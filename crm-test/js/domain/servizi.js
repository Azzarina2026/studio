/* Operazioni che seguono le regole dello studio: bozze automatiche, emissione, incassi, promemoria. */
import { S, salva, cliente } from '../core/stato.js';
import { today, dmy, yearOf, daysBetween, sum, clone, uid, r2 } from '../core/util.js';
import { scadenze } from './scadenze.js';
import { calcola, opzioni } from './calcolo.js';
import { LIMITI } from '../config.js';

/* ---------- proforma ---------- */
export function testoDescrizione(prof, c, p) {
  const v = { cliente: c?.nome || '', dataMandato: dmy(p.dataMandato) || '…', qualita: p.qualita || prof.qualita || '', competenza: p.competenza || '' };
  return prof.descrizione.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
}

export function nuovaBozza(idProfilo, c, incarico, scad) {
  const prof = S.profili[idProfilo];
  const data = scad?.data || today();
  const p = {
    id: uid(), profilo: idProfilo, clienteId: c.id, incaricoId: incarico?.id || null, origine: scad?.chiave || null, stato: 'bozza',
    numero: null, anno: yearOf(data), data, scadenzaPagamento: '', competenza: scad?.competenza || '', dataMandato: incarico?.dataMandato || '', qualita: incarico?.qualita || prof.qualita || '',
    voci: [{ d: scad?.competenza || incarico?.oggetto || 'Onorario', imp: scad?.importo ?? 0 }],
    anticipazioni: [], opz: opzioni(prof.opz, c.opz), forzati: {}, etichette: {}, diciture: [], forfettario: !!c.forfettario, ibanId: null, pagamenti: [],
  };
  if (p.forfettario) p.opz.rit.on = false;            // cliente forfettario: non è sostituto d'imposta, niente ritenuta
  p.descr = testoDescrizione(prof, c, p);
  p.totali = calcola(p).tot;
  return p;
}

/* All'apertura del CRM: crea le bozze per tutte le scadenze maturate e non ancora generate. */
export async function generaBozze() {
  const oggi = today(), fatte = new Set(S.proforma.map(p => p.origine).filter(Boolean));
  let n = 0;
  for (const inc of S.incarichi) {
    if (inc.attivo === false || !inc.compenso || !S.profili[inc.profilo]) continue;
    const c = cliente(inc.clienteId);
    if (!c || c.stato?.[inc.profilo]?.attivo === false) continue;
    const da = inc.compenso.generaDal || inc.creato || oggi;
    for (const s of scadenze(inc, da, oggi)) {
      if (fatte.has(s.chiave)) continue;
      await salva('proforma', nuovaBozza(inc.profilo, c, inc, s), { silenzioso: true });
      fatte.add(s.chiave); n++;
    }
  }
  return n;
}

export const etichettaNumero = p => p.numero ? `${p.numero}/${p.anno}` : 'bozza';
export const incassato = p => sum(p.pagamenti || [], x => x.importo);
export const dovuto = p => p.totali?.netto ?? calcola(p).tot.netto;
export const residuo = p => r2(dovuto(p) - incassato(p));
export function statoDi(p) {
  if (p.stato === 'bozza' || p.stato === 'annullata') return p.stato;
  if (residuo(p) <= 0.005) return 'saldata';
  if (p.scadenzaPagamento && p.scadenzaPagamento < today()) return 'scaduta';
  return incassato(p) > 0 ? 'parziale' : 'emessa';
}
export const STATI = { bozza: ['Bozza', 'grigio'], emessa: ['Da incassare', 'blu'], parziale: ['Acconto', 'ambra'], scaduta: ['Scaduta', 'rosso'], saldata: ['Saldata', 'verde'], annullata: ['Annullata', 'grigio'] };

/* Assegna il numero progressivo del profilo e registra gli addebiti delle spese anticipate. */
export async function emetti(p, ibanId) {
  const prof = clone(S.profili[p.profilo]);
  const anno = yearOf(p.data);
  if (!p.numero) {
    if (prof.numerazione.anno !== anno) prof.numerazione = { anno, prossimo: 1 };
    p.numero = prof.numerazione.prossimo; p.anno = anno;
    prof.numerazione.prossimo = p.numero + 1;
    await salva('profili', prof, { silenzioso: true });
  }
  p.stato = 'emessa'; p.ibanId = ibanId || p.ibanId; p.totali = calcola(p).tot;
  for (const a of p.anticipazioni || []) {
    const s = a.spesaId && S.spese.find(x => x.id === a.spesaId);
    if (!s) continue;
    s.addebiti = (s.addebiti || []).filter(x => x.proformaId !== p.id).concat({ proformaId: p.id, importo: r2(a.imp) });
    await salva('spese', s, { silenzioso: true });
  }
  return salva('proforma', p);
}
export async function liberaSpese(p) {
  for (const s of S.spese.filter(s => (s.addebiti || []).some(x => x.proformaId === p.id))) {
    s.addebiti = s.addebiti.filter(x => x.proformaId !== p.id);
    await salva('spese', s, { silenzioso: true });
  }
}
export const addebitato = s => sum(s.addebiti || [], x => x.importo);
export const residuoSpesa = s => r2(s.importo - addebitato(s));

/* ---------- promemoria ---------- */
export function avvisi() {
  const oggi = today(), max = Math.max(...LIMITI.avvisiGiorni), out = [];
  for (const c of S.clienti) {
    if (!c.profili.some(p => S.sessione.profili.includes(p) && c.stato?.[p]?.attivo !== false)) continue;   // i clienti disattivati non generano avvisi
    for (const [gruppo, lista] of [['Documento', c.documenti || []], ['Antiriciclaggio', c.aml || []]]) for (const d of lista) {
      if (!d.scadenza) continue;
      const g = daysBetween(oggi, d.scadenza);
      if (g <= max) out.push({ cliente: c, gruppo, doc: d, giorni: g, livello: g < 0 ? 'rosso' : g <= LIMITI.avvisiGiorni[2] ? 'rosso' : g <= LIMITI.avvisiGiorni[1] ? 'ambra' : 'blu' });
    }
  }
  return out.sort((a, b) => a.giorni - b.giorni);
}
