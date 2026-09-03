import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getStoredUser, getToken } from './api/client';
import { SignalingProvider } from './ws/SignalingContext';
import { CallProvider } from './call/CallContext';
import AppNavbar from './components/Navbar';
import IncomingCallModal from './components/IncomingCallModal';
import Login from './pages/Login';
import Register from './pages/Register';
import Dialer from './pages/Dialer';
import CallScreen from './pages/CallScreen';
import Chat from './pages/Chat';

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const loggedIn = Boolean(user && getToken());

  return (
    <SignalingProvider loggedIn={loggedIn}>
      <CallProvider>
        {loggedIn && <AppNavbar user={user} onLogout={() => setUser(null)} />}
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
