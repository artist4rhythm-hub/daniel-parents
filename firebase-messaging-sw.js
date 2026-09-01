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

/* 📛 앱 아이콘 숫자 뱃지 — 도착할 때 +1, 앱을 열면 홈 화면이 0으로 되돌린다.
   (아이폰·아이패드 설치 앱에서 숫자 표시 · 안드로이드는 시스템 점/숫자 자동) */
function badgeCount(mode, val){
  return new Promise((resolve)=>{
    try{
      const rq = indexedDB.open('pushBadge', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onerror = () => resolve(0);
      rq.onsuccess = () => {
        const db = rq.result;
        const tx = db.transaction('kv', 'readwrite');
        const st = tx.objectStore('kv');
        if(mode === 'set'){ st.put(val, 'n'); tx.oncomplete = () => resolve(val); }
        else {
          const g = st.get('n');
          g.onsuccess = () => {
            const cur = (g.result || 0) + 1;
            st.put(cur, 'n');
            tx.oncomplete = () => resolve(cur);
          };
          g.onerror = () => resolve(1);
        }
      };
    }catch(e){ resolve(0); }
  });
}
async function bumpBadge(){
  try{
    const n = await badgeCount('bump');
    if(n > 0 && 'setAppBadge' in self.navigator) await self.navigator.setAppBadge(n);
  }catch(e){}
}

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = n.title || d.title || '학교 소식';
  const body  = n.body  || d.body  || '';
  bumpBadge();
  self.registration.showNotification(title, {
    body,
    icon: d.icon || 'logo-daniel-color.png',
    data: { link: d.link || '' },
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  try{ badgeCount('set', 0); if('clearAppBadge' in self.navigator) self.navigator.clearAppBadge(); }catch(err){}
  const link = (e.notification.data && e.notification.data.link) || '/daniel-parents/index.html';
  e.waitUntil(clients.openWindow(link));
});
