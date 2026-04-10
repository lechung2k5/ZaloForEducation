import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, Globe, Eye, EyeOff } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105 animate-pulse-slow"
        style={{ backgroundImage: 'url("/auth-bg.png")' }}
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-white/40 to-primary/10 backdrop-blur-[2px]" />

      {/* Floating Shapes for depth */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      {/* Login Card */}
      <div className="relative z-20 w-full max-w-md p-4 animate-slide-up">
        <div className="glass-effect p-8 md:p-10 rounded-[2.5rem] shadow-2xl">
          <div className="text-center mb-10">
            <div className="inline-block p-4 bg-primary/10 rounded-2xl mb-4">
              <span className="text-4xl font-extrabold text-primary tracking-tighter">ZaloEdu</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Mừng bạn quay trở lại</h1>
            <p className="text-slate-500 mt-2">Đăng nhập để tiếp tục hành trình học tập</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                <input
                  type="email"
                  className="premium-input pl-12"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-bold text-slate-700">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs font-bold text-primary hover:underline">Quên mật khẩu?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="premium-input pl-12 pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button type="submit" className="primary-btn group" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Đăng nhập <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white/50 px-2 text-slate-400 font-bold backdrop-blur-sm">Hoặc đăng nhập với</span></div>
            </div>

            <div className="mt-6">
              <button disabled className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-600 opacity-60 cursor-not-allowed">
                <Globe size={20} /> Google
              </button>
            </div>
          </div>

          <p className="text-center mt-10 text-slate-500 text-sm">
            Chưa có tài khoản? <Link to="/register" className="text-primary font-extrabold hover:text-primary-dark transition-colors">Đăng ký ngay miễn phí</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
