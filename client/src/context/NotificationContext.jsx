import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import notificationsApi from '../api/notifications.api.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const { socket, status } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevStatusRef = useRef(status);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationsApi.getNotifications({ limit: 1, unreadOnly: 'true' });
      setUnreadCount(data?.unreadCount ?? 0);
    } catch {
      // Silently fail
    }
  }, [user]);

  const fetchNotifications = useCallback(async (params = {}) => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await notificationsApi.getNotifications(params);
      setNotifications(data?.items || []);
      setUnreadCount(data?.unreadCount ?? 0);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount or when user changes
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchNotifications();
    } else {
      setUnreadCount(0);
      setNotifications([]);
    }
  }, [user, fetchUnreadCount, fetchNotifications]);

  // Re-fetch on socket reconnect
  useEffect(() => {
    if (user && status === 'connected' && prevStatusRef.current === 'reconnecting') {
      fetchUnreadCount();
      fetchNotifications();
    }
    prevStatusRef.current = status;
  }, [status, user, fetchUnreadCount, fetchNotifications]);

  // Real-time socket notification listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      setUnreadCount((prev) => prev + 1);
      setNotifications((prev) => [notification, ...prev]);

      // Trigger user-friendly toast
      toast(notification.title || 'New Notification', {
        icon: '🔔',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff'
        }
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
