
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

const showError = (error: any) => {
  if (!rootElement) return;
  console.error("FamEats Startup Error:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 60px auto; text-align: center; background: white; border-radius: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border: 1px solid #eee;">
      <div style="font-size: 64px; margin-bottom: 24px;">🍽️</div>
      <h2 style="color: #111827; font-weight: 800; font-size: 24px; margin-bottom: 12px;">App Failed to Load</h2>
      <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
        This usually happens due to an incompatible browser or a temporary connection issue with our script provider.
      </p>
      <button onclick="window.location.reload()" style="background: #ea580c; color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 16px; width: 100%; transition: opacity 0.2s;">
        Reload App
      </button>
      <div style="margin-top: 32px; text-align: left; background: #f9fafb; padding: 16px; border-radius: 12px; font-size: 11px; color: #ef4444; border: 1px solid #fee2e2; overflow-x: auto; max-height: 150px;">
        <code style="white-space: pre-wrap; word-break: break-all;">${error instanceof Error ? error.message : String(error)}</code>
      </div>
    </div>
  `;
};

if (!rootElement) {
  console.error("Critical error: #root element missing in HTML");
} else {
  try {
    // Check if dependencies are actually resolved from importmap
    if (typeof React === 'undefined') {
      throw new Error("React library failed to load from the CDN. Please check your internet connection.");
    }
    
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("FamEats: Application successfully mounted.");
  } catch (err) {
    showError(err);
  }
}

// Catch unexpected promise rejections (CDN timeouts, etc)
window.addEventListener('unhandledrejection', (event) => {
  showError(`Async Loading Error: ${event.reason}`);
});
