// ═══ GAME STATE MACHINE (pure mutators; operate on a cloned G) ═══
let _uid=0;
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function mkDeck(){return shuffle(BIRDS.map(b=>({...b,uid:b.code+'_'+(_uid++)})));}
function isSurvivor(c){return /stays in play/i.test(c.power);}
function rotation(g){const o=[];for(let i=0;i<g.playerCount;i++)o.push(((g.firstPlayer-1+i)%g.playerCount)+1);return o;}
function nextActive(g){for(const p of rotation(g))if(!g.done.includes(p))return p;return null;}
function handSize(g){return g.playerCount===1?7:5;}
function r2req(g){return Math.min(g.r2count,g.hands[g.activePlayer].length+g.staged.length);}
function curStorm(g){return g.storms[g.stormIdx];}
function flockWins(g){return evalStorm(g.flock,curStorm(g));}

function selectStorms(enabled,n){let pool=STORMS.filter(s=>!enabled||enabled.includes(s.code));if(pool.length===0)pool=STORMS.slice();const k=(n&&n>0)?Math.min(n,pool.length):pool.length;return shuffle(pool).slice(0,k);}

function freshGame(playerCount,enabled,names,stormCount){
  const deck=mkDeck();const hands={1:[],2:[],3:[],4:[]};const hs=playerCount===1?7:5;
  for(let p=1;p<=playerCount;p++)for(let i=0;i<hs;i++)if(deck.length)hands[p].push(deck.shift());
  const g={playerCount,storms:selectStorms(enabled,stormCount),stormIdx:-1,phase:'',firstPlayer:1,activePlayer:1,
    done:[],r2count:1,deck,hands,flock:[],staged:[],frozen:{},pendingPass:{},fallen:[],names:names||{},pendingRetrieval:0,retrievable:[],lastDebrief:null,_dbid:0,
    piles:{birds:[],storms:[],solo:{1:[],2:[],3:[],4:[]}},lastOutcome:null,log:[]};
  return startStorm(g);
}
function log(g,m){g.log=[m,...g.log].slice(0,60);}

function startStorm(g){
  g.stormIdx++;
  if(g.stormIdx>=g.storms.length){g.phase='game_over';return g;}
  const anyCards=g.deck.length>0||Object.values(g.hands).some(hd=>hd.length>0);
  if(!anyCards){for(let i=g.stormIdx;i<g.storms.length;i++)g.piles.storms.push(g.storms[i]);g.stormIdx=g.storms.length;g.phase='game_over';return g;}
  const s=g.storms[g.stormIdx];
  g.firstPlayer=((g.stormIdx)%g.playerCount)+1;g.activePlayer=g.firstPlayer;g.done=[];g.staged=[];g.frozen={};g.pendingPass={};g.pendingRetrieval=0;g.retrievable=[];
  g.r2count=(g.playerCount===1)?1:((s.fx&&s.fx.r2count)||1);g.lastOutcome=null;
  const fx=s.fx||{};
  log(g,'⚡ '+s.name+' ('+s.origin+') — '+s.c1+' '+s.op+' '+s.c2);
  if(fx.pre==='freeze1'){g.phase='freeze';log(g,'Cold Front: each player freezes 1 card.');return settle(g);}
  if(fx.pre==='pass1'){g.phase='pass';log(g,'Wind Shear: each player passes 1 card.');return settle(g);}
  if(fx.pre==='squall_draw'&&g.deck.length){const c=g.deck.shift();
    if(c.code===s.code){g.fallen.push(c);log(g,'The Squall drew the AK Ptarmigan — storm lost!');return finishStorm(g,'storms');}
    c.source='STUD';g.flock.push(c);log(g,'The Squall drew '+c.species+' into the flock (stud card).');}
  g.phase='r1';return settle(g);
}

// auto-skip players who cannot act in the current phase
function settle(g){
  let safe=0;
  while(safe++<30){
    if(g.phase==='freeze'||g.phase==='pass'){
      const p=g.activePlayer;
      if(g.hands[p]&&g.hands[p].length===0){g.done.push(p);const nx=nextActive(g);if(nx===null)return endInput(g);g.activePlayer=nx;continue;}
      if(nextActive(g)===null)return endInput(g);
      break;
    } else if(g.phase==='r2'){
      if(r2req(g)===0){g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return endR2(g);g.activePlayer=nx;continue;}
      break;
    } else break;
  }
  return g;
}
function endInput(g){
  if(g.phase==='pass'){const order=rotation(g);for(let i=0;i<order.length;i++){const from=order[i],to=order[(i+1)%order.length];if(g.pendingPass[from])g.hands[to].push(g.pendingPass[from]);}g.pendingPass={};}
  g.done=[];g.activePlayer=g.firstPlayer;g.phase='r1';log(g,'Round 1 begins.');return settle(g);
}
function endR2(g){if(flockWins(g))return finishStorm(g,'birds');g.done=[];g.activePlayer=g.firstPlayer;g.phase='r3';log(g,'Round 3: optional — play 1 more or pass.');return g;}
function endR3(g){return finishStorm(g,flockWins(g)?'birds':'storms');}

// ---- input phases ----
function freezeSelect(g,uid){const hd=g.hands[g.activePlayer];const i=hd.findIndex(c=>c.uid===uid);if(i<0)return g;
  g.frozen[g.activePlayer]=hd.splice(i,1)[0];g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return endInput(g);g.activePlayer=nx;return settle(g);}
function passSelect(g,uid){const hd=g.hands[g.activePlayer];const i=hd.findIndex(c=>c.uid===uid);if(i<0)return g;
  g.pendingPass[g.activePlayer]=hd.splice(i,1)[0];g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return endInput(g);g.activePlayer=nx;return settle(g);}

// ---- staging ----
function stageCard(g,uid){const hd=g.hands[g.activePlayer];const i=hd.findIndex(c=>c.uid===uid);if(i<0)return g;g.staged.push(hd.splice(i,1)[0]);g.lastOutcome=null;return g;}
function unstageCard(g,uid){const i=g.staged.findIndex(c=>c.uid===uid);if(i<0)return g;g.hands[g.activePlayer].push(g.staged.splice(i,1)[0]);return g;}
function returnStaged(g){while(g.staged.length)g.hands[g.activePlayer].push(g.staged.pop());return g;}

// on-play DRAW powers (fired when a card is committed to the flock in r2/r3)
function fireDraw(g,card,wasFirst){
  const p=card.power||'';const pn=card.source&&card.source[0]==='P'?+card.source.slice(1):g.activePlayer;
  if(/played first/i.test(p)&&wasFirst){
    if(/your hand/i.test(p)){if(g.deck.length){g.hands[pn].push(g.deck.shift());log(g,card.species+' drew a card into Player '+pn+'\u2019s hand.');}}
    else if(g.deck.length){const d=g.deck.shift();d.source='STUD';g.flock.push(d);log(g,card.species+' drew '+d.species+' into the flock.');}
  } else if(/round 2/i.test(p)&&g.phase==='r2'&&g.deck.length){const d=g.deck.shift();d.source='STUD';g.flock.push(d);log(g,card.species+' drew '+d.species+' into the flock.');}
}
function isRetrieval(c){return c.et==='Modifier'&&/pick up one previously played/i.test(c.power||'');}
function commitStaged(g){const played=g.staged.slice();const wasFirst=g.flock.filter(c=>c.source&&c.source[0]==='P'&&!c.carried).length===0;g.staged.forEach(c=>{c.source='P'+g.activePlayer;g.flock.push(c);});g.staged=[];played.forEach(c=>{if(c.et==='Draw')fireDraw(g,c,wasFirst);});return played;}
// shared post-play resolution (used after a normal play AND after retrieval finishes)
function resolvePlay(g){if(flockWins(g))return finishStorm(g,'birds');g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return g.phase==='r2'?endR2(g):endR3(g);g.activePlayer=nx;return g.phase==='r2'?settle(g):g;}
// retrieval: pause for the active player to pick previously-played flock cards
function startRetrieval(g,played,priorUids){const n=played.filter(isRetrieval).length;const eligible=g.flock.filter(c=>priorUids.includes(c.uid));if(n>0&&eligible.length>0){g.pendingRetrieval=Math.min(n,eligible.length);g.retrievable=eligible.map(c=>c.uid);log(g,'Retrieval \u2014 Player '+g.activePlayer+' may pick up '+g.pendingRetrieval+' played card'+(g.pendingRetrieval>1?'s':'')+' from the flock.');return true;}return false;}
function retrieveCard(g,uid){if(!g.pendingRetrieval||!(g.retrievable||[]).includes(uid))return g;const i=g.flock.findIndex(c=>c.uid===uid);if(i<0)return g;const c=g.flock.splice(i,1)[0];delete c.source;delete c.carried;g.hands[g.activePlayer].push(c);g.retrievable=g.retrievable.filter(u=>u!==uid);g.pendingRetrieval--;log(g,c.species+' picked back up by Player '+g.activePlayer+'.');if(g.pendingRetrieval<=0||g.retrievable.length===0){g.pendingRetrieval=0;g.retrievable=[];return resolvePlay(g);}return g;}
function skipRetrieval(g){g.pendingRetrieval=0;g.retrievable=[];return resolvePlay(g);}

// ---- round 1 (solo) ----
function r1Resolve(g){
  const s=curStorm(g);const test=g.flock.concat(g.staged);const held=g.staged.some(c=>c.code===s.code);
  if(held||evalStorm(test,s)){
    const prior=g.flock.map(c=>c.uid);const wasFirst=g.flock.filter(c=>c.source&&c.source[0]==='P'&&!c.carried).length===0;
    const played=g.staged.slice();g.staged.forEach(c=>{c.source='P'+g.activePlayer;g.flock.push(c);});g.staged=[];
    played.forEach(c=>{if(c.et==='Draw')fireDraw(g,c,wasFirst);});
    if(g.playerCount===1&&startRetrieval(g,played,prior)){g.pendingRetrieval=0;g.retrievable=[];}
    log(g,'Player '+g.activePlayer+' beat '+s.name+' SOLO!');return finishStorm(g,'solo',g.activePlayer);}
  g.lastOutcome='solo_fail';return g;
}
function r1Pass(g){returnStaged(g);g.lastOutcome=null;g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return endRound1(g);g.activePlayer=nx;return g;}
function endRound1(g){
  const s=curStorm(g);const fx=s.fx||{};
  if(g.playerCount===1){log(g,'No solo win — storm lost.');return finishStorm(g,'storms');}
  if(fx.r1fail==='draw2_flock'){for(let i=0;i<2;i++)if(g.deck.length){const c=g.deck.shift();c.source='STUD';g.flock.push(c);}log(g,'The Surge: 2 cards drawn into the flock.');}
  if(fx.r1fail==='draw1_each'){for(const p of rotation(g))if(g.deck.length)g.hands[p].push(g.deck.shift());log(g,'Each player drew 1.');}
  if(fx.r1fail==='draw1_each_play2'){for(const p of rotation(g))if(g.deck.length)g.hands[p].push(g.deck.shift());g.r2count=2;log(g,'Fire Storm: draw 1 each, play 2 in round 2.');}
  g.done=[];g.activePlayer=g.firstPlayer;g.phase='r2';log(g,'Round 2: everyone plays '+g.r2count+'.');return settle(g);
}

// ---- round 2 (mandatory) — auto-resolves on submit ----
function r2Play(g){
  if(g.staged.length!==r2req(g)||r2req(g)===0)return g;
  const prior=g.flock.map(c=>c.uid);const played=commitStaged(g);
  if(startRetrieval(g,played,prior))return g;               // pause for retrieval pick
  return resolvePlay(g);
}
// ---- round 3 (optional) — auto-resolves on submit ----
function r3Play(g){
  if(g.staged.length!==1)return g;
  const prior=g.flock.map(c=>c.uid);const played=commitStaged(g);
  if(startRetrieval(g,played,prior))return g;
  return resolvePlay(g);
}
function r3Pass(g){returnStaged(g);g.done.push(g.activePlayer);const nx=nextActive(g);if(nx===null)return endR3(g);g.activePlayer=nx;return g;}

// ---- finish storm ----
function finishStorm(g,outcome,soloPid){
  const s=curStorm(g);const fx=s.fx||{};const won=(outcome==='birds'||outcome==='solo');
  if(outcome==='solo'){g.piles.solo[soloPid].push(s);g.piles.birds.push(s);}
  else if(outcome==='birds')g.piles.birds.push(s);else g.piles.storms.push(s);
  // build a detailed log entry of the resolution
  const contribArr=g.flock.filter(c=>c.source&&c.source[0]==='P').map(c=>c.code);
  const contributors=contribArr.join(', ');
  g.lastDebrief={code:s.code,name:s.name,origin:s.origin,outcome:outcome,soloPid:soloPid||null,
    contributors:contribArr,wins:g.piles.birds.length,losses:g.piles.storms.length,total:g.storms.length,
    id:(g._dbid||0)+1};
  g._dbid=g.lastDebrief.id;
  if(outcome==='solo')log(g,'✅ '+s.name+' — Player '+soloPid+' SOLO with '+(contributors||'their hand')+'.');
  else if(outcome==='birds')log(g,'✅ '+s.name+' — team win'+(contributors?' ('+contributors+')':'')+'.');
  else log(g,'❌ '+s.name+' — storm wins'+(contributors?' (flock: '+contributors+')':'')+'.');
  if(won){
    if(fx.onwin==='flock_to_hands'){g.flock.forEach(c=>{const p=(c.source&&c.source[0]==='P')?+c.source[1]:g.firstPlayer;delete c.source;delete c.carried;g.hands[p].push(c);});g.flock=[];log(g,'Ghost Storm: flock returned to hands.');}
    if(fx.onwin==='unfreeze'){for(const p of Object.keys(g.frozen)){if(g.frozen[p])g.hands[p].push(g.frozen[p]);}g.frozen={};log(g,'Frozen cards returned.');}
  } else {
    if(fx.onloss==='discard1_each'){for(const p of rotation(g)){const hd=g.hands[p];if(hd.length){hd.sort((a,b)=>a.rarity-b.rarity);g.fallen.push(hd.shift());}}log(g,'Hard Frost: each discarded 1.');}
    if(fx.onloss==='freeze_falls'){for(const p of Object.keys(g.frozen)){if(g.frozen[p])g.fallen.push(g.frozen[p]);}g.frozen={};log(g,'Frozen cards fell.');}
  }
  for(const p of Object.keys(g.frozen)){if(g.frozen[p])g.hands[p].push(g.frozen[p]);}g.frozen={};
  const carry=[],fall=[];g.flock.forEach(c=>{(isSurvivor(c)&&!c.carried?carry:fall).push(c);});
  fall.forEach(c=>{delete c.source;g.fallen.push(c);});carry.forEach(c=>{c.carried=true;delete c.source;});
  g.flock=carry;g.staged=[];g.lastOutcome=outcome+(soloPid?(':'+soloPid):'');
  for(const p of rotation(g)){while(g.hands[p].length<handSize(g)&&g.deck.length)g.hands[p].push(g.deck.shift());}
  return startStorm(g);
}
function gameResult(g){
  const beat=g.piles.birds.length;const total=g.storms.length;const solo={1:0,2:0,3:0,4:0};let hero=null,best=0;
  for(let p=1;p<=g.playerCount;p++){let vp=0;(g.hands[p]||[]).forEach(c=>{if(c.et==='Victory Points')vp+=/\+1/.test(c.power)?1:(/-1/.test(c.power)?-1:0);});solo[p]=g.piles.solo[p].length+vp;}
  const won=beat*2>total;
  if(won)for(let p=1;p<=g.playerCount;p++){if(solo[p]>best){best=solo[p];hero=p;}else if(solo[p]===best&&best>0)hero=null;}
  return {beat,total,won,tie:beat*2===total,need:Math.floor(total/2)+1,hero,solo};
}
