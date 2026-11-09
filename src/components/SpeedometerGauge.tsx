import React from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Navigation, 
  Radio, 
  Plus, 
  Minus, 
  RefreshCw, 
  Database,
  Sliders,
  Volume2,
  Bell,
  Download
} from 'lucide-react';
import { RoadInfo, SpeedUnit, RingSettings } from '../types/speedometer';
import { silenceAllVoices } from '../services/audioAlertEngine';
import { SpeedSign } from './SpeedSign';

interface SpeedometerGaugeProps {
  speed: number;
  unit: SpeedUnit;
  speedLimit: number | null;
  currentRoad: RoadInfo | null;
  isSpeeding: boolean;
  speedDelta: number;
  activeTier: 0 | 1 | 2 | 3;
  mode: 'gps' | 'simulator';
  setMode: (mode: 'gps' | 'simulator') => void;
  gpsStatus: 'idle' | 'acquiring' | 'active' | 'error' | 'denied';
  gpsAccuracy: number | null;
  startGps: () => void;
  stopGps: () => void;
  accelerate: (amount?: number) => void;
  brake: (amount?: number) => void;
  settings: RingSettings;
  updateSettings: (updater: (prev: RingSettings) => RingSettings) => void;
  onOpenStudio: () => void;
  onOpenSaveModal?: () => void;
  isLoadingOsm: boolean;
  forceOsmRefresh: () => void;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  speed,
  unit,
  speedLimit,
  currentRoad,
  isSpeeding,
  speedDelta,
  activeTier,
  mode,
  setMode,
  gpsStatus,
  gpsAccuracy,
  startGps,
  stopGps,
  accelerate,
  brake,
  settings,
  updateSettings,
  onOpenStudio,
  onOpenSaveModal,
  isLoadingOsm,
  forceOsmRefresh,
}) => {
  // SVG Arc calculation for speedometer dial
  // Range: 0 to 140 mph (or 220 kmh)
  const maxDial = unit === 'mph' ? 120 : 200;
  const clampedSpeed = Math.min(speed, maxDial);
  const percentage = (clampedSpeed / maxDial) * 100;
  
  // Circumference of radius 110: 2 * PI * 110 = ~691.15
  // We use a 240-degree arc: (240 / 360) * 691.15 = ~460.77
  const strokeDasharray = 460.8;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * (percentage / 100));

  // Limit tick position on dial
  const limitPercentage = speedLimit ? Math.min(speedLimit, maxDial) / maxDial : 0;
  const limitAngle = -120 + limitPercentage * 240; // -120 deg to +120 deg

  // Dynamic glow color
  const glowBorderClass = isSpeeding
    ? activeTier === 3
      ? 'border-red-500 shadow-2xl shadow-red-600/30 ring-2 ring-red-500/50'
      : activeTier === 2
      ? 'border-orange-500 shadow-xl shadow-orange-500/25 ring-2 ring-orange-500/40'
      : 'border-amber-500 shadow-lg shadow-amber-500/20'
    : 'border-slate-800';

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-6">
      {/* Top Telemetry & Mode Selector Bar */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 px-1">
        {/* Mode Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-900 border border-slate-800">
          <button
            onClick={() => {
              if (mode === 'gps') stopGps();
              setMode('simulator');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              mode === 'simulator'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Drive Simulator
          </button>
          <button
            onClick={() => {
              setMode('gps');
              startGps();
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              mode === 'gps'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${gpsStatus === 'active' ? 'text-emerald-400 animate-pulse' : ''}`} />
            <span>Live GPS</span>
          </button>
        </div>

        {/* GPS Status / OSM query indicator */}
        <div className="flex items-center gap-3">
          {mode === 'gps' && (
            <span className="flex items-center gap-1">
              <span>GPS:</span>
              <span
                className={`font-mono font-medium ${
                  gpsStatus === 'active'
                    ? 'text-emerald-400'
                    : gpsStatus === 'acquiring'
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              >
                {gpsStatus === 'active' ? `Locked (±${gpsAccuracy}m)` : gpsStatus}
              </span>
            </span>
          )}

          <button
            onClick={forceOsmRefresh}
            disabled={isLoadingOsm}
            title="Refresh OpenStreetMap Speed Limit"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingOsm ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">OSM Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Cockpit Speedometer Panel */}
      <div
        className={`relative w-full rounded-3xl bg-slate-900/90 border backdrop-blur-xl p-6 sm:p-8 flex flex-col items-center transition-all duration-300 ${glowBorderClass}`}
      >
        {/* Over-Speed Escalation Banner */}
        {isSpeeding ? (
          <div
            className={`w-full py-2.5 px-4 rounded-xl mb-4 flex items-center justify-between text-white font-medium animate-pulse ${
              activeTier === 3
                ? 'bg-red-600/90 text-white shadow-lg shadow-red-600/30'
                : activeTier === 2
                ? 'bg-orange-600/90 text-white shadow-md shadow-orange-600/25'
                : 'bg-amber-600/90 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="font-bold tracking-tight text-sm sm:text-base">
                OVER SPEED LIMIT (+{Math.round(speedDelta)} {unit.toUpperCase()})
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="bg-black/30 px-2 py-0.5 rounded">
                Tier {activeTier} Alert
              </span>
              <Volume2 className="w-4 h-4 animate-bounce" />
            </div>
          </div>
        ) : speedLimit !== null && speed > 0 ? (
          <div className="w-full py-1.5 px-4 rounded-xl mb-4 flex items-center justify-between text-emerald-400/90 bg-emerald-950/40 border border-emerald-900/50 text-xs font-mono">
            <span>SPEED OK</span>
            <span>{Math.round(speedLimit - speed)} {unit} below limit</span>
          </div>
        ) : null}

        {/* Central Dial & Signs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center w-full py-4">
          {/* Left Slot: Authentic OSM Speed Sign */}
          <div className="md:col-span-3 flex flex-col items-center justify-center space-y-2 order-2 md:order-1">
            <SpeedSign
              speedLimit={speedLimit}
              unit={unit}
              style={settings.signStyle}
              size="lg"
              isOverLimit={isSpeeding}
            />
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider text-center">
              OSM Speed Limit
            </span>
          </div>

          {/* Center Slot: Speedometer Gauge */}
          <div className="md:col-span-6 relative flex flex-col items-center justify-center order-1 md:order-2">
            {/* SVG Arc Gauge */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              <svg className="w-full h-full -rotate-210 transform" viewBox="0 0 260 260">
                {/* Background Track */}
                <circle
                  cx="130"
                  cy="130"
                  r="110"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="14"
                  strokeDasharray="460.8"
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />

                {/* Speed Progress Bar */}
                <circle
                  cx="130"
                  cy="130"
                  r="110"
                  fill="none"
                  stroke={
                    isSpeeding
                      ? activeTier === 3
                        ? '#ef4444'
                        : activeTier === 2
                        ? '#f97316'
                        : '#f59e0b'
                      : '#10b981'
                  }
                  strokeWidth="14"
                  strokeDasharray="460.8"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />

                {/* Tick markers */}
                {[0, 20, 40, 60, 80, 100].map((tick) => {
                  const angle = -120 + (tick / 100) * 240;
                  return (
                    <line
                      key={tick}
                      x1="130"
                      y1="24"
                      x2="130"
                      y2="32"
                      stroke="#475569"
                      strokeWidth="2"
                      transform={`rotate(${angle} 130 130)`}
                    />
                  );
                })}
              </svg>

              {/* Center Digital Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span
                  className={`font-mono font-extrabold tracking-tight tabular-nums leading-none ${
                    speed >= 100 ? 'text-6xl sm:text-7xl' : 'text-7xl sm:text-8xl'
                  } ${
                    isSpeeding
                      ? 'text-red-400'
                      : 'text-white'
                  }`}
                >
                  {Math.round(speed)}
                </span>
                <span className="font-mono text-sm tracking-wider text-slate-400 uppercase mt-1">
                  {unit}
                </span>
              </div>
            </div>

            {/* Quick Throttle & Brake controls for testing */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => brake(5)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
              >
                <Minus className="w-4 h-4 text-slate-400" />
                <span>Brake -5</span>
              </button>
              <button
                onClick={() => accelerate(3)}
                className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 active:scale-95 text-red-300 text-xs font-semibold border border-red-500/30 transition-all"
              >
                <Plus className="w-4 h-4 text-red-400" />
                <span>Throttle +3</span>
              </button>
            </div>
          </div>

          {/* Right Slot: Sound Settings Shortcut & Quick Stats */}
          <div className="md:col-span-3 flex flex-col items-center md:items-end justify-center space-y-3 order-3">
            <div className="w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs space-y-2.5">
              {/* Chime Only vs Voice Mode Toggle */}
              <div className="space-y-1">
                <span className="text-[11px] font-mono text-slate-400">ALERT OUTPUT</span>
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    onClick={() => updateSettings(silenceAllVoices)}
                    className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                      settings.mode === 'synth' && !settings.voice.enabled
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    <span>Chime Only</span>
                  </button>
                  <button
                    onClick={() =>
                      updateSettings((s) => ({
                        ...s,
                        mode: 'hybrid',
                        voice: { ...s.voice, enabled: true },
                      }))
                    }
                    className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                      settings.mode === 'hybrid' || (settings.voice.enabled && settings.mode !== 'synth')
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>+ Voice</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Tone Preset</span>
                <span className="font-mono text-white capitalize">{settings.selectedPreset.replace('-', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Tolerance</span>
                <span className="font-mono text-white">+{settings.toleranceValue} {unit}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Voice Warning</span>
                <span className={`font-mono ${settings.voice.enabled && settings.mode !== 'synth' ? 'text-blue-400' : 'text-slate-500'}`}>
                  {settings.voice.enabled && settings.mode !== 'synth' ? 'Active' : 'Off (Chime Only)'}
                </span>
              </div>
            </div>

            <button
              onClick={onOpenStudio}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Customize Rings</span>
            </button>

            {onOpenSaveModal && (
              <button
                onClick={onOpenSaveModal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Install / Save App</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Road & OSM Metadata Card */}
        <div className="w-full mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">
                {currentRoad?.name || 'Road not recognized'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                highway: {currentRoad?.highwayType || 'unknown'}
              </span>
              {currentRoad?.rawMaxspeedTag && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                  osm tag: maxspeed={currentRoad.rawMaxspeedTag}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Source:{' '}
              {currentRoad?.source === 'osm-maxspeed'
                ? 'OpenStreetMap (Explicit Tag)'
                : currentRoad?.source === 'osm-roadtype-default'
                ? 'OSM Legal Default by Road Type'
                : 'Simulated Route'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
