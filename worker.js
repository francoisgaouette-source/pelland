// Fanion : sert le site (dossier site/), l'envoi de textos /api/sms (Twilio) et le Caddie /api/caddie (API Claude).
// Secrets à entrer dans Cloudflare (Workers & Pages → pelland → Settings → Variables and secrets) :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (ex. +15145550000)
//   ANTHROPIC_API_KEY (le Caddie : l'agent qui répond aux questions dans l'app)
//   VAPID_PRIVATE_JWK (notifications de l'app : clé privée VAPID, format JWK)
// Sécurité : seuls les membres connectés peuvent texter, et seulement les numéros de leur propre groupe. Maximum 30 numéros par envoi.
// Connexion : compte HoldingAI (jeton de compte.letabli.ai), lu dans Supabase « Le Fanion » avec le jeton du membre (règles RLS).

const ORIGINS = ['https://francoisgaouette-source.github.io', 'https://lefanion.ai', 'https://www.lefanion.ai', 'https://app.lefanion.ai',
  // Anciennes adresses : encore acceptées pendant la transition vers lefanion.ai
  'https://fanion.ai', 'https://www.fanion.ai', 'https://app.fanion.ai',
  // L'Échange (sports de raquette) : servie par ce même serveur, avec sa propre base
  'https://app.lechange.ai'];
const MAX_TO = 30, MAX_LEN = 1200;

const cors = origin => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Vary': 'Origin'
});
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

// --- Compte HoldingAI : jeton signé par HoldingAI Compte (clés publiques JWKS) ---
const HAI_ISS = 'https://wwakxuzuhmdmweluafiz.supabase.co/auth/v1';
const SB = 'https://iuoaiambosdpsvsymupz.supabase.co', SB_KEY = 'sb_publishable_OyJAYcd00NPMK0_yiW54dA_ySQhECPK';
let HKEYS = null, HKEYS_AT = 0;
async function haiKeys() {
  if (HKEYS && Date.now() - HKEYS_AT < 3600e3) return HKEYS;
  const r = await fetch(HAI_ISS + '/.well-known/jwks.json');
  HKEYS = (await r.json()).keys || []; HKEYS_AT = Date.now(); return HKEYS;
}
async function verifyHai(h, p, sig, head, pay) {
  const jwk = (await haiKeys()).find(k => k.kid === head.kid); if (!jwk) throw new Error('clé inconnue');
  const ec = jwk.kty === 'EC';
  const key = await crypto.subtle.importKey('jwk', jwk, ec ? { name: 'ECDSA', namedCurve: jwk.crv || 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify(ec ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  if (!ok || pay.exp < Date.now() / 1000 || !pay.sub) throw new Error('jeton invalide');
  return { ...pay, kind: 'hai' };
}
// Lecture dans Supabase avec le jeton du membre (donc selon les règles de la base)
async function sbGet(tok, path, app = APPS.fanion) {
  const r = await fetch(app.sb + '/rest/v1/' + path, { headers: { apikey: app.sbKey, Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw new Error('lecture refusée'); return r.json();
}
async function haiGroup(tok, uid, app) {
  const l = await sbGet(tok, 'liens?select=group_id&uid=eq.' + encodeURIComponent(uid), app);
  if (!l.length) throw new Error('membre sans groupe'); return l[0].group_id;
}

// --- Vérification du jeton : compte HoldingAI seulement ---
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function verifyToken(tok) {
  const [h, p, sig] = (tok || '').split('.'); if (!sig) throw new Error('jeton manquant');
  const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (pay.iss !== HAI_ISS) throw new Error('jeton inconnu');
  return verifyHai(h, p, sig, head, pay);
}

// --- Numéros du groupe du membre (lus avec son jeton, donc selon les règles de la base) ---
async function knownPhones(tok, uid, app) {
  const g = await haiGroup(tok, uid, app);
  return new Set((await sbGet(tok, 'telephones?select=phone&group_id=eq.' + encodeURIComponent(g), app)).map(x => String(x.phone || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
}

async function sendSms(env, to, body) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: '+1' + to, From: env.TWILIO_FROM, Body: body })
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Twilio ' + r.status); }
}

// --- Notifications Web Push (RFC 8291 aes128gcm + VAPID RFC 8292), en WebCrypto ---
const wpEnc = new TextEncoder();
const wpB64u = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const wpUnb64u = str => { const s = str.replace(/-/g, '+').replace(/_/g, '/'); const p = s + '==='.slice((s.length + 3) % 4); const bin = atob(p); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const wpCat = (...a) => { const n = a.reduce((x, y) => x + y.length, 0), o = new Uint8Array(n); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
async function wpHkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}
// Chiffre le message pour un abonnement { endpoint, keys: { p256dh, auth } }
async function encryptPush(sub, payload) {
  const uaPub = wpUnb64u(sub.keys.p256dh), authSecret = wpUnb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await wpHkdf(authSecret, shared, wpCat(wpEnc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await wpHkdf(salt, ikm, wpEnc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await wpHkdf(salt, ikm, wpEnc.encode('Content-Encoding: nonce\0'), 12);
  const plain = wpCat(wpEnc.encode(payload), new Uint8Array([2]));   // délimiteur du dernier enregistrement
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return wpCat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
// Jeton VAPID (ES256) pour le service de notifications de l'abonné
async function vapidAuth(endpoint, jwk, subject, publicKey) {
  const aud = new URL(endpoint).origin;
  const head = wpB64u(wpEnc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = wpB64u(wpEnc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, wpEnc.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${wpB64u(sig)}, k=${publicKey}`;
}
async function sendPush(env, sub, data, app = APPS.fanion) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const pub = wpB64u(wpCat(new Uint8Array([4]), wpUnb64u(jwk.x), wpUnb64u(jwk.y)));
  const body = await encryptPush(sub, JSON.stringify(data));
  const r = await fetch(sub.endpoint, { method: 'POST', headers: {
    Authorization: await vapidAuth(sub.endpoint, jwk, 'mailto:' + app.courriel, pub),
    'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal'
  }, body });
  return r.status;
}

// Envoie une notification aux membres d'un groupe abonnés (subs/<uid>_<groupe>), sauf à l'expéditeur
async function pushGroup(env, tok, uid, data, app = APPS.fanion) {
  const g = await haiGroup(tok, uid, app);
  if (g !== data.groupId) throw new Error('groupe non autorisé');
  const only = Array.isArray(data.playerIds) && data.playerIds.length ? new Set(data.playerIds) : null;
  const membres = new Set((await sbGet(tok, 'joueurs?select=id&group_id=eq.' + encodeURIComponent(g), app)).map(x => x.id));
  const subs = (await sbGet(tok, 'abonnements_push?select=uid,player_id,sub&group_id=eq.' + encodeURIComponent(g), app))
    .map(x => ({ uid: x.uid, playerId: x.player_id, sub: x.sub })).filter(x => x.sub && x.sub.endpoint && x.uid !== uid && (!only || only.has(x.playerId)) && membres.has(x.playerId));
  const msg = { title: String(data.title || app.nom).slice(0, 80), body: String(data.body || '').slice(0, 240), url: String(data.url || './').slice(0, 300), tag: data.tag ? String(data.tag).slice(0, 60) : undefined };
  const res = await Promise.all(subs.map(x => sendPush(env, x.sub, msg, app).catch(() => 0)));
  return { sent: res.filter(s => s >= 200 && s < 300).length, total: subs.length, gone: res.filter(s => s === 404 || s === 410).length };
}

// --- Le Caddie : répond aux questions des membres sur l'app et les jeux ---
const CADDIE_MODEL = 'claude-haiku-5-5';
const CADDIE_SYSTEM = `Tu es Samuel, le caddie de l'app le fanion.ai, une app québécoise pour organiser un groupe de golf entre amis. Tu te présentes comme Samuel, votre caddie : un jeune caddie souriant, efficace et encourageant, qui connaît l'app par cœur. Tu peux glisser une petite image de golf à l'occasion (« on est sur le vert », « en plein dans l'allée »), sans en abuser.
Tu parles français québécois simple et chaleureux, tu vouvoies, tu réponds court (3 à 6 phrases, ou une petite liste d'étapes). Tu ne parles que de l'app, des jeux de golf et du golf entre amis.
Si tu ne sais pas, ou si la personne veut parler à quelqu'un, un remboursement, un problème de paiement ou de compte : dis-lui d'écrire à bonjour@fanion.ai (le bouton « Écrire à l'équipe » sous la conversation envoie la conversation). N'invente jamais une fonction qui n'existe pas.
Pour amener la personne au bon écran, ajoute à la fin une ligne [[ecran:CLE]] (une seule), avec CLE parmi : home (accueil), players (étape 1, Inviter des joueurs), quatuors (étape 2, Parties à préparer), setup (étape 3, Créer une partie), live (étape 4, Parties en cours), history (étape 6, Parties et compétitions jouées), courses (Banque de terrains), jeux (Banque de jeux), comps (Banque de compétitions), compte (Mon compte).
L'accueil présente 6 étapes : 1 Inviter des joueurs, 2 Parties à préparer, 3 Créer une partie, 4 Parties en cours, 5 Compétitions en cours, 6 Parties et compétitions jouées (deux onglets : Parties, avec résultats et qui doit quoi ; Compétitions, avec le classement final) ; puis les banques : joueurs, terrains, jeux et compétitions. Pour un membre invité, les étapes 1 à 3 et les banques sont réservées à l'organisateur (grisées).

L'APP
- Compte : on se connecte avec son compte L’Établi, le même pour toutes les apps de L’Établi : bouton « Continuer avec L’Établi », puis Philippe, le bâtisseur de L’Établi, s'occupe du cellulaire et du mot de passe (la première fois, il crée le compte en un instant avec le cellulaire). Mot de passe oublié ou cellulaire à changer : « Mon compte » → « Gérer » (chez Philippe). Ensuite on arrive dans « Mon compte » pour choisir son groupe. Un seul compte pour tous ses groupes : chaque groupe où ce cellulaire est inscrit apparaît dans « Mon compte » (bouton rond avec le visage de Philippe en haut à droite, le même dans toutes les apps de L’Établi : forfait du groupe, notifications, groupes, Se déconnecter ; aussi accessible par « Changer de groupe » sur l'accueil). Le cellulaire du compte L’Établi doit être celui inscrit pour ce joueur dans Joueurs ; sinon l'organisateur le corrige avec le bouton ☎ du joueur.
- Ajouter l'app à l'écran d'accueil : iPhone, dans Safari, bouton Partager puis « Sur l'écran d'accueil ». Android, dans Chrome, menu ⋮ puis « Ajouter à l'écran d'accueil ».
- Notifications : obligatoires pour les membres d'un groupe. L'organisateur voit dans Joueurs qui reçoit les notifications (🔔 actives, 🔕 bloquées ou pas activées) pour parler au joueur ou le retirer du groupe. Elles s'activent en entrant dans le groupe (après avoir accepté l'invitation) et on ne peut pas les désactiver ; elles s'arrêtent seulement quand on n'est plus membre du groupe. Si le téléphone les bloque, il faut les permettre dans ses réglages (iPhone : Réglages → Notifications → le fanion.ai ; sur iPhone, l'app doit être ajoutée à l'écran d'accueil).
- Compétitions (Banque de compétitions) : membre-membre en match play, Stableford ou en coups ; membre-invité (match play, Stableford ou coups) ; Texas scramble (départs minimums par joueur) ; scramble à 4 (25-20-15-10 %) ; Coupe Ryder du groupe (deux camps, sessions de quatre balles à 90 %, coups alternés à 50 % de la somme, simples à 100 % ; 1 point par match gagné, ½ par nul ; le premier camp à dépasser la moitié des points gagne) ; tableau à élimination en match play net (têtes de série par index, tirage ou ordre, exemptions des meilleures têtes de série, consolation possible, gagnant indiqué à la main pour trous supplémentaires ou forfait). Les formats en coups et Stableford peuvent se jouer sur plusieurs rondes (cumul et classement par ronde). « ⚖ Former les équipes » : équipes équilibrées A-B-C-D en serpentin selon l'index, ou tirage au sort ; en Coupe Ryder, deux camps équilibrés. Dans une compétition : « 📺 Écran télé » (classement plein écran en direct, défile tout seul), « 🖨 Cartes de pointage » et « 🖨 Affiches de voiturette » à imprimer ; un départ (heure ou trou) peut être noté pour chaque équipe. Ordre du mérite de la saison (Banque de compétitions) : points selon la position dans chaque compétition terminée (100, 80, 65, 55, 50…), Coupe Ryder 60 / 30, tableau 100 / 80 / 65 / 50.
- Créer une partie (étape 3 de l'accueil) : l'app demande d'abord le type, « Partie normale » (entre amis : terrain, joueurs, jeu, montants) ou « Compétition » (ouvre la Banque de compétitions pour choisir le format : match play, Stableford, en coups, Texas scramble…).
- Forfait Gratuit : un seul groupe gratuit par compte, de 4 joueurs (archivé compris). Pour créer un autre groupe, passer le premier au forfait Groupe (jusqu'à 16 joueurs) ou le supprimer. La banque de joueurs (joueurs du groupe et retirés) va jusqu'à 64.
- Banque de joueurs et groupe : la banque garde jusqu'à 64 joueurs (le propriétaire les ajoute avec leur cellulaire ; ils reçoivent un texto et sont « confirmés » une fois leur compte créé). Les membres du groupe (4 en Gratuit, 16 au forfait Groupe) sont choisis par l'organisateur parmi les joueurs confirmés : étape 1 « Inviter des joueurs », bouton « Ajouter au groupe ». « Retirer » enlève du groupe mais garde le joueur dans la banque ; « ✕ » (propriétaire) l'enlève de la banque.
- Banques : seul le propriétaire du groupe peut ajouter ou enlever des joueurs (nom et cellulaire, import Excel, retirer, remettre), des terrains (ajouter, effacer, remettre) et des compétitions (créer, effacer). L'organisateur peut voir les banques et modifier une compétition.
- Retirer un joueur (Joueurs, « Retirer ») : il ne fait plus partie du groupe (plus de notifications ni d'accès) mais reste dans la banque, sous « Retirés du groupe », avec son nom et son cellulaire ; « Remettre » le ramène dans le groupe et prépare le texto d'invitation, « ✕ » l'enlève de la banque.
- Une idée ou un pépin : bouton « 💡 Idée ou pépin ? » en haut, à côté du fanion.ai (une ampoule sur les autres écrans) ; l'équipe répond dans l'app.
- Rôles (propres à chaque groupe : on peut être organisateur d'un groupe et simple participant d'un autre) : le propriétaire détient le forfait et nomme l'organisateur ; l'organisateur prépare les parties. Sans organisateur nommé, c'est le propriétaire. Sur l'accueil, la carte « Rôles dans ce groupe » montre l'organisateur et votre rôle (organisateur ou participant). Le propriétaire se voit dans Mon compte : il y nomme ou change l'organisateur (« Nommer un organisateur » dans la case du groupe actuel), et y gère le forfait, l'archivage et la suppression du groupe.
- Joueurs : ajouter un nom et un cellulaire ; une invitation par texto est prête à envoyer (elle part de l'app Messages du téléphone : il faut toucher Envoyer). Import Excel ou CSV : deux colonnes, le nom et le cellulaire. Renommer : toucher le nom. Retirer : « Retirer », ou « Sélectionner » pour plusieurs.
- Parties à préparer : offrir des dates (terrain, dates, date limite) ; les joueurs répondent par lien texto ; l'app forme les groupes de 4 (en variant ou au hasard) ; bouton « Rappel » pour relancer ceux qui n'ont pas répondu.
- Nouvelle partie : terrain, joueurs, équipes (Meilleur + Pire par défaut : le plus bas index avec le plus haut), handicap (bas handicap ou plein), jeu (18 trous, aller 1-9 ou retour 10-18), montants. Le responsable (★) entre les scores ; les autres suivent en direct dans Parties en cours. On peut changer de responsable pendant la partie.
- Pendant la partie : toucher un trou pour entrer les scores ; Press et Reroll avant le départ du trou, ou après avec « Modifier le trou » ; « Modifier les montants » pour changer les mises ; « Texto aux joueurs » ; « Terminer la partie » à la fin (elle va dans Parties jouées).
- Hors réseau : les scores restent sur le téléphone et partent au retour du signal.
- Handicap de parcours = index × slope ÷ 113 + (évaluation − normale), arrondi. Les coups vont d'abord aux trous les plus difficiles.
- Plusieurs groupes : même compte L’Établi ; « Changer de groupe » sur l'accueil. Créer son propre groupe : « Créer mon groupe ».
- Parrainage : le propriétaire partage son lien depuis l'accueil ; chaque groupe parrainé qui passe au forfait Groupe lui donne 5 $ de rabais sur sa prochaine saison (les rabais s'additionnent).
- Installation obligatoire sur téléphone : ouverte dans le navigateur d'un cellulaire, le fanion.ai affiche « Installez le fanion.ai » et reste bloquée tant qu'elle n'est pas ouverte depuis son icône (iPhone : Safari → Partager → Sur l'écran d'accueil → Ajouter ; Android : Chrome → menu ⋮ → Installer l'application). Dans Messenger, Facebook ou un autre navigateur intégré, il faut d'abord ouvrir le lien dans Safari ou Chrome. Sur ordinateur, elle s'ouvre normalement.

FORFAITS (par saison de 12 mois, pas d'abonnement automatique)
- Gratuit : 1 groupe, jusqu'à 4 joueurs, tous les jeux.
- Groupe : jusqu'à 16 joueurs, 79 $ + taxes ; prix fondateur 49 $ + taxes pour les groupes inscrits avant le 31 mars 2027, garanti les saisons suivantes. Achat : accueil, « Passer au forfait Groupe » (propriétaire). Activation dans les 24 heures. Remboursement complet sur demande dans les 30 jours.
- Ligue (bientôt) : jusqu'à 64 joueurs, 199 $ + taxes.

LES JEUX (tout au net, avec handicap ; montants par joueur)
- Game à Pelland (4 joueurs, Rouges contre Bleus) : plus bas net du trou = 2 points pour son équipe ; plus haut net = 2 points à l'équipe adverse ; égalité entre équipes : rien ; skin = 1 point (si son détenteur ne fait pas la normale au brut, le point va à l'autre équipe) ; oiselet brut = 1 point ; cabane (oiselet brut + skin + plus haut net adverse) = 12 points ; press = points ×2, reroll = ×4. Argent : la game (montant de départ) à l'équipe qui mène à la fin + chaque revirement (l'équipe qui mène perd son avance : égalité ou dépassement) + l'écart × le montant par point + les normales 3 (skin + normale gagne le montant, sinon reporté).
- Nassau : trois paris en meilleure balle (aller, retour, total) ; chaque pari vaut la mise.
- Skins : le seul meilleur net du trou gagne le skin ; égalité, reporté au suivant ; chaque autre joueur paie le montant par skin.
- Wolf : le loup tourne à chaque trou ; avec partenaire ±1 par joueur ; seul ±2 par adversaire ; seul à l'aveugle ±3.
- Best Ball : meilleur net de chaque équipe ; écart de trous gagnés × montant.
- Match play (2 joueurs, un contre un) : au net, le plus bas score gagne le trou ; on compte l'avance en trous ; le match finit dès que l'avance dépasse les trous qui restent (« gagne 3 et 2 » = 3 trous d'avance, 2 à jouer) ; égalité au bout : match nul. Un seul enjeu, pour la partie (10 $ proposé) : le gagnant l'empoche, match nul personne ne paie. À 2 joueurs, on peut aussi jouer le Nassau (un contre un) ou les skins. À 3 joueurs : le 9 points ou les skins. Dans Nouvelle partie, on laisse simplement les cases des joueurs 3 et 4 vides.
- Banque de terrains : dans Terrains, chaque terrain a un bouton « Effacer » (aussi dans le terrain ouvert : « Effacer ce terrain ») ; il disparaît pour ce groupe seulement, les parties jouées le gardent, et on peut le remettre plus bas dans la liste (« Remettre »).
- Ajouter un terrain : dans Terrains, « Ajouter un terrain » propose la région du joueur d'après sa position, au Québec comme ailleurs dans le monde (on peut choisir une autre région ou taper un lieu) ; Samuel cherche sur le web les clubs de la région, puis prépare la carte de pointage du parcours choisi (normales, handicaps, tertres, évaluation, slope, avec les sources et l'image ou le PDF de la carte du club joint pour vérifier ; les photos de carte prises par le joueur sont aussi jointes). On la compare avec la carte officielle du club, on corrige au besoin, puis « Envoyer pour approbation » ou « Refuser ». Chaque nouveau terrain (web, photo ou à la main) est vérifié et approuvé par l'équipe du fanion.ai avant d'entrer dans la banque commune ; Terrains est en 3 étapes : 1. Terrain à ajouter, 2. Terrains à approuver (approuver ou effacer), 3. Terrains disponibles. Samuel garde les cartes à jour : il revérifie chaque terrain sur le web environ une fois par saison (et sur demande avec « Vérifier maintenant » dans le terrain) ; si la carte du club a changé, la mise à jour arrive dans « Terrains à approuver » avec la liste des différences. On peut aussi photographier la carte ou tout entrer à la main.
- Vegas (4 joueurs, équipes de deux) : les deux scores nets de l'équipe forment un nombre, le plus bas d'abord (4 et 5 = 45) ; un oiselet au brut renverse le nombre de l'autre équipe (45 devient 54), sauf si les deux équipes en font un ; maximum double boguey net par joueur ; l'écart entre les nombres = les points du trou ; gain = écart de points × montant par point (souvent 0,25 $).
- Sixes : équipes qui changent tous les 6 trous ; chaque tranche vaut la mise.
- 9 points (3 joueurs) : 5-3-1 par trou ; égalités 4-4-1, 5-2-2, 3-3-3 ; différence de points × montant avec chaque joueur.
- Jeux maison : dans Les jeux, « Ajouter un jeu ».
Les règles détaillées sont sur lefanion.ai/regles/.`;

// Console HoldingAI : reçoit les questions posées au Caddie (le jeton HoldingAI du membre y est revérifié)
const JOURNAL_CADDIE = 'https://gandliltstmtfsmsjaew.supabase.co/functions/v1/journal-caddie';
// Boucle de retour (idées, réponses de l'équipe, nouveautés, sondage) : notée dans la console HoldingAI, jeton HoldingAI revérifié là-bas
const RETOUR_FANION = 'https://gandliltstmtfsmsjaew.supabase.co/functions/v1/retour-fanion';
// Les apps servies par ce serveur, reconnues par l'adresse de l'app qui appelle (en-tête Origin) : le Fanion par défaut
const LECHANGE_SYSTEM = `Tu es Samuel, l'assistant de l'app L'Échange, une app québécoise pour organiser des soirées de sports de raquette entre amis : pickleball, tennis, badminton, padel, squash et tennis de table. Tu es souriant, efficace et encourageant.
Tu parles français québécois simple et chaleureux, tu vouvoies, tu réponds court (3 à 6 phrases, ou une petite liste d'étapes). Tu ne parles que de l'app, des six sports et de leurs règles de pointage.
Si tu ne sais pas, ou si la personne veut parler à quelqu'un, un remboursement, un problème de paiement ou de compte : dis-lui d'écrire à bonjour@lechange.ai (le bouton « Écrire à l'équipe » sous la conversation).
Pour amener la personne au bon écran, ajoute à la fin une ligne [[ecran:CLE]] (une seule), avec CLE parmi : home (accueil), players (Inviter des joueurs), soirees (Soirées), lieux (Lieux et terrains), compte (Mon compte).
Ce que fait l'app :
- Connexion : compte L’Établi (Philippe), par cellulaire. Installation sur le téléphone obligatoire (écran d'accueil).
- Joueurs : l'organisateur ajoute chaque joueur avec son cellulaire ; l'invitation part par texto. Banque de 64 joueurs au maximum.
- Lieux et terrains : les endroits où le groupe joue, avec leur nombre de terrains (ou de tables).
- Soirées : l'organisateur offre une date, une heure, un lieu, le nombre de terrains réservés et, au besoin, un nombre de places. Chacun répond « je viens » ou « je ne viens pas » ; quand c'est complet, les suivants vont sur la liste d'attente.
- Lancer la soirée : à l'arrivée, l'organisateur coche les présents et touche « Lancer la soirée ». L'app prépare les manches : qui joue avec qui, contre qui, sur quel terrain. On repose à tour de rôle ceux qui se sont le moins reposés, et on évite de rejouer avec le même partenaire.
- Retard ou départ : l'organisateur coche ou décoche la personne ; les manches suivantes se refont, celles commencées restent.
- Pointage : à la fin d'une manche, un joueur par terrain entre le pointage. Un pointage inhabituel demande une confirmation. La manche suivante apparaît quand tous les terrains ont fini.
- Classement de la soirée : manches gagnées, puis écart de points.
- Règles : pickleball, squash et tennis de table en manches à 11 (gagner par 2) ; badminton à 21 (gagner par 2, maximum 30) ; tennis et padel en sets à 6 jeux avec bris d'égalité à 6-6 (ou sets courts à 4). Le padel se joue en double seulement.
- Forfaits : un groupe gratuit jusqu'à 4 joueurs, puis le forfait Groupe ; 5 $ de rabais par groupe parrainé.`;
const APPS = {
  fanion: { id: 'fanion', nom: 'le fanion.ai', courriel: 'bonjour@fanion.ai', sb: SB, sbKey: SB_KEY, caddie: CADDIE_SYSTEM },
  lechange: { id: 'lechange', nom: 'L’Échange', courriel: 'bonjour@lechange.ai', sb: 'https://vdhlidlgwutlgihrypgo.supabase.co', sbKey: 'sb_publishable_RXZGbjuF6U5Fgu5Kdo1LBQ_Jv6xKnZ6', caddie: LECHANGE_SYSTEM },
};
const appDe = origin => origin === 'https://app.lechange.ai' ? APPS.lechange : APPS.fanion;
const RATE = new Map();
function tooMany(uid, max = 40) {
  const now = Date.now(), r = (RATE.get(uid) || []).filter(t => now - t < 3600e3);
  r.push(now); RATE.set(uid, r); return r.length > max;
}
async function caddie(env, messages, app = APPS.fanion) {
  const msgs = (messages || []).slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 1500) })).filter(m => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) throw new Error('question manquante');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: env.CADDIE_MODEL || CADDIE_MODEL, max_tokens: 700, system: app.caddie, messages: msgs })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || 'API ' + r.status);
  return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
}


// --- Avis des joueurs publiés sur fanion.ai : seulement ceux approuvés (approved: true, ajouté dans la console) et consentis (ok: true) ---
async function avisPublies() {
  try {
    const r = await fetch(SB + '/rest/v1/avis?select=stars,text,name,group_name,at&approved=eq.true&ok=eq.true&order=at.desc&limit=30', { headers: { apikey: SB_KEY } });
    const l = r.ok ? await r.json() : [];
    if (l.length) return l.filter(f => f.text).map(f => ({ stars: Math.max(1, Math.min(5, +f.stars || 5)), text: String(f.text).slice(0, 280), name: String(f.name || '').slice(0, 40), groupName: String(f.group_name || '').slice(0, 60), at: +f.at || 0 }));
  } catch (e) { }
  return [];
}


// --- Terrains trouvés sur le web : clubs d'une région, puis carte de pointage préparée (à faire vérifier et approuver dans l'app) ---
const REGIONS_QC = ['Abitibi-Témiscamingue', 'Bas-Saint-Laurent', 'Cantons-de-l’Est', 'Centre-du-Québec', 'Charlevoix', 'Chaudière-Appalaches', 'Côte-Nord', 'Gaspésie', 'Lanaudière', 'Laurentides', 'Laval', 'Mauricie', 'Montérégie', 'Montréal', 'Outaouais', 'Québec (Capitale-Nationale)', 'Saguenay–Lac-Saint-Jean'];
async function claudeWeb(env, { model, system, prompt, search = 6, fetchMax = 0, maxTokens = 4000, auQc = true }) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: search, ...(auQc ? { user_location: { type: 'approximate', region: 'Quebec', country: 'CA', timezone: 'America/Toronto' } } : {}) }];
  if (fetchMax) tools.push({ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: fetchMax, max_content_tokens: 15000 });
  const messages = [{ role: 'user', content: prompt }];
  for (let tour = 0; tour < 4; tour++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, tools })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && d.error.message) || 'API ' + r.status);
    if (d.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: d.content }); continue; }
    const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const urls = [...new Set((d.content || []).flatMap(c => c.type === 'web_search_tool_result' && Array.isArray(c.content) ? c.content.map(x => x.url) : c.type === 'web_fetch_tool_result' && c.content && c.content.url ? [c.content.url] : []).filter(Boolean))];
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('réponse illisible');
    return { data: JSON.parse(m[0]), urls };
  }
  throw new Error('recherche trop longue');
}
const TERRAINS_SYS = 'Tu es un recherchiste golf pour une app québécoise. Tu cherches sur le web et tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour. Tu n’inventes jamais une donnée : ce que tu ne trouves pas reste null et tu le dis dans "notes".';
async function clubsRegion(env, region) {
  const auQc = REGIONS_QC.includes(region);
  const { data, urls } = await claudeWeb(env, {
    model: env.TERRAINS_MODEL_LISTE || 'claude-haiku-5-5', system: TERRAINS_SYS, search: 6, maxTokens: 4000, auQc,
    prompt: `Dresse la liste la plus complète possible des clubs et terrains de golf ouverts au public (publics et semi-privés, et les clubs privés en les indiquant) ${auQc ? `dans la région « ${region} » au Québec` : `dans la région « ${region} » (n’importe quel pays : cherche aussi dans la langue locale)`}. Pour chaque club, donne ses parcours (un club peut en avoir plusieurs : « Le Champêtre », « Parcours bleu »…). Ignore les terrains d’exercice et de mini-golf.
Réponds par : {"clubs":[{"nom":"Club de golf …","ville":"…","parcours":[{"nom":"…","trous":18}],"prive":false}]}`
  });
  const clubs = (Array.isArray(data.clubs) ? data.clubs : []).filter(c => c && c.nom).slice(0, 80).map(c => ({
    nom: String(c.nom).slice(0, 90), ville: String(c.ville || '').slice(0, 60), prive: !!c.prive,
    parcours: (Array.isArray(c.parcours) && c.parcours.length ? c.parcours : [{ nom: '', trous: 18 }]).slice(0, 6).map(p => ({ nom: String((p && p.nom) || '').slice(0, 60), trous: Number(p && p.trous) || 18 }))
  })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return { region, clubs, sources: urls.slice(0, 8) };
}
async function typeCarte(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FanionBot/1.0; +https://lefanion.ai)', Accept: 'image/*,application/pdf' }, redirect: 'follow', cf: { cacheTtl: 86400 } });
    const t = (r.headers.get('content-type') || '').toLowerCase(); try { r.body && r.body.cancel(); } catch (e) { }
    if (!r.ok) return null;
    return /^image\/(jpeg|png|webp|gif)/.test(t) ? 'image' : /application\/pdf/.test(t) ? 'pdf' : null;
  } catch (e) { return null; }
}
// Adresse signée pour afficher la carte source dans l'app (beaucoup de sites bloquent l'affichage direct depuis un autre site)
async function signe(env, u) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('carte:' + (env.ANTHROPIC_API_KEY || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(u)));
  return btoa(String.fromCharCode(...s.slice(0, 18))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function carteVue(env, u) { return 'https://lefanion.ai/api/terrains/carte?u=' + encodeURIComponent(u) + '&s=' + await signe(env, u); }
async function carteClub(env, { nom, ville, parcours, region }) {
  const auQc = !region || REGIONS_QC.includes(region), lieu = auQc ? 'Québec' : region;
  const qui = `${nom}${parcours ? ' – parcours « ' + parcours + ' »' : ''}${ville ? ' (' + ville + ', ' + lieu + ')' : ' (' + lieu + ')'}`;
  const { data, urls } = await claudeWeb(env, {
    model: env.TERRAINS_MODEL_CARTE || 'claude-sonnet-5-5', system: TERRAINS_SYS, search: 6, fetchMax: 5, maxTokens: 3000, auQc,
    prompt: `Trouve la carte de pointage officielle de : ${qui}. Cherche le site du club et les sites de cartes de pointage (golfingrecord.com, bluegolf, golfpass, 18birdies, golflink, ${auQc ? 'Golf Québec' : 'la fédération de golf du pays'}…) et ouvre les pages pour lire les chiffres.
Il faut : la normale (par) et le handicap (stroke index, 1 = trou le plus difficile) de chaque trou, et pour chaque tertre son nom (couleur), son évaluation (course rating) et son slope, pour les hommes de préférence.
Très important pour la vérification : donne l’adresse exacte du fichier de la carte de pointage elle-même (image .jpg/.png/.webp ou PDF) telle que vue dans les pages ouvertes — souvent sur le site du club (« carte de pointage », « scorecard ») — dans "carte_fichier", et l’adresse de la page web qui montre la carte dans "carte_page". N’invente jamais une adresse : null si tu ne l’as pas vue.
Réponds par : {"name":"…","city":"…","holes":[{"par":4,"si":7}, … 18 trous dans l’ordre],"tees":[{"name":"Bleu","rating":71.2,"slope":128}],"carte_fichier":"https://…","carte_page":"https://…","confiance":"haute|moyenne|basse","notes":"ce qui manque ou semble douteux"}`
  });
  const n = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
  const holes = (Array.isArray(data.holes) ? data.holes : []).slice(0, 18).map(h => ({ par: n(h && h.par), si: n(h && h.si) }));
  while (holes.length < 18) holes.push({ par: null, si: null });
  const tees = (Array.isArray(data.tees) ? data.tees : []).filter(t => t && t.name).slice(0, 8).map(t => ({ name: String(t.name).slice(0, 30), rating: n(t.rating), slope: n(t.slope) }));
  const alertes = [];
  const pars = holes.map(h => h.par);
  if (pars.some(p => p === null || p < 3 || p > 6)) alertes.push('Des normales manquent ou semblent fausses.');
  const si = holes.map(h => h.si);
  if (si.some(x => x === null) || new Set(si).size !== 18 || si.some(x => x < 1 || x > 18)) alertes.push('Les handicaps des trous ne vont pas de 1 à 18 sans doublon.');
  if (!tees.length || tees.some(t => !t.rating || !t.slope || t.slope < 55 || t.slope > 155 || t.rating < 50 || t.rating > 80)) alertes.push('Vérifiez l’évaluation et le slope des tertres.');
  // La carte de pointage source, jointe pour la vérification : on confirme que l'adresse donne bien une image ou un PDF
  const http = u => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u) && u.length < 600 ? u : null);
  let carte = null;
  const f = http(data.carte_fichier);
  if (f) { const t = await typeCarte(f); if (t) carte = { url: f, type: t }; }
  const page = http(data.carte_page) || (carte ? null : urls[0] || null);
  if (!carte) alertes.push('Carte de pointage du club introuvable en image : ouvrez la page source pour vérifier.');
  return { name: String(data.name || nom).slice(0, 90), city: String(data.city || ville || '').slice(0, 60), holes, tees, carte, cartePage: page, confiance: ['haute', 'moyenne', 'basse'].includes(data.confiance) ? data.confiance : 'basse', notes: String(data.notes || '').slice(0, 600), alertes, sources: urls.slice(0, 6) };
}


// Service worker de déménagement, servi seulement sur app.fanion.ai (voir fetch plus bas).
const NOUVELLE_APP = 'https://app.lefanion.ai/';
const PAGE_DEMENAGEMENT = `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Le Fanion a déménagé</title>
<style>body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#FAF6EF;color:#1D1B18;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:420px;padding:32px 24px}h1{font-size:26px;line-height:1.2;margin:0 0 12px}a.b{display:block;text-align:center;background:#B3302A;color:#fff;text-decoration:none;font-weight:600;padding:14px 20px;border-radius:999px;margin:20px 0}ol{padding-left:20px;color:#6B665E}</style></head>
<body><main><h1>Le Fanion a déménagé</h1><p>L'app est maintenant à <b>app.lefanion.ai</b>. Ton compte, tes groupes et tes parties y sont déjà : tu n'as qu'à te reconnecter.</p>
<a class="b" href="https://app.lefanion.ai/">Ouvrir app.lefanion.ai</a>
<ol><li>Ouvre le lien ci-dessus dans Safari (iPhone) ou Chrome (Android).</li><li>Installe l'app sur ton écran d'accueil, comme la première fois.</li><li>Supprime l'ancienne icône du Fanion.</li></ol></main></body></html>`;
const SW_DEMENAGEMENT = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())));
const PAGE = ${JSON.stringify(PAGE_DEMENAGEMENT)};
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') e.respondWith(new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Le Fanion', { body: d.body || '', icon: '${NOUVELLE_APP}icon-192.png', tag: d.tag || undefined, data: { url: '${NOUVELLE_APP}' }, lang: 'fr-CA' }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.openWindow('${NOUVELLE_APP}')); });
`;

export default {
  async fetch(req, env, ctx) {
    // Déménagement vers lefanion.ai (même structure que les autres apps de L'Établi) :
    // les pages de l'ancien domaine redirigent pour de bon; l'API /api/ répond encore sur les deux.
    {
      const u = new URL(req.url), h = u.hostname;
      // Les apps déjà installées depuis app.fanion.ai : leur service worker ne suit pas les redirections.
      // On leur sert un service worker de déménagement qui affiche « Le Fanion a déménagé » et garde les notifications.
      if (h === 'app.fanion.ai' && u.pathname.endsWith('/sw.js')) {
        return new Response(SW_DEMENAGEMENT, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' } });
      }
      const cible = h === 'app.fanion.ai' ? 'app.lefanion.ai' : (h === 'fanion.ai' || h === 'www.fanion.ai') ? 'lefanion.ai' : h === 'www.lefanion.ai' ? 'lefanion.ai' : null;
      if (cible && (h === 'app.fanion.ai' || !u.pathname.startsWith('/api/'))) return Response.redirect('https://' + cible + u.pathname + u.search, 301);
    }
    const url = new URL(req.url), origin = req.headers.get('Origin') || '', app = appDe(origin);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (url.pathname === '/api/avis') {
      const cache = caches.default, key = new Request(url.origin + '/api/avis');
      let res = await cache.match(key);
      if (!res) { res = new Response(JSON.stringify(await avisPublies().catch(() => [])), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } }); await cache.put(key, res.clone()); }
      return res;
    }
    if (url.pathname === '/api/push/status') return json({ ready: !!env.VAPID_PRIVATE_JWK }, 200, origin);
    if (url.pathname === '/api/push' && req.method === 'POST') {
      if (!env.VAPID_PRIVATE_JWK) return json({ error: 'Notifications pas encore configurées.' }, 503, origin);
      const tk = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      let who; try { who = await verifyToken(tk); } catch (e) { return json({ error: 'Connexion requise.' }, 401, origin); }
      const uid = who.user_id || who.sub;
      if (tooMany('push:' + uid)) return json({ error: 'Trop de notifications d’un coup.' }, 429, origin);
      let data; try { data = await req.json(); } catch (e) { return json({ error: 'requête invalide' }, 400, origin); }
      try { return json(await pushGroup(env, tk, uid, data, app), 200, origin); } catch (e) { return json({ error: e.message }, 403, origin); }
    }
    if (url.pathname === '/api/retour' && req.method === 'POST') {
      const tk = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      let who; try { who = await verifyToken(tk); } catch (e) { return json({ error: 'Connexion requise.' }, 401, origin); }
      if (tooMany('retour:' + (who.user_id || who.sub))) return json({ error: 'Beaucoup d’envois d’un coup : réessayez plus tard.' }, 429, origin);
      let body = (await req.text()).slice(0, 8000);
      // Console des idées : partagée avec le Fanion pour l'instant ; l'app est notée devant le nom du groupe
      if (app.id !== 'fanion') { try { const b = JSON.parse(body); b.groupe = (app.nom + ' · ' + (b.groupe || '')).slice(0, 80); body = JSON.stringify(b); } catch (e) { } }
      const r = await fetch(RETOUR_FANION, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body }).catch(() => null);
      if (!r) return json({ error: 'Service indisponible.' }, 502, origin);
      const d = await r.json().catch(() => ({}));
      return json(r.ok ? d : { error: d.erreur || 'Erreur ' + r.status }, r.ok ? 200 : r.status, origin);
    }
    // Carte de pointage source, servie depuis fanion.ai : seulement une adresse signée par ce serveur, et seulement une image ou un PDF
    if (url.pathname === '/api/terrains/carte' && req.method === 'GET') {
      const u = url.searchParams.get('u') || '', s = url.searchParams.get('s') || '';
      if (!/^https?:\/\//i.test(u) || !s || s !== await signe(env, u)) return new Response('Lien invalide', { status: 403 });
      const cache = caches.default, ck = new Request('https://lefanion.ai/__carte/' + encodeURIComponent(u).slice(0, 900));
      const hit = await cache.match(ck); if (hit) return hit;
      let r; try { r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FanionBot/1.0; +https://lefanion.ai)', Accept: 'image/*,application/pdf' }, redirect: 'follow' }); } catch (e) { return new Response('Carte introuvable', { status: 502 }); }
      const t = (r.headers.get('content-type') || '').toLowerCase(), n = Number(r.headers.get('content-length') || 0);
      if (!r.ok || !/^(image\/(jpeg|png|webp|gif)|application\/pdf)/.test(t) || n > 15e6) return new Response('Carte introuvable', { status: 404 });
      const buf = await r.arrayBuffer(); if (buf.byteLength > 15e6) return new Response('Trop gros', { status: 413 });
      const res = new Response(buf, { headers: { 'Content-Type': t.split(';')[0], 'Cache-Control': 'public, max-age=604800', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' } });
      if (ctx) ctx.waitUntil(cache.put(ck, res.clone()));
      return res;
    }
    if (url.pathname === '/api/terrains' && req.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'La recherche de terrains n’est pas encore configurée.' }, 503, origin);
      const tk = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      let who; try { who = await verifyToken(tk); } catch (e) { return json({ error: 'Connexion requise.' }, 401, origin); }
      let data; try { data = await req.json(); } catch (e) { return json({ error: 'requête invalide' }, 400, origin); }
      // Région : une des 17 régions du Québec, ou un lieu libre ailleurs (« Guanacaste, Costa Rica ») trouvé d'après la position du joueur ou tapé
      data.region = String(data.region || '').replace(/[\u0000-\u001f<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const cle = data.action === 'region' ? 'region:' + data.region.toLowerCase() : 'carte:' + [data.nom, data.parcours, data.ville, data.region].map(x => String(x || '').trim().toLowerCase()).join('|');
      if (data.action === 'region' && data.region.length < 2) return json({ error: 'Région manquante.' }, 400, origin);
      if (data.action === 'carte' && String(data.nom || '').trim().length < 3) return json({ error: 'Nom du club manquant.' }, 400, origin);
      if (!['region', 'carte'].includes(data.action)) return json({ error: 'Action inconnue.' }, 400, origin);
      // Mémoire de 14 jours : la même région ou la même carte ne relance pas la recherche
      const cache = caches.default, ck = new Request('https://lefanion.ai/__terrains/' + encodeURIComponent(cle.slice(0, 200)));
      if (!data.frais) { const hit = await cache.match(ck); if (hit) return json(await hit.json(), 200, origin); }
      if (tooMany('terrains:' + (who.user_id || who.sub))) return json({ error: 'Beaucoup de recherches d’un coup : réessayez dans quelques minutes.' }, 429, origin);
      try {
        const out = data.action === 'region' ? await clubsRegion(env, data.region) : await carteClub(env, { nom: String(data.nom).slice(0, 90), ville: String(data.ville || '').slice(0, 60), parcours: String(data.parcours || '').slice(0, 60), region: data.region });
        if (out.carte) out.carte.vue = await carteVue(env, out.carte.url);
        if (ctx) ctx.waitUntil(cache.put(ck, new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1209600' } })));
        return json(out, 200, origin);
      } catch (e) { return json({ error: 'Recherche impossible pour l’instant (' + e.message + ').' }, 502, origin); }
    }
    if (url.pathname === '/api/caddie/status') return json({ ready: !!env.ANTHROPIC_API_KEY }, 200, origin);
    if (url.pathname === '/api/caddie' && req.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: 'Samuel, le caddie, n’est pas encore configuré.' }, 503, origin);
      const tk = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
      let who; try { who = await verifyToken(tk); } catch (e) { return json({ error: 'Connexion requise.' }, 401, origin); }
      if (tooMany(who.user_id || who.sub)) return json({ error: 'Beaucoup de questions d’un coup : réessayez dans quelques minutes.' }, 429, origin);
      let data; try { data = await req.json(); } catch (e) { return json({ error: 'requête invalide' }, 400, origin); }
      try {
        const text = await caddie(env, data.messages, app);
        // La question et la réponse sont notées dans la console HoldingAI (sans retarder la réponse au joueur)
        const q = [...(data.messages || [])].reverse().find(m => m && m.role !== 'assistant');
        if (ctx && q) ctx.waitUntil(fetch(JOURNAL_CADDIE, { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify({ question: (app.id === 'fanion' ? '' : '[' + app.nom + '] ') + String(q.content || '').slice(0, 2000 - (app.id === 'fanion' ? 0 : app.nom.length + 3)), reponse: text.slice(0, 4000) }) }).catch(() => {}));
        return json({ text }, 200, origin);
      } catch (e) { return json({ error: e.message }, 502, origin); }
    }
    const ready = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
    if (url.pathname === '/api/sms/status') return json({ ready }, 200, origin);
    if (url.pathname !== '/api/sms' || req.method !== 'POST') return json({ error: 'introuvable' }, 404, origin);
    if (!ready) return json({ error: 'Service de textos pas encore configuré.' }, 503, origin);
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    let who; try { who = await verifyToken(tok); } catch (e) { return json({ error: 'Connexion requise : ' + e.message }, 401, origin); }
    // Chaque texto coûte (Twilio) : au plus 10 envois par heure et par personne.
    if (tooMany('sms:' + (who.user_id || who.sub), 10)) return json({ error: 'Beaucoup de textos d’un coup : réessayez dans une heure.' }, 429, origin);
    let data; try { data = await req.json(); } catch (e) { return json({ error: 'requête invalide' }, 400, origin); }
    const body = String(data.text || '').slice(0, MAX_LEN).trim();
    const to = [...new Set((data.to || []).map(n => String(n).replace(/\D/g, '').slice(-10)).filter(n => n.length === 10))];
    if (!body || !to.length) return json({ error: 'message ou numéros manquants' }, 400, origin);
    if (to.length > MAX_TO) return json({ error: `maximum ${MAX_TO} numéros par envoi` }, 400, origin);
    let known; try { known = await knownPhones(tok, who.user_id || who.sub, app); } catch (e) { return json({ error: e.message }, 403, origin); }
    const sent = [], failed = [];
    for (const n of to) {
      if (!known.has(n)) { failed.push({ to: n, error: 'numéro hors du groupe' }); continue; }
      try { await sendSms(env, n, body); sent.push(n); } catch (e) { failed.push({ to: n, error: e.message }); }
    }
    return json({ sent: sent.length, failed }, 200, origin);
  }
};
