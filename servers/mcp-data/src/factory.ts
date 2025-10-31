import { randomUUID } from 'crypto';
import type { TestUser, LoanProduct, LoanType } from './types.js';

const users: Map<string, TestUser> = new Map();
const loans: Map<string, LoanProduct> = new Map();

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

const lenderNames = [
  'First National Bank',
  'Capital Trust',
  'Metro Financial',
  'Union Credit',
  'Summit Lending',
  'Valley Bank',
  'Coastal Financial',
  'Mountain Trust',
  'Prairie Credit Union',
  'Harbor Bank'
];

function calculateMonthlyPayment(principal: number, apr: number, termYears: number): number {
  const monthlyRate = apr / 100 / 12;
  const numPayments = termYears * 12;
  
  if (monthlyRate === 0) {
    return principal / numPayments;
  }
  
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                        (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return Math.round(monthlyPayment * 100) / 100;
}

function calculateTotalInterest(principal: number, monthlyPayment: number, termYears: number): number {
  const totalPaid = monthlyPayment * termYears * 12;
  return Math.round((totalPaid - principal) * 100) / 100;
}

export function createLoanProduct(loanType: LoanType, index: number): LoanProduct {
  const id = randomUUID();
  
  let apr: number;
  let minAmount: number;
  let maxAmount: number;
  let minTerm: number;
  let maxTerm: number;
  
  switch (loanType) {
    case 'personal':
      apr = 5.5 + (index * 2.1);
      minAmount = 1000;
      maxAmount = 50000;
      minTerm = 1;
      maxTerm = 7;
      break;
    case 'auto':
      apr = 3.5 + (index * 1.8);
      minAmount = 5000;
      maxAmount = 75000;
      minTerm = 2;
      maxTerm = 7;
      break;
    case 'mortgage':
      apr = 4.2 + (index * 1.5);
      minAmount = 50000;
      maxAmount = 500000;
      minTerm = 10;
      maxTerm = 30;
      break;
  }
  
  const exampleTerm = Math.floor((minTerm + maxTerm) / 2);
  const exampleAmount = Math.floor((minAmount + maxAmount) / 2);
  const monthlyPayment = calculateMonthlyPayment(exampleAmount, apr, exampleTerm);
  const totalInterest = calculateTotalInterest(exampleAmount, monthlyPayment, exampleTerm);
  
  const loan: LoanProduct = {
    id,
    lenderName: lenderNames[index % lenderNames.length],
    apr: Math.round(apr * 100) / 100,
    monthlyPayment,
    totalInterest,
    loanType,
    minAmount,
    maxAmount,
    minTerm,
    maxTerm,
    createdAt: new Date().toISOString()
  };
  
  loans.set(id, loan);
  return loan;
}

export function seedLoans(count: number = 7): LoanProduct[] {
  loans.clear();
  
  const loanTypes: LoanType[] = ['personal', 'auto', 'mortgage'];
  const createdLoans: LoanProduct[] = [];
  
  for (let i = 0; i < count; i++) {
    const loanType = loanTypes[i % loanTypes.length];
    const typeIndex = Math.floor(i / loanTypes.length);
    const loan = createLoanProduct(loanType, typeIndex);
    createdLoans.push(loan);
  }
  
  return createdLoans;
}

export function listLoans(filters?: {
  amount?: number;
  term?: number;
  loanType?: LoanType;
}): LoanProduct[] {
  let results = Array.from(loans.values());
  
  if (filters?.amount) {
    results = results.filter(loan => 
      loan.minAmount <= filters.amount! && loan.maxAmount >= filters.amount!
    );
  }
  
  if (filters?.term) {
    results = results.filter(loan => 
      loan.minTerm <= filters.term! && loan.maxTerm >= filters.term!
    );
  }
  
  if (filters?.loanType) {
    results = results.filter(loan => loan.loanType === filters.loanType);
  }
  
  if (filters?.amount && filters?.term) {
    results = results.map(loan => {
      const monthlyPayment = calculateMonthlyPayment(filters.amount!, loan.apr, filters.term!);
      const totalInterest = calculateTotalInterest(filters.amount!, monthlyPayment, filters.term!);
      
      return {
        ...loan,
        monthlyPayment,
        totalInterest
      };
    });
  }
  
  return results.sort((a, b) => a.apr - b.apr);
}

export function getLoanById(id: string): LoanProduct | null {
  return loans.get(id) || null;
}

export function resetAllLoans(): void {
  loans.clear();
}

export function getLoanCount(): number {
  return loans.size;
}

