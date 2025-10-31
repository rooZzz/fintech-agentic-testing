import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthSession } from '@/types/auth';
import { mockLogin, mockLogout, getStoredSession, refreshSession } from '@/api/auth';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      setSession(stored);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;

    const timeUntilExpiry = session.expiresAt - Date.now();
    if (timeUntilExpiry <= 0) {
      setSession(null);
      return;
    }

    const refreshTimer = setTimeout(async () => {
      try {
        const newSession = await refreshSession(session);
        setSession(newSession);
      } catch {
        setSession(null);
      }
    }, Math.max(0, timeUntilExpiry - 60000));

    return () => clearTimeout(refreshTimer);
  }, [session]);

  const login = async (email: string, password: string) => {
    const newSession = await mockLogin({ email, password });
    setSession(newSession);
  };

  const logout = async () => {
    await mockLogout();
    setSession(null);
  };

  if (isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

