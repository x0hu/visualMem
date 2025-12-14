// Content script - injects the patcher into the page context
(function() {
  'use strict';
  
  chrome.storage.sync.get(['startingLevel', 'unlimitedLives'], function(result) {
    const startingLevel = result.startingLevel || 1;
    const unlimitedLives = result.unlimitedLives || false;
    
    // Only inject if we need to modify something
    if (startingLevel === 1 && !unlimitedLives) {
      return;
    }
    
    // Inject script file into page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
      // Send settings to the injected script
      window.postMessage({
        type: 'SET_MEMORY_SETTINGS',
        level: startingLevel,
        unlimitedLives: unlimitedLives
      }, '*');
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  });
})();
