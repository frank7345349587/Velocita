import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  Zap, 
  Smartphone, 
  Eye, 
  Volume2, 
  CheckCircle2, 
  Radio, 
  ExternalLink,
  Copy,
  Check,
  Play,
  Shield,
  BellRing,
  Bell,
  Sparkles
} from 'lucide-react';
import { CarAutoConnectSettings, ConnectionStatus } from '../types/autoConnect';
import { carAutoConnect } from '../services/carAutoConnectService';
import { backgroundDriving } from '../services/backgroundDrivingService';

interface CarAutoConnectSettingsProps {
  settings: CarAutoConnectSettings;
  updateSettings: (updater: (prev: CarAutoConnectSettings) => CarAutoConnectSettings) => void;
  onSimulateConnect: () => void;
}

export const CarAutoConnectSettingsComponent: React.FC<CarAutoConnectSettingsProps> = ({
  settings,
  updateSettings,
  onSimulateConnect,
}) => {
  const [status, setStatus] = useState<ConnectionStatus>(carAutoConnect.status);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [copiedIntent, setCopiedIntent] = useState<boolean>(false);
  const [isNfcWriting, setIsNfcWriting] = useState<boolean>(false);
  const [nfcSuccess, setNfcSuccess] = useState<boolean>(false);
  const [notifPerm, setNotifPerm] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  const handleRequestNotifications = async () => {
    const granted = await backgroundDriving.requestNotificationPermission();
    setNotifPerm(granted);
  };

  useEffect(() => {
    const unsub = carAutoConnect.subscribe((s) => setStatus(s));
    return () => unsub();
  }, []);

  const handlePairBluetooth = async () => {
    setPairingError(null);
    try {
      const deviceName = await carAutoConnect.pairCarBluetooth(settings);
      if (deviceName) {
        updateSettings((prev) => ({
          ...prev,
          pairedBluetoothDeviceName: deviceName,
        }));
      }
    } catch (err: any) {
      setPairingError(err.message || 'Bluetooth pairing failed');
    }
  };

  const copyAndroidIntent = () => {
    const appUrl = window.location.href;
    const taskerCommand = `Intent Action: android.intent.action.VIEW\nData URI: ${appUrl}#autostart\nTrigger: Bluetooth Connected OR Android Auto Connected`;
    navigator.clipboard.writeText(taskerCommand);
    setCopiedIntent(true);
    setTimeout(() => setCopiedIntent(false), 2500);
  };

  const handleWriteNfc = async () => {
    if ('NDEFReader' in window) {
      try {
        setIsNfcWriting(true);
        const ndef = new (window as any).NDEFReader();
        await ndef.write({
          records: [{ recordType: 'url', data: `${window.location.origin}#autostart` }],
        });
        setNfcSuccess(true);
        setTimeout(() => setNfcSuccess(false), 3000);
      } catch (e: any) {
        setPairingError(e.message || 'NFC Write failed or canceled');
      } finally {
        setIsNfcWriting(false);
      }
    } else {
      setPairingError('NFC Writing is not supported on this device/browser. Use Chrome on Android with NFC.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Overview Banner */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-sans text-white">
              Vehicle Auto-Launch &amp; Android Auto
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Hands-Free
            </span>
          </div>
          <p className="text-sm text-slate-400 max-w-xl">
            Automatically arms GPS speed tracking, wakes audio synthesizer, and keeps your screen on the moment you start your car, plug into Android Auto, or place your phone on the car dock.
          </p>
        </div>

        {/* Master Toggle */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings((s) => ({ ...s, enabled: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
          <span className="ml-3 text-sm font-semibold text-white">
            {settings.enabled ? 'Auto-Active' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Live Connection Telemetry Card */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${status.isBluetoothConnected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Car Bluetooth</div>
            <div className="text-xs font-mono font-semibold text-white truncate max-w-[110px]">
              {status.isBluetoothConnected ? status.connectedDeviceName || 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${status.isPowerConnected ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">USB / Dock</div>
            <div className="text-xs font-mono font-semibold text-white">
              {status.isPowerConnected ? 'Charging' : 'Unplugged'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${status.isWakeLockActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Screen WakeLock</div>
            <div className="text-xs font-mono font-semibold text-white">
              {status.isWakeLockActive ? 'Always On' : 'Standard'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${status.isBackgroundSentinelActive ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Background Keep-Alive</div>
            <div className="text-xs font-mono font-semibold text-white">
              {status.isBackgroundSentinelActive ? 'Armed & Running' : 'Idle'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${status.isAutoActive ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Alarm State</div>
            <div className="text-xs font-mono font-semibold text-white">
              {status.isAutoActive ? 'Armed & Ready' : 'Standby'}
            </div>
          </div>
        </div>
      </div>

      {/* Background Driving Sentinel Feature Card */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-semibold text-white">Background Driving Sentinel</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                Runs with Google Maps &amp; Screen Off
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Allows the app to automatically wake up in the background and stay running there while you drive. Speed chimes continue ringing even if you lock your screen, switch to Google Maps, or minimize the browser.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.runInBackground}
              onChange={(e) => {
                const checked = e.target.checked;
                updateSettings((s) => ({ ...s, runInBackground: checked }));
                if (checked) {
                  backgroundDriving.engageBackgroundSentinel();
                } else {
                  backgroundDriving.disengageBackgroundSentinel();
                }
              }}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Background Audio Keepalive Explanation */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>MediaSession Process Keep-Alive</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Maintains an active background media session with the operating system so iOS &amp; Android do not freeze the GPS or alert engine when switching to Waze, Google Maps, or locking your phone.
            </p>
            <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Lock Screen Speed Telemetry</span>
              <span className="text-emerald-400">Active</span>
            </div>
          </div>

          {/* Background Over-Speed Notifications */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold">
                <BellRing className="w-4 h-4 text-amber-400" />
                <span>Lock-Screen Speed Warnings</span>
              </div>
              <input
                type="checkbox"
                checked={settings.notifyOnBackgroundSpeeding}
                onChange={(e) => updateSettings((s) => ({ ...s, notifyOnBackgroundSpeeding: e.target.checked }))}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
              />
            </div>
            <p className="text-slate-400 leading-relaxed">
              Pushes a priority system notification with your current speed and road limit if you exceed the threshold while the app is in the background.
            </p>
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                System Permission: {notifPerm ? 'Granted' : 'Not Granted'}
              </span>
              {!notifPerm && (
                <button
                  onClick={handleRequestNotifications}
                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors"
                >
                  Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trigger Methods */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-white">Auto-Activation Triggers</h3>
            <p className="text-xs text-slate-400 mt-0.5">Select when Velocita should automatically wake up</p>
          </div>

          <div className="space-y-4">
            {/* Bluetooth Car Stereo Trigger */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Bluetooth className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Car Stereo Bluetooth</div>
                    <div className="text-xs text-slate-400">Trigger on vehicle head unit connection</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.triggerOnBluetooth}
                  onChange={(e) => updateSettings((s) => ({ ...s, triggerOnBluetooth: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                />
              </div>

              {settings.triggerOnBluetooth && (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handlePairBluetooth}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Pair Vehicle Bluetooth</span>
                  </button>
                  {settings.pairedBluetoothDeviceName && (
                    <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Paired: {settings.pairedBluetoothDeviceName}</span>
                    </div>
                  )}
                  {pairingError && (
                    <div className="text-xs text-red-400 mt-1">{pairingError}</div>
                  )}
                </div>
              )}
            </div>

            {/* Android Auto / USB Power Trigger */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Car Power / Android Auto Cable</div>
                  <div className="text-xs text-slate-400">Auto-start when phone is plugged into car USB or dock</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.triggerOnPowerConnected}
                onChange={(e) => updateSettings((s) => ({ ...s, triggerOnPowerConnected: e.target.checked }))}
                className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Car Audio Sink Change */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Audio Sink Route</div>
                  <div className="text-xs text-slate-400">Trigger when media audio switches to car speakers</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.triggerOnAudioSink}
                onChange={(e) => updateSettings((s) => ({ ...s, triggerOnAudioSink: e.target.checked }))}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Handshake Actions & Greeting */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-white">Auto-Activation Actions</h3>
            <p className="text-xs text-slate-400 mt-0.5">Automated actions executed when connected to vehicle</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Auto Start GPS */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300 font-medium">Auto-start GPS Speed Tracking</span>
              <input
                type="checkbox"
                checked={settings.autoStartGps}
                onChange={(e) => updateSettings((s) => ({ ...s, autoStartGps: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Screen Wake Lock */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-slate-300 font-medium">Keep Screen Awake (Wake Lock)</div>
                <div className="text-[11px] text-slate-500">Prevents phone screen from dimming/sleeping while driving</div>
              </div>
              <input
                type="checkbox"
                checked={settings.keepScreenAwake}
                onChange={(e) => updateSettings((s) => ({ ...s, keepScreenAwake: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Auto Unmute */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300 font-medium">Auto-unmute Audio Alert Rings</span>
              <input
                type="checkbox"
                checked={settings.autoUnmute}
                onChange={(e) => updateSettings((s) => ({ ...s, autoUnmute: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Vehicle Connected Sound Chime */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-300 font-medium">Play Automotive Connected Chime</span>
              <input
                type="checkbox"
                checked={settings.playCarConnectedSound}
                onChange={(e) => updateSettings((s) => ({ ...s, playCarConnectedSound: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Spoken Greeting */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Spoken Voice Greeting</span>
                <input
                  type="checkbox"
                  checked={settings.speakGreeting}
                  onChange={(e) => updateSettings((s) => ({ ...s, speakGreeting: e.target.checked }))}
                  className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
                />
              </div>
              {settings.speakGreeting && (
                <input
                  type="text"
                  value={settings.greetingText}
                  onChange={(e) => updateSettings((s) => ({ ...s, greetingText: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Android Auto & NFC Automation Card */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Android Auto &amp; Car Mount Quick-Launch</h3>
            <p className="text-xs text-slate-400 mt-0.5">Launch automatically every time you dock your phone in your vehicle</p>
          </div>
          <Smartphone className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Method A: NFC Sticker on Car Phone Mount */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="font-semibold text-white text-sm flex items-center gap-2">
              <span>Method 1: NFC Car Mount Sticker</span>
            </div>
            <p className="text-slate-400">
              Stick a cheap NFC tag on your car phone mount or dashboard. Tap your phone onto the mount to instantly wake Velocita with speed alarms armed.
            </p>
            <button
              onClick={handleWriteNfc}
              disabled={isNfcWriting}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              {nfcSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">NFC Written Successfully!</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>{isNfcWriting ? 'Hold NFC Tag Near Phone...' : 'Write Launch Tag to NFC Sticker'}</span>
                </>
              )}
            </button>
          </div>

          {/* Method B: Android Auto / Tasker / Assistant Routine */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="font-semibold text-white text-sm flex items-center gap-2">
              <span>Method 2: Android Auto / Tasker Routine</span>
            </div>
            <p className="text-slate-400">
              In Android Settings &gt; Connected Devices &gt; Android Auto, or via Tasker/MacroDroid, trigger an automatic launch intent on car Bluetooth connection.
            </p>
            <button
              onClick={copyAndroidIntent}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              {copiedIntent ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied Android Auto Intent!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-300" />
                  <span>Copy Android Auto Launch Intent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Simulation Test Button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
          <span className="text-xs text-slate-400">
            Want to test what happens when you get into your car right now?
          </span>
          <button
            onClick={() => {
              carAutoConnect.simulateCarConnection(settings, 'android-auto');
              onSimulateConnect();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-emerald-400" />
            <span>Simulate Car Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
