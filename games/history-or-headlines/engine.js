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
      fact:"In a single year, the number of people held in the state's detention camps grows by roughly three-quarters, and new camps open across the country to keep up.",
      hy:'1934', my:'2026', answer:'both',
      truth:'Both eras',
      reveal:"ICE detention grew about 77% in a year, to a record of more than 71,000 people, filling county jails, tent camps on military bases and converted warehouses. The Reich's camp network scaled the same way after Dachau opened in 1933. Neither year is wrong here \u2014 that's the point. 'Both' was the sharp answer.",
      ct:'Mass detention without trial',
      src:{ label:'Human Rights Watch \u2014 Dying in Detention', url:'https://www.hrw.org/report/2026/06/25/dying-in-detention/rising-deaths-in-an-expanding-us-immigration-detention-system' } },

    { tag:'The Megaphone',
      fact:"Officials brand a whole population of immigrants an 'invasion' of the homeland \u2014 and use that exact word to unlock emergency wartime powers against them.",
      hy:'1938', my:'2025', answer:'both',
      truth:'Both eras',
      reveal:"In 2025 the 'invasion' label was used to invoke the Alien Enemies Act of 1798 against Venezuelan immigrants. Nazi propaganda cast Jews as an alien 'invasion' to justify emergency measures. Same move, different decade. Either year counts \u2014 but 'Both' was the sharp answer.",
      ct:'Incitement and dehumanization',
      src:{ label:'NPR \u2014 Contempt finding over Alien Enemies Act deportations', url:'https://www.npr.org/2025/04/16/g-s1-60696/judge-contempt-alien-enemies-act' } },

    { tag:'The Announcement',
      fact:"Officials open the country's first major detention camp and announce it at a press conference, telling reporters its capacity and exactly who will be held there.",
      hy:'1933', my:'2025', answer:'both',
      truth:'Both eras',
      reveal:"Himmler announced Dachau at a press conference on 20 March 1933, giving a capacity of 5,000 and naming the political groups to be held. In 2025 the Everglades facility was publicized, toured, and nicknamed by the officials who built it. Neither regime hid its camps. That is the unsettling part \u2014 the camps were never a secret.",
      ct:'Detention as public spectacle',
      src:{ label:"Alpha History \u2014 The opening of Dachau (1933)", url:'https://alphahistory.com/nazigermany/the-opening-of-dachau-1933/' } },

    { tag:'The Tip Line',
      fact:"The state asks ordinary citizens to report neighbors they suspect don't belong, and acts on what it is told.",
      hy:'1937', my:'2026', answer:'both',
      truth:'Both eras',
      reveal:"The Gestapo was thinly staffed and ran substantially on denunciations from ordinary people. ICE operates a public tip line. In both cases the machinery is not really the police. It is the neighbor.",
      ct:'Rule by denunciation' },

    /* ---------------- HISTORIC ---------------- */
    { tag:'No Appeal',
      fact:"A law lets the state revoke the citizenship of naturalized citizens it considers undesirable. The revocation covers their spouses and children, their property is confiscated, their names are printed in the official gazette, and no appeal is possible.",
      hy:'1933', my:'2026', answer:'historic',
      truth:'1933 \u2014 Reich',
      reveal:"The Law on the Revocation of Naturalizations, 14 July 1933. Orders extended to wives and children, property was declared confiscated, names were published in the Reichsanzeiger, and the orders stated plainly that no legal appeal existed. Today's denaturalization is a civil lawsuit \u2014 there is a judge, and there is an appeal. That is not a small difference. On this card, it is the whole difference.",
      ct:'Citizenship stripped by decree',
      src:{ label:'Jewish Museum Berlin \u2014 Revocation of a naturalization, 1933', url:'https://www.jmberlin.de/1933/en/10_21_revocation-of-adalbert-rentschners-naturalization.php' } },

    { tag:'The Second Class',
      fact:"A law divides the country's nationals into two classes: full citizens who hold political rights, and subjects of the state who hold none.",
      hy:'1935', my:'2026', answer:'historic',
      truth:'1935 \u2014 Reich',
      reveal:"The Reich Citizenship Law, one of the Nuremberg Laws. It invented a second tier of person \u2014 a national of the state who was not a citizen of it. No American statute does this. Critics argue that pursuing denaturalization at scale builds a second tier in practice, making naturalized citizenship conditional in a way birthright citizenship is not. That is an argument. The 1935 law was a text.",
      ct:'Two-tier citizenship' },

    { tag:'The Register',
      fact:"A decree orders a targeted minority to report every asset they own above a set value \u2014 furniture, art, insurance, stocks \u2014 to the tax office.",
      hy:'1938', my:'2026', answer:'historic',
      truth:'1938 \u2014 Reich',
      reveal:"The Decree for the Reporting of Jewish-Owned Property, 26 April 1938: everything above 5,000 Reichsmarks. Roughly 700,000 people filed, disclosing about 7 billion Reichsmarks. Registration is not confiscation. It is the paperwork that makes confiscation possible \u2014 and the confiscation followed within the year.",
      ct:'Registration of a minority\u2019s property',
      src:{ label:'USHMM \u2014 Antisemitic legislation, 1933\u20131939', url:'https://encyclopedia.ushmm.org/content/en/article/antisemitic-legislation-1933-1939' } },

    { tag:'Protective Custody',
      fact:"People are arrested and held indefinitely, without charge or trial, under an order no court is permitted to review. The detainee signs the order himself.",
      hy:'1936', my:'2026', answer:'historic',
      truth:'1936 \u2014 Reich',
      reveal:"Schutzhaft \u2014 'protective custody.' The 1936 Gestapo law exempted the secret police from the administrative courts, and a Prussian court had already ruled in 1935 that its actions were not reviewable. Detainees signed their own detention orders, formally requesting imprisonment. ICE detains without trial too \u2014 but its detainees petition courts, and courts still order them released.",
      ct:'Detention beyond judicial review',
      src:{ label:'Protective custody (Schutzhaft) \u2014 overview', url:'https://en.wikipedia.org/wiki/Protective_custody_(Nazi_Germany)' } },

    { tag:'The Long Knives',
      fact:"After the state kills roughly two hundred people without trial, the government passes a law declaring the killings lawful \u2014 retroactively, as acts of self-defense by the state.",
      hy:'1934', my:'2026', answer:'historic',
      truth:'1934 \u2014 Reich',
      reveal:"The Law Regarding Measures of State Self-Defence, 3 July 1934, drafted by the Reich Justice Minister and signed by Hitler. A single sentence turned a purge into policy. Nothing like this statute exists today \u2014 and that gap is the honest measure of the distance between the two eras on this card.",
      ct:'Retroactive legalization of killing',
      src:{ label:'Night of the Long Knives \u2014 the 3 July 1934 statute', url:'https://en.wikipedia.org/wiki/Night_of_the_Long_Knives' } },

    { tag:'Night & Fog',
      fact:"A decree lets the state seize people and make them vanish 'into night and fog,' with authorities refusing to tell families where they are or whether they are alive.",
      hy:'1941', my:'2026', answer:'historic',
      truth:'1941 \u2014 Reich',
      reveal:"The Night and Fog decree of 1941, signed to make opponents disappear without a trace. Eighty years later, men deported to El Salvador's CECOT prison vanished from ICE's own online locator while their families were told nothing \u2014 what Human Rights Watch calls an enforced disappearance. The decree is historic. The echo is now.",
      ct:'Enforced disappearance',
      src:{ label:'Human Rights Watch \u2014 Deportees forcibly disappeared', url:'https://www.hrw.org/news/2026/03/16/us/el-salvador-deportees-forcibly-disappeared' } },

    { tag:'The Reckoning',
      fact:"Officials defend mass round-ups by saying they were only carrying out lawful orders \u2014 and a court rules that this is no defense at all.",
      hy:'1946', my:'2026', answer:'historic',
      truth:'1946 \u2014 Reich, on trial',
      reveal:"At Nuremberg in 1946 the defense 'Befehl ist Befehl' \u2014 orders are orders \u2014 was rejected: following orders does not excuse the act. That ruling is the measuring stick every later system gets held to. No court has yet held it up to anyone running the present one.",
      foot:'Befehl ist Befehl \u2014 \u201corders are orders.\u201d',
      ct:"Accepting 'just following orders'" },

    /* ---------------- MODERN ---------------- */
    { tag:'Citizenship',
      fact:"The government orders its lawyers to 'maximally pursue' the stripping of citizenship from naturalized citizens, in every case the law allows.",
      hy:'1935', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"A June 2025 Justice Department memo used exactly that phrase. For decades the government averaged about 11 denaturalization cases a year; field offices were reportedly told to refer 100 to 200 a month. The Reich stripped citizenship too \u2014 but by decree, in bulk, with no appeal. Here it still takes a federal judge. That judge is the only thing in the way.",
      ct:'Persecution by stripping citizenship',
      src:{ label:'NPR \u2014 DOJ moves to prioritize stripping citizenship', url:'https://www.npr.org/2025/06/30/nx-s1-5445398/denaturalization-trump-immigration-enforcement' } },

    { tag:'Deportation',
      fact:"The government pays another country to imprison the people it deports.",
      hy:'1942', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"The U.S. paid El Salvador to hold deportees in its CECOT prison, where Human Rights Watch documented torture and enforced disappearance. The Reich deported on a vastly greater scale \u2014 but into territory it occupied. It never wrote a cheque to a sovereign partner to warehouse the people it expelled.",
      ct:'Unlawful deportation',
      src:{ label:'Human Rights Watch \u2014 Torture of Venezuelan deportees', url:'https://www.hrw.org/news/2025/11/12/us/el-salvador-torture-of-venezuelan-deportees' } },

    { tag:'Forced Labor',
      fact:"People held in the camps cook, clean and do the laundry that keeps the camps running \u2014 for a dollar a day.",
      hy:'1943', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"ICE's own detention standards set a minimum of $1 per day for detainee work programs. In 2026 the Supreme Court unanimously refused to let a private operator escape a forced-labor suit over it. Reich camp labor was unpaid \u2014 prisoners received nothing, while firms paid the SS for the use of them. A dollar is not a smaller number than zero. It is a different kind of number.",
      ct:'Forced labor',
      src:{ label:'Colorado Newsline \u2014 Forced-labor lawsuit moves forward', url:'https://coloradonewsline.com/briefs/supreme-court-ice-forced-labor-lawsuit/' } },

    { tag:'The Landlord',
      fact:"The camps are owned by publicly traded corporations. The state pays them by the head, per night. Their investors complain that not enough people are being detained.",
      hy:'1943', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"On an earnings call, an analyst grumbled that detention had come in below expectation \u2014 people had thought the population would reach 100,000, and it was only a little over 70,000. GEO reported $2.6bn in revenue and a record profit; CoreCivic $2.2bn. In the Reich the camps were run by the SS, and firms paid the state three to four Reichsmarks a day to rent prisoners. Money flowed toward the state. Here it flows out of it.",
      ct:'Detention for profit',
      src:{ label:"TIME \u2014 ICE's largest prison contractors post record revenue", url:'https://time.com/7378284/ice-immigration-detention-contractors-record-revenue/' } },

    { tag:'The Room',
      fact:"People are held for days in a windowless room so crowded there is no space to lie down, with a toilet in the same room behind a half-wall and the lights on all night.",
      hy:'1942', my:'2025', answer:'modern',
      truth:'2025 \u2014 United States',
      reveal:"The tenth floor of 26 Federal Plaza in Manhattan \u2014 an office building, directly above an immigration court. Detainees describe rooms at seven to eight times capacity; several were held more than 20 days, one more than 30. A federal judge capped the population and ordered sleeping mats, soap and toilet paper. The Reich's transit camps were as bad or worse. They were not above a courtroom.",
      ct:'Degrading conditions of confinement',
      src:{ label:'Courthouse News \u2014 Inside 26 Federal Plaza', url:'https://www.courthousenews.com/inside-26-federal-plaza-trial-reveals-deplorable-conditions-at-ice-facility/' } },

    { tag:'The Ledger',
      fact:"A judge attaches to his order a list of ninety-six court orders the enforcement agency broke in a single month, across seventy-four cases.",
      hy:'1934', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Chief Judge Patrick Schiltz \u2014 a Bush appointee who clerked for Antonin Scalia \u2014 wrote that the list should give pause to anyone who cares about the rule of law, whatever their politics. On review the court confirmed 97 violated orders, and tallied 113 more. This card can only be modern, because by 1934 the Reich's courts had been brought to heel. Nobody was counting.",
      ct:'Defiance of the courts',
      src:{ label:'Minnesota Reformer \u2014 Chief Judge Schiltz on ICE\u2019s noncompliance', url:'https://minnesotareformer.com/2026/02/27/chief-judge-schiltz-one-way-or-another-ice-will-comply-with-this-courts-orders/' } },

    { tag:'The Tally',
      fact:"People die in the state's custody at a rate of one every nine days. In a single year the number held rises by three-quarters; the number who die more than triples.",
      hy:'1938', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"52 people died in ICE custody in the 500 days after January 2025 \u2014 the highest death rate in nearly two decades, climbing far faster than the detained population. The Reich's camps killed on a scale that admits no comparison, and there the killing was the purpose, not the byproduct. The parallel is narrower and stranger: a state that counts its dead in custody, publishes the count, and does not stop.",
      ct:'Deaths in custody',
      src:{ label:'Human Rights Watch \u2014 Dying in Detention', url:'https://www.hrw.org/report/2026/06/25/dying-in-detention/rising-deaths-in-an-expanding-us-immigration-detention-system' } },

    { tag:'The Badge',
      fact:"Armed government agents make arrests with their faces covered, refusing to give their names or badge numbers.",
      hy:'1938', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Federal regulation requires an immigration officer to identify himself as soon as it is practical and safe. A district judge wrote that the agency masks in order to terrorize, describing it as an armed masked secret police; the administration answers that agents are masked because they and their families are doxxed and threatened. The Gestapo never covered its face. Being recognized was the instrument.",
      ct:'Policing without accountability',
      src:{ label:'Human Rights Watch \u2014 Masked federal agents undermine rule of law', url:'https://www.hrw.org/news/2025/12/18/us-masked-federal-agents-undermine-rule-of-law' } },

    { tag:'The Parade',
      fact:"Hundreds of masked men in matching uniforms march through the capital behind drums, carrying flags and chanting that they will reclaim the nation. Police make no arrests.",
      hy:'1933', my:'2026', answer:'modern',
      truth:'2026 \u2014 United States',
      reveal:"Patriot Front, Washington DC, 4 July 2026 \u2014 khakis, white face coverings, Confederate and upside-down flags, no arrests, police calling it First Amendment activity. The SA marched too, and to drums. But bare-faced: being recognized was the point. Men who cover their faces still expect a day of accountability. Read that as reassurance or as a countdown.",
      ct:'Paramilitary display',
      src:{ label:'Reuters \u2014 Masked Patriot Front members march through DC', url:'https://www.usnews.com/news/world/articles/2026-07-04/masked-patriot-front-white-nationalists-stage-july-4-march-through-dc' } },

    /* ---------------- NEITHER ---------------- */
    { tag:'The Catch',
      fact:"Faced with public outcry, the officials running the camps voluntarily resigned, shut the facilities down, and turned themselves in for judgment.",
      hy:'1944', my:'2026', answer:'neither',
      truth:'Neither',
      reveal:"Neither. Nobody ever walked away on their own. It took the Nuremberg trials, from 1945 to 1949, to force a reckoning \u2014 and the modern one has not come at all. If you picked a year, you assumed an apology that history has never once offered.",
      ct:'Willful blindness (you expected a voluntary apology)' },

    { tag:'The Vote',
      fact:"Under public pressure, the national legislature votes to cut the camps' funding and shut them down.",
      hy:'1935', my:'2026', answer:'neither',
      truth:'Neither',
      reveal:"Never happened, either time. The Reichstag voted itself out of relevance with the Enabling Act in 1933. In 2025 Congress passed a bill containing roughly $45 billion to expand immigration detention. Both fantasies \u2014 that the officials will surrender, that the legislature will step in \u2014 belong to you, not to the record.",
      ct:'Willful blindness (you expected the legislature to intervene)',
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
    return state==='win' ? '\u2713 Richtig (correct)'
         : state==='ok'  ? '\u2713 G\u00FCltig (valid \u2014 not the sharpest)'
         :                 '\u2717 Falsch (wrong)';
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
