export function extractElementsInBrowser(ctx) {
  const doc = document;
  const interactiveSelector = 'button, input, select, textarea, a[href], [role=button], [role=textbox], [role=checkbox], [role=combobox], [role=switch], [role=link], [role=spinbutton]';
  const contentSelector = 'h1, h2, h3, h4, h5, h6, [role=heading], label, [role=status], [role=alert]';
  
  const results = [];
  let idCounter = 0;
  
  function getComputedRole(el) {
    const explicitRole = el.getAttribute('role');
    if (explicitRole) return explicitRole;
    
    const tagName = el.tagName.toLowerCase();
    const roleMap = {
      'button': 'button',
      'a': 'link',
      'input': 'textbox',
      'select': 'combobox',
      'textarea': 'textbox',
      'h1': 'heading',
      'h2': 'heading',
      'h3': 'heading',
      'h4': 'heading',
      'h5': 'heading',
      'h6': 'heading',
      'label': 'label',
      'p': 'text',
      'div': 'generic',
      'span': 'generic',
      'td': 'cell',
      'th': 'columnheader'
    };
    
    if (tagName === 'input') {
      const type = el.type;
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'button' || type === 'submit') return 'button';
      if (type === 'number') return 'spinbutton';
      return 'textbox';
    }
    
    return roleMap[tagName] || tagName;
  }
  
  function getLabelText(el) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'select' || el.tagName.toLowerCase() === 'textarea') {
      const id = el.id;
      if (id) {
        const label = doc.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent?.trim() || '';
      }
      
      const parentLabel = el.closest('label');
      if (parentLabel) return parentLabel.textContent?.trim() || '';
    }
    
    return '';
  }
  
  function getVisibleText(el) {
    if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'select' || el.tagName.toLowerCase() === 'textarea') {
      return '';
    }
    return el.textContent?.trim().substring(0, 100) || '';
  }
  
  function isSalientContent(el) {
    const text = el.textContent?.trim() || '';
    if (text.length < 2) return false;
    
    if (el.getAttribute('data-testid')) return true;
    
    if (el.closest('button, a, input, select, textarea')) return false;
    
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') return false;
    
    if (el.hasAttribute('role')) return true;
    if (el.hasAttribute('aria-label')) return true;
    if (el.hasAttribute('aria-describedby')) return true;
    
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    const styles = window.getComputedStyle(el);
    const hasBorder = styles.borderWidth && parseFloat(styles.borderWidth) > 0;
    const hasPadding = styles.padding && parseFloat(styles.padding) > 0;
    const hasBackground = styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)';
    
    if (hasBorder && hasPadding) return true;
    if (hasBackground && hasPadding && text.length > 3) return true;
    
    if (tagName === 'p' && text.length > 10) return true;
    
    if (tagName === 'td' || tagName === 'th') return true;
    
    const parent = el.parentElement;
    if (parent) {
      const prevSibling = el.previousElementSibling;
      if (prevSibling && prevSibling.tagName.toLowerCase() === 'label') return true;
      
      const parentTag = parent.tagName.toLowerCase();
      if (parentTag === 'form' || parentTag === 'section' || parentTag === 'article') {
        if (text.length > 5) return true;
      }
    }
    
    const classList = el.className || '';
    const dataIndicators = ['data', 'value', 'display', 'info', 'status', 'result', 'output'];
    if (dataIndicators.some(indicator => classList.toLowerCase().includes(indicator))) {
      return true;
    }
    
    const children = el.children;
    if (children.length === 0 && text.length > 5 && text.length < 200) {
      const words = text.split(/\s+/).length;
      if (words >= 2 && words <= 50) return true;
    }
    
    return false;
  }
  
  function processElement(el, isInteractive) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    
    const testId = el.getAttribute('data-testid') || undefined;
    const disabled = el.disabled;
    if (isInteractive && disabled && !testId) return null;
    
    const role = getComputedRole(el);
    const label = getLabelText(el);
    const name = getVisibleText(el);
    const placeholder = el.placeholder || undefined;
    const href = el.href || undefined;
    
    let value;
    if (el.value !== undefined && el.value !== null) value = el.value;
    
    let checked;
    if (el.type === 'checkbox' || el.type === 'radio') {
      checked = el.checked;
    }
    
    const required = el.required;
    
    return {
      id: `node_${ctx}_${idCounter++}`,
      role,
      name: name || label || '',
      testId,
      label,
      placeholder,
      href,
      value,
      ariaChecked: checked,
      disabled: disabled || false,
      required: required || false,
      enabled: !disabled,
      visible: true,
      bounds: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
    };
  }
  
  const interactiveElements = doc.querySelectorAll(interactiveSelector);
  interactiveElements.forEach(function(el) {
    const node = processElement(el, true);
    if (node) results.push(node);
  });
  
  const contentElements = doc.querySelectorAll(contentSelector);
  contentElements.forEach(function(el) {
    if (!el.closest(interactiveSelector)) {
      const node = processElement(el, false);
      if (node) results.push(node);
    }
  });
  
  // Create a Set to track processed elements by their bounds (rounded to avoid floating point issues)
  const processedElements = new Set();
  results.forEach(function(node) {
    const boundsKey = Math.round(node.bounds.x) + ',' + Math.round(node.bounds.y) + ',' + Math.round(node.bounds.w) + ',' + Math.round(node.bounds.h);
    processedElements.add(boundsKey);
  });
  
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(function(el) {
    if (isSalientContent(el)) {
      const rect = el.getBoundingClientRect();
      // Skip if rect is empty (will be filtered by processElement anyway)
      if (rect.width === 0 || rect.height === 0) return;
      
      const boundsKey = Math.round(rect.x) + ',' + Math.round(rect.y) + ',' + Math.round(rect.width) + ',' + Math.round(rect.height);
      
      if (!processedElements.has(boundsKey)) {
        const node = processElement(el, false);
        if (node) {
          results.push(node);
          processedElements.add(boundsKey);
        }
      }
    }
  });
  
  // Sort by Y position to preserve visual order
  results.sort(function(a, b) {
    return a.bounds.y - b.bounds.y;
  });
  
  return results.slice(0, 100);
}

