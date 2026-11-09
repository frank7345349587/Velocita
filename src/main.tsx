import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('ServiceWorker registration error:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
