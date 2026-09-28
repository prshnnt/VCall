import { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('installPromptDismissed') === '1');
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);

    if (isIOS()) setShowIosHelp(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem('installPromptDismissed', '1');
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (dismissed || isStandalone() || (!deferredPrompt && !showIosHelp)) return null;

  return (
    <div className="install-banner">
      <div className="d-flex align-items-center gap-2">
        <span style={{ fontSize: 18 }}>📲</span>
        <div style={{ fontSize: 13, color: 'var(--text-main)' }}>
          {deferredPrompt ? (
            <>Install <strong>CallChat</strong> for instant call notifications.</>
          ) : (
            <>
              Install <strong>CallChat</strong>: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
            </>
          )}
        </div>
      </div>
      <div className="d-flex gap-2 align-items-center">
        {deferredPrompt && (
          <button className="touch-btn touch-btn-primary px-3 py-1" style={{ fontSize: 12 }} onClick={handleInstallClick}>
            Install
          </button>
        )}
        <button className="btn btn-sm text-muted p-1 border-0" onClick={dismiss} title="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
