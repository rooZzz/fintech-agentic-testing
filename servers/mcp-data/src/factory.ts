import { randomUUID } from 'crypto';
import type { TestUser } from './types.js';

const users: Map<string, TestUser> = new Map();

export function createUser(params: {
  plan: 'free' | 'plus' | 'premium';
  requires2FA?: boolean;
  email?: string;
}): TestUser {
  const userId = randomUUID();
  const email = params.email || `test.${userId.slice(0, 8)}@example.com`;
  const password = 'Password123!';
  
  const user: TestUser = {
    userId,
    email,
    password,
    plan: params.plan,
    requires2FA: params.requires2FA || false,
    otpSecret: params.requires2FA ? generateOTPSecret() : undefined,
    createdAt: new Date().toISOString()
  };
  
  users.set(userId, user);
  users.set(email, user);
  
  return user;
}

export function getUserById(userId: string): TestUser | null {
  return users.get(userId) || null;
}

export function getUserByEmail(email: string): TestUser | null {
  return users.get(email) || null;
}

export function resetAllUsers(): void {
  users.clear();
}

export function getUserCount(): number {
  return users.size / 2;
}

function generateOTPSecret(): string {
  return randomUUID().replace(/-/g, '').substring(0, 32).toUpperCase();
}

