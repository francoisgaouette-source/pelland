// Samuel, le caddie de Fanion, en personne : un jeune caddie dessiné (casquette au fanion, dossard, sac sur l'épaule)
// qui fait visiter l'app étape par étape, salue à chaque arrivée et reste dans le coin pour répondre aux questions.
// Partagé par l'app (app.lefanion.ai) et le site (fanion.ai).
//   CaddieGuide.ouvrir({ etapes: [{ titre, texte, puce? }], fin: { titre, texte, bouton, action }, onFermer })
//   const p = CaddieGuide.presence({ surFace, label });  p.dire({ titre, texte, bouton, action, duree });  p.taire();  p.cacher(oui)
//   CaddieGuide.avatar() → le SVG du personnage
(function () {
  'use strict';
  const NOM = 'Samuel';

  const AVATAR = `<svg class="cd-av" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <circle cx="100" cy="100" r="98" fill="#DDEBE1"/>
  <clipPath id="cd-clip"><circle cx="100" cy="100" r="98"/></clipPath>
  <g clip-path="url(#cd-clip)">
    <g transform="rotate(14 140 120)">
      <rect x="128" y="70" width="34" height="110" rx="12" fill="#14231B"/>
      <rect x="128" y="96" width="34" height="8" fill="#E3A90B"/>
      <path d="M133 72 L127 40 M145 70 L146 34 M156 72 L166 44" stroke="#9AA59E" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="119" y="32" width="16" height="9" rx="3" fill="#C9D0CB"/><rect x="139" y="27" width="15" height="9" rx="3" fill="#C9D0CB"/>
      <path d="M162 40 a8 8 0 1 1 0.1 0" fill="#C9D0CB"/>
    </g>
    <path d="M28 200 C30 160 60 142 100 142 C140 142 170 160 172 200 Z" fill="#1F6B46"/>
    <path d="M62 200 L66 156 C78 150 88 148 100 148 C112 148 122 150 134 156 L138 200 Z" fill="#F6F7F3"/>
    <path d="M86 148 C90 156 110 156 114 148" stroke="#1F6B46" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g transform="translate(76 160)"><path d="M0 0 v22" stroke="#14231B" stroke-width="3" stroke-linecap="round"/><path d="M1.5 1 l16 6 -16 6.5z" fill="#E3A90B"/></g>
    <path d="M128 150 L76 200" stroke="#8A5A2B" stroke-width="7" stroke-linecap="round"/>
    <g class="cd-bras"><path d="M40 200 C36 178 30 160 26 146" stroke="#1F6B46" stroke-width="22" stroke-linecap="round" fill="none"/>
      <circle cx="24" cy="138" r="11" fill="#F6F7F3"/><path d="M17 134 h14" stroke="#D5DAD6" stroke-width="2"/></g>
    <path d="M89 120 H111 V146 C105 151 95 151 89 146 Z" fill="#C98E68"/>
    <g transform="rotate(3 100 130)"><g class="cd-tete">
      <ellipse cx="100" cy="94" rx="33" ry="37" fill="#DCA27D"/>
      <path d="M68 86 C66 98 67 104 69 108 L73 92 Z M132 86 C134 98 133 104 131 108 L127 92 Z" fill="#6B4024"/>
      <ellipse cx="66" cy="99" rx="5" ry="7" fill="#D3966F"/><ellipse cx="134" cy="99" rx="5" ry="7" fill="#D3966F"/>
      <path d="M64 80 C64 56 80 46 100 46 C120 46 136 56 136 80 Z" fill="#1F6B46"/>
      <path d="M62 80 C78 74 122 74 138 80 C150 82 158 86 160 90 C140 86 120 84 100 84 C82 84 70 84 62 82 Z" fill="#14231B"/>
      <circle cx="100" cy="47" r="3.5" fill="#14231B"/>
      <g transform="translate(94 56)"><path d="M0 0 v16" stroke="#F6F7F3" stroke-width="2.4" stroke-linecap="round"/><path d="M1.4 1 l11 4 -11 4.4z" fill="#E3A90B"/></g>
      <ellipse cx="79" cy="109" rx="7.5" ry="5.5" fill="#E9806F" opacity=".5"/><ellipse cx="121" cy="109" rx="7.5" ry="5.5" fill="#E9806F" opacity=".5"/>
      <g class="cd-yeux"><ellipse cx="87" cy="97" rx="4.6" ry="5" fill="#1D2520"/><ellipse cx="113" cy="97" rx="4.6" ry="5" fill="#1D2520"/>
        <circle cx="88.8" cy="95" r="1.6" fill="#fff"/><circle cx="114.8" cy="95" r="1.6" fill="#fff"/></g>
      <path d="M80 88 Q87 85 93.5 87.5 M106.5 87.5 Q113 85 120 88" stroke="#6B4024" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M100 100 Q102.5 105.5 99 107" stroke="#B57B58" stroke-width="2" fill="none" stroke-linecap="round"/>
      <g class="cd-bouche"><path d="M87 114 Q100 130 113 114 Q100 118 87 114 Z" fill="#8E2F36"/>
        <path d="M89.5 115 Q100 118.5 110.5 115 L109.6 118 Q100 120.4 90.4 118 Z" fill="#fff"/></g>
    </g></g>
  </g>
</svg>`;

  const CSS = `
.cd-fond{position:fixed;inset:0;z-index:1000;background:rgba(10,20,15,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:cd-in .2s ease-out}
@media (min-width:700px){.cd-fond{align-items:center}}
.cd-boite{width:100%;max-width:560px;background:var(--surface,#fff);color:var(--ink,#12201a);border-radius:22px;padding:22px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:var(--body,'Barlow',system-ui,sans-serif);max-height:calc(100vh - 32px);overflow:auto}
.cd-haut{display:grid;grid-template-columns:136px 1fr;gap:16px;align-items:end}
@media (max-width:420px){.cd-haut{grid-template-columns:104px 1fr;gap:10px}}
.cd-av{width:100%;height:auto;display:block}
.cd-bulle{position:relative;background:var(--bg,#eef2ee);border:1.5px solid var(--line,#d3ddd6);border-radius:16px 16px 16px 4px;padding:14px 16px;min-height:96px}
.cd-bulle::before{content:"";position:absolute;left:-9px;bottom:10px;width:14px;height:14px;background:var(--bg,#eef2ee);border-left:1.5px solid var(--line,#d3ddd6);border-bottom:1.5px solid var(--line,#d3ddd6);transform:rotate(45deg)}
.cd-puce{display:inline-block;font:700 12px var(--body,'Barlow',sans-serif);letter-spacing:.08em;text-transform:uppercase;color:var(--flag-ink,#1d1600);background:var(--flag,#e3a90c);border-radius:999px;padding:3px 10px;margin:0 0 8px}
.cd-titre{font-family:var(--display,'Barlow Condensed',sans-serif);font-weight:800;font-size:25px;line-height:1.05;margin:0 0 6px}
.cd-texte{margin:0;font-size:16.5px;line-height:1.45}
.cd-points{display:flex;gap:6px;justify-content:center;margin:16px 0 12px}
.cd-points span{width:8px;height:8px;border-radius:50%;background:var(--line,#d3ddd6)}
.cd-points span.on{background:var(--green,#1d6a45);width:22px;border-radius:999px}
.cd-actions{display:flex;align-items:center;gap:10px}
.cd-actions .cd-plein{margin-left:auto}
.cd-btn{font:600 16px var(--body,'Barlow',sans-serif);border-radius:10px;min-height:46px;padding:0 18px;cursor:pointer;border:1.5px solid var(--green,#1d6a45);background:transparent;color:var(--green,#1d6a45)}
.cd-btn.cd-plein{background:var(--green,#1d6a45);color:var(--green-ink,#fff)}
.cd-btn.cd-jaune{background:var(--flag,#e3a90c);border-color:var(--flag,#e3a90c);color:var(--flag-ink,#1d1600)}
.cd-btn:focus-visible,.cd-lien:focus-visible,.cd-mini:focus-visible{outline:3px solid var(--flag,#e3a90c);outline-offset:2px}
.cd-lien{background:none;border:0;color:var(--muted,#5b6b62);font:500 15px var(--body,'Barlow',sans-serif);text-decoration:underline;cursor:pointer;padding:6px 2px}
.cd-yeux{transform-origin:100px 97px;animation:cd-cligne 4.5s infinite}
.cd-parle .cd-bouche{transform-origin:100px 117px;animation:cd-parle .22s ease-in-out infinite alternate}
.cd-salue .cd-bras{transform-origin:34px 190px;animation:cd-salue .5s ease-in-out 3 alternate}
.cd-tete{transform-origin:100px 130px;animation:cd-hoche 3.2s ease-in-out infinite}
@keyframes cd-cligne{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes cd-parle{from{transform:scaleY(.7)}to{transform:scaleY(1.2)}}
@keyframes cd-salue{from{transform:rotate(0)}to{transform:rotate(14deg)}}
@keyframes cd-hoche{0%,100%{transform:rotate(0)}50%{transform:rotate(-1.5deg)}}
@keyframes cd-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.cd-yeux,.cd-tete,.cd-parle .cd-bouche,.cd-salue .cd-bras,.cd-fond{animation:none}}
.cd-lanceur{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:900;display:flex;align-items:flex-end;gap:8px;max-width:calc(100vw - 28px)}
.cd-lanceur .cd-mini{width:64px;height:64px;border-radius:50%;border:3px solid var(--surface,#fff);box-shadow:0 6px 18px rgba(0,0,0,.25);background:#DDEBE1;padding:0;cursor:pointer;flex:none;overflow:hidden}
.cd-lanceur .cd-mini svg{width:100%;height:100%}
.cd-lanceur[hidden],.cd-lanceur .cd-dit[hidden]{display:none}
body:has(.cd-fond) .cd-lanceur,body:has(#welcome) .cd-lanceur{display:none}
@media print{.cd-lanceur{display:none}}
.cd-lanceur .cd-dit{background:var(--surface,#fff);color:var(--ink,#12201a);border:1px solid var(--line,#d3ddd6);border-radius:14px 14px 4px 14px;padding:10px 12px;box-shadow:0 6px 18px rgba(0,0,0,.18);font:500 15px/1.35 var(--body,'Barlow',sans-serif);max-width:250px;position:relative}
.cd-lanceur .cd-dit b{display:block;font-family:var(--display,'Barlow Condensed',sans-serif);font-size:18px}
.cd-lanceur .cd-dit button.cd-go{all:unset;cursor:pointer;color:var(--green,#1d6a45);font-weight:700;text-decoration:underline;margin-top:6px;display:inline-block}
.cd-lanceur .cd-ferme{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:0;background:var(--ink,#12201a);color:var(--surface,#fff);font-size:13px;cursor:pointer;line-height:24px;padding:0}
`;

  let styleOk = false;
  function style() { if (styleOk) return; styleOk = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // La visite : une étape à la fois, Samuel parle dans sa bulle
  function ouvrir(opts) {
    style();
    const etapes = (opts.etapes || []).slice();
    if (opts.fin) etapes.push(Object.assign({ estFin: true }, opts.fin));
    let i = 0, minuterie = null;
    const avant = document.activeElement;
    const fond = document.createElement('div');
    fond.className = 'cd-fond';
    fond.innerHTML = `<div class="cd-boite" role="dialog" aria-modal="true" aria-labelledby="cd-titre">
      <div class="cd-haut"><div class="cd-perso cd-salue">${AVATAR}</div>
        <div class="cd-bulle" aria-live="polite"><div class="cd-contenu"></div></div></div>
      <div class="cd-points" aria-hidden="true">${etapes.map(() => '<span></span>').join('')}</div>
      <div class="cd-actions">
        <button type="button" class="cd-lien" data-cd="passer">Passer la visite</button>
        <button type="button" class="cd-btn" data-cd="prec">Précédent</button>
        <button type="button" class="cd-btn cd-plein" data-cd="suiv">Suivant</button>
      </div></div>`;
    document.body.appendChild(fond);
    const perso = fond.querySelector('.cd-perso'), contenu = fond.querySelector('.cd-contenu');
    const bPrec = fond.querySelector('[data-cd="prec"]'), bSuiv = fond.querySelector('[data-cd="suiv"]'), bPasser = fond.querySelector('[data-cd="passer"]');
    const ancien = document.body.style.overflow; document.body.style.overflow = 'hidden';
    function montrer() {
      const e = etapes[i];
      contenu.innerHTML = (e.puce ? `<div class="cd-puce">${esc(e.puce)}</div>` : '') + `<h2 class="cd-titre" id="cd-titre">${esc(e.titre)}</h2><p class="cd-texte">${esc(e.texte)}</p>`;
      fond.querySelectorAll('.cd-points span').forEach((s, k) => s.classList.toggle('on', k === i));
      bPrec.hidden = i === 0; bPasser.hidden = !!e.estFin;
      bSuiv.textContent = e.estFin ? (e.bouton || 'Terminer') : (i === 0 ? 'Allons-y' : 'Suivant');
      bSuiv.classList.toggle('cd-jaune', !!e.estFin);
      perso.classList.add('cd-parle'); clearTimeout(minuterie);
      minuterie = setTimeout(() => perso.classList.remove('cd-parle'), Math.min(4000, 600 + (e.texte || '').length * 22));
      if (i > 0) perso.classList.remove('cd-salue');
      bSuiv.focus();
    }
    function fermer(fini) {
      clearTimeout(minuterie); document.removeEventListener('keydown', clavier, true);
      fond.remove(); document.body.style.overflow = ancien;
      if (avant && avant.focus) try { avant.focus(); } catch (x) { }
      if (opts.onFermer) opts.onFermer(!!fini);
    }
    function clavier(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); fermer(false); }
      else if (ev.key === 'ArrowRight' && i < etapes.length - 1) { i++; montrer(); }
      else if (ev.key === 'ArrowLeft' && i > 0) { i--; montrer(); }
      else if (ev.key === 'Tab') {
        const f = [...fond.querySelectorAll('button')].filter(b => !b.hidden); if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', clavier, true);
    bPrec.onclick = () => { if (i > 0) { i--; montrer(); } };
    bPasser.onclick = () => fermer(false);
    bSuiv.onclick = () => { const e = etapes[i]; if (e.estFin) { fermer(true); if (e.action) e.action(); return; } i++; montrer(); };
    fond.addEventListener('click', ev => { if (ev.target === fond) fermer(false); });
    montrer();
    return { fermer };
  }

  // Samuel toujours présent : son visage dans le coin ; il peut dire un mot dans une bulle
  let active = null;
  function presence(opts) {
    style();
    if (active) return active;
    const box = document.createElement('div'); box.className = 'cd-lanceur';
    box.innerHTML = `<div class="cd-dit" role="status" hidden></div><button type="button" class="cd-mini" aria-label="${esc(opts.label || 'Parler à ' + NOM + ', votre caddie')}">${AVATAR}</button>`;
    document.body.appendChild(box);
    const dit = box.querySelector('.cd-dit'), mini = box.querySelector('.cd-mini');
    let minuterie = null;
    mini.onclick = () => { taire(); if (opts.surFace) opts.surFace(); };
    function taire() { clearTimeout(minuterie); dit.hidden = true; dit.innerHTML = ''; mini.classList.remove('cd-parle'); }
    function dire(m) {
      clearTimeout(minuterie);
      dit.innerHTML = `<button type="button" class="cd-ferme" aria-label="Fermer">✕</button><b>${esc(m.titre || '')}</b>${esc(m.texte || '')}` + (m.bouton ? `<br><button type="button" class="cd-go">${esc(m.bouton)}</button>` : '');
      dit.hidden = false;
      mini.classList.add('cd-parle'); setTimeout(() => mini.classList.remove('cd-parle'), Math.min(3500, 600 + (m.texte || '').length * 22));
      dit.querySelector('.cd-ferme').onclick = () => { taire(); if (m.onFermer) m.onFermer(); };
      const go = dit.querySelector('.cd-go'); if (go) go.onclick = () => { taire(); if (m.action) m.action(); };
      if (m.duree) minuterie = setTimeout(taire, m.duree);
    }
    active = { dire, taire, element: box, cacher: oui => { box.hidden = !!oui; if (oui) taire(); } };
    return active;
  }

  window.CaddieGuide = { NOM, ouvrir, presence, avatar: () => AVATAR };
})();
