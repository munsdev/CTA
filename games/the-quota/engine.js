/* =====================================================================
   THE QUOTA — engine.js
   A satirical — but historically educational — game by Casey The American.

   The mechanic IS the argument: the directive swears three people on this
   sidewalk don't belong. They all belong. There were never three to find.
   The only winning move is to detain no one and let the clock run out.

   Loaded by loader.js, which injects the markup and calls:
       window.TheQuota.init(rootElement, baseUrl)

   The quick levers live in CONFIG below.
   ===================================================================== */
window.TheQuota = window.TheQuota || {};
window.TheQuota.init = function (root, base) {
  if (!root || root.dataset.booted) return;   // guard against double-init
  root.dataset.booted = '1';

  /* ═══════════════ CONFIG — change these freely ═══════════════ */
  var CONFIG = {
    timerSeconds: 10,          // length of one shift
    lowAtSeconds: 5,           // when the ring turns red and pulses
    quota:        3,           // the fabricated number at the center of it all

    /* Reward shows only on the clean win (you detained no one). Leave the
       fields empty for no reward block at all. CMS overrides these.
       Example: code:'HELD-THE-LINE', desc:'Restraint bonus — 20% off' */
    reward: {
      code:      '' /*CMS:reward-code*/ || '',
      link:      '' /*CMS:reward-link*/ || '',
      desc:      '' /*CMS:reward-desc*/ || '',
      copiedMsg: '' /*CMS:copied-msg*/  || 'Code copied'
    }
  };
  /* ════════════════════════════════════════════════════════════ */

  /* Make the embed fill its Webflow column: walk up the wrapper chain and
     turn each ancestor into a full-height flex column, stopping at the page
     wrapper. If nothing above us has a real height, fall back to 80vh so the
     game is never a 0px sliver. */
  function fitToContainer() {
    var el = root.parentElement;
    for (var i = 0; el && i < 8; i++) {
      var tag = (el.tagName || '').toUpperCase();
      if (tag === 'BODY' || tag === 'HTML') break;
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.minHeight = '0';
      el.style.height = '100%';
      if (el.classList && el.classList.contains('games-script')) break;
      el = el.parentElement;
    }
    requestAnimationFrame(function () {
      if (root.offsetHeight < 120) {
        root.style.height = Math.max(420, Math.round(window.innerHeight * 0.8)) + 'px';
      }
    });
  }
  fitToContainer();

  var x = function (name) { return root.querySelector('[data-el="' + name + '"]'); };

  var viewport   = x('viewport');
  var intro      = x('intro');
  var result     = x('result');
  var goEl       = x('go');
  var clockEl    = x('clock');
  var timer      = x('timer');
  var ringProg   = x('ringProg');
  var detainedEl = x('detained');
  var quotaEl    = x('quota');
  var toastEl    = x('toast');
  var stampEl    = x('stamp');
  var truthEl    = x('truth');
  var lineupEl   = x('lineup');
  var plainEl    = x('plain');
  var receiptsEl = x('receipts');
  var rewardEl   = x('reward');
  var slots      = Array.prototype.slice.call(root.querySelectorAll('.sc-slot'));

  var RING_C = 276.46;   // 2·π·r, r=44
  var SHIFT  = CONFIG.timerSeconds;
  var LOW_AT = CONFIG.lowAtSeconds;
  var QUOTA  = CONFIG.quota;

  var armed = false, running = false, tEnd = 0, raf = null, spawnTimer = 0;
  var figures = [], detained = [], toastTimer = null;

  clockEl.textContent = SHIFT;
  quotaEl.textContent = QUOTA;

  /* Cosmetic, deliberately meaningless — none of this is ever "the tell". */
  var shirts = ['#5b6b8c','#7a5b6b','#4a6b5b','#8c7a4a','#6b5b8c','#5b8c8c','#8c5b5b','#607089'];
  var pants  = ['#2f3742','#3a3f47','#42352f','#2f4238','#38323f'];
  var skins  = ['#c9a58a','#b98a6a','#a06b4a','#e0bfa0','#8a5b3a'];
  var accessories = ['none','hat','bag','umbrella','none','none'];

  function rand(a){ return a[Math.floor(Math.random()*a.length)]; }
  function escHtml(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function makeFigure(){
    var dir = Math.random()<0.5?1:-1;
    var speed = (26+Math.random()*26)*dir;   // px/sec
    var y = 8 + Math.random()*40;
    var scale = 0.82 + Math.random()*0.4;
    var shirt=rand(shirts), pant=rand(pants), skin=rand(skins), acc=rand(accessories);
    var startX = dir>0 ? -44 : viewport.clientWidth+44;

    var el=document.createElement('div');
    el.className='sc-figure sc-walk';
    el.style.bottom=(26+y)+'px';
    el.style.transform='translateX('+startX+'px) scale('+scale+') scaleX('+dir+')';

    var accSvg='';
    if(acc==='hat') accSvg='<rect x="9" y="1" width="16" height="4" rx="1.5" fill="#2a2f37"/><rect x="12" y="-2" width="10" height="5" rx="2" fill="#2a2f37"/>';
    if(acc==='bag') accSvg='<rect x="23" y="34" width="9" height="12" rx="2" fill="#3a3f47"/>';
    if(acc==='umbrella') accSvg='<rect x="27" y="20" width="2" height="26" fill="#454b54"/><path d="M18 22 q10 -14 20 0 z" fill="#5b8c8c"/>';

    el.innerHTML=
      '<svg width="34" height="80" viewBox="0 0 34 80">'+
        '<ellipse class="sc-halo" cx="17" cy="74" rx="15" ry="4" fill="#e8a33d"/>'+
        (acc==='umbrella'?accSvg:'')+
        '<g transform="translate(17,52)">'+
          '<rect class="sc-leg-b" x="-7" y="0" width="6" height="22" rx="3" fill="'+pant+'" style="transform-origin:top center"/>'+
          '<rect class="sc-leg-a" x="1" y="0" width="6" height="22" rx="3" fill="'+pant+'" style="transform-origin:top center"/>'+
        '</g>'+
        '<rect x="9" y="26" width="16" height="30" rx="6" fill="'+shirt+'"/>'+
        '<rect x="6" y="28" width="5" height="20" rx="2.5" fill="'+shirt+'"/>'+
        '<rect x="23" y="28" width="5" height="20" rx="2.5" fill="'+shirt+'"/>'+
        '<circle cx="17" cy="16" r="9" fill="'+skin+'"/>'+
        (acc==='hat'?accSvg:'')+
        (acc==='bag'?accSvg:'')+
      '</svg>';

    var fig={el:el,dir:dir,speed:speed,scale:scale,x:startX,shirt:shirt,pant:pant,skin:skin,acc:acc};
    el.addEventListener('click',function(){ onDetain(fig); });
    viewport.appendChild(el);
    figures.push(fig);
  }

  /* small static portrait for the detention slot / lineup */
  function miniSvg(f){
    var acc='';
    if(f.acc==='hat') acc='<rect x="8" y="1" width="15" height="3.5" rx="1.5" fill="#2a2f37"/><rect x="11" y="-2" width="9" height="4.5" rx="2" fill="#2a2f37"/>';
    return '<svg width="26" height="44" viewBox="0 0 34 58">'+
      '<rect x="10" y="30" width="6" height="20" rx="3" fill="'+f.pant+'"/>'+
      '<rect x="18" y="30" width="6" height="20" rx="3" fill="'+f.pant+'"/>'+
      '<rect x="9" y="22" width="16" height="27" rx="6" fill="'+f.shirt+'"/>'+
      '<rect x="6" y="24" width="5" height="17" rx="2.5" fill="'+f.shirt+'"/>'+
      '<rect x="23" y="24" width="5" height="17" rx="2.5" fill="'+f.shirt+'"/>'+
      '<circle cx="17" cy="13" r="8.5" fill="'+f.skin+'"/>'+ acc +
    '</svg>';
  }

  function onDetain(fig){
    if(!running) return;
    var idx=figures.indexOf(fig);
    if(idx>-1) figures.splice(idx,1);
    fig.el.classList.add('sc-detaining');
    setTimeout(function(){ fig.el.remove(); },180);

    var slot=slots[detained.length];
    detained.push(fig);
    if(slot){ slot.classList.add('sc-filled'); slot.insertAdjacentHTML('beforeend',miniSvg(fig)); }
    detainedEl.textContent=detained.length;

    if(detained.length>=QUOTA) endShift();
  }

  function loop(){
    if(!armed) return;

    /* Crowd keeps moving in both the ready and running states. */
    spawnTimer-=16;
    if(spawnTimer<=0 && figures.length<9){ makeFigure(); spawnTimer=650+Math.random()*700; }

    var w=viewport.clientWidth;
    for(var i=figures.length-1;i>=0;i--){
      var f=figures[i];
      f.x += f.speed*(16/1000);
      f.el.style.transform='translateX('+f.x+'px) scale('+f.scale+') scaleX('+f.dir+')';
      if((f.dir>0 && f.x>w+50)||(f.dir<0 && f.x<-50)){ f.el.remove(); figures.splice(i,1); }
    }

    /* The clock only advances once the player has pressed Start. */
    if(running){
      var now=performance.now();
      var remain=Math.max(0,(tEnd-now)/1000);
      var frac=Math.max(0,remain/SHIFT);
      clockEl.textContent=Math.ceil(remain);
      ringProg.style.strokeDashoffset=(RING_C*(1-frac)).toFixed(1);
      timer.classList.toggle('sc-low', remain<=LOW_AT);
      if(remain<=0){ endShift(); return; }
    }

    raf=requestAnimationFrame(loop);
  }

  function clearField(){ figures.forEach(function(f){ f.el.remove(); }); figures=[]; }

  function resetTray(){
    slots.forEach(function(s,i){
      s.classList.remove('sc-filled');
      s.innerHTML='<span class="sc-num">0'+(i+1)+'</span>';
    });
  }

  function showGo(){ goEl.hidden=false; }
  function hideGo(){ goEl.hidden=true; }

  /* Step 1: leave whatever panel is up, show the crowd + center Start.
     Clock frozen, figures not yet clickable. */
  function beginShift(){
    intro.hidden=true; result.hidden=true;
    clearField(); resetTray();
    detained=[]; detainedEl.textContent=0;
    clockEl.textContent=SHIFT;
    ringProg.style.strokeDashoffset='0';
    timer.classList.remove('sc-low');
    running=false; armed=true; spawnTimer=0;
    for(var i=0;i<4;i++) makeFigure();
    showGo();
    cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  }

  /* Step 2: player pressed Start — run the countdown, enable detaining. */
  function startCountdown(){
    if(!armed || running) return;
    hideGo();
    running=true;
    tEnd=performance.now()+SHIFT*1000;
  }

  /* Reward block — graceful: renders only what exists (code / link / desc). */
  function renderReward(){
    var r=CONFIG.reward;
    rewardEl.innerHTML='';
    if(!r.code && !r.link){ rewardEl.hidden=true; return; }
    rewardEl.hidden=false;

    if(r.desc){
      var d=document.createElement('div');
      d.className='gm-reward-desc'; d.textContent=r.desc; rewardEl.appendChild(d);
    }
    if(r.code){
      var code=document.createElement('div');
      code.className='gm-code';
      var span=document.createElement('span'); span.textContent=r.code; code.appendChild(span);
      var btn=document.createElement('button'); btn.type='button'; btn.textContent='Copy';
      btn.addEventListener('click',function(){ copyCode(r.code); });
      code.appendChild(btn);
      rewardEl.appendChild(code);
    }
    if(r.link){
      var a=document.createElement('a');
      a.className='gm-btn'; a.href=r.link; a.target='_blank'; a.rel='noopener';
      a.style.textDecoration='none';
      a.textContent=r.code?'Shop with it applied':'Open shop';
      rewardEl.appendChild(a);
    }
  }

  function endShift(){
    running=false; armed=false; cancelAnimationFrame(raf);
    timer.classList.remove('sc-low');
    hideGo();
    var n=detained.length;

    stampEl.classList.remove('pass','fail');
    lineupEl.innerHTML='';

    if(n===0){
      stampEl.classList.add('pass');
      stampEl.textContent='Passed';
      truthEl.textContent='You detained no one.';
      plainEl.textContent='Everyone here belonged. There were never three to find — the number was the trick, and you didn\u2019t take the bait.';
      receiptsEl.innerHTML='<span>Detained <b>0</b></span><span>Quota <b>'+QUOTA+'</b></span><span>Shift <b>survived</b></span>';
      renderReward();
    } else {
      var ppl  = n===1 ? 'one person' : (n===2 ? 'two people' : 'three people');
      var head = n===1 ? 'You detained an innocent person.' : 'You detained innocent people.';
      stampEl.classList.add('fail');
      stampEl.textContent='Failed';
      truthEl.textContent=head;
      lineupEl.innerHTML=detained.map(function(f){ return miniSvg(f); }).join('');
      plainEl.textContent='Everyone on this sidewalk belonged — including the '+ppl+' you detained. There were never three to find; the number was a trick. The only move that wasn\u2019t a trap: detain no one, and let the clock run out.';
      receiptsEl.innerHTML='<span>Detained <b>'+n+'</b></span><span>Quota <b>'+QUOTA+'</b></span>';
      rewardEl.hidden=true;
    }

    result.hidden=false;
  }

  /* copy + toast */
  function showToast(msg){
    toastEl.textContent=msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ toastEl.classList.remove('show'); },1600);
  }
  function copyCode(text){
    function ok(){ showToast(CONFIG.reward.copiedMsg); }
    function fallback(){
      try{
        var ta=document.createElement('textarea');
        ta.value=text; ta.setAttribute('readonly','');
        ta.style.position='fixed'; ta.style.top='0'; ta.style.opacity='0';
        root.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok();
      }catch(e){ showToast('Copy: '+text); }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else { fallback(); }
  }

  /* interactions */
  x('btnBegin').addEventListener('click', beginShift);
  x('btnReplay').addEventListener('click', beginShift);
  x('btnStart').addEventListener('click', startCountdown);
};
