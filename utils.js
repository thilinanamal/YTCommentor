// Shared button and dropdown styles
const BUTTON_STYLES = {
  primary: `
    background: #065fd4;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 18px;
    cursor: pointer;
    margin: 8px;
    font-size: 14px;
  `,
  secondary: `
    background: #065fd4;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 18px;
    cursor: pointer;
    margin-top: 8px;
    font-size: 12px;
    display: block;
    width: 100%;
  `
};

const DROPDOWN_STYLES = `
  display: none;
  position: absolute;
  background-color: #f9f9f9;
  min-width: 200px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  padding: 12px;
  z-index: 1000;
  border-radius: 8px;
  margin-top: 4px;
  color: #000000;
`;

// Helper function to create a suggestion button
function createButton(text, style) {
  const button = document.createElement('button');
  button.innerHTML = text;
  button.style.cssText = style;
  return button;
}

// Helper function to create a dropdown container
function createDropdown() {
  const dropdown = document.createElement('div');
  dropdown.style.cssText = DROPDOWN_STYLES;
  return dropdown;
}

// Helper function to trigger input events
function triggerInputEvents(element) {
  // Basic input and change events
  const events = [
    new InputEvent('input', { bubbles: true, composed: true }),
    new Event('change', { bubbles: true, composed: true }),
    // Add blur event to trigger validation
    new FocusEvent('blur', { bubbles: true, composed: true }),
    // Add YouTube Studio specific events
    new CustomEvent('bind-value-changed', { 
      detail: { value: element.value || element.textContent }, 
      bubbles: true, 
      composed: true 
    }),
    new CustomEvent('iron-input-ready', { 
      bubbles: true, 
      composed: true 
    })
  ];

  // Dispatch all events
  events.forEach(event => {
    element.dispatchEvent(event);
  });

  // Also dispatch to parent elements that might be custom elements
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName && parent.tagName.toLowerCase().includes('-')) {
      events.forEach(event => {
        parent.dispatchEvent(event);
      });
    }
    parent = parent.parentElement;
  }
}

export {
  BUTTON_STYLES,
  DROPDOWN_STYLES,
  createButton,
  createDropdown,
  triggerInputEvents
};