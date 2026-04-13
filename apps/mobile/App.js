import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Font from 'expo-font';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileMoreScreen from './src/screens/ProfileMoreScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StatusPickerScreen from './src/screens/StatusPickerScreen';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Alert from './src/utils/Alert';
import SocketService from './src/utils/socket';

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [screen, setScreen] = useState('login');
  const [homeInitialTab, setHomeInitialTab] = useState('messages');
  const [settingsReturnTo, setSettingsReturnTo] = useState('home');
  const [email, setEmail] = useState('');
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          PlusJakartaSans: PlusJakartaSans_400Regular,
          PlusJakartaSans_300Light,
          PlusJakartaSans_500Medium,
          PlusJakartaSans_600SemiBold,
          PlusJakartaSans_700Bold,
          PlusJakartaSans_800ExtraBold,
          'Material Symbols Outlined': require('./assets/fonts/MaterialSymbolsOutlined-Regular.ttf')
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn(e);
        setFontsLoaded(true);
      }
    }
    loadFonts();

    // Check existing session and setup socket
    const checkSession = async () => {
      try {
        const storage = AsyncStorage.default || AsyncStorage;
        const savedUserData = await storage.getItem('user');
        const savedDeviceId = await storage.getItem('deviceId');
        
        if (savedDeviceId) {
          setDeviceId(savedDeviceId);
        }

        if (savedUserData) {
          const user = JSON.parse(savedUserData);
          setEmail(user.email);
          setScreen('home');
          
          SocketService.connect(user.email);
          
          // Đăng ký listener toàn cục duy nhất
          SocketService.on('force_logout', (data) => {
            storage.getItem('deviceId').then(currentId => {
              if (data.targetDeviceId === currentId || data.all) {
                handleForceLogout();
              }
            });
          });
        }
      } catch (err) {
        console.error('Session check error', err);
      }
    };

    checkSession();

    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('token')) {
        setScreen('reset-password');
      }
    }

    return () => SocketService.disconnect();
  }, []);

  const handleLogout = async () => {
    try {
      const storage = AsyncStorage.default || AsyncStorage;
      await storage.removeItem('token');
      await storage.removeItem('user');
      SocketService.disconnect();
      setScreen('login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const handleForceLogout = async () => {
    Alert.alert(
      'Hết hạn phiên đăng nhập', 
      'Tài khoản của bạn vừa đăng nhập từ thiết bị khác. Vui lòng đăng nhập lại.'
    );
    await handleLogout();
  };

  const navigate = (target) => {
    if (target === 'settings') {
      setSettingsReturnTo(screen === 'profile' ? 'profile' : 'home');
      setScreen('settings');
      return;
    }

    if (target === 'home-me') {
      setHomeInitialTab('profile');
      setScreen('home');
      return;
    }

    if (target === 'home') {
      setHomeInitialTab('messages');
    }

    setScreen(target);
    // Sau khi login, setup socket lại nếu cần
    if (target === 'home') {
      const storage = AsyncStorage.default || AsyncStorage;
      storage.getItem('user').then(u => {
        if(u) {
          const user = JSON.parse(u);
          storage.getItem('deviceId').then(id => {
            console.log('[APP] Post-login setup: deviceId =', id);
            if (id) setDeviceId(id);
            
            SocketService.connect(user.email);
            
            // Re-register logout listener (Singleton logic inside SocketService handles deduplication)
            SocketService.on('force_logout', (data) => {
              if (data.targetDeviceId === id || data.all) {
                console.log('[APP] Matches current deviceId! Redir to logout.');
                handleForceLogout();
              } else {
                console.log('[APP] Kick target', data.targetDeviceId, 'does not match current', id);
              }
            });
          });
        }
      });
    }
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#f7f9fb', alignItems: 'center', justifyContent: 'center' }}><Text>Đang tải tài nguyên giao diện...</Text></View>;
  }

  switch (screen) {
    case 'register':
      return <RegisterScreen onNavigate={navigate} />;
    case 'forgot':
      return <ForgotPasswordScreen onNavigate={navigate} />;
    case 'reset-password':
      return <ResetPasswordScreen onNavigate={navigate} />;
    case 'sessions':
      return <SessionsScreen onNavigate={navigate} />;
    case 'settings':
      return <SettingsScreen onNavigate={navigate} returnTo={settingsReturnTo} onLogout={handleLogout} />;
    case 'profile':
      return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} />;
    case 'profile-more':
      return <ProfileMoreScreen onNavigate={navigate} />;
    case 'status-picker':
      return <StatusPickerScreen onNavigate={navigate} />;
    case 'home':
      return <HomeScreen onNavigate={navigate} onLogout={handleLogout} initialTab={homeInitialTab} />;
    case 'login':
    default:
      return <LoginScreen onNavigate={navigate} />;
  }
}
