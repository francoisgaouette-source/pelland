// Réglages du site Fanion : la seule chose à modifier pour ouvrir les ventes.
window.FANION = {
  // Lien de paiement Stripe (Payment Link), ex. 'https://buy.stripe.com/abc123'.
  // Laisser vide tant que les ventes ne sont pas ouvertes : le bouton Payer reste désactivé.
  stripeLink: '',  // prix régulier (79 $), après le prix fondateur
  // Lien Stripe du prix fondateur (49 $), utilisé jusqu'à la date ci-dessous. Vide = ventes pas encore ouvertes.
  stripeLinkFondateur: '',
  // Prix (avant taxes) et fin du prix fondateur
  prix: 79,
  prixFondateur: 49,
  finFondateur: '2027-03-31',
  // Adresse de l'app
  appUrl: 'https://app.fanion.ai/',
  // Courriel de contact
  email: 'bonjour@fanion.ai'
};
