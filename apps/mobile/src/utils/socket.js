import { io } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class SocketService {
  socket = null;
  currentEmail = null;
  listeners = {
    force_logout: [],
    sessions_update: []
  };

  connect(email) {
    if (!email) return;

    // Tránh kết nối lại nếu đã kết nối với cùng email
    if (this.socket && this.socket.connected && this.currentEmail === email) {
      console.log('Using existing socket connection for', email);
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentEmail = email;
    this.socket = io(API_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('Mobile connected/reconnected to socket server');
      // Luôn re-join identity khi reconnect để đảm bảo không bị rơi khỏi room
      if (this.currentEmail) {
        this.socket.emit('join_identity', { email: this.currentEmail });
      }
    });

    this.socket.on('force_logout', (data) => {
      console.log('Force logout event received', data);
      this.listeners.force_logout.forEach(cb => cb(data));
    });

    this.socket.on(`force_logout_${email}`, (data) => {
      console.log('Legacy force logout event received', data);
      this.listeners.force_logout.forEach(cb => cb(data));
    });

    this.socket.on('sessions_update', (data) => {
      console.log('Sessions update event received', data);
      this.listeners.sessions_update.forEach(cb => cb(data));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Mobile disconnected:', reason);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('Mobile reconnected after', attempt, 'attempts');
    });
  }

  // Đăng ký listener (có kiểm tra trùng lặp)
  on(event, callback) {
    if (this.listeners[event]) {
      if (!this.listeners[event].includes(callback)) {
        this.listeners[event].push(callback);
      }
    }
  }

  // Phương thức để gỡ bỏ listener
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentEmail = null;
      // Clear listeners
      this.listeners.force_logout = [];
      this.listeners.sessions_update = [];
    }
  }
}

export default new SocketService();
