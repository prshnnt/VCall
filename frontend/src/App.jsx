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
import CallLogs from './pages/CallLogs';
import Contacts from './pages/Contacts';
import Profile from './pages/Profile';

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
  const [activeTab, setActiveTab] = useState('dialpad');
  const [hasNotification, setHasNotification] = useState(true);
  const loggedIn = Boolean(user && getToken());

  useNotificationClicks();

  useEffect(() => {
    if (loggedIn && pushSupported() && Notification.permission === 'default') {
      enablePushNotifications().catch(() => {});
    }
  }, [loggedIn]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dialpad': return <Dialer />;
      case 'chats': return <Chat />;
      case 'logs': return <CallLogs />;
      case 'contacts': return <Contacts />;
      case 'profile': return <Profile />;
      default: return <Dialer />;
    }
  };

  return (
    <SignalingProvider loggedIn={loggedIn}>
      <CallProvider>
        <div className="min-h-screen bg-[#0a0a0c] flex justify-center">
          <div className="w-full max-w-md relative min-h-screen bg-[#0a0a0c] shadow-2xl">
            {loggedIn && <InstallPrompt />}
            {loggedIn && <IncomingCallModal />}
            
            <main className="pb-24">
              <Routes>
                <Route path="/login" element={loggedIn ? <Navigate to="/" replace /> : <Login onLoggedIn={setUser} />} />
                <Route path="/register" element={loggedIn ? <Navigate to="/" replace /> : <Register onLoggedIn={setUser} />} />
                <Route 
                  path="/" 
                  element={
                    <RequireAuth user={loggedIn}>
                      {renderTabContent()}
                    </RequireAuth>
                  } 
                />
                <Route path="/call" element={<RequireAuth user={loggedIn}><CallScreen /></RequireAuth>} />
                <Route path="/chats" element={<RequireAuth user={loggedIn}><Chat /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            {loggedIn && (
              <BottomNav 
                activeTab={activeTab} 
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  if (tab === 'chats') setHasNotification(false);
                }} 
                hasNotification={hasNotification}
              />
            )}
          </div>
        </div>
      </CallProvider>
    </SignalingProvider>
  );
}
