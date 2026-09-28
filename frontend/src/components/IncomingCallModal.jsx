import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../call/CallContext';

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
    <div className="incoming-modal-backdrop">
      <div className="glass-panel p-4 p-sm-5 text-center shadow-lg" style={{ width: '100%', maxWidth: 360 }}>
        {/* Animated Caller Avatar */}
        <div className="pulsing-call-avatar mb-3">
          {call.peer ? call.peer.charAt(0).toUpperCase() : '📞'}
        </div>

        <h4 className="fw-bold mb-1">{call.peer}</h4>
        <p className="text-muted small mb-4">
          Incoming {call.callType === 'video' ? '🎥 Video' : '🎙️ Voice'} Call…
        </p>

        {/* Action Buttons */}
        <div className="d-flex gap-3 justify-content-center">
          <button className="touch-btn touch-btn-danger flex-fill py-3" style={{ fontSize: 16 }} onClick={rejectIncoming}>
            📴 Decline
          </button>
          <button className="touch-btn touch-btn-success flex-fill py-3" style={{ fontSize: 16 }} onClick={handleAccept}>
            📞 Accept
          </button>
        </div>
      </div>
    </div>
  );
}
