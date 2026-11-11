/* Area super admin: condivisione clienti tra profili, duplicati, importazione, copia di sicurezza. */
import { S, salva, elimina, be, avvisa, scegliProfilo } from '../core/stato.js';
import { h, btn, chip, tabella, scheda, conferma, toast, errore, icona, scaricaBlob } from '../core/ui.js';
import { norm, by, today, uid } from '../core/util.js';
import { testata, vai } from '../main.js';
import { PROFILI, ID_PROFILI } from '../domain/profili.js';

let filtro = '';

export function vista() {
  const corpo = h('div');
  const ridisegna = () => {
    const q = norm(filtro);
    corpo.replaceChildren(tabella([
      { t: 'Cliente', v: c => h('div', h('div.princ', c.nome), h('div.sotto', c.piva ? 'P.IVA ' + c.piva : c.cf || '')) },
      ...ID_PROFILI.map(p => ({ t: PROFILI[p].nome, v: c => h('label.campo.spunta', h('input', { type: 'checkbox', checked: c.profili.includes(p), 'aria-label': `${c.nome} visibile a ${PROFILI[p].nome}`, onchange: e => condividi(c, p, e.target.checked, e.target) }),
        h('small', c.profili.includes(p) ? (c.stato?.[p]?.codice ? 'cod. ' + c.stato[p].codice : '') + (c.stato?.[p]?.attivo === false ? ' · disattivato' : '') : '')) })),
      { t: '', cls: 'az', v: c => btn('Apri', () => apri(c), { tipo: 'sm' }) },
    ], S.clienti.filter(c => !q || norm(c.nome + ' ' + c.piva + ' ' + c.cf).includes(q)).sort(by(c => norm(c.nome))), { vuoto: 'Nessun cliente.' }));
  };
  ridisegna();
  const doppi = duplicati();
  return h('div',
    testata(['Super ', h('b', 'admin')]),
    h('div.pila',
      doppi.length ? scheda([icona('condividi'), `Possibili duplicati (${doppi.length})`],
        h('p.testo', 'Clienti con la stessa partita IVA o codice fiscale inseriti da profili diversi. Unendoli resta una sola scheda in comune, con incarichi, spese e proforma di entrambi.'),
        h('div.pila', doppi.map(([a, b]) => h('div.riga', h('b', a.nome), chip(a.profili.map(p => PROFILI[p].nome).join('+'), 'nudo'), '↔', h('span', b.nome), chip(b.profili.map(p => PROFILI[p].nome).join('+'), 'nudo'), btn('Unisci', () => unisci(a, b), { tipo: 'sm.primary' }))))) : null,
      scheda('Clienti e condivisione tra profili',
        h('div.filtri', h('div.cerca', icona('cerca', 16), h('input', { type: 'search', placeholder: 'Cerca…', 'aria-label': 'Cerca clienti', value: filtro, oninput: e => { filtro = e.target.value; ridisegna(); } })),
          h('span.dim', 'Spunta un profilo per rendere il cliente visibile anche a quell’utente: la scheda resta una sola.')),
        corpo),
      scheda('Importa anagrafiche',
        h('p.testo', 'Carica un file CSV o JSON con le anagrafiche: i dati vengono letti direttamente dal tuo browser e salvati nel CRM, senza passare da nessun altro. Se un cliente esiste già (stessa P.IVA o codice fiscale) viene aggiunto al profilo scelto invece di essere duplicato.'),
        h('div.riga', h('select', { id: 'imp-profilo', style: { width: 'auto' }, 'aria-label': 'Profilo di destinazione' }, ID_PROFILI.map(p => h('option', { value: p, selected: p === S.profilo }, 'Destinazione: ' + PROFILI[p].nome))),
          h('input', { type: 'file', accept: '.csv,.json,.txt', style: { width: 'auto' }, 'aria-label': 'File da importare', onchange: e => importa(e.target) }),
          btn('Scarica modello CSV', () => scaricaBlob(new Blob(['﻿' + COLONNE.join(';') + '\n'], { type: 'text/csv' }), 'modello-anagrafiche.csv'), { tipo: 'sm', ic: 'scarica' }))),
      scheda('Copia di sicurezza',
        h('p.testo', 'Scarica sul tuo computer una copia completa dei dati (clienti, incarichi, spese, proforma, impostazioni). Gli allegati non sono inclusi.'),
        btn('Scarica copia dei dati', () => scaricaBlob(new Blob([JSON.stringify({ creato: new Date().toISOString(), clienti: S.clienti, incarichi: S.incarichi, spese: S.spese, proforma: S.proforma, profili: S.profili }, null, 1)], { type: 'application/json' }), `crm-studio-accogli-${today()}.json`), { ic: 'scarica' }))));
}

function apri(c) { if (!c.profili.includes(S.profilo)) scegliProfilo(c.profili[0]); vai('#/clienti/' + c.id); }

async function condividi(c, p, attiva, casella) {
  if (!attiva) {
    const legati = ['incarichi', 'spese', 'proforma'].some(r => S[r].some(x => x.clienteId === c.id && x.profilo === p));
    if (c.profili.length === 1 || legati) { casella.checked = true; return toast(legati ? `${PROFILI[p].nome} ha incarichi, spese o proforma su questo cliente: non si può togliere.` : 'Un cliente deve appartenere ad almeno un profilo.', 'err'); }
  }
  const profili = attiva ? [...new Set([...c.profili, p])] : c.profili.filter(x => x !== p);
  const stato = { ...c.stato }; if (attiva) stato[p] ??= { attivo: true, codice: '' }; else delete stato[p];
  salva('clienti', { ...c, profili, stato }).then(() => toast(attiva ? `Ora visibile anche a ${PROFILI[p].nome}` : `Tolto dall’elenco di ${PROFILI[p].nome}`)).catch(errore);
}

function duplicati() {
  const out = [], visti = new Map();
  for (const c of S.clienti) for (const k of [c.piva && 'p' + c.piva, c.cf && 'c' + c.cf].filter(Boolean)) {
    const altro = visti.get(k);
    if (altro && altro !== c && !out.some(([a, b]) => (a === altro && b === c))) out.push([altro, c]); else if (!altro) visti.set(k, c);
  }
  return out;
}
async function unisci(a, b) {
  if (!await conferma('Unire i due clienti?', `«${b.nome}» confluirà in «${a.nome}»: incarichi, spese, proforma, documenti e note passano alla scheda unica. L’operazione non si può annullare.`, { ok: 'Unisci' })) return;
  try {
    for (const r of ['incarichi', 'spese', 'proforma']) for (const x of S[r].filter(x => x.clienteId === b.id)) await salva(r, { ...x, clienteId: a.id }, { silenzioso: true });
    const u = { ...a, profili: [...new Set([...a.profili, ...b.profili])], stato: { ...b.stato, ...a.stato },
      note: [...(a.note || []), ...(b.note || [])], documenti: [...(a.documenti || []), ...(b.documenti || []).map(d => ({ ...d, file: null }))], aml: [...(a.aml || []), ...(b.aml || []).map(d => ({ ...d, file: null }))] };
    for (const k of ['piva', 'cf', 'sdi', 'pec', 'email', 'telefono', 'referente']) u[k] ||= b[k];
    await salva('clienti', u, { silenzioso: true });
    await elimina('clienti', b.id); toast('Clienti uniti');
  } catch (e) { errore(e); }
}

/* ---------- importazione ---------- */
const COLONNE = ['nome', 'tipo', 'piva', 'cf', 'sdi', 'codice', 'referente', 'via_sede_legale', 'citta_sede_legale', 'via_sede_operativa', 'citta_sede_operativa', 'pec', 'email', 'telefono', 'forfettario'];
function leggiCsv(testo) {
  const sep = (testo.split('\n')[0].match(/;/g) || []).length >= (testo.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const righe = []; let riga = [], cella = '', dentro = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (dentro) { if (ch === '"' && testo[i + 1] === '"') { cella += '"'; i++; } else if (ch === '"') dentro = false; else cella += ch; }
    else if (ch === '"') dentro = true; else if (ch === sep) { riga.push(cella); cella = ''; }
    else if (ch === '\n') { riga.push(cella); righe.push(riga); riga = []; cella = ''; } else if (ch !== '\r') cella += ch;
  }
  if (cella || riga.length) { riga.push(cella); righe.push(riga); }
  const testa = righe.shift().map(x => norm(x).replace(/\s+/g, '_'));
  return righe.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(testa.map((k, i) => [k, (r[i] || '').trim()])));
}
async function importa(input) {
  const file = input.files[0], p = document.getElementById('imp-profilo').value;
  if (!file) return;
  try {
    const testo = (await file.text()).replace(/^﻿/, '');
    const voci = file.name.endsWith('.json') ? JSON.parse(testo) : leggiCsv(testo);
    if (!Array.isArray(voci) || !voci.length) throw new Error('Il file non contiene anagrafiche.');
    if (!await conferma('Importare le anagrafiche?', `${voci.length} righe verranno importate nell’elenco di ${PROFILI[p].nome}.`, { ok: 'Importa' })) return;
    let nuovi = 0, agganciati = 0, saltati = 0;
    for (const v of voci) {
      const nome = (v.nome || v.ragione_sociale || v.denominazione || '').trim();
      if (!nome) { saltati++; continue; }
      const piva = String(v.piva || v.partita_iva || '').replace(/\s/g, ''), cf = String(v.cf || v.codice_fiscale || '').replace(/\s/g, '').toUpperCase(), codice = String(v.codice || v.codice_ditta || '');
      const gia = S.clienti.find(c => (piva && c.piva === piva) || (cf && c.cf === cf));
      if (gia) {
        if (!gia.profili.includes(p) || (codice && gia.stato?.[p]?.codice !== codice)) { await salva('clienti', { ...gia, profili: [...new Set([...gia.profili, p])], stato: { ...gia.stato, [p]: { attivo: true, ...(gia.stato?.[p] || {}), codice: codice || gia.stato?.[p]?.codice || '' } } }, { silenzioso: true }); agganciati++; }
        else saltati++;
        continue;
      }
      await salva('clienti', { id: uid(), tipo: /pers|fis/i.test(v.tipo || '') ? 'persona' : 'azienda', nome, piva, cf, sdi: v.sdi || v.codice_univoco || '', referente: v.referente || '',
        sedeLegale: { via: v.via_sede_legale || v.indirizzo || '', citta: v.citta_sede_legale || [v.cap, v.citta || v.comune, v.provincia && `(${v.provincia})`].filter(Boolean).join(' ') },
        sedeOperativa: { via: v.via_sede_operativa || '', citta: v.citta_sede_operativa || '' }, pec: v.pec || '', email: v.email || '', telefono: v.telefono || '',
        forfettario: /^(si|sì|s|x|1|true)$/i.test(v.forfettario || ''), profili: [p], stato: { [p]: { attivo: true, codice } }, note: [], documenti: [], aml: [], portale: { abilitato: false }, creato: today() }, { silenzioso: true });
      nuovi++;
    }
    toast(`Importazione completata: ${nuovi} nuovi, ${agganciati} collegati a clienti esistenti, ${saltati} saltati.`);
    avvisa();
  } catch (e) { errore(e); } finally { input.value = ''; }
}
void be;
