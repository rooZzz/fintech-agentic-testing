import type { AuthSession, LoginCredentials } from '@/types/auth';

const SESSION_STORAGE_KEY = 'auth_session';

export const mockLogin = async (credentials: LoginCredentials): Promise<AuthSession> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  const userId = Math.random().toString(36).substring(7);
  const token = btoa(JSON.stringify({ userId, email: credentials.email }));
  const refreshToken = btoa(JSON.stringify({ userId, type: 'refresh' }));
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const session: AuthSession = {
    token,
    refreshToken,
    expiresAt,
    user: {
      email: credentials.email,
      userId,
    },
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

  return session;
};

export const mockLogout = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const getStoredSession = (): AuthSession | null => {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const session: AuthSession = JSON.parse(stored);
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export const refreshSession = async (session: AuthSession): Promise<AuthSession> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const newExpiresAt = Date.now() + 15 * 60 * 1000;
  const newSession: AuthSession = {
    ...session,
    expiresAt: newExpiresAt,
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));

  return newSession;
};

