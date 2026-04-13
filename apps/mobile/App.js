import React, { useState, useEffect } from 'react';
import { Platform, View, Text } from 'react-native';
import * as Font from 'expo-font';
import { 
  PlusJakartaSans_300Light, 
  PlusJakartaSans_400Regular, 
  PlusJakartaSans_500Medium, 
  PlusJakartaSans_600SemiBold, 
  PlusJakartaSans_700Bold, 
  PlusJakartaSans_800ExtraBold 
} from '@expo-google-fonts/plus-jakarta-sans';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionsScreen from './src/screens/SessionsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import StatusPickerScreen from './src/screens/StatusPickerScreen';
import ProfileMoreScreen from './src/screens/ProfileMoreScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Alert from './src/utils/Alert';
import SocketService from './src/utils/socket';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function MainApp({ user, authLoading, screen, setScreen, homeTab, setHomeTab }) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [history, setHistory] = useState([]);

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
  }, []);

  // QUY TẮC CỨNG: "Cảnh sát điều hướng" tối cao
  useEffect(() => {
    if (!authLoading) {
      const authScreens = ['login', 'register', 'forgot', 'reset-password'];
      
      if (user && screen === 'login') {
        // Nếu có user mà lại đang ở Login -> Vào Home ngay
        setScreen('home');
      } else if (!user && !authScreens.includes(screen)) {
        // Nếu MẤT user mà đang ở màn hình nghiệp vụ -> Văng về Login ngay lập tức
        console.warn(`[NAVIGATION_POLICE] Session lost while on screen: ${screen}. Forcing redirect to Login.`);
        setScreen('login');
      }
    }
  }, [user, authLoading, screen]);

  // Handle URL params for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('token')) {
        setScreen('reset-password');
      }
    }
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      SocketService.disconnect();
      setScreen('login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const navigate = (target, tab = 'messages') => {
    const nonStackScreens = ['login', 'register', 'forgot', 'reset-password'];
    if (!nonStackScreens.includes(screen)) {
      setHistory(prev => [...prev, { screen, tab: homeTab }]);
    } else {
      setHistory([]); 
    }

    if (target === 'home') {
      setHomeTab(tab);
    }
    setScreen(target);
  };

  const goBack = () => {
    if (history.length === 0) {
      navigate('home', 'messages');
      return;
    }

    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    
    if (last.screen === 'home') {
      setHomeTab(last.tab);
    }
    setScreen(last.screen);
  };

  const handleTabChange = (tab) => {
    setHomeTab(tab);
  };

  if (!fontsLoaded || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f9fb', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Đang tải tài nguyên giao diện...</Text>
      </View>
    );
  }

  switch (screen) {
    case 'register': return <RegisterScreen onNavigate={navigate} />;
    case 'forgot': return <ForgotPasswordScreen onNavigate={navigate} />;
    case 'reset-password': return <ResetPasswordScreen onNavigate={navigate} />;
    case 'sessions': return <SessionsScreen onNavigate={navigate} goBack={goBack} />;
    case 'profile': return <ProfileScreen onNavigate={navigate} onLogout={handleLogout} goBack={goBack} />;
    case 'home': return <HomeScreen onNavigate={navigate} onLogout={handleLogout} initialTab={homeTab} goBack={goBack} onTabChange={handleTabChange} />;
    case 'qr-scanner': return <QRScannerScreen onNavigate={navigate} goBack={goBack} />;
    case 'status-picker': return <StatusPickerScreen onNavigate={navigate} goBack={goBack} />;
    case 'profile-more': return <ProfileMoreScreen onNavigate={navigate} goBack={goBack} />;
    case 'settings': return <SettingsScreen onNavigate={navigate} goBack={goBack} />;
    case 'change-password': return <ChangePasswordScreen onNavigate={navigate} goBack={goBack} />;
    case 'login':
    default: return <LoginScreen onNavigate={navigate} />;
  }
}

function MainContainer({ user, authLoading, screen, setScreen, homeTab, setHomeTab }) {
  return (
    <MainApp 
      user={user} 
      authLoading={authLoading} 
      screen={screen} 
      setScreen={setScreen}
      homeTab={homeTab}
      setHomeTab={setHomeTab}
    />
  );
}

export default function App() {
  const [screen, setScreen] = useState('login');
  const [homeTab, setHomeTab] = useState('messages');

  return (
    <SafeAreaProvider>
      <AuthProvider onForceLogoutNavigate={(target) => {
        console.log('🚨 [APP] Global Force Logout trigger received. Navigating to:', target);
        setScreen(target); // Sếp yêu cầu: Reset navigation ngay tại Provider
      }}>
        <MainContainerWithAuth 
          screen={screen} 
          setScreen={setScreen}
          homeTab={homeTab}
          setHomeTab={setHomeTab}
        />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function MainContainerWithAuth({ screen, setScreen, homeTab, setHomeTab }) {
  const { user, loading: authLoading } = useAuth();
  return (
    <MainContainer 
      user={user} 
      authLoading={authLoading} 
      screen={screen} 
      setScreen={setScreen}
      homeTab={homeTab}
      setHomeTab={setHomeTab}
    />
  );
}
