  // =====================================================================
  // Contenu propre aux sports de raquette, lu par le tronc commun (accueil, aperçus, Samuel, textes d'invitation)
  // =====================================================================
  const SPORT = {
    verrous: {
      players: 'Réservé à l’organisateur : il ajoute les joueurs et leur cellulaire.',
      lieux: 'Réservé à l’organisateur : il ajoute les lieux et leurs terrains.',
    },
    apercus: {
      players: () => `<div class="mk mk-list">${[['Marc Lavoie', 'ok', 'Compte créé'], ['Julie Roy', 'ok', 'Compte créé'], ['Éric Gagnon', 'wait', 'Invité']].map(([n, c, t]) =>
        `<div class="mk-row"><span class="mk-av">${n.split(' ').map(x => x[0]).join('')}</span><b>${n}</b><span class="mk-pill ${c}">${t}</span></div>`).join('')}<div class="mk-add">+ Ajouter un joueur et son cellulaire</div></div>`,
      lieux: () => `<div class="mk mk-list"><div class="mk-row"><b>Centre Claude-Robillard</b><span class="mk-pill ok">6 terrains</span></div><div class="mk-row"><b>Parc Jarry</b><span class="mk-pill ok">4 terrains</span></div></div>`,
    },
    apercuInfos: {
      players: { t: 'Inviter des joueurs', d: 'L’organisateur ajoute chaque joueur avec son cellulaire ; l’invitation part par texto.', you: 'Vous avez reçu cette invitation : votre compte est créé.' },
      lieux: { t: 'Lieux et terrains', d: 'Les endroits où le groupe joue, avec leur nombre de terrains ou de tables.', you: 'Vous voyez le lieu de chaque soirée.' },
    },
    bienvenueVous: `          <li><b>Répondre « je viens »</b> aux soirées offertes.</li>
          <li><b>Voir votre terrain et vos partenaires</b> à chaque manche, sur votre cellulaire.</li>
          <li><b>Entrer le pointage</b> de votre match à la fin de la manche.</li>
          <li><b>Voir le classement</b> de la soirée.</li>`,
    bienvenueOrg: '<li>Inviter les joueurs</li><li>Offrir les soirées</li><li>Lancer les rotations</li><li>Gérer les lieux et les terrains</li>',
    etapeJoueurs: n => `${n} joueur${n > 1 ? 's' : ''} avec cellulaire : il en faut 3 pour un premier double.`,
    etapeOffre: 'Une date, une heure, un lieu : vos joueurs répondent « je viens ».',
    etapePartie: 'Cochez les présents et touchez Lancer : l’app fait les rotations.',
    vueDates: 'soirees',
    vuePartie: 'soirees',
    ecrans: { home: 'Accueil', players: 'Inviter des joueurs', soirees: 'Soirées', lieux: 'Lieux et terrains', compte: 'Mon compte' },
    questionsLeo: ['Comment inviter mes joueurs ?', 'Comment marchent les rotations ?', 'Combien coûte le forfait Groupe ?'],
    leoAccueil: 'Posez-moi vos questions sur l’app, les rotations ou les forfaits.',
    visite: nom => [
      { puce: 'Bonjour !', titre: `Bienvenue${nom ? ', ' + nom : ''} !`, texte: `Je vous fais faire le tour de « ${groupName()} ». Ça prend une minute.` },
      { puce: 'Étape 1', titre: 'Inviter des joueurs', texte: 'Le nom et le cellulaire de chacun : l’invitation part par texto.' },
      { puce: 'Étape 2', titre: 'Offrir une soirée', texte: 'Une date, un lieu, le nombre de terrains. Chacun répond « je viens ».' },
      { puce: 'Étape 3', titre: 'Lancer les rotations', texte: 'Cochez les présents, touchez Lancer : chaque manche dit qui joue avec qui, sur quel terrain.' },
      { puce: 'Étape 4', titre: 'Pointage et classement', texte: 'Un joueur par terrain entre le pointage. À la fin, le classement de la soirée.' },
    ],
    parrainage: app => `On organise nos soirées de raquette avec ${app} : invitations par texto, rotations et pointage. Crée ton groupe, c’est gratuit pour 4 joueurs :`,
    avisExemple: 'ex. Plus de billets dans un chapeau pour faire les équipes.',
    lieuExemple: 'ex. Centre Claude-Robillard, terrains 3 à 6',
    amiJoueur: 'un ami joueur',
    autreGroupe: 'un autre groupe de raquette',
    gratuitPour: 'un double',
    quatuors: 'rotations',
    atouts: 'invitations par texto, rotations, pointage et classement',
    leoBouton: 'Soirées',
    leoProchaine: 'Prêt pour la prochaine soirée ? Offrez une date et je fais les rotations.',
  };
