/* Cruscotto: fatturato, incassi, insoluti, previsioni. Grafici in SVG, senza librerie. */
import { S, cliente, admin, avvisa, scegliProfilo } from '../core/stato.js';
import { h, svg, chip, tabella, scheda } from '../core/ui.js';
import { euro, euroK, today, addMonths, daysBetween, MESI_BREVI, MESI, dmy, sum, by, yearOf } from '../core/util.js';
import { testata, vai } from '../main.js';
import { PROFILI } from '../domain/profili.js';
import { statoDi, dovuto, incassato, residuo, avvisi, etichettaNumero } from '../domain/servizi.js';
import { scadenze } from '../domain/scadenze.js';

let ambito = 'profilo';   // 'profilo' = profilo attivo, 'tutti' = somma dei profili (solo super admin)

export function vista() {
  const oggi = today(), anno = yearOf(oggi);
  const profili = ambito === 'tutti' && admin() ? S.sessione.profili : [S.profilo];
  const emessi = S.proforma.filter(p => profili.includes(p.profilo) && !['bozza', 'annullata'].includes(p.stato));
  const bozze = S.proforma.filter(p => profili.includes(p.profilo) && p.stato === 'bozza');
  const pagamenti = emessi.flatMap(p => (p.pagamenti || []).map(x => ({ ...x, p })));

  const fattAnno = sum(emessi.filter(p => p.anno === anno), dovuto), fattPrec = sum(emessi.filter(p => p.anno === anno - 1 && p.data.slice(5) <= oggi.slice(5)), dovuto);
  const incAnno = sum(pagamenti.filter(x => yearOf(x.data) === anno), x => x.importo);
  const aperti = emessi.filter(p => residuo(p) > 0.005);
  const daIncassare = sum(aperti, residuo), scaduti = aperti.filter(p => statoDi(p) === 'scaduta');
  const saldati = emessi.filter(p => statoDi(p) === 'saldata' && p.pagamenti.length);
  const giorni = saldati.length ? Math.round(sum(saldati, p => daysBetween(p.data, p.pagamenti.at(-1).data)) / saldati.length) : null;
  const delta = fattPrec ? Math.round((fattAnno / fattPrec - 1) * 100) : null;

  /* ultimi 12 mesi: emesso e incassato */
  const mesi = Array.from({ length: 12 }, (_, i) => addMonths(oggi.slice(0, 8) + '01', i - 11).slice(0, 7));
  const serie = mesi.map(m => ({ m, emesso: sum(emessi.filter(p => p.data.startsWith(m)), dovuto), incassato: sum(pagamenti.filter(x => x.data.startsWith(m)), x => x.importo) }));

  /* anzianità del credito */
  const FASCE = [['Non scaduto', g => g <= 0], ['1–30 giorni', g => g <= 30], ['31–60 giorni', g => g <= 60], ['61–90 giorni', g => g <= 90], ['Oltre 90 giorni', () => true]];
  const fasce = FASCE.map(([nome]) => ({ nome, val: 0 }));
  for (const p of aperti) { const g = p.scadenzaPagamento ? daysBetween(p.scadenzaPagamento, oggi) : 0; fasce[FASCE.findIndex(f => f[1](g))].val += residuo(p); }

  /* clienti principali dell'anno */
  const perCliente = new Map();
  for (const p of emessi.filter(p => p.anno === anno)) perCliente.set(p.clienteId, (perCliente.get(p.clienteId) || 0) + dovuto(p));
  const top = [...perCliente].map(([id, val]) => ({ nome: cliente(id)?.nome || '—', val })).sort(by('val', -1)).slice(0, 6);

  /* previsione: compensi in scadenza nei prossimi 6 mesi */
  const fine = addMonths(oggi, 6), prev = Array.from({ length: 6 }, (_, i) => ({ m: addMonths(oggi.slice(0, 8) + '01', i + 1).slice(0, 7), val: 0 }));
  for (const inc of S.incarichi) {
    if (!profili.includes(inc.profilo) || inc.attivo === false || cliente(inc.clienteId)?.stato?.[inc.profilo]?.attivo === false) continue;
    for (const s of scadenze(inc, oggi, fine)) { const x = prev.find(v => s.data.startsWith(v.m)); if (x) x.val += s.importo; }
  }
  const urgenti = avvisi().slice(0, 6);

  const kpi = (eti, val, sub, cls = '') => h('div.card.kpi.g3', h('div.eti', eti), h('div.val', val), sub && h('div.sub' + cls, sub));
  return h('div',
    testata(['Cruscotto ', h('b', profili.length > 1 ? 'tutti i profili' : PROFILI[profili[0]].nome)],
      admin() && h('div.seg', { role: 'group', 'aria-label': 'Ambito' },
        h('button', { type: 'button', 'aria-pressed': String(ambito === 'profilo'), onclick: () => { ambito = 'profilo'; avvisa(); } }, 'Profilo attivo'),
        h('button', { type: 'button', 'aria-pressed': String(ambito === 'tutti'), onclick: () => { ambito = 'tutti'; avvisa(); } }, 'Anna + Studio'))),
    h('div.griglia',
      kpi(`Proforma emessi ${anno}`, euro(fattAnno), delta === null ? `${emessi.filter(p => p.anno === anno).length} documenti` : `${delta >= 0 ? '+' : ''}${delta}% sullo stesso periodo ${anno - 1}`, delta === null ? '' : delta >= 0 ? '.su' : '.giu'),
      kpi(`Incassato ${anno}`, euro(incAnno), fattAnno ? `${Math.round(incAnno / fattAnno * 100)}% dell’emesso` : ''),
      kpi('Da incassare', euro(daIncassare), scaduti.length ? `${euro(sum(scaduti, residuo))} già scaduti (${scaduti.length})` : 'Nessuno scaduto', scaduti.length ? '.giu' : ''),
      kpi('Tempo medio di incasso', giorni === null ? '—' : giorni + ' giorni', bozze.length ? `${bozze.length} bozze da verificare` : 'Nessuna bozza in attesa'),

      h('section.card.g8', h('h3.card-t', 'Emesso e incassato · ultimi 12 mesi'),
        h('div.legenda', h('span', h('i', { style: { background: 'var(--s1)' } }), 'Emesso'), h('span', h('i', { style: { background: 'var(--s2)' } }), 'Incassato')),
        barreDoppie(serie)),
      h('section.card.g4', h('h3.card-t', 'Anzianità del credito'),
        daIncassare ? barreOrizz(fasce, i => i === 0 ? 'var(--s1)' : 'var(--s4)') : h('p.dim', 'Nessun credito aperto.')),

      h('section.card.g4', h('h3.card-t', `Clienti principali ${anno}`), top.length ? barreOrizz(top) : h('p.dim', 'Nessun proforma emesso quest’anno.')),
      h('section.card.g4', h('h3.card-t', 'Compensi in arrivo · 6 mesi'),
        barreOrizz(prev.map(v => ({ nome: MESI[Number(v.m.slice(5)) - 1] + ' ' + v.m.slice(0, 4), val: v.val }))),
        h('p.dim', { style: { fontSize: '12.5px', margin: '10px 0 0' } }, `Totale previsto ${euro(sum(prev, v => v.val))}, dai compensi pattuiti negli incarichi attivi.`)),
      h('section.card.g4', h('h3.card-t', 'Scadenze documenti', h('span.azioni', h('a', { href: '#/scadenze', style: { fontSize: '13px' } }, 'Tutte'))),
        urgenti.length ? h('div.pila', urgenti.map(a => h('a', { href: '#/clienti/' + a.cliente.id, style: { color: 'inherit', textDecoration: 'none', display: 'grid', gap: '2px' } },
          h('span.riga', chip(a.giorni < 0 ? 'Scaduto' : a.giorni === 0 ? 'Oggi' : `${a.giorni} g`, a.livello), h('b', { style: { fontWeight: 500 } }, a.doc.tipo)), h('span.sotto.dim', { style: { fontSize: '12.5px' } }, a.cliente.nome))))
          : h('p.dim', 'Nessun documento in scadenza nei prossimi 60 giorni.')),

      h('section.card.g12', h('h3.card-t', 'Bozze da verificare ed emettere'),
        tabella([{ t: 'Data', v: p => dmy(p.data) }, { t: 'Cliente', v: p => h('span.princ', cliente(p.clienteId)?.nome || '—') }, { t: 'Competenza', v: p => p.competenza || '—' },
          profili.length > 1 && { t: 'Profilo', v: p => PROFILI[p.profilo].nome }, { t: 'Netto', num: true, v: p => euro(dovuto(p)) }].filter(Boolean),
          bozze.sort(by('data')).slice(0, 12), { suRiga: p => { if (p.profilo !== S.profilo) scegliProfilo(p.profilo); vai('#/proforma/' + p.id); }, vuoto: 'Nessuna bozza: i proforma vengono preparati automaticamente alle scadenze dei compensi.' })),
      scaduti.length ? h('section.card.g12', h('h3.card-t', 'Proforma scaduti'),
        tabella([{ t: 'N°', v: p => etichettaNumero(p) }, { t: 'Cliente', v: p => h('span.princ', cliente(p.clienteId)?.nome || '—') }, { t: 'Scadenza', v: p => dmy(p.scadenzaPagamento) },
          { t: 'Ritardo', v: p => daysBetween(p.scadenzaPagamento, oggi) + ' giorni' }, { t: 'Residuo', num: true, v: p => euro(residuo(p)) }],
          scaduti.sort(by('scadenzaPagamento')).slice(0, 12), { suRiga: p => vai('#/proforma/' + p.id) })) : null,
    ));
}

/* ---------- grafici ---------- */
let tip;
function suggerimento(e, titolo, righe) {
  tip ??= document.body.appendChild(h('div.tip', { hidden: true }));
  if (!e) { tip.hidden = true; return; }
  tip.replaceChildren(h('b', titolo), ...righe.map(r => h('div', r)));
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
}
function barreDoppie(serie) {
  const W = 720, H = 250, sx = 46, top = 10, base = H - 26, area = base - top;
  const max = Math.max(1, ...serie.flatMap(s => [s.emesso, s.incassato]));
  const passo = 10 ** Math.floor(Math.log10(max)), tacca = [1, 2, 5, 10].map(k => k * passo).find(t => max / t <= 5) || passo;
  const cima = Math.ceil(max / tacca) * tacca, y = v => base - v / cima * area;
  const col = (W - sx) / serie.length, lb = Math.min(16, col * .3);
  const barra = (x, v, colore) => { const yy = y(v), a = Math.max(0, base - yy), r = Math.min(4, a); return svg('path', { d: `M${x},${base}v${-(a - r)}q0,${-r} ${r},${-r}h${lb - 2 * r}q${r},0 ${r},${r}v${a - r}z`, fill: colore }); };
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafico', role: 'img', 'aria-label': 'Emesso e incassato negli ultimi 12 mesi' });
  for (let t = 0; t <= cima + 1; t += tacca) g.append(svg('line', { x1: sx, x2: W, y1: y(t), y2: y(t), class: 'asse' }), svg('text', { x: sx - 8, y: y(t) + 4, 'text-anchor': 'end' }, euroK(t)));
  serie.forEach((s, i) => {
    const cx = sx + col * i + col / 2, nome = `${MESI[Number(s.m.slice(5)) - 1]} ${s.m.slice(0, 4)}`;
    g.append(barra(cx - lb - 1, s.emesso, 'var(--s1)'), barra(cx + 1, s.incassato, 'var(--s2)'),
      svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, MESI_BREVI[Number(s.m.slice(5)) - 1]),
      svg('rect', { x: sx + col * i, y: top, width: col, height: base - top, fill: 'transparent', tabindex: 0, 'aria-label': `${nome}: emesso ${euro(s.emesso)}, incassato ${euro(s.incassato)}`,
        onpointermove: e => suggerimento(e, nome, ['Emesso ' + euro(s.emesso), 'Incassato ' + euro(s.incassato)]), onpointerleave: () => suggerimento() }));
  });
  return g;
}
function barreOrizz(voci, colore = () => 'var(--s1)') {
  const max = Math.max(1, ...voci.map(v => v.val));
  return h('div.barre-o', voci.map((v, i) => h('div.barra-o', { title: `${v.nome}: ${euro(v.val)}` },
    h('span.nome', v.nome), h('span.pista', h('i', { style: { width: (v.val / max * 100) + '%', background: colore(i), visibility: v.val ? 'visible' : 'hidden' } })), h('span.num', euro(v.val)))));
}
