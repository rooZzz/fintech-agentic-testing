export interface TestUser {
  userId: string;
  email: string;
  password: string;
  plan: 'free' | 'plus' | 'premium';
  requires2FA: boolean;
  otpSecret?: string;
  createdAt: string;
  creditLocked: boolean;
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

export type LoanType = 'personal' | 'auto' | 'mortgage';

export interface LoanProduct {
  id: string;
  lenderName: string;
  apr: number;
  monthlyPayment: number;
  totalInterest: number;
  loanType: LoanType;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  createdAt: string;
}

export interface SeedLoansRequest {
  count?: number;
}

export interface SeedLoansResponse {
  loans: LoanProduct[];
  count: number;
}

export interface ListLoansRequest {
  amount?: number;
  term?: number;
  loanType?: LoanType;
}

export interface ListLoansResponse {
  loans: LoanProduct[];
}

