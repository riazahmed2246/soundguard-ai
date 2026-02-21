import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AudioProvider } from './context/AudioContext';
import App from './App';

// ─────────────────────────────────────────────────────────────
//  Mount the React tree
//  AudioProvider wraps App so every component in the tree
//  can access shared audio state via useAudio() without
//  prop-drilling.
// ─────────────────────────────────────────────────────────────
const container = document.getElementById('root');

if (!container) {
  throw new Error(
    '[main.jsx] Could not find #root element. ' +
    'Check that /client/public/index.html contains <div id="root"></div>.'
  );
}

createRoot(container).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>
);