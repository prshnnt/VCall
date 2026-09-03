import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSignaling } from '../ws/SignalingContext';
import { WebRTCManager } from '../webrtc/WebRTCManager';

const CallContext = createContext(null);

// call.status: 'idle' | 'outgoing-ringing' | 'incoming-ringing' | 'active' | 'ended'
const initialCall = { status: 'idle' };

export function CallProvider({ children }) {
  const { send, subscribe, iceServers } = useSignaling();
  const [call, setCall] = useState(initialCall);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError] = useState(null);
  const rtcRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const cleanupMedia = useCallback(() => {
    rtcRef.current?.close();
    rtcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
  }, []);

  const resetToIdle = useCallback(() => {
    cleanupMedia();
    setCall(initialCall);
  }, [cleanupMedia]);

  // ---- Outgoing call ----
  const startCall = useCallback(
    (peer, callType) => {
      setError(null);
      setCall({ status: 'outgoing-ringing', peer, callType, isCaller: true });
      send('call:invite', peer, { callType });
    },
    [send]
  );

  const cancelOutgoing = useCallback(() => {
    if (call.peer) send('call:cancel', call.peer);
    resetToIdle();
  }, [call.peer, send, resetToIdle]);

  // ---- Incoming call ----
  const acceptIncoming = useCallback(async () => {
    if (call.status !== 'incoming-ringing') return;
    try {
      const rtc = new WebRTCManager({
        iceServers,
        onRemoteStream: setRemoteStream,
        onIceCandidate: (candidate) => send('webrtc:ice', call.peer, { candidate }),
      });
      rtcRef.current = rtc;
      const stream = await rtc.getLocalMedia(call.callType);
      setLocalStream(stream);
      send('call:accept', call.peer, {});
      setCall((c) => ({ ...c, status: 'active' }));
    } catch (err) {
      setError('Could not access camera/microphone: ' + err.message);
      send('call:reject', call.peer, {});
      resetToIdle();
    }
  }, [call, iceServers, send, resetToIdle]);

  const rejectIncoming = useCallback(() => {
    if (call.peer) send('call:reject', call.peer);
    resetToIdle();
  }, [call.peer, send, resetToIdle]);

  const hangup = useCallback(() => {
    if (call.peer && call.status !== 'idle') send('call:hangup', call.peer);
    resetToIdle();
  }, [call.peer, call.status, send, resetToIdle]);

  // ---- Wire up signaling events ----
  useEffect(() => {
    const unsubscribe = subscribe(async (msg) => {
      switch (msg.type) {
        case 'call:invite': {
          // If we're busy, the backend already handled "busy" logic server-side
          // by rejecting the second invite before it reaches us; here we just
          // render the incoming call UI.
          setError(null);
          setCall({
            status: 'incoming-ringing',
            peer: msg.from,
            callType: msg.payload?.callType || 'audio',
            callId: msg.payload?.callId,
            isCaller: false,
          });
          break;
        }

        case 'call:ringing':
          setCall((c) => (c.status === 'outgoing-ringing' ? { ...c, callId: msg.payload?.callId } : c));
          break;

        case 'call:accept': {
          // We were the caller; the callee accepted. Create our offer.
          setCall((c) => {
            if (c.status !== 'outgoing-ringing') return c;
            (async () => {
              try {
                const rtc = new WebRTCManager({
                  iceServers,
                  onRemoteStream: setRemoteStream,
                  onIceCandidate: (candidate) => send('webrtc:ice', c.peer, { candidate }),
                });
                rtcRef.current = rtc;
                const stream = await rtc.getLocalMedia(c.callType);
                setLocalStream(stream);
                const offer = await rtc.createOffer();
                send('webrtc:offer', c.peer, { sdp: offer });
              } catch (err) {
                setError('Could not access camera/microphone: ' + err.message);
                send('call:hangup', c.peer);
                resetToIdle();
              }
            })();
            return { ...c, status: 'active' };
          });
          break;
        }

        case 'webrtc:offer': {
          if (rtcRef.current) {
            const answer = await rtcRef.current.createAnswer(msg.payload.sdp);
            send('webrtc:answer', msg.from, { sdp: answer });
            for (const cand of pendingCandidatesRef.current) rtcRef.current.addIceCandidate(cand);
            pendingCandidatesRef.current = [];
          }
          break;
        }

        case 'webrtc:answer': {
          if (rtcRef.current) {
            await rtcRef.current.acceptAnswer(msg.payload.sdp);
            for (const cand of pendingCandidatesRef.current) rtcRef.current.addIceCandidate(cand);
            pendingCandidatesRef.current = [];
          }
          break;
        }

        case 'webrtc:ice': {
          if (rtcRef.current) {
            rtcRef.current.addIceCandidate(msg.payload.candidate);
          } else {
            pendingCandidatesRef.current.push(msg.payload.candidate);
          }
          break;
        }

        case 'call:reject':
          setError(`${msg.from} declined the call.`);
          resetToIdle();
          break;

        case 'call:cancel':
          setError(`${msg.from} cancelled the call.`);
          resetToIdle();
          break;

        case 'call:hangup':
          resetToIdle();
          break;

        case 'call:error':
          setError(describeCallError(msg.payload));
          resetToIdle();
          break;

        default:
          break;
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, iceServers, send, resetToIdle]);

  const toggleAudio = useCallback((enabled) => rtcRef.current?.toggleAudio(enabled), []);
  const toggleVideo = useCallback((enabled) => rtcRef.current?.toggleVideo(enabled), []);

  return (
    <CallContext.Provider
      value={{
        call,
        localStream,
        remoteStream,
        error,
        clearError: () => setError(null),
        startCall,
        cancelOutgoing,
        acceptIncoming,
        rejectIncoming,
        hangup,
        toggleAudio,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

function describeCallError(payload) {
  switch (payload?.reason) {
    case 'user_not_found':
      return `No user found with id "${payload.to}".`;
    case 'user_offline':
      return `${payload.to} is offline right now.`;
    case 'busy':
      return `${payload.to} is on another call.`;
    case 'cannot_call_self':
      return "You can't call yourself.";
    default:
      return 'Call could not be completed.';
  }
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
