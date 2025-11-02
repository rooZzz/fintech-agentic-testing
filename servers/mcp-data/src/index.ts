import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
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
  getLoanCount,
  toggleCreditLock,
  getCreditLockStatus
} from './factory.js';
import { generateToken, validateCredentials } from './auth.js';

const PORT = 7002;

function createMCPServer() {
  const server = new Server(
    {
      name: 'mcp-data',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'data.user.get',
          description: 'Fetch user data from database to verify displayed information',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'User email address' },
              userId: { type: 'string', description: 'User ID' }
            }
          }
        },
        {
          name: 'data.user.create',
          description: 'Create a test user (used in preconditions)',
          inputSchema: {
            type: 'object',
            properties: {
              plan: { 
                type: 'string', 
                enum: ['free', 'plus', 'premium'],
                description: 'Subscription plan' 
              },
              requires2FA: { 
                type: 'boolean', 
                description: 'Enable 2FA' 
              },
              email: {
                type: 'string',
                description: 'User email address (optional)'
              }
            },
            required: ['plan', 'requires2FA']
          }
        },
        {
          name: 'data.user.login',
          description: 'Authenticate user and get token',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'User email' },
              password: { type: 'string', description: 'User password' },
              otp: { type: 'string', description: '2FA code if required' }
            },
            required: ['email', 'password']
          }
        },
        {
          name: 'data.loan.list',
          description: 'List loan applications to verify backend state',
          inputSchema: {
            type: 'object',
            properties: {
              amount: { type: 'number', description: 'Filter by amount' },
              term: { type: 'number', description: 'Filter by term' },
              loanType: { type: 'string', description: 'Filter by loan type' }
            }
          }
        },
        {
          name: 'data.loan.get',
          description: 'Get specific loan details for verification',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Loan ID' }
            },
            required: ['id']
          }
        },
        {
          name: 'data.loan.seed',
          description: 'Seed loan offers (used in preconditions)',
          inputSchema: {
            type: 'object',
            properties: {
              count: { type: 'number', description: 'Number of loans to seed', default: 7 }
            }
          }
        },
        {
          name: 'data.loan.reset',
          description: 'Reset loan data',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'data.reset',
          description: 'Reset test data (used in preconditions)',
          inputSchema: {
            type: 'object',
            properties: {
              tenant: { type: 'string', description: 'Tenant identifier', default: 'default' },
              scope: { type: 'string', description: 'Reset scope' }
            }
          }
        },
        {
          name: 'data.user.getCreditLock',
          description: 'Get credit lock status for a user',
          inputSchema: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'User ID' }
            },
            required: ['userId']
          }
        },
        {
          name: 'data.user.toggleCreditLock',
          description: 'Toggle credit lock status for a user',
          inputSchema: {
            type: 'object',
            properties: {
              userId: { type: 'string', description: 'User ID' }
            },
            required: ['userId']
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      let result: any;
      
      switch (name) {
        case 'data.user.create': {
          const { plan = 'free', requires2FA = false, email } = args as any;
          
          if (!['free', 'plus', 'premium'].includes(plan)) {
            throw new Error('Invalid plan type. Must be free, plus, or premium.');
          }
          
          const user = createUser({ plan, requires2FA, email });
          result = {
            userId: user.userId,
            email: user.email,
            password: user.password,
            plan: user.plan,
            requires2FA: user.requires2FA,
            otpSecret: user.otpSecret
          };
          break;
        }
        
        case 'data.user.login': {
          const { email, password, otp } = args as any;
          
          if (!email || !password) {
            throw new Error('Email and password are required.');
          }
          
          const user = getUserByEmail(email);
          
          if (!user) {
            throw new Error('Invalid credentials.');
          }
          
          if (!validateCredentials(user, password, otp)) {
            throw new Error('Invalid credentials or 2FA code.');
          }
          
          const { token, expiresAt } = generateToken(user);
          result = {
            token,
            expiresAt,
            user: {
              userId: user.userId,
              email: user.email
            }
          };
          break;
        }
        
        case 'data.user.get': {
          const { userId, email } = args as any;
          
          if (!userId && !email) {
            throw new Error('Must provide userId or email.');
          }
          
          let user = null;
          
          if (userId) {
            user = getUserById(userId);
          } else if (email) {
            user = getUserByEmail(email);
          }
          
          result = { user };
          break;
        }
        
        case 'data.reset': {
          const { tenant = 'default' } = args as any;
          resetAllUsers();
          result = {
            ok: true,
            message: `Environment ${tenant} reset successfully.`
          };
          break;
        }
        
        case 'data.loan.seed': {
          const { count = 7 } = args as any;
          const loans = seedLoans(count);
          result = {
            loans,
            count: loans.length
          };
          break;
        }
        
        case 'data.loan.list': {
          const { amount, term, loanType } = args as any;
          const loans = listLoans({ amount, term, loanType });
          result = { loans };
          break;
        }
        
        case 'data.loan.get': {
          const { id } = args as any;
          
          if (!id) {
            throw new Error('Loan ID is required.');
          }
          
          const loan = getLoanById(id);
          result = { loan };
          break;
        }
        
        case 'data.loan.reset': {
          resetAllLoans();
          result = {
            ok: true,
            message: 'Loan products reset successfully.'
          };
          break;
        }
        
        case 'data.user.toggleCreditLock': {
          const { userId } = args as any;
          
          if (!userId) {
            throw new Error('User ID is required.');
          }
          
          const creditLocked = toggleCreditLock(userId);
          result = {
            userId,
            creditLocked
          };
          break;
        }
        
        case 'data.user.getCreditLock': {
          const { userId } = args as any;
          
          if (!userId) {
            throw new Error('User ID is required.');
          }
          
          const creditLocked = getCreditLockStatus(userId);
          result = {
            userId,
            creditLocked
          };
          break;
        }
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message })
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

const mcpServer = createMCPServer();
const fastify = Fastify({ logger: false });

await fastify.register(cors, {
  origin: '*'
});

fastify.all('/mcp', async (request, reply) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  await mcpServer.connect(transport);
  
  reply.hijack();
  await transport.handleRequest(request.raw, reply.raw, request.body);
});

fastify.post('/data/user/create', async (request, reply) => {
  try {
    const { plan = 'free', requires2FA = false, email } = request.body as any;
    
    if (!['free', 'plus', 'premium'].includes(plan)) {
      return reply.status(400).send({ error: 'Invalid plan type. Must be free, plus, or premium.' });
    }
    
    const user = createUser({ plan, requires2FA, email });
    
    reply.send({
      userId: user.userId,
      email: user.email,
      password: user.password,
      plan: user.plan,
      requires2FA: user.requires2FA,
      otpSecret: user.otpSecret
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/user/login', async (request, reply) => {
  try {
    const { email, password, otp } = request.body as any;
    
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }
    
    const user = getUserByEmail(email);
    
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials.' });
    }
    
    if (!validateCredentials(user, password, otp)) {
      return reply.status(401).send({ error: 'Invalid credentials or 2FA code.' });
    }
    
    const { token, expiresAt } = generateToken(user);
    
    reply.send({
      token,
      expiresAt,
      user: {
        userId: user.userId,
        email: user.email
      }
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/user/get', async (request, reply) => {
  try {
    const { userId, email } = request.body as any;
    
    if (!userId && !email) {
      return reply.status(400).send({ error: 'Must provide userId or email.' });
    }
    
    let user = null;
    
    if (userId) {
      user = getUserById(userId);
    } else if (email) {
      user = getUserByEmail(email);
    }
    
    reply.send({ user });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/user/toggle-credit-lock', async (request, reply) => {
  try {
    const { userId } = request.body as any;
    
    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required.' });
    }
    
    const creditLocked = toggleCreditLock(userId);
    
    reply.send({
      userId,
      creditLocked
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/user/get-credit-lock', async (request, reply) => {
  try {
    const { userId } = request.body as any;
    
    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required.' });
    }
    
    const creditLocked = getCreditLockStatus(userId);
    
    reply.send({
      userId,
      creditLocked
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/loan/seed', async (request, reply) => {
  try {
    const { count = 7 } = request.body as any;
    
    const loans = seedLoans(count);
    
    reply.send({
      loans,
      count: loans.length
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/loan/list', async (request, reply) => {
  try {
    const { amount, term, loanType } = request.body as any;
    
    const loans = listLoans({ amount, term, loanType });
    
    reply.send({ loans });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/loan/get', async (request, reply) => {
  try {
    const { id } = request.body as any;
    
    if (!id) {
      return reply.status(400).send({ error: 'Loan ID is required.' });
    }
    
    const loan = getLoanById(id);
    
    reply.send({ loan });
  } catch (error: any) {
    reply.status(500).send({ error: error.message });
  }
});

fastify.post('/data/reset', async (request, reply) => {
  try {
    const { tenant = 'default' } = request.body as any;
    
    resetAllUsers();
    
    reply.send({
      ok: true,
      message: `Environment ${tenant} reset successfully.`
    });
  } catch (error: any) {
    reply.status(500).send({ error: error.message, ok: false });
  }
});

fastify.get('/health', async (request, reply) => {
  reply.send({ 
    ok: true, 
    users: getUserCount(),
    loans: getLoanCount(),
    timestamp: new Date().toISOString()
  });
});

process.on('SIGINT', async () => {
  console.log('\nShutting down MCP-Data server...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down MCP-Data server...');
  await fastify.close();
  process.exit(0);
});

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`MCP-Data server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
