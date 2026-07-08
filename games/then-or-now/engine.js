/* =====================================================================
   THEN OR NOW — engine.js
   A satirical — but historically educational — game by Casey The American.

   One fact per file. Is it the Reich, or is it now? The mechanic IS the
   argument: the facts are indistinguishable because the machinery is.

   Loaded by loader.js, which injects the markup and calls:
       window.ThenOrNow.init(rootElement, baseUrl)
   ===================================================================== */
window.ThenOrNow = window.ThenOrNow || {};
window.ThenOrNow.init = function (root, base) {
  if (!root || root.dataset.booted) return;
  root.dataset.booted = '1';

  /* ═══════════════ CONFIG — change these freely ═══════════════ */
  var CONFIG = {
    /* How many files to draw, at random, from the bank below.
       Set to 0 (or a number >= the bank size) to always show all of them. */
    filesPerRound: 5,

    /* Reward shows only on a perfect run. Empty fields render nothing. */
    reward: {
      code:      'Urteil' /*CMS:reward-code*/,
      link:      ''       /*CMS:reward-link*/,
      desc:      'You never mistook the Reich for the present' /*CMS:reward-desc*/,
      copiedMsg: 'Code copied'
    }
  };
  /* ════════════════════════════════════════════════════════════ */

  /* Each card may carry one receipt: {label, url}. Omit it and nothing renders. */
  var BANK = [
    { tag:'Camps',
      fact:"In a single year, the number of people held in the state's detention camps grew by roughly three-quarters, with new facilities opening across the country to keep up.",
      hy:'1934', my:'2025', answer:'modern',
      truth:'2025 — ICE / United States',
      reveal:"In one year, ICE detention grew from about 40,000 people to a record 73,000 — a jump of nearly three-quarters — as the system raced to add beds in county jails, tent camps, and military sites. The Reich's camp network scaled the same way after Dachau opened in 1933. That's why it's hard to tell.",
      ct:'Mass arbitrary imprisonment',
      src:{ label:'CBS News — ICE detainee population hits 73,000', url:'https://www.cbsnews.com/news/ices-detainee-population-record-high-of-73000/' } },

    { tag:'Citizenship',
      fact:"A government directive orders officials to prioritize and 'maximally pursue' the stripping of citizenship from naturalized citizens.",
      hy:'1935', my:'2025', answer:'modern',
      truth:'2025 — ICE / United States',
      reveal:"In June 2025, the Justice Department ordered prosecutors to 'maximally pursue' denaturalization — stripping citizenship from naturalized Americans. For decades it was used only a handful of times a year; now field offices are pushed to refer 100 to 200 cases a month. Stripping a targeted group of its citizenship is exactly what the 1935 Nuremberg Laws did.",
      ct:'Persecution by stripping citizenship',
      src:{ label:'NPR — DOJ moves to prioritize stripping citizenship', url:'https://www.npr.org/2025/06/30/nx-s1-5445398/denaturalization-trump-immigration-enforcement' } },

    { tag:'The Megaphone', trick:true,
      fact:"Officials brand a whole population of immigrants an 'invasion' of the homeland — and use that exact word to unlock emergency wartime powers against them.",
      hy:'1938', my:'2025', answer:'both',
      truth:'Both eras',
      reveal:"In 2025, the 'invasion' label was used to invoke the Alien Enemies Act of 1798 against Venezuelan immigrants. Nazi propaganda cast Jews as an alien 'invasion' to justify 'emergency' measures. Same move, different decade. Either year counts here — but 'Both' was the sharp answer.",
      ct:'Incitement and dehumanization',
      src:{ label:'NPR — Contempt finding over Alien Enemies Act deportations', url:'https://www.npr.org/2025/04/16/g-s1-60696/judge-contempt-alien-enemies-act' } },

    { tag:'Night & Fog',
      fact:"An official decree lets the state seize people and make them vanish 'into night and fog,' with authorities refusing to tell families where they are or whether they're alive.",
      hy:'1941', my:'2026', answer:'historic',
      truth:'1941 — Reich',
      reveal:"This is the Night and Fog decree of 1941, signed to make opponents disappear without a trace. Eighty years later, men deported to El Salvador's CECOT mega-prison vanished from ICE's online locator while their families were told nothing — what Human Rights Watch calls an enforced disappearance. The decree is historic. The echo is now.",
      ct:'Enforced disappearance',
      src:{ label:'Human Rights Watch — Deportees forcibly disappeared', url:'https://www.hrw.org/news/2026/03/16/us/el-salvador-deportees-forcibly-disappeared' } },

    { tag:'Deportation',
      fact:"The government pays to ship detainees to prisons in other countries — and keeps the transports running after a court orders them stopped.",
      hy:'1942', my:'2025', answer:'modern',
      truth:'2025 — ICE / United States',
      reveal:"The U.S. paid El Salvador to hold deportees, and flights to its CECOT mega-prison kept flying after a federal judge ordered the planes turned around — enough for the judge to find probable cause to hold the administration in criminal contempt. The Reich deported too. It just had no judges to defy.",
      ct:'Unlawful deportation',
      src:{ label:'Human Rights Watch — Torture of Venezuelan deportees', url:'https://www.hrw.org/news/2025/11/12/us/el-salvador-torture-of-venezuelan-deportees' } },

    { tag:'Forced Labor',
      fact:"People held in the camps are put to work running the place — cooking, cleaning, laundry — for about a dollar a day.",
      hy:'1943', my:'2025', answer:'modern',
      truth:'2025 — ICE / United States',
      reveal:"Detainees keep ICE facilities running — kitchen, laundry, sanitation — for about a dollar a day, doing work that would otherwise need scores of paid staff. In 2026 the Supreme Court let a forced-labor lawsuit over it go forward. The Reich ran on camp labor too, far more brutally; the dollar-a-day detail is what's new.",
      ct:'Forced labor',
      src:{ label:'Colorado Newsline — Forced-labor lawsuit moves forward', url:'https://coloradonewsline.com/briefs/supreme-court-ice-forced-labor-lawsuit/' } },

    { tag:'The Catch', trick:true,
      fact:"Faced with public outcry, the officials running the camps voluntarily resigned, shut the facilities down, and turned themselves in for judgment.",
      hy:'1944', my:'2026', answer:'neither',
      truth:'Neither',
      reveal:"Neither. No one ever walked away on their own. It took the Nuremberg trials, from 1945 to 1949, to force a reckoning — and the modern one hasn't come at all. If you picked a year, you assumed an apology that history never offers.",
      ct:'Willful blindness (you expected a voluntary apology)' },

    { tag:'The Reckoning',
      fact:"Officials defend mass round-ups by saying they were only carrying out lawful orders — and a court rules that this is no defense at all.",
      hy:'1946', my:'2025', answer:'historic',
      truth:'1946 — Reich (on trial)',
      reveal:"At Nuremberg in 1946, the defense 'Befehl ist Befehl' — 'orders are orders' — was rejected: following orders does not excuse the act. No court has said this to ICE yet — which is why the year is 1946, not 2025. That ruling is the measuring stick the present will be held to.",
      foot:'Befehl ist Befehl — \u201corders are orders.\u201d',
      ct:"Accepting 'just following orders'" }
  ];

  var x = function (n) { return root.querySelector('[data-el="' + n + '"]'); };

  var stage = x('stage'), card = x('card');
  var fileLabel = x('fileLabel'), progFill = x('progFill'), dots = x('dots');
  var frontFile = x('frontFile'), frontTag = x('frontTag'), factEl = x('fact');
  var yrHist = x('yrHist'), yrMod = x('yrMod');
  var backFile = x('backFile'), resTag = x('resTag');
  var cardTruth = x('cardTruth'), revealEl = x('reveal'), footEl = x('foot'), srcEl = x('src');
  var btnSeeResult = x('btnSeeResult'), btnReread = x('btnReread');
  var btnPrev = x('btnPrev'), btnNext = x('btnNext');
  var intro = x('intro'), result = x('result');
  var stampEl = x('stamp'), truthEl = x('truth'), plainEl = x('plain');
  var receiptsEl = x('receipts'), chargesEl = x('charges'), rewardEl = x('reward');
  var toastEl = x('toast');

  var active = [], results = [], current = 0, toastTimer = null, sliding = false;

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function pad2(n){ return (n<10?'0':'')+n; }
  function roman(n){ var m=[['X',10],['IX',9],['V',5],['IV',4],['I',1]], r=''; for(var i=0;i<m.length;i++){ while(n>=m[i][1]){ r+=m[i][0]; n-=m[i][1]; } } return r; }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  /* Draw a fresh random subset each round. Files are numbered by display order. */
  function pickRound(){
    var want = (typeof CONFIG.filesPerRound === 'number' && CONFIG.filesPerRound > 0) ? CONFIG.filesPerRound : BANK.length;
    var n = Math.min(want, BANK.length);
    var pool = shuffle(BANK);
    active = [];
    for (var i=0;i<n;i++){
      var s = pool[i], c = {};
      for (var k in s) if (s.hasOwnProperty(k)) c[k]=s[k];
      c.file = 'File ' + pad2(i+1);
      active.push(c);
    }
    results = new Array(active.length).fill(null);
    current = 0;
  }

  function classify(ans, picked, opt){
    var valid = (ans === 'both') ? ['historic','modern','both'] : [ans];
    var isPicked = opt===picked, isBest = opt===ans, isValid = valid.indexOf(opt)>-1;
    if (isPicked){ if (isBest) return 'pick-win'; if (isValid) return 'pick-ok'; return 'pick-bad'; }
    if (isBest) return 'line-win';
    if (isValid) return 'line-ok';
    return 'dim';
  }

  /* ---- rendering one card ---- */
  function paint(i){
    var c = active[i], r = results[i];

    card.classList.remove('flipped','done','res-win','res-ok','res-bad');
    frontFile.textContent = c.file;
    backFile.textContent  = c.file;
    frontTag.textContent  = c.tag;
    factEl.textContent    = c.fact;
    yrHist.textContent    = c.hy;
    yrMod.textContent     = c.my;

    cardTruth.textContent = c.truth;
    revealEl.textContent  = c.reveal;
    if (c.foot){ footEl.textContent = c.foot; footEl.hidden = false; } else { footEl.hidden = true; }

    /* per-card receipt — renders only when the card carries one */
    if (c.src && c.src.url){ srcEl.textContent = c.src.label; srcEl.href = c.src.url; srcEl.hidden = false; }
    else { srcEl.hidden = true; srcEl.removeAttribute('href'); }

    var opts = card.querySelectorAll('[data-pick]');
    for (var k=0;k<opts.length;k++) opts[k].className = opts[k].classList.contains('ng-yr') ? 'ng-opt ng-yr' : 'ng-opt ng-altb';

    btnSeeResult.hidden = true;

    if (r !== null){ restoreAnswered(i); }
    syncChrome();
  }

  function restoreAnswered(i){
    var c = active[i], pick = results[i].pick;
    card.querySelectorAll('[data-pick]').forEach(function(el){
      el.classList.add(classify(c.answer, pick, el.getAttribute('data-pick')));
    });
    card.classList.add('done','res-'+results[i].state);
    resTag.textContent = tagFor(results[i].state);
    btnSeeResult.hidden = false;
    card.classList.add('flipped');
  }

  function tagFor(state){
    return state==='win' ? '\u2713 Richtig (correct)'
         : state==='ok'  ? '\u2713 G\u00FCltig (valid \u2014 not the sharpest)'
         :                 '\u2717 Falsch (wrong)';
  }

  function answer(pick){
    var i = current;
    if (results[i] !== null) return;
    var c = active[i];
    var valid = (c.answer==='both') ? ['historic','modern','both'] : [c.answer];
    var passed = valid.indexOf(pick) > -1;
    var state = !passed ? 'bad' : (pick===c.answer ? 'win' : 'ok');
    results[i] = { pick:pick, passed:passed, state:state };

    card.querySelectorAll('[data-pick]').forEach(function(el){
      el.classList.add(classify(c.answer, pick, el.getAttribute('data-pick')));
    });
    card.classList.add('done','res-'+state);
    resTag.textContent = tagFor(state);
    btnSeeResult.hidden = false;
    card.classList.add('flipped');       // auto-reveal
    syncChrome();
  }

  /* ---- navigation: cards slide off-screen ---- */
  function goTo(i, dir){
    if (sliding || i<0 || i>=active.length) return;
    sliding = true;
    card.classList.add(dir>0 ? 'slide-out-left' : 'slide-out-right');
    setTimeout(function(){
      current = i;
      card.classList.remove('slide-out-left','slide-out-right');
      card.classList.add(dir>0 ? 'slide-in-right' : 'slide-in-left');
      paint(i);
      card.scrollTop = 0;
      requestAnimationFrame(function(){
        card.classList.remove('slide-in-right','slide-in-left');
        setTimeout(function(){ sliding = false; }, 340);
      });
    }, 340);
  }

  function syncChrome(){
    var answered = results.filter(function(r){ return r!==null; }).length;
    fileLabel.textContent = 'File ' + pad2(current+1) + ' / ' + pad2(active.length);
    progFill.style.width = (answered/active.length*100) + '%';

    dots.innerHTML = '';
    for (var i=0;i<active.length;i++){
      var d = document.createElement('i');
      if (results[i]) d.className = results[i].state;
      else if (i===current) d.className = 'on';
      dots.appendChild(d);
    }

    btnPrev.disabled = current === 0;
    var done = results[current] !== null;
    btnNext.disabled = !done;
    btnNext.innerHTML = (current === active.length-1) ? 'Read the verdict &#8594;' : 'Next &#8594;';
  }

  /* ---- reward (graceful: renders only what exists) ---- */
  function renderReward(){
    var r = CONFIG.reward;
    rewardEl.innerHTML = '';
    if (!r.code && !r.link){ rewardEl.hidden = true; return; }
    rewardEl.hidden = false;

    if (r.desc){
      var d = document.createElement('div');
      d.className = 'gm-reward-desc'; d.textContent = r.desc; rewardEl.appendChild(d);
    }
    if (r.code){
      var box = document.createElement('div'); box.className = 'gm-code';
      var span = document.createElement('span'); span.textContent = r.code; box.appendChild(span);
      var btn = document.createElement('button'); btn.type='button'; btn.textContent='Copy';
      btn.addEventListener('click', function(){ copyCode(r.code); });
      box.appendChild(btn); rewardEl.appendChild(box);
    }
    if (r.link){
      var a = document.createElement('a');
      a.className='gm-btn'; a.href=r.link; a.target='_blank'; a.rel='noopener';
      a.style.textDecoration='none'; a.textContent = r.code ? 'Shop with it applied' : 'Open shop';
      rewardEl.appendChild(a);
    }
  }

  function showVerdict(){
    var wrong = [];
    results.forEach(function(r,i){ if (r && !r.passed) wrong.push(active[i]); });
    var right = results.filter(function(r){ return r && r.passed; }).length;
    var clean = wrong.length === 0;

    stampEl.classList.remove('pass','fail');
    chargesEl.innerHTML = '';

    if (clean){
      stampEl.classList.add('pass');
      stampEl.textContent = 'Acquitted';
      truthEl.textContent = 'You never mistook the Reich for the present.';
      plainEl.textContent = 'You placed every file correctly \u2014 which means you could see the machinery for what it is, in whichever decade it was running.';
      renderReward();
    } else {
      stampEl.classList.add('fail');
      stampEl.textContent = 'Indicted \u00B7 ' + wrong.length;
      truthEl.textContent = wrong.length===1 ? 'One count against you.' : wrong.length + ' counts against you.';
      plainEl.textContent = "Each wrong answer means you couldn't tell the Reich from 2026 \u2014 which is precisely how it works the second time. Your charge sheet:";
      var html = '';
      wrong.forEach(function(c, idx){
        html += '<li><span class="ct">Count ' + roman(idx+1) + ' \u2014 ' + esc(c.ct) + '</span>' + esc(c.tag) + ' \u2014 ' + esc(c.file) + '</li>';
      });
      chargesEl.innerHTML = html;
      rewardEl.hidden = true;
    }

    receiptsEl.innerHTML = '<span>Placed <b>' + right + '/' + active.length + '</b></span>' +
                           '<span>Verdict <b>' + (clean ? 'Acquitted' : 'Indicted') + '</b></span>';

    progFill.style.width = '100%';
    fileLabel.textContent = 'Verdict';
    result.hidden = false;
  }

  /* ---- copy + toast ---- */
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 1600);
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
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  /* ---- lifecycle ---- */
  function beginRound(){
    intro.hidden = true; result.hidden = true;
    pickRound();
    card.classList.remove('slide-out-left','slide-out-right','slide-in-left','slide-in-right');
    sliding = false;
    paint(0);
    card.scrollTop = 0;
  }

  /* ---- fill the parent Webflow column ---- */
  function fitToContainer(){
    var el = root.parentElement;
    for (var i=0; el && i<8; i++){
      var tag = (el.tagName||'').toUpperCase();
      if (tag==='BODY' || tag==='HTML') break;
      el.style.display='flex'; el.style.flexDirection='column';
      el.style.minHeight='0'; el.style.height='100%';
      if (el.classList && el.classList.contains('games-script')) break;
      el = el.parentElement;
    }
    requestAnimationFrame(function(){
      if (root.offsetHeight < 120) root.style.height = Math.max(460, Math.round(window.innerHeight*0.8)) + 'px';
    });
  }
  fitToContainer();

  /* ---- interactions ---- */
  card.addEventListener('click', function(e){
    var opt = e.target.closest('[data-pick]');
    if (opt && !card.classList.contains('done')) { answer(opt.getAttribute('data-pick')); return; }
    if (e.target.closest('[data-el="btnSeeResult"]')) { card.classList.add('flipped'); return; }
    if (e.target.closest('[data-el="btnReread"]'))    { card.classList.remove('flipped'); }
  });
  btnPrev.addEventListener('click', function(){ goTo(current-1, -1); });
  btnNext.addEventListener('click', function(){
    if (results[current] === null) return;
    if (current === active.length-1) showVerdict();
    else goTo(current+1, 1);
  });
  x('btnBegin').addEventListener('click', beginRound);
  x('btnReplay').addEventListener('click', beginRound);

  pickRound();
  paint(0);
};
