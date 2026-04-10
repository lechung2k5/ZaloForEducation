import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import Swal from 'sweetalert2';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type Step = 'email' | 'otp' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.endsWith('@gmail.com')) {
      setError('Chỉ chấp nhận tài khoản Gmail (@gmail.com)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) setStep('otp');
      else setError(data.message);
    } catch {
      setError('Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Mã OTP phải có 6 chữ số'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (res.ok) setStep('reset');
      else setError(data.message);
    } catch {
      setError('Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { 
      Swal.fire({
        icon: 'error',
        title: 'Mật khẩu quá ngắn',
        text: 'Mật khẩu phải có ít nhất 6 ký tự',
        confirmButtonColor: '#135bec',
      });
      return; 
    }
    if (newPassword !== confirmPassword) { 
      Swal.fire({
        icon: 'error',
        title: 'Mật khẩu không khớp',
        text: 'Mật khẩu xác nhận không giống với mật khẩu mới',
        confirmButtonColor: '#135bec',
      });
      return; 
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Thành công!',
          text: 'Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
          confirmButtonColor: '#135bec',
          confirmButtonText: 'Đăng nhập ngay'
        });
        navigate('/login');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Lỗi đổi mật khẩu',
          text: data.message,
          confirmButtonColor: '#135bec',
        });
        setError(data.message);
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi kết nối',
        text: 'Không thể kết nối với server',
        confirmButtonColor: '#135bec',
      });
      setError('Không thể kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = { email: 1, otp: 2, reset: 3 };
  const currentStep = stepIndex[step];

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-logo">Z</div>
          <span className="auth-brand-name">ZaloEdu</span>
        </div>

        <>
          <h1 className="auth-title">Quên mật khẩu</h1>
            <p className="auth-subtitle">
              {step === 'email' && 'Nhập Gmail để nhận mã xác thực'}
              {step === 'otp' && `Nhập mã OTP đã gửi tới ${email}`}
              {step === 'reset' && 'Tạo mật khẩu mới cho tài khoản'}
            </p>

            {/* Step Indicator */}
            <div className="step-indicator">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div className={`step-circle ${currentStep >= s ? 'active' : ''}`}>{s}</div>
                  {s < 3 && <div className={`step-line ${currentStep > s ? 'active' : ''}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* Bước 1: Email */}
            {step === 'email' && (
              <form onSubmit={handleSendOtp} className="auth-form">
                <div className="form-group">
                  <label>Email Gmail</label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    required
                  />
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? 'Đang gửi...' : 'Gửi mã OTP về Gmail'}
                </button>
              </form>
            )}

            {/* Bước 2: OTP */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="auth-form">
                <div className="form-group">
                  <label>Mã OTP (6 chữ số)</label>
                  <input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    style={{ letterSpacing: '0.5em', fontSize: '1.5rem', textAlign: 'center' }}
                    required
                  />
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? 'Đang xác thực...' : 'Xác thực OTP'}
                </button>
                <button type="button" className="auth-btn-secondary" onClick={() => setStep('email')}>
                  ← Quay lại
                </button>
                <button type="button" className="auth-link-btn" onClick={handleSendOtp as any}>
                  Gửi lại mã OTP
                </button>
              </form>
            )}

            {/* Bước 3: Mật khẩu mới */}
            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="auth-form">
                <div className="form-group">
                  <label>Mật khẩu mới</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Tối thiểu 6 ký tự"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                      required
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      required
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {error && <p className="auth-error">{error}</p>}
                <button type="submit" className="auth-btn-primary" disabled={loading}>
                  {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                </button>
              </form>
            )}
          </>

        <div className="auth-footer">
          <a href="/login">← Quay lại đăng nhập</a>
        </div>
      </div>
    </div>
  );
}
