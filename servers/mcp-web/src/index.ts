import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ElementHandle } from 'playwright';
import { browserManager } from './browser.js';
import { ensureSessionsDir, getSessionPath, generateStateId } from './session.js';
import { DebugLogger } from './debug-logger.js';
import type { UINode } from './types.js';
import { extractElementsInBrowser } from './browser-extract.js';

const PORT = 7001;
const debug = new DebugLogger('MCP_WEB');

function createMCPServer() {
  const server = new Server(
    {
      name: 'mcp-web',
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
          name: 'ui.act.click',
          description: 'Click an interactive element on the page. Prefer testId when available from observation.',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              testId: { type: 'string', description: 'data-testid attribute (PREFERRED - use this when element has testId in observation)' },
              selector: { type: 'string', description: 'CSS selector (e.g., "#id", ".class", "button[type=submit]") - NOT role names' },
              nodeId: { type: 'string', description: 'Node identifier' },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            }
          }
        },
        {
          name: 'ui.act.type',
          description: 'Type text into an input field or select element. Prefer testId when available from observation.',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              testId: { type: 'string', description: 'data-testid attribute (PREFERRED - use this when element has testId in observation)' },
              selector: { type: 'string', description: 'CSS selector (e.g., "#amount", "input[name=email]") - NOT role names' },
              nodeId: { type: 'string', description: 'Node identifier' },
              text: { type: 'string', description: 'Text to type' },
              clear: { type: 'boolean', description: 'Clear field first', default: false },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            },
            required: ['text']
          }
        },
        {
          name: 'ui.act.interact',
          description: 'Smart interaction that automatically handles any element type: types into inputs, selects options, clicks buttons, toggles checkboxes. Prefer testId when available from observation.',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              testId: { type: 'string', description: 'data-testid attribute (PREFERRED - use this when element has testId in observation)' },
              selector: { type: 'string', description: 'CSS selector (e.g., "select#term", "input.amount") - NOT role names' },
              text: { type: 'string', description: 'Text to type or option to select (for inputs/selects)' },
              checked: { type: 'boolean', description: 'Check/uncheck state (for checkboxes/radios)' },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            }
          }
        },
        {
          name: 'ui.observe',
          description: 'Get current page state and visible elements',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            }
          }
        },
        {
          name: 'ui.navigate',
          description: 'Navigate to a URL',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to navigate to' },
              waitUntil: { 
                type: 'string', 
                description: 'When to consider navigation complete',
                enum: ['load', 'domcontentloaded', 'networkidle'],
                default: 'domcontentloaded'
              },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            },
            required: ['url']
          }
        },
        {
          name: 'ui.query',
          description: 'Query elements on the page',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              role: { type: 'string', description: 'ARIA role' },
              name: { type: 'string', description: 'Accessible name' },
              text: { type: 'string', description: 'Text content' },
              selector: { type: 'string', description: 'CSS selector' },
              testId: { type: 'string', description: 'data-testid attribute' },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            }
          }
        },
        {
          name: 'session.save',
          description: 'Save browser session state',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Session name' },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            },
            required: ['name']
          }
        },
        {
          name: 'session.load',
          description: 'Load browser session state',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false
          },
          inputSchema: {
            type: 'object',
            properties: {
              stateId: { type: 'string', description: 'Session state ID' },
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            },
            required: ['stateId']
          }
        },
        {
          name: 'browser.reset',
          description: 'Reset browser context',
          annotations: {
            readOnlyHint: false,
            destructiveHint: true
          },
          inputSchema: {
            type: 'object',
            properties: {
              contextId: { type: 'string', description: 'Browser context ID', default: 'default' }
            }
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
        case 'ui.navigate': {
          const { url, contextId = 'default', waitUntil = 'domcontentloaded' } = args as any;
          
          const ctx = await browserManager.getOrCreateContext(contextId);
          await ctx.page.goto(url, { waitUntil });
          
          result = {
            ok: true,
            currentUrl: ctx.page.url(),
            title: await ctx.page.title()
          };
          break;
        }
        
        case 'ui.query': {
          const { role, name: elementName, text, selector, testId, contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          let locator;
          
          if (testId) {
            locator = ctx.page.locator(`[data-testid="${testId}"]`);
          } else if (role) {
            locator = ctx.page.getByRole(role as any, elementName ? { name: elementName } : undefined);
          } else if (text) {
            locator = ctx.page.getByText(text);
          } else if (selector) {
            locator = ctx.page.locator(selector);
          } else {
            locator = ctx.page.locator('button, a, input, textarea, select, [role="button"], [role="link"], [role="textbox"]');
          }
          
          const elements = await locator.elementHandles();
          
          const nodes = await Promise.all(
            elements.slice(0, 50).map(async (el, i) => {
              return await extractNodeInfo(el, `node_${contextId}_${i}`, contextId);
            })
          );
          
          result = {
            nodes: nodes.filter(n => n.visible)
          };
          break;
        }
        
        case 'ui.observe': {
          const { contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          const nodes = await extractInteractiveElements(ctx.page, contextId);
          
          result = {
            nodes,
            url: ctx.page.url(),
            title: await ctx.page.title()
          };
          
          debug.log(`Observation for context ${contextId}`, {
            url: ctx.page.url(),
            nodeCount: nodes.length
          });
          
          break;
        }
        
        case 'ui.act.click': {
          const { nodeId, selector, testId, contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          const target = testId ? `[data-testid="${testId}"]` : selector;
          debug.log(`Click action`, { target, testId, selector });
          
          if (testId) {
            await ctx.page.click(`[data-testid="${testId}"]`, { timeout: 5000 });
          } else if (selector) {
            await ctx.page.click(selector, { timeout: 5000 });
          } else if (nodeId) {
            throw new Error('nodeId-based clicking not yet implemented. Use selector or testId instead.');
          } else {
            throw new Error('Must provide selector, testId, or nodeId');
          }
          
          await ctx.page.waitForTimeout(500);
          
          result = {
            ok: true,
            message: 'Click successful'
          };
          break;
        }
        
        case 'ui.act.type': {
          const { nodeId, selector, testId, text, clear = false, contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          let targetSelector: string;
          
          if (testId) {
            targetSelector = `[data-testid="${testId}"]`;
          } else if (selector) {
            targetSelector = selector;
          } else if (nodeId) {
            throw new Error('nodeId-based typing not yet implemented. Use selector or testId instead.');
          } else {
            throw new Error('Must provide selector, testId, or nodeId');
          }
          
          debug.log(`Type action`, { target: targetSelector, textLength: text.length, clear });
          
          const element = await ctx.page.locator(targetSelector).first();
          const tagName = await element.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
          
          if (tagName === 'select') {
            await element.selectOption(text, { timeout: 5000 });
          } else {
            if (clear) {
              await ctx.page.fill(targetSelector, '');
            }
            await ctx.page.type(targetSelector, text, { timeout: 5000 });
          }
          
          result = {
            ok: true,
            message: 'Type successful'
          };
          break;
        }
        
        case 'ui.act.interact': {
          const { selector, testId, text, checked, contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          let targetSelector: string;
          if (testId) {
            targetSelector = `[data-testid="${testId}"]`;
          } else if (selector) {
            targetSelector = selector;
          } else {
            throw new Error('Must provide selector or testId');
          }
          
          debug.log(`Interact action`, { target: targetSelector, text, checked });
          
          const element = await ctx.page.locator(targetSelector).first();
          const tagName = await element.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
          const inputType = await element.evaluate((el: any) => el.type?.toLowerCase()).catch(() => '');
          
          if (tagName === 'select') {
            if (text === undefined) {
              throw new Error('text parameter required for select elements');
            }
            try {
              await element.selectOption({ label: text }, { timeout: 5000 });
            } catch (e) {
              await element.selectOption({ value: text }, { timeout: 5000 });
            }
            result = { ok: true, message: 'Option selected', action: 'select' };
          } else if (inputType === 'checkbox' || inputType === 'radio') {
            if (checked !== undefined) {
              if (checked) {
                await element.check({ timeout: 5000 });
              } else {
                await element.uncheck({ timeout: 5000 });
              }
            } else {
              await element.click({ timeout: 5000 });
            }
            result = { ok: true, message: 'Checkbox toggled', action: 'toggle' };
          } else if (tagName === 'input' || tagName === 'textarea') {
            if (text === undefined) {
              throw new Error('text parameter required for input/textarea elements');
            }
            await ctx.page.fill(targetSelector, text, { timeout: 5000 });
            result = { ok: true, message: 'Text entered', action: 'type' };
          } else if (tagName === 'button' || tagName === 'a' || inputType === 'submit') {
            await ctx.page.click(targetSelector, { timeout: 5000 });
            result = { ok: true, message: 'Clicked', action: 'click' };
          } else {
            await ctx.page.click(targetSelector, { timeout: 5000 });
            result = { ok: true, message: 'Clicked (default)', action: 'click' };
          }
          
          await ctx.page.waitForTimeout(500);
          break;
        }
        
        case 'session.save': {
          const { name, contextId = 'default' } = args as any;
          
          const ctx = await browserManager.getContext(contextId);
          if (!ctx) {
            throw new Error('No browser context found. Navigate to a URL first.');
          }
          
          await ensureSessionsDir();
          
          const stateId = generateStateId(name);
          const path = getSessionPath(stateId);
          
          await ctx.context.storageState({ path });
          
          result = {
            stateId,
            path
          };
          break;
        }
        
        case 'session.load': {
          const { stateId, contextId = 'default' } = args as any;
          
          const existingCtx = await browserManager.getContext(contextId);
          if (existingCtx) {
            await browserManager.closeContext(contextId);
          }
          
          const browser = await browserManager.ensureBrowser();
          const path = getSessionPath(stateId);
          
          const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            storageState: path
          });
          
          const page = await context.newPage();
          
          const ctx = { context, page };
          (browserManager as any).contexts.set(contextId, ctx);
          
          result = {
            ok: true
          };
          break;
        }
        
        case 'browser.reset': {
          const { contextId = 'default' } = args as any;
          
          await browserManager.closeContext(contextId);
          
          result = {
            ok: true,
            message: `Context ${contextId} closed and reset`
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

async function extractNodeInfo(el: ElementHandle, id: string, contextId: string): Promise<UINode> {
  const box = await el.boundingBox();
  const isVisible = box !== null && box.width > 0 && box.height > 0;
  const isEnabled = await el.isEnabled().catch(() => true);
  const isFocused = await el.evaluate((e: any) => e === e.ownerDocument.activeElement).catch(() => false);
  
  const role = await el.getAttribute('role') || await el.evaluate((e) => e.tagName.toLowerCase());
  const ariaLabel = await el.getAttribute('aria-label');
  const textContent = await el.textContent().catch(() => '');
  const name = ariaLabel || textContent?.trim().substring(0, 100) || '';
  
  const ariaCheckedAttr = await el.getAttribute('aria-checked');
  let ariaChecked: boolean | 'mixed' | undefined = undefined;
  if (ariaCheckedAttr === 'true') {
    ariaChecked = true;
  } else if (ariaCheckedAttr === 'false') {
    ariaChecked = false;
  } else if (ariaCheckedAttr === 'mixed') {
    ariaChecked = 'mixed';
  }
  
  return {
    id,
    role: role || 'unknown',
    name,
    bounds: box ? { x: box.x, y: box.y, w: box.width, h: box.height } : { x: 0, y: 0, w: 0, h: 0 },
    enabled: isEnabled,
    visible: isVisible,
    focused: isFocused,
    testId: await el.getAttribute('data-testid') || undefined,
    href: await el.getAttribute('href') || undefined,
    value: await el.evaluate((e: any) => e.value).catch(() => undefined),
    tagName: await el.evaluate((e) => e.tagName.toLowerCase()),
    ariaChecked
  };
}

async function extractInteractiveElements(page: any, contextId: string): Promise<UINode[]> {
  const funcString = `(${extractElementsInBrowser.toString()})`;
  const nodes = await page.evaluate(`${funcString}("${contextId}")`);
  return nodes as UINode[];
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

fastify.get('/health', async (request, reply) => {
  reply.send({
    ok: true,
    contexts: browserManager.getContextCount(),
    timestamp: new Date().toISOString()
  });
});

process.on('SIGINT', async () => {
  console.log('\nShutting down MCP-Web server...');
  await browserManager.closeAll();
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down MCP-Web server...');
  await browserManager.closeAll();
  await fastify.close();
  process.exit(0);
});

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`MCP-Web server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
