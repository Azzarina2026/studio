/* Mattoni dell'interfaccia: creazione elementi, finestre, moduli, avvisi.
   Il testo passa sempre da textContent (mai innerHTML): i dati inseriti non possono diventare codice. */
import { parseNum, num, uid, r2 } from './util.js';

export function h(tag, attrs, ...figli) {
  const [nome, ...classi] = tag.split('.');
  const el = document.createElement(nome || 'div');
  if (classi.length) el.className = classi.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { figli.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'data') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  metti(el, figli);
  return el;
}
function metti(el, figli) { for (const f of figli.flat(Infinity)) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : String(f)); }
export const svg = (tag, attrs = {}, ...figli) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) k.startsWith('on') ? el.addEventListener(k.slice(2), v) : el.setAttribute(k, v);
  for (const f of figli.flat()) if (f != null && f !== false) el.append(f instanceof Node ? f : String(f));
  return el;
};

/* Icone a tratto (percorsi SVG 24×24) */
const ICONE = {
  casa: 'M3 11l9-8 9 8M5 10v10h14V10', persone: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  doc: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5', campana: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4',
  ingranaggio: 'M12 15a3 3 0 100-6 3 3 0 000 6M19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 3h-5l-.3 3a7 7 0 00-1.7 1l-2.4-1-2 3.4L5.100 11a7 7 0 000 2l-2 1.600 2 3.400 2.400-1a7 7 0 001.700 1l.3 3h5l.3-3a7 7 0 001.700-1l2.400 1 2-3.400-2-1.600a7 7 0 00.100-1',
  scudo: 'M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z', piu: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', matita: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  cestino: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', scarica: 'M12 4v12M7 11l5 5 5-5M5 20h14', cerca: 'M11 18a7 7 0 100-14 7 7 0 000 14M21 21l-5-5',
  esci: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3', sole: 'M12 17a5 5 0 100-10 5 5 0 000 10M12 1v2M12 21v2M4.200 4.200l1.400 1.400M18.400 18.400l1.400 1.400M1 12h2M21 12h2M4.200 19.800l1.400-1.400M18.400 5.600l1.400-1.400',
  ok: 'M5 12l5 5 9-10', graffetta: 'M21 12l-8.500 8.500a5 5 0 01-7-7L14 5a3.500 3.500 0 015 5l-8.500 8.500a2 2 0 01-3-3L15 8', freccia: 'M9 6l6 6-6 6', condividi: 'M8 12h8M12 8l4 4-4 4M4 4h16v16H4z',
  chiave: 'M15 7a4 4 0 11-3.900 5H8v3H5v3H2v-3l6.100-6.100A4 4 0 0115 7', occhio: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12M12 15a3 3 0 100-6 3 3 0 000 6', pausa: 'M8 5v14M16 5v14', play: 'M7 4l13 8-13 8z',
};
export const icona = (n, dim = 18) => svg('svg', { viewBox: '0 0 24 24', width: dim, height: dim, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ic' }, svg('path', { d: ICONE[n] || '' }));

export const btn = (testo, onclick, { tipo = '', ic, titolo, disabilitato } = {}) =>
  h('button.btn' + (tipo ? '.' + tipo : ''), { type: 'button', onclick, title: titolo, 'aria-label': testo ? null : titolo, disabled: disabilitato }, ic && icona(ic, 16), testo);

/* ---------- avvisi ---------- */
let pila;
export function toast(msg, tipo = 'ok') {
  pila ??= document.body.appendChild(h('div.toasts', { role: 'status', 'aria-live': 'polite' }));
  const t = pila.appendChild(h('div.toast.' + tipo, msg));
  setTimeout(() => t.remove(), tipo === 'err' ? 7000 : 3200);
}
export const errore = e => { console.error(e); toast(e?.message || String(e), 'err'); };

/* ---------- finestre ---------- */
export function finestra({ titolo, corpo, azioni = [], larga = false, onChiudi }) {
  const dlg = h('dialog.dlg' + (larga ? '.larga' : ''));
  const chiudi = v => { dlg.close(); dlg.remove(); onChiudi?.(v); };
  dlg.append(
    h('header', h('h2', titolo), h('button.icbtn', { type: 'button', 'aria-label': 'Chiudi', onclick: () => chiudi() }, icona('x'))),
    h('div.dlg-corpo', corpo),
    azioni.length ? h('footer', azioni.map(a => typeof a === 'function' ? a(chiudi) : a)) : null,
  );
  dlg.addEventListener('cancel', e => { e.preventDefault(); chiudi(); });
  document.body.append(dlg); dlg.showModal();
  return { dlg, chiudi };
}
export const conferma = (titolo, testo, { ok = 'Conferma', pericolo = false } = {}) => new Promise(res => {
  let fatto = false;
  finestra({ titolo, corpo: h('p.testo', testo), onChiudi: v => { if (!fatto) res(false); },
    azioni: [c => btn('Annulla', () => c()), c => btn(ok, () => { fatto = true; res(true); c(); }, { tipo: pericolo ? 'danger' : 'primary' })] });
});

/* ---------- moduli ----------
   campi: [{ k, label, tipo, opzioni, richiesto, w, aiuto, segnaposto }]
   tipo: testo | area | numero | euro | data | scelta | spunta | file | titolo
   k può essere annidato: "sedeLegale.via" */
const prendi = (o, k) => k.split('.').reduce((x, p) => x?.[p], o);
const poni = (o, k, v) => { const ps = k.split('.'); const u = ps.pop(); let x = o; for (const p of ps) x = x[p] ??= {}; x[u] = v; };

export function modulo(campi, valore = {}) {
  const letture = [];
  const el = h('form.modulo', { onsubmit: e => e.preventDefault(), novalidate: true });
  for (const c of campi) {
    if (!c) continue;
    if (c.tipo === 'titolo') { el.append(h('h3.mod-titolo', c.label)); continue; }
    const id = 'f' + uid(), v = prendi(valore, c.k);
    let inp;
    if (c.tipo === 'area') inp = h('textarea', { id, rows: c.righe || 3, value: v ?? '', placeholder: c.segnaposto });
    else if (c.tipo === 'scelta') inp = h('select', { id }, c.opzioni.map(o => { const [val, txt] = Array.isArray(o) ? o : [o, o]; return h('option', { value: val, selected: String(v ?? '') === String(val) }, txt); }));
    else if (c.tipo === 'spunta') inp = h('input', { id, type: 'checkbox', checked: !!v });
    else if (c.tipo === 'file') inp = h('input', { id, type: 'file', accept: c.accetta || '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.p7m' });
    else if (c.tipo === 'euro') inp = h('input', { id, type: 'text', inputMode: 'decimal', value: v === undefined || v === null || v === '' ? '' : num(v), placeholder: '0,00', class: 'num' });
    else inp = h('input', { id, type: c.tipo === 'data' ? 'date' : c.tipo === 'numero' ? 'number' : c.tipo === 'password' ? 'password' : c.tipo === 'email' ? 'email' : 'text', value: v ?? '', placeholder: c.segnaposto, step: c.passo || 'any', autocomplete: c.auto || 'off' });
    if (c.richiesto) inp.required = true;
    if (c.max) inp.maxLength = c.max;
    const err = h('small.err');
    const campo = c.tipo === 'spunta'
      ? h('label.campo.spunta', { class: 'w' + (c.w || 12) }, inp, h('span', c.label), c.aiuto && h('small', c.aiuto))
      : h('div.campo', { class: 'w' + (c.w || 12) }, h('label', { htmlFor: id }, c.label, c.richiesto && h('span.req', ' *')), inp, c.aiuto && h('small', c.aiuto), err);
    el.append(campo);
    letture.push({ c, inp, err, campo });
  }
  const leggi = () => {
    const out = structuredClone(valore), sbagli = [];
    for (const { c, inp, err, campo } of letture) {
      let v = c.tipo === 'spunta' ? inp.checked : c.tipo === 'file' ? (inp.files[0] || null) : c.tipo === 'euro' ? (inp.value.trim() === '' ? (c.vuoto ?? 0) : r2(parseNum(inp.value))) : c.tipo === 'numero' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value.trim();
      const manca = c.richiesto && (v === '' || v === null || v === undefined);
      const msg = manca ? 'Campo obbligatorio' : (c.valida?.(v) || '');
      err && (err.textContent = msg); campo.classList.toggle('ko', !!msg);
      if (msg) sbagli.push(inp);
      if (c.tipo === 'file') { if (v) out.__file = { ...(out.__file || {}), [c.k]: v }; } else poni(out, c.k, v);
    }
    if (sbagli.length) { sbagli[0].focus(); return null; }
    return out;
  };
  return { el, leggi, campi: letture };
}

/* Finestra con modulo: restituisce i dati compilati, oppure null se annullata. */
export function chiedi({ titolo, campi, valore = {}, ok = 'Salva', larga, nota, elimina }) {
  return new Promise(res => {
    const m = modulo(campi, valore);
    let esito = null;
    const invia = c => { const d = m.leggi(); if (d) { esito = d; c(); } };
    const f = finestra({ titolo, larga, corpo: [nota && h('p.testo', nota), m.el], onChiudi: () => res(esito),
      azioni: [elimina && (c => btn('Elimina', async () => { if (await conferma('Eliminare?', 'L’operazione non si può annullare.', { ok: 'Elimina', pericolo: true })) { esito = { __elimina: true }; c(); } }, { tipo: 'danger.sx' })),
        c => btn('Annulla', () => c()), c => btn(ok, () => invia(c), { tipo: 'primary' })].filter(Boolean) });
    m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); invia(f.chiudi); } });
    setTimeout(() => m.el.querySelector('input,select,textarea')?.focus(), 30);
  });
}

/* ---------- tabelle e piccoli componenti ---------- */
export function tabella(colonne, righe, { vuoto = 'Nessun elemento', suRiga } = {}) {
  if (!righe.length) return h('div.vuoto', vuoto);
  return h('div.tab-wrap', h('table.tab',
    h('thead', h('tr', colonne.map(c => h('th', { class: c.num ? 'num' : c.cls || '' }, c.t)))),
    h('tbody', righe.map(r => h('tr', { class: suRiga ? 'clic' : '', tabIndex: suRiga ? 0 : null, onclick: suRiga ? e => { if (!e.target.closest('button,a,input,select')) suRiga(r); } : null, onkeydown: suRiga ? e => { if (e.key === 'Enter' && e.target === e.currentTarget) suRiga(r); } : null },
      colonne.map(c => h('td', { class: c.num ? 'num' : c.cls || '', data: { t: c.t } }, c.v(r))))))));
}
export const chip = (testo, colore = '') => h('span.chip' + (colore ? '.' + colore : ''), testo);
export const vuoto = (testo, azione) => h('div.vuoto', h('p', testo), azione);
export const scheda = (titolo, ...corpo) => h('section.card', titolo && h('h3.card-t', titolo), corpo);

/* testo con **grassetto** e //corsivo// → nodi */
export function ricco(testo) {
  const out = [];
  String(testo ?? '').split(/(\*\*.+?\*\*|\/\/.+?\/\/)/g).forEach(p => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) out.push(h('b', ricco(p.slice(2, -2))));
    else if (p.startsWith('//') && p.endsWith('//') && p.length > 4) out.push(h('i', ricco(p.slice(2, -2))));
    else if (p) out.push(p);
  });
  return out;
}
/* rende cliccabili i link dentro un testo */
export function conLink(testo) {
  return String(testo ?? '').split(/(https?:\/\/[^\s]+)/g).map(p => /^https?:\/\//.test(p) ? h('a', { href: p, target: '_blank', rel: 'noopener noreferrer' }, p) : p);
}
export function scaricaBlob(blob, nome) {
  const a = h('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
