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