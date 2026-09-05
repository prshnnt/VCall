import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getStoredUser, getToken } from './api/client';
import { SignalingProvider } from './ws/SignalingContext';
import { CallProvider } from './call/CallContext';
import { enablePushNotifications, pushSupported } from './push/registerPush';
import AppNavbar from './components/Navbar';
import IncomingCallModal from './components/IncomingCallModal';
import InstallPrompt from './components/InstallPrompt';
import Login from './pages/Login';
import Register from './pages/Register';
import Dialer from './pages/Dialer';
import CallScreen from './pages/CallScreen';
import Chat from './pages/Chat';

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Handles taps on a push notification while the app was already open in
// the background: the service worker posts a message here so we can
// route to the right place (the incoming-call modal itself is driven by
// the live WebSocket event, not by this - this just makes sure we're
// looking at the right screen).
function useNotificationClicks() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!pushSupported()) return;
    function handleMessage(event) {
      const data = event.data?.data;
      if (event.data?.type === 'notification-click' && data?.kind === 'message' && data.peer) {
        navigate(`/chats?peer=${encodeURIComponent(data.peer)}`);
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const loggedIn = Boolean(user && getToken());

  useNotificationClicks();

  // Ask for notification permission once, right after login, so incoming
  // calls/messages can reach the user even when the tab/app isn't focused.
  // If they dismiss the browser's permission prompt, nothing breaks - the
  // app still works fully via the live WebSocket while it's open.
  useEffect(() => {
    if (loggedIn && pushSupported() && Notification.permission === 'default') {
      enablePushNotifications().catch(() => {});
    }
  }, [loggedIn]);

  return (
    <SignalingProvider loggedIn={loggedIn}>
      <CallProvider>
        {loggedIn && <AppNavbar user={user} onLogout={() => setUser(null)} />}
        {loggedIn && <InstallPrompt />}
        {loggedIn && <IncomingCallModal />}
        <Routes>
          <Route path="/login" element={loggedIn ? <Navigate to="/" replace /> : <Login onLoggedIn={setUser} />} />
          <Route path="/register" element={loggedIn ? <Navigate to="/" replace /> : <Register onLoggedIn={setUser} />} />
          <Route
            path="/"
            element={
              <RequireAuth user={loggedIn}>
                <Dialer />
              </RequireAuth>
            }
          />
          <Route
            path="/call"
            element={
              <RequireAuth user={loggedIn}>
                <CallScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/chats"
            element={
              <RequireAuth user={loggedIn}>
                <Chat />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CallProvider>
    </SignalingProvider>
  );
}
