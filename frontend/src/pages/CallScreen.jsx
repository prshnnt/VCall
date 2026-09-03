import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../call/CallContext';

export default function CallScreen() {
  const { call, localStream, remoteStream, hangup, cancelOutgoing, toggleAudio, toggleVideo } = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(call.callType === 'video');
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

  if (call.status === 'idle') return null;

  const isVideo = call.callType === 'video';
  const isRinging = call.status === 'outgoing-ringing';

  return (
    <div className="container py-4 text-center" style={{ maxWidth: 720 }}>
      <h4>
        {isRinging ? 'Calling…' : 'On call with'} <strong>{call.peer}</strong>
      </h4>
      <p className="text-muted">{isVideo ? 'Video call' : 'Voice call'}</p>

      <div className="position-relative bg-dark rounded mb-3 d-flex align-items-center justify-content-center" style={{ minHeight: 360 }}>
        {isVideo ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-100 rounded"
              style={{ maxHeight: 420, background: '#111' }}
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="position-absolute bottom-0 end-0 m-2 rounded border border-light"
              style={{ width: 140 }}
            />
          </>
        ) : (
          <div className="text-light">
            <div style={{ fontSize: 64 }}>🎙️</div>
            <p>{isRinging ? 'Ringing…' : 'Audio connected'}</p>
            {/* Hidden audio elements still need to be attached for audio-only calls */}
            <audio ref={remoteVideoRef} autoPlay />
            <audio ref={localVideoRef} autoPlay muted />
          </div>
        )}
      </div>

      <div className="d-flex justify-content-center gap-3">
        {call.status === 'active' && (
          <>
            <button
              className={`btn ${micOn ? 'btn-outline-secondary' : 'btn-secondary'}`}
              onClick={() => {
                setMicOn((v) => !v);
                toggleAudio(!micOn);
              }}
            >
              {micOn ? '🎙️ Mute' : '🔇 Unmute'}
            </button>
            {isVideo && (
              <button
                className={`btn ${camOn ? 'btn-outline-secondary' : 'btn-secondary'}`}
                onClick={() => {
                  setCamOn((v) => !v);
                  toggleVideo(!camOn);
                }}
              >
                {camOn ? '🎥 Camera off' : '📷 Camera on'}
              </button>
            )}
          </>
        )}
        <button className="btn btn-danger" onClick={isRinging ? cancelOutgoing : hangup}>
          {isRinging ? 'Cancel' : '📴 Hang up'}
        </button>
      </div>
    </div>
  );
}
