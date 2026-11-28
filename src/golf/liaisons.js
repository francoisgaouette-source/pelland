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
