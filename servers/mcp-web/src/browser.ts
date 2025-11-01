import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface ContextState {
  context: BrowserContext;
  page: Page;
}

class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, ContextState> = new Map();

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--window-size=780,844',
          '--window-position=0,0',
        ]
      });
    }
    return this.browser;
  }

  async getOrCreateContext(contextId: string = 'default'): Promise<ContextState> {
    let ctx = this.contexts.get(contextId);
    
    if (!ctx) {
      const browser = await this.ensureBrowser();
      const context = await browser.newContext({
        viewport: { width: 780, height: 844 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      
      ctx = { context, page };
      this.contexts.set(contextId, ctx);
    }
    
    return ctx;
  }

  async getContext(contextId: string = 'default'): Promise<ContextState | null> {
    return this.contexts.get(contextId) || null;
  }

  async closeContext(contextId: string): Promise<void> {
    const ctx = this.contexts.get(contextId);
    if (ctx) {
      await ctx.page.close();
      await ctx.context.close();
      this.contexts.delete(contextId);
    }
  }

  async closeAll(): Promise<void> {
    for (const [contextId] of this.contexts) {
      await this.closeContext(contextId);
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  getContextCount(): number {
    return this.contexts.size;
  }
}

export const browserManager = new BrowserManager();

