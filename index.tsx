
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Fix: Prevent "process is not defined" or "API Key" errors during module load
// by ensuring a global process object exists before any other imports execute.
(window as any).process = (window as any).process || { env: {} };

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
