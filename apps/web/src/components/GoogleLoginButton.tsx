import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

interface GoogleLoginButtonProps {
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  isLoading?: boolean;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ onSuccess, onError, isLoading }) => {
  const { googleLogin } = useAuth();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // Note: useGoogleLogin by default returns an access token, but we need an ID token for backend verification
      // However, @react-oauth/google's useGoogleLogin can be configured for implicit or auth code flow.
      // For ID Token, we usually use the Google Login button component or GSI directly.
      // Actually, let's use the standard GoogleLogin component for the ID Token as requested.
    },
    onError: (error) => {
      console.error('Google Login Failed:', error);
      if (onError) onError(error);
    },
  });

  return null; // I will use the standard GoogleLogin component in the pages instead of a custom hook for ID Token convenience
};

export default GoogleLoginButton;
