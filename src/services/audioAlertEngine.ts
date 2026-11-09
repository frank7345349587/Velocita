import { HarmonicInterval, RingSettings, SynthParams } from '../types/speedometer';

class AudioAlertEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private activeIntervalId: number | null = null;
  private lastVoiceTimestamp: number = 0;
  private customAudioElement: HTMLAudioElement | null = null;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Helper to get frequency multiplier for harmonic intervals
   */
  private getHarmonicMultiplier(interval: HarmonicInterval): number[] {
    switch (interval) {
      case 'octave':
        return [2.0];
      case 'perfect-fifth':
        return [1.4983];
      case 'major-third':
        return [1.2599];
      case 'minor-third':
        return [1.1892];
      case 'tritone':
        return [1.4142]; // dissonant urgent warning
      case 'major-chord':
        return [1.2599, 1.4983];
      case 'none':
      default:
        return [];
    }
  }

  /**
   * Plays a single synthesized alert burst based on current parameters
   */
  public playSynthBurst(
    params: SynthParams,
    masterVolume: number = 0.8,
    speedDelta: number = 0
  ): void {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Calculate dynamic frequency if enabled (e.g. +15 Hz per mph over limit)
      let freq = params.baseFrequency;
      if (params.dynamicPitch && speedDelta > 0) {
        freq += Math.min(speedDelta * 28, 1200);
      }

      // Master gain node for volume
      const masterGain = ctx.createGain();
      const effectiveVol = Math.max(0.01, Math.min(1, params.volume * masterVolume));
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.connect(ctx.destination);

      const burstDuration = params.beepRate > 0 
        ? Math.max(0.06, (1 / params.beepRate) * params.dutyCycle)
        : 0.35;

      const attack = Math.min(params.attack, burstDuration * 0.4);
      const decay = Math.min(params.decay, burstDuration * 0.4);
      const sustain = params.sustain;
      const release = Math.min(params.release, burstDuration * 0.3);

      // ADSR Envelope
      masterGain.gain.linearRampToValueAtTime(effectiveVol, now + attack);
      masterGain.gain.linearRampToValueAtTime(effectiveVol * sustain, now + attack + decay);
      masterGain.gain.setValueAtTime(effectiveVol * sustain, now + burstDuration - release);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + burstDuration);

      // Primary Oscillator
      const osc1 = ctx.createOscillator();
      osc1.type = params.waveform;
      osc1.frequency.setValueAtTime(freq, now);
      osc1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + burstDuration);

      // Harmonic Oscillators if enabled
      const harmonics = this.getHarmonicMultiplier(params.harmonic);
      harmonics.forEach((mult) => {
        const oscHarmonic = ctx.createOscillator();
        oscHarmonic.type = params.waveform;
        oscHarmonic.frequency.setValueAtTime(freq * mult, now);

        const harmGain = ctx.createGain();
        harmGain.gain.setValueAtTime(0.35, now);
        oscHarmonic.connect(harmGain);
        harmGain.connect(masterGain);

        oscHarmonic.start(now);
        oscHarmonic.stop(now + burstDuration);
      });
    } catch (err) {
      console.warn('Audio synthesis error:', err);
    }
  }

  /**
   * Speaks spoken voice alert using SpeechSynthesis
   */
  public speakVoiceAlert(
    text: string,
    settings: {
      voiceName?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      cooldownSeconds?: number;
    } = {}
  ): void {
    if (!('speechSynthesis' in window)) return;

    const now = Date.now();
    const cooldown = (settings.cooldownSeconds ?? 6) * 1000;
    if (now - this.lastVoiceTimestamp < cooldown) {
      return;
    }
    this.lastVoiceTimestamp = now;

    // Cancel any stuck utterances
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.rate ?? 1.05;
    utterance.pitch = settings.pitch ?? 1.0;
    utterance.volume = settings.volume ?? 1.0;

    if (settings.voiceName) {
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === settings.voiceName || v.voiceURI === settings.voiceName);
      if (match) utterance.voice = match;
    }

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Plays custom uploaded or recorded audio
   */
  public playCustomAudio(dataUrl: string, volume: number = 0.8): void {
    if (!dataUrl) return;

    if (!this.customAudioElement) {
      this.customAudioElement = new Audio();
    }

    try {
      this.customAudioElement.src = dataUrl;
      this.customAudioElement.volume = Math.max(0, Math.min(1, volume));
      this.customAudioElement.currentTime = 0;
      this.customAudioElement.play().catch((err) => {
        console.warn('Custom audio playback blocked:', err);
      });
    } catch (e) {
      console.warn('Custom audio play error:', e);
    }
  }

  /**
   * Triggers device vibration pattern (haptic feedback)
   */
  public triggerVibration(pattern: number[] = [180, 80, 180]): void {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignored if unsupported or forbidden
      }
    }
  }

  /**
   * Starts continuous or interval over-speed alert loop
   */
  public startAlertLoop(
    settings: RingSettings,
    tierIndex: 1 | 2 | 3,
    speedDelta: number,
    voiceContext?: { speed: number; limit: number; unit: string; roadName?: string }
  ): void {
    if (settings.isMuted) return;

    // Get parameters for the active tier or global settings
    const tierConfig = settings.useMultiTier 
      ? settings.tiers[`tier${tierIndex}`] 
      : null;

    const synthParams = tierConfig 
      ? { ...settings.synth, ...tierConfig.synthPreset }
      : settings.synth;

    const effectiveVolume = tierConfig 
      ? (tierConfig.synthPreset.volume ?? settings.synth.volume) 
      : settings.masterVolume;

    // 1. Play first immediate burst
    this.playBurstForMode(settings, synthParams, effectiveVolume, speedDelta);

    // 2. Trigger vibration if enabled
    if (settings.vibrate || (tierConfig && tierConfig.vibrate)) {
      this.triggerVibration(tierIndex === 3 ? [250, 80, 250, 80, 250] : [150, 60, 150]);
    }

    // 3. Spoken voice alert ONLY if enabled and in hybrid/voice mode (never when in chime-only mode)
    const voiceAllowed = settings.voice.enabled && (settings.mode === 'hybrid' || settings.mode === 'voice');
    const shouldVoice = voiceAllowed && (settings.useMultiTier && tierConfig ? tierConfig.enableVoice : true);
    if (shouldVoice && voiceContext) {
      const template = settings.voice.template || 'Warning: Speed limit {limit} {unit}. You are driving {speed}.';
      const msg = template
        .replace(/{speed}/g, Math.round(voiceContext.speed).toString())
        .replace(/{limit}/g, Math.round(voiceContext.limit).toString())
        .replace(/{unit}/g, voiceContext.unit)
        .replace(/{delta}/g, Math.round(speedDelta).toString())
        .replace(/{road}/g, voiceContext.roadName || 'this road');

      this.speakVoiceAlert(msg, {
        voiceName: settings.voice.voiceName,
        rate: settings.voice.rate,
        pitch: settings.voice.pitch,
        volume: settings.voice.volume * settings.masterVolume,
        cooldownSeconds: settings.voice.cooldownSeconds,
      });
    }

    // 4. Setup repetition interval if not already running
    if (!this.isRunning) {
      this.isRunning = true;
      const intervalSec = tierConfig 
        ? tierConfig.repeatIntervalSec 
        : (settings.repeatIntervalSec || 1.5);

      const ms = Math.max(300, intervalSec * 1000);

      this.activeIntervalId = window.setInterval(() => {
        this.playBurstForMode(settings, synthParams, effectiveVolume, speedDelta);
      }, ms);
    }
  }

  private playBurstForMode(
    settings: RingSettings,
    synthParams: SynthParams,
    volume: number,
    speedDelta: number
  ): void {
    if (settings.mode === 'customAudio' && settings.customAudio.dataUrl) {
      this.playCustomAudio(settings.customAudio.dataUrl, volume);
    } else {
      this.playSynthBurst(synthParams, volume, speedDelta);
    }
  }

  /**
   * Stops the alert loop
   */
  public stopAlertLoop(): void {
    if (this.activeIntervalId !== null) {
      clearInterval(this.activeIntervalId);
      this.activeIntervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Test a specific sound preset or custom parameters once
   */
  public testSound(settings: RingSettings, speedDelta: number = 8): void {
    this.initContext();
    if (settings.mode === 'customAudio' && settings.customAudio.dataUrl) {
      this.playCustomAudio(settings.customAudio.dataUrl, settings.masterVolume);
    } else {
      this.playSynthBurst(settings.synth, settings.masterVolume, speedDelta);
    }

    const voiceAllowed = settings.voice.enabled && (settings.mode === 'hybrid' || settings.mode === 'voice');
    if (voiceAllowed) {
      this.speakVoiceAlert('Speed limit test: 45 miles per hour. You are driving 53.', {
        voiceName: settings.voice.voiceName,
        rate: settings.voice.rate,
        pitch: settings.voice.pitch,
        volume: settings.voice.volume * settings.masterVolume,
        cooldownSeconds: 0,
      });
    }

    if (settings.vibrate) {
      this.triggerVibration([150, 70, 150]);
    }
  }
}

export const alertEngine = new AudioAlertEngine();

/**
 * Built-in audio presets for quick customization
 */
export const SOUND_PRESETS: Record<string, { label: string; description: string; params: Partial<SynthParams> }> = {
  'modern-chime': {
    label: 'Modern German Chime',
    description: 'Clean dual-harmonic chime used in high-end vehicle cockpits.',
    params: {
      waveform: 'sine',
      baseFrequency: 780,
      harmonic: 'octave',
      beepRate: 2.2,
      dutyCycle: 0.45,
      dynamicPitch: true,
      attack: 0.01,
      decay: 0.12,
      sustain: 0.2,
      release: 0.1,
    },
  },
  'urgent-siren': {
    label: 'Urgent Pulsing Siren',
    description: 'High-visibility rapid alarm with tritone dissonance to cut through loud road noise.',
    params: {
      waveform: 'sawtooth',
      baseFrequency: 950,
      harmonic: 'tritone',
      beepRate: 5.5,
      dutyCycle: 0.6,
      dynamicPitch: true,
      attack: 0.005,
      decay: 0.08,
      sustain: 0.4,
      release: 0.05,
    },
  },
  'radar-pulse': {
    label: 'Avionics Radar Pulse',
    description: 'Sonar-like ping with deep resonant harmonic decay.',
    params: {
      waveform: 'sine',
      baseFrequency: 620,
      harmonic: 'perfect-fifth',
      beepRate: 1.5,
      dutyCycle: 0.35,
      dynamicPitch: true,
      attack: 0.008,
      decay: 0.22,
      sustain: 0.1,
      release: 0.15,
    },
  },
  'cockpit-beep': {
    label: 'Digital Dashboard Staccato',
    description: 'Crisp, concise 1200 Hz tone that grabs immediate attention.',
    params: {
      waveform: 'square',
      baseFrequency: 1180,
      harmonic: 'none',
      beepRate: 3.8,
      dutyCycle: 0.3,
      dynamicPitch: true,
      attack: 0.003,
      decay: 0.05,
      sustain: 0.3,
      release: 0.04,
    },
  },
  'retro-8bit': {
    label: 'Arcade 8-Bit Alert',
    description: 'Nostalgic retro gaming square-wave alert with fifth intervals.',
    params: {
      waveform: 'square',
      baseFrequency: 440,
      harmonic: 'major-third',
      beepRate: 4.0,
      dutyCycle: 0.5,
      dynamicPitch: true,
      attack: 0.002,
      decay: 0.06,
      sustain: 0.5,
      release: 0.05,
    },
  },
  'soft-bell': {
    label: 'Zen Ambient Bell',
    description: 'Gentle, polite chime ideal for calm drivers and city cruising.',
    params: {
      waveform: 'triangle',
      baseFrequency: 523, // C5
      harmonic: 'major-chord',
      beepRate: 1.2,
      dutyCycle: 0.4,
      dynamicPitch: false,
      attack: 0.02,
      decay: 0.3,
      sustain: 0.15,
      release: 0.25,
    },
  },
  'sub-thud': {
    label: 'Low Frequency Rumble',
    description: 'Sub-bass 180 Hz pulse felt through car speakers and subwoofers.',
    params: {
      waveform: 'sine',
      baseFrequency: 180,
      harmonic: 'octave',
      beepRate: 2.0,
      dutyCycle: 0.5,
      dynamicPitch: false,
      attack: 0.03,
      decay: 0.15,
      sustain: 0.4,
      release: 0.15,
    },
  },
};

/**
 * Default Ring Settings configuration
 */
export const DEFAULT_RING_SETTINGS: RingSettings = {
  toleranceType: 'absolute',
  toleranceValue: 3, // +3 mph tolerance
  mode: 'synth',
  masterVolume: 0.85,
  isMuted: false,
  selectedPreset: 'modern-chime',
  synth: {
    waveform: 'sine',
    baseFrequency: 780,
    harmonic: 'octave',
    beepRate: 2.5,
    dutyCycle: 0.45,
    dynamicPitch: true,
    attack: 0.01,
    decay: 0.12,
    sustain: 0.2,
    release: 0.1,
    volume: 0.9,
  },
  voice: {
    enabled: false,
    voiceName: '',
    rate: 1.1,
    pitch: 1.0,
    volume: 1.0,
    template: 'Warning: Speed limit is {limit} {unit}. Current speed {speed}.',
    cooldownSeconds: 8,
  },
  customAudio: {
    dataUrl: null,
    fileName: null,
    durationSec: 0,
  },
  useMultiTier: true,
  tiers: {
    tier1: {
      offset: 3,
      soundType: 'soft-bell',
      synthPreset: {
        waveform: 'triangle',
        baseFrequency: 580,
        harmonic: 'major-third',
        beepRate: 1.5,
        volume: 0.6,
      },
      repeatIntervalSec: 2.5,
      enableVoice: false,
      strobeVisual: false,
      vibrate: false,
      color: '#f59e0b', // Amber
    },
    tier2: {
      offset: 7,
      soundType: 'modern-chime',
      synthPreset: {
        waveform: 'sine',
        baseFrequency: 880,
        harmonic: 'perfect-fifth',
        beepRate: 3.2,
        volume: 0.85,
      },
      repeatIntervalSec: 1.5,
      enableVoice: false,
      strobeVisual: true,
      vibrate: true,
      color: '#f97316', // Orange
    },
    tier3: {
      offset: 12,
      soundType: 'urgent-siren',
      synthPreset: {
        waveform: 'sawtooth',
        baseFrequency: 1100,
        harmonic: 'tritone',
        beepRate: 5.5,
        volume: 1.0,
      },
      repeatIntervalSec: 0.8,
      enableVoice: false,
      strobeVisual: true,
      vibrate: true,
      color: '#ef4444', // Red
    },
  },
  repeatMode: 'continuous',
  repeatIntervalSec: 1.8,
  hysteresisOffset: 1,
  strobeScreen: true,
  vibrate: true,
  hudMode: false,
  hudMirror: 'vertical',
  signStyle: 'us',
};

/**
 * Pure chime helper: completely silences voice warnings across all tiers and sets mode to synth
 */
export function silenceAllVoices(prev: RingSettings): RingSettings {
  return {
    ...prev,
    mode: 'synth',
    voice: {
      ...prev.voice,
      enabled: false,
    },
    tiers: {
      tier1: { ...prev.tiers.tier1, enableVoice: false },
      tier2: { ...prev.tiers.tier2, enableVoice: false },
      tier3: { ...prev.tiers.tier3, enableVoice: false },
    },
  };
}
