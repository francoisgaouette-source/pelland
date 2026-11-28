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
