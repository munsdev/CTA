/* =====================================================================
   HISTORY OR HEADLINES — engine.js
   A satirical — but historically educational — game by Casey The American.

   One fact per file. Is it the Reich, or is it now? The mechanic IS the
   argument: the facts are hard to tell apart because the machinery is.

   Loaded by loader.js, which injects the markup and calls:
       window.HistoryOrHeadlines.init(rootElement, baseUrl)

   EXTERNAL CONTROLS (put these on any Webflow element on the page):
       [data-hoh-reset]     -> returns the game to its start screen
       [gm-reset-button]    -> same (house-wide convention)
   There is no pause control: this game is step-by-step, so nothing runs
   that could be paused.
   ===================================================================== */
window.HistoryOrHeadlines = window.HistoryOrHeadlines || {};
window.HistoryOrHeadlines.init = function (root, base) {
  if (!root || root.dataset.booted) return;
  root.dataset.booted = '1';

  /* ═══════════════ CONFIG — change these freely ═══════════════ */
  var CONFIG = {
    /* Default number of files drawn, at random, from the bank below.
       The player can change it with the gear on the start screen.
       Range is always 1 .. BANK.length, so adding cards widens it. */
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

  /* Each card may carry one receipt: {label, url}. Omit it, nothing renders.
     Every fact carries a "pin" — one detail that fixes it to a single era —
     so a reader who knows the history can always reconstruct the answer. */
  var BANK = [

    /* ---------------- BOTH ---------------- */
    { tag:'Camps',
      fact:"In one year, the number of people locked up in the country's detention camps jumps by three quarters. New camps open across the country to hold them all.",
      hy:'1934', my:'2026', answer:'both',
      truth:'Both eras',
      reveal:"ICE went from about 40,000 people to more than 71,000 in a single year, filling county jails, tents on army bases, and empty warehouses. Nazi camps grew the same way after Dachau opened in 1933. Both answers are true here \u2014 but 'Both' was the sharp one.",
      ct:'Mass detention without trial',
      src:{ label:'Human Rights Watch \u2014 Dying in Detention', url:'https://www.hrw.org/report/2026/06/25/dying-in-detention/rising-deaths-in-an-expanding-us-immigration-detention-system' } },

    { tag:'The Megaphone',
      fact:"The government calls immigrants an invasion. Then it uses that one word to switch on emergency wartime powers against them.",
      hy:'1938', my:'2025', answer:'both',
      truth:'Both eras',
      reveal:"In 2025 the word 'invasion' was used to invoke a wartime law from 1798 against Venezuelan immigrants. Nazi propaganda called Jews an invasion to justify emergency measures. Same move, different century. Either year counts \u2014 but 'Both' was the sharp answer.",
      ct:'Incitement and dehumanization',
      src:{ label:'NPR \u2014 Judge finds contempt over wartime-law deportations', url:'https://www.npr.org/2025/04/16/g-s1-60696/judge-contempt-alien-enemies-act' } },

    { tag:'The Announcement',
      fact:"The government opens its first big detention camp \u2014 and invites reporters to the announcement. It tells them how many people the camp will hold, and who.",
      hy:'1933', my:'2025', answer:'both',
      truth:'Both eras',
      reveal:"Himmler announced Dachau to reporters on 20 March 1933: room for 5,000, and he named the political groups going in. In 2025, officials walked reporters through the Everglades camp and gave it a nickname. Neither government hid its camps. That is the unsettling part.",
      ct:'Detention as public spectacle',
      src:{ label:'Alpha History \u2014 The opening of Dachau, 1933', url:'https://alphahistory.com/nazigermany/the-opening-of-dachau-1933/' } },

    { tag:'The Tip Line',
      fact:"The government asks ordinary people to report neighbors they think don't belong. Then it acts on what they say.",
      hy:'1937', my:'2026', answer:'both',
      truth:'Both eras',
      reveal:"The Gestapo had surprisingly few officers. It ran on ordinary Germans informing on each other. ICE runs a public tip line. In both cases the machine doesn't really run on police. It runs on neighbors.",
      ct:'Rule by denunciation' },

    /* ---------------- HISTORIC ---------------- */
    { tag:'No Appeal',
      fact:"A new law lets the government take citizenship away from people who were born abroad. It takes their spouse's and children's citizenship too, seizes everything they own, prints their names in the official gazette, and gives them no way to appeal.",
      hy:'1933', my:'2026', answer:'historic',
      truth:'1933 \u2014 Nazi Germany',
      reveal:"Germany, 14 July 1933. Names ran in the government's gazette, property was confiscated, and the orders said plainly that no appeal was possible. The U.S. does strip citizenship from naturalized Americans today \u2014 but it has to convince a federal judge first, and you can appeal. That is the difference.",
      ct:'Citizenship stripped by decree',
      src:{ label:'Jewish Museum Berlin \u2014 A 1933 revocation of citizenship', url:'https://www.jmberlin.de/1933/en/10_21_revocation-of-adalbert-rentschners-naturalization.php' } },

    { tag:'The Second Class',
      fact:"A law splits the country's people into two groups. One group are full citizens who can vote. The other group live there, obey the same laws, and have no political rights at all.",
      hy:'1935', my:'2026', answer:'historic',
      truth:'1935 \u2014 Nazi Germany',
      reveal:"The Reich Citizenship Law of 1935, one of the Nuremberg Laws. It invented a person who belonged to the country but was not a citizen of it. No American law does this. Critics warn that hunting for reasons to revoke naturalized citizenship creates two tiers in practice \u2014 but that is an argument. 1935 was a statute.",
      ct:'Two-tier citizenship' },

    { tag:'The Register',
      fact:"The government orders one minority group to list everything they own \u2014 furniture, jewelry, savings, insurance \u2014 and hand the list to the tax office.",
      hy:'1938', my:'2026', answer:'historic',
      truth:'1938 \u2014 Nazi Germany',
      reveal:"Germany, 26 April 1938. Every Jewish household had to report anything worth more than 5,000 Reichsmarks. About 700,000 people filed. Making a list is not stealing. It is how a government finds out what there is to steal \u2014 and the seizures began within the year.",
      ct:'Registration of a minority\u2019s property',
      src:{ label:'USHMM \u2014 Antisemitic legislation, 1933\u20131939', url:'https://encyclopedia.ushmm.org/content/en/article/antisemitic-legislation-1933-1939' } },

    { tag:'Protective Custody',
      fact:"Police can lock a person up for as long as they like, with no charge and no trial. No court is allowed to review the case. The prisoner has to sign the arrest form himself.",
      hy:'1936', my:'2026', answer:'historic',
      truth:'1936 \u2014 Nazi Germany',
      reveal:"The Germans called it protective custody. A 1936 law put the secret police completely beyond the reach of the courts, and prisoners signed forms saying they had asked to be locked up. ICE holds people without trial too \u2014 but they can sue, and judges do order them released. When no court may even look, nothing is left.",
      ct:'Detention beyond judicial review',
      src:{ label:'Protective custody (Schutzhaft) \u2014 overview', url:'https://en.wikipedia.org/wiki/Protective_custody_(Nazi_Germany)' } },

    { tag:'The Long Knives',
      fact:"The government kills about two hundred people without a trial. A few days later, it passes a law saying the killings were legal all along.",
      hy:'1934', my:'2026', answer:'historic',
      truth:'1934 \u2014 Nazi Germany',
      reveal:"Germany, 3 July 1934 \u2014 three days after the killings. The Justice Minister drafted it. Hitler signed it. One sentence turned a massacre into policy. Nothing like this law exists today, and that gap is the honest distance between then and now.",
      ct:'Retroactive legalization of killing',
      src:{ label:'Night of the Long Knives \u2014 the law of 3 July 1934', url:'https://en.wikipedia.org/wiki/Night_of_the_Long_Knives' } },

    { tag:'Night & Fog',
      fact:"A new order lets the government take people away and make them disappear. Families are told nothing \u2014 not where they are, not whether they are alive.",
      hy:'1941', my:'2026', answer:'historic',
      truth:'1941 \u2014 Nazi Germany',
      reveal:"The Night and Fog order of 1941, named for how people vanished. Eighty years later, men the U.S. deported to a prison in El Salvador disappeared from ICE's own online locator while their families were told nothing. The order is history. The echo is now.",
      ct:'Enforced disappearance',
      src:{ label:'Human Rights Watch \u2014 Deportees forcibly disappeared', url:'https://www.hrw.org/news/2026/03/16/us/el-salvador-deportees-forcibly-disappeared' } },

    { tag:'The Reckoning',
      fact:"Officials say they only rounded people up because they were ordered to. A court tells them that is not a defense.",
      hy:'1946', my:'2026', answer:'historic',
      truth:'1946 \u2014 Nazi officials on trial',
      reveal:"Nuremberg, 1946. 'I was following orders' was thrown out: an order does not make the act legal. That ruling is the yardstick everyone since has been measured against. No court has yet held it up to anyone running the system we have now.",
      foot:'Befehl ist Befehl \u2014 \u201corders are orders.\u201d',
      ct:"Accepting 'just following orders'" },

    /* ---------------- MODERN ---------------- */
    { tag:'Citizenship',
      fact:"The government tells its lawyers to go after as many naturalized citizens as they can, and take their citizenship away.",
      hy:'1935', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"A Justice Department memo in June 2025 ordered exactly that. The government used to bring about 11 of these cases a year. Offices were reportedly told to find 100 to 200 a month. Nazi Germany stripped citizenship too \u2014 by decree, with no appeal. Here it still takes a federal judge. That judge is the only thing standing in the way.",
      ct:'Persecution by stripping citizenship',
      src:{ label:'NPR \u2014 Justice Dept. moves to strip citizenship', url:'https://www.npr.org/2025/06/30/nx-s1-5445398/denaturalization-trump-immigration-enforcement' } },

    { tag:'Deportation',
      fact:"The government pays a foreign country to lock up the people it deports.",
      hy:'1942', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"The U.S. paid El Salvador to hold deportees in its CECOT prison, where Human Rights Watch documented torture and disappearances. Nazi Germany deported far more people \u2014 but into land it had conquered. It never paid another country to hold them.",
      ct:'Unlawful deportation',
      src:{ label:'Human Rights Watch \u2014 Torture of Venezuelan deportees', url:'https://www.hrw.org/news/2025/11/12/us/el-salvador-torture-of-venezuelan-deportees' } },

    { tag:'Forced Labor',
      fact:"The people locked in the camps do the cooking, the cleaning and the laundry that keep the camps running. They are paid one dollar a day.",
      hy:'1943', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"A dollar a day is ICE's own written minimum. In 2026 the Supreme Court let a forced-labor lawsuit over it go ahead. Prisoners in Nazi camps were paid nothing at all \u2014 companies paid the SS instead, for the use of them. A dollar is not less than nothing. It is a different kind of number.",
      ct:'Forced labor',
      src:{ label:'Colorado Newsline \u2014 Forced-labor lawsuit moves forward', url:'https://coloradonewsline.com/briefs/supreme-court-ice-forced-labor-lawsuit/' } },

    { tag:'The Landlord',
      fact:"The camps are owned by companies you can buy stock in. The government pays them for every person, every night. On a call with investors, one complains that not enough people are being locked up.",
      hy:'1943', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"That call happened. An analyst said investors had expected 100,000 people in detention, and it was only a little over 70,000. GEO made $2.6 billion in 2025 and a record profit; CoreCivic made $2.2 billion. In Nazi Germany the SS ran the camps, and companies paid the state to borrow prisoners. The money went to the government. Here it comes out of it.",
      ct:'Detention for profit',
      src:{ label:'TIME \u2014 ICE\u2019s biggest contractors post record revenue', url:'https://time.com/7378284/ice-immigration-detention-contractors-record-revenue/' } },

    { tag:'The Room',
      fact:"People are held for days in a room with no windows. It is so crowded there is nowhere to lie down. A toilet sits in the corner behind a half-wall, and the lights stay on all night.",
      hy:'1942', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"The tenth floor of a federal office building in Manhattan, directly above an immigration court. People said the rooms held seven or eight times as many as they should. Some were kept more than 20 days. A judge finally had to order the government to provide sleeping mats, soap and toilet paper. Nazi transit camps were as bad or worse. They were not upstairs from a courtroom.",
      ct:'Degrading conditions of confinement',
      src:{ label:'Courthouse News \u2014 Inside 26 Federal Plaza', url:'https://www.courthousenews.com/inside-26-federal-plaza-trial-reveals-deplorable-conditions-at-ice-facility/' } },

    { tag:'The Ledger',
      fact:"In a single month, immigration agents ignore 96 court orders. A judge counts every one and publishes the list.",
      hy:'1934', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Judge Patrick Schiltz \u2014 appointed by George W. Bush, once a clerk to Justice Scalia \u2014 wrote that the list should worry anyone who cares about the rule of law, whatever their politics. This card can only be modern. By 1934 Hitler's courts had been broken. Nobody was left to keep count.",
      ct:'Defiance of the courts',
      src:{ label:'Minnesota Reformer \u2014 A judge counts ICE\u2019s broken orders', url:'https://minnesotareformer.com/2026/02/27/chief-judge-schiltz-one-way-or-another-ice-will-comply-with-this-courts-orders/' } },

    { tag:'The Tally',
      fact:"Someone dies in government custody about once every nine days. In a single year, the number of people locked up rises by three quarters. The number who die more than triples.",
      hy:'1938', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"52 people died in ICE custody in the 500 days after January 2025 \u2014 the worst rate in almost twenty years, climbing far faster than the number of people held. Nazi camps killed on a scale nothing here comes near, and there the killing was the purpose. This is something narrower and stranger: a government that counts its dead, publishes the number, and carries on.",
      ct:'Deaths in custody',
      src:{ label:'Human Rights Watch \u2014 Dying in Detention', url:'https://www.hrw.org/report/2026/06/25/dying-in-detention/rising-deaths-in-an-expanding-us-immigration-detention-system' } },

    { tag:'The Badge',
      fact:"Armed government agents take people off the street with their faces covered. They will not give a name or a badge number.",
      hy:'1938', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Federal rules say an immigration officer must identify himself as soon as it is safe to. One judge called them an armed masked secret police. The government answers that agents cover their faces because they and their families are being threatened. The Gestapo never hid its face. Being recognized was the whole point.",
      ct:'Policing without accountability',
      src:{ label:'Human Rights Watch \u2014 Masked agents and the rule of law', url:'https://www.hrw.org/news/2025/12/18/us-masked-federal-agents-undermine-rule-of-law' } },

    { tag:'The Parade',
      fact:"Hundreds of masked men in matching uniforms march through the capital behind drums, carrying flags and chanting that they will take the country back. Police watch and arrest no one.",
      hy:'1933', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Patriot Front, Washington DC, 4 July 2026 \u2014 khakis, white face masks, Confederate flags. Police called it free speech and made no arrests. Hitler's brownshirts marched to drums too, but bare-faced. Being recognized was the point. Men who cover their faces still expect to answer for it one day.",
      ct:'Paramilitary display',
      src:{ label:'Reuters \u2014 Masked marchers in Washington, July 4', url:'https://www.usnews.com/news/world/articles/2026-07-04/masked-patriot-front-white-nationalists-stage-july-4-march-through-dc' } },

    /* ---------------- NEITHER ---------------- */
    { tag:'The Catch',
      fact:"After a public outcry, the officials running the camps quit, shut the camps down, and turned themselves in.",
      hy:'1944', my:'2026', answer:'neither',
      truth:'Neither',
      reveal:"Neither. Nobody ever walked away on their own. It took the Nuremberg trials, from 1945 to 1949, to force a reckoning \u2014 and the modern one has not come at all. If you picked a year, you expected an apology that history has never once given.",
      ct:'Willful blindness (you expected a voluntary apology)' },

    { tag:'The Vote',
      fact:"After a public outcry, the country's lawmakers vote to cut off the camps' money and close them down.",
      hy:'1935', my:'2026', answer:'neither',
      truth:'Neither',
      reveal:"Never happened, either time. Germany's parliament voted itself into irrelevance in 1933. In 2025 Congress passed a bill with roughly $45 billion to build more detention. Both hopes \u2014 that the officials will quit, that the lawmakers will step in \u2014 belong to you, not to the record.",
      ct:'Willful blindness (you expected the lawmakers to intervene)',
      src:{ label:'Common Dreams \u2014 $45 billion for detention expansion', url:'https://www.commondreams.org/news/geo-group-ice-profits' } }
  ];

  var x = function (n) { return root.querySelector('[data-el="' + n + '"]'); };

  var card = x('card');
  var fileLabel = x('fileLabel'), progFill = x('progFill'), dots = x('dots');
  var frontFile = x('frontFile'), frontTag = x('frontTag'), factEl = x('fact');
  var yrHist = x('yrHist'), yrMod = x('yrMod');
  var backFile = x('backFile'), resTag = x('resTag');
  var cardTruth = x('cardTruth'), revealEl = x('reveal'), footEl = x('foot'), srcEl = x('src');
  var btnSeeResult = x('btnSeeResult');
  var btnPrev = x('btnPrev'), btnNext = x('btnNext');
  var intro = x('intro'), result = x('result');
  var stampEl = x('stamp'), truthEl = x('truth'), plainEl = x('plain');
  var receiptsEl = x('receipts'), chargesEl = x('charges'), rewardEl = x('reward');
  var toastEl = x('toast');
  var btnGear = x('btnGear'), settings = x('settings'), countVal = x('countVal'), countNote = x('countNote');
  var btnFewer = x('fewer'), btnMore = x('more');

  var MAX = BANK.length;
  var roundSize = Math.max(1, Math.min(CONFIG.filesPerRound || 5, MAX));

  var active = [], results = [], current = 0, toastTimer = null, sliding = false;

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function pad2(n){ return (n<10?'0':'')+n; }
  function roman(n){ var m=[['X',10],['IX',9],['V',5],['IV',4],['I',1]], r=''; for(var i=0;i<m.length;i++){ while(n>=m[i][1]){ r+=m[i][0]; n-=m[i][1]; } } return r; }
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

  /* ---- settings ---- */
  function syncSettings(){
    countVal.textContent = roundSize;
    countNote.textContent = roundSize === MAX
      ? 'Every file in the archive (' + MAX + ').'
      : roundSize + ' of ' + MAX + ' files, drawn at random each round.';
    btnFewer.disabled = roundSize <= 1;
    btnMore.disabled  = roundSize >= MAX;
  }
  function setRoundSize(n){
    roundSize = Math.max(1, Math.min(n, MAX));
    syncSettings();
  }

  /* ---- round setup ---- */
  function pickRound(){
    var pool = shuffle(BANK);
    active = [];
    for (var i=0;i<roundSize;i++){
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

  function tagFor(state){
    return state==='win' ? '\u2713 Correct'
         : state==='ok'  ? '\u2713 Valid \u2014 not the sharpest'
         :                 '\u2717 Wrong';
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

    if (c.src && c.src.url){ srcEl.textContent = c.src.label; srcEl.href = c.src.url; srcEl.hidden = false; }
    else { srcEl.hidden = true; srcEl.removeAttribute('href'); }

    var opts = card.querySelectorAll('[data-pick]');
    for (var k=0;k<opts.length;k++) opts[k].className = opts[k].classList.contains('hh-yr') ? 'hh-opt hh-yr' : 'hh-opt hh-altb';

    btnSeeResult.hidden = true;
    if (r !== null) restoreAnswered(i);
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
    card.classList.add('flipped');
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
    btnNext.disabled = results[current] === null;
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
      plainEl.textContent = 'You placed every file correctly \u2014 which means you could see the machinery for what it is, in whichever decade it happened to be running.';
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
    settings.hidden = true; btnGear.classList.remove('is-on');
    pickRound();
    card.classList.remove('slide-out-left','slide-out-right','slide-in-left','slide-in-right');
    sliding = false;
    paint(0);
    card.scrollTop = 0;
  }

  /* Back to the start screen. Wired to [data-hoh-reset] and [gm-reset-button]. */
  function resetToIntro(){
    result.hidden = true;
    intro.hidden = false;
    settings.hidden = true; btnGear.classList.remove('is-on');
    sliding = false;
    pickRound();
    paint(0);
    progFill.style.width = '0%';
    fileLabel.textContent = 'File 01 / ' + pad2(roundSize);
  }
  root._hohReset = resetToIntro;   // also callable programmatically

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

  btnGear.addEventListener('click', function(){
    var open = settings.hidden;
    settings.hidden = !open;
    btnGear.classList.toggle('is-on', open);
  });
  btnFewer.addEventListener('click', function(){ setRoundSize(roundSize - 1); });
  btnMore.addEventListener('click',  function(){ setRoundSize(roundSize + 1); });

  /* External page controls. Pause is intentionally absent: nothing runs. */
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-hoh-reset]') || t.closest('[gm-reset-button]')) {
      e.preventDefault();
      resetToIntro();
    }
  });

  syncSettings();
  pickRound();
  paint(0);
};
