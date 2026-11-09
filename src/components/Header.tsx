import { Volume2, VolumeX, Play, ShieldAlert, Download } from 'lucide-react';
import { RingSettings } from '../types/speedometer';

interface HeaderProps {
  activeTab: 'dashboard' | 'studio' | 'map' | 'simulator' | 'hud';
  setActiveTab: (tab: 'dashboard' | 'studio' | 'map' | 'simulator' | 'hud') => void;
  settings: RingSettings;
  updateSettings: (updater: (prev: RingSettings) => RingSettings) => void;
  onTestSound: () => void;
  isSpeeding: boolean;
  unit: 'mph' | 'kmh';
  setUnit: (unit: 'mph' | 'kmh') => void;
  onOpenSaveModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  updateSettings,
  onTestSound,
  isSpeeding,
  unit,
  setUnit,
  onOpenSaveModal,
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-5 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1: Single text wordmark */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-bold font-sans tracking-tight text-white flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm shadow-red-600/30">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <span>VELOCITA</span>
        </a>
        <span className="text-xs font-mono text-slate-500 hidden sm:inline">
          OSM SPEED ALARM
        </span>
      </div>

      {/* Zone 2: 4-5 single-line nav links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`whitespace-nowrap transition-colors py-1 ${
            activeTab === 'dashboard'
              ? 'text-white border-b-2 border-red-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('studio')}
          className={`whitespace-nowrap transition-colors py-1 ${
            activeTab === 'studio'
              ? 'text-white border-b-2 border-red-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ring Studio
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`whitespace-nowrap transition-colors py-1 ${
            activeTab === 'map'
              ? 'text-white border-b-2 border-red-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          OSM Map &amp; Data
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`whitespace-nowrap transition-colors py-1 ${
            activeTab === 'simulator'
              ? 'text-white border-b-2 border-red-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Drive Simulator
        </button>
        <button
          onClick={() => setActiveTab('hud')}
          className={`whitespace-nowrap transition-colors py-1 ${
            activeTab === 'hud'
              ? 'text-white border-b-2 border-red-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          HUD Mode
        </button>
      </nav>

      {/* Zone 3: Quick action & Unit Toggle */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Unit switch */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setUnit('mph')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              unit === 'mph'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MPH
          </button>
          <button
            onClick={() => setUnit('kmh')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              unit === 'kmh'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            KM/H
          </button>
        </div>

        {/* Audio Mute button */}
        <button
          onClick={() => updateSettings((s) => ({ ...s, isMuted: !s.isMuted }))}
          title={settings.isMuted ? 'Unmute Audio Alerts' : 'Mute Audio Alerts'}
          className={`p-2 rounded-lg border transition-colors ${
            settings.isMuted
              ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          {settings.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Save / Install App Button */}
        <button
          onClick={onOpenSaveModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
          title="Install Velocita on Phone or Desktop"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Install App</span>
        </button>

        {/* Primary Action: Test Ring Now */}
        <button
          onClick={onTestSound}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm shadow-red-600/30 active:scale-95 transition-all whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Test Ring</span>
        </button>
      </div>
    </header>
  );
};
