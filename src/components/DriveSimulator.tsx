import React from 'react';
import { Play, Pause, Plus, Minus, RotateCcw, Navigation, Gauge, ShieldAlert } from 'lucide-react';
import { SimulationRoute, SpeedUnit, RoadInfo } from '../types/speedometer';
import { PRESET_SIMULATION_ROUTES } from '../services/osmSpeedService';
import { SpeedSign } from './SpeedSign';

interface DriveSimulatorProps {
  speed: number;
  setSpeed: (speed: number) => void;
  speedLimit: number | null;
  unit: SpeedUnit;
  isSpeeding: boolean;
  activeTier: 0 | 1 | 2 | 3;
  currentRoad: RoadInfo | null;
  selectedRoute: SimulationRoute;
  setSelectedRoute: (route: SimulationRoute) => void;
  isSimDriving: boolean;
  toggleSimDrive: () => void;
  currentWaypointIndex: number;
  goToWaypoint: (index: number) => void;
  accelerate: (amount?: number) => void;
  brake: (amount?: number) => void;
}

export const DriveSimulator: React.FC<DriveSimulatorProps> = ({
  speed,
  setSpeed,
  speedLimit,
  unit,
  isSpeeding,
  activeTier,
  currentRoad,
  selectedRoute,
  setSelectedRoute,
  isSimDriving,
  toggleSimDrive,
  currentWaypointIndex,
  goToWaypoint,
  accelerate,
  brake,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Simulator Hero & Control Strip */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-sans text-white">Drive Simulator &amp; Test Bench</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Interactive
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Test and audition your customizable over-speed alerts right from your desk without needing to get into a car.
          </p>
        </div>

        {/* Auto Cruise Toggle */}
        <button
          onClick={toggleSimDrive}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs shadow-md transition-all shrink-0 ${
            isSimDriving
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
          }`}
        >
          {isSimDriving ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
          <span>{isSimDriving ? 'Pause Auto Cruise' : 'Start Auto Cruise Route'}</span>
        </button>
      </div>

      {/* Speed Slider & Throttle Panel */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs uppercase font-mono text-slate-500">Current Simulated Speed</div>
            <div className="text-4xl font-extrabold font-mono text-white tracking-tight tabular-nums mt-0.5">
              {Math.round(speed)} <span className="text-sm font-normal text-slate-400 uppercase">{unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SpeedSign speedLimit={speedLimit} unit={unit} size="sm" isOverLimit={isSpeeding} />
            <div className="text-left">
              <div className="text-xs font-semibold text-white">{currentRoad?.name}</div>
              <div className="text-[11px] font-mono text-slate-400">
                Speed Limit: {speedLimit} {unit}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Speed Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>0 {unit}</span>
            <span className="text-amber-400 font-semibold">Speed Limit: {speedLimit} {unit}</span>
            <span>{unit === 'mph' ? '120 mph' : '200 km/h'}</span>
          </div>

          <input
            type="range"
            min="0"
            max={unit === 'mph' ? 120 : 200}
            step="1"
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
            className="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        {/* Quick Stepping Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => brake(10)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-800 transition-all"
          >
            <Minus className="w-4 h-4 text-slate-400" />
            <span>Hard Brake (-10)</span>
          </button>
          <button
            onClick={() => brake(3)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-800 transition-all"
          >
            <Minus className="w-3.5 h-3.5 text-slate-400" />
            <span>Brake (-3)</span>
          </button>
          <button
            onClick={() => accelerate(3)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-800 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-red-400" />
            <span>Throttle (+3)</span>
          </button>
          <button
            onClick={() => accelerate(10)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 active:scale-95 text-red-300 text-xs font-semibold border border-red-500/30 transition-all"
          >
            <Plus className="w-4 h-4 text-red-400" />
            <span>Sprint (+10)</span>
          </button>
        </div>
      </div>

      {/* Preset Route Selector Cards */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Select Real OpenStreetMap Test Corridor
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRESET_SIMULATION_ROUTES.map((route) => {
            const isSelected = selectedRoute.id === route.id;
            return (
              <button
                key={route.id}
                onClick={() => setSelectedRoute(route)}
                className={`p-4 rounded-2xl text-left border transition-all ${
                  isSelected
                    ? 'bg-red-500/10 border-red-500 text-white shadow-md ring-1 ring-red-500'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-white">{route.name}</div>
                  <span className="text-[10px] font-mono text-slate-400">{route.city}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{route.description}</p>
                <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                  <span>{route.waypoints.length} waypoints</span>
                  <span>·</span>
                  <span>Range: {route.waypoints[0].osmSpeedLimitMph} to {route.waypoints[route.waypoints.length - 2].osmSpeedLimitMph} {unit}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Waypoint Steps */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Route Segments ({selectedRoute.name})
        </h3>
        <div className="space-y-2">
          {selectedRoute.waypoints.map((wp, idx) => {
            const isCurrent = idx === currentWaypointIndex;
            return (
              <div
                key={idx}
                onClick={() => goToWaypoint(idx)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-slate-800 border-red-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-medium text-xs text-white">{wp.roadName}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      highway: {wp.highwayType}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-amber-400">Limit: {wp.osmSpeedLimitMph} {unit}</span>
                  <span className="text-slate-300">Target: {wp.speed} {unit}</span>
                  {wp.speed > wp.osmSpeedLimitMph && (
                    <span className="px-2 py-0.5 rounded bg-red-600/30 text-red-400 text-[10px] font-bold">
                      ALARM
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
