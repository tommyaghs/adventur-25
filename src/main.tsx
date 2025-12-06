import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Registrazione del Service Worker per PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usa il base path corretto per lo sviluppo e la produzione
    const swPath = import.meta.env.BASE_URL + 'sw.js';
    navigator.serviceWorker.register(swPath, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        console.log('Service Worker registrato con successo:', registration.scope);
        
        // Controlla se c'è un aggiornamento disponibile
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nuovo service worker disponibile
                console.log('Nuovo Service Worker disponibile');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('Registrazione Service Worker fallita:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
