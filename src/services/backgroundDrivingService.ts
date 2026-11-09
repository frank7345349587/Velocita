/**
 * Background Driving Sentinel Service
 * Keeps GPS tracking, OSM speed checks, and audio alerts active when the app
 * is minimized, screen is locked, or when using foreground apps like Google Maps/Waze.
 */

class BackgroundDrivingService {
  private silentAudioEl: HTMLAudioElement | null = null;
  private isSentinelActive: boolean = false;
  private hasNotificationPermission: boolean = false;
  private lastNotificationTime: number = 0;
  private notificationThrottleMs: number = 6000; // avoid spamming notifications

  public isBackground: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isBackground = document.visibilityState === 'hidden';
      document.addEventListener('visibilitychange', () => {
        this.isBackground = document.visibilityState === 'hidden';
      });

      if ('Notification' in window) {
        this.hasNotificationPermission = Notification.permission === 'granted';
      }
    }
  }

  /**
   * Request system notification permission for lock-screen over-speed alerts
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    try {
      const perm = await Notification.requestPermission();
      this.hasNotificationPermission = perm === 'granted';
      return this.hasNotificationPermission;
    } catch {
      return false;
    }
  }

  /**
   * Generates a 1-second silent WAV data URI to maintain background audio session
   */
  private generateSilentAudioUri(): string {
    // Minimal valid 1-second 8kHz mono silent PCM WAV
    const header = [
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x1f, 0x00, 0x00, // file size - 8
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // chunk size: 16
      0x01, 0x00,             // format: PCM (1)
      0x01, 0x00,             // channels: 1 (mono)
      0x40, 0x1f, 0x00, 0x00, // sample rate: 8000
      0x40, 0x1f, 0x00, 0x00, // byte rate: 8000
      0x01, 0x00,             // block align: 1
      0x08, 0x00,             // bits per sample: 8
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x1f, 0x00, 0x00, // data size: 7936 bytes
    ];

    const data = new Uint8Array(8000);
    // 8-bit PCM silence is value 128 (0x80)
    data.fill(128);

    const full = new Uint8Array(header.length + data.length);
    full.set(header, 0);
    full.set(data, header.length);

    let binary = '';
    for (let i = 0; i < full.byteLength; i++) {
      binary += String.fromCharCode(full[i]);
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  /**
   * Engages background driving mode:
   * Starts silent audio loop so mobile operating system does not freeze GPS or JavaScript timers
   */
  public engageBackgroundSentinel(): boolean {
    if (this.isSentinelActive) return true;

    try {
      if (!this.silentAudioEl) {
        this.silentAudioEl = new Audio(this.generateSilentAudioUri());
        this.silentAudioEl.loop = true;
        this.silentAudioEl.volume = 0.01; // tiny inaudible level to maintain media focus
      }

      this.silentAudioEl.play().catch((err) => {
        console.warn('Background audio session could not autoplay immediately:', err);
      });

      this.isSentinelActive = true;
      this.setupMediaSession();
      return true;
    } catch (e) {
      console.warn('Background sentinel initiation error:', e);
      return false;
    }
  }

  /**
   * Releases background sentinel
   */
  public disengageBackgroundSentinel() {
    if (this.silentAudioEl) {
      try {
        this.silentAudioEl.pause();
      } catch {}
    }
    this.isSentinelActive = false;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  /**
   * Configures Android Lock Screen / Notification & Android Auto Media widget
   */
  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Velocita Speed Sentinel',
        artist: 'Background Speed Monitoring Active',
        album: 'OpenStreetMap Speed Alert',
      });

      navigator.mediaSession.setActionHandler('play', () => {
        this.engageBackgroundSentinel();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        // Driver pressed pause from steering wheel / lock screen
        this.disengageBackgroundSentinel();
      });
    } catch (e) {
      console.warn('MediaSession setup failed:', e);
    }
  }

  /**
   * Updates Android Lock Screen / Car Head Unit with current speed and road info
   */
  public updateTelemetry(
    speed: number,
    speedLimit: number | null,
    unit: string,
    roadName?: string,
    isSpeeding?: boolean
  ) {
    if (!('mediaSession' in navigator) || !this.isSentinelActive) return;

    try {
      const speedStr = `${Math.round(speed)} ${unit.toUpperCase()}`;
      const limitStr = speedLimit ? `Limit: ${Math.round(speedLimit)} ${unit.toUpperCase()}` : 'No Limit Data';
      const statusPrefix = isSpeeding ? '⚠️ OVER SPEED' : '✓ OK';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${statusPrefix}: ${speedStr} (${limitStr})`,
        artist: roadName ? `Road: ${roadName}` : 'Velocita Background Driving Sentinel',
        album: isSpeeding ? 'SLOW DOWN - Speed Limit Exceeded' : 'Monitoring Speed via OpenStreetMap',
      });
    } catch {}

    // If app is hidden (in background) and speeding, fire system notification
    if (this.isBackground && isSpeeding && speedLimit !== null) {
      this.notifyBackgroundOverSpeed(speed, speedLimit, unit, roadName);
    }
  }

  /**
   * Fires a native system notification when speeding while running in the background
   */
  private notifyBackgroundOverSpeed(
    speed: number,
    speedLimit: number,
    unit: string,
    roadName?: string
  ) {
    if (!this.hasNotificationPermission || !('Notification' in window)) return;

    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationThrottleMs) {
      return;
    }
    this.lastNotificationTime = now;

    try {
      const delta = Math.round(speed - speedLimit);
      const title = `⚠️ Speed Limit Exceeded: +${delta} ${unit.toUpperCase()}`;
      const body = `You are driving ${Math.round(speed)} ${unit} in a ${Math.round(speedLimit)} ${unit} zone (${roadName || 'Current Road'}).`;

      new Notification(title, {
        body,
        tag: 'velocita-speed-alert',
        silent: false,
      } as any);
    } catch (err) {
      console.warn('Failed to dispatch background notification:', err);
    }
  }

  public getStatus() {
    return {
      isActive: this.isSentinelActive,
      isBackground: this.isBackground,
      hasNotifications: this.hasNotificationPermission,
    };
  }
}

export const backgroundDriving = new BackgroundDrivingService();
