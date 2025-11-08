import type { AuthSession, LoginCredentials } from '@/types/auth';

const SESSION_STORAGE_KEY = 'auth_session';

export const mockLogin = async (credentials: LoginCredentials): Promise<AuthSession> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(errorData.error || 'Authentication failed');
    }

    const data = await response.json();
    
    const session: AuthSession = {
      token: data.token,
      refreshToken: data.token,
      expiresAt: data.expiresAt,
      user: {
        email: data.user.email,
        userId: data.user.userId,
      },
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    return session;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
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

const DATA_API_BASE = 'http://localhost:7002';

export const toggleCreditLock = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/toggle-credit-lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to toggle credit lock');
    }

    const data = await response.json();
    return data.creditLocked;
  } catch (error) {
    console.error('Error toggling credit lock:', error);
    throw error;
  }
};

export const getCreditLockStatus = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/get-credit-lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to get credit lock status');
    }

    const data = await response.json();
    return data.creditLocked;
  } catch (error) {
    console.error('Error getting credit lock status:', error);
    throw error;
  }
};

export const createTestUser = async (): Promise<{ email: string; password: string; userId: string }> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan: 'plus',
        requires2FA: false,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create test user');
    }

    const data = await response.json();
    return {
      email: data.email,
      password: data.password,
      userId: data.userId,
    };
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
};

export interface Tradeline {
  id: number;
  creditor: string;
  accountNumber: string;
  type: 'Revolving' | 'Installment';
  balance: number;
  limit: number;
  status: 'Open' | 'Closed';
  paymentHistory: string;
}

export interface CreditReport {
  userId: string;
  creditScore: number;
  scoreRating: 'POOR' | 'FAIR' | 'GOOD' | 'VERY GOOD' | 'EXCELLENT';
  lastUpdated: string;
  tradelines: Tradeline[];
}

export const getCreditReport = async (userId: string): Promise<CreditReport> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/credit-report/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch credit report');
    }

    const report = await response.json() as CreditReport;
    return report;
  } catch (error) {
    console.error('Error fetching credit report:', error);
    throw error;
  }
};

export interface UserProfile {
  userId: string;
  email: string;
  name?: string;
  plan: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const data = await response.json();
    return {
      userId: data.user.userId,
      email: data.user.email,
      name: data.user.name,
      plan: data.user.plan,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const updateUserName = async (userId: string, name: string): Promise<UserProfile> => {
  try {
    const response = await fetch(`${DATA_API_BASE}/data/user/update-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update name' }));
      throw new Error(errorData.error || 'Failed to update name');
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Error updating user name:', error);
    throw error;
  }
};

