export interface AuthSession {
  token: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    email: string;
    userId: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

