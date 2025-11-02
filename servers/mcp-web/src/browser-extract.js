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
      'label': 'label'
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
  
  function processElement(el, isInteractive) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    
    const disabled = el.disabled;
    if (isInteractive && disabled) return null;
    
    const role = getComputedRole(el);
    const testId = el.getAttribute('data-testid') || undefined;
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
  
  return results.slice(0, 50);
}

