import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gauge, 
  Sliders, 
  Map as MapIcon, 
  Compass, 
  Bluetooth, 
  Maximize2,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';
import { useSpeedometer } from './hooks/useSpeedometer';
import { Header } from './components/Header';
import { SpeedometerGauge } from './components/SpeedometerGauge';
import { RingStudio } from './components/RingStudio';
import { MapView } from './components/MapView';
import { DriveSimulator } from './components/DriveSimulator';
import { CarAutoConnectSettingsComponent } from './components/CarAutoConnectSettings';
import { HUDView } from './components/HUDView';
import { SaveAppModal } from './components/SaveAppModal';
import { alertEngine } from './services/audioAlertEngine';
import { carAutoConnect } from './services/carAutoConnectService';
import { backgroundDriving } from './services/backgroundDrivingService';
import { DEFAULT_AUTO_CONNECT_SETTINGS, CarAutoConnectSettings } from './types/autoConnect';

export default function App() {
  const {
    speed,
    unit,
    setUnit,
    speedLimit,
    setManualSpeedLimit,
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
  } = useSpeedometer();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'studio' | 'map' | 'simulator' | 'hud' | 'autoConnect'>('dashboard');
  const [carSettings, setCarSettings] = useState<CarAutoConnectSettings>(() => {
    try {
      const saved = localStorage.getItem('velocita_car_connect_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_AUTO_CONNECT_SETTINGS;
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const updateCarSettings = useCallback((updater: (prev: CarAutoConnectSettings) => CarAutoConnectSettings) => {
    setCarSettings((prev) => {
      const updated = updater(prev);
      try {
        localStorage.setItem('velocita_car_connect_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Initialize Car Auto-Connect Service
  useEffect(() => {
    carAutoConnect.init(carSettings, () => {
      // Auto activation callback:
      showToast('🚗 Connected to vehicle. Speed alarm is armed.');
      if (carSettings.autoStartGps) {
        startGps();
      }
      if (carSettings.autoUnmute) {
        updateSettings((s) => ({ ...s, isMuted: false }));
      }
      if (carSettings.autoSwitchToHUD) {
        setActiveTab('hud');
      } else {
        setActiveTab('dashboard');
      }
    });

    // Handle deep link '#autostart' from NFC or Android Auto Intent
    if (window.location.hash === '#autostart') {
      carAutoConnect.triggerAutoActivation(carSettings, 'NFC / Intent Deep Link');
    }
  }, [carSettings, startGps, updateSettings, showToast]);

  // Test sound shortcut
  const handleTestSound = useCallback(() => {
    alertEngine.testSound(settings, 9);
    showToast(`Testing "${settings.selectedPreset}" chime`);
  }, [settings, showToast]);

  // Global Keyboard Shortcuts for testing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        accelerate(3);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        brake(5);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleTestSound();
      } else if (e.key === 'm' || e.key === 'M') {
        updateSettings((s) => ({ ...s, isMuted: !s.isMuted }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accelerate, brake, handleTestSound, updateSettings]);

  // Keep background driving telemetry (lock screen speed & media card) updated
  useEffect(() => {
    backgroundDriving.updateTelemetry(
      speed,
      speedLimit,
      unit,
      currentRoad?.name,
      isSpeeding
    );
  }, [speed, speedLimit, unit, currentRoad?.name, isSpeeding]);

  // Full-Screen HUD Mode
  if (activeTab === 'hud') {
    return (
      <HUDView
        speed={speed}
        unit={unit}
        speedLimit={speedLimit}
        currentRoad={currentRoad}
        isSpeeding={isSpeeding}
        speedDelta={speedDelta}
        activeTier={activeTier}
        settings={settings}
        onExitHud={() => setActiveTab('dashboard')}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-300 relative ${
      isStrobing ? 'ring-inset ring-4 ring-red-600/70 shadow-[inset_0_0_80px_rgba(239,68,68,0.35)]' : ''
    }`}>
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab === 'autoConnect' ? 'dashboard' : activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        updateSettings={updateSettings}
        onTestSound={handleTestSound}
        isSpeeding={isSpeeding}
        unit={unit}
        setUnit={setUnit}
        onOpenSaveModal={() => setIsSaveModalOpen(true)}
      />

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 py-2 px-4 rounded-xl bg-slate-900/95 border border-slate-700 text-white text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Secondary Sub-Bar for Quick Access to Car Auto-Connect & HUD */}
      <div className="w-full bg-slate-900/60 border-b border-slate-800/60 px-5 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('autoConnect')}
            className={`flex items-center gap-1.5 transition-colors ${
              activeTab === 'autoConnect' ? 'text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Car Auto-Connect &amp; Android Auto</span>
            {carSettings.enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
            {carSettings.runInBackground && (
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/25 hidden sm:inline">
                Background Active
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Use ↑ / ↓ arrow keys to throttle/brake
          </span>
          <button
            onClick={() => setActiveTab('hud')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Windshield HUD</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12">
        {activeTab === 'dashboard' && (
          <SpeedometerGauge
            speed={speed}
            unit={unit}
            speedLimit={speedLimit}
            currentRoad={currentRoad}
            isSpeeding={isSpeeding}
            speedDelta={speedDelta}
            activeTier={activeTier}
            mode={mode}
            setMode={setMode}
            gpsStatus={gpsStatus}
            gpsAccuracy={gpsAccuracy}
            startGps={startGps}
            stopGps={stopGps}
            accelerate={accelerate}
            brake={brake}
            settings={settings}
            updateSettings={updateSettings}
            onOpenStudio={() => setActiveTab('studio')}
            onOpenSaveModal={() => setIsSaveModalOpen(true)}
            isLoadingOsm={isLoadingOsm}
            forceOsmRefresh={forceOsmRefresh}
          />
        )}

        {activeTab === 'studio' && (
          <RingStudio
            settings={settings}
            updateSettings={updateSettings}
            unit={unit}
            onTestSound={handleTestSound}
          />
        )}

        {activeTab === 'map' && (
          <MapView
            currentPosition={currentPosition}
            currentRoad={currentRoad}
            speed={speed}
            speedLimit={speedLimit}
            unit={unit}
            isSpeeding={isSpeeding}
            selectedRoute={selectedRoute}
            currentWaypointIndex={currentWaypointIndex}
            onSelectWaypoint={goToWaypoint}
            onTeleportToLocation={(lat, lon, road) => {
              setMode('simulator');
              goToWaypoint(0);
              showToast(`Teleported to ${road?.name || 'Selected Way'}`);
            }}
          />
        )}

        {activeTab === 'simulator' && (
          <DriveSimulator
            speed={simSpeed}
            setSpeed={setSimSpeed}
            speedLimit={speedLimit}
            unit={unit}
            isSpeeding={isSpeeding}
            activeTier={activeTier}
            currentRoad={currentRoad}
            selectedRoute={selectedRoute}
            setSelectedRoute={setSelectedRoute}
            isSimDriving={isSimDriving}
            toggleSimDrive={toggleSimDrive}
            currentWaypointIndex={currentWaypointIndex}
            goToWaypoint={goToWaypoint}
            accelerate={accelerate}
            brake={brake}
          />
        )}

        {activeTab === 'autoConnect' && (
          <CarAutoConnectSettingsComponent
            settings={carSettings}
            updateSettings={updateCarSettings}
            onSimulateConnect={() => {
              showToast('🚗 Simulated vehicle connection: Speed alert engine active!');
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar for in-car thumb reach */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 h-16 items-center px-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center h-full ${
            activeTab === 'dashboard' ? 'text-red-500 font-bold' : 'text-slate-400'
          }`}
        >
          <Gauge className="w-5 h-5" />
          <span className="text-[10px] mt-1">Cockpit</span>
        </button>

        <button
          onClick={() => setActiveTab('studio')}
          className={`flex flex-col items-center justify-center h-full ${
            activeTab === 'studio' ? 'text-red-500 font-bold' : 'text-slate-400'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] mt-1">Rings</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center justify-center h-full ${
            activeTab === 'map' ? 'text-red-500 font-bold' : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="text-[10px] mt-1">OSM Map</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex flex-col items-center justify-center h-full ${
            activeTab === 'simulator' ? 'text-red-500 font-bold' : 'text-slate-400'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-1">Sim</span>
        </button>

        <button
          onClick={() => setActiveTab('autoConnect')}
          className={`flex flex-col items-center justify-center h-full ${
            activeTab === 'autoConnect' ? 'text-blue-400 font-bold' : 'text-slate-400'
          }`}
        >
          <Bluetooth className="w-5 h-5" />
          <span className="text-[10px] mt-1">Auto Car</span>
        </button>
      </nav>

      {/* Save & Install App Modal */}
      <SaveAppModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        settings={settings}
      />
    </div>
  );
}
