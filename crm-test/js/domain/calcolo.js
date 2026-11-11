/* Motore di calcolo del proforma. Funzioni pure: nessun accesso a dati o interfaccia.

   Riproduce le formule del foglio Excel usato in studio:
     Totale Onorario  = somma delle voci (+ spese generali − sconto, se attivi)
     Maggiorazione    = % × Totale Onorario
     Imponibile       = Totale Onorario + Maggiorazione
     IVA              = % × Imponibile
     Anticipazioni    = somma delle spese anticipate (fuori imponibile)
     Bollo            = importo fisso, se attivo
     Totale           = Imponibile + IVA + Anticipazioni + Bollo
     Ritenuta         = % × base (Totale Onorario oppure Imponibile)
     Netto            = Totale − Ritenuta (− IVA con scissione dei pagamenti)

   Ogni riga calcolata può essere forzata a mano (p.forzati[chiave]) e ogni etichetta
   può essere riscritta (p.etichette[chiave]). Per cambiare una regola basta toccare qui. */
import { r2, num } from '../core/util.js';

export const OPZIONI_BASE = {
  speseGen: { on: false, perc: 15, label: 'Spese generali {perc}%' },
  sconto:   { on: false, imp: 0,   label: 'Sconto' },
  magg:     { on: true,  perc: 4,  label: 'Maggiorazione {perc}% Legge n° 249/91' },
  iva:      { on: true,  perc: 22, label: 'IVA {perc}%' },
  antic:    { label: 'Anticipazioni art. 15 D.P.R. 633/72' },
  bollo:    { on: false, imp: 2,   label: 'Imposta di bollo' },
  rit:      { on: true,  perc: 20, base: 'onorario', label: "Ritenuta d'Acconto ({perc}% su: {base})" },
  split:    { on: false },
};

/* Unisce le opzioni salvate con quelle di base, così aggiungere un'opzione nuova non rompe i dati vecchi. */
export function opzioni(...strati) {
  const out = {};
  for (const k of Object.keys(OPZIONI_BASE)) out[k] = Object.assign({}, OPZIONI_BASE[k], ...strati.map(s => (s && s[k]) || {}));
  return out;
}

const perc = n => String(n).replace('.', ',');

export function calcola(p) {
  const o = opzioni(p.opz);
  const F = p.forzati || {}, E = p.etichette || {};
  const righe = [];
  const val = (k, calcolato) => (F[k] !== undefined && F[k] !== null && F[k] !== '') ? r2(F[k]) : r2(calcolato);
  const riga = (k, label, v, tipo, extra = {}) => { righe.push({ k, label: E[k] || label, val: v, tipo, forzato: F[k] !== undefined && F[k] !== null && F[k] !== '', ...extra }); return v; };

  let somma = 0;
  (p.voci || []).forEach((v, i) => { somma += r2(v.imp); righe.push({ k: 'voce' + i, label: v.d, val: r2(v.imp), tipo: 'voce', i }); });
  if (o.speseGen.on) somma += riga('speseGen', o.speseGen.label.replace('{perc}', perc(o.speseGen.perc)), val('speseGen', somma * o.speseGen.perc / 100), 'calc');
  if (o.sconto.on) somma -= riga('sconto', o.sconto.label, val('sconto', o.sconto.imp), 'meno');
  const onorario = riga('onorario', 'Totale Onorario', val('onorario', somma), 'sub');

  const magg = o.magg.on ? riga('magg', o.magg.label.replace('{perc}', perc(o.magg.perc)), val('magg', onorario * o.magg.perc / 100), 'calc') : 0;
  const imponibile = riga('imponibile', 'Imponibile', val('imponibile', onorario + magg), 'sub');
  const iva = o.iva.on ? riga('iva', o.iva.label.replace('{perc}', perc(o.iva.perc)), val('iva', imponibile * o.iva.perc / 100), 'calc') : 0;

  let antic = 0;
  (p.anticipazioni || []).forEach((a, i) => { antic += r2(a.imp); righe.push({ k: 'antic' + i, label: a.d || o.antic.label, val: r2(a.imp), tipo: 'antic', i }); });
  antic = r2(antic);
  const bollo = o.bollo.on ? riga('bollo', o.bollo.label, val('bollo', o.bollo.imp), 'calc') : 0;

  const totale = riga('totale', 'Totale Proforma', val('totale', imponibile + iva + antic + bollo), 'tot');
  const baseRit = o.rit.base === 'imponibile' ? imponibile : onorario;
  const ritenuta = o.rit.on
    ? riga('rit', o.rit.label.replace('{perc}', perc(o.rit.perc)).replace('{base}', '€ ' + num(baseRit)), val('rit', baseRit * o.rit.perc / 100), 'meno')
    : 0;
  const ivaSplit = (o.split.on && o.iva.on) ? riga('split', 'IVA versata dal committente (art. 17-ter)', iva, 'meno') : 0;
  const netto = riga('netto', 'Netto a pagare', val('netto', totale - ritenuta - ivaSplit), 'tot');

  return { righe, tot: { onorario, magg, imponibile, iva, antic, bollo, totale, ritenuta, netto } };
}

/* Diciture pronte per uno studio di dottori commercialisti: l'elenco è modificabile dalle Impostazioni. */
export const DICITURA_FORFETTARIO = 'Fattura Emessa a Contribuente In Regime Forfettario – Non si Applica R.A.';
export const DICITURE_BASE = [
  'Il presente documento non costituisce fattura ai fini del D.P.R. 633/72: la fattura sarà emessa all’atto del pagamento.',
  'Operazione esente da IVA ai sensi dell’art. 10 D.P.R. 633/72.',
  'Operazione non soggetta a IVA ai sensi dell’art. 7-ter D.P.R. 633/72.',
  'Inversione contabile – art. 17 D.P.R. 633/72.',
  'Scissione dei pagamenti – art. 17-ter D.P.R. 633/72.',
  'Anticipazioni in nome e per conto del cliente escluse dalla base imponibile ex art. 15 D.P.R. 633/72.',
  'Imposta di bollo assolta sull’originale per importi superiori a € 77,47.',
  'Compenso non assoggettato a ritenuta d’acconto ai sensi dell’art. 25 D.P.R. 600/73.',
  'Pagamento a ricevimento del presente avviso di parcella.',
];
