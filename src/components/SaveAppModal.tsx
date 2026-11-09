import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  CheckCircle2, 
  X,
  Bookmark,
  ShieldCheck,
  HardDrive,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Info
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { RingSettings } from '../types/speedometer';

interface SaveAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RingSettings;
}

export const SaveAppModal: React.FC<SaveAppModalProps> = ({ isOpen, onClose, settings }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, appUrl, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const exportSettingsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `velocita-config-${Date.now()}.json`);
    dlAnchor.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-sans text-white">Install &amp; Save Velocita</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              PWA Ready
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Install Velocita directly onto your phone home screen, car dashboard, or desktop for instant launch.
          </p>
        </div>

        {/* Browser Security Notice when inside iframe */}
        {isInIframe && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Why your browser says &quot;Can&apos;t install&quot;</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Google Chrome and Apple Safari security policies block web app installation when inside an embedded AI Studio preview iframe. To install, simply open the app in a dedicated tab:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <span>Open in New Tab to Install</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <button
                onClick={handleCopyUrl}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                <span>{copiedUrl ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Install Card */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-600/20 text-red-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Standalone App Installation</div>
                <div className="text-xs text-slate-400">Full-screen HUD, background audio keep-alive, car stereo auto-start</div>
              </div>
            </div>
            {isInstalled && (
              <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Installed</span>
              </span>
            )}
          </div>

          {/* 1-Click Install Button when browser fires install prompt */}
          {isInstallable && (
            <button
              onClick={install}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Install Velocita to Home Screen Now</span>
            </button>
          )}

          {/* Device-Specific Direct Instructions */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Easy steps to install on your device:</span>
            </div>
            
            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="font-bold text-slate-100 flex items-center justify-between">
                  <span>🤖 Android (Google Chrome):</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Home Screen Ready
                  </span>
                </div>
                <p className="text-slate-300">
                  In Chrome, tap the menu (<span className="text-white font-mono font-bold">⋮</span> at top right) &gt; Tap <strong>&quot;Install and create shortcut&quot;</strong> &gt; Tap <strong>&quot;Create shortcut&quot;</strong> (or <strong>&quot;Install&quot;</strong>).
                </p>
                <p className="text-[10px] text-slate-400">
                  Chrome places the Velocita icon directly on your home screen. Tapping it opens Velocita full-screen without the browser URL bar!
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="font-bold text-slate-100 flex items-center gap-1">
                  <span>🍏 iPhone / iPad (Safari):</span>
                </div>
                <p className="mt-0.5 text-slate-400">
                  Open in Safari &gt; Tap the Share button (<span className="text-blue-400 font-semibold">[↑]</span> at the bottom toolbar) &gt; Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="font-bold text-slate-100 flex items-center gap-1">
                  <span>💻 Computer (Chrome / Edge):</span>
                </div>
                <p className="mt-0.5 text-slate-400">
                  Click the <strong>Install icon (⊕)</strong> on the right side of the address bar, or click Menu (<span className="text-white font-mono font-bold">⋮</span>) &gt; <strong>Cast, save &amp; share &gt; Install Velocita</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scan QR Code with Phone */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-white">Scan with Phone to Install in Car</span>
            </div>
            <button
              onClick={() => setShowQr(!showQr)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {showQr ? 'Hide QR Code' : 'Show Phone QR Code'}
            </button>
          </div>

          {showQr && (
            <div className="flex flex-col items-center p-4 bg-white rounded-2xl mx-auto max-w-[220px]">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}`}
                alt="QR Code to open Velocita on Phone"
                className="w-40 h-40"
              />
              <span className="text-[10px] font-sans text-slate-700 mt-2 text-center font-medium">
                Point your phone camera here to open &amp; install
              </span>
            </div>
          )}
        </div>

        {/* Google Authentication Note for Cloud Run */}
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-start gap-2.5 text-[11px] text-slate-400">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <span>
            <strong>Note for mobile access:</strong> If opening the link on your phone, ensure your mobile browser is logged into your Google account (<strong>hurleyfrank696@gmail.com</strong>) so Google Cloud grants secure access.
          </span>
        </div>

        {/* Settings Backup */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Settings saved automatically</span>
          </div>

          <button
            onClick={exportSettingsJson}
            className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup (.json)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
