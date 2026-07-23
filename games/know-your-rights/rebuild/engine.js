/* =====================================================================
   KNOW YOUR RIGHTS — engine.js  (schema v2, greenfield)
   window.KnowYourRights.init(rootElement, baseUrl)

   ONE engine. Every scene is a graph of cards (schema v2, see
   rebuild/ARCHITECTURE.md + door.json). No legacy beats[], no procedural
   canvas, no per-scene special-casing. Art is SVG layers composited by
   rules evaluated against generic scene state (meters + flags). Content is
   one JSON object per scene, fetched whole from the kyr-content Worker,
   cached then refreshed.

   MECHANIC (unchanged from the original build):
   - Two outcomes: "do they take you?" (the primary meter, hidden, rolled
     once at the end, floored by law) and "is your case intact?" (pure
     player choice — damaged flag).
   - Four endings: clean / lucky / intact / damaged.
   - Fatal answers read as the reasonable, de-escalating choice and end the
     scene immediately.
   - Escape hatch ("Am I free to go?") = an `ask` answer, succeeds only at/
     below the scene's exitAt. The door has none — you win by never opening.
   - HUD: RECORD (changes the end-screen note, never the risk), per-prompt
     countdown, HINT (pulses the shield answer).

   PAGE CONTROLS  [data-kyr-reset] / [gm-reset-button] -> title. No pause.
   ===================================================================== */
window.KnowYourRights = window.KnowYourRights || {};

window.KnowYourRights.init = function (root, base, opts) {
  if (!root || root.dataset.booted) return;
  root.dataset.booted = '1';
  opts = opts || {};

  var CONFIG = {
    typeSpeed: 15,
    timeoutPenalty: 10,
    maxTimeouts: 3,
    reward: { code: '', link: '', desc: '' },
    recordedNote: 'You have it on video. Thirty seconds. It goes to the lawyer with everything else.'
  };
  var DIFF = { practice: 0, easy: 20, medium: 10, hard: 5 };

  /* ---- content source ---------------------------------------------- */
  var API = (opts.apiBase || 'https://kyr-content.casey-945.workers.dev').replace(/\/$/, '');
  var CACHE_INDEX = 'kyr:v2:index';
  var CACHE_SCENE = 'kyr:v2:scene:';      // + slug
  var FETCH_MS = 4000;

  /* Global endings — same four, stamp + truth. Offline baseline; the /v2
     index refreshes them. */
  var ENDINGS = {
    clean:   { stamp: 'WALKED AWAY', truth: 'You gave them nothing, and they had nothing.' },
    lucky:   { stamp: 'WALKED AWAY', truth: 'You handed them something and they let you go anyway. That was luck. Luck is not a plan.' },
    intact:  { stamp: 'DETAINED',    truth: 'They took you anyway. You gave them nothing. That is what a lawyer will need.' },
    damaged: { stamp: 'DETAINED',    truth: 'They took you, and they took what you gave them.' }
  };
  var INDEX = [];        // [{ slug, meta }]
  var SCENES = {};       // slug -> full scene object

  /* ============================== DOM =============================== */
  function x(n){ return root.querySelector('[data-el="'+n+'"]'); }
  var elTitle=x('title'), elMenuList=x('menuList'), elGame=x('game'), elResult=x('result'),
      elSpeaker=x('speaker'), elText=x('text'), elMore=x('more'), elOpts=x('opts'),
      elBar=x('bar'), elCount=x('count'), elRec=x('btnRec'), elHint=x('btnHint'),
      elSceneName=x('sceneName'), elDots=x('beatDots'),
      elStamp=x('stamp'), elTruth=x('truth'), elPlain=x('plain'), elList=x('list'),
      elReward=x('reward'), elDiff=x('diffRow'), elTitleTap=x('titleTap'),
      elLayers=x('layers'), elCanvas=x('canvas');
  if (elCanvas) elCanvas.style.display = 'none';    // v2 is SVG-layers only

  var difficulty='medium', S=null, typing=null, pendingThen=null, skipTo=null;
  function pick(a){ return a[(Math.random()*a.length)|0]; }

  /* ---------------------- dialogue box (typewriter) ----------------- */
  function say(line, narr, then){
    if (typing) clearInterval(typing); stopTimer();
    line = line || '';
    elOpts.hidden=true; elMore.hidden=true;
    elText.classList.toggle('narr', !!narr); elSpeaker.hidden=!!narr; elText.textContent='';
    var i=0;
    function settle(){ clearInterval(typing); typing=null; elText.textContent=line; elMore.hidden=false;
      elGame.dataset.await='1'; pendingThen=then; }
    typing=setInterval(function(){ elText.textContent=line.slice(0,++i); if(i>=line.length) settle(); }, CONFIG.typeSpeed);
    skipTo=settle;
  }
  function advance(){
    if (typing && skipTo){ skipTo(); return; }
    if (elGame.dataset.await==='1'){ elGame.dataset.await=''; elMore.hidden=true;
      var fn=pendingThen; pendingThen=null; if(fn) fn(); }
  }

  /* ---------------------- countdown timer --------------------------- */
  var timer={raf:null,t0:0,dur:0,timeouts:0};
  function stopTimer(){ if(timer.raf){ cancelAnimationFrame(timer.raf); timer.raf=null; }
    elBar.style.width='0%'; elBar.className='pr-bar'; elCount.textContent=''; elCount.className='pr-count'; }
  function startTimer(){ var secs=DIFF[difficulty];
    if(!secs){ elBar.style.width='100%'; elBar.className='pr-bar off'; elCount.textContent='∞'; elCount.className='pr-count off'; return; }
    timer.dur=secs*1000; timer.t0=performance.now();
    (function tick(now){ var left=timer.dur-(now-timer.t0), frac=Math.max(0,left/timer.dur), hot=left<=3000;
      elBar.style.width=(frac*100)+'%'; elBar.className='pr-bar'+(hot?' hot':'');
      elCount.textContent=Math.max(0,Math.ceil(left/1000)); elCount.className='pr-count'+(hot?' hot':'');
      if(left<=0){ timer.raf=null; onTimeout(); return; } timer.raf=requestAnimationFrame(tick); })(timer.t0); }
  function onTimeout(){ timer.timeouts++; applyMeters({ detain: CONFIG.timeoutPenalty }, true);
    if (timer.timeouts>=CONFIG.maxTimeouts){ timer.timeouts=0;
      var card=curCard(); if(card && card.answers && card.answers.length) return chooseAnswer(card.answers[0]); return; }
    say(pick(['“I am not going to ask again.”','“Answer me. Now.”','“You are running out of time.”']), false, renderCard); }

  /* ============================ ART LAYERS ========================== */
  /* Build one <img> per declared layer, keyed by layer.key; show/hide by
     the current card's base layers + matching rules. Scene-agnostic. */
  var layerImgs={}, layerBuiltFor=null;
  function buildLayers(scene){
    if (layerBuiltFor === scene.slug) return;
    layerBuiltFor = scene.slug; layerImgs = {}; elLayers.innerHTML='';
    var stack=document.createElement('div'); stack.className='pr-stack';
    (scene.art.layers||[]).forEach(function(l){
      var im=document.createElement('img'); im.src=base + l.file; im.alt=''; im.decoding='async';
      im.className='hide'; stack.appendChild(im); layerImgs[l.key]=im;
    });
    elLayers.appendChild(stack);
  }
  function ruleMatch(cond){
    if (cond.flags) for (var f in cond.flags){ var want=cond.flags[f], have=S.flags[f];
      if (want && typeof want==='object' && 'not' in want){ if (have===want.not) return false; }
      else if (have!==want) return false; }
    if (cond.meters) for (var m in cond.meters){ var c=cond.meters[m], v=S.meters[m]||0;
      if ('gte' in c && !(v>=c.gte)) return false; if ('lte' in c && !(v<=c.lte)) return false; }
    return true;
  }
  function paintLayers(card){
    var art=S.scene.art, show={};
    (card.layers || art.base || []).forEach(function(k){ show[k]=true; });
    (art.rules || []).forEach(function(r){ if (ruleMatch(r.if)) show[r.show]=true; });
    (card.rules || []).forEach(function(r){ if (ruleMatch(r.if)) show[r.show]=true; });
    for (var k in layerImgs) layerImgs[k].classList.toggle('hide', !show[k]);
  }

  /* ============================ GAMEPLAY ============================ */
  function curCard(){ return S ? S.scene.cards[S.cardId] : null; }
  function floorOf(){ return S.scene.meta.floor || 0; }
  function primaryKey(){ var m=(S.scene.meters||[]).filter(function(x){return x.primary;})[0]||S.scene.meters[0]; return m?m.key:'detain'; }
  function maxOf(key){ var m=(S.scene.meters||[]).filter(function(x){return x.key===key;})[0]; return m?(m.max||100):100; }

  function applyMeters(deltas, isTimeout){
    if (!deltas) return; var pk=primaryKey();
    for (var k in deltas){
      var lo = (k===pk) ? floorOf() : 0, hi = maxOf(k), cur = S.meters[k]||0;
      S.meters[k] = Math.min(hi, Math.max(lo, cur + deltas[k]));
    }
    // timeout penalty pushes the primary meter up but must still respect the cap
    if (isTimeout){ S.meters[pk] = Math.min(maxOf(pk), S.meters[pk]); }
  }

  function startScene(slug){
    var scene=SCENES[slug]; if (!scene){ return toTitle(); }   // not loaded yet — fail open to title
    var meters={}; (scene.meters||[]).forEach(function(m){ meters[m.key] = m.primary ? (scene.meta.floor||0) : 0; });
    var flags={}; for (var f in (scene.flags||{})) flags[f]=scene.flags[f];
    S = { scene:scene, slug:slug, cardId:scene.start, meters:meters, flags:flags,
          credits:{}, damaged:false, recording:false, over:false, pathLen:0, cardsSeen:{} };
    elTitle.hidden=true; elResult.hidden=true; elGame.hidden=false;
    elSceneName.textContent=scene.meta.name; elRec.className='pr-rec';
    buildLayers(scene); elLayers.hidden=false;
    var first=curCard(); if (first) paintLayers(first);   // paint before the opening line, no black flash
    drawDots();
    say(scene.meta.open, true, renderCard);
  }

  function renderCard(){
    var card=curCard();
    if (!card){ return finish(); }
    if (card.type==='end'){ return finish(!!card.fatal); }
    paintLayers(card);
    S.cardsSeen[S.cardId]=true; S.pathLen++; drawDots();
    var resp=(card.responses||[])[0];
    if (!resp){ return showChoices(card); }
    var extra=(card.responses||[]).slice(1).filter(function(r){ return r.mode==='narration-on-shield'; });
    say(pickText(resp), resp.speaker==null, function(){
      if (extra.length){ say(pickText(extra[0]), true, function(){ showChoices(card); }); }
      else showChoices(card);
    });
  }
  function pickText(resp){ return (resp.mode==='random') ? pick(resp.texts) : resp.texts[0]; }

  function showChoices(card){
    elOpts.innerHTML='';
    card.answers.forEach(function(a,i){ var b=document.createElement('button');
      b.className='pr-opt'; b.type='button'; b.dataset.i=i;
      b.innerHTML='<span class="pr-cur">▶</span><span>'+a.text+'</span>'; elOpts.appendChild(b); });
    elOpts.hidden=false; timer.timeouts=0; startTimer();
    elOpts.onclick=function(e){ var t=e.target.closest('.pr-opt'); if(!t) return; chooseAnswer(card.answers[+t.dataset.i]); };
  }

  function chooseAnswer(a){
    stopTimer();
    // escape hatch
    if (a.ask){ var pk=primaryKey(), exitAt=S.scene.meta.exitAt;
      if (exitAt!=null && S.meters[pk]<=exitAt){ S.credits.walked=true;
        return say('“Yeah. Go on.”', true, function(){ finish(false); }); }
      return say(S.scene.meta.exitDeny || '“No.”', false, function(){
        if (a.goto){ S.cardId=a.goto; renderCard(); } else renderCard(); }); }
    // effects
    (a.credits||[]).forEach(function(k){ S.credits[k]=true; });
    if (a.damaged) S.damaged=true;
    if (a.flags) for (var f in a.flags) S.flags[f]=a.flags[f];
    if (a.meters) applyMeters(a.meters);
    // fatal ends immediately
    if (a.grade==='fatal'){ var pk2=primaryKey(); S.meters[pk2]=maxOf(pk2);
      S.cardId = a.goto || S.cardId;
      var endCard = curCard();
      if (endCard && endCard.setFlags) for (var g in endCard.setFlags) S.flags[g]=endCard.setFlags[g];
      paintLayers({});                      // recomposite base+rules under the fatal end-state (e.g. door open)
      return say(a.why||'', true, function(){ finish(true); }); }
    if (!a.goto){ return finish(); }
    S.cardId=a.goto; repaintCurrent();
    if (a.why){ return say(a.why, true, renderCard); }
    renderCard();
  }
  function repaintCurrent(){ var c=curCard(); if (c && c.type!=='end') paintLayers(c); }

  function drawDots(){ elDots.innerHTML='';
    var n=Math.min(S.pathLen||0, 12);
    for (var j=0;j<n;j++){ var d=document.createElement('i'); d.className = j<n-1?'on':'now'; elDots.appendChild(d); } }

  /* ------------------------------- HUD ------------------------------ */
  elRec.addEventListener('click', function(){ if(!S) return;
    if(!S.recording){ S.recording=true; S.credits.record=true; elRec.classList.add('on'); } });
  elHint.addEventListener('click', function(){ if(!S||elGame.hidden) return;
    var card=curCard(); if(!card||!card.answers) return; var gi=-1;
    card.answers.forEach(function(a,i){ if(a.ask||a.grade==='shield'||a.grade==='steady') gi=i; });
    if(gi>=0){ var o=elOpts.querySelector('[data-i="'+gi+'"]'); if(o) pulse(o); } });
  function pulse(el){ el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint');
    setTimeout(function(){ el.classList.remove('hint'); },1600); }

  /* ------------------------------ FINISH ---------------------------- */
  function finish(forcedDetain){
    if (S.over) return; S.over=true; stopTimer();
    var scene=S.scene, meta=scene.meta, pk=primaryKey(), risk=S.meters[pk]||0;
    var detained = forcedDetain===true ? true : (Math.random()*100 < risk), forced=false;
    var fe=meta.forcedEntry;
    if (fe && (meta.floor||0)===0 && !S.damaged && risk===0 && !detained && Math.random()<fe.chance){
      detained=true; forced=true;
    }
    var key = detained ? (S.damaged?'damaged':'intact') : (S.damaged?'lucky':'clean');
    var e = ENDINGS[key] || ENDINGS.clean;
    if (forced){ if (fe.setFlags) for (var f in fe.setFlags) S.flags[f]=fe.setFlags[f]; paintLayers({}); }
    elGame.hidden=true; elResult.hidden=false;
    elStamp.textContent=e.stamp; elStamp.className='gm-stamp '+(detained?'bad':'ok');
    var truth = forced ? fe.text : e.truth; if (S.recording) truth += '\n\n' + CONFIG.recordedNote;
    elTruth.textContent=truth; elPlain.textContent=meta.law||'';
    elList.innerHTML='';
    (scene.credits||[]).forEach(function(c){ var li=document.createElement('li'); var got=!!S.credits[c.key];
      li.className=got?'got':''; li.innerHTML='<span class="bx">'+(got?'☑':'☐')+'</span>'+c.label; elList.appendChild(li); });
    renderReward();
  }
  function renderReward(){ var r=CONFIG.reward; elReward.innerHTML='';
    if(!r.code&&!r.link){ elReward.hidden=true; return; } elReward.hidden=false;
    if(r.desc){ var d=document.createElement('div'); d.className='gm-reward-desc'; d.textContent=r.desc; elReward.appendChild(d); }
    if(r.code){ var c=document.createElement('div'); c.className='gm-code'; c.textContent=r.code; elReward.appendChild(c); } }

  /* ------------------------------ MENU ------------------------------ */
  var devUnlocked=false;
  function toTitle(){ if(typing){ clearInterval(typing); typing=null; } stopTimer();
    elTitle.hidden=false; elGame.hidden=true; elResult.hidden=true; }
  function buildMenu(){
    elMenuList.innerHTML='';
    INDEX.forEach(function(entry){
      var meta=entry.meta||{}, isActive=meta.active!==false;
      if (!isActive && !devUnlocked) return;
      var b=document.createElement('button'); b.className='pr-row'; b.type='button'; b.dataset.slug=entry.slug;
      if (!isActive) b.classList.add('pr-row--dev');
      b.innerHTML='<span class="pr-cur">▶</span><span class="pr-rowin"><b>'+meta.name+
        (isActive?'':' <i class="pr-devtag">DEV</i>')+'</b><i>'+(meta.teaches||'')+'</i></span>';
      elMenuList.appendChild(b);
    });
  }

  elDiff.addEventListener('click', function(e){ var b=e.target.closest('[data-diff]'); if(!b) return;
    difficulty=b.dataset.diff; elDiff.querySelectorAll('[data-diff]').forEach(function(z){ z.classList.toggle('on',z===b); }); });
  elDiff.querySelector('[data-diff="medium"]').classList.add('on');
  elMenuList.addEventListener('click', function(e){ var b=e.target.closest('.pr-row'); if(!b) return; enterScene(b.dataset.slug); });
  x('box').addEventListener('click', function(e){ if(e.target.closest('.pr-opt')) return; advance(); });
  x('btnReplay').addEventListener('click', function(){ enterScene(S.slug); });
  x('btnTitle').addEventListener('click', toTitle);
  x('btnQuit').addEventListener('click', toTitle);
  root._kyrReset=toTitle;
  document.addEventListener('click', function(e){ var t=e.target; if(!t||!t.closest) return;
    if(t.closest('[data-kyr-reset]')||t.closest('[gm-reset-button]')){ e.preventDefault(); toTitle(); } });

  (function(){ if(!elTitleTap) return; var taps=0, rt=null;
    elTitleTap.addEventListener('click', function(){ taps++; clearTimeout(rt);
      rt=setTimeout(function(){ taps=0; },2000);
      if(taps>=8){ taps=0; if(!devUnlocked){ devUnlocked=true; buildMenu(); } } }); })();

  /* Ensure the scene's content is present (cache or fetch) before entering. */
  function enterScene(slug){
    if (SCENES[slug]) return startScene(slug);
    var cached=readJSON(CACHE_SCENE+slug); if (cached){ SCENES[slug]=cached; startScene(slug); }
    fetchScene(slug).then(function(sc){ if(sc){ SCENES[slug]=sc; if(!S||S.over||S.slug!==slug) return; } })
      .catch(function(){});
    if (!SCENES[slug]) { /* still nothing — fetch and start when it lands */
      fetchScene(slug).then(function(sc){ if(sc){ SCENES[slug]=sc; startScene(slug); } }).catch(function(){ toTitle(); }); }
  }

  /* --------------------------- CONTENT I/O -------------------------- */
  function readJSON(key){ try{ var r=localStorage.getItem(key); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function writeJSON(key,val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){} }
  function fetchT(url){ var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    var t=ctrl?setTimeout(function(){ctrl.abort();},FETCH_MS):null;
    return fetch(url, ctrl?{signal:ctrl.signal}:{}).finally(function(){ if(t) clearTimeout(t); }); }
  function fetchScene(slug){
    return fetchT(API+'/api/kyr/v2/scenes/'+encodeURIComponent(slug))
      .then(function(r){ if(!r.ok) throw new Error('scene fetch'); return r.json(); })
      .then(function(sc){ if(sc&&sc.error) throw new Error(sc.error); writeJSON(CACHE_SCENE+slug, sc); return sc; });
  }
  function applyIndex(payload){
    if (payload && payload.scenes){ INDEX=payload.scenes; if (payload.endings) ENDINGS=payload.endings; }
    buildMenu();
  }
  function loadIndex(){
    var cached=readJSON(CACHE_INDEX);
    if (cached){ applyIndex(cached); } else { buildMenu(); }
    toTitle();
    fetchT(API+'/api/kyr/version')
      .then(function(r){ if(!r.ok) throw 0; return r.json(); })
      .then(function(v){ if (cached && cached.version===v.version) return;
        return fetchT(API+'/api/kyr/v2/scenes').then(function(r){ if(!r.ok) throw 0; return r.json(); })
          .then(function(fresh){ fresh.version=v.version; writeJSON(CACHE_INDEX, fresh); SCENES={}; applyIndex(fresh);
            if(!S||S.over) toTitle(); }); })
      .catch(function(){});
  }

  /* ------------------------------- FIT ------------------------------ */
  function fit(){ var el=root.parentElement;
    for (var i=0; el&&i<8; i++){ var tag=(el.tagName||'').toUpperCase(); if(tag==='BODY'||tag==='HTML') break;
      el.style.display='flex'; el.style.flexDirection='column'; el.style.minHeight='0'; el.style.height='100%';
      if(el.classList && el.classList.contains('games-script')) break; el=el.parentElement; }
    requestAnimationFrame(function(){ if(root.offsetHeight<160) root.style.height=Math.max(560,Math.round(window.innerHeight*0.85))+'px'; }); }
  fit();

  /* ------------------------------- BOOT ----------------------------- */
  if (opts.scenes){                    // test/preload injection: {slug:sceneObj,...}
    for (var s in opts.scenes) SCENES[s]=opts.scenes[s];
    INDEX = opts.index || Object.keys(opts.scenes).map(function(k){ return { slug:k, meta:opts.scenes[k].meta }; });
    if (opts.endings) ENDINGS=opts.endings;
    buildMenu(); toTitle();
  } else {
    loadIndex();
  }
};
