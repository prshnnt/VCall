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

    // iOS Safari never fires beforeinstallprompt -- fall back to a
    // one-time hint pointing at the native Share sheet.
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
    <div className="alert alert-primary d-flex justify-content-between align-items-center mb-0 rounded-0 py-2">
      <div>
        {deferredPrompt ? (
          <>📲 Install CallChat for quick access and call notifications.</>
        ) : (
          <>
            📲 Install CallChat: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
          </>
        )}
      </div>
      <div className="d-flex gap-2">
        {deferredPrompt && (
          <button className="btn btn-sm btn-primary" onClick={handleInstallClick}>
            Install
          </button>
        )}
        <button className="btn btn-sm btn-outline-secondary" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
