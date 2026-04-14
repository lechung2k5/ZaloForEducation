import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../services/api';

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

const API_BASE = getApiBaseUrl();

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
  const navigate = useNavigate();
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);
  const [loadingLock, setLoadingLock] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [showLockOtpForm, setShowLockOtpForm] = useState(false);
  const [lockOtp, setLockOtp] = useState('');
  const [lockNotice, setLockNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const getAxiosErrorMessage = (error: unknown, fallback: string) => {
    if (!axios.isAxiosError(error)) {
      return fallback;
    }
    return error.response?.data?.message || fallback;
  };

  const patchSettings = (patch: Partial<WebSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleLockAccount = async () => {
    setLockNotice(null);

    setLoadingLock(true);
    try {
      await axios.post(
        `${API_BASE}/auth/account/request-lock-otp`,
        {},
        { headers: getAuthHeaders() },
      );
      setShowLockOtpForm(true);
      setLockOtp('');
      setLockNotice({ type: 'success', text: 'Mã OTP xác nhận khóa tài khoản đã được gửi qua email.' });
    } catch (error) {
      console.error('Lock account error:', error);
      setLockNotice({
        type: 'error',
        text: getAxiosErrorMessage(error, 'Lỗi khóa tài khoản'),
      });
    } finally {
      setLoadingLock(false);
    }
  };

  const handleConfirmLockAccount = async () => {
    if (!lockOtp.trim()) {
      setLockNotice({ type: 'error', text: 'Vui lòng nhập mã OTP.' });
      return;
    }

    setLockNotice(null);
    setLoadingLock(true);
    try {
      const response = await axios.post(
        `${API_BASE}/auth/account/confirm-lock-otp`,
        { otp: lockOtp.trim(), reason: 'Yêu cầu từ người dùng' },
        { headers: getAuthHeaders() },
      );

      setLockNotice({ type: 'success', text: response.data.message || 'Khóa tài khoản thành công.' });
      setShowLockOtpForm(false);
      setLockOtp('');

      setTimeout(() => {
        localStorage.removeItem('token');
        navigate('/login');
      }, 1000);
    } catch (error) {
      console.error('Confirm lock account error:', error);
      setLockNotice({
        type: 'error',
        text: getAxiosErrorMessage(error, 'Xác nhận OTP thất bại'),
      });
    } finally {
      setLoadingLock(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('⚠️ CẢNH BÁO: Hành động này sẽ XÓA tài khoản của bạn!\n\nNhập "XÓA CÓ" để xác nhận:')) {
      return;
    }

    const confirmation = window.prompt('Nhập "XÓA CÓ" để xác nhận xóa tài khoản:');
    if (confirmation !== 'XÓA CÓ') {
      alert('Xóa tài khoản đã hủy.');
      return;
    }

    setLoadingDelete(true);
    try {
      const response = await axios.delete(
        `${API_BASE}/auth/account/delete`,
        { headers: getAuthHeaders() },
      );

      alert(response.data.message);
      // Redirect to login after deletion
      setTimeout(() => {
        localStorage.removeItem('token');
        navigate('/login');
      }, 1000);
    } catch (error) {
      console.error('Delete account error:', error);
      alert(getAxiosErrorMessage(error, 'Lỗi xóa tài khoản'));
    } finally {
      setLoadingDelete(false);
    }
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

        <section className="mt-10 rounded-3xl border border-orange-200 bg-orange-50 p-6">
          <h3 className="text-lg font-bold text-on-surface">Duy trì bảo mật tài khoản</h3>
          <p className="text-sm text-on-surface-variant mt-1 mb-4">Khóa/mở khóa tài khoản qua xác nhận OTP email hoặc xóa tài khoản vĩnh viễn.</p>
          
          <div className="space-y-3">
            <button
              onClick={handleLockAccount}
              disabled={loadingLock}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-orange-500 text-white px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingLock ? 'Đang xử lý...' : 'Khóa tài khoản (OTP email)'}
            </button>

            {lockNotice && (
              <div className={`max-w-md rounded-xl px-3 py-2 text-sm font-medium ${lockNotice.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {lockNotice.text}
              </div>
            )}

            {showLockOtpForm && (
              <div className="w-full max-w-md rounded-2xl border border-orange-200 bg-white p-4">
                <p className="text-sm text-on-surface-variant mb-3">Nhập mã OTP đã gửi qua email để xác nhận khóa tài khoản.</p>
                <input
                  type="text"
                  value={lockOtp}
                  onChange={(event) => setLockOtp(event.target.value)}
                  placeholder="Nhập mã OTP"
                  className="w-full rounded-xl border border-outline-variant px-3 py-2.5 text-sm text-on-surface mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmLockAccount}
                    disabled={loadingLock}
                    className="inline-flex items-center justify-center rounded-xl bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                  >
                    {loadingLock ? 'Đang xác nhận...' : 'Xác nhận OTP'}
                  </button>
                  <button
                    onClick={() => {
                      setShowLockOtpForm(false);
                      setLockOtp('');
                    }}
                    disabled={loadingLock}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-200 text-slate-800 px-4 py-2.5 text-sm font-semibold hover:bg-slate-300 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={loadingDelete}
              className="w-full sm:w-auto ml-0 sm:ml-3 inline-flex items-center justify-center rounded-2xl bg-red-500 text-white px-5 py-3 font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingDelete ? 'Đang xử lý...' : 'Xóa tài khoản'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;
