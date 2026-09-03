import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Register({ onLoggedIn }) {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(userId.trim(), password, displayName.trim() || userId.trim());
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
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
      <div className="card shadow-sm" style={{ width: '100%', maxWidth: 380 }}>
        <div className="card-body p-4">
          <h3 className="mb-3 text-center">Create account</h3>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">User ID</label>
              <input
                className="form-control"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. priya123"
                autoFocus
                required
              />
              <div className="form-text">This is what other people will use to call you.</div>
            </div>
            <div className="mb-3">
              <label className="form-label">Display name</label>
              <input
                className="form-control"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <p className="text-center mt-3 mb-0">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
