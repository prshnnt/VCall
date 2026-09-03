import { Link, useNavigate } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useSignaling } from '../ws/SignalingContext';

export default function AppNavbar({ user, onLogout }) {
  const { connected } = useSignaling();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    onLogout();
    navigate('/login');
  }

  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
      <Link className="navbar-brand" to="/">
        📞 CallChat
      </Link>
      <div className="navbar-nav me-auto">
        <Link className="nav-link" to="/">
          Dialer
        </Link>
        <Link className="nav-link" to="/chats">
          Chats
        </Link>
      </div>
      <span
        className={`badge rounded-pill me-3 ${connected ? 'bg-success' : 'bg-secondary'}`}
        title={connected ? 'Connected' : 'Reconnecting…'}
      >
        {connected ? 'online' : 'connecting…'}
      </span>
      {user && (
        <>
          <span className="text-light me-3">
            {user.display_name} <small className="text-muted">({user.user_id})</small>
          </span>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </>
      )}
    </nav>
  );
}
