# Code source de l'app (src/)

`app.js` à la racine n'est plus écrit à la main : il est **assemblé** à partir des fichiers de ce dossier.

```
node outils/assembler.js fanion              # refait app.js
node outils/assembler.js fanion --verifier   # vérifie que app.js est à jour (aussi fait par GitHub à chaque envoi)
node outils/assembler.js raquette            # construit l'app raquette dans dist/raquette/ (pas envoyé sur GitHub)
node outils/tests-raquette.js                # teste les règles des six sports et les rotations
```

Pour essayer L’Échange (l'app raquette) sur l'ordinateur : `node outils/assembler.js raquette`, puis servir `dist/raquette/`
(ex. `python3 -m http.server -d dist/raquette 8000` et ouvrir http://localhost:8000/?plein=1). Sans projet
Supabase, elle fonctionne en mode local.

## Les dossiers

- `commun/` : le tronc commun, partagé avec les apps sœurs (dont l'app des sports de raquette) : démarrage,
  base de données (groupes, joueurs, banque, présences, offres de dates, avis, notifications), compte HoldingAI,
  rôles, forfaits et parrainage, accueil des nouveaux, boucle de retour (idées), Samuel, textos et notifications.
- `golf/` : le module golf : terrains et cartes, parties, jeux, quatuors, pointage, compétitions, impressions.
- `raquette/` : le module des sports de raquette : règles des six sports (`regles.js`), rotations (`rotation.js`),
  lieux et soirées (`donnees.js`, `vues.js`), et sa page (`page/` : index.html, manifest, config.js, sw.js, couleurs).
- `apps/<app>.json` : pour chaque app, le fichier produit et la **liste ordonnée** des morceaux.

## Comment ça marche

Les morceaux sont mis bout à bout dans une seule fonction : ils partagent toutes leurs variables, comme avant
dans le gros `app.js`. L'ordre de la liste compte pour ce qui s'exécute au chargement (constantes, écouteurs) :
c'est l'ordre d'origine, golf et commun entremêlés. Les déclarations `function` peuvent être dans n'importe quel
morceau (elles sont hissées).

Chaque module ajoute ses méthodes de base de données (`Object.assign(Store, …)`) et ses interactions
(`Object.assign(bind, …)`), et fournit deux objets lus par le tronc commun :
- `MODULE` (`golf/module.js`, `raquette/module.js`) : ses écrans, ce qu'il fait quand on change d'écran ou qu'on
  touche Retour, les données chargées au démarrage, les liens d'ouverture (`?partie=…`, `?soiree=…`).
- `SPORT` (`golf/sport.js`, `raquette/sport.js`) : les textes du tronc commun qui dépendent du sport.

Le tronc commun ne doit appeler aucune fonction d'un module directement : seulement `MODULE` et `SPORT`.

## Ce qui reste à faire

- `logic.js` (calculs du golf) est encore chargé par l'app raquette, pour `L.norm`.
- Mise en ligne de L'Échange : `wrangler.lechange.jsonc` (Cloudflare, domaine lechange.ai). Il reste le projet
  Supabase et le client HoldingAI (à mettre dans `raquette/page/config.js`), puis les services du serveur (textos,
  notifications, assistant), qui demandent de rendre `worker.js` multi-app.
- Le dessin de Samuel (caddie-guide.js) n'est pas branché pour L'Échange.
