import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api/client';

export default function Login({ onLoggedIn }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      // Mocking Google OAuth flow
      // In production, you'd use @react-oauth/google or similar
      const mockGoogleId = "google_user_" + Math.floor(Math.random() * 1000000);
      const mockDisplayName = "Google User";
      
      const data = await api.authGoogle(mockGoogleId, mockDisplayName);
      saveSession(data.token, { user_id: data.user_id, display_name: data.display_name });
      onLoggedIn({ user_id: data.user_id, display_name: data.display_name });
      
      if (data.needs_id_claim) {
        navigate('/register'); // Redirect to claim Call ID
      } else {
        navigate('/');
      }
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

        <div className="d-grid gap-3">
          <button 
            onClick={handleGoogleLogin}
            className="touch-btn touch-btn-primary w-100 py-3 mb-3" 
            style={{ fontSize: 16 }} 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>

        <p className="text-center text-muted small mt-3 mb-0">
          New here?{' '}
          <Link to="/register" className="text-primary fw-semibold text-decoration-none ms-1">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
