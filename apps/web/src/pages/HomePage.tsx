import React from 'react';
import { useAuth } from '../context/AuthContext';

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-surface text-on-surface font-['Plus_Jakarta_Sans'] overflow-hidden selection:bg-secondary-container relative">
      {/* Absolute Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-secondary-container/20 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Sidebar - Ethereal Academy Style */}
      <aside className="w-20 md:w-72 bg-surface-container-low/50 backdrop-blur-3xl border-r border-outline-variant/15 flex flex-col items-center md:items-stretch py-8 px-4 md:px-6 transition-all duration-300 z-10">
        <div className="flex items-center gap-4 px-2 mb-12">
          <div className="w-12 h-12 signature-gradient rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 shrink-0">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <span className="text-2xl font-extrabold text-primary hidden md:block tracking-tighter">ZaloEdu</span>
        </div>

        <nav className="flex-1 space-y-3 mt-4">
          <NavItem icon="dashboard" label="Bảng điều khiển" active />
          <NavItem icon="chat" label="Tin nhắn" />
          <NavItem icon="menu_book" label="Khóa học" />
          <NavItem icon="person" label="Hồ sơ" />
          <NavItem icon="settings" label="Cài đặt" />
        </nav>

        <button 
          onClick={logout}
          className="mt-auto flex items-center gap-4 p-4 text-error hover:bg-error-container/50 rounded-2xl transition-all font-bold group"
        >
          <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">logout</span>
          <span className="hidden md:block">Đăng xuất</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent z-10 relative">
        {/* Header Ethereal Glass */}
        <header className="h-24 px-8 shrink-0 flex items-center justify-between z-20">
          <div className="relative w-[400px] hidden lg:block group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input 
              type="text" 
              placeholder="Tìm kiếm khóa học, tài liệu..." 
              className="w-full bg-surface-container-highest/60 border-none rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-primary/30 focus:bg-surface-container-lowest text-on-surface placeholder:text-outline transition-all duration-300 backdrop-blur-sm"
            />
          </div>
          
          <div className="flex items-center gap-6 ml-auto">
            <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-surface-container-highest/50 hover:bg-surface-container hover:text-primary text-on-surface-variant transition-all relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface"></span>
            </button>
            <div className="flex items-center gap-4 pl-6 border-l border-outline-variant/20 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface leading-none group-hover:text-primary transition-colors">{user?.fullname || 'Học viên'}</p>
                <p className="text-xs text-on-surface-variant mt-1 font-bold tracking-wider">HỌC VIÊN</p>
              </div>
              <div className="w-12 h-12 signature-gradient rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 relative overflow-hidden">
                <span className="material-symbols-outlined text-xl">person</span>
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Canvas */}
        <div className="flex-1 overflow-y-auto px-8 pb-12 pt-4 hide-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-10 animate-slide-up">
            
            {/* Hero Welcome Glass Card */}
            <div className="academic-glass rounded-[2rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 shadow-[0px_20px_40px_rgba(0,65,143,0.06)] ring-1 ring-white/30 relative overflow-hidden">
              <div className="relative z-10 flex-1 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-full mb-6 uppercase tracking-widest">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  Học kì mới
                </div>
                <h2 className="text-4xl font-extrabold text-on-surface mb-4 tracking-tight">Chào mừng trở lại,<br /><span className="text-primary">{user?.fullname || 'Minh Thư'}</span>! 👋</h2>
                <p className="text-on-surface-variant text-lg font-medium leading-relaxed mb-8">Hôm nay bạn muốn học thêm điều gì mới không? Hệ thống đã chuẩn bị sẵn sàng lộ trình học cá nhân hóa cho bạn.</p>
                <button className="signature-gradient text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 active:scale-95 transition-all flex items-center gap-2 group inner-glow">
                  Khám phá khóa học
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
              </div>
              <div className="w-64 h-64 bg-primary-container rounded-full flex items-center justify-center animate-float relative shrink-0 shadow-2xl shadow-primary/20">
                 <div className="absolute inset-0 bg-white/20 rounded-full blur-xl mix-blend-overlay"></div>
                 <span className="material-symbols-outlined text-white text-[100px]" style={{ fontVariationSettings: "'wght' 200" }}>auto_stories</span>
              </div>
            </div>

            {/* Quick Stats Grid using "The Layering Principle" without generic borders */}
            <h3 className="text-2xl font-bold text-on-surface tracking-tight ml-2">Tổng quan tiến độ</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard icon="menu_book" label="Khóa học đang học" value="12" />
              <StatCard icon="task_alt" label="Bài tập hoàn thành" value="48" />
              <StatCard icon="workspace_premium" label="Điểm trung bình" value="8.5" />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active = false }: { icon: string, label: string, active?: boolean }) => (
  <button className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 relative overflow-hidden group ${
    active ? 'bg-surface-container-lowest text-primary shadow-[0px_10px_20px_rgba(0,65,143,0.05)]' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
  }`}>
    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full"></div>}
    <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${active ? 'pl-2' : ''}`} style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
    <span className="hidden md:block tracking-tight">{label}</span>
  </button>
);

const StatCard = ({ icon, label, value }: { icon: string, label: string, value: string }) => (
  <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_15px_30px_rgba(0,65,143,0.04)] hover:shadow-[0px_20px_40px_rgba(0,65,143,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden group border border-outline-variant/10">
    <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/5 rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-500"></div>
    <div className="w-12 h-12 rounded-2xl bg-primary-container text-white flex items-center justify-center mb-6 shadow-md shadow-primary/20">
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <p className="text-sm font-bold text-on-surface-variant">{label}</p>
    <p className="text-4xl font-black text-on-surface mt-2 tracking-tight">{value}</p>
  </div>
);

export default HomePage;
