// Content script to receive cookies from extension and save to localStorage
// This runs in the page context and can access localStorage directly

console.log('Socialora content script loaded');

// Listen for messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_COOKIES') {
    const { userId, cookies } = message;
    const storageKey = `socialora_cookies_${userId}`;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(cookies));
      console.log(`✓ Cookies saved to localStorage via content script (key: ${storageKey})`);
      
      // Trigger events to notify the page
      window.dispatchEvent(new CustomEvent('socialora_cookies_saved', { 
        detail: { userId, storageKey, cookies } 
      }));
      
      window.postMessage({
        type: 'SOCIALORA_COOKIES_SAVED',
        userId: userId,
        cookies: cookies,
        storageKey: storageKey
      }, window.location.origin);
      
      sendResponse({ success: true });
      return true;
    } catch (e) {
      console.error('Failed to save cookies via content script:', e);
      sendResponse({ success: false, error: e.message });
      return true;
    }
  }
  
  return false;
});

// Also listen for page load to check if we need to inject cookies
window.addEventListener('load', () => {
  console.log('Page loaded, content script ready');
});

