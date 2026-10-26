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
  function holePoints(game, hole) {
    const T = getTeams(game);
    const teamOf = pi => T.findIndex(t => t.includes(pi));
    const nets = game.players.map((p, pi) => netScore(game, hole, pi));
    if (nets.some(n => n == null)) return null;
    const lo = Math.min(...nets), hi = Math.max(...nets);
    const loP = nets.map((n, i) => n === lo ? i : -1).filter(i => i >= 0);
    const hiP = nets.map((n, i) => n === hi ? i : -1).filter(i => i >= 0);
    const pts = [0, 0];
    const loTeams = [...new Set(loP.map(teamOf))], hiTeams = [...new Set(hiP.map(teamOf))];
    const low = { players: loP, net: lo, team: loTeams.length === 1 ? loTeams[0] : null };
    const high = { players: hiP, net: hi, team: hiTeams.length === 1 ? hiTeams[0] : null };
    if (lo === hi) { low.team = null; high.team = null; }
    if (low.team != null) pts[low.team] += POINTS;
    if (high.team != null) pts[1 - high.team] += POINTS;
    return { pts, low, high, nets };
  }
  // Skin : l'équipe qui a la skin gagne 1 point. skinTeam : 0 ou 1 = équipe, -1 = pas de skin, null = pas encore dit.
  const SKIN_POINTS = 1;
  function skinTeam(game, hole) {
    const e = (game.events || {})[hole];
    if (!e) return null;
    if (e.skinTeam !== undefined && e.skinTeam !== null) return e.skinTeam;
    if (Array.isArray(e.skins) && e.skins.length) return getTeams(game).findIndex(t => t.includes(e.skins[0]));
    return null;
  }
  function holeTotal(game, hole) {
    const r = holePoints(game, hole); const st = skinTeam(game, hole);
    if (!r && (st == null || st < 0)) return null;
    const pts = r ? r.pts.slice() : [0, 0];
    if (st === 0 || st === 1) pts[st] += SKIN_POINTS;
    return pts;
  }
  function teamPoints(game) {
    const tot = [0, 0], skins = [0, 0]; let holes = 0;
    for (let h = 1; h <= 18; h++) {
      const r = holePoints(game, h); if (r) { tot[0] += r.pts[0]; tot[1] += r.pts[1]; holes++; }
      const st = skinTeam(game, h); if (st === 0 || st === 1) { tot[st] += SKIN_POINTS; skins[st]++; }
    }
    return { tot, holes, skins };
  }
  function describeSkin(game, hole) {
    const st = skinTeam(game, hole);
    if (st === 0 || st === 1) return `Skin pour l'équipe ${st + 1}, 1 point.`;
    if (st === -1) return 'Pas de skin.';
    return 'Skin pas encore indiquée.';
  }
  function describeHolePoints(game, hole) {
    const r = holePoints(game, hole); if (!r) return '';
    const P = game.players, names = a => a.map(i => P[i].name).join(' et ');
    const parts = [];
    if (r.low.team != null) parts.push(`${names(r.low.players)} plus bas net ${r.low.net}, 2 points pour l'équipe ${r.low.team + 1}`);
    else parts.push(`égalité au plus bas net ${r.low.net}, pas de points`);
    if (r.high.team != null) parts.push(`${names(r.high.players)} plus haut net ${r.high.net}, 2 points à l'équipe ${2 - r.high.team}`);
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
      else if (/skin/.test(t)) topic = 'skins';
      else if (/par3/.test(t)) topic = 'par3';
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

    if (/\bpress/.test(t)) {
      const who = mentioned.length ? mentioned : [null];
      who.forEach(p => actions.push({ type: 'press', hole: h, player: p }));
      return { kind: 'command', actions };
    }
    if (/\breroll\b/.test(t)) { actions.push({ type: 'reroll', hole: h, on: !/\b(pas|enleve|retire)\b/.test(t) }); return { kind: 'command', actions }; }
    if (/par3/.test(t) || /plus pres/.test(t)) {
      if (mentioned.length) actions.push({ type: 'par3', hole: h, player: mentioned[0] });
      else if (/\b(personne|aucun)\b/.test(t)) actions.push({ type: 'par3', hole: h, player: null });
      return actions.length ? { kind: 'command', actions } : { kind: 'unknown' };
    }
    if (skinCmd) {
      // sans numéro de trou : le trou en cours s'il a des scores, sinon le trou qui vient de se terminer
      let sh = hole;
      if (!sh) { const row = (game.scores || {})[current]; sh = row && row.some(v => v != null) ? current : Math.max(1, current - 1); }
      let team = null;
      const tm = t.match(/equipe\s+(1|un|une|2|deux)\b/);
      if (/\b(pas de|pas d|aucune?|personne|non|sans)\b/.test(t)) team = -1;
      else if (tm) team = /^(1|un|une)$/.test(tm[1]) ? 0 : 1;
      else if (mentioned.length) team = getTeams(game).findIndex(x => x.includes(mentioned[0]));
      if (team == null) return { kind: 'unknown' };
      actions.push({ type: 'skin', hole: sh, team });
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
        const lead = tot[0] === tot[1] ? 'Égalité' : `L'équipe ${tot[0] > tot[1] ? 1 : 2} mène par ${Math.abs(tot[0] - tot[1])}`;
        let s = `Après ${plural(holes, 'trou')} : équipe 1, ${teamName(game, 0)}, ${plural(tot[0], 'point')} ; équipe 2, ${teamName(game, 1)}, ${plural(tot[1], 'point')}${skins[0] || skins[1] ? `, skins comprises` : ''}. ${lead}.`;
        if (q.players.length === 1) { const t = getTeams(game).findIndex(x => x.includes(q.players[0])); s = `${P[q.players[0]].name} est dans l'équipe ${t + 1}. ` + s; }
        return s;
      }
      case 'teams': {
        const T = getTeams(game);
        if (q.players.length === 1) {
          const pi = q.players[0]; const t = T.findIndex(x => x.includes(pi)); const mate = T[t].find(x => x !== pi);
          return `${P[pi].name} joue avec ${P[mate].name}.`;
        }
        return `Équipe 1 : ${teamName(game, 0)}. Équipe 2 : ${teamName(game, 1)}.`;
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
      case 'skins': {
        const sk = teamPoints(game).skins;
        if (!sk[0] && !sk[1]) return 'Aucune skin pour l\'instant.';
        return `Skins : équipe 1, ${plural(sk[0], 'skin')} ; équipe 2, ${plural(sk[1], 'skin')}.`;
      }
      case 'par3': {
        const ev = game.events || {}; const out = [];
        for (let h = 1; h <= 18; h++) if (ev[h] && ev[h].par3Winner != null) out.push(`trou ${h}, ${P[ev[h].par3Winner].name}`);
        return out.length ? 'Par 3 gagnés : ' + out.join(' ; ') + '.' : 'Aucun par 3 attribué pour l\'instant.';
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
      if (a.type === 'goto') { g.currentHole = a.hole; say.push(`Trou ${a.hole}, normale ${holeInfo(g, a.hole, 0).par}.`); }
      if (a.type === 'scores') {
        const row = g.scores[a.hole] = (g.scores[a.hole] || [null, null, null, null]).slice();
        const parts = [];
        Object.entries(a.scores).forEach(([pi, v]) => { row[pi] = v; parts.push(`${g.players[pi].name} ${v}`); });
        say.push(`Trou ${a.hole} : ${parts.join(', ')}.`);
        if (row.every(v => v != null)) {
          const d = describeHolePoints(g, a.hole); if (d) say.push(d);
          const tp = teamPoints(g).tot; say.push(`Total : ${tp[0]} à ${tp[1]}.`);
        }
        if (row.every(v => v != null) && a.hole === (g.currentHole || 1) && a.hole < 18) { g.currentHole = a.hole + 1; say.push(`On passe au ${a.hole + 1}.`); }
        if (row.every(v => v != null) && skinTeam(g, a.hole) == null) say.push(`Skin ou pas de skin au ${a.hole} ?`);
      }
      if (a.type === 'press') { ev(a.hole).presses.push(a.player); say.push(`Trou ${a.hole} pressé${a.player != null ? ' par ' + g.players[a.player].name : ''}.`); }
      if (a.type === 'reroll') { ev(a.hole).reroll = a.on; say.push(a.on ? `Reroll au trou ${a.hole}.` : `Reroll retiré au trou ${a.hole}.`); }
      if (a.type === 'par3') {
        if (holeInfo(g, a.hole, 0).par !== 3) { say.push(`Attention, le trou ${a.hole} n'est pas un par 3.`); return; }
        ev(a.hole).par3Winner = a.player; say.push(a.player == null ? `Personne au par 3 du ${a.hole}.` : `${g.players[a.player].name} gagne le par 3 du ${a.hole}.`);
      }
      if (a.type === 'skin') {
        const e = ev(a.hole); e.skinTeam = a.team; e.skins = [];
        say.push(a.team === -1 ? `Pas de skin au trou ${a.hole}.` : `Skin au trou ${a.hole} pour l'équipe ${a.team + 1}, ${teamName(g, a.team)}. 1 point.`);
        const tp = teamPoints(g).tot; say.push(`Total : ${tp[0]} à ${tp[1]}.`);
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

  function parseSetup(text, draft, course) {
    const d = JSON.parse(JSON.stringify(draft));
    const said = [];
    let t = wordsToDigits(text)
      .replace(/(\d)\s*(?:,|\.|virgule|point)\s*(\d)/gi, '$1.$2')
      .replace(/\bplus\s+(\d+(?:\.\d)?)/gi, '-$1');
    const low = plainWord(t) === '' ? '' : t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const findPlayer = name => {
      const names = d.players.map(p => p.name || '');
      const i = matchPlayer(norm(name).split(' ')[0], names.map(n => n || '§'));
      return i;
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
      let i = f.slot != null ? f.slot : findPlayer(f.name);
      if (i < 0) i = d.players.findIndex(p => !String(p.name || '').trim());
      if (i < 0) return;
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
    return { draft: d, said: said.join(' '), missing, create: create && !said.length, understood: said.length > 0 };
  }

  const api = { PINEGROVE, teePar, holePar, courseHandicap, allocateStrokes, strokesOnHole, buildPlayers, makeTeams, getTeams, teamName, netScore, holePoints, teamPoints, describeHolePoints, skinTeam, holeTotal, describeSkin, holeInfo, getScore, totals, norm, matchPlayer, afterWake, parse, answer, apply, parseSetup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PellandLogic = api;
})(this);
