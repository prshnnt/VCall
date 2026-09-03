import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getToken } from '../api/client';

const SignalingContext = createContext(null);

export function SignalingProvider({ loggedIn, children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectTimerRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [iceServers, setIceServers] = useState([]);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const send = useCallback((type, to, payload = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open, dropping message', type);
      return false;
    }
    ws.send(JSON.stringify({ type, to, payload }));
    return true;
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    let cancelled = false;

    function connect() {
      const token = getToken();
      if (!token) return;
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'connected') {
          setIceServers(data.ice_servers || []);
        }
        listenersRef.current.forEach((fn) => fn(data));
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        // Simple fixed-delay reconnect. Good enough for a minimal app;
        // add exponential backoff if you expect flaky connections a lot.
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [loggedIn]);

  return (
    <SignalingContext.Provider value={{ connected, iceServers, send, subscribe }}>
      {children}
    </SignalingContext.Provider>
  );
}

export function useSignaling() {
  const ctx = useContext(SignalingContext);
  if (!ctx) throw new Error('useSignaling must be used within SignalingProvider');
  return ctx;
}
