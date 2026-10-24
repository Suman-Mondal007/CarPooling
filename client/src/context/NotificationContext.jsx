import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import notificationsApi from '../api/notifications.api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

const POLL_INTERVAL_MS = 30000; // 30 seconds

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationsApi.getNotifications({ limit: 1, unreadOnly: 'true' });
      setUnreadCount(data?.unreadCount ?? 0);
    } catch {
      // Silently fail - polling is best-effort
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

  // Start polling when user is authenticated
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    } else {
      setUnreadCount(0);
      setNotifications([]);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, fetchUnreadCount]);

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
