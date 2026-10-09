import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Register({ onLoggedIn }) {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.claimUserId(userId.trim());
      saveSession(data.token, { user_id: data.user_id, display_name: data.display_name });
      onLoggedIn({ user_id: data.user_id, display_name: data.display_name });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="d-flex justify-content-center align-items-center px-3 py-4" style={{ minHeight: '100dvh' }}>
      <div className="glass-panel p-4 p-sm-5" style={{ width: '100%', maxWidth: 420 }}>
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </div>
          <h2 className="fw-bold mb-1" style={{ fontSize: '1.75rem' }}>Claim Your ID</h2>
          <p className="text-muted small">Choose a unique ID that friends can use to call you</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 px-3 rounded-3 small mb-4 d-flex align-items-center gap-2">
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label small fw-semibold text-muted">Call ID / Number</label>
            <input
              className="form-control modern-input"
              placeholder="e.g. alex99 or 12345"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              required
            />
            <div className="form-text text-muted small mt-1" style={{ fontSize: 11 }}>
              This ID is permanent and public. Choose wisely.
            </div>
          </div>

          <button className="touch-btn touch-btn-primary w-100 py-3 mb-3" style={{ fontSize: 16 }} disabled={loading}>
            {loading ? 'Claiming ID...' : 'Confirm & Enter App'}
          </button>
        </form>

        <p className="text-center text-muted small mt-3 mb-0">
          Already have an account?{' '}
          <Link to="/login" className="text-primary fw-semibold text-decoration-none ms-1">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
