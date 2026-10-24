import React, { useState, useEffect } from 'react';
import {
  Bell, CheckCheck, Check, Clock, Calendar, Car,
  Users, IndianRupee, AlertCircle, Loader2
} from 'lucide-react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Badge from '../../components/common/Badge.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { Skeleton } from '../../components/common/Skeleton.jsx';
import { useNotifications } from '../../context/NotificationContext.jsx';

const TYPE_ICONS = {
  BOOKING_CREATED: Users,
  BOOKING_CANCELLED: AlertCircle,
  RIDE_CANCELLED: Car,
  TRIP_STARTED: Car,
  TRIP_COMPLETED: CheckCheck,
  PAYMENT_PENDING: IndianRupee,
  PAYMENT_COMPLETED: IndianRupee,
  GENERAL: Bell
};

const TYPE_COLORS = {
  BOOKING_CREATED: 'bg-teal-100 text-teal-700',
  BOOKING_CANCELLED: 'bg-rose-100 text-rose-700',
  RIDE_CANCELLED: 'bg-rose-100 text-rose-700',
  TRIP_STARTED: 'bg-amber-100 text-amber-700',
  TRIP_COMPLETED: 'bg-emerald-100 text-emerald-700',
  PAYMENT_PENDING: 'bg-amber-100 text-amber-700',
  PAYMENT_COMPLETED: 'bg-emerald-100 text-emerald-700',
  GENERAL: 'bg-slate-100 text-slate-700'
};

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function NotificationsPage() {
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications({ page, limit: 30 }).then((data) => {
      if (data) setTotal(data.total || 0);
    });
  }, [page, fetchNotifications]);

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await markAllAsRead();
    setMarkingAll(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            loading={markingAll}
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
          </Button>
        )}
      </div>

      {loading && notifications.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-2/3" />
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Notifications about bookings, trip updates, and payments will appear here."
        />
      )}

      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || Bell;
            const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.GENERAL;

            return (
              <div
                key={notif._id}
                onClick={() => !notif.isRead && markAsRead(notif._id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border transition cursor-pointer ${
                  notif.isRead
                    ? 'bg-white border-slate-200 hover:bg-slate-50'
                    : 'bg-teal-50/50 border-teal-200 hover:bg-teal-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${notif.isRead ? 'text-slate-700' : 'text-slate-900 font-semibold'}`}>
                      {notif.title}
                    </p>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-teal-500 shrink-0 mt-2" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTimeAgo(notif.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="text-xs text-slate-500 self-center">Page {page}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={notifications.length < 30}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
