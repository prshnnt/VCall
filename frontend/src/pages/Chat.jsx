import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, getStoredUser } from '../api/client';
import { useSignaling } from '../ws/SignalingContext';

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [activePeer, setActivePeer] = useState(searchParams.get('peer') || '');
  const [newPeerId, setNewPeerId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const { subscribe, send } = useSignaling();
  const me = getStoredUser();
  const bottomRef = useRef(null);

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
          setMessages((prev) => [...prev, { id: msg.payload.id, from: me.user_id, body: msg.payload.body, sentAt: msg.payload.sentAt, mine: true }]);
        }
        refreshThreads();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, activePeer]);

  function openThread(peerId) {
    setError('');
    setActivePeer(peerId.trim());
    setNewPeerId('');
  }

  function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activePeer) return;
    const delivered = send('chat:message', activePeer, { body });
    if (!delivered) {
      // Fall back to REST if the socket happens to be down.
      api.sendMessage(activePeer, body).then(() => {
        setMessages((prev) => [...prev, { from: me.user_id, body, sentAt: new Date().toISOString(), mine: true }]);
      });
    }
    setDraft('');
  }

  return (
    <div className="container-fluid py-3" style={{ maxWidth: 960 }}>
      <div className="row" style={{ minHeight: '70vh' }}>
        <div className="col-4 border-end">
          <form
            className="input-group mb-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newPeerId.trim()) openThread(newPeerId);
            }}
          >
            <input
              className="form-control"
              placeholder="New chat: user ID"
              value={newPeerId}
              onChange={(e) => setNewPeerId(e.target.value)}
            />
            <button className="btn btn-outline-primary">Go</button>
          </form>
          <div className="list-group">
            {threads.map((t) => (
              <button
                key={t.peer}
                className={`list-group-item list-group-item-action ${t.peer === activePeer ? 'active' : ''}`}
                onClick={() => openThread(t.peer)}
              >
                <div className="fw-bold">{t.peer}</div>
                <div className="small text-truncate" style={{ opacity: 0.8 }}>
                  {t.lastMessage}
                </div>
              </button>
            ))}
            {threads.length === 0 && <p className="text-muted small px-1">No conversations yet.</p>}
          </div>
        </div>

        <div className="col-8 d-flex flex-column">
          {!activePeer ? (
            <p className="text-muted m-auto">Select or start a conversation.</p>
          ) : (
            <>
              <h6 className="border-bottom pb-2">Chat with {activePeer}</h6>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div className="flex-grow-1 overflow-auto mb-2" style={{ maxHeight: '55vh' }}>
                {messages.map((m, i) => (
                  <div key={m.id ?? i} className={`d-flex mb-2 ${m.mine ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div
                      className={`px-3 py-2 rounded-3 ${m.mine ? 'bg-primary text-white' : 'bg-light'}`}
                      style={{ maxWidth: '75%' }}
                    >
                      <div>{m.body}</div>
                      <div className={`small ${m.mine ? 'text-white-50' : 'text-muted'}`}>
                        {new Date(m.sentAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="input-group" onSubmit={handleSend}>
                <input
                  className="form-control"
                  placeholder="Type a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button className="btn btn-primary">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
