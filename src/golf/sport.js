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
