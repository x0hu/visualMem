document.addEventListener('DOMContentLoaded', function() {
  const levelInput = document.getElementById('level');
  const unlimitedLivesCheckbox = document.getElementById('unlimitedLives');
  const saveButton = document.getElementById('save');
  
  // Load saved settings
  chrome.storage.sync.get(['startingLevel', 'unlimitedLives'], function(result) {
    if (result.startingLevel) {
      levelInput.value = result.startingLevel;
    }
    if (result.unlimitedLives) {
      unlimitedLivesCheckbox.checked = result.unlimitedLives;
    }
  });
  
  // Save settings and reload
  saveButton.addEventListener('click', function() {
    const level = parseInt(levelInput.value, 10);
    const unlimitedLives = unlimitedLivesCheckbox.checked;
    
    if (isNaN(level) || level < 1) {
      alert('Please enter a valid level (1 or higher)');
      return;
    }
    
    chrome.storage.sync.set({
      startingLevel: level,
      unlimitedLives: unlimitedLives
    }, function() {
      // Get current tab and reload if on memory test page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('humanbenchmark.com/tests/memory')) {
          chrome.tabs.reload(tabs[0].id);
        } else {
          alert(`Settings saved! Navigate to the Visual Memory Test page and refresh.`);
        }
      });
    });
  });
});
