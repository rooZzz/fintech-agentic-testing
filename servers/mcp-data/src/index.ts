import express from 'express';
import cors from 'cors';
import { 
  createUser, 
  getUserById, 
  getUserByEmail, 
  resetAllUsers, 
  getUserCount,
  seedLoans,
  listLoans,
  getLoanById,
  resetAllLoans,
  getLoanCount
} from './factory.js';
import { generateToken, validateCredentials } from './auth.js';
import type {
  CreateUserRequest,
  CreateUserResponse,
  LoginRequest,
  LoginResponse,
  GetUserRequest,
  GetUserResponse,
  ResetRequest,
  ResetResponse,
  SeedLoansRequest,
  SeedLoansResponse,
  ListLoansRequest,
  ListLoansResponse
} from './types.js';

const app = express();
const PORT = 7002;

app.use(cors());
app.use(express.json());

app.post('/data/user/create', (req, res) => {
  try {
    const { plan = 'free', requires2FA = false, email } = req.body as CreateUserRequest;
    
    if (!['free', 'plus', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type. Must be free, plus, or premium.' });
    }
    
    const user = createUser({ plan, requires2FA, email });
    
    const response: CreateUserResponse = {
      userId: user.userId,
      email: user.email,
      password: user.password,
      plan: user.plan,
      requires2FA: user.requires2FA,
      otpSecret: user.otpSecret
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/user/login', (req, res) => {
  try {
    const { email, password, otp } = req.body as LoginRequest;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    const user = getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    if (!validateCredentials(user, password, otp)) {
      return res.status(401).json({ error: 'Invalid credentials or 2FA code.' });
    }
    
    const { token, expiresAt } = generateToken(user);
    
    const response: LoginResponse = {
      token,
      expiresAt,
      user: {
        userId: user.userId,
        email: user.email
      }
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/user/get', (req, res) => {
  try {
    const { userId, email } = req.body as GetUserRequest;
    
    if (!userId && !email) {
      return res.status(400).json({ error: 'Must provide userId or email.' });
    }
    
    let user = null;
    
    if (userId) {
      user = getUserById(userId);
    } else if (email) {
      user = getUserByEmail(email);
    }
    
    const response: GetUserResponse = {
      user
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/reset', (req, res) => {
  try {
    const { tenant = 'default', scope } = req.body as ResetRequest;
    
    resetAllUsers();
    
    const response: ResetResponse = {
      ok: true,
      message: `Environment ${tenant} reset successfully.`
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message, ok: false });
  }
});

app.post('/data/loan/seed', (req, res) => {
  try {
    const { count = 7 } = req.body as SeedLoansRequest;
    
    const loans = seedLoans(count);
    
    const response: SeedLoansResponse = {
      loans,
      count: loans.length
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/loan/list', (req, res) => {
  try {
    const { amount, term, loanType } = req.body as ListLoansRequest;
    
    const loans = listLoans({ amount, term, loanType });
    
    const response: ListLoansResponse = {
      loans
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/loan/get', (req, res) => {
  try {
    const { id } = req.body as { id: string };
    
    if (!id) {
      return res.status(400).json({ error: 'Loan ID is required.' });
    }
    
    const loan = getLoanById(id);
    
    res.json({ loan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/data/loan/reset', (req, res) => {
  try {
    resetAllLoans();
    
    res.json({
      ok: true,
      message: 'Loan products reset successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, ok: false });
  }
});

app.get('/tools', (req, res) => {
  const tools = [
    {
      name: 'data.user.get',
      description: 'Fetch user data from database to verify displayed information',
      params: {
        email: 'string (optional) - User email address',
        userId: 'string (optional) - User ID'
      }
    },
    {
      name: 'data.user.create',
      description: 'Create a test user (used in preconditions)',
      params: {
        plan: 'string (required) - Subscription plan',
        requires2FA: 'boolean (required) - Enable 2FA'
      }
    },
    {
      name: 'data.loan.list',
      description: 'List loan applications to verify backend state',
      params: {
        amount: 'number (optional) - Filter by amount',
        term: 'number (optional) - Filter by term'
      }
    },
    {
      name: 'data.loan.get',
      description: 'Get specific loan details for verification',
      params: {
        id: 'string (required) - Loan ID'
      }
    },
    {
      name: 'data.loan.seed',
      description: 'Seed loan offers (used in preconditions)',
      params: {
        count: 'number (optional) - Number of loans to seed'
      }
    },
    {
      name: 'data.reset',
      description: 'Reset test data (used in preconditions)',
      params: {
        tenant: 'string (optional) - Tenant identifier'
      }
    }
  ];
  
  res.json({ tools });
});

app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    users: getUserCount(),
    loans: getLoanCount(),
    timestamp: new Date().toISOString()
  });
});

process.on('SIGINT', () => {
  console.log('\nShutting down MCP-Data server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down MCP-Data server...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`MCP-Data server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

