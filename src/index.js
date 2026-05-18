import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Global error handler to catch and log errors without breaking the app
window.addEventListener('error', (event) => {
  // Suppress Clarity-related errors to prevent app crashes
  if (event.filename && (event.filename.includes('clarity.ms') || event.filename.includes('core.js'))) {
    console.warn('Analytics error suppressed:', event.message);
    event.preventDefault();
    return false;
  }
});

// Handle unhandled promise rejections (like the Clarity error)
window.addEventListener('unhandledrejection', (event) => {
  // Check if error is from Clarity or analytics
  const errorMessage = event.reason?.message || event.reason?.toString() || '';
  if (errorMessage.includes('payload') || event.reason?.stack?.includes('clarity.ms') || event.reason?.stack?.includes('core.js')) {
    console.warn('Analytics promise rejection suppressed:', event.reason);
    event.preventDefault();
    return false;
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const SW_MIGRATION_VERSION = '2026-05-18-2';
    const migrationKey = 'brikx-sw-migration-version';
    const publicBasePath = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
    const serviceWorkerUrl = `${publicBasePath}/service-worker.js`;

    const migrateServiceWorkerState = async () => {
      const previousVersion = localStorage.getItem(migrationKey);

      if (previousVersion === SW_MIGRATION_VERSION) {
        return;
      }

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((cacheKey) => cacheKey.startsWith('brickx-'))
          .map((cacheKey) => caches.delete(cacheKey))
      );

      localStorage.setItem(migrationKey, SW_MIGRATION_VERSION);
    };

    migrateServiceWorkerState()
      .catch((migrationError) => {
        console.warn('SW migration skipped:', migrationError);
      })
      .finally(() => navigator.serviceWorker.register(serviceWorkerUrl))
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update();
        }, 60000);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('SW update found!');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker installed, notify user
              console.log('New version available!');
              
              // Dispatch custom event for the app to handle
              window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
                detail: { registration }
              }));
            }
          });
        });
        
        // Let the app control when to activate updates
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
