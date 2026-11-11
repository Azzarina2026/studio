/* Costruisce il foglio A4 del proforma (anteprima + stampa/PDF) a partire dai dati.
   "contenuto()" produce una descrizione neutra del documento, usata sia qui sia dall'esportazione Word:
   così i due formati restano sempre allineati. */
import { h, ricco } from '../core/ui.js';
import { num, dmy } from '../core/util.js';
import { calcola, DICITURA_FORFETTARIO } from '../domain/calcolo.js';

export function contenuto(p, prof, c) {
  const dest = [];
  const sl = c.sedeLegale || {}, so = c.sedeOperativa || {};
  dest.push(`Spett.le **${c.nome}**`);
  if (sl.via) dest.push(`s.l.: //${sl.via}//`);
  if (sl.citta) dest.push(`//${sl.citta}//`);
  if (so.via) dest.push(`s.o.: ${so.via}`);
  if (so.citta) dest.push(`//${so.citta}//`);
  if (c.piva) dest.push(`P.IVA: ${c.piva}`);
  if (c.cf && (prof.mostraCF || !c.piva)) dest.push(`C.F ${c.cf}`);
  const iban = (prof.iban || []).find(i => i.id === p.ibanId) || (prof.iban || []).find(i => i.predefinito) || (prof.iban || [])[0];
  const { righe, tot } = calcola(p);
  return {
    prof, dest, sdi: c.sdi || '',
    numero: `Proforma n° **${p.numero ? p.numero + '/' + p.anno : '…/' + p.anno}** del **${dmy(p.data)}**`,
    titolo: prof.titoloPrestazione, descr: p.descr || '',
    righe, tot,
    forfettario: p.forfettario ? DICITURA_FORFETTARIO : '',
    diciture: p.diciture || [],
    firma: prof.firma || [],
    avviso: prof.avvisoIbanOn ? prof.avvisoIban : '',
    iban: iban ? prof.rigaIban.replace('{banca}', iban.banca || '').replace('{iban}', (iban.iban || '').replace(/ /g, '\u00a0')) : '',
  };
}

/* suModifica(chiave, valore): se presente, le celle della tabella diventano modificabili direttamente sul foglio. */
export function foglio(p, prof, c, { suModifica } = {}) {
  const d = contenuto(p, prof, c);
  const t = prof.intestazione;
  const cella = (r, campo) => {
    const testo = campo === 'label' ? r.label : num(r.val);
    if (!suModifica || (campo === 'val' && r.tipo === 'voce' && false)) return testo;
    return h('span', { contentEditable: 'plaintext-only', spellcheck: false, title: 'Clicca per modificare',
      onblur: e => { const v = e.target.textContent.trim(); if (v !== testo) suModifica(r, campo, v); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } } }, testo);
  };
  return h('div.foglio',
    h('div.f-testa',
      h('img', { src: 'assets/logo.png', alt: '' }),
      h('p.f-titolo' + (t.linea ? '' : '.grande'), t.titolo),
      h('p.f-sotto', t.sottotitolo),
      (t.soci || []).map(s => h('p.f-soci', s)),
      t.linea && h('div.f-linea')),
    h('div.f-dest', d.dest.map(r => h('p', ricco(r))), d.sdi && h('p', h('i', 'codice univoco '), h('i.sdi', d.sdi))),
    h('p.f-num', ricco(d.numero)),
    h('div.f-descr', h('p', { style: { textAlign: 'left' } }, ricco(d.titolo)), h('p', ricco(d.descr))),
    h('table.f-tab', h('tbody', d.righe.map(r => h('tr.' + r.tipo, h('td', cella(r, 'label')), h('td.imp', '€ ', cella(r, 'val')))))),
    d.forfettario && h('p.f-forf', h('span', d.forfettario)),
    d.diciture.map(x => h('p.f-dic', x)),
    h('div.f-basso',
      d.firma.length ? h('div.f-firma', d.firma.map(x => h('p', x))) : null,
      d.avviso && h('p.f-avviso', d.avviso),
      d.iban && h('p.f-iban', ricco(d.iban))),
    h('div.f-piede', prof.piede.map(r => h('p', ricco(r)))),
  );
}

/* Stampa / salva come PDF: usa la stampa del browser, che produce un PDF vettoriale identico all'anteprima. */
export function stampa(p, prof, c) {
  const zona = document.getElementById('stampa');
  zona.replaceChildren(foglio(p, prof, c));
  const titolo = document.title;
  document.title = nomeFile(p, c);
  const img = zona.querySelector('img');
  const vai = () => { window.print(); setTimeout(() => { document.title = titolo; zona.replaceChildren(); }, 500); };
  img.complete ? vai() : (img.onload = img.onerror = vai);
}
export const nomeFile = (p, c) => `Proforma ${p.numero ? p.numero + '-' + p.anno : 'bozza'} ${c.nome}`.replace(/[\\/:*?"<>|]+/g, ' ').trim();
