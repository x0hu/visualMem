// Content script - injects script file instead of inline code
(function() {
  'use strict';
  
  chrome.storage.sync.get(['startingLevel', 'unlimitedLives'], function(result) {
    const startingLevel = result.startingLevel || 1;
    const unlimitedLives = result.unlimitedLives || false;
    
    console.log('[Level Selector] Content script loaded');
    console.log('[Level Selector] Starting level:', startingLevel);
    console.log('[Level Selector] Unlimited lives:', unlimitedLives);
    
    // Only inject if we need to modify something
    if (startingLevel === 1 && !unlimitedLives) {
      console.log('[Level Selector] No modifications needed');
      return;
    }
    
    // Inject script file (not inline)
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      // Send settings to the injected script
      window.postMessage({
        type: 'SET_MEMORY_SETTINGS',
        level: startingLevel,
        unlimitedLives: unlimitedLives
      }, '*');
      console.log('[Level Selector] Injected script loaded, sent settings');
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  });
})();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_MEMORY_LEVEL') {
    chrome.storage.sync.set({ startingLevel: request.level }, () => {
      sendResponse({ success: true });
      window.location.reload();
    });
    return true;
  }
});
