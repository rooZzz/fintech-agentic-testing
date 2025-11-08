// @ts-nocheck
import { Page } from 'playwright';

interface SDOM {
  interactive: InteractiveElement[];
  content: ContentElement[];
  feedback: FeedbackElement[];
}

interface InteractiveElement {
  type: 'button' | 'input' | 'select' | 'link' | 'checkbox' | 'radio';
  label: string;
  testId?: string;
  value?: string;
  disabled: boolean;
  required?: boolean;
  placeholder?: string;
  href?: string;
  relevance?: string;
}

interface ContentElement {
  type: 'heading' | 'label' | 'text' | 'paragraph';
  text: string;
  testId?: string;
  context?: string;
  level?: number;
}

interface FeedbackElement {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  field?: string;
  testId?: string;
}

type SDOMElement = InteractiveElement | ContentElement | FeedbackElement;

interface SDELTA {
  added: SDOMElement[];
  removed: SDOMElement[];
  changed: Array<{
    element: SDOMElement;
    oldValue: any;
    newValue: any;
  }>;
  urlChanged?: {
    from: string;
    to: string;
  };
}

interface ObservationContext {
  goal?: string;
  lastAction?: string;
  expectingValidation?: boolean;
}


export class ObserverService {
  private previousSDOMs: Map<string, SDOM> = new Map();

  async snapshot(page: Page, contextId: string, context?: ObservationContext): Promise<{ sdom: SDOM; sdelta: SDELTA | null }> {
    const sdom = await this.extractProceduralDOM(page);
    
    const previousSDOM = this.previousSDOMs.get(contextId);
    const sdelta = previousSDOM ? this.diff(previousSDOM, sdom, page.url()) : null;
    
    this.previousSDOMs.set(contextId, sdom);
    
    return { sdom, sdelta };
  }

  private async extractProceduralDOM(page: Page): Promise<SDOM> {
    const extractionScript = `
    (function() {
      const sdom = {
        interactive: [],
        content: [],
        feedback: []
      };

      function isVisible(el) {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
      }

      function getLabel(el) {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();
        
        const text = el.textContent ? el.textContent.trim() : '';
        if (text.length > 0 && text.length < 200) return text;
        
        const placeholder = el.placeholder;
        if (placeholder) return placeholder;
        
        return '';
      }

      document.querySelectorAll('button, input, select, textarea, a[href], [role=button], [role=checkbox], [role=radio]').forEach(function(el) {
        const htmlEl = el;
        if (!isVisible(htmlEl)) return;
        
        const tagName = htmlEl.tagName.toLowerCase();
        let type = 'button';
        
        if (tagName === 'input') {
          const inputType = htmlEl.type;
          if (inputType === 'checkbox') type = 'checkbox';
          else if (inputType === 'radio') type = 'radio';
          else type = 'input';
        } else if (tagName === 'select') {
          type = 'select';
        } else if (tagName === 'a') {
          type = 'link';
        }
        
        const label = getLabel(htmlEl);
        if (!label) return;
        
        sdom.interactive.push({
          type: type,
          label: label.substring(0, 100),
          testId: htmlEl.getAttribute('data-testid') || undefined,
          value: htmlEl.value || undefined,
          disabled: htmlEl.disabled || htmlEl.getAttribute('aria-disabled') === 'true',
          required: htmlEl.required || undefined,
          placeholder: htmlEl.placeholder || undefined,
          href: htmlEl.href || undefined
        });
      });

      document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, label').forEach(function(el) {
        const htmlEl = el;
        if (!isVisible(htmlEl)) return;
        
        const text = htmlEl.textContent ? htmlEl.textContent.trim() : '';
        if (text.length < 2) return;
        
        const tagName = htmlEl.tagName.toLowerCase();
        let type = 'text';
        let level;
        
        if (tagName.startsWith('h')) {
          type = 'heading';
          level = parseInt(tagName[1]);
        } else if (tagName === 'label') {
          type = 'label';
        } else if (tagName === 'p') {
          type = 'paragraph';
        }
        
        sdom.content.push({
          type: type,
          text: text.substring(0, 200),
          testId: htmlEl.getAttribute('data-testid') || undefined,
          level: level
        });
      });

      document.querySelectorAll('header span, header div, nav span, nav div, main span, main div, [role="banner"] span, [role="navigation"] span').forEach(function(el) {
        const htmlEl = el;
        if (!isVisible(htmlEl)) return;
        
        const hasComplexChildren = htmlEl.querySelector('button, input, select, a, h1, h2, h3, h4, h5, h6, p');
        if (hasComplexChildren) return;
        
        const hasNestedDivs = htmlEl.querySelector('div');
        if (hasNestedDivs) return;
        
        const text = htmlEl.textContent ? htmlEl.textContent.trim() : '';
        if (text.length < 2 || text.length > 200) return;
        
        const computedStyle = window.getComputedStyle(htmlEl);
        const fontSize = parseInt(computedStyle.fontSize || '0', 10);
        const fontWeight = computedStyle.fontWeight;
        const isLarge = fontSize >= 20;
        const isBold = fontWeight === 'bold' || parseInt(fontWeight, 10) >= 600;
        
        if (text.length <= 50 || isLarge || isBold || fontSize >= 14) {
          sdom.content.push({
            type: 'text',
            text: text.substring(0, 200),
            testId: htmlEl.getAttribute('data-testid') || undefined
          });
        }
      });

      document.querySelectorAll('[class*="error"], [class*="success"], [class*="warning"], [role="alert"], [role="status"]').forEach(function(el) {
        const htmlEl = el;
        if (!isVisible(htmlEl)) return;
        
        const text = htmlEl.textContent ? htmlEl.textContent.trim() : '';
        if (text.length < 3) return;
        
        const classList = htmlEl.className.toLowerCase();
        let type = 'info';
        
        if (classList.includes('error') || classList.includes('red')) type = 'error';
        else if (classList.includes('success') || classList.includes('green')) type = 'success';
        else if (classList.includes('warning') || classList.includes('yellow')) type = 'warning';
        
        const testId = htmlEl.getAttribute('data-testid');
        const field = testId ? testId.replace('-error', '').replace('-success', '') : undefined;
        
        sdom.feedback.push({
          type: type,
          message: text.substring(0, 200),
          field: field,
          testId: testId
        });
      });

      return sdom;
    })();
    `;
    
    return await page.evaluate(extractionScript);
  }

  diff(previous: SDOM, current: SDOM, currentUrl: string): SDELTA {
    const added: SDOMElement[] = [];
    const removed: SDOMElement[] = [];
    const changed: Array<{ element: SDOMElement; oldValue: any; newValue: any }> = [];

    const allCategories: Array<keyof SDOM> = ['interactive', 'content', 'feedback'];
    
    allCategories.forEach(category => {
      const prevItems = previous[category];
      const currItems = current[category];
      
      const prevMap = new Map(prevItems.map(item => [this.getElementKey(item), item]));
      const currMap = new Map(currItems.map(item => [this.getElementKey(item), item]));
      
      currItems.forEach(item => {
        const key = this.getElementKey(item);
        if (!prevMap.has(key)) {
          added.push(item);
        } else {
          const prevItem = prevMap.get(key);
          if (category === 'interactive' && 'value' in item && 'value' in prevItem!) {
            if (item.value !== prevItem.value) {
              changed.push({
                element: item,
                oldValue: prevItem.value,
                newValue: item.value
              });
            }
          }
        }
      });
      
      prevItems.forEach(item => {
        const key = this.getElementKey(item);
        if (!currMap.has(key)) {
          removed.push(item);
        }
      });
    });
    
    return {
      added,
      removed,
      changed,
      urlChanged: undefined
    };
  }

  private getElementKey(element: SDOMElement): string {
    if ('testId' in element && element.testId) {
      return `testId:${element.testId}`;
    }
    if ('label' in element) {
      return `label:${element.label}`;
    }
    if ('text' in element) {
      return `text:${element.text.substring(0, 50)}`;
    }
    if ('message' in element) {
      return `message:${element.message.substring(0, 50)}`;
    }
    return `unknown:${JSON.stringify(element).substring(0, 50)}`;
  }

  clearContext(contextId: string): void {
    this.previousSDOMs.delete(contextId);
  }
}

