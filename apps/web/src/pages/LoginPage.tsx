import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';

const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'password' | 'qr'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [qrExpired, setQrExpired] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrTimer, setQrTimer] = useState(120);

  const { login } = useAuth();
  const navigate = useNavigate();
  const qrSocketRef = useRef<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const fetchQrCode = useCallback(async () => {
    setQrLoading(true);
    setQrExpired(false);
    setQrTimer(120);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/auth/qr-code`);
      const data = await response.json();
      setQrCodeId(data.qrCodeId);

      // FIX 1: Tạo socket RIÊNG chỉ để lắng nghe QR
      // KHÔNG dùng authSocket vì có force_logout listener gây logout nhầm
      if (qrSocketRef.current) {
        qrSocketRef.current.disconnect();
      }
      const qrSocket = io(apiUrl, { reconnection: false });
      qrSocketRef.current = qrSocket;

      qrSocket.on('connect', () => {
        console.log('[QR] Socket connected, joining room:', data.qrCodeId);
        qrSocket.emit('join_qr_room', { qrCodeId: data.qrCodeId });
      });

      qrSocket.on('login_success', (tokens: any) => {
        console.log('[QR] Login success received');
        setLoading(true);

        // FIX 2: Lưu đầy đủ token + user + deviceId
        localStorage.setItem('token', tokens.accessToken);
        localStorage.setItem('user', JSON.stringify(tokens.user));

        // Decode JWT để lấy deviceId
        try {
          const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
          if (payload.deviceId) {
            localStorage.setItem('deviceId', payload.deviceId);
          }
        } catch (e) {
          console.warn('[QR] Could not decode JWT payload', e);
        }

        // FIX 3: Disconnect qrSocket trước khi navigate
        qrSocket.disconnect();
        qrSocketRef.current = null;

        window.location.href = '/chat';
      });

    } catch (err) {
      console.error('[QR] Failed to fetch QR code', err);
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'qr') {
      fetchQrCode();
    }
    return () => {
      if (qrSocketRef.current) {
        qrSocketRef.current.disconnect();
        qrSocketRef.current = null;
      }
    };
  }, [activeTab, fetchQrCode]);

  useEffect(() => {
    let interval: any;
    if (activeTab === 'qr' && qrCodeId && !qrExpired) {
      interval = setInterval(() => {
        setQrTimer((prev) => {
          if (prev <= 1) {
            setQrExpired(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, qrCodeId, qrExpired]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-x-hidden bg-surface text-on-surface w-full font-sans">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="hidden lg:block fixed left-12 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-40">
        <div className="h-32 bg-primary/10 rounded-xl animate-float"></div>
        <div className="h-20 bg-secondary/10 rounded-xl ml-8"></div>
        <div className="h-40 bg-surface-container-high rounded-xl -ml-4"></div>
      </div>
      <div className="hidden lg:block fixed right-12 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-40">
        <div className="h-40 bg-surface-container-high rounded-xl ml-4"></div>
        <div className="h-24 bg-primary/10 rounded-xl -ml-8 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="h-32 bg-secondary/10 rounded-xl"></div>
      </div>

      <main className="w-full max-w-[480px] z-10 flex flex-col items-center animate-fade-in">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Link to="/" className="w-16 h-16 signature-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-white text-4xl">school</span>
            </Link>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary mb-1">ZaloEdu</h1>
          <p className="text-on-surface-variant font-medium tracking-tight">Khai phóng tiềm năng tri thức</p>
        </header>

        <div className="flex bg-surface-container p-1.5 rounded-2xl mb-8 w-full max-w-[400px] shadow-sm">
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'password' ? 'bg-surface-container-lowest text-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-xl">lock</span>
            Mật khẩu
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${activeTab === 'qr' ? 'bg-surface-container-lowest text-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-xl">qr_code_2</span>
            Mã QR
          </button>
        </div>

        <section className="w-full academic-glass rounded-[2rem] p-8 md:p-10 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] ring-1 ring-white/20 min-h-[480px] flex flex-col">
          {activeTab === 'password' ? (
            <div className="animate-slide-up">
              <h2 className="text-2xl font-bold text-on-surface mb-8 tracking-tight">Đăng nhập tài khoản</h2>
              {error && (
                <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-on-surface-variant ml-1">Email</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-outline text-xl group-focus-within:text-primary transition-colors">person</span>
                    </div>
                    <input
                      type="email"
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest outline-none font-medium"
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="block text-sm font-semibold text-on-surface-variant">Mật khẩu</label>
                    <Link to="/forgot-password" className="text-sm font-bold text-primary hover:text-primary-container transition-colors">Quên mật khẩu?</Link>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-outline text-xl group-focus-within:text-primary transition-colors">lock</span>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-12 text-on-surface placeholder:text-outline transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest outline-none font-medium"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div
                      className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-outline hover:text-on-surface transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full signature-gradient text-white font-bold py-4 rounded-2xl inner-glow shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Đăng nhập</span>
                      <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="animate-slide-up flex flex-1 flex-col items-center justify-center py-4">
              <h2 className="text-2xl font-bold text-on-surface mb-2 tracking-tight">Đăng nhập bằng mã QR</h2>
              <p className="text-on-surface-variant text-sm mb-8 font-medium">Sử dụng ứng dụng ZaloEdu trên điện thoại để quét mã</p>
              <div className="relative p-6 bg-white rounded-[2rem] shadow-xl shadow-primary/5 ring-1 ring-slate-100 mb-6 group">
                {qrLoading ? (
                  <div className="w-48 h-48 flex items-center justify-center bg-surface-container-low rounded-2xl">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : qrCodeId ? (
                  <div className={`transition-all duration-500 ${qrExpired ? 'blur-md opacity-30 grayscale' : 'opacity-100'}`}>
                    <QRCodeSVG value={qrCodeId} size={192} level="H" className="rounded-lg" title="Quét mã QR để đăng nhập" />
                  </div>
                ) : null}
                {qrExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <p className="text-error font-bold mb-4">Mã QR đã hết hạn</p>
                    <button
                      onClick={fetchQrCode}
                      className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-xl">refresh</span>
                      Làm mới mã
                    </button>
                  </div>
                )}
                {!qrExpired && !qrLoading && (
                  <>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-3xl -m-[2px]"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-3xl -m-[2px]"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-3xl -m-[2px]"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-3xl -m-[2px]"></div>
                  </>
                )}
              </div>
              {!qrExpired && qrCodeId && (
                <div className="text-center space-y-1 animate-fade-in">
                  <p className="text-outline text-[10px] font-bold uppercase tracking-[0.2em]">Mã còn hiệu lực trong</p>
                  <p className="text-3xl font-mono font-black text-primary tabular-nums">
                    {Math.floor(qrTimer / 60)}:{(qrTimer % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              )}
              <div className="mt-8 flex items-center gap-4 text-on-surface-variant bg-surface-container-low px-6 py-4 rounded-2xl border border-white/50">
                <span className="material-symbols-outlined text-primary text-2xl">smartphone</span>
                <span className="text-sm font-semibold leading-tight text-left">
                  Mở ứng dụng &gt; <span className="text-primary italic">Cá nhân</span><br />
                  Chọn <span className="text-primary italic">Quét mã QR</span>
                </span>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-col items-center gap-6">
          <p className="text-on-surface-variant font-medium">
            Bạn mới sử dụng ZaloEdu?
            <Link to="/register" className="text-primary font-bold hover:underline ml-1">Đăng ký ngay</Link>
          </p>
          <nav className="flex items-center gap-6 text-sm font-semibold text-outline">
            <Link to="#" className="hover:text-on-surface transition-colors">Điều khoản</Link>
            <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
            <Link to="#" className="hover:text-on-surface transition-colors">Bảo mật</Link>
            <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
            <Link to="#" className="hover:text-on-surface transition-colors">Hỗ trợ</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
};

export default LoginPage;