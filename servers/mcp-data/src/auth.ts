import type { TestUser } from './types.js';

const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

export function generateToken(user: TestUser): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  
  const payload = {
    userId: user.userId,
    email: user.email,
    exp: expiresAt
  };
  
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  
  return { token, expiresAt };
}

export function validateCredentials(user: TestUser, password: string, otp?: string): boolean {
  if (user.password !== password) {
    return false;
  }
  
  if (user.requires2FA) {
    if (!otp) {
      return false;
    }
  }
  
  return true;
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch {
    return null;
  }
}

