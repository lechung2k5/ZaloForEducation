import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Alert from '../utils/Alert';
import SocketService from '../utils/socket';
import { getDeviceId } from '../utils/deviceId';
import { apiRequest } from '../utils/api'; // Đảm bảo đúng đường dẫn đến file api.js của sếp

const AuthContext = createContext();

export const AuthProvider = ({ children, onForceLogoutNavigate }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const [profileVersion, setProfileVersion] = useState(Date.now());

  // --- GLOBAL REGISTRATION (EARLY) ---
  const isKickingRef = useRef(false);

  // Sếp yêu cầu: Hàm Heartbeat để quét phiên (API nhẹ nhất) - Dùng Try/Catch chuẩn Senior
  const checkSessionStatus = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    try {
      console.log('[AUTH] Heartbeat check (polling) via /auth/sessions...');
      await apiRequest('/auth/sessions');
      // Nếu API thành công -> Phiên vẫn ổn
    } catch (err) {
      if (err.message === 'SESSION_INVALIDATED') {
        console.warn('[AUTH] Session invalidated detected during Heartbeat.');
        handleForceLogout();
      } else {
        console.error('[AUTH] Heartbeat check failed:', err.message);
      }
    }
  };

  const handleForceLogout = (data = {}) => {
    console.log('🔥 [AUTH] handleForceLogout CALLED with data:', data);
    if (isKickingRef.current) {
        console.log('[AUTH] Kick-out already in progress, skipping duplicate call.');
        return;
    }
    isKickingRef.current = true;

    const message = data.message || 'Phiên đăng nhập đã hết hạn hoặc bị thay thế bởi thiết bị khác.';
    const time = data.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    console.warn(`🚨 [AUTH] EXECUTING IMMEDIATE FORCE LOGOUT at ${time}`);

    // QUY TẮC CỨNG: 1. Xóa sạch Storage NGAY LẬP TỨC
    const triggerLogout = async () => {
      try {
        await AsyncStorage.multiRemove(['token', 'user']);
        console.log('[AUTH] Storage cleared (token, user). deviceId retained.');
      } catch (err) {
        console.error('[AUTH] Storage cleanup error:', err);
      } finally {
        // 2. Xóa State để kích hoạt Re-render
        setUser(null);
        setToken(null);
        // deviceId retained
        SocketService.disconnect();

        // 3. Cưỡng chế điều hướng ngay lập tức (Không đợi Alert)
        console.log('[AUTH] Triggering immediate navigation reset to login.');
        if (onForceLogoutNavigate) onForceLogoutNavigate('login');

        // 4. Hiện thông báo (Người dùng sẽ thấy Alert trên nền màn hình Login)
        Alert.alert(
          'Phiên đăng nhập hết hạn',
          `${message}\n\nLúc: ${time}`,
          [{ 
            text: 'Tôi đã hiểu', 
            onPress: () => { isKickingRef.current = false; }
          }],
          { cancelable: false }
        );
      }
    };

    triggerLogout();
  };

  // Expose to global
  if (typeof global !== 'undefined') {
    global.handleForceLogout = handleForceLogout;
  }

  const handleForceLogoutRef = useRef(handleForceLogout);
  useEffect(() => {
    handleForceLogoutRef.current = handleForceLogout;
  }, [handleForceLogout]);

  // Sếp yêu cầu: LOOP POLLING (Vòng lặp vây bắt 10s)
  useEffect(() => {
    if (user && token) {
      const interval = setInterval(() => {
        checkSessionStatus();
      }, 10000); // 10 giây một lần quét

      return () => clearInterval(interval);
    }
  }, [user, token]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user');
        const savedToken = await AsyncStorage.getItem('token');
        const savedDeviceId = await AsyncStorage.getItem('deviceId');

        if (savedDeviceId) setDeviceId(savedDeviceId);

        if (savedUser && savedToken) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setToken(savedToken);

          const currentDeviceId = savedDeviceId || await getDeviceId();
          SocketService.connect(parsedUser.email, currentDeviceId);

          // Socket Status Listeners
          SocketService.on('connect', () => {
            console.log('🟢 [SOCKET] Connected successfully');
          });

          SocketService.on('disconnect', () => {
            console.warn('🟡 [SOCKET] Disconnected');
          });

          // Sếp yêu cầu: "Check-in" ngay khi mở app bằng API /auth/sessions
          try {
            console.log('[AUTH] Startup check-in via /auth/sessions...');
            await apiRequest('/auth/sessions');
            console.log('[AUTH] Startup check-in success. Session active.');
          } catch (err) {
            if (err.message === 'SESSION_INVALIDATED') {
              console.warn('[AUTH] Startup check-in: Session officially invalidated.');
              handleForceLogout();
              return;
            }
            console.error('[AUTH] Startup check-in check failed:', err.message);
          }

          // Listening for real-time kickout
          SocketService.on('force_logout', (data) => {
            console.log('🔥 [SOCKET] force_logout EVENT RECEIVED:', data);
            
            if (handleForceLogoutRef.current) {
              const currentDeviceIdRef = savedDeviceId || deviceId; // Ưu tiên ID từ storage
              
              const shouldLogout =
                data?.all === true ||
                (data?.targetDeviceId && data.targetDeviceId === currentDeviceIdRef) ||
                (data?.reason === 'SESSION_INVALIDATED');

              if (shouldLogout) {
                console.log('✅ [SOCKET] Target device matched. Initiating force logout...');
                handleForceLogoutRef.current(data);
              } else {
                console.log('ℹ️ [SOCKET] force_logout ignored — not targeting this device', {
                  target: data?.targetDeviceId,
                  current: currentDeviceIdRef
                });
              }
            }
          });

          // Listening for profile updates
          SocketService.on('profile_update', (data) => {
            if (data && data.profile) {
              updateUser(data.profile);
            }
          });
        }
      } catch (e) {
        console.error('[AUTH_CONTEXT] Error loading session:', e);
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    // Sếp yêu cầu: Cài đặt "Trạm gác" AppState (Check-on-Focus)
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        checkSessionStatus();
      }
    };

    const subscription = require('react-native').AppState.addEventListener('change', handleAppStateChange);

    return () => {
      SocketService.off('force_logout');
      subscription.remove();
    };
  }, []);

  const login = async (userData, accessToken, currentDeviceId) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    await AsyncStorage.setItem('token', accessToken);
    await AsyncStorage.setItem('deviceId', currentDeviceId);
    setUser(userData);
    setToken(accessToken);
    setDeviceId(currentDeviceId);
    setProfileVersion(Date.now());
    SocketService.connect(userData.email, currentDeviceId);
  };

  const logout = async () => {
    try {
      // Gọi API logout lên backend để lưu lịch sử
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ deviceId })
      });
    } catch (e) {
      console.warn('[AUTH] Backend logout failed or already sessions invalidated', e);
    } finally {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // deviceId NOT removed to preserve trusted status
      setUser(null);
      setToken(null);
      SocketService.disconnect();
    }
  };

  const updateUser = async (userData) => {
    if (!userData) return;

    // Use functional update to ensure we have the absolute latest state
    setUser(prevUser => {
      const merged = { ...(prevUser || {}), ...userData };
      // Save merged state to storage asynchronously
      AsyncStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });

    // Bump version to force re-renders and cache-busting
    setProfileVersion(Date.now());
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, profileVersion, handleForceLogout, deviceId, checkSessionStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
