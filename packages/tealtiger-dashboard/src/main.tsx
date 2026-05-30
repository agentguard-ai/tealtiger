import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { SecurityEventsView } from './security-events-view';
import './security-events-view.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SecurityEventsView />
  </StrictMode>,
);
