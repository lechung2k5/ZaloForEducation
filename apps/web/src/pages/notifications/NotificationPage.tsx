import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  clearSecurityAlerts,
  getSecurityAlerts,
  markAllSecurityAlertsRead,
  type SecurityAlertItem,
} from '../../utils/securityAlerts';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('vi-VN');
};

const alertIcon = (type: SecurityAlertItem['type']) => {
  if (type === 'NEW_DEVICE_LOGIN') return 'devices';
  return 'key';
};

export const NotificationPage: React.FC = () => {
  const { t } = useTheme();
  const [alerts, setAlerts] = useState<SecurityAlertItem[]>([]);

  const alertBadge = (type: SecurityAlertItem['type']) => {
    if (type === 'NEW_DEVICE_LOGIN') return t('notif_page.login_device');
    return t('notif_page.pw_changed');
  };

  const unreadCount = useMemo(() => alerts.filter((item) => !item.read).length, [alerts]);

  useEffect(() => {
    const sync = () => setAlerts(getSecurityAlerts());
    sync();
    window.addEventListener('security-alerts-updated', sync);
    return () => window.removeEventListener('security-alerts-updated', sync);
  }, []);

  return (
    <div className="flex-1 h-full overflow-y-auto bg-surface-container-lowest p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{t('notif_page.title')}</h2>
            <p className="text-sm text-on-surface-variant">
              {unreadCount > 0 ? t('notif_page.unread', { count: unreadCount }) : t('notif_page.empty_unread')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                markAllSecurityAlertsRead();
                setAlerts(getSecurityAlerts());
              }}
              className="rounded-lg border border-outline px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container"
            >
              {t('notif_page.mark_read')}
            </button>
            <button
              type="button"
              onClick={() => {
                clearSecurityAlerts();
                setAlerts([]);
              }}
              className="rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error hover:bg-error/10"
            >
              {t('notif_page.clear_all')}
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-outline/40 bg-surface p-8 text-center">
            <span className="material-symbols-outlined text-[56px] text-primary/25">shield</span>
            <p className="mt-3 text-sm text-on-surface-variant">{t('notif_page.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 ${item.read ? 'border-outline/30 bg-surface' : 'border-warning/40 bg-warning/10'}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-warning">{alertIcon(item.type)}</span>
                    <h3 className="font-semibold text-on-surface">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
                    {alertBadge(item.type)}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">{item.message}</p>
                <p className="mt-2 text-xs text-on-surface-variant opacity-80">{formatTime(item.at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CloudPage: React.FC = () => {
  const { t } = useTheme();
  return (
    <div className="flex-1 h-full flex items-center justify-center bg-surface-container-lowest">
      <div className="text-center">
        <span className="material-symbols-outlined text-[64px] text-primary/20 mb-4">cloud</span>
        <h2 className="text-xl font-bold text-on-surface opacity-30">My Cloud</h2>
        <p className="text-sm text-on-surface-variant opacity-40">{t('notif_page.cloud_pending')}</p>
      </div>
    </div>
  );
};
