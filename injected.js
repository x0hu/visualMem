// Injected script - runs in page context to modify React state
(function() {
  'use strict';
  
  let TARGET_LEVEL = 1;
  let UNLIMITED_LIVES = false;
  let gameStateRef = null;
  let dispatchPatched = false;
  
  // Listen for settings from content script
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SET_MEMORY_SETTINGS') {
      TARGET_LEVEL = event.data.level || 1;
      UNLIMITED_LIVES = event.data.unlimitedLives || false;
    }
  });
  
  // Get React Fiber from root element
  function getFiber(root) {
    for (let key in root) {
      if (key.startsWith('__reactFiber') || key.startsWith('__reactContainer') || key.startsWith('__reactInternalInstance')) {
        return root[key];
      }
    }
    return null;
  }
  
  // Find and patch the memory component
  function patchGameState() {
    const root = document.getElementById('root');
    if (!root) return false;
    
    const fiber = getFiber(root);
    if (!fiber) return false;
    
    let patched = false;
    
    function traverse(f, depth = 0) {
      if (!f || depth > 100) return;
      
      let hook = f.memoizedState;
      while (hook) {
        if (hook.memoizedState && typeof hook.memoizedState === 'object' && hook.memoizedState !== null) {
          const state = hook.memoizedState;
          
          // Found the game state
          if ('stageNum' in state && 'remainingLives' in state && 'phase' in state) {
            gameStateRef = state;
            
            // Set starting level
            if (state.stageNum === 1 && TARGET_LEVEL > 1) {
              state.stageNum = TARGET_LEVEL;
              patched = true;
            }
            
            // Set unlimited lives
            if (UNLIMITED_LIVES && state.remainingLives < 99999) {
              state.remainingLives = 99999;
              patched = true;
            }
            
            // Prevent game over
            if (UNLIMITED_LIVES && state.phase === 'gameover') {
              state.phase = 'splash';
              state.remainingLives = 99999;
              patched = true;
            }
            
            // Patch dispatch function
            if (hook.queue && hook.queue.dispatch && !dispatchPatched) {
              const originalDispatch = hook.queue.dispatch;
              
              hook.queue.dispatch = function(action) {
                if (action && typeof action === 'object') {
                  // Intercept initStage to set custom level
                  if (action.type === 'initStage' && TARGET_LEVEL > 1) {
                    action.stageNum = TARGET_LEVEL;
                  }
                  
                  // Reset lives after each action
                  if (UNLIMITED_LIVES) {
                    const result = originalDispatch.call(this, action);
                    setTimeout(() => {
                      if (gameStateRef && gameStateRef.remainingLives < 99999) {
                        gameStateRef.remainingLives = 99999;
                      }
                      if (hook.queue && hook.queue.lastRenderedState && 'remainingLives' in hook.queue.lastRenderedState) {
                        hook.queue.lastRenderedState.remainingLives = 99999;
                      }
                    }, 0);
                    return result;
                  }
                }
                return originalDispatch.call(this, action);
              };
              
              dispatchPatched = true;
              patched = true;
            }
            
            // Also patch lastRenderedState
            if (hook.queue && hook.queue.lastRenderedState && 'remainingLives' in hook.queue.lastRenderedState) {
              if (UNLIMITED_LIVES && hook.queue.lastRenderedState.remainingLives < 99999) {
                hook.queue.lastRenderedState.remainingLives = 99999;
              }
              if (hook.queue.lastRenderedState.stageNum === 1 && TARGET_LEVEL > 1) {
                hook.queue.lastRenderedState.stageNum = TARGET_LEVEL;
              }
            }
          }
        }
        hook = hook.next;
      }
      
      if (f.child) traverse(f.child, depth + 1);
      if (f.sibling) traverse(f.sibling, depth + 1);
    }
    
    traverse(fiber);
    return patched;
  }
  
  // Monitor and maintain unlimited lives
  function monitorLives() {
    if (!UNLIMITED_LIVES) return;
    
    if (gameStateRef) {
      if (gameStateRef.remainingLives < 99999) {
        gameStateRef.remainingLives = 99999;
      }
      if (gameStateRef.phase === 'gameover') {
        gameStateRef.phase = 'splash';
        gameStateRef.remainingLives = 99999;
      }
      return;
    }
    
    // Search for state if reference lost
    const root = document.getElementById('root');
    if (!root) return;
    
    const fiber = getFiber(root);
    if (!fiber) return;
    
    function findAndFix(f, depth = 0) {
      if (!f || depth > 100) return;
      
      let hook = f.memoizedState;
      while (hook) {
        if (hook.memoizedState && typeof hook.memoizedState === 'object') {
          const state = hook.memoizedState;
          if ('remainingLives' in state && state.remainingLives < 99999) {
            state.remainingLives = 99999;
            gameStateRef = state;
          }
          if ('phase' in state && state.phase === 'gameover') {
            state.phase = 'splash';
            state.remainingLives = 99999;
            gameStateRef = state;
          }
        }
        hook = hook.next;
      }
      
      if (f.child) findAndFix(f.child, depth + 1);
      if (f.sibling) findAndFix(f.sibling, depth + 1);
    }
    
    findAndFix(fiber);
  }
  
  // Handle button clicks
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (btn) {
      const text = btn.textContent.trim();
      if (text === 'Start' || text === 'Try Again' || text === 'Save score') {
        if (text === 'Start' || text === 'Try Again') {
          dispatchPatched = false;
          gameStateRef = null;
        }
        [0, 50, 100, 200, 500, 1000].forEach(delay => {
          setTimeout(patchGameState, delay);
        });
      }
    }
  }, true);
  
  // Initial patching
  let attempts = 0;
  const patchInterval = setInterval(() => {
    attempts++;
    if (attempts > 60) {
      clearInterval(patchInterval);
      return;
    }
    patchGameState();
  }, 500);
  
  // Continuous life monitoring
  setInterval(monitorLives, 100);
})();
