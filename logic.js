/* Pelland — logique pure (handicaps, analyse vocale, réponses). Aucun accès au DOM. */
(function (root) {
  'use strict';

  // ---------- Terrain de départ ----------
  const PINEGROVE = {
    id: 'pinegrove',
    name: 'Club de golf Pinegrove',
    city: 'Saint-Luc (Saint-Jean-sur-Richelieu), QC',
    source: 'Carte de pointage officielle 2026',
    holes: [
      [5, 13], [3, 9], [4, 5], [4, 3], [5, 15], [3, 17], [5, 11], [3, 7], [4, 1],
      [4, 8], [5, 14], [3, 4], [5, 16], [4, 10], [3, 18], [4, 12], [4, 6], [4, 2]
    ].map(([par, si]) => ({ par, si })),
    // Évaluation / slope hommes. parOverrides : le 18 est un par 5 des tertres IV et V.
    tees: [
      { name: 'Championnat', rating: 74.4, slope: 138 },
      { name: 'I', rating: 72.6, slope: 132 },
      { name: 'I-II', rating: 71.5, slope: 131 },
      { name: 'II', rating: 70.7, slope: 129 },
      { name: 'II-III', rating: 69.5, slope: 121 },
      { name: 'III', rating: 67.9, slope: 116 },
      { name: 'III-IV', rating: 66.1, slope: 115 },
      { name: 'IV', rating: 65.3, slope: 108, parOverrides: { 18: 5 } }
    ]
  };

  // ---------- Handicaps ----------
  function teePar(course, tee) {
    return course.holes.reduce((s, h, i) => s + holePar(course, tee, i + 1), 0);
  }
  function holePar(course, tee, hole) {
    const o = tee && tee.parOverrides && tee.parOverrides[hole];
    return o || course.holes[hole - 1].par;
  }
  // Handicap de parcours = index × slope / 113 + (évaluation − par), arrondi.
  function courseHandicap(index, tee, par) {
    return Math.round(Number(index) * tee.slope / 113 + (tee.rating - par));
  }
  // Coups reçus selon le mode : 'full' = handicap de parcours complet,
  // 'bas' = le plus bas joue à zéro, les autres reçoivent la différence.
  function allocateStrokes(courseHandicaps, mode) {
    if (mode === 'bas') {
      const min = Math.min(...courseHandicaps);
      return courseHandicaps.map(c => c - min);
    }
    return courseHandicaps.slice();
  }
  // Coups sur un trou donné selon son indice de difficulté (1 = plus difficile).
  function strokesOnHole(strokes, si) {
    if (strokes >= 0) return Math.floor(strokes / 18) + (si <= strokes % 18 ? 1 : 0);
    const g = -strokes; // handicap « plus » : on redonne des coups sur les trous faciles
    return -(Math.floor(g / 18) + ((19 - si) <= g % 18 ? 1 : 0));
  }

  // Équipes de 2 : le meilleur (plus bas index) joue avec le moins bon,
  // les deux du milieu ensemble. Égalité d'index : handicap de parcours, puis ordre d'inscription.
  function makeTeams(players) {
    const order = players.map((p, i) => i).sort((a, b) =>
      (Number(players[a].index) - Number(players[b].index)) ||
      ((players[a].courseHandicap || 0) - (players[b].courseHandicap || 0)) || (a - b));
    return [[order[0], order[3]], [order[1], order[2]]];
  }
  // Équipes : 0 = Rouges, 1 = Bleus.
  const TEAMS = ['Rouges', 'Bleus'];
  const tl = t => 'les ' + TEAMS[t];
  // « rouge », « bleu », « équipe 1 », « équipe 2 » → 0 ou 1 ; sinon null
  function teamFromText(n) {
    if (/\brouges?\b/.test(n)) return 0;
    if (/\bbleu(e|s|es)?\b/.test(n)) return 1;
    const m = n.match(/equipe\s+(1|un|une|2|deux)\b/);
    return m ? (/^(1|un|une)$/.test(m[1]) ? 0 : 1) : null;
  }
  // Les Rouges sont toujours l'équipe du meilleur joueur (plus bas index) ; dans chaque équipe, le meilleur est nommé en premier.
  function orderTeams(players, teams) {
    const key = i => Number(String(players[i].index).replace(',', '.'));
    const t = teams.map(x => x.slice().sort((a, b) => key(a) - key(b) || a - b));
    return Math.min(...t[0].map(key)) <= Math.min(...t[1].map(key)) ? t : [t[1], t[0]];
  }
  function getTeams(game) { return game.teams || makeTeams(game.players); }
  function teamName(game, t) { return getTeams(game)[t].map(i => game.players[i].name).join(' et '); }

  // ---------- Points de la game ----------
  // Sur chaque trou (4 scores entrés) :
  //  - le plus bas score net donne 2 points à l'équipe de ce joueur ;
  //  - le plus haut score net donne 2 points à l'équipe adverse.
  // Égalité entre joueurs d'équipes différentes : ces 2 points ne sont pas attribués.
  // Égalité entre deux joueurs de la même équipe : l'équipe reçoit (ou donne) les 2 points une seule fois.
  const POINTS = 2;
  function netScore(game, hole, pi) {
    const s = getScore(game, hole, pi); if (s == null) return null;
    return s - strokesOnHole(game.players[pi].strokes, game.course.holes[hole - 1].si);
  }
  // Pressé : points du trou × 2. Reroll : points du trou × 4. La skin est multipliée aussi (2 ou 4 points).
  function holeMultiplier(game, hole) {
    const e = (game.events || {})[hole] || {};
    if (e.reroll) return 4;
    if ((e.presses || []).length) return 2;
    return 1;
  }
  function holePoints(game, hole) {
    const T = getTeams(game);
    const teamOf = pi => T.findIndex(t => t.includes(pi));
    const nets = game.players.map((p, pi) => netScore(game, hole, pi));
    if (nets.some(n => n == null)) return null;
    const lo = Math.min(...nets), hi = Math.max(...nets);
    const loP = nets.map((n, i) => n === lo ? i : -1).filter(i => i >= 0);
    const hiP = nets.map((n, i) => n === hi ? i : -1).filter(i => i >= 0);
    const mult = holeMultiplier(game, hole);
    const pts = [0, 0];
    const loTeams = [...new Set(loP.map(teamOf))], hiTeams = [...new Set(hiP.map(teamOf))];
    const low = { players: loP, net: lo, team: loTeams.length === 1 ? loTeams[0] : null };
    const high = { players: hiP, net: hi, team: hiTeams.length === 1 ? hiTeams[0] : null };
    if (lo === hi) { low.team = null; high.team = null; }
    if (low.team != null) pts[low.team] += POINTS * mult;
    if (high.team != null) pts[1 - high.team] += POINTS * mult;
    return { pts, low, high, nets, mult };
  }
  // Skin : l'équipe qui a la skin gagne 1 point. skinTeam : 0 ou 1 = équipe, -1 = pas de skin, null = pas encore dit.
  const SKIN_POINTS = 1, BIRDIE_POINTS = 1;
  // Nombre d'oiselets (ou mieux, au brut) de chaque équipe sur le trou
  function birdiesByTeam(game, hole) {
    const T = getTeams(game), c = [0, 0];
    game.players.forEach((p, pi) => { const sc = getScore(game, hole, pi); if (sc != null && sc < holeInfo(game, hole, pi).par) { const t = T.findIndex(x => x.includes(pi)); if (t >= 0) c[t]++; } });
    return c;
  }
  function skinTeam(game, hole) {
    const e = (game.events || {})[hole];
    if (!e) return null;
    if (e.skinTeam !== undefined && e.skinTeam !== null) return e.skinTeam;
    if (Array.isArray(e.skins) && e.skins.length) return getTeams(game).findIndex(t => t.includes(e.skins[0]));
    return null;
  }
  // Cabane : l'équipe reçoit 12 points pour le trou (au lieu des points habituels et de la skin).
  const CABANE_POINTS = 12;
  function holeTotal(game, hole) {
    const r = holePoints(game, hole); const st = skinTeam(game, hole);
    if (!r && (st == null || st < 0)) return null;
    const cab = cabaneTeam(game, hole);
    if (cab != null) { const pts = [0, 0]; pts[cab] = CABANE_POINTS; return pts; }
    const pts = r ? r.pts.slice() : [0, 0];
    if (st === 0 || st === 1) pts[st] += SKIN_POINTS * holeMultiplier(game, hole);
    // Oiselet (au brut) : 1 point à l'équipe du joueur, multiplié par la press ou le reroll
    const bd = birdiesByTeam(game, hole); pts[0] += bd[0] * BIRDIE_POINTS * holeMultiplier(game, hole); pts[1] += bd[1] * BIRDIE_POINTS * holeMultiplier(game, hole);
    // Les points sont au net : seule la différence compte (Rouges 3, Bleus 2 → Rouges +1).
    const d = pts[0] - pts[1];
    return d >= 0 ? [d, 0] : [0, -d];
  }
  // Nombre de fois que le meneur change (une égalité entre deux ne compte pas comme un changement).
  function leadChanges(game) {
    const t = [0, 0]; let last = null, n = 0;
    for (let h = 1; h <= 18; h++) {
      const ht = holeTotal(game, h); if (!ht) continue;
      t[0] += ht[0]; t[1] += ht[1];
      // Revirement : l'équipe qui menait perd son avance, soit en revenant à égalité (à zéro), soit en passant derrière
      const lead = t[0] === t[1] ? null : (t[0] > t[1] ? 0 : 1);
      if (last != null && lead !== last) n++;
      last = lead;
    }
    return n;
  }
  function totalText(game) {
    const t = teamPoints(game).tot;
    return t[0] === t[1] ? 'Partie égale.' : `Les ${TEAMS[t[0] > t[1] ? 0 : 1]} mènent par ${Math.abs(t[0] - t[1])}.`;
  }
  function holeNetText(game, hole) {
    const ht = holeTotal(game, hole); if (!ht) return '';
    return ht[0] === ht[1] ? 'net : trou égal' : ht[0] > ht[1] ? `net : Rouges +${ht[0]}` : `net : Bleus +${ht[1]}`;
  }
  function teamPoints(game) {
    const tot = [0, 0], skins = [0, 0]; let holes = 0;
    for (let h = 1; h <= 18; h++) {
      const r = holePoints(game, h); if (r) holes++;
      const st = skinTeam(game, h); if (st === 0 || st === 1) skins[st]++;
      const ht = holeTotal(game, h); if (ht) { tot[0] += ht[0]; tot[1] += ht[1]; }
    }
    return { tot, holes, skins };
  }
  // Cabane : une équipe fait un oiselet brut (un de ses joueurs), a la skin
  // et obtient les points du plus mauvais score (le plus haut net est dans l'autre équipe).
  // Retourne l'équipe (0 ou 1) ou null. La valeur de la cabane reste à définir.
  function cabaneTeam(game, hole) {
    const st = skinTeam(game, hole); if (st !== 0 && st !== 1) return null;
    const r = holePoints(game, hole); if (!r || r.high.team == null || r.high.team === st) return null;
    const birdie = getTeams(game)[st].some(pi => { const sc = getScore(game, hole, pi); return sc != null && sc < holeInfo(game, hole, pi).par; });
    return birdie ? st : null;
  }
  function cabanes(game) {
    const c = [0, 0]; for (let h = 1; h <= 18; h++) { const t = cabaneTeam(game, h); if (t != null) c[t]++; } return c;
  }
  // Normales 3 : l'équipe qui a la skin ET dont un joueur fait la normale (score brut ≤ normale) gagne 5 $.
  // Sinon les 5 $ sont reportés et ajoutés à la prochaine normale 3.
  const PAR3_DOLLARS = 5;
  // Trous joués : 1-18, aller (1-9) ou retour (10-18)
  function holeRange(g) { return [g.firstHole || 1, g.lastHole || 18]; }
  function par3Results(game) {
    let pot = 0; const results = []; const money = [0, 0]; let blocked = false; let next = null;
    const [h0, h1] = holeRange(game);
    for (let h = h0; h <= h1; h++) {
      if (game.course.holes[h - 1].par !== 3) continue;
      const value = pot + (game.par3Value == null || game.par3Value === '' || isNaN(+game.par3Value) ? PAR3_DOLLARS : +game.par3Value);
      const row = (game.scores || {})[h];
      const complete = row && row.length === game.players.length && row.every(v => v != null);
      const st = skinTeam(game, h);
      if (blocked || !complete || st == null) { results.push({ hole: h, status: 'pending', value }); if (!blocked) { next = h; blocked = true; } continue; }
      const made = st >= 0 && getTeams(game)[st].some(pi => getScore(game, h, pi) <= holeInfo(game, h, pi).par);
      if (made) { results.push({ hole: h, status: 'won', team: st, amount: value }); money[st] += value; pot = 0; }
      else { results.push({ hole: h, status: 'carried', value }); pot = value; }
    }
    const nextValue = next ? results.find(x => x.hole === next).value : null;
    return { results, money, pot, next, nextValue };
  }
  function describePar3(game, hole) {
    if (game.course.holes[hole - 1].par !== 3) return '';
    const x = par3Results(game).results.find(r => r.hole === hole);
    if (!x || x.status === 'pending') return '';
    if (x.status === 'won') return `Normale 3 : ${tl(x.team)} gagnent ${x.amount} $.`;
    return `Normale 3 : personne ne gagne, ${x.value} $ reportés à la prochaine normale 3.`;
  }
  // Texte court pour la colonne « Calcul » de la carte.
  // Initiales uniques : « Francois Gaouette » → FG ; un seul prénom → 2 lettres (« Marc » → Ma).
  function initials(players) {
    const words = players.map(p => String(p.name || '').trim().split(/[\s-]+/).filter(Boolean));
    let out = words.map(w => w.length > 1 ? w.map(x => x[0].toUpperCase()).join('') : (w[0] || '?').slice(0, 2).replace(/^./, c => c.toUpperCase()));
    for (let n = 3; n <= 6; n++) {
      const dup = out.map((x, i) => out.indexOf(x) !== i || out.lastIndexOf(x) !== i);
      if (!dup.some(Boolean)) break;
      out = out.map((x, i) => dup[i] ? (words[i].length > 1 ? words[i][0].slice(0, n - 1).replace(/^./, c => c.toUpperCase()) + words[i].slice(1).map(w => w[0].toUpperCase()).join('') : words[i][0].slice(0, n).replace(/^./, c => c.toUpperCase())) : x);
    }
    return out;
  }
  function calcText(game, hole) {
    const r = holePoints(game, hole); if (!r) return '';
    const P = game.players, ini = initials(P), nm = a => a.map(i => ini[i]).join('+');
    const cab = cabaneTeam(game, hole);
    const st = skinTeam(game, hole);
    // Notation courte : ↓ plus bas net, ↑ plus haut net, R/B équipe qui reçoit, ×2 press, ×4 reroll, S skin, C cabane, = résultat net
    const RB = t => t === 0 ? 'R' : 'B';
    if (cab != null) return `C\u00a0${RB(cab)}${CABANE_POINTS}`;
    const v = POINTS * r.mult, parts = [];
    parts.push(r.low.team != null ? `↓${nm(r.low.players)} ${RB(r.low.team)}${v}` : '↓=');
    if (r.low.net !== r.high.net) parts.push(r.high.team != null ? `↑${nm(r.high.players)} ${RB(1 - r.high.team)}${v}` : '↑=');
    if (r.mult > 1) parts.push('×' + r.mult);
    if (st === 0 || st === 1) parts.push(r.mult > 1 ? `S ${RB(st)}${SKIN_POINTS * r.mult}` : `S ${RB(st)}`);
    const bd = birdiesByTeam(game, hole); [0, 1].forEach(t => { if (bd[t]) parts.push(`O ${RB(t)}${bd[t] * BIRDIE_POINTS * r.mult}`); });
    const ht = holeTotal(game, hole);
    if (ht) parts.push(ht[0] === ht[1] ? '= 0' : ht[0] > ht[1] ? `= R+${ht[0]}` : `= B+${ht[1]}`);
    return parts.map(x => x.replace(/ /g, '\u00a0')).join(' ');
  }
  function describeSkin(game, hole) {
    const st = skinTeam(game, hole);
    if ((st === 0 || st === 1) && cabaneTeam(game, hole) != null) return `Skin pour ${tl(st)} et cabane : ${CABANE_POINTS} points pour le trou.`;
    if (st === 0 || st === 1) { const n = SKIN_POINTS * holeMultiplier(game, hole); return `Skin pour ${tl(st)}, ${n} point${n > 1 ? 's' : ''}${n > 1 ? ' (multipliée)' : ''}.`; }
    if (st === -1) return 'Pas de skin.';
    return 'Skin pas encore indiquée.';
  }
  function describeHolePoints(game, hole) {
    const r = holePoints(game, hole); if (!r) return '';
    const P = game.players, names = a => a.map(i => P[i].name).join(' et ');
    const parts = [];
    const v = POINTS * r.mult;
    if (r.mult > 1) parts.push(r.mult === 4 ? 'Reroll, points fois 4' : 'Pressé, points fois 2');
    if (r.low.team != null) parts.push(`${names(r.low.players)} plus bas net ${r.low.net}, ${v} points pour ${tl(r.low.team)}`);
    else parts.push(`égalité au plus bas net ${r.low.net}, pas de points`);
    if (r.high.team != null) parts.push(`${names(r.high.players)} plus haut net ${r.high.net}, ${v} points pour ${tl(1 - r.high.team)}`);
    else if (r.low.net !== r.high.net) parts.push(`égalité au plus haut net, pas de points`);
    return parts.join(' ; ') + '.';
  }

  function buildPlayers(course, players, mode) {
    const chs = players.map(p => {
      const tee = course.tees.find(t => t.name === p.tee) || course.tees[0];
      return courseHandicap(p.index, tee, teePar(course, tee));
    });
    const strokes = allocateStrokes(chs, mode);
    return players.map((p, i) => ({ ...p, courseHandicap: chs[i], strokes: strokes[i] }));
  }

  // ---------- Calculs de la partie ----------
  function playerTee(game, pi) {
    return game.course.tees.find(t => t.name === game.players[pi].tee) || game.course.tees[0];
  }
  function holeInfo(game, hole, pi) {
    const h = game.course.holes[hole - 1];
    const par = holePar(game.course, pi == null ? null : playerTee(game, pi), hole);
    return { par, si: h.si };
  }
  function getScore(game, hole, pi) {
    const row = game.scores && game.scores[hole];
    const v = row ? row[pi] : null;
    return v == null ? null : v;
  }
  function totals(game, pi) {
    const p = game.players[pi];
    let gross = 0, net = 0, par = 0, played = 0;
    for (let hole = 1; hole <= 18; hole++) {
      const s = getScore(game, hole, pi);
      if (s == null) continue;
      const hi = holeInfo(game, hole, pi);
      const k = strokesOnHole(p.strokes, hi.si);
      gross += s; net += s - k; par += hi.par; played++;
    }
    const ev = game.events || {};
    let skins = 0, par3 = 0, presses = 0;
    Object.values(ev).forEach(e => {
      if (!e) return;
      if (e.par3Winner === pi) par3++;
      presses += (e.presses || []).filter(x => x === pi).length;
    });
    return { gross, net, par, played, toPar: gross - par, netToPar: net - par, skins, par3, presses };
  }

  // ---------- Texte → nombres ----------
  const NUM_WORDS = {
    zero: 0, un: 1, une: 1, premier: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
    huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
    dixsept: 17, dixhuit: 18, dixneuf: 19, vingt: 20,
    // confusions fréquentes de la dictée
    sang: 5, cent: 5, sain: 5, saint: 5, set: 7, cette: 7, huitre: 8, nef: 9, de: null, deu: 2, troi: 3, catre: 4
  };
  // termes relatifs au par
  const REL = { albatros: -3, aigle: -2, eagle: -2, birdie: -1, berdi: -1, oiselet: -1, par: 0, normale: 0,
    bogey: 1, bogie: 1, boguey: 1, double: 2, triple: 3, quadruple: 4 };

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/dix[\s-]+sept/g, 'dixsept').replace(/dix[\s-]+huit/g, 'dixhuit').replace(/dix[\s-]+neuf/g, 'dixneuf')
      .replace(/\bre[\s-]?roll?e?s?\b/g, 'reroll').replace(/\bri[\s-]?roll?\b/g, 'reroll')
      .replace(/\bpar[\s-]?(3|trois)\b/g, 'par3')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tokNum(t) {
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (t in NUM_WORDS) return NUM_WORDS[t];
    return null;
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // Trouve le joueur correspondant à un mot (prénom, tolérance aux erreurs de dictée).
  function matchPlayer(tok, names) {
    if (!tok || tok.length < 2 || tokNum(tok) != null || tok in REL) return -1;
    let best = -1, bestD = 99;
    names.forEach((n, i) => {
      const cands = norm(n).split(' ').filter(Boolean);
      cands.forEach(c => {
        let d = lev(tok, c);
        if (c.startsWith(tok) && tok.length >= 3) d = Math.min(d, 0.5);
        const tol = c.length <= 3 ? 0 : c.length <= 5 ? 1 : 2;
        if (d <= tol && d < bestD) { bestD = d; best = i; }
      });
    });
    return best;
  }

  const WAKE = ['pelland', 'pellan', 'pelan', 'pelant', 'pellande', 'peland', 'pelland', 'pel and', 'pelle and', 'paylan', 'pelin'];
  // Retourne le texte qui suit le mot d'éveil, ou null s'il est absent.
  function afterWake(text) {
    const t = norm(text);
    for (const w of WAKE) {
      const i = t.indexOf(w);
      if (i >= 0) return t.slice(i + w.length).trim();
    }
    // tolérance : un mot à distance 1 de « pelland »
    const words = t.split(' ');
    for (let i = 0; i < words.length; i++) if (words[i].length >= 5 && lev(words[i], 'pelland') <= 2 && words[i].startsWith('pe')) return words.slice(i + 1).join(' ');
    return null;
  }

  // ---------- Analyse d'une phrase ----------
  // Retourne { kind:'command', actions:[...] } ou { kind:'question', q:{...} } ou { kind:'unknown' }
  function parse(text, game, opts) {
    const isResp = !opts || opts.isResponsable !== false;
    const t = norm(text);
    const toks = t.split(' ').filter(Boolean);
    const names = game.players.map(p => p.name);
    const current = game.currentHole || 1;

    // numéro de trou mentionné
    let hole = null;
    for (let i = 0; i < toks.length - 1; i++) {
      if (/^(trou|trous|troupe|true|trouve)$/.test(toks[i])) {
        const n = tokNum(toks[i + 1]);
        if (n >= 1 && n <= 18) { hole = n; break; }
      }
      if (toks[i] === 'au' && /^\d+$/.test(toks[i + 1]) && +toks[i + 1] <= 18 && i > 0 && /coup/.test(toks[i - 1])) { hole = +toks[i + 1]; break; }
    }
    const hasQuestionWord = /^(qui|combien|quel|quelle|quels|ou|est ce|c est quoi|donne|dis|resultat|pointage|classement|score|qu)/.test(t) || /\b(qui|combien|ou en|classement|equipes?|points?)\b/.test(t);
    const mentioned = [];
    toks.forEach(tk => { const m = matchPlayer(tk, names); if (m >= 0 && !mentioned.includes(m)) mentioned.push(m); });

    const skinCmd = isResp && /skin/.test(t) && !/\b(qui|combien|quel|quelle|ou en)\b/.test(t);
    // ----- Questions -----
    if ((hasQuestionWord || !isResp) && !skinCmd) {
      let topic = 'leaderboard';
      if (/\bpoints?\b|la game|resultat|qui gagne|qui mene/.test(t)) topic = 'points';
      else if (/equipe|partenaire|avec qui|joue avec|team/.test(t)) topic = 'teams';
      else if (/coup/.test(t)) topic = 'strokes';
      else if (/changement|change de|chang/.test(t) && /mene|leader|tete/.test(t)) topic = 'leadchanges';
      else if (/cabane/.test(t)) topic = 'cabanes';
      else if (/skin/.test(t)) topic = 'skins';
      else if (/par3|normale 3|normale trois|dollar|argent|cagnotte|\bpot\b/.test(t)) topic = 'par3';
      else if (/press/.test(t)) topic = 'presses';
      else if (/reroll/.test(t)) topic = 'rerolls';
      else if (hole && /\b(par|handicap|difficile|info)\b/.test(t)) topic = 'hole';
      else if (mentioned.length) topic = 'player';
      if (!isResp || hasQuestionWord) return { kind: 'question', q: { topic, hole, players: mentioned } };
    }

    if (!isResp) return { kind: 'unknown' };

    // ----- Commandes du responsable -----
    const actions = [];
    if (/\b(annule|annuler|efface|oups|erreur)\b/.test(t)) return { kind: 'command', actions: [{ type: 'undo' }] };
    if (/\b(suivant|prochain)\b/.test(t) && !/[0-9]/.test(t.replace(/trou suivant/, ''))) actions.push({ type: 'goto', hole: Math.min(18, current + 1) });
    else if (/\b(precedent|retour)\b/.test(t)) actions.push({ type: 'goto', hole: Math.max(1, current - 1) });
    else if (hole && /\b(va|aller|on est|on s en va|passe|commence)\b/.test(t) && mentioned.length === 0) actions.push({ type: 'goto', hole });

    const h = hole || current;

    if (/\bpress/.test(t) && /\b(pas de|pas d|aucune?|sans|non|personne)\b/.test(t)) {
      actions.push({ type: 'nopress', hole: h }); return { kind: 'command', actions };
    }
    if (/\bpress/.test(t)) {
      const who = mentioned.length ? mentioned : [null];
      who.forEach(p => actions.push({ type: 'press', hole: h, player: p }));
      return { kind: 'command', actions };
    }
    if (/\breroll\b/.test(t)) { actions.push({ type: 'reroll', hole: h, on: !/\b(pas|enleve|retire)\b/.test(t) }); return { kind: 'command', actions }; }
    if (/par3|normale 3|normale trois|plus pres|dollar|argent|cagnotte|pot\b/.test(t)) return { kind: 'question', q: { topic: 'par3', hole, players: mentioned } };
    if (skinCmd) {
      // sans numéro de trou : le trou en cours s'il a des scores, sinon le trou qui vient de se terminer
      let sh = hole;
      if (!sh) { const np = nextPrompt(game); if (np && np.type === 'skin') sh = np.hole; }
      if (!sh) { const row = (game.scores || {})[current]; sh = row && row.some(v => v != null) ? current : Math.max(1, current - 1); }
      let team = null;
      const tt = teamFromText(t);
      if (/\b(pas de|pas d|aucune?|personne|non|sans)\b/.test(t)) team = -1;
      else if (tt != null) team = tt;
      let player = null;
      if (team == null && mentioned.length) { team = getTeams(game).findIndex(x => x.includes(mentioned[0])); player = mentioned[0]; }
      if (team == null) return { kind: 'unknown' };
      actions.push({ type: 'skin', hole: sh, team, player });
      return { kind: 'command', actions };
    }

    // scores : « Marc 5 Luc 4 » ou « Marc par Luc bogey »
    const scores = {};
    for (let i = 0; i < toks.length; i++) {
      const p = matchPlayer(toks[i], names);
      if (p < 0) continue;
      for (let j = i + 1; j < Math.min(toks.length, i + 4); j++) {
        if (matchPlayer(toks[j], names) >= 0) break;
        const n = tokNum(toks[j]);
        if (n != null && n >= 1 && n <= 15) { scores[p] = n; i = j; break; }
        if (toks[j] in REL) {
          let rel = REL[toks[j]];
          if (toks[j] === 'double' || toks[j] === 'triple') rel = REL[toks[j]];
          const par = holeInfo(game, h, p).par;
          scores[p] = par + rel; i = j; break;
        }
      }
    }
    if (Object.keys(scores).length) actions.push({ type: 'scores', hole: h, scores });

    if (actions.length) return { kind: 'command', actions };
    if (mentioned.length || hole) return { kind: 'question', q: { topic: mentioned.length ? 'player' : (/coup/.test(t) ? 'strokes' : 'hole'), hole, players: mentioned } };
    return { kind: 'unknown' };
  }

  // ---------- Réponses en français ----------
  function plural(n, s, p) { return `${n} ${Math.abs(n) > 1 ? (p || s + 's') : s}`; }
  function signed(n) { return n === 0 ? 'égal à la normale' : n > 0 ? `plus ${n}` : `moins ${-n}`; }

  function answer(q, game) {
    const cur = game.currentHole || 1;
    const P = game.players;
    const list = arr => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];

    switch (q.topic) {
      case 'points': {
        if (q.hole) {
          const d = describeHolePoints(game, q.hole);
          return d ? `Trou ${q.hole} : ${d} ${describeSkin(game, q.hole)}` : `Le trou ${q.hole} n'est pas complété.`;
        }
        const { tot, holes, skins } = teamPoints(game);
        if (!holes) return 'Aucun trou complété pour l\'instant.';
        const lead = tot[0] === tot[1] ? 'Égalité' : `Les ${TEAMS[tot[0] > tot[1] ? 0 : 1]} mènent par ${Math.abs(tot[0] - tot[1])}`;
        let s = `Après ${plural(holes, 'trou')} : Rouges, ${teamName(game, 0)}, ${plural(tot[0], 'point')} ; Bleus, ${teamName(game, 1)}, ${plural(tot[1], 'point')}${skins[0] || skins[1] ? `, skins comprises` : ''}. ${lead}.`;
        if (q.players.length === 1) { const t = getTeams(game).findIndex(x => x.includes(q.players[0])); s = `${P[q.players[0]].name} est chez ${tl(t)}. ` + s; }
        return s;
      }
      case 'teams': {
        const T = getTeams(game);
        if (q.players.length === 1) {
          const pi = q.players[0]; const t = T.findIndex(x => x.includes(pi)); const mate = T[t].find(x => x !== pi);
          return `${P[pi].name} joue avec ${P[mate].name}.`;
        }
        return `Rouges : ${teamName(game, 0)}. Bleus : ${teamName(game, 1)}.`;
      }
      case 'strokes': {
        if (q.players.length && !q.hole) {
          return q.players.map(pi => {
            const p = P[pi];
            if (p.strokes === 0) return `${p.name} ne reçoit aucun coup.`;
            const holes = [];
            for (let h = 1; h <= 18; h++) { const k = strokesOnHole(p.strokes, game.course.holes[h - 1].si); if (k) holes.push(k > 1 ? `${h} (${k})` : String(h)); }
            return `${p.name} reçoit ${plural(p.strokes, 'coup')}, aux trous ${list(holes)}.`;
          }).join(' ');
        }
        const h = q.hole || cur;
        const si = game.course.holes[h - 1].si;
        const who = P.map((p, i) => ({ p, k: strokesOnHole(p.strokes, si), i }))
          .filter(x => x.k !== 0 && (!q.players.length || q.players.includes(x.i)));
        if (!who.length) return `Au trou ${h}, handicap ${si}, personne ne reçoit de coup.`;
        return `Au trou ${h}, handicap ${si} : ` + who.map(x => `${x.p.name} ${x.k > 0 ? 'reçoit ' + plural(x.k, 'coup') : 'redonne ' + plural(-x.k, 'coup')}`).join(', ') + '.';
      }
      case 'leadchanges': {
        const n = leadChanges(game);
        return n === 0 ? 'Le meneur n\'a pas encore changé.' : `Le meneur a changé ${n} fois.`;
      }
      case 'cabanes': {
        const c = cabanes(game);
        if (!c[0] && !c[1]) return 'Aucune cabane pour l\'instant.';
        return `Cabanes : Rouges, ${c[0]} ; Bleus, ${c[1]}.`;
      }
      case 'skins': {
        const sk = teamPoints(game).skins;
        if (!sk[0] && !sk[1]) return 'Aucune skin pour l\'instant.';
        return `Skins : Rouges, ${plural(sk[0], 'skin')} ; Bleus, ${plural(sk[1], 'skin')}.`;
      }
      case 'par3': {
        const r = par3Results(game);
        const done = r.results.filter(x => x.status !== 'pending');
        let out = done.map(x => x.status === 'won' ? `au ${x.hole}, ${tl(x.team)} gagnent ${x.amount} $` : `au ${x.hole}, personne, reporté`).join(' ; ');
        out = out ? 'Normales 3 : ' + out + '. ' : 'Aucune normale 3 jouée pour l\'instant. ';
        out += `Argent : Rouges, ${r.money[0]} $ ; Bleus, ${r.money[1]} $.`;
        if (r.next) out += ` La prochaine normale 3, au ${r.next}, vaut ${r.nextValue} $.`;
        return out;
      }
      case 'presses': {
        const ev = game.events || {}; const out = [];
        for (let h = 1; h <= 18; h++) if (ev[h] && (ev[h].presses || []).length) out.push(`trou ${h}` + (ev[h].presses.filter(x => x != null).length ? ' par ' + list(ev[h].presses.filter(x => x != null).map(x => P[x].name)) : ''));
        return out.length ? 'Trous pressés : ' + out.join(' ; ') + '.' : 'Aucun trou pressé.';
      }
      case 'rerolls': {
        const ev = game.events || {}; const out = [];
        for (let h = 1; h <= 18; h++) if (ev[h] && ev[h].reroll) out.push(h);
        return out.length ? `Reroll aux trous ${list(out.map(String))}.` : 'Aucun reroll.';
      }
      case 'hole': {
        const h = q.hole || cur; const hi = holeInfo(game, h, 0);
        return `Trou ${h} : normale ${hi.par}, handicap ${hi.si}. ` + answer({ topic: 'strokes', hole: h, players: [] }, game);
      }
      case 'player': {
        return q.players.map(pi => {
          const t = totals(game, pi); const p = P[pi];
          if (!t.played) return `${p.name} n'a pas encore de score.`;
          let s = `${p.name}, après ${plural(t.played, 'trou')} : ${t.gross} brut, ${signed(t.toPar)} ; ${t.net} net, ${signed(t.netToPar)}.`;
          if (t.par3) s += ` ${plural(t.par3, 'par 3 gagné', 'par 3 gagnés')}.`;
          return s;
        }).join(' ');
      }
      default: {
        const rows = P.map((p, i) => ({ p, t: totals(game, i) })).filter(x => x.t.played);
        if (!rows.length) return 'Aucun score inscrit pour l\'instant.';
        rows.sort((a, b) => a.t.netToPar - b.t.netToPar);
        return 'Classement net : ' + rows.map(x => `${x.p.name} ${x.t.net} (${signed(x.t.netToPar)})`).join(', ') + '.';
      }
    }
  }

  // Applique des actions à une partie (copie) ; retourne { game, say }
  function apply(game, actions) {
    const g = JSON.parse(JSON.stringify(game));
    g.scores = g.scores || {}; g.events = g.events || {};
    const say = [];
    const ev = h => (g.events[h] = g.events[h] || { presses: [], skins: [], skinTeam: null, reroll: false, par3Winner: null });
    actions.forEach(a => {
      if (a.type === 'wolf') { ev(a.hole).wolf = a.wolf; }
      if (a.type === 'goto') { g.currentHole = a.hole; say.push(`Trou ${a.hole}, normale ${holeInfo(g, a.hole, 0).par}.`); }
      if (a.type === 'scores') {
        const row = g.scores[a.hole] = (g.scores[a.hole] || g.players.map(() => null)).slice(0, g.players.length);
        while (row.length < g.players.length) row.push(null);
        const parts = [];
        Object.entries(a.scores).forEach(([pi, v]) => { row[pi] = v; parts.push(`${g.players[pi].name} ${v}`); });
        say.push(`Trou ${a.hole} : ${parts.join(', ')}.`);
        if (row.every(v => v != null) && g.players.length === 4) {
          const d = describeHolePoints(g, a.hole); if (d) say.push(d);
          say.push(totalText(g));
        }
        if (row.every(v => v != null) && a.hole === (g.currentHole || 1) && a.hole < (g.lastHole || 18)) { g.currentHole = a.hole + 1; say.push(`On passe au ${a.hole + 1}.`); }
      }
      if (a.type === 'nopress') { const e = ev(a.hole); e.presses = []; e.noPress = true; e.reroll = false; e.rerollSet = true; say.push(`Pas de press au ${a.hole}.`); }
      if (a.type === 'unpress') { const e = ev(a.hole); e.presses = []; e.pressTeam = null; e.noPress = false; e.reroll = false; e.rerollSet = false; say.push(`Press retirée au ${a.hole}.`); }
      if (a.type === 'press') {
        const tt = trailingTeam(g, a.hole);
        const team = a.player != null ? getTeams(g).findIndex(x => x.includes(a.player)) : (a.team != null ? a.team : tt);
        // Correction après coup (scores déjà entrés) : on accepte la press telle qu'elle a été jouée
        const fix = ((g.scores || {})[a.hole] || []).some(v => v != null);
        if (!fix && tt == null) { say.push('Égalité : personne ne peut presser.'); return; }
        if (!fix && team !== tt) { say.push(`Seuls ${tl(tt)} peuvent presser, ils sont en déficit.`); return; }
        if ((ev(a.hole).presses || []).length) { say.push(`Le ${a.hole} est déjà pressé.`); return; }
        ev(a.hole).pressTeam = team != null && team >= 0 ? team : tt;
      }
      if (a.type === 'press') { ev(a.hole).noPress = false; ev(a.hole).presses.push(a.player); say.push(`${a.player != null ? g.players[a.player].name + ' presse' : (ev(a.hole).pressTeam != null ? 'Les ' + TEAMS[ev(a.hole).pressTeam] + ' pressent' : 'Press')} au ${a.hole}. Points fois 2.`); }
      if (a.type === 'reroll' && a.on && !(ev(a.hole).presses || []).length) { say.push('Il faut une press avant un reroll.'); return; }
      if (a.type === 'reroll') { ev(a.hole).reroll = a.on; ev(a.hole).rerollSet = true; say.push(a.on ? `Reroll au ${a.hole}. Points fois 4.` : `Pas de reroll au ${a.hole}.`); }
      if (a.type === 'par3') {
        if (holeInfo(g, a.hole, 0).par !== 3) { say.push(`Attention, le trou ${a.hole} n'est pas un par 3.`); return; }
        ev(a.hole).par3Winner = a.player; say.push(a.player == null ? `Personne au par 3 du ${a.hole}.` : `${g.players[a.player].name} gagne le par 3 du ${a.hole}.`);
      }
      if (a.type === 'skin') {
        const e = ev(a.hole); e.skinTeam = a.team; e.skins = []; e.skinPlayer = a.player != null ? a.player : null;
        say.push(a.team === -1 ? `Pas de skin au trou ${a.hole}.` : a.player != null ? `Skin au trou ${a.hole} pour ${g.players[a.player].name}, ${tl(a.team)}. 1 point.` : `Skin au trou ${a.hole} pour ${tl(a.team)}, ${teamName(g, a.team)}. 1 point.`);
        { const p3 = describePar3(g, a.hole); if (p3) say.push(p3); }
        if (cabaneTeam(g, a.hole) != null) say.push(`Cabane pour ${tl(a.team)} ! ${CABANE_POINTS} points pour le trou.`);
        { const nt = holeNetText(g, a.hole); if (nt) say.push(`Trou ${a.hole}, ${nt}.`); }
        say.push(totalText(g));
      }
      if (a.type === 'skins') { ev(a.hole).skins = a.players; say.push(a.players.length ? `Skin au trou ${a.hole} : ${a.players.map(i => g.players[i].name).join(', ')}.` : `Pas de skin au trou ${a.hole}.`); }
    });
    return { game: g, say: say.join(' ') };
  }


  // ---------- Configuration de la partie à la voix ----------
  // Comprend par exemple :
  //  « François 12,4, Marc 8,1, Luc 18,6 et Pierre 3,2 »
  //  « Joueur 3 Luc index 18 virgule 6 » · « Les joueurs sont François, Marc, Luc et Pierre »
  //  « François est responsable » · « Responsable Marc »
  //  « Tout le monde au tertre deux » · « Luc au tertre deux trois »
  //  « Bas handicap » · « Full handicap » · « Créer la partie »
  const SETUP_STOP = new Set(['index', 'joueur', 'joueurs', 'et', 'avec', 'a', 'est', 'le', 'la', 'les', 'de', 'du', 'puis', 'ensuite', 'alors', 'sont',
    'numero', 'pour', 'au', 'aux', 'qui', 'son', 'sa', 'ses', 'un', 'une', 'des', 'il', 'elle', 'on', 'joue', 'jouent', 'handicap', 'tertre', 'tertres',
    'responsable', 'partie', 'game', 'pelland', 'virgule', 'point', 'plus', 'moins', 'c', 'cest', 'ok', 'oui', 'non', 'ca', 'fait', 'et puis', 'premier', 'deuxieme', 'troisieme', 'quatrieme']);
  const ORD = { premier: 1, un: 1, deux: 2, deuxieme: 2, second: 2, trois: 3, troisieme: 3, quatre: 4, quatrieme: 4 };
  function plainWord(w) { return String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, ''); }
  function wordsToDigits(text) {
    // « douze virgule quatre » → « 12 virgule 4 » ; « dix-huit » → 18
    return String(text).replace(/[A-Za-zÀ-ÿ]+(?:[-\s](?:sept|huit|neuf))?/g, w => {
      const k = plainWord(w).replace(/[-\s]/g, '');
      if (['dixsept', 'dixhuit', 'dixneuf'].includes(k)) return String(NUM_WORDS[k]);
      const one = plainWord(w);
      const map = { zero: 0, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
        quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40 };
      return one in map ? String(map[one]) : w;
    });
  }
  function teeFromWords(words, course) {
    const roman = ['', 'I', 'II', 'III', 'IV', 'V'];
    const parts = [];
    for (const w of words) {
      const p = plainWord(w);
      if (/^championnat|^champion|^noir|^or$/.test(p)) return course.tees.find(t => /champ/i.test(t.name)) || null;
      const n = /^\d$/.test(p) ? +p : ({ un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 })[p];
      if (n >= 1 && n <= 5) parts.push(roman[n]); else if (/^(i|ii|iii|iv|v)$/i.test(w)) parts.push(w.toUpperCase()); else if (parts.length) break;
      if (parts.length === 2) break;
    }
    if (!parts.length) return null;
    const want = parts.join('-');
    return course.tees.find(t => t.name.toUpperCase() === want) || course.tees.find(t => t.name.toUpperCase() === parts[0]) || null;
  }
  function capName(n) { return n.split(/([\s-])/).map(x => x.length > 1 ? x[0].toUpperCase() + x.slice(1) : x).join(''); }

  // Retrouve le nom complet dans la bibliothèque de joueurs (« Gaouette » → « François Gaouette »).
  function resolveName(name, library) {
    if (!library || !library.length) return name;
    const n = norm(name), words = n.split(' ');
    const lib = library.map(x => ({ name: x, n: norm(x) }));
    const exact = lib.find(x => x.n === n); if (exact) return exact.name;
    const hits = lib.filter(x => {
      const lw = x.n.split(' ');
      return words.every(w => lw.some(v => v === w || (w.length >= 4 && lev(v, w) <= 1)));
    });
    return hits.length === 1 ? hits[0].name : name;
  }
  function parseSetup(text, draft, course, library) {
    const d = JSON.parse(JSON.stringify(draft));
    const said = [];
    let t = wordsToDigits(text)
      .replace(/(\d)\s*(?:,|\.|virgule|point)\s*(\d)/gi, '$1.$2')
      .replace(/\bplus\s+(\d+(?:\.\d)?)/gi, '-$1');
    const low = plainWord(t) === '' ? '' : t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const findPlayer = name => {
      const n = norm(name), words = n.split(' ');
      const names = d.players.map(p => norm(p.name || ''));
      const exact = names.indexOf(n); if (exact >= 0) return exact;
      // prénom + nom : n'écrase un joueur existant que si celui-ci n'avait que ce prénom (« François » → « François Gaouette »)
      if (words.length > 1) return names.findIndex(x => x && x.split(' ').length === 1 && x === words[0]);
      // un seul mot : prénom ou nom de famille d'un joueur déjà inscrit
      const hits = names.map((x, i) => x && x.split(' ').some(w => w === n || (n.length >= 4 && lev(w, n) <= 1)) ? i : -1).filter(i => i >= 0);
      return hits.length === 1 ? hits[0] : (hits.length ? -2 : matchPlayer(n, d.players.map(p => p.name || '§')));
    };

    // Créer la partie
    const create = /\b(cree|creer|creez|cre|lance|lancer|demarre|demarrer|commence|commencer|c est parti|go)\b.*\b(partie|carte|game)?/.test(low) && /\b(partie|carte|game|c est parti|go)\b/.test(low) && !/\d/.test(low);
    // Mode
    if (/\bbas\s+handicap|\bhandicap\s+bas|\bbas\s+hcp/.test(low)) { d.mode = 'bas'; said.push('Bas handicap.'); }
    if (/\b(full|plein|complet)\b.*handicap|handicap\s+(complet|full|plein)/.test(low)) { d.mode = 'full'; said.push('Full handicap.'); }

    // Joueurs avec numéro explicite : « joueur 3 Luc 18.6 »
    const toks = t.replace(/[,;:!?]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    const isNum = w => /^-?\d+(\.\d+)?$/.test(w);
    const isStop = w => SETUP_STOP.has(plainWord(w)) || plainWord(w).length < 2;
    let slot = null;
    const consumed = new Set();
    // Responsable
    let respName = null;
    let m = low.match(/responsable\s+(?:c\s*est\s+|est\s+|sera\s+|:)?([a-z-]+)/);
    if (m && !SETUP_STOP.has(m[1])) respName = m[1];
    m = low.match(/([a-z-]+)\s+(?:est|sera|c est)\s+(?:le\s+|la\s+)?responsable/);
    if (m && !SETUP_STOP.has(m[1])) respName = m[1];
    if (respName) toks.forEach((w, i) => { if (plainWord(w) === respName) consumed.add(i); });

    // Tertres : « tout le monde au tertre deux », « Luc au tertre deux trois », « tertre deux pour Luc »
    const teeAssign = [];
    toks.forEach((w, i) => {
      if (!/^tertres?$/i.test(plainWord(w))) return;
      const tee = teeFromWords(toks.slice(i + 1, i + 4), course);
      if (!tee) return;
      for (let k = i + 1; k < Math.min(toks.length, i + 4); k++) { const p = plainWord(toks[k]); if (/^\d$|^(un|deux|trois|quatre|cinq|i|ii|iii|iv|v|championnat)$/.test(p)) consumed.add(k); else break; }
      const before = toks.slice(Math.max(0, i - 6), i).map(plainWord);
      const after = toks.slice(i + 1, i + 7).map(plainWord);
      if (before.some(x => /^(tous|tout|toutes|monde|chacun)$/.test(x)) || after.some(x => /^(tous|monde)$/.test(x))) { teeAssign.push({ all: true, tee }); return; }
      const pi = after.indexOf('pour');
      let nameTok = pi >= 0 ? toks[i + 1 + pi + 1] : null;
      if (!nameTok) for (let k = i - 1; k >= Math.max(0, i - 3); k--) if (!isStop(toks[k]) && !isNum(toks[k])) { nameTok = toks[k]; consumed.add(k); break; }
      if (nameTok) teeAssign.push({ name: nameTok, tee });
    });

    // Noms + index
    const found = [];
    for (let i = 0; i < toks.length; i++) {
      if (consumed.has(i)) continue;
      const w = toks[i];
      if (/^joueur$/i.test(plainWord(w)) && toks[i + 1]) {
        const n = isNum(toks[i + 1]) ? +toks[i + 1] : ORD[plainWord(toks[i + 1])];
        if (n >= 1 && n <= 4) { slot = n - 1; i++; continue; }
      }
      if (isNum(w)) {
        // nom = 1 ou 2 mots juste avant (en sautant « index », « a », etc.)
        let k = i - 1; while (k >= 0 && isStop(toks[k]) && !consumed.has(k) && i - k <= 3) k--;
        if (k < 0 || isNum(toks[k]) || consumed.has(k) || isStop(toks[k])) continue;
        let name = toks[k];
        if (k - 1 >= 0 && !isStop(toks[k - 1]) && !isNum(toks[k - 1]) && !consumed.has(k - 1) && /^[A-ZÀ-Ý]/.test(toks[k - 1]) && /^[A-ZÀ-Ý]/.test(toks[k]) && !found.some(f => f.k === k - 1)) name = toks[k - 1] + ' ' + toks[k];
        const val = parseFloat(w);
        if (val < -10 || val > 54) continue;
        found.push({ name: capName(name.replace(/[.]/g, '')), index: val, slot, k });
        slot = null;
      }
    }
    // Liste de noms sans index : « les joueurs sont François, Marc, Luc et Pierre »
    if (!found.length) {
      const lm = text.match(/joueurs?\s*(?:sont|:|c'est|ce sont)?\s+(.+)/i);
      if (lm && !/\d/.test(lm[1])) {
        lm[1].split(/,|\bet\b/i).map(x => x.trim()).filter(x => x && !isStop(x)).slice(0, 4).forEach((n, i) => found.push({ name: capName(n), index: null, slot: i }));
      }
    }

    // Application
    const done = [];
    found.forEach(f => {
      f.name = resolveName(f.name, library);
      let i = f.slot != null ? f.slot : findPlayer(f.name);
      if (i === -2) { said.push(`Deux joueurs s'appellent ${f.name}. Dites le prénom et le nom.`); return; }
      if (i < 0) i = d.players.findIndex(p => !String(p.name || '').trim());
      if (i < 0) return;
      const dupAt = d.players.findIndex((p, j) => j !== i && norm(p.name || '') === norm(f.name));
      if (dupAt >= 0) { said.push(`${f.name} est déjà choisi comme joueur ${dupAt + 1}.`); return; }
      if (f.index == null && norm(d.players[i].name || '') !== norm(f.name)) d.players[i].index = '';
      d.players[i].name = f.name;
      if (f.index != null) d.players[i].index = String(f.index).replace('.', ',');
      done.push(f.index != null ? `${f.name} ${String(f.index).replace('.', ',')}` : f.name);
    });
    if (done.length) said.unshift(done.join(', ') + '.');
    teeAssign.forEach(a => {
      if (a.all) { d.players.forEach(p => (p.tee = a.tee.name)); said.push(`Tout le monde au tertre ${a.tee.name}.`); return; }
      const i = findPlayer(a.name);
      if (i >= 0) { d.players[i].tee = a.tee.name; said.push(`${d.players[i].name} au tertre ${a.tee.name}.`); }
    });
    if (respName) {
      const i = findPlayer(respName);
      if (i >= 0) { d.responsable = i; said.push(`${d.players[i].name} est responsable.`); }
      else said.push(`Je ne trouve pas ${capName(respName)} parmi les joueurs.`);
    }
    const missing = [];
    d.players.forEach((p, i) => {
      if (!String(p.name || '').trim()) missing.push(`le joueur ${i + 1}`);
      else if (p.index === '' || p.index == null) missing.push(`l'index de ${p.name}`);
    });
    // Équipes : « oui » / « le meilleur avec le moins bon » → automatique ; « François avec Marc » → choisies
    const plain = norm(text);
    const names = d.players.map(p => p.name || '§');
    let teamMsg = null;
    let pm = plain.match(/([a-z-]+)\s+(?:joue\s+|jouera\s+|va\s+)?avec\s+([a-z-]+)/) || plain.match(/([a-z-]+)\s+et\s+([a-z-]+)\s+ensemble/) || plain.match(/equipe\s+([a-z-]+)\s+(?:et\s+)?([a-z-]+)/);
    if (pm && !/meilleur|moins bon/.test(plain)) {
      const a = matchPlayer(pm[1], names), b = matchPlayer(pm[2], names);
      if (a >= 0 && b >= 0 && a !== b) {
        const others = [0, 1, 2, 3].filter(i => i !== a && i !== b);
        d.teamMode = 'manual'; d.teams = [[a, b], others];
        const ok = d.players.every(p => p.index !== '' && p.index != null);
        const T = ok ? orderTeams(d.players, d.teams) : d.teams;
        teamMsg = `Rouges : ${d.players[T[0][0]].name} et ${d.players[T[0][1]].name}. Bleus : ${d.players[T[1][0]].name} et ${d.players[T[1][1]].name}.`;
      }
    } else if (/meilleur.*(moins bon|pire|plus haut)|(moins bon|pire).*meilleur|automatique/.test(plain) ||
               (d.teamMode == null && /^(oui|ok|exact|correct|parfait|c est ca|d accord|oui c est ca)$/.test(plain))) {
      d.teamMode = 'auto'; teamMsg = 'Équipes : le meilleur avec le moins bon.';
    } else if (d.teamMode == null && /^(non|pas vraiment|non merci)$/.test(plain)) {
      teamMsg = 'D\'accord. Dites qui joue avec qui, par exemple « François avec Marc ».';
    }
    if (teamMsg) said.push(teamMsg);
    return { draft: d, said: said.join(' '), missing, create: create && !said.length, understood: said.length > 0 };
  }

  // Prochaine question à poser au responsable : skin du trou terminé, press au trou en cours, puis reroll.
  // Seule l'équipe en déficit (points avant ce trou) peut presser ; l'autre peut alors faire un reroll.
  function trailingTeam(game, hole) {
    const t = [0, 0];
    for (let x = 1; x < hole; x++) { const ht = holeTotal(game, x); if (ht) { t[0] += ht[0]; t[1] += ht[1]; } }
    return t[0] === t[1] ? null : (t[0] < t[1] ? 0 : 1);
  }
  function pressTeamOf(game, hole) {
    const e = (game.events || {})[hole] || {};
    if (!(e.presses || []).length) return null;
    return e.pressTeam != null ? e.pressTeam : trailingTeam(game, hole);
  }
  function nextPrompt(game) {
    const h = game.currentHole || 1;
    const complete = x => { const r = (game.scores || {})[x]; return r && r.length === game.players.length && r.every(v => v != null); };
    for (const x of [h - 1, h]) if (x >= 1 && complete(x) && skinTeam(game, x) == null) return { type: 'skin', hole: x, text: `Skin ou pas de skin au ${x} ?` };
    if (complete(h)) return null;
    const e = (game.events || {})[h] || {};
    const started = ((game.scores || {})[h] || []).some(v => v != null);
    const pressed = (e.presses || []).length > 0;
    const tt = trailingTeam(game, h);
    if (!pressed && !e.noPress && !started && tt != null) return { type: 'press', hole: h, team: tt, text: `Les ${TEAMS[tt]}, press au ${h} ?` };
    if (pressed && !e.rerollSet && !started) { const pt = pressTeamOf(game, h); return { type: 'reroll', hole: h, team: pt == null ? null : 1 - pt, text: pt == null ? 'Reroll ?' : `Les ${TEAMS[1 - pt]}, reroll ?` }; }
    return null;
  }

  // ---------------- Lecture d'une carte de pointage (texte OCR ou PDF) ----------------
  // Renvoie { name, holes:[{par,si}]|null, pars:[18]|null, sis:[18]|null, tees:[{name,rating,slope}] }
  function parseCardText(text) {
    const fix = l => l.replace(/[|\[\]{}()!«»"“”‘’_~=+*#<>—–]/g, ' ').replace(/(?<=\d)[oO](?=\d|\b)/g, '0').replace(/\b[lI](?=\d)/g, '1');
    const lines = String(text || '').split(/\r?\n/).map(l => fix(l).trim()).filter(Boolean);
    const ints = l => (l.match(/\d+(?:[.,]\d+)?/g) || []).filter(x => !/[.,]/.test(x)).map(Number);
    const isPerm = (a, n) => a.length === n && new Set(a).size === n && a.every(x => x >= 1 && x <= 18);
    const parRe = /\b(par|normale?s?|norm\.?)\b/i, siRe = /(handicap|hcp|hdcp|hdc|hand\.?|index|difficult|stroke|\bs\.?i\.?\b)/i;
    // --- normales : on garde les 3 à 6, on retire les totaux
    const parRuns = [];
    lines.forEach(l => { if (!parRe.test(l)) return; const v = ints(l).filter(x => x >= 3 && x <= 6); if (v.length >= 18) parRuns.push(v.slice(0, 18)); else if (v.length >= 9) parRuns.push(v.slice(0, 9)); });
    if (!parRuns.length) lines.forEach(l => { const all = ints(l); const v = all.filter(x => x >= 3 && x <= 6); if (v.length >= 9 && v.length >= all.length - 3 && !/\d{3}/.test(l)) parRuns.push(v.length >= 18 ? v.slice(0, 18) : v.slice(0, 9)); });
    let pars = null;
    const p18 = parRuns.find(r => r.length === 18); if (p18) pars = p18;
    else { const nine = parRuns.filter(r => r.length === 9); if (nine.length >= 2) pars = nine[0].concat(nine[1]); }
    // --- handicaps : chaque nombre de 1 à 18 une seule fois
    const siRuns = [];
    const take = l => { const v = ints(l).filter(x => x >= 1 && x <= 18); return v; };
    lines.forEach(l => { if (!siRe.test(l)) return; const v = take(l); if (v.length >= 18 && isPerm(v.slice(0, 18), 18)) siRuns.push(v.slice(0, 18)); else if (v.length >= 9 && new Set(v.slice(0, 9)).size === 9) siRuns.push(v.slice(0, 9)); });
    if (!siRuns.length) lines.forEach(l => { const all = ints(l); const v = all.filter(x => x >= 1 && x <= 18); if (v.length >= 9 && v.length === all.length && !(parRe.test(l))) { if (v.length >= 18 && isPerm(v.slice(0, 18), 18)) siRuns.push(v.slice(0, 18)); else if (new Set(v.slice(0, 9)).size === 9 && v.slice(0, 9).some(x => x > 9)) siRuns.push(v.slice(0, 9)); } });
    let sis = siRuns.find(r => r.length === 18) || null;
    if (!sis) { const nine = siRuns.filter(r => r.length === 9);
      outer: for (let i = 0; i < nine.length; i++) for (let j = i + 1; j < nine.length; j++) { const c = nine[i].concat(nine[j]); if (isPerm(c, 18)) { sis = c; break outer; } } }
    // --- tertres : « Blanc 70,7 / 129 », « Bleu 71.5 129 », « II … 70,7 … 129 »
    const tees = [], seen = new Set();
    lines.forEach(l => {
      const m = l.match(/(\d{2}[.,]\d)\s*(?:\/|-|\s)\s*(\d{2,3})\b/); if (!m) return;
      const rating = parseFloat(m[1].replace(',', '.')), slope = parseInt(m[2], 10);
      if (!(rating > 55 && rating < 82) || !(slope >= 55 && slope <= 155)) return;
      let name = l.slice(0, m.index).replace(/(évaluation|evaluation|rating|slope|course|parcours|hommes?|men|femmes?|women|ladies|[:\/\-–])/gi, ' ').replace(/\s+/g, ' ').trim();
      name = name.replace(/^[^A-Za-zÀ-ÿ0-9]+/, '').replace(/[^A-Za-zÀ-ÿ0-9]+$/, '');
      if (!name) name = 'Tertre ' + (tees.length + 1);
      const key = name.toLowerCase() + rating + slope; if (seen.has(key)) return; seen.add(key);
      tees.push({ name: name.slice(0, 24), rating, slope });
    });
    const nameLine = lines.find(l => /(golf|club)/i.test(l) && !/\d{2}/.test(l));
    const holes = pars || sis ? Array.from({ length: 18 }, (_, i) => ({ par: pars ? pars[i] : '', si: sis ? sis[i] : '' })) : null;
    return { name: nameLine ? nameLine.replace(/\s+/g, ' ').slice(0, 60) : '', pars, sis, holes, tees };
  }

  // ---------- Le 9 points (3 joueurs) : 5 au meilleur net, 3 au 2e, 1 au 3e ; égalités partagées ----------
  function neufPoints(game, hole) {
    if (game.players.length !== 3) return null;
    const si = game.course.holes[hole - 1].si;
    const nets = game.players.map((p, i) => { const s = getScore(game, hole, i); return s == null ? null : s - strokesOnHole(p.strokes, si); });
    if (nets.some(v => v == null)) return null;
    const order = [0, 1, 2].sort((a, b) => nets[a] - nets[b]), slots = [5, 3, 1], pts = [0, 0, 0];
    for (let i = 0; i < 3;) { let j = i; while (j + 1 < 3 && nets[order[j + 1]] === nets[order[i]]) j++;
      const avg = slots.slice(i, j + 1).reduce((a, b) => a + b, 0) / (j - i + 1); for (let k = i; k <= j; k++) pts[order[k]] = avg; i = j + 1; }
    return { nets, pts };
  }
  function neufTotals(game) { const t = [0, 0, 0]; for (let h = 1; h <= 18; h++) { const r = neufPoints(game, h); if (r) r.pts.forEach((v, i) => { t[i] += v; }); } return t; }

  // ---------- Autres jeux : Best Ball, Wolf, Sixes, Skins (et le 9 points) ----------
  const FORMATS = { pelland: 'La game à Pelland', neuf: 'Le 9 points', bestball: 'Best Ball', nassau: 'Nassau', wolf: 'Wolf', sixes: 'Sixes', skins: 'Skins', perso: 'Jeu maison' };
  function formatOf(g) { return g.format || (g.players.length === 3 ? 'neuf' : 'pelland'); }
  function netOf(g, h, i) { const s = getScore(g, h, i); return s == null ? null : s - strokesOnHole(g.players[i].strokes, g.course.holes[h - 1].si); }
  function holeNets(g, h) { const n = g.players.map((_, i) => netOf(g, h, i)); return n.some(v => v == null) ? null : n; }
  // Sixes : 3 tranches égales des trous joués (6-6-6 sur 18, 3-3-3 sur 9)
  function sixesSeg(h, g) { const [a, b] = g ? holeRange(g) : [1, 18], len = (b - a + 1) / 3; return Math.min(2, Math.floor((h - a) / len)); }
  function sixesTeams(h, g) { return [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][sixesSeg(h, g)]; }
  function wolfOf(g, h) { return (h - 1) % g.players.length; }
  // Résultat d'un trou : pts = points de chaque joueur (somme nulle sauf le 9 points), win = gagnants, desc = phrase
  function altHoles(g) {
    const f = formatOf(g), P = g.players, nm = i => P[i].name, out = {}; let carry = 0;
    const [h0, h1] = holeRange(g);
    for (let h = h0; h <= h1; h++) {
      const n = holeNets(g, h); if (!n) { out[h] = null; continue; }
      if (f === 'neuf') { const r = neufPoints(g, h); out[h] = { pts: r.pts, win: [], desc: P.map((p, i) => `${nm(i)} ${r.pts[i]}`).join(', ') }; continue; }
      if (f === 'bestball' || f === 'nassau' || f === 'sixes') {
        const T = f !== 'sixes' ? getTeams(g) : sixesTeams(h, g), b = T.map(t => Math.min(...t.map(i => n[i]))), pts = P.map(() => 0);
        if (b[0] === b[1]) { out[h] = { pts, win: [], desc: `Égalité au meilleur net (${b[0]}) : trou partagé.`, teams: T }; continue; }
        const w = b[0] < b[1] ? 0 : 1; T[w].forEach(i => { pts[i] = 1; }); T[1 - w].forEach(i => { pts[i] = -1; });
        out[h] = { pts, win: T[w], desc: `${T[w].map(nm).join(' et ')} gagnent le trou (meilleur net ${b[w]} contre ${b[1 - w]}).`, teams: T }; continue;
      }
      if (f === 'wolf') {
        const e = (g.events || {})[h] || {}, d = e.wolf, wf = wolfOf(g, h), pts = P.map(() => 0);
        if (!d) { out[h] = { pts: null, win: [], desc: `Décision du loup (${nm(wf)}) pas encore indiquée.` }; continue; }
        if (d.partner != null) {
          const A = [wf, d.partner], B = P.map((_, i) => i).filter(i => !A.includes(i));
          const a = Math.min(...A.map(i => n[i])), bb = Math.min(...B.map(i => n[i]));
          if (a === bb) { out[h] = { pts, win: [], desc: `Loup ${nm(wf)} avec ${nm(d.partner)} : égalité (${a}), pas de points.`, wolf: d }; continue; }
          const W = a < bb ? A : B, Lz = a < bb ? B : A; W.forEach(i => { pts[i] = 1; }); Lz.forEach(i => { pts[i] = -1; });
          out[h] = { pts, win: W, desc: `Loup ${nm(wf)} avec ${nm(d.partner)} : ${W.map(nm).join(' et ')} gagnent (${Math.min(a, bb)} contre ${Math.max(a, bb)}), 1 point chacun.`, wolf: d }; continue;
        }
        const v = d.blind ? 3 : 2, others = P.map((_, i) => i).filter(i => i !== wf), bo = Math.min(...others.map(i => n[i]));
        if (n[wf] === bo) { out[h] = { pts, win: [], desc: `Loup ${nm(wf)} seul${d.blind ? ' à l’aveugle' : ''} : égalité (${bo}), pas de points.`, wolf: d }; continue; }
        const won = n[wf] < bo; pts[wf] = (won ? 1 : -1) * v * others.length; others.forEach(i => { pts[i] = (won ? -1 : 1) * v; });
        out[h] = { pts, win: won ? [wf] : others, desc: `Loup ${nm(wf)} seul${d.blind ? ' à l’aveugle' : ''} (${v} points par joueur) : ${won ? 'il gagne' : 'il perd'} (${n[wf]} contre ${bo}).`, wolf: d }; continue;
      }
      if (f === 'perso') { const r = persoHole(g, h, n, carry); carry = r.carry || 0; out[h] = r; continue; }
      if (f === 'skins') {
        const mn = Math.min(...n), who = n.map((v, i) => v === mn ? i : -1).filter(i => i >= 0), units = 1 + carry, pts = P.map(() => 0);
        if (who.length > 1) { carry = units; out[h] = { pts, win: [], desc: `Égalité au meilleur net (${mn}) : ${units} skin${units > 1 ? 's' : ''} reporté${units > 1 ? 's' : ''} au trou suivant.`, carry: units }; continue; }
        carry = 0; const w = who[0]; pts[w] = units * (P.length - 1); P.forEach((_, i) => { if (i !== w) pts[i] = -units; });
        out[h] = { pts, win: [w], desc: `${nm(w)} gagne ${units} skin${units > 1 ? 's' : ''} (net ${mn}).`, units }; continue;
      }
      out[h] = null;
    }
    return out;
  }
  // ---------- Jeu maison : règles choisies par le groupe (g.custom) ----------
  // équipes : plus bas net (low), plus haut net donne (high), meilleur total d'équipe (team), oiselets (birdie)
  // chacun pour soi : points par rang (ranks), oiselets (birdie), skins avec report (skin)
  function persoHole(g, h, n, carry) {
    const c = g.custom || {}, P = g.players, nm = i => P[i].name, num = x => Number(x) || 0;
    const par = i => holeInfo(g, h, i).par, gross = i => getScore(g, h, i);
    const birdies = P.map((_, i) => gross(i) < par(i) ? 1 : 0), parts = [];
    if (c.mode === 'equipes') {
      const T = getTeams(g), tp = [0, 0], teamOf = i => T[0].includes(i) ? 0 : 1, mn = Math.min(...n), mx = Math.max(...n);
      const lowT = [...new Set(P.map((_, i) => i).filter(i => n[i] === mn).map(teamOf))], highT = [...new Set(P.map((_, i) => i).filter(i => n[i] === mx).map(teamOf))];
      if (num(c.low) && lowT.length === 1 && mn !== mx) { tp[lowT[0]] += num(c.low); parts.push(`plus bas net : +${num(c.low)} ${TEAMS[lowT[0]]}`); }
      if (num(c.high) && highT.length === 1 && mn !== mx) { tp[1 - highT[0]] += num(c.high); parts.push(`plus haut net : +${num(c.high)} ${TEAMS[1 - highT[0]]}`); }
      if (num(c.team)) { const s = T.map(t => t.reduce((a, i) => a + n[i], 0)); if (s[0] !== s[1]) { const w = s[0] < s[1] ? 0 : 1; tp[w] += num(c.team); parts.push(`meilleur total : +${num(c.team)} ${TEAMS[w]}`); } }
      if (num(c.birdie)) P.forEach((_, i) => { if (birdies[i]) { tp[teamOf(i)] += num(c.birdie); parts.push(`oiselet de ${nm(i)} : +${num(c.birdie)}`); } });
      const d = tp[0] - tp[1], pts = P.map((_, i) => teamOf(i) === 0 ? d : -d);
      return { pts, win: d ? T[d > 0 ? 0 : 1] : [], desc: parts.length ? parts.join(' ; ') + '.' : 'Pas de points.', teamPts: tp };
    }
    const ranks = String(c.ranks || '').split(/[^0-9.]+/).filter(Boolean).map(Number), pts = P.map(() => 0), order = P.map((_, i) => i).sort((a, b) => n[a] - n[b]);
    if (ranks.length) for (let i = 0; i < order.length;) { let j = i; while (j + 1 < order.length && n[order[j + 1]] === n[order[i]]) j++;
      let sum = 0; for (let k = i; k <= j; k++) sum += ranks[k] || 0; for (let k = i; k <= j; k++) pts[order[k]] += sum / (j - i + 1); i = j + 1; }
    if (ranks.length) parts.push(P.map((_, i) => `${nm(i)} ${Math.round(pts[i] * 10) / 10}`).join(', '));
    if (num(c.birdie)) P.forEach((_, i) => { if (birdies[i]) { pts[i] += num(c.birdie); parts.push(`oiselet de ${nm(i)} : +${num(c.birdie)}`); } });
    let nc = 0;
    if (num(c.skin)) { const mn = Math.min(...n), who = P.map((_, i) => i).filter(i => n[i] === mn), units = 1 + (carry || 0);
      if (who.length > 1) { nc = units; parts.push(`skin reporté (${units})`); } else { pts[who[0]] += units * num(c.skin); parts.push(`skin à ${nm(who[0])} : +${units * num(c.skin)}`); } }
    return { pts, win: [], desc: parts.length ? parts.join(' ; ') + '.' : 'Pas de points.', carry: nc };
  }
  function altTotals(g) { const r = altHoles(g), t = g.players.map(() => 0); for (let h = 1; h <= 18; h++) if (r[h] && r[h].pts) r[h].pts.forEach((v, i) => { t[i] += v; }); return t; }
  // Gain de chaque joueur ($) selon le jeu
  function altGains(g, pp) {
    const f = formatOf(g), t = altTotals(g);
    if (f === 'neuf' || (f === 'perso' && (g.custom || {}).mode !== 'equipes')) return t.map((x, i) => t.reduce((a, y, j) => a + (j === i ? 0 : (x - y) * pp), 0));
    if (f === 'perso') { const st = Number((g.custom || {}).stake) || 0; return t.map(x => x * pp + Math.sign(x) * st); }
    if (f === 'sixes') { const r = altHoles(g), gn = g.players.map(() => 0);
      [0, 1, 2].forEach(seg => { const s = g.players.map(() => 0); let any = false;
        for (let h = 1; h <= 18; h++) if (r[h] && sixesSeg(h, g) === seg) if (r[h] && r[h].pts) { any = true; r[h].pts.forEach((v, i) => { s[i] += v; }); }
        if (any) s.forEach((v, i) => { gn[i] += Math.sign(v) * pp; }); });
      return gn; }
    if (f === 'nassau') return nassauBets(g).reduce((gn, b) => gn.map((v, i) => v + Math.sign(b.pts[i]) * pp), g.players.map(() => 0));
    return t.map(x => x * pp);
  }
  // Nassau : 3 paris en Best Ball — l'aller (1-9), le retour (10-18) et le total ; sur 9 trous, un seul pari
  function nassauBets(g) {
    const r = altHoles(g), [a, b] = holeRange(g);
    const segs = a === 1 && b === 18 ? [['L’aller', 1, 9], ['Le retour', 10, 18], ['Le total', 1, 18]] : [['La partie', a, b]];
    return segs.map(([name, x, y]) => { const pts = g.players.map(() => 0); let played = 0;
      for (let h = x; h <= y; h++) if (r[h] && r[h].pts) { played++; r[h].pts.forEach((v, i) => { pts[i] += v; }); }
      return { name, from: x, to: y, pts, played, done: played === y - x + 1 }; }).filter(s => s.played);
  }

  const api = { PINEGROVE, teePar, holePar, courseHandicap, allocateStrokes, strokesOnHole, buildPlayers, TEAMS, teamFromText, makeTeams, orderTeams, getTeams, teamName, netScore, holeMultiplier, holePoints, teamPoints, describeHolePoints, skinTeam, holeTotal, describeSkin, cabaneTeam, cabanes, birdiesByTeam, calcText, par3Results, describePar3, holeInfo, getScore, totals, norm, matchPlayer, afterWake, parse, answer, apply, parseSetup, resolveName, nextPrompt, trailingTeam, pressTeamOf, initials, leadChanges, totalText, holeNetText, parseCardText, neufPoints, neufTotals, FORMATS, formatOf, altHoles, altTotals, altGains, nassauBets, sixesTeams, wolfOf, holeRange };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PellandLogic = api;
})(this);
