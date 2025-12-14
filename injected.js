// This script runs in the page context (not extension context)
(function() {
  'use strict';
  
  // Settings from the extension
  let TARGET_LEVEL = 1;
  let UNLIMITED_LIVES = false;
  
  // Listen for settings from content script
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SET_MEMORY_SETTINGS') {
      TARGET_LEVEL = event.data.level || 1;
      UNLIMITED_LIVES = event.data.unlimitedLives || false;
      console.log('[Level Selector] Received settings - Level:', TARGET_LEVEL, 'Unlimited Lives:', UNLIMITED_LIVES);
    }
  });
  
  // Store reference to the game state for continuous monitoring
  let gameStateRef = null;
  let dispatchPatched = false;
  
  // Find and patch the memory component
  function aggressivePatch() {
    const root = document.getElementById('root');
    if (!root) return false;
    
    // Get React Fiber
    let fiber = null;
    for (let key in root) {
      if (key.startsWith('__reactFiber') || key.startsWith('__reactContainer') || key.startsWith('__reactInternalInstance')) {
        fiber = root[key];
        break;
      }
    }
    
    if (!fiber) return false;
    
    let patchedSomething = false;
    
    // Traverse ALL fibers
    function traverseAndPatch(f, depth = 0) {
      if (!f || depth > 100) return;
      
      // Check hooks in memoizedState (linked list)
      let hook = f.memoizedState;
      let hookIndex = 0;
      
      while (hook) {
        // Check if this hook's memoizedState has the game state
        if (hook.memoizedState && typeof hook.memoizedState === 'object' && hook.memoizedState !== null) {
          const state = hook.memoizedState;
          
          // Check for memory test state - look for remainingLives (the actual key name)
          if ('stageNum' in state && 'remainingLives' in state && 'phase' in state) {
            console.log('[Level Selector] FOUND game state! stageNum:', state.stageNum, 'remainingLives:', state.remainingLives, 'phase:', state.phase);
            
            // Store reference for monitoring
            gameStateRef = state;
            
            // Modify starting level
            if (state.stageNum === 1 && TARGET_LEVEL > 1) {
              state.stageNum = TARGET_LEVEL;
              console.log('[Level Selector] Set stageNum to', TARGET_LEVEL);
              patchedSomething = true;
            }
            
            // Modify remainingLives if unlimited lives is enabled
            if (UNLIMITED_LIVES && state.remainingLives < 99999) {
              state.remainingLives = 99999;
              console.log('[Level Selector] Set remainingLives to 99999');
              patchedSomething = true;
            }
            
            // Prevent game over
            if (UNLIMITED_LIVES && state.phase === 'gameover') {
              state.phase = 'splash';
              state.remainingLives = 99999;
              console.log('[Level Selector] Prevented game over, reset to splash');
              patchedSomething = true;
            }
            
            // Patch dispatch function to intercept actions
            if (hook.queue && hook.queue.dispatch && !dispatchPatched) {
              const originalDispatch = hook.queue.dispatch;
              
              hook.queue.dispatch = function(action) {
                console.log('[Level Selector] Action:', action?.type || action);
                
                if (action && typeof action === 'object') {
                  // Intercept initStage - set custom level
                  if (action.type === 'initStage' && TARGET_LEVEL > 1) {
                    console.log('[Level Selector] Intercepting initStage, setting level to', TARGET_LEVEL);
                    action.stageNum = TARGET_LEVEL;
                  }
                  
                  // For unlimited lives, we'll reset lives after each action
                  if (UNLIMITED_LIVES) {
                    const result = originalDispatch.call(this, action);
                    
                    // Reset lives after action completes
                    setTimeout(() => {
                      if (gameStateRef && gameStateRef.remainingLives < 99999) {
                        gameStateRef.remainingLives = 99999;
                        console.log('[Level Selector] Reset remainingLives after action');
                      }
                      // Also update lastRenderedState
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
              console.log('[Level Selector] Patched dispatch function');
              patchedSomething = true;
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
        hookIndex++;
      }
      
      // Traverse children and siblings
      if (f.child) traverseAndPatch(f.child, depth + 1);
      if (f.sibling) traverseAndPatch(f.sibling, depth + 1);
    }
    
    traverseAndPatch(fiber);
    
    return patchedSomething;
  }
  
  // Continuously monitor and fix lives
  function monitorLives() {
    if (!UNLIMITED_LIVES) return;
    
    // Use stored reference if available
    if (gameStateRef) {
      if (gameStateRef.remainingLives < 99999) {
        gameStateRef.remainingLives = 99999;
        console.log('[Level Selector] Monitor: Reset remainingLives to 99999');
      }
      if (gameStateRef.phase === 'gameover') {
        gameStateRef.phase = 'splash';
        gameStateRef.remainingLives = 99999;
        console.log('[Level Selector] Monitor: Prevented game over');
      }
      return;
    }
    
    // Otherwise search for it
    const root = document.getElementById('root');
    if (!root) return;
    
    let fiber = null;
    for (let key in root) {
      if (key.startsWith('__reactFiber') || key.startsWith('__reactContainer')) {
        fiber = root[key];
        break;
      }
    }
    
    if (!fiber) return;
    
    function fixLives(f, depth = 0) {
      if (!f || depth > 100) return;
      
      let hook = f.memoizedState;
      while (hook) {
        if (hook.memoizedState && typeof hook.memoizedState === 'object') {
          const state = hook.memoizedState;
          
          // Fix remainingLives
          if ('remainingLives' in state && state.remainingLives < 99999) {
            state.remainingLives = 99999;
            gameStateRef = state;
            console.log('[Level Selector] Monitor: Reset remainingLives to 99999');
          }
          
          // Prevent game over
          if ('phase' in state && state.phase === 'gameover') {
            state.phase = 'splash';
            state.remainingLives = 99999;
            gameStateRef = state;
            console.log('[Level Selector] Monitor: Prevented game over');
          }
        }
        hook = hook.next;
      }
      
      if (f.child) fixLives(f.child, depth + 1);
      if (f.sibling) fixLives(f.sibling, depth + 1);
    }
    
    fixLives(fiber);
  }
  
  // Intercept button clicks
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (btn) {
      const text = btn.textContent.trim();
      if (text === 'Start' || text === 'Try Again' || text === 'Save score') {
        console.log('[Level Selector] Button clicked:', text);
        // Reset dispatch patched flag on new game
        if (text === 'Start' || text === 'Try Again') {
          dispatchPatched = false;
          gameStateRef = null;
        }
        [0, 50, 100, 200, 500, 1000].forEach(delay => {
          setTimeout(() => aggressivePatch(), delay);
        });
      }
    }
  }, true);
  
  // Start patching
  console.log('[Level Selector] Script loaded, starting...');
  
  // Initial patch attempts
  let attempts = 0;
  const patchInterval = setInterval(() => {
    attempts++;
    if (attempts > 60) {
      clearInterval(patchInterval);
      return;
    }
    aggressivePatch();
  }, 500);
  
  // Continuous life monitoring (faster interval)
  setInterval(() => {
    monitorLives();
  }, 100);
})();
