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
      if ((e.skins || []).includes(pi)) skins++;
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
    const hasQuestionWord = /^(qui|combien|quel|quelle|quels|ou|est ce|c est quoi|donne|dis|resultat|pointage|classement|score|qu)/.test(t) || /\b(qui|combien|ou en|classement)\b/.test(t);
    const mentioned = [];
    toks.forEach(tk => { const m = matchPlayer(tk, names); if (m >= 0 && !mentioned.includes(m)) mentioned.push(m); });

    // ----- Questions -----
    if (hasQuestionWord || !isResp) {
      let topic = 'leaderboard';
      if (/coup/.test(t)) topic = 'strokes';
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
    if (/skin/.test(t)) {
      if (mentioned.length) actions.push({ type: 'skins', hole: h, players: mentioned });
      else if (/\b(personne|aucun|pas de)\b/.test(t)) actions.push({ type: 'skins', hole: h, players: [] });
      return actions.length ? { kind: 'command', actions } : { kind: 'unknown' };
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
        const parts = P.map((p, i) => ({ n: p.name, s: totals(game, i).skins })).filter(x => x.s > 0);
        if (!parts.length) return 'Aucune skin pour l\'instant.';
        return 'Skins : ' + parts.map(x => `${x.n} ${x.s}`).join(', ') + '.';
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
          if (t.skins) s += ` ${plural(t.skins, 'skin')}.`;
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
    const ev = h => (g.events[h] = g.events[h] || { presses: [], skins: [], reroll: false, par3Winner: null });
    actions.forEach(a => {
      if (a.type === 'goto') { g.currentHole = a.hole; say.push(`Trou ${a.hole}, normale ${holeInfo(g, a.hole, 0).par}.`); }
      if (a.type === 'scores') {
        const row = g.scores[a.hole] = (g.scores[a.hole] || [null, null, null, null]).slice();
        const parts = [];
        Object.entries(a.scores).forEach(([pi, v]) => { row[pi] = v; parts.push(`${g.players[pi].name} ${v}`); });
        say.push(`Trou ${a.hole} : ${parts.join(', ')}.`);
        if (row.every(v => v != null) && a.hole === (g.currentHole || 1) && a.hole < 18) { g.currentHole = a.hole + 1; say.push(`On passe au ${a.hole + 1}.`); }
      }
      if (a.type === 'press') { ev(a.hole).presses.push(a.player); say.push(`Trou ${a.hole} pressé${a.player != null ? ' par ' + g.players[a.player].name : ''}.`); }
      if (a.type === 'reroll') { ev(a.hole).reroll = a.on; say.push(a.on ? `Reroll au trou ${a.hole}.` : `Reroll retiré au trou ${a.hole}.`); }
      if (a.type === 'par3') {
        if (holeInfo(g, a.hole, 0).par !== 3) { say.push(`Attention, le trou ${a.hole} n'est pas un par 3.`); return; }
        ev(a.hole).par3Winner = a.player; say.push(a.player == null ? `Personne au par 3 du ${a.hole}.` : `${g.players[a.player].name} gagne le par 3 du ${a.hole}.`);
      }
      if (a.type === 'skins') { ev(a.hole).skins = a.players; say.push(a.players.length ? `Skin au trou ${a.hole} : ${a.players.map(i => g.players[i].name).join(', ')}.` : `Pas de skin au trou ${a.hole}.`); }
    });
    return { game: g, say: say.join(' ') };
  }

  const api = { PINEGROVE, teePar, holePar, courseHandicap, allocateStrokes, strokesOnHole, buildPlayers, holeInfo, getScore, totals, norm, matchPlayer, afterWake, parse, answer, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PellandLogic = api;
})(this);
