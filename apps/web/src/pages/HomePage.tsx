import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, 
  MessageCircle, 
  User as UserIcon, 
  Settings, 
  Search, 
  Bell,
  LayoutDashboard,
  BookOpen
} from 'lucide-react';

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50 font-['Inter'] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 md:w-64 bg-white border-r border-slate-200 flex flex-col items-center md:items-stretch py-8 px-4 transition-all duration-300">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/30">Z</div>
          <span className="text-xl font-black text-slate-800 hidden md:block tracking-tighter">ZaloEdu</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Bảng điều khiển" active />
          <NavItem icon={<MessageCircle size={20} />} label="Tin nhắn" />
          <NavItem icon={<BookOpen size={20} />} label="Khóa học" />
          <NavItem icon={<UserIcon size={20} />} label="Hồ sơ" />
          <NavItem icon={<Settings size={20} />} label="Cài đặt" />
        </nav>

        <button 
          onClick={logout}
          className="mt-auto flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="hidden md:block">Đăng xuất</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="relative w-96 hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm khóa học, tài liệu..." 
              className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 focus:ring-2 focus:ring-primary/20 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-none">{user?.fullname}</p>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Học viên</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center text-slate-400">
                 <UserIcon size={24} />
              </div>
            </div>
          </div>
        </header>

        {/* Welcome Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-gradient-mesh">
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="glass-effect p-8 rounded-[2rem] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
              <div className="relative z-10 flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black text-slate-800 mb-2">Chào mừng trở lại, {user?.fullname}! 👋</h2>
                <p className="text-slate-600">Hôm nay bạn muốn học thêm điều gì mới không? Hệ thống đã sẵn sàng 24/7 để hỗ trợ bạn.</p>
                <button className="mt-6 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">
                  Khám phá ngay
                </button>
              </div>
              <div className="w-48 h-48 bg-primary/10 rounded-full flex items-center justify-center animate-float">
                 <BookOpen size={80} className="text-primary opacity-40" />
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StatCard label="Khóa học đang học" value="12" color="bg-blue-500" />
              <StatCard label="Bài tập hoàn thành" value="48" color="bg-green-500" />
              <StatCard label="Điểm trung bình" value="8.5" color="bg-orange-500" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, active = false }: { icon: any, label: string, active?: boolean }) => (
  <button className={`w-full flex items-center gap-4 p-3 rounded-2xl font-bold transition-all ${
    active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-100'
  }`}>
    {icon}
    <span className="hidden md:block">{label}</span>
  </button>
);

const StatCard = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className={`w-2 h-8 ${color} rounded-full mb-4`}></div>
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
  </div>
);

export default HomePage;
