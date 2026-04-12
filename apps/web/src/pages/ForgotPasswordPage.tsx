import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);
  
  const { requestForgotPassword, resetPassword, resendOtp } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[@$!%*?&]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthConfig = [
    { label: 'Rất yếu', color: 'bg-error', width: '25%' },
    { label: 'Yếu', color: 'from-error to-warning/50', width: '40%' },
    { label: 'Trung bình', color: 'from-warning to-primary/50', width: '65%' },
    { label: 'Mạnh', color: 'from-primary/50 to-secondary', width: '100%' }
  ];

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.endsWith('@gmail.com')) {
      setError('Chỉ chấp nhận tài khoản Gmail (@gmail.com)');
      return;
    }
    setLoading(true);
    try {
      await requestForgotPassword(email);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi mã OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setLoading(true);
    setError('');
    try {
      await resendOtp(email, 'forgot_password');
      setCanResend(false);
      setResendTimer(60);
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otpArray];
    newOtp[index] = value;
    setOtpArray(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`forgot-otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  };
  const currentOtp = otpArray.join('');

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (currentOtp.length !== 6) { setError('Mã OTP phải có 6 chữ số'); return; }
    // Ở web flow này ta đơn giản là cho qua bước tiếp theo và sẽ verify thật sự ở handleResetPassword
    setStep('reset');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setError('Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }

    if (newPassword !== confirmPassword) { 
      setError('Mật khẩu xác nhận không khớp.');
      return; 
    }
    setLoading(true);
    try {
      await resetPassword({ email, otp: currentOtp, newPassword });
      await Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: 'Mật khẩu đã được đặt lại thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
        confirmButtonColor: '#00418f',
        confirmButtonText: 'Đăng nhập ngay'
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi khi đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col w-full">
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative animate-fade-in">
          <div className="w-full max-w-md z-10">
            <div className="flex justify-center mb-10">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">school</span>
                </div>
                <span className="text-2xl font-bold tracking-tighter text-primary">ZaloEdu</span>
              </div>
            </div>
            
            <div className="academic-glass bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] border border-white/40">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-3">Nhập mã OTP</h1>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  Chúng tôi đã gửi mã xác thực gồm 6 chữ số tới <br />
                  <span className="font-semibold text-on-surface">{email}</span>
                </p>
              </div>

              {error && (
                <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleVerifyOtp}>
                <div className="grid grid-cols-6 gap-3 mb-8">
                  {otpArray.map((digit, index) => (
                    <input 
                      key={index}
                      id={`forgot-otp-${index}`}
                      type="text" 
                      maxLength={1} 
                      placeholder="·"
                      className="w-full aspect-square text-center text-2xl font-bold bg-surface-container-highest border-2 border-transparent rounded-2xl transition-all duration-300 outline-none focus:bg-white focus:border-primary focus:shadow-[0_0_0_2px_rgba(0,65,143,0.2)] text-primary"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                    />
                  ))}
                </div>
                
                <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-br from-[#0058bc] to-[#00418f] text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 mb-6 disabled:opacity-50">
                  {loading ? 'Đang xác thực...' : 'Xác thực OTP'}
                  {!loading && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
                </button>
              </form>

              <div className="flex flex-col items-center gap-4">
                <button 
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || loading}
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendTimer > 0 ? `Gửi lại mã (${resendTimer}s)` : 'Gửi lại mã OTP'}
                </button>
                <button onClick={() => setStep('email')} className="text-sm font-semibold text-outline hover:text-primary transition-colors duration-200">
                  Đổi email khác
                </button>
              </div>
            </div>
          </div>
          
          <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-secondary-container/20 rounded-full blur-[100px] pointer-events-none"></div>
        </main>
      </div>
    );
  }

  // Handle both Email request and Reset steps using the streamlined qu_n_m_t_kh_u_b_c_1 layout
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center w-full animate-fade-in relative z-0">
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-6 bg-transparent">
        <Link to="/login" className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-container-lowest shadow-[0px_10px_20px_rgba(0,65,143,0.04)] text-primary transition-transform active:scale-95 duration-200">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Link>
        <div className="text-xl font-bold tracking-tighter text-primary">ZaloEdu</div>
        <div className="w-12 h-12"></div>
      </nav>

      <main className="flex-1 w-full max-w-md px-6 pt-32 pb-12 flex flex-col items-center z-10">
        <div className="w-full text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-surface-container-lowest shadow-[0px_20px_40px_rgba(0,65,143,0.06)] mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'wght' 300" }}>
                {step === 'email' ? 'lock_reset' : 'key'}
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-3">
            {step === 'email' ? 'Quên mật khẩu?' : 'Tạo mật khẩu mới'}
          </h1>
          <p className="text-on-surface-variant leading-relaxed px-4 text-sm font-medium">
            {step === 'email' 
              ? 'Nhập Email để khôi phục. Chúng tôi sẽ gửi mã OTP đến hộp thư của bạn.' 
              : 'Hãy nhập mật khẩu mới và cố gắng không quên nó lần nào nữa nhé.'
            }
          </p>
        </div>

        <div className="w-full">
          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="group relative">
                <label className="absolute left-5 -top-2.5 px-2 bg-surface text-label text-xs font-semibold text-primary transition-all">
                  Địa chỉ Email
                </label>
                <div className="flex items-center bg-surface-container-highest/50 group-focus-within:bg-surface-container-lowest border-2 border-transparent group-focus-within:border-primary/20 rounded-2xl transition-all duration-300 shadow-sm relative">
                  <div className="pl-5 text-on-surface-variant group-focus-within:text-primary transition-colors flex items-center">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <input 
                    type="email"
                    className="w-full bg-transparent border-none outline-none focus:ring-0 py-5 px-4 text-on-surface placeholder:text-outline-variant font-medium" 
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full signature-gradient text-white py-5 rounded-2xl font-bold text-lg shadow-[0px_10px_25px_rgba(0,65,143,0.2)] active:scale-[0.98] transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
                  {!loading && <span className="material-symbols-outlined text-xl group-hover:translate-x-1 duration-300">arrow_forward</span>}
                </span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="group relative">
                <label className="absolute left-5 -top-2.5 px-2 bg-surface text-label text-xs font-semibold text-primary transition-all z-10">
                  Mật khẩu mới
                </label>
                <div className="flex items-center bg-surface-container-highest/50 group-focus-within:bg-surface-container-lowest border-2 border-transparent group-focus-within:border-primary/20 rounded-2xl transition-all duration-300 shadow-sm relative">
                  <div className="pl-5 text-on-surface-variant group-focus-within:text-primary transition-colors flex items-center">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-transparent border-none outline-none focus:ring-0 py-5 px-4 text-on-surface placeholder:text-outline-variant font-medium" 
                    placeholder="Tối thiểu 8 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <div 
                    className="pr-5 cursor-pointer text-outline hover:text-on-surface transition-colors flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </div>
                </div>
                {newPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      <span>Độ mạnh: <span className={
                        passwordStrength === 0 ? 'text-error' : 
                        passwordStrength < 3 ? 'text-warning' : 
                        'text-primary'
                      }>{strengthConfig[Math.max(0, passwordStrength - 1)].label}</span></span>
                      <span>{passwordStrength * 25}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r transition-all duration-500 rounded-full ${strengthConfig[Math.max(0, passwordStrength - 1)].color}`}
                        style={{ width: strengthConfig[Math.max(0, passwordStrength - 1)].width }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="group relative">
                <label className="absolute left-5 -top-2.5 px-2 bg-surface text-label text-xs font-semibold text-primary transition-all z-10">
                  Xác nhận lại
                </label>
                <div className="flex items-center bg-surface-container-highest/50 group-focus-within:bg-surface-container-lowest border-2 border-transparent group-focus-within:border-primary/20 rounded-2xl transition-all duration-300 shadow-sm relative">
                  <div className="pl-5 text-on-surface-variant group-focus-within:text-primary transition-colors flex items-center">
                    <span className="material-symbols-outlined">lock_reset</span>
                  </div>
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full bg-transparent border-none outline-none focus:ring-0 py-5 px-4 text-on-surface placeholder:text-outline-variant font-medium" 
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <div 
                    className="pr-5 cursor-pointer text-outline hover:text-on-surface transition-colors flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full signature-gradient text-white py-5 rounded-2xl font-bold text-lg shadow-[0px_10px_25px_rgba(0,65,143,0.2)] active:scale-[0.98] transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                  {!loading && <span className="material-symbols-outlined text-xl">check_circle</span>}
                </span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            </form>
          )}
        </div>

        <div className="mt-auto pt-12 w-full">
          <div className="rounded-3xl bg-surface-container-low p-6 flex items-center gap-4 border border-white/50">
            <div className="w-12 h-12 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
              <span className="material-symbols-outlined">support_agent</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-on-surface">Bạn cần trợ giúp?</p>
              <p className="text-xs text-on-surface-variant">Liên hệ với bộ phận hỗ trợ</p>
            </div>
            <button className="text-primary font-bold text-sm hover:underline">
              Trò chuyện
            </button>
          </div>
        </div>
      </main>

      <div className="fixed -z-10 top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]"></div>
      <div className="fixed -z-10 bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-secondary-container/20 rounded-full blur-[80px]"></div>
    </div>
  );
}
