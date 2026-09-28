import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useSignaling } from '../ws/SignalingContext';

export default function AppNavbar({ user, onLogout }) {
  const { connected } = useSignaling();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    clearSession();
    onLogout();
    navigate('/login');
  }

  const isDialerActive = location.pathname === '/';
  const isChatsActive = location.pathname.startsWith('/chats');

  return (
    <>
      {/* Top Glass Navbar */}
      <header className="glass-header sticky-top px-3 py-2">
        <div className="container-fluid d-flex align-items-center justify-content-between p-0" style={{ maxWidth: 1140 }}>
          <div className="d-flex align-items-center gap-3">
            <Link className="app-brand" to="/">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>CallChat</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="d-none d-md-flex align-items-center gap-1 ms-3">
              <Link className={`btn btn-sm ${isDialerActive ? 'btn-primary text-white fw-bold' : 'btn-link text-light text-decoration-none'}`} to="/">
                📞 Dialer
              </Link>
              <Link className={`btn btn-sm ${isChatsActive ? 'btn-primary text-white fw-bold' : 'btn-link text-light text-decoration-none'}`} to="/chats">
                💬 Chats
              </Link>
            </nav>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Status Dot Pill */}
            <div className="status-badge" title={connected ? 'Connected to signaling server' : 'Reconnecting to signaling server…'}>
              <span className={`status-dot ${connected ? 'online' : 'connecting'}`}></span>
              <span className="d-none d-sm-inline" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {connected ? 'Online' : 'Connecting'}
              </span>
            </div>

            {user && (
              <div className="d-flex align-items-center gap-2 ms-2">
                <div className="d-flex align-items-center gap-2 px-2 py-1 rounded-pill" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)' }}>
                  <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: 12 }}>
                    {user.display_name ? user.display_name.charAt(0).toUpperCase() : user.user_id.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-truncate d-none d-sm-inline" style={{ maxWidth: 120, fontSize: 13, fontWeight: 600 }}>
                    {user.display_name || user.user_id}
                  </span>
                </div>
                <button className="touch-btn touch-btn-secondary px-3 py-1" style={{ fontSize: 13 }} onClick={handleLogout} title="Logout">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-bottom-nav">
        <Link to="/" className={`bottom-tab-item ${isDialerActive ? 'active' : ''}`}>
          <span className="bottom-tab-icon">📞</span>
          <span>Dialer</span>
        </Link>
        <Link to="/chats" className={`bottom-tab-item ${isChatsActive ? 'active' : ''}`}>
          <span className="bottom-tab-icon">💬</span>
          <span>Chats</span>
        </Link>
      </nav>
    </>
  );
}
