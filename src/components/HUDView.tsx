import React, { useState } from 'react';
import { Maximize2, Minimize2, FlipVertical, FlipHorizontal, ArrowLeft, Volume2 } from 'lucide-react';
import { SpeedUnit, RoadInfo, RingSettings } from '../types/speedometer';
import { SpeedSign } from './SpeedSign';

interface HUDViewProps {
  speed: number;
  unit: SpeedUnit;
  speedLimit: number | null;
  currentRoad: RoadInfo | null;
  isSpeeding: boolean;
  speedDelta: number;
  activeTier: 0 | 1 | 2 | 3;
  settings: RingSettings;
  onExitHud: () => void;
}

export const HUDView: React.FC<HUDViewProps> = ({
  speed,
  unit,
  speedLimit,
  currentRoad,
  isSpeeding,
  speedDelta,
  activeTier,
  settings,
  onExitHud,
}) => {
  const [mirror, setMirror] = useState<'vertical' | 'horizontal' | 'none'>('vertical');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const mirrorClass = mirror === 'vertical' ? 'hud-mirror' : mirror === 'horizontal' ? 'hud-mirror-h' : '';

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 sm:p-10 select-none ${
        isSpeeding ? 'ring-inset ring-8 ring-red-600 animate-pulse' : ''
      }`}
    >
      {/* Top Floating Controls (unmirrored for easy tapping) */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onExitHud}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 text-white border border-slate-800 hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit HUD</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Flip Mode */}
          <button
            onClick={() => setMirror((m) => (m === 'vertical' ? 'none' : 'vertical'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors ${
              mirror === 'vertical'
                ? 'bg-amber-600 text-white border-amber-500 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            <FlipVertical className="w-4 h-4" />
            <span>Windshield Reflection {mirror === 'vertical' ? '(ON)' : '(OFF)'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main HUD Projector Surface (Mirrored for Windshield Reflection) */}
      <div className={`flex flex-col items-center justify-center flex-1 my-auto transition-transform ${mirrorClass}`}>
        {/* Speed Limit Sign + Overspeed Warning Badge */}
        <div className="flex items-center gap-6 mb-4">
          <SpeedSign
            speedLimit={speedLimit}
            unit={unit}
            style={settings.signStyle}
            size="xl"
            isOverLimit={isSpeeding}
          />

          {isSpeeding && (
            <div className="flex flex-col items-start bg-red-600 text-white font-mono font-bold px-4 py-2 rounded-2xl animate-bounce">
              <span className="text-xl sm:text-2xl">+{Math.round(speedDelta)} {unit.toUpperCase()}</span>
              <span className="text-xs uppercase tracking-wider">SLOW DOWN</span>
            </div>
          )}
        </div>

        {/* Massive High-Visibility Speedometer Digits */}
        <div className="flex flex-col items-center text-center">
          <span
            className={`font-mono font-black tracking-tighter tabular-nums leading-none ${
              isSpeeding ? 'text-red-500' : 'text-emerald-400'
            } text-8xl sm:text-[14rem]`}
          >
            {Math.round(speed)}
          </span>
          <span className="font-mono text-xl sm:text-3xl text-slate-400 font-bold uppercase tracking-widest mt-2">
            {unit}
          </span>
        </div>

        {/* Road Name */}
        {currentRoad && (
          <div className="mt-6 text-slate-400 font-mono text-sm sm:text-base font-semibold">
            {currentRoad.name}
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-[11px] font-mono text-slate-600">
        Lay your phone flat on the dashboard under the windshield for crisp optical projection.
      </div>
    </div>
  );
};
