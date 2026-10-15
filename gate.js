/* ═══════════════════════════════════════════════
   gate.js — 🎫 학부모 출입증 (v122 · v124 · 학부모 공용)
   · 출입증(parentAccess/{내 uid})은 학교 «출입 서버»만 만듭니다 — 여기서는 읽고, 오래되면 새로 받습니다
   · 자녀 · 반 · 기간이 적혀 있어 게시판은 이 출입증으로만 열립니다 (보안 규칙 v30)
   · 출입 서버 주소는 parentConfig/gate 의 url (교사 선교사 › 학부모 관리 › 연결 현황에서 넣음)
   · v124 — 반 게시판은 «반편성 한 칸»마다 (열쇠 c:<반 id>) · 바로 전 학년도 반은 «보기만» 서랍
   ═══════════════════════════════════════════════ */
import { doc, getDoc, collection, query, where, getDocs }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const HOUR = 3600e3, DAY = 864e5;
export const ORG_NAME = { daniel:'다니엘 아마츠', jihyebit:'지혜빛 선교원' };
const msOf = t => !t ? 0 : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis()
  : (t.seconds != null ? t.seconds * 1000 : (Date.parse(t) || 0));

/* 출입증을 화면에서 쓰기 좋은 모양으로 (Timestamp → 밀리초) */
export function normPass(d){
  if(!d) return null;
  return {
    kids: (d.kids || []).map(k => Object.assign({}, k, { org: k.org || 'daniel', viewUntil: msOf(k.viewUntil),
      classNames: Array.isArray(k.classNames) ? k.classNames : (k.className ? [k.className] : []),
      classes: Array.isArray(k.classes) ? k.classes : [], archive: Array.isArray(k.archive) ? k.archive : [] })),
    orgs: d.orgs || [], writeOrgs: d.writeOrgs || [], classKeys: d.classKeys || [], writeClassKeys: d.writeClassKeys || [],
    ended: (d.ended || []).map(e => Object.assign({}, e, { at: msOf(e.at), viewUntil: msOf(e.viewUntil) })),
    until: msOf(d.until), issuedAt: msOf(d.issuedAt), legacy: !!d.legacy,
    mig: d.mig === undefined ? undefined : !!d.mig,   // v124: 학교가 옛 반 게시글을 반편성 반으로 옮겼나 (옮기기 전이면 옛 이름 글도 함께 봄)
  };
}

/* ── 출입 서버 ── */
let _url = null;
export async function gateUrl(db){
  if(_url !== null) return _url;
  try{ const s = sessionStorage.getItem('pg_url'); if(s){ _url = s; return _url; } }catch(e){}
  try{
    const c = await getDoc(doc(db, 'parentConfig', 'gate'));
    _url = (c.exists() && typeof c.data().url === 'string') ? c.data().url.trim().replace(/\/+$/, '') : '';
  }catch(e){ _url = ''; }
  try{ if(_url) sessionStorage.setItem('pg_url', _url); }catch(e){}   // 빈 주소는 기억하지 않음 (설정 뒤 바로 쓰이게)
  return _url;
}
export async function callGate(auth, db, action, body){
  const url = await gateUrl(db);
  if(!url) return { ok:false, error:'no-gate' };
  const user = auth.currentUser; if(!user) return { ok:false, error:'auth' };
  let r;
  try{
    const tok = await user.getIdToken();
    r = await fetch(url + '/?action=' + encodeURIComponent(action), { method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + tok }, body: JSON.stringify(body || {}) });
  }catch(e){ return { ok:false, error:'network' }; }
  let j = null; try{ j = await r.json(); }catch(e){}
  if(!j) j = { ok:false, error: r.status === 401 ? 'auth' : 'server' };
  return j;
}

/* ── 출입증 받기 ──
   ① 내 출입증이 아직 싱싱하면(20시간 안 · 기간 1시간 넘게 남음) 그대로
   ② 아니면 출입 서버에서 새로 받음 (학생 상태 · 반편성이 그때 반영됨)
   ③ 서버가 잠시 안 되면 남은 출입증으로
   ④ 출입 서버가 아직 없으면(첫 배포 전) 예전처럼 연결 문서로 — 화면이 비지 않게 */
export async function loadPass(auth, db, opt = {}){
  const uid = auth.currentUser && auth.currentUser.uid; if(!uid) return { pass:null, src:'none' };
  const now = Date.now();
  let cur = null;
  try{ const s = await getDoc(doc(db, 'parentAccess', uid)); if(s.exists()) cur = normPass(s.data()); }catch(e){}
  const fresh = cur && cur.issuedAt > now - 20 * HOUR && cur.until > now + HOUR;
  if(cur && fresh && !opt.force) return { pass: cur, src:'doc' };
  const j = await callGate(auth, db, 'me');
  if(j && j.ok && j.pass) return { pass: normPass(j.pass), src:'gate' };
  if(cur && cur.until > now) return { pass: cur, src:'doc-stale' };
  if((j && j.error === 'no-gate') || !cur){
    try{
      const snap = await getDocs(query(collection(db, 'parentLinks'), where('parentUid', '==', uid), where('status', '==', 'active')));
      const kids = snap.docs.map(d => d.data()).map(l => ({ studentId:l.studentId, name:l.studentName || '', org:l.org || 'daniel',
        className:l.className || '', classNames:l.className ? [l.className] : [], grade:l.grade || '', state:'active', ro:false, viewUntil:0 }));
      const orgs = [...new Set(kids.map(k => k.org))];
      const keys = [...new Set(kids.flatMap(k => k.classNames.map(n => k.org + '|' + n)))];
      return { pass: { kids, orgs, writeOrgs: orgs, classKeys: keys, writeClassKeys: keys, ended: [], until: now + DAY, issuedAt: now, legacy: true }, src:'legacy' };
    }catch(e){ return { pass: cur, src:'none', error: e }; }
  }
  return { pass: cur, src:'expired' };
}

export const kidsOf = (pass, org) => ((pass && pass.kids) || []).filter(k => (k.org || 'daniel') === org);
export const endedOf = (pass, org) => ((pass && pass.ended) || []).filter(e => (e.org || 'daniel') === org);
export const canWriteOrg = (pass, org) => !!pass && (pass.writeOrgs || []).includes(org);
export const canWriteClass = (pass, org, cls) => !!pass && (pass.writeClassKeys || []).includes(org + '|' + cls);
export const kidClassLine = k => [k.grade, k.className].filter(Boolean).join(' ');

/* ── 🏫 반 게시판 목록 (v124) ──
   반편성 한 칸 = 게시판 하나 (열쇠 «c:반 id» · 이름이 같은 반도 따로)
   출입증이 옛 모양(반 정보 없음)이거나 반편성을 안 쓰는 학생이면 예전처럼 반 이름이 열쇠 */
function addBoard(map, b, k){ const e = map.get(b.key) || Object.assign(b, { kids: [] }); if(!e.kids.includes(k)) e.kids.push(k); map.set(b.key, e); }
const cBoard = (c, ro) => ({ key: 'c:' + c.id, id: c.id, name: c.name || '', grade: c.grade || '', dept: c.dept || '', year: Number(c.year || 0), ro: !!ro });
export function boardsOf(pass, org){
  const map = new Map();
  kidsOf(pass, org).forEach(k => {
    const cs = (k.classes || []).filter(c => c && c.id);
    if(cs.length) cs.forEach(c => addBoard(map, cBoard(c, k.ro), k));
    else (k.classNames || []).filter(Boolean).forEach(n => addBoard(map, { key: n, id: '', name: n, grade: k.grade || '', dept: '', year: 0, ro: !!k.ro }, k));
  });
  // 학년 순 (1학년 → 7학년) · 같으면 반 이름
  const nat = (a, b) => String(a || '').localeCompare(String(b || ''), 'ko', { numeric: true });
  return [...map.values()].sort((a, b) => nat(a.grade || a.dept, b.grade || b.dept) || nat(a.name, b.name));
}
// 바로 전 학년도 반 — 보기만 (다음 반편성 전까지)
export function archiveOf(pass, org){
  const map = new Map();
  kidsOf(pass, org).forEach(k => (k.archive || []).filter(c => c && c.id).forEach(c => addBoard(map, cBoard(c, true), k)));
  return [...map.values()].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name, 'ko'));
}
// 게시판 이름: «1학년 닛시반» (학년이 없으면 부서)
export const boardLabel = b => [b.grade || b.dept, b.name].filter(Boolean).join(' ');
// 이 자녀가 이 게시판(열쇠)의 반인가
export const kidInBoard = (k, key) => (k.classes || []).some(c => 'c:' + c.id === key) || (k.archive || []).some(c => 'c:' + c.id === key)
  || (!(k.classes || []).length && (k.classNames || [k.className]).includes(key));

const md = t => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
/* 자녀 한 명의 상태 한 줄 (보기만 · 졸업 유예) */
export function kidNote(k){
  if(k.state === 'grace') return `졸업 · ${md(k.viewUntil)}까지 보기만`;
  if(k.state === 'leave') return '휴학 중 · 보기만';
  return '';
}
/* 끝난 연결 안내 */
export function endedText(e){
  const n = e.name || '자녀';
  if(e.why === 'grad') return { icon:'🎓', t:`${n} 학생이 졸업했어요`, s:'그동안 함께해 주셔서 감사합니다. 졸업 뒤 30일이 지나 연결이 끝났어요.' };
  if(e.why === 'quit') return { icon:'👋', t:`${n} 학생의 연결이 끝났어요`, s:'자퇴 · 전학으로 학교 연결이 정리되었어요.' };
  if(e.why === 'revoked') return { icon:'🔗', t:`${n} 학생 연결을 학교에서 정리했어요`, s:'잘못 연결된 것이면 담임 선생님께 새 코드를 받아 다시 연결해 주세요.' };
  return { icon:'🔗', t:`${n} 학생 연결이 끝났어요`, s:'학생 정보가 정리되었어요. 궁금하시면 학교로 문의해 주세요.' };
}

/* 이메일 가리기: abcde@gmail.com → ab***@gmail.com */
export function maskEmail(e){
  const s = String(e || ''); const i = s.indexOf('@'); if(i < 1) return s;
  return s.slice(0, Math.min(2, i)) + '***' + s.slice(i);
}

/* 카카오톡 · 네이버 · 인스타그램 등 «앱 안 브라우저» — 구글 로그인이 막혀 있다 */
export function inAppBrowser(){
  const u = navigator.userAgent || '';
  if(/KAKAOTALK/i.test(u)) return 'kakao';
  if(/NAVER\(inapp|NAVER\//i.test(u)) return 'naver';
  if(/Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|BAND\/|Snapchat|Twitter/i.test(u)) return 'app';
  if(/; wv\)/.test(u) && /Android/i.test(u)) return 'app';
  return '';
}
/* 바깥 브라우저로 열기 — 카카오톡은 바로, 안드로이드는 크롬으로, 그 밖은 안내 */
export function openExternal(url){
  const u = navigator.userAgent || '', href = url || location.href;
  if(/KAKAOTALK/i.test(u)){ location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(href); return true; }
  if(/Android/i.test(u)){ location.href = 'intent://' + href.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'; return true; }
  return false;
}
