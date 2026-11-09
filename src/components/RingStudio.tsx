import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  Play, 
  Mic, 
  Square, 
  Upload, 
  Sliders, 
  SlidersHorizontal, 
  Layers, 
  Music, 
  ShieldAlert, 
  Download, 
  FileUp, 
  Sparkles,
  Smartphone,
  Eye,
  Check,
  Bell,
  VolumeX
} from 'lucide-react';
import { RingSettings, AlertSoundType, HarmonicInterval, SynthParams } from '../types/speedometer';
import { alertEngine, SOUND_PRESETS, silenceAllVoices } from '../services/audioAlertEngine';

interface RingStudioProps {
  settings: RingSettings;
  updateSettings: (updater: (prev: RingSettings) => RingSettings) => void;
  unit: 'mph' | 'kmh';
  onTestSound: () => void;
}

export const RingStudio: React.FC<RingStudioProps> = ({
  settings,
  updateSettings,
  unit,
  onTestSound,
}) => {
  const [activeTab, setActiveTab] = useState<'synth' | 'voice' | 'tiers' | 'custom' | 'behavior'>('synth');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordTimer, setRecordTimer] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load available speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Preset Selection handler
  const handleSelectPreset = (key: AlertSoundType) => {
    const preset = SOUND_PRESETS[key];
    if (!preset) return;

    updateSettings((prev) => ({
      ...prev,
      selectedPreset: key,
      synth: {
        ...prev.synth,
        ...preset.params,
      },
    }));

    // Auto preview preset
    setTimeout(() => {
      alertEngine.testSound({
        ...settings,
        selectedPreset: key,
        synth: { ...settings.synth, ...preset.params },
      });
    }, 50);
  };

  // Helper for synth slider changes
  const updateSynth = <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    updateSettings((prev) => ({
      ...prev,
      synth: {
        ...prev.synth,
        [key]: value,
      },
    }));
  };

  // File Upload for Custom Sound
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateSettings((prev) => ({
        ...prev,
        mode: 'customAudio',
        customAudio: {
          dataUrl,
          fileName: file.name,
          durationSec: 1.5,
        },
      }));
      alertEngine.playCustomAudio(dataUrl, settings.masterVolume);
    };
    reader.readAsDataURL(file);
  };

  // Microphone Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          updateSettings((prev) => ({
            ...prev,
            mode: 'customAudio',
            customAudio: {
              dataUrl,
              fileName: 'Custom Mic Alert.webm',
              durationSec: recordTimer,
            },
          }));
          alertEngine.playCustomAudio(dataUrl, settings.masterVolume);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordTimer(0);
      const timer = setInterval(() => {
        setRecordTimer((t) => {
          if (t >= 5) {
            stopRecording();
            clearInterval(timer);
            return 5;
          }
          return t + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Microphone recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Export Settings as JSON
  const exportSettingsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `velocita-ring-profile-${Date.now()}.json`);
    dlAnchor.click();
  };

  // Import Settings from JSON
  const importSettingsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        updateSettings(() => parsed);
      } catch (err) {
        alert('Invalid settings file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Studio Header & Audition Strip */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-sans text-white">Ring Customizer Studio</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
              Parametric WebAudio
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Fine-tune every aspect of your over-speed alarm: frequencies, waveforms, escalation tiers, voice alerts, custom recordings, and dynamic pitch.
          </p>
        </div>

        {/* Master Volume & Test Ring CTA */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Master Volume</span>
              <span className="font-mono">{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.masterVolume}
              onChange={(e) => updateSettings((s) => ({ ...s, masterVolume: parseFloat(e.target.value) }))}
              className="w-28 accent-red-500 cursor-pointer"
            />
          </div>

          <button
            onClick={onTestSound}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-md shadow-red-600/30 active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Test Sound</span>
          </button>
        </div>
      </div>

      {/* Alert Output Mode Selector (Chime Only vs Voice + Chime) */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Alert Sound Mode</span>
            {settings.mode === 'synth' && !settings.voice.enabled && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                ✓ Chime Only Active (No Voice)
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Choose whether to hear clean chimes, spoken warnings, or both
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => updateSettings(silenceAllVoices)}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              settings.mode === 'synth' && !settings.voice.enabled
                ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm ring-1 ring-amber-500'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1.5 text-white">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Chime Only (No Voice)</span>
              </span>
              {settings.mode === 'synth' && !settings.voice.enabled && (
                <Check className="w-3.5 h-3.5 text-amber-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Pure musical chimes, beeps, or sirens without any spoken &quot;Warning...&quot; voice alerts.
            </p>
          </button>

          <button
            onClick={() =>
              updateSettings((s) => ({
                ...s,
                mode: 'hybrid',
                voice: { ...s.voice, enabled: true },
              }))
            }
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              settings.mode === 'hybrid' || (settings.voice.enabled && settings.mode !== 'synth')
                ? 'bg-blue-500/10 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1.5 text-white">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span>Chime + Spoken Voice</span>
              </span>
              {(settings.mode === 'hybrid' || (settings.voice.enabled && settings.mode !== 'synth')) && (
                <Check className="w-3.5 h-3.5 text-blue-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Plays the alert chime tone accompanied by a spoken copilot speed alert.
            </p>
          </button>

          <button
            onClick={() =>
              updateSettings((s) => ({
                ...s,
                mode: 'voice',
                voice: { ...s.voice, enabled: true },
              }))
            }
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              settings.mode === 'voice'
                ? 'bg-purple-500/10 border-purple-500 text-white shadow-sm ring-1 ring-purple-500'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs flex items-center gap-1.5 text-white">
                <Mic className="w-4 h-4 text-purple-400" />
                <span>Voice Warning Only</span>
              </span>
              {settings.mode === 'voice' && (
                <Check className="w-3.5 h-3.5 text-purple-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Speaks speed warnings without musical tone synthesis.
            </p>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab('synth')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'synth'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          <Music className="w-3.5 h-3.5 text-amber-400" />
          <span>Synthesizer &amp; Tone</span>
        </button>

        <button
          onClick={() => setActiveTab('voice')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'voice'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Voice Alerts</span>
        </button>

        <button
          onClick={() => setActiveTab('tiers')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'tiers'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-red-400" />
          <span>Multi-Tier Escalation</span>
        </button>

        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'custom'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-purple-400" />
          <span>Custom Audio &amp; Mic</span>
        </button>

        <button
          onClick={() => setActiveTab('behavior')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors whitespace-nowrap ${
            activeTab === 'behavior'
              ? 'bg-slate-800 text-white font-semibold border border-slate-700'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tolerance &amp; Visuals</span>
        </button>
      </div>

      {/* Tab 1: Parametric Synthesizer & Tone */}
      {activeTab === 'synth' && (
        <div className="space-y-6">
          {/* Quick Sound Presets Cards */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              1. Sound Tone Presets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(SOUND_PRESETS).map(([key, item]) => {
                const isSelected = settings.selectedPreset === key && settings.mode === 'synth';
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectPreset(key as AlertSoundType)}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? 'bg-red-500/10 border-red-500 text-white shadow-md shadow-red-500/10 ring-1 ring-red-500'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{item.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Granular Parametric Synthesizer Sliders */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  2. Parametric Synthesizer Controls
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tune oscillator waveforms, harmonic intervals, pulse frequency, and envelope
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Waveform Selector */}
              <div className="space-y-2">
                <label className="text-slate-300 font-medium">Oscillator Waveform</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['sine', 'triangle', 'sawtooth', 'square'] as OscillatorType[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => updateSynth('waveform', w)}
                      className={`py-2 px-2 rounded-xl font-mono text-center capitalize border transition-all ${
                        settings.synth.waveform === w
                          ? 'bg-red-600 text-white border-red-500 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Harmonic Overtones */}
              <div className="space-y-2">
                <label className="text-slate-300 font-medium">Harmonic Chords / Interval</label>
                <select
                  value={settings.synth.harmonic}
                  onChange={(e) => updateSynth('harmonic', e.target.value as HarmonicInterval)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                >
                  <option value="none">Pure Single Tone (No Harmonics)</option>
                  <option value="octave">Octave (+12 Semitones)</option>
                  <option value="perfect-fifth">Perfect 5th (+7 Semitones)</option>
                  <option value="major-third">Major 3rd (+4 Semitones)</option>
                  <option value="minor-third">Minor 3rd (+3 Semitones)</option>
                  <option value="tritone">Tritone (Dissonant Siren Alarm)</option>
                  <option value="major-chord">Major Triad Chord</option>
                </select>
              </div>

              {/* Base Frequency Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Base Frequency</span>
                  <span className="font-mono text-amber-400 font-bold">{settings.synth.baseFrequency} Hz</span>
                </div>
                <input
                  type="range"
                  min="140"
                  max="2200"
                  step="10"
                  value={settings.synth.baseFrequency}
                  onChange={(e) => updateSynth('baseFrequency', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>140 Hz (Bass Thud)</span>
                  <span>780 Hz (Chime)</span>
                  <span>2200 Hz (Piercing)</span>
                </div>
              </div>

              {/* Pulse / Beep Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Beep Rate / Pulsation</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {settings.synth.beepRate === 0 ? 'Continuous' : `${settings.synth.beepRate} beeps/sec`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={settings.synth.beepRate}
                  onChange={(e) => updateSynth('beepRate', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Slow Pulse</span>
                  <span>Medium</span>
                  <span>Rapid Warning</span>
                </div>
              </div>

              {/* Duty Cycle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Duty Cycle (Beep Length)</span>
                  <span className="font-mono text-slate-400">{Math.round(settings.synth.dutyCycle * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.85"
                  step="0.05"
                  value={settings.synth.dutyCycle}
                  onChange={(e) => updateSynth('dutyCycle', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Dynamic Pitch Escalation Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Dynamic Pitch Escalation</div>
                  <div className="text-[11px] text-slate-400">
                    Frequency pitches higher proportional to how fast you exceed limit
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.synth.dynamicPitch}
                  onChange={(e) => updateSynth('dynamicPitch', e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Spoken Voice Alerts */}
      {activeTab === 'voice' && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">SpeechSynthesis Spoken Alerts</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Have your copilot speak clear speed warnings through your car audio speakers
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.voice.enabled && settings.mode !== 'synth'}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    updateSettings((s) => ({
                      ...s,
                      mode: 'hybrid',
                      voice: { ...s.voice, enabled: true },
                    }));
                  } else {
                    updateSettings(silenceAllVoices);
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Quick Chime Only Status & Action */}
          {(!settings.voice.enabled || settings.mode === 'synth') ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Chime Only Mode Active</div>
                  <div className="text-[11px] text-slate-400">
                    Voice alerts are silenced. You will hear pure musical chimes without spoken voice warnings.
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  updateSettings((s) => ({
                    ...s,
                    mode: 'hybrid',
                    voice: { ...s.voice, enabled: true },
                  }))
                }
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs whitespace-nowrap transition-colors"
              >
                Turn On Voice
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Voice Alerts are Active</div>
                  <div className="text-[11px] text-slate-400">
                    Prefer just chimes and no voice speaking &quot;Warning...&quot;?
                  </div>
                </div>
              </div>
              <button
                onClick={() => updateSettings(silenceAllVoices)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs whitespace-nowrap border border-slate-700 transition-colors"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                <span>Switch to Chime Only</span>
              </button>
            </div>
          )}

          <div className="space-y-4 text-xs">
            {/* Template Input */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium">Spoken Voice Phrase Template</label>
              <textarea
                rows={2}
                value={settings.voice.template}
                onChange={(e) => updateSettings((s) => ({ ...s, voice: { ...s.voice, template: e.target.value } }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500">Insert variable tags:</span>
                {['{limit}', '{speed}', '{unit}', '{delta}', '{road}'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      updateSettings((s) => ({
                        ...s,
                        voice: { ...s.voice, template: `${s.voice.template} ${tag}` },
                      }));
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 font-mono text-[11px] border border-slate-700"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Dropdown */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium">Voice Selection</label>
              <select
                value={settings.voice.voiceName}
                onChange={(e) => updateSettings((s) => ({ ...s, voice: { ...s.voice, voiceName: e.target.value } }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
              >
                <option value="">Default System Voice</option>
                {voices.map((v, index) => (
                  <option key={`voice-${index}-${v.voiceURI || v.name}-${v.lang}`} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Speed & Pitch Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Speech Rate</span>
                  <span className="font-mono text-white">{settings.voice.rate}x</span>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.05"
                  value={settings.voice.rate}
                  onChange={(e) => updateSettings((s) => ({ ...s, voice: { ...s.voice, rate: parseFloat(e.target.value) } }))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Voice Pitch</span>
                  <span className="font-mono text-white">{settings.voice.pitch}</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  value={settings.voice.pitch}
                  onChange={(e) => updateSettings((s) => ({ ...s, voice: { ...s.voice, pitch: parseFloat(e.target.value) } }))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Multi-Tier Escalation */}
      {activeTab === 'tiers' && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Escalating Alert Tiers</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically escalate alarm intensity from gentle chime to urgent siren as speed increases
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useMultiTier}
                onChange={(e) => updateSettings((s) => ({ ...s, useMultiTier: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Tier 1 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="font-bold text-white text-sm">Tier 1: Mild Warning</span>
                </div>
                <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  +{settings.tiers.tier1.offset} {unit} over limit
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Trigger Offset</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.tiers.tier1.offset}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier1: { ...s.tiers.tier1, offset: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Sound Tone</label>
                  <select
                    value={settings.tiers.tier1.soundType}
                    onChange={(e) => {
                      const val = e.target.value as AlertSoundType;
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier1: { ...s.tiers.tier1, soundType: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs mt-1"
                  >
                    {Object.entries(SOUND_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Repeat Interval</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={settings.tiers.tier1.repeatIntervalSec}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier1: { ...s.tiers.tier1, repeatIntervalSec: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Tier 2 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-orange-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="font-bold text-white text-sm">Tier 2: Moderate Alert</span>
                </div>
                <span className="text-xs font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                  +{settings.tiers.tier2.offset} {unit} over limit
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Trigger Offset</label>
                  <input
                    type="number"
                    min="4"
                    max="20"
                    value={settings.tiers.tier2.offset}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier2: { ...s.tiers.tier2, offset: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Sound Tone</label>
                  <select
                    value={settings.tiers.tier2.soundType}
                    onChange={(e) => {
                      const val = e.target.value as AlertSoundType;
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier2: { ...s.tiers.tier2, soundType: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs mt-1"
                  >
                    {Object.entries(SOUND_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Repeat Interval</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={settings.tiers.tier2.repeatIntervalSec}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier2: { ...s.tiers.tier2, repeatIntervalSec: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Tier 3 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-red-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600 animate-ping"></div>
                  <span className="font-bold text-white text-sm">Tier 3: Critical Alarm</span>
                </div>
                <span className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                  +{settings.tiers.tier3.offset} {unit} over limit
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400">Trigger Offset</label>
                  <input
                    type="number"
                    min="8"
                    max="40"
                    value={settings.tiers.tier3.offset}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier3: { ...s.tiers.tier3, offset: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Sound Tone</label>
                  <select
                    value={settings.tiers.tier3.soundType}
                    onChange={(e) => {
                      const val = e.target.value as AlertSoundType;
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier3: { ...s.tiers.tier3, soundType: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs mt-1"
                  >
                    {Object.entries(SOUND_PRESETS).map(([k, p]) => (
                      <option key={k} value={k}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400">Repeat Interval</label>
                  <input
                    type="number"
                    step="0.2"
                    min="0.3"
                    max="3"
                    value={settings.tiers.tier3.repeatIntervalSec}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateSettings((s) => ({
                        ...s,
                        tiers: { ...s.tiers, tier3: { ...s.tiers.tier3, repeatIntervalSec: val } },
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Custom Audio Upload & Microphone Recording */}
      {activeTab === 'custom' && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-white">Custom Audio Clips &amp; Recordings</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload custom sound files or record your own voice / loved one's voice memo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option A: Microphone Recorder */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Microphone Voice Recording</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Record a custom personal voice alert like &quot;Hey, please slow down!&quot;
                </p>
              </div>

              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs animate-pulse"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Stop Recording ({recordTimer}s)</span>
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              )}
            </div>

            {/* Option B: Audio File Upload */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Upload Audio File</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Upload an MP3, WAV, or OGG file from your device
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                onChange={handleAudioUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Choose Audio File</span>
              </button>
            </div>
          </div>

          {/* Current Custom Audio Status */}
          {settings.customAudio.dataUrl && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    {settings.customAudio.fileName || 'Custom Audio Clip'}
                  </div>
                  <div className="text-[11px] text-slate-400">Ready to play upon overspeed</div>
                </div>
              </div>

              <button
                onClick={() => alertEngine.playCustomAudio(settings.customAudio.dataUrl!, settings.masterVolume)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Audition Clip
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Tolerance & Visuals */}
      {activeTab === 'behavior' && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-semibold text-white">Tolerance &amp; Visual Settings</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set trigger margins, speed limit sign appearance, and screen flash effects
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Tolerance Value */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium">Speed Tolerance Buffer</label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 3, 5, 10].map((tol) => (
                  <button
                    key={tol}
                    onClick={() => updateSettings((s) => ({ ...s, toleranceValue: tol }))}
                    className={`py-2 px-3 rounded-xl font-mono text-center border transition-all ${
                      settings.toleranceValue === tol
                        ? 'bg-red-600 text-white border-red-500 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    +{tol} {unit}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Alarm activates when speed exceeds limit by at least +{settings.toleranceValue} {unit}.
              </p>
            </div>

            {/* Speed Limit Sign Style */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium">Speed Limit Sign Style</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => updateSettings((s) => ({ ...s, signStyle: 'us' }))}
                  className={`py-2 px-3 rounded-xl text-center border transition-all ${
                    settings.signStyle === 'us'
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  US MUTCD (Rectangle)
                </button>
                <button
                  onClick={() => updateSettings((s) => ({ ...s, signStyle: 'eu' }))}
                  className={`py-2 px-3 rounded-xl text-center border transition-all ${
                    settings.signStyle === 'eu'
                      ? 'bg-red-600 text-white border-red-500 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  EU Vienna (Red Circle)
                </button>
              </div>
            </div>

            {/* Visual Strobe */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="font-semibold text-white">Screen Border Crimson Strobe</div>
                <div className="text-[11px] text-slate-400">Flash display borders in red while speeding</div>
              </div>
              <input
                type="checkbox"
                checked={settings.strobeScreen}
                onChange={(e) => updateSettings((s) => ({ ...s, strobeScreen: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Haptic Vibration */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="font-semibold text-white">Haptic Device Vibration</div>
                <div className="text-[11px] text-slate-400">Vibrate phone mount during over-speed alert</div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrate}
                onChange={(e) => updateSettings((s) => ({ ...s, vibrate: e.target.checked }))}
                className="w-4 h-4 rounded text-red-600 bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          {/* Backup / Export Settings */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Export or restore your sound settings configuration</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer">
                <FileUp className="w-3.5 h-3.5" />
                <span>Import JSON</span>
                <input type="file" accept=".json" onChange={importSettingsJson} className="hidden" />
              </label>
              <button
                onClick={exportSettingsJson}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
