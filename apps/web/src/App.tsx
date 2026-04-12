import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import SessionsPage from './pages/SessionsPage';

// Component bảo vệ Route
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/sessions" 
              element={
                <PrivateRoute>
                  <SessionsPage />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
