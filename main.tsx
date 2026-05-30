import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// -----------------------------------------------------------------------------
// Sentry (Error Tracking & Performance Monitoring)
// -----------------------------------------------------------------------------
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '', // Set in .env or CI
  environment: import.meta.env.MODE || 'development',
  tracesSampleRate: 1.0, // Sampling rate for performance traces (0–1)
  beforeSend(event) {
    // Filter or modify events before sending (e.g., strip PII)
    // Return `null` to discard the event entirely
    return event;
  },
});

// -----------------------------------------------------------------------------
// React Root Mount
// -----------------------------------------------------------------------------
const rootElement = document.getElementById('root');
if (!rootElement) {
  // Fail fast with a clear message if the DOM container is missing
  throw new Error(
    'Root element not found. Ensure your index.html contains <div id="root"></div>.'
  );
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);