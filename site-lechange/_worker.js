// Site de L’Échange (lechange.ai) : sert les pages du dossier site-lechange/.
// www.lechange.ai renvoie vers lechange.ai, comme pour toutes les apps de L’Établi.
export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    if (url.hostname === 'www.lechange.ai') {
      url.hostname = 'lechange.ai';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(requete);
  },
};
