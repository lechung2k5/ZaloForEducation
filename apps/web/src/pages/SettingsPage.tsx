import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SETTINGS_KEY = 'mobile_settings';

type WebSettings = {
  showOnlineStatus: boolean;
  receiveFriendRequests: boolean;
  messageNotificationSound: boolean;
  autoDownloadMedia: boolean;
};

const DEFAULT_SETTINGS: WebSettings = {
  showOnlineStatus: true,
  receiveFriendRequests: true,
  messageNotificationSound: true,
  autoDownloadMedia: true,
};

const SettingsToggle: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}> = ({ label, description, enabled, onToggle }) => {
  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-white p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-on-surface">{label}</p>
        <p className="text-xs text-on-surface-variant mt-1">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-[42px] w-[74px] rounded-full border overflow-hidden transition-colors duration-300 focus:outline-none focus:ring-0 focus-visible:outline-none ${enabled ? 'border-[#18d95f] bg-[#16ef67]' : 'border-[#d0d0d4] bg-[#d9d9dc]'}`}
        aria-label={label}
      >
        <span className={`absolute top-[2px] h-9 w-9 rounded-full bg-[#f0f0f0] shadow-[0_2px_8px_rgba(15,23,42,0.16)] transition-all duration-300 ${enabled ? 'left-[36px]' : 'left-[2px]'}`}></span>
      </button>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);

  const displayName = useMemo(() => user?.fullName || user?.fullname || 'Bạn', [user]);
  const displayAvatar = useMemo(
    () => user?.avatarUrl || user?.urlAvatar || 'https://fptupload.s3.ap-southeast-1.amazonaws.com/Zalo_Edu_Logo_2e176b6b7f.png',
    [user],
  );

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch (error) {
      console.error('Failed to parse settings from localStorage', error);
    }
  }, []);

  const patchSettings = (patch: Partial<WebSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-outline-variant px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-container-low transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-primary">Cài đặt</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-on-surface">{displayName}</p>
            <p className="text-[11px] text-on-surface-variant font-medium">{user?.email}</p>
          </div>
          <img src={displayAvatar} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto w-full px-6 pt-24 pb-12">
        <header className="mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Quyền riêng tư & thông báo</h2>
          <p className="text-on-surface-variant mt-2 max-w-2xl">
            Đồng bộ thiết lập chính với mobile. Bạn có thể điều chỉnh trạng thái hoạt động, thông báo và một số tuỳ chọn hành vi ứng dụng.
          </p>
        </header>

        <section className="space-y-4">
          <SettingsToggle
            label="Hiển thị trạng thái hoạt động"
            description="Cho phép người khác thấy bạn đang online (chấm xanh trên ảnh đại diện)."
            enabled={settings.showOnlineStatus}
            onToggle={() => patchSettings({ showOnlineStatus: !settings.showOnlineStatus })}
          />
          <SettingsToggle
            label="Nhận lời mời kết bạn"
            description="Cho phép tài khoản khác gửi lời mời kết bạn."
            enabled={settings.receiveFriendRequests}
            onToggle={() => patchSettings({ receiveFriendRequests: !settings.receiveFriendRequests })}
          />
          <SettingsToggle
            label="Âm thanh thông báo tin nhắn"
            description="Phát âm thanh khi có tin nhắn mới."
            enabled={settings.messageNotificationSound}
            onToggle={() => patchSettings({ messageNotificationSound: !settings.messageNotificationSound })}
          />
          <SettingsToggle
            label="Tự động tải media"
            description="Tự tải ảnh và tệp phương tiện trong cuộc trò chuyện."
            enabled={settings.autoDownloadMedia}
            onToggle={() => patchSettings({ autoDownloadMedia: !settings.autoDownloadMedia })}
          />
        </section>

        <section className="mt-10 rounded-3xl border border-outline-variant/20 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-on-surface">Quản lý thiết bị đăng nhập</h3>
            <p className="text-sm text-on-surface-variant mt-1">Xem và đăng xuất các phiên đang hoạt động trên thiết bị khác.</p>
          </div>
          <Link
            to="/sessions"
            className="inline-flex items-center justify-center rounded-2xl bg-primary text-white px-5 py-3 font-semibold hover:opacity-90 transition-opacity"
          >
            Mở quản lý phiên
          </Link>
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
