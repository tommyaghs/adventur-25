// Service Worker per le notifiche programmate
const CACHE_NAME = 'advent-calendar-v1';
const NOTIFICATION_TITLE = 'Calendario dell\'Avvento 🎄';
const NOTIFICATION_BODY = 'Ricorda di aprire la tua casella del calendario dell\'avvento!';

// Installa il Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installato');
  self.skipWaiting();
});

// Attiva il Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker attivato');
  event.waitUntil(self.clients.claim());
});

// Gestisce i messaggi dal client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { timeUntilMidnight } = event.data;
    scheduleNotification(timeUntilMidnight);
  }
});

// Funzione per programmare una notifica
function scheduleNotification(timeUntilMidnight) {
  // Cancella eventuali notifiche programmate precedenti
  self.registration.getNotifications({ tag: 'advent-calendar-reminder' })
    .then(notifications => {
      notifications.forEach(notification => notification.close());
    });

  // Programma la notifica per la prossima mezzanotte
  setTimeout(() => {
    showNotification();
    
    // Poi programma una notifica ogni 24 ore
    setInterval(() => {
      showNotification();
    }, 24 * 60 * 60 * 1000); // 24 ore
  }, timeUntilMidnight);
}

// Funzione per mostrare la notifica
function showNotification() {
  self.registration.showNotification(NOTIFICATION_TITLE, {
    body: NOTIFICATION_BODY,
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: 'advent-calendar-reminder',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin
    }
  });
}

// Gestisce il click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se c'è già una finestra aperta, portala in primo piano
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});

