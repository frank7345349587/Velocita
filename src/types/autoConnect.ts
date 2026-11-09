export interface CarAutoConnectSettings {
  enabled: boolean;
  
  // Triggers
  triggerOnBluetooth: boolean;
  pairedBluetoothDeviceName: string | null;
  pairedBluetoothDeviceId: string | null;
  
  triggerOnAudioSink: boolean; // car stereo / aux / bluetooth audio connection
  triggerOnPowerConnected: boolean; // phone plugged into car USB / Android Auto cable
  triggerOnMotion: boolean; // accelerometer detects vehicular movement
  
  // Actions upon auto-activation
  autoStartGps: boolean;
  autoUnmute: boolean;
  keepScreenAwake: boolean; // Screen WakeLock
  autoSwitchToHUD: boolean; // Auto open HUD mode at night
  runInBackground: boolean; // Keep active in background when using Google Maps / screen off
  notifyOnBackgroundSpeeding: boolean; // Push notification when over speed in background
  
  // Notification / Voice greeting
  playCarConnectedSound: boolean;
  speakGreeting: boolean;
  greetingText: string;
}

export interface ConnectionStatus {
  isBluetoothConnected: boolean;
  connectedDeviceName: string | null;
  isPowerConnected: boolean;
  isAudioConnectedToCar: boolean;
  isWakeLockActive: boolean;
  isAutoActive: boolean;
  isBackgroundSentinelActive: boolean;
  isAppInBackground: boolean;
}

export const DEFAULT_AUTO_CONNECT_SETTINGS: CarAutoConnectSettings = {
  enabled: true,
  triggerOnBluetooth: true,
  pairedBluetoothDeviceName: null,
  pairedBluetoothDeviceId: null,
  triggerOnAudioSink: true,
  triggerOnPowerConnected: true,
  triggerOnMotion: false,
  autoStartGps: true,
  autoUnmute: true,
  keepScreenAwake: true,
  autoSwitchToHUD: false,
  runInBackground: true,
  notifyOnBackgroundSpeeding: true,
  playCarConnectedSound: true,
  speakGreeting: true,
  greetingText: 'Connected to vehicle. Speed limit alarm is armed.',
};
