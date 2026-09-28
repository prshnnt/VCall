import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCall } from '../call/CallContext';

export default function Dialer() {
  const [targetId, setTargetId] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [checking, setChecking] = useState(false);
  const [recentCalls, setRecentCalls] = useState([]);
  const { startCall, call, error, clearError } = useCall();
  const navigate = useNavigate();

  useEffect(() => {
    api.callHistory().then(setRecentCalls).catch(() => {});
  }, []);

  // Once a call becomes active/ringing, jump to the call screen.
  useEffect(() => {
    if (call.status === 'outgoing-ringing' || call.status === 'active') {
      navigate('/call');
    }
  }, [call.status, navigate]);

  async function placeCall(callType) {
    const id = targetId.trim();
    if (!id) return;
    setLookupError('');
    clearError();
    setChecking(true);
    try {
      await api.lookupUser(id);
      startCall(id, callType);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setChecking(false);
    }
  }

  function handleDialPadKey(char) {
    setTargetId((prev) => prev + char);
  }

  function handleBackspace() {
    setTargetId((prev) => prev.slice(0, -1));
  }

  return (
    <div className="container py-3 py-md-4" style={{ maxWidth: 520 }}>
      {/* Top Banner / Card */}
      <div className="glass-panel p-4 mb-4">
        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2">
          <span>📞</span> Make a Call
        </h4>

        {error && (
          <div className="alert alert-warning alert-dismissible fade show rounded-3 small">
            {error}
            <button type="button" className="btn-close" onClick={clearError}></button>
          </div>
        )}
        {lookupError && <div className="alert alert-danger py-2 rounded-3 small mb-3">{lookupError}</div>}

        {/* Input Field with Clear Button */}
        <div className="position-relative mb-3">
          <input
            className="form-control modern-input text-center fw-bold fs-4 pe-5"
            placeholder="Enter User ID..."
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && placeCall('audio')}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {targetId && (
            <button
              className="btn position-absolute top-50 end-0 translate-middle-y me-2 text-muted p-1 border-0"
              onClick={() => setTargetId('')}
              title="Clear"
              style={{ fontSize: 18, background: 'none' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="d-flex gap-2 mb-4">
          <button
            className="touch-btn touch-btn-success flex-fill py-3"
            style={{ fontSize: 15 }}
            disabled={checking || !targetId.trim()}
            onClick={() => placeCall('audio')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            Voice Call
          </button>
          <button
            className="touch-btn touch-btn-primary flex-fill py-3"
            style={{ fontSize: 15 }}
            disabled={checking || !targetId.trim()}
            onClick={() => placeCall('video')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            Video Call
          </button>
        </div>

        {/* Tactile Mobile Dial Pad */}
        <div className="dialpad-grid">
          {[
            { num: '1', sub: '' },
            { num: '2', sub: 'ABC' },
            { num: '3', sub: 'DEF' },
            { num: '4', sub: 'GHI' },
            { num: '5', sub: 'JKL' },
            { num: '6', sub: 'MNO' },
            { num: '7', sub: 'PQRS' },
            { num: '8', sub: 'TUV' },
            { num: '9', sub: 'WXYZ' },
            { num: '*', sub: '' },
            { num: '0', sub: '+' },
            { num: '#', sub: '' },
          ].map((k) => (
            <button key={k.num} type="button" className="dialpad-btn" onClick={() => handleDialPadKey(k.num)}>
              <span>{k.num}</span>
              {k.sub && <span className="dialpad-sub">{k.sub}</span>}
            </button>
          ))}
        </div>
        {targetId && (
          <div className="text-center">
            <button type="button" className="touch-btn touch-btn-secondary px-3 py-1 text-muted" style={{ fontSize: 13 }} onClick={handleBackspace}>
              ⌫ Backspace
            </button>
          </div>
        )}
      </div>

      {/* Recent Calls Section */}
      <div className="glass-panel p-4">
        <h6 className="fw-semibold text-muted mb-3 d-flex align-items-center justify-content-between">
          <span>Recent Calls</span>
          <span className="badge bg-dark text-muted">{recentCalls.length}</span>
        </h6>

        {recentCalls.length === 0 ? (
          <p className="text-muted small text-center py-3 mb-0">No calls in history yet.</p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {recentCalls.map((c) => (
              <div
                key={c.id}
                className="d-flex align-items-center justify-content-between p-3 rounded-3"
                style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div className="avatar-circle">
                    {c.peer.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="fw-bold">{c.peer}</div>
                    <div className="small text-muted d-flex align-items-center gap-1 mt-1">
                      <span className={c.direction === 'outgoing' ? 'text-info' : 'text-success'}>
                        {c.direction === 'outgoing' ? '↗ outgoing' : '↙ incoming'}
                      </span>
                      <span>•</span>
                      <span>{c.callType}</span>
                    </div>
                    <div className="text-dim" style={{ fontSize: 11 }}>
                      {new Date(c.startedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-1">
                  <button
                    className="touch-btn touch-btn-secondary p-2"
                    title={`Call ${c.peer}`}
                    onClick={() => {
                      setTargetId(c.peer);
                      placeCall(c.callType || 'audio');
                    }}
                  >
                    📞
                  </button>
                  <button
                    className="touch-btn touch-btn-secondary p-2"
                    title={`Message ${c.peer}`}
                    onClick={() => navigate(`/chats?peer=${encodeURIComponent(c.peer)}`)}
                  >
                    💬
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
