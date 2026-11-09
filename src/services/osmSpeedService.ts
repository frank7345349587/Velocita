import { RoadInfo, SpeedLimitSource, SpeedUnit } from '../types/speedometer';

// Overpass API public endpoints for redundancy
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OsmWayElement {
  id: number;
  type: string;
  tags?: {
    highway?: string;
    maxspeed?: string;
    name?: string;
    'name:en'?: string;
    ref?: string;
    lanes?: string;
    oneway?: string;
    surface?: string;
    source?: string;
    [key: string]: string | undefined;
  };
  center?: {
    lat: number;
    lon: number;
  };
}

// In-memory cache to prevent duplicate queries for adjacent GPS points
interface CacheEntry {
  timestamp: number;
  data: RoadInfo;
  lat: number;
  lon: number;
}
const roadCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Calculates distance between two coordinates in meters (Haversine formula)
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Default fallback speed limits based on OSM road classification when explicit `maxspeed` is absent
 */
export function getDefaultSpeedForHighwayType(highwayType: string, unit: SpeedUnit): number {
  const isMph = unit === 'mph';

  switch (highwayType) {
    case 'motorway':
    case 'motorway_link':
      return isMph ? 65 : 110;
    case 'trunk':
    case 'trunk_link':
      return isMph ? 55 : 90;
    case 'primary':
    case 'primary_link':
      return isMph ? 45 : 70;
    case 'secondary':
    case 'secondary_link':
      return isMph ? 35 : 60;
    case 'tertiary':
    case 'tertiary_link':
      return isMph ? 30 : 50;
    case 'residential':
      return isMph ? 25 : 40;
    case 'living_street':
    case 'pedestrian':
      return isMph ? 15 : 20;
    case 'service':
    case 'track':
      return isMph ? 15 : 25;
    case 'unclassified':
    default:
      return isMph ? 30 : 50;
  }
}

/**
 * Parses raw OSM maxspeed tag values like "25 mph", "50 km/h", "50", "signals", "walk", "none"
 */
export function parseOsmMaxspeed(rawVal: string | undefined, targetUnit: SpeedUnit): { speed: number | null; source: SpeedLimitSource } {
  if (!rawVal) {
    return { speed: null, source: 'osm-roadtype-default' };
  }

  const clean = rawVal.trim().toLowerCase();

  if (clean === 'none') {
    // e.g. German Autobahn unrestricted
    return { speed: targetUnit === 'mph' ? 80 : 130, source: 'osm-maxspeed' };
  }

  if (clean === 'walk') {
    return { speed: targetUnit === 'mph' ? 4 : 7, source: 'osm-maxspeed' };
  }

  // Check explicit unit suffixes
  if (clean.endsWith('mph')) {
    const num = parseFloat(clean.replace('mph', '').trim());
    if (!isNaN(num)) {
      const speed = targetUnit === 'mph' ? Math.round(num) : Math.round(num * 1.60934);
      return { speed, source: 'osm-maxspeed' };
    }
  }

  if (clean.endsWith('km/h') || clean.endsWith('kmh') || clean.endsWith('kph')) {
    const num = parseFloat(clean.replace(/km\/h|kmh|kph/, '').trim());
    if (!isNaN(num)) {
      const speed = targetUnit === 'kmh' ? Math.round(num) : Math.round(num / 1.60934);
      return { speed, source: 'osm-maxspeed' };
    }
  }

  // Handle formats like "US:urban", "DE:rural", "FR:urban"
  if (clean.includes(':')) {
    if (clean.includes('urban') || clean.includes('zone30')) {
      return { speed: targetUnit === 'mph' ? 25 : 40, source: 'osm-maxspeed' };
    }
    if (clean.includes('rural')) {
      return { speed: targetUnit === 'mph' ? 50 : 80, source: 'osm-maxspeed' };
    }
    if (clean.includes('motorway') || clean.includes('autobahn')) {
      return { speed: targetUnit === 'mph' ? 65 : 110, source: 'osm-maxspeed' };
    }
  }

  // Pure numeric value (standard in OSM: km/h in most of world, mph in UK/US)
  // If no unit is specified and it's a number:
  const numericMatch = clean.match(/^(\d+(\.\d+)?)/);
  if (numericMatch) {
    const num = parseFloat(numericMatch[1]);
    if (!isNaN(num)) {
      // In OSM standard specification: numeric without unit is km/h.
      // However if target unit is mph and the number is typically US speed limit (15, 25, 35, 45, 55, 65, 70),
      // we check target unit or convert if strictly km/h.
      let speedInTarget = num;
      if (targetUnit === 'mph') {
        // If the number looks like standard km/h (>45 and target is mph) or standard km/h scale
        if (num > 55 && num % 10 === 0 && num <= 130) {
          speedInTarget = Math.round(num / 1.60934);
        } else {
          speedInTarget = Math.round(num);
        }
      } else {
        // Target is km/h
        if (num <= 45 && [15, 25, 30, 35, 40, 45].includes(num)) {
          // likely entered as mph
          speedInTarget = Math.round(num * 1.60934);
        } else {
          speedInTarget = Math.round(num);
        }
      }
      return { speed: speedInTarget, source: 'osm-maxspeed' };
    }
  }

  return { speed: null, source: 'osm-roadtype-default' };
}

/**
 * Fetch road and speed limit data from OpenStreetMap Overpass API
 */
export async function fetchOsmRoadSpeed(
  lat: number,
  lon: number,
  unit: SpeedUnit,
  radiusMeters: number = 45
): Promise<RoadInfo | null> {
  // Check if we have a recent cached road near this coordinate (< 25m)
  const now = Date.now();
  for (const [_, entry] of roadCache) {
    if (now - entry.timestamp < CACHE_TTL_MS) {
      const dist = getDistanceMeters(lat, lon, entry.lat, entry.lon);
      if (dist < 25) {
        // Recalculate converted speed if unit changed
        let speed = entry.data.maxspeed;
        if (entry.data.rawMaxspeedTag) {
          const parsed = parseOsmMaxspeed(entry.data.rawMaxspeedTag, unit);
          speed = parsed.speed;
        } else if (entry.data.highwayType) {
          speed = getDefaultSpeedForHighwayType(entry.data.highwayType, unit);
        }
        return {
          ...entry.data,
          maxspeed: speed,
          distanceMeters: Math.round(dist),
        };
      }
    }
  }

  // Construct Overpass QL query:
  // Find highway ways within radius of current GPS coordinates
  const query = `[out:json][timeout:6];way(around:${radiusMeters},${lat.toFixed(6)},${lon.toFixed(6)})["highway"];out tags center;`;

  let responseData: { elements?: OsmWayElement[] } | null = null;
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        responseData = await res.json();
        if (responseData && responseData.elements) {
          break; // successfully fetched
        }
      }
    } catch (err: any) {
      lastError = err;
      // Continue to next mirror endpoint
    }
  }

  if (!responseData || !responseData.elements || responseData.elements.length === 0) {
    // If Overpass didn't find any highways within radius or failed, try reverse geocoding via Nominatim as fallback
    return fetchNominatimFallback(lat, lon, unit);
  }

  // Filter highways, rank by proximity to current location
  const elements = responseData.elements.filter((el) => el.tags && el.tags.highway);
  if (elements.length === 0) {
    return fetchNominatimFallback(lat, lon, unit);
  }

  // Find closest way
  let closestElement: OsmWayElement = elements[0];
  let minDistance = Infinity;

  for (const el of elements) {
    if (el.center) {
      const dist = getDistanceMeters(lat, lon, el.center.lat, el.center.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closestElement = el;
      }
    }
  }

  const tags = closestElement.tags || {};
  const highwayType = tags.highway || 'residential';
  const roadName = tags.name || tags['name:en'] || tags.ref || `${capitalize(highwayType)} Road`;
  const rawMaxspeed = tags.maxspeed;

  let maxspeed: number | null = null;
  let source: SpeedLimitSource = 'osm-roadtype-default';

  if (rawMaxspeed) {
    const parsed = parseOsmMaxspeed(rawMaxspeed, unit);
    if (parsed.speed !== null) {
      maxspeed = parsed.speed;
      source = parsed.source;
    }
  }

  if (maxspeed === null) {
    maxspeed = getDefaultSpeedForHighwayType(highwayType, unit);
    source = 'osm-roadtype-default';
  }

  const roadInfo: RoadInfo = {
    id: closestElement.id,
    name: roadName,
    highwayType,
    maxspeed,
    rawMaxspeedTag: rawMaxspeed,
    lanes: tags.lanes ? parseInt(tags.lanes, 10) : undefined,
    oneway: tags.oneway === 'yes',
    surface: tags.surface,
    source,
    lat,
    lon,
    distanceMeters: isFinite(minDistance) ? Math.round(minDistance) : undefined,
  };

  // Cache result
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  roadCache.set(cacheKey, {
    timestamp: now,
    data: roadInfo,
    lat,
    lon,
  });

  return roadInfo;
}

/**
 * Fallback to Nominatim reverse lookup if Overpass is temporarily saturated
 */
async function fetchNominatimFallback(lat: number, lon: number, unit: SpeedUnit): Promise<RoadInfo | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const address = data.address || {};
    const roadName = address.road || address.pedestrian || address.highway || 'Public Road';
    
    // Default residential/secondary speed
    const defaultSpeed = unit === 'mph' ? 30 : 50;

    return {
      id: data.osm_id || `nom-${Date.now()}`,
      name: roadName,
      highwayType: address.highway || 'residential',
      maxspeed: defaultSpeed,
      source: 'osm-roadtype-default',
      lat,
      lon,
    };
  } catch {
    return null;
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pre-packaged realistic simulation routes with authentic OpenStreetMap roads and speed limits
 */
export const PRESET_SIMULATION_ROUTES = [
  {
    id: 'sf-coastal',
    name: 'San Francisco: Embarcadero to US-101',
    city: 'San Francisco, CA',
    description: 'Transition from 25 mph downtown waterfront to 45 mph arterial to 65 mph freeway.',
    waypoints: [
      { lat: 37.7942, lon: -122.3951, speed: 22, roadName: 'The Embarcadero', highwayType: 'secondary', osmSpeedLimitMph: 25 },
      { lat: 37.7915, lon: -122.3905, speed: 28, roadName: 'Mission Street', highwayType: 'primary', osmSpeedLimitMph: 25 }, // triggers alert!
      { lat: 37.7865, lon: -122.3892, speed: 32, roadName: 'King Street', highwayType: 'primary', osmSpeedLimitMph: 30 },
      { lat: 37.7785, lon: -122.3932, speed: 42, roadName: '4th Street Approach', highwayType: 'primary', osmSpeedLimitMph: 35 },
      { lat: 37.7720, lon: -122.4045, speed: 52, roadName: 'I-80 W Ramp', highwayType: 'motorway_link', osmSpeedLimitMph: 45 },
      { lat: 37.7650, lon: -122.4100, speed: 72, roadName: 'US-101 S (James Lick Freeway)', highwayType: 'motorway', osmSpeedLimitMph: 65 }, // triggers alert!
      { lat: 37.7550, lon: -122.4150, speed: 78, roadName: 'US-101 S Freeway', highwayType: 'motorway', osmSpeedLimitMph: 65 }, // high tier alert!
      { lat: 37.7450, lon: -122.4200, speed: 64, roadName: 'US-101 S (Cesar Chavez exit)', highwayType: 'motorway', osmSpeedLimitMph: 65 },
    ],
  },
  {
    id: 'nyc-broadway',
    name: 'New York City: Midtown to FDR Drive',
    city: 'New York, NY',
    description: 'Dense 25 mph Manhattan grid connecting into 40 mph FDR Expressway.',
    waypoints: [
      { lat: 40.7580, lon: -73.9855, speed: 18, roadName: '7th Avenue (Times Square)', highwayType: 'primary', osmSpeedLimitMph: 25 },
      { lat: 40.7549, lon: -73.9840, speed: 29, roadName: 'West 42nd Street', highwayType: 'primary', osmSpeedLimitMph: 25 }, // over limit!
      { lat: 40.7510, lon: -73.9770, speed: 24, roadName: 'Lexington Avenue', highwayType: 'secondary', osmSpeedLimitMph: 25 },
      { lat: 40.7480, lon: -73.9730, speed: 36, roadName: 'East 34th Street', highwayType: 'primary', osmSpeedLimitMph: 25 }, // +11 over!
      { lat: 40.7430, lon: -73.9710, speed: 44, roadName: 'FDR Drive Northbound', highwayType: 'trunk', osmSpeedLimitMph: 40 },
      { lat: 40.7520, lon: -73.9650, speed: 55, roadName: 'FDR Drive Express', highwayType: 'trunk', osmSpeedLimitMph: 40 }, // +15 over!
      { lat: 40.7600, lon: -73.9580, speed: 39, roadName: 'FDR Drive / 63rd St', highwayType: 'trunk', osmSpeedLimitMph: 40 },
    ],
  },
  {
    id: 'school-zone-corridor',
    name: 'Suburban School Zone & Residential Arc',
    city: 'Austin, TX',
    description: 'Strict 20 mph active school zone with instant over-speed triggers, into 35 mph suburban parkway.',
    waypoints: [
      { lat: 30.2850, lon: -97.7420, speed: 24, roadName: 'University Parkway', highwayType: 'secondary', osmSpeedLimitMph: 30 },
      { lat: 30.2880, lon: -97.7410, speed: 26, roadName: 'Elementary School Crosswalk', highwayType: 'residential', osmSpeedLimitMph: 20 }, // +6 over in school zone!
      { lat: 30.2910, lon: -97.7400, speed: 32, roadName: 'Lincoln Way School Zone', highwayType: 'residential', osmSpeedLimitMph: 20 }, // +12 over!
      { lat: 30.2940, lon: -97.7380, speed: 19, roadName: 'Oak Ridge School Gate', highwayType: 'residential', osmSpeedLimitMph: 20 },
      { lat: 30.2980, lon: -97.7350, speed: 38, roadName: 'Lamar Boulevard', highwayType: 'primary', osmSpeedLimitMph: 35 },
    ],
  },
  {
    id: 'german-autobahn',
    name: 'Munich: Inner Ring to Autobahn A9',
    city: 'Munich, Germany',
    description: 'European metric test: 50 km/h city street to 80 km/h ring to 130 km/h highway.',
    waypoints: [
      { lat: 48.1375, lon: 11.5755, speed: 45, roadName: 'Maximilianstraße', highwayType: 'secondary', osmSpeedLimitMph: 31 }, // ~50 km/h
      { lat: 48.1480, lon: 11.5850, speed: 58, roadName: 'Prinzregentenstraße', highwayType: 'primary', osmSpeedLimitMph: 31 }, // ~50 km/h (+16 km/h over!)
      { lat: 48.1650, lon: 11.6050, speed: 75, roadName: 'Mittlerer Ring (B2R)', highwayType: 'trunk', osmSpeedLimitMph: 50 }, // 80 km/h
      { lat: 48.1850, lon: 11.6150, speed: 92, roadName: 'Mittlerer Ring Tunnel', highwayType: 'trunk', osmSpeedLimitMph: 50 }, // 80 km/h (+25 km/h over!)
      { lat: 48.2100, lon: 11.6250, speed: 120, roadName: 'Bundesautobahn 9 (A9)', highwayType: 'motorway', osmSpeedLimitMph: 81 }, // 130 km/h
      { lat: 48.2450, lon: 11.6350, speed: 145, roadName: 'Bundesautobahn 9 (Garching)', highwayType: 'motorway', osmSpeedLimitMph: 81 }, // 130 km/h (+15 km/h over!)
    ],
  },
];
