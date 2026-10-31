// Fanion : sert le site (dossier site/) et l'envoi de textos /api/sms par Twilio.
// Secrets à entrer dans Cloudflare (Workers & Pages → pelland → Settings → Variables and secrets) :
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (ex. +15145550000)
// Sécurité : seuls les membres connectés (jeton Firebase) peuvent texter, et seulement des numéros
// enregistrés dans le groupe (collection Firestore « phones »). Maximum 30 numéros par envoi.

const PROJECT = 'pelland';
const ORIGINS = ['https://francoisgaouette-source.github.io', 'https://fanion.ai', 'https://www.fanion.ai', 'https://app.fanion.ai'];
const MAX_TO = 30, MAX_LEN = 1200;

const cors = origin => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Vary': 'Origin'
});
const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

// --- Vérification du jeton Firebase (RS256) ---
let KEYS = null, KEYS_AT = 0;
async function googleKeys() {
  if (KEYS && Date.now() - KEYS_AT < 3600e3) return KEYS;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  KEYS = (await r.json()).keys; KEYS_AT = Date.now(); return KEYS;
}
const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function verifyToken(tok) {
  const [h, p, sig] = (tok || '').split('.'); if (!sig) throw new Error('jeton manquant');
  const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  const jwk = (await googleKeys()).find(k => k.kid === head.kid); if (!jwk) throw new Error('clé inconnue');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== PROJECT || pay.iss !== 'https://securetoken.google.com/' + PROJECT || pay.exp < now) throw new Error('jeton invalide');
  if ((pay.firebase || {}).sign_in_provider !== 'password') throw new Error('membre requis');
  return pay;
}

// --- Numéros enregistrés (lus avec le jeton du membre, donc selon les règles Firestore) ---
async function knownPhones(tok) {
  const set = new Set(); let page = '';
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/phones?pageSize=300${page ? '&pageToken=' + page : ''}`, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error('lecture des numéros refusée');
    const d = await r.json();
    (d.documents || []).forEach(doc => { const v = ((doc.fields || {}).phone || {}).stringValue; if (v) set.add(v.replace(/\D/g, '').slice(-10)); });
    if (!d.nextPageToken) break; page = d.nextPageToken;
  }
  return set;
}

async function sendSms(env, to, body) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: '+1' + to, From: env.TWILIO_FROM, Body: body })
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Twilio ' + r.status); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const ready = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
    if (url.pathname === '/api/sms/status') return json({ ready }, 200, origin);
    if (url.pathname !== '/api/sms' || req.method !== 'POST') return json({ error: 'introuvable' }, 404, origin);
    if (!ready) return json({ error: 'Service de textos pas encore configuré.' }, 503, origin);
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    try { await verifyToken(tok); } catch (e) { return json({ error: 'Connexion requise : ' + e.message }, 401, origin); }
    let data; try { data = await req.json(); } catch (e) { return json({ error: 'requête invalide' }, 400, origin); }
    const body = String(data.text || '').slice(0, MAX_LEN).trim();
    const to = [...new Set((data.to || []).map(n => String(n).replace(/\D/g, '').slice(-10)).filter(n => n.length === 10))];
    if (!body || !to.length) return json({ error: 'message ou numéros manquants' }, 400, origin);
    if (to.length > MAX_TO) return json({ error: `maximum ${MAX_TO} numéros par envoi` }, 400, origin);
    let known; try { known = await knownPhones(tok); } catch (e) { return json({ error: e.message }, 403, origin); }
    const sent = [], failed = [];
    for (const n of to) {
      if (!known.has(n)) { failed.push({ to: n, error: 'numéro hors du groupe' }); continue; }
      try { await sendSms(env, n, body); sent.push(n); } catch (e) { failed.push({ to: n, error: e.message }); }
    }
    return json({ sent: sent.length, failed }, 200, origin);
  }
};
