import express from 'express';
import cors from 'cors';
import { ElementHandle } from 'playwright';
import { browserManager } from './browser.js';
import { ensureSessionsDir, getSessionPath, generateStateId } from './session.js';
import type {
  NavigateRequest,
  NavigateResponse,
  QueryRequest,
  QueryResponse,
  ObserveRequest,
  ObserveResponse,
  ClickRequest,
  ClickResponse,
  TypeRequest,
  TypeResponse,
  SessionSaveRequest,
  SessionSaveResponse,
  SessionLoadRequest,
  SessionLoadResponse,
  UINode
} from './types.js';

const app = express();
const PORT = 7001;

app.use(cors());
app.use(express.json());

app.post('/ui/navigate', async (req, res) => {
  try {
    const { url, contextId = 'default', waitUntil = 'domcontentloaded' } = req.body as NavigateRequest;
    
    const ctx = await browserManager.getOrCreateContext(contextId);
    await ctx.page.goto(url, { waitUntil });
    
    const response: NavigateResponse = {
      ok: true,
      currentUrl: ctx.page.url(),
      title: await ctx.page.title()
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ui/query', async (req, res) => {
  try {
    const { role, name, text, selector, testId, contextId = 'default' } = req.body as QueryRequest;
    
    const ctx = await browserManager.getContext(contextId);
    if (!ctx) {
      return res.status(400).json({ error: 'No browser context found. Navigate to a URL first.' });
    }
    
    let locator;
    
    if (testId) {
      locator = ctx.page.locator(`[data-testid="${testId}"]`);
    } else if (role) {
      locator = ctx.page.getByRole(role as any, name ? { name } : undefined);
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
    
    const response: QueryResponse = {
      nodes: nodes.filter(n => n.visible)
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ui/observe', async (req, res) => {
  try {
    const { contextId = 'default' } = req.body as ObserveRequest;
    
    const ctx = await browserManager.getContext(contextId);
    if (!ctx) {
      return res.status(400).json({ error: 'No browser context found. Navigate to a URL first.' });
    }
    
    const locator = ctx.page.locator('button, a, input, textarea, select, [role="button"], [role="link"], [role="textbox"], h1, h2, h3');
    const elements = await locator.elementHandles();
    
    const nodes = await Promise.all(
      elements.slice(0, 50).map(async (el, i) => {
        return await extractNodeInfo(el, `node_${contextId}_${i}`, contextId);
      })
    );
    
    const response: ObserveResponse = {
      nodes: nodes.filter(n => n.visible),
      url: ctx.page.url(),
      title: await ctx.page.title()
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ui/act/click', async (req, res) => {
  try {
    const { nodeId, selector, testId, contextId = 'default' } = req.body as ClickRequest;
    
    const ctx = await browserManager.getContext(contextId);
    if (!ctx) {
      return res.status(400).json({ error: 'No browser context found. Navigate to a URL first.' });
    }
    
    if (testId) {
      await ctx.page.click(`[data-testid="${testId}"]`, { timeout: 5000 });
    } else if (selector) {
      await ctx.page.click(selector, { timeout: 5000 });
    } else if (nodeId) {
      return res.status(400).json({ error: 'nodeId-based clicking not yet implemented. Use selector or testId instead.' });
    } else {
      return res.status(400).json({ error: 'Must provide selector, testId, or nodeId' });
    }
    
    await ctx.page.waitForTimeout(500);
    
    const response: ClickResponse = {
      ok: true,
      message: 'Click successful'
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message, ok: false });
  }
});

app.post('/ui/act/type', async (req, res) => {
  try {
    const { nodeId, selector, testId, text, clear = false, contextId = 'default' } = req.body as TypeRequest;
    
    const ctx = await browserManager.getContext(contextId);
    if (!ctx) {
      return res.status(400).json({ error: 'No browser context found. Navigate to a URL first.' });
    }
    
    let targetSelector: string;
    
    if (testId) {
      targetSelector = `[data-testid="${testId}"]`;
    } else if (selector) {
      targetSelector = selector;
    } else if (nodeId) {
      return res.status(400).json({ error: 'nodeId-based typing not yet implemented. Use selector or testId instead.' });
    } else {
      return res.status(400).json({ error: 'Must provide selector, testId, or nodeId' });
    }
    
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
    
    const response: TypeResponse = {
      ok: true,
      message: 'Type successful'
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message, ok: false });
  }
});

app.post('/session/save', async (req, res) => {
  try {
    const { name, contextId = 'default' } = req.body as SessionSaveRequest;
    
    const ctx = await browserManager.getContext(contextId);
    if (!ctx) {
      return res.status(400).json({ error: 'No browser context found. Navigate to a URL first.' });
    }
    
    await ensureSessionsDir();
    
    const stateId = generateStateId(name);
    const path = getSessionPath(stateId);
    
    await ctx.context.storageState({ path });
    
    const response: SessionSaveResponse = {
      stateId,
      path
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/session/load', async (req, res) => {
  try {
    const { stateId, contextId = 'default' } = req.body as SessionLoadRequest;
    
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
    
    const response: SessionLoadResponse = {
      ok: true
    };
    
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message, ok: false });
  }
});

app.post('/browser/reset', async (req, res) => {
  try {
    const { contextId = 'default' } = req.body;
    
    await browserManager.closeContext(contextId);
    
    res.json({
      ok: true,
      message: `Context ${contextId} closed and reset`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/tools', (req, res) => {
  const tools = [
    {
      name: 'ui.act.click',
      description: 'Click an interactive element on the page',
      params: {
        testId: 'string (optional) - data-testid attribute',
        selector: 'string (optional) - CSS selector',
        nodeId: 'string (optional) - Node identifier'
      }
    },
    {
      name: 'ui.act.type',
      description: 'Type text into an input field or select element',
      params: {
        testId: 'string (optional) - data-testid attribute',
        selector: 'string (optional) - CSS selector',
        text: 'string (required) - Text to type',
        clear: 'boolean (optional) - Clear field first'
      }
    },
    {
      name: 'ui.observe',
      description: 'Get current page state and visible elements',
      params: {}
    }
  ];
  
  res.json({ tools });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    contexts: browserManager.getContextCount(),
    timestamp: new Date().toISOString()
  });
});

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

process.on('SIGINT', async () => {
  console.log('\nShutting down MCP-Web server...');
  await browserManager.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down MCP-Web server...');
  await browserManager.closeAll();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`MCP-Web server listening on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

