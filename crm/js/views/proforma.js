/* Elenco proforma ed editor con anteprima. */
import { S, salva, elimina, cliente, clientiDi, profilo } from '../core/stato.js';
import { h, icona, btn, chip, tabella, scheda, chiedi, conferma, toast, errore } from '../core/ui.js';
import { norm, by, dmy, euro, num, parseNum, today, clone, yearOf, r2, addDays } from '../core/util.js';
import { testata, vai } from '../main.js';
import { PROFILI } from '../domain/profili.js';
import { calcola, opzioni } from '../domain/calcolo.js';
import { statoDi, STATI, etichettaNumero, dovuto, incassato, residuo, emetti, liberaSpese, residuoSpesa, nuovaBozza, testoDescrizione } from '../domain/servizi.js';
import { foglio, stampa } from '../export/foglio.js';
import { scaricaWord } from '../export/word.js';

let filtro = '', filtroStato = 'tutti', filtroAnno = 'tutti';

export function vista([id]) { return id ? editor(id) : elenco(); }

/* ---------- elenco ---------- */
function elenco() {
  const p = S.profilo;
  const tutti = S.proforma.filter(x => x.profilo === p);
  const anni = [...new Set(tutti.map(x => x.anno))].sort((a, b) => b - a);
  const corpo = h('div'), conta = h('span.dim');
  const GRUPPI = [['tutti', 'Tutti'], ['bozza', 'Bozze'], ['aperti', 'Da incassare'], ['scaduta', 'Scaduti'], ['saldata', 'Saldati']];
  const ridisegna = () => {
    const q = norm(filtro);
    const lista = tutti.filter(x => {
      const st = statoDi(x);
      if (filtroStato === 'aperti' ? !['emessa', 'parziale', 'scaduta'].includes(st) : filtroStato !== 'tutti' && st !== filtroStato) return false;
      if (filtroStato === 'tutti' && st === 'annullata' && !q) return false;
      if (filtroAnno !== 'tutti' && x.anno !== Number(filtroAnno)) return false;
      return !q || norm(cliente(x.clienteId)?.nome).includes(q) || etichettaNumero(x).includes(q);
    }).sort(by(x => x.data + String(x.numero || 9999).padStart(5, '0'), -1));
    corpo.replaceChildren(tabella([
      { t: 'N°', v: x => h('span.princ', etichettaNumero(x)) }, { t: 'Data', v: x => dmy(x.data) },
      { t: 'Cliente', v: x => h('div', h('div.princ', cliente(x.clienteId)?.nome || '—'), x.competenza && h('div.sotto', x.competenza)) },
      { t: 'Stato', v: x => chip(...STATI[statoDi(x)]) },
      { t: 'Netto', num: true, v: x => euro(dovuto(x)) }, { t: 'Incassato', num: true, v: x => incassato(x) ? euro(incassato(x)) : h('span.dim', '—') },
    ], lista, { suRiga: x => vai('#/proforma/' + x.id), vuoto: 'Nessun proforma con questi filtri.' }));
    conta.textContent = `${lista.length} proforma · ${euro(lista.reduce((t, x) => t + dovuto(x), 0))}`;
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === filtroStato)));
  };
  const seg = h('div.seg', { role: 'group', 'aria-label': 'Stato' }, GRUPPI.map(([k, n]) => h('button', { type: 'button', data: { k }, onclick: () => { filtroStato = k; ridisegna(); } }, n)));
  ridisegna();
  return h('div',
    testata(['Proforma ', h('b', PROFILI[p].nome)], btn('Nuovo proforma', nuovo, { tipo: 'primary', ic: 'piu' })),
    h('div.filtri', h('div.cerca', icona('cerca', 16), h('input', { type: 'search', placeholder: 'Cerca cliente o numero…', value: filtro, 'aria-label': 'Cerca proforma', oninput: e => { filtro = e.target.value; ridisegna(); } })),
      seg, h('select', { style: { width: 'auto' }, 'aria-label': 'Anno', onchange: e => { filtroAnno = e.target.value; ridisegna(); } }, h('option', { value: 'tutti' }, 'Tutti gli anni'), anni.map(a => h('option', { value: a, selected: String(a) === filtroAnno }, a))), conta),
    h('div.card', corpo));
}
async function nuovo() {
  const lista = clientiDi().sort(by(c => norm(c.nome)));
  if (!lista.length) return toast('Aggiungi prima un cliente', 'err');
  const d = await chiedi({ titolo: 'Nuovo proforma', ok: 'Crea bozza', campi: [{ k: 'clienteId', label: 'Cliente', tipo: 'scelta', opzioni: lista.map(c => [c.id, c.nome]) }], valore: { clienteId: lista[0].id } });
  if (!d) return;
  const c = cliente(d.clienteId), inc = S.incarichi.find(i => i.clienteId === c.id && i.profilo === S.profilo && i.attivo !== false);
  const x = await salva('proforma', nuovaBozza(S.profilo, c, inc)).catch(errore);
  if (x) vai('#/proforma/' + x.id);
}

/* ---------- editor ---------- */
let bozza = null, timer = 0;
function editor(id) {
  const orig = S.proforma.find(x => x.id === id);
  if (!orig) return h('div', testata('Proforma non trovato', [], { indietro: ['#/proforma', 'Proforma'] }));
  if (!bozza || bozza.id !== id) bozza = clone(orig);
  const p = bozza, prof = S.profili[p.profilo], c = cliente(p.clienteId) || { nome: '(cliente eliminato)' };
  p.opz = opzioni(p.opz);
  const o = p.opz;
  const statoSalva = h('span.dim', { 'aria-live': 'polite' });
  const cornice = h('div.foglio-cornice');
  const titoloStato = h('span');

  const registra = () => { p.totali = calcola(p).tot; clearTimeout(timer); statoSalva.textContent = 'Modifiche non salvate…';
    timer = setTimeout(async () => { try { await salva('proforma', clone(p), { silenzioso: true }); statoSalva.textContent = 'Salvato'; } catch (e) { errore(e); } }, 700); };
  const anteprima = () => {
    const f = foglio(p, prof, c, { suModifica: (r, campo, v) => {
      if (campo === 'label') { if (r.tipo === 'voce') p.voci[r.i].d = v; else if (r.tipo === 'antic') p.anticipazioni[r.i].d = v; else p.etichette = { ...p.etichette, [r.k]: v }; }
      else if (r.tipo === 'voce') p.voci[r.i].imp = parseNum(v); else if (r.tipo === 'antic') p.anticipazioni[r.i].imp = parseNum(v); else p.forzati = { ...p.forzati, [r.k]: parseNum(v) };
      cambia(true);
    } });
    cornice.replaceChildren(f);
    requestAnimationFrame(() => { const k = Math.min(1, cornice.clientWidth / f.offsetWidth) || 1; f.style.transform = `scale(${k})`; cornice.style.height = f.offsetHeight * k + 'px'; });
    titoloStato.replaceChildren(chip(...STATI[statoDi(p)]));
  };
  const controlli = h('div.controlli');
  const cambia = (rifai) => { registra(); anteprima(); if (rifai) disegnaControlli(); };

  /* campi semplici legati alla bozza */
  const campo = (label, k, tipo = 'text', w = 6, extra = {}) => h('div.campo.w' + w, h('label', label),
    h('input', { type: tipo, value: p[k] ?? '', ...extra, onchange: e => { p[k] = tipo === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value; if (k === 'data') p.anno = yearOf(p.data) || p.anno; cambia(); } }));
  const inEuro = (v, su, etichetta) => h('input.num', { type: 'text', inputMode: 'decimal', value: num(v), 'aria-label': etichetta, onchange: e => { su(parseNum(e.target.value)); e.target.value = num(parseNum(e.target.value)); cambia(); } });

  function disegnaControlli() {
    const spese = S.spese.filter(s => s.clienteId === p.clienteId && s.profilo === p.profilo);
    const usata = s => p.anticipazioni.find(a => a.spesaId === s.id);
    const forzati = Object.keys(p.forzati || {}).length + Object.keys(p.etichette || {}).length;
    const opz = (k, extra) => h('div.opz-riga',
      h('input', { type: 'checkbox', checked: o[k].on, 'aria-label': 'Attiva', onchange: e => { o[k].on = e.target.checked; cambia(); } }),
      h('input', { type: 'text', value: o[k].label, 'aria-label': 'Dicitura', onchange: e => { o[k].label = e.target.value; cambia(); } }), extra);
    const perc = k => h('input.num', { type: 'number', step: 'any', value: o[k].perc, 'aria-label': 'Percentuale', onchange: e => { o[k].perc = Number(e.target.value) || 0; cambia(); } });
    controlli.replaceChildren(
      scheda('Documento', h('div.modulo',
        campo('Data', 'data', 'date', 6), campo('Pagamento entro', 'scadenzaPagamento', 'date', 6),
        campo('Numero', 'numero', 'number', 4, { min: 1, placeholder: 'auto' }), campo('Anno', 'anno', 'number', 4), campo('Data mandato', 'dataMandato', 'date', 4),
        campo('Competenza', 'competenza', 'text', 12),
        h('div.campo', h('label', 'Descrizione (**grassetto**, //corsivo//)'),
          h('textarea', { rows: 4, value: p.descr || '', onchange: e => { p.descr = e.target.value; cambia(); } }),
          h('div.riga', btn('Rigenera dal modello', () => { p.descr = testoDescrizione(prof, c, p); cambia(true); }, { tipo: 'sm' }))))),
      scheda('Onorari',
        p.voci.map((v, i) => h('div.voce-riga',
          h('input', { type: 'text', value: v.d, 'aria-label': 'Descrizione voce', onchange: e => { v.d = e.target.value; cambia(); } }),
          inEuro(v.imp, x => v.imp = x, 'Importo voce'),
          h('button.icbtn.danger', { type: 'button', 'aria-label': 'Rimuovi voce', onclick: () => { p.voci.splice(i, 1); cambia(true); } }, icona('x', 16)))),
        btn('Aggiungi voce', () => { p.voci.push({ d: '', imp: 0 }); cambia(true); }, { tipo: 'sm', ic: 'piu' })),
      scheda('Spese anticipate',
        spese.filter(s => residuoSpesa(s) > 0 || usata(s)).map(s => {
          const a = usata(s), disp = r2(residuoSpesa(s) + (p.stato !== 'bozza' && a ? a.imp : 0));
          return h('div.voce-riga',
            h('label.campo.spunta', h('input', { type: 'checkbox', checked: !!a, onchange: e => { if (e.target.checked) p.anticipazioni.push({ d: `${o.antic.label} – ${s.descr}`, imp: disp, spesaId: s.id }); else p.anticipazioni = p.anticipazioni.filter(x => x.spesaId !== s.id); cambia(true); } }),
              h('span', s.descr, h('small', ` · ${dmy(s.data)} · disponibili ${euro(disp)}`))),
            a ? inEuro(a.imp, x => a.imp = Math.min(x, disp), 'Importo da addebitare') : h('span'), h('span'));
        }),
        p.anticipazioni.filter(a => !a.spesaId).map(a => h('div.voce-riga',
          h('input', { type: 'text', value: a.d, 'aria-label': 'Descrizione anticipazione', onchange: e => { a.d = e.target.value; cambia(); } }), inEuro(a.imp, x => a.imp = x, 'Importo'),
          h('button.icbtn.danger', { type: 'button', 'aria-label': 'Rimuovi', onclick: () => { p.anticipazioni.splice(p.anticipazioni.indexOf(a), 1); cambia(true); } }, icona('x', 16)))),
        h('div.riga', btn('Aggiungi importo libero', () => { p.anticipazioni.push({ d: o.antic.label, imp: 0 }); cambia(true); }, { tipo: 'sm', ic: 'piu' }),
          !spese.some(s => residuoSpesa(s) > 0) && h('span.dim', 'Nessuna spesa da addebitare.'))),
      scheda('Calcolo',
        opz('speseGen', perc('speseGen')), opz('sconto', inEuro(o.sconto.imp, x => o.sconto.imp = x, 'Sconto')),
        opz('magg', perc('magg')), opz('iva', perc('iva')), opz('bollo', inEuro(o.bollo.imp, x => o.bollo.imp = x, 'Bollo')), opz('rit', perc('rit')),
        h('div.modulo', { style: { marginTop: '10px' } },
          h('div.campo.w6', h('label', 'Ritenuta calcolata su'), h('select', { onchange: e => { o.rit.base = e.target.value; cambia(); } },
            h('option', { value: 'onorario', selected: o.rit.base === 'onorario' }, 'Totale onorario'), h('option', { value: 'imponibile', selected: o.rit.base === 'imponibile' }, 'Imponibile'))),
          h('label.campo.spunta.w6', h('input', { type: 'checkbox', checked: o.split.on, onchange: e => { o.split.on = e.target.checked; cambia(); } }), h('span', 'Scissione dei pagamenti')),
          h('label.campo.spunta', h('input', { type: 'checkbox', checked: p.forfettario, onchange: e => { p.forfettario = e.target.checked; o.rit.on = !p.forfettario; cambia(true); } }),
            h('span', 'Cliente in regime forfettario'), h('small', 'Toglie la ritenuta e aggiunge la dicitura evidenziata in giallo.'))),
        h('p.dim', { style: { fontSize: '12.5px', margin: '10px 0 0' } }, 'Puoi anche cliccare su qualsiasi cifra o dicitura della tabella nell’anteprima per correggerla a mano.'),
        forzati ? btn(`Annulla ${forzati} correzioni manuali`, () => { p.forzati = {}; p.etichette = {}; cambia(true); }, { tipo: 'sm' }) : null),
      scheda('Diciture aggiuntive',
        [...new Set([...(prof.diciture || []), ...p.diciture])].map(t => h('label.campo.spunta', { style: { marginBottom: '8px' } },
          h('input', { type: 'checkbox', checked: p.diciture.includes(t), onchange: e => { p.diciture = e.target.checked ? [...p.diciture, t] : p.diciture.filter(x => x !== t); cambia(); } }), h('span', { style: { fontSize: '13.5px' } }, t))),
        btn('Scrivi una dicitura', async () => { const d = await chiedi({ titolo: 'Dicitura libera', ok: 'Aggiungi', campi: [{ k: 't', label: 'Testo', tipo: 'area', richiesto: true, max: 400 }] }); if (d) { p.diciture.push(d.t); cambia(true); } }, { tipo: 'sm', ic: 'piu' })),
      p.stato !== 'bozza' && p.stato !== 'annullata' ? scheda('Incassi',
        tabella([{ t: 'Data', v: x => dmy(x.data) }, { t: 'Metodo', v: x => x.metodo || '—' }, { t: 'Importo', num: true, v: x => euro(x.importo) },
          { t: '', cls: 'az', v: x => h('button.icbtn.danger', { type: 'button', 'aria-label': 'Elimina incasso', onclick: () => { p.pagamenti.splice(p.pagamenti.indexOf(x), 1); cambia(true); } }, icona('cestino', 15)) }],
          p.pagamenti, { vuoto: 'Nessun incasso registrato.' }),
        h('div.riga', { style: { marginTop: '10px' } }, h('b', residuo(p) > 0.005 ? `Residuo ${euro(residuo(p))}` : 'Saldata'),
          residuo(p) > 0.005 && btn('Segna come saldata', () => { p.pagamenti.push({ data: today(), importo: residuo(p), metodo: 'Bonifico' }); cambia(true); toast('Incasso registrato'); }, { tipo: 'sm.primary', ic: 'ok' }),
          residuo(p) > 0.005 && btn('Registra incasso…', incasso, { tipo: 'sm' }))) : null,
    );
  }
  async function incasso() {
    const d = await chiedi({ titolo: 'Registra incasso', campi: [
      { k: 'data', label: 'Data', tipo: 'data', richiesto: true, w: 6 }, { k: 'importo', label: 'Importo', tipo: 'euro', richiesto: true, w: 6 },
      { k: 'metodo', label: 'Metodo', tipo: 'scelta', opzioni: ['Bonifico', 'Assegno', 'Contanti', 'POS', 'Altro'] }], valore: { data: today(), importo: residuo(p), metodo: 'Bonifico' } });
    if (d) { p.pagamenti.push(d); cambia(true); }
  }
  /* prima di emettere o scaricare: su quale IBAN? */
  async function scegliIban() {
    const lista = prof.iban || [];
    if (!lista.length) { if (!await conferma('Nessun IBAN', 'Non hai ancora inserito un IBAN in Impostazioni: il documento uscirà senza coordinate bancarie. Continuare?', { ok: 'Continua senza IBAN' })) return false; return true; }
    if (lista.length === 1) { p.ibanId = lista[0].id; return true; }
    const d = await chiedi({ titolo: 'Su quale IBAN?', ok: 'Usa questo IBAN', campi: [{ k: 'ibanId', label: 'Conto da indicare nel documento', tipo: 'scelta', opzioni: lista.map(i => [i.id, `${i.banca} · ${i.iban}`]) }],
      valore: { ibanId: p.ibanId || (lista.find(i => i.predefinito) || lista[0]).id } });
    if (!d) return false;
    p.ibanId = d.ibanId; return true;
  }
  const fermaTimer = async () => { clearTimeout(timer); statoSalva.textContent = ''; };
  const azioni = {
    async emetti() { if (!await scegliIban()) return; await fermaTimer(); if (!p.scadenzaPagamento) p.scadenzaPagamento = addDays(p.data, 30); try { const n = await emetti(p); toast(`Proforma n° ${etichettaNumero(n)} emesso`); } catch (e) { errore(e); } },
    async pdf() { if (!await scegliIban()) return; cambia(); stampa(p, prof, c); },
    async word() { if (!await scegliIban()) return; cambia(); scaricaWord(p, prof, c).catch(errore); },
    async elimina() {
      const emessa = p.stato !== 'bozza';
      if (!await conferma(emessa ? 'Annullare il proforma?' : 'Eliminare la bozza?', emessa ? 'Il proforma resterà in archivio come annullato e le spese addebitate torneranno disponibili.' : (p.origine ? 'La bozza era stata creata automaticamente: resterà registrata come annullata per non essere rigenerata.' : 'L’operazione non si può annullare.'), { ok: emessa ? 'Annulla proforma' : 'Elimina', pericolo: true })) return;
      await fermaTimer();
      try { await liberaSpese(p); if (emessa || p.origine) await salva('proforma', { ...clone(p), stato: 'annullata', pagamenti: [] }); else await elimina('proforma', p.id); bozza = null; vai('#/proforma'); } catch (e) { errore(e); }
    },
  };
  disegnaControlli(); anteprima();
  addEventListener('resize', anteprima, { once: true });
  return h('div',
    testata([`Proforma ${p.numero ? 'n° ' + etichettaNumero(p) : '(bozza)'} · `, h('b', c.nome)], [titoloStato, statoSalva,
      p.stato === 'bozza' && btn('Emetti', azioni.emetti, { tipo: 'primary', ic: 'ok' }),
      btn('PDF', azioni.pdf, { ic: 'scarica' }), btn('Word', azioni.word, { ic: 'scarica' }),
      p.stato !== 'annullata' && btn(p.stato === 'bozza' ? 'Elimina' : 'Annulla', azioni.elimina, { tipo: 'danger', ic: 'cestino' }),
    ], { indietro: ['#/proforma', 'Proforma'] }),
    h('div.editor', controlli, h('div.anteprima', cornice)));
}
