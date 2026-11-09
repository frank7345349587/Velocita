import { useEffect, useRef, useState, useCallback } from 'react';
import { RoadInfo, SpeedUnit, RingSettings, SimulationRoute } from '../types/speedometer';
import { fetchOsmRoadSpeed, PRESET_SIMULATION_ROUTES, getDistanceMeters } from '../services/osmSpeedService';
import { alertEngine, DEFAULT_RING_SETTINGS } from '../services/audioAlertEngine';

export interface UseSpeedometerReturn {
  // Speed & Limits
  speed: number;
  unit: SpeedUnit;
  setUnit: (unit: SpeedUnit) => void;
  speedLimit: number | null;
  setManualSpeedLimit: (limit: number | null) => void;
  currentRoad: RoadInfo | null;
  isSpeeding: boolean;
  speedDelta: number;
  activeTier: 0 | 1 | 2 | 3;
  
  // Tracking Mode & GPS
  mode: 'gps' | 'simulator';
  setMode: (mode: 'gps' | 'simulator') => void;
  gpsStatus: 'idle' | 'acquiring' | 'active' | 'error' | 'denied';
  gpsAccuracy: number | null;
  currentPosition: { lat: number; lon: number; heading: number | null } | null;
  startGps: () => void;
  stopGps: () => void;
  
  // Simulator State & Controls
  selectedRoute: SimulationRoute;
  setSelectedRoute: (route: SimulationRoute) => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  isSimDriving: boolean;
  toggleSimDrive: () => void;
  currentWaypointIndex: number;
  goToWaypoint: (index: number) => void;
  accelerate: (amount?: number) => void;
  brake: (amount?: number) => void;
  
  // Settings & Ring Configuration
  settings: RingSettings;
  updateSettings: (updater: (prev: RingSettings) => RingSettings) => void;
  isStrobing: boolean;
  isLoadingOsm: boolean;
  lastOsmUpdate: Date | null;
  forceOsmRefresh: () => void;
}

export function useSpeedometer(): UseSpeedometerReturn {
  const [unit, setUnitState] = useState<SpeedUnit>('mph');
  const [speed, setSpeed] = useState<number>(0);
  const [manualLimit, setManualLimit] = useState<number | null>(null);
  const [currentRoad, setCurrentRoad] = useState<RoadInfo | null>(null);
  const [mode, setMode] = useState<'gps' | 'simulator'>('simulator');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'active' | 'error' | 'denied'>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lon: number; heading: number | null } | null>({
    lat: PRESET_SIMULATION_ROUTES[0].waypoints[0].lat,
    lon: PRESET_SIMULATION_ROUTES[0].waypoints[0].lon,
    heading: 45,
  });

  // Settings
  const [settings, setSettings] = useState<RingSettings>(() => {
    try {
      const saved = localStorage.getItem('velocita_ring_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode === 'synth' || !parsed.voice?.enabled) {
          if (parsed.tiers?.tier1) parsed.tiers.tier1.enableVoice = false;
          if (parsed.tiers?.tier2) parsed.tiers.tier2.enableVoice = false;
          if (parsed.tiers?.tier3) parsed.tiers.tier3.enableVoice = false;
        }
        return { ...DEFAULT_RING_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_RING_SETTINGS;
  });

  // Simulation controls
  const [selectedRoute, setSelectedRoute] = useState<SimulationRoute>(PRESET_SIMULATION_ROUTES[0]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState<number>(0);
  const [simSpeed, setSimSpeedState] = useState<number>(24);
  const [isSimDriving, setIsSimDriving] = useState<boolean>(false);
  const [isLoadingOsm, setIsLoadingOsm] = useState<boolean>(false);
  const [lastOsmUpdate, setLastOsmUpdate] = useState<Date | null>(null);
  const [isStrobing, setIsStrobing] = useState<boolean>(false);

  // Refs for tracking changes without re-renders
  const watchIdRef = useRef<number | null>(null);
  const lastCoordRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const lastOsmQueryCoordRef = useRef<{ lat: number; lon: number } | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Persist settings
  const updateSettings = useCallback((updater: (prev: RingSettings) => RingSettings) => {
    setSettings((prev) => {
      const updated = updater(prev);
      try {
        localStorage.setItem('velocita_ring_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const setUnit = useCallback((newUnit: SpeedUnit) => {
    setUnitState((prevUnit) => {
      if (prevUnit === newUnit) return prevUnit;
      // Convert speed when switching unit
      setSpeed((s) => (newUnit === 'kmh' ? Math.round(s * 1.60934) : Math.round(s / 1.60934)));
      setSimSpeedState((s) => (newUnit === 'kmh' ? Math.round(s * 1.60934) : Math.round(s / 1.60934)));
      return newUnit;
    });
  }, []);

  // Determine effective speed limit
  const effectiveLimit = manualLimit !== null 
    ? manualLimit 
    : currentRoad?.maxspeed !== undefined 
      ? currentRoad.maxspeed 
      : null;

  // Compute speeding status and tier
  const speedDelta = effectiveLimit !== null ? speed - effectiveLimit : 0;
  
  // Calculate threshold based on settings
  const tolerance = settings.toleranceType === 'percentage' 
    ? (effectiveLimit ? (effectiveLimit * settings.toleranceValue) / 100 : 0)
    : settings.toleranceValue;

  const isSpeeding = effectiveLimit !== null && speed >= effectiveLimit + tolerance && speed > 2;

  // Compute active escalation tier (0 = safe, 1 = mild, 2 = moderate, 3 = severe)
  let activeTier: 0 | 1 | 2 | 3 = 0;
  if (isSpeeding && effectiveLimit !== null) {
    if (settings.useMultiTier) {
      if (speedDelta >= settings.tiers.tier3.offset) {
        activeTier = 3;
      } else if (speedDelta >= settings.tiers.tier2.offset) {
        activeTier = 2;
      } else {
        activeTier = 1;
      }
    } else {
      activeTier = 1;
    }
  }

  // Handle alert loop with audio engine
  useEffect(() => {
    if (isSpeeding && effectiveLimit !== null && !settings.isMuted) {
      alertEngine.startAlertLoop(
        settings,
        activeTier || 1,
        speedDelta,
        {
          speed,
          limit: effectiveLimit,
          unit: unit === 'mph' ? 'miles per hour' : 'kilometers per hour',
          roadName: currentRoad?.name,
        }
      );

      // Strobe visual state
      if (settings.strobeScreen) {
        setIsStrobing(true);
      }
    } else {
      alertEngine.stopAlertLoop();
      setIsStrobing(false);
    }

    return () => {
      alertEngine.stopAlertLoop();
    };
  }, [isSpeeding, activeTier, effectiveLimit, settings, speedDelta, speed, unit, currentRoad?.name]);

  // Query OpenStreetMap when position changes
  const queryOsmRoad = useCallback(async (lat: number, lon: number, force: boolean = false) => {
    if (!force && lastOsmQueryCoordRef.current) {
      const dist = getDistanceMeters(
        lat,
        lon,
        lastOsmQueryCoordRef.current.lat,
        lastOsmQueryCoordRef.current.lon
      );
      if (dist < 20) return; // Haven't moved far enough to warrant new OSM query
    }

    setIsLoadingOsm(true);
    lastOsmQueryCoordRef.current = { lat, lon };

    try {
      const road = await fetchOsmRoadSpeed(lat, lon, unit);
      if (road) {
        setCurrentRoad(road);
        setLastOsmUpdate(new Date());
      }
    } catch (err) {
      console.warn('OSM query failed:', err);
    } finally {
      setIsLoadingOsm(false);
    }
  }, [unit]);

  const forceOsmRefresh = useCallback(() => {
    if (currentPosition) {
      queryOsmRoad(currentPosition.lat, currentPosition.lon, true);
    }
  }, [currentPosition, queryOsmRoad]);

  // Start GPS tracking
  const startGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      return;
    }

    setGpsStatus('acquiring');
    setMode('gps');

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus('active');
        const { latitude, longitude, speed: rawSpeed, accuracy, heading } = pos.coords;

        setGpsAccuracy(accuracy ? Math.round(accuracy) : null);
        setCurrentPosition({
          lat: latitude,
          lon: longitude,
          heading: heading ?? null,
        });

        // Convert GPS speed (m/s) to target unit
        let calculatedSpeed = 0;
        if (rawSpeed !== null && rawSpeed >= 0) {
          calculatedSpeed = unit === 'mph' ? rawSpeed * 2.23694 : rawSpeed * 3.6;
        } else if (lastCoordRef.current) {
          // Fallback: calculate speed from coordinate delta if coords.speed is null
          const timeDeltaSec = (pos.timestamp - lastCoordRef.current.time) / 1000;
          if (timeDeltaSec > 0.5 && timeDeltaSec < 15) {
            const dist = getDistanceMeters(
              lastCoordRef.current.lat,
              lastCoordRef.current.lon,
              latitude,
              longitude
            );
            const speedMps = dist / timeDeltaSec;
            calculatedSpeed = unit === 'mph' ? speedMps * 2.23694 : speedMps * 3.6;
          }
        }

        lastCoordRef.current = {
          lat: latitude,
          lon: longitude,
          time: pos.timestamp,
        };

        setSpeed(Math.max(0, Math.round(calculatedSpeed)));
        queryOsmRoad(latitude, longitude);
      },
      (err) => {
        console.warn('GPS watchPosition error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  }, [unit, queryOsmRoad]);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setGpsStatus('idle');
  }, []);

  // Simulator controls
  const setSimSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(0, Math.min(180, Math.round(newSpeed)));
    setSimSpeedState(clamped);
    if (mode === 'simulator') {
      setSpeed(clamped);
    }
  }, [mode]);

  const accelerate = useCallback((amount: number = 3) => {
    setSimSpeed(simSpeed + amount);
  }, [setSimSpeed, simSpeed]);

  const brake = useCallback((amount: number = 5) => {
    setSimSpeed(Math.max(0, simSpeed - amount));
  }, [setSimSpeed, simSpeed]);

  const goToWaypoint = useCallback((index: number) => {
    if (!selectedRoute.waypoints[index]) return;
    const wp = selectedRoute.waypoints[index];
    setCurrentWaypointIndex(index);
    setCurrentPosition({
      lat: wp.lat,
      lon: wp.lon,
      heading: 90,
    });

    const targetLimit = unit === 'mph' 
      ? wp.osmSpeedLimitMph 
      : Math.round(wp.osmSpeedLimitMph * 1.60934);

    const targetSimSpeed = unit === 'mph' 
      ? wp.speed 
      : Math.round(wp.speed * 1.60934);

    setSimSpeedState(targetSimSpeed);
    if (mode === 'simulator') {
      setSpeed(targetSimSpeed);
    }

    setCurrentRoad({
      id: `sim-${wp.roadName}`,
      name: wp.roadName,
      highwayType: wp.highwayType,
      maxspeed: targetLimit,
      rawMaxspeedTag: `${targetLimit} ${unit}`,
      source: 'simulated-route',
      lat: wp.lat,
      lon: wp.lon,
    });
    setLastOsmUpdate(new Date());
  }, [selectedRoute, unit, mode]);

  const toggleSimDrive = useCallback(() => {
    setIsSimDriving((prev) => !prev);
  }, []);

  // Handle route change
  useEffect(() => {
    if (mode === 'simulator') {
      goToWaypoint(0);
    }
  }, [selectedRoute, mode, goToWaypoint]);

  // Automated drive progress in simulator
  useEffect(() => {
    if (!isSimDriving || mode !== 'simulator') return;

    const interval = setInterval(() => {
      setCurrentWaypointIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % selectedRoute.waypoints.length;
        const wp = selectedRoute.waypoints[nextIndex];
        
        setCurrentPosition({
          lat: wp.lat,
          lon: wp.lon,
          heading: 90,
        });

        const targetLimit = unit === 'mph' 
          ? wp.osmSpeedLimitMph 
          : Math.round(wp.osmSpeedLimitMph * 1.60934);

        const targetSimSpeed = unit === 'mph' 
          ? wp.speed 
          : Math.round(wp.speed * 1.60934);

        setSimSpeedState(targetSimSpeed);
        setSpeed(targetSimSpeed);

        setCurrentRoad({
          id: `sim-${wp.roadName}`,
          name: wp.roadName,
          highwayType: wp.highwayType,
          maxspeed: targetLimit,
          rawMaxspeedTag: `${targetLimit} ${unit}`,
          source: 'simulated-route',
          lat: wp.lat,
          lon: wp.lon,
        });
        setLastOsmUpdate(new Date());

        return nextIndex;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [isSimDriving, mode, selectedRoute, unit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      alertEngine.stopAlertLoop();
    };
  }, []);

  return {
    speed,
    unit,
    setUnit,
    speedLimit: effectiveLimit,
    setManualSpeedLimit: setManualLimit,
    currentRoad,
    isSpeeding,
    speedDelta,
    activeTier,
    mode,
    setMode,
    gpsStatus,
    gpsAccuracy,
    currentPosition,
    startGps,
    stopGps,
    selectedRoute,
    setSelectedRoute,
    simSpeed,
    setSimSpeed,
    isSimDriving,
    toggleSimDrive,
    currentWaypointIndex,
    goToWaypoint,
    accelerate,
    brake,
    settings,
    updateSettings,
    isStrobing,
    isLoadingOsm,
    lastOsmUpdate,
    forceOsmRefresh,
  };
}
