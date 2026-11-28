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
