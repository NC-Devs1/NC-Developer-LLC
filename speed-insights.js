// Vercel Speed Insights initialization
// This script initializes Speed Insights for static HTML sites
(function() {
  // Initialize the queue if it doesn't exist
  window.si = window.si || function() {
    (window.siq = window.siq || []).push(arguments);
  };

  // Create and inject the Speed Insights script
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  
  // Add SDK metadata
  script.setAttribute('data-sdkn', '@vercel/speed-insights');
  script.setAttribute('data-sdkv', '2.0.0');
  
  script.onerror = function() {
    console.log('[Vercel Speed Insights] Failed to load script. Please check if any content blockers are enabled.');
  };
  
  document.head.appendChild(script);
})();
