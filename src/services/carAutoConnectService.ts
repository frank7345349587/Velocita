import { CarAutoConnectSettings, ConnectionStatus } from '../types/autoConnect';
import { alertEngine } from './audioAlertEngine';
import { backgroundDriving } from './backgroundDrivingService';

class CarAutoConnectService {
  private wakeLock: any = null;
  private statusListeners: Array<(status: ConnectionStatus) => void> = [];
  private onAutoActivateCallback: (() => void) | null = null;
  private batteryObj: any = null;

  public status: ConnectionStatus = {
    isBluetoothConnected: false,
    connectedDeviceName: null,
    isPowerConnected: false,
    isAudioConnectedToCar: false,
    isWakeLockActive: false,
    isAutoActive: false,
    isBackgroundSentinelActive: false,
    isAppInBackground: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  };

  public init(settings: CarAutoConnectSettings, onAutoActivate: () => void) {
    this.onAutoActivateCallback = onAutoActivate;
    this.setupPowerDetection(settings);
    this.setupAudioSinkDetection(settings);

    // If wake lock enabled and already active
    if (settings.keepScreenAwake) {
      this.acquireWakeLock();
    }

    // If background driving sentinel is enabled
    if (settings.runInBackground) {
      backgroundDriving.engageBackgroundSentinel();
      this.status.isBackgroundSentinelActive = true;
      this.notify();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.status.isAppInBackground = document.visibilityState === 'hidden';
        this.notify();
      });
    }
  }

  public subscribe(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.push(callback);
    callback({ ...this.status });
    return () => {
      this.statusListeners = this.statusListeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.statusListeners.forEach((cb) => cb({ ...this.status }));
  }

  /**
   * Acquire screen wake lock so the phone screen doesn't sleep while driving
   */
  public async acquireWakeLock(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.status.isWakeLockActive = true;
        this.notify();

        this.wakeLock.addEventListener('release', () => {
          this.status.isWakeLockActive = false;
          this.notify();
        });
        return true;
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
    return false;
  }

  public releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
      this.status.isWakeLockActive = false;
      this.notify();
    }
  }

  /**
   * Listen for car charger / Android Auto USB connection
   */
  private async setupPowerDetection(settings: CarAutoConnectSettings) {
    if ('getBattery' in navigator) {
      try {
        this.batteryObj = await (navigator as any).getBattery();
        const updateCharging = () => {
          const wasCharging = this.status.isPowerConnected;
          this.status.isPowerConnected = !!this.batteryObj.charging;
          this.notify();

          if (!wasCharging && this.batteryObj.charging && settings.enabled && settings.triggerOnPowerConnected) {
            this.triggerAutoActivation(settings, 'Car Power / Android Auto USB connected');
          }
        };

        updateCharging();
        this.batteryObj.addEventListener('chargingchange', updateCharging);
      } catch (e) {
        console.warn('Battery API not available:', e);
      }
    }
  }

  /**
   * Listen for Audio sink change (e.g. phone connects to car Bluetooth audio or aux)
   */
  private setupAudioSinkDetection(settings: CarAutoConnectSettings) {
    if ('mediaDevices' in navigator && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
          // Check if any audio output looks like bluetooth or external car stereo
          const carOutput = audioOutputs.find(
            (d) =>
              d.label.toLowerCase().includes('car') ||
              d.label.toLowerCase().includes('bluetooth') ||
              d.label.toLowerCase().includes('auto') ||
              d.label.toLowerCase().includes('handsfree') ||
              d.label.toLowerCase().includes('sync')
          );

          if (carOutput) {
            this.status.isAudioConnectedToCar = true;
            this.status.connectedDeviceName = carOutput.label;
            this.notify();

            if (settings.enabled && settings.triggerOnAudioSink) {
              this.triggerAutoActivation(settings, `Car Audio Sink (${carOutput.label})`);
            }
          }
        } catch {}
      };
    }
  }

  /**
   * Request Bluetooth connection with Car Stereo using Web Bluetooth
   */
  public async pairCarBluetooth(settings: CarAutoConnectSettings): Promise<string | null> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome on Android or desktop.');
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['generic_access', 'battery_service'],
      });

      this.status.isBluetoothConnected = true;
      this.status.connectedDeviceName = device.name || 'Car Stereo';
      this.notify();

      if (settings.enabled && settings.triggerOnBluetooth) {
        this.triggerAutoActivation(settings, `Bluetooth Car Stereo (${device.name})`);
      }

      device.addEventListener('gattserverdisconnected', () => {
        this.status.isBluetoothConnected = false;
        this.notify();
      });

      return device.name || 'Connected Vehicle Device';
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.warn('Bluetooth connection error:', err);
      }
      return null;
    }
  }

  /**
   * Triggers the full auto-activation sequence (GPS, Audio, Greeting)
   */
  public triggerAutoActivation(settings: CarAutoConnectSettings, reason: string) {
    this.status.isAutoActive = true;
    this.notify();

    // 1. Acquire Wake Lock
    if (settings.keepScreenAwake) {
      this.acquireWakeLock();
    }

    // 2. Play greeting chime
    if (settings.playCarConnectedSound) {
      alertEngine.playSynthBurst(
        {
          waveform: 'sine',
          baseFrequency: 587.33, // D5
          harmonic: 'perfect-fifth',
          beepRate: 0,
          dutyCycle: 0.5,
          dynamicPitch: false,
          attack: 0.01,
          decay: 0.2,
          sustain: 0.2,
          release: 0.1,
          volume: 0.8,
        },
        0.85,
        0
      );
    }

    // 3. Spoken voice announcement
    if (settings.speakGreeting && settings.greetingText) {
      setTimeout(() => {
        alertEngine.speakVoiceAlert(settings.greetingText, {
          rate: 1.05,
          pitch: 1.0,
          volume: 1.0,
          cooldownSeconds: 0,
        });
      }, 400);
    }

    // 4. Engage background driving sentinel so GPS and chimes continue in background
    if (settings.runInBackground) {
      backgroundDriving.engageBackgroundSentinel();
      this.status.isBackgroundSentinelActive = true;
      this.notify();
    }

    // 5. Trigger App Callback (starts GPS tracking, un-mutes, sets mode)
    if (this.onAutoActivateCallback) {
      this.onAutoActivateCallback();
    }
  }

  /**
   * Manually simulate car connection (useful for testing and setup)
   */
  public simulateCarConnection(settings: CarAutoConnectSettings, type: 'bluetooth' | 'android-auto' | 'dock') {
    if (type === 'bluetooth') {
      this.status.isBluetoothConnected = true;
      this.status.connectedDeviceName = settings.pairedBluetoothDeviceName || 'Subaru BT / Car Multimedia';
    } else if (type === 'android-auto') {
      this.status.isPowerConnected = true;
      this.status.isAudioConnectedToCar = true;
      this.status.connectedDeviceName = 'Android Auto Head Unit';
    } else {
      this.status.isPowerConnected = true;
      this.status.connectedDeviceName = 'Magnetic Car Mount (Fast Charge)';
    }

    this.triggerAutoActivation(settings, `Simulated ${type}`);
  }
}

export const carAutoConnect = new CarAutoConnectService();
