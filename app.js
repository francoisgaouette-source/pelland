/* Fichier assemblé par outils/assembler.js à partir de src/ (src/apps/fanion.json). Ne pas le modifier directement :
   modifier les fichiers de src/, puis lancer « node outils/assembler.js fanion ». */
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
  // ==== src/apps/fanion.json (marque) ====
  const MARQUE = Object.freeze({"id":"fanion","nom":"le fanion.ai","nomMaj":"Le fanion.ai","duNom":"du fanion.ai","nomApp":"Le Fanion","domaine":"fanion.ai","site":"https://lefanion.ai","api":"https://lefanion.ai","courriel":"bonjour@fanion.ai","slogan":"le golf entre amis","accroche":"Le golf entre amis : pointage, jeux et parties à venir.","description":"l’app de golf entre amis","groupeDefaut":"La gang à Pelland","personnage":"Samuel","role":"votre caddie","roleMaj":"Votre caddie","leRole":"le caddie","icone":"L’icône du fanion","logoVue":"0 0 26 30","logo":"<path d=\"M5 2v26\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M6 3l15 5.5L6 14z\" fill=\"#e3a90c\"/>"});
  // ==== src/golf/sport.js ====
  // =====================================================================
  // Contenu propre au golf, lu par le tronc commun (accueil, aperçus, Samuel, textes d'invitation)
  // =====================================================================
  const SPORT = {
    // Tuiles réservées à l'organisateur : explication, aperçu dessiné et fiche
    verrous: {
      courses: 'Réservé à l’organisateur : il ajoute et corrige les terrains du groupe.',
      players: 'Réservé à l’organisateur : il ajoute les joueurs et leur cellulaire.',
      jeux: 'Réservé à l’organisateur : il choisit les jeux, les règles et les montants du groupe.',
      quatuors: 'Réservé à l’organisateur : il offre les dates et forme les quatuors. Vous répondez avec le lien reçu par texto.',
      setup: 'Réservé à l’organisateur : il crée les parties. Vous les suivez en direct dans Parties en cours.',
    },
    apercus: {
      players: () => `<div class="mk mk-list">${[['Marc Lavoie', 'ok', 'Compte créé'], ['Julie Roy', 'ok', 'Compte créé'], ['Éric Gagnon', 'wait', 'Invité']].map(([n, c, t]) =>
      `<div class="mk-row"><span class="mk-av">${n.split(' ').map(x => x[0]).join('')}</span><b>${n}</b><span class="mk-pill ${c}">${t}</span></div>`).join('')}<div class="mk-add">+ Ajouter un joueur et son cellulaire</div></div>`,
      quatuors: () => `<div class="mk mk-offre"><div class="mk-date"><b>Samedi 14 juin, 8 h</b><span>Pinegrove</span></div>
      <div class="mk-yes">${['Marc', 'Julie', 'Éric', 'Luc', 'Ana', 'Paul', 'Guy', 'Bob'].map(n => `<span>${n}</span>`).join('')}</div>
      <div class="mk-q"><span>Quatuor 1 : Marc, Julie, Éric, Luc</span><span>Quatuor 2 : Ana, Paul, Guy, Bob</span></div></div>`,
      setup: () => `<div class="mk mk-setup"><div class="mk-f"><span>Terrain</span><b>Pinegrove, tertres blancs</b></div><div class="mk-f"><span>Jeu</span><b>La game à Pelland</b></div>
      <div class="mk-teams"><div class="r"><b>Rouges</b>Marc et Paul</div><div class="b"><b>Bleus</b>Julie et Luc</div></div><div class="mk-f"><span>La game commence à</span><b>10 $</b></div></div>`,
      courses: () => `<div class="mk mk-course"><b>Pinegrove</b><span>Saint-Jean-sur-Richelieu, normale 72</span>
      <div class="mk-holes">${[5, 3, 4, 4, 5, 3, 5, 3, 4, 4, 5, 3, 5, 4, 3, 4, 4, 4].map((p, i) => `<i><small>${i + 1}</small>${p}</i>`).join('')}</div></div>`,
      jeux: () => `<div class="mk mk-jeu"><b>La game à Pelland</b><ul><li>Plus bas net du trou : 2 points</li><li>Skin, oiselet, press et reroll</li></ul>
      <div class="mk-money"><span>Départ <b>10 $</b></span><span>Revirement <b>5 $</b></span><span>Normale 3 <b>5 $</b></span></div></div>`,
    },
    apercuInfos: {
      players: { t: 'Inviter des joueurs', d: 'L’organisateur ajoute chaque joueur avec son cellulaire ; l’invitation part par texto.', you: 'Vous avez reçu cette invitation : votre compte est créé.' },
      quatuors: { t: 'Parties à préparer', d: 'L’organisateur offre des dates ; l’app voit qui est disponible et forme les quatuors.', you: 'Vous recevez un texto avec un lien : cochez vos dates, c’est tout.' },
      setup: { t: 'Créer une partie', d: 'Terrain, joueurs, équipes, jeu et montants : l’organisateur lance la partie et entre les scores.', you: 'Vous suivez la partie en direct dans Parties en cours.' },
      courses: { t: 'Banque de terrains', d: 'Les terrains du groupe, avec leurs normales, la difficulté de chaque trou et leurs tertres.', you: 'Les coups de handicap de chacun en découlent automatiquement.' },
      jeux: { t: 'Banque de jeux', d: 'Les règles et les montants de chaque jeu : la game à Pelland, Nassau, Vegas, skins, Wolf…', you: 'Les règles détaillées sont aussi sur lefanion.ai/regles.' },
    },
    // Accueil du participant
    bienvenueVous: `          <li><b>Répondre aux dates</b> avec le lien reçu par texto.</li>
          <li><b>Suivre les parties en direct</b> : scores, points et argent, trou par trou.</li>
          <li><b>Revoir les parties jouées</b> et qui doit quoi à qui.</li>
          <li><b>Voir le classement</b> des compétitions.</li>
          <li><b>Poser vos questions</b> à Samuel, votre caddie : touchez son visage dans le coin.</li>`,
    bienvenueOrg: '<li>Inviter les joueurs</li><li>Offrir les dates et former les quatuors</li><li>Créer les parties</li><li>Gérer les terrains et les jeux</li>',
    // Bien démarrer
    etapeJoueurs: n => `${n} joueur${n > 1 ? 's' : ''} avec cellulaire : il en faut 3 pour un premier quatuor.`,
    etapeOffre: 'Vos joueurs répondent par texto ; l’app forme les quatuors.',
    etapePartie: 'Choisissez le terrain et le jeu ; l’app compte tout, en direct.',
    // Samuel
    ecrans: { home: 'Accueil', players: 'Inviter des joueurs', quatuors: 'Parties à préparer', setup: 'Créer une partie', jeux: 'Banque de jeux', courses: 'Banque de terrains', live: 'Parties en cours', history: 'Parties et compétitions jouées', comps: 'Banque de compétitions', compte: 'Mon compte' },
    questionsLeo: ['Comment inviter mes joueurs ?', 'Comment marche la press ?', 'Combien coûte le forfait Groupe ?'],
    leoAccueil: 'Posez-moi vos questions sur l’app, les règles des jeux ou les forfaits.',
    visite: nom => [
      { puce: 'Bonjour !', titre: `Bienvenue${nom ? ', ' + nom : ''} ! Moi, c’est Samuel, votre caddie.`, texte: `Je vous fais faire le tour de « ${groupName()} » en six coups. Ça prend une minute.` },
      { puce: 'Étape 1', titre: 'Inviter des joueurs', texte: 'Le nom et le cellulaire de chacun : l’invitation part par texto. Chaque joueur crée son compte une fois, pour tous ses groupes.' },
      { puce: 'Étape 2', titre: 'Parties à préparer', texte: 'Offrez quelques dates. Chacun coche les siennes, et je forme les quatuors à la date butoir.' },
      { puce: 'Étapes 3 et 4', titre: 'Créer une partie, la suivre en direct', texte: 'Terrain, équipes, jeu et montants. Un joueur entre les scores ; les autres suivent la partie sur leur téléphone.' },
      { puce: 'Étapes 5 et 6', titre: 'Compétitions et résultats', texte: 'Membre-membre, membre-invité, scrambles, Coupe Ryder ou tableau à élimination, avec le classement en direct. À la fin, je dis qui doit quoi à qui.' },
      { puce: 'Les banques', titre: 'Joueurs, terrains, jeux, compétitions', texte: 'Tout ce que le groupe bâtit reste là pour la prochaine saison : vos terrains, vos jeux maison, vos formats.' },
    ],
    // Textes
    parrainage: app => `On organise notre golf avec ${app} : invitations par texto, quatuors, pointage et gageures calculées. Crée ton groupe, c’est gratuit pour un quatuor :`,
    avisExemple: 'ex. Plus besoin de 40 textos pour former les quatuors.',
    lieuExemple: 'ex. Golf Simulateur Laval, baies 2 et 3',
    amiJoueur: 'un ami golfeur',
    autreGroupe: 'un autre groupe de golf',
    gratuitPour: 'un quatuor',
    quatuors: 'quatuors',
    atouts: 'invitations par texto, quatuors, pointage et argent calculés',
    vueDates: 'quatuors',
    vuePartie: 'setup',
    leoBouton: 'Parties à préparer',
    leoProchaine: 'Prêt pour la prochaine ronde ? Offrez des dates et je forme les quatuors.',
  };
  // ==== src/commun/base.js ====

  // =====================================================================
  // Base de données : Supabase (projet « Le Fanion ») avec le compte HoldingAI ; sinon stockage local
  // Connexion : « Continuer avec HoldingAI » (holdingai.js). La base reçoit le jeton HoldingAI ; ses règles lisent
  // auth.jwt()->>'sub' (le compte) et son cellulaire confirmé. Voir supabase/LISEZMOI.md.
  // Hors ligne : les parties sont gardées sur le téléphone et envoyées au retour du réseau (file d'attente).
  // =====================================================================
  const CFG = window.FANION_CONFIG || window.APP_CONFIG || {};
  // Lignes de la base → objets de l'app (mêmes champs qu'avant)
  const rowGroupe = r => ({ ...(r.data || {}), id: r.id, owner: r.owner || '', organizers: r.organizers || [], ...(r.plan ? { plan: r.plan } : {}),
    ...(r.paid_until ? { paidUntil: Number(r.paid_until) } : {}), ...(r.max_joueurs ? { maxJoueurs: r.max_joueurs } : {}),
    nPlayers: r.n_players, archived: !!r.archived, deleted: !!r.deleted });
  const rowJoueur = r => ({ ...(r.data || {}), id: r.id, groupId: r.group_id, ...(r.acct ? { acct: r.acct } : {}), ...(r.auth_email ? { authEmail: r.auth_email } : {}) });
  const ok = ({ data, error }) => { if (error) throw Object.assign(new Error(error.message || 'Erreur de la base'), { code: error.code }); return data; };
  const Store = {
    mode: 'local', uid: null, sb: null, error: '',
    async init() {
      if (!CFG.supabaseUrl || !window.supabase || !window.HoldingAI) {
        this.error = !window.supabase ? 'Les outils de la base n’ont pas pu se charger (réseau ou bloqueur de contenu).' : 'Configuration manquante (config.js).';
      } else {
        try {
          this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { accessToken: async () => (await HoldingAI.jeton()) || null });
          this.mode = 'cloud';
          // Le compte suit : sans session, on passe chez Philippe (compte.letabli.ai), qui ramène la personne connectée
          // Installation obligatoire sur téléphone : on ne passe chez Philippe qu'une fois l'app installée (iPhone : l'app installée ne garde pas la connexion faite dans Safari)
          const dep = await HoldingAI.demarrer({ obligatoire: !window.FANION_INSTALL_REQUISE });
          if (dep.redirection) { this.redirecting = true; return; }
          if (dep.erreur) toast(dep.erreur.message);
          // Hors ligne sur le terrain avec un jeton expiré : on garde le compte connu (le jeton sera renouvelé au retour du réseau)
          if (!dep.session && navigator.onLine === false) { try { const j = JSON.parse(localStorage.getItem('hai.jetons') || 'null'), c = j && j.access && JSON.parse(decodeURIComponent(escape(atob(j.access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); if (c && c.sub) dep.session = { uid: c.sub, phone: c.phone || '', email: c.email || '', nom: (c.user_metadata || {}).nom || '' }; } catch (e) { } }
          if (dep.session) this.setUser(dep.session); else this.needLogin = true;
        } catch (e) { console.error(e); this.mode = 'local'; this.error = 'Base injoignable : ' + (e.message || e); toast('Base partagée injoignable : mode local.'); }
      }
      if (this.mode === 'local') {
        this.uid = ls.get('pelland.uid', null) || ('local-' + Math.random().toString(36).slice(2, 10));
        ls.set('pelland.uid', this.uid);
      }
      if (this.mode === 'cloud' && !this.needLogin) {
        // Compte relié à aucun joueur : on reste connecté, mais il faut un groupe (invitation ou nouveau groupe)
        const m = await this.ensureMember();
        if (m === false) { this.noGroup = true; this.needLogin = true; }
        if (this.flush) { this.flush(); window.addEventListener('online', () => this.flush()); }
      }
    },
    // ---------- Compte (HoldingAI) ----------
    phoneE164(phone) { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10) d = '1' + d; return d.length === 11 ? '+' + d : ''; },
    setUser(s) { this.uid = s ? s.uid : null; this.e164 = s ? this.phoneE164(s.phone) || null : null; this.email = s ? (s.email || this.e164 || s.uid) : null; this.nom = s ? s.nom || '' : ''; },
    async token() { return window.HoldingAI ? await HoldingAI.jeton() : null; },
    async ensureMember(player) {
      if (this.mode !== 'cloud' || !this.uid) return;
      try {
        if (player) { await this.linkTo(player); return true; }
        const inv = new URLSearchParams(location.search).get('joueur');
        const l = ok(await this.sb.from('liens').select('player_id, group_id').eq('uid', this.uid).maybeSingle());
        const mine = (!l || inv) ? await this.myPlayers() : [];
        // Invitation reçue (?joueur=…) : on se relie à ce joueur-là si c'est bien notre cellulaire
        const cible = inv && mine.find(p => p.id === inv);
        if (cible) { await this.linkTo(cible); return true; }
        if (l) {
          if (this.gid !== l.group_id) this.setGroup(l.group_id);
          // Nouvel appareil : on retrouve le nom de « mon » joueur (sert à savoir qui je suis dans le groupe)
          try { const j = ok(await this.sb.from('joueurs').select('data').eq('id', l.player_id).maybeSingle()); if (j && j.data && j.data.name) ls.set('pelland.me', j.data.name); } catch (e) { }
          return true;
        }
        if (mine.length) { await this.linkTo(mine[0]); return true; }
        return false;
      } catch (e) { console.warn('membre', e.message); return null; }
    },
    // Tous les joueurs (un par groupe) inscrits avec le cellulaire de ce compte
    async myPlayers() {
      if (this.mode !== 'cloud' || !this.e164) return [];
      const rows = ok(await this.sb.rpc('mes_groupes')) || [];
      this._mesGroupes = rows;
      return rows.map(r => ({ ...(r.joueur || {}), id: r.player_id, groupId: r.group_id, ...(r.acct ? { acct: r.acct } : {}) }));
    },
    async myGroupList() {
      if (this.mode !== 'cloud') { const gs = await this.listGroups(); return this.myGroups().map(x => ({ ...x, name: (gs.find(g => g.id === x.gid) || {}).name || x.name })); }
      const pl = await this.myPlayers(), rows = this._mesGroupes || [];
      return pl.map(p => { const r = rows.find(x => x.player_id === p.id) || {}, g = r.groupe || {};
        const orgs = r.organizers || [];
        return { gid: p.groupId, name: g.name || p.groupId, playerId: p.id, playerName: p.name, owner: r.owner === p.id, organizer: orgs.includes(p.id) || (r.owner === p.id && !orgs.length), archived: !!r.archived, deleted: !!r.deleted }; })
        .filter(x => !x.deleted).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    // Archiver, rétablir ou supprimer le groupe actif (propriétaire seulement ; vérifié par la base)
    async setGroupState(flags) {
      if (this.mode === 'cloud') { ok(await this.sb.rpc('groupe_etat', { p_id: this.gid, p_archived: flags.archived == null ? null : !!flags.archived, p_deleted: flags.deleted == null ? null : !!flags.deleted })); return; }
      const all = ls.get('pelland.groups', {}); all[this.gid] = { ...(all[this.gid] || { id: this.gid }), ...flags }; ls.set('pelland.groups', all);
    },
    // Rend ce joueur (et son groupe) actif pour ce compte
    async linkTo(player) {
      let g = player.groupId || 'pelland';
      if (this.mode === 'cloud') {
        try { g = ok(await this.sb.rpc('relier_joueur', { p_joueur: player.id })) || g; }
        catch (e) { throw Object.assign(new Error('Votre cellulaire n’est pas celui inscrit pour ' + player.name + '. Demandez à l’organisateur de le vérifier dans Joueurs.'), { code: 'local/nolink' }); }
      }
      this.setGroup(g); if (player.name) ls.set('pelland.me', player.name);
    },
    async logout() { if (window.HoldingAI) HoldingAI.deconnexion(); ls.set('pelland.me', null); location.href = location.pathname; },
    // Ajoute ou change le cellulaire d'un joueur. Le joueur se connecte ensuite avec son compte HoldingAI (même cellulaire).
    async setPhone(player, phone) {
      const digits = String(phone || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
      if (digits.length !== 10) throw new Error('Numéro de cellulaire invalide (10 chiffres).');
      if (this.mode !== 'cloud') { const list = ls.get('pelland.players', []); const x = list.find(q => q.id === player.id); if (x) { x.phoneHint = digits.slice(-2); x.phone = digits; } ls.set('pelland.players', list); return; }
      await this.savePhone(player.id, digits, true, player.groupId || this.gid);
      ok(await this.sb.rpc('joueur_maj', { p_id: player.id, p_patch: { phoneHint: digits.slice(-2) } }));
    },
    async savePhone(id, digits, strict, groupId) {
      const r = await this.sb.from('telephones').upsert({ player_id: id, group_id: groupId || this.gid, phone: digits, e164: this.phoneE164(digits) });
      if (r.error) { console.warn('telephones', r.error.message); this.phonesBlocked = true; if (strict) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Ce cellulaire est déjà inscrit.' : 'Numéro non conservé : ' + r.error.message); }
      else this.phonesBlocked = false;
    },
    // ---- Nouveaux terrains : proposés par les joueurs, approuvés par l'équipe Fanion (table admins) avant d'entrer dans la banque commune
    async isAdmin() {
      if (this.mode !== 'cloud') return !!ls.get('pelland.admin', false);
      try { return !!ok(await this.sb.from('admins').select('uid').eq('uid', this.uid).maybeSingle()); } catch (e) { return false; }
    },
    // ---- Parties : copie sur le téléphone + file d'attente (hors ligne sur le terrain), envoyées dès que possible
    // Temps réel : changements de la base (autres joueurs) + nos propres enregistrements (immédiats, même hors ligne)
    // Groupes : chaque groupe a ses joueurs, parties, dates et quatuors (les terrains sont communs). Pelland = premier groupe.
    get gid() { return ls.get('pelland.group', 'pelland') || 'pelland'; },
    setGroup(id) { ls.set('pelland.group', id || 'pelland'); },
    async listGroups() {
      let list = [];
      if (this.mode === 'cloud') { try { list = (ok(await this.sb.from('groupes').select('*')) || []).map(rowGroupe); } catch (e) { } }
      else list = Object.values(ls.get('pelland.groups', {}));
      if (!list.find(g => g.id === 'pelland') && this.mode !== 'cloud') list.push({ id: 'pelland', name: MARQUE.groupeDefaut });
      return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
    },
    async saveGroup(gr) {
      if (this.mode === 'cloud') {
        // forfait, compteur et état : gérés par la base (et par Fanion pour le forfait)
        const { id, owner, organizers, plan, paidUntil, maxJoueurs, nPlayers, lastAdd, lastDel, archived, deleted, ...rest } = gr;
        ok(await this.sb.rpc('groupe_maj', { p_id: id, p_patch: rest, p_owner: owner == null ? null : owner, p_organizers: organizers == null ? null : organizers }));
        return;
      }
      const all = ls.get('pelland.groups', {}); all[gr.id] = gr; ls.set('pelland.groups', all);
    },
    // Mes groupes (sur ce téléphone) : un joueur peut faire partie de plusieurs groupes
    myGroups() { return ls.get('pelland.mygroups', []); },
    rememberGroup(gid, name, playerId, playerName, owner) {
      if (!gid || !playerId) return;
      const all = this.myGroups(), old = all.find(x => x.gid === gid) || {}, l = all.filter(x => x.gid !== gid);
      l.unshift({ gid, name: name || old.name || gid, playerId, playerName: playerName || '', owner: !!(owner || old.owner) });
      ls.set('pelland.mygroups', l.slice(0, 12));
    },
    async switchGroup(entry) {
      if (this.mode !== 'cloud') { ls.set('pelland.me', entry.playerName || ls.get('pelland.me', '')); this.setGroup(entry.gid); return; }
      await this.linkTo({ id: entry.playerId, name: entry.playerName, groupId: entry.gid });
    },
    // Parrainage : ?ref=<code> (un groupe ou un centre) est gardé 90 jours sur ce téléphone, puis noté sur le groupe créé
    refCode() { const r = ls.get('pelland.ref', null); return r && r.until > Date.now() ? r.code : ''; },
    // Le groupe gratuit que ce compte possède déjà (non supprimé, sans forfait Groupe en cours), ou null
    async groupeGratuit() {
      if (this.mode !== 'cloud') return null;
      try {
        await this.myPlayers();
        const r = (this._mesGroupes || []).find(x => x.owner === x.player_id && !x.deleted && !planOf({ plan: x.plan, paidUntil: x.paid_until, maxJoueurs: x.max_joueurs }).paid);
        return r ? { id: r.group_id, name: (r.groupe || {}).name || r.group_id } : null;
      } catch (e) { return null; }
    },
    // Nouveau groupe, créé par la personne connectée (son compte HoldingAI a son cellulaire confirmé)
    async createGroup(groupName, name, ref) {
      if (!String(groupName || '').trim()) throw new Error('Donnez un nom au groupe.');
      if (!String(name || '').trim()) throw new Error('Entrez votre prénom et nom.');
      const pid = slug(name) + '-' + Math.random().toString(36).slice(2, 6);
      const gr = { id: slug(groupName) + '-' + Math.random().toString(36).slice(2, 6), name: groupName.trim(), owner: pid, createdAt: Date.now(), nPlayers: 1 };
      const rc = String(ref || this.refCode() || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 60); if (rc) gr.ref = rc;
      if (this.mode === 'cloud') {
        if (!this.uid || !this.e164) throw new Error('Votre compte L’Établi doit avoir un cellulaire confirmé. Ouvrez « Mon compte » chez Philippe.');
        // Forfait Gratuit : un seul groupe gratuit par compte (vérifié par la base)
        const gratuit = await this.groupeGratuit();
        if (gratuit) throw Object.assign(new Error(`Avec le forfait Gratuit, vous avez droit à un groupe de 4 joueurs : vous avez déjà « ${gratuit.name} ». Passez ce groupe au forfait Groupe pour en créer un autre.`), { code: 'local/gratuit' });
        try { await this.sb.from('gratuits').delete().eq('uid', this.uid); } catch (e) { }
        const { id, owner, nPlayers, ...gdata } = gr;
        ok(await this.sb.rpc('creer_groupe', { p_groupe: gr.id, p_joueur: pid, p_donnees_groupe: gdata,
          p_donnees_joueur: { id: pid, name: name.trim(), phoneHint: this.e164.slice(-2), updatedAt: Date.now() } }));
      } else { await this.saveGroup(gr); const list = ls.get('pelland.players', []); list.push({ id: pid, name: name.trim(), groupId: gr.id, authEmail: 'local', acct: 'local' }); ls.set('pelland.players', list); }
      this.setGroup(gr.id); this.needLogin = false; this.noGroup = false; ls.set('pelland.me', name.trim());
      if (this.ensureSeed) await this.ensureSeed();
      return gr;
    },
    // Membres du groupe (par défaut) ; avec bank = true, toute la banque de joueurs du groupe (membres et non-membres)
    async listPlayers(all, bank) {
      const mine = p => (all || (p.groupId || 'pelland') === this.gid) && (bank || all || p.membre !== false);
      if (this.mode === 'cloud') {
        let q = this.sb.from('joueurs').select('id, group_id, acct, auth_email, data'); if (!all) q = q.eq('group_id', this.gid);
        const list = (ok(await q) || []).map(rowJoueur).filter(mine);
        try { const ph = ok(await this.sb.from('telephones').select('player_id, phone').eq('group_id', this.gid)) || []; const m = {}; ph.forEach(x => { m[x.player_id] = x.phone; }); list.forEach(p => { if (m[p.id]) p.phone = m[p.id]; }); this.phonesBlocked = false; } catch (e) { this.phonesBlocked = true; }
        return list.sort(byName);
      }
      return ls.get('pelland.players', []).filter(mine).sort(byName);
    },
    // Données privées du groupe (quatuors, jeux maison, terrains et joueurs retirés) : table donnees_groupe
    async gdata() {
      try { const r = ok(await this.sb.from('donnees_groupe').select('data').eq('group_id', this.gid).maybeSingle()); return r ? r.data : null; } catch (e) { return null; }
    },
    async setGdata(field, list) { ok(await this.sb.rpc('donnees_maj', { p_group: this.gid, p_patch: { groupId: this.gid, [field]: list, updatedAt: Date.now() } })); },
    // Demandes d'ajout de jeux : table demandes (envoi seulement ; lues par l'équipe Fanion)
    // Jeux maison du groupe
    // Offres de parties : { id, groupId, course, dates:[ms], deadline:ms, by, createdAt, rep_<joueur>: { name, dates:[ms], at } }
    async listOffres() {
      if (this.mode === 'cloud') {
        try { return (ok(await this.sb.from('offres').select('id, data').eq('group_id', this.gid)) || []).map(r => ({ ...(r.data || {}), id: r.id })).sort((a, b) => b.createdAt - a.createdAt); } catch (e) { return []; }
      }
      return Object.values(ls.get('pelland.offres', {})).filter(o => (o.groupId || 'pelland') === this.gid).sort((a, b) => b.createdAt - a.createdAt);
    },
    async getOffre(id) {
      if (this.mode === 'cloud') { try { const r = ok(await this.sb.from('offres').select('id, group_id, data').eq('id', id).maybeSingle()); return r ? { ...(r.data || {}), id: r.id, groupId: r.group_id } : null; } catch (e) { return null; } }
      return ls.get('pelland.offres', {})[id] || null;
    },
    async saveOffre(o, merge) {
      if (this.mode === 'cloud') { const g = o.groupId || this.gid; ok(await this.sb.rpc('offre_maj', { p_id: o.id, p_group: g, p_patch: { ...o, groupId: g } })); return; }
      const all = ls.get('pelland.offres', {}); all[o.id] = merge ? { ...(all[o.id] || {}), ...o } : o; ls.set('pelland.offres', all);
    },
    async deleteOffre(id) {
      if (this.mode === 'cloud') { ok(await this.sb.from('offres').delete().eq('id', id)); return; }
      const all = ls.get('pelland.offres', {}); delete all[id]; ls.set('pelland.offres', all);
    },
    async listBank() { return this.listPlayers(false, true); },
    // Membre du groupe ou seulement dans la banque (choisi par l'organisateur parmi les joueurs confirmés)
    async setMembre(id, on) {
      if (this.mode === 'cloud') { ok(await this.sb.rpc('joueur_maj', { p_id: id, p_patch: { membre: !!on, updatedAt: Date.now() } })); return; }
      ls.set('pelland.players', ls.get('pelland.players', []).map(x => x.id === id ? { ...x, membre: !!on } : x));
    },
    // Ajout à la banque de joueurs (le compteur du groupe est tenu par la base : 64 au plus)
    async savePlayer(name, count, membre = false) {
      const p = { id: slug(name) + '-' + Math.random().toString(36).slice(2, 6), name: name.trim(), groupId: this.gid, membre: !!membre, updatedAt: Date.now() };
      if (this.mode === 'cloud') {
        const r = await this.sb.from('joueurs').insert({ id: p.id, group_id: this.gid, data: p });
        if (r.error) throw /64|maximum/i.test(r.error.message) ? new Error('La banque du groupe est pleine (64 joueurs).') : /row-level|violates/i.test(r.error.message) ? new Error('Seul le propriétaire du groupe ajoute des joueurs.') : new Error(r.error.message);
        return p;
      }
      const list = ls.get('pelland.players', []); list.push(p); ls.set('pelland.players', list); return p;
    },
    async renamePlayer(id, name) {
      if (this.mode === 'cloud') { ok(await this.sb.rpc('joueur_maj', { p_id: id, p_patch: { name: name.trim(), updatedAt: Date.now() } })); return; }
      ls.set('pelland.players', ls.get('pelland.players', []).map(x => x.id === id ? { ...x, name: name.trim() } : x));
    },
    // Joueurs retirés du groupe : gardés dans la banque (nom, cellulaire) pour les remettre en un geste
    async retiredPlayers() {
      if (this.mode === 'cloud') { const g = await this.gdata(); return (g && g.joueursRetires) || []; }
      return ls.get('pelland.joueursRetires', []);
    },
    async setRetiredPlayers(list) {
      if (this.mode === 'cloud') return this.setGdata('joueursRetires', list);
      ls.set('pelland.joueursRetires', list);
    },
    async keepInBank(p) {
      if (!p) return;
      let phone = p.phone || '';
      if (!phone && this.mode === 'cloud') { try { const r = ok(await this.sb.from('telephones').select('phone').eq('player_id', p.id).maybeSingle()); if (r) phone = r.phone || ''; } catch (e) { } }
      const l = (await this.retiredPlayers()).filter(x => x.name.toLowerCase() !== p.name.toLowerCase());
      l.unshift({ name: p.name, phone, retireLe: Date.now() });
      // Banque de joueurs : 64 au plus (joueurs du groupe + retirés) ; au-delà, les plus anciens retirés sont oubliés
      await this.setRetiredPlayers(l.slice(0, Math.max(0, BANQUE_MAX - (S.players || []).length + 1)));
    },
    async deletePlayer(id) {
      if (this.mode === 'cloud') {
        const r = ok(await this.sb.from('joueurs').delete().eq('id', id).select('id'));
        if (!r || !r.length) throw new Error('Seul le propriétaire du groupe retire des joueurs.');
        return;
      }
      ls.set('pelland.players', ls.get('pelland.players', []).filter(x => x.id !== id));
    },
    _subs: {},
    _emit(g) { (this._subs[g.id] || []).forEach(cb => cb(g)); },
    watch(table, col, id, cb) {
      const ch = this.sb.channel(table + ':' + id + ':' + Math.random().toString(36).slice(2, 7))
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: col + '=eq.' + id }, p => { if (p.new && Object.keys(p.new).length) cb(p.new); })
        .subscribe();
      return () => { try { this.sb.removeChannel(ch); } catch (e) { } };
    },
    // Présences : { cléJoueur: { ok: true|false, at } } par partie ; chaque membre écrit sa propre réponse
    watchPresence(id, cb) {
      if (this.mode === 'cloud') {
        this.sb.from('presences').select('data').eq('game_id', id).maybeSingle().then(r => cb(r.error ? null : (r.data ? r.data.data : {})));
        return this.watch('presences', 'game_id', id, r => cb(r.data || {}));
      }
      const read = () => cb(ls.get('pelland.presence', {})[id] || {}); read();
      const on = e => { if (e.key === 'pelland.presence') read(); }; window.addEventListener('storage', on);
      this._presSubs = (this._presSubs || []).concat([[id, read]]);
      return () => { window.removeEventListener('storage', on); this._presSubs = (this._presSubs || []).filter(x => x[1] !== read); };
    },
    async setPresence(id, key, yes) {
      const v = { ok: yes, at: Date.now() };
      if (this.mode === 'cloud') { ok(await this.sb.rpc('presence_maj', { p_partie: id, p_cle: key, p_valeur: v })); return; }
      const all = ls.get('pelland.presence', {}); all[id] = { ...(all[id] || {}), [key]: v }; ls.set('pelland.presence', all);
      (this._presSubs || []).forEach(([gid, f]) => { if (gid === id) f(); });
    },
    async listPresence(ids) {
      if (this.mode === 'cloud') { const m = {}; if (!(ids || []).length) return m; try { (ok(await this.sb.from('presences').select('game_id, data').in('game_id', ids)) || []).forEach(r => { m[r.game_id] = r.data; }); } catch (e) { } return m; }
      return ls.get('pelland.presence', {});
    },
    // Avis des joueurs : un par compte ; publié seulement si approuvé par l'équipe Fanion
    async getAvis() {
      if (this.mode !== 'cloud' || !this.uid) return ls.get('fanion.avis', null);
      try { const r = ok(await this.sb.from('avis').select('*').eq('uid', this.uid).maybeSingle()); return r ? { stars: r.stars, text: r.text, name: r.name, groupName: r.group_name, ok: r.ok, at: Number(r.at) } : null; } catch (e) { return null; }
    },
    async saveAvis(a) {
      if (this.mode !== 'cloud' || !this.uid) { ls.set('fanion.avis', a); return; }
      ok(await this.sb.from('avis').upsert({ uid: this.uid, stars: a.stars, text: String(a.text || '').slice(0, 280), name: String(a.name || '').slice(0, 40), group_name: String(a.groupName || '').slice(0, 60), ok: !!a.ok, at: a.at || Date.now() }));
    },
    // Compétitions : { groupId, format, name, date, course, tee, allowance, flights, teams:[…], scores:{ <équipe>: { <trou>: [s1, s2] } } }
    // Un score à la fois, fusionné, pour que deux équipes puissent entrer leurs scores en même temps
    // Remplace un champ entier (ex. tableau.manual)
    // Notifications : un abonnement par compte et par groupe (abonnements_push)
    async savePushSub(g, playerId, js, etat) {
      ok(await this.sb.from('abonnements_push').upsert({ id: this.uid + '_' + g, uid: this.uid, group_id: g, player_id: playerId, sub: js ? JSON.parse(js) : null, etat, at: Date.now() }));
    },
    async deletePushSub(g) { await this.sb.from('abonnements_push').delete().eq('id', this.uid + '_' + g); },
    async listPushSubs() { return (ok(await this.sb.from('abonnements_push').select('player_id, sub, etat, at').eq('group_id', this.gid)) || []).map(r => ({ playerId: r.player_id, sub: r.sub, etat: r.etat, at: Number(r.at || 0) })); }
  };
  // Approbateur des terrains (compte) et taille maximale de la banque de joueurs
  const P = { admin: false, mine: [], todo: [], charge: false };
  const BANQUE_MAX = 64;
  const presKey = name => L.norm(name).replace(/[^a-z0-9]+/g, '-');
  function slug(s) { return L.norm(s).replace(/\s+/g, '-').slice(0, 30) || 'terrain'; }
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

  // =====================================================================
  // Voix : reconnaissance (Safari iOS) et synthèse
  // ==== src/golf/donnees.js ====
  // Base de données : ce qui est propre au golf (terrains, parties, quatuors, jeux, compétitions)
  Object.assign(Store, {
    async ensureSeed() { return this.listCourses(); },
    async listCourses() {
      let list;
      if (this.mode === 'cloud') list = (ok(await this.sb.from('terrains').select('id, data')) || []).map(r => ({ ...(r.data || {}), id: r.id }));
      else list = ls.get('pelland.courses', []);
      // Terrains retirés de la banque de ce groupe (les autres groupes les gardent)
      const out = await this.retiredCourses();
      this.retired = list.filter(c => out.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      return list.filter(c => !out.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async retiredCourses() {
      if (this.mode === 'cloud') { const g = await this.gdata(); return (g && g.terrainsRetires) || []; }
      return ls.get('pelland.terrainsRetires.' + this.gid, []);
    },
    async setCourseRetired(id, out) {
      const cur = await this.retiredCourses(), next = out ? [...new Set([...cur, id])] : cur.filter(x => x !== id);
      if (this.mode === 'cloud') await this.setGdata('terrainsRetires', next); else ls.set('pelland.terrainsRetires.' + this.gid, next);
    },
    async proposeCourse(course, meta) {
      const p = { course: JSON.parse(JSON.stringify(course)), statut: 'propose', groupe: this.gid, cree: Date.now(), ...meta, proposeUid: this.uid || '' };
      if (this.mode === 'cloud') { const r = ok(await this.sb.from('terrains_proposes').insert({ groupe: this.gid, propose_uid: this.uid, statut: 'propose', data: p }).select('id').single()); return { ...p, id: r.id }; }
      const l = ls.get('pelland.terrainsProposes', []); p.id = 'p' + Date.now(); l.push(p); ls.set('pelland.terrainsProposes', l); return p;
    },
    async listProposals(admin) {
      if (this.mode !== 'cloud') { const l = ls.get('pelland.terrainsProposes', []); return { mine: l.filter(p => p.groupe === this.gid), todo: admin ? l.filter(p => p.statut === 'propose') : [] }; }
      const map = q => q.then(r => (ok(r) || []).map(x => ({ ...(x.data || {}), id: x.id, statut: x.statut, groupe: x.groupe }))).catch(() => []);
      const cols = 'id, groupe, statut, data';
      const [mine, todo] = await Promise.all([map(this.sb.from('terrains_proposes').select(cols).eq('groupe', this.gid)), admin ? map(this.sb.from('terrains_proposes').select(cols).eq('statut', 'propose')) : []]);
      return { mine, todo };
    },
    async withdrawProposal(id) {
      if (this.mode === 'cloud') { ok(await this.sb.from('terrains_proposes').delete().eq('id', id)); return; }
      ls.set('pelland.terrainsProposes', ls.get('pelland.terrainsProposes', []).filter(p => p.id !== id));
    },
    async decideProposal(id, yes, course, photos) {
      const ch = { statut: yes ? 'approuve' : 'refuse', decideLe: Date.now(), decideUid: this.uid || '' };
      if (yes) {
        const c = await this.saveCourse({ ...course, verifieLe: Date.now(), ...(photos && photos.length ? { photosCarte: photos.length } : {}) }); ch.courseId = c.id;
        // Photos de la carte gardées à part (lues seulement quand on ouvre le terrain)
        if (photos && photos.length) { if (this.mode === 'cloud') ok(await this.sb.from('cartes_terrains').upsert({ course_id: c.id, photos, cree: Date.now() })); else ls.set('pelland.carte.' + c.id, photos); }
      }
      if (this.mode === 'cloud') {
        const cur = ok(await this.sb.from('terrains_proposes').select('data').eq('id', id).maybeSingle());
        ok(await this.sb.from('terrains_proposes').update({ statut: ch.statut, data: { ...((cur && cur.data) || {}), ...ch } }).eq('id', id)); return;
      }
      ls.set('pelland.terrainsProposes', ls.get('pelland.terrainsProposes', []).map(p => p.id === id ? { ...p, ...ch } : p));
    },
    async cartePhotos(courseId) {
      if (this.mode !== 'cloud') return ls.get('pelland.carte.' + courseId, []);
      try { const r = ok(await this.sb.from('cartes_terrains').select('photos').eq('course_id', courseId).maybeSingle()); return (r && r.photos) || []; } catch (e) { return []; }
    },
    async saveCourse(c) {
      c = JSON.parse(JSON.stringify(c));
      if (!c.id) c.id = slug(c.name) + '-' + Math.random().toString(36).slice(2, 6);
      c.updatedAt = Date.now();
      if (this.mode === 'cloud') {
        const u = ok(await this.sb.from('terrains').update({ data: c }).eq('id', c.id).select('id'));
        if (!u || !u.length) ok(await this.sb.from('terrains').insert({ id: c.id, data: c }));
        return c;
      }
      const list = ls.get('pelland.courses', []).filter(x => x.id !== c.id); list.push(c); ls.set('pelland.courses', list); return c;
    },
    async newCode() {
      const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      for (let n = 0; n < 20; n++) {
        const code = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join('');
        let used = null; try { used = await this.getGame(code); } catch (e) { return code; }
        if (!used) return code;
      }
      return 'P' + Date.now().toString(36).toUpperCase().slice(-5);
    },
    cacheGame(g) { const all = ls.get('fanion.parties', {}); all[g.id] = g; const ids = Object.keys(all); if (ids.length > 40) ids.sort((a, b) => (all[a].updatedAt || 0) - (all[b].updatedAt || 0)).slice(0, ids.length - 40).forEach(k => delete all[k]); ls.set('fanion.parties', all); },
    cachedGame(id) { return ls.get('fanion.parties', {})[id] || null; },
    async getGame(id) {
      if (this.mode === 'cloud') {
        try { const r = ok(await this.sb.from('parties').select('data').eq('id', id).maybeSingle()); if (r) { const g = fromDb(r.data); return this.pending(id) || g; } return this.pending(id) || null; }
        catch (e) { const c = this.cachedGame(id); if (c) return c; throw e; }
      }
      return ls.get('pelland.games', {})[id] || null;
    },
    pending(id) { const q = ls.get('fanion.file', {}); return q[id] ? q[id] : null; },
    async saveGame(g) {
      g.updatedAt = Date.now(); if (!g.groupId) g.groupId = this.gid;
      if (this.mode === 'cloud') {
        if (!g.ownerUid) g.ownerUid = this.uid;
        this.cacheGame(g);
        const q = ls.get('fanion.file', {}); q[g.id] = g; ls.set('fanion.file', q);
        this._emit(g);
        // hors ligne : la partie reste dans la file et part au retour du réseau ; on n'attend pas plus de 5 s
        const p = this.flush(); await Promise.race([p, new Promise(r => setTimeout(r, navigator.onLine ? 5000 : 0))]); return;
      }
      const all = ls.get('pelland.games', {}); all[g.id] = g; ls.set('pelland.games', all);
      this._emit(g);
    },
    async flush() {
      if (this.mode !== 'cloud' || this._flushing || navigator.onLine === false) return;
      this._flushing = true;
      try {
        const q = ls.get('fanion.file', {});
        for (const id of Object.keys(q)) {
          const g = q[id];
          const r = await this.sb.rpc('partie_enregistrer', { p_id: g.id, p_group: g.groupId, p_owner: g.ownerUid || '', p_data: toDb(g) });
          const now = ls.get('fanion.file', {});
          if (!r.error || /appartient|row-level|violates/i.test(r.error.message || '')) {
            if (now[id] && now[id].updatedAt === g.updatedAt) { delete now[id]; ls.set('fanion.file', now); }
            if (r.error) toast('Non enregistré : ' + r.error.message);
          } else if (!/fetch|network|Failed/i.test(r.error.message || '')) { toast('Non enregistré : ' + r.error.message); delete now[id]; ls.set('fanion.file', now); }
          else break;
        }
      } catch (e) { /* réseau : on réessaiera */ } finally { this._flushing = false; }
    },
    watchGame(id, cb) {
      (this._subs[id] = this._subs[id] || []).push(cb);
      if (this.mode === 'cloud') {
        const c = this.cachedGame(id); if (c) cb(c);
        this.getGame(id).then(g => g && cb(g)).catch(e => toast('Lecture impossible : ' + e.message));
        const off = this.watch('parties', 'id', id, r => { if (!this.pending(id)) { const g = fromDb(r.data); this.cacheGame(g); cb(g); } });
        return () => { off(); this._subs[id] = (this._subs[id] || []).filter(x => x !== cb); };
      }
      this.getGame(id).then(g => g && cb(g));
      const onStorage = e => { if (e.key === 'pelland.games') this.getGame(id).then(g => g && cb(g)); };
      window.addEventListener('storage', onStorage);
      return () => { this._subs[id] = (this._subs[id] || []).filter(x => x !== cb); window.removeEventListener('storage', onStorage); };
    },
    async listQuatuors() {
      if (this.mode === 'cloud') { const g = await this.gdata(); return (g && g.quatuors) || []; }
      return ls.get('pelland.quatuors.' + this.gid, this.gid === 'pelland' ? ls.get('pelland.quatuors', []) : []);
    },
    async saveQuatuors(list) {
      if (this.mode === 'cloud') { await this.setGdata('quatuors', list); return; }
      ls.set('pelland.quatuors.' + this.gid, list);
    },
    async saveGameRequest(req) {
      if (this.mode === 'cloud') { ok(await this.sb.from('demandes').insert({ data: req })); return; }
      ls.set('pelland.demandesJeux', ls.get('pelland.demandesJeux', []).concat([req]));
    },
    async listJeux() {
      if (this.mode === 'cloud') { const g = await this.gdata(); return (g && g.jeux) || []; }
      return ls.get('pelland.jeux.' + this.gid, []);
    },
    async saveJeux(list) {
      if (this.mode === 'cloud') { await this.setGdata('jeux', list); return; }
      ls.set('pelland.jeux.' + this.gid, list);
    },
    async deleteGame(id) {
      if (this.mode === 'cloud') { const q = ls.get('fanion.file', {}); delete q[id]; ls.set('fanion.file', q); ok(await this.sb.from('parties').delete().eq('id', id)); return; }
      const all = ls.get('pelland.games', {}); delete all[id]; ls.set('pelland.games', all);
    },
    async listComps() {
      if (this.mode === 'cloud') { try { return (ok(await this.sb.from('competitions').select('id, data, scores').eq('group_id', this.gid)) || []).map(r => ({ ...(r.data || {}), id: r.id, scores: r.scores || {} })).sort((a, b) => (b.date || '').localeCompare(a.date || '')); } catch (e) { return []; } }
      return Object.values(ls.get('pelland.comps', {})).filter(c => c.groupId === this.gid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    },
    async saveComp(c) {
      if (this.mode === 'cloud') { const { scores, ...rest } = c; ok(await this.sb.rpc('comp_fusion', { p_id: c.id, p_group: c.groupId || this.gid, p_patch: JSON.parse(JSON.stringify(rest)) })); return; }
      const all = ls.get('pelland.comps', {}); all[c.id] = { ...(all[c.id] || {}), ...c }; ls.set('pelland.comps', all);
    },
    async setCompScore(id, tid, h, arr) {
      if (this.mode === 'cloud') { ok(await this.sb.rpc('comp_score', { p_comp: id, p_equipe: String(tid), p_trou: String(h), p_valeur: arr })); return; }
      const all = ls.get('pelland.comps', {}); const c = all[id]; if (!c) return; c.scores = c.scores || {}; c.scores[tid] = c.scores[tid] || {}; c.scores[tid][h] = arr; ls.set('pelland.comps', all);
    },
    async setCompField(id, path, value) {
      if (this.mode === 'cloud') { ok(await this.sb.rpc('comp_maj', { p_comp: id, p_chemin: path.split('.'), p_valeur: value === undefined ? null : value })); return; }
      const all = ls.get('pelland.comps', {}); const c = all[id]; if (!c) return; const ks = path.split('.'); let o = c; ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = value; ls.set('pelland.comps', all);
    },
    async deleteComp(id) {
      if (this.mode === 'cloud') { ok(await this.sb.from('competitions').delete().eq('id', id)); return; }
      const all = ls.get('pelland.comps', {}); delete all[id]; ls.set('pelland.comps', all);
    },
    watchComp(id, cb) {
      if (this.mode === 'cloud') {
        const get = () => this.sb.from('competitions').select('id, data, scores').eq('id', id).maybeSingle().then(r => { if (r.data) cb({ ...(r.data.data || {}), id: r.data.id, scores: r.data.scores || {} }); });
        get();
        return this.watch('competitions', 'id', id, r => cb({ ...(r.data || {}), id: r.id, scores: r.scores || {} }));
      }
      const get = () => { const c = ls.get('pelland.comps', {})[id]; if (c) cb(c); };
      get(); const on = e => { if (e.key === 'pelland.comps') get(); }; window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
    async listGames() {
      if (this.mode === 'cloud') {
        let list = [];
        try { list = (ok(await this.sb.from('parties').select('data').eq('group_id', this.gid).order('updated_at', { ascending: false }).limit(200)) || []).map(r => fromDb(r.data)); }
        catch (e) { list = Object.values(ls.get('fanion.parties', {})).filter(g => g.groupId === this.gid); }
        const q = ls.get('fanion.file', {}); Object.values(q).filter(g => g.groupId === this.gid).forEach(g => { list = list.filter(x => x.id !== g.id).concat([g]); });
        return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 200);
      }
      return Object.values(ls.get('pelland.games', {})).filter(g => (g.groupId || 'pelland') === this.gid).sort((a, b) => b.createdAt - a.createdAt);
    },
  });
  // Les parties gardent les équipes sous la forme { e1: [...], e2: [...] } (comme avant).
  function toDb(g) {
    const o = JSON.parse(JSON.stringify(g));
    if (Array.isArray(o.teams)) o.teams = { e1: o.teams[0], e2: o.teams[1] };
    return o;
  }
  function fromDb(o) {
    if (o && o.teams && !Array.isArray(o.teams)) o.teams = [o.teams.e1, o.teams.e2];
    return o;
  }
  // ==== src/commun/voix.js ====
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
  // ==== src/commun/etat.js ====
  // =====================================================================
  // État de l'interface
  // =====================================================================
  const BALL = '<span class="ydot" aria-label="coup">●</span>';
  const S = { players: [], confirmDel: null, view: 'home', game: null, unwatch: null, undo: [], courses: [], draft: null, editCourse: null };
  // Responsable : celui qui a créé ou réclamé la partie ; après une passation, le joueur désigné (ownerUid vide)
  const myIdx = g => g.players.findIndex(p => L.norm(p.name) === L.norm(ls.get('pelland.me', '') || ''));
  const isOwner = () => !!S.game && (S.game.ownerUid === Store.uid || (S.game.responsable != null && myIdx(S.game) === S.game.responsable));
  const handoffBtn = (g, owner) => owner && g.status !== 'terminée' ? `<div class="row handoff-row"><span class="note">Responsable : <b>${esc((g.players[g.responsable] || {}).name || '')}</b> ★</span><span class="row" style="gap:8px"><button class="btn ghost small" data-editmoney type="button">Modifier les montants</button><button class="btn ghost small" data-handoff type="button">Changer de responsable</button></span></div>` : '';

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), Math.min(9000, 2200 + msg.length * 45));
  }
  function setHeard(t) { $('#heard').textContent = t; }
  function setReply(t) { if (t) toast(t); }
  function updateMic() { $('#micBtn').classList.toggle('on', Voice.listening && !Voice.wake); }

  function go(view, opts = {}) {
    MODULE.quitter(view);   // le module ferme ce qu'il suivait en direct (partie, compétition…)
    if (view === 'compte') S.acctGroups = null;
    if (view !== 'compte') S.fromLogin = false;
    if (view === 'players') S.pFocused = false;
    MODULE.avant(view);
    S.view = view; Object.assign(S, opts);
    MODULE.aller(view, opts);
    if (view === 'offre') { S.offre = undefined; S.offreSel = null; }
    render(); window.scrollTo(0, 0);
  }

  function render() {
    const v = $('#view');
    $('#back').hidden = S.view === 'home' || S.view === 'login';
    document.body.classList.toggle('tv-mode', S.view === 'compTv');   // écran télé : sans barre ni bouton de Samuel
    $('#dbBadge').textContent = !navigator.onLine ? 'Hors ligne' : Store.mode === 'cloud' ? '' : 'Local';
    // Mon compte : l'ancien bouton aux initiales reste caché ; le visage de Philippe (porte.js) le remplace
    const ab = $('#acctBtn'), acctOk = Store.mode === 'cloud' && !!Store.email && !Store.needLogin && S.view !== 'login';
    ab.hidden = true; $('#ideeBtn').hidden = !acctOk;  // Mon compte : par le menu de Philippe (HoldingAI)
    $('#ideeBtn').classList.toggle('compact', S.view !== 'home'); ab.classList.toggle('on', S.view === 'compte');
    if (acctOk) { const nm = (S.players.find(p => p.id === meId()) || {}).name || ls.get('pelland.me', '') || ''; $('#acctIni').textContent = nm.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('') || '👤'; ab.title = 'Mon compte' + (nm ? ' · ' + nm : ''); }
    $('#dbBadge').classList.toggle('offline', !navigator.onLine);
    const showDock = false; // plus d'interface vocale
    document.body.classList.toggle('view-game', S.view === 'game');
    $('#dock').hidden = !showDock; document.body.classList.toggle('no-dock', !showDock);
    const R = { ...MODULE.vues, offre: vOffre, players: vPlayers, login: vLogin, compte: vCompte }[S.view];
    v.innerHTML = R();
    bind[S.view] && bind[S.view](v);
    leoApres();
  }

  const APP = MARQUE.nom;
  function curGroup() { return (S.groups || []).find(x => x.id === Store.gid) || { id: Store.gid, name: MARQUE.groupeDefaut }; }
  function groupName() { return curGroup().name; }
  const ownerId = () => curGroup().owner || null;
  // Banques (joueurs, terrains, compétitions) : seul le propriétaire du groupe ajoute ou enlève
  const isProprio = () => !ownerId() || (!!meId() && meId() === ownerId());
  const meId = () => ((S.players || []).find(p => L.norm(p.name) === L.norm(ls.get('pelland.me', '') || '')) || {}).id;
  const isOrganizer = id => !ownerId() || id === ownerId() || (curGroup().organizers || []).includes(id);
  // Qui peut organiser : le propriétaire et les organisateurs qu'il nomme (tout le monde tant qu'il n'y a pas de propriétaire)
  const canOrganize = () => isOrganizer(meId());
  // ==== src/commun/bienvenue.js ====
  // ---------------- Accueil ----------------
  // Membres invités (ni propriétaire ni organisateur) : ces tuiles sont grisées ; survol ou toucher = explication
  const LOCKED = SPORT.verrous;
  function lockTiles(html) {
    if (canOrganize()) return html;
    return html.replace(new RegExp(`<button class="tile" data-go="(${Object.keys(LOCKED).join('|')})"`, 'g'), (m, k) => `<button class="tile locked" data-locked="${k}" data-tip="${esc(LOCKED[k])} Touchez pour voir un aperçu."`)
      .replace(/(data-locked="\w+" data-tip="[^"]*"[^>]*>)/g, '$1<span class="tile-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>Aperçu</span>');
  }
  // =====================================================================
  // Participants (ni propriétaire ni organisateur) : accueil à la première visite du groupe,
  // et aperçu de chaque tuile réservée à l'organisateur.
  // =====================================================================
  const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
  function organizerOf() {
    const orgId = (curGroup().organizers || [])[0] || ownerId();
    return (S.players || []).find(p => p.id === orgId) || null;
  }
  const isParticipant = () => !Store.needLogin && !!meId() && !canOrganize();
  const welcomeKey = () => 'pelland.welcome.' + Store.gid + '.' + meId();
  // Petits aperçus dessinés de chaque écran réservé (données d'exemple)
  const MOCK = SPORT.apercus;
  const LOCKED_INFO = SPORT.apercuInfos;
  function lockedSheet(k) {
    const x = LOCKED_INFO[k], org = organizerOf();
    openSheet(`<div class="lk">
        <div class="lk-head"><span class="lk-lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg></span>
          <div><h3>${esc(x.t)}</h3><p>Réservé à ${org ? esc(org.name) : 'l’organisateur'}</p></div></div>
        <div class="lk-shot" aria-hidden="true">${MOCK[k]()}</div>
        <p class="lk-d">${esc(x.d)}</p>
        <p class="lk-you"><b>Pour vous :</b> ${esc(x.you)}</p>
        <div class="sheet-actions"><button class="btn" data-close type="button">Compris</button></div>
        <p class="lk-own">Envie d’organiser votre propre gang ? <button class="linkbtn" data-viral type="button">Créer mon groupe gratuit</button></p>
      </div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  document.addEventListener('click', async e => { const b = e.target.closest && e.target.closest('[data-copyuid]'); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.copyuid); toast('Identifiant copié.'); } catch (x) { toast('Sélectionnez le code pour le copier.'); } });
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-locked]'); if (t) { e.preventDefault(); lockedSheet(t.dataset.locked); } });

  // Accueil du participant : une étiquette de sac à son nom, ce qu'il peut faire, ce que l'organisateur fait
  function showWelcome() {
    const me = (S.players || []).find(p => p.id === meId()) || { name: ls.get('pelland.me', '') }, org = organizerOf();
    const wrap = document.createElement('div'); wrap.id = 'welcome'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'wlTitle');
    wrap.innerHTML = `<div class="wl-in">
      <div class="wl-tag" aria-hidden="true">
        <span class="wl-strap"></span>
        <div class="wl-card">
          <span class="wl-hole"></span>
          <div class="wl-brand"><svg width="16" height="19" viewBox="${MARQUE.logoVue}">${MARQUE.logo}</svg>${APP}</div>
          <div class="wl-name">${esc(me.name)}</div>
          <div class="wl-grp">${esc(groupName())}</div>
          <div class="wl-role">Participant</div>
        </div>
      </div>
      <h1 id="wlTitle">Bienvenue dans la gang, ${esc(firstName(me.name))}.</h1>
      <p class="wl-lead">Vous faites partie de « ${esc(groupName())} » comme participant. ${org ? esc(firstName(org.name)) + ' organise' : 'L’organisateur s’occupe de tout'} ; vous, vous jouez.</p>
      <div class="wl-cols">
        <section class="wl-you"><h2>Ce que vous faites</h2><ul>
${SPORT.bienvenueVous}</ul></section>
        <section class="wl-org"><h2>Ce que ${org ? esc(firstName(org.name)) : 'l’organisateur'} fait pour le groupe</h2><ul>
          ${SPORT.bienvenueOrg}</ul>
          <p>Ces tuiles sont grisées pour vous. Touchez-en une pour voir à quoi elle sert.</p></section>
      </div>
      <p class="wl-notif">🔔 En entrant, les notifications du groupe s’activent : nouvelles dates, rappels, parties et résultats. Elles restent actives tant que vous êtes membre du groupe.</p>
      <button class="btn wl-go" id="wlGo" type="button">Entrer dans le groupe</button>
      <p class="wl-own">Envie d’organiser votre propre gang ? <button class="linkbtn" id="wlOwn" type="button">Créer mon groupe gratuit</button></p>
    </div>`;
    document.body.appendChild(wrap);
    const close = () => { try { ls.set(welcomeKey(), Date.now()); } catch (e) { } wrap.classList.add('out'); setTimeout(() => wrap.remove(), 250); };
    // Notifications du groupe : activées d'office en entrant (le geste du joueur permet de demander la permission au téléphone)
    wrap.querySelector('#wlGo').onclick = () => { close(); if (Push.supported() && !Push.needsInstall() && Push.perm() !== 'denied') Push.enable().then(() => toast('Notifications du groupe activées.')).catch(() => Push.signaler()).then(() => render()); else Push.signaler(); };
    wrap.querySelector('#wlOwn').onclick = () => { close(); setTimeout(newGroupSheet, 260); };
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    wrap.tabIndex = -1; setTimeout(() => { wrap.scrollTop = 0; wrap.focus({ preventScroll: true }); }, 50);
  }
  function maybeWelcome() { if (S.view === 'home' && isParticipant() && !ls.get(welcomeKey(), 0) && !document.getElementById('welcome')) showWelcome(); }
  // ==== src/golf/accueil.js ====
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-welcome]'); if (t) { e.preventDefault(); showWelcome(); } });
  function vHome() {
    $('#barTitle').innerHTML = `${APP}<small class="bar-sous">le golf entre amis</small>`;
    const last = ls.get('pelland.lastGame', null);
    const info = ls.get('pelland.lastGameInfo', null);
    const lastDate = info && info.id === last && info.createdAt ? new Date(info.createdAt).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
    return `
      <h3 class="home-h home-h-first">Les banques</h3>
      ${lockTiles(`<div class="tiles banks">
        <button class="tile" data-go="players"><span class="pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="9" cy="8" r="3.2" fill="currentColor"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" fill="currentColor"/><circle cx="17" cy="9" r="2.4" fill="currentColor" opacity=".7"/><path d="M15.5 13.6c3 .2 5.5 2.1 5.5 5.4h-4.3" fill="currentColor" opacity=".7"/></svg></span><div><strong>Banque de joueurs</strong><span>Tous les joueurs du groupe : ajouter, renommer, retirer, importer d’Excel</span></div></button>
        <button class="tile" data-go="courses"><span class="pin">⛳</span><div><strong>Banque de terrains</strong><span>Consultez les terrains ou ajoutez-en un</span></div></button>
        <button class="tile" data-go="jeux"><span class="pin" style="font-family:var(--display);font-weight:700">$</span><div><strong>Banque de jeux</strong><span>Les règles et l’argent de chaque jeu ; ajoutez les vôtres</span></div></button>
        <button class="tile" data-go="comps"><span class="pin"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 4h10v3a5 5 0 0 1-10 0V4z" fill="currentColor"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 12v4M8 20h8l-1-4H9z" fill="currentColor" stroke="currentColor" stroke-width="1.2"/></svg></span><div><strong>Banque de compétitions</strong><span>Membre-membre : équipes de 2, classes et classement en direct</span></div></button>
      </div>`)}
      <div class="hero"><div class="hero-k-row"><span class="hero-k">Groupe :</span>${(() => { const autres = (S.myPlayers || []).filter(x => !x.archived && !x.deleted && (x.gid || x.groupId) !== Store.gid).length;
        return Store.needLogin ? '' : `<span class="hero-liens">${autres ? `<button class="btn ghost small" id="switchGroup" type="button">Changer (${autres})</button>` : ''}<button class="btn ghost small" data-viral type="button">+ Ajouter un groupe</button></span>`; })()}</div>
      <h1>${canOrganize() ? `<button class="hero-nom" id="renameGroup" type="button" title="Toucher pour changer le nom du groupe" aria-label="Changer le nom du groupe : ${esc(groupName())}">${esc(groupName())}</button>` : esc(groupName())}</h1></div>
      ${Store.needLogin ? '' : groupInfo(true)}
      ${!Store.needLogin && Store.mode === 'cloud' && S.players && S.players.length && !meId() ? `<div class="warn">Vous êtes dans la banque de joueurs de ce groupe, mais pas encore membre : l’organisateur vous ajoutera au groupe quand il y aura une place.</div>` : ''}
      ${retourCarte()}
      ${P.admin && P.todo.length ? `<button class="warn approve-band" data-go="courses" type="button">🏌️ ${P.todo.length} terrain${P.todo.length > 1 ? 's' : ''} à approuver pour la banque · Voir</button>` : ''}
      ${curGroup().archived ? `<div class="warn archived-band">Ce groupe est archivé.${meId() && meId() === ownerId() ? ' <button class="linkbtn" data-go="compte" type="button">Le rétablir dans Mon compte</button>' : ' Son propriétaire peut le rétablir.'}</div>` : ''}
      <h3 class="home-h">Les étapes</h3>
      ${lockTiles(`<div class="tiles steps">
        <button class="tile" data-go="players" data-pmode="inviter"><span class="pin step-n">1</span><div><strong>Inviter des joueurs</strong><span>Choisissez les membres du groupe parmi les joueurs confirmés de la banque</span></div></button>
        <button class="tile" data-go="quatuors"><span class="pin step-n">2</span><div><strong>Parties à préparer</strong><span>Offrez des dates ; les joueurs répondent et l’app forme les quatuors</span></div></button>
        <button class="tile" data-typepartie type="button"><span class="pin step-n">3</span><div><strong>Créer une partie</strong><span>Terrain, joueurs, jeu et montants</span></div></button>
        <button class="tile" data-go="live"><span class="pin step-n">4</span><div><strong>Parties en cours</strong><span>Suivez les parties en direct</span></div></button>
        <button class="tile" data-go="comps" data-clive="1"><span class="pin step-n">5</span><div><strong>Compétitions en cours</strong><span>Classements en direct des compétitions du groupe</span></div></button>
        <button class="tile" data-go="history"><span class="pin step-n">6</span><div><strong>Parties et compétitions jouées</strong><span>Les résultats, qui doit quoi et les classements finaux</span></div></button>
      </div>`)}
      ${avisCard('home')}
      ${referralCard()}
      ${Store.needLogin ? '' : `<button class="caddie-tile" data-caddie type="button"><span class="cad-ico" aria-hidden="true">${window.CaddieGuide ? CaddieGuide.avatar() : '?'}</span><span><b>Une question ?</b><small>Demandez à Samuel, votre caddie : l’app, les règles des jeux, les forfaits.</small></span></button>`}
      ${viralCard('home')}
      <p class="note">${Store.mode === 'cloud' ? 'Base partagée active : les autres joueurs suivent la partie en direct dans Parties en cours.' : 'Mode local : les parties restent sur ce téléphone.'}</p>
      ${Store.mode === 'local' && Store.error ? `<div class="warn"><b>Pourquoi le mode local :</b> ${esc(Store.error)}</div>` : ''}`;
  }
  // ==== src/commun/forfait.js ====
  // ---------------- Propriétaire et forfait du groupe ----------------
  // Forfait gardé dans players/_groupe_<g> : plan = 'groupe' (16 joueurs, payé) et paidUntil (ms). Sans forfait : Gratuit, 4 joueurs.
  function planOf(gr) {
    gr = gr || curGroup();
    // Limite donnée par Fanion (groupe de test, entente spéciale) : l'emporte sur le forfait
    if (Number(gr.maxJoueurs) > 0) { const b = gr.plan === 'groupe' && (!gr.paidUntil || gr.paidUntil > Date.now()); return { name: b ? 'Groupe' : 'Test', max: Number(gr.maxJoueurs), until: b ? gr.paidUntil || null : null, paid: true }; }
    if (gr.plan === 'groupe' && (!gr.paidUntil || gr.paidUntil > Date.now())) return { name: 'Groupe', max: 16, until: gr.paidUntil || null, paid: true };
    return { name: 'Gratuit', max: 4, until: null, paid: false, expired: gr.plan === 'groupe' };
  }
  // « Mon compte » sous le nom de la personne connectée (et, pour le propriétaire, le choix de l'organisateur)
  function acctAct(sameOrg) {
    const acct = '';   // Mon compte : bouton en haut à droite
    const pick = sameOrg !== undefined ? `<button class="linkbtn" data-pickorg type="button">${sameOrg ? 'Nommer un organisateur' : 'Changer l’organisateur'}</button>` : '';
    return acct || pick ? `<div class="who-act">${[acct, pick].filter(Boolean).join('<span aria-hidden="true"> · </span>')}</div>` : '';
  }
  function groupInfo(compact) {
    // Rôle dans le groupe : organisateur ou participant. Le propriétaire (forfait) se gère dans Mon compte.
    const own = (S.players || []).find(p => p.id === ownerId()), pl = planOf(), n = (S.players || []).length, over = n > pl.max;
    const buy = !pl.paid && meId() && meId() === ownerId() ? ` <a class="linkbtn" href="${buyUrl()}" target="_blank" rel="noopener">Passer au forfait Groupe</a>` : '';
    const orgId = (curGroup().organizers || [])[0], org = (S.players || []).find(p => p.id === orgId) || own;
    const me = (S.players || []).find(p => p.id === meId());
    const tagO = '<span class="role-tag org" title="Prépare les parties">Organisateur</span>';
    const moiOrg = me && org && me.id === org.id;
    return `<div class="grp-info${compact ? ' compact' : ''}">
      <div class="grp-info-k">Rôles dans ce groupe</div>
      ${moiOrg ? `<div class="who-line"><b>Vous êtes</b>${tagO}</div>`
        : `<div class="who-line"><b>${org ? esc(org.name) : 'Aucun organisateur'}</b>${org ? tagO : ''}</div>
      ${me ? `<div class="who-line me-line"><b>Vous êtes</b><span class="role-tag part">Participant</span><button class="linkbtn" data-welcome type="button">Ce que je peux faire</button></div>` : ''}`}
      ${over ? `<div class="plan-line"><small class="over">${n} / ${pl.max} joueurs : forfait dépassé</small>${buy}</div>` : ''}
    </div>`;
  }

  // Invitation acceptée = le joueur a créé son compte (cellulaire confirmé + mot de passe)
  const hasAccepted = p => !!(p && (p.acct || p.authEmail));
  function pickOrganizerSheet() {
    const cur = (curGroup().organizers || [])[0] || ownerId();
    openSheet(`<h3>Organisateur du groupe</h3><p class="note">Il prépare les parties : dates offertes, ${SPORT.quatuors}, nouvelles parties. Le propriétaire garde le forfait.</p>
      <div class="pick-list">${(S.players || []).map(p => { const ok = p.id === ownerId() || hasAccepted(p); return `<button class="btn ${p.id === cur ? '' : 'ghost'} small ${ok ? '' : 'pick-off'}" ${ok ? `data-orgpick="${esc(p.id)}"` : 'disabled'} type="button">${esc(p.name)}${p.id === ownerId() ? ' · propriétaire' : ''}${p.id === cur ? ' ✓' : ''}${ok ? '' : '<small>Invitation pas encore acceptée</small>'}</button>`; }).join('')}</div>
      <p class="note">Seuls les joueurs qui ont accepté leur invitation (compte créé) peuvent être organisateurs.</p>
      <div class="sheet-actions"><button class="btn ghost" data-close type="button">Fermer</button></div>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelectorAll('[data-orgpick]').forEach(b => b.onclick = async () => {
        const id = b.dataset.orgpick, gr = { ...curGroup(), organizers: id === ownerId() ? [] : [id] };
        try { await Store.saveGroup(gr); S.groups = await Store.listGroups(); closeSheet(); toast('Organisateur : ' + ((S.players.find(p => p.id === id) || {}).name || '')); render(); } catch (e) { toast('Impossible : ' + e.message); }
      });
    });
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-pickorg]'); if (t) { e.preventDefault(); pickOrganizerSheet(); } });

  // Lien d'achat : le site transmet l'identifiant du groupe à Stripe, pour activer le bon groupe
  function buyUrl() { return MARQUE.site + '/achat.html?groupe=' + encodeURIComponent(Store.gid) + '&nom=' + encodeURIComponent(groupName()); }
  // Places qui restent dans le forfait (Gratuit : 4 joueurs ; Groupe : 16)
  function roomLeft() { return planOf().max - (S.players || []).length; }
  function limitSheet(wanted) {
    const pl = planOf(), own = (S.players || []).find(p => p.id === ownerId()), meOwner = !!meId() && meId() === ownerId();
    const left = Math.max(0, roomLeft());
    openSheet(`<h3>${pl.paid ? 'Le groupe est complet' : 'Passez au forfait Groupe'}</h3>
      <p>${pl.paid ? `Le forfait ${pl.name} permet ${pl.max} joueurs.` : `Le forfait Gratuit permet ${pl.max} joueurs, pour essayer avec ${SPORT.gratuitPour}.`}${wanted ? ` Vous voulez en ajouter ${wanted}, il reste ${left} place${left > 1 ? 's' : ''}.` : ''}</p>
      ${pl.paid ? '<p class="note">Pour une ligue de plus de 16 joueurs, écrivez à ' + MARQUE.courriel + '.</p>'
        : `<ul class="info-list"><li>Jusqu’à 16 joueurs</li><li>Dates offertes, disponibilités et ${SPORT.quatuors}</li><li>49 $ + taxes pour la saison, au prix fondateur</li></ul>
      ${meOwner ? '' : `<p class="note">Seul le propriétaire du groupe${own ? ', ' + esc(own.name) + ',' : ''} peut changer de forfait.</p>`}`}
      <div class="sheet-actions">${!pl.paid && meOwner ? `<a class="btn" href="${buyUrl()}" target="_blank" rel="noopener">Passer au forfait Groupe</a>` : ''}<button class="btn ghost" data-close type="button">${!pl.paid && meOwner ? 'Plus tard' : 'Compris'}</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }

  // Deuxième groupe avec le forfait Gratuit : même offre que pour un 5e joueur
  function deuxiemeGroupeSheet(g) {
    const url = MARQUE.site + '/achat.html?groupe=' + encodeURIComponent(g.id) + '&nom=' + encodeURIComponent(g.name || '');
    openSheet(`<h3>Passez au forfait Groupe</h3>
      <p>Le forfait Gratuit permet un groupe de 4 joueurs, pour essayer avec ${SPORT.gratuitPour}. Vous avez déjà « ${esc(g.name)} » : pour créer un deuxième groupe, passez-le au forfait Groupe.</p>
      <ul class="info-list"><li>Jusqu’à 16 joueurs</li><li>Dates offertes, disponibilités et ${SPORT.quatuors}</li><li>Un autre groupe gratuit possible</li><li>49 $ + taxes pour la saison, au prix fondateur</li></ul>
      <div class="sheet-actions"><a class="btn" href="${url}" target="_blank" rel="noopener">Passer au forfait Groupe</a><button class="btn ghost" data-close type="button">Plus tard</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  // ==== src/commun/demarrer.js ====
  // ---------------- Bien démarrer : 4 premiers pas pour un nouveau groupe (propriétaire et organisateur) ----------------
  // Le progrès est gardé sur le groupe (onb), donc le même sur tous les téléphones ; l'écran d'accueil est propre à chaque téléphone.
  async function markStep(key) {
    const gr = curGroup(); if ((gr.onb || {})[key]) return;
    const ng = { ...gr, onb: { ...(gr.onb || {}), [key]: Date.now() } };
    S.groups = (S.groups || []).map(g => g.id === ng.id ? ng : g);
    try { await Store.saveGroup(ng); } catch (e) { }
  }
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  function onboardSteps() {
    const onb = curGroup().onb || {}, me = meId();
    const withPhone = (S.players || []).filter(p => p.id !== me && (p.phone || p.authEmail)).length;
    return [
      { k: 'joueurs', done: withPhone >= 3, t: 'Ajoutez vos joueurs', d: withPhone ? SPORT.etapeJoueurs(withPhone) : 'Avec leur cellulaire : chacun reçoit son invitation par texto.', go: 'players', b: 'Joueurs' },
      { k: 'offre', done: !!onb.offre || (S.offres || []).length > 0, t: 'Offrez une première date', d: SPORT.etapeOffre, go: SPORT.vueDates, b: 'Offrir' },
      { k: 'partie', done: !!onb.partie, t: 'Jouez une première partie', d: SPORT.etapePartie, go: SPORT.vuePartie, b: 'Commencer' },
      { k: 'ecran', done: standalone() || !!ls.get('pelland.onb.ecran', 0), t: 'Ajoutez l’app à votre écran d’accueil', d: 'Elle s’ouvre ensuite comme une vraie app.', act: 'ecran', b: 'Comment' },
    ];
  }
  function onboardCard() {
    if (Store.needLogin || !canOrganize() || ls.get('pelland.onb.hide.' + Store.gid, 0)) return '';
    const st = onboardSteps(), n = st.filter(x => x.done).length;
    if (n === st.length) return '';
    const next = st.find(x => !x.done);
    return `<section class="card onboard"><div class="onb-head"><h3>Bien démarrer</h3><span class="onb-count">${n} / ${st.length}</span></div>
      <div class="onb-bar"><i style="width:${Math.round(n / st.length * 100)}%"></i></div>
      <ol class="onb-list">${st.map(x => `<li class="${x.done ? 'done' : x === next ? 'next' : ''}"><span class="onb-dot">${x.done ? '✓' : ''}</span><div><b>${esc(x.t)}</b>${x === next ? `<small>${esc(x.d)}</small>` : ''}</div>${x.done ? '' : x === next ? `<button class="btn small" ${x.go ? `data-go="${x.go}"` : `data-onbact="${x.act}"`} type="button">${esc(x.b)}</button>` : `<button class="onb-more" ${x.go ? `data-go="${x.go}"` : `data-onbact="${x.act}"`} type="button" aria-label="${esc(x.b)}">›</button>`}</li>`).join('')}</ol>
      <p class="note onb-foot">Une question ? <button class="linkbtn" data-caddie type="button">Demandez à ${MARQUE.personnage}, ${MARQUE.role}</button> · <button class="linkbtn" data-onbhide type="button">Masquer</button></p></section>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-onbact],[data-onbhide]'); if (!t) return;
    e.preventDefault();
    if (t.hasAttribute('data-onbhide')) { ls.set('pelland.onb.hide.' + Store.gid, 1); return render(); }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    openSheet(`<h3>${MARQUE.nomMaj} sur votre écran d’accueil</h3>
      <ol class="info-list">${ios ? '<li>Ouvrez ' + APP + ' dans <b>Safari</b>.</li><li>Touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li><li>Choisissez <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>'
        : '<li>Ouvrez ' + APP + ' dans <b>Chrome</b>.</li><li>Touchez le menu <b>⋮</b> en haut à droite.</li><li>Choisissez <b>Ajouter à l’écran d’accueil</b> (ou <b>Installer l’application</b>).</li>'}</ol>
      <p class="note">${MARQUE.icone} apparaît avec vos autres apps. Partagez ces étapes avec vos joueurs.</p>
      <div class="sheet-actions"><button class="btn" data-ecranok type="button">C’est fait</button><button class="btn ghost" data-close type="button">Plus tard</button></div>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('[data-ecranok]').onclick = () => { ls.set('pelland.onb.ecran', 1); closeSheet(); render(); };
    });
  });
  // ==== src/commun/compte.js ====
  // ---------------- Mon compte : le compte de la personne et tous les groupes dont elle fait partie ----------------
  function groupRows(l, cur, base) {
    return `<div class="acct-groups">${l.map((x, k) => [x, base ? base.indexOf(x) : k]).map(([x, i]) => `<div class="acct-g ${x.gid === cur ? 'cur' : ''}"><div><b><span class="g-k">Groupe :</span> ${esc(x.name)}</b><small>${esc(x.playerName)} · ${x.organizer ? 'organisateur' : 'participant'}</small></div>${x.gid === cur ? '<span class="acct-cur">Groupe actuel</span>' : `<button class="btn small" data-gopen="${i}" type="button">Ouvrir</button>`}${x.gid === cur && x.owner && !S.fromLogin ? `<div class="g-manage"><button class="btn ghost small" data-pickorg type="button">${(curGroup().organizers || []).length ? 'Changer l’organisateur' : 'Nommer un organisateur'}</button>${x.archived
        ? '<button class="btn ghost small" data-grpstate="unarchive" type="button">Rétablir le groupe</button>'
        : '<button class="btn ghost small" data-grpstate="archive" type="button">Archiver le groupe</button>'}<button class="btn ghost small danger-txt" data-grpstate="delete" type="button">Supprimer le groupe</button>
        <small>Archiver : le groupe est mis de côté pour tous, rien n’est perdu et vous pouvez le rétablir. Supprimer : il disparaît pour tous avec ses parties, ses dates et ses compétitions, sans retour possible.</small></div>` : ''}</div>`).join('') || '<p class="note">Aucun groupe pour l’instant.</p>'}</div>`;
  }
  function vCompte() {
    $('#barTitle').textContent = 'Mon compte';
    if (S.acctGroups == null) { Store.myGroupList().then(l => { S.acctGroups = l; S.myPlayers = l; if (S.view === 'compte') render(); }).catch(() => { S.acctGroups = []; render(); }); return '<p class="note">Chargement…</p>'; }
    const u = { uid: Store.uid }, cell = (Store.e164 || '').replace(/^\+1/, '');
    const mine = S.acctGroups.find(g => g.gid === Store.gid) || S.acctGroups[0];
    if (mine && !S.fromLogin) ls.set('pelland.me', mine.playerName);
    return `<section class="card"><h2>${esc(mine ? mine.playerName : ls.get('pelland.me', '') || '')}</h2>
        ${S.fromLogin ? '<p class="note"><b>Bienvenue !</b> Choisissez votre groupe.</p>' : ''}
        <p class="note">${cell ? 'Cellulaire confirmé : ' + esc(fmtPhone(cell)) : 'Votre compte L’Établi n’a pas de cellulaire confirmé : ajoutez-le dans « Mon compte L’Établi ».'}</p>
        ${u.uid ? `<p class="note uid-ligne">Identifiant du compte : <code>${esc(u.uid)}</code> <button class="linkbtn" data-copyuid="${esc(u.uid)}" type="button">Copier</button>${P.admin ? ' · <b>approbateur des terrains ✓</b>' : ''}</p>` : ''}</section>
      ${S.fromLogin ? '' : forfaitHtml()}
      <h3 class="acct-h">Compte L’Établi</h3>
      <div class="acct-box acct-g"><div><b>Cellulaire et mot de passe</b><small>Votre compte L’Établi sert dans toutes les apps de L’Établi. Philippe s’en occupe.</small></div><a class="btn ghost small" href="${esc(HoldingAI.compteUrl)}">Gérer</a></div>
      <h3 class="acct-h acct-h-act"><span>Mes groupes (${S.acctGroups.filter(x => !x.archived).length})</span><button class="btn ghost small" data-viral type="button">+ Ajouter un groupe</button></h3>
      ${groupRows(S.acctGroups.filter(x => !x.archived), S.fromLogin ? null : Store.gid, S.acctGroups).replace(S.fromLogin ? /Ouvrir/g : /^$/, 'Entrer')}
      ${S.acctGroups.some(x => x.archived) ? `<h3 class="acct-h">Groupes archivés (${S.acctGroups.filter(x => x.archived).length})</h3>
        ${groupRows(S.acctGroups.filter(x => x.archived), S.fromLogin ? null : Store.gid, S.acctGroups)}<p class="note">Un groupe archivé garde ses joueurs, ses parties et ses résultats. Son propriétaire peut le rétablir.</p>` : ''}
      <p class="note">Ce sont les groupes où votre cellulaire est inscrit. Pour en rejoindre un autre, demandez à son organisateur de vous ajouter dans Joueurs.</p>
      <div class="row acct-actions"><button class="btn ghost small" type="button" data-hai-inviter>💌 Inviter quelqu’un</button><button class="btn ghost small" data-avis type="button">Donner mon avis</button><button class="btn ghost small" data-idee type="button">💡 Une idée ?</button></div>
      <button class="btn ghost danger-txt acct-logout" id="logout2" type="button">Se déconnecter</button>`;
  }
  // Forfait du groupe actif (le propriétaire peut passer au forfait Groupe ou le renouveler)
  function forfaitHtml() {
    const pl = planOf(), n = (S.players || []).length, meOwner = !!meId() && meId() === ownerId();
    const own = (S.players || []).find(p => p.id === ownerId());
    const until = pl.until ? 'jusqu’au ' + new Date(pl.until).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : pl.expired ? 'saison terminée' : 'sans limite de temps';
    return `<h3 class="acct-h">Forfait · ${esc(groupName())}</h3>
      <div class="acct-box">
        <div class="forfait-l"><b>${pl.name}</b><span class="${n > pl.max ? 'over' : ''}">${n} / ${pl.max} joueurs</span><span>${until}</span></div>
        <p class="note">${pl.paid ? 'Le forfait Groupe permet jusqu’à 16 joueurs.' : 'Le forfait Gratuit permet 4 joueurs. Le forfait Groupe va jusqu’à 16.'} ${meOwner ? 'Vous êtes le propriétaire : c’est vous qui gérez le forfait.' : 'Le forfait est géré par le propriétaire du groupe' + (own ? ' (' + esc(own.name) + ')' : '') + '.'}</p>
        ${meOwner ? `<a class="btn small" href="${buyUrl()}" target="_blank" rel="noopener">${pl.paid ? 'Renouveler ou gérer' : 'Passer au forfait Groupe'}</a>` : ''}
      </div>`;
  }
  // Gérer le groupe actif : archiver / rétablir / supprimer (propriétaire seulement)
  function manageGroupHtml() {
    if (S.fromLogin) return '';
    const me = (S.acctGroups || []).find(x => x.gid === Store.gid);
    if (!me || !me.owner) return '';
    return `<h3 class="acct-h">Gérer « ${esc(me.name)} »</h3>
      <section class="card manage-g">
        ${me.archived
          ? `<p class="note">Ce groupe est archivé. Rétablissez-le pour recommencer à organiser des parties.</p><button class="btn small" data-grpstate="unarchive" type="button">Rétablir le groupe</button>`
          : `<p class="note"><b>Archiver :</b> le groupe passe dans « Groupes archivés », pour vous et pour tous les joueurs. Rien n’est perdu ; vous pouvez le rétablir.</p><button class="btn ghost small" data-grpstate="archive" type="button">Archiver le groupe</button>`}
        <p class="note" style="margin-top:14px"><b>Supprimer :</b> le groupe disparaît pour vous et pour tous les joueurs, avec ses parties, ses dates et ses compétitions. Impossible de revenir en arrière.</p>
        <button class="btn ghost small danger-txt" data-grpstate="delete" type="button">Supprimer le groupe</button>
      </section>`;
  }
  async function setGroupState(kind) {
    const me = (S.acctGroups || []).find(x => x.gid === Store.gid); if (!me) return;
    const done = async (flags, msg) => {
      try { await Store.setGroupState(flags); } catch (e) { toast('Impossible : ' + (/permission/i.test(e.message) ? 'seul le propriétaire peut le faire.' : e.message)); return false; }
      S.groups = await Store.listGroups().catch(() => S.groups); S.acctGroups = null; toast(msg); return true;
    };
    if (kind === 'archive') { if (await done({ archived: Date.now() }, `« ${me.name} » est archivé.`)) render(); return; }
    if (kind === 'unarchive') { if (await done({ archived: 0 }, `« ${me.name} » est rétabli.`)) render(); return; }
    openSheet(`<h3>Supprimer « ${esc(me.name)} » ?</h3>
      <p>Le groupe disparaîtra pour vous et pour ses ${(S.players || []).length} joueurs, avec ses parties, ses dates offertes et ses compétitions.</p>
      <p class="warn">C’est définitif. Pour seulement le mettre de côté, choisissez plutôt « Archiver ».</p>
      <label>Pour confirmer, écrivez le nom du groupe<input id="delName" type="text" autocomplete="off" placeholder="${esc(me.name)}"></label>
      <div class="sheet-actions"><button class="btn" id="delGo" type="button" style="background:var(--red)" disabled>Supprimer définitivement</button><button class="btn ghost" data-close type="button">Annuler</button></div>`, sh => {
      const inp = sh.querySelector('#delName'), go2 = sh.querySelector('#delGo');
      inp.oninput = () => { go2.disabled = L.norm(inp.value) !== L.norm(me.name); };
      sh.querySelector('[data-close]').onclick = closeSheet;
      go2.onclick = async () => {
        go2.disabled = true;
        if (!(await done({ deleted: Date.now() }, `« ${me.name} » est supprimé.`))) { go2.disabled = false; return; }
        closeSheet();
        const rest = (await Store.myGroupList().catch(() => [])).filter(x => x.gid !== me.gid);
        if (rest.length) openGroup(rest.find(x => !x.archived) || rest[0]);
        else { S.acctGroups = []; go('compte'); setTimeout(newGroupSheet, 400); }
      };
    });
  }
  async function openGroup(x) {
    try { await Store.switchGroup(x); ls.set('pelland.lastGame', null); location.href = location.pathname; } catch (e) { toast(e.message); }
  }
  function bindCompte(v) {
      commonNav(v);
      v.querySelectorAll('[data-gopen]').forEach(b => b.onclick = () => { b.disabled = true; b.textContent = '…'; openGroup(S.acctGroups[+b.dataset.gopen]); });
      v.querySelectorAll('[data-grpstate]').forEach(b => b.onclick = () => setGroupState(b.dataset.grpstate));
      const lo = v.querySelector('#logout2'); if (lo) lo.onclick = () => Store.logout();
      const cp = v.querySelector('#chgPw'); if (cp) cp.onclick = () => openSheet(`<h3>Changer mon mot de passe</h3>
          <label>Nouveau mot de passe<input id="np1" type="password" autocomplete="new-password" placeholder="6 caractères ou plus"></label>
          <label>Confirmez<input id="np2" type="password" autocomplete="new-password"></label>
          <p class="note" id="npMsg"></p>
          <div class="row"><button class="btn small" id="npGo" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
        sh.querySelector('[data-close]').onclick = closeSheet;
        sh.querySelector('#npGo').onclick = async () => {
          const a = sh.querySelector('#np1').value, b = sh.querySelector('#np2').value, m = sh.querySelector('#npMsg');
          if (a.length < 6) return m.textContent = 'Au moins 6 caractères.'; if (a !== b) return m.textContent = 'Les deux mots de passe ne sont pas pareils.';
          try { closeSheet(); location.href = HoldingAI.compteUrl; }
          catch (e) { m.textContent = /recent/.test(e.code || '') ? 'Pour votre sécurité : déconnectez-vous, puis « Mot de passe oublié ? » sur l’écran de connexion.' : 'Impossible : ' + (e.code || e.message); }
        };
      });
    }
  // ==== src/commun/avis.js ====
  // ---------------- Avis des joueurs : demandés après une partie terminée ; publiés sur fanion.ai si le joueur accepte et après approbation ----------------
  const AVIS_K = 'fanion.avis.etat';   // { given: true } ou { later: date }
  function avisCard(where) {
    if (Store.needLogin || !meId()) return '';
    const st = ls.get(AVIS_K, {}) || {};
    if (where === 'game') ls.set(AVIS_K, { ...st, eligible: 1 });
    if (st.given || (st.later && Date.now() - st.later < 30 * 864e5)) return '';
    if (where === 'home' && !st.eligible) return '';
    return `<section class="card avis-card"><div class="av-stars" aria-hidden="true">★★★★★</div>
      <h3>${MARQUE.nomMaj} vous plaît ?</h3><p>Dites-le en une phrase. Avec votre accord, votre commentaire pourra paraître sur ${MARQUE.domaine} pour aider d’autres groupes à se lancer.</p>
      <div class="row"><button class="btn small" data-avis type="button">Donner mon avis</button><button class="btn ghost small" data-avislater type="button">Plus tard</button></div></section>`;
  }
  const shortName = n => { const w = String(n || '').trim().split(/\s+/); return (w[0] || '') + (w.length > 1 ? ' ' + w[w.length - 1][0].toUpperCase() + '.' : ''); };
  async function avisSheet() {
    const me = (S.players || []).find(p => p.id === meId()) || { name: ls.get('pelland.me', '') };
    const old = await Store.getAvis() || {};
    let stars = old.stars || 0;
    openSheet(`<div class="avis-sheet"><h3>Votre avis sur ${APP}</h3>
      <div class="av-pick" role="radiogroup" aria-label="Note sur 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" data-star="${n}" aria-label="${n} étoile${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      <label class="fld">En une phrase, qu’est-ce que ${APP} change pour votre groupe ?<textarea id="avText" maxlength="280" rows="3" placeholder="${SPORT.avisExemple}">${esc(old.text || '')}</textarea></label>
      <p class="note" id="avCount"></p>
      <label class="av-ok"><input type="checkbox" id="avOk" ${old.ok === false ? '' : 'checked'}><span>J’accepte que ${APP} publie ce commentaire sur ${MARQUE.domaine}, signé <b>${esc(shortName(me.name))}</b>, ${esc(groupName())}.</span></label>
      <div class="sheet-actions"><button class="btn" id="avSend" type="button">Envoyer</button><button class="btn ghost" data-close type="button">Annuler</button></div></div>`, sh => {
      const paint = () => { sh.querySelectorAll('[data-star]').forEach(b => { const on = +b.dataset.star <= stars; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(+b.dataset.star === stars)); }); };
      const ta = sh.querySelector('#avText'), cnt = () => { sh.querySelector('#avCount').textContent = `${ta.value.length} / 280`; };
      sh.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { stars = +b.dataset.star; paint(); });
      ta.oninput = cnt; paint(); cnt();
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('#avSend').onclick = async () => {
        if (!stars) { toast('Choisissez une note de 1 à 5 étoiles.'); return; }
        const a = { stars, text: ta.value.trim().slice(0, 280), name: shortName(me.name).slice(0, 40), groupName: String(groupName() || '').slice(0, 60), ok: sh.querySelector('#avOk').checked, at: Date.now() };
        try { await Store.saveAvis(a); ls.set(AVIS_K, { ...(ls.get(AVIS_K, {}) || {}), given: 1 }); closeSheet(); toast('Merci ! Votre avis est envoyé.'); render(); }
        catch (e) { toast('Envoi impossible : ' + e.message); }
      };
    });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-avis],[data-avislater]'); if (!t) return;
    if (t.hasAttribute('data-avis')) { avisSheet(); return; }
    ls.set(AVIS_K, { ...(ls.get(AVIS_K, {}) || {}), later: Date.now() }); render();
  });
  // ==== src/commun/retour.js ====
  // ---------------- Boucle de retour : idées → équipe (console HoldingAI) → réponse et nouveautés dans l'app, sondage éclair ----------------
  const RETOUR_API = MARQUE.api + '/api/retour';
  const R = { idees: [], nouveautes: [], sondageDernier: null, charge: false, sondage: null };
  const JOUR = 864e5;
  const STATUT_IDEE = { recue: ['Reçue', ''], etudiee: ['À l’étude', 'etude'], prevue: ['Prévue', 'prevue'], faite: ['Faite ✓', 'faite'], non: ['Pas pour l’instant', 'non'] };
  const TYPE_IDEE = { idee: ['💡', 'Une idée'], probleme: ['🐞', 'Un problème'], aime: ['❤️', 'J’aime'], autre: ['💬', 'Autre'] };
  const PLACE_IDEE = { idee: 'Ce serait pratique si…', probleme: 'Qu’est-ce qui accroche ? Sur quel écran ?', aime: 'Ce que vous aimez le plus…', autre: 'Votre message…' };
  const cleIdee = i => i.statut + '|' + (i.repondu || '');
  const vuKey = () => 'fanion.retour.' + (Store.uid || '');
  const vuR = () => ls.get(vuKey(), {}) || {};
  const noterVu = o => ls.set(vuKey(), { ...vuR(), ...o });
  async function retourApi(body) {
    const tok = Store.mode === 'cloud' && await Store.token(); if (!tok) throw new Error('Connexion requise.');
    const r = await fetch(RETOUR_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Erreur ' + r.status); return d;
  }
  async function chargerRetour() {
    if (Store.needLogin || Store.mode !== 'cloud') return;
    try { const d = await retourApi({ action: 'lire' }); Object.assign(R, { idees: d.idees || [], nouveautes: d.nouveautes || [], sondageDernier: d.sondageDernier, charge: true }); }
    catch (e) { return; }
    if (S.view === 'home' && !document.querySelector('#sheetWrap:not([hidden]), #welcome, .cd-fond')) render();
  }
  // Une seule carte à la fois en haut de l'accueil : réponse reçue, puis nouveauté, puis sondage éclair
  function carteRetourChoix() {
    if (!R.charge || Store.needLogin) return null;
    const vu = vuR(), vuI = vu.idees || {};
    const rep = R.idees.find(i => (i.reponse || ['prevue', 'faite', 'non'].includes(i.statut)) && vuI[i.id] !== cleIdee(i));
    if (rep) return { k: 'reponse', i: rep };
    const cree = Number(ls.get('fanion.premiereVisite', 0)) || (ls.set('fanion.premiereVisite', Date.now()), Date.now());
    const depuis = Math.max(cree, Number(vu.nv || 0));
    const nv = R.nouveautes.find(n => new Date(n.cree).getTime() > depuis);
    if (nv) return { k: 'nouveaute', n: nv };
    if (R.sondage) return { k: 'sondage' };
    const dernier = Math.max(new Date(R.sondageDernier || 0).getTime(), Number(vu.sondage || 0));
    if (Date.now() - cree >= 10 * JOUR && Date.now() - dernier >= 90 * JOUR && Date.now() - Number(vu.sondagePlusTard || 0) >= 14 * JOUR) return { k: 'sondage' };
    return null;
  }
  function retourCarte() {
    const c = carteRetourChoix(); if (!c) return '';
    if (c.k === 'reponse') {
      const i = c.i, [mot] = STATUT_IDEE[i.statut] || STATUT_IDEE.recue;
      return `<section class="card retour-carte"><b>${i.statut === 'faite' ? '🎉 Votre idée est en ligne !' : '💬 L’équipe vous a répondu'}</b>
        <p class="note">Vous avez écrit : « ${esc(i.texte.length > 140 ? i.texte.slice(0, 140) + '…' : i.texte)} » · <b>${esc(mot)}</b></p>
        ${i.reponse ? `<p>${esc(i.reponse)}</p>` : ''}
        <div class="row"><button class="btn small" type="button" data-retour="vu-idee" data-id="${esc(i.id)}">Merci !</button><button class="btn ghost small" type="button" data-idee>Voir mes envois</button></div></section>`;
    }
    if (c.k === 'nouveaute') {
      const n = c.n;
      return `<section class="card retour-carte"><b>✨ Nouveau : ${esc(n.titre)}</b>${n.texte ? `<p>${esc(n.texte)}</p>` : ''}
        <div class="row"><button class="btn small" type="button" data-retour="vu-nv" data-t="${new Date(n.cree).getTime()}">Super</button><button class="btn ghost small" type="button" data-idee>Proposer une idée</button></div></section>`;
    }
    if (!R.sondage) return `<section class="card retour-carte"><b>Recommanderiez-vous ${APP} à ${SPORT.amiJoueur} ?</b>
        <p class="note">0 = pas du tout, 10 = sans hésiter. Une seule question.</p>
        <div class="nps" role="group" aria-label="Note de 0 à 10">${Array.from({ length: 11 }, (_, n) => `<button type="button" class="nps-n" data-note="${n}">${n}</button>`).join('')}</div>
        <div class="row"><button class="linkbtn" type="button" data-retour="sondage-plus-tard">Plus tard</button></div></section>`;
    const n = R.sondage.note, q = n >= 9 ? 'Merci ! Qu’est-ce que vous aimez le plus ?' : n >= 7 ? 'Merci ! Qu’est-ce qui le rendrait parfait pour votre groupe ?' : 'Merci de votre franchise. Qu’est-ce qui accroche le plus ?';
    return `<section class="card retour-carte"><b>${esc(q)}</b>
        <textarea id="sondageRaison" rows="3" maxlength="2000" placeholder="Facultatif, mais ça nous aide beaucoup"></textarea>
        <div class="row"><button class="btn small" type="button" data-retour="sondage-envoyer">Envoyer</button><button class="linkbtn" type="button" data-retour="sondage-passer">Passer</button></div></section>`;
  }
  async function finirSondage(raison) {
    const n = R.sondage.note; R.sondage = null; noterVu({ sondage: Date.now() });
    retourApi({ action: 'sondage', note: n, raison: raison || null, groupe: groupName() }).catch(() => { });
    if (raison) envoyerIdee({ type: n >= 9 ? 'aime' : n <= 6 ? 'probleme' : 'idee', texte: raison, source: 'sondage' }).catch(() => { });
    render();
    if (n >= 9) openSheet(`<h3>Merci, ça fait vraiment plaisir !</h3><p>Vous connaissez ${SPORT.autreGroupe} qui court après ses joueurs ? Envoyez-lui votre lien : c’est gratuit pour ${SPORT.gratuitPour}${meId() === ownerId() ? ', et vous obtenez 5 $ de rabais sur votre prochaine saison s’il passe au forfait Groupe' : ''}.</p>
      <div class="sheet-actions"><button class="btn" data-refshare type="button">Partager mon lien</button><button class="btn ghost" data-close type="button">Plus tard</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; sh.querySelector('[data-refshare]').addEventListener('click', () => setTimeout(closeSheet, 300)); });
    else toast('Merci ! Votre réponse est bien reçue. L’équipe la lit.');
  }
  async function envoyerIdee({ type, texte, contact, source }) {
    const me = (S.players || []).find(p => p.id === meId());
    const d = await retourApi({ action: 'idee', type, texte, contact: !!contact, source, prenom: firstName((me && me.name) || ls.get('pelland.me', '')), groupe: groupName(), ecran: S.view, appareil: navigator.userAgent.slice(0, 160) });
    if (d.idee) R.idees.unshift(d.idee);
    return d;
  }
  function ideeSheet(type0) {
    let type = type0 || 'idee';
    const mesEnvois = () => R.idees.length ? `<h4 class="idee-h">Vos envois</h4><ul class="idee-liste">${R.idees.map(i => {
      const [mot, cls] = STATUT_IDEE[i.statut] || STATUT_IDEE.recue;
      return `<li><div class="idee-tete"><span>${(TYPE_IDEE[i.type] || TYPE_IDEE.autre)[0]} ${esc(new Date(i.cree).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' }))}</span><span class="idee-statut ${cls}">${esc(mot)}</span></div>
        <p>${esc(i.texte)}</p>${i.reponse ? `<p class="idee-rep"><b>Réponse de l’équipe :</b> ${esc(i.reponse)}</p>` : ''}</li>`;
    }).join('')}</ul>` : '';
    openSheet(`<h3>Une idée ? Un pépin ?</h3>
      <p class="note">Ça va directement à l’équipe ${MARQUE.duNom}. On lit tout, et la réponse s’affiche ici, dans l’app.</p>
      <div class="seg idee-types">${Object.entries(TYPE_IDEE).map(([k, [ic, mot]]) => `<button type="button" data-itype="${k}" aria-pressed="${k === type}"><b>${ic}</b><small>${esc(mot)}</small></button>`).join('')}</div>
      <label class="fld"><span class="sr-only">Votre message</span><textarea id="ideeTexte" rows="4" maxlength="2000" placeholder="${esc(PLACE_IDEE[type])}"></textarea></label>
      <label class="av-ok"><input type="checkbox" id="ideeContact"><span>L’équipe peut me texter pour en parler.</span></label>
      <div class="sheet-actions"><button class="btn" id="ideeGo" type="button">Envoyer</button><button class="btn ghost" data-close type="button">Fermer</button></div>
      <div id="ideeMiennes">${mesEnvois()}</div>`, sh => {
      const ta = sh.querySelector('#ideeTexte');
      sh.querySelectorAll('[data-itype]').forEach(b => b.onclick = () => { type = b.dataset.itype; sh.querySelectorAll('[data-itype]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); ta.placeholder = PLACE_IDEE[type]; });
      sh.querySelector('[data-close]').onclick = closeSheet;
      const go2 = sh.querySelector('#ideeGo');
      go2.onclick = async () => {
        const texte = ta.value.trim(); if (texte.length < 2) { toast('Écrivez quelques mots.'); ta.focus(); return; }
        go2.disabled = true;
        try { await envoyerIdee({ type, texte, contact: sh.querySelector('#ideeContact').checked }); }
        catch (e) { go2.disabled = false; toast('Envoi impossible : ' + e.message); return; }
        go2.disabled = false; ta.value = ''; sh.querySelector('#ideeContact').checked = false;
        sh.querySelector('#ideeMiennes').innerHTML = mesEnvois();
        toast(type === 'aime' ? 'Merci ! Ça fait vraiment plaisir à l’équipe.' : 'Merci ! C’est bien reçu. Vous verrez notre réponse ici.');
      };
      // Ouvrir la liste vaut lecture des réponses
      const vu = vuR().idees || {}; R.idees.forEach(i => { vu[i.id] = cleIdee(i); }); noterVu({ idees: vu });
      if (!R.charge) chargerRetour().then(() => { const m = sh.querySelector('#ideeMiennes'); if (m) m.innerHTML = mesEnvois(); });
    });
  }
  document.addEventListener('click', e => {
    if (!e.target.closest) return;
    const t = e.target.closest('[data-idee]'); if (t) { e.preventDefault(); ideeSheet(); return; }
    const nb = e.target.closest('.retour-carte [data-note]'); if (nb) { R.sondage = { note: Number(nb.dataset.note) }; render(); setTimeout(() => { const x = document.getElementById('sondageRaison'); if (x) x.focus(); }, 60); return; }
    const b = e.target.closest('[data-retour]'); if (!b) return;
    const g = b.dataset.retour;
    if (g === 'vu-idee') { const i = R.idees.find(x => x.id === b.dataset.id); const vu = vuR().idees || {}; if (i) vu[i.id] = cleIdee(i); noterVu({ idees: vu }); }
    else if (g === 'vu-nv') noterVu({ nv: Number(b.dataset.t) });
    else if (g === 'sondage-plus-tard') noterVu({ sondagePlusTard: Date.now() });
    else if (g === 'sondage-envoyer') { finirSondage((document.getElementById('sondageRaison') || {}).value || ''); return; }
    else if (g === 'sondage-passer') { finirSondage(''); return; }
    render();
  });
  // ==== src/commun/parrainage.js ====
  // ---------------- Parrainage : le propriétaire partage son lien ; les groupes créés avec ce lien sont comptés ----------------
  function refLink(code) { return location.origin + location.pathname + '?ref=' + encodeURIComponent(code || Store.gid); }
  function referralCard() {
    if (Store.needLogin || !meId() || meId() !== ownerId()) return '';
    const mine = (S.groups || []).filter(g => g.ref === Store.gid), paid = mine.filter(g => planOf(g).paid && g.id !== 'pelland').length;
    return `<section class="card referral"><h3>Parrainez un autre groupe</h3>
      <p>Pour chaque groupe qui s’inscrit avec votre lien et passe au forfait Groupe, <b>vous obtenez 5 $ de rabais sur votre prochaine saison</b>. Les rabais s’additionnent.</p>
      <div class="ref-stats"><span><b>${mine.length}</b> groupe${mine.length > 1 ? 's' : ''} inscrit${mine.length > 1 ? 's' : ''}</span><span><b>${paid}</b> au forfait Groupe</span></div>
      <div class="row"><button class="btn small" data-refshare type="button">Partager mon lien</button><button class="btn ghost small" data-refcopy type="button">Copier</button></div></section>`;
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-refshare],[data-refcopy]'); if (!t) return;
    const url = refLink(), text = SPORT.parrainage(APP);
    if (t.hasAttribute('data-refshare') && navigator.share) { try { await navigator.share({ title: APP, text, url }); } catch (x) { } return; }
    try { await navigator.clipboard.writeText(text + ' ' + url); toast('Lien copié.'); } catch (x) { openSheet(`<h3>Votre lien</h3><p class="note">Copiez-le :</p><input type="text" readonly value="${esc(url)}" onclick="this.select()"><div class="sheet-actions"><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; }); }
  });
  // ==== src/commun/viral.js ====
  // ---------------- Effet viral : chaque joueur invité peut lancer son propre groupe, gratuit ----------------
  // Montré aux membres qui ne sont pas propriétaires d'un groupe (à l'accueil, et à la fin d'une partie).
  function ownsAGroup() { const me = meId(); return (!!me && me === ownerId()) || Store.myGroups().some(x => x.owner); }
  function viralCard(where) {
    if (ownsAGroup() || Store.needLogin) return '';
    if (where === 'home' && (ls.get('pelland.viral.hide', 0) || 0) > Date.now()) return '';
    return `<section class="card viral"><div class="viral-flag" aria-hidden="true"><svg width="22" height="26" viewBox="0 0 26 30"><path d="M5 2v26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3l15 5.5L6 14z" fill="#e3a90b"/></svg></div>
      <div><h3>Vous aussi, organisez votre gang</h3>
      <p>Créez votre propre groupe en une minute : ${SPORT.atouts}. <b>Gratuit pour 4 joueurs.</b></p>
      <div class="row"><button class="btn small" data-viral type="button">Créer mon groupe</button>${where === 'home' ? '<button class="btn ghost small" data-viralhide type="button">Plus tard</button>' : ''}</div>
      <p class="note">Vous restez dans « ${esc(groupName())} » : passez d’un groupe à l’autre à l’accueil.</p></div></section>`;
  }
  function myPhone() { const me = (S.players || []).find(p => p.id === meId()); return (me && me.phone) || ''; }
  function newGroupSheet() {
    openSheet(`<h3>Créer mon groupe</h3>
      <label>Nom du groupe<input id="vgName" type="text" autocapitalize="sentences" placeholder="ex. Les lève-tôt du samedi"></label>
      <label>Votre prénom et nom<input id="vgMe" type="text" autocapitalize="words" value="${esc(ls.get('pelland.me', '') || '')}"></label>
      <p class="note" id="vgMsg">Même compte et même mot de passe : vous passerez d’un groupe à l’autre à l’accueil. Ajoutez ensuite vos joueurs dans Joueurs ; ils reçoivent l’invitation par texto. Gratuit jusqu’à 4 joueurs.</p>
      <div class="row"><button class="btn small" id="vgGo" type="button">Créer le groupe</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      const b = sh.querySelector('#vgGo');
      // Déjà un groupe gratuit : on le dit tout de suite, avec le passage au forfait Groupe
      Store.groupeGratuit().then(g => { if (!g || !sh.isConnected) return; b.disabled = true;
        sh.querySelector('#vgMsg').innerHTML = `<b>Avec le forfait Gratuit, vous avez droit à un groupe de 4 joueurs.</b> Vous avez déjà « ${esc(g.name)} ». Passez-le au forfait Groupe (jusqu’à 16 joueurs) pour créer un autre groupe, ou supprimez-le dans Mon compte. <a class="linkbtn" href="${buyUrl()}" target="_blank" rel="noopener">Passer au forfait Groupe</a>`; }).catch(() => { });
      b.onclick = async () => {
        const msg = sh.querySelector('#vgMsg'); b.disabled = true; msg.textContent = 'Création…';
        try { await Store.createGroup(sh.querySelector('#vgName').value, sh.querySelector('#vgMe').value, Store.gid); ls.set('pelland.lastGame', null); location.href = location.pathname; }
        catch (e) { msg.textContent = e.message; b.disabled = false; }
      };
      setTimeout(() => { const i = sh.querySelector('#vgName'); if (i) i.focus(); }, 50);
    });
  }
  function rememberCurrent() { if (!Store.needLogin && meId()) Store.rememberGroup(Store.gid, groupName(), meId(), ls.get('pelland.me', ''), meId() === ownerId()); }
  async function switchGroupSheet() {
    let l = [];
    try { l = (await Store.myPlayers()).map(p => ({ gid: p.groupId || 'pelland', playerId: p.id, playerName: p.name, name: ((S.groups || []).find(g => g.id === (p.groupId || 'pelland')) || {}).name || p.groupId })); } catch (e) { }
    if (!l.length) l = Store.myGroups();
    openSheet(`<h3>Mes groupes</h3>
      <div class="pick-list">${l.map((x, i) => `<button class="btn ${x.gid === Store.gid ? '' : 'ghost'} small" data-gsw="${i}" type="button" ${x.gid === Store.gid ? 'disabled' : ''}>${esc(x.name)}${x.gid === Store.gid ? ' · actuel' : ''}</button>`).join('')}</div>
      <p class="note" id="gswMsg">Les groupes où votre cellulaire est inscrit. Touchez-en un pour y passer.</p>
      <div class="row"><button class="btn ghost small" data-viral type="button">Créer un autre groupe</button><button class="btn ghost small" data-close type="button">Fermer</button></div>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelectorAll('[data-gsw]').forEach(b => b.onclick = async () => {
        const msg = sh.querySelector('#gswMsg'); msg.textContent = 'Changement…';
        try { await Store.switchGroup(l[+b.dataset.gsw]); ls.set('pelland.lastGame', null); location.href = location.pathname; }
        catch (e) { msg.textContent = e.message; }
      });
    });
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-typepartie]'); if (!t) return; e.preventDefault(); MODULE.nouvellePartie(); });
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-viral],[data-viralhide],#switchGroup'); if (!t) return;
    e.preventDefault();
    if (t.id === 'switchGroup') return go('compte');
    if (t.hasAttribute('data-viralhide')) { ls.set('pelland.viral.hide', Date.now() + 30 * 864e5); return render(); }
    closeSheet();
    // Forfait Gratuit = un seul groupe : un deuxième groupe demande le forfait Groupe, comme un 5e joueur
    Store.groupeGratuit().then(g => g ? deuxiemeGroupeSheet(g) : newGroupSheet()).catch(() => newGroupSheet());
  });
  // ==== src/golf/aide.js ====
  // ---------------- Petit « i » d'explication ----------------
  const info = key => `<button type="button" class="info" data-info="${key}" aria-label="Explication">i</button>`;
  const HELP = {
    handicap: ['Handicap', ['Hcp de parcours = index × slope ÷ 113 + (évaluation − normale), arrondi. Il dépend du tertre choisi.', 'Bas handicap : le meilleur joue à 0 et les autres reçoivent la différence (ex. 12 − 7 = 5 coups).', 'Full handicap : chacun reçoit son Hcp au complet.', 'Les coups se placent d’abord sur les trous les plus difficiles (handicap 1, 2, 3…). Au-delà de 18, un 2e coup.']],
    argent: ['L’argent de la game à Pelland', ['La game commence à : le montant de départ, gagné par l’équipe qui mène à la fin.', 'À chaque revirement : ajouté chaque fois que l’équipe qui mène perd son avance (retour à égalité ou l’autre passe devant).', 'Par point net : multiplié par l’écart de points à la fin.', 'Chaque normale 3 : gagné par l’équipe qui a la skin et fait la normale ; sinon reporté à la normale 3 suivante.', 'Tous les montants sont par joueur.']],
    equipes: ['Les équipes', ['Meilleur + Pire : le plus bas index joue avec le plus haut, les deux du milieu ensemble.', 'Le meilleur joueur est toujours chez les Rouges.', 'Je choisis : vous décidez qui joue avec qui.']],
    game: ['La game commence à', ['Le montant de départ, par joueur. L’équipe qui mène à la fin du parcours le gagne.']],
    par3now: ['Les pars 3 sont à', ['Le montant en jeu à la prochaine normale 3, par joueur.', 'L’équipe qui a la skin et fait la normale le gagne. Sinon, il est reporté et s’ajoute à la normale 3 suivante.']],
    revirement: ['À chaque revirement', ['Un revirement, c’est quand l’équipe qui mène perd son avance : quand les points reviennent à égalité (à zéro) ou quand l’autre équipe passe devant. Chaque revirement ajoute ce montant à la game, par joueur.', 'La case montre le montant par revirement et le nombre de revirements jusqu’ici.']],
    meneurs: ['Meneurs', ['L’équipe en avance et son écart en points nets.', 'Gain par joueur en ce moment = la game + les revirements + les normales 3 (gagnées moins perdues) + l’écart × le montant par point.']],
    press: ['Press et reroll', ['Avant le départ d’un trou, l’équipe en déficit peut presser : les points du trou comptent double.', 'L’autre équipe peut alors répondre par un reroll : les points comptent quatre fois.', 'Le responsable touche le bouton Press du trou. Oublié ? On peut le toucher après les scores : revenez au trou avec ‹ et touchez Press, ou retirez-la avec Pressé ✓.']],
  };
  function showInfo(key) {
    let t, lines;
    if (key.startsWith('jeu-perso')) { const c = key === 'jeu-perso' ? (S.game || {}).custom : jeuOf(key.slice(4)); if (!c) return; t = c.name || 'Jeu maison'; lines = [...persoLines(c), gainRule({ format: 'perso', custom: c, players: [], perPoint: c.pp }) + '.']; }
    else if (key.startsWith('jeu-')) { const g = GAMES_INFO.find(x => x.f === key.slice(4)); if (!g) return; t = L.FORMATS[g.f]; lines = [g.who, ...g.rules, ...g.money.map(m => 'Argent : ' + m)]; }
    else if (HELP[key]) [t, lines] = HELP[key]; else return;
    openSheet(`<h3>${esc(t)}</h3><ul class="info-list">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="sheet-actions"><button class="btn" data-close type="button">Compris</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-info]'); if (!b) return; e.preventDefault(); e.stopPropagation(); showInfo(b.dataset.info); }, true);
  // ==== src/golf/jeux.js ====
  // ---------------- Les jeux (règles) ----------------
  const GAMES_INFO = [
    { f: 'pelland', who: '4 joueurs, en équipes de deux (Rouges et Bleus)', rules: [
      'À chaque trou, le joueur au plus bas score net gagne 2 points pour son équipe.',
      'Le joueur au plus haut score net donne 2 points à l’équipe adverse.',
      'Égalité entre deux équipes : pas de points ; dans la même équipe : 2 points une seule fois.',
      'Skin : 1 point à l’équipe du joueur qui l’obtient. S’il ne fait pas la normale (au brut), le point va à l’autre équipe.',
      'Oiselet (au brut) : 1 point à l’équipe du joueur, pour chaque oiselet.',
      'Cabane : oiselet brut + skin + plus haut net chez l’adversaire = 12 points pour le trou.',
      'Press : l’équipe en déficit double les points du trou, skin et oiselets compris ; l’autre peut répondre par un reroll (×4).'],
      money: ['La game : montant de départ gagné par l’équipe qui mène à la fin.', 'Chaque revirement (l’équipe qui mène perd son avance : retour à égalité ou l’autre passe devant) ajoute un montant.', 'Normales 3 : la skin + la normale gagne le montant choisi (5 $ par défaut), sinon reporté à la normale 3 suivante.', 'Chaque point net d’écart vaut le montant par point.', 'Montants par joueur.'] },
    { f: 'neuf', who: '3 joueurs, chacun pour soi', rules: ['À chaque trou : 5 points au meilleur net, 3 au deuxième, 1 au troisième.', 'Égalité : on partage (4-4-1, 5-2-2 ou 3-3-3).'],
      money: ['Chacun gagne ou paie la différence de points avec chaque autre joueur, × le montant par point.'] },
    { f: 'bestball', who: '4 joueurs, en équipes de deux', rules: ['Le meilleur net de chaque équipe compte.', 'L’équipe la plus basse gagne le trou ; égalité : trou partagé.'],
      money: ['Écart de trous gagnés × le montant par trou, par joueur.'] },
    { f: 'match', who: '2 joueurs, un contre un', rules: ['Au net, avec les coups de handicap de chacun.', 'Le plus bas score du trou le gagne ; égalité : trou partagé.', 'On compte l’avance en trous (« 2 d’avance »). Dès que l’avance dépasse le nombre de trous qui restent, le match est fini : « gagne 3 et 2 » veut dire 3 trous d’avance avec 2 trous à jouer.', 'Égalité après le dernier trou : match nul.'],
      money: ['Un seul enjeu, pour la partie : le gagnant du match empoche le montant ; match nul, personne ne paie.'] },
    { f: 'vegas', who: '4 joueurs, en équipes de deux', rules: ['Sur chaque trou, les deux scores nets de l’équipe forment un nombre, le plus bas d’abord : 4 et 5 donnent 45.', 'Un oiselet (au brut) renverse le nombre de l’autre équipe : son 45 devient 54. Oiselet des deux côtés : rien ne change.', 'Maximum par joueur : double boguey net, pour garder des nombres à deux chiffres.', 'L’écart entre les deux nombres donne les points du trou à l’équipe la plus basse.'],
      money: ['Écart de points × le montant par point, par joueur. Les points montent vite : on joue souvent à 0,10 $ ou 0,25 $ le point.'] },
    { f: 'nassau', who: '4 joueurs, en équipes de deux', rules: ['Trois paris en Best Ball : l’aller (trous 1 à 9), le retour (10 à 18) et le total des 18 trous.', 'Le meilleur net de chaque équipe gagne le trou ; l’équipe qui gagne le plus de trous gagne le pari.', 'Égalité dans un pari : personne ne gagne.', 'Sur 9 trous : un seul pari.'],
      money: ['Chaque pari gagné vaut la mise ; perdu, −la mise. Maximum : 3 fois la mise, par joueur.'] },
    { f: 'wolf', who: '4 joueurs ; le loup tourne à chaque trou', rules: ['Joueur 1 est le loup au trou 1, joueur 2 au trou 2, et ainsi de suite.', 'Le loup choisit un partenaire : chaque gagnant fait +1, chaque perdant −1.', 'Le loup joue seul : 2 points par adversaire, gagnés ou perdus.', 'Seul à l’aveugle (avant les coups de départ) : 3 points par adversaire.'],
      money: ['Points × le montant par point.'] },
    { f: 'sixes', who: '4 joueurs ; les équipes changent', rules: ['1+2 contre 3+4, puis 1+3 contre 2+4, puis 1+4 contre 2+3 (6 trous chacun sur 18, 3 sur 9).', 'Dans chaque tranche : Best Ball, 1 point par trou gagné.'],
      money: ['La tranche gagnée vaut la mise ; perdue, −la mise.'] },
    { f: 'skins', who: '3 ou 4 joueurs, chacun pour soi', rules: ['Le seul meilleur net du trou gagne le skin.', 'Égalité : le skin est reporté et s’ajoute au trou suivant.'],
      money: ['Chaque autre joueur paie le montant par skin au gagnant.'] },
  ];
  function vJeux() {
    $('#barTitle').textContent = 'Les jeux';
    return `<p class="note">Le jeu se choisit en créant la partie. Tout se compte au net, avec les coups de handicap de chacun.</p>
      <div class="jeux">${GAMES_INFO.map(x => `<details class="card jeu"><summary><b>${esc(L.FORMATS[x.f])}</b><span>${esc(x.who)}</span></summary>
        <h3>Règles</h3><ul>${x.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <h3>L’argent</h3><ul>${x.money.map(r => `<li>${esc(r)}</li>`).join('')}</ul></details>`).join('')}</div>
      <h2 class="jeux-h">Jeux maison du groupe</h2>
      <div class="jeux">${(S.jeux || []).map(j => `<details class="card jeu"><summary><b>${esc(j.name)}</b><span>${j.mode === 'equipes' ? '4 joueurs, en équipes de deux' : '3 ou 4 joueurs, chacun pour soi'}</span></summary>
        <ul>${persoLines(j).map(r => `<li>${esc(r)}</li>`).join('')}<li>${esc(gainRule({ format: 'perso', custom: j, players: [], perPoint: j.pp }))}.</li></ul>
        ${canOrganize() ? `<div class="row" style="margin-top:10px"><button class="btn small" data-jedit="${esc(j.id)}" type="button">Modifier</button><button class="btn ghost small" data-jdel="${esc(j.id)}" type="button">${S.confirmDelJ === j.id ? 'Confirmer' : 'Retirer'}</button></div>` : ''}</details>`).join('') || '<p class="note">Aucun jeu maison pour l’instant.</p>'}</div>
      ${canOrganize() ? '<button class="btn" data-jnew type="button">Ajouter un jeu</button>' : ''}`;
  }
  // Ajouter un jeu : on demande d'abord si les règles sont sur le web (adresse) ; sinon, on demande de l'expliquer
  function askNewGame() {
    const st = { web: null };
    const draw = sh => {
      sh.innerHTML = `<h3>Ajouter un jeu</h3>
        <label>Nom du jeu<input id="ngName" type="text" placeholder="ex. Le Bingo Bango Bongo" value="${esc(st.name || '')}"></label>
        <p style="margin:10px 0 6px"><b>Les explications de ce jeu sont-elles sur le web ?</b></p>
        <div class="seg"><button type="button" data-web="1" aria-pressed="${st.web === true}"><b>Oui</b><small>Je donne l’adresse</small></button><button type="button" data-web="0" aria-pressed="${st.web === false}"><b>Non</b><small>Je l’explique</small></button></div>
        ${st.web === true ? `<label>Où ? Adresse de la page (lien)<input id="ngUrl" type="url" inputmode="url" placeholder="https://…" value="${esc(st.url || '')}"></label>` : ''}
        ${st.web === false ? `<label>Expliquez le jeu que vous voulez créer<textarea id="ngTxt" rows="7" placeholder="Combien de joueurs ? En équipes ou chacun pour soi ? Comment on gagne des points à chaque trou ? Comment l’argent se compte ?">${esc(st.txt || '')}</textarea></label>` : ''}
        ${st.web != null ? '<p class="note">Nous ajoutons le jeu au fanion.ai et vous avisons dès qu’il est prêt.</p>' : ''}
        <div class="row"><button class="btn small" id="ngSend" type="button" ${st.web == null ? 'disabled' : ''}>Envoyer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>
        <p class="note" style="margin-top:10px">Vous savez déjà comment le compter ? <button class="linkbtn" id="ngSelf" type="button">Le créer moi-même</button></p>`;
      const keep = () => { const n = sh.querySelector('#ngName'), u = sh.querySelector('#ngUrl'), t = sh.querySelector('#ngTxt'); if (n) st.name = n.value; if (u) st.url = u.value; if (t) st.txt = t.value; };
      sh.querySelectorAll('[data-web]').forEach(b => b.onclick = () => { keep(); st.web = b.dataset.web === '1'; draw(sh); const f = sh.querySelector(st.web ? '#ngUrl' : '#ngTxt'); if (f) f.focus(); });
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('#ngSelf').onclick = () => { closeSheet(); go('jeuEdit', { editJeu: null }); };
      sh.querySelector('#ngSend').onclick = async () => {
        keep();
        if (!String(st.name || '').trim()) return toast('Donnez le nom du jeu.');
        if (st.web && !/^\S+\.\S+/.test(String(st.url || '').trim())) return toast('Entrez l’adresse de la page.');
        if (!st.web && String(st.txt || '').trim().length < 20) return toast('Expliquez le jeu en quelques phrases.');
        const req = { name: st.name.trim(), url: st.web ? st.url.trim() : '', text: st.web ? '' : st.txt.trim(), group: groupName(), groupId: Store.gid, by: ls.get('pelland.me', '') || '', at: Date.now() };
        try { await Store.saveGameRequest(req); } catch (e) { }
        const body = `Nouveau jeu demandé pour le fanion.ai\n\nGroupe : ${req.group}\nDemandé par : ${req.by}\nJeu : ${req.name}\n` + (req.url ? `Règles sur le web : ${req.url}\n` : `Explication :\n${req.text}\n`);
        closeSheet(); toast('Demande envoyée. Merci !');
        location.href = 'mailto:bonjour@fanion.ai?subject=' + encodeURIComponent('le fanion.ai – Ajouter un jeu : ' + req.name) + '&body=' + encodeURIComponent(body);
      };
    };
    openSheet('', sh => draw(sh));
  }
  function vJeuEdit() {
    const j = S.editJeu || (S.editJeu = { name: '', mode: 'equipes', low: 2, high: 2, team: 0, birdie: 0, stake: 0, ranks: '5, 3, 1, 0', skin: 0, pp: 1 });
    $('#barTitle').textContent = j.id ? 'Modifier le jeu' : 'Ajouter un jeu';
    const numIn = (k, label, help) => `<label>${label}<input data-jf="${k}" type="text" inputmode="decimal" value="${esc(j[k] ?? '')}"></label>${help ? `<p class="note" style="margin-top:-4px">${help}</p>` : ''}`;
    return `<section class="card">
        <label>Nom du jeu<input data-jf="name" type="text" value="${esc(j.name)}" placeholder="ex. La game du mardi"></label>
        <div class="seg"><button type="button" data-jmode="equipes" aria-pressed="${j.mode === 'equipes'}"><b>En équipes</b><small>2 contre 2, 4 joueurs</small></button><button type="button" data-jmode="individuel" aria-pressed="${j.mode !== 'equipes'}"><b>Chacun pour soi</b><small>3 ou 4 joueurs</small></button></div>
      </section>
      <section class="card"><h2>Points à chaque trou</h2><p class="note">Tout se compte au net. Mettez 0 pour ne pas utiliser une règle.</p>
        ${j.mode === 'equipes'
          ? numIn('low', 'Plus bas net : points à son équipe') + numIn('high', 'Plus haut net : points à l’équipe adverse') + numIn('team', 'Meilleur total des deux nets de l’équipe') + numIn('birdie', 'Chaque oiselet (au brut) : points à l’équipe')
          : numIn('ranks', 'Points par rang (1er, 2e, 3e, 4e)', 'Séparés par des virgules, ex. 5, 3, 1, 0. Égalités partagées.') + numIn('birdie', 'Chaque oiselet (au brut)') + numIn('skin', 'Skin : seul meilleur net du trou', 'Reporté au trou suivant en cas d’égalité.')}
      </section>
      <section class="card"><h2>L’argent</h2>
        ${numIn('pp', 'Montant par point ($)')}
        ${j.mode === 'equipes' ? numIn('stake', 'Mise : gagnée par l’équipe qui mène à la fin ($)') : '<p class="note">Chacun gagne ou paie la différence de points avec chaque autre joueur.</p>'}
      </section>
      <section class="card"><h2>Résumé</h2><ul class="info-list" id="jSum">${persoLines(j).map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>
      <button class="btn" id="jSave" type="button">Enregistrer le jeu</button>`;
  }
  // ==== src/golf/quatuors.js ====
  // ---------------- Quatuors ----------------
  function vQuatuors() {
    $('#barTitle').textContent = 'Parties à préparer';
    const q = S.quatuors || [], nq = S.newQuat || (S.newQuat = { name: '', players: ['', '', '', ''] });
    const opts = i => { const taken = nq.players.filter((x, j) => j !== i && x).map(L.norm);
      return `<option value="">— Joueur ${i + 1} —</option>` + S.players.filter(p => !taken.includes(L.norm(p.name))).map(p => `<option value="${esc(p.name)}" ${p.name === nq.players[i] ? 'selected' : ''}>${esc(p.name)}</option>`).join(''); };
    void opts;
    return `${offresHtml()}
      <div class="list">${q.length ? q.map(x => `<div class="item quat">
          <div><b>${esc(x.name || x.players.join(', '))}</b>${x.name ? `<span>${esc(x.players.join(', '))}</span>` : ''}</div>
          <span class="row" style="flex-wrap:nowrap;flex:none">${S.confirmDelQ === x.id
            ? `<button class="btn small" data-qdel="${esc(x.id)}" type="button" style="background:var(--red)">Retirer</button><button class="btn ghost small" data-qcancel type="button">Annuler</button>`
            : canOrganize() ? `<button class="btn small" data-qplay="${esc(x.id)}" type="button">Jouer</button><button class="btn ghost small" data-qrem="${esc(x.id)}" type="button">Rappel</button><button class="btn ghost small" data-qask="${esc(x.id)}" type="button">Retirer</button>` : ''}</span></div>`).join('')
        : ''}</div>`;
  }

  // Tailles des groupes : le plus de 4 possible, des groupes de 3 au besoin (5 → 4 + 1 en attente)
  // « 1 quatuor de 4 et 1 de 3 · 1 en attente »
  function groupsText(n) {
    const z = groupSizes(n), q4 = z.filter(x => x === 4).length, q3 = z.filter(x => x === 3).length, wait = n - z.reduce((a, b) => a + b, 0);
    if (!z.length) return n ? `${n} disponible${n > 1 ? 's' : ''} : pas assez pour un groupe` : '';
    const parts = []; if (q4) parts.push(`${q4} quatuor${q4 > 1 ? 's' : ''} de 4`); if (q3) parts.push(`${q3} quatuor${q3 > 1 ? 's' : ''} de 3`);
    return parts.join(' et ') + (wait ? ` · ${wait} en attente` : '');
  }
  function groupSizes(n) {
    for (let a = Math.floor(n / 4); a >= 0; a--) { const r = n - 4 * a; if (r % 3 === 0) return Array(a).fill(4).concat(Array(r / 3).fill(3)); }
    return n >= 4 ? [4] : n === 3 ? [3] : [];
  }
  // Varier les groupes : coût = nombre de fois (récentes surtout) où deux joueurs ont déjà été ensemble
  function pairHistory(games, quats) {
    const m = {}, add = (names, w) => { const k = names.map(L.norm); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const key = [k[i], k[j]].sort().join('|'); m[key] = (m[key] || 0) + w; } };
    (games || []).slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).forEach((g, i) => add(g.players.map(p => p.name), 1 / (1 + i * 0.15)));
    (quats || []).forEach(q => add(q.players, 0.5));
    return (a, b) => m[[L.norm(a), L.norm(b)].sort().join('|')] || 0;
  }
  function autoGroups(names, pc, hasard) {
    if (hasard) pc = () => 0;
    const sizes = groupSizes(names.length), placed = sizes.reduce((a, b) => a + b, 0);
    const cost = gs => gs.reduce((t, g) => { let c = 0; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) c += pc(g[i], g[j]); return t + c; }, 0);
    let best = null, bestC = Infinity;
    for (let r = 0; r < 60; r++) {
      const sh = names.slice().sort(() => Math.random() - 0.5);
      // les premiers à avoir répondu sont placés ; les autres en attente
      const pool = names.slice(0, placed).sort(() => Math.random() - 0.5);
      let gs = [], k = 0; sizes.forEach(z => { gs.push(pool.slice(k, k + z)); k += z; });
      let c = cost(gs), improved = true;
      while (improved) { improved = false;
        for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) for (let i = 0; i < gs[a].length; i++) for (let j = 0; j < gs[b].length; j++) {
          [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]]; const c2 = cost(gs);
          if (c2 < c - 1e-9) { c = c2; improved = true; } else [gs[a][i], gs[b][j]] = [gs[b][j], gs[a][i]];
        } }
      if (c < bestC) { bestC = c; best = gs.map(g => g.slice()); }
      void sh;
    }
    return { groups: best || [], waiting: names.slice(placed) };
  }
  // Former les groupes d'une date : en variant les partenaires (selon l'historique de tous) ou au hasard.
  // onPlay(g) : depuis Nouvelle partie, « Jouer ce groupe » remplit la partie avec ces joueurs.
  async function autoQuatuorsSheet(o, dt, onPlay) {
    const reps = offreReps(o).filter(r => (r.dates || []).includes(dt)).sort((a, b) => (a.at || 0) - (b.at || 0));
    const names = reps.map(r => r.name);
    let games = []; try { games = await Store.listGames(); } catch (e) { }
    const pc = pairHistory(games, S.quatuors);
    let mode = 'varier', res = autoGroups(names, pc, false);
    const label = `${o.course.replace(/^Club de golf /i, '')} – ${fmtDate(dt)}`;
    const draw = () => openSheet(`<h3>Former les groupes</h3><p class="note">${esc(label)} · ${names.length} disponibles : <b>${esc(groupsText(names.length))}</b>.</p>
      <div class="seg"><button type="button" data-gmode="varier" aria-pressed="${mode === 'varier'}"><b>Varier les partenaires</b><small>Selon les parties passées de tous</small></button><button type="button" data-gmode="hasard" aria-pressed="${mode === 'hasard'}"><b>Au hasard</b><small>Tirage aléatoire</small></button></div>
      <p class="note">${mode === 'varier' ? 'Les groupes évitent de remettre ensemble ceux qui ont souvent joué ensemble, pour que chacun joue avec tout le monde.' : 'Les joueurs sont répartis au hasard.'}</p>
      <div class="auto-groups">${res.groups.map((g, i) => `<div class="auto-g"><b>Groupe ${i + 1}${g.length === 3 ? ' (3 joueurs)' : ''}</b><span>${g.map(esc).join(', ')}</span>${onPlay ? `<button class="btn small" data-gplay="${i}" type="button" style="margin-top:8px">Jouer ce groupe</button>` : ''}</div>`).join('')}
      ${res.waiting.length ? `<div class="auto-g wait"><b>En attente</b><span>${res.waiting.map(esc).join(', ')}</span></div>` : ''}</div>
      <div class="row"><button class="btn${onPlay ? ' ghost small' : ''}" data-autosave type="button">Enregistrer ces quatuors</button><button class="btn ghost small" data-autoredo type="button">Refaire</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
        sh.querySelector('[data-close]').onclick = closeSheet;
        sh.querySelectorAll('[data-gmode]').forEach(b => b.onclick = () => { mode = b.dataset.gmode; res = autoGroups(names, pc, mode === 'hasard'); draw(); });
        sh.querySelector('[data-autoredo]').onclick = () => { res = autoGroups(names, pc, mode === 'hasard'); draw(); };
        sh.querySelectorAll('[data-gplay]').forEach(b => b.onclick = () => { closeSheet(); onPlay(res.groups[+b.dataset.gplay]); });
        sh.querySelector('[data-autosave]').onclick = async () => {
          const add = res.groups.map((g, i) => ({ id: 'q' + Date.now().toString(36) + i, name: `${label}${res.groups.length > 1 ? ' – groupe ' + (i + 1) : ''}`, players: g.slice(), date: dt }));
          const list = (S.quatuors || []).concat(add);
          try { await Store.saveQuatuors(list); S.quatuors = list; closeSheet(); toast(`${add.length} quatuor${add.length > 1 ? 's' : ''} enregistré${add.length > 1 ? 's' : ''}.`); render(); }
          catch (e) { toast('Enregistrement impossible : ' + e.message); }
        };
      });
    draw();
  }
  function draftFromQuatuor(x) {
    const d = newDraft(), me = L.norm(ls.get('pelland.me', '') || '');

    x.players.forEach((n, i) => { if (d.players[i]) { d.players[i].name = n; d.players[i].custom = false; } });
    const r = x.players.findIndex(n => L.norm(n) === me); if (r >= 0) d.responsable = r;
    return d;
  }
  // ==== src/commun/offres.js ====
  // ---------------- Offres de parties ----------------
  const fmtDate = ms => new Date(ms).toLocaleString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).replace(' h 00', ' h').replace(/(\d+):(\d+)/, '$1 h $2');
  const fmtDay = ms => new Date(ms).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  const offreReps = o => Object.keys(o).filter(k => k.startsWith('rep_')).map(k => o[k]);
  function offresHtml() {
    const f = S.newOffre;
    const list = (S.offres || []).map(o => {
      const reps = offreReps(o), past = Date.now() > o.deadline;
      return `<div class="offre"><div class="offre-h"><b>${esc(o.course)}</b>${o.place ? `<span class="place">${esc(o.place)}</span>` : ''}<small>${past ? 'Réponses fermées' : 'Réponses avant le ' + esc(fmtDay(o.deadline))} · ${reps.length} réponse${reps.length > 1 ? 's' : ''}</small></div>
        ${o.dates.map(dt => { const yes = reps.filter(r => (r.dates || []).includes(dt)).map(r => r.name);
          return `<div class="offre-d"><div><b>${esc(fmtDate(dt))}</b><span>${yes.length ? esc(yes.join(', ')) : 'Personne pour l’instant'}</span>${yes.length ? `<span class="grp">${esc(MODULE.groupesTexte(yes.length))}</span>` : ''}</div><span class="cnt ${yes.length >= 4 ? 'ok' : ''}">${yes.length}</span></div>${yes.length >= 3 && canOrganize() ? `<div class="row offre-acts"><button class="btn small" data-oauto="${esc(o.id)}|${dt}" type="button">Former les groupes</button><button class="btn ghost small" data-oquat="${esc(o.id)}|${dt}" type="button">Manuel</button></div>` : ''}`; }).join('')}
        ${canOrganize() ? '' : '<!--'}<div class="row"><button class="btn small" data-orem="${esc(o.id)}" type="button">Rappel</button><button class="btn ghost small" data-osms="${esc(o.id)}" type="button">Renvoyer le texto</button><button class="btn ghost small" data-odel="${esc(o.id)}" type="button">${S.confirmDelO === o.id ? 'Confirmer' : 'Retirer'}</button></div>${canOrganize() ? '' : '-->'}</div>`; }).join('');
    const form = f ? `<div class="offre-form">
        <label>Terrain<select id="oCourse">${S.courses.map(c => `<option value="${esc(c.name)}" ${c.name === f.course ? 'selected' : ''}>${esc(c.name)}${c.sim ? ' (simulateur)' : ''}</option>`).join('')}</select></label>
        <label>Lieu (facultatif)<input id="oPlace" type="text" value="${esc(f.place || '')}" placeholder="${SPORT.lieuExemple}"></label>
        <div class="lbl">Dates offertes</div>
        ${f.dates.map((d, i) => `<div class="row" style="flex-wrap:nowrap"><input type="datetime-local" data-od="${i}" value="${esc(d)}" style="flex:1;min-width:0"><button class="x" type="button" data-odx="${i}" aria-label="Retirer">×</button></div>`).join('')}
        <button class="btn ghost small" id="oAddDate" type="button">+ Ajouter une date</button>
        <label>Date butoir pour répondre<input type="date" id="oDeadline" value="${esc(f.deadline)}"></label>
        <div class="row"><button class="btn sms-btn" id="oSend" type="button">Enregistrer et texter les joueurs</button><button class="btn ghost small" id="oCancel" type="button">Annuler</button></div></div>`
      : canOrganize() ? `<button class="btn" id="oNew" type="button">Créer des parties</button>` : '<p class="note">Seuls le propriétaire et l’organisateur du groupe offrent des parties.</p>';
    return `<section class="card"><h2>Parties offertes</h2><p class="note">Proposez des dates : tous les joueurs reçoivent un texto et indiquent dans l’app les dates où ils sont disponibles, avant la date butoir.</p>${form}${list}</section>`;
  }
  // Rappels : à ceux qui n'ont pas répondu, ou aux joueurs disponibles pour une date
  function reminderSheet(o) {
    const me = L.norm(ls.get('pelland.me', '') || ''), reps = offreReps(o), answered = new Set(reps.map(r => L.norm(r.name)));
    const course = o.course.replace(/^Club de golf /i, '') + (o.place ? ' – ' + o.place : ''), link = `${location.origin + location.pathname}?offre=${o.id}`, past = Date.now() > o.deadline;
    const byNames = names => (S.players || []).filter(p => L.norm(p.name) !== me && names.has(L.norm(p.name)));
    const noAns = (S.players || []).filter(p => L.norm(p.name) !== me && !answered.has(L.norm(p.name)));
    const choices = [];
    if (!past) choices.push({ label: 'Ceux qui n’ont pas encore répondu', ps: noAns, text: `Rappel – ${groupName()} : tu n’as pas encore indiqué tes disponibilités pour les parties à ${course}. Réponds avant le ${fmtDay(o.deadline)} : ${link}` });
    if (!past) choices.push({ label: 'Tous les joueurs du groupe', ps: (S.players || []).filter(p => L.norm(p.name) !== me), text: `Rappel – ${groupName()} : parties offertes à ${course} : ${o.dates.map(fmtDate).join(', ')}. Indique tes disponibilités : ${link}` });
    o.dates.filter(dt => dt > Date.now() - 3600e3).forEach(dt => { const yes = new Set(reps.filter(r => (r.dates || []).includes(dt)).map(r => L.norm(r.name)));
      if (yes.size) choices.push({ label: `Joueurs du ${fmtDate(dt)}`, ps: byNames(yes), text: `Rappel – ${groupName()} : on joue ${fmtDate(dt)} à ${course}. À bientôt sur le terrain !` }); });
    const draw = (sh, sel) => {
      const c = sel != null ? choices[sel] : null;
      sh.innerHTML = `<h3>Rappel</h3>
        ${choices.length ? `<div class="list">${choices.map((x, i) => `<button class="item rem-opt ${sel === i ? 'on' : ''}" data-rc="${i}" type="button"><b>${esc(x.label)}</b><span>${x.ps.length} joueur${x.ps.length > 1 ? 's' : ''}${x.ps.length ? ' : ' + esc(x.ps.map(p => p.name.split(' ')[0]).join(', ')) : ''}</span></button>`).join('')}</div>` : '<p class="note">Aucun rappel à envoyer pour l’instant.</p>'}
        ${c ? `<label>Message<textarea id="rmMsg" rows="4">${esc(c.text)}</textarea></label>${c.ps.some(p => !p.phone) ? `<p class="warn" style="margin:6px 0">Pas de numéro pour ${esc(c.ps.filter(p => !p.phone).map(p => p.name).join(', '))}.</p>` : ''}` : ''}
        <div class="row"><button class="btn small" id="rmGo" type="button" ${c && c.ps.some(p => p.phone) ? '' : 'disabled'}>Envoyer le texto${c ? ` (${c.ps.filter(p => p.phone).length})` : ''}</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`;
      sh.querySelectorAll('[data-rc]').forEach(bt => bt.onclick = () => draw(sh, +bt.dataset.rc));
      sh.querySelector('[data-close]').onclick = closeSheet;
      const go = sh.querySelector('#rmGo'); if (go) go.onclick = () => { if (!c) return; const txt = sh.querySelector('#rmMsg').value; closeSheet();
        Push.notify({ title: 'Rappel – ' + groupName(), body: txt.replace(/^Rappel – [^:]*: /, '').slice(0, 200), url: './?offre=' + o.id, tag: 'rappel-' + o.id, playerIds: c.ps.map(p => p.id) });
        openSms(c.ps.filter(p => p.phone).map(p => p.phone), txt); };
    };
    openSheet('', sh => draw(sh, choices.length === 1 ? 0 : null));
  }
  function offreSms(o) {
    const me = L.norm(ls.get('pelland.me', '') || '');
    const nums = (S.players || []).filter(p => p.phone && L.norm(p.name) !== me).map(p => p.phone);
    const missing = (S.players || []).filter(p => !p.phone && L.norm(p.name) !== me).map(p => p.name);
    const body = [`${groupName()} (${APP}) – parties offertes à ${o.course.replace(/^Club de golf /i, '')}${o.place ? ' – ' + o.place : ''} :`, ...o.dates.map(d => '• ' + fmtDate(d)),
      `Indique tes disponibilités avant le ${fmtDay(o.deadline)} : ${location.origin + location.pathname}?offre=${o.id}`].join('\n');
    if (missing.length) toast(`Pas de numéro pour ${missing.join(', ')}.`);
    openSms(nums, body);
  }
  function vOffre() {
    $('#barTitle').textContent = 'Disponibilités';
    const o = S.offre;
    if (o === undefined) { Store.getOffre(S.offreId).then(x => { S.offre = x; if (S.view === 'offre') render(); }); return '<p class="note">Chargement…</p>'; }
    if (!o) return '<section class="card"><h2>Offre introuvable</h2><p class="note">Elle a peut-être été retirée.</p></section>';
    const me = ls.get('pelland.me', '') || '', key = 'rep_' + presKey(me), mine = (o[key] || {}).dates || [], past = Date.now() > o.deadline;
    const sel = S.offreSel || (S.offreSel = mine.slice());
    return `<section class="card"><h2>${esc(o.course)}</h2>${o.place ? `<p class="note" style="margin-top:-6px">${esc(o.place)}</p>` : ''}
      <p class="note">${past ? 'La date butoir est passée : les réponses sont fermées.' : `Cochez les dates où vous êtes disponible, avant le <b>${esc(fmtDay(o.deadline))}</b>.`}</p>
      <div class="dispo">${o.dates.map(dt => `<button type="button" class="dispo-d" data-dispo="${dt}" aria-pressed="${sel.includes(dt)}" ${past ? 'disabled' : ''}><b>${sel.includes(dt) ? '✓' : ''}</b><span>${esc(fmtDate(dt))}</span></button>`).join('')}</div>
      <div class="row dispo-btns">${past ? '' : `<button class="btn" id="dispoSave" type="button">Enregistrer</button>`}<button class="btn ghost" id="dispoCancel" type="button">${past ? 'Retour' : 'Annuler'}</button></div>
      ${o[key] ? `<p class="note">Réponse enregistrée${sel.length ? '' : ' : aucune date'}.</p>` : ''}</section>`;
  }
  // Dates offertes (Parties à préparer) avec les joueurs qui se sont dits disponibles
  function offreDates() {
    const out = [];
    (S.offres || []).forEach(o => o.dates.forEach(dt => { if (dt < Date.now() - 864e5) return;
      const names = offreReps(o).filter(r => (r.dates || []).includes(dt)).sort((a, b) => (a.at || 0) - (b.at || 0)).map(r => r.name);
      out.push({ key: o.id + '|' + dt, course: o.course, label: `${o.course.replace(/^Club de golf /i, '')} – ${fmtDate(dt)}`, names }); }));
    return out.sort((a, b) => +a.key.split('|')[1] - +b.key.split('|')[1]);
  }
  // ==== src/golf/nouvelle-partie.js ====
  // ---------------- Nouvelle partie ----------------
  function newDraft() {
    return {
      courseId: (S.courses[0] || {}).id || '', mode: 'bas', responsable: 0, teamMode: 'auto', teams: null, stake: '', leadChangeValue: '', perPoint: '1', par3Value: '5', count: 4,
      players: [0, 1, 2, 3].map(() => ({ name: '', index: '', tee: 'II' }))
    };
  }
  // Ce qui manque avant de pouvoir créer la partie
  function validIndex(v) { const x = parseFloat(String(v).replace(',', '.')); return String(v).trim() !== '' && /^[-+]?\d+([.,]\d)?$/.test(String(v).trim()) && x >= -10 && x <= 54; }
  // 4 joueurs = la game à Pelland ; 3 joueurs = le 9 points ; 2 joueurs = un contre un (match play, Nassau, skins)
  const gamesFor = n => (n === 2 ? ['match', 'nassau', 'skins'] : n === 3 ? ['neuf', 'skins'] : ['pelland', 'bestball', 'nassau', 'vegas', 'wolf', 'sixes', 'skins'])
    .concat((S.jeux || []).filter(j => j.mode === 'equipes' ? n === 4 : true).map(j => 'perso:' + j.id));
  // Jeu maison choisi dans Nouvelle partie → objet « partie » minimal pour les textes de règles
  const jeuOf = key => (S.jeux || []).find(j => 'perso:' + j.id === key);
  const fakeG = key => key && key.startsWith('perso:') ? { format: 'perso', custom: jeuOf(key) || {}, players: [] } : { format: key, players: [] };
  const fmtLabel = key => key && key.startsWith('perso:') ? ((jeuOf(key) || {}).name || 'Jeu maison') : L.FORMATS[key];
  const gameName = g => L.formatOf(g) === 'perso' ? ((g.custom || {}).name || 'Jeu maison') : L.FORMATS[L.formatOf(g)];
  const filledIdx = d => d.players.map((p, i) => i).filter(i => String(d.players[i].name || '').trim());
  function syncCount(d) { const n = filledIdx(d).length; d.count = n === 2 ? 2 : n === 3 ? 3 : 4;
    // À 2 joueurs, le jeu par défaut devient le match play, avec un enjeu pour la partie (10 $)
    if (d.count === 2 && !gamesFor(2).includes(d.format)) { d.format = 'match'; if (!d.perPoint || d.perPoint === '1') d.perPoint = '10'; }
    return d.count; }
  // Partie à équipes de deux (formation des équipes à choisir) : seulement à 4 joueurs
  const teamGame = (key, n) => n === 4 && (key === 'pelland' || key === 'bestball' || key === 'nassau' || key === 'vegas' || ((jeuOf(key) || {}).mode === 'equipes'));
  function missingList(d) {
    const out = [], idx = filledIdx(d);
    if (useOffres(d) && !d.offre) return ['la date de la partie'];
    if (!S.courses.find(x => x.id === d.courseId) && !S.courses[0]) return ['un terrain (ajoutez-en un dans Terrains)'];
    if (idx.length < 2) d.players.forEach((p, i) => { if (i < 2 && !String(p.name || '').trim()) out.push(`le nom du joueur ${i + 1}`); });
    idx.forEach(i => { const p = d.players[i];
      if (!String(p.index).trim()) out.push(`l'index de ${p.name.trim()}`);
      else if (!validIndex(p.index)) out.push(`un index valide pour ${p.name.trim()} (ex. 12,4)`);
    });
    return out;
  }
  function draftPreview(d) {
    const c = S.courses.find(x => x.id === d.courseId);
    if (!c) return null;
    const ok = !missingList(d).length;
    if (!ok) return { c, ready: false };
    const ps = L.buildPlayers(c, filledIdx(d).map(i => d.players[i]).map(p => ({ name: p.name.trim(), index: parseFloat(String(p.index).replace(',', '.')), tee: p.tee })), d.mode);
    return { c, ready: true, ps };
  }
  // Conseil de handicap selon le jeu choisi (étape Handicap de Nouvelle partie)
  const pourJeu = f => { const n = fmtLabel(f) || ''; return 'Pour ' + (/^(La|Le|Les) /.test(n) ? n[0].toLowerCase() + n.slice(1) : 'le ' + n); };
  function hcpAdvice(d) {
    const f = d.format, n = d.count;
    if (f === 'match') return 'Pour le match play : en bas handicap, le meilleur joue à 0 et l’autre reçoit la différence de coups. C’est la façon habituelle.';
    if (f === 'nassau' && n === 2) return 'Pour le Nassau à deux : en bas handicap, le meilleur joue à 0 et l’autre reçoit la différence.';
    if (f === 'neuf') return 'Pour le 9 points : en bas handicap, le meilleur des trois joue à 0 et les deux autres reçoivent la différence.';
    if (f === 'skins') return 'Pour les skins : chacun joue contre tous ; le bas handicap garde les écarts de coups entre les joueurs.';
    if (f === 'wolf' || f === 'sixes') return `${pourJeu(f)} : les équipes changent en cours de partie ; le bas handicap garde les mêmes écarts de coups.`;
    if (teamGame(f, n)) return `${pourJeu(f)} : les coups se calculent par joueur, puis l’équipe compte ses scores nets.`;
    return 'Les coups de chacun se calculent à partir de son index et de son tertre.';
  }
  function vSetup() {
    $('#barTitle').textContent = 'Nouvelle partie';
    const d = S.draft || (S.draft = newDraft());
    while (d.players.length < 4) d.players.push({ name: '', index: '', tee: (d.players[0] || {}).tee || 'II' });
    syncCount(d);
    const games = gamesFor(d.count); if (!games.includes(d.format)) d.format = games[0];
    const teamsUsed = teamGame(d.format, d.count);
    let stepN = 5; const stepNo = () => ++stepN;   // étapes 6, 7, 8… numérotées selon le jeu choisi
    const od = d.offre ? offreDates().find(x => x.key === d.offre) : null;
    const fromOffre = od ? S.courses.find(x => x.name === od.course) : null;
    if (fromOffre) d.courseId = fromOffre.id;
    const c = S.courses.find(x => x.id === d.courseId) || S.courses[0];
    if (c && !c.tees.find(t => t.name === d.players[0].tee)) d.players.forEach(p => (p.tee = c.tees[0].name));
    const teeOpts = sel => (c ? c.tees : []).map(t => `<option value="${esc(t.name)}" ${t.name === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    return `
      ${d.players.map((_, i) => `<datalist id="playerList${i}">${listOptions(d, i)}</datalist>`).join('')}
      <section class="card">
        <div class="step">1 · Terrain</div>
        ${fromOffre ? `<p class="fixed-course"><b>${esc(fromOffre.name)}</b><span class="note">Choisi dans Parties à préparer</span></p>` : !S.courses.length ? `<p class="note">Aucun terrain dans la banque pour l’instant.</p><button class="btn" data-go="courses" type="button">Ajouter un terrain</button>` : `<select id="course">${S.courses.map(x => `<option value="${esc(x.id)}" ${x.id === d.courseId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <p class="note">Le terrain n'est pas dans la liste ? Ajoutez-le d'abord dans <b>Terrains</b>, à l'accueil.</p>`}
      </section>
      <section class="card">
        <div class="step">2 à 5 · Joueurs, responsable, index, tertre</div>
        ${offreDates().length ? `<div class="seg src-seg"><button type="button" data-src="offre" aria-pressed="${useOffres(d)}"><b>Ceux qui ont répondu</b><small>À une date offerte</small></button><button type="button" data-src="libre" aria-pressed="${!useOffres(d)}"><b>Tous les joueurs</b><small>Partie libre</small></button></div>` : ''}
        ${useOffres(d) ? `<label>Choisir parmi ceux qui ont répondu pour cette partie<select id="offPick"><option value="">— La date de la partie —</option>${offreDates().map(x => `<option value="${x.key}" ${d.offre === x.key ? 'selected' : ''}>${esc(x.label)} (${x.names.length} dispo)</option>`).join('')}</select></label>
        ${d.offre ? (() => { const nm = (offreDates().find(x => x.key === d.offre) || { names: [] }).names; return `<p class="note">Disponibles : ${esc(nm.join(', ') || 'personne')}${nm.length ? `<br><b>${esc(groupsText(nm.length))}</b>` : ''}</p>${nm.length >= 3 ? `<div class="row grp-acts"><span class="note">Former les groupes :</span><button class="btn small" data-sgroups="varier" type="button">Varier les partenaires</button><button class="btn ghost small" data-sgroups="hasard" type="button">Au hasard</button><span class="note">ou choisissez les joueurs ci-dessous (manuel).</span></div>` : ''}`; })() : ''}` : ''}
        ${(S.quatuors || []).length ? `<label>Quatuor<select id="quatPick"><option value="">— Choisir un quatuor (facultatif) —</option>${S.quatuors.map(x => `<option value="${esc(x.id)}">${esc(x.name || x.players.join(', '))}</option>`).join('')}</select></label>` : ''}
        ${d.players.map((p, i) => `
          <div class="prow">
            <label>Joueur ${i + 1}${i === 2 ? ' <small class="opt">(vide : partie à 2, en match play)</small>' : i === 3 ? ' <small class="opt">(vide : partie à 3, le 9 points)</small>' : ''}${playerPicker(d, i)}</label>
            <label>Index<input id="pi${i}" type="text" inputmode="decimal" value="${esc(p.index)}" placeholder="" aria-label="Index de ${esc(p.name || 'joueur ' + (i + 1))}"></label>
            <label>Tertre<select id="pt${i}">${teeOpts(p.tee)}</select></label>
            <label class="resp"><input type="radio" name="resp" value="${i}" ${d.responsable === i ? 'checked' : ''}> Responsable de la partie</label>
          </div>`).join('')}
      </section>
      <section class="card">
        <div class="step">${stepNo()} · Jeu ${info('jeu-' + d.format)}</div>
        <div class="seg holes-seg">${[['18', '18 trous', '1-18'], ['front', 'Aller', '1-9'], ['back', 'Retour', '10-18']].map(([k, t, r]) => `<button type="button" data-holes="${k}" aria-pressed="${(d.holes || '18') === k}"><b>${t}</b><small>${r}</small></button>`).join('')}</div>
        <div class="games">${games.map(x => `<button type="button" data-game="${x}" aria-pressed="${d.format === x}">${esc(fmtLabel(x))}</button>`).join('')}</div>
        ${d.format === 'wolf' ? `<p class="note">Le loup tourne dans l’ordre des joueurs : joueur 1 au trou 1, joueur 2 au trou 2, etc.</p>` : ''}
        ${d.format === 'sixes' ? `<p class="note">Équipes : joueurs 1+2 contre 3+4 (trous 1 à 6), 1+3 contre 2+4 (7 à 12), 1+4 contre 2+3 (13 à 18) ; sur 9 trous, on change aux 3 trous.</p>` : ''}
      </section>
      ${!teamsUsed ? '' : `<section class="card">
        <div class="step">${stepNo()} · Équipes ${info('equipes')}</div>
        <p class="note step-for">${esc(pourJeu(d.format))} : deux équipes de deux, pour toute la partie.</p>
        <div class="seg">
          <button type="button" data-tmode="auto" aria-pressed="${d.teamMode === 'auto'}"><b>Meilleur + Pire</b><small>Les deux du milieu ensemble</small></button>
          <button type="button" data-tmode="manual" aria-pressed="${d.teamMode === 'manual'}"><b>Je choisis</b><small>Qui joue avec qui</small></button>
        </div>
        ${d.teamMode === 'manual' ? `<label>Partenaire de ${esc(d.players[0].name || 'joueur 1')}<select id="partner">${[1, 2, 3].map(i => `<option value="${i}" ${d.teams && d.teams[0].includes(i) ? 'selected' : ''}>${esc(d.players[i].name || 'Joueur ' + (i + 1))}</option>`).join('')}</select></label>` : ''}
      </section>`}
      <section class="card">
        <div class="step">${stepNo()} · Handicap ${info('handicap')}</div>
        <p class="note step-for">${esc(hcpAdvice(d))}</p>
        <div class="seg">
          <button type="button" data-mode="bas" aria-pressed="${d.mode === 'bas'}"><b>Bas handicap</b><small>Le plus bas joue à 0, les autres reçoivent la différence</small></button>
          <button type="button" data-mode="full" aria-pressed="${d.mode === 'full'}"><b>Full handicap</b><small>Chacun reçoit son handicap de parcours</small></button>
        </div>
      </section>
      <section class="card">
        <div class="step">${stepNo()} · Argent ${info(d.format === 'pelland' ? 'argent' : 'jeu-' + d.format)}</div>
        ${d.format !== 'pelland' ? `<div class="row" style="flex-wrap:nowrap"><label style="flex:1">${({ neuf: 'Par point', bestball: 'Par trou gagné', match: 'Pour la partie', nassau: 'Par pari', vegas: 'Par point', wolf: 'Par point', sixes: 'Par tranche gagnée', skins: 'Par skin' })[d.format] || 'Par point'}<span class="money-in"><input id="ppt" type="text" inputmode="decimal" placeholder="1" value="${esc(fmtIn(d.perPoint))}"><i>$</i></span></label><span style="flex:1"></span></div>
        <p class="note">${esc(ruleText(fakeG(d.format)))} ${esc(gainRule({ ...fakeG(d.format), perPoint: d.perPoint }))}.</p>` : `<div class="row" style="flex-wrap:nowrap">
          <label style="flex:1">La game commence à<span class="money-in"><input id="stake" type="text" inputmode="decimal" placeholder="0" value="${esc(fmtIn(d.stake))}"><i>$</i></span></label>
          <label style="flex:1">À chaque revirement<span class="money-in"><input id="lcv" type="text" inputmode="decimal" placeholder="0" value="${esc(fmtIn(d.leadChangeValue))}"><i>$</i></span></label>
        </div>
        <div class="row" style="flex-wrap:nowrap">
          <label style="flex:1">Par point net<span class="money-in"><input id="ppt" type="text" inputmode="decimal" placeholder="1" value="${esc(fmtIn(d.perPoint))}"><i>$</i></span></label>
          <label style="flex:1">Chaque normale 3<span class="money-in"><input id="p3v" type="text" inputmode="decimal" placeholder="5" value="${esc(fmtIn(d.par3Value))}"><i>$</i></span></label>
        </div>`}
      </section>
      <section class="card">
        <div class="step">${stepNo()} · ${teamsUsed ? 'Coups et équipes' : 'Coups'}</div>
        <div id="pv" class="preview">${previewHtml(d)}</div>
        <p class="note" id="missingNote">${missingList(d).length ? 'Il manque ' + esc(missingList(d).join(', ')) + '.' : ''}</p>
        <button class="btn" id="create" type="button" ${missingList(d).length ? 'disabled' : ''}>Créer la carte de pointage</button>
      </section>`;
  }
  // Noms de la bibliothèque pas encore choisis dans les autres cases
  // Menu déroulant des joueurs de la bibliothèque (sans ceux déjà choisis) + « Autre… » pour taper un nom
  // Nouvelle partie : à partir des réponses aux dates offertes, ou partie libre avec tous les joueurs
  const useOffres = d => offreDates().length > 0 && d.src !== 'libre';
  function playerPicker(d, i) {
    const p = d.players[i];
    const inLib = S.players.some(x => L.norm(x.name) === L.norm(p.name || ''));
    const needDate = useOffres(d), custom = !S.players.length;
    const taken = d.players.map((q, j) => j !== i ? L.norm(q.name || '') : '').filter(Boolean);
    const dispo = d.offre ? ((offreDates().find(x => x.key === d.offre) || {}).names || []).map(L.norm) : null;
    if (needDate && !d.offre) return `<select id="ps${i}" disabled><option>— Choisissez d’abord la date —</option></select>`;
    const opts = S.players.filter(x => !taken.includes(L.norm(x.name)) && (!dispo || dispo.includes(L.norm(x.name))));
    void inLib;
    const sel = S.players.length ? `<select id="ps${i}"><option value="">— Choisir —</option>${opts.map(x => `<option value="${esc(x.name)}" ${!custom && L.norm(x.name) === L.norm(p.name || '') ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '';
    const inp = custom ? `<input id="pn${i}" type="text" value="${esc(p.name)}" placeholder="Prénom et nom" autocapitalize="words" ${S.players.length ? 'style="margin-top:6px"' : ''}>` : '';
    return sel + inp;
  }
  function listOptions(d, i) {
    const taken = d.players.map((p, j) => j !== i ? L.norm(p.name || '') : '').filter(Boolean);
    return S.players.filter(p => !taken.includes(L.norm(p.name))).map(p => `<option value="${esc(p.name)}"></option>`).join('');
  }
  function money(v) { const x = parseFloat(String(v || '').replace(',', '.').replace(/[^0-9.]/g, '')); return isNaN(x) ? 0 : x; }
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
    if (!pv || !pv.ready) return `<p class="note">Entrez au moins deux prénoms et leur index pour voir les coups${d.count === 4 ? ' et les équipes' : ''}.</p>`;
    return `<table><thead><tr><th>Joueur</th><th>Tertre</th><th style="text-align:right">Index</th><th style="text-align:right">Hcp</th><th style="text-align:right">Coups</th></tr></thead><tbody>
      ${pv.ps.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.tee)}</td><td class="n">${String(p.index).replace('.', ',')}</td><td class="n">${p.courseHandicap}</td><td class="n"><b>${p.strokes}</b></td></tr>`).join('')}
      </tbody></table>${!teamGame(d.format, d.count) ? '' : d.teamMode ? teamsHtml(pv.ps, draftTeams(d, pv.ps)) : '<p class="note">Choisissez la formation des équipes plus haut, à l\'étape Équipes.</p>'}<p class="note">${d.mode === 'full' ? '<b>Coups</b> : chaque joueur reçoit son handicap de parcours (Hcp).' : '<b>Coups</b> = Hcp du joueur − Hcp le plus bas du groupe. Le meilleur joue à 0.'}${coupsCalc(pv.ps, d.mode)} Les coups se placent d’abord sur les trous les plus difficiles : 7 coups, 1 par trou, pour des trous de difficulté 1 à 7. Au-delà de 18 coups, on recommence : un 2<sup>e</sup> coup sur les trous les plus difficiles.</p>`;
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

  // Créer une partie : d'abord le type, partie normale ou compétition
  function typePartieSheet() {
    openSheet(`<h3>Quel type de partie ?</h3>
      <div class="type-partie">
        <button class="type-choix" data-tp="normale" type="button"><span aria-hidden="true">⛳</span><span><b>Partie normale</b><small>Une partie entre amis : terrain, joueurs, jeu (Nassau, skins, Vegas, match…) et montants.</small></span></button>
        <button class="type-choix" data-tp="comp" type="button"><span aria-hidden="true">🏆</span><span><b>Compétition</b><small>Un tournoi avec classement : match play, Texas scramble, Stableford… avec équipes et handicaps.</small></span></button>
      </div>
      <button class="btn ghost" data-close type="button">Annuler</button>`, sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { closeSheet(); if (b.dataset.tp === 'normale') go('setup'); else go('comps', { compLive: false }); });
    });
  }
  // ==== src/golf/rejoindre.js ====
  // ---------------- Rejoindre ----------------
  function vJoin() {
    $('#barTitle').textContent = 'Rejoindre';
    return `<section class="card"><h2>Code de la partie</h2>
      <p class="note">Le responsable voit le code en haut de sa carte (4 lettres).</p>
      <input id="code" type="text" autocapitalize="characters" maxlength="8" placeholder="ABCD" style="font-family:var(--display);font-size:28px;letter-spacing:.2em;text-transform:uppercase">
      <button class="btn" id="joinBtn" type="button">Ouvrir la partie</button>
      ${Store.mode === 'local' ? '<div class="warn">En mode local, seules les parties créées sur ce téléphone sont accessibles.</div>' : ''}</section>`;
  }
  // ==== src/golf/partie.js ====
  // ---------------- Partie ----------------
  function vGame() {
    const g = S.game;
    if (!g) { $('#barTitle').textContent = 'Chargement…'; return '<p class="note">Chargement de la partie…</p>'; }
    $('#barTitle').textContent = `${g.course.name.replace(/^Club de golf /i, '')} · ${g.id}`;
    if (isAlt(g)) return vGameNeuf(g);
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
        ${savedBand(g)}
        <div class="hole-top">
          <div class="hole-no">${h}</div>
          <div class="hole-meta">Normale <b>${hi.par}</b> · Handicap <b>${hi.si}</b>${meta.map(m => ` · <b>${m}</b>`).join('')}</div>
          <div class="hole-nav"><button data-nav="-1" aria-label="Trou précédent">‹</button><button data-nav="1" aria-label="Trou suivant">›</button></div>
        </div>
        ${respActions(g, owner, true)}
        <div class="money-boxes${owner && g.status !== 'terminée' ? ' editable' : ''}"${owner && g.status !== 'terminée' ? ' data-editmoney role="button" tabindex="0" title="Toucher pour modifier les montants"' : ''}>
          <div class="mbox green"><span>La game commence à ${info('game')}</span><b>${g.stake ? fmt$(money(g.stake)) : '—'}</b></div>
          <div class="mbox green"><span>À chaque revirement ${info('revirement')}</span><b>${g.leadChangeValue ? fmt$(money(g.leadChangeValue)) : '—'}</b>${g.leadChangeValue ? (n => `<small class="mbox-sub">${n} revirement${n > 1 ? 's' : ''}${n ? ' = ' + fmt$(n * money(g.leadChangeValue)) : ''}</small>`)(L.leadChanges(g)) : ''}</div>
          ${(r => `<div class="mbox yellow"><span>Les pars 3 sont à ${info('par3now')}</span><b>${r.next ? fmt$(r.nextValue) : '—'}</b>${r.next ? `<small class="mbox-sub">au trou ${r.next}</small>` : ''}</div>`)(L.par3Results(g))}
        </div>
        <div class="team-blocks">${[1, 0].map(k => { const tm = L.getTeams(g)[k], teamPts = L.teamPoints(g).tot;
          const tt = L.trailingTeam(g, h), pt = L.pressTeamOf(g, h), started = ((g.scores || {})[h] || []).some(v => v != null);
          let btn = '';
          if (owner && (tt === k || (started && tt == null)) && !(ev.presses || []).length) btn = `<button type="button" class="tb-btn t${k}" data-press-team="${k}">Press</button>`;
          else if (owner && pt === k) btn = `<button type="button" class="tb-btn t${k} on" data-unpress="1">Pressé ✓</button>`;
          else if (owner && pt != null && pt !== k) btn = `<button type="button" class="tb-btn t${k} ${ev.reroll ? 'on' : ''}" data-reroll-team="${ev.reroll ? 0 : 1}">${ev.reroll ? 'Reroll ✓' : 'Reroll'}</button>`;
          else if (!owner && pt === k) btn = `<span class="tb-btn t${k} on">Pressé</span>`;
          else if (!owner && pt != null && ev.reroll) btn = `<span class="tb-btn t${k} on">Reroll</span>`;
          const ph = tm.map(pi => { const p = g.players[pi]; const k = L.strokesOnHole(p.strokes, hi.si); const s = L.getScore(g, h, pi); return `<${owner ? `button type="button" data-allscores="${h}"` : 'div'} class="hp"><div class="nm tc${teamOf(g, pi)}">${esc(p.name)}${g.responsable === pi ? ' ★' : ''}</div><div class="hp-idx">Index ${String(p.index).replace('.', ',')}</div><div class="hp-strk">${strokeHoles(g, p)}</div><div class="dots">${k ? dots(k) + (k < 0 ? ' redonne' : '') : ''}</div><div class="hp-tot">${tots[pi].played ? `<span>Brut <b>${tots[pi].gross}</b> · Net <b>${tots[pi].net}</b></span><span class="hp-n">${tots[pi].played} trou${tots[pi].played > 1 ? 's' : ''}</span>` : 'Aucun trou joué'}</div></${owner ? 'button' : 'div'}>`; });
          if (btn) btn += info('press');
          return `<div class="team-block t${k}"><div class="tb-name">${L.TEAMS[k]}</div><div class="tb-grid two">${ph[0]}${ph[1]}</div>${btn}</div>`; }).join('')}</div>
        ${holeChips.length ? `<div class="chips">${holeChips.join('')}</div>` : ''}
      </section>


      ${(() => { const t = L.teamPoints(g).tot, d = Math.abs(t[0] - t[1]), k = t[0] > t[1] ? 0 : 1, o = 1 - k;
        const pts = `<div class="lb-pts"><span class="tc1">Bleus <b>${t[1]}</b></span><span class="tc0">Rouges <b>${t[0]}</b></span></div>`;
        if (t[0] === t[1]) return `<div class="leader-box even"><span>Meneurs ${info('meneurs')}</span><div><b>Égalité</b><small>0 point net d’écart</small></div>${pts}</div>`;
        const { parts, tot } = leaderMoney(g);
        return `<div class="leader-box t${k}"><span>Meneurs ${info('meneurs')}</span><div><b class="tc${k}">${L.TEAMS[k]}</b><small>+${d} point${d > 1 ? 's' : ''} net${d > 1 ? 's' : ''}</small></div>${pts}
          <div class="lb-money"><span>Gain par joueur des ${L.TEAMS[k]} en ce moment</span><b class="tc${k}">${fmt$(tot)}</b></div>
          <div class="lb-detail">${parts.map(([v, l]) => `<span>${v < 0 ? '−' : '+'} ${fmt$(Math.abs(v))} <i>${l}</i></span>`).join('')}</div></div>`; })()}
      ${handoffBtn(g, owner)}
      <div class="card-scroll"><table class="sc">
        <thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${colOrder.map(i => { const p = g.players[i]; return `<th class="pc tc${teamOf(g, i)}" title="${esc(p.name)}">${esc(ini[i])}</th>`; }).join('')}<th class="col-wide">Statut</th><th class="col-wide">Calcul</th><th class="tc0">Rouge</th><th class="tc1">Bleu</th></tr></thead>
        <tbody>${scoreRows(g, row, sumRow)}</tbody>
      </table></div>
      <button class="btn sms-btn" data-sms type="button">Texto aux joueurs</button>
      ${g.status === 'terminée' ? avisCard('game') + viralCard('game') : ''}
        ${owner ? `<div class="row game-actions bottom-actions">${g.status === 'terminée'
          ? '<span class="note">Partie terminée.</span><button class="btn ghost small" data-reopen type="button">Rouvrir</button>'
          : '<button class="btn small" data-finish type="button">Terminer la partie</button>'}
          ${S.confirmDelGame === g.id
            ? '<button class="btn small" data-delthis type="button" style="background:var(--red)">Confirmer l\'effacement</button><button class="btn ghost small" data-canceldelgame type="button">Annuler</button>'
            : '<button class="btn ghost small" data-askdelthis type="button">Effacer la partie</button>'}</div>` : ''}
      <div class="legend"><span>★ responsable de la partie (il entre les scores)</span><span>${BALL} coup reçu · petit chiffre = net</span><span>Calcul : ↓ plus bas net · ↑ plus haut net · R/B équipe qui reçoit · ×2 press · ×4 reroll · S skin · O oiselet · C cabane · $ normale 3 · = résultat net</span><span>Noms à la couleur de l'équipe : <b class="tc1">Bleus</b> · <b class="tc0">Rouges</b></span><span>${g.players.map((p, i) => `<b class="tc${teamOf(g, i)}">${esc(ini[i])}</b> ${esc(p.name)}`).join(' · ')}</span><span class="narrow-only">Sous chaque trou : statut (Normal, Press, Reroll) et calcul des points</span></div>`;
  }

  function respActions(g, owner, note) {
    if (owner) return '';
    if (!(Store.mode === 'cloud' && Store.email)) return '';
    const r = g.players[g.responsable];
    return S.confirmClaim === g.id
      ? `<div class="row game-actions"><button class="btn small" data-claim type="button">Oui, je deviens responsable</button><button class="btn ghost small" data-cancelclaim type="button">Annuler</button></div>`
      : `<div class="row game-actions"><button class="btn ghost small light" data-askclaim type="button">Devenir responsable de cette partie</button>${note ? `<span class="note light">${r ? 'Responsable : ' + esc(r.name) + '. ' : ''}pour entrer les scores, la terminer ou l'effacer</span>` : ''}</div>`;
  }
  // ==== src/golf/historique.js ====
  // ---------------- Historique ----------------
  let historyCache = null;
  function vHistory() {
    const live = S.view === 'live';
    $('#barTitle').textContent = live ? 'Parties en cours' : 'Parties et compétitions jouées';
    if (!live && S.compList == null && !S.compLoading) { S.compLoading = true; Store.listComps().then(l => { S.compList = l; S.compLoading = false; if (S.view === 'history') render(); }).catch(() => { S.compList = []; S.compLoading = false; }); }
    if (S.historyList == null) { Store.listGames().then(l => { S.historyList = l; Store.listPresence(l.map(g => g.id)).then(m => { S.presAll = m; if (S.view === 'live') render(); }); if (S.view === 'history' || S.view === 'live') render(); }).catch(e => toast(e.message)); return '<p class="note">Chargement…</p>'; }
    const list = S.historyList.filter(g => live ? g.status !== 'terminée' : g.status === 'terminée');
    if (!live) return `<div class="seg hist-seg">${['parties', 'comps'].map(k => `<button type="button" data-histtab="${k}" aria-pressed="${(S.histTab || 'parties') === k}"><b>${k === 'parties' ? 'Parties' : 'Compétitions'}</b></button>`).join('')}</div>`
      + ((S.histTab || 'parties') === 'comps' ? compsPlayed() : gamesPlayed(list, live));
    return gamesPlayed(list, live);
  }
  document.addEventListener('click', e => {
    if (S.view !== 'history' || !e.target.closest) return;
    const t = e.target.closest('[data-histtab]'); if (t) { S.histTab = t.dataset.histtab; render(); return; }
    const c = e.target.closest('[data-comp]'); if (c) openComp(c.dataset.comp);
  });
  // Compétitions jouées : celles dont la date est passée (avant hier ; hier et aujourd'hui restent « en cours »)
  function compsPlayed() {
    if (S.compList == null) return '<p class="note">Chargement…</p>';
    const from = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const l = S.compList.filter(c => c.date && c.date < from).sort((a, b) => b.date.localeCompare(a.date));
    if (!l.length) return '<section class="card"><h2>Aucune compétition jouée</h2><p class="note">Une compétition apparaît ici le surlendemain de sa date, avec son classement final.</p></section>';
    const fmtName = f => (COMP_INFO.find(x => x.f === (f || 'match')) || {}).name || '';
    return `<div class="list">${l.map(c => `<button class="item" data-comp="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(new Date(c.date + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(fmtName(c.format))} · ${esc((c.course || {}).name || '')} · ${(c.teams || []).length} équipes</span></button>`).join('')}</div>`;
  }
  function gamesPlayed(list, live) {
    if (!list.length) return live
      ? '<section class="card"><h2>Aucune partie en cours</h2><p class="note">Les parties apparaissent ici dès leur création, jusqu’à ce que le responsable les termine.</p></section>'
      : '<section class="card"><h2>Aucune partie terminée</h2><p class="note">Une partie apparaît ici quand le responsable touche « Terminer la partie ».</p></section>';
    return `<div class="list">${list.map(g => {
      const d = new Date(g.createdAt);
      const played = Object.keys(g.scores || {}).filter(k => (g.scores[k] || []).some(v => v != null)).length;
      let res;
      if (isAlt(g)) { const t = neufGains(g), mx = Math.max(...t); res = `${gameName(g)} · ${g.players.filter((p, i) => t[i] === mx).map(p => p.name.split(' ')[0]).join(', ')} ${mx > 0 ? '+' + fmt$(mx) : ''}`; }
      else { const t = L.teamPoints(g).tot; res = t[0] === t[1] ? 'égalité' : `${L.TEAMS[t[0] > t[1] ? 0 : 1]} +${Math.abs(t[0] - t[1])}`; }
      const mine = Store.mode !== 'cloud' || !!Store.email;
      const done = g.status === 'terminée';
      return `<div class="item hist ${done ? 'done' : ''}"><button class="hist-open" data-open="${esc(g.id)}" type="button"><b>${d.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(g.course.name.replace(/^Club de golf /i, ''))}</b>
        <span><span class="hist-st">${done ? 'Terminée' : 'En cours'}</span>${!done && S.presAll && S.presAll[g.id] ? ` ✓ ${Object.values(S.presAll[g.id]).filter(x => x && x.ok).length}/4 ·` : ''} ${g.players.map(p => esc(p.name)).join(', ')} · ${played}/18 trous · ${res}</span></button>
        ${mine ? (S.confirmDelGame === g.id
          ? `<span class="row"><button class="btn small" data-delgame="${esc(g.id)}" type="button" style="background:var(--red)">Effacer</button><button class="btn ghost small" data-canceldelgame type="button">Annuler</button></span>`
          : `<button class="btn ghost small" data-askdelgame="${esc(g.id)}" type="button">Effacer</button>`) : ''}</div>`;
    }).join('')}</div>`;
  }
  // ==== src/commun/connexion.js ====
  // ---------------- Terrains ----------------
  function vLogin() {
    $('#barTitle').innerHTML = `${APP}<small class="bar-sous">${MARQUE.slogan}</small>`;
    $('#back').hidden = true;
    const refQ = new URLSearchParams(location.search).get('ref');
    const groups = S.groups || [];
    const refGroup = refQ && groups.find(g => g.id === refQ);
    const hero = `<div class="hero"><h1>${APP}</h1><p>${MARQUE.accroche}</p></div>`;
    // Pas encore connecté : le compte HoldingAI (le même pour toutes les apps HoldingAI)
    if (!Store.uid) return hero + `<section class="card"><h2>Connexion</h2>
        <p class="note">Un seul compte pour toutes les apps de L’Établi : votre cellulaire et votre mot de passe. Philippe s’en occupe.</p>
        <p class="note"><b>Invité par texto ?</b> Utilisez le cellulaire où vous avez reçu l’invitation : vous retrouverez votre groupe.</p>
        <button class="btn" id="haiGo" type="button">Continuer avec L’Établi</button>
        <p class="note" id="loginMsg">${esc(S.loginMsg || Store.error || '')}</p></section>`;
    // Connecté, mais ce cellulaire n'est inscrit dans aucun groupe : invitation à demander, ou nouveau groupe
    const nom = Store.nom || '';
    return hero + `${refQ ? `<div class="ref-hello">${refGroup ? `Recommandé par <b>${esc(refGroup.name)}</b>. ` : ''}Créez votre groupe : c’est gratuit pour ${SPORT.gratuitPour}, et vos joueurs reçoivent l’invitation par texto.</div>` : ''}
      <section class="card"><h2>${nom ? 'Bienvenue, ' + esc(nom.split(' ')[0]) + ' !' : 'Bienvenue !'}</h2>
        <p class="note">Votre cellulaire${Store.e164 ? ' (' + esc(fmtPhone(Store.e164.slice(2))) + ')' : ''} n’est inscrit dans aucun groupe pour l’instant.</p>
        <p class="note"><b>Invité par un organisateur ?</b> Demandez-lui de vérifier votre cellulaire dans Joueurs, puis rouvrez le lien de son texto.</p>
      </section>
      <section class="card"><h2>Créer un groupe</h2>
        <label>Nom du groupe<input id="ngName" type="text" placeholder="ex. Les lève-tôt du samedi"></label>
        <label>Votre prénom et nom<input id="ngMe" type="text" autocapitalize="words" value="${esc(nom)}"></label>
        <button class="btn" id="ngCreate" type="button">Créer le groupe</button>
        <p class="note" id="acMsg"></p>
        <p class="note">Vous en serez le propriétaire. Ajoutez ensuite vos joueurs dans Joueurs : ils reçoivent l’invitation par texto. Gratuit jusqu’à 4 joueurs.</p>
      </section>
      <p class="note" style="text-align:center"><button class="linkbtn" id="haiOut" type="button">Changer de compte</button></p>`;
  }
  // ==== src/commun/banque.js ====
  // ---------- Import de joueurs depuis Excel (ou CSV) : nom + cellulaire ----------
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; sc.onload = () => ok(window.XLSX); sc.onerror = () => ko(new Error('Lecture Excel indisponible (réseau).')); document.head.appendChild(sc); });
  }
  const phoneDigits = v => { let d = String(v == null ? '' : v).replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; };
  // Lignes du tableau → [{ name, phone }] ; trouve les colonnes par leur titre (Nom, Prénom, Cellulaire…) ou prend les deux premières
  function rowsToPlayers(rows) {
    rows = rows.filter(r => r && r.some(c => String(c ?? '').trim() !== ''));
    if (!rows.length) return [];
    const nrm = x => L.norm(String(x ?? ''));
    let hi = -1, cName = -1, cFirst = -1, cLast = -1, cPhone = -1;
    for (let i = 0; i < Math.min(5, rows.length) && hi < 0; i++) {
      const h = rows[i].map(nrm);
      const ph = h.findIndex(x => /cell|tel|phone|mobile|portable|numero/.test(x));
      const fi = h.findIndex(x => /prenom|first/.test(x));
      const la = h.findIndex((x, j) => j !== fi && /(^| )nom( |$)|famille|last|surname/.test(x));
      const nm = h.findIndex((x, j) => j !== fi && /nom|name|joueur/.test(x));
      if (ph >= 0 || nm >= 0 || fi >= 0) { hi = i; cPhone = ph; cFirst = fi; cLast = fi >= 0 ? la : -1; cName = fi >= 0 ? -1 : nm; }
    }
    const data = hi >= 0 ? rows.slice(hi + 1) : rows;
    if (hi < 0 || (cName < 0 && cFirst < 0)) { // pas de titres : la colonne avec des chiffres = téléphone, l'autre = nom
      const r0 = data[0] || [];
      cPhone = cPhone >= 0 ? cPhone : r0.findIndex(c => phoneDigits(c).length >= 7);
      cName = r0.findIndex((c, j) => j !== cPhone && String(c ?? '').trim() && phoneDigits(c).length < 7);
    }
    return data.map(r => {
      const name = (cFirst >= 0 ? [r[cFirst], cLast >= 0 ? r[cLast] : ''] : [r[cName]]).map(x => String(x ?? '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
      return { name, phone: cPhone >= 0 ? phoneDigits(r[cPhone]) : '' };
    }).filter(x => x.name);
  }
  async function importPlayersFile(file) {
    let rows;
    try {
      if (/\.csv$/i.test(file.name)) { const t = await file.text(); const sep = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ','; rows = t.split(/\r?\n/).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, ''))); }
      else { const X = await loadXLSX(); const wb = X.read(await file.arrayBuffer(), { type: 'array' }); rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); }
    } catch (e) { return toast('Fichier illisible : ' + e.message); }
    const list = rowsToPlayers(rows);
    if (!list.length) return toast('Aucun nom trouvé dans le fichier.');
    const seen = new Set(S.players.map(p => L.norm(p.name)));
    const items = list.map(x => { const dup = seen.has(L.norm(x.name)); seen.add(L.norm(x.name)); const bad = x.phone && x.phone.length !== 10; return { ...x, dup, bad, on: !dup && !bad }; });
    const draw = sh => {
      const n = items.filter(x => x.on).length, room = roomLeft(), over = n > room;
      sh.innerHTML = `<h3>Importer des joueurs</h3><p class="note">${items.length} ligne${items.length > 1 ? 's' : ''} lue${items.length > 1 ? 's' : ''} dans « ${esc(file.name)} ». Décochez ceux à ne pas ajouter.</p>
        <div class="imp-list">${items.map((x, i) => `<label class="imp-row ${x.dup || x.bad ? 'warnrow' : ''}"><input type="checkbox" data-imp="${i}" ${x.on ? 'checked' : ''} ${x.dup ? 'disabled' : ''}><span><b>${esc(x.name)}</b><small>${x.phone ? esc(fmtPhone(x.phone)) : 'Pas de numéro'}${x.dup ? ' · déjà dans le groupe' : x.bad ? ' · numéro à vérifier' : ''}</small></span></label>`).join('')}</div>
        ${over ? `<div class="warn">Votre forfait ${planOf().name} permet ${planOf().max} joueurs : il reste ${Math.max(0, room)} place${room > 1 ? 's' : ''}. Décochez-en ${n - Math.max(0, room)} ou <button class="linkbtn" data-limit type="button">passez au forfait Groupe</button>.</div>` : ''}
        <p class="note">Les invitations par texto s’envoient ensuite depuis la liste, avec le bouton ☎ de chaque joueur.</p>
        <div class="row"><button class="btn small" id="impGo" type="button" ${n && !over ? '' : 'disabled'}>Importer (${n})</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`;
      sh.querySelectorAll('[data-imp]').forEach(c => c.onchange = () => { items[+c.dataset.imp].on = c.checked; draw(sh); });
      const lm = sh.querySelector('[data-limit]'); if (lm) lm.onclick = () => { closeSheet(); setTimeout(() => limitSheet(n), 50); };
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('#impGo').onclick = async () => {
        const todo = items.filter(x => x.on); let ok = 0, phErr = 0;
        const btn = sh.querySelector('#impGo'); btn.disabled = true;
        for (const x of todo) {
          btn.textContent = `Ajout… ${ok + 1}/${todo.length}`;
          try { const np = await Store.savePlayer(x.name, S.players.length + ok); ok++; if (x.phone && x.phone.length >= 10) { try { await Store.setPhone(np, x.phone); } catch (e) { phErr++; } } } catch (e) { }
        }
        S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); closeSheet(); render();
        toast(`${ok} joueur${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}${phErr ? ` · ${phErr} numéro${phErr > 1 ? 's' : ''} à refaire` : ''}.`);
      };
    };
    openSheet('', sh => draw(sh));
  }
  // Peut être retiré en lot : ni le propriétaire, ni soi-même
  // Banque de joueurs hors du groupe : confirmés (compte créé) que l'organisateur peut ajouter au groupe, et en attente de confirmation
  function banqueHtml() {
    if (!canOrganize() || !S.bank) return '';
    const hors = S.bank.filter(p => p.membre === false), conf = hors.filter(hasAccepted), att = hors.filter(p => !hasAccepted(p)), room = roomLeft();
    const ligne = (p, act) => `<div class="item pl-row bank-row"><div><b>${esc(p.name)}</b><span>${hasAccepted(p) ? '<span class="pl-st ok">✓ Confirmé</span>' : '<span class="pl-st wait">En attente de confirmation</span>'}${p.phone ? ' · ☎ ' + esc(fmtPhone(p.phone)) : ''}</span></div><span class="row" style="flex-wrap:nowrap;flex:none">${act}</span></div>`;
    return `<h3 class="acct-h">Banque de joueurs : hors du groupe (${hors.length})</h3>
      <p class="note"><b>Banque : ${S.bank.length} / ${BANQUE_MAX} joueurs.</b> Le groupe compte ${S.players.length} / ${planOf().max} membres. ${room > 0 ? `Ajoutez au groupe les joueurs confirmés (il reste ${room} place${room > 1 ? 's' : ''}).` : 'Le groupe est complet.'}</p>
      ${conf.length ? `<div class="list">${conf.map(p => ligne(p, `<button class="btn small" data-membre="${esc(p.id)}" type="button">Ajouter au groupe</button>${isProprio() && p.id !== ownerId() ? `<button class="btn ghost small" data-bankdel="${esc(p.id)}" type="button" aria-label="Enlever ${esc(p.name)} de la banque">✕</button>` : ''}`)).join('')}</div>` : '<p class="note">Aucun joueur confirmé hors du groupe.</p>'}
      ${att.length ? `<h4 class="bank-h">En attente de confirmation (${att.length})</h4><p class="note">Ils doivent créer leur compte avec le texto d’invitation avant d’entrer dans le groupe.</p>
        <div class="list">${att.map(p => ligne(p, `${p.phone && isProprio() ? `<button class="btn ghost small" data-reinv="${esc(p.id)}" type="button">Texto</button>` : ''}${isProprio() ? `<button class="btn ghost small" data-bankdel="${esc(p.id)}" type="button" aria-label="Enlever ${esc(p.name)} de la banque">✕</button>` : ''}`)).join('')}</div>` : ''}`;
  }
  const canRemove = p => canOrganize() && p.id !== ownerId() && p.id !== meId();
  function vPlayers() {
    const inviter = S.pMode === 'inviter';
    $('#barTitle').textContent = inviter ? 'Inviter des joueurs' : 'Banque de joueurs';
    // Seul le propriétaire du groupe ajoute des joueurs (nom, cellulaire, import Excel, remettre un retiré)
    const proprio = isProprio(), banque = (S.bank || S.players).length;
    return `${inviter ? `<p class="note"><b>Choisissez les membres du groupe parmi les joueurs confirmés de la banque.</b> Un joueur est confirmé quand il a créé son compte avec le texto d’invitation.</p>` + banqueHtml() : ''}${!proprio ? `<p class="note">Seul le propriétaire du groupe${(S.players.find(p => p.id === ownerId()) || {}).name ? ' (' + esc(S.players.find(p => p.id === ownerId()).name) + ')' : ''} peut ajouter des joueurs à la banque.</p>` : `<section class="card"><h2>Ajouter un joueur à la banque</h2>
        ${banque >= BANQUE_MAX ? `<div class="full-box"><b>La banque de joueurs est pleine : ${banque} / ${BANQUE_MAX}.</b><p>Enlevez un joueur de la banque pour en ajouter un autre.</p></div>`
        : `<p class="note">Entrez le nom et le cellulaire : un texto d’invitation est prêt à envoyer. Une fois son compte créé, le joueur est confirmé et peut être ajouté au groupe.</p>        <input id="newPlayer" type="text" placeholder="Prénom et nom" autocapitalize="words">
        <div class="row" style="flex-wrap:nowrap"><input id="newPhone" type="tel" inputmode="tel" placeholder="Cellulaire" style="flex:1;min-width:0"><button class="btn small" id="addPlayer" type="button">Ajouter</button></div>
        <div class="import-row"><label class="btn ghost small" for="xlsFile">Importer un fichier Excel</label><input id="xlsFile" type="file" accept=".xlsx,.xls,.csv,.ods" hidden><span class="note">Deux colonnes : le nom et le cellulaire.</span></div>`}
        </section>`}
      ${canOrganize() && S.notifs ? (() => { const sans = S.players.filter(p => hasAccepted(p) && p.id !== meId() && (S.notifs[p.id] || 'a_activer') !== 'actif'); const bl = sans.filter(p => ['bloque', 'non_supporte'].includes(S.notifs[p.id]));
        return sans.length ? `<div class="warn notif-warn"><b>${sans.length} joueur${sans.length > 1 ? 's ne reçoivent' : ' ne reçoit'} pas les notifications :</b> ${sans.map(p => esc(p.name) + ' (' + NOTIF[S.notifs[p.id] || 'a_activer'][1].replace(/^🔕 /, '').toLowerCase() + ')').join(', ')}.
          ${bl.length ? 'Ils ne verront ni les dates, ni les rappels, ni les parties : parlez-leur, ou retirez-les du groupe.' : 'Rappelez-leur d’ouvrir l’app et d’accepter les notifications.'}</div>` : ''; })() : ''}
      ${(() => { const dups = duplicateMap(S.players); const nd = Object.keys(dups).length; return nd ? `<div class="warn">${nd} joueurs semblent en double. Vérifiez les noms marqués « Doublon ? » et retirez celui de trop.</div>` : ''; })()}
      ${!ownerId() && S.players.length ? `<div class="warn">Le groupe n’a pas encore de propriétaire (la personne qui l’administre et paie l’abonnement). <button class="linkbtn" id="claimOwner" type="button">C’est moi</button></div>` : ''}
      ${S.players.length ? `<div class="row pl-head"><p class="pl-count"><b>${S.players.length}</b> joueur${S.players.length > 1 ? 's' : ''} dans le groupe</p>${canOrganize() ? `<button class="btn ghost small" data-selmode type="button">${S.selMode ? 'Terminer' : 'Sélectionner'}</button>` : ''}</div>` : ''}
      ${S.selMode ? (() => { const sel = S.sel || [], removable = S.players.filter(p => canRemove(p)); return `<div class="sel-bar"><button class="linkbtn" data-selall type="button">${sel.length === removable.length && removable.length ? 'Tout désélectionner' : 'Tout sélectionner'}</button><span class="note">${sel.length} sélectionné${sel.length > 1 ? 's' : ''}</span>${sel.length ? (S.confirmBulk ? `<button class="btn small" data-bulkdel type="button" style="background:var(--red)">Confirmer : retirer ${sel.length}</button><button class="btn ghost small" data-bulkcancel type="button">Annuler</button>` : `<button class="btn small" data-bulkask type="button" style="background:var(--red)">Retirer (${sel.length})</button>`) : ''}</div>`; })() : ''}
      <div class="list">${S.players.length ? (() => { const dups = duplicateMap(S.players); return S.players.map((p, n) => S.selMode ? `<label class="item pl-row sel-row ${dups[p.id] ? 'dup' : ''}">${canRemove(p) ? `<input type="checkbox" data-selp="${esc(p.id)}" ${(S.sel || []).includes(p.id) ? 'checked' : ''}>` : '<span class="sel-lock" title="Ne peut pas être retiré">—</span>'}<b><span class="pl-n">${n + 1}.</span> ${esc(p.name)}${p.id === ownerId() ? ' <span class="owner-tag">Propriétaire</span>' : ''}${p.id === meId() ? ' <span class="note">(vous)</span>' : ''}</b></label>` : `<div class="item pl-row ${dups[p.id] ? 'dup' : ''}"><b><span class="pl-n">${n + 1}.</span> ${canOrganize() || p.id === meId() ? `<button class="name-btn" data-rename="${esc(p.id)}" type="button">${esc(p.name)}</button>` : esc(p.name)}${p.id === ownerId() ? ' <span class="owner-tag">Propriétaire</span>' : !ownerId() ? '' : meId() === ownerId() ? ` <button class="role-chip ${isOrganizer(p.id) ? 'on' : ''}" data-org="${esc(p.id)}" type="button" ${!isOrganizer(p.id) && !hasAccepted(p) ? 'disabled title="Invitation pas encore acceptée"' : ''}>${isOrganizer(p.id) ? 'Organisateur ✓' : '+ Organisateur'}</button>` : isOrganizer(p.id) ? ' <span class="org-tag">Organisateur</span>' : ''}${dups[p.id] ? ` <span class="dup-flag" title="Ressemble à ${esc(dups[p.id].join(', '))}">Doublon ?</span>` : ''}${plStatus(p)}</b>${S.confirmDel === p.id
        ? `<span class="row"><button class="btn small" data-delp="${esc(p.id)}" type="button" style="background:var(--red)">Confirmer</button><button class="btn ghost small" data-canceldel type="button">Annuler</button></span>`
        : `<span class="row" style="flex-wrap:nowrap;flex:none"><button class="btn ghost small" data-phone="${esc(p.id)}" type="button">${p.phone ? '☎ ' + esc(fmtPhone(p.phone)) : p.authEmail ? '☎ ••' + esc(p.phoneHint || '') : '+ Téléphone'}</button>${p.id === ownerId() || !canOrganize() ? '' : `<button class="btn ghost small" data-askdel="${esc(p.id)}" type="button">Retirer</button>`}</span>`}</div>`).join(''); })() : '<p class="note">Aucun joueur pour l\'instant.</p>'}</div>
      ${inviter ? '' : banqueHtml()}
      ${isProprio() && (S.retiredPl || []).length ? `<h3 class="acct-h">Anciens joueurs (${S.retiredPl.length})</h3><p class="note"><b>Banque : ${S.players.length + S.retiredPl.length} / ${BANQUE_MAX} joueurs</b> (groupe et retirés ; au-delà, les plus anciens retirés sont oubliés). Ils ne font plus partie du groupe : plus de notifications ni d’accès. Leur nom et leur cellulaire restent ici pour les remettre en un geste.</p>
        <div class="list">${S.retiredPl.map((x, i) => `<div class="item pl-row retire-row"><div><b>${esc(x.name)}</b><span>${x.phone ? '☎ ' + esc(fmtPhone(x.phone)) + ' · ' : ''}retiré le ${new Date(x.retireLe).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' })}</span></div>
          <span class="row" style="flex-wrap:nowrap;flex:none"><button class="btn small" data-remettre="${i}" type="button">Remettre</button><button class="btn ghost small" data-oublier="${i}" type="button" aria-label="Enlever ${esc(x.name)} de la banque">✕</button></span></div>`).join('')}</div>` : ''}`;
  }
  // Statut d'invitation d'un joueur : compte créé, invité en attente, ou sans cellulaire
  // Notifications de chaque joueur, pour l'organisateur (lu dans subs du groupe)

  // « 20 » → « 20,00 » ; vide reste vide
  function fmtPhone(d) { d = String(d || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}` : d; }
  // ==== src/commun/notifications.js ====
  const NOTIF = { actif: ['ok', '🔔 Notifications actives', 'Il reçoit les alertes du groupe.'], bloque: ['bad', '🔕 Notifications bloquées', 'Il les a bloquées sur son téléphone : il ne reçoit rien. Parlez-lui, ou retirez-le du groupe.'],
    a_activer: ['wait', '🔕 Notifications pas activées', 'Il n’a pas encore accepté les notifications sur son téléphone.'], a_installer: ['wait', '🔕 App pas sur l’écran d’accueil', 'Sur iPhone, il doit ajouter l’app à l’écran d’accueil pour recevoir les alertes.'],
    non_supporte: ['bad', '🔕 Téléphone sans notifications', 'Son navigateur ne reçoit pas les notifications.'] };
  async function chargerNotifs() {
    if (Store.mode !== 'cloud' || !canOrganize()) return;
    try {
      const subs = await Store.listPushSubs(), m = {};
      subs.forEach(x => { const e = x.sub ? 'actif' : (x.etat || 'a_activer'); if (!m[x.playerId] || (x.at || 0) > m[x.playerId].at) m[x.playerId] = { e, at: x.at || 0 }; });
      S.notifs = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.e]));
    } catch (e) { S.notifs = {}; }
    if (S.view === 'players') render();
  }
  function notifStatus(p) {
    if (!S.notifs || !hasAccepted(p)) return '';
    const n = NOTIF[S.notifs[p.id] || 'a_activer'];
    return ` <span class="pl-st notif-${n[0]}" title="${esc(n[2])}">${n[1]}</span>`;
  }
  function plStatus(p) {
    if (hasAccepted(p)) return ' <span class="pl-st ok" title="Invitation acceptée : compte créé">✓ Compte créé</span>' + notifStatus(p);
    if (p.phone || p.phoneHint) return ' <span class="pl-st wait" title="Le texto d’invitation a pu être envoyé ; le joueur n’a pas encore créé son compte">Invité · en attente</span>';
    return ' <span class="pl-st none" title="Ajoutez son cellulaire pour l’inviter">Sans cellulaire</span>';
  }
  // ==== src/golf/terrains.js ====
  function vCourses() {
    $('#barTitle').textContent = 'Terrains';
    const ilya = t => { const j = Math.round((Date.now() - t) / 864e5); return j < 1 ? 'aujourd’hui' : j === 1 ? 'hier' : `il y a ${j} jours`; };
    // 2. À approuver : pour l'équipe Fanion, toutes les propositions ; pour un groupe, les siennes (en attente, ou refusées depuis moins de 30 jours)
    const liste = P.admin ? [...P.todo, ...P.mine.filter(p => p.statut === 'refuse' && Date.now() - (p.decideLe || 0) < 30 * 864e5)]
      : P.mine.filter(p => p.statut === 'propose' || (p.statut === 'refuse' && Date.now() - (p.decideLe || 0) < 30 * 864e5));
    const aApprouver = liste.sort((a, b) => a.cree - b.cree);
    const ligneProp = p => {
      const attente = p.statut === 'propose';
      const infos = `${esc([p.course.city, p.course.web && p.course.web.region].filter(Boolean).join(' · '))}${p.course.web ? ' · trouvé sur le web' : ''}${(p.photos || []).length ? ' · photo de la carte' : ''} · proposé par ${esc(p.proposePar || 'un joueur')}${p.groupeNom && P.admin ? ' (' + esc(p.groupeNom) + ')' : ''}, ${ilya(p.cree)}`;
      const etat = attente ? '<span class="pl-st wait">En attente</span>' : '<span class="pl-st none">Refusé</span>';
      const actions = !attente ? '' : S.confirmDelProp === p.id
        ? `<div class="row del-confirm"><span class="note">${P.admin ? 'Effacer cette proposition ? Le terrain n’entrera pas dans la banque.' : 'Retirer votre proposition ?'}</span><button class="btn small" data-delprop-ok="${esc(p.id)}" type="button" style="background:var(--red)">Effacer</button><button class="btn ghost small" data-delprop-no type="button">Annuler</button></div>`
        : `<div class="row prop-actions">${P.admin ? `<button class="btn small" data-prop="${esc(p.id)}" type="button">Vérifier et approuver</button>` : ''}<button class="btn ghost small danger-txt" data-delprop="${esc(p.id)}" type="button">Effacer</button></div>`;
      return `<div class="prop-row">${P.admin && attente ? `<button class="item" data-prop="${esc(p.id)}" type="button">` : '<div class="item">'}<b>${esc(p.course.name)}</b><span>${etat}${p.type === 'maj' ? ' <span class="pl-st maj">Mise à jour</span>' : ''} · ${infos}</span>${p.type === 'maj' && (p.changes || []).length ? `<span class="maj-resume">${esc(p.changes.slice(0, 3).join(' · '))}${p.changes.length > 3 ? ` · et ${p.changes.length - 3} autre${p.changes.length > 4 ? 's' : ''}` : ''}</span>` : ''}${P.admin && attente ? '</button>' : '</div>'}${actions}</div>`;
    };
    const nAtt = aApprouver.filter(p => p.statut === 'propose').length;
    return `<section class="card terr-etape"><h3><span class="terr-n">1</span> Terrain à ajouter</h3>
        <p class="note">Samuel cherche les clubs de votre région sur le web et prépare la carte de pointage ; vous pouvez aussi photographier la carte ou l’entrer à la main.</p>
        ${isProprio() ? '<button class="btn" data-addcourse type="button">Ajouter un terrain</button>' : '<p class="note"><b>Seul le propriétaire du groupe peut ajouter ou effacer un terrain.</b></p>'}</section>
      <section class="card terr-etape${nAtt && P.admin ? ' approve-card' : ''}"><h3><span class="terr-n">2</span> Terrains à approuver${nAtt ? ' (' + nAtt + ')' : ''}</h3>
        <p class="note">${P.admin ? 'Vérifiez chaque terrain avec sa carte de pointage, puis approuvez-le ou effacez-le.' : 'Chaque nouveau terrain est vérifié par l’équipe du fanion.ai, qui l’approuve ou l’efface.'}</p>
        ${aApprouver.length ? `<div class="list">${aApprouver.map(ligneProp).join('')}</div>` : '<p class="note vide">Aucun terrain en attente.</p>'}</section>
      <section class="card terr-etape"><h3><span class="terr-n">3</span> Terrains disponibles (${S.courses.length})</h3>
        <p class="note">Ceux marqués « Catalogue Québec » viennent de cartes publiques : vérifiez-les avec la carte du club et corrigez au besoin. « Effacer » enlève le terrain de la banque de votre groupe ; les parties jouées le gardent.</p>
        <div class="list">${S.courses.map(c => `<div class="course-row"><button class="item" data-edit="${esc(c.id)}"><b>${esc(c.name)}</b><span>${c.sim ? 'Simulateur · ' : ''}${c.catalog ? 'Catalogue Québec · ' : ''}${c.source === 'web' ? 'Trouvé sur le web · ' : ''}Normale ${L.teePar(c, c.tees[0])} · ${c.tees.length} tertres${c.city ? ' · ' + esc(c.city) : ''}</span></button>
        ${S.confirmDelCourse === c.id ? `<div class="row del-confirm"><span class="note">Effacer « ${esc(c.name)} » ?</span><button class="btn small" data-delcourse-ok="${esc(c.id)}" type="button" style="background:var(--red)">Effacer</button><button class="btn ghost small" data-delcourse-no type="button">Annuler</button></div>`
          : isProprio() ? `<button class="btn ghost small danger-txt course-del" data-delcourse="${esc(c.id)}" type="button" aria-label="Effacer ${esc(c.name)}">Effacer</button>` : ''}</div>`).join('')}</div></section>
      ${(Store.retired || []).length ? `<section class="card"><h3>Terrains effacés</h3><p class="note">Ils n’apparaissent plus dans la banque ni dans Nouvelle partie. Les parties déjà jouées gardent leur terrain.</p>
        <div class="list">${Store.retired.map(c => `<div class="item"><b>${esc(c.name)}</b>${isProprio() ? `<button class="btn ghost small" data-unretire="${esc(c.id)}" type="button">Remettre</button>` : ''}</div>`).join('')}</div></section>` : ''}`;
  }
  // ==== src/golf/terrains-web.js ====
  // ---------------- Terrains trouvés sur le web : région → clubs → carte préparée → révision et approbation ----------------
  const TERRAINS_API = 'https://lefanion.ai/api/terrains';
  const REGIONS_QC = ['Montréal', 'Laval', 'Laurentides', 'Lanaudière', 'Montérégie', 'Cantons-de-l’Est', 'Centre-du-Québec', 'Mauricie', 'Québec (Capitale-Nationale)', 'Charlevoix', 'Chaudière-Appalaches', 'Outaouais', 'Abitibi-Témiscamingue', 'Saguenay–Lac-Saint-Jean', 'Bas-Saint-Laurent', 'Gaspésie', 'Côte-Nord'];
  const W = { region: null, clubs: [], sources: [], charge: false, err: '', prep: null };
  const normNom = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/club de golf|golf club|club|golf|le |la |les |du |de |des |d’|d'/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  async function terrainsApi(body) {
    const tok = Store.mode === 'cloud' && await Store.token(); if (!tok) throw new Error('Connexion requise.');
    const r = await fetch(TERRAINS_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Erreur ' + r.status); return d;
  }
  // Région du joueur d'après sa position : point de repère le plus proche (villes principales de chaque région)
  const REPERES = {
    'Montréal': [[45.50, -73.57], [45.45, -73.75], [45.60, -73.56], [45.46, -73.84], [45.56, -73.66]],
    'Laval': [[45.57, -73.72], [45.61, -73.80], [45.60, -73.65], [45.54, -73.79]],
    'Montérégie': [[45.53, -73.45], [45.45, -73.47], [45.31, -73.26], [45.63, -72.95], [45.25, -74.13], [45.40, -74.03], [45.38, -73.56], [45.40, -72.73], [46.04, -73.11]],
    'Lanaudière': [[46.02, -73.44], [45.71, -73.49], [45.70, -73.64], [46.40, -73.95], [45.84, -73.42]],
    'Laurentides': [[45.78, -74.00], [46.12, -74.60], [45.67, -73.88], [46.55, -75.50], [45.92, -74.17], [45.55, -74.33], [45.64, -73.84]],
    'Cantons-de-l’Est': [[45.40, -71.89], [45.27, -72.15], [45.40, -72.00], [45.10, -72.30], [45.58, -70.88]],
    'Centre-du-Québec': [[45.88, -72.48], [46.06, -71.96], [46.22, -72.62], [45.95, -72.20]],
    'Mauricie': [[46.35, -72.55], [46.55, -72.75], [47.43, -72.78], [46.60, -73.00]],
    'Québec (Capitale-Nationale)': [[46.81, -71.21], [46.87, -71.35], [46.75, -71.60], [46.95, -71.30], [46.70, -71.90]],
    'Charlevoix': [[47.65, -70.15], [47.44, -70.50], [47.50, -70.30]],
    'Chaudière-Appalaches': [[46.80, -71.18], [46.70, -71.25], [46.12, -70.67], [46.22, -70.78], [46.98, -70.55], [45.90, -70.40], [46.45, -71.00]],
    'Outaouais': [[45.48, -75.70], [45.43, -75.75], [45.60, -75.40], [45.85, -76.00], [46.38, -75.97]],
    'Abitibi-Témiscamingue': [[48.24, -79.02], [48.10, -77.78], [48.57, -78.12], [47.31, -79.43]],
    'Saguenay–Lac-Saint-Jean': [[48.43, -71.07], [48.42, -71.25], [48.55, -72.23], [48.87, -72.23], [48.53, -71.65]],
    'Bas-Saint-Laurent': [[48.45, -68.52], [47.83, -69.53], [48.23, -69.02], [47.38, -68.33], [48.85, -67.53]],
    'Gaspésie': [[48.83, -64.48], [49.12, -66.49], [48.11, -66.13], [48.03, -65.00], [47.38, -61.86]],
    'Côte-Nord': [[49.22, -68.15], [50.22, -66.38], [48.14, -69.72], [50.28, -63.60]],
  };
  function regionDe(lat, lng) {
    let best = null, d0 = Infinity;
    for (const [r, pts] of Object.entries(REPERES)) for (const [a, b] of pts) {
      const d = Math.hypot(lat - a, (lng - b) * Math.cos(lat * Math.PI / 180));
      if (d < d0) { d0 = d; best = r; }
    }
    return d0 < 1.6 ? best : null;   // environ 175 km du repère le plus proche ; plus loin : hors Québec
  }
  const REGION_K = 'fanion.region';
  function positionJoueur() {
    return new Promise(ok => {
      if (!navigator.geolocation) return ok({ err: 'non' });
      navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), e => ok({ err: e.code === 1 ? 'refus' : 'echec' }), { enableHighAccuracy: false, timeout: 10000, maximumAge: 600e3 });
    });
  }
  // Hors Québec : nom de la région d'après la position (service gratuit prévu pour les navigateurs, puis OpenStreetMap)
  async function lieuDe(lat, lng) {
    const net = (u, ms = 6000) => Promise.race([fetch(u).then(r => r.ok ? r.json() : null), new Promise(ok => setTimeout(() => ok(null), ms))]).catch(() => null);
    const a = await net(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=fr`);
    if (a && (a.principalSubdivision || a.countryName)) return { region: [String(a.principalSubdivision || '').replace(/^(province|provincia|état|estado|state|région|region) (de |d’|d'|du |of )?/i, ''), a.countryName].filter(Boolean).join(', '), ville: a.city || a.locality || '' };
    const b = await net(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=8&accept-language=fr&lat=${lat}&lon=${lng}`);
    const ad = b && b.address;
    if (ad && (ad.state || ad.country)) return { region: [ad.state || ad.county, ad.country].filter(Boolean).join(', '), ville: ad.city || ad.town || ad.village || '' };
    return { region: `environs de ${lat.toFixed(2)}, ${lng.toFixed(2)}`, ville: '' };
  }
  // ---- Samuel garde les cartes à jour : il revérifie chaque terrain sur le web environ une fois par saison
  const VERIF_JOURS = 300, VERIF_PAR_JOUR = 2;
  const derniereVerif = c => Number(c.verifieLe || c.approuveLe || 0);
  const fmtN = x => String(x).replace('.', ',');
  function comparerCarte(c, d) {
    const h = d.holes || [], pars = h.map(x => x && x.par), sis = h.map(x => x && x.si);
    const valide = h.length === 18 && pars.every(p => p >= 3 && p <= 6) && [...sis].sort((a, b) => a - b).join(',') === Array.from({ length: 18 }, (_, i) => i + 1).join(',');
    if (!valide) return { valide: false };
    const changes = [];
    c.holes.forEach((o, i) => {
      if (Number(o.par) !== pars[i]) changes.push(`Trou ${i + 1} : normale ${o.par} → ${pars[i]}`);
      if (Number(o.si) !== sis[i]) changes.push(`Trou ${i + 1} : handicap ${o.si} → ${sis[i]}`);
    });
    const tees = c.tees.map(t => ({ ...t }));
    (d.tees || []).filter(t => t.rating > 50 && t.rating < 90 && t.slope >= 55 && t.slope <= 155).forEach(t => {
      const o = tees.find(x => String(x.name).toLowerCase() === String(t.name).toLowerCase());
      if (!o) { tees.push({ name: t.name, rating: t.rating, slope: t.slope }); changes.push(`Nouveau tertre ${t.name} : ${fmtN(t.rating)} / ${t.slope}`); }
      else if (Math.abs(Number(o.rating) - t.rating) > 0.05 || Number(o.slope) !== t.slope) { changes.push(`Tertre ${o.name} : ${fmtN(o.rating)} / ${o.slope} → ${fmtN(t.rating)} / ${t.slope}`); o.rating = t.rating; o.slope = t.slope; }
    });
    return { valide: true, changes, course: { ...c, holes: pars.map((p, i) => ({ par: p, si: sis[i] })), tees } };
  }
  async function verifierCarte(c, auto) {
    const d = await terrainsApi({ action: 'carte', nom: c.name, ville: c.city || '', region: c.region || '', frais: true });
    const r = comparerCarte(c, d);
    const carteSource = d.carte || d.cartePage ? { ...(d.carte || {}), page: d.cartePage || null } : c.carteSource;
    if (!r.valide) return { etat: 'incertain' };
    if (!r.changes.length) { await Store.saveCourse({ ...c, verifieLe: Date.now(), ...(carteSource ? { carteSource } : {}) }); return { etat: 'ajour' }; }
    if ([...P.todo, ...P.mine].some(p => p.statut === 'propose' && p.courseId === c.id)) return { etat: 'deja', changes: r.changes };
    const g = curGroup(), moi = (S.players.find(p => p.id === meId()) || {}).name || ls.get('pelland.me', '') || '';
    const web = { region: c.region || '', sources: d.sources || [], alertes: [], notes: d.notes || '', confiance: d.confiance || 'basse', carte: d.carte || null, cartePage: d.cartePage || null };
    const p = await Store.proposeCourse({ ...r.course, web }, { type: 'maj', courseId: c.id, changes: r.changes.slice(0, 40), proposePar: auto ? 'Samuel (vérification automatique)' : moi, groupeNom: g.name || '' });
    P.mine.push(p); if (P.admin) P.todo.push(p);
    return { etat: 'change', changes: r.changes };
  }
  // Pour l'équipe Fanion : deux terrains par jour, les moins récemment vérifiés d'abord (sans retarder l'app)
  async function verifAuto() {
    if (!P.admin || Store.mode !== 'cloud') return;
    const k = 'fanion.verif.jour', jour = new Date().toISOString().slice(0, 10);
    if (ls.get(k, '') === jour) return; ls.set(k, jour);
    const dus = S.courses.filter(c => !c.sim && Date.now() - derniereVerif(c) > VERIF_JOURS * 864e5 && ![...P.todo, ...P.mine].some(p => p.statut === 'propose' && p.courseId === c.id))
      .sort((a, b) => derniereVerif(a) - derniereVerif(b)).slice(0, VERIF_PAR_JOUR);
    let n = 0;
    for (const c of dus) { try { const r = await verifierCarte(c, true); if (r.etat === 'change') n++; } catch (e) { if (/configurée|Connexion/.test(e.message)) return; } }
    if (n) { S.courses = await Store.listCourses(); if (['home', 'courses'].includes(S.view) && !document.querySelector('#sheetWrap:not([hidden]), .cd-fond')) render(); }
  }
  async function chargerPropositions() {
    if (Store.needLogin) return;
    try { P.admin = await Store.isAdmin(); Object.assign(P, await Store.listProposals(P.admin), { charge: true }); } catch (e) { return; }
    setTimeout(verifAuto, 4000);
    if ((S.view === 'home' && P.todo.length) || S.view === 'courses') { if (!document.querySelector('#sheetWrap:not([hidden]), #welcome, .cd-fond')) render(); }
  }
  function ajoutTerrainSheet() {
    const memo = ls.get(REGION_K, null);   // { region, auto } : dernière région détectée ou choisie
    const html = (etat) => {
      const r = etat.region;
      const tete = etat.cherche ? `<div class="region-moi"><div class="spin small"></div><span>Samuel cherche votre région d’après votre position…</span></div>`
        : r ? `<div class="region-moi"><span class="note">${etat.auto ? (etat.ville ? `📍 Vous êtes près de ${esc(etat.ville)}` : '📍 Votre région, d’après votre position') : 'Dernière région utilisée'}</span>
            <button class="btn" data-region="${esc(r)}" type="button">Chercher les clubs · ${esc(r)}</button></div>`
        : `<div class="region-moi"><span class="note">${etat.refus ? 'Position non disponible : choisissez une région ou tapez un lieu.' : 'Choisissez une région ou tapez un lieu.'}</span>
            ${etat.refus || etat.echec ? '<button class="btn ghost small" data-relocal type="button">📍 Utiliser ma position</button>' : ''}</div>`;
      return `<h3>Ajouter un terrain</h3>
        <p class="note">Samuel cherche sur le web tous les clubs de golf de la région et prépare la carte de pointage du terrain choisi. Vous la vérifiez, puis l’approuvez ou la refusez avant qu’elle entre dans la banque.</p>
        ${tete}
        <form class="region-libre" data-libre><input id="regionLibre" type="text" maxlength="80" placeholder="Autre lieu (ville, pays)" autocomplete="off"><button class="btn small" type="submit">Chercher</button></form>
        <h4 class="region-autres">${r && REGIONS_QC.includes(r) ? 'Autres régions du Québec' : 'Régions du Québec'}</h4>
        <div class="region-grid">${REGIONS_QC.filter(x => x !== r).map(x => `<button class="chip-btn" data-region="${esc(x)}" type="button">${esc(x)}</button>`).join('')}</div>
        <div class="sheet-actions"><button class="btn ghost" data-main type="button">Autre : photo de la carte ou à la main</button><button class="btn ghost" data-close type="button">Annuler</button></div>`;
    };
    let etat = { region: memo && memo.region, auto: !!(memo && memo.auto), cherche: true };
    const lier = sh => {
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('[data-main]').onclick = () => { closeSheet(); go('course', { editCourse: null }); };
      sh.querySelectorAll('[data-region]').forEach(b => b.onclick = () => { const x = b.dataset.region; ls.set(REGION_K, { region: x, auto: x === etat.detectee }); closeSheet(); chercherClubs(x); });
      const rl = sh.querySelector('[data-relocal]'); if (rl) rl.onclick = localiser;
      sh.querySelector('[data-libre]').onsubmit = e => { e.preventDefault(); const x = sh.querySelector('#regionLibre').value.replace(/\s+/g, ' ').trim(); if (x.length < 2) return; ls.set(REGION_K, { region: x, auto: false }); closeSheet(); chercherClubs(x); };
    };
    const maj = () => { const sh = $('#sheet'); if ($('#sheetWrap').hidden || !sh.querySelector('.region-grid')) return; const lib = sh.querySelector('#regionLibre'), val = lib ? lib.value : '', foc = lib && document.activeElement === lib; sh.innerHTML = html(etat); lier(sh); const nl = sh.querySelector('#regionLibre'); if (nl) { nl.value = val; if (foc) nl.focus(); } };
    async function localiser() {
      etat = { ...etat, cherche: true }; maj();
      const p = await positionJoueur();
      let det = p.err ? null : regionDe(p.lat, p.lng), ville = '';
      if (!p.err && !det) { const l = await lieuDe(p.lat, p.lng); det = l.region; ville = l.ville; }
      if (det) etat = { region: det, auto: true, detectee: det, ville };
      else etat = { region: memo && memo.region, auto: false, refus: p.err === 'refus', echec: p.err && p.err !== 'refus' };
      maj();
    }
    openSheet(html(etat), lier);
    localiser();
  }
  async function chercherClubs(region, frais) {
    Object.assign(W, { region, clubs: [], sources: [], charge: false, err: '', prep: null });
    go('clubs');
    try { const d = await terrainsApi({ action: 'region', region, frais: !!frais }); W.clubs = d.clubs || []; W.sources = d.sources || []; }
    catch (e) { W.err = e.message; }
    W.charge = true; if (S.view === 'clubs') render();
  }
  async function preparerCarte(club, parcours) {
    W.prep = club.nom + (parcours ? ' · ' + parcours : ''); W.err = ''; render();
    try {
      const d = await terrainsApi({ action: 'carte', nom: club.nom, ville: club.ville, parcours, region: W.region });
      const nom = d.name || (club.nom + (parcours && !normNom(club.nom).includes(normNom(parcours)) ? ' – ' + parcours : ''));
      const holes = (d.holes || []).slice(0, 18).map(h => ({ par: h.par == null ? '' : h.par, si: h.si == null ? '' : h.si }));
      while (holes.length < 18) holes.push({ par: '', si: '' });
      const tees = (d.tees || []).map(t => ({ name: t.name, rating: t.rating == null ? '' : String(t.rating).replace('.', ','), slope: t.slope == null ? '' : String(t.slope) }));
      W.prep = null;
      go('course', { editCourse: { name: nom, city: d.city || club.ville || '', holes, tees: tees.length ? tees : [{ name: 'Blanc', rating: '', slope: '' }],
        web: { region: W.region, sources: d.sources || [], alertes: d.alertes || [], notes: d.notes || '', confiance: d.confiance || 'basse', carte: d.carte || null, cartePage: d.cartePage || null } } });
    } catch (e) { W.prep = null; W.err = 'Carte introuvable pour « ' + club.nom + ' » : ' + e.message; render(); }
  }
  function vClubs() {
    $('#barTitle').textContent = W.region || 'Clubs';
    const enBanque = c => { const n = normNom(c.nom); return n && S.courses.some(x => { const m = normNom(x.name); return m && (m.includes(n) || n.includes(m)); }); };
    if (!W.charge) return `<section class="card leo-cherche"><div class="spin"></div><p><b>Samuel cherche les clubs de golf · ${esc(W.region)}</b></p><p class="note">Recherche sur le web, ça prend de 20 à 60 secondes.</p></section>`;
    if (W.prep) return `<section class="card leo-cherche"><div class="spin"></div><p><b>Samuel prépare la carte de pointage</b></p><p>${esc(W.prep)}</p><p class="note">Il lit le site du club et les sites de cartes de pointage : normales, handicaps, tertres, évaluation et slope. Comptez jusqu’à une minute.</p></section>`;
    return `${W.err ? `<p class="note err-txt">${esc(W.err)}</p>` : ''}
      ${W.clubs.length ? `<p class="note">${W.clubs.length} club${W.clubs.length > 1 ? 's' : ''} trouvé${W.clubs.length > 1 ? 's' : ''}. Touchez un parcours : Samuel prépare sa carte, vous la vérifiez puis l’approuvez.</p>
      <div class="list">${W.clubs.map((c, i) => { const deja = enBanque(c); const pcs = c.parcours && c.parcours.length > 1 ? c.parcours : null;
        return `<div class="item club-item${deja ? ' deja' : ''}"><div><b>${esc(c.nom)}</b><span>${esc(c.ville || '')}${c.prive ? ' · privé' : ''}${deja ? ' · déjà dans la banque' : ''}</span></div>
          <div class="club-pcs">${pcs ? pcs.map((p, j) => `<button class="btn ghost small" data-club="${i}" data-pc="${j}" type="button">${esc(p.nom || 'Parcours ' + (j + 1))}${p.trous && p.trous !== 18 ? ' (' + p.trous + ' t.)' : ''}</button>`).join('') : `<button class="btn ghost small" data-club="${i}" type="button">${deja ? 'Préparer quand même' : 'Préparer la carte'}</button>`}</div></div>`; }).join('')}</div>` : (W.err ? '' : '<p class="note">Aucun club trouvé pour cette région.</p>')}
      <div class="row"><button class="btn ghost small" data-reclubs type="button">Relancer la recherche</button><button class="btn ghost small" data-autreregion type="button">Autre région</button><button class="btn ghost small" data-main type="button">Entrer à la main</button></div>
      ${W.sources.length ? `<p class="note">Sources : ${W.sources.slice(0, 5).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(' · ')}</p>` : ''}`;
  }
  // Photos de la carte jointes à la proposition (réduites pour tenir dans la fiche : 3 au plus, ~700 Ko en tout)
  async function photosPourVerif(urls) {
    const out = []; let total = 0;
    for (const u of urls.slice(0, 3)) {
      try {
        const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = u; });
        const k = Math.min(1, 1500 / Math.max(img.naturalWidth, img.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        let d = cv.toDataURL('image/jpeg', .62); if (d.length > 330e3) d = cv.toDataURL('image/jpeg', .45);
        if (total + d.length > 700e3) break; total += d.length; out.push(d);
      } catch (e) { }
    }
    return out;
  }
  // Carte de pointage source jointe au terrain, pour vérifier chaque valeur
  function carteSourceHtml(carte, page) {
    if (!carte && !page) return '';
    const dom = u => esc(String(u).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
    return `<div class="carte-source"><b>Carte de pointage du club</b>
      ${carte && carte.type === 'image' ? `<button type="button" class="carte-img" data-cartesrc="${esc(carte.vue || carte.url)}"><img src="${esc(carte.vue || carte.url)}" alt="Carte de pointage" loading="lazy" onerror="this.closest('.carte-img').classList.add('ko')"><span>Touchez pour agrandir</span></button>` : ''}
      ${carte && carte.type === 'pdf' ? `<a class="btn ghost small" href="${esc(carte.vue || carte.url)}" target="_blank" rel="noopener">📄 Ouvrir la carte (PDF)</a>` : ''}
      <span class="note">${carte ? `Fichier : <a href="${esc(carte.url)}" target="_blank" rel="noopener">${dom(carte.url)}</a>` : 'Pas de fichier de carte trouvé.'}${page ? ` · <a href="${esc(page)}" target="_blank" rel="noopener">page source</a>` : ''}</span></div>`;
  }
  function vCourse() {
    const c = S.editCourse || (S.editCourse = { name: '', city: '', holes: Array.from({ length: 18 }, () => ({ par: 4, si: '' })), tees: [{ name: 'Blanc', rating: '', slope: '' }] });
    $('#barTitle').textContent = c.proposition ? (c.proposition.maj ? 'Mise à jour à approuver' : 'Terrain à approuver') : c.web ? 'Carte à réviser' : c.id ? 'Modifier le terrain' : 'Nouveau terrain';
    const imgs = S.cardImgs || [];
    const w = c.web, prop = c.proposition, admin = P.admin;
    const propBand = prop ? `<section class="card web-band"><h2>${prop.maj ? 'La carte a changé' : 'Proposé pour la banque'}</h2><p>${prop.maj ? 'Samuel a revérifié ce terrain sur le web et trouvé des différences avec la banque' : 'Par ' + esc(prop.par || 'un joueur') + (prop.groupeNom ? ' (' + esc(prop.groupeNom) + ')' : '')}. Vérifiez avec la carte du club, corrigez au besoin, puis approuvez ou effacez.</p>
      ${prop.changes && prop.changes.length ? `<ul class="maj-liste">${prop.changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section>` : '';
    const webBand = w ? `<section class="card web-band conf-${esc(w.confiance)}">
        <h2>Carte préparée par Samuel · à réviser</h2>
        <p>Trouvée sur le web (fiabilité ${w.confiance === 'haute' ? 'élevée' : w.confiance === 'moyenne' ? 'moyenne' : 'faible'}). Comparez chaque normale, handicap, évaluation et slope avec la carte officielle du club, corrigez au besoin, puis approuvez ou refusez.</p>
        ${carteSourceHtml(w.carte, w.cartePage)}
        ${w.alertes.length ? `<ul class="web-alertes">${w.alertes.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
        ${w.notes ? `<p class="note">${esc(w.notes)}</p>` : ''}
        ${w.sources.length ? `<p class="note">Sources : ${w.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(' · ')}</p>` : ''}
      </section>` : '';
    return `${propBand}${webBand}
      <section class="card card-upload">
        <h2>Carte de pointage</h2>
        ${!w && c.carteSource ? carteSourceHtml(c.carteSource.url ? c.carteSource : null, c.carteSource.page) : ''}
        <p class="note">Prenez la carte en photo (recto et verso) ou choisissez un PDF. L’app lit les normales, les handicaps et les tertres et remplit le formulaire : vérifiez ensuite avec la photo.</p>
        <label class="btn upload-btn" for="cardFile">Téléverser la carte</label>
        <input id="cardFile" type="file" accept="image/*,application/pdf" multiple hidden>
        <div id="cardStatus" class="note">${esc(S.cardStatus || '')}</div>
        ${imgs.length ? `<div class="card-thumbs">${imgs.map((u, i) => `<button type="button" data-viewcard="${i}"><img src="${u}" alt="Carte ${i + 1}"></button>`).join('')}</div><p class="note">Touchez une photo pour l’agrandir.</p>` : ''}
      </section>
      <section class="card">
        <label>Nom du terrain<input id="cname" type="text" value="${esc(c.name)}" placeholder="Club de golf …"></label>
        <label>Ville<input id="ccity" type="text" value="${esc(c.city || '')}"></label>
        <label class="check"><input id="csim" type="checkbox" ${c.sim ? 'checked' : ''}> Terrain virtuel (simulateur)</label>
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
      ${prop || (w && admin) ? `<div class="row web-actions"><button class="btn" id="saveCourse" type="button">Approuver et ajouter à la banque</button><button class="btn ghost danger-txt" id="refuseCourse" type="button">${prop ? 'Effacer' : 'Refuser'}</button></div>`
        : w ? `<div class="row web-actions"><button class="btn" id="saveCourse" type="button">Envoyer pour approbation</button><button class="btn ghost danger-txt" id="refuseCourse" type="button">Refuser</button></div>
          <p class="note">L’équipe du fanion.ai vérifie chaque nouveau terrain avant de l’ajouter à la banque. Vous le verrez dans Terrains dès qu’il est approuvé.</p>`
        : !c.id && !admin ? `<button class="btn" id="saveCourse" type="button">Envoyer pour approbation</button><p class="note">L’équipe du fanion.ai vérifie chaque nouveau terrain avant de l’ajouter à la banque.</p>`
        : `<button class="btn" id="saveCourse" type="button">Enregistrer le terrain</button>`}
      ${!prop && c.id && S.courses.some(x => x.id === c.id) ? `<section class="card verif-card"><h3>Carte à jour ?</h3><p class="note">${derniereVerif(c) ? 'Dernière vérification : ' + new Date(derniereVerif(c)).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) + '.' : 'Jamais vérifiée sur le web.'} Samuel revérifie chaque terrain environ une fois par saison ; si la carte du club a changé, la mise à jour passe par l’approbation.</p>
        <button class="btn ghost small" id="verifCarte" type="button">🔄 Vérifier maintenant</button><div id="verifEtat" class="note"></div></section>` : ''}
      ${!prop && c.id && S.courses.some(x => x.id === c.id) ? (S.confirmRetire === c.id
        ? `<div class="row retire-row"><span class="note">Effacer « ${esc(c.name)} » de la banque du groupe ?</span><button class="btn small" id="retireOk" type="button" style="background:var(--red)">Effacer</button><button class="btn ghost small" id="retireNo" type="button">Annuler</button></div>`
        : `<button class="btn ghost danger-txt" id="retireCourse" type="button">Effacer ce terrain</button>`) : ''}`;
  }
  // ==== src/golf/lecture-carte.js ====
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
  // ==== src/commun/liaisons.js ====
  const bind = {
    compte(v) { bindCompte(v); },
    login(v) {
      const done = () => { const q = new URLSearchParams(location.search); q.delete('joueur'); q.delete('ref'); location.href = location.pathname + (q.toString() ? '?' + q : ''); };
      const say = t => { const m = $('#acMsg') || $('#loginMsg'); if (m) m.textContent = t; };
      const go = $('#haiGo'); if (go) go.onclick = async () => { go.disabled = true; say('Connexion…'); try { await HoldingAI.connecter(); } catch (e) { go.disabled = false; say(e.message); } };
      const out = $('#haiOut'); if (out) out.onclick = () => Store.logout();
      const nc = $('#ngCreate'); if (nc) nc.onclick = async () => {
        nc.disabled = true; say('Création…');
        try { await Store.createGroup($('#ngName').value, $('#ngMe').value); done(); } catch (e) { nc.disabled = false; say(e.message); }
      };
    },
    offre(v) {
      commonNav(v);
      v.querySelectorAll('[data-dispo]').forEach(b => b.onclick = () => { const dt = +b.dataset.dispo, a = S.offreSel; const i = a.indexOf(dt); if (i >= 0) a.splice(i, 1); else a.push(dt); render(); });
      const cn = $('#dispoCancel'); if (cn) cn.onclick = () => { history.replaceState(null, '', location.pathname); go('home'); };
      const sv = $('#dispoSave'); if (sv) sv.onclick = async () => {
        const me = ls.get('pelland.me', '') || ''; if (!me) return toast('Connectez-vous d’abord.');
        const rep = { name: me, dates: S.offreSel.slice().sort(), at: Date.now() };
        try { await Store.saveOffre({ id: S.offre.id, ['rep_' + presKey(me)]: rep }, true); S.offre['rep_' + presKey(me)] = rep; render(); }
        catch (e) { toast('Enregistrement impossible : ' + e.message); }
      };
    },
    players(v) {
      if (!S.notifsAt || Date.now() - S.notifsAt > 60e3) { S.notifsAt = Date.now(); chargerNotifs(); }
      if (S.pMode === 'inviter' && !S.pFocused && roomLeft() > 0) { S.pFocused = true; setTimeout(() => { const i = $('#newPlayer'); if (i) i.focus(); }, 80); }
      v.querySelectorAll('[data-org]').forEach(b => b.onclick = async () => {
        // un seul organisateur (en plus du propriétaire) : en nommer un nouveau remplace l'ancien
        const gr = { ...curGroup() }, id = b.dataset.org, cur = (gr.organizers || [])[0];
        if (cur !== id && !hasAccepted(S.players.find(p => p.id === id))) return toast('Ce joueur n’a pas encore accepté son invitation (compte pas créé).');
        gr.organizers = cur === id ? [] : [id];
        try { await Store.saveGroup(gr); S.groups = await Store.listGroups(); render(); } catch (e) { toast('Impossible : ' + e.message); }
      });
      const co = $('#claimOwner'); if (co) co.onclick = async () => {
        const me = S.players.find(p => L.norm(p.name) === L.norm(ls.get('pelland.me', '') || ''));
        if (!me) return toast('Connectez-vous d’abord.');
        const gr = { ...curGroup(), owner: me.id };
        try { await Store.saveGroup(gr); S.groups = await Store.listGroups(); render(); } catch (e) { toast('Impossible : ' + e.message); }
      };
      const add = async () => {
        const n = $('#newPlayer').value.trim(); if (!n) return;
        if (S.players.some(p => L.norm(p.name) === L.norm(n))) return toast(`${n} est déjà dans la liste.`);
        const near = duplicateMap(S.players.concat([{ id: '__new', name: n }]))['__new'];
        if (near && S.confirmAdd !== n) { S.confirmAdd = n; return toast(`Ressemble à ${near.join(', ')}. Touchez Ajouter de nouveau pour confirmer.`); }
        S.confirmAdd = null;
        if (roomLeft() <= 0) return limitSheet();
        if ((S.bank || S.players).length >= BANQUE_MAX) return toast(`La banque de joueurs est pleine (${BANQUE_MAX}).`);
        try { const np = await Store.savePlayer(n, (S.bank || S.players).length); const ph = $('#newPhone').value.trim(); if (ph) await Store.setPhone(np, ph); S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); render(); if (ph) inviteText(n, ph, np.id); else setTimeout(() => $('#newPlayer') && $('#newPlayer').focus(), 50); }
        catch (e) { toast('Ajout impossible : ' + e.message); }
      };
      if ($('#addPlayer')) $('#addPlayer').onclick = add;
      const xf = $('#xlsFile'); if (xf) xf.onchange = async () => { const f = xf.files[0]; xf.value = ''; if (f) importPlayersFile(f); };
      if ($('#newPlayer')) $('#newPlayer').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
      v.querySelectorAll('[data-askdel]').forEach(b => b.onclick = () => { S.confirmDel = b.dataset.askdel; render(); });
      if (canOrganize() && !S.bankAt) { S.bankAt = 1; Store.listBank().then(l => { S.bank = l; if (S.view === 'players') render(); }).catch(() => { }); }
      v.querySelectorAll('[data-membre]').forEach(b => b.onclick = async () => {
        if (roomLeft() <= 0) return limitSheet(S.players.length + 1);
        b.disabled = true; const p = (S.bank || []).find(x => x.id === b.dataset.membre);
        try { await Store.setMembre(b.dataset.membre, true); S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); toast(`${p ? p.name : 'Le joueur'} est dans le groupe.`); render(); }
        catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-bankdel]').forEach(b => b.onclick = async () => {
        const p = (S.bank || []).find(x => x.id === b.dataset.bankdel); if (!p) return;
        if (S.confirmBankDel !== p.id) { S.confirmBankDel = p.id; b.textContent = 'Enlever ?'; b.classList.add('danger-txt'); return; }
        b.disabled = true;
        try { await Store.deletePlayer(p.id, (S.bank || []).length); S.bank = await Store.listBank(); S.confirmBankDel = null; toast(`${p.name} est enlevé de la banque.`); render(); }
        catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-reinv]').forEach(b => b.onclick = () => { const p = (S.bank || []).find(x => x.id === b.dataset.reinv); if (p) inviteText(p.name, p.phone, p.id); });
      if (canOrganize() && !S.retiredPlAt) { S.retiredPlAt = 1; Store.retiredPlayers().then(l => { S.retiredPl = l; if (l.length && S.view === 'players') render(); }).catch(() => { }); }
      v.querySelectorAll('[data-remettre]').forEach(b => b.onclick = async () => {
        const x = S.retiredPl[+b.dataset.remettre]; if (!x) return;
        if (roomLeft() <= 0) return toast(`Le groupe est complet (${S.players.length} / ${planOf().max}).`);
        b.disabled = true;
        try {
          const np = await Store.savePlayer(x.name, S.players.length);
          if (x.phone && x.phone.length >= 10) { try { await Store.setPhone(np, x.phone); } catch (e) { } }
          S.retiredPl = S.retiredPl.filter(y => y !== x); await Store.setRetiredPlayers(S.retiredPl);
          S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); toast(`${x.name} est de retour dans le groupe.`); render();
          if (x.phone) inviteText(x.name, x.phone, np && np.id);
        } catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-oublier]').forEach(b => b.onclick = async () => {
        const x = S.retiredPl[+b.dataset.oublier]; if (!x) return;
        S.retiredPl = S.retiredPl.filter(y => y !== x); try { await Store.setRetiredPlayers(S.retiredPl); } catch (e) { } toast(`${x.name} est enlevé de la banque.`); render();
      });
      v.querySelectorAll('[data-phone]').forEach(b => b.onclick = () => {
        const pl = S.players.find(x => x.id === b.dataset.phone);
        openSheet(`<h3>Téléphone de ${esc(pl.name)}</h3>
          <p class="note">${pl.phone ? `Numéro actuel : <b style="font-size:20px">${esc(fmtPhone(pl.phone))}</b>` : pl.authEmail ? `Numéro actuel : se termine par <b>${esc(pl.phoneHint || '')}</b>. Entrez le numéro complet une fois ci-dessous et touchez Enregistrer : il s’affichera ensuite.` : 'Aucun numéro pour l’instant.'}</p>
          <label>${pl.authEmail ? 'Nouveau numéro' : 'Numéro'}<input id="phIn" type="tel" inputmode="tel" placeholder="450 555-1234" value="${esc(pl.phone ? fmtPhone(pl.phone) : '')}"></label>
          <p class="note">Ce numéro sert à se connecter. Il est visible seulement par les joueurs du groupe.</p>
          ${Store.phonesBlocked ? '<div class="warn">La base a refusé d’enregistrer ce numéro. Réessayez, ou écrivez à ' + MARQUE.courriel + '.</div>' : ''}
          <div class="row"><button class="btn small" id="phSave" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelector('#phSave').onclick = async () => {
            try { const first = !pl.authEmail, ph = sh.querySelector('#phIn').value; await Store.setPhone(pl, ph); closeSheet(); S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); toast('Téléphone enregistré.'); render(); if (first) inviteText(pl.name, ph, pl.id); }
            catch (e) { toast(e.message); }
          };
          setTimeout(() => { const i = sh.querySelector('#phIn'); if (i) { i.focus(); i.select(); } }, 50);
        });
      });
      v.querySelectorAll('[data-rename]').forEach(b => b.onclick = () => {
        const pl = S.players.find(x => x.id === b.dataset.rename);
        openSheet(`<h3>Modifier le nom</h3>
          <label>Prénom et nom<input id="rnIn" type="text" autocapitalize="words" value="${esc(pl.name)}"></label>
          <p class="note">Les parties déjà jouées gardent l’ancien nom.</p>
          <div class="row"><button class="btn small" id="rnSave" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelector('#rnSave').onclick = async () => {
            const nm = sh.querySelector('#rnIn').value.trim().replace(/\s+/g, ' ');
            if (!nm) return toast('Entrez un nom.');
            if (S.players.some(x => x.id !== pl.id && L.norm(x.name) === L.norm(nm))) return toast('Ce nom est déjà dans le groupe.');
            try { const self = pl.id === meId(); await Store.renamePlayer(pl.id, nm); if (self) ls.set('pelland.me', nm); closeSheet(); S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); toast('Nom modifié.'); render(); }
            catch (e) { toast('Impossible : ' + e.message); }
          };
          setTimeout(() => { const i = sh.querySelector('#rnIn'); if (i) { i.focus(); i.select(); } }, 50);
        });
      });
      const sm = v.querySelector('[data-selmode]'); if (sm) sm.onclick = () => { S.selMode = !S.selMode; S.sel = []; S.confirmBulk = false; render(); };
      v.querySelectorAll('[data-selp]').forEach(c => c.onchange = () => { const id = c.dataset.selp; S.sel = (S.sel || []).filter(x => x !== id); if (c.checked) S.sel.push(id); S.confirmBulk = false; render(); });
      const sa = v.querySelector('[data-selall]'); if (sa) sa.onclick = () => { const all = S.players.filter(canRemove).map(p => p.id); S.sel = (S.sel || []).length === all.length ? [] : all; S.confirmBulk = false; render(); };
      const ba = v.querySelector('[data-bulkask]'); if (ba) ba.onclick = () => { S.confirmBulk = true; render(); };
      const bc = v.querySelector('[data-bulkcancel]'); if (bc) bc.onclick = () => { S.confirmBulk = false; render(); };
      const bd = v.querySelector('[data-bulkdel]'); if (bd) bd.onclick = async () => {
        const ids = (S.sel || []).slice(); let ok = 0;
        for (const id of ids) { try { await Store.setMembre(id, false); ok++; } catch (e) { } }
        S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); S.sel = []; S.confirmBulk = false; S.selMode = false;
        toast(ok === ids.length ? `${ok} joueur${ok > 1 ? 's' : ''} retiré${ok > 1 ? 's' : ''}.` : `${ok} sur ${ids.length} retirés : réessayez pour les autres.`); render();
      };
      v.querySelectorAll('[data-canceldel]').forEach(b => b.onclick = () => { S.confirmDel = null; render(); });
      v.querySelectorAll('[data-delp]').forEach(b => b.onclick = async () => {
        const p = S.players.find(x => x.id === b.dataset.delp);
        try { await Store.setMembre(b.dataset.delp, false); S.players = await Store.listPlayers(); S.bank = await Store.listBank().catch(() => S.bank); S.confirmDel = null; toast(`${p ? p.name : 'Le joueur'} est retiré du groupe ; il reste dans la banque.`); render(); } catch (e) { toast('Retrait impossible : ' + e.message); }
      });
    },
  };

  function commonNav(v) {
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go, b.dataset.go === 'setup' ? { draft: null } : b.dataset.go === 'players' ? { pMode: b.dataset.pmode || 'banque' } : b.dataset.go === 'comps' ? { compLive: !!b.dataset.clive } : b.dataset.new ? { editCourse: null } : {}));
    v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => MODULE.ouvrir(b.dataset.open));
  }
  // ==== src/golf/liaisons.js ====
  // Interactions des écrans du golf
  Object.assign(bind, {
    jeux(v) {
      commonNav(v);
      const jn = v.querySelector('[data-jnew]'); if (jn) jn.onclick = () => askNewGame();
      v.querySelectorAll('[data-jedit]').forEach(b => b.onclick = () => go('jeuEdit', { editJeu: JSON.parse(JSON.stringify(S.jeux.find(j => j.id === b.dataset.jedit))) }));
      v.querySelectorAll('[data-jdel]').forEach(b => b.onclick = async () => {
        if (S.confirmDelJ !== b.dataset.jdel) { S.confirmDelJ = b.dataset.jdel; return render(); }
        const list = S.jeux.filter(j => j.id !== b.dataset.jdel);
        try { await Store.saveJeux(list); S.jeux = list; S.confirmDelJ = null; render(); } catch (e) { toast('Retrait impossible : ' + e.message); }
      });
    },
    jeuEdit(v) {
      commonNav(v);
      const j = S.editJeu, sync = () => v.querySelectorAll('[data-jf]').forEach(i => { j[i.dataset.jf] = i.dataset.jf === 'name' || i.dataset.jf === 'ranks' ? i.value : i.value.replace(',', '.'); });
      v.querySelectorAll('[data-jf]').forEach(i => i.oninput = () => { sync(); const u = $('#jSum'); if (u) u.innerHTML = persoLines(j).map(r => `<li>${esc(r)}</li>`).join(''); });
      v.querySelectorAll('[data-jmode]').forEach(b => b.onclick = () => { sync(); j.mode = b.dataset.jmode; render(); });
      $('#jSave').onclick = async () => {
        sync();
        if (!String(j.name).trim()) return toast('Donnez un nom au jeu.');
        ['low', 'high', 'team', 'birdie', 'stake', 'skin', 'pp'].forEach(k => { j[k] = Number(j[k]) || 0; });
        if (j.mode === 'equipes' ? !(j.low || j.high || j.team || j.birdie) : !(String(j.ranks).trim() || j.birdie || j.skin)) return toast('Choisissez au moins une façon de gagner des points.');
        const out = { ...j, name: String(j.name).trim(), id: j.id || 'j' + Date.now().toString(36) };
        const list = (S.jeux || []).filter(x => x.id !== out.id).concat([out]);
        try { await Store.saveJeux(list); S.jeux = list; S.editJeu = null; go('jeux'); } catch (e) { toast('Enregistrement impossible : ' + e.message); }
      };
    },
    quatuors(v) {
      commonNav(v);
      const f = S.newOffre;
      const on = $('#oNew'); if (on) on.onclick = () => { const dl = new Date(Date.now() + 3 * 864e5); S.newOffre = { course: (S.courses[0] || {}).name || '', dates: [''], deadline: dl.toISOString().slice(0, 10) }; render(); };
      if (f) {
        const syncO = () => { f.place = $('#oPlace').value.trim(); f.course = $('#oCourse').value; f.deadline = $('#oDeadline').value; v.querySelectorAll('[data-od]').forEach(i => { f.dates[+i.dataset.od] = i.value; }); };
        $('#oAddDate').onclick = () => { syncO(); f.dates.push(''); render(); };
        v.querySelectorAll('[data-odx]').forEach(b => b.onclick = () => { syncO(); f.dates.splice(+b.dataset.odx, 1); if (!f.dates.length) f.dates.push(''); render(); });
        $('#oCancel').onclick = () => { S.newOffre = null; render(); };
        $('#oSend').onclick = async () => {
          syncO();
          const dates = f.dates.filter(Boolean).map(x => new Date(x).getTime()).filter(x => !isNaN(x)).sort((a, b) => a - b);
          if (!dates.length) return toast('Ajoutez au moins une date.');
          if (!f.deadline) return toast('Choisissez la date butoir.');
          const o = { id: Date.now().toString(36), course: f.course, place: f.place || '', dates, deadline: new Date(f.deadline + 'T23:59:59').getTime(), by: ls.get('pelland.me', '') || '', groupId: Store.gid, createdAt: Date.now() };
          try { await Store.saveOffre(o); S.offres = [o].concat(S.offres || []); S.newOffre = null; markStep('offre'); render(); offreSms(o);
            Push.notify({ title: 'Nouvelles dates – ' + o.course.replace(/^Club de golf /i, ''), body: `Indiquez vos disponibilités avant le ${fmtDay(o.deadline)}.`, url: './?offre=' + o.id, tag: 'offre-' + o.id }); }
          catch (e) { toast('Enregistrement impossible : ' + e.message); }
        };
      }
      v.querySelectorAll('[data-osms]').forEach(b => b.onclick = () => offreSms(S.offres.find(o => o.id === b.dataset.osms)));
      v.querySelectorAll('[data-orem]').forEach(b => b.onclick = () => reminderSheet(S.offres.find(o => o.id === b.dataset.orem)));
      v.querySelectorAll('[data-odel]').forEach(b => b.onclick = async () => {
        if (S.confirmDelO !== b.dataset.odel) { S.confirmDelO = b.dataset.odel; return render(); }
        try { await Store.deleteOffre(b.dataset.odel); S.offres = S.offres.filter(o => o.id !== b.dataset.odel); S.confirmDelO = null; render(); } catch (e) { toast('Retrait impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-oauto]').forEach(b => b.onclick = () => { const [id, dt] = b.dataset.oauto.split('|'); autoQuatuorsSheet(S.offres.find(x => x.id === id), +dt); });
      v.querySelectorAll('[data-oquat]').forEach(b => b.onclick = () => {
        const key = b.dataset.oquat, x = offreDates().find(y => y.key === key), d = newDraft();
        d.offre = key; void x;
        go('setup', { draft: d });
      });
      const nq = S.newQuat;
      v.querySelectorAll('[data-qp]').forEach(sl => sl.onchange = e => { nq.players[+sl.dataset.qp] = e.target.value; render(); });
      const qs = $('#qsave'); if (qs) qs.onclick = async () => {
        if (nq.players.some(x => !x)) return toast('Choisissez les 4 joueurs.');
        const list = (S.quatuors || []).concat([{ id: 'q' + Date.now().toString(36), name: nq.name, players: nq.players.slice() }]);
        try { await Store.saveQuatuors(list); S.quatuors = list; S.newQuat = null; render(); } catch (e) { toast('Enregistrement impossible : ' + e.message); }
      };
      v.querySelectorAll('[data-qrem]').forEach(b => b.onclick = () => {
        const x = S.quatuors.find(q => q.id === b.dataset.qrem), me = L.norm(ls.get('pelland.me', '') || '');
        const ps = (S.players || []).filter(p => L.norm(p.name) !== me && x.players.some(n => L.norm(n) === L.norm(p.name)));
        const txt = `Rappel – ${groupName()} : ${x.name ? 'on joue à ' + x.name.replace(/ – groupe \d+$/, '') : x.date ? 'on joue ' + fmtDate(x.date) : 'partie à venir'}. Ton groupe : ${x.players.join(', ')}. À bientôt sur le terrain !`;
        openSheet(`<h3>Rappel au groupe</h3><p class="note">${esc(x.players.join(', '))}</p><label>Message<textarea id="qrMsg" rows="4">${esc(txt)}</textarea></label>
          ${ps.some(p => !p.phone) ? `<p class="warn" style="margin:6px 0">Pas de numéro pour ${esc(ps.filter(p => !p.phone).map(p => p.name).join(', '))}.</p>` : ''}
          <div class="row"><button class="btn small" id="qrGo" type="button" ${ps.some(p => p.phone) ? '' : 'disabled'}>Envoyer le texto (${ps.filter(p => p.phone).length})</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelector('#qrGo').onclick = () => { const t = sh.querySelector('#qrMsg').value; closeSheet(); openSms(ps.filter(p => p.phone).map(p => p.phone), t); };
        });
      });
      v.querySelectorAll('[data-qplay]').forEach(b => b.onclick = () => { const x = S.quatuors.find(q => q.id === b.dataset.qplay); go('setup', { draft: draftFromQuatuor(x) }); });
      v.querySelectorAll('[data-qask]').forEach(b => b.onclick = () => { S.confirmDelQ = b.dataset.qask; render(); });
      v.querySelectorAll('[data-qcancel]').forEach(b => b.onclick = () => { S.confirmDelQ = null; render(); });
      v.querySelectorAll('[data-qdel]').forEach(b => b.onclick = async () => {
        const list = S.quatuors.filter(q => q.id !== b.dataset.qdel);
        try { await Store.saveQuatuors(list); S.quatuors = list; S.confirmDelQ = null; render(); } catch (e) { toast('Retrait impossible : ' + e.message); }
      });
    },
    home(v) {
      commonNav(v); const lo = $('#logout'); if (lo) lo.onclick = () => Store.logout();
      setTimeout(maybeWelcome, 300);
      rememberCurrent();
      const rg = $('#renameGroup'); if (rg) rg.onclick = () => openSheet(`<h3>Nom du groupe</h3>
          <label>Nom<input id="gnIn" type="text" autocapitalize="sentences" value="${esc(groupName())}"></label>
          <p class="note">Le nom paraît en haut de l’accueil et dans les textos envoyés aux joueurs.</p>
          <div class="row"><button class="btn small" id="gnSave" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
        sh.querySelector('[data-close]').onclick = closeSheet;
        sh.querySelector('#gnSave').onclick = async () => {
          const nm = sh.querySelector('#gnIn').value.trim().replace(/\s+/g, ' ');
          if (!nm) return toast('Entrez un nom.');
          try { await Store.saveGroup({ ...curGroup(), name: nm }); S.groups = await Store.listGroups(); closeSheet(); toast('Nom du groupe modifié.'); render(); }
          catch (e) { toast('Impossible : ' + e.message); }
        };
        setTimeout(() => { const i = sh.querySelector('#gnIn'); if (i) { i.focus(); i.select(); } }, 50);
      });
    },
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
        try { await removeGame(b.dataset.delgame, S.historyList.find(x => x.id === b.dataset.delgame)); S.historyList = S.historyList.filter(x => x.id !== b.dataset.delgame); S.confirmDelGame = null; render(); }
        catch (e) { toast('Effacement impossible : ' + e.message); }
      });
    },
    clubs(v) {
      v.querySelectorAll('[data-club]').forEach(b => b.onclick = () => { const c = W.clubs[+b.dataset.club]; const p = b.dataset.pc != null && c.parcours ? c.parcours[+b.dataset.pc] : null; preparerCarte(c, p && p.nom || ''); });
      const q = (s, f) => { const el = v.querySelector(s); if (el) el.onclick = f; };
      q('[data-reclubs]', () => chercherClubs(W.region, true));
      q('[data-autreregion]', ajoutTerrainSheet);
      q('[data-main]', () => go('course', { editCourse: null }));
    },
    courses(v) {
      commonNav(v);
      const ac = v.querySelector('[data-addcourse]'); if (ac) ac.onclick = ajoutTerrainSheet;
      v.querySelectorAll('[data-delprop]').forEach(b => b.onclick = () => { S.confirmDelProp = b.dataset.delprop; render(); });
      v.querySelectorAll('[data-delprop-no]').forEach(b => b.onclick = () => { S.confirmDelProp = null; render(); });
      v.querySelectorAll('[data-delprop-ok]').forEach(b => b.onclick = async () => {
        b.disabled = true; const id = b.dataset.delpropOk;
        try {
          if (P.admin) await Store.decideProposal(id, false); else await Store.withdrawProposal(id);
          P.todo = P.todo.filter(p => p.id !== id); P.mine = P.admin ? P.mine.map(p => p.id === id ? { ...p, statut: 'refuse', decideLe: Date.now() } : p) : P.mine.filter(p => p.id !== id);
          S.confirmDelProp = null; toast(P.admin ? 'Terrain effacé : il n’entre pas dans la banque.' : 'Proposition retirée.'); render();
        } catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => {
        const p = P.todo.find(x => x.id === b.dataset.prop); if (!p) return;
        const { web, ...co } = JSON.parse(JSON.stringify(p.course)); if (p.type !== 'maj') delete co.id;
        const fmt = x => x == null || x === '' || isNaN(x) ? '' : String(x).replace('.', ',');
        go('course', { editCourse: { ...co, holes: co.holes.map(h => ({ par: h.par, si: h.si })), tees: co.tees.map(t => ({ ...t, rating: fmt(t.rating), slope: fmt(t.slope) })), ...(web ? { web: { alertes: [], notes: '', sources: [], ...web } } : {}), proposition: { id: p.id, par: p.proposePar, groupeNom: p.groupeNom, maj: p.type === 'maj', changes: p.changes || [] } } });
        if (p.photos && p.photos.length) { S.cardImgs = p.photos.slice(); S.cardStatus = 'Photos de la carte envoyées avec la proposition : comparez chaque valeur.'; render(); }
      });
      v.querySelectorAll('[data-delcourse]').forEach(b => b.onclick = () => { S.confirmDelCourse = b.dataset.delcourse; render(); });
      v.querySelectorAll('[data-delcourse-no]').forEach(b => b.onclick = () => { S.confirmDelCourse = null; render(); });
      v.querySelectorAll('[data-delcourse-ok]').forEach(b => b.onclick = async () => {
        b.disabled = true; const c = S.courses.find(x => x.id === b.dataset.delcourseOk);
        try { await Store.setCourseRetired(b.dataset.delcourseOk, true); S.courses = await Store.listCourses(); S.confirmDelCourse = null; toast(`« ${c ? c.name : 'Terrain'} » est effacé.`); render(); }
        catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
      v.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => {
        const co = S.courses.find(c => c.id === b.dataset.edit);
        go('course', { editCourse: JSON.parse(JSON.stringify(co)), confirmRetire: null });
        if (co.photosCarte) { const ph = await Store.cartePhotos(co.id); if (ph.length && S.view === 'course' && S.editCourse && S.editCourse.id === co.id && !(S.cardImgs || []).length) { S.cardImgs = ph; S.cardStatus = 'Photos de la carte jointes à ce terrain.'; render(); } }
      });
      v.querySelectorAll('[data-unretire]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { await Store.setCourseRetired(b.dataset.unretire, false); S.courses = await Store.listCourses(); toast('Terrain remis dans la banque.'); render(); }
        catch (e) { b.disabled = false; toast('Impossible : ' + e.message); }
      });
    },
    course(v) {
      const c = S.editCourse;
      const sync = () => {
        c.name = $('#cname').value; c.city = $('#ccity').value; c.sim = $('#csim').checked;
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
      v.querySelectorAll('[data-cartesrc]').forEach(b => b.onclick = () => openSheet(`<div class="card-view"><img src="${esc(b.dataset.cartesrc)}" alt="Carte de pointage"></div><div class="sheet-actions"><a class="btn ghost" href="${esc(b.dataset.cartesrc)}" target="_blank" rel="noopener">Ouvrir en plein écran</a><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; }));
      v.querySelectorAll('[data-viewcard]').forEach(b => b.onclick = () => openSheet(`<div class="card-view"><img src="${S.cardImgs[+b.dataset.viewcard]}" alt="Carte"></div><div class="sheet-actions"><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; }));
      $('#addTee').onclick = () => { sync(); c.tees.push({ name: '', rating: '', slope: '' }); render(); };
      v.querySelectorAll('[data-deltee]').forEach(b => b.onclick = () => { sync(); if (c.tees.length > 1) c.tees.splice(+b.dataset.deltee, 1); render(); });
      const rc = $('#retireCourse'); if (rc) rc.onclick = () => { S.confirmRetire = c.id; render(); };
      const rn = $('#retireNo'); if (rn) rn.onclick = () => { S.confirmRetire = null; render(); };
      const ro = $('#retireOk'); if (ro) ro.onclick = async () => {
        ro.disabled = true;
        try { await Store.setCourseRetired(c.id, true); S.courses = await Store.listCourses(); S.confirmRetire = null; S.editCourse = null; toast(`« ${c.name} » est effacé de la banque.`); go('courses'); }
        catch (e) { ro.disabled = false; toast('Retrait impossible : ' + e.message); }
      };
      const vc = $('#verifCarte'); if (vc) vc.onclick = async () => {
        vc.disabled = true; const et = $('#verifEtat'); et.textContent = 'Samuel compare avec la carte du club sur le web… (jusqu’à une minute)';
        try {
          const r = await verifierCarte(S.courses.find(x => x.id === c.id) || c, false);
          et.textContent = r.etat === 'ajour' ? '✓ La carte est à jour.' : r.etat === 'incertain' ? 'Samuel n’a pas trouvé de carte complète et fiable : rien n’a changé.' : r.etat === 'deja' ? 'Une mise à jour attend déjà l’approbation.'
            : `La carte a changé (${r.changes.length} différence${r.changes.length > 1 ? 's' : ''}) : la mise à jour ${P.admin ? 'est dans « Terrains à approuver »' : 'est envoyée pour approbation'}.`;
          if (r.etat === 'ajour') S.courses = await Store.listCourses();
        } catch (e) { et.textContent = 'Vérification impossible : ' + e.message; }
        vc.disabled = false;
      };
      const rf = $('#refuseCourse'); if (rf) rf.onclick = async () => {
        if (c.proposition) {
          rf.disabled = true;
          try { await Store.decideProposal(c.proposition.id, false); P.todo = P.todo.filter(p => p.id !== c.proposition.id); toast('Terrain effacé : il n’entre pas dans la banque.'); S.editCourse = null; go('courses'); chargerPropositions(); }
          catch (e) { rf.disabled = false; toast('Impossible : ' + e.message); }
          return;
        }
        toast('Carte refusée : rien n’a été ajouté.'); S.editCourse = null; go(W.region ? 'clubs' : 'courses');
      };
      $('#saveCourse').onclick = async () => {
        sync();
        const num = x => parseFloat(String(x).replace(',', '.'));
        const { web, proposition, ...base } = c;
        const out = { ...base, catalog: false, name: c.name.trim(), ...(web ? { source: 'web', region: web.region || '', sources: web.sources.slice(0, 6), approuvePar: Store.uid || '', approuveLe: Date.now(), ...(web.carte || web.cartePage ? { carteSource: { ...(web.carte || {}), page: web.cartePage || null } } : {}) } : {}), holes: c.holes.map(h => ({ par: parseInt(h.par, 10), si: parseInt(h.si, 10) })),
          tees: c.tees.filter(t => String(t.name).trim()).map(t => ({ ...t, name: String(t.name).trim(), rating: num(t.rating), slope: parseInt(t.slope, 10) })) };
        const sis = out.holes.map(h => h.si).sort((a, b) => a - b).join(',');
        if (!out.name) return toast('Donnez un nom au terrain.');
        if (out.holes.some(h => !(h.par >= 3 && h.par <= 6))) return toast('Chaque normale doit être entre 3 et 6.');
        if (sis !== Array.from({ length: 18 }, (_, i) => i + 1).join(',')) return toast('Les handicaps doivent utiliser 1 à 18, une fois chacun.');
        if (!out.tees.length || out.tees.some(t => !(t.rating > 50 && t.rating < 90) || !(t.slope >= 55 && t.slope <= 155))) return toast('Vérifiez l\'évaluation (ex. 70,7) et le slope (55 à 155) des tertres.');
        if (proposition) {
          try { await Store.decideProposal(proposition.id, true, out, (P.todo.find(x => x.id === proposition.id) || {}).photos); P.todo = P.todo.filter(p => p.id !== proposition.id); S.courses = await Store.listCourses(); toast('Terrain approuvé : il est dans la banque.'); go('courses', { editCourse: null }); chargerPropositions(); }
          catch (e) { toast('Approbation impossible : ' + e.message); }
          return;
        }
        if (!c.id && !P.admin) {
          const g = curGroup(), moi = (S.players.find(p => p.id === meId()) || {}).name || ls.get('pelland.me', '') || '';
          const photos = await photosPourVerif(S.cardImgs || []);
          try { const p = await Store.proposeCourse({ ...out, ...(web ? { web } : {}) }, { proposePar: moi, groupeNom: g.name || '', ...(photos.length ? { photos } : {}) }); P.mine.push(p); toast('Envoyé pour approbation. Merci !'); go(S.draft ? 'setup' : 'courses', { editCourse: null }); }
          catch (e) { toast('Envoi impossible : ' + e.message); }
          return;
        }
        try { await Store.saveCourse(out); S.courses = await Store.listCourses(); toast(web ? 'Terrain approuvé et ajouté à la banque.' : 'Terrain enregistré.'); go(S.draft ? 'setup' : 'courses', { editCourse: null }); }
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
      if ($('#course')) $('#course').onchange = e => { d.courseId = e.target.value; render(); };
      v.querySelectorAll('[data-sgroups]').forEach(b => b.onclick = async () => {
        const [oid, dt] = d.offre.split('|'), o = (S.offres || []).find(x => x.id === oid); if (!o) return;
        await autoQuatuorsSheet(o, +dt, g => {
          d.players.forEach((p, i) => { p.name = g[i] || ''; p.custom = false; });
          const me = L.norm(ls.get('pelland.me', '') || ''), r = g.findIndex(n => L.norm(n) === me); if (r >= 0) d.responsable = r;
          render(); toast('Groupe choisi : entrez les index.');
        });
        if (b.dataset.sgroups === 'hasard') { const h = document.querySelector('#sheet [data-gmode="hasard"]'); if (h) h.click(); }
      });
      v.querySelectorAll('[data-src]').forEach(b => b.onclick = () => { d.src = b.dataset.src; if (d.src === 'libre') d.offre = null; render(); });
      const op = $('#offPick'); if (op) op.onchange = e => { d.offre = e.target.value || null;
        if (d.offre) { const x = offreDates().find(y => y.key === d.offre), ok = (x ? x.names : []).map(L.norm); d.players.forEach(p => { if (p.name && !ok.includes(L.norm(p.name))) { p.name = ''; p.custom = false; } }); }
        render(); };
      const qp = $('#quatPick'); if (qp) qp.onchange = e => { const x = S.quatuors.find(q => q.id === e.target.value); if (!x) return;
        const nd = draftFromQuatuor(x); nd.courseId = d.courseId; nd.mode = d.mode; nd.stake = d.stake; nd.leadChangeValue = d.leadChangeValue; nd.perPoint = d.perPoint; nd.par3Value = d.par3Value; S.draft = nd; render(); };
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
      v.querySelectorAll('[data-game]').forEach(b => b.onclick = () => { const was = d.format; d.format = b.dataset.game; const jj = jeuOf(d.format); if (jj && jj.pp) d.perPoint = String(jj.pp);
        // Vegas : les points montent vite, on propose 0,25 $ le point (sauf si un montant a déjà été choisi)
        if (d.format === 'vegas' && was !== 'vegas' && (d.perPoint === '1' || !d.perPoint)) d.perPoint = '0.25'; else if (was === 'vegas' && d.format !== 'vegas' && d.perPoint === '0.25') d.perPoint = '1';
        if (d.format === 'match' && was !== 'match' && (d.perPoint === '1' || !d.perPoint)) d.perPoint = '10'; else if (was === 'match' && d.format !== 'match' && d.perPoint === '10') d.perPoint = '1';
        render(); });
      v.querySelectorAll('[data-holes]').forEach(b => b.onclick = () => { d.holes = b.dataset.holes; render(); });
      v.querySelectorAll('[data-count]').forEach(b => b.onclick = () => {
        const n = +b.dataset.count; if (n === (d.count || 4)) return;
        d.count = n;
        if (n === 3) d.players = d.players.slice(0, 3); else while (d.players.length < 4) d.players.push({ name: '', index: '', tee: d.players[0].tee });
        if (d.responsable >= n) d.responsable = 0; render();
      });
      ['stake', 'lcv', 'ppt', 'p3v'].forEach(id => { const el = $('#' + id), key = { stake: 'stake', lcv: 'leadChangeValue', ppt: 'perPoint', p3v: 'par3Value' }[id]; if (!el) return;
        el.oninput = e => { d[key] = e.target.value; };
        el.onblur = e => { e.target.value = fmtIn(e.target.value); d[key] = e.target.value; };
        el.onfocus = e => { e.target.select(); }; });
      v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { d.mode = b.dataset.mode; v.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); refresh(); });
      $('#create').onclick = async () => {
        const pv = draftPreview(d);
        if (!pv || !pv.ready) { const m = 'Il manque ' + missingList(d).slice(0, 2).join(' et ') + '.'; toast(m); setReply(m); Voice.say(m); return; }
        syncCount(d); const fmtG = gamesFor(d.count).includes(d.format) ? d.format : gamesFor(d.count)[0], jeu = jeuOf(fmtG), neuf = !teamGame(fmtG, d.count), rIdx = filledIdx(d).indexOf(d.responsable);
        if (!neuf && !d.teamMode) { toast('Choisissez la formation des équipes (étape Équipes).'); return; }
        const names = pv.ps.map(p => L.norm(p.name));
        if (new Set(names).size < names.length) return toast('Le même joueur est choisi deux fois.');
        ls.set('pelland.lastPlayers', d.players);
        const id = await Store.newCode();
        const g = { id, createdAt: Date.now(), ownerUid: Store.uid, course: pv.c, courseId: pv.c.id, mode: d.mode, responsable: rIdx >= 0 ? rIdx : 0,
          format: jeu ? 'perso' : fmtG, custom: jeu ? JSON.parse(JSON.stringify(jeu)) : null, players: pv.ps, teams: neuf ? null : draftTeams(d, pv.ps), teamMode: neuf ? null : d.teamMode, stake: money(d.stake), leadChangeValue: money(d.leadChangeValue), perPoint: String(d.perPoint || '').trim() === '' ? 1 : money(d.perPoint), par3Value: String(d.par3Value ?? '').trim() === '' ? 5 : money(d.par3Value), currentHole: d.holes === 'back' ? 10 : 1, firstHole: d.holes === 'back' ? 10 : 1, lastHole: d.holes === 'front' ? 9 : 18, scores: {}, events: {}, status: 'en cours' };
        try {
          await Store.saveGame(g); markStep('partie');
          // Responsable choisi = un autre joueur que moi : la partie lui est confiée (il la prend en l'ouvrant)
          const mi = myIdx(g); if (Store.uid && g.responsable !== mi) { g.ownerUid = ''; await Store.saveGame(g); }
          S.draft = null; openGame(id); toast(g.ownerUid ? 'Partie créée.' : `Partie créée : ${g.players[g.responsable].name} est le responsable.`);
          const inGame = new Set(g.players.map(p => L.norm(p.name)));
          Push.notify({ title: 'La partie commence', body: `${g.course.name} : suivez-la en direct, trou par trou.`, url: './?partie=' + id, tag: 'partie-' + id, playerIds: (S.players || []).filter(p => inGame.has(L.norm(p.name))).map(p => p.id) });
        }
        catch (e) { toast('Création impossible : ' + e.message); }
      };
    },
    game(v) {
      if (!S.game) return;
      // Désigné responsable par l'ancien responsable : on prend la partie à son compte dès l'ouverture
      // Je suis responsable mais l'étoile est sur un autre joueur (parties créées avant la correction) : on la remet sur moi
      if (S.game.ownerUid === Store.uid && !S.claiming) { const mi = myIdx(S.game); if (mi >= 0 && mi !== S.game.responsable) { S.claiming = true; const ng = JSON.parse(JSON.stringify(S.game)); ng.responsable = mi; S.game = ng; Store.saveGame(ng).catch(() => { }).finally(() => { S.claiming = false; }); setTimeout(render, 0); } }
      if (S.game.ownerUid !== Store.uid && isOwner() && Store.uid && !S.claiming) { S.claiming = true; const ng = JSON.parse(JSON.stringify(S.game)); ng.ownerUid = Store.uid; S.game = ng; Store.saveGame(ng).catch(() => { }).finally(() => { S.claiming = false; }); }
      v.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
        const [h0, h1] = L.holeRange(S.game), h = Math.min(h1, Math.max(h0, (S.game.currentHole || 1) + +b.dataset.nav));
        if (isOwner()) commit([{ type: 'goto', hole: h }], false); else { S.game.currentHole = h; render(); }
      });
      v.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const [h] = b.dataset.cell.split(':').map(Number); allScoresSheet(h); });
      v.querySelectorAll('[data-allscores]').forEach(b => b.onclick = () => allScoresSheet(+b.dataset.allscores));
      const ac = v.querySelector('[data-askclaim]'); if (ac) ac.onclick = () => { S.confirmClaim = S.game.id; render(); };
      const cc = v.querySelector('[data-cancelclaim]'); if (cc) cc.onclick = () => { S.confirmClaim = null; render(); };
      const cl = v.querySelector('[data-claim]'); if (cl) cl.onclick = async () => {
        const ng = JSON.parse(JSON.stringify(S.game)); ng.ownerUid = Store.uid; const mi = myIdx(ng); if (mi >= 0) ng.responsable = mi;
        try { await Store.saveGame(ng); S.game = ng; S.confirmClaim = null; toast('Vous êtes maintenant le responsable de cette partie.'); render(); }
        catch (e) { toast('Impossible pour l’instant. (' + e.message + ')'); }
      };
      v.querySelectorAll('[data-editmoney]').forEach(em => em.onclick = ev => {
        if (ev && ev.target.closest && ev.target.closest('[data-info]')) return;
        const g = S.game, f = L.formatOf(g), c = g.custom || {};
        const inp = (id, label, val, ph) => `<label style="flex:1">${label}<span class="money-in"><input id="${id}" type="text" inputmode="decimal" placeholder="${ph}" value="${esc(val == null || val === '' ? '' : fmtIn(val))}"><i>$</i></span></label>`;
        const ppLabel = f === 'pelland' ? 'Par point net' : (f === 'perso' ? 'Par point' : ({ neuf: 'Par point', bestball: 'Par trou gagné', match: 'Pour la partie', nassau: 'Par pari', vegas: 'Par point', wolf: 'Par point', sixes: 'Par tranche gagnée', skins: 'Par skin' })[f] || 'Par point');
        const fields = f === 'pelland'
          ? `<div class="row" style="flex-wrap:nowrap">${inp('emStake', 'La game commence à', g.stake, '0')}${inp('emLcv', 'À chaque revirement', g.leadChangeValue, '0')}</div><div class="row" style="flex-wrap:nowrap">${inp('emPp', ppLabel, g.perPoint, '1')}${inp('emP3', 'Chaque normale 3', g.par3Value == null ? 5 : g.par3Value, '5')}</div>`
          : `<div class="row" style="flex-wrap:nowrap">${inp('emPp', ppLabel, g.perPoint, '1')}${f === 'perso' && c.mode === 'equipes' ? inp('emCs', 'Mise à l’équipe qui mène', c.stake, '0') : '<span style="flex:1"></span>'}</div>`;
        openSheet(`<h3>Modifier les montants</h3>${fields}<p class="note">Tous les montants sont par joueur. Les gains sont recalculés pour toute la partie, y compris les trous déjà joués.</p>
          <div class="row"><button class="btn small" id="emSave" type="button">Enregistrer</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelector('#emSave').onclick = async () => {
            const val = (id, def) => { const el = sh.querySelector('#' + id); if (!el) return undefined; return String(el.value).trim() === '' ? def : money(el.value); };
            const ng = JSON.parse(JSON.stringify(S.game));
            if (f === 'pelland') { ng.stake = val('emStake', 0); ng.leadChangeValue = val('emLcv', 0); ng.par3Value = val('emP3', 5); }
            ng.perPoint = val('emPp', 1);
            if (sh.querySelector('#emCs')) { ng.custom = { ...(ng.custom || {}), stake: val('emCs', 0) }; }
            try { await Store.saveGame(ng); S.game = ng; closeSheet(); toast('Montants modifiés.'); render(); } catch (e) { toast('Impossible : ' + e.message); }
          };
        });
      });
      const ho = v.querySelector('[data-handoff]'); if (ho) ho.onclick = () => {
        const g = S.game, cur = g.responsable;
        openSheet(`<h3>Changer de responsable</h3><p class="note">Le responsable entre les scores, termine ou efface la partie. Choisissez qui prend la relève :</p>
          <div class="list">${g.players.map((p, i) => i === cur ? '' : `<button class="item" data-newresp="${i}" type="button"><b>${esc(p.name)}</b><span>Il ouvre la partie sur son téléphone et continue là où vous êtes.</span></button>`).join('')}</div>
          <div class="row"><button class="btn ghost small" data-close type="button">Annuler</button></div>`, sh => {
          sh.querySelector('[data-close]').onclick = closeSheet;
          sh.querySelectorAll('[data-newresp]').forEach(b => b.onclick = async () => {
            const i = +b.dataset.newresp, ng = JSON.parse(JSON.stringify(S.game)); ng.responsable = i; ng.ownerUid = '';
            try { await Store.saveGame(ng); S.game = ng; closeSheet(); toast(`${ng.players[i].name} est maintenant responsable de la partie.`); render(); }
            catch (e) { toast('Impossible : ' + e.message); }
          });
        });
      };
      const inv = v.querySelector('[data-invite]'); if (inv) inv.onclick = () => invitePlayers(S.game);
      const fin = v.querySelector('[data-finish]'); if (fin) fin.onclick = async () => {
        const ng = JSON.parse(JSON.stringify(S.game)); ng.status = 'terminée'; ng.finishedAt = Date.now();
        try {
          await Store.saveGame(ng); S.game = ng; toast('Partie terminée : elle est dans Parties jouées.'); ls.set('pelland.lastGame', null);
          Push.notify({ title: 'Résultats de la partie', body: `${ng.course.name} : voyez les points et qui doit quoi.`, url: './?partie=' + ng.id, tag: 'partie-' + ng.id });
          go('home');
        } catch (e) { toast('Impossible de terminer : ' + e.message); }
      };
      const reo = v.querySelector('[data-reopen]'); if (reo) reo.onclick = async () => { const ng = JSON.parse(JSON.stringify(S.game)); ng.status = 'en cours'; delete ng.finishedAt; S.game = ng; render(); await Store.saveGame(ng); };
      const ask = v.querySelector('[data-askdelthis]'); if (ask) ask.onclick = () => { S.confirmDelGame = S.game.id; render(); };
      const can = v.querySelector('[data-canceldelgame]'); if (can) can.onclick = () => { S.confirmDelGame = null; render(); };
      const del = v.querySelector('[data-delthis]'); if (del) del.onclick = async () => {
        const id = S.game.id;
        try { if (S.unwatch) { S.unwatch(); S.unwatch = null; } await removeGame(id); S.confirmDelGame = null; go('home'); } catch (e) { toast('Effacement impossible : ' + e.message); }
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
      v.querySelectorAll('[data-hole]').forEach(b => b.onclick = () => { const h = +b.dataset.hole; if (isOwner() && isAlt(S.game)) commit([{ type: 'goto', hole: h }], false); else if (isOwner()) holeSheet(h); else { S.game.currentHole = h; render(); } });
    },
  });
  // ==== src/golf/actions-partie.js ====

  // Invitation : lien direct vers la partie, envoyé avec le menu Partager de l'iPhone
  function inviteLink(g) { return location.origin + location.pathname + '?partie=' + encodeURIComponent(g.id); } // sans « cadre »
  async function invitePlayers(g) {
    const url = inviteLink(g);
    const others = g.players.filter((p, i) => i !== g.responsable).map(p => p.name.split(' ')[0]).join(', ');
    const text = `Salut ${others} ! Suis la partie en direct (${g.course.name.replace(/^Club de golf /i, '')}) : `;
    if (navigator.share) {
      try { await navigator.share({ title: APP, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
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
    // message court : affiché en haut de la carte du trou, sur le dernier trou enregistré (pas en bulle par-dessus)
    const sc = actions.find(a => a.type === 'scores' || a.type === 'skin');
    if (sc && !undo && isAlt(next)) {
      const r = L.altHoles(next)[sc.hole];
      say = r ? `Trou ${sc.hole} · ${r.desc}` : `Trou ${sc.hole} enregistré`;
    } else if (sc && !undo) {
      const hh = sc.hole, parts = [];
      const nt = L.holeNetText(next, hh); if (nt) parts.push(`Trou ${hh} · ${nt}`); else parts.push(`Trou ${hh} enregistré`);
      if (L.cabaneTeam(next, hh) != null) parts.push('Cabane !');
      const p3 = L.describePar3(next, hh); if (p3) parts.push(p3.replace(/\.$/, ''));
      parts.push(L.totalText(next).replace(/\.$/, ''));
      say = parts.join(' · ');
    }
    const pr = isAlt(next) ? null : L.nextPrompt(next);
    S.pending = pr;
    if (sc && !undo) S.lastSaved = { gid: next.id, hole: sc.hole, text: say };
    render();
    if (!(sc && !undo)) setReply(say);
    if (speak) Voice.say(say);
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
  // ==== src/commun/feuilles.js ====
  // ---------------- Feuilles (saisie manuelle) ----------------
  function openSheet(html, bindFn) {
    const w = $('#sheetWrap'), s = $('#sheet');
    s.innerHTML = html; w.hidden = false;
    w.onclick = e => { if (e.target === w) closeSheet(); };
    bindFn(s);
  }
  function closeSheet() { $('#sheetWrap').hidden = true; }
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
    const body = `Salut ${name.split(' ')[0]} ! Tu as été invité à te joindre au groupe « ${groupName()} » sur ${APP}, ${MARQUE.description}. Ouvre l’app : ${url} — ton nom est déjà choisi. La première fois, crée ton compte avec ton cellulaire (${fmtPhone(d)}) : tu reçois un code par texto, puis tu choisis un mot de passe. Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».`;
    openSms([d], body);
  }
  // ==== src/golf/neuf-points.js ====
  // ---------------- Le 9 points (3 joueurs) ----------------
  const isAlt = g => !!g && L.formatOf(g) !== 'pelland';
  const fmtPts = x => String(Math.round(x * 10) / 10).replace('.', ',').replace('-', '−');
  const neufPP = g => g.perPoint == null || g.perPoint === '' ? 1 : money(g.perPoint);
  // Gain de chacun : différence de points avec chaque autre joueur × $ par point
  function neufGains(g) { return L.altGains(g, neufPP(g)); }
  const ptsLabel = g => ({ neuf: 'pts', skins: 'skins', bestball: 'trous', match: 'trous', nassau: 'trous', sixes: 'trous', wolf: 'pts' })[L.formatOf(g)] || 'pts';
  function persoLines(c) {
    c = c || {}; const L2 = [];
    if (c.mode === 'equipes') {
      L2.push('Équipes de deux (Rouges et Bleus).');
      if (+c.low) L2.push(`Plus bas net : ${+c.low} point${+c.low > 1 ? 's' : ''} à son équipe.`);
      if (+c.high) L2.push(`Plus haut net : ${+c.high} point${+c.high > 1 ? 's' : ''} à l’équipe adverse.`);
      if (+c.team) L2.push(`Meilleur total des deux nets : ${+c.team} point${+c.team > 1 ? 's' : ''}.`);
      if (+c.birdie) L2.push(`Chaque oiselet (brut) : ${+c.birdie} point${+c.birdie > 1 ? 's' : ''} à l’équipe.`);
      L2.push('Par trou, seule la différence entre les équipes compte. Égalité : pas de points.');
    } else {
      L2.push('Chacun pour soi.');
      if (String(c.ranks || '').trim()) L2.push(`Points par rang au net (1er, 2e, 3e…) : ${c.ranks}. Égalités partagées.`);
      if (+c.birdie) L2.push(`Chaque oiselet (brut) : ${+c.birdie} point${+c.birdie > 1 ? 's' : ''}.`);
      if (+c.skin) L2.push(`Skin (seul meilleur net) : ${+c.skin} point${+c.skin > 1 ? 's' : ''}, reporté en cas d’égalité.`);
    }
    return L2;
  }
  function ruleText(g) {
    if (L.formatOf(g) === 'perso') return persoLines(g.custom).join(' ');
    return ({ neuf: 'Le 9 points : 5 points au meilleur net, 3 au 2e, 1 au 3e ; égalités partagées.',
      bestball: 'Best Ball : le meilleur net de chaque équipe ; le trou gagné vaut 1 point.',
      match: 'Match play : un contre un, au net ; le plus bas score gagne le trou. Le match finit dès que l’avance dépasse les trous qui restent (« gagne 3 et 2 »). Un seul enjeu, pour la partie.',
      vegas: 'Vegas : les deux nets de l’équipe forment un nombre, le plus bas d’abord (4 et 5 = 45) ; un oiselet renverse le nombre de l’autre équipe ; l’écart donne les points.',
      nassau: 'Nassau : trois paris en Best Ball, l’aller, le retour et le total ; l’équipe qui gagne le plus de trous gagne le pari.',
      sixes: 'Sixes : les équipes changent à chaque tiers de la partie (6 trous sur 18, 3 sur 9) ; meilleur net de l’équipe, 1 point par trou ; l’équipe qui gagne le plus de trous gagne la tranche.',
      wolf: 'Wolf : le loup tourne à chaque trou. Avec un partenaire : 1 point chacun au gagnant ; seul : 2 points par adversaire ; seul à l’aveugle : 3 points.',
      skins: 'Skins : le seul meilleur net gagne le skin ; à égalité, il est reporté au trou suivant.' })[L.formatOf(g)] || '';
  }
  function gainRule(g) {
    const pp = fmt$(neufPP(g));
    if (L.formatOf(g) === 'perso') { const c = g.custom || {}; return c.mode === 'equipes' ? `Gain par joueur = écart de points × ${pp}${+c.stake ? ` + ${fmt$(+c.stake)} à l’équipe qui mène` : ''}` : `Gain = différence de points avec chaque autre joueur × ${pp}`; }
    return ({ neuf: `Gain = différence de points avec chaque autre joueur × ${pp}`, bestball: `Gain = écart de trous gagnés × ${pp} par joueur`, match: `Gain = ${pp} pour le gagnant du match (match nul : rien)`, vegas: `Gain = écart de points × ${pp} par joueur`, nassau: `Gain = ${pp} par pari gagné (perdu : −${pp}), par joueur` + nassauText(g),
      sixes: `Gain = ${pp} par tranche gagnée (perdue : −${pp})`, wolf: `Gain = points × ${pp}`, skins: `Gain = skins gagnés × ${pp} payé par chaque autre joueur` })[L.formatOf(g)] || '';
  }
  // État des paris du Nassau : « L’aller : Rouges +2 · Le retour : égal »
  function nassauText(g) {
    if (!g.scores || !g.players || g.players.length !== 4) return '';
    const T = L.getTeams(g), b = L.nassauBets(g); if (!b.length) return '';
    return '. ' + b.map(x => { const v = x.pts[T[0][0]]; return `${x.name} : ${v === 0 ? 'égal' : `${L.TEAMS[v > 0 ? 0 : 1]} +${Math.abs(v)}`}${x.done ? (v ? ' (gagné)' : '') : ''}`; }).join(' · ');
  }
  // Texte court sous chaque trou de la carte
  function altShort(g, r, ini) {
    const f = L.formatOf(g);
    if (!r) return '';
    if (f === 'neuf' || (f === 'perso' && (g.custom || {}).mode !== 'equipes')) return g.players.map((p, i) => `${ini[i]} ${fmtPts(r.pts[i])}`).join(' · ');
    if (!r.pts) return 'Loup : décision ?';
    if (f === 'match') { const st = L.matchStatus(g); if (st.decidedAt && r.hole > st.decidedAt) return 'Match déjà fini'; }
    if (f === 'vegas' && r.vegas) return `${r.vegas[0]} – ${r.vegas[1]} · ` + (r.win.length ? `${r.win.map(i => ini[i]).join('+')} +${Math.abs(r.pts[r.win[0]])}` : 'Égalité');
    if (f === 'skins') return r.win.length ? `Skin ${ini[r.win[0]]}${r.units > 1 ? ' ×' + r.units : ''}` : `Report (${r.carry})`;
    const pre = f === 'wolf' && r.wolf ? `Loup ${ini[L.wolfOf(g, r.hole || 1)]}${r.wolf.partner == null ? (r.wolf.blind ? ' seul aveugle' : ' seul') : ''} · ` : '';
    return pre + (r.win.length ? `${r.win.map(i => ini[i]).join('+')} gagne${r.win.length > 1 ? 'nt' : ''}` : 'Égalité');
  }
  function smsSummaryNeuf(g) {
    const t = L.altTotals(g), gn = neufGains(g), done = g.status === 'terminée', f = L.formatOf(g);
    const played = Object.keys(g.scores || {}).filter(x => (g.scores[x] || []).some(v => v != null)).map(Number), last = played.length ? Math.max(...played) : 0;
    const date = new Date(g.createdAt || Date.now()).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const rank = g.players.map((p, i) => i).sort((a, b) => gn[b] - gn[a]);
    return [`${groupName()} – ${gameName(g)} – ${g.course.name.replace(/^Club de golf /i, '')}, ${date}`, done ? 'Résultat final :' : last ? `Après ${last} trou${last > 1 ? 's' : ''} :` : 'La partie commence.',
      ...(last ? rank.map((i, r) => `${r + 1}. ${g.players[i].name} : ${fmtPts(t[i])} ${ptsLabel(g)} (${gn[i] >= 0 ? '+' : '−'}${fmt$(Math.abs(gn[i]))})`) : g.players.map(p => p.name)), inviteLink(g)].join('\n');
  }
  // Bandeau « Score enregistré » : toujours en haut de la carte, pour le dernier trou terminé (tous les scores entrés)
  function lastDoneHole(g) {
    let last = 0; const [a, b] = [g.firstHole || 1, g.lastHole || 18];
    for (let x = a; x <= b; x++) if (g.players.every((p, pi) => L.getScore(g, x, pi) != null)) last = x;
    return last;
  }
  function savedBand(g) {
    if (g.status === 'terminée') return '';
    const ls0 = S.lastSaved && S.lastSaved.gid === g.id ? S.lastSaved : null;
    const h = ls0 && g.players.every((p, pi) => L.getScore(g, ls0.hole, pi) != null) ? ls0.hole : lastDoneHole(g);
    if (!h) return '';
    let t = ls0 && ls0.hole === h && L.formatOf(g) !== 'match' ? ls0.text : '';
    if (!t) {
      if (isAlt(g)) { const r = L.altHoles(g)[h]; t = r ? `Trou ${h} · ${r.desc}` : ''; if (L.formatOf(g) === 'match') { const st = L.matchStatus(g); t += ' · ' + (st.winner >= 0 ? g.players[st.winner].name.split(' ')[0] + ' ' : '') + st.text; } }
      else { const nt = L.holeNetText(g, h); t = [nt ? `Trou ${h} · ${nt}` : '', L.totalText(g).replace(/\.$/, '')].filter(Boolean).join(' · '); }
    }
    t = t.replace(new RegExp('^Trou ' + h + ' · '), '');
    return `<button type="button" class="saved-band" data-detail="${h}"><span class="sb-ok" aria-hidden="true">✓</span><span><b>Score enregistré · trou ${h}</b>${t ? `<small>${esc(t)}</small>` : ''}</span><span class="sb-go" aria-hidden="true">›</span></button>`;
  }
  function holeDetailNeuf(g, h) {
    const ih = L.holeInfo(g, h, 0), r = L.altHoles(g)[h], f = L.formatOf(g);
    const rows = g.players.map((p, i) => { const s = L.getScore(g, h, i), k = L.strokesOnHole(p.strokes, ih.si);
      return `<tr><td>${esc(p.name)}</td><td>${s == null ? '—' : s}</td><td>${k > 0 ? BALL.repeat(k) : '—'}</td><td><b>${s == null ? '—' : s - k}</b></td><td><b>${r && r.pts ? (r.pts[i] > 0 && f !== 'neuf' ? '+' : '') + fmtPts(r.pts[i]) : '—'}</b></td></tr>`; }).join('');
    openSheet(`<h3>Trou ${h}</h3><p class="note" style="margin-top:-8px">Normale ${ih.par} · Handicap ${ih.si} · ${esc(gameName(g))}</p>
      <table class="detail-t"><thead><tr><th>Joueur</th><th>Brut</th><th>Coups</th><th>Net</th><th>Points</th></tr></thead><tbody>${rows}</tbody></table>
      ${r ? `<p class="detail-desc">${esc(r.desc)}</p>` : ''}<p class="note">${esc(ruleText(g))}</p>
      <div class="sheet-actions"><button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; });
  }
  function vGameNeuf(g) {
    const h = g.currentHole || 1, hi = L.holeInfo(g, h, 0), owner = isOwner();
    const f = L.formatOf(g), fname = gameName(g), AH = L.altHoles(g);
    const tots = g.players.map((p, i) => L.totals(g, i)), pts = L.altTotals(g), gn = neufGains(g), ini = L.initials(g.players);
    const wolfNow = f === 'wolf' ? L.wolfOf(g, h) : -1;
    const sixT = f === 'sixes' ? L.sixesTeams(h, g) : (f === 'bestball' || f === 'match' || f === 'nassau' || f === 'vegas') ? L.getTeams(g) : null;
    const dots = k => k > 0 ? BALL.repeat(k) : '';
    const ph = g.players.map((p, pi) => { const k = L.strokesOnHole(p.strokes, hi.si);
      return `<${owner ? `button type="button" data-allscores="${h}"` : 'div'} class="hp"><div class="nm">${esc(p.name)}${g.responsable === pi ? ' ★' : ''}${pi === wolfNow ? ' <span class="wolf-tag">Loup</span>' : ''}</div><div class="hp-idx">Index ${String(p.index).replace('.', ',')}${sixT && g.players.length > 2 ? ` · <span class="pair">${sixT[0].includes(pi) ? 'Équipe A' : 'Équipe B'}</span>` : ''}</div><div class="dots">${k ? dots(k) : ''}</div><div class="hp-strk">${strokeHoles(g, p)}</div><div class="hp-tot">${tots[pi].played ? `<span>Brut <b>${tots[pi].gross}</b> · Net <b>${tots[pi].net}</b></span><span class="hp-n">${tots[pi].played} trou${tots[pi].played > 1 ? 's' : ''}</span>` : 'Aucun trou joué'}</div><div class="hp-pts"><b>${(pts[pi] > 0 && f !== 'neuf' ? '+' : '') + fmtPts(pts[pi])}</b> ${ptsLabel(g)}</div></${owner ? 'button' : 'div'}>`; });
    const rank = g.players.map((p, i) => i).sort((a, b) => gn[b] - gn[a] || pts[b] - pts[a]);
    const mst = f === 'match' ? L.matchStatus(g) : null;
    const leader = mst ? `<div class="leader-box neuf match-box"><span>Match play ${info('jeu-' + f)}</span>
        <div class="mp-status ${mst.decidedAt || mst.done ? 'fini' : ''}"><b>${mst.winner >= 0 && (mst.decidedAt || mst.done) ? esc(g.players[mst.winner].name) + ' ' : mst.winner >= 0 ? esc(g.players[mst.winner].name.split(' ')[0]) + ' : ' : ''}${esc(mst.text)}</b>
        ${(mst.decidedAt || mst.done) && mst.winner >= 0 ? `<small>Empoche ${fmt$(money(g.perPoint))}</small>` : (mst.decidedAt || mst.done) ? '<small>Personne ne paie.</small>' : `<small>Enjeu de la partie : ${fmt$(money(g.perPoint))}</small>`}</div>
        ${mst.decidedAt && mst.decidedAt < (g.lastHole || 18) && g.status !== 'terminée' && owner ? '<button class="btn small" data-finish type="button">Le match est fini : terminer la partie</button>' : ''}</div>`
      : `<div class="leader-box neuf"><span>Classement · ${esc(fname)} ${info('jeu-' + f)}</span>${rank.map((i, r) => `<div class="nf-r"><b>${r + 1}. ${esc(g.players[i].name)}</b><small>${(pts[i] > 0 && f !== 'neuf' ? '+' : '') + fmtPts(pts[i])} ${ptsLabel(g)}</small><em class="${gn[i] > 0 ? 'pos' : gn[i] < 0 ? 'neg' : ''}">${gn[i] > 0 ? '+' : gn[i] < 0 ? '−' : ''}${fmt$(Math.abs(gn[i]))}</em></div>`).join('')}<div class="lb-detail"><span>${esc(gainRule(g))}</span></div></div>`;
    const row = hole => { const ih = L.holeInfo(g, hole, 0), r = AH[hole] ? { ...AH[hole], hole } : null;
      const cells = g.players.map((p, pi) => { const s = L.getScore(g, hole, pi), k = L.strokesOnHole(p.strokes, ih.si), par = L.holeInfo(g, hole, pi).par;
        const cls = s == null ? '' : (s - k < par ? 'birdie' : s - k > par ? 'bogey' : '');
        return `<td class="pc"><button class="cell ${cls}" data-cell="${hole}:${pi}" ${owner ? '' : 'disabled'}><span>${s == null ? '' : s}</span>${k ? `<i class="d">${dots(k)}</i>` : ''}${s != null && k ? `<i class="nt">${s - k}</i>` : ''}</button></td>`; }).join('');
      const sub = r ? `<tr class="calc-row ${hole === h ? 'cur' : ''}" data-detail="${hole}"><td colspan="3"></td><td colspan="${g.players.length}">${esc(altShort(g, r, ini))}</td></tr>` : '';
      return `<tr class="${hole === h ? 'cur' : ''} ${sub ? 'has-sub' : ''}"><th class="h"><button class="cell" data-hole="${hole}" style="font-size:19px">${hole}</button></th><td class="m">${ih.par}</td><td class="m">${ih.si}</td>${cells}</tr>${sub}`; };
    const sumRow = (label, from, to) => { let par = 0; for (let x = from; x <= to; x++) par += L.holeInfo(g, x, 0).par;
      return `<tr class="sum"><td colspan="2">${label}</td><td>${par}</td>${g.players.map((p, pi) => { let s = 0, any = false; for (let x = from; x <= to; x++) { const v = L.getScore(g, x, pi); if (v != null) { s += v; any = true; } } return `<td>${any ? s : ''}</td>`; }).join('')}</tr>`; };
    return `${presenceHtml(g)}
      <section class="hole-card" aria-live="polite">
        ${savedBand(g)}
        <div class="hole-top"><div class="hole-no">${h}</div><div class="hole-meta">Normale <b>${hi.par}</b> · Handicap <b>${hi.si}</b> · <b>${esc(fname)}</b>${f === 'wolf' ? ` · Loup : <b>${esc(g.players[wolfNow].name.split(' ')[0])}</b>` : ''}${f === 'sixes' ? ` · <b>${sixT[0].map(i => esc(g.players[i].name.split(' ')[0])).join(' + ')}</b> contre <b>${sixT[1].map(i => esc(g.players[i].name.split(' ')[0])).join(' + ')}</b>` : ''}</div>
          <div class="hole-nav"><button data-nav="-1" aria-label="Trou précédent">‹</button><button data-nav="1" aria-label="Trou suivant">›</button></div></div>
        ${respActions(g, owner, false)}
        <div class="team-blocks"><div class="team-block neuf"><div class="tb-grid two">${ph.join('')}</div></div></div>
      </section>
      ${leader}
      ${handoffBtn(g, owner)}
      <div class="card-scroll"><table class="sc neuf">
        <thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${g.players.map((p, i) => `<th class="pc" title="${esc(p.name)}">${esc(ini[i])}</th>`).join('')}</tr></thead>
        <tbody>${scoreRows(g, row, sumRow)}
        <tr class="sum"><td colspan="3">${f === 'skins' ? 'Skins' : f === 'neuf' || f === 'wolf' || f === 'vegas' ? 'Points' : 'Trous'}</td>${pts.map(x => `<td>${(x > 0 && f !== 'neuf' ? '+' : '') + fmtPts(x)}</td>`).join('')}</tr></tbody>
      </table></div>
      <button class="btn sms-btn" data-sms type="button">Texto aux joueurs</button>
      ${g.status === 'terminée' ? avisCard('game') + viralCard('game') : ''}
      ${owner ? `<div class="row game-actions bottom-actions">${g.status === 'terminée'
        ? '<span class="note">Partie terminée.</span><button class="btn ghost small" data-reopen type="button">Rouvrir</button>'
        : '<button class="btn small" data-finish type="button">Terminer la partie</button>'}
        ${S.confirmDelGame === g.id
          ? '<button class="btn small" data-delthis type="button" style="background:var(--red)">Confirmer l\'effacement</button><button class="btn ghost small" data-canceldelgame type="button">Annuler</button>'
          : '<button class="btn ghost small" data-askdelthis type="button">Effacer la partie</button>'}</div>` : ''}
      <div class="legend"><span>★ responsable de la partie (il entre les scores)</span><span>${BALL} coup reçu · petit chiffre = net</span><span>${esc(ruleText(g))} Touchez la ligne sous un trou pour le détail.</span><span>${g.players.map((p, i) => `<b>${esc(ini[i])}</b> ${esc(p.name)}`).join(' · ')}</span></div>`;
  }
  // ==== src/golf/presences.js ====
  // ---------------- Présences ----------------
  function myIndex(g) { const me = L.norm(ls.get('pelland.me', '') || ''); return g.players.findIndex(p => L.norm(p.name) === me); }
  function presenceHtml(g) {
    const pr = S.presence || {}, started = Object.values(g.scores || {}).some(r => (r || []).some(v => v != null));
    if (started || g.status === 'terminée') return '';
    const mi = myIndex(g), mine = mi >= 0 ? pr[presKey(g.players[mi].name)] : null;
    const order = isAlt(g) ? g.players.map((_, i) => i) : [...L.getTeams(g)[1], ...L.getTeams(g)[0]];
    const n = order.filter(i => (pr[presKey(g.players[i].name)] || {}).ok === true).length;
    return `<section class="card presence"><h2>Présences <small>${n}/${g.players.length} confirmés</small></h2>
      <div class="pres-list">${order.map(i => { const x = pr[presKey(g.players[i].name)];
        const st = !x ? ['?', 'En attente', 'wait'] : x.ok ? ['✓', 'Présent', 'yes'] : ['✗', 'Absent', 'no'];
        return `<div class="pres ${st[2]}"><b>${st[0]}</b><span class="${isAlt(g) ? '' : 'tc' + teamOf(g, i)}">${esc(g.players[i].name)}</span><small>${st[1]}</small></div>`; }).join('')}</div>
      ${mi >= 0 ? `<div class="row pres-btns"><button class="btn ${mine && mine.ok ? '' : 'ghost'}" data-pres="1" type="button">Je serai là ✓</button><button class="btn ghost ${mine && mine.ok === false ? 'on-no' : ''}" data-pres="0" type="button">Je ne pourrai pas</button></div>` : ''}
      ${isOwner() ? `<button class="btn sms-btn" data-confirmsms type="button" style="margin-top:10px">Texto aux joueurs pour confirmer</button>` : ''}
      ${S.presenceBlocked ? '<div class="warn">Les présences ne peuvent pas être enregistrées : vérifiez votre connexion, puis réessayez.</div>' : ''}</section>`;
  }
  // À la création d'une partie : texto aux joueurs pour confirmer leur présence
  function confirmText(g) {
    const { nums, missing } = playerNumbers(g); if (!nums.length) return;
    const T = isAlt(g) ? null : L.getTeams(g);
    const date = new Date(g.createdAt || Date.now()).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const body = [`Tu es inscrit à une partie (${gameName(g)}) – ${g.course.name.replace(/^Club de golf /i, '')}, ${date}.`,
      ...(T ? [`Bleus : ${T[1].map(i => g.players[i].name).join(', ')}`, `Rouges : ${T[0].map(i => g.players[i].name).join(', ')}`] : [`Le 9 points : ${g.players.map(p => p.name).join(', ')}`]),
      !T ? '' : g.stake ? `La game commence à ${fmt$(money(g.stake))}.` : '',
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
  // Textos : par le service Fanion (Twilio, via fanion.ai) quand il est en place ; sinon, Messages s'ouvre sur le téléphone
  // =====================================================================
  // Compétitions (inspiré des tournois de Golf Genius) :
  //   membre-membre en match play, Stableford ou coups ; membre-invité ; Texas scramble ; scramble à 4 ;
  //   Coupe Ryder (deux camps, sessions de matchs) ; tableau à élimination (têtes de série, consolation) ;
  //   plusieurs rondes (cumul) ; ordre du mérite de la saison ; équipes équilibrées A-B-C-D ou tirage ;
  //   classement plein écran (télé du chalet) ; cartes de pointage et affiches de voiturette à imprimer.
  // comps/<id> = { groupId, format, jeu?, name, date, courseId, course, tee, allowance, flights, teams:[{id, dep?, p:[{name,index}]}],
  //   rounds?:[{date, courseId, course, tee}], ryder?:{sides, sessions}, tableau?:{entrants, seeding, consolation, manual},
  //   scores:{ <équipe | équipe@ronde | match>: { <trou>: [scores] } } }
  // =====================================================================
  // ==== src/golf/competitions.js ====
  const CLASSES_LETTRES = ['A', 'B', 'C', 'D'];
  const toParTxt = x => x === 0 ? 'Par' : (x > 0 ? '+' : '−') + Math.abs(x);
  const parseIdx = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
  const uid6 = () => Math.random().toString(36).slice(2, 8);
  const prenom = n => esc(String(n || '?').split(' ')[0]);
  const dateLong = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  // Moteur de pointage réellement utilisé : le membre-invité suit le jeu choisi, le scramble à 4 suit le Texas scramble
  const eff = c => c.format === 'invite' ? (c.jeu || 'match') : c.format === 'scramble' ? 'texas' : (c.format || 'match');
  const isStroke = c => ['coups', 'stableford', 'texas'].includes(eff(c)) && !['ryder', 'tableau'].includes(c.format);
  const nRounds = c => isStroke(c) ? 1 + (c.rounds || []).length : 1;
  const roundOf = (c, r) => !r ? { date: c.date, course: c.course, tee: c.tee } : (c.rounds || [])[r - 1] || { date: c.date, course: c.course, tee: c.tee };
  const skey = (t, r) => r ? t.id + '@' + r : t.id;
  function compTee(c, r) { const R = roundOf(c, r); return (R.course.tees || []).find(t => t.name === R.tee) || (R.course.tees || [])[0]; }
  const chOf = (idx, course, tee) => { const i = parseIdx(idx); return i == null || !tee ? 0 : L.courseHandicap(i, tee, L.teePar(course, tee)); };
  // Handicap de jeu de chaque joueur : handicap de parcours × allocation (85 % en meilleure balle, selon le système mondial)
  function compPlayers(c, t, r) {
    const R = roundOf(c, r), tee = compTee(c, r);
    return t.p.map(p => { const ch = chOf(p.index, R.course, tee); return { ...p, ch, ph: Math.round(ch * (c.allowance || 85) / 100) }; });
  }
  // Texas scramble : handicap d'équipe selon le système mondial (4 joueurs : 25-20-15-10 % ; 3 : 30-20-10 % ; 2 : 35-15 %)
  const TX_W = { 2: [0.35, 0.15], 3: [0.30, 0.20, 0.10], 4: [0.25, 0.20, 0.15, 0.10] };
  function texasHcp(c, t, r) {
    const R = roundOf(c, r), tee = compTee(c, r);
    const chs = t.p.map(p => chOf(p.index, R.course, tee)).sort((a, b) => a - b);
    const w = TX_W[chs.length] || TX_W[4];
    return Math.round(chs.reduce((a, ch, k) => a + ch * (w[k] || 0), 0));
  }
  // Résultat d'une équipe pour une ronde : meilleure balle nette à chaque trou (ou score unique en scramble)
  function compTeamResult(c, t, r = 0) {
    const R = roundOf(c, r), tee = compTee(c, r), sc = (c.scores || {})[skey(t, r)] || {};
    if (eff(c) === 'texas') {
      const th = texasHcp(c, t, r), drives = t.p.map(() => 0);
      let toPar = 0, thru = 0, gross = 0, net = 0; const holes = [];
      for (let h = 1; h <= 18; h++) {
        const par = L.holePar(R.course, tee, h), si = R.course.holes[h - 1].si, s = sc[h] || [];
        const g = s[0] == null || s[0] === '' ? null : Number(s[0]), dv = s[1] == null ? null : Number(s[1]);
        const best = g == null ? null : g - L.strokesOnHole(th, si);
        if (dv != null && drives[dv] != null && g != null) drives[dv]++;
        holes.push({ h, par, si, best, s, g, dv });
        if (best != null) { thru++; toPar += best - par; gross += g; net += best; }
      }
      return { t, ps: t.p.map(p => ({ ...p, ph: 0 })), toPar, thru, net, gross, pts: 0, holes, ph: th, drives };
    }
    const ps = compPlayers(c, t, r);
    let toPar = 0, thru = 0, net = 0, pts = 0; const holes = [];
    for (let h = 1; h <= 18; h++) {
      const par = L.holePar(R.course, tee, h), si = R.course.holes[h - 1].si, s = sc[h] || [];
      const nets = ps.map((p, i) => s[i] == null || s[i] === '' ? null : Number(s[i]) - L.strokesOnHole(p.ph, si)).filter(x => x != null);
      const best = nets.length ? Math.min(...nets) : null;
      // Stableford : 2 points pour la normale nette, 1 de plus par coup sous la normale, 1 de moins par coup au-dessus (minimum 0)
      const sp = best == null ? null : Math.max(0, 2 + par - best);
      holes.push({ h, par, si, best, s, sp });
      if (best != null) { thru++; toPar += best - par; net += best; pts += sp; }
    }
    return { t, ps, toPar, thru, net, pts, holes, ph: ps.reduce((a, p) => a + p.ph, 0) };
  }
  // Cumul de toutes les rondes (une seule ronde : le résultat de cette ronde)
  function compTeamTotal(c, t) {
    const n = nRounds(c), rs = Array.from({ length: n }, (_, r) => compTeamResult(c, t, r));
    if (n === 1) return { ...rs[0], rounds: rs };
    const sum = k => rs.reduce((a, x) => a + (x[k] || 0), 0);
    return { t, ps: rs[0].ps, ph: rs[0].ph, drives: eff(c) === 'texas' ? t.p.map((_, i) => rs.reduce((a, x) => a + (x.drives[i] || 0), 0)) : null,
      toPar: sum('toPar'), thru: sum('thru'), net: sum('net'), gross: sum('gross'), pts: sum('pts'), holes: rs[0].holes, rounds: rs };
  }
  // Classes : les équipes sont classées par handicap d'équipe, puis réparties également ; classement par ronde ou cumulé
  function compFlights(c, r) {
    const res = (c.teams || []).map(t => r == null ? compTeamTotal(c, t) : compTeamResult(c, t, r)).sort((a, b) => a.ph - b.ph);
    const n = Math.max(1, Math.min(c.flights || 1, res.length || 1)), out = [];
    let k = 0; for (let f = 0; f < n; f++) { const size = Math.floor(res.length / n) + (f < res.length % n ? 1 : 0); out.push({ name: n > 1 ? 'Classe ' + CLASSES_LETTRES[f] : 'Classement', teams: res.slice(k, k + size) }); k += size; }
    out.forEach(fl => {
      const key = x => eff(c) === 'stableford' ? -x.pts : x.toPar;
      fl.teams.sort((a, b) => (a.thru ? 0 : 1) - (b.thru ? 0 : 1) || key(a) - key(b) || b.thru - a.thru);
      let pos = 0; fl.teams.forEach((x, i) => { if (i === 0 || key(x) !== key(fl.teams[i - 1]) || !x.thru) pos = i + 1; x.pos = x.thru ? pos : null; x.tie = x.thru && fl.teams.filter(y => y.thru && key(y) === key(x)).length > 1; });
    });
    return out;
  }
  const teamLabel = t => t.p.map(p => esc(p.name || '?')).join(' · ');
  // Match play générique : côtés A et B, allocation selon le type ; les coups se donnent à partir du plus bas handicap du match
  //   quatre (quatre balles) : 90 % chacun, meilleure balle nette ; alterne : 50 % de la somme par côté ; simple : 100 %
  function playMatch(course, tee, A, B, sc, type) {
    const par = L.teePar(course, tee), ch = p => chOf(p.index, course, tee);
    let ha, hb;
    if (type === 'alterne') { ha = [Math.round(A.reduce((s, p) => s + ch(p), 0) * 0.5)]; hb = [Math.round(B.reduce((s, p) => s + ch(p), 0) * 0.5)]; }
    else { const k = type === 'quatre' ? 0.9 : 1; ha = A.map(p => Math.round(ch(p) * k)); hb = B.map(p => Math.round(ch(p) * k)); }
    const base = Math.min(...ha, ...hb); ha = ha.map(x => x - base); hb = hb.map(x => x - base);
    const na = ha.length;
    const best = (hs, s, off, si) => { const n = hs.map((x, i) => s[off + i] == null || s[off + i] === '' ? null : Number(s[off + i]) - L.strokesOnHole(x, si)).filter(x => x != null); return n.length === hs.length || type === 'quatre' && n.length ? Math.min(...n) : null; };
    let d = 0, played = 0, last = 0, fini = false; const holes = [];
    for (let h = 1; h <= 18; h++) {
      const si = course.holes[h - 1].si, s = (sc || {})[h] || [], x = best(ha, s, 0, si), y = best(hb, s, na, si);
      holes.push({ h, si, par: L.holePar(course, tee, h), s, x, y });
      if (fini || x == null || y == null) continue;
      played++; last = h; if (x < y) d++; else if (y < x) d--;
      holes[h - 1].d = d;
      if (Math.abs(d) > 18 - h) fini = true;   // match décidé
    }
    const left = 18 - last, done = played > 0 && (Math.abs(d) > left || last === 18);
    const txt = !played ? 'À jouer' : d === 0 ? (done ? 'Match nul' : `Égal après ${last}`) : done && left > 0 ? `${Math.abs(d)} et ${left}` : done ? `${Math.abs(d)} UP` : `${Math.abs(d)} UP après ${last}`;
    return { d, played, last, done, txt, holes, ha, hb, pts: done ? (d > 0 ? [1, 0] : d < 0 ? [0, 1] : [0.5, 0.5]) : [0, 0] };
  }
  // Membre-membre en match play : chaque équipe affronte toutes celles de sa classe (meilleure balle nette)
  function compMatch(c, A, B) {
    const pa = compPlayers(c, A), pb = compPlayers(c, B), base = Math.min(...pa.concat(pb).map(p => p.ph));
    const sa = (c.scores || {})[A.id] || {}, sb = (c.scores || {})[B.id] || {};
    const best = (ps, s, si) => { const n = ps.map((p, i) => s[i] == null || s[i] === '' ? null : Number(s[i]) - L.strokesOnHole(p.ph - base, si)).filter(x => x != null); return n.length ? Math.min(...n) : null; };
    let d = 0, played = 0, last = 0;
    for (let h = 1; h <= 18; h++) {
      const si = c.course.holes[h - 1].si, x = best(pa, sa[h] || [], si), y = best(pb, sb[h] || [], si);
      if (x == null || y == null) continue;
      played++; last = h; if (x < y) d++; else if (y < x) d--;
      if (Math.abs(d) > 18 - h) break;
    }
    const left = 18 - last, done = played > 0 && (Math.abs(d) > left || (last === 18 && played === 18));
    const lead = d > 0 ? A : d < 0 ? B : null;
    const txt = !played ? 'À jouer' : d === 0 ? (done ? 'Match nul' : `Égal après ${last}`) : done && left > 0 ? `${Math.abs(d)} et ${left}` : done ? `${Math.abs(d)} UP` : `${Math.abs(d)} UP après ${last}`;
    return { A, B, d, played, last, done, lead, txt, pts: done ? (d > 0 ? [1, 0] : d < 0 ? [0, 1] : [0.5, 0.5]) : [0, 0] };
  }
  function compStandings(c, fl) {
    const T = fl.teams.map(r => ({ r, pts: 0, w: 0, h: 0, l: 0, diff: 0 })), M = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      const m = compMatch(c, T[i].r.t, T[j].r.t); M.push(m);
      T[i].pts += m.pts[0]; T[j].pts += m.pts[1];
      if (m.done) { if (m.d > 0) { T[i].w++; T[j].l++; } else if (m.d < 0) { T[j].w++; T[i].l++; } else { T[i].h++; T[j].h++; } }
      T[i].diff += m.d; T[j].diff -= m.d;
    }
    T.sort((a, b) => b.pts - a.pts || b.diff - a.diff);
    T.forEach((x, k) => { x.pos = k && x.pts === T[k - 1].pts && x.diff === T[k - 1].diff ? T[k - 1].pos : k + 1; });
    return { T, M };
  }
  const fmtPt = x => String(x).replace('.5', ',5');
  const drivesTxt = (c, r) => { const min = (c.minDrives || 0) * (r.rounds ? r.rounds.length : 1); return r.t.p.map((p, i) => `${prenom(p.name)} ${r.drives[i]}${min && r.drives[i] < min ? '⚠' : ''}`).join(' · '); };
  const sumHtml = (c, r) => `<span>${r.thru ? `Après ${r.thru} trou${r.thru > 1 ? 's' : ''}` : 'Aucun score'}</span><b class="${eff(c) !== 'stableford' && r.toPar < 0 ? 'under' : ''}">${!r.thru ? '' : eff(c) === 'stableford' ? r.pts + ' pts' : toParTxt(r.toPar)}</b>`;
  // ==== src/golf/ryder.js ====
  // ---------- Coupe Ryder : deux camps, sessions de matchs ----------
  const RY_TYPES = { quatre: 'Quatre balles (meilleure balle, 2 contre 2)', alterne: 'Coups alternés (une balle, 2 contre 2)', simple: 'Simples (1 contre 1)' };
  const RY_COURT = { quatre: 'Quatre balles', alterne: 'Coups alternés', simple: 'Simples' };
  const ryPlayer = (c, id) => { for (const s of c.ryder.sides) { const p = s.p.find(x => x.id === id); if (p) return p; } return { name: '?', index: '' }; };
  function ryMatch(c, m, type) {
    const A = m.a.map(id => ryPlayer(c, id)), B = m.b.map(id => ryPlayer(c, id));
    return { m, A, B, ...playMatch(c.course, compTee(c), A, B, (c.scores || {})[m.id], type) };
  }
  function ryTotals(c) {
    const tot = [0, 0], all = []; let n = 0;
    (c.ryder.sessions || []).forEach(s => s.matches.forEach(m => { const r = ryMatch(c, m, s.type); all.push({ s, r }); n++; tot[0] += r.pts[0]; tot[1] += r.pts[1]; }));
    return { tot, all, n, gagner: n / 2 + 0.5 };
  }
  // Paires par défaut d'une session : joueurs dans l'ordre (1-2 contre 1-2, 3-4 contre 3-4…), ou un contre un
  function ryAutoMatches(c, type) {
    const [A, B] = c.ryder.sides.map(s => s.p.map(p => p.id)), k = type === 'simple' ? 1 : 2, n = Math.floor(Math.min(A.length, B.length) / k);
    return Array.from({ length: n }, (_, i) => ({ id: uid6(), a: A.slice(i * k, i * k + k), b: B.slice(i * k, i * k + k) }));
  }
  // ==== src/golf/tableau.js ====
  // ---------- Tableau à élimination ----------
  // Ordre des têtes de série dans un tableau de taille 2^k (1 contre 16, 8 contre 9, …)
  function seedOrder(n) { let o = [1]; while (o.length < n) { const m = o.length * 2 + 1; o = o.flatMap(x => [x, m - x]); } return o; }
  const ROUND_NAMES = n => n === 2 ? 'Finale' : n === 4 ? 'Demi-finales' : n === 8 ? 'Quarts de finale' : n === 16 ? 'Huitièmes de finale' : `Ronde de ${n}`;
  function tbSeeds(c) {
    const T = c.tableau, E = T.entrants.filter(e => e.name);
    if (T.seeding === 'index') return [...E].sort((a, b) => (parseIdx(a.index) ?? 99) - (parseIdx(b.index) ?? 99));
    if (T.seeding === 'tirage') { const ord = T.order || []; return [...E].sort((a, b) => (ord.indexOf(a.id) + 1 || 999) - (ord.indexOf(b.id) + 1 || 999)); }
    return E;
  }
  // Résultat d'un match du tableau : pointage trou par trou (match play net, 100 %) ou gagnant indiqué à la main
  function tbResult(c, key, a, b) {
    const man = ((c.tableau.manual || {})[key]) || null;
    const r = playMatch(c.course, compTee(c), [a], [b], (c.scores || {})[key], 'simple');
    if (man && man.w) return { ...r, winner: man.w === 'a' ? a : b, loser: man.w === 'a' ? b : a, txt: man.txt || 'Gagné', manual: true };
    if (r.done && r.d !== 0) return { ...r, winner: r.d > 0 ? a : b, loser: r.d > 0 ? b : a };
    return { ...r, winner: null, egal: r.done && r.d === 0 };
  }
  // Tableau à partir des places de la première ronde : joueur, null (exempté) ou PEND (pas encore connu)
  const PEND = { pend: true };
  function tbBuildSlots(c, slots, prefix) {
    const rounds = [];
    for (let n = slots.length, r = 0; n >= 2; n /= 2, r++) {
      const ms = [];
      for (let i = 0; i < slots.length; i += 2) {
        const key = `${prefix}${r}-${i / 2}`, a = slots[i], b = slots[i + 1];
        const res = a === PEND || b === PEND ? { pend: true, winner: null } : !a || !b ? { bye: true, winner: a || b || null } : tbResult(c, key, a, b);
        ms.push({ key, a: a === PEND ? null : a, b: b === PEND ? null : b, pendA: a === PEND, pendB: b === PEND, res });
      }
      rounds.push({ name: ROUND_NAMES(n), ms });
      slots = ms.map(m => m.res.bye ? m.res.winner : m.res.winner || PEND);
    }
    return { rounds, champion: rounds.length ? rounds[rounds.length - 1].ms[0].res.winner || null : null };
  }
  function tbBrackets(c) {
    const seeds = tbSeeds(c), size = Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(2, seeds.length))));
    const main = tbBuildSlots(c, seedOrder(size).map(k => seeds[k - 1] || null), 'T');
    let conso = null;
    // Consolation : les perdants de la première ronde, chacun à la place de son match (un match d'exempté laisse une place vide)
    if (c.tableau.consolation && main.rounds[0].ms.length >= 2) {
      const sl = main.rounds[0].ms.filter(m => !m.res.bye).map(m => m.res.loser || PEND);
      if (sl.length >= 2) { while (sl.length & (sl.length - 1)) sl.push(null); conso = tbBuildSlots(c, sl, 'C'); }
    }
    return { seeds, main, conso };
  }
  const tbName = (c, p, pend) => { if (pend) return '<i class="tb-tbd">à déterminer</i>'; if (!p) return '<i class="tb-tbd">—</i>'; const s = tbSeeds(c).indexOf(p) + 1; return `${s ? `<small class="tb-seed">${s}</small>` : ''}${esc(p.name)}`; };
  // ==== src/golf/merite.js ====
  // ---------- Ordre du mérite : points selon la position, cumulés sur la saison ----------
  const MERIT_PTS = [100, 80, 65, 55, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8];
  // Une compétition compte dans l'ordre du mérite seulement une fois terminée
  function compFinie(c) {
    if (c.format === 'ryder') { const T = ryTotals(c); return T.n > 0 && T.all.every(x => x.r.done); }
    if (c.format === 'tableau') return !!tbBrackets(c).main.champion;
    if (eff(c) === 'match') return compFlights(c, 0).every(f => compStandings(c, f).M.every(m => m.done));
    return (c.teams || []).length > 0 && (c.teams || []).every(t => compTeamTotal(c, t).thru >= 18 * nRounds(c));
  }
  function compMerit(c) {
    const out = []; const add = (name, pts) => { if (name) out.push({ name, pts }); };
    if (!compFinie(c)) return out;
    if (c.format === 'ryder') { const T = ryTotals(c), w = T.tot[0] === T.tot[1] ? -1 : T.tot[0] > T.tot[1] ? 0 : 1; c.ryder.sides.forEach((s, i) => s.p.forEach(p => add(p.name, w === -1 ? 45 : w === i ? 60 : 30))); return out; }
    if (c.format === 'tableau') {
      const { main } = tbBrackets(c), R = main.rounds.length, reach = {};
      main.rounds.forEach((rd, r) => rd.ms.forEach(m => [m.a, m.b].forEach(p => { if (p) reach[p.id] = Math.max(reach[p.id] || 0, r); })));
      Object.entries(reach).forEach(([id, r]) => { const p = c.tableau.entrants.find(x => x.id === id); const champ = main.champion && main.champion.id === id;
        add(p && p.name, champ ? 100 : r === R - 1 ? 80 : r === R - 2 ? 65 : r === R - 3 ? 50 : 30); });
      return out;
    }
    if (eff(c) === 'match') { compFlights(c, 0).forEach(f => compStandings(c, f).T.forEach(x => x.r.t.p.forEach(p => add(p.name, MERIT_PTS[x.pos - 1] || 5)))); return out; }
    compFlights(c).forEach(f => f.teams.forEach(x => { if (x.pos) x.t.p.forEach(p => add(p.name, MERIT_PTS[x.pos - 1] || 5)); }));
    return out;
  }
  function meritTable(list, year) {
    const m = {};
    list.filter(c => (c.date || '').startsWith(String(year))).forEach(c => compMerit(c).forEach(x => { const k = L.norm(x.name); m[k] = m[k] || { name: x.name, pts: 0, n: 0 }; m[k].pts += x.pts; m[k].n++; }));
    const rows = Object.values(m).sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'fr'));
    rows.forEach((x, i) => { x.pos = i && x.pts === rows[i - 1].pts ? rows[i - 1].pos : i + 1; });
    return rows;
  }

  // Formats de compétition (comme la banque de jeux) ; ready = on peut la créer dans l'app
  const COMP_INFO = [
    { f: 'match', ready: true, name: 'Membre-membre en match play', who: 'Équipes de 2, réparties en classes selon le handicap d’équipe',
      rules: ['Dans chaque classe, chaque équipe affronte toutes les autres (ronde).', 'Chaque match se joue en meilleure balle nette sur 18 trous : l’équipe au meilleur score net gagne le trou.', 'Allocation recommandée : 90 % du handicap de parcours ; les coups se donnent à partir du plus bas des quatre joueurs.'],
      score: ['Match gagné : 1 point ; nul : ½ ; perdu : 0.', 'Égalité de points : on départage par les trous gagnés.', 'Le classement de chaque classe se met à jour en direct.'] },
    { f: 'stableford', ready: true, name: 'Membre-membre Stableford', who: 'Équipes de 2, réparties en classes selon le handicap d’équipe',
      rules: ['À chaque trou, le meilleur score net de l’équipe compte (meilleure balle).', 'Points : normale nette 2, oiselet net 3, aigle net 4, boguey net 1, double boguey ou pire 0.', 'Allocation recommandée : 85 % du handicap de parcours.', 'Possible sur plusieurs rondes : les points s’additionnent.'],
      score: ['Le plus de points gagne la classe.', 'Un mauvais trou ne coûte que 0 point : idéal pour les handicaps élevés.'] },
    { f: 'coups', ready: true, name: 'Membre-membre en coups', who: 'Équipes de 2, réparties en classes selon le handicap d’équipe',
      rules: ['À chaque trou, le meilleur score net de l’équipe compte (meilleure balle).', 'On additionne les trous ; le total se lit par rapport à la normale (−5, Par, +2).', 'Allocation recommandée : 85 % du handicap de parcours.', 'Possible sur plusieurs rondes : les totaux s’additionnent.'],
      score: ['Le plus bas total net gagne la classe.'] },
    { f: 'invite', ready: true, name: 'Membre-invité', who: 'Un membre et son invité, en équipe de 2',
      rules: ['Comme le membre-membre, mais chaque équipe compte un invité de l’extérieur du groupe.', 'Au choix : match play (chaque équipe contre toutes celles de sa classe), Stableford ou en coups, meilleure balle nette.', 'Classes selon le handicap d’équipe.'],
      score: ['Match play : 1 point par match gagné, ½ par nul.', 'Stableford ou coups : le meilleur total de la classe gagne.'] },
    { f: 'texas', ready: true, name: 'Texas scramble', who: 'Équipes de 4 (ou de 2 ou 3), avec ou sans classes',
      rules: ['Les joueurs de l’équipe frappent tous ; on choisit la meilleure balle et tout le monde rejoue de là, jusqu’au trou.', 'Chaque joueur doit fournir un nombre minimum de coups de départ (souvent 3 à 4 balles).', 'Handicap d’équipe : 25-20-15-10 % des handicaps de parcours, du plus bas au plus haut.'],
      score: ['Un seul score par équipe et par trou ; le plus bas total net gagne.', 'L’app compte les départs de chaque joueur et signale ceux qui manquent.'] },
    { f: 'scramble', ready: true, name: 'Scramble à 4', who: 'Équipes de 4',
      rules: ['Les 4 joueurs frappent ; l’équipe choisit la meilleure balle et tout le monde rejoue de là, jusqu’au trou.', 'Aucun minimum de départs par joueur.', 'Handicap d’équipe : 25 %, 20 %, 15 % et 10 % des handicaps de parcours, du plus bas au plus haut.'],
      score: ['Un seul score par équipe ; le plus bas total net gagne.'] },
    { f: 'ryder', ready: true, name: 'Coupe Ryder du groupe', who: 'Deux camps (Rouges contre Bleus)',
      rules: ['Plusieurs sessions de matchs : quatre balles (meilleure balle à 2 contre 2), coups alternés (une balle à 2 contre 2) et simples.', 'Chaque match se joue en match play net : 90 % du handicap en quatre balles, 50 % de la somme des deux joueurs en coups alternés, 100 % en simple, à partir du plus bas handicap du match.'],
      score: ['Match gagné : 1 point pour son camp ; nul : ½.', 'Le premier camp à dépasser la moitié des points gagne la coupe.'] },
    { f: 'tableau', ready: true, name: 'Tableau à élimination', who: 'Joueurs en match play, un contre un',
      rules: ['Têtes de série selon l’index (le plus bas est no 1), par tirage au sort ou dans l’ordre entré ; les meilleures têtes de série sont exemptées s’il manque des joueurs.', 'Chaque match se joue en match play net, 100 % de l’écart des handicaps.', 'Le gagnant passe à la ronde suivante ; un tableau de consolation est possible pour les perdants de la première ronde.'],
      score: ['Le pointage trou par trou décide le match ; l’organisateur peut aussi indiquer le gagnant (trous supplémentaires, forfait).'] },
  ];
  const fmtName = f => (COMP_INFO.find(x => x.f === (f || 'match')) || {}).name || '';
  const compSub = c => c.format === 'ryder' ? `${c.ryder.sides[0].name} contre ${c.ryder.sides[1].name}` : c.format === 'tableau' ? `${c.tableau.entrants.filter(e => e.name).length} joueurs` : `${(c.teams || []).length} équipes${nRounds(c) > 1 ? ` · ${nRounds(c)} rondes` : ''}`;
  const compItem = c => `<button class="item" data-comp="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(dateLong(c.date))} · ${esc(fmtName(c.format))} · ${esc(c.course.name)} · ${esc(compSub(c))}</span></button>`;

  function vComps() {
    $('#barTitle').textContent = S.compLive ? 'Compétitions en cours' : 'Compétitions';
    if (S.compList == null) { Store.listComps().then(l => { S.compList = l; if (S.view === 'comps') render(); }); return '<p class="note">Chargement…</p>'; }
    if (S.compLive) {
      // En cours : aujourd'hui et à venir (et la veille, pour finir d'entrer les scores) ; une compétition sur plusieurs rondes reste jusqu'à sa dernière
      const from = new Date(Date.now() - 864e5).toISOString().slice(0, 10), today = new Date().toISOString().slice(0, 10);
      const fin = c => [c.date, ...(c.rounds || []).map(r => r.date)].filter(Boolean).sort().pop() || '';
      const l = S.compList.filter(c => fin(c) >= from || c.format === 'tableau' && !(tbBrackets(c).main.champion)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return `<p class="note">Touchez une compétition pour voir son classement en direct et entrer les scores de votre équipe.</p>
        <div class="list">${l.map(c => compItem(c).replace('</b>', c.date === today ? ' <span class="live-tag">Aujourd’hui</span></b>' : '</b>')).join('') || `<p class="note">Aucune compétition en cours.</p>`}</div>
        <button class="btn ghost" data-go="comps" type="button">Voir la Banque de compétitions</button>`;
    }
    const year = S.meritYear || new Date().getFullYear(), merit = meritTable(S.compList, year);
    return `<p class="note">Les formats de compétition, leurs règles et leur pointage. Tout se compte au net, avec le handicap de chacun.</p>
      <div class="jeux">${COMP_INFO.map(x => `<details class="card jeu"><summary><b>${esc(x.name)}${x.ready ? '' : ' <span class="soon-tag">Bientôt</span>'}</b><span>${esc(x.who)}</span></summary>
        <h3>Règles</h3><ul>${x.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <h3>Le classement</h3><ul>${x.score.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        ${x.ready && isProprio() ? `<button class="btn small" data-compnew="${x.f}" type="button">Créer dans ce format</button>` : ''}</details>`).join('')}</div>
      <h2 class="jeux-h">Compétitions du groupe</h2>
      <div class="list">${S.compList.map(compItem).join('') || '<p class="note">Aucune compétition pour l’instant.</p>'}</div>
      ${isProprio() ? '<button class="btn" data-compnew="match" type="button">Nouvelle compétition</button>' : canOrganize() ? '<p class="note">Seul le propriétaire du groupe peut créer ou effacer une compétition.</p>' : ''}
      <h2 class="jeux-h">Ordre du mérite ${year}</h2>
      <p class="note">Points de saison selon la position dans chaque compétition : 1re place 100, 2e 80, 3e 65, 4e 55, 5e 50, puis en baissant. Coupe Ryder : 60 par joueur du camp gagnant, 30 pour l’autre camp. Tableau : champion 100, finaliste 80, demi-finale 65, quart 50. Seules les compétitions terminées comptent.</p>
      ${merit.length ? `<section class="card"><table class="cm-lb merit"><thead><tr><th>Pos.</th><th>Joueur</th><th>Comp.</th><th>Pts</th></tr></thead><tbody>${merit.map(x => `<tr class="${x.pos === 1 ? 'lead' : ''}"><td>${x.pos}</td><td>${esc(x.name)}</td><td>${x.n}</td><td class="tp">${x.pts}</td></tr>`).join('')}</tbody></table></section>` : `<p class="note">Aucun point cette saison : les points apparaissent dès qu’une compétition de ${year} est terminée.</p>`}
      <div class="row"><button class="btn ghost small" data-merit="${year - 1}" type="button">‹ ${year - 1}</button>${year < new Date().getFullYear() ? `<button class="btn ghost small" data-merit="${year + 1}" type="button">${year + 1} ›</button>` : ''}</div>`;
  }
  // ==== src/golf/competition-edition.js ====
  // ---------- Création et modification ----------
  const blankTeam = n => ({ id: uid6(), dep: '', p: Array.from({ length: n }, () => ({ name: '', index: '' })) });
  const teamSizeOf = d => ['texas', 'scramble'].includes(d.format) ? (d.format === 'scramble' ? 4 : d.teamSize || 4) : 2;
  function newCompDraft(format) {
    const c0 = S.courses[0] || { id: '', tees: [] }, y = new Date().getFullYear();
    const d = { format, jeu: 'match', name: '', date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), courseId: c0.id, tee: (c0.tees[0] || {}).name, allowance: 90, flights: 2, rounds: [], teams: [] };
    d.name = { match: 'Membre-membre', stableford: 'Membre-membre Stableford', coups: 'Membre-membre en coups', invite: 'Membre-invité', texas: 'Texas scramble', scramble: 'Scramble à 4', ryder: 'Coupe Ryder', tableau: 'Championnat du groupe' }[format] + ' ' + y;
    d.allowance = format === 'match' || format === 'invite' ? 90 : ['texas', 'scramble'].includes(format) ? 100 : 85;
    if (format === 'texas') { d.teamSize = 4; d.minDrives = 3; d.flights = 1; }
    if (format === 'scramble') { d.teamSize = 4; d.minDrives = 0; d.flights = 1; }
    if (format === 'ryder') { d.flights = 1; d.ryder = { sides: [{ name: 'Rouges', p: [] }, { name: 'Bleus', p: [] }], sessions: [] }; for (let i = 0; i < 4; i++) d.ryder.sides.forEach(s => s.p.push({ id: uid6(), name: '', index: '' })); }
    else if (format === 'tableau') { d.flights = 1; d.tableau = { entrants: Array.from({ length: 8 }, () => ({ id: uid6(), name: '', index: '' })), seeding: 'index', consolation: false, manual: {} }; }
    else d.teams = [0, 1, 2, 3].map(() => blankTeam(teamSizeOf(d)));
    return d;
  }
  const courseOpts = id => S.courses.map(x => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const teeOpts = (cid, tee) => ((S.courses.find(x => x.id === cid) || S.courses[0] || {}).tees || []).map(t => `<option ${t.name === tee ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const pRow = (pre, id, p, ph) => `<div class="cm-p"><input data-${pre}n="${id}" type="text" list="cmNames" placeholder="${esc(ph)}" value="${esc(p.name)}" autocapitalize="words"><input data-${pre}i="${id}" type="text" inputmode="decimal" placeholder="Index" value="${esc(p.index)}"></div>`;
  function vCompEdit() {
    const d = S.compDraft; $('#barTitle').textContent = d.id ? 'Modifier la compétition' : 'Nouvelle compétition';
    if (!S.courses.length) return `<p class="note">Ajoutez d’abord un terrain dans la banque de terrains.</p><button class="btn" data-go="courses" type="button">Ajouter un terrain</button>`;
    const f = d.format, stroke = ['coups', 'stableford', 'texas', 'scramble'].includes(f) || f === 'invite' && d.jeu !== 'match';
    const fmtSel = `<select id="cmFmt">${COMP_INFO.map(x => `<option value="${x.f}" ${x.f === f ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    const base = `<section class="card"><h2>La compétition</h2>
        <label>Format${fmtSel}</label>
        ${f === 'invite' ? `<label>Jeu<select id="cmJeu">${[['match', 'Match play (chaque équipe contre toutes celles de sa classe)'], ['stableford', 'Stableford, meilleure balle'], ['coups', 'En coups, meilleure balle']].map(([k, l]) => `<option value="${k}" ${k === (d.jeu || 'match') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
        <label>Nom<input id="cmName" type="text" value="${esc(d.name)}"></label>
        <div class="row"><label style="flex:1">${stroke && (d.rounds || []).length ? 'Ronde 1 : date' : 'Date'}<input id="cmDate" type="date" value="${esc(d.date)}"></label></div>
        <label>Terrain<select id="cmCourse">${courseOpts(d.courseId)}</select></label>
        <label>Tertre<select id="cmTee">${teeOpts(d.courseId, d.tee)}</select></label>
        ${stroke ? `${(d.rounds || []).map((r, i) => `<div class="cm-round"><b>Ronde ${i + 2}</b><button class="linkbtn" data-rdel="${i}" type="button">Retirer</button>
          <div class="row"><label style="flex:1">Date<input data-rdate="${i}" type="date" value="${esc(r.date || '')}"></label></div>
          <div class="row"><label style="flex:1">Terrain<select data-rcourse="${i}">${courseOpts(r.courseId)}</select></label><label style="flex:1">Tertre<select data-rtee="${i}">${teeOpts(r.courseId, r.tee)}</select></label></div></div>`).join('')}
          ${(d.rounds || []).length < 3 ? '<button class="btn ghost small" id="cmRoundAdd" type="button">+ Ajouter une ronde</button>' : ''}
          ${(d.rounds || []).length ? '<p class="note">Plusieurs rondes : le classement additionne les rondes, et chaque ronde a aussi le sien.</p>' : ''}` : ''}
        ${['texas', 'scramble'].includes(f) ? `<div class="row">${f === 'texas' ? `<label style="flex:1">Joueurs par équipe<select id="cmSize">${[2, 3, 4].map(n => `<option ${n === (d.teamSize || 4) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label style="flex:1">Départs minimums par joueur<select id="cmMinDr">${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === (d.minDrives == null ? 3 : d.minDrives) ? 'selected' : ''}>${n || 'Aucun'}</option>`).join('')}</select></label>` : ''}
          <label style="flex:1">Nombre de classes<select id="cmFl">${[1, 2, 3, 4].map(n => `<option ${n === d.flights ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><input type="hidden" id="cmAllow" value="100">`
        : ['ryder', 'tableau'].includes(f) ? '' : `<div class="row"><label style="flex:1">Allocation du handicap<select id="cmAllow">${[85, 90, 100].map(a => `<option value="${a}" ${a === d.allowance ? 'selected' : ''}>${a} %${a === (eff(d) === 'match' ? 90 : 85) ? ' (recommandé)' : ''}</option>`).join('')}</select></label>
          <label style="flex:1">Nombre de classes<select id="cmFl">${[1, 2, 3, 4].map(n => `<option ${n === d.flights ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`}
        <p class="note">${esc((COMP_INFO.find(x => x.f === f) || COMP_INFO[0]).rules.join(' '))}</p></section>
      <datalist id="cmNames">${(S.players || []).map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>`;
    let body = '';
    if (f === 'ryder') {
      const R = d.ryder;
      body = `<section class="card"><h2>Les camps</h2><div class="ry-sides">${R.sides.map((s, k) => `<div class="ry-side ry-${k}"><input class="ry-name" data-ryname="${k}" type="text" value="${esc(s.name)}" aria-label="Nom du camp ${k + 1}">
          ${s.p.map((p, j) => pRow('ry', k + '.' + j, p, 'Joueur ' + (j + 1))).join('')}
          <div class="row"><button class="linkbtn" data-ryadd="${k}" type="button">+ Joueur</button>${s.p.length > 1 ? `<button class="linkbtn" data-rypop="${k}" type="button">− Retirer le dernier</button>` : ''}</div></div>`).join('')}</div>
          <button class="btn ghost small" data-balance="ryder" type="button">⚖ Répartir des joueurs en deux camps équilibrés</button></section>
        <section class="card"><h2>Les sessions (${R.sessions.length})</h2>
          ${R.sessions.map((s, si) => `<div class="ry-sess"><div class="cm-th"><b>${esc(s.name || RY_COURT[s.type])}</b><button class="linkbtn" data-sdel="${si}" type="button">Retirer</button></div>
            ${s.matches.map((m, mi) => `<div class="ry-m"><span>${m.a.map((id, q) => `<select data-msel="${si}.${mi}.a.${q}">${R.sides[0].p.filter(p => p.name).map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`).join('')}</span><i>contre</i>
              <span>${m.b.map((id, q) => `<select data-msel="${si}.${mi}.b.${q}">${R.sides[1].p.filter(p => p.name).map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`).join('')}</span></div>`).join('') || '<p class="note">Pas assez de joueurs nommés dans chaque camp.</p>'}
            <button class="linkbtn" data-sregen="${si}" type="button">Refaire les paires dans l’ordre des camps</button></div>`).join('')}
          <div class="row"><select id="rySessType">${Object.entries(RY_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn ghost small" id="rySessAdd" type="button">+ Ajouter la session</button></div>
          <p class="note">Les paires suivent l’ordre des joueurs dans chaque camp ; changez-les dans les listes. Nommez les joueurs avant d’ajouter les sessions.</p></section>`;
    } else if (f === 'tableau') {
      const T = d.tableau;
      body = `<section class="card"><h2>Les joueurs (${T.entrants.filter(e => e.name).length})</h2>
          <div class="cm-team">${T.entrants.map((p, j) => pRow('tb', j, p, 'Joueur ' + (j + 1))).join('')}</div>
          <div class="row"><button class="btn ghost small" id="tbAdd" type="button">+ 4 joueurs</button><button class="btn ghost small" data-balance="tableau" type="button">Prendre les joueurs du groupe</button></div>
          <label>Têtes de série<select id="tbSeed"><option value="index" ${T.seeding === 'index' ? 'selected' : ''}>Selon l’index (le plus bas est no 1)</option><option value="tirage" ${T.seeding === 'tirage' ? 'selected' : ''}>Tirage au sort</option><option value="ordre" ${T.seeding === 'ordre' ? 'selected' : ''}>Dans l’ordre de la liste</option></select></label>
          <label class="chk"><input id="tbConso" type="checkbox" ${T.consolation ? 'checked' : ''}> Tableau de consolation pour les perdants de la première ronde</label>
          <p class="note">Il faut au moins 3 joueurs. S’il en manque pour remplir le tableau (8, 16, 32), les meilleures têtes de série sont exemptées de la première ronde.</p></section>`;
    } else {
      const n = teamSizeOf(d), ph = j => f === 'invite' ? (j === 0 ? 'Membre' : 'Invité') : 'Joueur ' + (j + 1);
      body = `<section class="card"><h2>Les équipes (${d.teams.length})</h2>
        <button class="btn ghost small" data-balance="teams" type="button">⚖ Former les équipes : équilibrées (A-B-C-D) ou tirage au sort</button>
        <div class="cm-teams">${d.teams.map((t, i) => `<div class="cm-team"><div class="cm-th"><b>Équipe ${i + 1}</b><button class="linkbtn" data-cmdel="${i}" type="button">Retirer</button></div>
          ${t.p.slice(0, n).map((p, j) => pRow('cm', i + '.' + j, p, ph(j))).join('')}
          <input class="cm-dep" data-cmdep="${i}" type="text" placeholder="Départ (ex. 8 h 10 ou trou 5)" value="${esc(t.dep || '')}"></div>`).join('')}</div>
        <button class="btn ghost small" id="cmAdd" type="button">+ Ajouter une équipe</button></section>`;
    }
    return base + body + `<div class="row"><button class="btn" id="cmSave" type="button">${d.id ? 'Enregistrer' : 'Créer la compétition'}</button><button class="btn ghost" id="cmCancel" type="button">Annuler</button></div>`;
  }

  // Former les équipes : joueurs du groupe cochés, avec leur index ; équilibrées (A-B-C-D en serpentin) ou tirage au sort
  function balanceSheet(kind) {
    const d = S.compDraft, last = ls.get('pelland.lastPlayers', []) || [];
    const idxOf = n => { const x = last.find(p => p && L.norm(p.name || '') === L.norm(n)); return x && x.index != null ? String(x.index) : ''; };
    const size = kind === 'teams' ? teamSizeOf(d) : 1;
    openSheet(`<h3>${kind === 'ryder' ? 'Deux camps équilibrés' : kind === 'tableau' ? 'Joueurs du tableau' : 'Former les équipes'}</h3>
      <p class="note">${kind === 'teams' ? `Cochez les joueurs (équipes de ${size}). Équilibrées : les joueurs sont classés par index et répartis en groupes A, B, C, D ; chaque équipe reçoit un joueur de chaque groupe, en serpentin, pour des handicaps d’équipe semblables.` : kind === 'ryder' ? 'Cochez les joueurs : ils sont classés par index et répartis en serpentin entre les deux camps.' : 'Cochez les joueurs du tableau.'}</p>
      <div class="bal-list">${(S.players || []).map((p, i) => `<label class="bal-row"><input type="checkbox" data-bk="${i}" checked><span>${esc(p.name)}</span><input data-bi="${i}" type="text" inputmode="decimal" placeholder="Index" value="${esc(idxOf(p.name))}"></label>`).join('') || '<p class="note">Aucun joueur dans le groupe.</p>'}</div>
      ${kind === 'teams' ? '<div class="seg bal-mode"><button class="on" data-bm="eq" type="button">Équilibrées</button><button data-bm="tirage" type="button">Tirage au sort</button></div>' : ''}
      <div class="sheet-actions"><button class="btn" id="balGo" type="button">${kind === 'teams' ? 'Former les équipes' : kind === 'ryder' ? 'Répartir' : 'Ajouter au tableau'}</button><button class="btn ghost" data-close type="button">Annuler</button></div>`, sh => {
      let mode = 'eq';
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelectorAll('[data-bm]').forEach(b => b.onclick = () => { mode = b.dataset.bm; sh.querySelectorAll('[data-bm]').forEach(x => x.classList.toggle('on', x === b)); });
      sh.querySelector('#balGo').onclick = () => {
        const chosen = (S.players || []).map((p, i) => ({ name: p.name, index: sh.querySelector(`[data-bi="${i}"]`).value.trim(), on: sh.querySelector(`[data-bk="${i}"]`).checked })).filter(x => x.on);
        if (chosen.length < 2) return toast('Cochez au moins deux joueurs.');
        const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
        const byIdx = l => [...l].sort((a, b) => (parseIdx(a.index) ?? 54) - (parseIdx(b.index) ?? 54));
        if (kind === 'tableau') { d.tableau.entrants = [...d.tableau.entrants.filter(e => e.name), ...chosen.map(p => ({ id: uid6(), name: p.name, index: p.index }))]; closeSheet(); return render(); }
        if (kind === 'ryder') { const s = byIdx(chosen); d.ryder.sides.forEach(x => { x.p = []; }); s.forEach((p, i) => d.ryder.sides[[0, 1, 1, 0][i % 4]].p.push({ id: uid6(), name: p.name, index: p.index })); d.ryder.sessions = []; closeSheet(); toast('Camps formés : ajoutez maintenant les sessions.'); return render(); }
        const nT = Math.floor(chosen.length / size); if (!nT) return toast(`Il faut au moins ${size} joueurs.`);
        let teams = Array.from({ length: nT }, () => []);
        if (mode === 'tirage') { shuffle(chosen).slice(0, nT * size).forEach((p, i) => teams[i % nT].push(p)); }
        else {
          const s = byIdx(chosen).slice(0, nT * size);
          for (let k = 0; k < size; k++) { const pot = shuffle(s.slice(k * nT, (k + 1) * nT)).sort((a, b) => (parseIdx(a.index) ?? 54) - (parseIdx(b.index) ?? 54)); (k % 2 ? pot.reverse() : pot).forEach((p, i) => teams[i].push(p)); }
        }
        const out = chosen.length - nT * size;
        d.teams = teams.map(ps => ({ id: uid6(), dep: '', p: ps.map(p => ({ name: p.name, index: p.index })) }));
        closeSheet(); toast(`${nT} équipes formées${out ? ` ; ${out} joueur${out > 1 ? 's' : ''} sans équipe` : ''}.`); render();
      };
    });
  }
  // ==== src/golf/competition-affichage.js ====
  // ---------- Affichage d'une compétition ----------
  function compHead(c) {
    const info = c.format === 'ryder' ? 'Coupe Ryder · match play net' : c.format === 'tableau' ? `Tableau à élimination · match play net, 100 % de l’écart` : eff(c) === 'texas' ? `${c.format === 'scramble' ? 'Scramble à 4' : 'Texas scramble'} · équipes de ${c.teamSize || 4}${c.minDrives ? ` · ${c.minDrives} départ(s) minimum par joueur` : ''}` : `${c.format === 'invite' ? 'Membre-invité · ' : ''}${eff(c) === 'coups' ? 'Meilleure balle nette en coups' : eff(c) === 'stableford' ? 'Stableford, meilleure balle nette' : 'Match play, meilleure balle nette'} · ${c.allowance} % du handicap`;
    const rounds = nRounds(c) > 1 ? ` · ${nRounds(c)} rondes` : '';
    return `<div class="cm-head"><span>${esc(dateLong(c.date))}</span><span>${esc(c.course.name)} · tertre ${esc(c.tee)}</span><span>${esc(info + rounds)}</span></div>`;
  }
  const tabsHtml = (tab, list) => `<div class="seg cm-tabs">${list.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-ctab="${k}" type="button">${l}</button>`).join('')}</div>`;
  const outilsHtml = () => `<div class="row cm-outils"><button class="btn ghost small" data-tv type="button">📺 Écran télé</button><button class="btn ghost small" data-print="cartes" type="button">🖨 Cartes de pointage</button><button class="btn ghost small" data-print="affiches" type="button">🖨 Affiches de voiturette</button></div>`;
  const orgHtml = () => canOrganize() ? `<div class="row"><button class="btn ghost small" data-cedit type="button">Modifier</button>${!isProprio() ? '' : S.confirmDelComp ? '<button class="btn small" data-cdelok type="button" style="background:var(--red)">Confirmer l’effacement</button>' : '<button class="btn ghost small" data-cdel type="button">Effacer la compétition</button>'}</div>` : '';
  function boardHtml(c, r) {
    const fl = compFlights(c, r), stb = eff(c) === 'stableford', multi = nRounds(c) > 1 && r == null;
    return fl.map(f => `<section class="card cm-board"><h3>${esc(f.name)}</h3>
        <table class="cm-lb"><thead><tr><th>Pos.</th><th>Équipe</th>${multi ? Array.from({ length: nRounds(c) }, (_, i) => `<th>R${i + 1}</th>`).join('') : ''}<th>Trous</th><th>${stb ? 'Pts' : 'Total'}</th></tr></thead>
        <tbody>${f.teams.map(x => `<tr class="${x.pos === 1 ? 'lead' : ''}"><td>${x.pos ? (x.tie ? 'É' : '') + x.pos : '—'}</td><td>${teamLabel(x.t)}<small>Hcp d’équipe ${x.ph}${stb && x.thru ? ' · ' + toParTxt(x.toPar) : ''}${eff(c) === 'texas' ? (x.thru ? ' · brut ' + x.gross : '') + ' · départs : ' + drivesTxt(c, x) : ''}</small></td>
          ${multi ? x.rounds.map(y => `<td class="rd">${!y.thru ? '—' : stb ? y.pts : toParTxt(y.toPar)}</td>`).join('') : ''}<td>${x.thru === 18 * (multi ? nRounds(c) : 1) ? 'F' : x.thru || '—'}</td><td class="tp ${!stb && x.toPar < 0 ? 'under' : ''}">${!x.thru ? '—' : stb ? x.pts : toParTxt(x.toPar)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  }
  function matchBoardHtml(c) {
    return compFlights(c, 0).map(f => { const st = compStandings(c, f); return `<section class="card cm-board"><h3>${esc(f.name)}</h3>
        <table class="cm-lb"><thead><tr><th>Pos.</th><th>Équipe</th><th>G-N-P</th><th>Pts</th></tr></thead>
        <tbody>${st.T.map(x => `<tr class="${x.pos === 1 && x.pts ? 'lead' : ''}"><td>${x.pos}</td><td>${teamLabel(x.r.t)}<small>Hcp d’équipe ${x.r.ph} · trous ${x.diff > 0 ? '+' : x.diff < 0 ? '−' : ''}${Math.abs(x.diff)}</small></td><td>${x.w}-${x.h}-${x.l}</td><td class="tp">${fmtPt(x.pts)}</td></tr>`).join('')}</tbody></table>
        <h4 class="cm-mh">Les matchs</h4><ul class="cm-matches">${st.M.map(m => `<li class="${m.done ? 'done' : ''}"><span>${teamLabel(m.A)} <i>contre</i> ${teamLabel(m.B)}</span><b>${m.lead ? `${esc(m.lead.p.map(p => (p.name || '?').split(' ')[0]).join(' et '))} : ` : ''}${esc(m.txt)}</b></li>`).join('')}</ul></section>`; }).join('');
  }
  function ryderBoardHtml(c, big) {
    const T = ryTotals(c), S0 = c.ryder.sides, gagne = T.tot[0] >= T.gagner ? 0 : T.tot[1] >= T.gagner ? 1 : -1;
    return `<section class="card ry-score${big ? ' big' : ''}"><div class="ry-tot"><div class="ry-0"><span>${esc(S0[0].name)}</span><b>${fmtPt(T.tot[0])}</b></div><div class="ry-1"><span>${esc(S0[1].name)}</span><b>${fmtPt(T.tot[1])}</b></div></div>
        <p class="note">${T.n ? (gagne >= 0 ? `<b>${esc(S0[gagne].name)} remportent la coupe.</b>` : `${fmtPt(T.gagner)} points pour gagner, sur ${T.n} matchs.`) : 'Ajoutez des sessions de matchs.'}</p></section>
      ${(c.ryder.sessions || []).map(s => `<section class="card cm-board"><h3>${esc(s.name || RY_COURT[s.type])}</h3><ul class="cm-matches ry-list">${s.matches.map(m => { const r = ryMatch(c, m, s.type), side = r.d > 0 ? 0 : r.d < 0 ? 1 : -1;
        return `<li class="${r.done ? 'done' : ''}"><span><b class="ry-c0">${r.A.map(p => esc(p.name)).join(' et ')}</b> <i>contre</i> <b class="ry-c1">${r.B.map(p => esc(p.name)).join(' et ')}</b></span><b class="${side >= 0 ? 'ry-c' + side : ''}">${side >= 0 ? esc(S0[side].name) + ' : ' : ''}${esc(r.txt)}</b>${big ? '' : `<button class="linkbtn" data-mscore="${m.id}" type="button">Pointage</button>`}</li>`; }).join('')}</ul></section>`).join('')}`;
  }
  function bracketHtml(c, B, title, big) {
    return `<section class="card cm-board tb"><h3>${esc(title)}</h3><div class="tb-rounds">${B.rounds.map(rd => `<div class="tb-round"><h4>${esc(rd.name)}</h4>${rd.ms.map(m => `<div class="tb-m ${m.res.winner ? 'done' : ''}">
        <div class="${m.res.winner && m.res.winner === m.a ? 'win' : ''}">${tbName(c, m.a, m.pendA)}</div><div class="${m.res.winner && m.res.winner === m.b ? 'win' : ''}">${tbName(c, m.b, m.pendB)}</div>
        <small>${m.res.bye ? (m.a || m.b ? 'Exempté' : '') : m.res.pend ? 'En attente' : m.res.winner ? esc(m.res.txt) : m.res.egal ? 'Égalité : indiquez le gagnant' : m.res.played ? esc(m.res.txt) : 'À jouer'}</small>
        ${!big && m.a && m.b && !m.res.bye && !m.res.pend ? `<div class="tb-act"><button class="linkbtn" data-mscore="${m.key}" type="button">Pointage</button>${canOrganize() ? `<select data-tbw="${m.key}" aria-label="Gagnant"><option value="">Gagnant…</option><option value="a" ${((c.tableau.manual || {})[m.key] || {}).w === 'a' ? 'selected' : ''}>${esc(m.a.name)}</option><option value="b" ${((c.tableau.manual || {})[m.key] || {}).w === 'b' ? 'selected' : ''}>${esc(m.b.name)}</option></select>` : ''}</div>` : ''}</div>`).join('')}</div>`).join('')}</div>
      ${B.champion ? `<p class="tb-champ">🏆 ${esc(B.champion.name)}</p>` : ''}</section>`;
  }
  // Pointage d'un match (Coupe Ryder ou tableau) : scores bruts de chaque joueur, coups reçus en points
  function matchScoreHtml(c, key) {
    let A, B, type, title;
    if (c.format === 'ryder') { for (const s of c.ryder.sessions) { const m = s.matches.find(x => x.id === key); if (m) { A = m.a.map(id => ryPlayer(c, id)); B = m.b.map(id => ryPlayer(c, id)); type = s.type; title = s.name || RY_COURT[s.type]; } } }
    else { const { main, conso } = tbBrackets(c); for (const Bk of [main, conso].filter(Boolean)) for (const rd of Bk.rounds) for (const m of rd.ms) if (m.key === key) { A = [m.a]; B = [m.b]; type = 'simple'; title = rd.name; } }
    if (!A || !B || !A[0] || !B[0]) return '<p class="note">Match introuvable.</p>';
    const r = playMatch(c.course, compTee(c), A, B, (c.scores || {})[key], type);
    const cols = type === 'alterne' ? [{ n: A.map(p => p.name.split(' ')[0]).join('-'), k: r.ha[0], side: 0 }, { n: B.map(p => p.name.split(' ')[0]).join('-'), k: r.hb[0], side: 1 }]
      : [...A.map((p, i) => ({ n: p.name.split(' ')[0], k: r.ha[i], side: 0 })), ...B.map((p, i) => ({ n: p.name.split(' ')[0], k: r.hb[i], side: 1 }))];
    return `<button class="linkbtn" data-mback type="button">‹ Retour</button>
      <h3 class="ms-t">${esc(title)} : ${A.map(p => esc(p.name)).join(' et ')} <i>contre</i> ${B.map(p => esc(p.name)).join(' et ')}</h3>
      <div class="cm-sum"><span>${esc(RY_COURT[type])}</span><b class="${r.d > 0 ? 'ry-c0' : r.d < 0 ? 'ry-c1' : ''}">${r.d ? esc((r.d > 0 ? A : B).map(p => p.name.split(' ')[0]).join(' et ')) + ' : ' : ''}${esc(r.txt)}</b></div>
      <div class="card-scroll"><table class="sc cm-sc"><thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${cols.map(x => `<th class="ry-c${x.side}">${esc(x.n)}<small>${x.k}</small></th>`).join('')}<th>Match</th></tr></thead>
      <tbody>${r.holes.map(hh => `<tr><td>${hh.h}</td><td>${hh.par}</td><td>${hh.si}</td>${cols.map((x, i) => { const k = L.strokesOnHole(x.k, hh.si); return `<td class="cm-in">${k > 0 ? `<i class="dots">${'•'.repeat(Math.min(k, 3))}</i>` : ''}<input data-ms="${key}.${hh.h}.${i}" type="text" inputmode="numeric" maxlength="2" value="${hh.s[i] == null ? '' : esc(hh.s[i])}" aria-label="Trou ${hh.h}, ${esc(x.n)}"></td>`; }).join('')}<td class="cm-best ${hh.d > 0 ? 'ry-c0' : hh.d < 0 ? 'ry-c1' : ''}">${hh.d == null ? '' : hh.d === 0 ? 'É' : Math.abs(hh.d) + ' UP'}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Entrez les scores bruts. Les points (•) sont les coups reçus dans ce match${type === 'alterne' ? ' (50 % de la somme des deux joueurs)' : type === 'quatre' ? ' (90 % du handicap)' : ''}, à partir du plus bas handicap.</p>`;
  }

  function vComp() {
    const c = S.comp; if (!c) return '<p class="note">Chargement…</p>';
    $('#barTitle').textContent = c.name;
    const head = compHead(c);
    if (c.format === 'ryder' || c.format === 'tableau') {
      if (S.compMatch) return head + matchScoreHtml(c, S.compMatch);
      const tab = ['class', 'teams'].includes(S.compTab) ? S.compTab : 'class';
      const t = tabsHtml(tab, [['class', c.format === 'ryder' ? 'Pointage de la coupe' : 'Tableau'], ['teams', c.format === 'ryder' ? 'Camps' : 'Joueurs']]);
      if (tab === 'class') {
        if (c.format === 'ryder') return head + t + ryderBoardHtml(c) + outilsHtml();
        const { main, conso } = tbBrackets(c);
        return head + t + bracketHtml(c, main, 'Tableau principal') + (conso ? bracketHtml(c, conso, 'Consolation') : '') + '<p class="note">Touchez « Pointage » pour entrer un match trou par trou ; l’organisateur peut aussi choisir le gagnant (trous supplémentaires, forfait).</p>' + outilsHtml();
      }
      if (c.format === 'ryder') return head + t + `<div class="ry-sides">${c.ryder.sides.map((s, k) => `<div class="card ry-side ry-${k}"><h3>${esc(s.name)}</h3>${s.p.filter(p => p.name).map(p => `<div>${esc(p.name)} <small>index ${String(p.index).replace('.', ',')}</small></div>`).join('')}</div>`).join('')}</div>` + orgHtml();
      return head + t + `<div class="list">${tbSeeds(c).map((p, i) => `<div class="item"><b>${i + 1}. ${esc(p.name)}</b><span>index ${String(p.index).replace('.', ',')}</span></div>`).join('')}</div>` + orgHtml();
    }
    const tab = S.compTab || 'class', R = Math.min(S.compRound || 0, nRounds(c) - 1);
    const rsel = nRounds(c) > 1 ? `<div class="seg cm-rounds">${tab === 'class' ? `<button class="${S.compRound == null || S.compRound === 'total' ? 'on' : ''}" data-cround="total" type="button">Cumul</button>` : ''}${Array.from({ length: nRounds(c) }, (_, i) => `<button class="${(tab === 'class' ? S.compRound === i : R === i) ? 'on' : ''}" data-cround="${i}" type="button">Ronde ${i + 1}</button>`).join('')}</div>` : '';
    const t = tabsHtml(tab, [['class', 'Classement'], ['score', 'Pointage'], ['teams', 'Équipes']]);
    if (tab === 'class' && eff(c) === 'match') return head + t + matchBoardHtml(c) +
      '<p class="note">Chaque équipe affronte toutes les équipes de sa classe en match play, meilleure balle nette. Match gagné : 1 point ; nul : ½. G-N-P = gagnés, nuls, perdus. Égalité de points : on départage par les trous gagnés. Les coups se donnent à partir du plus bas handicap de jeu des quatre joueurs du match.</p>' + outilsHtml();
    if (tab === 'class') return head + t + rsel + boardHtml(c, typeof S.compRound === 'number' ? Math.min(S.compRound, nRounds(c) - 1) : null) +
      `<p class="note">${eff(c) === 'stableford' ? 'Stableford, meilleure balle nette : à chaque trou, le meilleur joueur de l’équipe compte. Normale nette 2 points, oiselet net 3, aigle net 4, boguey net 1, double boguey ou pire 0. Le plus de points gagne. ' : ''}É = égalité. F = parcours terminé. Le classement se met à jour en direct pendant que les équipes entrent leurs scores.</p>` + outilsHtml();
    const fl = compFlights(c, R);
    if (tab === 'teams') return head + t + `<div class="list">${fl.map(f => f.teams.map(x => `<div class="item"><b>${teamLabel(x.t)}</b><span>${esc(f.name)}${x.t.dep ? ' · départ ' + esc(x.t.dep) : ''} · ${eff(c) === 'texas' ? `hcp d’équipe ${x.ph} · ` + x.t.p.map(p => `${esc(p.name)} : index ${String(p.index).replace('.', ',')}`).join(' · ') : x.ps.map(p => `${esc(p.name)} : index ${String(p.index).replace('.', ',')}, hcp de jeu ${p.ph}`).join(' · ')}</span></div>`).join('')).join('')}</div>` + orgHtml();
    // Pointage d'une équipe, pour la ronde choisie
    const teams = (c.teams || []), tid = S.compTeam && teams.find(x => x.id === S.compTeam) ? S.compTeam : (teams[0] || {}).id, tm = teams.find(x => x.id === tid);
    if (!tm) return head + t + '<p class="note">Aucune équipe.</p>';
    const r = compTeamResult(c, tm, R), sel = `<label>Équipe<select id="cmTeamSel">${teams.map(x => `<option value="${esc(x.id)}" ${x.id === tid ? 'selected' : ''}>${teamLabel(x)}</option>`).join('')}</select></label>`;
    if (eff(c) === 'texas') return head + t + rsel + sel + `<div class="cm-sum">${sumHtml(c, r)}</div>
      <p class="note tx-drv">Départs : ${drivesTxt(c, r)}${c.minDrives ? ` (minimum ${c.minDrives} chacun)` : ''}</p>
      <div class="card-scroll"><table class="sc cm-sc tx"><thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th><th>Score de l’équipe</th><th>Départ de</th><th>Net</th></tr></thead>
      <tbody>${r.holes.map(hh => { const k = L.strokesOnHole(r.ph, hh.si); return `<tr><td>${hh.h}</td><td>${hh.par}</td><td>${hh.si}</td>
        <td class="cm-in">${k > 0 ? `<i class="dots">${'•'.repeat(Math.min(k, 3))}</i>` : ''}<input data-tx="${hh.h}" type="text" inputmode="numeric" maxlength="2" value="${hh.g == null ? '' : hh.g}" aria-label="Trou ${hh.h}, score de l’équipe"></td>
        <td><select data-td="${hh.h}" aria-label="Trou ${hh.h}, départ de"><option value="">—</option>${tm.p.map((p, i) => `<option value="${i}" ${hh.dv === i ? 'selected' : ''}>${prenom(p.name)}</option>`).join('')}</select></td>
        <td class="cm-best ${hh.best != null && hh.best < hh.par ? 'under' : ''}">${hh.best == null ? '' : hh.best}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">Entrez le score de l’équipe (une seule balle) et le joueur dont le départ a été choisi. Les points (•) sont les coups reçus par l’équipe.</p>`;
    return head + t + rsel + sel + `<div class="cm-sum">${sumHtml(c, r)}</div>
      <div class="card-scroll"><table class="sc cm-sc"><thead><tr><th>Trou</th><th>Norm.</th><th>Hcp</th>${r.ps.map(p => `<th>${prenom(p.name)}<small>${p.ph}</small></th>`).join('')}<th>Équipe</th></tr></thead>
      <tbody>${r.holes.map(hh => `<tr><td>${hh.h}</td><td>${hh.par}</td><td>${hh.si}</td>${r.ps.map((p, i) => { const k = L.strokesOnHole(p.ph, hh.si); return `<td class="cm-in">${k > 0 ? `<i class="dots">${'•'.repeat(Math.min(k, 3))}</i>` : ''}<input data-cms="${hh.h}.${i}" type="text" inputmode="numeric" maxlength="2" value="${hh.s[i] == null ? '' : esc(hh.s[i])}" aria-label="Trou ${hh.h}, ${esc(p.name)}"></td>`; }).join('')}<td class="cm-best ${hh.best != null && hh.best < hh.par ? 'under' : ''}">${hh.best == null ? '' : hh.best}${eff(c) === 'stableford' && hh.sp != null ? `<small>${hh.sp} pt${hh.sp > 1 ? 's' : ''}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Entrez les scores bruts. Les points (•) sont les coups reçus avec le plein handicap de jeu ; la colonne Équipe montre le meilleur score net du trou.${eff(c) !== 'match' ? '' : ' En match play, l’app recalcule les coups de chaque match à partir du plus bas handicap des quatre joueurs.'}</p>`;
  }
  // ==== src/golf/ecran-tele.js ====
  // ---------- Écran télé : classement plein écran, en direct, les classes défilent ----------
  function vCompTv() {
    const c = S.comp; if (!c) return '<p class="note">Chargement…</p>';
    $('#barTitle').textContent = c.name;
    let inner;
    if (c.format === 'ryder') inner = ryderBoardHtml(c, true);
    else if (c.format === 'tableau') { const { main, conso } = tbBrackets(c); inner = bracketHtml(c, main, 'Tableau principal', true) + (conso ? bracketHtml(c, conso, 'Consolation', true) : ''); }
    else if (eff(c) === 'match') inner = matchBoardHtml(c);
    else inner = boardHtml(c, null);
    return `<div class="tv"><div class="tv-top"><h1>${esc(c.name)}</h1><span>${esc(c.course.name)} · ${esc(dateLong(c.date))}</span><span class="tv-live">● En direct</span><button class="btn ghost small" data-tvquit type="button">Fermer</button></div><div class="tv-body">${inner}</div></div>`;
  }
  // ==== src/golf/impressions.js ====
  // ---------- Impressions : cartes de pointage et affiches de voiturette ----------
  function imprimer(c, kind) {
    const tee = compTee(c), holes = c.course.holes, par = h => L.holePar(c.course, tee, h);
    const units = c.format === 'ryder' ? c.ryder.sessions.flatMap(s => s.matches.map(m => ({ titre: `${s.name || RY_COURT[s.type]}`, ps: [...m.a.map(id => ({ ...ryPlayer(c, id), camp: c.ryder.sides[0].name })), ...m.b.map(id => ({ ...ryPlayer(c, id), camp: c.ryder.sides[1].name }))], ph: null, dep: '' })))
      : c.format === 'tableau' ? (() => { const { main } = tbBrackets(c); const rd = main.rounds.find(r => r.ms.some(m => m.a && m.b && !m.res.winner)) || main.rounds[0]; return rd.ms.filter(m => m.a && m.b).map(m => ({ titre: rd.name, ps: [m.a, m.b], dep: '' })); })()
      : (c.teams || []).map((t, i) => { const r = compTeamResult(c, t, 0); return { titre: 'Équipe ' + (i + 1), ps: eff(c) === 'texas' ? t.p.map(p => ({ ...p, ph: null })) : r.ps, teamPh: eff(c) === 'texas' ? r.ph : null, dep: t.dep || '' }; });
    const fmt = esc(fmtName(c.format)) + (c.format === 'invite' ? ' · ' + ({ match: 'match play', stableford: 'Stableford', coups: 'en coups' })[c.jeu || 'match'] : '');
    const carte = u => {
      const row = (lab, f) => `<tr><th>${lab}</th>${holes.slice(0, 9).map((_, i) => `<td>${f(i + 1)}</td>`).join('')}<td class="s">${''}</td>${holes.slice(9).map((_, i) => `<td>${f(i + 10)}</td>`).join('')}<td class="s"></td><td class="s"></td></tr>`;
      const pts = (ph, h) => { const k = ph == null ? 0 : L.strokesOnHole(ph, holes[h - 1].si); return k ? '•'.repeat(Math.min(k, 3)) : ''; };
      return `<section class="carte"><header><b>${esc(c.name)}</b><span>${esc(u.titre)}${u.dep ? ' · départ ' + esc(u.dep) : ''}</span><span>${esc(c.course.name)} · tertre ${esc(c.tee)} · ${esc(dateLong(c.date))}</span><span>${fmt}${u.teamPh != null ? ' · hcp d’équipe ' + u.teamPh : ''}</span></header>
        <table><thead><tr><th>Trou</th>${holes.slice(0, 9).map((_, i) => `<th>${i + 1}</th>`).join('')}<th class="s">Aller</th>${holes.slice(9).map((_, i) => `<th>${i + 10}</th>`).join('')}<th class="s">Ret.</th><th class="s">Total</th></tr></thead><tbody>
        ${row('Normale', par)}${row('Hcp', h => holes[h - 1].si)}
        ${u.ps.map(p => row(`${esc(p.name)}${p.camp ? ` <small>${esc(p.camp)}</small>` : ''}${p.ph != null ? ` <small>(${p.ph})</small>` : ''}`, h => `<i>${pts(p.ph, h)}</i>`)).join('')}
        ${eff(c) === 'texas' && c.format !== 'ryder' && c.format !== 'tableau' ? row('Équipe', h => `<i>${pts(u.teamPh, h)}</i>`) + row('Départ de', () => '') : ''}
        </tbody></table><footer>Marqueur : ____________________ Joueur : ____________________ · Les points (•) sont les coups reçus.</footer></section>`;
    };
    const affiche = u => `<section class="affiche"><small>${esc(c.name)}</small><h1>${u.ps.map(p => esc(p.name)).join('<br>')}</h1><p>${esc(u.titre)}${u.dep ? ' · départ ' + esc(u.dep) : ''}</p><small>${esc(c.course.name)} · ${esc(dateLong(c.date))}</small></section>`;
    const css = `@page{size:${kind === 'affiches' ? 'letter landscape' : 'letter'};margin:12mm}body{font-family:Inter,Arial,sans-serif;color:#111;margin:0}
      .carte{page-break-inside:avoid;border:1.5px solid #222;border-radius:6px;padding:8px;margin:0 0 10mm}.carte header{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;margin-bottom:6px}.carte header b{font-size:14px;width:100%}
      .carte table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}.carte thead th:first-child,.carte tbody th{width:24%}.carte th,.carte td{border:1px solid #999;text-align:center;height:22px;padding:0 2px}.carte tbody th{text-align:left;white-space:nowrap;padding:0 4px;max-width:120px}.carte .s{background:#eee;width:30px}.carte i{font-style:normal;font-size:9px;vertical-align:top;float:right}.carte small{font-weight:400;color:#555}.carte footer{font-size:10px;margin-top:6px;color:#444}
      .affiche{page-break-after:always;height:170mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:3px solid #0d4a2e;border-radius:14px}.affiche h1{font-size:44px;line-height:1.15;margin:12px 0}.affiche p{font-size:22px;margin:0 0 10px}.affiche small{font-size:16px;color:#333}`;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(c.name)} · ${kind === 'affiches' ? 'Affiches' : 'Cartes de pointage'}</title><style>${css}</style></head><body>${units.map(kind === 'affiches' ? affiche : carte).join('')}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`;
    const w = window.open('', '_blank'); if (!w) return toast('Permettez les fenêtres surgissantes pour imprimer.');
    w.document.open(); w.document.write(html); w.document.close();
  }

  function openComp(id) {
    if (S.unwatchComp) { S.unwatchComp(); S.unwatchComp = null; }
    S.comp = null; S.compTab = S.compTab || 'class'; S.confirmDelComp = false; S.compMatch = null; S.compRound = null;
    go('comp');
    // Pendant qu'on entre des scores, l'écran ne se redessine pas (on garderait la case active) ; le classement, lui, suit en direct
    S.unwatchComp = Store.watchComp(id, c => { const first = !S.comp; S.comp = c; if (!['comp', 'compTv'].includes(S.view)) return; if (!first && S.view === 'comp' && ((S.compTab || 'class') === 'score' || S.compMatch)) return; render(); });
  }
  const draftOf = c => ({ id: c.id, format: c.format || 'match', jeu: c.jeu || 'match', teamSize: c.teamSize, minDrives: c.minDrives, name: c.name, date: c.date, courseId: c.courseId, tee: c.tee, allowance: c.allowance, flights: c.flights,
    teams: JSON.parse(JSON.stringify(c.teams || [])), rounds: (c.rounds || []).map(r => ({ date: r.date, courseId: r.courseId, tee: r.tee })), ryder: c.ryder ? JSON.parse(JSON.stringify(c.ryder)) : undefined, tableau: c.tableau ? JSON.parse(JSON.stringify(c.tableau)) : undefined });

  Object.assign(bind, {
    comps(v) {
      v.querySelectorAll('[data-comp]').forEach(b => b.onclick = () => openComp(b.dataset.comp));
      v.querySelectorAll('[data-go="comps"]').forEach(b => b.onclick = () => go('comps', { compLive: false }));
      v.querySelectorAll('[data-merit]').forEach(b => b.onclick = () => { S.meritYear = +b.dataset.merit; render(); });
      v.querySelectorAll('[data-compnew]').forEach(n => n.onclick = () => go('compEdit', { compDraft: newCompDraft(n.dataset.compnew || 'match') }));
    },
    compEdit(v) {
      const d = S.compDraft; if (!d || !$('#cmFmt')) return;
      const val = s => { const e = $(s); return e ? e.value : null; };
      const sync = () => {
        d.name = val('#cmName'); d.date = val('#cmDate'); d.tee = val('#cmTee');
        if ($('#cmJeu')) d.jeu = val('#cmJeu');
        if ($('#cmSize')) d.teamSize = +val('#cmSize'); if ($('#cmMinDr')) d.minDrives = +val('#cmMinDr');
        if ($('#cmAllow')) d.allowance = +val('#cmAllow'); if ($('#cmFl')) d.flights = +val('#cmFl');
        v.querySelectorAll('[data-rdate]').forEach(i => { d.rounds[+i.dataset.rdate].date = i.value; });
        v.querySelectorAll('[data-rtee]').forEach(i => { d.rounds[+i.dataset.rtee].tee = i.value; });
        v.querySelectorAll('[data-cmn]').forEach(i => { const [a, b] = i.dataset.cmn.split('.'); d.teams[a].p[b].name = i.value.trim(); });
        v.querySelectorAll('[data-cmi]').forEach(i => { const [a, b] = i.dataset.cmi.split('.'); d.teams[a].p[b].index = i.value.trim(); });
        v.querySelectorAll('[data-cmdep]').forEach(i => { d.teams[+i.dataset.cmdep].dep = i.value.trim(); });
        v.querySelectorAll('[data-ryname]').forEach(i => { d.ryder.sides[+i.dataset.ryname].name = i.value.trim() || ['Rouges', 'Bleus'][+i.dataset.ryname]; });
        v.querySelectorAll('[data-ryn]').forEach(i => { const [k, j] = i.dataset.ryn.split('.'); d.ryder.sides[k].p[j].name = i.value.trim(); });
        v.querySelectorAll('[data-ryi]').forEach(i => { const [k, j] = i.dataset.ryi.split('.'); d.ryder.sides[k].p[j].index = i.value.trim(); });
        v.querySelectorAll('[data-msel]').forEach(i => { const [si, mi, side, q] = i.dataset.msel.split('.'); d.ryder.sessions[si].matches[mi][side][q] = i.value; });
        v.querySelectorAll('[data-tbn]').forEach(i => { d.tableau.entrants[+i.dataset.tbn].name = i.value.trim(); });
        v.querySelectorAll('[data-tbi]').forEach(i => { d.tableau.entrants[+i.dataset.tbi].index = i.value.trim(); });
        if ($('#tbSeed')) d.tableau.seeding = val('#tbSeed'); if ($('#tbConso')) d.tableau.consolation = $('#tbConso').checked;
      };
      // Nom choisi dans la liste du groupe : on reprend le dernier index connu de ce joueur
      v.querySelectorAll('[data-cmn],[data-ryn],[data-tbn]').forEach(i => i.addEventListener('change', () => { const last = (ls.get('pelland.lastPlayers', []) || []).find(p => p && L.norm(p.name || '') === L.norm(i.value)); const ix = i.nextElementSibling; if (last && last.index && ix && !ix.value) ix.value = last.index; }));
      $('#cmFmt').onchange = () => { sync(); const keep = { id: d.id, name: d.name, date: d.date, courseId: d.courseId, tee: d.tee }; const n = newCompDraft($('#cmFmt').value);
        const people = [...(d.teams || []).flatMap(t => t.p), ...((d.ryder || {}).sides || []).flatMap(s => s.p), ...((d.tableau || {}).entrants || [])].filter(p => p.name);
        Object.assign(d, n, keep, { name: n.name }); if (keep.id) d.name = keep.name;
        if (people.length && !['ryder', 'tableau'].includes(d.format)) { const k = teamSizeOf(d); d.teams = []; for (let i = 0; i < people.length; i += k) d.teams.push({ id: uid6(), dep: '', p: Array.from({ length: k }, (_, j) => people[i + j] ? { name: people[i + j].name, index: people[i + j].index } : { name: '', index: '' }) }); }
        if (people.length && d.format === 'tableau') d.tableau.entrants = people.map(p => ({ id: uid6(), name: p.name, index: p.index }));
        render(); };
      if ($('#cmJeu')) $('#cmJeu').onchange = () => { sync(); d.allowance = d.jeu === 'match' ? 90 : 85; if (d.jeu === 'match') d.rounds = []; render(); };
      $('#cmCourse').onchange = e => { sync(); d.courseId = e.target.value; const cc = S.courses.find(x => x.id === d.courseId); d.tee = ((cc && cc.tees[0]) || {}).name; render(); };
      v.querySelectorAll('[data-rcourse]').forEach(s => s.onchange = () => { sync(); const r = d.rounds[+s.dataset.rcourse]; r.courseId = s.value; const cc = S.courses.find(x => x.id === r.courseId); r.tee = ((cc && cc.tees[0]) || {}).name; render(); });
      if ($('#cmRoundAdd')) $('#cmRoundAdd').onclick = () => { sync(); const prev = d.rounds.length ? d.rounds[d.rounds.length - 1] : { date: d.date, courseId: d.courseId, tee: d.tee }; const nd = prev.date ? new Date(new Date(prev.date + 'T12:00').getTime() + 864e5).toISOString().slice(0, 10) : ''; d.rounds.push({ date: nd, courseId: prev.courseId, tee: prev.tee }); render(); };
      v.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => { sync(); d.rounds.splice(+b.dataset.rdel, 1); render(); });
      if ($('#cmAllow')) $('#cmAllow').onchange = () => { sync(); render(); };
      const resize = n => d.teams.forEach(t => { while (t.p.length < n) t.p.push({ name: '', index: '' }); t.p.length = n; });
      if ($('#cmSize')) $('#cmSize').onchange = () => { sync(); resize(d.teamSize); render(); };
      if ($('#cmAdd')) $('#cmAdd').onclick = () => { sync(); d.teams.push(blankTeam(teamSizeOf(d))); render(); };
      v.querySelectorAll('[data-cmdel]').forEach(b => b.onclick = () => { sync(); d.teams.splice(+b.dataset.cmdel, 1); render(); });
      v.querySelectorAll('[data-balance]').forEach(b => b.onclick = () => { sync(); balanceSheet(b.dataset.balance); });
      // Coupe Ryder
      v.querySelectorAll('[data-ryadd]').forEach(b => b.onclick = () => { sync(); d.ryder.sides[+b.dataset.ryadd].p.push({ id: uid6(), name: '', index: '' }); render(); });
      v.querySelectorAll('[data-rypop]').forEach(b => b.onclick = () => { sync(); const s = d.ryder.sides[+b.dataset.rypop], gone = s.p.pop(); d.ryder.sessions.forEach(x => x.matches = x.matches.filter(m => ![...m.a, ...m.b].includes(gone.id))); render(); });
      if ($('#rySessAdd')) $('#rySessAdd').onclick = () => { sync(); const type = val('#rySessType'), named = { ...d, ryder: { ...d.ryder, sides: d.ryder.sides.map(s => ({ ...s, p: s.p.filter(p => p.name) })) } };
        const ms = ryAutoMatches(named, type); if (!ms.length) return toast(type === 'simple' ? 'Nommez au moins un joueur dans chaque camp.' : 'Nommez au moins deux joueurs dans chaque camp.');
        const nType = d.ryder.sessions.filter(s => s.type === type).length; d.ryder.sessions.push({ id: uid6(), type, name: RY_COURT[type] + (nType ? ' ' + (nType + 1) : ''), matches: ms }); render(); };
      v.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { sync(); d.ryder.sessions.splice(+b.dataset.sdel, 1); render(); });
      v.querySelectorAll('[data-sregen]').forEach(b => b.onclick = () => { sync(); const s = d.ryder.sessions[+b.dataset.sregen]; s.matches = ryAutoMatches({ ...d, ryder: { ...d.ryder, sides: d.ryder.sides.map(x => ({ ...x, p: x.p.filter(p => p.name) })) } }, s.type); render(); });
      // Tableau
      if ($('#tbAdd')) $('#tbAdd').onclick = () => { sync(); for (let i = 0; i < 4; i++) d.tableau.entrants.push({ id: uid6(), name: '', index: '' }); render(); };
      $('#cmCancel').onclick = () => d.id ? openComp(d.id) : go('comps', { compList: null });
      $('#cmSave').onclick = async () => {
        sync();
        if (!d.name.trim()) return toast('Donnez un nom à la compétition.');
        const course = S.courses.find(x => x.id === d.courseId) || S.courses[0];
        if (!course) return toast('Ajoutez d’abord un terrain dans Terrains.');
        const needIdx = p => parseIdx(p.index) == null ? toast(`Entrez l’index de ${p.name} (ex. 12,4).`) || true : false;
        let extra = {};
        if (d.format === 'ryder') {
          const sides = d.ryder.sides.map(s => ({ name: s.name, p: s.p.filter(p => p.name) }));
          if (sides.some(s => !s.p.length)) return toast('Chaque camp a besoin d’au moins un joueur.');
          for (const s of sides) for (const p of s.p) if (needIdx(p)) return;
          extra = { ryder: { sides, sessions: d.ryder.sessions.map(s => ({ ...s, matches: s.matches.filter(m => [...m.a, ...m.b].every(id => sides.some(x => x.p.some(p => p.id === id)))) })) }, teams: [] };
        } else if (d.format === 'tableau') {
          const E = d.tableau.entrants.filter(e => e.name);
          if (E.length < 3) return toast('Il faut au moins 3 joueurs dans le tableau.');
          for (const p of E) if (needIdx(p)) return;
          const old = S.comp && d.id ? S.comp.tableau || {} : {};
          const order = d.tableau.seeding === 'tirage' ? ((old.order || []).length && E.every(e => (old.order || []).includes(e.id)) ? old.order : E.map(e => e.id).sort(() => Math.random() - 0.5)) : null;
          extra = { tableau: { entrants: E, seeding: d.tableau.seeding, consolation: !!d.tableau.consolation, manual: old.manual || {}, ...(order ? { order } : {}) }, teams: [] };
        } else {
          const teams = d.teams.filter(t => t.p.some(p => p.name));
          for (const t of teams) for (const p of t.p) { if (!p.name) return toast(`Chaque équipe a besoin de ${t.p.length} joueurs.`); if (needIdx(p)) return; }
          if (teams.length < 2) return toast('Il faut au moins deux équipes.');
          const rounds = (['coups', 'stableford', 'texas', 'scramble'].includes(d.format) || d.format === 'invite' && d.jeu !== 'match') ? d.rounds.map(r => { const cc = S.courses.find(x => x.id === r.courseId) || course; return { date: r.date || d.date, courseId: cc.id, course: JSON.parse(JSON.stringify(cc)), tee: r.tee || (cc.tees[0] || {}).name }; }) : [];
          extra = { teams, rounds };
        }
        const c = { ...(d.id ? S.comp : {}), id: d.id || Date.now().toString(36), groupId: Store.gid, kind: d.format === 'invite' ? 'membre-invite' : d.format === 'ryder' ? 'ryder' : d.format === 'tableau' ? 'tableau' : 'membre-membre', format: d.format || 'match',
          jeu: d.format === 'invite' ? (d.jeu || 'match') : null, name: d.name.trim(), date: d.date, courseId: course.id, course: JSON.parse(JSON.stringify(course)), tee: d.tee, allowance: d.allowance, flights: d.flights,
          teamSize: ['texas', 'scramble'].includes(d.format) ? (d.format === 'scramble' ? 4 : d.teamSize || 4) : 2, minDrives: d.format === 'texas' ? (d.minDrives == null ? 3 : d.minDrives) : d.format === 'scramble' ? 0 : null,
          by: ls.get('pelland.me', '') || '', createdAt: (S.comp && d.id && S.comp.createdAt) || Date.now(), ...extra };
        try { await Store.saveComp(c); S.compList = null; openComp(c.id); toast(d.id ? 'Compétition modifiée.' : 'Compétition créée.');
          if (!d.id) Push.notify({ title: 'Nouvelle compétition : ' + c.name, body: `${c.course.name}, ${dateLong(c.date)}. Suivez le classement en direct.`, url: './', tag: 'comp-' + c.id }); } catch (e) { toast('Enregistrement impossible : ' + e.message); }
      };
    },
    comp(v) {
      v.querySelectorAll('[data-ctab]').forEach(b => b.onclick = () => { S.compTab = b.dataset.ctab; S.compMatch = null; render(); });
      v.querySelectorAll('[data-cround]').forEach(b => b.onclick = () => { S.compRound = b.dataset.cround === 'total' ? null : +b.dataset.cround; render(); });
      const sel = v.querySelector('#cmTeamSel'); if (sel) sel.onchange = () => { S.compTeam = sel.value; render(); };
      const ed = v.querySelector('[data-cedit]'); if (ed) ed.onclick = () => go('compEdit', { compDraft: draftOf(S.comp) });
      const dl = v.querySelector('[data-cdel]'); if (dl) dl.onclick = () => { S.confirmDelComp = true; render(); };
      const dok = v.querySelector('[data-cdelok]'); if (dok) dok.onclick = async () => { try { await Store.deleteComp(S.comp.id); if (S.unwatchComp) { S.unwatchComp(); S.unwatchComp = null; } go('comps', { compList: null }); toast('Compétition effacée.'); } catch (e) { toast('Impossible : ' + e.message); } };
      const tv = v.querySelector('[data-tv]'); if (tv) tv.onclick = () => { go('compTv'); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } };
      v.querySelectorAll('[data-print]').forEach(b => b.onclick = () => imprimer(S.comp, b.dataset.print));
      v.querySelectorAll('[data-mscore]').forEach(b => b.onclick = () => { S.compMatch = b.dataset.mscore; render(); window.scrollTo(0, 0); });
      const mb = v.querySelector('[data-mback]'); if (mb) mb.onclick = () => { S.compMatch = null; render(); };
      // Gagnant d'un match du tableau indiqué par l'organisateur
      v.querySelectorAll('[data-tbw]').forEach(s => s.onchange = async () => {
        const c = S.comp, k = s.dataset.tbw, man = { ...(c.tableau.manual || {}) };
        if (s.value) man[k] = { w: s.value, txt: 'Gagné' }; else delete man[k];
        c.tableau = { ...c.tableau, manual: man }; render();
        try { await Store.setCompField(c.id, 'tableau.manual', man); } catch (e) { toast('Non enregistré : ' + e.message); }
      });
      // Pointage d'un match (Coupe Ryder, tableau) : [scores des joueurs], mis à jour sur place
      const msAll = [...v.querySelectorAll('[data-ms]')];
      msAll.forEach((inp, k) => inp.addEventListener('input', () => { const x = inp.value.trim(); if ((x.length === 1 && x !== '1') || x.length === 2) { const nx = msAll[k + 1]; if (nx) nx.focus(); } }));
      msAll.forEach(inp => inp.onchange = async () => {
        const [key, h, i] = inp.dataset.ms.split('.'), c = S.comp, raw = inp.value.trim(), val = raw === '' ? null : parseInt(raw, 10);
        if (raw !== '' && !(val >= 1 && val <= 15)) { toast('Score invalide.'); inp.value = ''; return; }
        const n = v.querySelectorAll(`[data-ms^="${key}.${h}."]`).length, cur = ((c.scores || {})[key] || {})[h] || [], arr = Array.from({ length: n }, (_, j) => cur[j] == null ? null : cur[j]); arr[+i] = val;
        c.scores = c.scores || {}; c.scores[key] = c.scores[key] || {}; c.scores[key][h] = arr;
        const sm = v.querySelector('.cm-sum b'); const keep = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.ms : null;
        try { await Store.setCompScore(c.id, key, +h, arr); } catch (e) { toast('Score non enregistré : ' + e.message); }
        render(); if (keep) { const el = document.querySelector(`[data-ms="${keep}"]`); if (el) el.focus(); }
        void sm;
      });
      // Texas scramble : score de l'équipe et départ choisi, enregistrés ensemble [score, joueur]
      const R = () => Math.min(S.compRound || 0, nRounds(S.comp) - 1);
      const tidOf = c => S.compTeam && c.teams.find(t => t.id === S.compTeam) ? S.compTeam : c.teams[0].id;
      const txSave = async h => {
        const c = S.comp, tid = tidOf(c), t = c.teams.find(x => x.id === tid), key = skey(t, R());
        const gi = v.querySelector(`[data-tx="${h}"]`), di = v.querySelector(`[data-td="${h}"]`), raw = gi.value.trim(), g = raw === '' ? null : parseInt(raw, 10);
        if (raw !== '' && !(g >= 1 && g <= 15)) { toast('Score invalide.'); gi.value = ''; return; }
        const arr = [g, di.value === '' ? null : +di.value];
        c.scores = c.scores || {}; c.scores[key] = c.scores[key] || {}; c.scores[key][h] = arr;
        const r = compTeamResult(c, t, R()), hh = r.holes[h - 1];
        const cell = gi.closest('tr').querySelector('.cm-best'); cell.textContent = hh.best == null ? '' : hh.best; cell.classList.toggle('under', hh.best != null && hh.best < hh.par);
        const sm = v.querySelector('.cm-sum'); if (sm) sm.innerHTML = sumHtml(c, r);
        const dr = v.querySelector('.tx-drv'); if (dr) dr.innerHTML = 'Départs : ' + drivesTxt(c, r) + (c.minDrives ? ` (minimum ${c.minDrives} chacun)` : '');
        try { await Store.setCompScore(c.id, key, h, arr); } catch (e) { toast('Score non enregistré : ' + e.message); }
      };
      v.querySelectorAll('[data-tx]').forEach(i => { i.onchange = () => txSave(+i.dataset.tx); i.addEventListener('input', () => { const x = i.value.trim(); if ((x.length === 1 && x !== '1') || x.length === 2) { const s2 = v.querySelector(`[data-td="${i.dataset.tx}"]`); if (s2) s2.focus(); } }); });
      v.querySelectorAll('[data-td]').forEach(s2 => s2.onchange = () => { txSave(+s2.dataset.td); const nx = v.querySelector(`[data-tx="${+s2.dataset.td + 1}"]`); if (nx) nx.focus(); });
      const all = [...v.querySelectorAll('[data-cms]')];
      all.forEach((inp, k) => inp.addEventListener('input', () => { const x = inp.value.trim(); if ((x.length === 1 && x !== '1') || x.length === 2) { const nx = all[k + 1]; if (nx) nx.focus(); } }));
      all.forEach(inp => {
        inp.onchange = async () => {
          const [h, i] = inp.dataset.cms.split('.').map(Number), c = S.comp, tid = tidOf(c), t = c.teams.find(x => x.id === tid), key = skey(t, R());
          const raw = inp.value.trim(), val = raw === '' ? null : parseInt(raw, 10);
          if (raw !== '' && !(val >= 1 && val <= 15)) { toast('Score invalide.'); inp.value = ''; return; }
          const cur = ((c.scores || {})[key] || {})[h] || [null, null], arr = [cur[0] == null ? null : cur[0], cur[1] == null ? null : cur[1]]; arr[i] = val;
          c.scores = c.scores || {}; c.scores[key] = c.scores[key] || {}; c.scores[key][h] = arr;
          // Mise à jour sur place (sans redessiner l'écran, pour ne pas perdre la case où l'on tape)
          const r = compTeamResult(c, t, R()), hh = r.holes[h - 1];
          const cell = inp.closest('tr').querySelector('.cm-best'); cell.textContent = hh.best == null ? '' : hh.best; cell.classList.toggle('under', hh.best != null && hh.best < hh.par);
          if (eff(c) === 'stableford') cell.innerHTML = hh.best == null ? '' : `${hh.best}<small>${hh.sp} pt${hh.sp > 1 ? 's' : ''}</small>`;
          const sm = v.querySelector('.cm-sum'); if (sm) sm.innerHTML = sumHtml(c, r);
          try { await Store.setCompScore(c.id, key, h, arr); } catch (e) { toast('Score non enregistré : ' + e.message); }
        };
      });
    },
    compTv(v) {
      const q = v.querySelector('[data-tvquit]'); if (q) q.onclick = () => { try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { } go('comp'); };
      // Les classes défilent toutes les 12 secondes si elles dépassent l'écran
      clearInterval(S.tvTimer); const body = v.querySelector('.tv-body');
      S.tvTimer = setInterval(() => { if (S.view !== 'compTv') return clearInterval(S.tvTimer); if (!body || body.scrollHeight <= body.clientHeight + 4) return; body.scrollTop = body.scrollTop + body.clientHeight >= body.scrollHeight - 4 ? 0 : body.scrollTop + body.clientHeight * 0.85; }, 12000);
    }
  });
  // ==== src/commun/textos-push.js ====
  const SMS_API = MARQUE.api + '/api/sms';
  // =====================================================================
  // Notifications de l'app (Web Push) : gratuites, envoyées par le serveur Fanion aux membres abonnés du groupe
  // =====================================================================
  const PUSH_API = MARQUE.api + '/api/push', PUSH_KEY = 'BOTntJP973w0RiGfVtYr4Lh2Edy0_GwQeqtkp4tLXHez-BEiVKdv0DiBHlKY-0WgPi6zOGeKhdbbBmrH6s_JXzU';
  const Push = {
    supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    // iPhone : les notifications n'existent que pour l'app ajoutée à l'écran d'accueil
    needsInstall() { return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.standalone || (matchMedia && matchMedia('(display-mode: standalone)').matches)); },
    perm() { return 'Notification' in window ? Notification.permission : 'unsupported'; },
    async sub() { try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch (e) { return null; } },
    key() { const s = PUSH_KEY.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); },
    // Abonnement du téléphone avec la clé actuelle (un ancien abonnement fait avec une autre clé est refait)
    async abonner(reg) {
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { const k = sub.options && sub.options.applicationServerKey; const a = k ? new Uint8Array(k) : null, b = this.key(); if (!a || a.length !== b.length || a.some((x, i) => x !== b[i])) { await sub.unsubscribe(); sub = null; } } catch (e) { }
      }
      return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.key() });
    },
    // Abonne ce téléphone ; un document par groupe du compte (subs/<uid>_<groupe>)
    async enable() {
      if (!this.supported()) throw new Error(this.needsInstall() ? 'Ajoutez d’abord l’app à votre écran d’accueil.' : 'Ce navigateur ne reçoit pas les notifications.');
      const p = await Notification.requestPermission();
      if (p !== 'granted') throw new Error('Notifications refusées. Vous pouvez les permettre dans les réglages du téléphone.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await this.abonner(reg);
      await this.save(sub);
      ls.set('pelland.push', 1);
    },
    async save(sub) {
      if (Store.mode !== 'cloud' || !Store.uid) return;
      let mine = []; try { mine = await Store.myPlayers(); } catch (e) { }
      if (!mine.length && meId()) mine = [{ id: meId(), groupId: Store.gid }];
      const js = sub ? JSON.stringify(sub) : '';
      // Groupes quittés : leur abonnement est retiré (on ne reçoit plus rien d'un groupe dont on n'est plus membre)
      const avant = ls.get('pelland.push.groupes', []), maintenant = mine.map(p => p.groupId || 'pelland');
      for (const g of avant.filter(g => !maintenant.includes(g))) { try { await Store.deletePushSub(g); } catch (e) { } }
      ls.set('pelland.push.groupes', maintenant);
      for (const p of mine) { const g = p.groupId || 'pelland'; try { await Store.savePushSub(g, p.id, js, js ? 'actif' : (this.etatAct || 'a_activer')); } catch (e) { console.warn('abonnement', g, e.message); } }
    },
    async disable() {
      const sub = await this.sub(); if (sub) { try { await sub.unsubscribe(); } catch (e) { } }
      ls.set('pelland.push', 0);
      if (Store.mode !== 'cloud' || !Store.uid) return;
      let mine = []; try { mine = await Store.myPlayers(); } catch (e) { }
      const gs = new Set(mine.map(p => p.groupId || 'pelland').concat([Store.gid]));
      for (const g of gs) { try { await Store.deletePushSub(g); } catch (e) { } }
    },
    // Garde l'abonnement à jour (nouveau groupe, abonnement renouvelé par le navigateur)
    // Membre d'un groupe = notifications actives : dès que le téléphone les permet, l'abonnement est (re)fait sans rien demander
    // État vu par l'organisateur (Joueurs) : actif, bloque, a_activer, a_installer, non_supporte
    etat() { return !this.supported() ? (this.needsInstall() ? 'a_installer' : 'non_supporte') : this.perm() === 'denied' ? 'bloque' : this.perm() === 'granted' ? 'actif' : 'a_activer'; },
    async signaler() {
      if (Store.mode !== 'cloud' || !Store.uid) return;
      const e = this.etat(); if (e === 'actif' || ls.get('pelland.push.etat', '') === e + ':' + Store.gid) return;
      this.etatAct = e; try { await this.save(null); ls.set('pelland.push.etat', e + ':' + Store.gid); } catch (x) { }
    },
    async refresh() {
      if (this.perm() !== 'granted' || !this.supported()) return this.signaler();
      if (Store.mode !== 'cloud' || !Store.uid) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const s = await this.abonner(reg);
        await this.save(s); ls.set('pelland.push', 1); ls.set('pelland.push.etat', '');
      } catch (e) { this.etatAct = 'a_activer'; }
    },
    on() { return this.perm() === 'granted' && !!ls.get('pelland.push', 0); },
    // Avertit les membres du groupe (sauf soi) ; playerIds = seulement ces joueurs
    async notify(data) {
      if (Store.mode !== 'cloud' || !Store.uid) return;
      try { const tok = await Store.token(); await fetch(PUSH_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ groupId: Store.gid, ...data }) }); } catch (e) { console.warn('notification', e.message); }
    }
  };
  function pushCard() {
    if (Store.needLogin || Store.mode !== 'cloud') return '';
    if (Push.on()) return '';
    const bloque = Push.perm() === 'denied';
    const install = Push.needsInstall();
    if (!install && !Push.supported()) return '';
    return `<section class="card push-card"><span class="push-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3a6 6 0 0 0-6 6v3.6L4.3 15.4A1 1 0 0 0 5.2 17h13.6a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6z" fill="currentColor"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="currentColor"/></svg></span>
      <div><h3>Activez les notifications du groupe</h3><p>Elles sont obligatoires pour les membres : nouvelles dates, rappels, début des parties et résultats. Elles restent actives tant que vous êtes dans le groupe.</p>
      ${bloque ? '<p class="note"><b>Elles sont bloquées sur ce téléphone.</b> Permettez-les dans les réglages : iPhone, Réglages → Notifications → ' + APP + ' ; Android, appui long sur l’icône ' + MARQUE.duNom + ' → Infos sur l’appli → Notifications. Puis rouvrez l’app.</p>'
        : `<div class="row">${install ? '<button class="btn small" data-onbact="ecran" type="button">Ajouter l’app à l’écran d’accueil</button>' : '<button class="btn small" data-pushon type="button">Activer les notifications</button>'}</div>`}
      ${install ? '<p class="note">Sur iPhone, les notifications fonctionnent une fois l’app ajoutée à l’écran d’accueil. Ouvrez-la ensuite par son icône.</p>' : ''}</div></section>`;
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-pushon]'); if (!t) return;
    e.preventDefault();
    t.disabled = true;
    try { await Push.enable(); toast('Notifications activées.'); } catch (x) { toast(x.message); Push.signaler(); }
    render();
  });

  async function smsService() {
    if (S.smsReady != null) return S.smsReady;
    try { const r = await fetch(SMS_API + '/status'); S.smsReady = r.ok && !!(await r.json()).ready; } catch (e) { S.smsReady = false; }
    return S.smsReady;
  }
  async function openSms(nums, text) {
    nums = (nums || []).filter(Boolean);
    if (Store.mode === 'cloud' && nums.length && await smsService()) {
      try {
        const tok = await Store.token();
        const r = await fetch(SMS_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ to: nums, text }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.sent) { toast(`Texto envoyé à ${d.sent} joueur${d.sent > 1 ? 's' : ''}${(d.failed || []).length ? ` · ${d.failed.length} non envoyé${d.failed.length > 1 ? 's' : ''}` : ''}.`); return; }
        toast('Envoi automatique impossible' + (d.error ? ' : ' + d.error : '') + '. Messages s’ouvre à la place.');
      } catch (e) { }
    }
    openSmsApp(nums, text);
  }
  function openSmsApp(nums, text) {
    const body = encodeURIComponent(text), ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
    const url = ios ? `sms:/open?addresses=${nums.join(',')}&body=${body}` : `sms:${nums.join(',')}?body=${body}`;
    window.__lastSms = url; (window.top || window).location.href = url;
  }
  // ==== src/commun/caddie.js ====
  // ---------------- Le Caddie : l'agent qui répond aux questions (API Claude, par le serveur Fanion) ----------------
  const CADDIE_API = MARQUE.api + '/api/caddie';
  const SCREENS = SPORT.ecrans;
  let caddieReady = null;
  async function caddieStatus() {
    if (caddieReady !== null) return caddieReady;
    try { const r = await fetch(CADDIE_API + '/status'); caddieReady = !!(await r.json()).ready; } catch (e) { caddieReady = false; }
    return caddieReady;
  }
  function caddieMsg(m) {
    let t = String(m.content || ''), go = null;
    t = t.replace(/\[\[ecran:([a-z]+)\]\]/g, (x, k) => { if (SCREENS[k]) go = k; return ''; }).trim();
    const html = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    return `<div class="cad-msg ${m.role === 'assistant' ? 'bot' : 'me'}">${html}${go && m.role === 'assistant' ? `<button class="btn small cad-go" data-cadgo="${go}" type="button">Aller à : ${SCREENS[go]}</button>` : ''}</div>`;
  }
  async function openCaddie() {
    S.caddie = S.caddie || [{ role: 'assistant', content: `Bonjour${firstName(ls.get('pelland.me', '')) ? ' ' + firstName(ls.get('pelland.me', '')) : ''} ! Moi, c’est ${MARQUE.personnage}, ${MARQUE.role}. ${SPORT.leoAccueil}` }];
    const ready = Store.mode === 'cloud' && await caddieStatus();
    const draw = sh => {
      sh.innerHTML = `<div class="cad-id"><span class="cad-av" aria-hidden="true">${window.CaddieGuide ? CaddieGuide.avatar() : ''}</span><div><h3>${MARQUE.personnage}</h3><p class="note">${MARQUE.roleMaj}. Posez votre question sur l’app.</p></div></div>
        <div class="cad-log" id="cadLog">${S.caddie.map(caddieMsg).join('')}${S.caddieBusy ? '<div class="cad-msg bot busy">…</div>' : ''}</div>
        ${ready ? `<form class="cad-form" id="cadForm"><input id="cadIn" type="text" placeholder="Votre question" autocomplete="off" ${S.caddieBusy ? 'disabled' : ''}><button class="btn small" type="submit" ${S.caddieBusy ? 'disabled' : ''}>Envoyer</button></form>
          ${S.caddie.length < 2 ? `<div class="cad-sugg">${SPORT.questionsLeo.map(q => `<button class="chip" data-cadq="${esc(q)}" type="button">${esc(q)}</button>`).join('')}</div>` : ''}`
        : '<p class="note">' + MARQUE.personnage + ' arrive bientôt. En attendant, écrivez-nous : nous répondons rapidement.</p>'}
        ${window.CaddieGuide && !Store.needLogin ? '<p class="note cad-visite"><button class="linkbtn" data-leovisite type="button">Revoir la visite avec ' + MARQUE.personnage + '</button> · <button class="linkbtn" data-idee type="button">Proposer une idée à l’équipe</button></p>' : ''}
        <div class="sheet-actions"><a class="btn ghost" href="${caddieMail()}">Écrire à l’équipe</a><button class="btn ghost" data-close type="button">Fermer</button></div>`;
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelectorAll('[data-cadgo]').forEach(b => b.onclick = () => { closeSheet(); go(b.dataset.cadgo); });
      sh.querySelectorAll('[data-cadq]').forEach(b => b.onclick = () => ask(b.dataset.cadq, sh));
      const vis = sh.querySelector('[data-leovisite]'); if (vis) vis.onclick = () => { closeSheet(); setTimeout(leoVisite, 200); };
      const f = sh.querySelector('#cadForm'); if (f) f.onsubmit = e => { e.preventDefault(); const v = sh.querySelector('#cadIn').value.trim(); if (v) ask(v, sh); };
      const log = sh.querySelector('#cadLog'); if (log) log.scrollTop = log.scrollHeight;
      const i = sh.querySelector('#cadIn'); if (i && !S.caddieBusy) setTimeout(() => i.focus(), 50);
    };
    const ask = async (q, sh) => {
      S.caddie.push({ role: 'user', content: q }); S.caddieBusy = true; draw(sh);
      try {
        const tok = await Store.token();
        const r = await fetch(CADDIE_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ messages: S.caddie.slice(1) }) });
        const d = await r.json().catch(() => ({}));
        S.caddie.push({ role: 'assistant', content: r.ok && d.text ? d.text : (d.error || 'Je n’ai pas pu répondre.') + ' Vous pouvez écrire à l’équipe avec le bouton ci-dessous.' });
      } catch (e) { S.caddie.push({ role: 'assistant', content: 'Pas de réseau pour l’instant. Réessayez dans un moment.' }); }
      S.caddieBusy = false; if (!$('#sheetWrap').hidden) draw(sh);
    };
    openSheet('', sh => draw(sh));
  }
  function caddieMail() {
    const conv = (S.caddie || []).slice(1).map(m => (m.role === 'user' ? 'Moi : ' : MARQUE.personnage + ' : ') + m.content.replace(/\[\[ecran:[a-z]+\]\]/g, '')).join('\n\n');
    const body = `Groupe : ${groupName()}\nJoueur : ${ls.get('pelland.me', '') || ''}\n\n${conv ? 'Ma conversation avec ' + MARQUE.personnage + ', ' + MARQUE.leRole + ' :\n\n' + conv + '\n\n' : ''}Ma question :\n`;
    return 'mailto:' + MARQUE.courriel + '?subject=' + encodeURIComponent(APP + ' – question') + '&body=' + encodeURIComponent(body.slice(0, 1800));
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-caddie]'); if (t) { e.preventDefault(); openCaddie(); } });
  // ==== src/commun/leo.js ====
  // ---------------- Samuel, le caddie en personne : visage dans le coin, salut à l'arrivée, visite guidée ----------------
  let leo = null;
  const LEO_CACHE = ['game', 'setup', 'compEdit', 'comp', 'compTv', 'offre', 'login', 'join', 'jeuEdit', 'course'];   // écrans de saisie : on ne cache rien
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = k => { try { sessionStorage.setItem(k, '1'); } catch (e) { } };
  const visiteKey = () => 'fanion.leo.visite.' + (Store.uid || meId() || '');
  function leoApres() {
    if (!window.CaddieGuide) return;
    const off = Store.needLogin || !meId() || LEO_CACHE.includes(S.view);
    if (off) { if (leo) leo.cacher(true); return; }
    if (!leo) leo = CaddieGuide.presence({ surFace: () => openCaddie(), label: 'Parler à ' + MARQUE.personnage + ', ' + MARQUE.role });
    leo.cacher(false);
    document.body.classList.add('avec-leo');
    if (S.view !== 'home' || document.getElementById('welcome') || document.querySelector('.cd-fond')) return;
    // Première fois : la visite (propriétaire et organisateurs ; les participants ont leur accueil) ; sinon un mot à chaque ouverture
    if (canOrganize() && !ls.get(visiteKey(), 0)) { ls.set(visiteKey(), Date.now()); setTimeout(leoVisite, 600); return; }
    if (ssGet('fanion.leo.salut') || carteRetourChoix()) return;   // une seule chose à la fois : la carte de retour passe avant le salut
    ssSet('fanion.leo.salut');
    setTimeout(() => { if (S.view === 'home' && !document.querySelector('.cd-fond, #welcome')) leo.dire(leoMessage()); }, 1200);
  }
  function leoMessage() {
    const h = new Date().getHours(), salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir', nom = firstName(ls.get('pelland.me', ''));
    const today = new Date().toISOString().slice(0, 10);
    const live = (S.historyList || []).filter(g => g.status !== 'terminée').length;
    const compAuj = (S.compList || []).filter(c => c.date === today).length;
    const nbJ = (S.players || []).length;
    let texte, bouton = null, action = null;
    if (live) { texte = `${live} partie${live > 1 ? 's' : ''} en cours dans le groupe.`; bouton = 'Suivre en direct'; action = () => go('live'); }
    else if (compAuj) { texte = `Une compétition se joue aujourd’hui. Bonne chance !`; bouton = 'Voir le classement'; action = () => go('comps', { compLive: true }); }
    else if (canOrganize() && nbJ < 4) { texte = `Il vous faut au moins 4 joueurs pour ${SPORT.gratuitPour}. On les invite ?`; bouton = 'Inviter des joueurs'; action = () => go('players', { pMode: 'banque' }); }
    else if (canOrganize()) { texte = SPORT.leoProchaine; bouton = SPORT.leoBouton; action = () => go(SPORT.vueDates); }
    else texte = 'Tout est en ordre. Touchez mon visage si vous avez une question.';
    return { titre: `${salut}${nom ? ', ' + nom : ''} !`, texte, bouton, action, duree: 9000 };
  }
  function leoVisite() {
    if (!window.CaddieGuide) return;
    const nom = firstName(ls.get('pelland.me', ''));
    CaddieGuide.ouvrir({
      etapes: SPORT.visite(nom),
      fin: { titre: 'Une question ? Je suis dans le coin.', texte: 'Touchez mon visage en bas à droite, n’importe quand. On commence par inviter vos joueurs ?', bouton: (S.players || []).length < 4 ? 'Inviter des joueurs' : 'C’est parti', action: () => { if ((S.players || []).length < 4) go('players', { pMode: 'banque' }); } },
    });
  }
  // Texto : les joueurs de la partie sont cochés ; on peut ajouter des joueurs d'une autre partie (ou du groupe)
  // ==== src/golf/pointage.js ====
  async function textPlayers(g) {
    const me = L.norm(ls.get('pelland.me', '') || '');
    const inGame = new Set(g.players.map(p => L.norm(p.name)));
    let others = [];
    try { others = (await Store.listGames()).filter(x => x.id !== g.id && x.status !== 'terminée' && Math.abs((x.createdAt || 0) - Date.now()) < 36 * 3600e3); } catch (e) { }
    const whereOf = n => { const o = others.find(x => x.players.some(p => L.norm(p.name) === n)); return o ? `Joue avec ${o.players.filter(p => L.norm(p.name) !== n).map(p => p.name.split(' ')[0]).join(', ')}` : ''; };
    const lib = (S.players || []).filter(p => L.norm(p.name) !== me);
    const rows = lib.map(p => ({ p, n: L.norm(p.name), on: inGame.has(L.norm(p.name)), where: inGame.has(L.norm(p.name)) ? '' : whereOf(L.norm(p.name)) }));
    rows.sort((a, b) => (b.on - a.on) || ((!!b.where) - (!!a.where)) || a.p.name.localeCompare(b.p.name, 'fr'));
    const msg = { text: smsSummary(g) };
    const draw = sh => {
      const sel = rows.filter(r => r.on), noPh = sel.filter(r => !r.p.phone);
      const item = (r, k) => `<label class="imp-row"><input type="checkbox" data-tp="${k}" ${r.on ? 'checked' : ''}><span><b>${esc(r.p.name)}</b><small>${r.p.phone ? esc(fmtPhone(r.p.phone)) : 'Pas de numéro complet'}${r.where ? ' · ' + esc(r.where) : ''}</small></span></label>`;
      const idx = r => rows.indexOf(r);
      const mine = rows.filter(r => inGame.has(r.n)), rest = rows.filter(r => !inGame.has(r.n));
      sh.innerHTML = `<h3>Texto</h3>
        <p class="note" style="margin:0 0 4px">Joueurs de cette partie</p><div class="imp-list">${mine.map(r => item(r, idx(r))).join('') || '<p class="note" style="padding:10px">—</p>'}</div>
        ${rest.length ? `<details class="tp-more" ${rest.some(r => r.on) ? 'open' : ''}><summary>Ajouter un joueur d’une autre partie</summary><div class="imp-list">${rest.map(r => item(r, idx(r))).join('')}</div></details>` : ''}
        <label>Message<textarea id="tpMsg" rows="5">${esc(msg.text)}</textarea></label>
        ${noPh.length ? `<p class="warn" style="margin:6px 0">Pas de numéro complet pour ${esc(noPh.map(r => r.p.name).join(', '))} : ajoutez-le dans Joueurs.</p>` : ''}
        <div class="row"><button class="btn small" id="tpGo" type="button" ${sel.some(r => r.p.phone) ? '' : 'disabled'}>Envoyer le texto (${sel.filter(r => r.p.phone).length})</button><button class="btn ghost small" data-close type="button">Annuler</button></div>`;
      sh.querySelector('#tpMsg').oninput = e => { msg.text = e.target.value; };
      sh.querySelectorAll('[data-tp]').forEach(c => c.onchange = () => { rows[+c.dataset.tp].on = c.checked; draw(sh); });
      sh.querySelector('[data-close]').onclick = closeSheet;
      sh.querySelector('#tpGo').onclick = () => {
        const nums = rows.filter(r => r.on && r.p.phone).map(r => r.p.phone);
        closeSheet(); openSms(nums, msg.text);
      };
    };
    openSheet('', sh => draw(sh));
  }
  // Détail d'un trou (en touchant la ligne de calcul sous le trou)
  function holeDetail(h) {
    const g = S.game; if (!g) return;
    if (isAlt(g)) return holeDetailNeuf(g, h);
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
      <div class="sheet-actions">${isOwner() ? '<button class="btn ghost" data-edithole type="button">Modifier le trou (press, reroll, skin)</button>' : ''}<button class="btn" data-close type="button">Fermer</button></div>`, sh => { sh.querySelector('[data-close]').onclick = closeSheet; const eh = sh.querySelector('[data-edithole]'); if (eh) eh.onclick = () => { closeSheet(); setTimeout(() => holeSheet(h), 50); }; });
  }
  function allScoresSheet(h) {
    const g = S.game, P = g.players;
    const vals = P.map((p, pi) => L.getScore(g, h, pi));
    const st0 = L.skinTeam(g, h);
    let skin = st0 == null ? undefined : st0; // undefined = pas encore dit ; -1 = pas de skin ; 0/1 = équipe
    let skinPlayer = ((g.events || {})[h] || {}).skinPlayer; if (skinPlayer === undefined) skinPlayer = null;
    const neuf = isAlt(g), T = neuf ? null : L.getTeams(g), order = neuf ? g.players.map((_, i) => i) : [...T[1], ...T[0]]; // Bleus puis Rouges
    const isWolf = L.formatOf(g) === 'wolf', wf = isWolf ? L.wolfOf(g, h) : -1;
    let wolf = isWolf ? (((g.events || {})[h] || {}).wolf || null) : null;
    const draw = () => {
      const sheet = $('#sheet');
      // tout joueur peut avoir la skin ; s'il ne fait pas la normale (brut), le point va à l'autre équipe
      const eligible = order.filter(pi => vals[pi] != null);
      if (skinPlayer != null && !eligible.includes(skinPlayer)) { skinPlayer = null; if (skin !== -1) skin = st0 == null ? undefined : st0; }
      const needSkin = (!neuf && vals.some(v => v != null) && skin === undefined) || (isWolf && vals.some(v => v != null) && !wolf);
      sheet.innerHTML = `<h3>Trou ${h} · normale ${L.holeInfo(g, h, 0).par}</h3>
        <div class="allscores">${order.map(pi => { const p = P[pi];
          const par = L.holeInfo(g, h, pi).par, k = L.strokesOnHole(p.strokes, g.course.holes[h - 1].si);
          const lo = Math.max(1, par - 2), hi = lo + 5;
          const opts = []; for (let n = lo; n <= hi; n++) opts.push(n);
          if (vals[pi] != null && !opts.includes(vals[pi])) opts.push(vals[pi]);
          return `<div class="as-row ${vals[pi] != null ? 'done' : ''}"><div class="as-name ${neuf ? '' : 'tc' + teamOf(g, pi)}">${esc(p.name)}${k ? ` <small class="as-k">${BALL.repeat(Math.max(0, k))}</small>` : ''}</div>
            <div class="as-opts">${opts.map(n => `<button type="button" class="as-n ${n === par ? 'par' : ''}" data-p="${pi}" data-n="${n}" aria-pressed="${vals[pi] === n}">${n}</button>`).join('')}<button type="button" class="as-n more" data-p="${pi}" data-plus="1" aria-label="Plus">+</button></div></div>`;
        }).join('')}</div>
        ${isWolf ? `<div class="toggles"><div class="tg"><span>Le loup ${esc(P[wf].name)} joue avec…</span>${P.map((p, i) => i === wf ? '' : `<button type="button" class="pill" data-wolfp="${i}" aria-pressed="${!!wolf && wolf.partner === i}">${esc(p.name)}</button>`).join('')}<button type="button" class="pill" data-wolfp="lone" aria-pressed="${!!wolf && wolf.partner == null && !wolf.blind}">Seul (×2)</button><button type="button" class="pill" data-wolfp="blind" aria-pressed="${!!wolf && !!wolf.blind}">Seul à l’aveugle (×3)</button></div></div>` : ''}
        ${neuf ? '' : `<div class="toggles"><div class="tg"><span>Skin à… (sans la normale, le point va à l’autre équipe)</span>${eligible.length ? eligible.map(pi => `<button type="button" class="pill team-pill t${teamOf(g, pi)}" data-skinp="${pi}" aria-pressed="${skinPlayer === pi}">${esc(P[pi].name)}</button>`).join('') : `<span class="note" style="width:auto">${vals.every(v => v == null) ? 'Entrez les scores d\'abord.' : 'Personne n\'a fait la normale.'}</span>`}<button type="button" class="pill" data-skinp="-1" aria-pressed="${skin === -1}">Pas de skin</button></div>
        <p class="note">${skin === 0 || skin === 1 ? (skinPlayer != null ? (vals[skinPlayer] != null && vals[skinPlayer] > L.holeInfo(g, h, skinPlayer).par ? `Skin à ${esc(P[skinPlayer].name)}, sans la normale : le point va aux ${L.TEAMS[1 - skin]}.` : `Skin à ${esc(P[skinPlayer].name)} (${L.TEAMS[skin]}).`) : `Skin pour les ${L.TEAMS[skin]}.`) : skin === -1 ? 'Pas de skin.' : 'Skin pas encore indiquée.'}</p></div>`}
        ${needSkin ? `<p class="warn" style="margin:0">${isWolf ? 'Indiquez le choix du loup avant d’enregistrer.' : 'Choisissez la skin (un joueur) ou « Pas de skin » avant d’enregistrer.'}</p>` : ''}
        <div class="sheet-foot"><button type="button" class="btn ghost small" data-close>Annuler</button><button type="button" class="btn" data-save ${needSkin ? 'disabled' : ''}>Enregistrer</button></div>`;
      sheet.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { const pi = +b.dataset.p, n = +b.dataset.n; vals[pi] = vals[pi] === n ? null : n; draw(); });
      sheet.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => { const pi = +b.dataset.p; vals[pi] = (vals[pi] || Math.max(1, L.holeInfo(g, h, pi).par - 2) + 5) + 1; draw(); });
      sheet.querySelectorAll('[data-wolfp]').forEach(b => b.onclick = () => { const v = b.dataset.wolfp; wolf = v === 'lone' ? { lone: true } : v === 'blind' ? { lone: true, blind: true } : { partner: +v }; draw(); });
      sheet.querySelectorAll('[data-skinp]').forEach(b => b.onclick = () => {
        const v = +b.dataset.skinp;
        if (v === -1) { skin = -1; skinPlayer = null; } else { skinPlayer = v; skin = teamOf(g, v); }
        draw();
      });
      sheet.querySelector('[data-close]').onclick = closeSheet;
      sheet.querySelector('[data-save]').onclick = () => {
        if (needSkin) return toast(isWolf ? 'Indiquez le choix du loup.' : 'Choisissez la skin ou « Pas de skin ».');
        const scores = {}; vals.forEach((v, pi) => { if (v != null && v !== L.getScore(g, h, pi)) scores[pi] = v; });
        const acts = [];
        if (isWolf && wolf) acts.unshift({ type: 'wolf', hole: h, wolf });
        if (Object.keys(scores).length) acts.push({ type: 'scores', hole: h, scores });
        if (!neuf && skin !== undefined && (skin !== st0 || skinPlayer != null)) acts.push({ type: 'skin', hole: h, team: skin, player: skin >= 0 ? skinPlayer : null });
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
        <div class="tg"><span>Statut du trou</span>${(() => { const pt = L.pressTeamOf(g, h), st = e.reroll ? 'reroll' : (e.presses || []).length ? 'press' + (pt != null ? pt : '') : 'normal';
          return `<button class="pill" data-status="normal" aria-pressed="${st === 'normal'}">Normal</button>` + [0, 1].map(k => `<button class="pill team-pill t${k}" data-status="press${k}" aria-pressed="${st === 'press' + k}">Pressé par les ${L.TEAMS[k]} (×2)</button>`).join('') + `<button class="pill" data-status="reroll" aria-pressed="${st === 'reroll'}" ${(e.presses || []).length ? '' : 'disabled'}>Reroll (×4)</button>`; })()}
          <span class="note" style="width:auto">Le reroll se choisit après la press.</span></div>
        ${isPar3 ? `<div class="tg"><span>Normale 3</span><span class="note" style="width:auto">Calculée automatiquement : l'équipe qui a la skin et fait la normale gagne l'argent.</span></div>` : ''}
        <div class="tg"><span>Skin à… (1 point, multiplié par la press ; sans la normale, le point va à l’autre équipe)</span>${(() => { const sp = e.skinPlayer, stt = L.skinTeam(g, h), el = P.map((p, i) => i).filter(i => L.getScore(g, h, i) != null);
          return (el.length ? el.map(i => `<button class="pill team-pill t${teamOf(g, i)}" data-skinpl="${i}" aria-pressed="${sp === i}">${esc(P[i].name)}</button>`).join('') : [0, 1].map(k => `<button class="pill team-pill t${k}" data-skin="${k}" aria-pressed="${stt === k}">${L.TEAMS[k]}</button>`).join('')) + `<button class="pill" data-skin="-1" aria-pressed="${stt === -1}">Pas de skin</button>`; })()}</div>
      </div>
      <button class="btn ghost small" data-close>Fermer</button>`, s => {
      const done = acts => { closeSheet(); commit(acts, false); };
      s.querySelector('[data-goto]').onclick = () => done([{ type: 'goto', hole: h }]);
      s.querySelectorAll('[data-status]').forEach(b => b.onclick = () => {
        const v = b.dataset.status;
        if (v === 'normal') return done([{ type: 'unpress', hole: h }]);
        if (v === 'reroll') return done([{ type: 'reroll', hole: h, on: true }]);
        const k = +v.slice(5); // press0 / press1 : on remplace la press existante
        done([{ type: 'unpress', hole: h }, { type: 'press', hole: h, team: k, player: null, force: true }]);
      });
      s.querySelectorAll('[data-skinpl]').forEach(b => b.onclick = () => { const pi = +b.dataset.skinpl; done([{ type: 'skin', hole: h, team: teamOf(g, pi), player: pi }]); });
      s.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
        done([{ type: 'skin', hole: h, team: +b.dataset.skin }]);
      });
      s.querySelector('[data-close]').onclick = closeSheet;
    });
  }

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
    if (isAlt(g)) return smsSummaryNeuf(g);
    const m = leaderMoney(g), T = L.getTeams(g);
    const played = Object.keys(g.scores || {}).filter(x => (g.scores[x] || []).some(v => v != null)).map(Number);
    const last = played.length ? Math.max(...played) : 0, done = g.status === 'terminée';
    const date = new Date(g.createdAt || Date.now()).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
    const lines = [`${groupName()} – ${gameName(g)} – ${g.course.name.replace(/^Club de golf /i, '')}, ${date}`];
    lines.push(done ? 'Résultat final :' : last ? `Après ${last} trou${last > 1 ? 's' : ''} :` : 'La partie commence.');
    if (last) {
      if (m.tie) lines.push(`Égalité, ${m.t[0]} points chacun.`);
      else lines.push(`${L.TEAMS[m.k]} ${done ? 'gagnent' : 'mènent'} par ${m.d} point${m.d > 1 ? 's' : ''} nets (Bleus ${m.t[1]} · Rouges ${m.t[0]}).`, `${done ? 'Gain' : 'Gain en ce moment'} : ${fmt$(m.tot)} par joueur pour les ${L.TEAMS[m.k]}.`);
    }
    lines.push(`Bleus : ${T[1].map(i => g.players[i].name).join(', ')}`, `Rouges : ${T[0].map(i => g.players[i].name).join(', ')}`);
    lines.push(inviteLink(g));
    return lines.join('\n');
  }
  // Lignes de la carte selon les trous joués (18, aller ou retour)
  function scoreRows(g, row, sumRow) {
    const [h0, h1] = L.holeRange(g), rows = a => Array.from({ length: 9 }, (_, i) => row(a + i)).join('');
    if (h0 === 1 && h1 === 18) return rows(1) + sumRow('Aller', 1, 9) + rows(10) + sumRow('Retour', 10, 18) + sumRow('Total', 1, 18, true);
    return rows(h0) + sumRow('Total', h0, h1, true);
  }
  // ==== src/golf/module.js ====
  // =====================================================================
  // Le module golf, vu du tronc commun : écrans, navigation, données au démarrage, liens d'ouverture
  // =====================================================================
  const MODULE = {
    vues: { home: vHome, jeux: vJeux, jeuEdit: vJeuEdit, quatuors: vQuatuors, setup: vSetup, game: vGame, join: vJoin, history: vHistory, live: vHistory, courses: vCourses, course: vCourse, clubs: vClubs, comps: vComps, compEdit: vCompEdit, comp: vComp, compTv: vCompTv },
    // Avant de changer d'écran : on arrête de suivre en direct ce qu'on quitte
    quitter(view) {
      if (S.unwatch && view !== 'game') { S.unwatch(); S.unwatch = null; S.game = null; }
      if (S.unwatchPres && view !== 'game') { S.unwatchPres(); S.unwatchPres = null; }
      if (S.unwatchComp && view !== 'comp' && view !== 'compEdit') { S.unwatchComp(); S.unwatchComp = null; }
      if (view === 'comps') S.compList = null;
    },
    avant(view) {
      if (view !== 'game' && view !== 'setup' && Voice.wake) Voice.setWake(false);
    },
    // Après avoir changé d'écran
    aller(view, opts) {
      if (view === 'setup' && !S.offres) Store.listOffres().then(l => { S.offres = l; if (S.view === 'setup') render(); });
      if (view === 'quatuors') { Store.listOffres().then(l => { S.offres = l; if (S.view === 'quatuors') render(); }); Store.listQuatuors().then(l => { S.quatuors = l; }); }
      if (view === 'course' && 'editCourse' in opts) { S.cardImgs = []; S.cardStatus = ''; }
      if (view === 'history' || view === 'live') { S.historyList = null; S.confirmDelGame = null; }
      if (view === 'setup') { setHeard('Touchez le micro et dites les joueurs et leurs index.'); setReply(''); }
      if (view === 'game') { setHeard('Appuyez sur le micro et parlez.'); setReply(''); }
    },
    // Bouton retour : vrai si le module s'en occupe (sinon : accueil)
    retour() {
      if (S.view === 'course') go(S.editCourse && S.editCourse.web ? 'clubs' : S.draft ? 'setup' : 'courses', { editCourse: null });
      else if (S.view === 'clubs') go('courses');
      else if (S.view === 'compTv') go('comp');
      else if (S.view === 'comp' && S.compMatch) { S.compMatch = null; render(); }
      else if (S.view === 'comp') go('comps');
      else if (S.view === 'compEdit') { if (S.compDraft && S.compDraft.id) openComp(S.compDraft.id); else go('comps'); }
      else return false;
      return true;
    },
    phrase(text) { handle(text); },
    ouvrir(id) { openGame(id); },
    nouvellePartie() { typePartieSheet(); },
    groupesTexte(n) { return groupsText(n); },
    // Démarrage : copie gardée sur l'appareil, puis chargement à jour
    depuisCopie(snap) {
      Object.assign(S, { quatuors: snap.quatuors || [], jeux: snap.jeux || [], courses: [...(snap.courses || []), ...(window.QC_COURSES || []).filter(q => !(snap.courses || []).some(c => c.id === q.id) && !(snap.retired || []).includes(q.id))].sort((x, y) => x.name.localeCompare(y.name, 'fr')) });
    },
    async charger() {
      const [courses, quatuors, jeux] = await Promise.all([Store.listCourses().catch(() => []), Store.listQuatuors().catch(() => []), Store.listJeux().catch(() => [])]);
      return { courses, quatuors, jeux };
    },
    garder(d, garde) { Object.assign(S, { courses: garde(d.courses, S.courses), quatuors: garde(d.quatuors, S.quatuors), jeux: garde(d.jeux, S.jeux) }); },
    ensuite() { setTimeout(chargerPropositions, 1200); },   // terrains proposés : en attente pour le groupe, à approuver pour l'équipe Fanion
    copie(d) { return { quatuors: d.quatuors, jeux: d.jeux, courses: d.courses.filter(c => !(window.QC_COURSES || []).some(q => q === c)), retired: (Store.retired || []).map(c => c.id) }; },
    // Ouverture par un lien (?partie=…) ou par le raccourci Siri ; vrai si le module s'en occupe
    lien(params) {
      const code = (params.get('partie') || params.get('code') || '').toUpperCase();
      if (code) openGame(code);
      else if (params.has('ecoute') || params.has('pelland')) {
        // Ouverture par le raccourci Siri : reprendre la dernière partie et écouter
        const last = ls.get('pelland.lastGame', null);
        if (last) openGame(last); else render();
      } else return false;
      return true;
    },
  };
  // ==== src/commun/demarrage.js ====

  // =====================================================================
  // Démarrage
  // =====================================================================
  $('#back').onclick = () => { if (!MODULE.retour()) go('home'); };

  $('#acctBtn').onclick = () => { if (S.view !== 'compte') go('compte'); };
  $('#micBtn').onclick = () => Voice.ptt();
  $('#wakeBtn').onclick = () => Voice.setWake(!Voice.wake);
  $('#typeForm').onsubmit = e => { e.preventDefault(); const t = $('#typeInput').value.trim(); if (t) { $('#typeInput').value = ''; MODULE.phrase(t); } };
  $('#typeInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#typeForm').requestSubmit(); } });
  Voice.onText = text => MODULE.phrase(text);
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  // Réseau perdu / retrouvé : on l'indique ; les scores en attente partent au retour du réseau (Store.flush)
  window.addEventListener('offline', () => { render(); toast('Hors ligne : les scores sont gardés et seront envoyés au retour du réseau.'); });
  window.addEventListener('online', () => { render(); toast('Réseau retrouvé : scores envoyés.'); });
  (function captureRef() {
    const r = new URLSearchParams(location.search).get('ref');
    if (r && /^[a-z0-9_-]{2,60}$/i.test(r)) ls.set('pelland.ref', { code: r, until: Date.now() + 90 * 864e5 });
  })();
  (async function start() {
    $('#view').innerHTML = '<p class="note">Démarrage…</p>';
    await Store.init();
    if (Store.redirecting) { $('#view').innerHTML = '<p class="note">Philippe vous reconnaît…</p>'; return; }
    // Menu de Philippe (compte HoldingAI), en haut à droite, comme dans toutes les apps HoldingAI
    if (Store.mode === 'cloud') {
      window.HOLDINGAI_PORTE = Store.uid
        ? { app: MARQUE.id, nomApp: MARQUE.nomApp, personnage: MARQUE.personnage, prenom: Store.nom || '', connecte: true,
            liens: Store.noGroup ? [] : [{ texte: 'Mes groupes et forfait', action: () => go('compte') }], surDeconnexion: () => Store.logout() }
        : { app: MARQUE.id, nomApp: MARQUE.nomApp, personnage: MARQUE.personnage, barriere: true };
      if (!Store.uid && window.HoldingAIPorte) try { HoldingAIPorte.barriere(); } catch (e) { }
    }
    if (Store.needLogin) {
      [S.players, S.groups] = await Promise.all([Store.listPlayers(true).catch(() => []), Store.listGroups().catch(() => [])]);
      S.view = 'login'; render(); return;
    }
    // Lien d'invitation (?joueur=…) : le compte y a déjà été relié s'il a le bon cellulaire (Store.ensureMember)
    if (new URLSearchParams(location.search).get('joueur')) history.replaceState(null, '', location.pathname);
    // Ouverture rapide : on affiche tout de suite la dernière copie du groupe gardée sur l'appareil,
    // puis on charge la version à jour (toutes les lectures en même temps) et on rafraîchit l'écran.
    const params0 = new URLSearchParams(location.search), snapK = 'fanion.snap.' + Store.gid + '.' + (Store.uid || '');
    const plain = !['partie', 'code', 'offre', 'compte', 'ecoute', 'pelland', 'joueur'].some(k => params0.has(k));
    const snap = plain ? ls.get(snapK, null) : null;
    if (snap && snap.players && snap.players.length) {
      Object.assign(S, { players: snap.players, groups: snap.groups || [] }); MODULE.depuisCopie(snap);
      render();
    }
    const [donnees, players, groups] = await Promise.all([MODULE.charger(), Store.listPlayers().catch(() => []), Store.listGroups().catch(() => [])]);
    // Hors ligne : la base ne répond pas ; on garde la copie de l'appareil plutôt que des listes vides
    const garde = (v, old) => (v && v.length) || navigator.onLine !== false || !old ? v : old;
    Object.assign(S, { players: garde(players, S.players), groups: garde(groups, S.groups) }); MODULE.garder(donnees, garde);
    setTimeout(chargerRetour, 800);
    MODULE.ensuite();
    if (navigator.onLine !== false) try { ls.set(snapK, { players, groups, ...MODULE.copie(donnees), at: Date.now() }); } catch (e) { }
    // Groupes créés avant le compteur : on l'initialise une fois avec le nombre de joueurs
    // (le compteur de joueurs est tenu par la base)
    Push.refresh().catch(() => { });
    // Groupes du joueur (sans les groupes supprimés ni archivés pour le lien « Changer de groupe »)
    Store.myGroupList().then(l => { S.myPlayers = l; if (S.view === 'home' && l.some(x => !x.archived && x.gid !== Store.gid)) render(); }).catch(() => { });
    const params = new URLSearchParams(location.search);
    const offreId = params.get('offre');
    if (params.get('compte')) { history.replaceState(null, '', location.pathname); go('compte', { fromLogin: true }); return; }
    if (curGroup().deleted) { toast('Ce groupe a été supprimé par son propriétaire. Choisissez un autre groupe.'); go('compte', { fromLogin: true }); return; }
    if (offreId) go('offre', { offreId });
    else if (MODULE.lien(params)) { }
    else if (!snap || (S.view === 'home' && !document.querySelector('#sheetWrap:not([hidden]), #welcome'))) render();
  })();
})();
