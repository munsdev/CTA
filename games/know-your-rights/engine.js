/* =====================================================================
   KNOW YOUR RIGHTS — engine.js
   window.KnowYourRights.init(rootElement, baseUrl)

   Five scenes. Dialogue-in-the-box (no rail). Day/night is a palette
   axis only — same geometry, same beats, chosen on the title screen.

   VISUALS — vector, then pixelize. Drawn as smooth shapes into a hi-res
   buffer, downsampled to 160x144 (chunky SNES pixels), ordered-dithered
   on light falloff, quantized to a bright ~26-colour palette (day set /
   night set) via a per-set lookup table, shown with hard pixel edges.
   Inkscape SVGs sent later load into the same buffer and run the same
   pass. One officer per scene; swap-ready.

   MECHANIC — the pressure loop. Officer speaks; you pick from 2-3 boxed
   options. The shield option holds the line; hold it and he escalates
   and asks again (round advances, not the beat). Wrong options resolve
   at their grade. Risk is hidden; rolled once at the end. Officers lie.

   HUD — RECORD (push early; blinks; never changes risk; changes the end
   screen), a per-prompt countdown (Easy 20 / Medium 10 / Hard 5 /
   Practice off; red under 3s), HINT (pulses the right option).

   PAGE CONTROLS  [data-kyr-reset] / [gm-reset-button] -> title. No pause.
   ===================================================================== */
window.KnowYourRights = window.KnowYourRights || {};

window.KnowYourRights.init = function (root, base) {
  if (!root || root.dataset.booted) return;
  root.dataset.booted = '1';

  var CONFIG = {
    reward: { code: '', link: '', desc: '' },
    typeSpeed: 15,
    forcedEntryChance: 0.20,
    timeoutPenalty: 10,
    maxTimeouts: 3
  };
  var DIFF = { practice: 0, easy: 20, medium: 10, hard: 5 };
  var DELTA = { shield: 0, steady: -8, soft: 12, harmful: 30, severe: 45, fatal: 100 };

  /* ------------------------------------------------------------------
     CONTENT SOURCE — Worker + D1 (kyr-content), cache-then-refresh.
     SCENES/ENDINGS below start as the bundled offline-baseline fallback
     and are REASSIGNED once loading resolves (see loadContent() near the
     bottom of init), before the scene picker or gameplay code reads them.
     Functions defined further down close over these vars by reference,
     so a reassignment is picked up automatically everywhere.
     ------------------------------------------------------------------ */
  var CONTENT_API_BASE = 'https://kyr-content.casey-945.workers.dev';
  var CONTENT_CACHE_KEY = 'kyr:content:v1';
  var CONTENT_FETCH_TIMEOUT_MS = 4000;

  /* BUNDLED_SCENES / BUNDLED_ENDINGS — guaranteed-offline baseline, used
     only when there's no usable cache AND no reachable network. Same
     content as migrated into kyr-content-db; this copy is a floor, not
     the source of truth — edit scenes in D1 going forward. */
  var BUNDLED_SCENES = [
    {
      id: 'door', art: 'door', name: 'At the door', active: true, mode: 'graph',
      teaches: 'Consent is the whole game.', floor: 0, exitAt: null,
      open: 'Someone is knocking. You are on the inside of your own front door.',
      law: 'A warrant signed by an immigration officer does not let anyone in. Only a judge can sign one that does \u2014 and they almost never do.',
      checklist: [
        ['record','Started recording'], ['closed','Kept the door closed'],
        ['judge','Asked if a judge signed it'], ['slide','Asked them to slide it under the door'],
        ['read','Read the paper before deciding'], ['refused','Said \u201cI do not consent\u201d'],
        ['silent','Stayed silent'], ['lawyer','Asked for a lawyer']
      ],
      beats: [
        { rounds: [{ npc: ['Federal agents. Open the door.', 'We know you are in there. Open up.'],
            box: [
              { g:'shield', t:'Stay where you are. Talk through the door.', keys:['closed'] },
              { g:'harmful', t:'Open it a crack, just to see who it is.', damages:true, door:'cracked' },
              { g:'fatal', t:'Open the door. Refusing looks guilty.',
                why:'You let them in. Nothing after that was a search. It was a visit you agreed to.' }
            ] }] },
        { rounds: [
            { npc:['We have a warrant.','There is a warrant. Open up.'],
              box:[ { g:'shield', t:'\u201cIs it signed by a judge?\u201d', keys:['judge'] },
                    { g:'soft', t:'Ask who they are looking for.' },
                    { g:'fatal', t:'\u201cThen come in.\u201d', why:'You said yes. Consent is the only key they needed.' } ] },
            { npc:['I told you. It has your name on it.','It is a federal warrant. That is all you need to know.'],
              box:[ { g:'shield', t:'\u201cSlide it under the door, or show me in the window.\u201d', keys:['slide'], door:'warrant' },
                    { g:'harmful', t:'Tell them your name so they can check.', damages:true },
                    { g:'fatal', t:'Open the door far enough to look at it.', why:'The door came open. From there it was never going to close.' } ] },
            { npc:['Last chance. Open it or we open it for you. Do not make this hard.','Every minute you stall goes in the report. Open the door.'],
              box:[ { g:'shield', t:'\u201cI do not consent to entry.\u201d', keys:['refused'] },
                    { g:'severe', t:'Tell them nobody is home.', damages:true },
                    { g:'fatal', t:'Unlock it. They said they would break it.', why:'They did not break it. You opened it.' } ] }
          ], after:'He holds the paper up to the window. The header reads DEPARTMENT OF HOMELAND SECURITY. At the bottom: Field Office Director. No judge ever saw it.' },
        { rounds: [{ npc:['There. Warrant. Now open the door.','You have seen it. Open the door.'],
            box:[ { g:'shield', t:'\u201cThat is not signed by a judge. I do not consent.\u201d', keys:['read','refused'] },
                  { g:'harmful', t:'\u201cThat is my name. I am the one you want.\u201d', damages:true },
                  { g:'fatal', t:'It looks official. Unlock the door.', why:'It said Department of Homeland Security at the top. A judge never saw it.' } ] }] },
        { rounds: [{ npc:['Where were you born?','You got papers in there? Just tell me where you were born.'],
            box:[ { g:'shield', t:'Say nothing.', keys:['silent'] },
                  { g:'soft', t:'\u201cI have lived here twelve years.\u201d' },
                  { g:'harmful', t:'Answer the question.', damages:true } ] }] },
        { rounds: [{ npc:['Come out here and we will clear this up in five minutes.','Step outside. It is easier for everyone.'],
            box:[ { g:'shield', t:'\u201cI want a lawyer. I am not opening the door.\u201d', keys:['lawyer'] },
                  { g:'steady', t:'\u201cCome back with a warrant a judge signed.\u201d' },
                  { g:'fatal', t:'Step outside.', why:'On the porch you are not in your home. The porch was the whole plan.' } ] }] }
      ]
    },

    {
      id: 'car', art: 'car', name: 'Car stop', active: false,
      teaches: 'A stop is not an arrest.', floor: 20, exitAt: 20,
      open: 'Lights fill the mirror. You pull onto the shoulder.',
      law: 'A stop lasts as long as the reason for it. Everything after that needs a new reason.',
      checklist: [
        ['record','Started recording'], ['hands','Kept your hands visible'],
        ['license','Gave the license and registration'], ['silent','Stayed silent about where you were born'],
        ['held','Held the line when they pushed'], ['nosearch','Said \u201cI do not consent to a search\u201d'],
        ['free','Asked \u201cAm I free to go?\u201d'], ['nolie','Told no lies']
      ],
      exitDeny: '\u201cNo. Turn the engine off and step out of the vehicle.\u201d',
      beats: [
        { rounds: [{ npc:['Turn the engine off. Hands where I can see them.','Both hands on the wheel. Now.'],
            box:[ { g:'shield', t:'Engine off. Hands on the wheel. Wait.', keys:['hands','nolie'] },
                  { g:'severe', t:'Reach into the glovebox for your papers.', damages:true },
                  { g:'fatal', t:'Keep driving until somewhere with lights and people.', why:'Running turns a stop into a chase, and a chase into a charge.' } ] }] },
        { rounds: [{ npc:['License and registration.','License. Registration. Insurance.'],
            box:[ { g:'shield', t:'Hand over the license and registration.', keys:['license'] },
                  { g:'soft', t:'Ask why you were stopped first.' },
                  { g:'harmful', t:'Hand over your passport too, to be helpful.', damages:true } ] }] },
        { rounds: [
            { npc:['Where were you born?','You from around here originally?'],
              box:[ { g:'shield', t:'\u201cI am going to remain silent.\u201d', keys:['silent'] },
                    { g:'soft', t:'\u201cAround here.\u201d' },
                    { g:'severe', t:'Tell them you are a United States citizen.', damages:true } ] },
            { npc:['It is a simple question. Citizens answer it.','Silence tells me everything anyway. Try again.'],
              box:[ { g:'shield', t:'Say nothing. Look straight ahead.', keys:['held'] },
                    { g:'soft', t:'\u201cI have a job. My kids go to school here.\u201d' },
                    { g:'harmful', t:'Answer it. He is not going to let it go.', damages:true } ] }
          ], after:'He writes something down. He does not say what.' },
        { rounds: [
            { npc:['Mind if I take a quick look in the car?','Anything in the vehicle I should know about? Pop the trunk.'],
              box:[ { g:'shield', t:'\u201cI do not consent to a search.\u201d', keys:['nosearch'] },
                    { g:'soft', t:'\u201cThere is nothing in there.\u201d' },
                    { g:'fatal', t:'\u201cGo ahead. I have nothing to hide.\u201d', why:'He did not have a reason to search. You gave him one, and it was called yes.' } ] },
            { npc:['So you have got something to hide.','Innocent people say yes. What is in the car?'],
              box:[ { g:'shield', t:'\u201cI do not consent. I am not stopping you.\u201d', keys:['nosearch'] },
                    { g:'soft', t:'Explain what is in the trunk.' },
                    { g:'fatal', t:'Unlock the trunk to end the argument.', why:'The argument ended. So did the protection.' } ] }
          ] },
        { hatch:true, rounds: [{ npc:['He is holding your license. Nobody is writing a ticket.'], narr:true,
            box:[ { g:'ask', t:'\u201cAm I free to go?\u201d', keys:['free'] },
                  { g:'steady', t:'Say nothing and wait.' },
                  { g:'severe', t:'Open the door and get out.', damages:true } ] }] },
        { rounds: [{ npc:['Out of the vehicle. Hands behind your back.','Step out. Do not make me ask twice.'],
            box:[ { g:'shield', t:'Get out. Say nothing. Do not resist.', keys:['nolie'] },
                  { g:'soft', t:'Ask what you are being arrested for.' },
                  { g:'severe', t:'Pull your arm away.', damages:true } ] }] }
      ]
    },

    {
      id: 'street', art: 'street', name: 'On the street', active: false,
      teaches: '\u201cAm I free to go?\u201d', floor: 15, exitAt: 15,
      open: 'Two blocks from home. Somebody behind you says hey.',
      law: 'If you are free to go, it was never a stop. Ask, and you find out which one it is.',
      checklist: [
        ['record','Started recording'], ['free','Asked \u201cAm I free to go?\u201d'],
        ['walked','Walked away when you could'], ['silent','Stayed silent about where you were born'],
        ['held','Held the line when they pushed'], ['noforeign','Showed no foreign documents'],
        ['lawyer','Asked for a lawyer']
      ],
      exitDeny: '\u201cNo. You are not going anywhere yet.\u201d',
      beats: [
        { hatch:true, rounds: [{ npc:['Hey. Hold up a second. I want to talk to you.','Hey. Come here. Just a couple of questions.'],
            box:[ { g:'ask', t:'\u201cAm I free to go?\u201d', keys:['free','walked'] },
                  { g:'soft', t:'Stop and hear him out.' },
                  { g:'fatal', t:'Run.', why:'Running is the one thing that turns a hunch into a reason.' } ] }] },
        { rounds: [{ npc:['Where are you from?','You live around here? Originally?'],
            box:[ { g:'shield', t:'Say nothing.', keys:['silent'] },
                  { g:'soft', t:'\u201cJust down the block.\u201d' },
                  { g:'harmful', t:'Name the country you were born in.', damages:true } ] }] },
        { rounds: [
            { npc:['Let me see some ID.','You carrying identification?'],
              box:[ { g:'shield', t:'\u201cI am going to remain silent. I want a lawyer.\u201d', keys:['lawyer','noforeign'] },
                    { g:'steady', t:'Show your state driver\u2019s license.' },
                    { g:'harmful', t:'Show your passport from home.', damages:true } ] },
            { npc:['You have to identify yourself. That is the law.','Everybody has to identify themselves. You know that.'],
              box:[ { g:'shield', t:'Stay silent.', keys:['held'] },
                    { g:'soft', t:'Give him your name.' },
                    { g:'harmful', t:'Show him the passport after all.', damages:true } ] }
          ], after:'That is not true everywhere, and he knows it. He is counting on you not knowing.' },
        { hatch:true, rounds: [{ npc:['He has not touched you. He has not said you are under arrest.'], narr:true,
            box:[ { g:'ask', t:'\u201cAm I free to go?\u201d', keys:['free'] },
                  { g:'steady', t:'Wait for him to finish.' },
                  { g:'soft', t:'Ask him what this is about.' } ] }] },
        { rounds: [{ npc:['Then we are going to do this the long way.','Hands out of your pockets. We are going to be here a while.'],
            box:[ { g:'shield', t:'\u201cI am not answering anything else. I want a lawyer.\u201d', keys:['lawyer'] },
                  { g:'soft', t:'Try to explain yourself.' },
                  { g:'severe', t:'Tell him you are a citizen.', damages:true } ] }] }
      ]
    },

    {
      id: 'store', art: 'store', name: 'Outside a grocery store', active: false,
      teaches: 'Suspicion is cheap. Do not add to it.', floor: 10, exitAt: 12,
      open: 'Two of them by the carts. Nobody is going in or out.',
      law: 'They can stand in a public place and watch you. What they cannot do is make you help.',
      checklist: [
        ['record','Started recording'], ['moving','Kept moving'],
        ['free','Asked \u201cAm I free to go?\u201d'], ['silent','Stayed silent about where you were born'],
        ['nohelp','Told them nothing about anyone else'], ['held','Held the line when they pushed'],
        ['lawyer','Asked for a lawyer']
      ],
      exitDeny: '\u201cNo. Stay right there.\u201d',
      beats: [
        { rounds: [{ npc:['They are scanning faces. One of them turns toward you.','They are watching the doors. One of them has noticed you.'], narr:true,
            box:[ { g:'shield', t:'Keep walking. Do not meet his eye.', keys:['moving'] },
                  { g:'soft', t:'Stop and watch what happens.' },
                  { g:'fatal', t:'Leave the cart and get out of there.', why:'Nobody chases a man who is buying eggs. They chase a man who runs.' } ] }] },
        { rounds: [{ npc:['\u00bfDe d\u00f3nde eres? \u2014 Where are you from?','Habla ingl\u00e9s? Where were you born?'],
            box:[ { g:'shield', t:'Say nothing. Keep loading the cart.', keys:['silent'] },
                  { g:'soft', t:'Answer him in Spanish.' },
                  { g:'harmful', t:'Tell him where you were born.', damages:true } ] }] },
        { rounds: [
            { npc:['He points at the woman beside you. \u201cShe says she knows you.\u201d','He nods at the woman with the cart. \u201cThat your sister?\u201d'],
              box:[ { g:'shield', t:'Say nothing about her.', keys:['nohelp'] },
                    { g:'soft', t:'\u201cI have never seen her before.\u201d' },
                    { g:'severe', t:'Tell him she is nobody. Make something up.', damages:true } ] },
            { npc:['We can do this here, or we can do it downtown. Give me her name.','You help me, I help you. Just the name.'],
              box:[ { g:'shield', t:'Still nothing.', keys:['held'] },
                    { g:'soft', t:'Tell him you do not want any trouble.' },
                    { g:'harmful', t:'Say her name.', damages:true } ] }
          ], after:'She never said she knew you. He was guessing, out loud, to see what came back.' },
        { rounds: [{ npc:['Show me something. Anything with your name on it.','Just show me a document and you can go.'],
            box:[ { g:'shield', t:'\u201cI do not consent. I want a lawyer.\u201d', keys:['lawyer'] },
                  { g:'harmful', t:'Show him your consular card.', damages:true },
                  { g:'severe', t:'Push past him.', damages:true } ] }] },
        { hatch:true, rounds: [{ npc:['He has not said you are under arrest. He is waiting for you to keep talking.'], narr:true,
            box:[ { g:'ask', t:'\u201cAm I free to go?\u201d', keys:['free'] },
                  { g:'steady', t:'Stand still and say nothing.' },
                  { g:'soft', t:'Ask if you have done something wrong.' } ] }] }
      ]
    },

    {
      id: 'site', art: 'site', name: 'Construction site', active: false,
      teaches: 'Someone else can open your door.', floor: 70, exitAt: 25,
      open: 'Two vans at the gate. The foreman is already walking toward them.',
      law: 'Your employer can let them into the parts of the site you work in. Nobody asks you.',
      checklist: [
        ['record','Started recording'], ['stayed','Stayed where you were'],
        ['nosort','Refused to sort yourself'], ['held','Held still when they pushed'],
        ['lawyer','Asked for a lawyer'], ['noforeign','Showed no foreign documents'],
        ['nosign','Signed nothing'], ['nolie','Told no lies']
      ],
      exitDeny: '\u201cNo.\u201d',
      beats: [
        { rounds: [{ npc:['The foreman opens the gate and waves them through. He does not look at you.','The foreman shakes a hand at the gate. The vans roll in.'], narr:true,
            box:[ { g:'shield', t:'Put the tools down. Stay exactly where you are.', keys:['stayed'] },
                  { g:'soft', t:'Walk over to the trailer with everyone else.' },
                  { g:'fatal', t:'Go over the fence.', why:'The fence was eight feet. The report says you fled.' } ] }] },
        { rounds: [
            { npc:['Everybody line up. Citizens on this side.','Line up. If you were born here, stand over there.'],
              box:[ { g:'shield', t:'Do not move. Say nothing.', keys:['nosort'] },
                    { g:'soft', t:'Move to the middle of the yard.' },
                    { g:'harmful', t:'Step to the other side.', damages:true } ] },
            { npc:['Standing there is an answer too. Move.','You think we cannot tell? Move.'],
              box:[ { g:'shield', t:'Stay still.', keys:['held'] },
                    { g:'soft', t:'Ask what the line is for.' },
                    { g:'harmful', t:'Step across.', damages:true } ] }
          ], after:'Nobody moves. Then somebody does, and the yard sorts itself.' },
        { rounds: [{ npc:['Name. Country.','Name, and where you were born.'],
            box:[ { g:'shield', t:'\u201cI am going to remain silent. I want a lawyer.\u201d', keys:['lawyer','nolie'] },
                  { g:'harmful', t:'Give your name and your country.', damages:true },
                  { g:'severe', t:'Tell them you were born here.', damages:true } ] }] },
        { rounds: [{ npc:['Papers. Whatever you have got on you.','Empty your pockets. Show me a document.'],
            box:[ { g:'shield', t:'Show nothing. Say nothing.', keys:['noforeign'] },
                  { g:'steady', t:'Show the registration card you are required to carry.' },
                  { g:'harmful', t:'Show your passport from home.', damages:true } ] }] },
        { rounds: [{ npc:['In the van, a clipboard. \u201cSign here and you sleep at home tonight.\u201d','A form on a clipboard. \u201cOne signature. You will be out by dinner.\u201d'], narr:true,
            box:[ { g:'shield', t:'\u201cI will not sign anything without a lawyer.\u201d', keys:['nosign','lawyer'] },
                  { g:'harmful', t:'Read it and sign it.', damages:true },
                  { g:'severe', t:'Sign it without reading.', damages:true } ] }] },
        { hatch:true, rounds: [{ npc:['The van door is open. Nobody has said the word arrest.'], narr:true,
            box:[ { g:'ask', t:'\u201cAm I free to go?\u201d', keys:[] },
                  { g:'steady', t:'Say nothing.' },
                  { g:'severe', t:'Ask them to call your foreman back over.', damages:true } ] }] }
      ]
    }
  ];

  var BUNDLED_ENDINGS = {
    clean:  { stamp:'WALKED AWAY', truth:'You gave them nothing, and they had nothing.' },
    lucky:  { stamp:'WALKED AWAY', truth:'You handed them something and they let you go anyway. That was luck. Luck is not a plan.' },
    intact: { stamp:'DETAINED',    truth:'They took you anyway. You gave them nothing. That is what a lawyer will need.' },
    damaged:{ stamp:'DETAINED',    truth:'They took you, and they took what you gave them.' }
  };

  var SCENES = BUNDLED_SCENES;
  var ENDINGS = BUNDLED_ENDINGS;

  /* ------------------------------------------------------------------
     GRAPH SCENES — cards/answers/goto/layerRules, fetched separately
     from the legacy beats[] scenes above. Keyed by scene id. A graph
     scene entry in SCENES (see BUNDLED_SCENES) carries mode:'graph'
     and no beats/checklist of its own — curBeat()/renderBeat()/etc.
     dispatch to the graph renderer whenever S.sc.mode==='graph'.
     Falls back to null (scene simply won't be playable) if neither
     cache nor network has it yet — same fail-open posture as the
     legacy path, just scoped to graph scenes so it can't regress them.
     ------------------------------------------------------------------ */
  var GRAPHS = {}; // sceneId -> { cardsById, npcsById, meters, credits, layerFiles }
  var GRAPH_CACHE_KEY = 'kyr:graph:v1';

  function indexGraph(raw){
    var cardsById = {}; (raw.cards||[]).forEach(function(c){ cardsById[c.id]=c; });
    var npcsById = {}; (raw.npcs||[]).forEach(function(n){ npcsById[n.id]=n; });
    var layerFiles = {}; (raw.layers||[]).forEach(function(l){ layerFiles[l.id.replace(raw.slug+'-','')]=l.file; });
    var meterDefs = (raw.effects&&raw.effects.meters)||[];
    var creditDefs = (raw.effects&&raw.effects.credits)||[];
    return {
      slug: raw.slug, title: raw.title, teaches: raw.teaches, floor: raw.floor,
      exitAt: raw.exitAt, exitDeny: raw.exitDeny, open: raw.open, law: raw.law,
      active: raw.active, cardsById: cardsById, npcsById: npcsById,
      layerFiles: layerFiles, meterDefs: meterDefs, creditDefs: creditDefs
    };
  }
  function readGraphCache(){
    try { var raw=localStorage.getItem(GRAPH_CACHE_KEY); return raw?JSON.parse(raw):null; }
    catch(e){ return null; }
  }
  function writeGraphCache(all){
    try { localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(all)); } catch(e){}
  }
  function loadGraphScene(slug){
    var cached = readGraphCache();
    if (cached && cached[slug]) GRAPHS[slug] = indexGraph(cached[slug]);
    fetchWithTimeout(CONTENT_API_BASE + '/api/kyr/graph/scenes/' + encodeURIComponent(slug), CONTENT_FETCH_TIMEOUT_MS)
      .then(function(r){ if(!r.ok) throw new Error('graph fetch failed'); return r.json(); })
      .then(function(fresh){
        if (fresh && fresh.error) throw new Error(fresh.error);
        GRAPHS[slug] = indexGraph(fresh);
        var all = readGraphCache() || {}; all[slug] = fresh; writeGraphCache(all);
      })
      .catch(function(){ /* offline/unreachable — keep whatever cache gave us, or
        nothing if this is a true first launch; scene picker checks GRAPHS[slug]
        before allowing entry, same fail-open posture as the legacy path. */ });
  }

  var FORCED_ENTRY = 'They came through the door. You never opened it, you never consented, and the paper they carried was signed by an immigration officer, not a judge. Write down the time. Write down what it said. A lawyer starts there.';
  var RECORDED_NOTE = 'You have it on video. Thirty seconds. It goes to the lawyer with everything else.';

  /* ==================================================================
     PIXELIZE  — 160x144, day/night palettes, ordered dither
     ================================================================== */
  var LW = 160, LH = 144, SCALE = 4;

  /* Bright, saturated, SNES-era. Darkest colour stops at readable slate. */
  var PAL_DAY = ['#f7f1e2','#ece0c6','#d9c9a6','#c1ac82','#a5906a','#867454',
    '#fdf4dc','#f8e3a0','#f0c766','#dba24a','#bd7f34',
    '#cdd8e8','#aab9d0','#8898b4','#6b7d9c','#516485','#3f5170',
    '#a3b283','#88996a','#6c8050','#53623c','#ddd0ac','#93a172',
    '#e2e7ee','#b3bcc6','#4a5064'];
  var PAL_NIGHT = ['#d5cebd','#c0b59d','#a3937c','#867658','#6b5f48','#544a3b',
    '#f6e5b2','#edc973','#d5a04a','#a87838','#7c5726',
    '#9aa7be','#7d8daa','#647794','#4c5d79','#3b4d68','#2d3d54',
    '#7c8a60','#63744c','#4e5f3c','#3c4a2e','#b4a886','#6d7a52',
    '#b4bcc7','#808a97','#3a3f4e'];

  function toRGB(pal){ return pal.map(function(h){ return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }); }
  var PALS = { day: toRGB(PAL_DAY), night: toRGB(PAL_NIGHT) };
  var LUTS = {};
  function buildLUT(pal){
    var lut=new Uint8Array(32768);
    for (var r=0;r<32;r++) for (var g=0;g<32;g++) for (var b=0;b<32;b++){
      var R=r<<3,G=g<<3,B=b<<3,best=0,bd=1e9;
      for (var i=0;i<pal.length;i++){ var dr=R-pal[i][0],dg=G-pal[i][1],db=B-pal[i][2];
        var d=dr*dr*0.3+dg*dg*0.59+db*db*0.11; if(d<bd){bd=d;best=i;} }
      lut[(r<<10)|(g<<5)|b]=best;
    } return lut;
  }
  LUTS.day = buildLUT(PALS.day); LUTS.night = buildLUT(PALS.night);
  var BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

  var hi = document.createElement('canvas'); hi.width=LW*SCALE; hi.height=LH*SCALE;
  var hx = hi.getContext('2d');
  var visCanvas=null, vx=null;

  function Rr(x,y,w,h,c){ hx.fillStyle=c; hx.fillRect(x*SCALE,y*SCALE,w*SCALE,h*SCALE); }
  function POLY(pts,c){ hx.fillStyle=c; hx.beginPath(); hx.moveTo(pts[0][0]*SCALE,pts[0][1]*SCALE);
    for(var i=1;i<pts.length;i++) hx.lineTo(pts[i][0]*SCALE,pts[i][1]*SCALE); hx.closePath(); hx.fill(); }
  function GLOW(x,y,r,c,a){ var gr=hx.createRadialGradient(x*SCALE,y*SCALE,0,x*SCALE,y*SCALE,r*SCALE);
    gr.addColorStop(0,c); gr.addColorStop(1,'rgba(0,0,0,0)');
    hx.globalAlpha=a==null?1:a; hx.fillStyle=gr; hx.fillRect((x-r)*SCALE,(y-r)*SCALE,r*2*SCALE,r*2*SCALE); hx.globalAlpha=1; }

  function pixelize(){
    if(!vx) return;
    var lut=LUTS[palName], pal=PALS[palName];
    vx.imageSmoothingEnabled=true; vx.drawImage(hi,0,0,LW,LH);
    var img=vx.getImageData(0,0,LW,LH), d=img.data, w=LW;
    for (var i=0;i<d.length;i+=4){
      var px=(i>>2)%w, py=(i>>2)/w|0;
      var dth=(BAYER[(py&3)*4+(px&3)]/16-0.5)*10;   /* light dither before quantize */
      var r=d[i]+dth, g=d[i+1]+dth, b=d[i+2]+dth;
      r=r<0?0:r>255?255:r; g=g<0?0:g>255?255:g; b=b<0?0:b>255?255:b;
      var key=((r>>3)<<10)|((g>>3)<<5)|(b>>3);
      var p=pal[lut[key]]; d[i]=p[0]; d[i+1]=p[1]; d[i+2]=p[2]; d[i+3]=255;
    }
    vx.imageSmoothingEnabled=false; vx.putImageData(img,0,0);
  }

  /* palette-aware colour helper: pick from a small semantic set by night flag */
  var palName='day';
  function C(day,night){ return palName==='night'?night:day; }

  /* one officer. olive gear, no skin, chunky. */
  function officer(cx, feetY, h, rim){
    var u=h/100, headW=24*u, hx0=cx-headW/2, topY=feetY-h;
    var oD=C('#586d41','#485836'), oL=C('#748557','#5c6d46'), dk=C('#2e3d57','#28374c'),
        tan=C('#cfc19c','#aca07f'), tanhi=C('#efe8d6','#cdc6b6');
    /* torso + carrier */
    var ty=topY+24*u, tw=52*u, tx=cx-tw/2, th=h-26*u;
    Rr(tx,ty,tw,th,oD);
    Rr(tx-6*u,ty+2*u,6*u,th*0.6,oD); Rr(tx+tw,ty+2*u,6*u,th*0.6,oD);
    Rr(tx+4*u,ty,5*u,th,oL); Rr(tx+tw-9*u,ty,5*u,th,oL);
    Rr(tx+12*u,ty+th*0.46,11*u,10*u,dk); Rr(tx+29*u,ty+th*0.46,11*u,10*u,dk);
    var pw=38*u,ph=8*u,ppx=cx-pw/2,ppy=ty+9*u;
    Rr(ppx,ppy,pw,ph,tanhi);
    hx.fillStyle=C('#2e3d57','#28374c'); hx.font='700 '+Math.max(6,Math.round(4.8*u*SCALE))+'px "Courier New",monospace';
    hx.textAlign='center'; hx.textBaseline='middle';
    hx.fillText('IMMIGRATION', cx*SCALE, (ppy+ph/2)*SCALE);
    hx.textAlign='start'; hx.textBaseline='alphabetic';
    /* helmet + gaiter + shades */
    Rr(hx0,topY,headW,22*u,oD);
    Rr(hx0-2*u,topY-2*u,headW+4*u,9*u,dk);       /* helmet */
    Rr(cx-2*u,topY-5*u,4*u,4*u,dk);              /* nvg mount */
    Rr(hx0-1*u,topY+8*u,headW+2*u,6*u,'#101019');/* shades band */
    Rr(hx0+3*u,topY+9*u,6*u,2*u,C('#7587a4','#5b6e8c'));
    Rr(hx0,topY+15*u,headW,8*u,oL);              /* gaiter */
    /* slung rifle */
    POLY([[tx-4*u,ty+th*0.5],[tx+tw*0.58,ty+th*0.74],[tx+tw*0.58,ty+th*0.82],[tx-4*u,ty+th*0.58]], dk);
    if (rim){ Rr(hx0-2*u,topY,2*u,22*u,C('#e8b954','#cb9944')); Rr(tx-6*u,ty+2*u,2*u,th*0.5,C('#e8b954','#cb9944')); }
  }

  /* ---------- scene draw routines (share day/night via C()) ---------- */
  var artState={ open:0, t:0, lit:false };





  function drawCar(){
    var road=C('#a5906a','#4c4235'), sky=C('#cdd8e8','#2d3d54'), pillar=C('#8898b4','#4c5d79'),
        dash=C('#867454','#3b4d68');
    Rr(0,0,LW,LH,sky);
    Rr(0,36,LW,40,road); Rr(0,34,LW,2,C('#6f6044','#354760'));
    for (var i=0;i<5;i++) Rr(14+i*32,54,14,2,C('#efe8d6','#79828f'));
    /* light bar flash */
    var f=Math.sin(artState.t/160)>0;
    Rr(6,6,14,7,f?C('#3d5070','#354760'):C('#2e3d57','#3c4150'));
    Rr(22,6,14,7,f?C('#b23a3c','#8a3a35'):C('#7587a4','#5b6e8c'));
    /* window frame */
    Rr(0,0,LW,12,pillar); Rr(0,0,12,86,pillar); Rr(148,0,12,86,pillar);
    Rr(0,84,LW,60,dash); Rr(0,82,LW,2,C('#8d7b58','#445571'));
    hx.strokeStyle=C('#414f30','#28374c'); hx.lineWidth=6*SCALE/1;
    hx.beginPath(); hx.arc(80*SCALE,150*SCALE,34*SCALE,Math.PI,2*Math.PI); hx.stroke();
    /* officer leaning to driver window (left) */
    Rr(0,12,40,72,C('#2e3d57','#1a1f2b'));
    GLOW(34,52,30,palName==='day'?'rgba(247,236,210,.4)':'rgba(244,225,170,.45)',1);
    officer(20,80,74,true);
    Rr(38,50,10,4,C('#f4dc93','#e9c26b'));  /* flashlight */
  }

  function drawStreet(){
    var sky=C('#cdd8e8','#2d3d54'), build=C('#aab9d0','#3b4d68'), walk=C('#c1ac82','#6b5f48');
    Rr(0,0,LW,LH,sky);
    Rr(0,0,LW,64,build);
    for (var i=0;i<7;i++) Rr(6+i*22,24,16,40,i%2?C('#98a9c1','#3c4150'):C('#566a8a','#28374c'));
    Rr(0,62,LW,4,C('#3d5070','#354760'));
    Rr(0,66,LW,78,walk);
    for (i=0;i<5;i++) Rr(i*40,66,2,78,C('#8d7b58','#4c4235'));
    /* streetlight */
    Rr(128,6,3,58,C('#566a8a','#354760')); Rr(114,4,20,3,C('#3d5070','#28374c'));
    Rr(120,8,10,5,C('#f4dc93','#e9c26b'));
    if (palName==='night'){ GLOW(124,12,34,'rgba(244,225,170,.5)',1); }
    else GLOW(124,12,30,'rgba(247,236,210,.35)',1);
    officer(74,120,96,true);
    /* your shadow, cast toward camera */
    hx.globalAlpha=0.28; POLY([[60,144],[96,144],[84,116],[72,116]], C('#3c4150','#1a1f2b')); hx.globalAlpha=1;
  }

  function drawStore(){
    var lot=C('#c1ac82','#4c4235'), face=C('#aab9d0','#3b4d68'), glass=C('#a3b283','#4e5f3c');
    Rr(0,0,LW,LH,C('#cdd8e8','#2d3d54'));
    Rr(12,14,136,58,face);
    Rr(16,20,128,44,glass);
    for (var i=0;i<5;i++) Rr(22+i*26,24,20,3,C('#8f9d6f','#5c6d46'));
    Rr(64,26,34,38,C('#3d5070','#28374c'));  /* doors */
    Rr(12,68,136,6,C('#3d5070','#354760'));
    Rr(0,74,LW,70,lot); Rr(0,74,LW,2,C('#566a8a','#445571'));
    Rr(12,104,40,2,C('#8d7b58','#4c4235')); Rr(64,104,40,2,C('#8d7b58','#4c4235')); Rr(116,104,32,2,C('#8d7b58','#4c4235'));
    if (artState.lit){ GLOW(80,20,50,palName==='day'?'rgba(247,236,210,.3)':'rgba(233,194,107,.35)',1); }
    officer(92,64,44,artState.lit);
    officer(112,66,42,artState.lit);
    /* cart handle foreground */
    Rr(14,120,132,6,C('#9fa8b3','#79828f'));
    Rr(14,116,8,14,C('#d4dae0','#adb5c0')); Rr(138,116,8,14,C('#d4dae0','#adb5c0'));
  }

  function drawSite(){
    var ground=C('#c1ac82','#4c4235'), sky=C('#cdd8e8','#2d3d54'), wall=C('#aab9d0','#4c5d79');
    Rr(0,0,LW,LH,sky);
    Rr(0,40,84,40,wall);
    for (var i=0;i<5;i++) for (var j=0;j<3;j++) Rr(4+i*16,44+j*12,13,9,C('#7587a4','#354760'));
    Rr(0,78,LW,66,ground); Rr(0,76,LW,2,C('#566a8a','#445571'));
    /* floodlights */
    Rr(20,6,3,14,C('#566a8a','#354760')); Rr(14,3,15,5,C('#e8b954','#cb9944'));
    Rr(140,6,3,14,C('#566a8a','#354760')); Rr(132,3,15,5,C('#e8b954','#cb9944'));
    if (palName==='night'){ GLOW(21,7,28,'rgba(233,194,107,.4)',1); GLOW(141,7,28,'rgba(233,194,107,.4)',1); }
    /* gate + vans */
    Rr(104,32,2,46,C('#3d5070','#354760')); Rr(150,32,2,46,C('#3d5070','#354760'));
    Rr(110,44,28,30,C('#2e3d57','#1a1f2b')); Rr(112,47,24,11,C('#566a8a','#354760'));
    Rr(138,48,16,26,C('#2e3d57','#1a1f2b'));
    officer(128,78,58,true);
    officer(100,80,52,true);
    /* scaffold foreground */
    Rr(18,0,4,144,C('#6f6044','#28374c')); Rr(60,0,4,144,C('#6f6044','#28374c'));
    Rr(0,30,LW,4,C('#6f6044','#28374c')); Rr(0,92,LW,4,C('#6f6044','#28374c'));
  }

  function render(){
    var art = S?S.sc.art:'door';
    if (art==='door'){ /* door is drawn with SVG layers, not the canvas */ return; }
    if (art==='car') drawCar();
    else if (art==='street') drawStreet();
    else if (art==='store') drawStore();
    else drawSite();
    /* light scanline */
    hx.globalAlpha=0.05; hx.fillStyle='#000';
    for (var y=0;y<LH;y+=2) hx.fillRect(0,y*SCALE,LW*SCALE,SCALE);
    hx.globalAlpha=1;
    pixelize();
  }

  /* ---- door SVG layer stack (Casey's pre-aligned 1600x1440 art) ------
     Layer order (back to front): sky, floor, [agents], walls, door.
     Each is a full-frame transparent PNG/SVG; we just show/hide. */
  var DOOR_LAYERS = [
    'sky',        '0-sky.svg',
    'floor',      '1-floor.svg',
    'agentDoor1', '2-agent-1-at-door.svg',
    'agentDoor2', '3-agent-2-at-door.svg',
    'agentWin',   '2-agent-4-looking-in-window.svg',
    'agentWarrant','2-agent-3-papers-at-window.svg',
    'walls',      '4-walls.svg',
    'doorClosed', '5-door-closed.svg',
    'doorCracked','5-door-cracked.svg',
    'doorOpen',   '5-door-open.svg'
  ];
  var doorImgs = {}, doorBuilt = false;
  function buildDoorLayers(){
    if (doorBuilt) return; doorBuilt = true;
    elLayers.innerHTML = '';
    var stack = document.createElement('div'); stack.className = 'pr-stack';
    for (var i=0;i<DOOR_LAYERS.length;i+=2){
      var key = DOOR_LAYERS[i], file = DOOR_LAYERS[i+1];
      var im = document.createElement('img');
      im.src = base + file; im.alt = ''; im.className = 'hide'; im.decoding = 'async';
      stack.appendChild(im); doorImgs[key] = im;
    }
    elLayers.appendChild(stack);
  }
  function show(keys){
    for (var k in doorImgs) doorImgs[k].classList.add('hide');
    keys.forEach(function(k){ if(doorImgs[k]) doorImgs[k].classList.remove('hide'); });
  }
  /* compose the door scene from the current game state */
  function paintDoor(){
    if (!S) return;
    var L = ['sky','floor'];
    var open = S.doorState;               // 'closed' | 'cracked' | 'open'
    if (open==='closed'){
      /* while shut, an agent is at the window; the warrant agent replaces
         him once the paper is asked for */
      if (S.warrantShown) L.push('agentWarrant');
      else if (S.agentWin) L.push('agentWin');
    } else {
      /* door is cracked or open: the agent is at the doorway now.
         a second one joins only once you have given something away. */
      L.push('agentDoor1');
      if (S.risk >= 30) L.push('agentDoor2');
    }
    L.push('walls');
    L.push(open==='open' ? 'doorOpen' : open==='cracked' ? 'doorCracked' : 'doorClosed');
    show(L);
  }



  /* ============================== DOM ============================== */
  function x(n){ return root.querySelector('[data-el="'+n+'"]'); }
  var elTitle=x('title'), elMenuList=x('menuList'), elGame=x('game'),
      elResult=x('result'), elSpeaker=x('speaker'), elText=x('text'),
      elMore=x('more'), elOpts=x('opts'),
      elBar=x('bar'), elCount=x('count'), elRec=x('btnRec'), elHint=x('btnHint'),
      elSceneName=x('sceneName'), elDots=x('beatDots'),
      elStamp=x('stamp'), elTruth=x('truth'), elPlain=x('plain'),
      elList=x('list'), elReward=x('reward'), elDiff=x('diffRow'), elTitleTap=x('titleTap');
  visCanvas=x('canvas'); visCanvas.width=LW; visCanvas.height=LH; vx=visCanvas.getContext('2d');
  var elLayers=x('layers');

  var difficulty='medium', S=null, typing=null, pendingThen=null, skipTo=null;
  function pick(a){ return a[(Math.random()*a.length)|0]; }

  function say(line, narr, then){
    if (typing) clearInterval(typing); stopTimer();
    elOpts.hidden=true; elMore.hidden=true;
    elText.classList.toggle('narr', !!narr); elSpeaker.hidden=!!narr; elText.textContent='';
    var i=0;
    function settle(){ clearInterval(typing); typing=null; elText.textContent=line; elMore.hidden=false;
      elGame.dataset.await='1'; pendingThen=then; }
    typing=setInterval(function(){ elText.textContent=line.slice(0,++i); if(i>=line.length) settle(); }, CONFIG.typeSpeed);
    skipTo=settle;
  }
  function advance(){ if (typing&&skipTo){ skipTo(); return; }
    if (elGame.dataset.await==='1'){ elGame.dataset.await=''; elMore.hidden=true;
      var fn=pendingThen; pendingThen=null; if(fn) fn(); } }

  var timer={raf:null,t0:0,dur:0,timeouts:0};
  function stopTimer(){ if(timer.raf){ cancelAnimationFrame(timer.raf); timer.raf=null; } elBar.style.width='0%'; elBar.className='pr-bar'; elCount.textContent=''; elCount.className='pr-count'; }
  function startTimer(){ var secs=DIFF[difficulty];
    if(!secs){ elBar.style.width='100%'; elBar.className='pr-bar off'; elCount.textContent='\u221e'; elCount.className='pr-count off'; return; }
    timer.dur=secs*1000; timer.t0=performance.now();
    (function tick(now){ var left=timer.dur-(now-timer.t0), frac=Math.max(0,left/timer.dur), hot=left<=3000;
      elBar.style.width=(frac*100)+'%'; elBar.className='pr-bar'+(hot?' hot':'');
      elCount.textContent=Math.max(0,Math.ceil(left/1000)); elCount.className='pr-count'+(hot?' hot':'');
      if(left<=0){ timer.raf=null; onTimeout(); return; } timer.raf=requestAnimationFrame(tick); })(timer.t0); }
  function onTimeout(){ timer.timeouts++; S.risk+=CONFIG.timeoutPenalty;
    if (timer.timeouts>=CONFIG.maxTimeouts){ var b=curBeat(), r=b.rounds[Math.min(S.round,b.rounds.length-1)];
      timer.timeouts=0; return resolve(r.box[0], b); }
    say(pick(['\u201cI am not going to ask again.\u201d','\u201cAnswer me. Now.\u201d','\u201cYou are running out of time.\u201d']), false, renderRound); }

  function toTitle(){ if(typing){ clearInterval(typing); typing=null; } stopTimer();
    elTitle.hidden=false; elGame.hidden=true; elResult.hidden=true; }

  /* ------------------------------------------------------------------
     GRAPH GAMEPLAY — evaluated fresh against live state every render,
     never precomputed per a scripted path. A layer rule looks like:
       { if: { door:'closed', warrantShown:false }, show:'agentWin' }
       { if: { door_not:'closed', meter:'detain', gte:30 }, show:'agentDoor2' }
     `door`/`door_not` compare S.doorState; `warrantShown` compares
     S.warrantShown; `meter`+`gte`/`lte` compare S.risk (the door
     scene's only meter, 'detain', is kept in sync with S.risk so the
     rest of the engine — finish(), the hint system — doesn't need to
     know graph scenes exist).
     ------------------------------------------------------------------ */
  function ruleMatches(cond){
    if ('door' in cond && S.doorState !== cond.door) return false;
    if ('door_not' in cond && S.doorState === cond.door_not) return false;
    if ('warrantShown' in cond && !!S.warrantShown !== cond.warrantShown) return false;
    if (cond.meter){
      var val = (cond.meter === 'detain') ? S.risk : (S.meters && S.meters[cond.meter]) || 0;
      if ('gte' in cond && !(val >= cond.gte)) return false;
      if ('lte' in cond && !(val <= cond.lte)) return false;
    }
    return true;
  }
  function paintGraphLayers(card){
    var g = GRAPHS[S.sc.id]; if (!g) return;
    var show = {}; (card.layers||[]).forEach(function(k){ show[k]=true; });
    (card.layerRules||[]).forEach(function(rule){ if (ruleMatches(rule.if)) show[rule.show]=true; });
    /* Reuse the door art system's existing show()/doorImgs — same 10
       committed SVGs, just driven by rule evaluation instead of the
       old paintDoor()'s three hand-written if/else branches. */
    if (S.sc.art === 'door'){ buildDoorLayers(); elLayers.hidden=false; visCanvas.style.display='none'; show(Object.keys(show)); }
  }
  function curGraphCard(){ var g=GRAPHS[S.sc.id]; return g ? g.cardsById[S.cardId] : null; }
  function renderGraphCard(){
    var g = GRAPHS[S.sc.id], card = curGraphCard();
    if (!g || !card){ return finish(); }
    if (card.type === 'end'){ return finish(S.pendingForcedDetain); }
    paintGraphLayers(card);
    S.cardsSeen = S.cardsSeen || {}; S.cardsSeen[card.id] = true;
    S.pathLen = (S.pathLen||0) + 1;
    drawDots();
    var resp = (card.responses||[])[0];
    if (!resp){ return showGraphChoices(card); }
    var extra = (card.responses||[]).slice(1).filter(function(r){ return r.variantMode==='narration-on-shield'; });
    say(pick(resp.texts), resp.speaker==null, function(){
      if (extra.length){ say(pick(extra[0].texts), true, function(){ showGraphChoices(card); }); }
      else showGraphChoices(card);
    });
  }
  function showGraphChoices(card){
    elOpts.innerHTML='';
    card.answers.forEach(function(a,i){ var btn=document.createElement('button');
      btn.className='pr-opt'; btn.type='button'; btn.dataset.i=i;
      btn.innerHTML='<span class="pr-cur">\u25b6</span><span>'+a.text+'</span>'; elOpts.appendChild(btn); });
    elOpts.hidden=false; timer.timeouts=0; startTimer();
    elOpts.onclick=function(e){ var t=e.target.closest('.pr-opt'); if(!t) return; resolveGraphAnswer(card.answers[+t.dataset.i]); };
  }
  function resolveGraphAnswer(a){
    stopTimer();
    var fx = a.effects || {};
    if (fx.credits) for (var k in fx.credits) if (fx.credits[k]) S.keys[k]=true;
    if (fx.damaged) S.damaged = true;
    if (fx.door){
      if (fx.door === 'warrant'){ S.warrantShown = true; }
      else { S.doorState = fx.door; }
    }
    if (fx.meters && 'detain' in fx.meters){
      S.risk = Math.min(100, Math.max(curFloor(), S.risk + fx.meters.detain));
    }
    var goto = a.goto;
    var nextCard = goto ? (GRAPHS[S.sc.id] && GRAPHS[S.sc.id].cardsById[goto]) : null;
    if (nextCard && nextCard.type === 'end' && fx.grade === 'fatal'){
      S.risk = 100; S.doorState = 'open';
      S.cardId = goto;
      return say(fx.why || '', true, function(){ finish(true); });
    }
    if (!goto){ return finish(); }
    S.cardId = goto;
    if (fx.why){ return say(fx.why, true, renderGraphCard); }
    renderGraphCard();
  }

  function startScene(i){ var sc=SCENES[i];
    if (sc.mode === 'graph'){
      var g = GRAPHS[sc.id];
      if (!g){ /* not loaded yet (offline/slow network) — bail to title rather
        than render a broken scene; loadGraphScene keeps retrying in the background. */
        return toTitle(); }
      S={ i:i, sc:sc, cardId:'start', risk:g.floor, damaged:false, keys:{}, over:false, recording:false,
          doorState:'closed', warrantShown:false, cardsSeen:{}, pathLen:0 };
      artState.open=0; artState.lit=false;
      elTitle.hidden=true; elResult.hidden=true; elGame.hidden=false;
      elSceneName.textContent=g.title; elRec.className='pr-rec';
      buildDoorLayers(); elLayers.hidden=false; visCanvas.style.display='none';
      drawDots();
      var startCard = g.cardsById['start'];
      var firstGoto = startCard && startCard.answers && startCard.answers[0] && startCard.answers[0].goto;
      if (firstGoto) S.cardId = firstGoto;
      return say(g.open, true, renderGraphCard);
    }
    S={ i:i, sc:sc, beat:0, round:0, risk:sc.floor, damaged:false, keys:{}, over:false, recording:false,
        doorState:'closed', agentWin:false, warrantShown:false };
    artState.open=0; artState.lit=false;
    elTitle.hidden=true; elResult.hidden=true; elGame.hidden=false;
    elSceneName.textContent=sc.name; elRec.className='pr-rec';
    if (sc.id==='door'){
      buildDoorLayers();
      elLayers.hidden=false; visCanvas.style.display='none';
      paintDoor();
    } else {
      elLayers.hidden=true; visCanvas.style.display='';
      render();
    }
    drawDots();
    say(sc.open, true, renderBeat); }

  function drawDots(){ elDots.innerHTML='';
    if (S.sc.mode === 'graph'){
      /* Path length is dynamic in a graph scene (branches make it longer),
         so dots track progress-so-far rather than a fixed beat count —
         one dot per card visited this run, capped so a long detour
         doesn't overflow the strip. */
      var n = Math.min(S.pathLen||0, 12);
      for (var j=0;j<n;j++){ var dd=document.createElement('i'); dd.className = j<n-1?'on':'now'; elDots.appendChild(dd); }
      return;
    }
    for (var i=0;i<S.sc.beats.length;i++){ var d=document.createElement('i');
      d.className=i<S.beat?'on':(i===S.beat?'now':''); elDots.appendChild(d); } }
  function curBeat(){ return S.sc.beats[S.beat]; }
  function renderBeat(){ var b=curBeat(); if(!b) return finish();
    if (S.sc.id==='store' && S.beat>=1) artState.lit=true;
    if (S.sc.id==='door'){
      /* the knock is the opening line; from the first real beat on, an agent
         is at the window unless the door is already open */
      if (S.doorState==='closed' && !S.warrantShown) S.agentWin=true;
      paintDoor();
    }
    drawDots(); if(S.sc.id!=='door') render(); renderRound(); }
  function renderRound(){ var b=curBeat(), r=b.rounds[Math.min(S.round,b.rounds.length-1)];
    say(pick(r.npc), !!r.narr, function(){ showChoices(r,b); }); }

  function showChoices(r,b){ elOpts.innerHTML='';
    r.box.forEach(function(o,i){ var btn=document.createElement('button');
      btn.className='pr-opt'; btn.type='button'; btn.dataset.i=i;
      btn.innerHTML='<span class="pr-cur">\u25b6</span><span>'+o.t+'</span>'; elOpts.appendChild(btn); });
    elOpts.hidden=false; timer.timeouts=0; startTimer();
    elOpts.onclick=function(e){ var t=e.target.closest('.pr-opt'); if(!t) return; resolve(r.box[+t.dataset.i], b); }; }

  function grantKeys(keys){ if(keys) keys.forEach(function(k){ S.keys[k]=true; }); }
  function curFloor(){ return (S.sc.mode==='graph') ? (GRAPHS[S.sc.id]?GRAPHS[S.sc.id].floor:0) : S.sc.floor; }

  function resolve(o,b){ stopTimer(); grantKeys(o.keys); if(o.damages) S.damaged=true;
    if (S.sc.id==='door' && o.door){
      if (o.door==='warrant'){ S.warrantShown=true; S.agentWin=false; }
      else { S.doorState=o.door; }        /* 'cracked' | 'open' */
      paintDoor();
    }
    if (o.g==='ask'){ if (S.risk<=S.sc.exitAt){ S.keys.walked=true;
        return say('\u201cYeah. Go on.\u201d', true, function(){ finish(false); }); }
      return say(S.sc.exitDeny, false, function(){ nextBeat(b); }); }
    if (o.g==='fatal'){ S.risk=100;
      if (S.sc.id==='door'){ S.doorState='open'; paintDoor();
        return say(o.why,true,function(){ finish(true); }); }
      return say(o.why,true,function(){ finish(true); }); }
    if (o.g==='shield'){ if (S.round<b.rounds.length-1){ S.round++; return renderRound(); } return nextBeat(b); }
    S.risk=Math.max(curFloor(), S.risk+DELTA[o.g]); nextBeat(b); }

  function nextBeat(b){ S.beat++; S.round=0;
    if (b && b.after) say(b.after, true, renderBeat); else renderBeat(); }

  elRec.addEventListener('click', function(){ if(!S) return;
    if(!S.recording){ S.recording=true; S.keys.record=true; elRec.classList.add('on'); } });
  elHint.addEventListener('click', function(){ if(!S||elGame.hidden) return;
    if (S.sc.mode === 'graph'){
      var card = curGraphCard(); if (!card) return;
      var gi = -1;
      card.answers.forEach(function(a,i){ if (a.effects && (a.effects.grade==='shield'||a.effects.grade==='steady')) gi=i; });
      if (gi>=0){ var gopt=elOpts.querySelector('[data-i="'+gi+'"]'); if(gopt) pulse(gopt); }
      return;
    }
    var b=curBeat(); if(!b) return; var r=b.rounds[Math.min(S.round,b.rounds.length-1)], idx=-1;
    r.box.forEach(function(o,i){ if(o.g==='shield'||o.g==='ask') idx=i; });
    if(idx>=0){ var opt=elOpts.querySelector('[data-i="'+idx+'"]'); if(opt) pulse(opt); } });
  function pulse(el){ el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint');
    setTimeout(function(){ el.classList.remove('hint'); },1600); }

  function finish(forcedDetain){ if(S.over) return; S.over=true; stopTimer();
    var sc=S.sc, isGraph=(sc.mode==='graph'), g=isGraph?GRAPHS[sc.id]:null;
    var detained=forcedDetain===true?true:(Math.random()*100<S.risk), forced=false;
    var isDoorFloorZero = isGraph ? (g && g.floor===0) : (sc.id==='door');
    if (isDoorFloorZero && !S.damaged && S.risk===0 && !detained && Math.random()<CONFIG.forcedEntryChance){ detained=true; forced=true; }
    var key=detained?(S.damaged?'damaged':'intact'):(S.damaged?'lucky':'clean'), e=ENDINGS[key];
    if (forced){
      S.doorState='open'; artState.open=1;
      if (sc.art==='door') paintGraphLayers({layers:['sky','floor','walls','doorOpen'],layerRules:[]});
      else render();
    }
    elGame.hidden=true; elResult.hidden=false;
    elStamp.textContent=e.stamp; elStamp.className='gm-stamp '+(detained?'bad':'ok');
    var truth=forced?FORCED_ENTRY:e.truth; if(S.recording) truth+='\n\n'+RECORDED_NOTE;
    elTruth.textContent=truth; elPlain.textContent = isGraph ? (g?g.law:'') : sc.law;
    elList.innerHTML='';
    var checklist = isGraph ? (g?g.creditDefs.map(function(c){return [c.key,c.label];}):[]) : sc.checklist;
    checklist.forEach(function(row){ var li=document.createElement('li'); var got=!!S.keys[row[0]];
      li.className=got?'got':''; li.innerHTML='<span class="bx">'+(got?'\u2611':'\u2610')+'</span>'+row[1]; elList.appendChild(li); });
    renderReward(); }
  function renderReward(){ var r=CONFIG.reward; elReward.innerHTML='';
    if(!r.code&&!r.link){ elReward.hidden=true; return; } elReward.hidden=false;
    if(r.desc){ var d=document.createElement('div'); d.className='gm-reward-desc'; d.textContent=r.desc; elReward.appendChild(d); }
    if(r.code){ var c=document.createElement('div'); c.className='gm-code'; c.textContent=r.code; elReward.appendChild(c); } }

  function fit(){ var el=root.parentElement;
    for (var i=0; el&&i<8; i++){ var tag=(el.tagName||'').toUpperCase(); if(tag==='BODY'||tag==='HTML') break;
      el.style.display='flex'; el.style.flexDirection='column'; el.style.minHeight='0'; el.style.height='100%';
      if(el.classList && el.classList.contains('games-script')) break; el=el.parentElement; }
    requestAnimationFrame(function(){ if(root.offsetHeight<160) root.style.height=Math.max(560,Math.round(window.innerHeight*0.85))+'px'; }); }
  fit();

  elDiff.addEventListener('click', function(e){ var b=e.target.closest('[data-diff]'); if(!b) return;
    difficulty=b.dataset.diff; elDiff.querySelectorAll('[data-diff]').forEach(function(z){ z.classList.toggle('on',z===b); }); });
  elMenuList.addEventListener('click', function(e){ var b=e.target.closest('.pr-row'); if(!b) return; startScene(+b.dataset.scene); });
  x('box').addEventListener('click', function(e){ if(e.target.closest('.pr-opt')) return; advance(); });
  x('btnReplay').addEventListener('click', function(){ startScene(S.i); });
  x('btnTitle').addEventListener('click', toTitle);
  x('btnQuit').addEventListener('click', toTitle);
  root._kyrReset=toTitle;
  document.addEventListener('click', function(e){ var t=e.target; if(!t||!t.closest) return;
    if(t.closest('[data-kyr-reset]')||t.closest('[gm-reset-button]')){ e.preventDefault(); toTitle(); } });

  var devUnlocked = false; // set true by the 8-tap unlock on the title word; not persisted across reloads

  function buildMenu(){
    elMenuList.innerHTML='';
    SCENES.forEach(function(sc,i){
      var isActive = sc.active !== false; // undefined/true = active; explicit false = hidden
      if (!isActive && !devUnlocked) return;
      var b=document.createElement('button'); b.className='pr-row'; b.type='button'; b.dataset.scene=i;
      if (!isActive) b.classList.add('pr-row--dev');
      b.innerHTML='<span class="pr-cur">\u25b6</span><span class="pr-rowin"><b>'+sc.name+(isActive?'':' <i class="pr-devtag">DEV</i>')+'</b><i>'+sc.teaches+'</i></span>';
      elMenuList.appendChild(b);
    });
  }
  elDiff.querySelector('[data-diff="medium"]').classList.add('on');

  /* ------------------------------------------------------------------
     Dev unlock — 8 taps on the KNOW title word within 2s of each other
     reveals inactive (in-development) scenes for testing, for this
     session only. Rebuilds the menu in place if already on the title
     screen so the reveal is immediate.
     ------------------------------------------------------------------ */
  (function(){
    if (!elTitleTap) return;
    var taps = 0, resetTimer = null;
    elTitleTap.addEventListener('click', function(){
      taps++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function(){ taps = 0; }, 2000);
      if (taps >= 8){
        taps = 0;
        if (!devUnlocked){ devUnlocked = true; buildMenu(); }
      }
    });
  })();

  /* ------------------------------------------------------------------
     loadContent — fetch-then-cache-then-fallback, mirrors the Ice
     Blaster characters/scenes pattern. Never blocks the boot screen
     longer than CONTENT_FETCH_TIMEOUT_MS; whichever source resolves
     first (cache, fresh fetch, or bundled baseline) is what the player
     sees, and the game becomes interactive the moment ANY source is in
     place, not necessarily the freshest one.
     ------------------------------------------------------------------ */
  function readCache(){
    try {
      var raw = localStorage.getItem(CONTENT_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.scenes && parsed.scenes.length && parsed.endings) return parsed;
    } catch (e) { /* corrupt cache — ignore, fall through */ }
    return null;
  }
  function writeCache(payload){
    try { localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(payload)); }
    catch (e) { /* storage full/unavailable — non-fatal, just skip caching */ }
  }
  function fetchWithTimeout(url, ms){
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var opts = ctrl ? { signal: ctrl.signal } : {};
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, ms) : null;
    return fetch(url, opts).finally(function(){ if (timer) clearTimeout(timer); });
  }
  function applyContent(payload, isInitialLoad){
    if (payload && payload.scenes && payload.scenes.length && payload.endings){
      SCENES = payload.scenes; ENDINGS = payload.endings;
      /* The legacy /api/kyr/scenes endpoint still serves a beats-shaped
         'door' entry for backward compatibility with older clients — the
         graph renderer is the only one that should ever run for it here,
         so re-tag it regardless of what the legacy payload says. */
      SCENES.forEach(function(sc){ if (sc.id === 'door') sc.mode = 'graph'; });
    }
    /* else: leave SCENES/ENDINGS at whatever they already were
       (BUNDLED_* from the top-level assignment) — this is the true
       first-launch-offline case. */
    buildMenu();
    /* A late-arriving fetch (after the player has already started
       playing) must not yank the menu out from under an in-progress
       scene or jump them back to the title screen mid-drill. Content
       swaps silently apply to the NEXT time they reach the title/menu
       — S.over is true whenever a scene isn't actively being played
       (title screen, or a finished result screen waiting on Replay/Title). */
    if (isInitialLoad || !S || S.over) toTitle();
  }
  function loadContent(){
    var cached = readCache();
    if (cached) { applyContent(cached, true); }
    else { buildMenu(); toTitle(); }

    fetchWithTimeout(CONTENT_API_BASE + '/api/kyr/version', CONTENT_FETCH_TIMEOUT_MS)
      .then(function(r){ if(!r.ok) throw new Error('version check failed'); return r.json(); })
      .then(function(v){
        if (cached && cached.version === v.version) return; // cache is current, nothing to do
        return fetchWithTimeout(CONTENT_API_BASE + '/api/kyr/scenes', CONTENT_FETCH_TIMEOUT_MS)
          .then(function(r){ if(!r.ok) throw new Error('scenes fetch failed'); return r.json(); })
          .then(function(fresh){
            writeCache(fresh);
            applyContent(fresh, !cached);
          });
      })
      .catch(function(){ /* offline, timed out, or Worker unreachable —
        silent: we're already interactive on cache or bundled content,
        this was purely a best-effort freshness check. */ });
  }
  loadContent();
  loadGraphScene('door');
};
