import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../call/CallContext';

export default function CallScreen() {
  const { call, localStream, remoteStream, hangup, cancelOutgoing, toggleAudio, toggleVideo } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(call.callType === 'video');
  const [durationSec, setDurationSec] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (call.status === 'idle') navigate('/');
  }, [call.status, navigate]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  // Call timer when active
  useEffect(() => {
    if (call.status !== 'active') return;
    const interval = setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [call.status]);

  if (call.status === 'idle') return null;

  const isVideo = call.callType === 'video';
  const isRinging = call.status === 'outgoing-ringing';

  function formatTime(sec) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="call-overlay">
      {/* Top Info Bar */}
      <div className="text-center py-2">
        <h3 className="fw-bold mb-1">{call.peer}</h3>
        <div className="badge bg-dark bg-opacity-75 text-light px-3 py-1 rounded-pill" style={{ border: '1px solid var(--border-light)' }}>
          {isRinging ? 'Ringing…' : isVideo ? `Video Call • ${formatTime(durationSec)}` : `Audio Call • ${formatTime(durationSec)}`}
        </div>
      </div>

      {/* Main Stream Area */}
      <div className="video-container my-3">
        {isVideo ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video-remote"
            />
            {/* Picture in Picture Local Video */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="video-pip"
            />
          </>
        ) : (
          <div className="text-center my-auto p-4">
            <div className="pulsing-call-avatar">
              {call.peer ? call.peer.charAt(0).toUpperCase() : '📞'}
            </div>
            <h5 className="fw-bold text-light mb-1">{call.peer}</h5>
            <p className="text-muted small">{isRinging ? 'Waiting for answer…' : 'Connected'}</p>
            {/* Hidden audio element binding */}
            <audio ref={remoteVideoRef} autoPlay />
            <audio ref={localVideoRef} autoPlay muted />
          </div>
        )}
      </div>

      {/* Floating Call Action Controls Bar */}
      <div className="d-flex align-items-center justify-content-center gap-4 py-2">
        {call.status === 'active' && (
          <>
            {/* Mic Toggle Button */}
            <button
              className={`call-control-btn call-control-btn-secondary ${!micOn ? 'active' : ''}`}
              onClick={() => {
                setMicOn((v) => !v);
                toggleAudio(!micOn);
              }}
              title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micOn ? '🎙️' : '🔇'}
            </button>

            {/* Camera Toggle Button (Video call only) */}
            {isVideo && (
              <button
                className={`call-control-btn call-control-btn-secondary ${!camOn ? 'active' : ''}`}
                onClick={() => {
                  setCamOn((v) => !v);
                  toggleVideo(!camOn);
                }}
                title={camOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {camOn ? '🎥' : '📷'}
              </button>
            )}
          </>
        )}

        {/* Hangup / Cancel Call Button */}
        <button
          className="call-control-btn call-control-btn-danger"
          onClick={isRinging ? cancelOutgoing : hangup}
          title={isRinging ? 'Cancel Call' : 'Hang up'}
        >
          📴
        </button>
      </div>
    </div>
  );
}
