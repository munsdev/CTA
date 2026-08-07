// ═══ STORM WATCH RULES ENGINE (pure functions) ═══

const REGIONS = ['Pacific','Mountain','Great Plains','South Central','Midwest','Southeast','Appalachia','Mid-Atlantic','New England','Caribbean'];
const STYLES = ['Mobber','Sentinel','Evader','Defender'];
const MIGRATIONS = ['Resident','Migratory'];
// species that carry a Substitute2 pair power, mapped to the axis they flex
const SUB2 = { 'Cardinal':'region', 'Meadowlark':'migration', 'Mockingbird':'style' };

// Parse "2 Pacific", "3 NOT Midwest", "1 Cardinal"
function parseCond(str){
  str = (str||'').trim();
  if(!str) return null;
  const m = str.match(/^(\d+)\s+(.+)$/);
  if(!m) return null;
  let q = m[2].trim(), neg = false;
  if(/^NOT\s+/i.test(q)){ neg = true; q = q.replace(/^NOT\s+/i,'').trim(); }
  return { n: parseInt(m[1],10), q, neg };
}

// Which axis does a qualifier name belong to? (species check last)
function qualAxis(q){
  if(MIGRATIONS.includes(q)) return 'migration';
  if(REGIONS.includes(q)) return 'region';       // Mountain resolves to region
  if(STYLES.includes(q)) return 'style';
  return 'species';
}

// Does a single card naturally match a positive qualifier on a given axis?
function naturalMatch(card, q, axis){
  if(axis === 'species') return card.species === q;
  // wildcards
  if(card.et === 'Substitute+') return true;                 // any region/style/migration
  if(card.et === 'Substitute' && card.sub === axis) return true;
  // natural attribute on the matching axis OR a cross-axis two-fer (a Forest+Resident
  // bird satisfies both a Forest and a Resident requirement)
  return card.region === q || card.style === q || card.migration === q;
}

// Count flock contribution toward ONE parsed condition (with Count x2 + Substitute2 pairs)
function condScore(flock, cond){
  const { q, neg } = cond;
  const axis = qualAxis(q);
  let score = 0;
  if(neg){
    // "NOT X" — count cards whose value on X's axis is not X
    for(const c of flock){
      const mult = c.et === 'Count' ? 2 : 1;
      if(c[axis] !== q) score += mult;
    }
    return score;
  }
  // positive
  let pairable = 0;            // Substitute2 birds that DON'T already match naturally
  for(const c of flock){
    const mult = c.et === 'Count' ? 2 : 1;
    const nat = naturalMatch(c, q, axis);
    if(nat){ score += mult; continue; }
    // not a natural match — is it a pairable Substitute2 for this axis?
    if(c.et === 'Substitute2' && SUB2[c.species] === axis) pairable += 1;
  }
  score += Math.floor(pairable / 2);   // 2 of a paired species = +1 wild on their axis
  return score;
}

// Evaluate a full storm (c1 op c2) against a flock. Returns true if conditions met.
function evalStorm(flock, storm){
  const c1 = parseCond(storm.c1);
  const c2 = parseCond(storm.c2);
  const ok1 = c1 ? condScore(flock, c1) >= c1.n : true;
  const ok2 = c2 ? condScore(flock, c2) >= c2.n : true;
  if(!c2) return ok1;
  return storm.op === 'OR' ? (ok1 || ok2) : (ok1 && ok2);
}

// ── UI ANALYSIS: which conditions are met, and which cards speak to them ──
// Returns {bird, c1, c2, met, cards} where:
//   bird  = state-bird code present in the flock? (bool)
//   c1/c2 = {n, have, met, axis, label} per condition (null if absent)
//   met   = does the whole storm resolve?
//   cards = { [uid]: {bird:bool, c1:bool, c2:bool} }  which conditions each card speaks to
function stormAnalysis(flock, storm){
  const c1=parseCond(storm.c1), c2=parseCond(storm.c2);
  const info=c=>{ if(!c) return null; const have=condScore(flock,c); const axis=qualAxis(c.q);
    return {n:c.n, have, met:have>=c.n, axis, neg:c.neg, q:c.q,
      label:({region:'REGION',style:'ROLE',migration:'MIGRATION',species:'SPECIES'}[axis]||'CONDITION')}; };
  const i1=info(c1), i2=info(c2);
  const ok1=i1?i1.met:true, ok2=i2?i2.met:true;
  const met = !i2 ? ok1 : (storm.op==='OR' ? (ok1||ok2) : (ok1&&ok2));
  // does a single card speak to a given (positive or NOT) condition?
  const speaks=(card,cond)=>{ if(!cond) return false;
    const axis=qualAxis(cond.q);
    if(cond.neg) return card[axis]!==cond.q && axis!=='species';
    if(card.et==='Substitute+') return true;
    if(card.et==='Substitute' && card.sub===axis) return true;
    if(card.et==='Substitute2' && SUB2[card.species]===axis) return true;
    return naturalMatch(card, cond.q, axis); };
  const cards={};
  for(const c of flock){ cards[c.uid]={ bird:c.code===storm.code, c1:speaks(c,c1), c2:speaks(c,c2) }; }
  return { bird:flock.some(c=>c.code===storm.code), c1:i1, c2:i2, met, cards };
}

// Solo check for one player's hand (held state bird auto-wins)
function canSolo(hand, storm){
  if(hand.some(c => c.code === storm.code)) return { win:true, via:'state-bird' };
  if(evalStorm(hand, storm)) return { win:true, via:'conditions' };
  return { win:false };
}

if (typeof module !== 'undefined') module.exports = { parseCond, qualAxis, naturalMatch, condScore, evalStorm, canSolo, stormAnalysis, REGIONS, STYLES, MIGRATIONS, SUB2 };
