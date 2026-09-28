import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, getStoredUser } from '../api/client';
import { useSignaling } from '../ws/SignalingContext';
import { useCall } from '../call/CallContext';

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [activePeer, setActivePeer] = useState(searchParams.get('peer') || '');
  const [newPeerId, setNewPeerId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const { subscribe, send } = useSignaling();
  const { startCall } = useCall();
  const me = getStoredUser();
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  function refreshThreads() {
    api.threads().then(setThreads).catch(() => {});
  }

  useEffect(() => {
    refreshThreads();
  }, []);

  useEffect(() => {
    if (!activePeer) return;
    setSearchParams({ peer: activePeer });
    api
      .thread(activePeer)
      .then(setMessages)
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeer]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'chat:message') {
        if (msg.from === activePeer) {
          setMessages((prev) => [...prev, { id: msg.payload.id, from: msg.from, body: msg.payload.body, sentAt: msg.payload.sentAt, mine: false }]);
        }
        refreshThreads();
      } else if (msg.type === 'chat:sent') {
        if (msg.payload.to === activePeer) {
          setMessages((prev) => [...prev, { id: msg.payload.id, from: me?.user_id, body: msg.payload.body, sentAt: msg.payload.sentAt, mine: true }]);
        }
        refreshThreads();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, activePeer, me?.user_id]);

  function openThread(peerId) {
    setError('');
    setActivePeer(peerId.trim());
    setNewPeerId('');
  }

  function handleBackToThreads() {
    setActivePeer('');
    setSearchParams({});
  }

  function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activePeer) return;
    const delivered = send('chat:message', activePeer, { body });
    if (!delivered) {
      // Fall back to REST if the socket happens to be down.
      api.sendMessage(activePeer, body).then(() => {
        setMessages((prev) => [...prev, { from: me?.user_id, body, sentAt: new Date().toISOString(), mine: true }]);
      });
    }
    setDraft('');
  }

  function handleStartCall(type) {
    if (!activePeer) return;
    startCall(activePeer, type);
    navigate('/call');
  }

  return (
    <div className="container-fluid p-2 p-md-3" style={{ maxWidth: 1080 }}>
      <div className="chat-layout">
        {/* Sidebar / Conversations List */}
        <div className={`chat-threads-sidebar ${activePeer ? 'mobile-hide' : ''}`}>
          <div className="p-3 border-bottom border-secondary border-opacity-25">
            <h5 className="fw-bold mb-3 d-flex align-items-center justify-content-between">
              <span>💬 Messages</span>
            </h5>
            <form
              className="d-flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPeerId.trim()) openThread(newPeerId);
              }}
            >
              <input
                className="form-control modern-input py-2"
                placeholder="Start chat with user ID..."
                value={newPeerId}
                onChange={(e) => setNewPeerId(e.target.value)}
              />
              <button className="touch-btn touch-btn-primary px-3" type="submit">
                Go
              </button>
            </form>
          </div>

          <div className="flex-grow-1 overflow-auto">
            {threads.length === 0 ? (
              <div className="text-center text-muted small p-4">
                No recent conversations.<br />Enter a User ID above to start chatting!
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.peer}
                  className={`chat-thread-item ${t.peer === activePeer ? 'active' : ''}`}
                  onClick={() => openThread(t.peer)}
                >
                  <div className="avatar-circle">
                    {t.peer.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="fw-bold text-truncate">{t.peer}</span>
                    </div>
                    <div className="small text-muted text-truncate" style={{ opacity: 0.85 }}>
                      {t.lastMessage}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active Chat Thread Window */}
        <div className={`chat-main-area ${!activePeer ? 'mobile-hide' : ''}`}>
          {!activePeer ? (
            <div className="m-auto text-center p-4">
              <div style={{ fontSize: 48, opacity: 0.4 }}>💬</div>
              <h5 className="fw-semibold text-muted mt-2">Select a conversation</h5>
              <p className="text-dim small">Choose a contact on the left or enter a new user ID</p>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="p-3 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between bg-dark bg-opacity-40">
                <div className="d-flex align-items-center gap-2">
                  <button className="touch-btn touch-btn-secondary p-2 d-md-none" onClick={handleBackToThreads} title="Back to chats">
                    ←
                  </button>
                  <div className="avatar-circle" style={{ width: 36, height: 36, fontSize: 14 }}>
                    {activePeer.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0">{activePeer}</h6>
                    <span className="text-success small" style={{ fontSize: 11 }}>● active</span>
                  </div>
                </div>

                {/* Direct Call Quick Buttons */}
                <div className="d-flex gap-2">
                  <button className="touch-btn touch-btn-success px-3 py-1" style={{ fontSize: 13 }} onClick={() => handleStartCall('audio')}>
                    🎙️ <span className="d-none d-sm-inline">Voice</span>
                  </button>
                  <button className="touch-btn touch-btn-primary px-3 py-1" style={{ fontSize: 13 }} onClick={() => handleStartCall('video')}>
                    🎥 <span className="d-none d-sm-inline">Video</span>
                  </button>
                </div>
              </div>

              {error && <div className="alert alert-danger m-2 py-2 px-3 small">{error}</div>}

              {/* Messages Body */}
              <div className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2">
                {messages.map((m, i) => (
                  <div key={m.id ?? i} className={`d-flex ${m.mine ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div className={m.mine ? 'chat-bubble-mine' : 'chat-bubble-peer'}>
                      <div>{m.body}</div>
                      <div className="text-end mt-1" style={{ fontSize: 10, opacity: 0.7 }}>
                        {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Message Input Footer */}
              <form className="p-2 p-md-3 border-top border-secondary border-opacity-25 bg-dark bg-opacity-50" onSubmit={handleSend}>
                <div className="input-group">
                  <input
                    className="form-control modern-input"
                    placeholder={`Message ${activePeer}…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="touch-btn touch-btn-primary px-4" disabled={!draft.trim()}>
                    Send ✈️
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
