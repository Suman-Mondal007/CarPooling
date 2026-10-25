import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, accessToken, refreshAccessToken, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('offline'); // 'connected' | 'reconnecting' | 'offline'
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    // Only connect if user is authenticated with an access token
    if (!user || !accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setStatus('offline');
      return;
    }

    // Connect to server (using relative path via dev proxy or current origin)
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const newSocket = io(socketUrl, {
      auth: {
        token: accessToken
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setStatus('connected');
    });

    newSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        setStatus('reconnecting');
        newSocket.connect();
      } else {
        setStatus('reconnecting');
      }
    });

    newSocket.on('connect_error', async (err) => {
      const errCode = err?.data?.code || err?.message;

      if (errCode === 'TOKEN_EXPIRED') {
        setStatus('reconnecting');
        if (!isRefreshingRef.current) {
          isRefreshingRef.current = true;
          try {
            const newToken = await refreshAccessToken();
            if (newToken) {
              newSocket.auth = { token: newToken };
              newSocket.connect();
            } else {
              setStatus('offline');
              logout();
            }
          } catch {
            setStatus('offline');
            logout();
          } finally {
            isRefreshingRef.current = false;
          }
        }
      } else if (errCode === 'UNAUTHORIZED' || errCode === 'INVALID_TOKEN' || errCode === 'ACCOUNT_NOT_ACTIVE') {
        setStatus('offline');
      } else {
        setStatus('reconnecting');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, accessToken]);



  return (
    <SocketContext.Provider value={{ socket, status, isConnected: status === 'connected' }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;
