/* Elenco clienti e scheda cliente. */
import { S, salva, elimina, admin, cliente, clientiDi, profilo, avvisa } from '../core/stato.js';
import { h, icona, btn, chip, tabella, scheda, chiedi, conferma, toast, errore, conLink, vuoto, finestra } from '../core/ui.js';
import { norm, by, dmy, euro, today, uid, addMonths, daysBetween } from '../core/util.js';
import { testata, vai } from '../main.js';
import { PROFILI } from '../domain/profili.js';
import { PERIODICITA, scadenze, importoAl } from '../domain/scadenze.js';
import { residuoSpesa, addebitato, nuovaBozza, statoDi, STATI, etichettaNumero, dovuto } from '../domain/servizi.js';
import { caricaFile, linkFile, eliminaFile } from '../core/allegati.js';
import { pd } from '../data/picodoc.js';

let filtro = '', mostraInattivi = false, linguetta = 'riepilogo';

export function vista([id]) { return id ? schedaCliente(id) : elenco(); }

/* ---------- elenco ---------- */
function elenco() {
  const p = S.profilo;
  const corpo = h('div');
  const ridisegna = () => {
    const q = norm(filtro);
    const lista = clientiDi(p, { inattivi: mostraInattivi })
      .filter(c => !q || [c.nome, c.piva, c.cf, c.stato?.[p]?.codice, c.referente].some(x => norm(x).includes(q)))
      .sort(by(c => norm(c.nome)));
    corpo.replaceChildren(tabella([
      { t: 'Cod.', v: c => h('span.dim', c.stato?.[p]?.codice || '—') },
      { t: 'Cliente', v: c => h('div', h('div.princ', c.nome), h('div.sotto', [c.piva && 'P.IVA ' + c.piva, c.sedeLegale?.citta].filter(Boolean).join(' · '))) },
      { t: 'Referente', v: c => c.referente || h('span.dim', '—') },
      { t: '', v: c => h('div.riga', c.stato?.[p]?.attivo === false && chip('Disattivato'), c.profili.length > 1 && chip('In comune', 'blu'), c.forfettario && chip('Forfettario', 'ambra')) },
    ], lista, { suRiga: c => { linguetta = 'riepilogo'; vai('#/clienti/' + c.id); },
      vuoto: q ? 'Nessun cliente corrisponde alla ricerca.' : 'Nessun cliente: aggiungine uno con «Nuovo cliente».' }));
    conta.textContent = lista.length + (lista.length === 1 ? ' cliente' : ' clienti');
  };
  const conta = h('span.dim');
  const cerca = h('input', { type: 'search', placeholder: 'Cerca per nome, P.IVA, codice…', value: filtro, 'aria-label': 'Cerca clienti', oninput: e => { filtro = e.target.value; ridisegna(); } });
  ridisegna();
  return h('div',
    testata(['Clienti ', h('b', PROFILI[p].nome)], btn('Nuovo cliente', nuovoCliente, { tipo: 'primary', ic: 'piu' })),
    h('div.filtri', h('div.cerca', icona('cerca', 16), cerca),
      h('label.campo.spunta', { style: { gridColumn: 'auto' } }, h('input', { type: 'checkbox', checked: mostraInattivi, onchange: e => { mostraInattivi = e.target.checked; ridisegna(); } }), h('span', 'Mostra disattivati')),
      conta),
    h('div.card', corpo));
}

const campiAnagrafica = (p) => [
  { k: 'tipo', label: 'Tipo', tipo: 'scelta', opzioni: [['azienda', 'Azienda / ente'], ['persona', 'Persona fisica / professionista']], w: 4 },
  { k: 'nome', label: 'Ragione sociale o nome e cognome', richiesto: true, w: 8, max: 160 },
  { k: 'piva', label: 'Partita IVA', w: 4, max: 16 },
  { k: 'cf', label: 'Codice fiscale', w: 4, max: 16 },
  { k: 'sdi', label: 'Codice univoco (SDI)', w: 4, max: 7 },
  { k: `stato.${p}.codice`, label: `Codice ditta (${PROFILI[p].nome})`, w: 4, max: 20 },
  { k: 'referente', label: 'Referente', w: 8, max: 120 },
  { tipo: 'titolo', label: 'Sede legale' },
  { k: 'sedeLegale.via', label: 'Indirizzo', w: 7, max: 160 },
  { k: 'sedeLegale.citta', label: 'CAP e città', w: 5, max: 120 },
  { tipo: 'titolo', label: 'Sede operativa (se diversa)' },
  { k: 'sedeOperativa.via', label: 'Indirizzo', w: 7, max: 160 },
  { k: 'sedeOperativa.citta', label: 'CAP e città', w: 5, max: 120 },
  { tipo: 'titolo', label: 'Contatti' },
  { k: 'pec', label: 'PEC', w: 4, max: 120 }, { k: 'email', label: 'E-mail', w: 4, max: 120 }, { k: 'telefono', label: 'Telefono', w: 4, max: 40 },
  { tipo: 'titolo', label: 'Fatturazione' },
  { k: 'forfettario', label: 'Contribuente in regime forfettario', tipo: 'spunta', aiuto: 'Nel proforma non si applica la ritenuta d’acconto e compare la dicitura evidenziata in giallo.' },
];

async function nuovoCliente() {
  const p = S.profilo;
  const d = await chiedi({ titolo: 'Nuovo cliente', larga: true, ok: 'Aggiungi', campi: campiAnagrafica(p),
    valore: { tipo: 'azienda', sedeLegale: {}, sedeOperativa: {}, stato: { [p]: { attivo: true, codice: '' } } } });
  if (!d) return;
  const doppio = S.clienti.find(c => (d.piva && c.piva === d.piva) || (d.cf && c.cf === d.cf));
  if (doppio && !await conferma('Cliente già presente?', `Esiste già «${doppio.nome}» con la stessa partita IVA o codice fiscale. Vuoi crearne comunque uno nuovo?`, { ok: 'Crea comunque' })) return vai('#/clienti/' + doppio.id);
  try {
    const c = await salva('clienti', { ...d, profili: [p], note: [], documenti: [], aml: [], portale: { abilitato: false }, creato: today() });
    toast('Cliente aggiunto'); linguetta = 'riepilogo'; vai('#/clienti/' + c.id);
  } catch (e) { errore(e); }
}

/* ---------- scheda ---------- */
function schedaCliente(id) {
  const c = cliente(id), p = S.profilo;
  if (!c) return h('div', testata('Cliente non trovato', [], { indietro: ['#/clienti', 'Clienti'] }));
  if (!c.profili.includes(p)) return h('div', testata(c.nome, [], { indietro: ['#/clienti', 'Clienti'] }), h('div.avviso', `Questo cliente non è nell’elenco di ${PROFILI[p].nome}.`));
  const attivo = c.stato?.[p]?.attivo !== false;
  const LINGUETTE = [['riepilogo', 'Riepilogo'], ['incarichi', 'Incarichi e compensi'], ['spese', 'Spese anticipate'], ['proforma', 'Proforma'], ['documenti', 'Documenti'], ['aml', 'Antiriciclaggio'], ['note', 'Note']];
  const pannelli = { riepilogo: tabRiepilogo, incarichi: tabIncarichi, spese: tabSpese, proforma: tabProforma, documenti: tabDocumenti, aml: tabAml, note: tabNote };
  return h('div',
    testata(c.nome, [
      btn(attivo ? 'Disattiva' : 'Riattiva', async () => { c.stato = { ...c.stato, [p]: { ...(c.stato?.[p] || {}), attivo: !attivo } }; await salva('clienti', c).catch(errore); toast(attivo ? 'Cliente disattivato: non comparirà più negli elenchi' : 'Cliente riattivato'); }, { ic: attivo ? 'pausa' : 'play', titolo: 'I clienti disattivati spariscono da elenchi, scadenze e proforma automatici' }),
      admin() && btn('Modifica', () => modificaCliente(c), { ic: 'matita' }),
      admin() && btn('Elimina', () => eliminaCliente(c), { ic: 'cestino', tipo: 'danger' }),
    ], { indietro: ['#/clienti', 'Clienti'] }),
    h('div.riga', { style: { marginBottom: '14px' } }, !attivo && chip('Disattivato'), c.profili.length > 1 && chip('In comune: ' + c.profili.map(x => PROFILI[x].nome).join(' + '), 'blu'), c.forfettario && chip('Regime forfettario', 'ambra')),
    h('div.linguette', { role: 'tablist' }, LINGUETTE.map(([k, n]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(linguetta === k), onclick: () => { linguetta = k; avvisa(); } }, n))),
    (pannelli[linguetta] || tabRiepilogo)(c, p));
}

async function modificaCliente(c) {
  const d = await chiedi({ titolo: 'Modifica anagrafica', larga: true, campi: campiAnagrafica(S.profilo), valore: c });
  if (d) salva('clienti', d).then(() => toast('Anagrafica aggiornata')).catch(errore);
}
async function eliminaCliente(c) {
  const legati = ['incarichi', 'spese', 'proforma'].map(r => S[r].filter(x => x.clienteId === c.id));
  if (!await conferma('Eliminare il cliente?', `«${c.nome}» verrà eliminato con ${legati[0].length} incarichi, ${legati[1].length} spese e ${legati[2].length} proforma. L’operazione non si può annullare.`, { ok: 'Elimina tutto', pericolo: true })) return;
  try {
    for (const [i, r] of ['incarichi', 'spese', 'proforma'].entries()) for (const x of legati[i]) await elimina(r, x.id);
    for (const d of [...(c.documenti || []), ...(c.aml || [])]) await eliminaFile(c.id, d.file);
    await elimina('clienti', c.id); toast('Cliente eliminato'); vai('#/clienti');
  } catch (e) { errore(e); }
}

const dato = (t, v) => h('div', h('dt', t), h('dd', v || h('span.dim', '—')));
function tabRiepilogo(c, p) {
  const aperti = S.proforma.filter(x => x.clienteId === c.id && x.profilo === p && ['emessa', 'parziale', 'scaduta'].includes(statoDi(x)));
  return h('div.pila',
    scheda('Anagrafica', h('dl.dati',
      dato(`Codice ditta (${PROFILI[p].nome})`, c.stato?.[p]?.codice),
      // codice usato dall'altro profilo, solo se il cliente è in comune e il codice esiste
      c.profili.filter(x => x !== p && c.stato?.[x]?.codice).map(x => dato(`Codice ditta usato da ${PROFILI[x].nome}`, c.stato[x].codice)),
      dato('Tipo', c.tipo === 'persona' ? 'Persona fisica' : 'Azienda'),
      dato('Partita IVA', c.piva), dato('Codice fiscale', c.cf), dato('Codice univoco', c.sdi), dato('Referente', c.referente),
      dato('Sede legale', [c.sedeLegale?.via, c.sedeLegale?.citta].filter(Boolean).join(', ')),
      dato('Sede operativa', [c.sedeOperativa?.via, c.sedeOperativa?.citta].filter(Boolean).join(', ')),
      dato('PEC', c.pec), dato('E-mail', c.email), dato('Telefono', c.telefono)),
      !admin() && h('p.dim', { style: { margin: '14px 0 0', fontSize: '12.5px' } }, 'L’anagrafica può essere modificata solo dal super admin.')),
    scheda('Da incassare', aperti.length
      ? tabella([{ t: 'Proforma', v: x => 'n° ' + etichettaNumero(x) }, { t: 'Data', v: x => dmy(x.data) }, { t: 'Stato', v: x => chip(...STATI[statoDi(x)]) }, { t: 'Importo', num: true, v: x => euro(dovuto(x)) }], aperti, { suRiga: x => vai('#/proforma/' + x.id) })
      : h('p.dim', { style: { margin: 0 } }, 'Nessun proforma in attesa di incasso.')),
    schedaPicoDoc(c));
}

/* ---------- Pico Doc: invito del cliente e utenti collegati ---------- */
function schedaPicoDoc(c) {
  const corpo = h('div', h('p.dim', { style: { margin: 0 } }, 'Controllo Pico Doc…'));
  const card = scheda('Documenti dal cliente (app Pico Doc)', corpo);
  const ridisegna = async () => {
    try {
      const st = await pd.stato();
      if (!st.utente || !st.membro) {
        corpo.replaceChildren(h('p.testo', { style: { margin: 0 } }, 'Il cliente può scansionare i documenti con l’app Pico Doc e inviarli qui. Per attivarlo vai in ', h('a', { href: '#/impostazioni' }, 'Impostazioni'), ' → Pico Doc.'));
        return;
      }
      const collegati = await pd.collegati(c.id);
      corpo.replaceChildren(
        h('p.testo', { style: { marginTop: 0 } }, collegati.length
          ? 'Utenti dell’app collegati a questa scheda: i documenti che inviano arrivano in «Da Pico Doc».'
          : 'Nessun utente collegato. Genera un codice e dallo al cliente: lo inserisce in Pico Doc → Impostazioni → Collegamenti.'),
        collegati.length > 0 && tabella([
          { t: 'Utente', v: x => h('span.princ', x.email || '—') },
          { t: 'Collegato il', v: x => x.creato ? dmy(x.creato.toISOString().slice(0, 10)) : '—' },
          { t: '', v: x => btn('Scollega', async () => {
            if (!await conferma('Scollegare?', `${x.email} non potrà più inviare documenti a questa scheda.`, { ok: 'Scollega', pericolo: true })) return;
            try { await pd.scollega(x.id); toast('Scollegato'); ridisegna(); } catch (e) { errore(e); }
          }, { tipo: 'sm' }) }], collegati),
        h('div.riga', { style: { marginTop: '12px' } }, btn('Invita a Pico Doc', () => invita(c), { tipo: 'primary', ic: 'piu' })));
    } catch (e) {
      corpo.replaceChildren(h('p.testo', { style: { margin: 0 } }, e.message));
    }
  };
  ridisegna();
  return card;
}

async function invita(c) {
  try {
    const { codice, scade } = await pd.creaInvito(c.id, c.nome);
    const leggibile = codice.slice(0, 4) + ' ' + codice.slice(4);
    const testo = `Ciao, per inviarci i documenti in modo sicuro scarica l’app Pico Doc, accedi e in Impostazioni → Collegamenti inserisci il codice ${codice}. Il codice vale fino al ${dmy(scade.toISOString().slice(0, 10))} e si usa una sola volta.`;
    finestra({ titolo: 'Codice invito Pico Doc', corpo: [
      h('p.testo', `Codice per «${c.nome}». Vale una sola volta, fino al ${dmy(scade.toISOString().slice(0, 10))}.`),
      h('div', { style: { fontSize: '34px', fontWeight: '600', letterSpacing: '6px', textAlign: 'center', padding: '18px 0', fontFamily: 'ui-monospace, monospace' } }, leggibile),
      h('p.dim', 'Lo stesso cliente può collegarsi a più schede (es. come privato e come società): genera un codice per ciascuna.')],
      azioni: [ch => btn('Copia messaggio per il cliente', async () => { await navigator.clipboard.writeText(testo).catch(() => {}); toast('Messaggio copiato'); }, { ic: 'condividi' }),
        ch => btn('Fatto', () => ch(), { tipo: 'primary' })] });
  } catch (e) { errore(e); }
}

/* ---------- incarichi e compensi ---------- */
const campiIncarico = () => [
  { k: 'oggetto', label: 'Oggetto dell’incarico', richiesto: true, w: 8, max: 200 },
  { k: 'dataMandato', label: 'Data del mandato', tipo: 'data', w: 4 },
  { k: 'qualita', label: 'Testo «in qualità di…» per il proforma', w: 12, segnaposto: 'consulenza fiscale e societaria', max: 200 },
  { k: 'mandato', label: 'Mandato firmato (PDF o scansione)', tipo: 'file' },
  { tipo: 'titolo', label: 'Compenso pattuito' },
  { k: 'compenso.importo', label: 'Importo di ogni rata', tipo: 'euro', w: 4 },
  { k: 'compenso.periodicita', label: 'Cadenza', tipo: 'scelta', opzioni: Object.entries(PERIODICITA).map(([k, v]) => [k, v.nome]), w: 4 },
  { k: 'compenso.prima', label: 'Prima scadenza', tipo: 'data', w: 4, aiuto: 'Le successive seguono la cadenza.' },
  { k: 'compenso.competenza', label: 'Periodo di competenza', tipo: 'scelta', opzioni: [['posticipata', 'Si chiude alla scadenza (posticipato)'], ['anticipata', 'Si apre alla scadenza (anticipato)']], w: 6 },
  { k: 'compenso.fine', label: 'Ultima data utile (facoltativa)', tipo: 'data', w: 3 },
  { k: 'compenso.rate', label: 'N° rate (facolt.)', tipo: 'numero', w: 3 },
  { k: 'compenso.generaDal', label: 'Crea i proforma automatici a partire dal', tipo: 'data', w: 6, aiuto: 'Le scadenze precedenti a questa data non generano bozze.' },
  { k: 'attivo', label: 'Incarico attivo', tipo: 'spunta', w: 6 },
];
async function modificaIncarico(c, p, inc) {
  const nuovo = !inc;
  inc ??= { profilo: p, clienteId: c.id, attivo: true, oggetto: 'Consulenza fiscale e societaria', qualita: profilo().qualita, dataMandato: '', creato: today(),
    compenso: { importo: 0, periodicita: 'trimestrale', prima: '', fine: '', rate: '', competenza: 'posticipata', generaDal: today(), dateLibere: [], adeguamenti: [] } };
  const d = await chiedi({ titolo: nuovo ? 'Nuovo incarico' : 'Modifica incarico', larga: true, campi: campiIncarico(), valore: inc, elimina: !nuovo });
  if (!d) return;
  try {
    if (d.__elimina) { await eliminaFile(c.id, inc.fileMandato); await elimina('incarichi', inc.id); return toast('Incarico eliminato'); }
    const f = d.__file?.mandato; delete d.__file;
    if (!d.id) d.id = uid();
    if (f) { await eliminaFile(c.id, d.fileMandato); d.fileMandato = await caricaFile(c.id, f, p); }
    await salva('incarichi', d); toast('Incarico salvato');
  } catch (e) { errore(e); }
}
async function modificaAdeguamento(inc, i) {
  const a = i >= 0 ? inc.compenso.adeguamenti[i] : { dal: today(), tipo: 'perc', valore: '', ripeti: 'no', nota: '' };
  const d = await chiedi({ titolo: 'Adeguamento del compenso', elimina: i >= 0, campi: [
    { k: 'dal', label: 'A partire dal', tipo: 'data', richiesto: true, w: 6 },
    { k: 'ripeti', label: 'Ripetizione', tipo: 'scelta', opzioni: [['no', 'Una sola volta'], ['annuale', 'Ogni anno, alla stessa data']], w: 6 },
    { k: 'tipo', label: 'Tipo', tipo: 'scelta', opzioni: [['perc', 'Percentuale (%)'], ['cifra', 'Cifra fissa (€)']], w: 6 },
    { k: 'valore', label: 'Valore (negativo per ridurre)', tipo: 'euro', richiesto: true, w: 6, vuoto: '' },
    { k: 'nota', label: 'Nota', segnaposto: 'es. Adeguamento ISTAT', max: 120 }], valore: a });
  if (!d) return;
  const lista = [...(inc.compenso.adeguamenti || [])];
  d.__elimina ? lista.splice(i, 1) : i >= 0 ? lista[i] = d : lista.push(d);
  salva('incarichi', { ...inc, compenso: { ...inc.compenso, adeguamenti: lista } }).catch(errore);
}
async function modificaDataLibera(inc, i) {
  const a = i >= 0 ? inc.compenso.dateLibere[i] : { data: '', importo: '', descr: '' };
  const d = await chiedi({ titolo: 'Scadenza libera', elimina: i >= 0, campi: [
    { k: 'data', label: 'Data', tipo: 'data', richiesto: true, w: 6 },
    { k: 'importo', label: 'Importo (vuoto = compenso in vigore)', tipo: 'euro', w: 6, vuoto: '' },
    { k: 'descr', label: 'Descrizione nel proforma', segnaposto: 'es. Saldo bilancio 2025', max: 160 }], valore: a });
  if (!d) return;
  const lista = [...(inc.compenso.dateLibere || [])];
  d.__elimina ? lista.splice(i, 1) : i >= 0 ? lista[i] = d : lista.push(d);
  salva('incarichi', { ...inc, compenso: { ...inc.compenso, dateLibere: lista } }).catch(errore);
}
function tabIncarichi(c, p) {
  const lista = S.incarichi.filter(i => i.clienteId === c.id && i.profilo === p);
  const oggi = today();
  return h('div.pila',
    h('div.riga', btn('Nuovo incarico', () => modificaIncarico(c, p), { tipo: 'primary', ic: 'piu' })),
    !lista.length && h('div.card', vuoto('Nessun incarico registrato per questo cliente.')),
    lista.map(inc => {
      const k = inc.compenso || {}, prossime = scadenze(inc, oggi, addMonths(oggi, 24)).slice(0, 4);
      return scheda([inc.oggetto, inc.attivo === false && chip('Non attivo'), h('span.azioni', btn('Modifica', () => modificaIncarico(c, p, inc), { tipo: 'sm', ic: 'matita' }))],
        h('dl.dati',
          dato('Mandato del', dmy(inc.dataMandato)), dato('Mandato firmato', linkFile(c.id, inc.fileMandato)),
          dato('Compenso', k.importo ? `${euro(k.importo)} · ${PERIODICITA[k.periodicita]?.nome || ''}` : ''),
          dato('In vigore oggi', k.importo ? euro(importoAl(k, oggi)) : ''),
          dato('Prima scadenza', dmy(k.prima)), dato('Bozze automatiche dal', dmy(k.generaDal))),
        h('h3.mod-titolo', 'Adeguamenti'),
        h('div.riga', (k.adeguamenti || []).map((a, i) => h('button.btn.sm', { type: 'button', onclick: () => modificaAdeguamento(inc, i) },
          `${a.valore > 0 ? '+' : ''}${a.tipo === 'perc' ? String(a.valore).replace('.', ',') + '%' : euro(a.valore)} dal ${dmy(a.dal)}${a.ripeti === 'annuale' ? ' · ogni anno' : ''}${a.nota ? ' · ' + a.nota : ''}`)),
          btn('Aggiungi', () => modificaAdeguamento(inc, -1), { tipo: 'sm', ic: 'piu' })),
        h('h3.mod-titolo', 'Scadenze libere'),
        h('div.riga', (k.dateLibere || []).map((a, i) => h('button.btn.sm', { type: 'button', onclick: () => modificaDataLibera(inc, i) }, `${dmy(a.data)}${a.importo ? ' · ' + euro(a.importo) : ''}${a.descr ? ' · ' + a.descr : ''}`)),
          btn('Aggiungi', () => modificaDataLibera(inc, -1), { tipo: 'sm', ic: 'piu' })),
        h('h3.mod-titolo', 'Prossime scadenze'),
        prossime.length ? h('div.riga', prossime.map(s => chip(`${dmy(s.data)} · ${euro(s.importo)}${s.competenza ? ' · ' + s.competenza : ''}`, 'nudo'))) : h('span.dim', 'Nessuna scadenza in programma.'));
    }));
}

/* ---------- spese anticipate ---------- */
async function modificaSpesa(c, p, s) {
  const d = await chiedi({ titolo: s ? 'Modifica spesa' : 'Nuova spesa anticipata', elimina: !!s, campi: [
    { k: 'data', label: 'Data', tipo: 'data', richiesto: true, w: 5 }, { k: 'importo', label: 'Importo', tipo: 'euro', richiesto: true, w: 7 },
    { k: 'descr', label: 'Descrizione', richiesto: true, segnaposto: 'es. Diritti camerali', max: 200 }],
    valore: s || { profilo: p, clienteId: c.id, data: today(), importo: '', descr: '', addebiti: [] } });
  if (!d) return;
  (d.__elimina ? elimina('spese', s.id) : salva('spese', d)).then(() => toast(d.__elimina ? 'Spesa eliminata' : 'Spesa salvata')).catch(errore);
}
function tabSpese(c, p) {
  const lista = S.spese.filter(s => s.clienteId === c.id && s.profilo === p).sort(by('data', -1));
  return h('div.pila',
    h('div.riga', btn('Nuova spesa', () => modificaSpesa(c, p), { tipo: 'primary', ic: 'piu' }), h('span.dim', 'Le spese si addebitano, in tutto o in parte, quando prepari un proforma.')),
    h('div.card', tabella([
      { t: 'Data', v: s => dmy(s.data) }, { t: 'Descrizione', v: s => s.descr },
      { t: 'Importo', num: true, v: s => euro(s.importo) }, { t: 'Addebitato', num: true, v: s => euro(addebitato(s)) },
      { t: 'Da addebitare', num: true, v: s => residuoSpesa(s) > 0 ? h('b', euro(residuoSpesa(s))) : chip('Recuperata', 'verde') },
    ], lista, { suRiga: s => modificaSpesa(c, p, s), vuoto: 'Nessuna spesa anticipata.' })));
}

/* ---------- proforma del cliente ---------- */
function tabProforma(c, p) {
  const lista = S.proforma.filter(x => x.clienteId === c.id && x.profilo === p).sort(by('data', -1));
  const incarichi = S.incarichi.filter(i => i.clienteId === c.id && i.profilo === p && i.attivo !== false);
  return h('div.pila',
    h('div.riga', btn('Nuovo proforma', async () => { const x = await salva('proforma', nuovaBozza(p, c, incarichi[0])).catch(errore); if (x) vai('#/proforma/' + x.id); }, { tipo: 'primary', ic: 'piu' })),
    h('div.card', tabella([
      { t: 'N°', v: x => etichettaNumero(x) }, { t: 'Data', v: x => dmy(x.data) }, { t: 'Competenza', v: x => x.competenza || h('span.dim', '—') },
      { t: 'Stato', v: x => chip(...STATI[statoDi(x)]) }, { t: 'Netto', num: true, v: x => euro(dovuto(x)) },
    ], lista, { suRiga: x => vai('#/proforma/' + x.id), vuoto: 'Nessun proforma per questo cliente.' })));
}

/* ---------- documenti e antiriciclaggio (dati condivisi tra i profili) ---------- */
const TIPI_DOC = ['Carta d’identità', 'Passaporto', 'Patente', 'Tessera sanitaria / codice fiscale', 'Permesso di soggiorno', 'Visura camerale', 'Statuto / atto costitutivo', 'Certificato attribuzione P.IVA', 'DURC', 'Firma digitale / SPID / CNS', 'Delega cassetto fiscale', 'Contratto', 'Altro'];
const TIPI_AML = ['Adeguata verifica della clientela', 'Valutazione del rischio', 'Dichiarazione del titolare effettivo', 'Dichiarazione PEP', 'Documento d’identità del titolare effettivo', 'Fascicolo antiriciclaggio', 'Altro'];
function scadenzaChip(s) {
  if (!s) return h('span.dim', '—');
  const g = daysBetween(today(), s);
  return h('span', dmy(s), ' ', g < 0 ? chip('Scaduto', 'rosso') : g <= 30 ? chip(`tra ${g} g`, g <= 7 ? 'rosso' : 'ambra') : null);
}
function elencoAllegati(c, chiave, { titolo, campi, colonne, nuovo, testoVuoto }) {
  const modifica = async (x) => {
    const d = await chiedi({ titolo: (x ? 'Modifica · ' : 'Nuovo · ') + titolo, larga: true, elimina: !!x, campi, valore: x || nuovo() });
    if (!d) return;
    try {
      let lista = [...(c[chiave] || [])];
      if (d.__elimina) { await eliminaFile(c.id, x.file); lista = lista.filter(y => y.id !== x.id); }
      else {
        const f = d.__file?.file; delete d.__file;
        if (f) { await eliminaFile(c.id, d.file); d.file = await caricaFile(c.id, f); }
        d.aggiornato = today();
        x ? lista[lista.findIndex(y => y.id === x.id)] = d : lista.push({ ...d, id: uid() });
      }
      await salva('clienti', { ...c, [chiave]: lista }); toast('Salvato');
    } catch (e) { errore(e); }
  };
  return h('div.pila',
    h('div.riga', btn('Aggiungi', () => modifica(), { tipo: 'primary', ic: 'piu' }), c.profili.length > 1 && h('span.dim', 'Sezione in comune tra ' + c.profili.map(x => PROFILI[x].nome).join(' e ') + '.')),
    h('div.card', tabella([...colonne, { t: 'Scadenza', v: d => scadenzaChip(d.scadenza) }, { t: 'File', v: d => linkFile(c.id, d.file) }],
      [...(c[chiave] || [])].sort(by(d => d.scadenza || '9')), { suRiga: modifica, vuoto: testoVuoto })));
}
const tabDocumenti = c => elencoAllegati(c, 'documenti', { titolo: 'documento', testoVuoto: 'Nessun documento caricato.',
  nuovo: () => ({ ambito: 'aziendale', tipo: TIPI_DOC[5], intestatario: c.nome, numero: '', rilascio: '', scadenza: '', fonte: 'manuale' }),
  campi: [
    { k: 'ambito', label: 'Ambito', tipo: 'scelta', opzioni: [['aziendale', 'Aziendale'], ['personale', 'Personale']], w: 4 },
    { k: 'tipo', label: 'Tipo di documento', tipo: 'scelta', opzioni: TIPI_DOC, w: 8 },
    { k: 'intestatario', label: 'Intestatario', w: 7, max: 160 }, { k: 'numero', label: 'Numero', w: 5, max: 60 },
    { k: 'rilascio', label: 'Data di rilascio', tipo: 'data', w: 6 }, { k: 'scadenza', label: 'Scadenza', tipo: 'data', w: 6, aiuto: 'Riceverai un promemoria a 60, 30 e 7 giorni.' },
    { k: 'file', label: 'File (PDF o foto)', tipo: 'file' }],
  colonne: [{ t: 'Documento', v: d => h('div', h('div.princ', d.tipo), h('div.sotto', [d.intestatario, d.numero].filter(Boolean).join(' · '))) },
    { t: 'Ambito', v: d => chip(d.ambito === 'personale' ? 'Personale' : 'Aziendale', 'nudo') },
    { t: 'Origine', v: d => chip(d.fonte === 'app' ? 'Dal cliente (app)' : 'Manuale', 'nudo') }] });
const tabAml = c => elencoAllegati(c, 'aml', { titolo: 'antiriciclaggio', testoVuoto: 'Nessun documento antiriciclaggio.',
  nuovo: () => ({ tipo: TIPI_AML[0], rischio: 'basso', data: today(), scadenza: '', nota: '' }),
  campi: [
    { k: 'tipo', label: 'Tipo', tipo: 'scelta', opzioni: TIPI_AML, w: 8 },
    { k: 'rischio', label: 'Rischio', tipo: 'scelta', opzioni: [['basso', 'Basso'], ['medio', 'Medio'], ['alto', 'Alto']], w: 4 },
    { k: 'data', label: 'Data', tipo: 'data', w: 6 }, { k: 'scadenza', label: 'Prossima revisione', tipo: 'data', w: 6 },
    { k: 'nota', label: 'Note', tipo: 'area', max: 2000 }, { k: 'file', label: 'File', tipo: 'file' }],
  colonne: [{ t: 'Documento', v: d => h('div', h('div.princ', d.tipo), d.nota && h('div.sotto', d.nota)) },
    { t: 'Rischio', v: d => chip({ basso: 'Basso', medio: 'Medio', alto: 'Alto' }[d.rischio] || '—', { basso: 'verde', medio: 'ambra', alto: 'rosso' }[d.rischio]) },
    { t: 'Data', v: d => dmy(d.data) }] });

/* ---------- note ---------- */
function tabNote(c) {
  const area = h('textarea', { rows: 3, placeholder: 'Scrivi una nota o incolla un link…', 'aria-label': 'Nuova nota', maxLength: 4000 });
  const aggiungi = async () => {
    const t = area.value.trim(); if (!t) return;
    await salva('clienti', { ...c, note: [{ id: uid(), testo: t, data: today(), autore: S.sessione.nome }, ...(c.note || [])] }).catch(errore);
  };
  return h('div.pila',
    h('div.card', h('div.pila', area, h('div.riga', btn('Aggiungi nota', aggiungi, { tipo: 'primary', ic: 'piu' }), c.profili.length > 1 && h('span.dim', 'Le note sono in comune tra i profili che seguono il cliente.')))),
    (c.note || []).map(n => h('div.nota', h('div', conLink(n.testo)), h('div.meta', `${dmy(n.data)} · ${n.autore || ''}`,
      h('button.icbtn.danger', { type: 'button', 'aria-label': 'Elimina nota', onclick: async () => { if (await conferma('Eliminare la nota?', n.testo.slice(0, 120), { ok: 'Elimina', pericolo: true })) salva('clienti', { ...c, note: c.note.filter(x => x.id !== n.id) }).catch(errore); } }, icona('cestino', 15))))),
    !(c.note || []).length && h('div.vuoto', 'Nessuna nota.'));
}
