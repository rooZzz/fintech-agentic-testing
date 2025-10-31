export interface TestUser {
  userId: string;
  email: string;
  password: string;
  plan: 'free' | 'plus' | 'premium';
  requires2FA: boolean;
  otpSecret?: string;
  createdAt: string;
}

export interface CreateUserRequest {
  plan: 'free' | 'plus' | 'premium';
  requires2FA?: boolean;
  email?: string;
}

export interface CreateUserResponse {
  userId: string;
  email: string;
  password: string;
  plan: string;
  requires2FA: boolean;
  otpSecret?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  otp?: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: {
    userId: string;
    email: string;
  };
}

export interface GetUserRequest {
  userId?: string;
  email?: string;
}

export interface GetUserResponse {
  user: TestUser | null;
}

export interface ResetRequest {
  tenant?: string;
  scope?: string;
}

export interface ResetResponse {
  ok: boolean;
  message: string;
}

