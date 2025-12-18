
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

const showError = (error: any) => {
  if (!rootElement) return;
  console.error("FamEats Startup Error:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; font-family: sans-serif; max-width: 500px; margin: 100px auto; text-align: center; background: white; border-radius: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 1px solid #eee;">
      <div style="font-size: 64px; margin-bottom: 24px;">🍽️</div>
      <h2 style="color: #111827; font-weight: 800; font-size: 24px; margin-bottom: 12px;">Kitchen Closed Temporarily</h2>
      <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        We couldn't start the app. This is usually due to a script loading error or an incompatible browser setting.
      </p>
      <button onclick="window.location.reload()" style="background: #ea580c; color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 16px; width: 100%;">
        Refresh Page
      </button>
      <div style="margin-top: 32px; text-align: left; background: #f9fafb; padding: 16px; border-radius: 12px; font-size: 12px; color: #ef4444; border: 1px solid #fee2e2; overflow-x: auto;">
        <code>${error instanceof Error ? error.stack || error.message : String(error)}</code>
      </div>
    </div>
  `;
};

if (!rootElement) {
  console.error("Critical: #root element missing");
} else {
  try {
    // Basic verification of dependencies before mounting
    if (typeof React === 'undefined') throw new Error("React is not loaded. Check importmap/network.");
    
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("FamEats: App mounted successfully.");
  } catch (err) {
    showError(err);
  }
}

// Global error handler to catch unhandled promise rejections (like module load failures)
window.addEventListener('unhandledrejection', (event) => {
  showError(`Unhandled Rejection: ${event.reason}`);
});
