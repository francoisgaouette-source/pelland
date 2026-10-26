/* Pelland — application (interface, voix, base de données). */
(function () {
  'use strict';
  const L = window.PellandLogic;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };

  // =====================================================================
  // Base de données : Firebase si configuré, sinon stockage local
  // =====================================================================
  const Store = {
    mode: 'local', uid: null, db: null, error: '',
    async init() {
      const cfg = window.PELLAND_FIREBASE;
      if (!cfg || !cfg.apiKey) this.error = 'Le fichier firebase-config.js en ligne ne contient pas de clé (apiKey vide). Remplacez-le sur GitHub.';
      else if (typeof firebase === 'undefined') this.error = 'Les outils Firebase n\'ont pas pu se charger (réseau ou bloqueur de contenu).';
      if (cfg && cfg.apiKey && typeof firebase !== 'undefined') {
        try {
          firebase.initializeApp(cfg);
          const cred = await firebase.auth().signInAnonymously();
          this.uid = cred.user.uid;
          this.db = firebase.firestore();
          try { await this.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* déjà active ou non supportée */ }
          this.mode = 'firebase';
        } catch (e) {
          console.error(e);
          const c = (e && e.code) || '';
          this.error = c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed'
            ? 'La connexion « Anonymous » n\'est pas activée dans Firebase (Authentication → Sign-in method).'
            : c === 'auth/unauthorized-domain' || /domain/i.test(e.message || '')
            ? 'Le domaine francoisgaouette-source.github.io n\'est pas dans Authentication → Settings → Authorized domains.'
            : /referer|referrer|API key|api-key|blocked/i.test((e && e.message) || '')
            ? 'La clé Firebase est restreinte et refuse ce site. Vérifiez les « Website restrictions » de la clé dans Google Cloud.'
            : 'Erreur Firebase : ' + (c || '') + ' ' + ((e && e.message) || e);
          toast('Base partagée injoignable : mode local.');
        }
      }
      if (this.mode === 'local') {
        this.uid = ls.get('pelland.uid', null) || ('local-' + Math.random().toString(36).slice(2, 10));
        ls.set('pelland.uid', this.uid);
      }
      await this.ensureSeed();
    },
    async ensureSeed() {
      const list = await this.listCourses();
      if (!list.find(c => c.id === L.PINEGROVE.id)) await this.saveCourse(L.PINEGROVE);
    },
    async listCourses() {
      if (this.mode === 'firebase') {
        const snap = await this.db.collection('courses').get();
        return snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name));
      }
      return ls.get('pelland.courses', []).sort((a, b) => a.name.localeCompare(b.name));
    },
    async saveCourse(c) {
      c = JSON.parse(JSON.stringify(c));
      if (!c.id) c.id = slug(c.name) + '-' + Math.random().toString(36).slice(2, 6);
      c.updatedAt = Date.now();
      if (this.mode === 'firebase') { await this.db.collection('courses').doc(c.id).set(c); return c; }
      const list = ls.get('pelland.courses', []).filter(x => x.id !== c.id); list.push(c); ls.set('pelland.courses', list); return c;
    },
    async newCode() {
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      for (let n = 0; n < 20; n++) {
        const code = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
        if (!(await this.getGame(code))) return code;
      }
      return 'P' + Date.now().toString(36).toUpperCase().slice(-5);
    },
    async getGame(id) {
      if (this.mode === 'firebase') { const d = await this.db.collection('games').doc(id).get(); return d.exists ? d.data() : null; }
      return ls.get('pelland.games', {})[id] || null;
    },
    async saveGame(g) {
      g.updatedAt = Date.now();
      if (this.mode === 'firebase') { await this.db.collection('games').doc(g.id).set(JSON.parse(JSON.stringify(g))); return; }
      const all = ls.get('pelland.games', {}); all[g.id] = g; ls.set('pelland.games', all);
      this._emit(g);
    },
    _subs: {},
    _emit(g) { (this._subs[g.id] || []).forEach(cb => cb(g)); },
    watchGame(id, cb) {
      if (this.mode === 'firebase') {
        return this.db.collection('games').doc(id).onSnapshot(d => { if (d.exists) cb(d.data()); }, e => toast('Lecture impossible : ' + e.message));
      }
      (this._subs[id] = this._subs[id] || []).push(cb);
      this.getGame(id).then(g => g && cb(g));
      const onStorage = e => { if (e.key === 'pelland.games') this.getGame(id).then(g => g && cb(g)); };
      window.addEventListener('storage', onStorage);
      return () => { this._subs[id] = (this._subs[id] || []).filter(x => x !== cb); window.removeEventListener('storage', onStorage); };
    },
    async listGames() {
      if (this.mode === 'firebase') {
        const snap = await this.db.collection('games').orderBy('createdAt', 'desc').limit(100).get();
        return snap.docs.map(d => d.data());
      }
      return Object.values(ls.get('pelland.games', {})).sort((a, b) => b.createdAt - a.createdAt);
    }
  };
  function slug(s) { return L.norm(s).replace(/\s+/g, '-').slice(0, 30) || 'terrain'; }

  // =====================================================================
  // Voix : reconnaissance (Safari iOS) et synthèse
  // =====================================================================
  const Voice = {
    SR: window.SpeechRecognition || window.webkitSpeechRecognition,
    rec: null, wake: false, listening: false, speaking: false, armedUntil: 0, onText: null, wakeLock: null,
    get supported() { return !!this.SR; },
    _make(continuous) {
      const r = new this.SR();
      r.lang = 'fr-CA'; r.continuous = continuous; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = e => {
        let fin = '', interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) fin += t; else interim += t;
        }
        if (interim) setHeard('… ' + interim);
        if (fin) this._final(fin.trim(), continuous);
      };
      r.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.setWake(false); setReply('Micro refusé. Autorisez le micro pour Safari dans Réglages.'); }
      };
      r.onend = () => {
        this.listening = false; updateMic();
        if (this.wake && !this.speaking) setTimeout(() => this._startWake(), 250);
      };
      return r;
    },
    _final(text, fromWake) {
      if (!fromWake) { this.stop(); this.onText && this.onText(text, false); return; }
      const rest = L.afterWake(text);
      if (rest != null) {
        if (rest.length > 1) { this.armedUntil = 0; this.onText && this.onText(rest, true); }
        else { this.armedUntil = Date.now() + 8000; setHeard('« Pelland » entendu…'); this.say('Oui?'); }
      } else if (Date.now() < this.armedUntil) {
        this.armedUntil = 0; this.onText && this.onText(text, true);
      } else setHeard('(ignoré) ' + text);
    },
    ptt() {
      if (!this.supported) return setReply('La reconnaissance vocale n\'est pas offerte ici. Ouvrez l\'app dans Safari, ou utilisez le micro du clavier.');
      if (this.listening && !this.wake) { this.stop(); return; }
      const wasWake = this.wake; if (wasWake) this.setWake(false);
      speechSynthesis.cancel();
      try { this.rec = this._make(false); this.rec.start(); this.listening = true; updateMic(); setHeard('J\'écoute…'); } catch (e) { setReply('Micro occupé, réessayez.'); }
    },
    stop() { try { this.rec && this.rec.stop(); } catch (e) { } this.listening = false; updateMic(); },
    setWake(on) {
      if (on && !this.supported) { setReply('Écoute continue indisponible ici. Ouvrez l\'app dans Safari.'); on = false; }
      this.wake = on; $('#wakeBtn').setAttribute('aria-pressed', on);
      if (on) { this._startWake(); this.keepAwake(true); setHeard('Écoute continue : dites « Pelland » puis la commande.'); }
      else { this.armedUntil = 0; this.stop(); this.keepAwake(false); }
    },
    _startWake() {
      if (!this.wake || this.listening || this.speaking) return;
      try { this.rec = this._make(true); this.rec.start(); this.listening = true; updateMic(); } catch (e) { /* relance au prochain onend */ }
    },
    async keepAwake(on) {
      try {
        if (on && 'wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
        else if (!on && this.wakeLock) { await this.wakeLock.release(); this.wakeLock = null; }
      } catch (e) { /* refusé : sans gravité */ }
    },
    say(text) {
      if (!('speechSynthesis' in window) || !text) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-CA';
      const v = speechSynthesis.getVoices().find(v => /fr[-_]CA/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang));
      if (v) u.voice = v;
      u.rate = 1.05;
      // couper l'écoute pendant que l'app parle, pour ne pas s'entendre elle-même
      this.speaking = true; if (this.listening) this.stop();
      u.onend = u.onerror = () => { this.speaking = false; if (this.wake) setTimeout(() => this._startWake(), 200); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Voice.wake) Voice.keepAwake(true); });

  // =====================================================================
  // État de l'interface
  // =====================================================================
  const S = { view: 'home', game: null, unwatch: null, undo: [], courses: [], draft: null, editCourse: null };
  const isOwner = () => S.game && S.game.ownerUid === Store.uid;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }
  function setHeard(t) { $('#heard').textContent = t; }
  function setReply(t) { $('#reply').textContent = t; }
  function updateMic() { $('#micBtn').classList.toggle('on', Voice.listening && !Voice.wake); }

  function go(view, opts = {}) {
    if (S.unwatch && view !== 'game') { S.unwatch(); S.unwatch = null; S.game = null; }
    if (view !== 'game' && view !== 'setup' && Voice.wake) Voice.setWake(false);
    S.view = view; Object.assign(S, opts);
    if (view === 'setup') { setHeard('Touchez le micro et dites les joueurs et leurs index.'); setReply(''); }
    if (view === 'game') { setHeard('Appuyez sur le micro et parlez.'); setReply(''); }
    render(); window.scrollTo(0, 0);
  }

  function render() {
    const v = $('#view');
    $('#back').hidden = S.view === 'home';
    $('#dbBadge').textContent = Store.mode === 'firebase' ? 'Partagé' : 'Local';
    const showDock = (S.view === 'game' && S.game) || S.view === 'setup';
    $('#dock').hidden = !showDock; document.body.classList.toggle('no-dock', !showDock);
    const R = { home: vHome, setup: vSetup, game: vGame, join: vJoin, history: vHistory, courses: vCourses, course: vCourse }[S.view];
    v.innerHTML = R();
    bind[S.view] && bind[S.view](v);
  }

  // ---------------- Accueil ----------------
  function vHome() {
    $('#barTitle').textContent = 'Pelland';
    const last = ls.get('pelland.lastGame', null);
    return `
      <div class="hero"><h1>La game à Pelland</h1><p>Carte de pointage à la voix pour quatre joueurs.</p></div>
      ${Voice.supported ? '' : `<div class="warn">La dictée intégrée n'est pas disponible dans ce navigateur. Sur iPhone, ouvrez le lien dans Safari. En attendant, le micro du clavier fonctionne dans la zone de texte.</div>`}
      <div class="tiles">
        <button class="tile" data-go="courses"><span class="pin">⛳</span><div><strong>Terrains</strong><span>Ajouter ou corriger un terrain avant la partie</span></div></button>
        <button class="tile primary" data-go="setup"><span class="pin">+</span><div><strong>Nouvelle partie</strong><span>Terrain, joueurs, index, tertres, handicap, à la voix</span></div></button>
        ${last ? `<button class="tile" data-open="${esc(last)}"><span class="pin">▶</span><div><strong>Reprendre la partie ${esc(last)}</strong><span>Dernière partie ouverte sur ce téléphone</span></div></button>` : ''}
        <button class="tile" data-go="join"><span class="pin">#</span><div><strong>Rejoindre une partie</strong><span>Avec le code donné par le responsable</span></div></button>
        <button class="tile" data-go="history"><span class="pin">≡</span><div><strong>Historique</strong><span>Toutes les parties enregistrées</span></div></button>
      </div>
      <p class="note">${Store.mode === 'firebase' ? 'Base partagée active : les autres joueurs voient la partie en direct avec le code.' : 'Mode local : les parties restent sur ce téléphone.'}</p>
      ${Store.mode === 'local' && Store.error ? `<div class="warn"><b>Pourquoi le mode local :</b> ${esc(Store.error)}</div>` : ''}`;
  }

  // ---------------- Nouvelle partie ----------------
  function newDraft() {
    const prev = ls.get('pelland.lastPlayers', null);
    return {
      courseId: (S.courses[0] || {}).id || 'pinegrove', mode: 'bas', responsable: 0,
      players: prev || [0, 1, 2, 3].map(() => ({ name: '', index: '', tee: 'II' }))
    };
  }
  function draftPreview(d) {
    const c = S.courses.find(x => x.id === d.courseId);
    if (!c) return null;
    const ok = d.players.every(p => p.name.trim() && p.index !== '' && !isNaN(parseFloat(String(p.index).replace(',', '.'))));
    if (!ok) return { c, ready: false };
    const ps = L.buildPlayers(c, d.players.map(p => ({ name: p.name.trim(), index: parseFloat(String(p.index).replace(',', '.')), tee: p.tee })), d.mode);
    return { c, ready: true, ps };
  }
  function vSetup() {
    $('#barTitle').textContent = 'Nouvelle partie';
    const d = S.draft || (S.draft = newDraft());
    const c = S.courses.find(x => x.id === d.courseId) || S.courses[0];
    if (c && !c.tees.find(t => t.name === d.players[0].tee)) d.players.forEach(p => (p.tee = c.tees[0].name));
    const teeOpts = sel => (c ? c.tees : []).map(t => `<option value="${esc(t.name)}" ${t.name === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    return `
      <section class="card voice-help">
        <div class="step">Configuration à la voix</div>
        <p class="note">Touchez le micro en bas et dites, par exemple : « On joue au Pinegrove » · « François 12,4, Marc 8,1, Luc 18,6 et Pierre 3,2 » · « Marc est responsable » · « Tout le monde au tertre deux » · « Luc au tertre deux trois » · « Bas handicap » · puis « Créer la partie ».</p>
      </section>
      <section class="card">
        <div class="step">1 · Terrain</div>
        <select id="course">${S.courses.map(x => `<option value="${esc(x.id)}" ${x.id === d.courseId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <p class="note">Le terrain n'est pas dans la liste ? Ajoutez-le d'abord dans <b>Terrains</b>, à l'accueil.</p>
      </section>
      <section class="card">
        <div class="step">2 à 5 · Joueurs, responsable, index, tertre</div>
        ${d.players.map((p, i) => `
          <div class="prow">
            <label>Joueur ${i + 1}<input id="pn${i}" type="text" value="${esc(p.name)}" placeholder="Prénom" autocapitalize="words"></label>
            <label>Index<input id="pi${i}" type="text" inputmode="decimal" value="${esc(p.index)}" placeholder="12,4"></label>
            <label>Tertre<select id="pt${i}">${teeOpts(p.tee)}</select></label>
            <label class="resp"><input type="radio" name="resp" value="${i}" ${d.responsable === i ? 'checked' : ''}> Responsable de la partie</label>
          </div>`).join('')}
      </section>
      <section class="card">
        <div class="step">6 · Handicap</div>
        <div class="seg">
          <button type="button" data-mode="bas" aria-pressed="${d.mode === 'bas'}"><b>Bas handicap</b><small>Le plus bas joue à 0, les autres reçoivent la différence</small></button>
          <button type="button" data-mode="full" aria-pressed="${d.mode === 'full'}"><b>Full handicap</b><small>Chacun reçoit son handicap de parcours</small></button>
        </div>
      </section>
      <section class="card">
        <div class="step">7 · Coups et équipes</div>
        <div id="pv" class="preview">${previewHtml(d)}</div>
        <button class="btn" id="create" type="button">Créer la carte de pointage</button>
      </section>`;
  }
  function previewHtml(d) {
    const pv = draftPreview(d);
    if (!pv || !pv.ready) return '<p class="note">Entrez les quatre prénoms et index pour voir les coups et les équipes.</p>';
    return `<table><thead><tr><th>Joueur</th><th>Tertre</th><th style="text-align:right">Index</th><th style="text-align:right">Hcp</th><th style="text-align:right">Coups</th></tr></thead><tbody>
      ${pv.ps.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.tee)}</td><td class="n">${String(p.index).replace('.', ',')}</td><td class="n">${p.courseHandicap}</td><td class="n"><b>${p.strokes}</b></td></tr>`).join('')}
      </tbody></table>${teamsHtml(pv.ps, L.makeTeams(pv.ps))}<p class="note">Hcp = handicap de parcours = index × slope ÷ 113 + (évaluation − normale), arrondi.</p>`;
  }

  function teamsHtml(players, teams, pts) {
    const lead = pts && pts[0] !== pts[1] ? (pts[0] > pts[1] ? 0 : 1) : -1;
    return `<div class="teams">${teams.map((t, k) => `<div class="team ${lead === k ? 'lead' : ''}"><span class="step">Équipe ${k + 1}</span><b>${t.map(i => esc(players[i].name)).join(' et ')}</b>${pts ? `<span class="tp num">${pts[k]} <small>pts</small></span>` : ''}<span class="note">index ${t.map(i => String(players[i].index).replace('.', ',')).join(' et ')}</span></div>`).join('')}</div>`;
  }

  // ---------------- Rejoindre ----------------
  function vJoin() {
    $('#barTitle').textContent = 'Rejoindre';
    return `<section class="card"><h2>Code de la partie</h2>
      <p class="note">Le responsable voit le code en haut de sa carte (4 lettres).</p>
      <input id="code" type="text" autocapitalize="characters" maxlength="8" placeholder="ABCD" style="font-family:var(--display);font-size:28px;letter-spacing:.2em;text-transform:uppercase">
      <button class="btn" id="joinBtn" type="button">Ouvrir la partie</button>
      ${Store.mode === 'local' ? '<div class="warn">En mode local, seules les parties créées sur ce téléphone sont accessibles.</div>' : ''}</section>`;
  }

  // ---------------- Partie ----------------
  function vGame() {
    const g = S.game;
    if (!g) { $('#barTitle').textContent = 'Chargement…'; return '<p class="note">Chargement de la partie…</p>'; }
    $('#barTitle').textContent = `${g.course.name.replace(/^Club de golf /i, '')} · ${g.id}`;
    const h = g.currentHole || 1;
    const hi = L.holeInfo(g, h, 0);
    const ev = (g.events || {})[h] || {};
    const owner = isOwner();
    const tots = g.players.map((p, i) => L.totals(g, i));
    const played = tots.filter(t => t.played);
    const best = played.length ? Math.min(...played.map(t => t.netToPar)) : null;
    const fmt = n => n === 0 ? 'E' : (n > 0 ? '+' + n : '−' + (-n));
    const dots = k => k > 0 ? '●'.repeat(k) : k < 0 ? '○'.repeat(-k) : '';

    const holeChips = [];
    (ev.presses || []).forEach(x => holeChips.push(`<span class="chip">Pressé${x != null ? ' · ' + esc(g.players[x].name) : ''}</span>`));
    if (ev.reroll) holeChips.push('<span class="chip">Reroll</span>');
    if (ev.par3Winner != null) holeChips.push(`<span class="chip">Par 3 · ${esc(g.players[ev.par3Winner].name)}</span>`);
    { const st = L.skinTeam(g, h); if (st === 0 || st === 1) holeChips.push(`<span class="chip">Skin · équipe ${st + 1}</span>`); else if (st === -1) holeChips.push('<span class="chip alt">Pas de skin</span>'); }
    { const prev = h - 1; const row = (g.scores || {})[prev]; if (prev >= 1 && row && row.every(v => v != null) && L.skinTeam(g, prev) == null) holeChips.push(`<span class="chip alt">Skin du ${prev} ? (à dire)</span>`); }

    const row = hole => {
      const ih = L.holeInfo(g, hole, 0); const e = (g.events || {})[hole] || {};
      const cells = g.players.map((p, pi) => {
        const s = L.getScore(g, hole, pi); const k = L.strokesOnHole(p.strokes, ih.si);
        const par = L.holeInfo(g, hole, pi).par;
        const cls = s == null ? '' : (s - k < par ? 'birdie' : s - k > par ? 'bogey' : '');
        return `<td><button class="cell ${cls}" data-cell="${hole}:${pi}" ${owner ? '' : 'disabled'} aria-label="Trou ${hole}, ${esc(p.name)}"><span>${s == null ? '' : s}</span>${k ? `<i class="d">${dots(k)}</i>` : ''}${s != null && k ? `<i class="nt">${s - k}</i>` : ''}</button></td>`;
      }).join('');
      const evs = [];
      if ((e.presses || []).length) evs.push(`<i class="p">P${e.presses.length > 1 ? e.presses.length : ''}</i>`);
      if (e.reroll) evs.push('<i>R</i>');
      if (e.par3Winner != null) evs.push(`<i class="t">${esc(g.players[e.par3Winner].name.slice(0, 2))}</i>`);
      { const st = L.skinTeam(g, hole); if (st === 0 || st === 1) evs.push(`<i class="s">S${st + 1}</i>`); else if (st == null && L.holePoints(g, hole)) evs.push('<i>S?</i>'); }
      const hp = L.holeTotal(g, hole);
      if (hp) evs.unshift(`<i class="pts">${hp[0]}–${hp[1]}</i>`);
      return `<tr class="${hole === h ? 'cur' : ''}"><th class="h"><button class="cell" data-hole="${hole}" style="font-size:19px">${hole}</button></th><td class="m">${ih.par}</td><td class="m">${ih.si}</td>${cells}<td><div class="ev">${evs.join('')}</div></td></tr>`;
    };
    const sumRow = (label, from, to) => {
      const cells = g.players.map((p, pi) => {
        let s = 0, any = false; for (let x = from; x <= to; x++) { const v = L.getScore(g, x, pi); if (v != null) { s += v; any = true; } }
        return `<td>${any ? s : ''}</td>`;
      }).join('');
      let par = 0; for (let x = from; x <= to; x++) par += L.holeInfo(g, x, 0).par;
      return `<tr class="sum"><td colspan="2">${label}</td><td>${par}</td>${cells}<td></td></tr>`;
    };

    return `
      <section class="hole-card" aria-live="polite">
        <div class="hole-top">
          <div class="hole-no">${h}</div>
          <div class="hole-meta">Normale <b>${hi.par}</b> · Handicap <b>${hi.si}</b></div>
          <div class="hole-nav"><button data-nav="-1" aria-label="Trou précédent">‹</button><button data-nav="1" aria-label="Trou suivant">›</button></div>
        </div>
        <div class="hole-players">
          ${g.players.map((p, pi) => { const k = L.strokesOnHole(p.strokes, hi.si); const s = L.getScore(g, h, pi); return `<div class="hp"><div class="nm">${esc(p.name)}${g.responsable === pi ? ' ★' : ''}</div><div class="sc">${s == null ? '–' : s}</div><div class="dots">${k ? dots(k) + ' ' + (k > 0 ? 'coup' + (k > 1 ? 's' : '') : 'redonne') : ''}</div></div>`; }).join('')}
        </div>
        ${holeChips.length ? `<div class="chips">${holeChips.join('')}</div>` : ''}
        ${owner ? `<button class="btn small" data-hole="${h}" style="background:var(--flag);color:var(--flag-ink)">Pressé, reroll, par 3, skin…</button>` : ''}
      </section>

      ${teamsHtml(g.players, L.getTeams(g), L.teamPoints(g).tot)}
      <section class="board">
        ${g.players.map((p, i) => { const t = tots[i]; return `<div class="tot ${t.played && t.netToPar === best ? 'lead' : ''}"><div class="nm">${esc(p.name)} <span class="tm">É${L.getTeams(g).findIndex(x => x.includes(i)) + 1}</span></div><div class="big">${t.played ? fmt(t.netToPar) : '–'} <small style="font-size:15px">net</small></div><div class="sub">${t.played ? `${t.gross} brut · ${t.net} net · ${t.played} tr.` : `${p.strokes} coups`}${t.par3 ? ` · ${t.par3} par 3` : ''}</div></div>`; }).join('')}
      </section>

      <div class="card-scroll"><table class="sc">
        <thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${g.players.map(p => `<th>${esc(p.name)}</th>`).join('')}<th>É1–É2</th></tr></thead>
        <tbody>${Array.from({ length: 9 }, (_, i) => row(i + 1)).join('')}${sumRow('Aller', 1, 9)}${Array.from({ length: 9 }, (_, i) => row(i + 10)).join('')}${sumRow('Retour', 10, 18)}${sumRow('Total', 1, 18)}</tbody>
      </table></div>
      <div class="legend"><span>● coup reçu</span><span>petit chiffre = net</span><span>P pressé · R reroll</span><span>vert = par 3 · S1/S2 = skin de l'équipe</span><span>2–0 = points du trou, skin comprise (équipe 1–équipe 2)</span></div>
      <section class="card">
        <h2>${owner ? 'Vous êtes le responsable' : 'Vous suivez la partie'}</h2>
        <p class="note">${owner
          ? 'Dites par exemple : « Trou 4, François 5, Marc 4, Luc 6, Pierre 5 » · « Marc par, Luc bogey » · « Marc presse » · « Reroll » · « Luc gagne le par 3 » · « Skin équipe 1 » · « Skin pour Marc » · « Pas de skin » · « Annule » · « Trou suivant ».'
          : 'Posez vos questions : « Qui a des coups au 7 ? » · « Combien de coups pour Marc ? » · « Où en est Luc ? » · « Combien de skins ? » · « Combien de points ? » · « Les points au trou 5 » · « Avec qui joue Marc ? » · « Les équipes » · « Classement ».'}</p>
        <p class="note">${esc(g.mode === 'bas' ? 'Bas handicap' : 'Full handicap')} · ${g.players.map(p => `${esc(p.name)} ${esc(p.tee)}, index ${String(p.index).replace('.', ',')}, ${p.strokes} coups`).join(' · ')}</p>
        ${Store.mode === 'firebase' ? `<p class="note">Code à donner aux autres joueurs : <b class="num" style="font-size:22px;letter-spacing:.15em">${esc(g.id)}</b></p>` : ''}
      </section>`;
  }

  // ---------------- Historique ----------------
  let historyCache = null;
  function vHistory() {
    $('#barTitle').textContent = 'Historique';
    if (!historyCache) { Store.listGames().then(l => { historyCache = l; if (S.view === 'history') render(); }).catch(e => toast(e.message)); return '<p class="note">Chargement…</p>'; }
    const list = historyCache; historyCache = null;
    if (!list.length) return '<section class="card"><h2>Aucune partie encore</h2><p class="note">Les parties apparaîtront ici dès leur création.</p></section>';
    return `<div class="list">${list.map(g => {
      const d = new Date(g.createdAt);
      const played = Object.keys(g.scores || {}).length;
      const lead = g.players.map((p, i) => ({ p, t: L.totals(g, i) })).filter(x => x.t.played).sort((a, b) => a.t.netToPar - b.t.netToPar)[0];
      return `<button class="item" data-open="${esc(g.id)}"><b>${d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(g.course.name.replace(/^Club de golf /i, ''))}</b>
        <span>${g.players.map(p => esc(p.name)).join(', ')} · ${played}/18 trous${lead ? ` · meilleur net : ${esc(lead.p.name)}` : ''} · code ${esc(g.id)}</span></button>`;
    }).join('')}</div>`;
  }

  // ---------------- Terrains ----------------
  function vCourses() {
    $('#barTitle').textContent = 'Terrains';
    return `<div class="list">${S.courses.map(c => `<button class="item" data-edit="${esc(c.id)}"><b>${esc(c.name)}</b><span>Normale ${L.teePar(c, c.tees[0])} · ${c.tees.length} tertres${c.city ? ' · ' + esc(c.city) : ''}</span></button>`).join('')}</div>
      <button class="btn" data-go="course" data-new="1" type="button">Ajouter un terrain</button>
      <p class="note">Les terrains sont gardés dans la base de données et réutilisés aux parties suivantes.</p>`;
  }
  function vCourse() {
    const c = S.editCourse || (S.editCourse = { name: '', city: '', holes: Array.from({ length: 18 }, () => ({ par: 4, si: '' })), tees: [{ name: 'Blanc', rating: '', slope: '' }] });
    $('#barTitle').textContent = c.id ? 'Modifier le terrain' : 'Nouveau terrain';
    return `
      <section class="card">
        <label>Nom du terrain<input id="cname" type="text" value="${esc(c.name)}" placeholder="Club de golf …"></label>
        <label>Ville<input id="ccity" type="text" value="${esc(c.city || '')}"></label>
      </section>
      <section class="card">
        <h2>Tertres</h2><p class="note">Évaluation et slope, inscrits au verso de la carte de pointage.</p>
        <div id="tees" class="list">${c.tees.map((t, i) => `<div class="tee-row">
          <label>Nom<input data-tee="${i}:name" type="text" value="${esc(t.name)}"></label>
          <label>Évaluation<input data-tee="${i}:rating" type="text" inputmode="decimal" value="${esc(t.rating)}"></label>
          <label>Slope<input data-tee="${i}:slope" type="text" inputmode="numeric" value="${esc(t.slope)}"></label>
          <button class="x" type="button" data-deltee="${i}" aria-label="Retirer">×</button></div>`).join('')}</div>
        <button class="btn ghost small" type="button" id="addTee">Ajouter un tertre</button>
      </section>
      <section class="card">
        <h2>Trous</h2><p class="note">Normale et handicap (1 = trou le plus difficile, chaque nombre de 1 à 18 une seule fois).</p>
        <div class="holes-edit"><span class="lbl">Trou</span><span class="lbl">Normale</span><span class="lbl">Handicap</span>
        ${c.holes.map((h, i) => `<span class="hh">${i + 1}</span><input data-hole="${i}:par" type="text" inputmode="numeric" value="${esc(h.par)}"><input data-hole="${i}:si" type="text" inputmode="numeric" value="${esc(h.si)}">`).join('')}</div>
      </section>
      <button class="btn" id="saveCourse" type="button">Enregistrer le terrain</button>`;
  }

  // =====================================================================
  // Interactions
  // =====================================================================
  const bind = {
    home(v) { commonNav(v); },
    join(v) {
      $('#joinBtn').onclick = () => { const code = $('#code').value.trim().toUpperCase(); if (code) openGame(code); };
      $('#code').onkeydown = e => { if (e.key === 'Enter') $('#joinBtn').click(); };
    },
    history(v) { commonNav(v); },
    courses(v) {
      commonNav(v);
      v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => go('course', { editCourse: JSON.parse(JSON.stringify(S.courses.find(c => c.id === b.dataset.edit))) }));
    },
    course(v) {
      const c = S.editCourse;
      const sync = () => {
        c.name = $('#cname').value; c.city = $('#ccity').value;
        v.querySelectorAll('[data-tee]').forEach(i => { const [k, f] = i.dataset.tee.split(':'); c.tees[k][f] = i.value; });
        v.querySelectorAll('[data-hole]').forEach(i => { const [k, f] = i.dataset.hole.split(':'); c.holes[k][f] = i.value; });
      };
      $('#addTee').onclick = () => { sync(); c.tees.push({ name: '', rating: '', slope: '' }); render(); };
      v.querySelectorAll('[data-deltee]').forEach(b => b.onclick = () => { sync(); if (c.tees.length > 1) c.tees.splice(+b.dataset.deltee, 1); render(); });
      $('#saveCourse').onclick = async () => {
        sync();
        const num = x => parseFloat(String(x).replace(',', '.'));
        const out = { ...c, name: c.name.trim(), holes: c.holes.map(h => ({ par: parseInt(h.par, 10), si: parseInt(h.si, 10) })),
          tees: c.tees.filter(t => String(t.name).trim()).map(t => ({ ...t, name: String(t.name).trim(), rating: num(t.rating), slope: parseInt(t.slope, 10) })) };
        const sis = out.holes.map(h => h.si).sort((a, b) => a - b).join(',');
        if (!out.name) return toast('Donnez un nom au terrain.');
        if (out.holes.some(h => !(h.par >= 3 && h.par <= 6))) return toast('Chaque normale doit être entre 3 et 6.');
        if (sis !== Array.from({ length: 18 }, (_, i) => i + 1).join(',')) return toast('Les handicaps doivent utiliser 1 à 18, une fois chacun.');
        if (!out.tees.length || out.tees.some(t => !(t.rating > 50 && t.rating < 90) || !(t.slope >= 55 && t.slope <= 155))) return toast('Vérifiez l\'évaluation (ex. 70,7) et le slope (55 à 155) des tertres.');
        try { await Store.saveCourse(out); S.courses = await Store.listCourses(); toast('Terrain enregistré.'); go(S.draft ? 'setup' : 'courses', { editCourse: null }); }
        catch (e) { toast('Enregistrement impossible : ' + e.message); }
      };
    },
    setup(v) {
      commonNav(v);
      const d = S.draft;
      const refresh = () => { $('#pv').innerHTML = previewHtml(d); };
      $('#course').onchange = e => { d.courseId = e.target.value; render(); };
      d.players.forEach((p, i) => {
        $('#pn' + i).oninput = e => { p.name = e.target.value; refresh(); };
        $('#pi' + i).oninput = e => { p.index = e.target.value; refresh(); };
        $('#pt' + i).onchange = e => { p.tee = e.target.value; refresh(); };
      });
      v.querySelectorAll('[name=resp]').forEach(r => r.onchange = () => { d.responsable = +r.value; });
      v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { d.mode = b.dataset.mode; v.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); });
      $('#create').onclick = async () => {
        const pv = draftPreview(d);
        if (!pv || !pv.ready) { toast('Il manque un prénom ou un index.'); setReply('Il manque un prénom ou un index.'); Voice.say('Il manque un prénom ou un index.'); return; }
        const names = pv.ps.map(p => L.norm(p.name));
        if (new Set(names).size < 4) return toast('Deux joueurs ont le même prénom. Ajoutez une initiale.');
        ls.set('pelland.lastPlayers', d.players);
        const id = await Store.newCode();
        const g = { id, createdAt: Date.now(), ownerUid: Store.uid, course: pv.c, courseId: pv.c.id, mode: d.mode, responsable: d.responsable,
          players: pv.ps, teams: L.makeTeams(pv.ps), currentHole: 1, scores: {}, events: {}, status: 'en cours' };
        try { await Store.saveGame(g); S.draft = null; openGame(id); const msg = `Partie créée. ${g.players.map(p => `${p.name} ${p.strokes} coup${Math.abs(p.strokes) > 1 ? 's' : ''}`).join(', ')}. Équipes : ${L.teamName(g, 0)} contre ${L.teamName(g, 1)}. Trou 1, normale ${L.holeInfo(g, 1, 0).par}.`; setHeard('« Créer la partie »'); setReply(msg); Voice.say(msg); }
        catch (e) { toast('Création impossible : ' + e.message); }
      };
    },
    game(v) {
      if (!S.game) return;
      v.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
        const h = Math.min(18, Math.max(1, (S.game.currentHole || 1) + +b.dataset.nav));
        if (isOwner()) commit([{ type: 'goto', hole: h }], false); else { S.game.currentHole = h; render(); }
      });
      v.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const [h, pi] = b.dataset.cell.split(':').map(Number); scoreSheet(h, pi); });
      v.querySelectorAll('[data-hole]').forEach(b => b.onclick = () => { const h = +b.dataset.hole; if (isOwner()) holeSheet(h); else { S.game.currentHole = h; render(); } });
    }
  };
  function commonNav(v) {
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go, b.dataset.new ? { editCourse: null } : {}));
    v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openGame(b.dataset.open));
  }

  function openGame(id) {
    if (S.unwatch) S.unwatch();
    S.undo = [];
    S.view = 'game'; S.game = null; render();
    let first = true;
    S.unwatch = Store.watchGame(id, g => {
      const keepHole = S.game && !isOwner() ? S.game.currentHole : null;
      S.game = g; if (keepHole && !first) { /* les joueurs suivent le trou du responsable */ }
      first = false; ls.set('pelland.lastGame', id); render();
    });
    setTimeout(() => { if (S.view === 'game' && !S.game) { $('#view').innerHTML = `<section class="card"><h2>Partie ${esc(id)} introuvable</h2><p class="note">Vérifiez le code avec le responsable.</p></section>`; } }, 6000);
  }

  // Applique des actions (responsable seulement) et enregistre.
  async function commit(actions, speak = true) {
    if (!isOwner()) return;
    const undo = actions.find(a => a.type === 'undo');
    let next, say;
    if (undo) {
      if (!S.undo.length) { say = 'Rien à annuler.'; setReply(say); speak && Voice.say(say); return; }
      next = S.undo.pop(); say = 'Dernière action annulée.';
    } else {
      S.undo.push(JSON.parse(JSON.stringify(S.game))); if (S.undo.length > 40) S.undo.shift();
      const r = L.apply(S.game, actions); next = r.game; say = r.say;
    }
    S.game = next; render();
    setReply(say); if (speak) Voice.say(say);
    try { await Store.saveGame(next); } catch (e) { toast('Non enregistré : ' + e.message); }
  }

  // Traite une phrase (voix ou texte)
  function levenshtein(a, b) {
    const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function handleSetup(text) {
    const d = S.draft || (S.draft = newDraft());
    const c = S.courses.find(x => x.id === d.courseId) || S.courses[0];
    setHeard('« ' + text + ' »');
    // terrain : « on joue au Pinegrove », « terrain Pinegrove »
    const nt = L.norm(text);
    const GENERIC = /^(club|golf|country|de|du|des|la|le|les|et|centre|parcours|terrain)$/;
    const words = nt.split(' ');
    const compact = nt.replace(/ /g, '');
    const hit = x => L.norm(x.name).split(' ').filter(w => w.length > 3 && !GENERIC.test(w))
      .some(w => nt.includes(w) || (w.length >= 6 && compact.includes(w)) || words.some(v => v.length >= 5 && L.norm(v) !== '' && levenshtein(v, w) <= 1));
    const course = S.courses.find(hit);
    let extra = '';
    if (course) { if (course.id !== d.courseId) d.courseId = course.id; extra = `Terrain : ${course.name}. `; }
    else if (/\b(terrain|on joue (au|a)|golf)\b/.test(nt)) {
      const r0 = `Je ne trouve pas ce terrain. Terrains disponibles : ${S.courses.map(x => x.name).join(', ')}. Pour un nouveau terrain, ajoutez-le d'abord dans Terrains, à l'accueil.`;
      setReply(r0); Voice.say(r0); return;
    }
    let rest = text;
    if (course) {
      const cw = L.norm(course.name).split(' ').filter(w => w.length > 3 && !GENERIC.test(w));
      cw.forEach(w => { rest = rest.replace(new RegExp(w.split('').join('[\\s-]*'), 'ig'), ' '); });
      rest = rest.split(/\s+/).filter(tok => { const n = L.norm(tok); return !n || !cw.some(w => n === w || (n.length >= 5 && levenshtein(n, w) <= 1)); }).join(' ')
        .replace(/\b(on joue|terrain|au club|club de golf|au golf)\b/gi, ' ');
    }
    const r = L.parseSetup(rest, d, course || c);
    if (r.create) { $('#create').click(); return; }
    S.draft = Object.assign(d, r.draft);
    render();
    let reply = extra + (r.understood ? r.said : (extra ? '' : 'Je n\'ai pas compris. Exemple : « François 12,4, Marc 8,1 ».'));
    if (r.understood || extra) reply += r.missing.length ? ` Il manque ${r.missing.slice(0, 2).join(' et ')}.` : ' Tout est prêt. Dites « Créer la partie ».';
    setReply(reply); Voice.say(reply);
  }

  function handle(text) {
    if (S.view === 'setup') return handleSetup(text);
    if (!S.game) return;
    setHeard('« ' + text + ' »');
    const r = L.parse(text, S.game, { isResponsable: isOwner() });
    if (r.kind === 'command') return commit(r.actions);
    let reply;
    if (r.kind === 'question') reply = L.answer(r.q, S.game);
    else reply = isOwner() ? 'Je n\'ai pas compris. Exemple : « Trou 3, Marc 4, Luc 5 ».' : 'Je n\'ai pas compris. Exemple : « Qui a des coups au 7 ? »';
    setReply(reply); Voice.say(reply);
  }

  // ---------------- Feuilles (saisie manuelle) ----------------
  function openSheet(html, bindFn) {
    const w = $('#sheetWrap'), s = $('#sheet');
    s.innerHTML = html; w.hidden = false;
    w.onclick = e => { if (e.target === w) closeSheet(); };
    bindFn(s);
  }
  function closeSheet() { $('#sheetWrap').hidden = true; }
  function scoreSheet(h, pi) {
    const g = S.game, p = g.players[pi], par = L.holeInfo(g, h, pi).par;
    openSheet(`<h3>Trou ${h} · ${esc(p.name)}</h3><p class="note">Normale ${par}${L.strokesOnHole(p.strokes, g.course.holes[h - 1].si) ? ' · reçoit un coup' : ''}</p>
      <div class="pad">${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<button data-n="${n}" class="${n === par ? 'par' : ''}">${n}</button>`).join('')}</div>
      <div class="row"><button class="btn ghost small" data-n="">Effacer</button><button class="btn ghost small" data-close>Fermer</button></div>`, s => {
      s.querySelectorAll('[data-n]').forEach(b => b.onclick = () => {
        closeSheet();
        if (b.dataset.n === '') {
          S.undo.push(JSON.parse(JSON.stringify(g)));
          const ng = JSON.parse(JSON.stringify(g)); if (ng.scores[h]) ng.scores[h][pi] = null; S.game = ng; render(); Store.saveGame(ng);
        } else commit([{ type: 'scores', hole: h, scores: { [pi]: +b.dataset.n } }], false);
      });
      s.querySelector('[data-close]').onclick = closeSheet;
    });
  }
  function holeSheet(h) {
    const g = S.game, e = (g.events || {})[h] || {}, isPar3 = L.holeInfo(g, h, 0).par === 3;
    const P = g.players;
    openSheet(`<h3>Trou ${h}</h3>
      <div class="toggles">
        <div class="tg"><span>Aller à ce trou</span><button class="pill" data-goto>Trou courant</button></div>
        <div class="tg"><span>Pressé par</span>${P.map((p, i) => `<button class="pill" data-press="${i}">${esc(p.name)}</button>`).join('')}<button class="pill" data-press="">Sans nom</button>
          ${(e.presses || []).length ? `<button class="pill" data-clearpress>Retirer les pressés (${e.presses.length})</button>` : ''}</div>
        <div class="tg"><span>Reroll</span><button class="pill" data-reroll aria-pressed="${!!e.reroll}">${e.reroll ? 'Oui' : 'Non'}</button></div>
        ${isPar3 ? `<div class="tg"><span>Gagnant du par 3</span>${P.map((p, i) => `<button class="pill" data-par3="${i}" aria-pressed="${e.par3Winner === i}">${esc(p.name)}</button>`).join('')}<button class="pill" data-par3="" aria-pressed="${e.par3Winner == null}">Personne</button></div>` : ''}
        <div class="tg"><span>Skin (1 point à l'équipe)</span>${[0, 1].map(k => `<button class="pill" data-skin="${k}" aria-pressed="${L.skinTeam(g, h) === k}">Équipe ${k + 1} · ${esc(L.teamName(g, k))}</button>`).join('')}<button class="pill" data-skin="-1" aria-pressed="${L.skinTeam(g, h) === -1}">Pas de skin</button></div>
      </div>
      <button class="btn ghost small" data-close>Fermer</button>`, s => {
      const done = acts => { closeSheet(); commit(acts, false); };
      s.querySelector('[data-goto]').onclick = () => done([{ type: 'goto', hole: h }]);
      s.querySelectorAll('[data-press]').forEach(b => b.onclick = () => done([{ type: 'press', hole: h, player: b.dataset.press === '' ? null : +b.dataset.press }]));
      const cp = s.querySelector('[data-clearpress]'); if (cp) cp.onclick = () => { closeSheet(); S.undo.push(JSON.parse(JSON.stringify(g))); const ng = JSON.parse(JSON.stringify(g)); ng.events[h].presses = []; S.game = ng; render(); Store.saveGame(ng); };
      s.querySelector('[data-reroll]').onclick = () => done([{ type: 'reroll', hole: h, on: !e.reroll }]);
      s.querySelectorAll('[data-par3]').forEach(b => b.onclick = () => done([{ type: 'par3', hole: h, player: b.dataset.par3 === '' ? null : +b.dataset.par3 }]));
      s.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
        done([{ type: 'skin', hole: h, team: +b.dataset.skin }]);
      });
      s.querySelector('[data-close]').onclick = closeSheet;
    });
  }

  // =====================================================================
  // Démarrage
  // =====================================================================
  $('#back').onclick = () => {
    if (S.view === 'course') go(S.draft ? 'setup' : 'courses', { editCourse: null });
    else go('home');
  };
  $('#micBtn').onclick = () => Voice.ptt();
  $('#wakeBtn').onclick = () => Voice.setWake(!Voice.wake);
  $('#typeForm').onsubmit = e => { e.preventDefault(); const t = $('#typeInput').value.trim(); if (t) { $('#typeInput').value = ''; handle(t); } };
  $('#typeInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#typeForm').requestSubmit(); } });
  Voice.onText = text => handle(text);
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  (async function start() {
    $('#view').innerHTML = '<p class="note">Démarrage…</p>';
    await Store.init();
    try { S.courses = await Store.listCourses(); } catch (e) { S.courses = [L.PINEGROVE]; }
    const params = new URLSearchParams(location.search);
    const code = (params.get('partie') || params.get('code') || '').toUpperCase();
    if (code) openGame(code);
    else if (params.has('ecoute') || params.has('pelland')) {
      // Ouverture par le raccourci Siri : reprendre la dernière partie et écouter
      const last = ls.get('pelland.lastGame', null);
      if (last) { openGame(last); setTimeout(() => Voice.setWake(true), 800); } else render();
    } else render();
  })();
})();
