import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Login({ onLoggedIn }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(userId.trim(), password);
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
        {/* Brand Icon Header */}
        <div className="text-center mb-4">
          <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <h2 className="fw-bold mb-1" style={{ fontSize: '1.75rem' }}>Welcome Back</h2>
          <p className="text-muted small">Sign in to start calling and messaging</p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 px-3 rounded-3 small mb-4 d-flex align-items-center gap-2">
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small fw-semibold text-muted">User ID</label>
            <div className="position-relative">
              <input
                className="form-control modern-input ps-4"
                placeholder="Enter your user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label small fw-semibold text-muted">Password</label>
            <input
              type="password"
              className="form-control modern-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="touch-btn touch-btn-primary w-100 py-3 mb-3" style={{ fontSize: 16 }} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-center text-muted small mt-3 mb-0">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary fw-semibold text-decoration-none ms-1">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
}
