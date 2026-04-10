import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-x-hidden bg-surface text-on-surface w-full">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[80px] pointer-events-none"></div>
      
      {/* Side Graphic (Decorative Bento elements implied for larger screens) */}
      <div className="hidden lg:block fixed left-12 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-40">
        <div className="h-32 bg-primary/10 rounded-xl"></div>
        <div className="h-20 bg-secondary/10 rounded-xl ml-8"></div>
        <div className="h-40 bg-surface-container-high rounded-xl -ml-4"></div>
      </div>
      <div className="hidden lg:block fixed right-12 top-1/2 -translate-y-1/2 w-64 space-y-4 opacity-40">
        <div className="h-40 bg-surface-container-high rounded-xl ml-4"></div>
        <div className="h-24 bg-primary/10 rounded-xl -ml-8"></div>
        <div className="h-32 bg-secondary/10 rounded-xl"></div>
      </div>

      <main className="w-full max-w-[480px] z-10 flex flex-col items-center">
        {/* Brand Identity */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="w-16 h-16 signature-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20">
              <span className="material-symbols-outlined text-white text-4xl">school</span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary mb-1">ZaloEdu</h1>
          <p className="text-on-surface-variant font-medium tracking-tight">Khai phóng tiềm năng tri thức</p>
        </header>

        {/* Glass-morphic Login Card */}
        <section className="w-full academic-glass rounded-[2rem] p-8 md:p-10 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] ring-1 ring-white/20">
          <h2 className="text-2xl font-bold text-on-surface mb-8 tracking-tight">Đăng nhập</h2>
          
          {error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-2xl mb-6 text-sm font-medium border border-error/20 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email/Username Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-on-surface-variant ml-1">Email hoặc Tên đăng nhập</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-xl group-focus-within:text-primary transition-colors">person</span>
                </div>
                <input 
                  type="email"
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest outline-none" 
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
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
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-12 text-on-surface placeholder:text-outline transition-all duration-300 focus:ring-2 focus:ring-primary/40 focus:bg-surface-container-lowest outline-none" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-outline hover:text-on-surface transition-colors">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </div>
              </div>
            </div>

            {/* Primary Login Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full signature-gradient text-white font-bold py-4 rounded-2xl inner-glow shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Đang xử lý</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Social Divider */}
          <div className="relative my-10">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant/30"></div>
            </div>
            <div className="relative flex justify-center text-sm font-medium leading-6">
              <span className="bg-transparent px-4 text-on-surface-variant backdrop-blur-md">Hoặc đăng nhập với</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-1 gap-4">
            <button className="flex items-center justify-center gap-3 w-full bg-surface-container-lowest border border-outline-variant/20 py-4 rounded-2xl hover:bg-surface-container-low transition-all duration-300 active:scale-[0.98]">
              <img alt="Google Logo" className="w-6 h-6" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPE-Hs2sXxF9RWnHVJmc9fl7OCnvNjpdSeR2gViU90OjYvOGyo3J519Ct4X1IRo7cmyQMNiuuX4zEC3lyTYvTy-69cXAR_Oia3hr_Sz7-wETfp3Vo0sK9DEZ_uJoSJ9Fe5ORgxINXXgFGszhwAtQclIiYY8AcRPS5GGU5IGiDlCVyBXkaFnCB4JzPJxqmehQCcD38q5wvkcv9xWLkIT0i2dah9CRhyvZi6SSKr7eXUtOz1pyy0h8yCfTmyV7EBJxs-VBE3omB3Wg" />
              <span className="font-bold text-on-surface">Tiếp tục với Google</span>
            </button>
          </div>
        </section>

        {/* Footer Links */}
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
