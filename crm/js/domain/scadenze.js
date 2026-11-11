/* Piano dei compensi di un incarico. Funzioni pure.

   compenso = {
     importo,                       // importo di ogni rata
     periodicita,                   // vedi PERIODICITA; 'libere' = solo le date elencate in dateLibere
     prima,                         // data della prima scadenza
     fine,                          // (facoltativa) ultima data utile
     rate,                          // (facoltativo) numero massimo di rate
     competenza,                    // 'posticipata' = il periodo si chiude alla scadenza; 'anticipata' = si apre
     dateLibere: [{ data, importo, descr }],
     adeguamenti: [{ dal, tipo: 'perc'|'cifra', valore, ripeti: 'no'|'annuale', nota }]
   } */
import { addMonths, yearOf, toDate, MESI, r2 } from '../core/util.js';

export const PERIODICITA = {
  mensile: { mesi: 1, nome: 'Mensile' },
  bimestrale: { mesi: 2, nome: 'Bimestrale' },
  trimestrale: { mesi: 3, nome: 'Trimestrale' },
  quadrimestrale: { mesi: 4, nome: 'Quadrimestrale' },
  semestrale: { mesi: 6, nome: 'Semestrale' },
  annuale: { mesi: 12, nome: 'Annuale' },
  unatantum: { mesi: 0, nome: 'Una tantum' },
  libere: { mesi: 0, nome: 'Date libere' },
};
const ORD = ['Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto', 'Sesto'];
const NOME_PERIODO = { 2: 'Bimestre', 3: 'Trimestre', 4: 'Quadrimestre', 6: 'Semestre' };

/* Importo in vigore a una certa data, applicando in ordine tutti gli adeguamenti già maturati. */
export function importoAl(compenso, data) {
  let imp = Number(compenso.importo) || 0;
  const eventi = [];
  for (const a of compenso.adeguamenti || []) {
    if (!a.dal || !a.valore) continue;
    if (a.ripeti === 'annuale') { for (let d = a.dal, i = 0; d <= data && i < 60; d = addMonths(d, 12), i++) eventi.push({ ...a, quando: d }); }
    else if (a.dal <= data) eventi.push({ ...a, quando: a.dal });
  }
  eventi.sort((x, y) => x.quando < y.quando ? -1 : 1);
  for (const e of eventi) imp = e.tipo === 'perc' ? imp * (1 + Number(e.valore) / 100) : imp + Number(e.valore);
  return r2(imp);
}

/* Descrizione del periodo di competenza, nello stile "Secondo Trimestre Anno 2025". */
export function etichettaCompetenza(compenso, data) {
  const mesi = PERIODICITA[compenso.periodicita]?.mesi || 0;
  if (!mesi) return '';
  // mese di riferimento: l'ultimo del periodo (posticipata) o il primo (anticipata)
  const rif = compenso.competenza === 'anticipata' ? toDate(data) : toDate(addMonths(data, -1));
  const d = compenso.competenza === 'anticipata' ? rif : (toDate(data).getDate() >= 28 ? toDate(data) : rif);
  const m = d.getMonth(), y = d.getFullYear();
  if (mesi === 1) return `${MESI[m]} ${y}`;
  if (mesi === 12) return `Anno ${y}`;
  return `${ORD[Math.floor(m / mesi)]} ${NOME_PERIODO[mesi]} Anno ${y}`;
}

/* Tutte le scadenze comprese tra "da" e "a" (estremi inclusi). */
export function scadenze(incarico, da, a) {
  const c = incarico.compenso;
  if (!c) return [];
  const out = [];
  const push = (data, importo, competenza) => {
    if (data < da || data > a) return;
    if (c.fine && data > c.fine) return;
    out.push({ chiave: `${incarico.id}|${data}`, data, importo: r2(importo), competenza });
  };
  for (const l of c.dateLibere || []) if (l.data) push(l.data, l.importo || importoAl(c, l.data), l.descr || '');
  const mesi = PERIODICITA[c.periodicita]?.mesi;
  if (c.prima && c.periodicita === 'unatantum') push(c.prima, importoAl(c, c.prima), '');
  if (c.prima && mesi) {
    const max = Number(c.rate) || 600;
    for (let i = 0, d = c.prima; i < max && d <= a; i++, d = addMonths(c.prima, mesi * i)) push(d, importoAl(c, d), etichettaCompetenza(c, d));
  }
  return out.sort((x, y) => x.data < y.data ? -1 : 1);
}

export const annoCompetenza = s => yearOf(s);
