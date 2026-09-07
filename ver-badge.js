/* ═══════════════════════════════════════════════
   ver-badge.js — 🏷 버전 배지 + ✨ 업데이트 배너 (학부모 공용)
   · version.json 의 v를 읽어 좌하단에 「학부모 v…」 표시
   · 5분마다·탭 복귀 시 재확인 — v가 바뀌면 「✨ 업데이트 되었습니다」 배너
   · club-enroll.html 은 자체 배지가 있으므로 이 파일을 넣지 않는다
   ═══════════════════════════════════════════════ */
(function(){
  let base = null;
  function badge(v){
    let b = document.getElementById('vb-badge');
    if(!b){ b = document.createElement('div'); b.id='vb-badge';
      b.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9998;font-size:10px;color:#98A39D;'
        +'background:rgba(255,255,255,.88);border:1px solid #E3E1DA;border-radius:8px;padding:2px 7px;'
        +'pointer-events:none;font-variant-numeric:tabular-nums;font-family:inherit';
      (document.body||document.documentElement).appendChild(b); }
    b.textContent = '학부모 v' + v;
  }
  function banner(){
    if(document.getElementById('vb-upd')) return;
    const d = document.createElement('div'); d.id='vb-upd';
    d.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;'
      +'display:flex;align-items:center;gap:11px;background:#1E3932;color:#fff;'
      +'padding:11px 14px 11px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);'
      +'font-size:13px;font-weight:700;font-family:inherit;max-width:92vw';
    d.innerHTML='✨ 업데이트 되었습니다'
      +'<button onclick="location.reload()" style="font-family:inherit;font-size:12.5px;font-weight:800;'
      +'border:none;border-radius:8px;padding:7px 13px;cursor:pointer;background:#fff;color:#1E3932;'
      +'white-space:nowrap">새 화면 보기</button>'
      +'<button onclick="this.parentNode.remove()" aria-label="닫기" style="border:none;background:none;'
      +'color:rgba(255,255,255,.6);font-size:15px;cursor:pointer;padding:2px 4px;line-height:1">✕</button>';
    document.body.appendChild(d);
  }
  async function check(){
    try{
      const r = await fetch('version.json?_='+Date.now(), { cache:'no-store' });
      const j = await r.json(); if(!j || !j.v) return;
      badge(j.v);
      if(base === null){ base = j.v; return; }
      if(j.v !== base){ base = j.v; banner(); }
    }catch(e){ /* 오프라인 — 조용히 */ }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check);
  else check();
  setInterval(check, 5*60*1000);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) check(); });
})();
