// Socialora Background Service Worker
// Handles cookie access and communication

// Import config
importScripts('config.js');

// Helper function to build API URL safely (removes trailing slashes)
function buildApiUrl(baseUrl, path) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_COOKIES') {
    getInstagramCookies().then(sendResponse);
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'VERIFY_SESSION') {
    verifySession(message.cookies).then(sendResponse);
    return true;
  }
  
  // Handle request for cookies from page (fallback mechanism)
  if (message.type === 'GET_STORED_COOKIES') {
    const userId = message.userId;
    const storageKey = `socialora_cookies_${userId}`;
    chrome.storage.local.get([storageKey], (result) => {
      sendResponse({ success: true, cookies: result[storageKey] || null });
    });
    return true;
  }
});

// Get all Instagram cookies
async function getInstagramCookies() {
  const cookies = await chrome.cookies.getAll({ domain: 'instagram.com' });
  
  const cookieMap = {};
  cookies.forEach(cookie => {
    cookieMap[cookie.name] = cookie.value;
  });

  return {
    sessionId: cookieMap['sessionid'] || '',
    csrfToken: cookieMap['csrftoken'] || '',
    dsUserId: cookieMap['ds_user_id'] || '',
    mid: cookieMap['mid'] || '',
    igDid: cookieMap['ig_did'] || '',
    rur: cookieMap['rur'] || ''
  };
}

// Verify session with backend
async function verifySession(cookies) {
  try {
    // Get current backend URL from config
    const config = await CONFIG.getCurrent();
    const url = buildApiUrl(config.BACKEND_URL, 'api/instagram/cookie/verify');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Verify session error:', error);
    return { success: false, error: error.message || 'Failed to connect to backend' };
  }
}

// Extension installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Socialora Instagram Session Grabber installed');
});

