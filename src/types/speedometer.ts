export type SpeedUnit = 'mph' | 'kmh';

export type SpeedLimitSource = 
  | 'osm-maxspeed' 
  | 'osm-roadtype-default' 
  | 'user-override' 
  | 'simulated-route';

export interface RoadInfo {
  id: string | number;
  name: string;
  highwayType: string;
  maxspeed: number | null; // in active unit
  rawMaxspeedTag?: string;
  lanes?: number;
  oneway?: boolean;
  surface?: string;
  source: SpeedLimitSource;
  lat: number;
  lon: number;
  distanceMeters?: number;
}

export type AlertSoundType = 
  | 'modern-chime'
  | 'urgent-siren'
  | 'radar-pulse'
  | 'cockpit-beep'
  | 'retro-8bit'
  | 'soft-bell'
  | 'sub-thud'
  | 'custom-synth'
  | 'custom-audio';

export type HarmonicInterval = 
  | 'none'
  | 'octave'
  | 'perfect-fifth'
  | 'major-third'
  | 'minor-third'
  | 'tritone'
  | 'major-chord';

export interface SynthParams {
  waveform: OscillatorType;
  baseFrequency: number; // Hz (100 - 3000)
  harmonic: HarmonicInterval;
  beepRate: number; // beeps per second (0 = continuous drone, 1 - 10)
  dutyCycle: number; // 0.1 to 0.9 (beep length ratio)
  dynamicPitch: boolean; // frequency increases with speed delta
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0 - 1
  release: number; // seconds
  volume: number; // 0 - 1
}

export interface VoiceAlertSettings {
  enabled: boolean;
  voiceName: string;
  rate: number; // 0.7 - 1.5
  pitch: number; // 0.5 - 1.5
  volume: number; // 0 - 1
  template: string; // "Warning: Speed limit {limit} {unit}. You are driving {speed}."
  cooldownSeconds: number; // interval between voice prompts
}

export interface TierConfig {
  offset: number; // speed over limit to trigger this tier
  soundType: AlertSoundType;
  synthPreset: Partial<SynthParams>;
  repeatIntervalSec: number;
  enableVoice: boolean;
  strobeVisual: boolean;
  vibrate: boolean;
  color: string;
}

export interface RingSettings {
  // Main trigger tolerance
  toleranceType: 'absolute' | 'percentage';
  toleranceValue: number; // e.g. +0, +3, +5 mph or +10%
  
  // Audio Mode
  mode: 'synth' | 'voice' | 'hybrid' | 'customAudio';
  masterVolume: number; // 0 - 1
  isMuted: boolean;
  
  // Synth sound configuration
  selectedPreset: AlertSoundType;
  synth: SynthParams;
  
  // Spoken voice warnings
  voice: VoiceAlertSettings;
  
  // Custom uploaded or recorded audio
  customAudio: {
    dataUrl: string | null;
    fileName: string | null;
    durationSec: number;
  };

  // Multi-tier escalation
  useMultiTier: boolean;
  tiers: {
    tier1: TierConfig; // Mild (e.g. +3 mph over)
    tier2: TierConfig; // Moderate (e.g. +7 mph over)
    tier3: TierConfig; // Severe (e.g. +12 mph over)
  };

  // Timing & repetition
  repeatMode: 'continuous' | 'interval' | 'once';
  repeatIntervalSec: number; // seconds between alert chimes
  hysteresisOffset: number; // speed must drop this much below limit to disarm alert
  
  // Visual & Haptic
  strobeScreen: boolean;
  vibrate: boolean;
  hudMode: boolean;
  hudMirror: 'vertical' | 'horizontal';
  signStyle: 'us' | 'eu'; // US rectangular vs EU round red border
}

export interface SimulationRoute {
  id: string;
  name: string;
  city: string;
  description: string;
  waypoints: {
    lat: number;
    lon: number;
    speed: number; // default recommended test speed
    roadName: string;
    highwayType: string;
    osmSpeedLimitMph: number;
  }[];
}
