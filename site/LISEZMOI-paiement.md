# Ouvrir les ventes de Le 19e (Stripe)

Le site est prêt. Il manque seulement votre lien de paiement Stripe. Tant que ce lien est vide, la page Acheter affiche « Les ventes ouvrent bientôt » et le bouton Payer reste désactivé.

## 1. Créer le compte Stripe

1. Allez sur stripe.com et créez un compte au nom de votre entreprise (pays : Canada, devise : CAD).
2. Entrez vos informations d’entreprise et votre compte bancaire pour recevoir les paiements.

## 2. Ajouter la TPS et la TVQ

Dans Stripe : Produits → Taux de taxe → Créer :

- TPS : 5 %, exclusive (ajoutée au prix), région Québec, avec votre numéro de TPS.
- TVQ : 9,975 %, exclusive, région Québec, avec votre numéro de TVQ.

(Tant que vos ventes restent sous 30 000 $, vous n’êtes peut-être pas obligé de percevoir les taxes : à confirmer avec votre comptable. Sans taxes, changez le tableau du prix dans `achat.html`.)

## 3. Créer le lien de paiement

Dans Stripe : Liens de paiement → Nouveau :

1. Produit : « Le 19e – Groupe, 1 saison (12 mois) », prix 79,00 $ CAD, paiement unique (pas récurrent).
   Créez un deuxième lien, « prix fondateur », à 49,00 $ CAD, et collez-le dans `stripeLinkFondateur` (utilisé jusqu’au 31 mars 2027).
2. Taxes : ajoutez les taux TPS et TVQ créés plus haut.
3. Champs personnalisés : ajoutez un champ texte « Nom de votre groupe » (obligatoire).
4. Options : demander le nom et le courriel du client ; limiter l’adresse au Canada.
5. Après le paiement : « Rediriger vers votre site » → l’adresse de `merci.html` (ex. `https://fanion.ai/merci.html`).
6. Reçus : dans Paramètres → Courriels clients, activez l’envoi des reçus de paiement.

Copiez le lien obtenu (il commence par `https://buy.stripe.com/`).

## 4. Brancher le lien sur le site

Ouvrez `config.js` et collez le lien :

```js
stripeLink: 'https://buy.stripe.com/votre-lien',
```

C’est tout : le bouton Payer s’active dès que l’acheteur coche les conditions.

## 5. Après chaque vente

Stripe vous envoie un courriel avec le nom du groupe. Pour l’instant, l’activation à 16 joueurs se fait à la main, dans les 24 heures (la limite de joueurs et la page d’activation dans l’app sont les prochaines étapes à bâtir).

## 6. Avant d’ouvrir les ventes

- Compléter les éléments entre [crochets] dans `conditions.html` et `confidentialite.html`, et les faire valider par un avocat.
- Remplacer bonjour@fanion.ai dans `config.js` et dans les pages si l’adresse change.
- Mettre le site en ligne (ex. GitHub Pages ou Netlify) sous votre nom de domaine.

## Savoir quel groupe a payé

Le bouton « Passer au Groupe » de l'app ouvre la page Acheter avec l'identifiant du groupe. La page le transmet à Stripe : dans chaque paiement, le champ **client_reference_id** contient l'identifiant du groupe à activer (document `players/_groupe_<identifiant>` dans Firestore : ajouter `plan: "groupe"` et `paidUntil`).

## Parrainage et affiches

- Chaque propriétaire partage son lien depuis l'accueil de l'app (`?ref=<groupe>`). Les groupes créés avec ce lien portent le champ `ref` dans leur document `_groupe_`.
- Pour un centre de simulateurs : ouvrez `fanion.ai/affiche.html`, entrez le nom du centre et un code (ex. `vieux-port`), puis imprimez. Les groupes créés à partir de l'affiche portent `ref: "vieux-port"`.
