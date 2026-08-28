/* 🔔 학부모 사이트 푸시 알림 — 백그라운드 수신 (앱이 닫혀 있어도 알림이 옵니다) */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCtgr79jKqkec6HwqkxYNxSubWAhfEkM7g",
  authDomain: "daniel-amatz.firebaseapp.com",
  projectId: "daniel-amatz",
  storageBucket: "daniel-amatz.firebasestorage.app",
  messagingSenderId: "455744290312",
  appId: "1:455744290312:web:3ce7e7d3e58f6f1d185bbd"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = n.title || d.title || '학교 소식';
  const body  = n.body  || d.body  || '';
  self.registration.showNotification(title, {
    body,
    icon: d.icon || 'logo-daniel-color.png',
    data: { link: d.link || '' },
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/daniel-parents/index.html';
  e.waitUntil(clients.openWindow(link));
});
