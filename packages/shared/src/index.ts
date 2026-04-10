// Shared interfaces for ZaloEdu

export interface User {
  id: string; // USER#<email>
  email: string;
  fullName: string;
  gender: boolean;
  dataOfBirth: string;
  phone: string;
  urlAvatar?: string;
  album?: any[];
  passwordHash: string;
  currentDeviceId?: string;
  lastLoginAt: string;
  createdAt: string;
  status: 'active' | 'suspended';
}

export interface OtpCode {
  id: string; // OTP#<email>
  code: string;
  type: 'register' | 'forgot_password';
  attempts: number;
  expiresAt: number; // TTL (Unix timestamp)
}

export interface UserSession {
  id: string; // SESSION#<deviceId>
  userId: string;
  isActive: boolean;
  lastActiveAt: string;
}

// Data Transfer Objects (DTOs)
export interface RegisterRequestDto {
  email: string;
  password?: string;
  fullName?: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  otp?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  deviceId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}
