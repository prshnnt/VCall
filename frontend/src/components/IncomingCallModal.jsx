import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../call/CallContext';

// Generates a simple two-tone ringtone with the Web Audio API so we don't
// need to ship/host an audio file.
function useRingtone(active) {
  const ctxRef = useRef(null);
  const stopRef = useRef(null);

  useEffect(() => {
    if (!active) {
      stopRef.current?.();
      return;
    }
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = audioCtx;
    let stopped = false;

    function ring() {
      if (stopped) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 440;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
      setTimeout(() => !stopped && ring(), 1500);
    }
    ring();

    stopRef.current = () => {
      stopped = true;
      audioCtx.close();
    };
    return () => stopRef.current?.();
  }, [active]);
}

export default function IncomingCallModal() {
  const { call, acceptIncoming, rejectIncoming } = useCall();
  const navigate = useNavigate();
  const isIncoming = call.status === 'incoming-ringing';
  useRingtone(isIncoming);

  if (!isIncoming) return null;

  async function handleAccept() {
    await acceptIncoming();
    navigate('/call');
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
    >
      <div className="card shadow-lg" style={{ width: 340 }}>
        <div className="card-body text-center p-4">
          <div style={{ fontSize: 48 }}>{call.callType === 'video' ? '🎥' : '📞'}</div>
          <h5 className="mt-2">{call.peer}</h5>
          <p className="text-muted">Incoming {call.callType} call…</p>
          <div className="d-flex gap-2 justify-content-center mt-3">
            <button className="btn btn-danger" onClick={rejectIncoming}>
              Decline
            </button>
            <button className="btn btn-success" onClick={handleAccept}>
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
