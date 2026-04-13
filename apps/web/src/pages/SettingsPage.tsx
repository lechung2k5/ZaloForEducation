import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SETTINGS_KEY = 'mobile_settings';

type WebSettings = {
  notifications: boolean;
  messageSound: boolean;
  showOnlineStatus: boolean;
  allowSearchByPhone: boolean;
  syncContacts: boolean;
  autoDownloadMedia: boolean;
  themeMode: 'system' | 'light' | 'dark';
  language: 'vi' | 'en';
};

const DEFAULT_SETTINGS: WebSettings = {
  notifications: true,
  messageSound: true,
  showOnlineStatus: true,
  allowSearchByPhone: true,
  syncContacts: true,
  autoDownloadMedia: true,
  themeMode: 'system',
  language: 'vi',
};

const SettingsToggle: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: string;
}> = ({ label, description, enabled, onToggle, icon }) => {
  return (
    <div className="group rounded-3xl border border-outline-variant/15 bg-white p-5 flex items-center justify-between gap-6 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-primary/20">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center transition-colors group-hover:bg-primary/10">
          <span className="material-symbols-outlined text-primary text-[24px]">{icon}</span>
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-on-surface leading-tight">{label}</p>
          <p className="text-[13px] text-on-surface-variant mt-1.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative h-9 w-16 shrink-0 rounded-full border overflow-hidden transition-all duration-300 focus:outline-none ${enabled ? 'border-primary bg-primary' : 'border-[#d0d0d4] bg-[#d9d9dc]'}`}
      >
        <span className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow-lg transition-all duration-300 ${enabled ? 'left-[34px]' : 'left-[2px]'}`}></span>
      </button>
    </div>
  );
};

const Section: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="mt-12 first:mt-0">
    <div className="mb-6 px-1">
      <h3 className="text-xl font-extrabold tracking-tight text-on-surface">{title}</h3>
      <p className="text-[13px] text-on-surface-variant mt-1.5 font-medium">{subtitle}</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {children}
    </div>
  </section>
);

const ChipSelector: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
      active 
        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' 
        : 'bg-surface-container-highest/50 text-on-surface-variant hover:bg-surface-container-highest'
    }`}
  >
    {label}
  </button>
);

const SettingsPage: React.FC = () => {
  const { user, requestChangePassword, confirmChangePassword } = useAuth();
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const displayName = useMemo(() => user?.fullName || user?.fullname || 'Bạn', [user]);
  const displayAvatar = useMemo(
    () => user?.avatarUrl || user?.urlAvatar || '/logo_blue.png',
    [user],
  );

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch (error) {
      console.error('Failed to parse settings', error);
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
    <div className="min-h-screen bg-surface-container-lowest text-on-surface selection:bg-primary/10">
      <nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-2xl border-b border-outline-variant/10 px-8 py-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <Link to="/" className="w-11 h-11 flex items-center justify-center rounded-2xl bg-surface-container-highest/50 hover:bg-surface-container-highest transition-all hover:scale-105 active:scale-95 text-on-surface">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-primary leading-none">Cài đặt</h1>
            <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mt-1.5">Zalo Education Experience</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/80 p-1.5 pr-4 rounded-2xl border border-outline-variant/10 shadow-sm">
          <img src={displayAvatar} alt={displayName} className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/5 shadow-inner" />
          <div className="text-left">
            <p className="text-[13px] font-extrabold text-on-surface leading-tight">{displayName}</p>
            <p className="text-[10px] text-on-surface-variant font-bold truncate max-w-[150px]">{user?.email}</p>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto w-full px-8 pt-32 pb-24">
        <header className="mb-14 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[32px] bg-primary/5 text-primary mb-6 shadow-xl shadow-primary/5">
            <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'wght' 300" }}>settings</span>
          </div>
          <h2 className="text-4xl font-black tracking-tight text-on-surface mb-4">Tuỳ chỉnh ứng dụng</h2>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            Mọi thay đổi sẽ được lưu cục bộ trên trình duyệt này và đồng bộ hoá khi bạn đăng nhập trên các thiết bị Zalo Education khác.
          </p>
        </header>

        <div className="space-y-12">
          <Section title="Tài khoản & Bảo mật" subtitle="Quản lý các thiết bị và phương thức bảo vệ tài khoản">
            <div className="md:col-span-2 group rounded-[32px] border border-outline-variant/20 bg-gradient-to-br from-primary to-primary-container p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-2xl shadow-primary/10 transition-all hover:scale-[1.01]">
              <div className="text-white">
                <h3 className="text-xl font-black mb-1.5 flex items-center gap-2">
                  <span className="material-symbols-outlined">devices</span>
                  Thiết bị đăng nhập
                </h3>
                <p className="text-white/80 text-sm font-medium">Hiện tại bạn đang đăng nhập trên {user?.activeSessions || 1} thiết bị.</p>
              </div>
              <Link
                to="/sessions"
                className="inline-flex items-center justify-center rounded-2xl bg-white text-primary px-8 py-4 font-black text-sm hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all"
              >
                Quản lý phiên ngay
              </Link>
            </div>
            <SettingsToggle
              icon="lock"
              label="Đổi mật khẩu"
              description="Cập nhật mật khẩu thường xuyên để đảm bảo an toàn tối đa."
              enabled={false}
              onToggle={() => setIsChangePasswordOpen(true)}
            />
          </Section>

          <Section title="Quyền riêng tư" subtitle="Kiểm soát những gì người khác thấy về bạn">
            <SettingsToggle
              icon="visibility"
              label="Trạng thái hoạt động"
              description="Cho phép bạn bè thấy khi nào bạn đang online."
              enabled={settings.showOnlineStatus}
              onToggle={() => patchSettings({ showOnlineStatus: !settings.showOnlineStatus })}
            />
            <SettingsToggle
              icon="contact_phone"
              label="Tìm kiếm qua số điện thoại"
              description="Cho phép người lạ tìm thấy bạn thông qua số điện thoại."
              enabled={settings.allowSearchByPhone}
              onToggle={() => patchSettings({ allowSearchByPhone: !settings.allowSearchByPhone })}
            />
            <SettingsToggle
              icon="sync"
              label="Đồng bộ danh bạ"
              description="Tự động đồng bộ các liên hệ mới từ danh bạ của bạn."
              enabled={settings.syncContacts}
              onToggle={() => patchSettings({ syncContacts: !settings.syncContacts })}
            />
          </Section>

          <Section title="Thông báo" subtitle="Cài đặt âm thanh và cách nhận tin nhắn">
            <SettingsToggle
              icon="notifications"
              label="Thông báo đẩy"
              description="Nhận thông báo ngay lập tức trên màn hình desktop."
              enabled={settings.notifications}
              onToggle={() => patchSettings({ notifications: !settings.notifications })}
            />
            <SettingsToggle
              icon="volume_up"
              label="Âm thanh thông báo"
              description="Phát âm báo khi có tin nhắn mới hoặc cuộc gọi."
              enabled={settings.messageSound}
              onToggle={() => patchSettings({ messageSound: !settings.messageSound })}
            />
          </Section>

          <Section title="Dữ liệu & Media" subtitle="Quản lý cách ứng dụng xử lý file và bộ nhớ">
            <SettingsToggle
              icon="cloud_download"
              label="Tự động tải media"
              description="Tự động lưu ảnh và video về bộ nhớ tạm của trình duyệt."
              enabled={settings.autoDownloadMedia}
              onToggle={() => patchSettings({ autoDownloadMedia: !settings.autoDownloadMedia })}
            />
          </Section>

          <Section title="Giao diện & Ngôn ngữ" subtitle="Tùy chỉnh phong cách hiển thị ứng dụng">
            <div className="rounded-3xl border border-outline-variant/15 bg-white p-6 md:col-span-2">
              <div className="flex flex-col md:flex-row gap-12">
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-on-surface mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">palette</span>
                    Chủ đề giao diện
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <ChipSelector label="Hệ thống" active={settings.themeMode === 'system'} onClick={() => patchSettings({ themeMode: 'system' })} />
                    <ChipSelector label="Sáng" active={settings.themeMode === 'light'} onClick={() => patchSettings({ themeMode: 'light' })} />
                    <ChipSelector label="Tối" active={settings.themeMode === 'dark'} onClick={() => patchSettings({ themeMode: 'dark' })} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-on-surface mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">language</span>
                    Ngôn ngữ ứng dụng
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <ChipSelector label="Tiếng Việt" active={settings.language === 'vi'} onClick={() => patchSettings({ language: 'vi' })} />
                    <ChipSelector label="English" active={settings.language === 'en'} onClick={() => patchSettings({ language: 'en' })} />
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

        <footer className="mt-20 pt-10 border-t border-outline-variant/10 text-center">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Zalo Education v1.0.0 Alpha</p>
          <p className="text-[11px] text-outline mt-2 tracking-wide font-medium max-w-md mx-auto leading-relaxed">
            Hệ thống giáo dục nội bộ. Các thiết lập giao diện chỉ có hiệu lực trên trình duyệt này.
          </p>
        </footer>
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={isChangePasswordOpen} 
        onClose={() => setIsChangePasswordOpen(false)} 
        requestChangePassword={requestChangePassword}
        confirmChangePassword={confirmChangePassword}
        email={user?.email || ''}
      />
    </div>
  );
};

const ChangePasswordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  requestChangePassword: (data: any) => Promise<void>;
  confirmChangePassword: (otp: string) => Promise<void>;
  email: string;
}> = ({ isOpen, onClose, requestChangePassword, confirmChangePassword, email }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  if (!isOpen) return null;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestChangePassword({ currentPassword, newPassword });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      await confirmChangePassword(otp);
      // Success will automatically trigger logout from confirmChangePassword in AuthContext
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
      <div 
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[500px] bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-surface-container-highest/30 flex items-center justify-center hover:bg-surface-container-highest transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
          </button>
        </div>

        <div className="p-8 sm:p-12">
          <div className="mb-10 text-center">
            <div className="inline-flex w-16 h-16 rounded-[24px] bg-primary/5 text-primary items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[32px]">{step === 1 ? 'lock_reset' : 'mark_email_unread'}</span>
            </div>
            <h3 className="text-2xl font-black text-on-surface">
              {step === 1 ? 'Đổi mật khẩu' : 'Xác thực OTP'}
            </h3>
            <p className="text-sm text-on-surface-variant font-medium mt-2 leading-relaxed">
              {step === 1 
                ? 'Vui lòng xác thực mật khẩu hiện tại để tiếp tục.' 
                : `Mã xác thực đã được gửi tới email: ${email}`}
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 rounded-2xl bg-error/5 border border-error/10 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-error text-[20px]">error</span>
              <p className="text-[13px] font-bold text-error leading-tight">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequest} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-extrabold text-on-surface ml-1">Mật khẩu hiện tại</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full h-14 bg-surface-container-highest/20 border-2 border-outline-variant/10 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-primary focus:bg-white outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-extrabold text-on-surface ml-1">Mật khẩu mới</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">password</span>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-14 bg-surface-container-highest/20 border-2 border-outline-variant/10 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-primary focus:bg-white outline-none transition-all"
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-extrabold text-on-surface ml-1">Xác nhận mật khẩu mới</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">verified</span>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-14 bg-surface-container-highest/20 border-2 border-outline-variant/10 rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-primary focus:bg-white outline-none transition-all"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:scale-100"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Gửi mã xác thực'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-8">
              <div className="flex justify-center">
                <input 
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full max-w-[280px] h-20 bg-surface-container-highest/30 border-2 border-outline-variant/10 rounded-[28px] text-center text-4xl font-black tracking-[12px] text-primary focus:border-primary focus:bg-white outline-none transition-all placeholder:text-outline/30"
                  placeholder="000000"
                />
              </div>

              <div className="space-y-4">
                <button 
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Xác nhận đổi mật khẩu'}
                </button>
                <button 
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full h-12 bg-transparent text-primary rounded-2xl font-extrabold text-[13px] hover:bg-primary/5 transition-all"
                >
                  Quay lại bước trước
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
