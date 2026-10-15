/* ═══════════════════════════════════════════════
   parent-login.js — 학부모 로그인 · 자녀 연결 (v122 · 두 기관 공용)
   · 로그인: 🟢 구글로 계속하기 (맨 위) · ✉️ 이메일 링크 · 🔑 비밀번호 (구글 계정이 없는 가정)
   · 자녀 연결: 한 화면 — 코드를 다 넣으면 «김*준 · 3학년 샬롬반»이 바로 보이고, 맞으면 연결
     연결은 학교 «출입 서버»가 코드를 확인하고 만든다 (학부모 화면은 연결 문서를 직접 쓰지 않음 · 규칙 v30)
   · 막히면(코드 만료 · 틀림 · 다른 기관 · 보호자 칸 다 참 · 졸업) 이유와 할 일을 그 자리에 보여 준다
   · QR: 가정통신문의 QR은 «login-기관.html?code=…» 주소 — 열면 코드가 저절로 채워진다
   ═══════════════════════════════════════════════ */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signOut, signInWithEmailAndPassword, updatePassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
         onAuthStateChanged, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { loadPass, callGate, gateUrl, normPass, kidsOf, endedOf, kidNote, endedText, maskEmail, inAppBrowser, openExternal, ORG_NAME } from './gate.js?v=124';

export function start(ORG){
const OTHER = ORG === 'daniel' ? 'jihyebit' : 'daniel';
const ORGN = ORG_NAME[ORG];
const app = initializeApp({
  apiKey: "AIzaSyCtgr79jKqkec6HwqkxYNxSubWAhfEkM7g",
  authDomain: "daniel-amatz.firebaseapp.com",
  projectId: "daniel-amatz",
  storageBucket: "daniel-amatz.firebasestorage.app",
  messagingSenderId: "455744290312",
  appId: "1:455744290312:web:3ce7e7d3e58f6f1d185bbd",
  measurementId: "G-E91V0S88T8"
});
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });   /* 🔌 막히는 네트워크 자동 우회 */
setPersistence(auth, browserLocalPersistence).catch(()=>{});

const EMAIL_KEY = 'gyosa_parent_email';
const CODE_KEY = 'parent_pending_code';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show = id => { document.querySelectorAll('.step').forEach(s => s.classList.remove('on')); $(id).classList.add('on'); };
const alertShow = (id, msg) => { const e = $(id); if(!e) return; e.innerHTML = msg; e.classList.add('on'); };
const alertHide = id => { const e = $(id); if(e) e.classList.remove('on'); };
const hm = t => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
const CODE_RE = /^[A-Z]{2}-[A-Z0-9]{2}-[A-Z0-9]{4,5}$/;
function normCode(v){
  const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(s.length <= 2) return s;
  if(s.length <= 4) return s.slice(0, 2) + '-' + s.slice(2);
  return s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 9);
}

/* ── QR · 링크로 들어온 코드 — 로그인 전에도 잃지 않게 기억 ── */
const qs = new URLSearchParams(location.search);
try{
  const qc = qs.get('code');
  if(qc){ localStorage.setItem(CODE_KEY, normCode(qc)); qs.delete('code');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : '')); }
}catch(e){}
const pendingCode = () => { try{ return localStorage.getItem(CODE_KEY) || ''; }catch(e){ return ''; } };
const clearPending = () => { try{ localStorage.removeItem(CODE_KEY); }catch(e){} };

/* ═══ STEP 1: 로그인 ═══ */
const INAPP = inAppBrowser();
(function paintLogin(){
  const pc = pendingCode();
  if(pc && $('code-hint')){ $('code-hint').innerHTML = `🎫 자녀 코드 <b>${esc(pc)}</b>가 준비되어 있어요 — 로그인하면 바로 이어져요.`; $('code-hint').style.display = ''; }
  if(INAPP){
    $('btn-google').style.display = 'none';
    const box = $('inapp-box'); box.style.display = '';
    const kakao = INAPP === 'kakao', android = /Android/i.test(navigator.userAgent || '');
    box.innerHTML = `<div class="lk-ic">💬</div><div class="lk-t">${kakao ? '카카오톡' : '이 앱'} 안에서는<br>구글 로그인이 막혀 있어요</div>
      <div class="lk-s">${kakao ? '카카오톡이' : '앱 안 화면이'} 아니라 휴대폰 브라우저(사파리 · 크롬)에서 열어야 해요.</div>
      ${(kakao || android) ? `<button class="btn" type="button" onclick="openOut()">사파리 · 크롬으로 열기</button>`
        : `<div class="lk-s" style="margin-top:8px">오른쪽 위 <b>⋯</b> 또는 <b>공유</b> 단추 → <b>«Safari로 열기»</b>를 눌러 주세요.</div>`}`;
    $('g-note').innerHTML = '브라우저로 옮기기 어려우면 아래 <b>«이메일로 로그인»</b>을 쓰셔도 돼요.';
  }
})();
window.openOut = () => { if(!openExternal(location.href)) alert('오른쪽 위 ⋯ 단추에서 «Safari로 열기»를 눌러 주세요.'); };
window.openEmail = () => { $('email-wrap').style.display = ''; $('btn-email-open').style.display = 'none'; setTimeout(() => $('email').focus(), 50); };

window.googleLogin = async function(){
  alertHide('g-err');
  const btn = $('btn-google'); btn.disabled = true;
  try{
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, p);
    // 이후 흐름은 onAuthStateChanged 가 처리 (자녀 있으면 홈, 없으면 연결 화면)
  }catch(e){
    const c = e && e.code || '';
    if(c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request'){ /* 그냥 닫음 */ }
    else if(c === 'auth/popup-blocked') alertShow('g-err', '로그인 창이 막혔어요. 한 번 더 눌러 주세요 — 그래도 안 되면 «이메일로 로그인»을 써 주세요.');
    else if(c === 'auth/account-exists-with-different-credential') alertShow('g-err', '이 메일 주소는 이미 <b>이메일 로그인</b>으로 쓰고 계세요. 아래 «이메일로 로그인»으로 들어와 주세요 — 자녀 연결은 그대로예요.');
    else if(c === 'auth/operation-not-allowed') alertShow('g-err', '학교에서 구글 로그인을 아직 켜지 않았어요. 아래 «이메일로 로그인»을 써 주세요.');
    else if(c === 'auth/unauthorized-domain') alertShow('g-err', '이 주소에서는 구글 로그인을 쓸 수 없어요 (학교 설정 필요). «이메일로 로그인»을 써 주세요.');
    else if(c === 'auth/network-request-failed') alertShow('g-err', '인터넷 연결을 확인해 주세요.');
    else if(c === 'auth/web-storage-unsupported' || c === 'auth/operation-not-supported-in-this-environment') alertShow('g-err', '이 화면에서는 구글 로그인이 안 돼요. 사파리 · 크롬에서 열거나 «이메일로 로그인»을 써 주세요.');
    else alertShow('g-err', '구글 로그인에 실패했어요: ' + esc(c || e.message || ''));
  }finally{ btn.disabled = false; }
};

let PW_MODE = false;
window.togglePwMode = function(){
  PW_MODE = !PW_MODE;
  $('pw-wrap').style.display = PW_MODE ? '' : 'none';
  $('btn-pw').style.display  = PW_MODE ? '' : 'none';
  $('btn-send').style.display = PW_MODE ? 'none' : '';
  $('btn-mode').innerHTML = PW_MODE ? '✉️ 이메일 링크로 로그인하기' : '🔑 비밀번호로 로그인하기';
  $('mode-note').innerHTML = PW_MODE
    ? '처음이시거나 비밀번호를 <b>잊으셨다면</b> ✉️ 이메일 링크로 로그인한 뒤 새로 만들면 돼요 — 예전 비밀번호는 자동으로 사라지고, 자녀 연결은 그대로 유지됩니다.'
    : '비밀번호가 없어도 됩니다 — 이메일로 로그인 링크를 보내드려요. <b>홈 화면에 설치한 앱</b>에서는 비밀번호 로그인이 편해요 (아래에서 전환).';
  if(PW_MODE) $('pw-in').focus();
};
window.pwLogin = async function(){
  const email = $('email').value.trim(), pw = $('pw-in').value;
  const err = $('email-err'); err.classList.remove('on');
  if(!email || !pw){ err.textContent = '이메일과 비밀번호를 입력해 주세요.'; err.classList.add('on'); return; }
  const btn = $('btn-pw'); btn.disabled = true;
  try{
    await signInWithEmailAndPassword(auth, email, pw);
  }catch(e){
    btn.disabled = false;
    err.textContent = (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found')
      ? '이메일 또는 비밀번호가 맞지 않아요. 잊으셨다면 ✉️ 이메일 링크로 로그인해 새 비밀번호를 만들면 됩니다.'
      : '로그인에 실패했습니다: ' + (e.code || e.message);
    err.classList.add('on');
  }
};
window.sendLink = async function(){
  alertHide('email-err');
  const email = $('email').value.trim().toLowerCase();
  if(!validEmail(email)){ alertShow('email-err', '올바른 이메일 주소를 입력해 주세요.'); return; }
  const btn = $('btn-send'); btn.disabled = true;
  const orig = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>';
  try {
    const actionCodeSettings = { url: location.origin + location.pathname, handleCodeInApp: true };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem(EMAIL_KEY, email);
    try { await addDoc(collection(db, 'parentAuthLogs'), { email, requestedAt: Timestamp.now(), clicked: false, ua: navigator.userAgent || '' }); } catch(e){}
    $('sent-email').textContent = email;
    show('step-sent');
  } catch(e){
    alertShow('email-err', '링크 발송에 실패했습니다: ' + esc(e.code || e.message));
  } finally {
    btn.disabled = false; btn.innerHTML = orig;
  }
};
window.backToEmail = function(){ show('step-email'); };

/* ── ⏳ 로그인 진행바 ── */
const LP = {
  pct: 3, target: 3, timer: null,
  start(){
    if(this.timer) return;
    this.timer = setInterval(() => {
      const ceil = Math.min(this.target + 6, 97);
      if(this.pct < ceil) this.pct = Math.min(ceil, this.pct + Math.max(0.15, (ceil - this.pct) * 0.03));
      this.paint();
    }, 180);
  },
  to(target, label, sub, icon){
    this.target = Math.max(this.target, target);
    if(this.pct < target - 12) this.pct = target - 12;
    if(label){ const el = $('lp-label'); if(el) el.textContent = label; }
    if(sub){ const el = $('lp-sub'); if(el) el.textContent = sub; }
    if(icon){ const el = $('lp-icon'); if(el) el.textContent = icon; }
    this.start(); this.paint();
  },
  done(){ this.target = 100; this.pct = 100; this.paint(); if(this.timer){ clearInterval(this.timer); this.timer = null; } },
  paint(){ const b = $('lp-bar'), p = $('lp-pct'); const v = Math.min(100, Math.floor(this.pct)); if(b) b.style.width = v + '%'; if(p) p.textContent = v + '%'; }
};

async function completeSignInFromLink(){
  if(!isSignInWithEmailLink(auth, location.href)) return false;
  show('step-verify');
  window.LP_TAKEN = true;
  LP.pct = Math.max(LP.pct, 12);
  LP.to(15, '메일 링크 확인 중…', '링크가 진짜인지 살펴보고 있어요', '🔎');
  let email = localStorage.getItem(EMAIL_KEY);
  if(!email){
    email = window.prompt('로그인을 완료하려면 링크를 요청한 이메일을 다시 입력해 주세요.');
    if(email) email = email.trim().toLowerCase();
  }
  if(!email){ show('step-email'); return true; }
  try {
    LP.to(30, '로그인 열쇠 확인 중…', '구글 인증 서버와 악수하는 중', '🔑');
    await signInWithEmailLink(auth, email, location.href);
    LP.to(55, '로그인 성공! 준비 중…', '문이 열렸어요', '🔓');
    localStorage.removeItem(EMAIL_KEY);
    try {
      const q = query(collection(db, 'parentAuthLogs'), where('email', '==', email), where('clicked', '==', false));
      const snap = await getDocs(q);
      const latest = snap.docs.sort((a, b) => (b.data().requestedAt?.seconds || 0) - (a.data().requestedAt?.seconds || 0))[0];
      if(latest) await updateDoc(doc(db, 'parentAuthLogs', latest.id), { clicked: true, clickedAt: Timestamp.now() });
    } catch(e){}
    history.replaceState(null, '', location.pathname);
  } catch(e){
    show('step-email'); window.openEmail();
    alertShow('email-err', '로그인에 실패했습니다. 링크가 만료되었을 수 있어요. 다시 시도해 주세요.');
    return true;
  }
  return true;
}

async function ensureParentDoc(user){
  const ref = doc(db, 'parents', user.uid);
  try{
    const s = await getDoc(ref);
    if(!s.exists()) await setDoc(ref, { uid: user.uid, email: user.email || '', role: 'parent', createdAt: Timestamp.now(), lastSeen: Timestamp.now() });
    else { try { await updateDoc(ref, { lastSeen: Timestamp.now() }); } catch(e){} }
  }catch(e){}
}

/* 🔑 비밀번호 만들기 — 이메일로 들어온 분만 (구글 계정이면 필요 없음) */
function injectPwSetup(){
  const u = auth.currentUser;
  if(!u || (u.providerData || []).some(p => p && p.providerId === 'google.com')) return;
  if($('pwset-card')) return;
  const host = $('step-link'); if(!host) return;
  const div = document.createElement('div');
  div.id = 'pwset-card'; div.className = 'pwset';
  div.innerHTML = `
    <div style="font-size:13px;font-weight:800;margin-bottom:4px">🔑 비밀번호 만들기 <span style="font-weight:400;opacity:.75">(선택)</span></div>
    <div style="font-size:12px;opacity:.8;line-height:1.55;margin-bottom:9px">
      만들어 두면 다음부터는 메일 링크 없이,<br><b>홈 화면에 설치한 앱 안에서</b> 이메일+비밀번호로 바로 로그인돼요.</div>
    <input type="password" id="pwset-1" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" class="pw-in">
    <input type="password" id="pwset-2" placeholder="한 번 더" autocomplete="new-password" class="pw-in">
    <button type="button" class="btn" style="width:100%;margin-top:4px" onclick="savePw()">비밀번호 저장</button>
    <div id="pwset-msg" style="display:none;margin-top:8px;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:700"></div>`;
  host.appendChild(div);
}
window.savePw = async function(){
  const p1 = $('pwset-1').value, p2 = $('pwset-2').value;
  const m = $('pwset-msg');
  const say = (ok, t) => { m.style.display = 'block'; m.className = ok ? 'pw-ok' : 'pw-err'; m.textContent = t; };
  if(p1.length < 6) return say(false, '6자 이상으로 만들어 주세요.');
  if(p1 !== p2)     return say(false, '두 칸이 서로 달라요.');
  try{
    await updatePassword(auth.currentUser, p1);
    say(true, '저장했습니다 ✓ 이제 앱에서 «비밀번호로 로그인»을 쓰시면 돼요.');
    $('pwset-1').value = ''; $('pwset-2').value = '';
  }catch(e){
    say(false, e.code === 'auth/requires-recent-login'
      ? '보안을 위해 방금 로그인한 상태에서만 만들 수 있어요 — 메일 링크로 다시 로그인한 뒤 설정해 주세요.'
      : '저장 실패: ' + (e.code || e.message));
  }
};

/* ═══ STEP 4: 자녀 연결 (한 화면) ═══ */
let PASS = null, KIDS = [], LEGACY = false;
function paintKids(){
  KIDS = kidsOf(PASS, ORG);
  const box = $('kid-list');
  $('kids-sec').textContent = KIDS.length ? `연결된 자녀 ${KIDS.length}명` : '연결된 자녀';
  box.innerHTML = KIDS.length ? KIDS.map(k => {
    const note = kidNote(k);
    return `<div class="li"><div class="av">${esc((k.name || '?').trim().charAt(0))}</div>
      <div class="t">${esc(k.name || '학생')}<small>${esc([k.grade, k.className].filter(Boolean).join(' ') || ORGN)}${note ? ' · ' + esc(note) : ''}</small></div>
      <span class="pill ${k.ro ? 'ro' : ''}">${k.ro ? '보기만' : '연결됨'}</span></div>`;
  }).join('') : '<div class="empty">아직 없어요</div>';
  // 끝난 연결 안내 (지금 자녀 목록에 없는 것만)
  const ended = endedOf(PASS, ORG).filter(e => !KIDS.some(k => k.studentId === e.studentId)).slice(0, 3);
  $('ended-box').innerHTML = ended.map(e => { const t = endedText(e);
    return `<div class="lk-box info"><div class="lk-ic">${t.icon}</div><div class="lk-t">${esc(t.t)}</div><div class="lk-s">${esc(t.s)}</div></div>`; }).join('');
  const has = KIDS.length > 0;
  $('btn-go-home').style.display = has ? '' : 'none';
  // «다른 계정» 안내 — 자녀가 없고, QR로 막 들어온 것도 아니고, 끝난 연결 안내도 없을 때만
  $('acct-hint').style.display = (has || pendingCode() || ended.length) ? 'none' : '';
  // 자녀가 있으면 코드 칸은 «＋ 자녀 더 연결하기»로 접어 둔다 (QR로 들어왔으면 펼침)
  const open = !has || !!pendingCode() || $('code').value.trim();
  $('code-area').style.display = open ? '' : 'none';
  $('more-btn').style.display = open ? 'none' : '';
}
window.openMore = () => { $('code-area').style.display = ''; $('more-btn').style.display = 'none'; setTimeout(() => $('code').focus(), 50); };

let PREV = null, prevSeq = 0, prevTimer = null;
function codeBox(html, kind){ $('code-box').innerHTML = html ? `<div class="lk-box ${kind || ''}">${html}</div>` : ''; }
function setLinkBtn(on, label){ const b = $('btn-link'); b.disabled = !on; if(label) b.innerHTML = `<span>${label}</span>`; }
function explain(j, code){
  const e = j && j.error;
  if(e === 'invalid') return codeBox(`<div class="lk-t">코드를 찾을 수 없어요</div><div class="lk-s">가정통신문의 코드를 다시 확인해 주세요.${j.left != null ? ` (앞으로 ${j.left}번 더 넣어 볼 수 있어요)` : ''}</div>`, 'warn');
  if(e === 'locked') return codeBox(`<div class="lk-ic">🔒</div><div class="lk-t">코드를 여러 번 틀렸어요</div><div class="lk-s">안전을 위해 잠시 쉬어요 — <b>${hm(j.until)}</b>부터 다시 넣을 수 있어요.</div>`, 'warn');
  if(e === 'expired') return codeBox(`<div class="lk-ic">⏳</div><div class="lk-t">코드가 만료됐어요</div><div class="lk-s">${j.createdAt ? md(j.createdAt) + '에 만든 코드예요 (30일 동안만 쓸 수 있어요). ' : ''}담임 선생님께 <b>새 코드</b>를 받아 주세요.</div>`, 'warn');
  if(e === 'wrong-org'){ const o = j.org === 'jihyebit' ? 'jihyebit' : 'daniel';
    return codeBox(`<div class="lk-t">이 코드는 ${esc(j.orgName || ORG_NAME[o])} 코드예요</div><div class="lk-s">${esc(ORG_NAME[o])} 학부모 페이지에서 연결해 주세요 — 코드는 그대로 옮겨 가요.</div>
      <a class="btn btn-ghost" href="login-${o}.html?add=1&code=${encodeURIComponent(code)}">${esc(ORG_NAME[o])}에서 연결하기 →</a>`, 'info'); }
  if(e === 'full'){ const p = j.preview || {};
    return codeBox(`<div class="lk-ic">👨‍👩‍👧</div><div class="lk-t">이미 보호자 두 분이 연결되어 있어요</div><div class="lk-s">${esc(p.name || '')} · ${esc([p.grade, p.className].filter(Boolean).join(' '))}<br>학교에서 <b>한 칸 더</b> 열어 주시면 연결돼요.</div>
      <button class="btn" type="button" id="btn-req" onclick="askMore()">학교에 요청 보내기</button>`, 'warn'); }
  if(e === 'ended') return codeBox(`<div class="lk-ic">${j.why === 'grad' ? '🎓' : '👋'}</div><div class="lk-t">${j.why === 'grad' ? '졸업한 학생이에요' : '연결이 끝난 학생이에요'}</div><div class="lk-s">${esc(j.name || '')} 학생은 ${j.why === 'grad' ? '졸업' : '자퇴 · 전학'} 처리되어 새로 연결할 수 없어요.</div>`, 'info');
  if(e === 'revoked') return codeBox(`<div class="lk-ic">🔗</div><div class="lk-t">학교에서 이 연결을 정리했어요</div><div class="lk-s">${esc(j.name || '')} 학생과 다시 연결하려면 담임 선생님께 <b>새 코드</b>를 받아 주세요.</div>`, 'info');
  if(e === 'rejected') return codeBox(`<div class="lk-t">학교에서 요청을 받지 않았어요</div><div class="lk-s">궁금하시면 담임 선생님께 여쭤봐 주세요.</div>`, 'info');
  if(e === 'network' || e === 'server') return codeBox(`<div class="lk-t">학교 연결 서버에 닿지 않아요</div><div class="lk-s">인터넷을 확인하고 잠시 뒤 다시 해 주세요.</div>`, 'warn');
  if(e === 'auth') return codeBox(`<div class="lk-t">로그인이 풀렸어요</div><div class="lk-s">새로고침해서 다시 로그인해 주세요.</div>`, 'warn');
  return codeBox(`<div class="lk-t">확인하지 못했어요</div><div class="lk-s">${esc(e || '')}</div>`, 'warn');
}
async function preview(){
  const code = normCode($('code').value); PREV = null; setLinkBtn(false, '이 자녀 연결하기');
  if(!CODE_RE.test(code)){ codeBox(''); return; }
  const seq = ++prevSeq;
  codeBox('<div class="lk-s">코드를 확인하는 중…</div>');
  if(LEGACY){ PREV = { code, legacy:true }; codeBox(`<div class="lk-s">코드 <b>${esc(code)}</b> — 아래 버튼을 눌러 연결해 주세요.</div>`); setLinkBtn(true); return; }
  const j = await callGate(auth, db, 'link', { code, org: ORG });
  if(seq !== prevSeq) return;
  if(j && j.ok && j.already){ if(j.pass) PASS = normPass(j.pass); codeBox(`✓ <b>${esc(j.preview.name)}</b> 학생은 이미 연결되어 있어요`, 'ok'); clearPending(); paintKids(); return; }
  if(j && j.ok && j.preview){ PREV = { code, p: j.preview };
    codeBox(`<div class="lk-t">✓ ${esc(j.preview.name)} · ${esc([j.preview.grade, j.preview.className].filter(Boolean).join(' ') || j.preview.orgName)}</div><div class="lk-s">맞으면 아래 버튼을 눌러 주세요 · 아니면 연결하지 말고 담임 선생님께 알려 주세요</div>`, 'ok');
    setLinkBtn(true); return; }
  if(j && j.error === 'no-gate'){ LEGACY = true; return preview(); }
  explain(j, code);
}
function onCodeInput(){
  const el = $('code'), v = normCode(el.value);
  if(el.value !== v) el.value = v;
  clearTimeout(prevTimer); prevTimer = setTimeout(preview, CODE_RE.test(v) ? 150 : 400);
}

window.linkChild = async function(){
  const user = auth.currentUser;
  if(!user){ codeBox('<div class="lk-t">로그인이 필요합니다.</div>', 'warn'); return; }
  if(!PREV){ await preview(); if(!PREV) return; }
  const code = PREV.code;
  const btn = $('btn-link'); btn.disabled = true;
  const orig = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>';
  try{
    if(PREV.legacy){ await legacyLink(user, code); return; }
    const j = await callGate(auth, db, 'link', { code, org: ORG, confirm: true });
    if(j && j.ok && (j.linked || j.already)){
      if(j.pass) PASS = normPass(j.pass);
      clearPending(); $('code').value = ''; PREV = null;
      codeBox(`✓ <b>${esc((j.preview && j.preview.name) || '')}</b> 연결 완료! 다음부터는 로그인만 하면 바로 들어와요.`, 'ok');
      paintKids();
      $('link-hello').innerHTML = '연결되었어요 🎉<br><span class="sub">자녀를 더 연결하거나 홈으로 가세요.</span>';
      return;
    }
    explain(j, code);
  }finally{ btn.innerHTML = orig; btn.disabled = !PREV; }
};
window.askMore = async function(){
  const code = normCode($('code').value);
  const b = $('btn-req'); if(b){ b.disabled = true; b.innerHTML = '<span class="spin"></span>'; }
  const j = await callGate(auth, db, 'request', { code, org: ORG });
  if(j && j.ok) codeBox(`<div class="lk-ic">📨</div><div class="lk-t">요청을 보냈어요</div><div class="lk-s">학교에서 승인하면, 다음에 들어오실 때 연결되어 있어요.</div>`, 'ok');
  else explain(j, code);
};

/* 출입 서버가 아직 없을 때(첫 배포 전)만 — 예전 방식 그대로 연결 */
async function legacyLink(user, code){
  try{
    const cSnap = await getDoc(doc(db, 'joinCodes', code));
    if(!cSnap.exists() || cSnap.data().active === false){ codeBox('<div class="lk-t">유효하지 않은 코드입니다</div><div class="lk-s">학교에서 받은 코드를 다시 확인해 주세요.</div>', 'warn'); return; }
    const cd = cSnap.data();
    if((cd.org || 'daniel') !== ORG){ explain({ error:'wrong-org', org: cd.org }, code); return; }
    const linkRef = doc(db, 'parentLinks', `${user.uid}_${cd.studentId}`);
    const prev = await getDoc(linkRef);
    if(!(prev.exists() && prev.data().status === 'active')){
      await setDoc(linkRef, { parentUid: user.uid, parentEmail: user.email || '', studentId: cd.studentId, studentName: cd.studentName || '', org: cd.org || '',
        grade: cd.grade || '', className: cd.className || '', status: 'active', linkedVia: 'code', linkedAt: Timestamp.now() });
    }
    clearPending(); $('code').value = ''; PREV = null;
    const r = await loadPass(auth, db, { force: true }); PASS = r.pass;
    codeBox(`✓ <b>${esc(cd.studentName || '')}</b> 연결 완료!`, 'ok'); paintKids();
  }catch(e){
    codeBox(`<div class="lk-t">연결에 실패했습니다</div><div class="lk-s">${esc(e.code === 'permission-denied' ? '학교 연결 서버 준비가 아직 끝나지 않았어요 — 잠시 뒤 다시 해 주세요.' : (e.code || e.message))}</div>`, 'warn');
  }
}

window.switchAccount = async function(){
  try{ await signOut(auth); }catch(e){}
  $('email-wrap').style.display = 'none'; $('btn-email-open').style.display = '';
  show('step-email');
};

function nextUrl(){
  try{
    const n = new URLSearchParams(location.search).get('next') || '';
    if(n && !n.startsWith('http') && !n.startsWith('//') && !n.includes(':')) return n;
  }catch(e){}
  return '';
}
const ADD_MODE = qs.get('add') === '1';
window.goHome = function(){ location.replace(nextUrl() || `home-${ORG}.html`); };

try{ localStorage.setItem('parent_org', ORG); }catch(e){}
$('code').addEventListener('input', onCodeInput);
$('code').addEventListener('keydown', e => { if(e.key === 'Enter' && !$('btn-link').disabled) window.linkChild(); });

(async () => {
  const handled = await completeSignInFromLink();
  let busy = false;
  onAuthStateChanged(auth, async (user) => {
    if(!user){ if(!handled) show('step-email'); return; }
    if(busy) return; busy = true;
    try{
      if(!$('step-verify').classList.contains('on')){ show('step-verify'); }
      LP.to(70, '보호자 정보 확인 중…', '프로필을 준비하고 있어요', '👤');
      await ensureParentDoc(user);
      LP.to(88, '우리 아이 정보 연결 중…', '출입증을 받는 중', '🎫');
      const r = await loadPass(auth, db, { force: true });
      PASS = r.pass; LEGACY = r.src === 'legacy' && !(await gateUrl(db));
      LP.done();
      const kids = kidsOf(PASS, ORG);
      const pc = pendingCode();
      // 이 기관 자녀가 있는 재방문자 → 가려던 곳(next) 또는 홈으로
      if(kids.length && !handled && !ADD_MODE && !pc){ location.replace(nextUrl() || `home-${ORG}.html`); return; }
      // 👩‍🏫 교사 계정 — 같은 브라우저는 교사 · 학부모 로그인이 한 자리를 쓴다
      if(!kids.length && !ADD_MODE && !pc){
        try {
          const st = await getDoc(doc(db, 'staff', user.uid));
          if(st.exists()){
            const tn = st.data().name || '선생님';
            $('link-hello').innerHTML = `지금 <b>교사 계정(${esc(tn)})</b>으로 로그인되어 있어요.<br><span class="sub">같은 브라우저에서는 교사 · 학부모 로그인이 한 자리를 함께 씁니다.</span>`;
            ['code-area', 'kids-sec', 'kid-list', 'acct', 'more-btn', 'btn-go-home', 'ended-box'].forEach(i => { const el = $(i); if(el) el.style.display = 'none'; });
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;flex-direction:column;gap:9px;margin-top:14px';
            div.innerHTML = `<button type="button" class="btn" onclick="location.href='board.html?org=${ORG}&scope=org'">👩‍🏫 교사 모드로 게시판 보기</button>`
              + `<button type="button" class="btn btn-ghost" id="tout-btn">학부모로 로그인하기 (교사 로그아웃)</button>`;
            $('step-link').appendChild(div);
            $('tout-btn').onclick = async () => { await signOut(auth); location.replace(`login-${ORG}.html`); };
            show('step-link');
            return;
          }
        } catch(e){}
      }
      $('acct-email').textContent = '👤 ' + maskEmail(user.email || '');
      const other = kidsOf(PASS, OTHER).length;
      $('link-hello').innerHTML = kids.length
        ? '로그인되었습니다.<br><span class="sub">자녀를 더 연결하거나 홈으로 가세요.</span>'
        : (other ? `이 계정에는 ${esc(ORG_NAME[OTHER])} 자녀만 연결되어 있어요.<br><span class="sub">${esc(ORGN)} 자녀가 있다면 코드로 연결해 주세요.</span>`
          : endedOf(PASS, ORG).length ? '지금 연결된 자녀가 없어요<br><span class="sub">다른 자녀가 있다면 코드로 연결해 주세요.</span>'
                 : `자녀 코드를 넣어 주세요<br><span class="sub">가정통신문에 적힌 코드예요 (예: ${ORG === 'jihyebit' ? 'JH' : 'DA'}-3B-7K2P)</span>`);
      if(pc){ $('code').value = normCode(pc); }
      paintKids();
      show('step-link');
      injectPwSetup();
      if(pc) preview();
    }finally{ busy = false; }
  });
})();
}
