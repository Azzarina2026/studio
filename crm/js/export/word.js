/* Esporta il proforma in Word (.docx) partendo dai modelli originali dello studio:
   intestazione, piè di pagina, logo, margini e stili restano quelli del modello;
   qui si genera solo il corpo del documento. Usa JSZip (vendor/jszip.min.js). */
import { contenuto, nomeFile } from './foglio.js';
import { num } from '../core/util.js';
import { scaricaBlob } from '../core/ui.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = '<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/>';

/* un pezzo di testo con formato: { b, i, colore, dim (mezzi punti), sfondo } */
function run(testo, f = {}) {
  if (testo === '') return '';
  const dim = f.dim || 24;
  return `<w:r><w:rPr>${FONT}${f.b ? '<w:b/><w:bCs/>' : ''}${f.i ? '<w:i/><w:iCs/>' : ''}${f.colore ? `<w:color w:val="${f.colore}"/>` : ''}<w:sz w:val="${dim}"/><w:szCs w:val="${dim}"/>${f.sfondo ? `<w:highlight w:val="${f.sfondo}"/>` : ''}</w:rPr><w:t xml:space="preserve">${esc(testo)}</w:t></w:r>`;
}
/* testo con **grassetto** e //corsivo// → sequenza di run */
function ricco(testo, f = {}) {
  return String(testo ?? '').split(/(\*\*.+?\*\*|\/\/.+?\/\/)/g).map(p =>
    p.startsWith('**') && p.endsWith('**') && p.length > 4 ? ricco(p.slice(2, -2), { ...f, b: true })
      : p.startsWith('//') && p.endsWith('//') && p.length > 4 ? ricco(p.slice(2, -2), { ...f, i: true })
        : run(p, f)).join('');
}
function par(runs, { jc, rientro, dopo, interlinea } = {}) {
  return `<w:p><w:pPr>${interlinea ? `<w:spacing w:line="${interlinea}" w:lineRule="auto"/>` : ''}${dopo !== undefined ? `<w:spacing w:after="${dopo}"/>` : ''}${rientro ? `<w:ind w:left="${rientro}"/>` : ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}<w:rPr>${FONT}</w:rPr></w:pPr>${runs || ''}</w:p>`;
}
const vuoto = (n = 1) => par('').repeat(n);

function tabella(righe) {
  const bordo = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  const cella = (w, contenuto, jc, rientro) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcBorders>${bordo}</w:tcBorders><w:tcMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/>${rientro ? `<w:ind w:left="${rientro}"/>` : ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr>${contenuto}</w:p></w:tc>`;
  const L = 6950, R = 1980;
  return `<w:tbl><w:tblPr><w:tblW w:w="${L + R}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${L}"/><w:gridCol w:w="${R}"/></w:tblGrid>` +
    righe.map(r => {
      const f = { dim: 22, b: r.tipo === 'tot' };
      const dx = r.tipo === 'sub' || r.tipo === 'tot';
      return `<w:tr>${cella(L, run(r.label, f), dx ? 'right' : null, ['calc', 'meno', 'antic'].includes(r.tipo) ? 320 : 0)}${cella(R, run('€ ' + num(r.val), f), 'right')}</w:tr>`;
    }).join('') + '</w:tbl>';
}

export function corpo(d) {
  const x = [];
  x.push(vuoto());
  d.dest.forEach(r => x.push(par(ricco(r), { jc: 'right' })));
  if (d.sdi) x.push(par(run('codice univoco ', { i: true }) + run(d.sdi, { b: true, i: true, colore: 'FF0000' }), { jc: 'right' }));
  x.push(vuoto());
  x.push(par(ricco(d.numero)));
  x.push(vuoto(2));
  x.push(par(ricco(d.titolo)));
  x.push(par(ricco(d.descr), { jc: 'both' }));
  x.push(vuoto());
  x.push(tabella(d.righe));
  if (d.forfettario) { x.push(vuoto()); x.push(par(run(d.forfettario, { b: true, dim: 22, sfondo: 'yellow' }))); }
  d.diciture.forEach(t => x.push(par(run(t, { dim: 19 }))));
  x.push(vuoto(d.firma.length ? 2 : 3));
  if (d.firma.length) {
    d.firma.forEach((t, i) => x.push(par(run(t, { dim: i ? 24 : 20 }), { jc: 'center', rientro: 5672 })));
    x.push(vuoto(2));
  }
  if (d.avviso) { x.push(par(run(d.avviso, { b: true, colore: 'FF0000', dim: 28 }), { jc: 'center', interlinea: 192 })); x.push(par('', { interlinea: 192 })); }
  if (d.iban) x.push(par(ricco(d.iban), { jc: 'center', interlinea: 192 }));
  return x.join('');
}

export async function documentoWord(p, prof, c) {
  const risposta = await fetch(prof.modello);
  if (!risposta.ok) throw new Error('Modello Word non trovato.');
  const zip = await window.JSZip.loadAsync(await risposta.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  if (!xml.includes('<!--CORPO-->')) throw new Error('Modello Word non valido.');
  zip.file('word/document.xml', xml.replace('<!--CORPO-->', corpo(contenuto(p, prof, c))));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
}
export async function scaricaWord(p, prof, c) { scaricaBlob(await documentoWord(p, prof, c), nomeFile(p, c) + '.docx'); }
