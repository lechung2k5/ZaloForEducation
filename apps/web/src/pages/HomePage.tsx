import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';
import ProfileModal from '../components/ProfileModal';

const HomePage: React.FC = () => {
  const { user, logout, socket, refreshUser } = useAuth();
  
  // STATE MANAGEMENT giống cấu trúc Zalo
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'notifications' | 'cloud'>('chat');
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Profile & Settings state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FETCH CONVERSATIONS ON LOAD
  useEffect(() => {
    if (!user) return;
    
    // Refresh user metadata to get latest avatarUrl/fullName
    refreshUser();

    const fetchConversations = async () => {
      try {
        // Fetch inbox / group matches for this user
        const res = await api.get('/chat/conversations');
        setConversations(res.data);
      } catch (err) {
        console.error('Error fetching conversations:', err);
      }
    };
    fetchConversations();
  }, [user]);

  // SOCKET: RECEIVE MESSAGES REAL-TIME
  useEffect(() => {
    if (!socket) return;
    
    const handleReceiveMessage = (msg: any) => {
      // Append if we are viewing this chat right now
      if (selectedChat?.id === msg.conversationId) {
        setMessages(prev => [...prev, msg]);
      }
      
      // Update lastMessage in the left sidebar
      setConversations(prev => prev.map(conv => 
        conv.id === msg.conversationId 
          ? { ...conv, lastMessage: msg.content, updatedAt: new Date().toISOString() }
          : conv
      ));
    };

    socket.on('receiveMessage', handleReceiveMessage);
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, selectedChat]);

  // AUTO-SCROLL TO BOTTOM OF CHAT
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // SWITCH CHAT: FETCH MESSAGES & JOIN ROOM
  const handleSelectChat = async (chat: any) => {
    setSelectedChat(chat);
    if (!chat) return;

    // Join Socket Room
    if (socket) {
      socket.emit('join_room', { convId: chat.id });
    }

    try {
      const res = await api.get(`/chat/conversations/${encodeURIComponent(chat.id)}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  // SEND A TEXT MESSAGE
  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedChat) return;
    try {
      await api.post(`/chat/conversations/${encodeURIComponent(selectedChat.id)}/messages`, {
        content: inputText
      });
      // Emitting through API which will broadcast via Gateway
      // Let the socket handleReceiveMessage append it to our local state
      setInputText('');
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  // Render Sidebar
  const renderNavButton = (id: typeof activeTab, icon: string, hasBadge: boolean = false) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`rounded-2xl transition-all duration-300 p-3 scale-95 flex items-center justify-center relative ${
          isActive 
            ? 'bg-white/20 backdrop-blur-md text-white active:scale-90' 
            : 'text-white/60 hover:text-white hover:bg-white/10 active:scale-90'
        }`}
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
        {hasBadge && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-[#00418f]"></span>
        )}
      </button>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-on-surface antialiased font-['Plus_Jakarta_Sans']">
      
      {/* COLUMN 1: SideNavBar (80px wide) */}
      <aside className="fixed left-0 top-0 h-full z-50 w-20 flex flex-col items-center py-6 bg-gradient-to-br from-[#0058bc] to-[#00418f] shadow-[0px_20px_40px_rgba(0,65,143,0.06)] shrink-0">
        {/* Top Avatar Area */}
        <div className="mb-8">
          <img 
            alt="User Avatar" 
            onClick={() => setIsProfileModalOpen(true)}
            className="w-12 h-12 rounded-full border-2 border-white/20 p-0.5 object-cover bg-white/10 cursor-pointer hover:border-white transition-colors" 
            src={user?.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuCFw8hQBOq4JKJazc3GAIcVjmlrrfkICsk9jcBPauM53xp43QRLa6DqnEMow0-o1mRGziDfptfm02FgIlDbYltgzrSJtsP-_9ZmmuU5a1HL7JGFMujo8aASzX0ctHu6vqLGHtPPfgD52k6jx6G96Ll7O72OmXDkjh4_ow9-Pm7zokfO_INwwFExRPgQJIjpqmh5hidvLzAXnfEYTg61gAUYlTRiSMH5ZUorMbj1-J4SuqKTeDZetL9hIls8Yq8wumlUwCODZQaS6A"} 
          />
        </div>

        {/* Middle Navigation area */}
        <nav className="flex flex-col gap-4 flex-1">
          {renderNavButton('chat', 'chat')}
          {renderNavButton('contacts', 'group')}
          {renderNavButton('notifications', 'notifications', true)}
          {renderNavButton('cloud', 'cloud')}
        </nav>

        {/* Bottom Settings & Logout area */}
        <div className="mt-auto space-y-4">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 p-3 scale-95 active:scale-90 flex items-center justify-center font-medium" 
            title='Thông tin cá nhân'
          >
            <span className="material-symbols-outlined">person</span>
          </button>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`rounded-2xl transition-all duration-300 p-3 scale-95 flex items-center justify-center relative ${
                isDropdownOpen ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white hover:bg-white/10 active:scale-90'
              }`}
              title='Cài đặt'
            >
              <span className="material-symbols-outlined">settings</span>
            </button>

            {/* Dropdown Menu - ĐỒNG BỘ ZALO UI (Phía trên Bánh răng) */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-3 w-64 bg-white rounded-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.15)] z-[100] border border-outline-variant/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Account Name Header */}
                <div className="px-5 py-4 border-b border-outline-variant/5 bg-surface-container-lowest/50">
                  <p className="font-extrabold text-[16px] text-on-surface truncate">{user?.fullName || user?.fullname || 'Người dùng'}</p>
                </div>
                
                <div className="py-1">
                  <button 
                    onClick={() => { setIsProfileModalOpen(true); setIsDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-semibold text-sm text-left group"
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">account_circle</span>
                    Thông tin tài khoản
                  </button>
                  <Link 
                    to="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-semibold text-sm text-left group"
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">settings</span>
                    Cài đặt
                  </Link>
                </div>

                <div className="border-t border-outline-variant/5 py-1">
                  <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-semibold text-sm group">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">database</span>
                      Dữ liệu
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </button>
                  <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-semibold text-sm group">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">language</span>
                      Ngôn ngữ
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </button>
                  <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-semibold text-sm group">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary transition-colors">support_agent</span>
                      Hỗ trợ
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                  </button>
                </div>
                
                <div className="border-t border-outline-variant/5 py-1 mb-1">
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container transition-colors text-error font-bold text-sm text-left"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Đăng xuất
                  </button>
                  <button 
                    onClick={() => setIsDropdownOpen(false)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-surface-container transition-colors text-on-surface font-bold text-sm text-left"
                  >
                    <span className="material-symbols-outlined text-[20px]">power_settings_new</span>
                    Thoát
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} className="text-white/80 hover:text-error hover:bg-white/10 rounded-2xl transition-all duration-300 p-3 scale-95 active:scale-90 flex items-center justify-center" title='Đăng xuất'>
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </aside>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />

      {/* COLUMN 2: List Panel (320px) */}
      <section className="ml-20 w-[320px] bg-white bg-surface-container-lowest h-full flex flex-col z-10 border-r border-outline-variant/20 shrink-0">
        {/* Search Header */}
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input 
                className="w-full bg-surface-container-highest border-none rounded-[16px] py-2 pl-[34px] pr-4 text-[13px] focus:ring-2 focus:ring-primary/40 transition-all outline-none text-on-surface placeholder:text-outline" 
                placeholder="Tìm kiếm" 
                type="text"
              />
            </div>
            <button className="p-2 hover:bg-surface-container rounded-xl transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant focus-within:text-primary text-[20px]">person_add</span>
            </button>
            <button className="p-2 hover:bg-surface-container rounded-xl transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant focus-within:text-primary text-[20px]">group_add</span>
            </button>
          </div>
          
          {/* Sub Navigation */}
          {activeTab === 'chat' && (
            <div className="flex items-center gap-4 text-sm font-semibold px-1">
              <button className="text-primary border-b-2 border-primary pb-1">Tất cả</button>
              <button className="text-on-surface-variant hover:text-primary transition-colors pb-1">Chưa đọc</button>
            </div>
          )}
          {activeTab === 'contacts' && (
            <div className="flex items-center gap-4 text-sm font-semibold px-1">
              <button className="text-primary border-b-2 border-primary pb-1">Bạn bè</button>
              <button className="text-on-surface-variant hover:text-primary transition-colors pb-1">Nhóm</button>
            </div>
          )}
        </div>

        {/* Dynamic List Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-4 px-2 space-y-1">
          {activeTab === 'chat' ? (
            conversations.length === 0 ? (
              <div className="text-center p-8 opacity-50 mt-10">
                <p className="font-medium text-[13px] text-on-surface">Chưa có cuộc trò chuyện nào</p>
              </div>
            ) : (
              conversations.map((chat) => {
                const isSelected = selectedChat?.id === chat.id;
                // Nếu là direct chat thì avatar/name sẽ lôi từ partner mapping (tạm dùng tên mặc định nếu thiếu)
                const chatName = chat.name || chat.partner || chat.id.substring(0,6);
                return (
                  <div 
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`flex items-center gap-3 p-3 rounded-[16px] cursor-pointer transition-all ${
                      isSelected ? 'bg-secondary-container/50 shadow-[0_4px_12px_rgba(0,0,0,0.02)]' : 'hover:bg-surface-container/70'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img className="w-12 h-12 rounded-full object-cover shadow-sm bg-surface-container" alt={chatName} src={chat.avatar || 'https://fptupload.s3.ap-southeast-1.amazonaws.com/Zalo_Edu_Logo_2e176b6b7f.png'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`font-bold text-[14px] truncate ${isSelected ? 'text-on-secondary-container' : 'text-on-surface'}`}>{chatName}</h3>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1 overflow-hidden">
                          <p className={`text-[13px] truncate text-on-surface-variant`}>{chat.lastMessage || 'Chưa có tin nhắn'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50 mt-10">
              <span className="material-symbols-outlined text-6xl mb-4 text-outline">construction</span>
              <p className="font-bold text-on-surface">Tính năng đang phát triển</p>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Area (Column 3 & 4 OR Welcome Screen) */}
      {!selectedChat ? (
        // WELCOME SCREEN (Empty State)
        <main className="flex-1 bg-[#f7f9fb] flex flex-col items-center justify-center relative shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
           <img 
              src="https://fptupload.s3.ap-southeast-1.amazonaws.com/Zalo_Edu_Logo_2e176b6b7f.png"
              alt="Welcome"
              className="w-48 h-auto mb-8 animate-float opacity-80 mix-blend-multiply"
              onError={(e) => {
                // Fallback to huge icon if logo fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
           />
           <span className="material-symbols-outlined text-primary text-[120px] mb-8 hidden" style={{ fontVariationSettings: "'wght' 200" }}>forum</span>
           <h2 className="text-2xl font-extrabold text-on-surface mb-3 tracking-tight">Chào mừng đến với ZaloEdu</h2>
           <p className="text-on-surface-variant font-medium max-w-md text-center leading-relaxed">
             Khám phá tiện ích hỗ trợ làm việc và học tập, kết nối với giảng viên và sinh viên một cách dễ dàng.
           </p>
           {user?.fullname && (
             <div className="mt-8 px-6 py-3 bg-white rounded-full shadow-sm border border-outline-variant/20 inline-flex items-center gap-3">
               <span className="text-sm font-semibold text-on-surface">Đang đăng nhập dưới tên:</span>
               <span className="text-primary font-extrabold">{user.fullname}</span>
             </div>
           )}
        </main>
      ) : (
        // ACTIVE CHAT SCREEN
        <>
          {/* COLUMN 3: Main Chat Window */}
          <main className="flex-1 flex flex-col bg-[#f7f9fb] overflow-hidden relative shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
            {/* Chat Header */}
            <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-outline-variant/15 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <img 
                  className="w-10 h-10 rounded-full object-cover bg-surface-container" 
                  alt="Avatar" 
                  src={selectedChat.avatar}
                />
                <div>
                  <h2 className="font-bold text-on-surface leading-tight text-[15px]">{selectedChat.name}</h2>
                  <div className="flex items-center gap-1 text-[12px] text-on-surface-variant font-medium">
                    {selectedChat.type === 'group' ? (
                      <>
                        <span className="material-symbols-outlined text-[13px]">group</span>
                        <span>11 thành viên • <span className="text-green-600">3 đang hoạt động</span></span>
                      </>
                    ) : (
                      <>
                        <span className={`w-2 h-2 rounded-full ${selectedChat.online ? 'bg-green-500' : 'bg-outline-variant'}`}></span>
                        <span>{selectedChat.online ? 'Đang hoạt động' : 'Truy cập 2 giờ trước'}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"><span className="material-symbols-outlined">search</span></button>
                <button className="p-2 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"><span className="material-symbols-outlined">videocam</span></button>
                <button className="p-2 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"><span className="material-symbols-outlined">call</span></button>
                <button className="p-2 hover:bg-surface-container rounded-full transition-all text-on-surface-variant"><span className="material-symbols-outlined">dock_to_left</span></button>
              </div>
            </header>

            {/* Pinned Message Strip (Only for Groups as demo) */}
            {selectedChat.type === 'group' && (
              <div className="px-6 py-2.5 bg-white/50 backdrop-blur-md flex items-center gap-3 border-b border-outline-variant/10 shrink-0 cursor-pointer hover:bg-white/80 transition-colors">
                <span className="material-symbols-outlined text-primary text-[18px]">push_pin</span>
                <div className="flex-1 text-[13px] truncate">
                  <span className="font-bold text-primary mr-2">Tin nhắn ghim:</span>Deadline nộp báo cáo cuối kỳ vào ngày 25/12. Mọi người chú ý!
                </div>
                <button className="material-symbols-outlined text-on-surface-variant text-[18px]">keyboard_arrow_down</button>
              </div>
            )}

            {/* Chat Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar flex flex-col">
              <div className="flex justify-center my-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/80 bg-surface-container-high/50 px-4 py-1.5 rounded-full">Lịch sử trò chuyện</span>
              </div>

              {messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-on-surface-variant">Trò chuyện này chưa có tin nhắn nào. Bắt đầu ngay!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMe = message.senderId === user?.email;
                  
                  if (isMe) {
                    return (
                      <div key={message.id} className="flex items-end justify-end gap-3 mt-auto group">
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-surface-container rounded-full transition-all text-on-surface-variant mb-4"><span className="material-symbols-outlined text-[18px]">more_vert</span></button>
                        <div className="max-w-[75%]">
                          <div className="bg-primary-container text-on-primary-container rounded-[20px] rounded-tr-none p-4 shadow-sm shadow-primary/10">
                            <p className="text-[15px] leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={message.id} className="flex items-start gap-3 max-w-[80%] group">
                        <img 
                          className="w-9 h-9 rounded-full mt-1 object-cover bg-surface-container" 
                          alt="Avatar" 
                          src="https://fptupload.s3.ap-southeast-1.amazonaws.com/Zalo_Edu_Logo_2e176b6b7f.png"
                        />
                        <div>
                          {selectedChat.type === 'group' && <span className="text-[12px] font-bold ml-1 mb-1 block text-on-surface-variant">{message.senderId}</span>}
                          <div className="bg-white rounded-[20px] rounded-tl-none p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-outline-variant/10">
                            <p className="text-[15px] leading-relaxed text-on-surface">{message.content}</p>
                          </div>
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-surface-container rounded-full transition-all self-center text-on-surface-variant"><span className="material-symbols-outlined text-[18px]">more_vert</span></button>
                      </div>
                    );
                  }
                })
              )}
              {/* Invisible element to force scroll to bottom */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <footer className="bg-white/80 backdrop-blur-xl border-t border-outline-variant/20 px-6 py-4 shrink-0">
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <button className="p-2 hover:bg-surface-container rounded-xl transition-all text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[22px]">mood</span></button>
                <button className="p-2 hover:bg-surface-container rounded-xl transition-all text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[22px]">image</span></button>
                <button className="p-2 hover:bg-surface-container rounded-xl transition-all text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[22px]">attach_file</span></button>
                <button className="p-2 hover:bg-surface-container rounded-xl transition-all text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined text-[22px]">alternate_email</span></button>
              </div>
              <div className="flex items-end gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] p-2 pr-2.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all shadow-sm">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] resize-none py-3 px-4 hide-scrollbar pt-3.5 outline-none text-on-surface placeholder:text-outline" 
                  placeholder={`Nhập tin nhắn tới ${selectedChat.name || 'bạn'}...`} 
                  rows={1}
                ></textarea>
                <button 
                  onClick={handleSendMessage}
                  className="bg-primary text-white w-12 h-12 rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shrink-0 mb-[2px]">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </div>
            </footer>
          </main>

          {/* COLUMN 4: Group Info Sidebar (320px) */}
          <aside className="w-[320px] bg-surface border-l border-outline-variant/20 flex flex-col h-full z-40 hidden lg:flex font-['Plus_Jakarta_Sans'] text-sm shrink-0">
            <div className="p-8 text-center border-b border-outline-variant/10 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] z-10 shrink-0">
              <h2 className="text-on-surface font-extrabold text-[16px] mb-6 tracking-tight">Thông tin hội thoại</h2>
              <img 
                className="w-24 h-24 rounded-full mx-auto shadow-xl shadow-primary/10 mb-5 object-cover ring-4 ring-white" 
                alt="Avatar" 
                src={selectedChat.avatar}
              />
              <h3 className="font-extrabold text-primary text-[18px] px-2">{selectedChat.name}</h3>
              {selectedChat.type === 'group' && <p className="text-on-surface-variant mt-1 font-medium text-sm tracking-wide">Khoa Công nghệ thông tin</p>}
              
              <div className="flex justify-center gap-6 mt-8">
                <div className="flex flex-col items-center gap-2 cursor-pointer text-on-surface-variant hover:text-primary transition-all group">
                  <div className="w-11 h-11 rounded-full bg-surface-container-highest group-hover:bg-primary/10 flex items-center justify-center shadow-sm transition-colors text-on-surface group-hover:text-primary"><span className="material-symbols-outlined text-[20px]">notifications_off</span></div>
                  <span className="text-[11px] font-bold">Tắt Tbáo</span>
                </div>
                <div 
                  onClick={() => {/* logic ghim */}}
                  className="flex flex-col items-center gap-2 cursor-pointer text-on-surface-variant hover:text-primary transition-all group"
                >
                  <div className="w-11 h-11 rounded-full bg-surface-container-highest group-hover:bg-primary/10 flex items-center justify-center shadow-sm transition-colors text-on-surface group-hover:text-primary"><span className="material-symbols-outlined text-[20px]">push_pin</span></div>
                  <span className="text-[11px] font-bold">Ghim hội thoại</span>
                </div>
                <div 
                  onClick={() => {/* logic thêm TV */}}
                  className="flex flex-col items-center gap-2 cursor-pointer text-on-surface-variant hover:text-primary transition-all group"
                >
                  <div className="w-11 h-11 rounded-full bg-surface-container-highest group-hover:bg-primary/10 flex items-center justify-center shadow-sm transition-colors text-on-surface group-hover:text-primary"><span className="material-symbols-outlined text-[20px]">person_add</span></div>
                  <span className="text-[11px] font-bold">Thêm TV</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto hide-scrollbar bg-[#f7f9fb]">
              {selectedChat.type === 'group' && (
                <section className="bg-white rounded-[24px] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-extrabold text-on-surface text-[15px]">Thành viên (11)</span>
                    <button className="material-symbols-outlined text-outline hover:text-primary transition-colors cursor-pointer text-[20px] bg-surface-container hover:bg-primary/10 p-1 rounded-full">expand_more</button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 hover:bg-surface-container p-2 -mx-2 rounded-xl transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-full bg-primary-container text-primary font-bold flex flex-col items-center justify-center">{user?.fullname?.charAt(0) || 'B'}</div>
                      <div className="flex-1">
                        <span className="font-bold text-on-surface text-[14px] group-hover:text-primary block leading-tight">{user?.fullname || 'Bạn'} <span className="text-on-surface-variant font-medium">(Trưởng nhóm)</span></span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="bg-white rounded-[24px] p-5 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-extrabold text-on-surface text-[15px]">Tài liệu & Files</span>
                  <button className="material-symbols-outlined text-outline hover:text-primary transition-colors cursor-pointer text-[20px] bg-surface-container hover:bg-primary/10 p-1 rounded-full">expand_more</button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 hover:bg-surface-container p-2 -mx-2 rounded-xl transition-all cursor-pointer group">
                    <div className="w-11 h-11 rounded-[14px] bg-[#fff0f0] flex items-center justify-center text-red-500 shadow-sm"><span className="material-symbols-outlined text-[20px]">picture_as_pdf</span></div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-on-surface text-[13px] truncate group-hover:text-primary">Quy_dinh_nhom.pdf</p>
                      <span className="text-[11px] font-medium text-on-surface-variant tracking-wide block mt-0.5">2.1 MB • Hôm qua</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default HomePage;
