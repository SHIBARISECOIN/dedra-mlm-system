importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

fetch('/api/public/firebase-config', { cache: 'no-store' })
  .then((res) => {
    if (!res.ok) throw new Error('Firebase config unavailable');
    return res.json();
  })
  .then((firebaseConfig) => {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const title = notification.title || 'DEEDRA';
      const options = {
        body: notification.body || '',
        icon: '/static/favicon.ico',
        badge: '/static/favicon.ico',
        data: payload.data || {}
      };

      self.registration.showNotification(title, options);
    });
  })
  .catch((err) => console.warn('[FCM] background setup skipped:', err.message));
