import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 academic-glass border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 signature-gradient rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white text-2xl">school</span>
              </div>
              <span className="text-2xl font-black tracking-tighter text-primary">
                ZaloEdu
              </span>
            </Link>
            <div className="flex items-center gap-8">
              <nav className="hidden md:flex items-center gap-6">
                <a href="#features" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Tính năng</a>
                <a href="#about" className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Giới thiệu</a>
              </nav>
              <button 
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-6 py-2.5 signature-gradient text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all inner-glow"
              >
                <span className="material-symbols-outlined text-xl">login</span>
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 lg:pt-56 lg:pb-32 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Side Graphic (Decorative) */}
        <div className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 w-48 space-y-4 opacity-20 pointer-events-none">
          <div className="h-32 bg-primary/10 rounded-3xl animate-float"></div>
          <div className="h-48 bg-secondary/10 rounded-3xl ml-12"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest mb-8 animate-fade-in">
              <span className="material-symbols-outlined text-sm">bolt</span>
              Nền tảng Giáo dục Thông minh 4.0
            </div>
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter mb-8 leading-[1.1] animate-slide-up">
              Học tập Không giới hạn hướng tới <span className="text-primary italic">Tương lai</span>
            </h1>
            <p className="text-xl text-on-surface-variant mb-12 leading-relaxed max-w-2xl mx-auto font-medium animate-slide-up" style={{ animationDelay: '0.1s' }}>
              ZaloEdu mang đến giải pháp kết nối học viên và giảng viên thông qua hệ thống OTT chuyên nghiệp. 
              An toàn, bảo mật và hiệu quả vượt trội.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <button 
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-10 py-5 signature-gradient text-white rounded-[2rem] font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-primary/30 active:scale-95 flex items-center justify-center gap-3 inner-glow"
              >
                <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                Sử dụng ngay
              </button>
              <button 
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-10 py-5 bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded-[2rem] font-black text-lg hover:bg-surface-container-low transition-all active:scale-95 shadow-xl shadow-black/5"
              >
                Khám phá thêm
              </button>
            </div>
            
            {/* Stats Badges */}
            <div className="mt-24 grid grid-cols-2 lg:grid-cols-4 gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl">verified_user</span>
                <span className="text-xs font-black uppercase tracking-tighter">Bảo mật AES-256</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl">sync</span>
                <span className="text-xs font-black uppercase tracking-tighter">Real-time Sync</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
                <span className="text-xs font-black uppercase tracking-tighter">QR Authentication</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-3xl">group</span>
                <span className="text-xs font-black uppercase tracking-tighter">100k+ Học viên</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section id="features" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tighter text-on-surface mb-4">Tại sao chọn ZaloEdu?</h2>
            <div className="w-16 h-1 bg-primary mx-auto rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Đăng nhập Một chạm',
                desc: 'Xác thực nhanh chóng bằng mã QR từ điện thoại, loại bỏ gánh nặng ghi nhớ mật khẩu phức tạp.',
                icon: 'qr_code_2',
                color: 'text-primary',
                bg: 'bg-primary/5'
              },
              {
                title: 'Kết nối Tức thì',
                desc: 'Hệ thống Chat Socket.io mạnh mẽ giúp tương tác thời gian thực giữa giảng viên và học viên.',
                icon: 'forum',
                color: 'text-secondary',
                bg: 'bg-secondary/5'
              },
              {
                title: 'Trải Nghiệm Đa Luồng',
                desc: 'Đồng bộ hóa hoàn hảo trên mọi thiết bị. Học mọi lúc, mọi nơi với bảo mật đa tầng.',
                icon: 'devices',
                color: 'text-tertiary',
                bg: 'bg-tertiary/5'
              }
            ].map((feature, i) => (
              <div key={i} className="group p-10 rounded-[2.5rem] bg-surface-container-lowest border border-outline-variant/10 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500">
                <div className={`w-16 h-16 ${feature.bg} ${feature.color} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500`}>
                  <span className="material-symbols-outlined text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-on-surface-variant font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 mb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="signature-gradient rounded-[3rem] p-12 lg:p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-primary/40">
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-4xl lg:text-5xl font-black tracking-tighter mb-6">Sẵn sàng để bắt đầu?</h2>
              <p className="text-white/80 text-lg font-bold mb-10 max-w-xl mx-auto">Gia nhập cộng đồng ZaloEdu ngay hôm nay và trải nghiệm môi trường học tập hiện đại nhất.</p>
              <button 
                onClick={() => navigate('/register')}
                className="px-12 py-5 bg-white text-primary rounded-[2rem] font-black text-xl hover:scale-105 transition-all shadow-xl active:scale-95"
              >
                Đăng ký Miễn phí
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-outline-variant/10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 signature-gradient rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm">school</span>
             </div>
             <span className="font-black tracking-tighter text-primary">ZaloEdu</span>
          </div>
          <p className="text-on-surface-variant text-sm font-bold opacity-50">
            © 2026 ZaloEdu System. Built with NestJS & React.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-on-surface-variant hover:text-primary text-sm font-bold transition-colors">Bảo mật</a>
            <a href="#" className="text-on-surface-variant hover:text-primary text-sm font-bold transition-colors">Điều khoản</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
