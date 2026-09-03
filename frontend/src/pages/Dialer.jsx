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
      await api.lookupUser(id); // gives a friendly "not found" before we even try signaling
      startCall(id, callType);
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 560 }}>
      <h4 className="mb-3">Place a call</h4>

      {error && (
        <div className="alert alert-warning alert-dismissible">
          {error}
          <button type="button" className="btn-close" onClick={clearError}></button>
        </div>
      )}
      {lookupError && <div className="alert alert-danger">{lookupError}</div>}

      <div className="input-group input-group-lg mb-3">
        <span className="input-group-text">@</span>
        <input
          className="form-control"
          placeholder="Enter user ID to call"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && placeCall('audio')}
        />
      </div>

      <div className="d-flex gap-2 mb-4">
        <button className="btn btn-success flex-fill" disabled={checking || !targetId.trim()} onClick={() => placeCall('audio')}>
          🎙️ Voice call
        </button>
        <button className="btn btn-primary flex-fill" disabled={checking || !targetId.trim()} onClick={() => placeCall('video')}>
          🎥 Video call
        </button>
      </div>

      <h6 className="text-muted">Recent calls</h6>
      {recentCalls.length === 0 && <p className="text-muted small">No calls yet.</p>}
      <ul className="list-group">
        {recentCalls.map((c) => (
          <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>{c.peer}</strong>{' '}
              <span className="text-muted small">
                {c.direction === 'outgoing' ? '↗ outgoing' : '↙ incoming'} · {c.callType} · {c.status}
              </span>
              <div className="text-muted small">{new Date(c.startedAt).toLocaleString()}</div>
            </div>
            <div className="d-flex gap-1">
              <button className="btn btn-sm btn-outline-success" onClick={() => setTargetId(c.peer)}>
                Call again
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
