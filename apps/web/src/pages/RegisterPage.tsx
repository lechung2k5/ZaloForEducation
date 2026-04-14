import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import GoogleOneTapPrompt from '../components/GoogleOneTapPrompt';
import ProfileCompletionModal from '../components/ProfileCompletionModal';
import { useOtpCountdown } from '../hooks/useOtpCountdown';



const RegisterPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState<boolean>(true); // true = Nam, false = Nữ
  const [dataOfBirth, setDataOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Extra state for OTP inputs (combining 6 digits)
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);

  const { countdown, startCountdown, syncWithServer } = useOtpCountdown(email);

  const { requestRegisterOtp, confirmRegister, resendOtp, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');


  const handleBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[@$!%*?&]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthConfig = [
    { label: 'Rất yếu', color: 'bg-error', width: '25%' },
    { label: 'Yếu', color: 'from-error to-warning/50', width: '40%' },
    { label: 'Trung bình', color: 'from-warning to-primary/50', width: '65%' },
    { label: 'Mạnh', color: 'from-primary/50 to-secondary', width: '100%' }
  ];

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith('@gmail.com')) {
      setError('Chỉ chấp nhận đăng ký bằng tài khoản Gmail.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestRegisterOtp(email);
      startCountdown();
      setStep(2);
    } catch (err: any) {
      if (err.response?.status === 429 && err.response?.data?.retryAfter) {
        syncWithServer(err.response.data.retryAfter);
      }
      setError(err.response?.data?.message || 'Không thể gửi mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  const currentOtp = otpArray.join('');
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentOtp.length === 6) {
      setOtp(currentOtp);
      setStep(3);
      setError('');
    } else {
      setError('Mã OTP phải có 6 chữ số.');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otpArray];
    newOtp[index] = value;
    setOtpArray(newOtp);
    // Auto focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      await resendOtp(email, 'register');
      startCountdown();
    } catch (err: any) {
      if (err.response?.status === 429 && err.response?.data?.retryAfter) {
        syncWithServer(err.response.data.retryAfter);
      }
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('Bạn cần đồng ý với điều khoản sử dụng.');
      return;
    }

    // Validation
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setError('Họ và tên phải bao gồm ít nhất 2 từ.');
      return;
    }
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(fullName)) {
      setError('Họ tên không được chứa số hoặc ký tự đặc biệt.');
      return;
    }

    const phoneRegex = /^(0|84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      setError('Số điện thoại không hợp lệ (Phải là SĐT Việt Nam).');
      return;
    }

    const dobRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(19|20)\d\d$/;
    if (!dobRegex.test(dataOfBirth)) {
      setError('Ngày sinh phải đúng định dạng DD-MM-YYYY (VD: 15-05-2005).');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setError('Mật khẩu phải tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await confirmRegister({ 
        email, 
        otp, 
        fullName, 
        password,
        gender,
        dataOfBirth,
        phone
      });
      await Swal.fire({
        icon: 'success',
        title: 'Đăng ký thành công!',
        text: 'Tài khoản của bạn đã được khởi tạo. Hãy đăng nhập để truy cập hệ thống.',
        confirmButtonColor: '#00418f',
        confirmButtonText: 'Đăng nhập ngay'
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi hoàn tất đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      if (res.success) {
        navigate('/chat');
      } else if (res.isProfileComplete === false) {
        setPendingEmail(res.email || '');
        setIsProfileModalOpen(true);
      } else if (res.requireOtp) {
        // Should not happen for registration unless Google user email redirected to standard login OTP
        navigate('/login', { state: { email: res.email } });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập Google thất bại.');
    } finally {
      setLoading(false);
    }
  };


  if (step === 1) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden w-full">
        {/* Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary-container/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <GoogleOneTapPrompt 
          onSuccess={(res) => {
            if (res.isProfileComplete === false) {
              setPendingEmail(res.email || '');
              setIsProfileModalOpen(true);
            }
          }}
          onError={(err) => console.log('One Tap Error:', err)}
        />

        <ProfileCompletionModal 
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          email={pendingEmail}
        />

        
        {/* Main Container */}
        <div className="w-full max-w-xl z-10 animate-fade-in">
          {/* Brand Identity */}
          <div className="mb-10 flex flex-col items-center">
            <Link to="/" className="w-16 h-16 bg-[#eef4ff] rounded-2xl flex items-center justify-center shadow-xl shadow-primary/10 hover:scale-105 transition-transform border border-[#00418f10] overflow-hidden">
              <img src="/logo_blue.png" alt="Logo" className="w-full h-full object-cover" />
            </Link>
            <span className="text-3xl font-extrabold tracking-tighter text-primary">Zalo Education</span>
          </div>

          {/* Stepper Component */}
          <div className="flex items-center justify-between mb-12 px-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full signature-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-lg">person</span>
              </div>
              <span className="text-[11px] font-bold text-primary tracking-wide">Tài khoản</span>
            </div>
            <div className="flex-1 h-[2px] mx-4 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="w-0 h-full signature-gradient"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-lg">lock</span>
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">Mật khẩu</span>
            </div>
            <div className="flex-1 h-[2px] mx-4 bg-surface-container-highest rounded-full"></div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-lg">verified_user</span>
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">Hoàn tất</span>
            </div>
          </div>

          {/* Registration Card */}
          <div className="academic-glass rounded-xl p-8 md:p-12 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] border border-white/40">
            <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight leading-tight mb-4 text-center">
              Bắt đầu hành trình tri thức
            </h1>
            <p className="text-on-surface-variant text-center mb-10 font-medium">
              Tham gia cộng đồng học thuật tinh hoa cùng Zalo Education.
            </p>

            {error && (
              <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20">
                {error}
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-8">
              {/* High-Quality Email Field */}
              <div className="relative group">
                <label className="absolute -top-2.5 left-5 bg-white px-2 text-[11px] font-bold text-primary tracking-widest z-10 uppercase">Địa chỉ Email</label>
                <div className="relative">
                  <input 
                    type="email"
                    className="w-full h-16 px-6 bg-surface-container-highest border-none rounded-xl text-on-surface font-medium placeholder:text-outline/50 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all duration-300 outline-none" 
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">alternate_email</span>
                  </div>
                </div>
                <p className="mt-2 ml-4 text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">info</span>
                  Chúng tôi sẽ gửi mã xác thực tới email này.
                </p>
              </div>

              {/* Prominent CTA Button */}
              <button 
                type="submit" 
                disabled={loading || countdown > 0}
                className="w-full h-16 signature-gradient text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 relative overflow-hidden group disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <span>{loading ? 'Đang gửi...' : (countdown > 0 ? `Nhận mã sau (${countdown}s)` : 'Nhận mã xác thực')}</span>
                {!loading && countdown === 0 && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>}
              </button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-4 text-on-surface-variant font-bold tracking-widest">Hoặc đăng ký nhanh bằng</span>
                </div>
              </div>

              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Đăng nhập Google thất bại.')}
                  useOneTap={false}
                  theme="outline"
                  shape="pill"
                  size="large"
                  width="100%"
                  text="signup_with"
                />
              </div>
            </form>


            <div className="mt-8 text-center">
              <p className="text-on-surface-variant font-medium">
                Đã có tài khoản? 
                <Link to="/login" className="text-primary font-bold hover:underline decoration-2 underline-offset-4 ml-1">Đăng nhập ngay</Link>
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="academic-glass p-6 rounded-xl border border-white/20 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined">school</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">Giảng đường số</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Tiếp cận kho tài liệu từ các viện nghiên cứu hàng đầu.</p>
              </div>
            </div>
            <div className="academic-glass p-6 rounded-xl border border-white/20 flex items-start gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined">card_membership</span>
              </div>
              <div>
                <h3 className="font-bold text-on-surface">Chứng chỉ uy tín</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">Xác thực kỹ năng theo tiêu chuẩn mở.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Background Illustration */}
        <div className="fixed top-0 right-0 -z-0 w-1/3 h-full overflow-hidden pointer-events-none hidden lg:block">
          <div className="absolute inset-0 bg-gradient-to-l from-white/80 to-transparent"></div>
          <img className="h-full w-full object-cover opacity-10" alt="Library Background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDOGdbm8nWg5tkhOYNwD2fC47wnuIFdiKsjfd8k1nqoov1Zn3uujdxYDapkood7eiG-Ieu6yXc1shKBibC_dd7XVyRyPlAEPIeZOz99VDUPUogB_zkg0Zl7vNsL7NBn_3EJwbttNsYyl4fEMhrJzqJJIHg0tFfCvTGUnJrHQkXpfEh6jM6PAnh_CLO1-FtvEXEh-X3mQUQp4dMi3kCtWbwmfAm57WF6gRrCqLhzjSFWly8LWgrt5l_UIbaIWa1bK2_wscROLmoXXQ" />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col w-full">
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative animate-fade-in">
          <div className="w-full max-w-md z-10">
            {/* Branding Anchor */}
            <div className="flex justify-center mb-10">
              <div className="flex items-center gap-4">
                <img src="/logo_blue.png" alt="Logo" className="w-10 h-10 object-contain" />
                <span className="text-2xl font-bold tracking-tighter text-primary">Zalo Education</span>
              </div>
            </div>
            
            {/* Stepper */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-sm font-bold">
                  <span className="material-symbols-outlined text-sm">check</span>
                </div>
                <span className="text-sm font-medium text-on-surface-variant">Đăng ký</span>
              </div>
              <div className="h-px w-8 bg-outline-variant"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/20">
                  2
                </div>
                <span className="text-sm font-bold text-primary">Xác thực</span>
              </div>
              <div className="h-px w-8 bg-outline-variant"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-outline flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <span className="text-sm font-medium text-outline">Hoàn tất</span>
              </div>
            </div>
            
            {/* Content Card */}
            <div className="academic-glass bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] border border-white/40">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-extrabold tracking-tight text-on-surface mb-3">Xác thực tài khoản</h1>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  Mã xác minh đã được gửi đến địa chỉ email <br />
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
                      id={`otp-${index}`}
                      type="text" 
                      maxLength={1} 
                      placeholder="·"
                      className="w-full aspect-square text-center text-2xl font-bold bg-surface-container-highest border-2 border-transparent rounded-2xl transition-all duration-300 outline-none focus:bg-white focus:border-primary focus:shadow-[0_0_0_2px_rgba(0,65,143,0.2)] text-primary"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                    />
                  ))}
                </div>
                
                <button type="submit" className="w-full py-4 bg-gradient-to-br from-[#0058bc] to-[#00418f] text-white font-bold rounded-2xl shadow-lg shadow-primary/30 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 mb-6">
                  Xác thực OTP
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </form>

              <div className="flex flex-col items-center gap-4">
                <button 
                  type="button"
                  onClick={handleResendOtp}
                  disabled={countdown > 0 || loading}
                  className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {countdown > 0 ? `Gửi lại mã (${countdown}s)` : 'Gửi lại mã OTP'}
                </button>
                <button onClick={() => setStep(1)} className="text-sm font-semibold text-outline hover:text-primary transition-colors duration-200">
                  Quay lại để sửa Email
                </button>
              </div>
            </div>
            
            <div className="mt-12 flex flex-col items-center gap-4 opacity-60">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  Secure Verification
                </div>
              </div>
              <p className="text-[11px] text-center text-on-surface-variant px-12 leading-relaxed">
                Kết nối của bạn được bảo mật bằng mã hóa 256-bit chuẩn quốc tế. Zalo Education cam kết bảo vệ dữ liệu học tập của bạn.
              </p>
            </div>
          </div>
          
          <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-secondary-container/20 rounded-full blur-[100px] pointer-events-none"></div>
        </main>
      </div>
    );
  }

  // Final Step 3
  return (
    <div className="bg-surface text-on-surface min-h-screen w-full relative z-0 animate-fade-in">
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-24 relative z-10">
        <header className="text-center mb-16">
          <h1 className="text-3xl font-extrabold tracking-tighter text-primary mb-4">Zalo Education</h1>
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold">
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-on-surface-variant text-sm font-medium">Tài khoản</span>
            </div>
            <div className="h-px w-8 bg-outline-variant"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold">
                <span className="material-symbols-outlined text-sm">check</span>
              </div>
              <span className="text-on-surface-variant text-sm font-medium">Xác thực</span>
            </div>
            <div className="h-px w-8 bg-outline-variant"></div>
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-full signature-gradient text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/20">3</div>
              <span className="text-primary text-sm font-bold">Hoàn tất</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            <section className="academic-glass bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] border border-white/20">
              <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-8">Thông tin cá nhân</h2>
              
              {error && (
                <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20">
                  {error}
                </div>
              )}

              <form onSubmit={handleCompleteRegistration} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-on-surface-variant ml-1">Họ và tên</label>
                  <input 
                    type="text"
                    className={`w-full px-5 py-4 bg-surface-container-highest rounded-xl border-2 transition-all duration-300 outline-none text-on-surface placeholder:text-outline ${touchedFields.fullName && (fullName.trim().split(/\s+/).length < 2 || /[0-9!@#$%^&*(),.?":{}|<>]/.test(fullName)) ? 'border-error bg-error-container/10' : 'border-transparent focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest'}`} 
                    placeholder="Nguyễn Văn A" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => handleBlur('fullName')}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant ml-1">Số điện thoại</label>
                    <input 
                      type="tel"
                      className={`w-full px-5 py-4 bg-surface-container-highest rounded-xl border-2 transition-all duration-300 outline-none text-on-surface ${touchedFields.phone && !/^(0|84)(3|5|7|8|9)[0-9]{8}$/.test(phone) ? 'border-error bg-error-container/10' : 'border-transparent focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest'}`} 
                      placeholder="0901 234 567" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => handleBlur('phone')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant ml-1">Ngày sinh</label>
                    <div className="relative">
                      <input 
                        type="text"
                        className={`w-full px-5 py-4 bg-surface-container-highest rounded-xl border-2 transition-all duration-300 outline-none text-on-surface ${touchedFields.dataOfBirth && !/^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(19|20)\d\d$/.test(dataOfBirth) ? 'border-error bg-error-container/10' : 'border-transparent focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest'}`} 
                        placeholder="DD-MM-YYYY" 
                        value={dataOfBirth}
                        onChange={(e) => setDataOfBirth(e.target.value)}
                        onBlur={() => handleBlur('dataOfBirth')}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-on-surface-variant ml-1">Giới tính</label>
                  <div className="flex p-1.5 bg-surface-container-highest rounded-2xl w-full">
                    <button 
                      type="button" 
                      onClick={() => setGender(true)}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${gender ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                    >
                      Nam
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setGender(false)}
                      className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${!gender ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                    >
                      Nữ
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant ml-1">Mật khẩu mới</label>
                    <input 
                      type="password"
                      className={`w-full px-5 py-4 bg-surface-container-highest rounded-xl border-2 transition-all duration-300 outline-none text-on-surface ${touchedFields.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password) ? 'border-error bg-error-container/10' : 'border-transparent focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest'}`} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => handleBlur('password')}
                      required
                    />
                    {password && (
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
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant ml-1">Xác nhận mật khẩu</label>
                    <input 
                      type="password"
                      className="w-full px-5 py-4 bg-surface-container-highest rounded-xl border-none focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest transition-all duration-300 outline-none text-on-surface" 
                      placeholder="••••••••" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 py-4">
                  <div className="mt-1">
                    <input 
                      type="checkbox"
                      id="terms"
                      className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/20 bg-surface-container-highest cursor-pointer" 
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                  </div>
                  <label htmlFor="terms" className="text-sm text-on-surface-variant leading-relaxed">
                    Tôi đồng ý với các <span className="text-primary font-semibold">Điều khoản dịch vụ</span> và <span className="text-primary font-semibold">Chính sách bảo mật</span> của Zalo Education.
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || !agreedToTerms}
                  className="w-full signature-gradient text-white py-5 rounded-2xl font-bold text-lg inner-glow shadow-xl shadow-primary/25 hover:opacity-90 active:scale-[0.98] transition-all duration-300 disabled:opacity-50"
                >
                  {loading ? 'Đang khởi tạo...' : 'Hoàn tất đăng ký'}
                </button>
              </form>
            </section>
          </div>

          {/* Social Proof Sidebar */}
          <div className="lg:col-span-5 space-y-8 hidden lg:block">
            <div className="academic-glass bg-primary-container p-10 rounded-xl relative overflow-hidden text-white shadow-2xl shadow-primary/30">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <span className="material-symbols-outlined text-4xl mb-6 opacity-80">format_quote</span>
              <p className="text-xl font-medium leading-relaxed mb-8 relative z-10 italic">
                "Hệ thống học tập tại Zalo Education giúp mình tối ưu hóa thời gian và đạt được chứng chỉ học thuật chỉ trong thời gian ngắn."
              </p>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/50 text-white font-bold text-xl">MT</div>
                <div>
                  <h4 className="font-bold text-lg">Minh Thư</h4>
                  <p className="text-sm text-white/70">Học viên xuất sắc 2026</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-on-surface-variant tracking-tight ml-2">Tham gia cùng cộng đồng</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="academic-glass bg-surface-container-low p-4 rounded-xl flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-primary">groups</span>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-on-surface">50K+</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">Học viên</p>
                  </div>
                </div>
                <div className="academic-glass bg-surface-container-low p-4 rounded-xl flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-primary">verified</span>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-on-surface">200+</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">Chuyên gia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-20 text-center">
          <p className="text-on-surface-variant text-sm">
            Bạn đã có tài khoản? <Link to="/login" className="text-primary font-bold hover:underline">Đăng nhập ngay</Link>
          </p>
        </footer>
      </main>

      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-secondary-container/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[30vw] h-[30vw] bg-primary-fixed/30 rounded-full blur-[100px]"></div>
      </div>
    </div>
  );
};

export default RegisterPage;
