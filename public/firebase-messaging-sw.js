importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0904645018",
  appId: "1:604019460073:web:24cb77107f1819e8e5ad78",
  apiKey: "AIzaSyC0Q3FrK1N1Z4wkwLhkBAJsrtBaKiEjP5I",
  authDomain: "gen-lang-client-0904645018.firebaseapp.com",
  storageBucket: "gen-lang-client-0904645018.firebasestorage.app",
  messagingSenderId: "604019460073",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Halal Ottawa';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: payload.data?.url || '/' },
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
