
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical: Could not find root element '#root' in the DOM.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("FamEats: React mounted successfully.");
  } catch (error) {
    console.error("FamEats: React rendering failed during startup:", error);
    
    // Provide a user-friendly error fallback if the app crashes before it can even show its own loader
    rootElement.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', -apple-system, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; background: white; border-radius: 32px; shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);">
        <div style="font-size: 64px; margin-bottom: 24px;">🍽️</div>
        <h2 style="color: #111827; font-weight: 800; font-size: 24px; margin-bottom: 12px;">Failed to Load</h2>
        <p style="color: #6b7280; line-height: 1.6; margin-bottom: 24px;">
          Something went wrong while starting the kitchen. This usually happens if the connection is poor or a script failed to download.
        </p>
        <button onclick="window.location.reload()" style="background: #ea580c; color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 700; cursor: pointer; font-size: 16px; transition: all 0.2s;">
          Try Refreshing
        </button>
        <div style="margin-top: 40px; text-align: left; background: #f9fafb; padding: 20px; border-radius: 16px; font-size: 11px; color: #9ca3af; border: 1px solid #f3f4f6; overflow: auto; max-height: 200px;">
          <strong style="display: block; margin-bottom: 8px; color: #4b5563;">Error Diagnostics:</strong>
          <code style="word-break: break-all;">${error instanceof Error ? error.message : String(error)}</code>
          <br/><br/>
          <span style="opacity: 0.7;">User Agent: ${navigator.userAgent}</span>
        </div>
      </div>
    `;
    
    // Add simple hover effect to the injected button
    const btn = rootElement.querySelector('button');
    if (btn) {
      btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
      btn.onmouseout = () => btn.style.transform = 'scale(1)';
    }
  }
}
