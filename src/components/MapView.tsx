import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Info, Search, RefreshCw, Layers } from 'lucide-react';
import { RoadInfo, SpeedUnit, SimulationRoute } from '../types/speedometer';
import { fetchOsmRoadSpeed } from '../services/osmSpeedService';
import { SpeedSign } from './SpeedSign';

interface MapViewProps {
  currentPosition: { lat: number; lon: number; heading: number | null } | null;
  currentRoad: RoadInfo | null;
  speed: number;
  speedLimit: number | null;
  unit: SpeedUnit;
  isSpeeding: boolean;
  selectedRoute: SimulationRoute;
  currentWaypointIndex: number;
  onSelectWaypoint: (index: number) => void;
  onTeleportToLocation: (lat: number, lon: number, roadInfo: RoadInfo | null) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  currentPosition,
  currentRoad,
  speed,
  speedLimit,
  unit,
  isSpeeding,
  selectedRoute,
  currentWaypointIndex,
  onSelectWaypoint,
  onTeleportToLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const carMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);

  const [clickedRoad, setClickedRoad] = useState<RoadInfo | null>(null);
  const [isQueryingMapPoint, setIsQueryingMapPoint] = useState<boolean>(false);
  const [mapTheme, setMapTheme] = useState<'dark' | 'standard'>('dark');

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = currentPosition?.lat ?? 37.7942;
    const initialLon = currentPosition?.lon ?? -122.3951;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
    });

    // OpenStreetMap Standard Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Car Icon
    const carIconHtml = `
      <div style="transform: translate(-50%, -50%);" class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg ring-4 ring-red-500/40">
          <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
        </div>
      </div>
    `;

    const customCarIcon = L.divIcon({
      html: carIconHtml,
      className: 'car-leaflet-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([initialLat, initialLon], { icon: customCarIcon }).addTo(map);
    carMarkerRef.current = marker;

    // Handle map click to query OSM speed limit at clicked point
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setIsQueryingMapPoint(true);
      try {
        const road = await fetchOsmRoadSpeed(lat, lng, unit, 50);
        setClickedRoad(road);
      } catch (err) {
        console.warn('Map point query failed:', err);
      } finally {
        setIsQueryingMapPoint(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update car position when vehicle moves
  useEffect(() => {
    if (!mapInstanceRef.current || !carMarkerRef.current || !currentPosition) return;

    const { lat, lon } = currentPosition;
    carMarkerRef.current.setLatLng([lat, lon]);
    mapInstanceRef.current.panTo([lat, lon], { animate: true, duration: 0.6 });
  }, [currentPosition]);

  // Update Route Polyline & Waypoint Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old route
    if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
    }
    waypointMarkersRef.current.forEach((m) => mapInstanceRef.current?.removeLayer(m));
    waypointMarkersRef.current = [];

    const latlngs: [number, number][] = selectedRoute.waypoints.map((w) => [w.lat, w.lon]);
    
    // Draw route line
    const polyline = L.polyline(latlngs, {
      color: '#ef4444',
      weight: 5,
      opacity: 0.85,
      dashArray: '8, 8',
    }).addTo(mapInstanceRef.current);

    routePolylineRef.current = polyline;

    // Add waypoint dots
    selectedRoute.waypoints.forEach((wp, idx) => {
      const isCurrent = idx === currentWaypointIndex;
      const dotHtml = `
        <div class="w-4 h-4 rounded-full flex items-center justify-center ${
          isCurrent ? 'bg-amber-400 ring-4 ring-amber-400/50 scale-125' : 'bg-slate-700 border-2 border-white'
        } transition-all"></div>
      `;

      const dotIcon = L.divIcon({
        html: dotHtml,
        className: 'route-wp-dot',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const wpMarker = L.marker([wp.lat, wp.lon], { icon: dotIcon })
        .addTo(mapInstanceRef.current!)
        .on('click', () => onSelectWaypoint(idx));

      waypointMarkersRef.current.push(wpMarker);
    });
  }, [selectedRoute, currentWaypointIndex, onSelectWaypoint]);

  // Toggle map theme class
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapTheme === 'dark') {
      mapContainerRef.current.classList.add('dark-tiles');
    } else {
      mapContainerRef.current.classList.remove('dark-tiles');
    }
  }, [mapTheme]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* Top Map Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white text-sm">
            OpenStreetMap Speed Network
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">Click anywhere on map to query OSM road speed limit</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapTheme((t) => (t === 'dark' ? 'standard' : 'dark'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{mapTheme === 'dark' ? 'Cockpit Dark Map' : 'Standard Carto'}</span>
          </button>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div className="relative w-full h-[480px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Top Left Speed HUD Overlay */}
        <div className="absolute top-4 left-4 z-10 p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 flex items-center gap-3 shadow-xl">
          <SpeedSign speedLimit={speedLimit} unit={unit} size="sm" isOverLimit={isSpeeding} />
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Current Speed</div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {Math.round(speed)} <span className="text-xs font-normal text-slate-400">{unit}</span>
            </div>
          </div>
        </div>

        {/* Floating Clicked Road Inspector Popup */}
        {clickedRoad && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-10 p-4 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-700 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span>{clickedRoad.name}</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  highway: <span className="text-white">{clickedRoad.highwayType}</span> · id: #{clickedRoad.id}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SpeedSign speedLimit={clickedRoad.maxspeed} unit={unit} size="sm" />
                <button
                  onClick={() => setClickedRoad(null)}
                  className="text-slate-500 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">
                {clickedRoad.rawMaxspeedTag ? `maxspeed="${clickedRoad.rawMaxspeedTag}"` : 'OSM Legal Default'}
              </span>
              <button
                onClick={() => {
                  onTeleportToLocation(clickedRoad.lat, clickedRoad.lon, clickedRoad);
                  setClickedRoad(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
              >
                Drive Here in Simulator
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Route Waypoint Strip */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
        <div className="text-xs font-semibold text-white mb-2 flex items-center justify-between">
          <span>Active Route Waypoints ({selectedRoute.name})</span>
          <span className="text-[11px] font-mono text-slate-500">Tap waypoint to test</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {selectedRoute.waypoints.map((wp, idx) => {
            const isSelected = idx === currentWaypointIndex;
            return (
              <button
                key={idx}
                onClick={() => onSelectWaypoint(idx)}
                className={`p-2.5 rounded-xl border text-left shrink-0 transition-all ${
                  isSelected
                    ? 'bg-red-600/20 border-red-500 text-white shadow-sm ring-1 ring-red-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold truncate max-w-[140px] text-white">
                  {wp.roadName}
                </div>
                <div className="text-[10px] font-mono mt-1 flex items-center gap-2">
                  <span className="text-amber-400">Limit: {wp.osmSpeedLimitMph} {unit}</span>
                  <span className="text-slate-500">·</span>
                  <span>Speed: {wp.speed} {unit}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
