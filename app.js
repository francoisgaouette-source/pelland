/* Pelland — application (interface, voix, base de données). */
(function () {
  'use strict';
  if (window.PELLAND_FRAMED) return; // l'app tourne dans le cadre iPhone (ordinateur)
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
          this.cfg = cfg;
          this.db = firebase.firestore();
          // Connexion des membres : nom + numéro de téléphone (compte Firebase « courriel / mot de passe »)
          const user = await new Promise(res => { const off = firebase.auth().onAuthStateChanged(u => { off(); res(u); }); });
          if (user && !user.isAnonymous) { this.uid = user.uid; this.email = user.email; }
          else { if (user && user.isAnonymous) { try { await firebase.auth().signOut(); } catch (e) { } } this.needLogin = true; }
          try { await this.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* déjà active ou non supportée */ }
          this.mode = 'firebase';
        } catch (e) {
          console.error(e);
          const c = (e && e.code) || '';
          this.error = c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed'
            ? 'La connexion « Email/Password » n\'est pas activée dans Firebase (Authentication → Sign-in method).'
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
      if (!this.needLogin) await this.ensureSeed();
    },
    // Connexion avec le nom (choisi dans la liste) et le numéro de téléphone
    async login(player, phone) {
      const digits = String(phone || '').replace(/\D/g, '');
      if (digits.length < 7) throw new Error('Entrez votre numéro de téléphone (10 chiffres).');
      const auth = firebase.auth();
      if (player.authEmail) {
        try { const c = await auth.signInWithEmailAndPassword(player.authEmail, digits); this.uid = c.user.uid; this.email = c.user.email; }
        catch (e) { throw new Error('Numéro de téléphone incorrect pour ' + player.name + '.'); }
        this.savePhone(player.id, digits);
      } else {
        const all = await this.listPlayers();
        if (all.some(x => x.authEmail)) throw new Error('Le téléphone de ' + player.name + ' n\'est pas encore enregistré. Demandez à un membre de l\'ajouter dans Joueurs.');
        // Premier membre : son compte est créé avec ce numéro
        const email = player.id.replace(/[^a-z0-9-]/gi, '') + '-' + Date.now().toString(36) + '@pelland.golf';
        const c = await auth.createUserWithEmailAndPassword(email, digits);
        this.uid = c.user.uid; this.email = email;
        await this.db.collection('players').doc(player.id).set({ authEmail: email, phoneHint: digits.slice(-2) }, { merge: true });
        this.savePhone(player.id, digits);
      }
      this.needLogin = false;
      ls.set('pelland.me', player.name);
      await this.ensureSeed();
    },
    async logout() { try { await firebase.auth().signOut(); } catch (e) { } ls.set('pelland.me', null); location.reload(); },
    // Ajoute ou change le téléphone d'un joueur (crée son compte sans déconnecter le membre actuel)
    async setPhone(player, phone) {
      const digits = String(phone || '').replace(/\D/g, '');
      if (digits.length < 7) throw new Error('Numéro de téléphone invalide (10 chiffres).');
      if (this.mode !== 'firebase') { const list = ls.get('pelland.players', []); const x = list.find(q => q.id === player.id); if (x) { x.phoneHint = digits.slice(-2); x.phone = digits; x.authEmail = 'local'; } ls.set('pelland.players', list); return; }
      const sec = firebase.apps.find(a => a.name === 'invite') || firebase.initializeApp(this.cfg, 'invite');
      const email = player.id.replace(/[^a-z0-9-]/gi, '') + '-' + Date.now().toString(36) + '@pelland.golf';
      await sec.auth().createUserWithEmailAndPassword(email, digits);
      try { await sec.auth().signOut(); } catch (e) { }
      await this.db.collection('players').doc(player.id).set({ authEmail: email, phoneHint: digits.slice(-2) }, { merge: true });
      await this.savePhone(player.id, digits, true);
    },
    // Numéro complet : gardé à part, lisible seulement par les membres connectés
    async savePhone(id, digits, strict) { try { await this.db.collection('phones').doc(id).set({ phone: digits }); this.phonesBlocked = false; } catch (e) { console.warn('phones', e.message); this.phonesBlocked = true; if (strict) throw new Error('Numéro non conservé : publiez la règle « phones » dans Firebase (Firestore → Règles).'); } },
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
      if (this.mode === 'firebase') { const d = await this.db.collection('games').doc(id).get(); return d.exists ? fromDb(d.data()) : null; }
      return ls.get('pelland.games', {})[id] || null;
    },
    async saveGame(g) {
      g.updatedAt = Date.now();
      if (this.mode === 'firebase') { await this.db.collection('games').doc(g.id).set(toDb(g)); return; }
      const all = ls.get('pelland.games', {}); all[g.id] = g; ls.set('pelland.games', all);
      this._emit(g);
    },
    _subs: {},
    _emit(g) { (this._subs[g.id] || []).forEach(cb => cb(g)); },
    watchGame(id, cb) {
      if (this.mode === 'firebase') {
        return this.db.collection('games').doc(id).onSnapshot(d => { if (d.exists) cb(fromDb(d.data())); }, e => toast('Lecture impossible : ' + e.message));
      }
      (this._subs[id] = this._subs[id] || []).push(cb);
      this.getGame(id).then(g => g && cb(g));
      const onStorage = e => { if (e.key === 'pelland.games') this.getGame(id).then(g => g && cb(g)); };
      window.addEventListener('storage', onStorage);
      return () => { this._subs[id] = (this._subs[id] || []).filter(x => x !== cb); window.removeEventListener('storage', onStorage); };
    },
    async listPlayers() {
      if (this.mode === 'firebase') {
        const snap = await this.db.collection('players').get();
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        if (this.email) { try { const ph = await this.db.collection('phones').get(); const m = {}; ph.docs.forEach(d => { m[d.id] = d.data().phone; }); list.forEach(p => { if (m[p.id]) p.phone = m[p.id]; }); this.phonesBlocked = false; } catch (e) { this.phonesBlocked = true; } }
        return list.sort(byName);
      }
      return ls.get('pelland.players', []).sort(byName);
    },
    async savePlayer(name) {
      const p = { id: slug(name) + '-' + Math.random().toString(36).slice(2, 6), name: name.trim(), updatedAt: Date.now() };
      if (this.mode === 'firebase') { await this.db.collection('players').doc(p.id).set(p); return p; }
      const list = ls.get('pelland.players', []); list.push(p); ls.set('pelland.players', list); return p;
    },
    async deletePlayer(id) {
      if (this.mode === 'firebase') { await this.db.collection('players').doc(id).delete(); try { await this.db.collection('phones').doc(id).delete(); } catch (e) { } return; }
      ls.set('pelland.players', ls.get('pelland.players', []).filter(x => x.id !== id));
    },
    // Présences : presence/{partie} = { cléJoueur: { ok: true|false, at } } ; chaque membre écrit sa propre réponse
    watchPresence(id, cb) {
      if (this.mode === 'firebase') return this.db.collection('presence').doc(id).onSnapshot(d => cb(d.exists ? d.data() : {}), () => cb(null));
      const read = () => cb(ls.get('pelland.presence', {})[id] || {}); read();
      const on = e => { if (e.key === 'pelland.presence') read(); }; window.addEventListener('storage', on);
      this._presSubs = (this._presSubs || []).concat([[id, read]]);
      return () => { window.removeEventListener('storage', on); this._presSubs = (this._presSubs || []).filter(x => x[1] !== read); };
    },
    async setPresence(id, key, ok) {
      const v = { ok, at: Date.now() };
      if (this.mode === 'firebase') { await this.db.collection('presence').doc(id).set({ [key]: v }, { merge: true }); return; }
      const all = ls.get('pelland.presence', {}); all[id] = { ...(all[id] || {}), [key]: v }; ls.set('pelland.presence', all);
      (this._presSubs || []).forEach(([gid, f]) => { if (gid === id) f(); });
    },
    async listPresence() {
      if (this.mode === 'firebase') { try { const sn = await this.db.collection('presence').get(); const m = {}; sn.docs.forEach(d => { m[d.id] = d.data(); }); return m; } catch (e) { return {}; } }
      return ls.get('pelland.presence', {});
    },
    async deleteGame(id) {
      if (this.mode === 'firebase') { await this.db.collection('games').doc(id).delete(); return; }
      const all = ls.get('pelland.games', {}); delete all[id]; ls.set('pelland.games', all);
    },
    async listGames() {
      if (this.mode === 'firebase') {
        const snap = await this.db.collection('games').orderBy('createdAt', 'desc').limit(100).get();
        return snap.docs.map(d => fromDb(d.data()));
      }
      return Object.values(ls.get('pelland.games', {})).sort((a, b) => b.createdAt - a.createdAt);
    }
  };
  // Firestore refuse les tableaux imbriqués : les équipes sont stockées comme { e1: [...], e2: [...] }.
  function toDb(g) {
    const o = JSON.parse(JSON.stringify(g));
    if (Array.isArray(o.teams)) o.teams = { e1: o.teams[0], e2: o.teams[1] };
    return o;
  }
  function fromDb(o) {
    if (o && o.teams && !Array.isArray(o.teams)) o.teams = [o.teams.e1, o.teams.e2];
    return o;
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  // Doublons possibles : même nom à une lettre ou deux près (accents, fautes), ou même nom de famille et même initiale.
  function duplicateMap(list) {
    const L2 = window.PellandLogic, n = list.map(p => L2.norm(p.name)), out = {};
    const lev = (a, b) => { const m = a.length, k = b.length; let pr = Array.from({ length: k + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= k; j++) c[j] = Math.min(pr[j] + 1, c[j - 1] + 1, pr[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); pr = c; } return pr[k]; };
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = n[i], b = n[j], wa = a.split(' '), wb = b.split(' ');
      const similar = lev(a, b) <= 2 || (wa.length > 1 && wb.length > 1 && wa[wa.length - 1] === wb[wb.length - 1] && wa[0][0] === wb[0][0]) || (wa.length === 1 || wb.length === 1) && (wa[0] === wb[0]);
      if (similar) { (out[list[i].id] = out[list[i].id] || []).push(list[j].name); (out[list[j].id] = out[list[j].id] || []).push(list[i].name); }
    }
    return out;
  }
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
    say(text) { return; /* voix retirée */
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
  const BALL = '<span class="ydot" aria-label="coup">●</span>';
  const S = { players: [], confirmDel: null, view: 'home', game: null, unwatch: null, undo: [], courses: [], draft: null, editCourse: null };
  const isOwner = () => S.game && S.game.ownerUid === Store.uid;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), Math.min(9000, 2200 + msg.length * 45));
  }
  function setHeard(t) { $('#heard').textContent = t; }
  function setReply(t) { if (t) toast(t); }
  function updateMic() { $('#micBtn').classList.toggle('on', Voice.listening && !Voice.wake); }

  function go(view, opts = {}) {
    if (S.unwatch && view !== 'game') { S.unwatch(); S.unwatch = null; S.game = null; }
    if (S.unwatchPres && view !== 'game') { S.unwatchPres(); S.unwatchPres = null; }
    if (view !== 'game' && view !== 'setup' && Voice.wake) Voice.setWake(false);
    S.view = view; Object.assign(S, opts);
    if (view === 'course' && 'editCourse' in opts) { S.cardImgs = []; S.cardStatus = ''; }
    if (view === 'history' || view === 'live') { S.historyList = null; S.confirmDelGame = null; }
    if (view === 'setup') { setHeard('Touchez le micro et dites les joueurs et leurs index.'); setReply(''); }
    if (view === 'game') { setHeard('Appuyez sur le micro et parlez.'); setReply(''); }
    render(); window.scrollTo(0, 0);
  }

  function render() {
    const v = $('#view');
    $('#back').hidden = S.view === 'home' || S.view === 'login';
    $('#dbBadge').textContent = Store.mode === 'firebase' ? 'Partagé' : 'Local';
    const showDock = false; // plus d'interface vocale
    document.body.classList.toggle('view-game', S.view === 'game');
    $('#dock').hidden = !showDock; document.body.classList.toggle('no-dock', !showDock);
    const R = { home: vHome, setup: vSetup, game: vGame, join: vJoin, history: vHistory, live: vHistory, courses: vCourses, course: vCourse, players: vPlayers, login: vLogin }[S.view];
    v.innerHTML = R();
    bind[S.view] && bind[S.view](v);
  }

  // ---------------- Accueil ----------------
  function vHome() {
    $('#barTitle').textContent = 'Pelland';
    const last = ls.get('pelland.lastGame', null);
    const info = ls.get('pelland.lastGameInfo', null);
    const lastDate = info && info.id === last && info.createdAt ? new Date(info.createdAt).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
    return `
      <div class="hero"><h1>La game à Pelland</h1><p>Carte de pointage pour quatre joueurs.</p></div>
      <div class="tiles">
        <button class="tile" data-go="courses"><span class="pin">⛳</span><div><strong>Terrains</strong><span>Ajouter ou corriger un terrain avant la partie</span></div></button>
        <button class="tile" data-go="players"><span class="pin"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.5 2.5 9 17.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M9 17.2c-.4 1.2-1.6 2.2-3.4 2.4l-2.1.2c-.6.1-.9.7-.6 1.2.2.3.5.5.9.5h4.6c1.6 0 2.7-.9 3.1-2.2l.3-.9" fill="currentColor"/><circle cx="18.5" cy="19.5" r="1.8" fill="currentColor"/></svg></span><div><strong>Joueurs</strong><span>Ajouter ou retirer des joueurs avant la partie</span></div></button>
        <button class="tile primary" data-go="setup"><span class="pin">+</span><div><strong>Nouvelle partie</strong><span>Terrain, joueurs, index, tertres, handicap</span></div></button>
        <button class="tile" data-go="live"><span class="pin">⏵</span><div><strong>Parties en cours</strong><span>Les parties qui ont lieu en ce moment</span></div></button>
        <button class="tile" data-go="history"><span class="pin">≡</span><div><strong>Parties jouées</strong><span>Les parties terminées</span></div></button>
      </div>
      ${Store.mode === 'firebase' && Store.email ? `<p class="note">Connecté : <b>${esc(ls.get('pelland.me', '') || '')}</b> · <button class="linkbtn" id="logout" type="button">Se déconnecter</button></p>` : ''}
      <p class="note">${Store.mode === 'firebase' ? 'Base partagée active : les autres joueurs suivent la partie en direct dans Parties en cours.' : 'Mode local : les parties restent sur ce téléphone.'}</p>
      ${Store.mode === 'local' && Store.error ? `<div class="warn"><b>Pourquoi le mode local :</b> ${esc(Store.error)}</div>` : ''}`;
  }

  // ---------------- Nouvelle partie ----------------
  function newDraft() {
    return {
      courseId: (S.courses[0] || {}).id || 'pinegrove', mode: 'bas', responsable: 0, teamMode: null, teams: null, stake: '', leadChangeValue: '', perPoint: '1',
      players: [0, 1, 2, 3].map(() => ({ name: '', index: '', tee: 'II' }))
    };
  }
  // Ce qui manque avant de pouvoir créer la partie
  function validIndex(v) { const x = parseFloat(String(v).replace(',', '.')); return String(v).trim() !== '' && /^[-+]?\d+([.,]\d)?$/.test(String(v).trim()) && x >= -10 && x <= 54; }
  function missingList(d) {
    const out = [];
    d.players.forEach((p, i) => {
      if (!String(p.name || '').trim()) out.push(`le nom du joueur ${i + 1}`);
      else if (!String(p.index).trim()) out.push(`l'index de ${p.name.trim()}`);
      else if (!validIndex(p.index)) out.push(`un index valide pour ${p.name.trim()} (ex. 12,4)`);
    });
    return out;
  }
  function draftPreview(d) {
    const c = S.courses.find(x => x.id === d.courseId);
    if (!c) return null;
    const ok = !missingList(d).length;
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
      ${d.players.map((_, i) => `<datalist id="playerList${i}">${listOptions(d, i)}</datalist>`).join('')}
      <section class="card">
        <div class="step">1 · Terrain</div>
        <select id="course">${S.courses.map(x => `<option value="${esc(x.id)}" ${x.id === d.courseId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <p class="note">Le terrain n'est pas dans la liste ? Ajoutez-le d'abord dans <b>Terrains</b>, à l'accueil.</p>
      </section>
      <section class="card">
        <div class="step">2 à 5 · Joueurs, responsable, index, tertre</div>
        ${d.players.map((p, i) => `
          <div class="prow">
            <label>Joueur ${i + 1}${playerPicker(d, i)}</label>
            <label>Index<input id="pi${i}" type="text" inputmode="decimal" value="${esc(p.index)}" placeholder="" aria-label="Index de ${esc(p.name || 'joueur ' + (i + 1))}"></label>
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
        <div class="step">Argent</div>
        <div class="row" style="flex-wrap:nowrap">
          <label style="flex:1">La game commence à<span class="money-in"><input id="stake" type="text" inputmode="decimal" placeholder="0" value="${esc(fmtIn(d.stake))}"><i>$</i></span></label>
          <label style="flex:1">À chaque revirement<span class="money-in"><input id="lcv" type="text" inputmode="decimal" placeholder="0" value="${esc(fmtIn(d.leadChangeValue))}"><i>$</i></span></label>
        </div>
        <div class="row" style="flex-wrap:nowrap">
          <label style="flex:1">Par point net<span class="money-in"><input id="ppt" type="text" inputmode="decimal" placeholder="1" value="${esc(fmtIn(d.perPoint))}"><i>$</i></span></label>
          <span style="flex:1"></span>
        </div>
      </section>
      <section class="card">
        <div class="step">7 · Équipes</div>
        <div class="seg">
          <button type="button" data-tmode="auto" aria-pressed="${d.teamMode === 'auto'}"><b>Meilleur avec le moins bon</b><small>Les deux du milieu ensemble</small></button>
          <button type="button" data-tmode="manual" aria-pressed="${d.teamMode === 'manual'}"><b>Je choisis</b><small>Qui joue avec qui</small></button>
        </div>
        ${d.teamMode === 'manual' ? `<label>Partenaire de ${esc(d.players[0].name || 'joueur 1')}<select id="partner">${[1, 2, 3].map(i => `<option value="${i}" ${d.teams && d.teams[0].includes(i) ? 'selected' : ''}>${esc(d.players[i].name || 'Joueur ' + (i + 1))}</option>`).join('')}</select></label>` : ''}
      </section>
      <section class="card">
        <div class="step">8 · Coups et équipes</div>
        <div id="pv" class="preview">${previewHtml(d)}</div>
        <p class="note" id="missingNote">${missingList(d).length ? 'Il manque ' + esc(missingList(d).join(', ')) + '.' : ''}</p>
        <button class="btn" id="create" type="button" ${missingList(d).length ? 'disabled' : ''}>Créer la carte de pointage</button>
      </section>`;
  }
  // Noms de la bibliothèque pas encore choisis dans les autres cases
  // Menu déroulant des joueurs de la bibliothèque (sans ceux déjà choisis) + « Autre… » pour taper un nom
  function playerPicker(d, i) {
    const p = d.players[i];
    const inLib = S.players.some(x => L.norm(x.name) === L.norm(p.name || ''));
    const custom = !S.players.length || p.custom || (p.name && !inLib);
    const taken = d.players.map((q, j) => j !== i ? L.norm(q.name || '') : '').filter(Boolean);
    const opts = S.players.filter(x => !taken.includes(L.norm(x.name)));
    const sel = S.players.length ? `<select id="ps${i}"><option value="">— Choisir —</option>${opts.map(x => `<option value="${esc(x.name)}" ${!custom && L.norm(x.name) === L.norm(p.name || '') ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="__other" ${custom ? 'selected' : ''}>Autre (taper le nom)…</option></select>` : '';
    const inp = custom ? `<input id="pn${i}" type="text" value="${esc(p.name)}" placeholder="Prénom et nom" autocapitalize="words" ${S.players.length ? 'style="margin-top:6px"' : ''}>` : '';
    return sel + inp;
  }
  function listOptions(d, i) {
    const taken = d.players.map((p, j) => j !== i ? L.norm(p.name || '') : '').filter(Boolean);
    return S.players.filter(p => !taken.includes(L.norm(p.name))).map(p => `<option value="${esc(p.name)}"></option>`).join('');
  }
  function money(v) { const x = parseFloat(String(v || '').replace(',', '.').replace(/[^0-9.]/g, '')); return isNaN(x) ? 0 : x; }
  // « 20 » → « 20,00 » ; vide reste vide
  function fmtPhone(d) { d = String(d || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}` : d; }
  function fmtIn(v) { if (String(v || '').trim() === '') return ''; return money(v).toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // 15 $ ; les cents seulement s'il y en a (2,50 $)
  const fmt$ = x => { const n = Number(x || 0); const d = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2; return n.toLocaleString('fr-CA', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' $'; };
  // « 11 coups : 1 2 3 4 5 7 8 9 10 12 14 » (un chiffre en double = 2 coups sur ce trou)
  function strokeHoles(g, p) {
    if (!p.strokes) return 'Aucun coup';
    const list = [];
    for (let h = 1; h <= 18; h++) { const k = L.strokesOnHole(p.strokes, g.course.holes[h - 1].si); if (k > 0) list.push(k > 1 ? `${h}×${k}` : String(h)); else if (k < 0) list.push(`${h}(−)`); }
    return `<b>${Math.abs(p.strokes)} ${BALL}${p.strokes < 0 ? ' à redonner' : ''}</b> : ${list.join('\u00a0- ')}`;
  }
  function draftTeams(d, ps) { return d.teamMode === 'manual' && d.teams ? L.orderTeams(ps, d.teams) : L.makeTeams(ps); }
  function teamQuestion(d, ps) {
    const t = L.makeTeams(ps), n = i => ps[i].name;
    return `Pour les équipes, le meilleur avec le moins bon, donc ${n(t[0][0])} et ${n(t[0][1])} chez les Rouges, ${n(t[1][0])} et ${n(t[1][1])} chez les Bleus ? Dites oui, ou dites qui joue avec qui.`;
  }
  function previewHtml(d) {
    const pv = draftPreview(d);
    if (!pv || !pv.ready) return '<p class="note">Entrez les quatre prénoms et index pour voir les coups et les équipes.</p>';
    return `<table><thead><tr><th>Joueur</th><th>Tertre</th><th style="text-align:right">Index</th><th style="text-align:right">Hcp</th><th style="text-align:right">Coups</th></tr></thead><tbody>
      ${pv.ps.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.tee)}</td><td class="n">${String(p.index).replace('.', ',')}</td><td class="n">${p.courseHandicap}</td><td class="n"><b>${p.strokes}</b></td></tr>`).join('')}
      </tbody></table>${d.teamMode ? teamsHtml(pv.ps, draftTeams(d, pv.ps)) : '<p class="note">Choisissez la formation des équipes à l\'étape 7.</p>'}<p class="note">${d.mode === 'full' ? '<b>Coups</b> : chaque joueur reçoit son handicap de parcours (Hcp).' : '<b>Coups</b> = Hcp du joueur − Hcp le plus bas du groupe. Le meilleur joue à 0.'}${coupsCalc(pv.ps, d.mode)} Les coups se placent d’abord sur les trous les plus difficiles : 7 coups, 1 par trou, pour des trous de difficulté 1 à 7. Au-delà de 18 coups, on recommence : un 2<sup>e</sup> coup sur les trous les plus difficiles.</p>`;
  }

  // « Claude : 12 − 7 = 5 coups (trous de difficulté 1 à 5) »
  function coupsCalc(ps, mode) {
    const lo = Math.min(...ps.map(p => p.courseHandicap));
    return '<span class="coups-calc">' + ps.map(p => `<span><b>${esc(p.name)}</b> : ${mode === 'full' ? `Hcp ${p.courseHandicap}` : `${p.courseHandicap} − ${lo}`} = <b>${p.strokes} coup${Math.abs(p.strokes) > 1 ? 's' : ''}</b></span>`).join('') + '</span>';
  }
  const teamOf = (g, i) => L.getTeams(g).findIndex(x => x.includes(i));
  // Résumé : Bleus à gauche, Rouges à droite ; nom, index, score ; points et argent de l'équipe.
  function summaryHtml(g, tots, p3) {
    const T = L.getTeams(g), pts = L.teamPoints(g).tot, money = p3.money;
    const fmt = n => n === 0 ? 'E' : (n > 0 ? '+' + n : '−' + (-n));
    const cell = pi => { const p = g.players[pi], t = tots[pi]; return `<div class="sm-p"><div class="sm-n">${esc(p.name)}${g.responsable === pi ? ' ★' : ''}</div><div class="sm-i">Index ${String(p.index).replace('.', ',')}</div><div class="sm-s">${t.played ? t.gross : '–'}</div><div class="sm-i">${t.played ? `net ${t.net} (${fmt(t.netToPar)})` : '&nbsp;'}</div></div>`; };
    return `<section class="summary">${[1, 0].map(k => `<div class="sm-team t${k}">
        <div class="sm-players">${T[k].map(cell).join('')}</div>
        <div class="sm-foot"><div><b>${pts[k]}</b> point${pts[k] > 1 ? 's' : ''}</div><div><b>${money[k]} $</b></div></div>
      </div>`).join('')}</section>`;
  }
  function teamsHtml(players, teams, pts, money) {
    const lead = pts && pts[0] !== pts[1] ? (pts[0] > pts[1] ? 0 : 1) : -1;
    return `<div class="teams">${teams.map((t, k) => `<div class="team t${k} ${lead === k ? 'lead' : ''}"><span class="step tn">${L.TEAMS[k]}</span><b>${t.map(i => esc(players[i].name)).join(' et ')}</b>${pts ? `<span class="tp num">${pts[k]} <small>pts</small>${money ? ` <small class="money">· ${money[k]} $</small>` : ''}</span>` : ''}<span class="note">index ${t.map(i => String(players[i].index).replace('.', ',')).join(' et ')}</span></div>`).join('')}</div>`;
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
    const dots = k => k > 0 ? BALL.repeat(k) : k < 0 ? '○'.repeat(-k) : '';

    const holeChips = [];
    const meta = [];
    if ((ev.presses || []).length) meta.push(`Pressé${ev.presses.filter(x => x != null).length ? ' par ' + ev.presses.filter(x => x != null).map(x => esc(g.players[x].name)).join(', ') : ''}`);
    else if (ev.noPress) meta.push('Pas de press');
    if (ev.reroll) meta.push('Reroll');
    else if (ev.rerollSet && (ev.presses || []).length) meta.push('Pas de reroll');
    if (hi.par === 3) { const x = L.par3Results(g).results.find(r => r.hole === h); if (x && x.status === 'pending') meta.push(`${x.value} $ en jeu`); }
    { const st = L.skinTeam(g, h); if (st === 0 || st === 1) holeChips.push(`<span class="chip team t${st}">Skin · ${ev.skinPlayer != null ? esc(g.players[ev.skinPlayer].name) : L.TEAMS[st]}</span>`); else if (st === -1) holeChips.push('<span class="chip alt">Pas de skin</span>'); }

    const p3 = L.par3Results(g);
    const colOrder = [...L.getTeams(g)[1], ...L.getTeams(g)[0]]; // Bleus puis Rouges
    const row = hole => {
      const ih = L.holeInfo(g, hole, 0); const e = (g.events || {})[hole] || {};
      const cells = colOrder.map(pi => { const p = g.players[pi];
        const s = L.getScore(g, hole, pi); const k = L.strokesOnHole(p.strokes, ih.si);
        const par = L.holeInfo(g, hole, pi).par;
        const cls = s == null ? '' : (s - k < par ? 'birdie' : s - k > par ? 'bogey' : '');
        return `<td class="pc"><button class="cell ${cls}" data-cell="${hole}:${pi}" ${owner ? '' : 'disabled'} aria-label="Trou ${hole}, ${esc(p.name)}"><span>${s == null ? '' : s}</span>${k ? `<i class="d">${dots(k)}</i>` : ''}${s != null && k ? `<i class="nt">${s - k}</i>` : ''}</button></td>`;
      }).join('');
      // Statut : Normal, Press ou Reroll
      const played = ((g.scores || {})[hole] || []).some(v => v != null);
      const status = e.reroll ? 'Reroll' : (e.presses || []).length ? 'Press' : (played || e.noPress) ? 'Normal' : '';
      const st = status ? [`<i class="${status === 'Normal' ? '' : 'p'}">${status}</i>`] : [];
      let calc = L.calcText(g, hole);
      if (L.holePoints(g, hole) && L.skinTeam(g, hole) == null) calc += ' S?';
      if (ih.par === 3) { const x = p3.results.find(r => r.hole === hole); if (x && x.status === 'won') calc += ` $${x.amount}${x.team === 0 ? 'R' : 'B'}`; else if (x && x.status === 'carried') calc += ` $${x.value}→`; }
      const hp = L.holeTotal(g, hole);
      if (hp) { cum[0] += hp[0]; cum[1] += hp[1]; }
      const tot = hp ? leadHtml(cum) : '';
      const calcTxt = esc(calc.replace(/^ · /, '').trim());
      const sub = (status || calcTxt) ? `<tr class="calc-row ${hole === h ? 'cur' : ''}" data-detail="${hole}"><td colspan="3"></td><td colspan="6">${status ? `<i class="${status === 'Normal' ? '' : 'p'}">${status}</i> ` : ''}${calcTxt}</td></tr>` : '';
      return `<tr class="${hole === h ? 'cur' : ''} ${sub ? 'has-sub' : ''}"><th class="h"><button class="cell" data-hole="${hole}" style="font-size:19px">${hole}</button></th><td class="m">${ih.par}</td><td class="m">${ih.si}</td>${cells}<td class="stat col-wide"><div class="ev">${st.join('')}</div></td><td class="calc col-wide">${calcTxt}</td><td class="tp0">${hp ? hp[0] : ''}</td><td class="tp1">${hp ? hp[1] : ''}</td></tr>${sub}`;
    };
    const sumRow = (label, from, to, final) => {
      const cells = colOrder.map(pi => { const p = g.players[pi];
        let s = 0, any = false; for (let x = from; x <= to; x++) { const v = L.getScore(g, x, pi); if (v != null) { s += v; any = true; } }
        return `<td>${any ? s : ''}</td>`;
      }).join('');
      let par = 0, tb = [0, 0]; for (let x = from; x <= to; x++) { par += L.holeInfo(g, x, 0).par; const hp = L.holeTotal(g, x); if (hp) { tb[0] += hp[0]; tb[1] += hp[1]; } }
      return `<tr class="sum"><td colspan="2">${label}</td><td>${par}</td>${cells}<td class="col-wide"></td><td class="col-wide"></td><td class="tp0">${tb[0]}</td><td class="tp1">${tb[1]}</td></tr>`;
    };
    const cum = [0, 0];
    const ini = L.initials(g.players);
    function leadHtml(t) { return t[0] === t[1] ? '<span>Égal</span>' : t[0] > t[1] ? `<span class="tc0">R ${t[0]}</span>` : `<span class="tc1">B ${t[1]}</span>`; }

    return `
      ${presenceHtml(g)}
      <section class="hole-card" aria-live="polite">
        <div class="hole-top">
          <div class="hole-no">${h}</div>
          <div class="hole-meta">Normale <b>${hi.par}</b> · Handicap <b>${hi.si}</b>${meta.map(m => ` · <b>${m}</b>`).join('')}</div>
          <div class="hole-nav"><button data-nav="-1" aria-label="Trou précédent">‹</button><button data-nav="1" aria-label="Trou suivant">›</button></div>
        </div>
        ${!owner && Store.mode === 'firebase' && Store.email ? (S.confirmClaim === g.id
          ? `<div class="row game-actions"><button class="btn small" data-claim type="button">Oui, je deviens responsable</button><button class="btn ghost small" data-cancelclaim type="button">Annuler</button></div>`
          : `<div class="row game-actions"><button class="btn ghost small light" data-askclaim type="button">Devenir responsable de cette partie</button><span class="note light">pour entrer les scores, la terminer ou l'effacer</span></div>`) : ''}
        <div class="money-boxes">
          <div class="mbox green"><span>La game commence à</span><b>${g.stake ? fmt$(money(g.stake)) : '—'}</b></div>
          <div class="mbox green"><span>À chaque revirement</span><b>${g.leadChangeValue ? fmt$(L.leadChanges(g) * money(g.leadChangeValue)) : '—'}</b></div>
        </div>
        <div class="team-blocks">${[1, 0].map(k => { const tm = L.getTeams(g)[k], teamPts = L.teamPoints(g).tot;
          const tt = L.trailingTeam(g, h), pt = L.pressTeamOf(g, h), started = ((g.scores || {})[h] || []).some(v => v != null);
          let btn = '';
          if (owner && !started && tt === k && !(ev.presses || []).length) btn = `<button type="button" class="tb-btn t${k}" data-press-team="${k}">Press</button>`;
          else if (owner && pt === k) btn = `<button type="button" class="tb-btn t${k} on" data-unpress="1" ${started ? 'disabled' : ''}>Pressé ✓</button>`;
          else if (owner && pt != null && pt !== k) btn = `<button type="button" class="tb-btn t${k} ${ev.reroll ? 'on' : ''}" data-reroll-team="${ev.reroll ? 0 : 1}" ${started ? 'disabled' : ''}>${ev.reroll ? 'Reroll ✓' : 'Reroll'}</button>`;
          else if (!owner && pt === k) btn = `<span class="tb-btn t${k} on">Pressé</span>`;
          else if (!owner && pt != null && ev.reroll) btn = `<span class="tb-btn t${k} on">Reroll</span>`;
          const ph = tm.map(pi => { const p = g.players[pi]; const k = L.strokesOnHole(p.strokes, hi.si); const s = L.getScore(g, h, pi); return `<${owner ? `button type="button" data-allscores="${h}"` : 'div'} class="hp"><div class="nm tc${teamOf(g, pi)}">${esc(p.name)}${g.responsable === pi ? ' ★' : ''}</div><div class="hp-idx">Index ${String(p.index).replace('.', ',')}</div><div class="hp-strk">${strokeHoles(g, p)}</div><div class="dots">${k ? dots(k) + (k < 0 ? ' redonne' : '') : ''}</div><div class="hp-tot">${tots[pi].played ? `<span>Brut <b>${tots[pi].gross}</b> · Net <b>${tots[pi].net}</b></span><span class="hp-n">${tots[pi].played} trou${tots[pi].played > 1 ? 's' : ''}</span>` : 'Aucun trou joué'}</div></${owner ? 'button' : 'div'}>`; });
          return `<div class="team-block t${k}"><div class="tb-name">${L.TEAMS[k]}</div><div class="tb-grid two">${ph[0]}${ph[1]}</div>${btn}</div>`; }).join('')}</div>
        ${holeChips.length ? `<div class="chips">${holeChips.join('')}</div>` : ''}
      </section>


      ${(() => { const t = L.teamPoints(g).tot, d = Math.abs(t[0] - t[1]), k = t[0] > t[1] ? 0 : 1, o = 1 - k;
        const pts = `<div class="lb-pts"><span class="tc1">Bleus <b>${t[1]}</b></span><span class="tc0">Rouges <b>${t[0]}</b></span></div>`;
        if (t[0] === t[1]) return `<div class="leader-box even"><span>Meneurs</span><div><b>Égalité</b><small>0 point net d’écart</small></div>${pts}</div>`;
        const { parts, tot } = leaderMoney(g);
        return `<div class="leader-box t${k}"><span>Meneurs</span><div><b class="tc${k}">${L.TEAMS[k]}</b><small>+${d} point${d > 1 ? 's' : ''} net${d > 1 ? 's' : ''}</small></div>${pts}
          <div class="lb-money"><span>Gain par joueur des ${L.TEAMS[k]} en ce moment</span><b class="tc${k}">${fmt$(tot)}</b></div>
          <div class="lb-detail">${parts.map(([v, l]) => `<span>${v < 0 ? '−' : '+'} ${fmt$(Math.abs(v))} <i>${l}</i></span>`).join('')}</div></div>`; })()}
      <div class="card-scroll"><table class="sc">
        <thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${colOrder.map(i => { const p = g.players[i]; return `<th class="pc tc${teamOf(g, i)}" title="${esc(p.name)}">${esc(ini[i])}</th>`; }).join('')}<th class="col-wide">Statut</th><th class="col-wide">Calcul</th><th class="tc0">Rouge</th><th class="tc1">Bleu</th></tr></thead>
        <tbody>${Array.from({ length: 9 }, (_, i) => row(i + 1)).join('')}${sumRow('Aller', 1, 9)}${Array.from({ length: 9 }, (_, i) => row(i + 10)).join('')}${sumRow('Retour', 10, 18)}${sumRow('Total', 1, 18, true)}</tbody>
      </table></div>
      <button class="btn sms-btn" data-sms type="button">Texto aux joueurs</button>
        ${owner ? `<div class="row game-actions bottom-actions">${g.status === 'terminée'
          ? '<span class="note">Partie terminée.</span><button class="btn ghost small" data-reopen type="button">Rouvrir</button>'
          : '<button class="btn small" data-finish type="button">Terminer la partie</button>'}
          ${S.confirmDelGame === g.id
            ? '<button class="btn small" data-delthis type="button" style="background:var(--red)">Confirmer l\'effacement</button><button class="btn ghost small" data-canceldelgame type="button">Annuler</button>'
            : '<button class="btn ghost small" data-askdelthis type="button">Effacer la partie</button>'}</div>` : ''}
      <div class="legend"><span>★ responsable de la partie (il entre les scores)</span><span>${BALL} coup reçu · petit chiffre = net</span><span>Calcul : ↓ plus bas net · ↑ plus haut net · R/B équipe qui reçoit · ×2 press · ×4 reroll · S skin · C cabane · $ normale 3 · = résultat net</span><span>Noms à la couleur de l'équipe : <b class="tc1">Bleus</b> · <b class="tc0">Rouges</b></span><span>${g.players.map((p, i) => `<b class="tc${teamOf(g, i)}">${esc(ini[i])}</b> ${esc(p.name)}`).join(' · ')}</span><span class="narrow-only">Sous chaque trou : statut (Normal, Press, Reroll) et calcul des points</span></div>`;
  }

  // ---------------- Historique ----------------
  let historyCache = null;
  function vHistory() {
    const live = S.view === 'live';
    $('#barTitle').textContent = live ? 'Parties en cours' : 'Parties jouées';
    if (S.historyList == null) { Store.listPresence().then(m => { S.presAll = m; }); Store.listGames().then(l => { S.historyList = l; if (S.view === 'history' || S.view === 'live') render(); }).catch(e => toast(e.message)); return '<p class="note">Chargement…</p>'; }
    const list = S.historyList.filter(g => live ? g.status !== 'terminée' : g.status === 'terminée');
    if (!list.length) return live
      ? '<section class="card"><h2>Aucune partie en cours</h2><p class="note">Les parties apparaissent ici dès leur création, jusqu’à ce que le responsable les termine.</p></section>'
      : '<section class="card"><h2>Aucune partie terminée</h2><p class="note">Une partie apparaît ici quand le responsable touche « Terminer la partie ».</p></section>';
    return `<div class="list">${list.map(g => {
      const d = new Date(g.createdAt);
      const played = Object.keys(g.scores || {}).filter(k => (g.scores[k] || []).some(v => v != null)).length;
      const t = L.teamPoints(g).tot;
      const res = t[0] === t[1] ? 'égalité' : `${L.TEAMS[t[0] > t[1] ? 0 : 1]} +${Math.abs(t[0] - t[1])}`;
      const mine = Store.mode !== 'firebase' || !!Store.email;
      const done = g.status === 'terminée';
      return `<div class="item hist ${done ? 'done' : ''}"><button class="hist-open" data-open="${esc(g.id)}" type="button"><b>${d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(g.course.name.replace(/^Club de golf /i, ''))}</b>
        <span><span class="hist-st">${done ? 'Terminée' : 'En cours'}</span>${!done && S.presAll && S.presAll[g.id] ? ` ✓ ${Object.values(S.presAll[g.id]).filter(x => x && x.ok).length}/4 ·` : ''} ${g.players.map(p => esc(p.name)).join(', ')} · ${played}/18 trous · ${res}</span></button>
        ${mine ? (S.confirmDelGame === g.id
          ? `<span class="row"><button class="btn small" data-delgame="${esc(g.id)}" type="button" style="background:var(--red)">Effacer</button><button class="btn ghost small" data-canceldelgame type="button">Annuler</button></span>`
          : `<button class="btn ghost small" data-askdelgame="${esc(g.id)}" type="button">Effacer</button>`) : ''}</div>`;
    }).join('')}</div>`;
  }

  // ---------------- Terrains ----------------
  function vLogin() {
    $('#barTitle').textContent = 'Pelland';
    $('#back').hidden = true;
    const me = ls.get('pelland.me', ''), invited = new URLSearchParams(location.search).get('joueur');
    return `<div class="hero"><h1>La game à Pelland</h1><p>Réservé aux joueurs du groupe.</p></div>
      <section class="card"><h2>Connexion</h2>
        <label>Votre nom<select id="loginName"><option value="">— Choisir —</option>${S.players.map(p => `<option value="${esc(p.id)}" ${(invited ? p.id === invited : p.name === me) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label>Votre numéro de téléphone<input id="loginPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="450 555-1234"></label>
        <button class="btn" id="loginBtn" type="button">Entrer</button>
        <p class="note" id="loginMsg">Votre numéro sert de mot de passe. Seuls les joueurs du groupe peuvent le voir.</p>
      </section>`;
  }
  function vPlayers() {
    $('#barTitle').textContent = 'Joueurs';
    return `<section class="card"><h2>Ajouter un joueur</h2>
        <input id="newPlayer" type="text" placeholder="Prénom et nom" autocapitalize="words">
        <div class="row" style="flex-wrap:nowrap"><input id="newPhone" type="tel" inputmode="tel" placeholder="Téléphone (sert de mot de passe)" style="flex:1;min-width:0"><button class="btn small" id="addPlayer" type="button">Ajouter</button></div>
        </section>
      ${(() => { const dups = duplicateMap(S.players); const nd = Object.keys(dups).length; return nd ? `<div class="warn">${nd} joueurs semblent en double. Vérifiez les noms marqués « Doublon ? » et retirez celui de trop.</div>` : ''; })()}
      <div class="list">${S.players.length ? (() => { const dups = duplicateMap(S.players); return S.players.map(p => `<div class="item pl-row ${dups[p.id] ? 'dup' : ''}"><b>${esc(p.name)}${dups[p.id] ? ` <span class="dup-flag" title="Ressemble à ${esc(dups[p.id].join(', '))}">Doublon ?</span>` : ''}</b>${S.confirmDel === p.id
        ? `<span class="row"><button class="btn small" data-delp="${esc(p.id)}" type="button" style="background:var(--red)">Confirmer</button><button class="btn ghost small" data-canceldel type="button">Annuler</button></span>`
        : `<span class="row" style="flex-wrap:nowrap;flex:none"><button class="btn ghost small" data-phone="${esc(p.id)}" type="button">${p.phone ? '☎ ' + esc(fmtPhone(p.phone)) : p.authEmail ? '☎ ••' + esc(p.phoneHint || '') : '+ Téléphone'}</button><button class="btn ghost small" data-askdel="${esc(p.id)}" type="button">Retirer</button></span>`}</div>`).join(''); })() : '<p class="note">Aucun joueur pour l\'instant.</p>'}</div>`;
  }
  function vCourses() {
    $('#barTitle').textContent = 'Terrains';
    return `<div class="list">${S.courses.map(c => `<button class="item" data-edit="${esc(c.id)}"><b>${esc(c.name)}</b><span>Normale ${L.teePar(c, c.tees[0])} · ${c.tees.length} tertres${c.city ? ' · ' + esc(c.city) : ''}</span></button>`).join('')}</div>
      <button class="btn" data-go="course" data-new="1" type="button">Ajouter un terrain</button>
      <p class="note">Les terrains sont gardés dans la base de données et réutilisés aux parties suivantes.</p>`;
  }
  function vCourse() {
    const c = S.editCourse || (S.editCourse = { name: '', city: '', holes: Array.from({ length: 18 }, () => ({ par: 4, si: '' })), tees: [{ name: 'Blanc', rating: '', slope: '' }] });
    $('#barTitle').textContent = c.id ? 'Modifier le terrain' : 'Nouveau terrain';
    const imgs = S.cardImgs || [];
    return `
      <section class="card card-upload">
        <h2>Carte de pointage</h2>
        <p class="note">Prenez la carte en photo (recto et verso) ou choisissez un PDF. L’app lit les normales, les handicaps et les tertres et remplit le formulaire : vérifiez ensuite avec la photo.</p>
        <label class="btn upload-btn" for="cardFile">Téléverser la carte</label>
        <input id="cardFile" type="file" accept="image/*,application/pdf" multiple hidden>
        <div id="cardStatus" class="note">${esc(S.cardStatus || '')}</div>
        ${imgs.length ? `<div class="card-thumbs">${imgs.map((u, i) => `<button type="button" data-viewcard="${i}"><img src="${u}" alt="Carte ${i + 1}"></button>`).join('')}</div><p class="note">Touchez une photo pour l’agrandir.</p>` : ''}
      </section>
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

  // ---------------- Lecture de la carte (photo ou PDF) ----------------
  const loadScript = (() => { const done = {}; return src => done[src] || (done[src] = new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete done[src]; ko(new Error('connexion requise pour lire la carte')); }; document.head.appendChild(s); })); })();
  async function fileToCanvas(file, max = 2200) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image illisible')); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv;
    } finally { URL.revokeObjectURL(url); }
  }
  // Agrandit, passe en noir et blanc et efface les lignes du quadrillage (elles nuisent à la lecture des chiffres)
  function cleanForOcr(src) {
    const k = Math.max(1, Math.min(2.5, 2400 / src.width));
    const W = Math.round(src.width * k), H = Math.round(src.height * k);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, W, H);
    const im = g.getImageData(0, 0, W, H), d = im.data, n = W * H, lum = new Uint8Array(n);
    for (let i = 0; i < n; i++) lum[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    // seuil local (moyenne sur un bloc) : tolère l'ombre et l'éclairage inégal d'une photo
    const B = Math.max(15, Math.round(W / 60)), ii = new Float64Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < W; x++) { r += lum[y * W + x]; ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1] + r; } }
    const dark = new Uint8Array(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - B), x1 = Math.min(W, x + B), y0 = Math.max(0, y - B), y1 = Math.min(H, y + B);
      const m = (ii[y1 * (W + 1) + x1] - ii[y0 * (W + 1) + x1] - ii[y1 * (W + 1) + x0] + ii[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      dark[y * W + x] = lum[y * W + x] < m * 0.82 ? 1 : 0;
    }
    const kill = new Uint8Array(n), hMin = Math.round(W * 0.06), vMin = Math.round(H * 0.045);
    for (let y = 0; y < H; y++) { let s = -1; for (let x = 0; x <= W; x++) { const on = x < W && dark[y * W + x]; if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s >= hMin) for (let j = s; j < x; j++) kill[y * W + j] = 1; s = -1; } } }
    for (let x = 0; x < W; x++) { let s = -1; for (let y = 0; y <= H; y++) { const on = y < H && dark[y * W + x]; if (on && s < 0) s = y; if (!on && s >= 0) { if (y - s >= vMin) for (let j = s; j < y; j++) kill[j * W + x] = 1; s = -1; } } }
    for (let i = 0; i < n; i++) { const v = dark[i] && !kill[i] ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); return cv;
  }
  async function ocrCanvas(cv, status) {
    status('Chargement du lecteur de texte…');
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    const w = await Tesseract.createWorker(['fra', 'eng'], 1, { logger: m => { if (m.status === 'recognizing text') status(`Lecture de la carte… ${Math.round(m.progress * 100)} %`); } });
    try {
      await w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' });
      const { data } = await w.recognize(cleanForOcr(cv));
      window.__cardText = (window.__cardText || '') + '\n' + (data.text || '');
      return data.text || '';
    }
    finally { await w.terminate(); }
  }
  async function readPdf(file, status) {
    status('Ouverture du PDF…');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const out = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 4); n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: Math.min(3, 2200 / page.getViewport({ scale: 1 }).width) });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      (S.cardImgs = S.cardImgs || []).push(cv.toDataURL('image/jpeg', .7)); render();
      const tc = await page.getTextContent(); const rows = {};
      tc.items.forEach(it => { const y = Math.round(it.transform[5] / 4); (rows[y] = rows[y] || []).push(it); });
      const text = Object.keys(rows).sort((a, b) => b - a).map(y => rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ')).join('\n');
      out.push(text.replace(/\s/g, '').length > 40 ? text : await ocrCanvas(cv, status));
    }
    return out;
  }

  // =====================================================================
  // Interactions
  // =====================================================================
  const bind = {
    login(v) {
      const go2 = async () => {
        const id = $('#loginName').value, ph = $('#loginPhone').value;
        const pl = S.players.find(p => p.id === id);
        const msg = $('#loginMsg');
        if (!pl) { msg.textContent = 'Choisissez votre nom.'; return; }
        $('#loginBtn').disabled = true; msg.textContent = 'Connexion…';
        try { await Store.login(pl, ph); const q = new URLSearchParams(location.search); q.delete('joueur'); location.href = location.pathname + (q.toString() ? '?' + q : ''); }
        catch (e) { msg.textContent = e.message; $('#loginBtn').disabled = false; }
      };
      $('#loginBtn').onclick = go2;
      $('#loginPhone').onkeydown = e => { if (e.key === 'Enter') go2(); };
    },
    players(v) {
      const add = async () => {
        const n = $('#newPlayer').value.trim(); if (!n) return;
        if (S.players.some(p => L.norm(p.name) === L.norm(n))) return toast(`${n} est déjà dans la liste.`);
        const near = duplicateMap(S.players.concat([{ id: '__new', name: n }]))['__new'];
        if (near && S.confirmAdd !== n) { S.confirmAdd = n; return toast(`Ressemble à ${near.join(', ')}. Touchez Ajouter de nouveau pour confirmer.`); }
        S.confirmAdd = null;
        try { const np = await Store.savePlayer(n); const ph = $('#newPhone').value.trim(); if (ph) await Store.setPhone(np, ph); S.players = await Store.listPlayers(); render(); if (ph) inviteText(n, ph, np.id); else setTimeout(() => $('#newPlayer') && $('#newPlayer').focus(), 50); }
        catch (e) { toast('Ajout impossible : ' + e.message); }
      };
      $('#addPlayer').onclick = add;
      $('#newPlayer').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
      v.querySelectorAll('[data-askdel]').forEach(b => b.onclick = () => { S.confirmDel = b.dataset.askdel; render(); });
      v.querySelectorAll('[data-phone]').forEach(b => b.onclick = () => {
        const pl = S.players.find(x => x.id === b.dataset.phone);
        openSheet(`<h3>Téléphone de ${esc(pl.name)}</h3>
          <p class="note">${pl.phone ? `Numéro actuel : <b style="font-size:20px">${esc(fmtPhone(pl.phone))}</b>` : pl.authEmail ? `Numéro actuel : se termine par <b>${esc(pl.phoneHint || '')}</b>. Entrez le numéro complet une fois ci-dessous et touchez Enregistrer : il s’affichera ensuite.` : 'Aucun numéro pour l’instant.'}</p>
          <label>${pl.authEmail ? 'Nouveau numéro' : 'Numéro'}<input id="phIn" type="tel" inputmode="tel" placeholder="450 555-1234" value="${esc(pl.phone ? fmtPhone(pl.phone) : '')}"></label>
          <p class="note">Ce numéro sert de mot de passe pour se connecter. Il est visible seulement par les joueurs connectés.</p>
          ${Store.phonesBlocked ? '<div class="warn">La base refuse de garder les numéros complets : la règle « phones » n’est pas encore publiée dans Firebase (Firestore → Règles).</div>' : ''}
          <div class="row"><button class="btn small" id="phSave" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelector('#phSave').onclick = async () => {
            try { const first = !pl.authEmail, ph = sh.querySelector('#phIn').value; await Store.setPhone(pl, ph); closeSheet(); S.players = await Store.listPlayers(); toast('Téléphone enregistré.'); render(); if (first) inviteText(pl.name, ph, pl.id); }
            catch (e) { toast(e.message.includes('auth/') ? 'Impossible : vérifiez que Email/Password est activé dans Firebase.' : e.message); }
          };
          setTimeout(() => { const i = sh.querySelector('#phIn'); i.focus(); i.select(); }, 50);
        });
      });
      v.querySelectorAll('[data-canceldel]').forEach(b => b.onclick = () => { S.confirmDel = null; render(); });
      v.querySelectorAll('[data-delp]').forEach(b => b.onclick = async () => {
        try { await Store.deletePlayer(b.dataset.delp); S.players = await Store.listPlayers(); S.confirmDel = null; render(); } catch (e) { toast('Retrait impossible : ' + e.message); }
      });
    },
    home(v) { commonNav(v); const lo = $('#logout'); if (lo) lo.onclick = () => Store.logout(); },
    join(v) {
      $('#joinBtn').onclick = () => { const code = $('#code').value.trim().toUpperCase(); if (code) openGame(code); };
      $('#code').onkeydown = e => { if (e.key === 'Enter') $('#joinBtn').click(); };
    },
    live(v) { bind.history(v); },
    history(v) {
      commonNav(v);
      v.querySelectorAll('[data-askdelgame]').forEach(b => b.onclick = () => { S.confirmDelGame = b.dataset.askdelgame; render(); });
      v.querySelectorAll('[data-canceldelgame]').forEach(b => b.onclick = () => { S.confirmDelGame = null; render(); });
      v.querySelectorAll('[data-delgame]').forEach(b => b.onclick = async () => {
        try { await removeGame(b.dataset.delgame, S.historyList.find(x => x.id === b.dataset.delgame)); S.historyList = S.historyList.filter(x => x.id !== b.dataset.delgame); S.confirmDelGame = null; toast('Partie effacée.'); render(); }
        catch (e) { toast('Effacement impossible : ' + e.message); }
      });
    },
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
      $('#cardFile').onchange = async e => {
        const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
        sync();
        const status = t => { S.cardStatus = t; const el = $('#cardStatus'); if (el) el.textContent = t; };
        try {
          const texts = [];
          for (const f of files) {
            if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) texts.push(...await readPdf(f, status));
            else { const cv = await fileToCanvas(f); (S.cardImgs = S.cardImgs || []).push(cv.toDataURL('image/jpeg', .7)); render(); texts.push(await ocrCanvas(cv, status)); }
          }
          const r = L.parseCardText(texts.join('\n'));
          if (r.pars) r.pars.forEach((x, i) => { c.holes[i].par = x; });
          if (r.sis) r.sis.forEach((x, i) => { c.holes[i].si = x; });
          if (r.tees.length) {
            const blank = c.tees.every(t => !String(t.rating).trim() && !String(t.slope).trim());
            if (blank) c.tees = r.tees.map(t => ({ name: t.name, rating: String(t.rating).replace('.', ','), slope: String(t.slope) }));
            else r.tees.forEach(t => { if (!c.tees.some(x => String(x.name).toLowerCase() === t.name.toLowerCase())) c.tees.push({ name: t.name, rating: String(t.rating).replace('.', ','), slope: String(t.slope) }); });
          }
          if (!String(c.name).trim() && r.name) c.name = r.name;
          const ok = x => x ? 'trouvées ✓' : 'à entrer à la main';
          status(`Lecture terminée. Normales : ${ok(r.pars)}. Handicaps : ${r.sis ? 'trouvés ✓' : 'à entrer à la main'}. Tertres : ${r.tees.length ? r.tees.length + ' trouvé' + (r.tees.length > 1 ? 's' : '') + ' ✓' : 'à entrer à la main'}. Vérifiez chaque valeur avec la photo.`);
          render();
        } catch (err) { status('Lecture impossible : ' + (err && err.message || err) + '. Entrez les valeurs à la main en regardant la photo.'); render(); }
      };
      v.querySelectorAll('[data-viewcard]').forEach(b => b.onclick = () => openSheet(`<div class="card-view"><img src="${S.cardImgs[+b.dataset.viewcard]}" alt="Carte"></div><div class="sheet-actions"><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; }));
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
      const refresh = () => {
        $('#pv').innerHTML = previewHtml(d);
        const m = missingList(d);
        $('#missingNote').textContent = m.length ? 'Il manque ' + m.join(', ') + '.' : '';
        $('#create').disabled = m.length > 0;
      };
      $('#course').onchange = e => { d.courseId = e.target.value; render(); };
      d.players.forEach((p, i) => {
        const ps = $('#ps' + i);
        if (ps) ps.onchange = e => {
          const v = e.target.value;
          if (v === '__other') { p.custom = true; p.name = ''; }
          else { p.custom = false; p.name = v; }
          render();
          if (v === '__other') setTimeout(() => $('#pn' + i) && $('#pn' + i).focus(), 50);
        };
        if (!$('#pn' + i)) { $('#pi' + i).oninput = e => { p.index = e.target.value; refresh(); }; $('#pt' + i).onchange = e => { p.tee = e.target.value; refresh(); }; return; }
        $('#pn' + i).oninput = e => { p.name = e.target.value; d.players.forEach((_, j) => { const dl = $('#playerList' + j); if (dl && j !== i) dl.innerHTML = listOptions(d, j); }); refresh(); };
        $('#pn' + i).onchange = e => {
          const n = L.norm(e.target.value);
          if (n && d.players.some((q, j) => j !== i && L.norm(q.name || '') === n)) {
            toast(`${e.target.value.trim()} est déjà choisi.`); p.name = ''; e.target.value = ''; refresh();
            d.players.forEach((_, j) => { const dl = $('#playerList' + j); if (dl) dl.innerHTML = listOptions(d, j); });
          }
        };
        $('#pi' + i).oninput = e => { p.index = e.target.value; refresh(); };
        $('#pt' + i).onchange = e => { p.tee = e.target.value; refresh(); };
      });
      v.querySelectorAll('[name=resp]').forEach(r => r.onchange = () => { d.responsable = +r.value; });
      v.querySelectorAll('[data-tmode]').forEach(b => b.onclick = () => {
        d.teamMode = b.dataset.tmode;
        if (d.teamMode === 'manual' && !d.teams) d.teams = [[0, 1], [2, 3]];
        render();
      });
      const pt = $('#partner'); if (pt) pt.onchange = () => { const j = +pt.value; d.teams = [[0, j], [1, 2, 3].filter(i => i !== j)]; refresh(); };
      ['stake', 'lcv', 'ppt'].forEach(id => { const el = $('#' + id), key = { stake: 'stake', lcv: 'leadChangeValue', ppt: 'perPoint' }[id];
        el.oninput = e => { d[key] = e.target.value; };
        el.onblur = e => { e.target.value = fmtIn(e.target.value); d[key] = e.target.value; };
        el.onfocus = e => { e.target.select(); }; });
      v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { d.mode = b.dataset.mode; v.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); });
      $('#create').onclick = async () => {
        const pv = draftPreview(d);
        if (!pv || !pv.ready) { const m = 'Il manque ' + missingList(d).slice(0, 2).join(' et ') + '.'; toast(m); setReply(m); Voice.say(m); return; }
        if (!d.teamMode) { toast('Choisissez la formation des équipes (étape 7).'); return; }
        const names = pv.ps.map(p => L.norm(p.name));
        if (new Set(names).size < 4) return toast('Le même joueur est choisi deux fois.');
        ls.set('pelland.lastPlayers', d.players);
        const id = await Store.newCode();
        const g = { id, createdAt: Date.now(), ownerUid: Store.uid, course: pv.c, courseId: pv.c.id, mode: d.mode, responsable: d.responsable,
          players: pv.ps, teams: draftTeams(d, pv.ps), teamMode: d.teamMode, stake: money(d.stake), leadChangeValue: money(d.leadChangeValue), perPoint: String(d.perPoint || '').trim() === '' ? 1 : money(d.perPoint), currentHole: 1, scores: {}, events: {}, status: 'en cours' };
        try { await Store.saveGame(g); S.draft = null; openGame(id); toast('Partie créée.'); }
        catch (e) { toast('Création impossible : ' + e.message); }
      };
    },
    game(v) {
      if (!S.game) return;
      v.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
        const h = Math.min(18, Math.max(1, (S.game.currentHole || 1) + +b.dataset.nav));
        if (isOwner()) commit([{ type: 'goto', hole: h }], false); else { S.game.currentHole = h; render(); }
      });
      v.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const [h] = b.dataset.cell.split(':').map(Number); allScoresSheet(h); });
      v.querySelectorAll('[data-allscores]').forEach(b => b.onclick = () => allScoresSheet(+b.dataset.allscores));
      const ac = v.querySelector('[data-askclaim]'); if (ac) ac.onclick = () => { S.confirmClaim = S.game.id; render(); };
      const cc = v.querySelector('[data-cancelclaim]'); if (cc) cc.onclick = () => { S.confirmClaim = null; render(); };
      const cl = v.querySelector('[data-claim]'); if (cl) cl.onclick = async () => {
        const ng = JSON.parse(JSON.stringify(S.game)); ng.ownerUid = Store.uid;
        try { await Store.saveGame(ng); S.game = ng; S.confirmClaim = null; toast('Vous êtes maintenant le responsable de cette partie.'); render(); }
        catch (e) { toast('Impossible : publiez les nouvelles règles Firestore. (' + e.message + ')'); }
      };
      const inv = v.querySelector('[data-invite]'); if (inv) inv.onclick = () => invitePlayers(S.game);
      const fin = v.querySelector('[data-finish]'); if (fin) fin.onclick = async () => {
        const ng = JSON.parse(JSON.stringify(S.game)); ng.status = 'terminée'; ng.finishedAt = Date.now();
        try { await Store.saveGame(ng); S.game = ng; toast('Partie terminée : elle est dans Parties jouées.'); ls.set('pelland.lastGame', null); go('home'); } catch (e) { toast('Impossible de terminer : ' + e.message); }
      };
      const reo = v.querySelector('[data-reopen]'); if (reo) reo.onclick = async () => { const ng = JSON.parse(JSON.stringify(S.game)); ng.status = 'en cours'; delete ng.finishedAt; S.game = ng; render(); await Store.saveGame(ng); };
      const ask = v.querySelector('[data-askdelthis]'); if (ask) ask.onclick = () => { S.confirmDelGame = S.game.id; render(); };
      const can = v.querySelector('[data-canceldelgame]'); if (can) can.onclick = () => { S.confirmDelGame = null; render(); };
      const del = v.querySelector('[data-delthis]'); if (del) del.onclick = async () => {
        const id = S.game.id;
        try { if (S.unwatch) { S.unwatch(); S.unwatch = null; } await removeGame(id); S.confirmDelGame = null; toast('Partie effacée.'); go('home'); } catch (e) { toast('Effacement impossible : ' + e.message); }
      };
      const hh = S.game.currentHole || 1;
      v.querySelectorAll('[data-press-team]').forEach(b => b.onclick = () => commit([{ type: 'press', hole: hh, team: +b.dataset.pressTeam, player: null }]));
      v.querySelectorAll('[data-unpress]').forEach(b => b.onclick = () => commit([{ type: 'unpress', hole: hh }]));
      v.querySelectorAll('[data-reroll-team]').forEach(b => b.onclick = () => commit([{ type: 'reroll', hole: hh, on: b.dataset.rerollTeam === '1' }]));
      v.querySelectorAll('[data-detail]').forEach(r => r.onclick = () => holeDetail(+r.dataset.detail));
      const sm = v.querySelector('[data-sms]'); if (sm) sm.onclick = () => textPlayers(S.game);
      const cs = v.querySelector('[data-confirmsms]'); if (cs) cs.onclick = () => confirmText(S.game);
      v.querySelectorAll('[data-pres]').forEach(b => b.onclick = async () => {
        const g = S.game, mi = myIndex(g); if (mi < 0) return;
        const k = presKey(g.players[mi].name), ok = b.dataset.pres === '1';
        S.presence = { ...(S.presence || {}), [k]: { ok, at: Date.now() } }; render();
        try { await Store.setPresence(g.id, k, ok); toast(b.dataset.pres === '1' ? 'Présence confirmée.' : 'Absence notée.'); }
        catch (e) { S.presenceBlocked = true; render(); }
      });
      v.querySelectorAll('[data-hole]').forEach(b => b.onclick = () => { const h = +b.dataset.hole; if (isOwner()) holeSheet(h); else { S.game.currentHole = h; render(); } });
    }
  };
  function commonNav(v) {
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go, b.dataset.go === 'setup' ? { draft: null } : b.dataset.new ? { editCourse: null } : {}));
    v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openGame(b.dataset.open));
  }

  // Invitation : lien direct vers la partie, envoyé avec le menu Partager de l'iPhone
  function inviteLink(g) { return location.origin + location.pathname + '?partie=' + encodeURIComponent(g.id); } // sans « cadre »
  async function invitePlayers(g) {
    const url = inviteLink(g);
    const others = g.players.filter((p, i) => i !== g.responsable).map(p => p.name.split(' ')[0]).join(', ');
    const text = `Salut ${others} ! Suis la game à Pelland en direct (${g.course.name.replace(/^Club de golf /i, '')}) : `;
    if (navigator.share) {
      try { await navigator.share({ title: 'La game à Pelland', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    openSheet(`<h3>Inviter les joueurs</h3>
      <p class="note">Envoyez ce lien aux autres joueurs. Il ouvre directement la partie sur leur iPhone.</p>
      <input id="invUrl" type="text" readonly value="${esc(url)}">
      <div class="row"><button class="btn small" id="invCopy" type="button">Copier le lien</button>
      <a class="btn ghost small" style="display:grid;place-items:center;text-decoration:none" href="sms:&body=${encodeURIComponent(text + url)}">Texto</a>
      <button class="btn ghost small" data-close type="button">Fermer</button></div>
      <p class="note">Code de la partie : <b class="num" style="font-size:20px;letter-spacing:.15em">${esc(g.id)}</b></p>`, sh => {
      sh.querySelector('#invCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié.'); } catch (e) { const i = sh.querySelector('#invUrl'); i.select(); toast('Lien sélectionné : copiez-le.'); } };
      sh.querySelector('[data-close]').onclick = closeSheet;
    });
  }
  async function removeGame(id, g) {
    // une partie créée par un autre membre (ou avant la connexion par téléphone) : on en devient responsable, puis on l'efface
    if (g && g.ownerUid !== Store.uid) { const ng = JSON.parse(JSON.stringify(g)); ng.ownerUid = Store.uid; await Store.saveGame(ng); }
    await Store.deleteGame(id);
    if (ls.get('pelland.lastGame', null) === id) { ls.set('pelland.lastGame', null); ls.set('pelland.lastGameInfo', null); }
  }
  function openGame(id) {
    if (S.unwatch) S.unwatch();
    S.undo = [];
    S.view = 'game'; S.game = null; S.presence = {}; render();
    if (S.unwatchPres) S.unwatchPres();
    S.unwatchPres = Store.watchPresence(id, p => { S.presenceBlocked = p === null; S.presence = p || {}; if (S.view === 'game' && S.game) render(); });
    let first = true;
    S.unwatch = Store.watchGame(id, g => {
      const keepHole = S.game && !isOwner() ? S.game.currentHole : null;
      S.game = g; if (keepHole && !first) { /* les joueurs suivent le trou du responsable */ }
      first = false; ls.set('pelland.lastGame', id); ls.set('pelland.lastGameInfo', { id, createdAt: g.createdAt, course: g.course.name, players: g.players.map(p => p.name), hole: g.currentHole || 1 }); render();
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
    S.game = next;
    // message court à l'écran
    const sc = actions.find(a => a.type === 'scores' || a.type === 'skin');
    if (sc && !undo) {
      const hh = sc.hole, parts = [];
      const nt = L.holeNetText(next, hh); if (nt) parts.push(`Trou ${hh} · ${nt}`); else parts.push(`Trou ${hh} enregistré`);
      if (L.cabaneTeam(next, hh) != null) parts.push('Cabane !');
      const p3 = L.describePar3(next, hh); if (p3) parts.push(p3.replace(/\.$/, ''));
      parts.push(L.totalText(next).replace(/\.$/, ''));
      say = parts.join(' · ');
    }
    const pr = L.nextPrompt(next);
    S.pending = pr;
    render();
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
    const r = L.parseSetup(rest, d, course || c, S.players.map(p => p.name));
    if (r.create) { $('#create').onclick(); return; }
    S.draft = Object.assign(d, r.draft);
    render();
    let reply = extra + (r.understood ? r.said : (extra ? '' : 'Je n\'ai pas compris. Exemple : « François 12,4, Marc 8,1 ».'));
    if (r.understood || extra) {
      if (r.missing.length) reply += ` Il manque ${r.missing.slice(0, 2).join(' et ')}.`;
      else if (!S.draft.teamMode && /qui joue avec qui/.test(r.said)) { /* on attend la réponse */ }
      else if (!S.draft.teamMode) { const pv = draftPreview(S.draft); reply += ' ' + teamQuestion(S.draft, pv.ps); }
      else reply += ' Tout est prêt. Dites « Créer la partie ».';
    }
    setReply(reply); Voice.say(reply);
  }

  function handle(text) {
    if (S.view === 'setup') return handleSetup(text);
    if (!S.game) return;
    setHeard('« ' + text + ' »');
    // Réponse « oui » / « non » à la question en attente (press, reroll, skin)
    const pend = isOwner() && L.nextPrompt(S.game);
    if (pend) {
      const n = L.norm(text);
      const yes = /^(oui|ouais|ouai|yes|ok|exact|oui oui|affirmatif)\b/.test(n);
      const no = /^(non|nan|no|pas|aucun|aucune|negatif)\b/.test(n) && !/\bpas de (skin|press|reroll)\b/.test(n) || /^non\b/.test(n);
      const who = n.split(' ').map(w => L.matchPlayer(w, S.game.players.map(p => p.name))).filter(i => i >= 0);
      // « équipe 2 » ou un prénom en réponse à la question de la skin
      if (pend.type === 'skin' && !yes && !no && !/\b(qui|combien|quel|quelle|ou en)\b/.test(n)) {
        const tt = /^(?:skin\s+)?(?:pour\s+)?(?:les\s+|l\s+)?(?:equipe\s+)?(1|un|une|2|deux|rouges?|bleu(?:e|s|es)?)$/.test(n) ? L.teamFromText(/^\D*(1|un|une|2|deux)$/.test(n) ? 'equipe ' + n.split(' ').pop() : n) : null;
        const team = tt != null ? tt : (who.length === 1 && !/\d/.test(n)) ? L.getTeams(S.game).findIndex(x => x.includes(who[0])) : null;
        if (team != null) return commit([{ type: 'skin', hole: pend.hole, team, player: tt == null && who.length === 1 ? who[0] : null }]);
      }
      if (yes || no) {
        if (pend.type === 'press') return commit(yes ? (who.length ? who : [null]).map(p => ({ type: 'press', hole: pend.hole, player: p })) : [{ type: 'nopress', hole: pend.hole }]);
        if (pend.type === 'reroll') return commit([{ type: 'reroll', hole: pend.hole, on: !!yes }]);
        if (pend.type === 'skin') {
          if (no) return commit([{ type: 'skin', hole: pend.hole, team: -1 }]);
          const tt = L.teamFromText(n);
          const team = tt != null ? tt : who.length ? L.getTeams(S.game).findIndex(x => x.includes(who[0])) : null;
          if (team == null) { const q = 'Quelle équipe ? Rouges ou Bleus ?'; setReply(q); Voice.say(q); return; }
          return commit([{ type: 'skin', hole: pend.hole, team }]);
        }
      }
    }
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
  // Saisie manuelle : les 4 scores du trou et la skin, en une seule fois.
  // Gain par joueur de l'équipe qui mène : game + revirements + normales 3 (net) + points × $/point
  function leaderMoney(g) {
    const t = L.teamPoints(g).tot, d = Math.abs(t[0] - t[1]), k = t[0] > t[1] ? 0 : 1, o = 1 - k, p3 = L.par3Results(g);
    const stake = money(g.stake), lc = L.leadChanges(g), lcv = money(g.leadChangeValue), pp = g.perPoint == null || g.perPoint === '' ? 1 : money(g.perPoint);
    const parts = [[stake, 'game'], [lc * lcv, `${lc} revirement${lc > 1 ? 's' : ''}`], [p3.money[k] - p3.money[o], 'normales 3'], [d * pp, `${d} pt${d > 1 ? 's' : ''} × ${fmt$(pp)}`]];
    return { t, d, k, tie: t[0] === t[1], parts, tot: parts.reduce((a, x) => a + x[0], 0) };
  }
  // Texto aux joueurs : ouvre Messages avec les numéros et le résumé de la partie
  function smsSummary(g) {
    const m = leaderMoney(g), T = L.getTeams(g);
    const played = Object.keys(g.scores || {}).filter(x => (g.scores[x] || []).some(v => v != null)).map(Number);
    const last = played.length ? Math.max(...played) : 0, done = g.status === 'terminée';
    const date = new Date(g.createdAt || Date.now()).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const lines = [`La game à Pelland – ${g.course.name.replace(/^Club de golf /i, '')}, ${date}`];
    lines.push(done ? 'Résultat final :' : last ? `Après ${last} trou${last > 1 ? 's' : ''} :` : 'La partie commence.');
    if (last) {
      if (m.tie) lines.push(`Égalité, ${m.t[0]} points chacun.`);
      else lines.push(`${L.TEAMS[m.k]} ${done ? 'gagnent' : 'mènent'} par ${m.d} point${m.d > 1 ? 's' : ''} nets (Bleus ${m.t[1]} · Rouges ${m.t[0]}).`, `${done ? 'Gain' : 'Gain en ce moment'} : ${fmt$(m.tot)} par joueur pour les ${L.TEAMS[m.k]}.`);
    }
    lines.push(`Bleus : ${T[1].map(i => g.players[i].name).join(', ')}`, `Rouges : ${T[0].map(i => g.players[i].name).join(', ')}`);
    lines.push(inviteLink(g));
    return lines.join('\n');
  }
  // Texto d'invitation quand on ajoute un joueur avec son téléphone
  function inviteText(name, phone, id) {
    const d = String(phone || '').replace(/\D/g, ''); if (d.length < 10) return;
    openSheet(`<h3>Inviter ${esc(name)}</h3><p class="note">Un texto d’invitation est prêt pour le ${esc(fmtPhone(d))}.</p>
      <div class="row"><button class="btn sms-btn" data-go-sms type="button">Envoyer le texto</button><button class="btn ghost small" data-close type="button">Plus tard</button></div>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('[data-go-sms]').onclick = () => { closeSheet(); inviteSms(name, d, id); };
    });
  }
  function inviteSms(name, d, id) {
    const url = location.origin + location.pathname + (id ? '?joueur=' + encodeURIComponent(id) : '');
    const body = `Salut ${name.split(' ')[0]} ! Tu as été invité à te joindre à la game à Pelland. Ouvre l’app : ${url} — ton nom est déjà choisi, entre seulement ton numéro de téléphone (${fmtPhone(d)}) pour te connecter. Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».`;
    const ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const href = ios ? `sms:/open?addresses=${d}&body=${encodeURIComponent(body)}` : `sms:${d}?body=${encodeURIComponent(body)}`;
    window.__lastSms = href;
    (window.top || window).location.href = href;
  }
  // ---------------- Présences ----------------
  const presKey = name => L.norm(name).replace(/[^a-z0-9]+/g, '-');
  function myIndex(g) { const me = L.norm(ls.get('pelland.me', '') || ''); return g.players.findIndex(p => L.norm(p.name) === me); }
  function presenceHtml(g) {
    const pr = S.presence || {}, started = Object.values(g.scores || {}).some(r => (r || []).some(v => v != null));
    if (started || g.status === 'terminée') return '';
    const mi = myIndex(g), mine = mi >= 0 ? pr[presKey(g.players[mi].name)] : null;
    const order = [...L.getTeams(g)[1], ...L.getTeams(g)[0]];
    const n = order.filter(i => (pr[presKey(g.players[i].name)] || {}).ok === true).length;
    return `<section class="card presence"><h2>Présences <small>${n}/4 confirmés</small></h2>
      <div class="pres-list">${order.map(i => { const x = pr[presKey(g.players[i].name)];
        const st = !x ? ['?', 'En attente', 'wait'] : x.ok ? ['✓', 'Présent', 'yes'] : ['✗', 'Absent', 'no'];
        return `<div class="pres ${st[2]}"><b>${st[0]}</b><span class="tc${teamOf(g, i)}">${esc(g.players[i].name)}</span><small>${st[1]}</small></div>`; }).join('')}</div>
      ${mi >= 0 ? `<div class="row pres-btns"><button class="btn ${mine && mine.ok ? '' : 'ghost'}" data-pres="1" type="button">Je serai là ✓</button><button class="btn ghost ${mine && mine.ok === false ? 'on-no' : ''}" data-pres="0" type="button">Je ne pourrai pas</button></div>` : ''}
      ${isOwner() ? `<button class="btn sms-btn" data-confirmsms type="button" style="margin-top:10px">Texto aux joueurs pour confirmer</button>` : ''}
      ${S.presenceBlocked ? '<div class="warn">Les présences ne peuvent pas être enregistrées : la règle « presence » n’est pas publiée dans Firebase.</div>' : ''}</section>`;
  }
  // À la création d'une partie : texto aux joueurs pour confirmer leur présence
  function confirmText(g) {
    const { nums, missing } = playerNumbers(g); if (!nums.length) return;
    const T = L.getTeams(g);
    const date = new Date(g.createdAt || Date.now()).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const body = [`Tu es inscrit à la game à Pelland – ${g.course.name.replace(/^Club de golf /i, '')}, ${date}.`,
      `Bleus : ${T[1].map(i => g.players[i].name).join(', ')}`, `Rouges : ${T[0].map(i => g.players[i].name).join(', ')}`,
      g.stake ? `La game commence à ${fmt$(money(g.stake))}.` : '',
      `Confirme ta présence : ouvre ${inviteLink(g)} et touche « Je serai là ».`].filter(Boolean).join('\n');
    if (missing.length) toast(`Pas de numéro pour ${missing.join(', ')}.`);
    openSms(nums, body);
  }
  function playerNumbers(g) {
    const me = L.norm(ls.get('pelland.me', '') || ''), nums = [], missing = [];
    g.players.forEach(p => { if (L.norm(p.name) === me) return;
      const lib = (S.players || []).find(x => L.norm(x.name) === L.norm(p.name));
      if (lib && lib.phone) nums.push(lib.phone); else missing.push(p.name); });
    return { nums, missing };
  }
  function openSms(nums, text) {
    const body = encodeURIComponent(text), ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const url = ios ? `sms:/open?addresses=${nums.join(',')}&body=${body}` : `sms:${nums.join(',')}?body=${body}`;
    window.__lastSms = url; (window.top || window).location.href = url;
  }
  function textPlayers(g) {
    const me = L.norm(ls.get('pelland.me', '') || '');
    const nums = [], missing = [];
    g.players.forEach(p => { if (L.norm(p.name) === me) return;
      const lib = (S.players || []).find(x => L.norm(x.name) === L.norm(p.name));
      if (lib && lib.phone) nums.push(lib.phone); else missing.push(p.name); });
    const body = encodeURIComponent(smsSummary(g));
    const ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const url = ios ? `sms:/open?addresses=${nums.join(',')}&body=${body}` : `sms:${nums.join(',')}?body=${body}`;
    if (missing.length) toast(`Pas de numéro complet pour ${missing.join(', ')} : ajoutez-le dans Joueurs.`);
    window.__lastSms = url;
    (window.top || window).location.href = url;
  }
  // Détail d'un trou (en touchant la ligne de calcul sous le trou)
  function holeDetail(h) {
    const g = S.game; if (!g) return;
    const ih = L.holeInfo(g, h, 0), e = (g.events || {})[h] || {}, mult = L.holeMultiplier(g, h);
    const order = [...L.getTeams(g)[1], ...L.getTeams(g)[0]];
    const rows = order.map(pi => { const p = g.players[pi], s = L.getScore(g, h, pi), k = L.strokesOnHole(p.strokes, ih.si);
      return `<tr><td class="tc${teamOf(g, pi)}">${esc(p.name)}</td><td>${s == null ? '—' : s}</td><td>${k > 0 ? BALL.repeat(k) : k < 0 ? '○'.repeat(-k) : '—'}</td><td><b>${s == null ? '—' : s - k}</b></td></tr>`; }).join('');
    const lines = [];
    lines.push(`<b>Statut :</b> ${e.reroll ? 'Reroll (points ×4)' : (e.presses || []).length ? 'Press (points ×2)' : 'Normal'}`);
    const r = L.holePoints(g, h);
    if (r) {
      const v = 2 * r.mult, nm = a => a.map(i => esc(g.players[i].name)).join(' et '), tm = k => `<span class="tc${k}">les ${L.TEAMS[k]}</span>`;
      lines.push(`<b>Point plus bas :</b> ${r.low.team != null ? `${nm(r.low.players)}, net ${r.low.net} : ${v} points pour ${tm(r.low.team)}.` : `égalité au plus bas net (${r.low.net}), pas de points.`}`);
      lines.push(`<b>Point plus haut :</b> ${r.high.team != null ? `${nm(r.high.players)}, net ${r.high.net} : ${v} points pour ${tm(1 - r.high.team)}.` : `égalité au plus haut net (${r.high.net}), pas de points.`}`);
      if (mult > 1) lines.push(`<b>Multiplicateur :</b> ${mult === 4 ? 'reroll, points ×4' : 'press, points ×2'} (déjà compté ci-dessus).`);
    }
    const sk = L.describeSkin(g, h); if (sk) lines.push(`<b>Skin :</b> ${esc(sk)}`);
    const p3 = L.describePar3(g, h); if (p3) lines.push(`<b>Normale 3 :</b> ${esc(p3)}`);
    const hp = L.holeTotal(g, h); if (hp) lines.push(`<b>Résultat du trou :</b> <span class="tc0">Rouges ${hp[0]}</span> · <span class="tc1">Bleus ${hp[1]}</span>`);
    const cum = [0, 0]; for (let x = 1; x <= h; x++) { const t = L.holeTotal(g, x); if (t) { cum[0] += t[0]; cum[1] += t[1]; } }
    if (hp) lines.push(`<b>Après ce trou :</b> ${cum[0] === cum[1] ? 'égalité' : cum[0] > cum[1] ? `<span class="tc0">Rouges ${cum[0]}</span> · Bleus ${cum[1]}` : `<span class="tc1">Bleus ${cum[1]}</span> · Rouges ${cum[0]}`}`);
    openSheet(`<h3>Trou ${h}</h3><p class="note" style="margin-top:-8px">Normale ${ih.par} · Handicap ${ih.si}</p>
      <table class="detail-t"><thead><tr><th>Joueur</th><th>Brut</th><th>Coups</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="detail-lines">${lines.map(l => `<p>${l}</p>`).join('')}</div>
      <p class="note">Calcul abrégé : ${esc(L.calcText(g, h).replace(/^ · /, ''))}</p>
      <div class="sheet-actions"><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  function allScoresSheet(h) {
    const g = S.game, P = g.players;
    const vals = P.map((p, pi) => L.getScore(g, h, pi));
    const st0 = L.skinTeam(g, h);
    let skin = st0 == null ? undefined : st0; // undefined = pas encore dit ; -1 = pas de skin ; 0/1 = équipe
    let skinPlayer = ((g.events || {})[h] || {}).skinPlayer; if (skinPlayer === undefined) skinPlayer = null;
    const T = L.getTeams(g), order = [...T[1], ...T[0]]; // Bleus puis Rouges
    const draw = () => {
      const sheet = $('#sheet');
      // seuls les joueurs à la normale ou mieux (score brut) peuvent avoir la skin
      const eligible = order.filter(pi => vals[pi] != null && vals[pi] <= L.holeInfo(g, h, pi).par);
      if (skinPlayer != null && !eligible.includes(skinPlayer)) { skinPlayer = null; if (skin !== -1) skin = st0 == null ? undefined : st0; }
      const needSkin = vals.some(v => v != null) && skin === undefined;
      sheet.innerHTML = `<h3>Trou ${h} · normale ${L.holeInfo(g, h, 0).par}</h3>
        <div class="allscores">${order.map(pi => { const p = P[pi];
          const par = L.holeInfo(g, h, pi).par, k = L.strokesOnHole(p.strokes, g.course.holes[h - 1].si);
          const lo = Math.max(1, par - 2), hi = lo + 5;
          const opts = []; for (let n = lo; n <= hi; n++) opts.push(n);
          if (vals[pi] != null && !opts.includes(vals[pi])) opts.push(vals[pi]);
          return `<div class="as-row ${vals[pi] != null ? 'done' : ''}"><div class="as-name tc${teamOf(g, pi)}">${esc(p.name)}${k ? ` <small class="as-k">${BALL.repeat(Math.max(0, k))}</small>` : ''}</div>
            <div class="as-opts">${opts.map(n => `<button type="button" class="as-n ${n === par ? 'par' : ''}" data-p="${pi}" data-n="${n}" aria-pressed="${vals[pi] === n}">${n}</button>`).join('')}<button type="button" class="as-n more" data-p="${pi}" data-plus="1" aria-label="Plus">+</button></div></div>`;
        }).join('')}</div>
        <div class="toggles"><div class="tg"><span>Skin à… (joueurs qui ont fait la normale)</span>${eligible.length ? eligible.map(pi => `<button type="button" class="pill team-pill t${teamOf(g, pi)}" data-skinp="${pi}" aria-pressed="${skinPlayer === pi}">${esc(P[pi].name)}</button>`).join('') : `<span class="note" style="width:auto">${vals.every(v => v == null) ? 'Entrez les scores d\'abord.' : 'Personne n\'a fait la normale.'}</span>`}<button type="button" class="pill" data-skinp="-1" aria-pressed="${skin === -1}">Pas de skin</button></div>
        <p class="note">${skin === 0 || skin === 1 ? `Skin pour les ${L.TEAMS[skin]}.` : skin === -1 ? 'Pas de skin.' : 'Skin pas encore indiquée.'}</p></div>
        ${needSkin ? '<p class="warn" style="margin:0">Choisissez la skin (un joueur) ou « Pas de skin » avant d’enregistrer.</p>' : ''}
        <div class="sheet-foot"><button type="button" class="btn ghost small" data-close>Annuler</button><button type="button" class="btn" data-save ${needSkin ? 'disabled' : ''}>Enregistrer</button></div>`;
      sheet.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const pi = +b.dataset.p, n = +b.dataset.n; vals[pi] = vals[pi] === n ? null : n; draw(); });
      sheet.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => { const pi = +b.dataset.p; vals[pi] = (vals[pi] || Math.max(1, L.holeInfo(g, h, pi).par - 2) + 5) + 1; draw(); });
      sheet.querySelectorAll('[data-skinp]').forEach(b => b.onclick = () => {
        const v = +b.dataset.skinp;
        if (v === -1) { skin = -1; skinPlayer = null; } else { skinPlayer = v; skin = teamOf(g, v); }
        draw();
      });
      sheet.querySelector('[data-close]').onclick = closeSheet;
      sheet.querySelector('[data-save]').onclick = () => {
        if (needSkin) return toast('Choisissez la skin ou « Pas de skin ».');
        const scores = {}; vals.forEach((v, pi) => { if (v != null && v !== L.getScore(g, h, pi)) scores[pi] = v; });
        const acts = [];
        if (Object.keys(scores).length) acts.push({ type: 'scores', hole: h, scores });
        if (skin !== undefined && (skin !== st0 || skinPlayer != null)) acts.push({ type: 'skin', hole: h, team: skin, player: skin >= 0 ? skinPlayer : null });
        closeSheet();
        if (acts.length) commit(acts, true);
      };
    };
    openSheet('', () => draw());
  }
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
        <div class="tg"><span>Pressé par</span>${P.map((p, i) => `<button class="pill" data-press="${i}">${esc(p.name)}</button>`).join('')}<button class="pill" data-press="">Sans nom</button><button class="pill" data-nopress aria-pressed="${!!e.noPress}">Pas de press</button>
          ${(e.presses || []).length ? `<button class="pill" data-clearpress>Retirer les pressés (${e.presses.length})</button>` : ''}</div>
        <div class="tg"><span>Reroll</span><button class="pill" data-reroll="1" aria-pressed="${!!e.reroll}">Oui</button><button class="pill" data-reroll="0" aria-pressed="${!!e.rerollSet && !e.reroll}">Non</button></div>
        ${isPar3 ? `<div class="tg"><span>Normale 3</span><span class="note" style="width:auto">Calculée automatiquement : l'équipe qui a la skin et fait la normale gagne l'argent.</span></div>` : ''}
        <div class="tg"><span>Skin (1 point à l'équipe)</span>${[0, 1].map(k => `<button class="pill team-pill t${k}" data-skin="${k}" aria-pressed="${L.skinTeam(g, h) === k}">${L.TEAMS[k]} · ${esc(L.teamName(g, k))}</button>`).join('')}<button class="pill" data-skin="-1" aria-pressed="${L.skinTeam(g, h) === -1}">Pas de skin</button></div>
      </div>
      <button class="btn ghost small" data-close>Fermer</button>`, s => {
      const done = acts => { closeSheet(); commit(acts, false); };
      s.querySelector('[data-goto]').onclick = () => done([{ type: 'goto', hole: h }]);
      s.querySelectorAll('[data-press]').forEach(b => b.onclick = () => done([{ type: 'press', hole: h, player: b.dataset.press === '' ? null : +b.dataset.press }]));
      const cp = s.querySelector('[data-clearpress]'); if (cp) cp.onclick = () => { closeSheet(); S.undo.push(JSON.parse(JSON.stringify(g))); const ng = JSON.parse(JSON.stringify(g)); ng.events[h].presses = []; S.game = ng; render(); Store.saveGame(ng); };
      s.querySelectorAll('[data-reroll]').forEach(b => b.onclick = () => done([{ type: 'reroll', hole: h, on: b.dataset.reroll === '1' }]));
      s.querySelector('[data-nopress]').onclick = () => done([{ type: 'nopress', hole: h }]);
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
    if (Store.needLogin) {
      try { S.players = await Store.listPlayers(); } catch (e) { S.players = []; }
      S.view = 'login'; render(); return;
    }
    // Lien d'invitation (?joueur=…) ouvert par quelqu'un d'autre que la personne connectée : écran de connexion
    const inv = new URLSearchParams(location.search).get('joueur');
    if (inv && Store.mode === 'firebase') {
      let pl = []; try { pl = await Store.listPlayers(); } catch (e) { }
      const target = pl.find(x => x.id === inv);
      if (target && L.norm(target.name) !== L.norm(ls.get('pelland.me', '') || '')) {
        try { await firebase.auth().signOut(); } catch (e) { }
        Store.email = null; Store.uid = null; Store.needLogin = true; S.players = pl; S.view = 'login'; render(); return;
      }
      if (target) history.replaceState(null, '', location.pathname);
    }
    try { S.courses = await Store.listCourses(); } catch (e) { S.courses = [L.PINEGROVE]; }
    try { S.players = await Store.listPlayers(); } catch (e) { S.players = []; }
    const params = new URLSearchParams(location.search);
    const code = (params.get('partie') || params.get('code') || '').toUpperCase();
    if (code) openGame(code);
    else if (params.has('ecoute') || params.has('pelland')) {
      // Ouverture par le raccourci Siri : reprendre la dernière partie et écouter
      const last = ls.get('pelland.lastGame', null);
      if (last) openGame(last); else render();
    } else render();
  })();
})();
