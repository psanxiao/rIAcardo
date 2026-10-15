import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import api from '../services/api';

const POLL_MS = 60000;

const formatWhen = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotificationsBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const pollUnread = async () => {
      try {
        const res = await api.get('/api/notifications/unread-count');
        if (mounted.current) setUnread(res.data.unread || 0);
      } catch {
        // Silent: the badge simply stays as it was.
      }
    };
    pollUnread();
    const timer = setInterval(pollUnread, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      if (!mounted.current) return;
      setNotifications(res.data);
      setUnread(res.data.filter((n) => !n.is_read).length);
    } catch {
      if (mounted.current) setNotifications([]);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  };

  const handleClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await api.post(`/api/notifications/${notification.id}/read`);
      } catch {
        // Ignore: navigating is still useful.
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnread((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all');
    } catch {
      // Ignore and optimistically clear anyway.
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notificaciones</h3>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-500">
                  <Inbox className="h-6 w-6" />
                  <p className="text-xs">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleClick(notification)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      notification.is_read ? '' : 'bg-indigo-50/50 dark:bg-indigo-900/10'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {notification.title}
                        </p>
                        {notification.message && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {notification.message}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatWhen(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationsBell;
