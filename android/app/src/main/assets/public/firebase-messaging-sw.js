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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
