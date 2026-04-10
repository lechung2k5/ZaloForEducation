import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { Mail, User, Lock, CheckCircle2, ArrowRight, ArrowLeft, Phone, Calendar, MapPin, AlignLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { requestRegisterOtp, confirmRegister } = useAuth();
  const navigate = useNavigate();

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
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi mã OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length === 6) {
      setStep(3);
      setError('');
    } else {
      setError('Mã OTP phải có 6 chữ số.');
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError('Bạn cần đồng ý với điều khoản sử dụng.');
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
        confirmButtonColor: '#135bec',
        confirmButtonText: 'Đăng nhập ngay'
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi hoàn tất đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 py-10">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat rotate-180 opacity-40"
        style={{ backgroundImage: 'url("/auth-bg.png")' }}
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-tr from-white/60 to-primary/5 backdrop-blur-[1px]" />

      {/* Register Card */}
      <div className="relative z-20 w-full max-w-lg p-4 animate-slide-up">
        <div className="glass-effect p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
          <div className="text-center mb-8">
            <span className="text-3xl font-black text-primary tracking-tighter block mb-2">ZaloEdu</span>
            <h1 className="text-xl font-bold text-slate-800">Tạo tài khoản mới</h1>
            <p className="text-slate-500 text-sm mt-1">Gia nhập cộng đồng học tập thông minh</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between mb-10 px-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${step === s ? 'bg-primary text-white shadow-lg shadow-primary/30' :
                      step > s ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                >
                  {step > s ? <CheckCircle2 size={20} /> : s}
                </div>
                {s < 3 && <div className={`flex-1 h-1 mx-2 rounded ${step > s ? 'bg-green-500' : 'bg-slate-100'}`} />}
              </React.Fragment>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 animate-fade-in">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Email của bạn</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                  <input
                    type="email"
                    className="premium-input pl-12"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      if (val && !val.endsWith('@gmail.com')) {
                        setError('Chỉ chấp nhận tài khoản Gmail (@gmail.com)');
                      } else {
                        setError('');
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="primary-btn group" disabled={loading}>
                {loading ? 'Đang gửi mã...' : (
                  <span className="flex items-center justify-center gap-2">
                    Nhận mã xác thực <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fade-in">
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 block text-center">Xác thực OTP (6 chữ số)</label>
                <input
                  type="text"
                  className="w-full text-center text-4xl font-black tracking-[0.5em] py-5 rounded-3xl border-4 border-primary/20 focus:border-primary focus:outline-none bg-primary/5 text-primary transition-all"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-slate-500 text-center">Vui lòng kiểm tra mã được gửi đến <b>{email}</b></p>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  <ArrowLeft size={18} /> Quay lại
                </button>
                <button type="submit" className="flex-[2] primary-btn">Tiếp theo</button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleCompleteRegistration} className="space-y-5 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Họ và tên</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text"
                      className="premium-input pl-11 !py-3"
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Số điện thoại</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="tel"
                      className="premium-input pl-11 !py-3"
                      placeholder="0912345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Ngày sinh</label>
                  <div className="relative group">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="date"
                      className="premium-input pl-11 !py-3"
                      value={dataOfBirth}
                      onChange={(e) => setDataOfBirth(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Giới tính</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl h-[52px]">
                    <button
                      type="button"
                      onClick={() => setGender(true)}
                      className={`flex-1 rounded-xl font-bold text-sm transition-all ${gender ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                    >
                      Nam
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender(false)}
                      className={`flex-1 rounded-xl font-bold text-sm transition-all ${!gender ? 'bg-white text-pink-500 shadow-sm' : 'text-slate-500'}`}
                    >
                      Nữ
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Mật khẩu mới</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="premium-input pl-11 pr-11 !py-3"
                      placeholder="Tối thiểu 8 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Xác nhận mật khẩu</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="premium-input pl-11 pr-11 !py-3"
                      placeholder="Nhập lại mật khẩu"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 px-1 py-2">
                <div className="flex items-center h-5 mt-1">
                  <input
                    id="terms"
                    type="checkbox"
                    className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                  />
                </div>
                <label htmlFor="terms" className="text-xs text-slate-500 cursor-pointer select-none">
                  Tôi đồng ý với <span className="text-primary font-bold">Chính sách bảo mật</span> và <span className="text-primary font-bold">Điều khoản sử dụng</span> của ZaloEdu.
                </label>
              </div>

              <button
                type="submit"
                className={`primary-btn group ${!agreedToTerms ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                disabled={loading || !agreedToTerms}
              >
                {loading ? 'Đang khởi tạo...' : (
                  <span className="flex items-center justify-center gap-2">
                    Hoàn tất đăng ký <ShieldCheck size={20} />
                  </span>
                )}
              </button>
            </form>
          )}

          <div className="text-center mt-8 text-slate-500 text-sm">
            Đã có tài khoản? <Link to="/login" className="text-primary font-extrabold hover:underline">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
