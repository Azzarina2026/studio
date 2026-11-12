/* Impostazioni del profilo attivo: numerazione, IBAN, aliquote, testi del proforma, password. */
import { S, be, salva, profilo } from '../core/stato.js';
import { h, btn, chip, scheda, chiedi, toast, errore, tabella, icona } from '../core/ui.js';
import { clone, uid } from '../core/util.js';
import { testata, campiPassword } from '../main.js';
import { PROFILI } from '../domain/profili.js';
import { PICODOC } from '../config.js';
import { pd } from '../data/picodoc.js';

const righe = { da: a => (a || []).join('\n'), a: s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean) };
const registra = (prof, msg = 'Impostazioni salvate') => salva('profili', prof).then(() => toast(msg)).catch(errore);

export function vista() {
  const prof = profilo(), o = prof.opz;
  const dato = (t, v) => h('div', h('dt', t), h('dd', v));

  const numerazione = async () => {
    const d = await chiedi({ titolo: 'Numerazione proforma', nota: 'Il numero viene assegnato quando emetti un proforma. A inizio anno riparte da 1 da solo.', campi: [
      { k: 'anno', label: 'Anno', tipo: 'numero', richiesto: true, w: 6 }, { k: 'prossimo', label: 'Prossimo numero', tipo: 'numero', richiesto: true, w: 6, valida: v => v >= 1 ? '' : 'Deve essere almeno 1' }], valore: prof.numerazione });
    if (d) registra({ ...clone(prof), numerazione: { anno: Number(d.anno), prossimo: Number(d.prossimo) } });
  };
  const iban = async (x) => {
    const d = await chiedi({ titolo: x ? 'Modifica IBAN' : 'Nuovo IBAN', elimina: !!x, campi: [
      { k: 'banca', label: 'Banca (come deve comparire nel proforma)', richiesto: true, segnaposto: 'es. Intesa San Paolo sede di Bari', max: 120 },
      { k: 'iban', label: 'IBAN', richiesto: true, max: 40, valida: v => /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}$/i.test(v) ? '' : 'IBAN non valido' },
      { k: 'predefinito', label: 'Conto predefinito', tipo: 'spunta' }], valore: x || { banca: '', iban: '', predefinito: !(prof.iban || []).length } });
    if (!d) return;
    let lista = clone(prof.iban || []);
    if (d.__elimina) lista = lista.filter(i => i.id !== x.id);
    else { d.iban = d.iban.toUpperCase(); if (d.predefinito) lista.forEach(i => i.predefinito = false); x ? lista[lista.findIndex(i => i.id === x.id)] = d : lista.push({ ...d, id: uid() }); }
    registra({ ...clone(prof), iban: lista }, 'IBAN aggiornati');
  };
  const calcolo = async () => {
    const d = await chiedi({ titolo: 'Regole di calcolo predefinite', larga: true, nota: 'Valgono per i nuovi proforma di questo profilo. Ogni proforma resta comunque modificabile.', valore: o, campi: [
      { tipo: 'titolo', label: 'Maggiorazione' }, { k: 'magg.on', label: 'Applica', tipo: 'spunta', w: 3 }, { k: 'magg.perc', label: '%', tipo: 'numero', w: 3 }, { k: 'magg.label', label: 'Dicitura ({perc} = percentuale)', w: 6 },
      { tipo: 'titolo', label: 'IVA' }, { k: 'iva.on', label: 'Applica', tipo: 'spunta', w: 3 }, { k: 'iva.perc', label: '%', tipo: 'numero', w: 3 }, { k: 'iva.label', label: 'Dicitura', w: 6 },
      { tipo: 'titolo', label: 'Ritenuta d’acconto' }, { k: 'rit.on', label: 'Applica', tipo: 'spunta', w: 3 }, { k: 'rit.perc', label: '%', tipo: 'numero', w: 3 },
      { k: 'rit.base', label: 'Calcolata su', tipo: 'scelta', opzioni: [['onorario', 'Totale onorario'], ['imponibile', 'Imponibile']], w: 6 }, { k: 'rit.label', label: 'Dicitura ({perc}, {base})' },
      { tipo: 'titolo', label: 'Altre righe' }, { k: 'antic.label', label: 'Dicitura anticipazioni' },
      { k: 'bollo.on', label: 'Bollo', tipo: 'spunta', w: 3 }, { k: 'bollo.imp', label: 'Importo', tipo: 'euro', w: 3 }, { k: 'bollo.label', label: 'Dicitura', w: 6 },
      { k: 'speseGen.on', label: 'Spese generali', tipo: 'spunta', w: 3 }, { k: 'speseGen.perc', label: '%', tipo: 'numero', w: 3 }, { k: 'speseGen.label', label: 'Dicitura', w: 6 }] });
    if (d) registra({ ...clone(prof), opz: d });
  };
  const testi = async () => {
    const v = { ...clone(prof), _soci: righe.da(prof.intestazione.soci), _piede: righe.da(prof.piede), _firma: righe.da(prof.firma), _diciture: righe.da(prof.diciture) };
    const d = await chiedi({ titolo: 'Testi del proforma', larga: true, nota: 'Usa **testo** per il grassetto e //testo// per il corsivo. I segnaposto tra parentesi graffe vengono sostituiti in automatico.', valore: v, campi: [
      { tipo: 'titolo', label: 'Intestazione' }, { k: 'intestazione.titolo', label: 'Titolo', w: 7 }, { k: 'intestazione.sottotitolo', label: 'Sottotitolo', w: 5 },
      { k: '_soci', label: 'Professionisti (uno per riga)', tipo: 'area', righe: 2 }, { k: '_piede', label: 'Piè di pagina (una riga per riga)', tipo: 'area', righe: 4 },
      { tipo: 'titolo', label: 'Corpo' }, { k: 'titoloPrestazione', label: 'Titolo della prestazione' },
      { k: 'descrizione', label: 'Descrizione — segnaposto: {cliente} {dataMandato} {qualita} {competenza}', tipo: 'area', righe: 4 }, { k: 'qualita', label: 'Testo predefinito «in qualità di»' },
      { k: 'mostraCF', label: 'Mostra sempre il codice fiscale del cliente', tipo: 'spunta' },
      { tipo: 'titolo', label: 'Chiusura' }, { k: '_firma', label: 'Firma (una riga per riga, vuoto = nessuna)', tipo: 'area', righe: 2 },
      { k: 'avvisoIbanOn', label: 'Mostra l’avviso in rosso sopra l’IBAN', tipo: 'spunta', w: 6 }, { k: 'avvisoIban', label: 'Testo dell’avviso', w: 6 },
      { k: 'rigaIban', label: 'Riga IBAN — segnaposto: {banca} {iban}' },
      { tipo: 'titolo', label: 'Diciture a scelta' }, { k: '_diciture', label: 'Una dicitura per riga: compaiono come opzioni in ogni proforma', tipo: 'area', righe: 8 }] });
    if (!d) return;
    d.intestazione.soci = righe.a(d._soci); d.piede = righe.a(d._piede); d.firma = righe.a(d._firma); d.diciture = righe.a(d._diciture);
    ['_soci', '_piede', '_firma', '_diciture'].forEach(k => delete d[k]);
    registra(d);
  };
  const password = async () => {
    const d = await chiedi({ titolo: 'Cambia password', ok: 'Cambia', campi: campiPassword() });
    if (!d) return;
    if (d.nuova !== d.ripeti) return toast('Le due password non coincidono', 'err');
    be.cambiaPassword(d.attuale, d.nuova).then(() => toast('Password aggiornata')).catch(errore);
  };

  const dueFattori = async () => {
    try {
      const t = await be.totpInizia();
      const d = await chiedi({ titolo: 'Verifica in due passaggi', ok: 'Attiva', nota: `Apri Google Authenticator, scegli «Inserisci una chiave di configurazione», tipo «Basata sul tempo», e digita questa chiave: ${t.chiave} — poi scrivi qui sotto il codice a 6 cifre che compare.`,
        campi: [{ k: 'codice', label: 'Codice a 6 cifre', richiesto: true, max: 6 }] });
      if (!d) return;
      await t.conferma(d.codice); toast('Verifica in due passaggi attivata: dal prossimo accesso servirà il codice');
    } catch (e) {
      if (e.code === 'auth/unverified-email') { await be.verificaEmail().catch(() => {}); return toast('Ti abbiamo inviato un’e-mail: conferma l’indirizzo dal link, poi riprova.', 'err'); }
      errore(e);
    }
  };
  return h('div',
    testata(['Impostazioni ', h('b', PROFILI[prof.id].nome)]),
    h('div.griglia',
      h('section.card.g6', h('h3.card-t', 'Numerazione proforma', h('span.azioni', btn('Modifica', numerazione, { tipo: 'sm', ic: 'matita' }))),
        h('dl.dati', dato('Prossimo numero', h('b', `${prof.numerazione.prossimo}/${prof.numerazione.anno}`)), dato('Serie', 'Separata per ' + PROFILI[prof.id].nome))),
      h('section.card.g6', h('h3.card-t', 'Regole di calcolo', h('span.azioni', btn('Modifica', calcolo, { tipo: 'sm', ic: 'matita' }))),
        h('div.riga', chip(`Maggiorazione ${o.magg.on ? o.magg.perc + '%' : 'no'}`, 'nudo'), chip(`IVA ${o.iva.on ? o.iva.perc + '%' : 'no'}`, 'nudo'), chip(`Ritenuta ${o.rit.on ? o.rit.perc + '% su ' + o.rit.base : 'no'}`, 'nudo'), o.bollo.on && chip('Bollo', 'nudo'), o.speseGen.on && chip(`Spese generali ${o.speseGen.perc}%`, 'nudo'))),
      h('section.card.g12', h('h3.card-t', 'Conti correnti (IBAN)', h('span.azioni', btn('Aggiungi IBAN', () => iban(), { tipo: 'sm.primary', ic: 'piu' }))),
        tabella([{ t: 'Banca', v: i => h('span.princ', i.banca) }, { t: 'IBAN', v: i => i.iban }, { t: '', v: i => i.predefinito ? chip('Predefinito', 'verde') : '' }], prof.iban || [], { suRiga: iban, vuoto: 'Nessun IBAN inserito: aggiungilo per farlo comparire nei proforma.' }),
        h('p.dim', { style: { fontSize: '12.5px', margin: '12px 0 0' } }, 'Con più di un conto, prima di emettere o scaricare un proforma ti viene chiesto quale usare.')),
      h('section.card.g12', h('h3.card-t', 'Testi e diciture del proforma', h('span.azioni', btn('Modifica', testi, { tipo: 'sm', ic: 'matita' }))),
        h('dl.dati', dato('Intestazione', prof.intestazione.titolo), dato('Firma', prof.firma.join(' · ') || '—'), dato('Avviso IBAN', prof.avvisoIbanOn ? prof.avvisoIban : 'Non mostrato'), dato('Diciture a scelta', prof.diciture.length + ' disponibili'))),
      h('section.card.g12', h('h3.card-t', icona('chiave'), 'Accesso'),
        h('div.riga', h('span', `Collegato come ${S.sessione.nome} (${S.sessione.email})`), btn('Cambia password', password, { tipo: 'sm' })),
        be.totpInizia && h('div.riga', { style: { marginTop: '10px' } }, S.sessione.dueFattori ? chip('Verifica in due passaggi attiva', 'verde') : btn('Attiva la verifica in due passaggi (Authenticator)', dueFattori, { tipo: 'sm', ic: 'scudo' })),
        h('p.dim', { style: { fontSize: '12.5px', margin: '12px 0 0' } }, 'La sessione si chiude da sola dopo 30 minuti di inattività e alla chiusura del browser.')),
      schedaPicoDoc()));
}

/* ---------- Pico Doc: account dello studio e tipi di documento accettati ---------- */
function schedaPicoDoc() {
  const corpo = h('div', h('p.dim', 'Controllo il collegamento con Pico Doc…'));
  const card = h('section.card.g12', h('h3.card-t', icona('graffetta'), 'Pico Doc · documenti dai clienti'), corpo);
  const ridisegna = () => disegna().catch(e => corpo.replaceChildren(h('p.testo', e.message), btn('Riprova', ridisegna, { tipo: 'sm' })));
  const azione = f => async () => { try { await f(); await ridisegna(); } catch (e) { errore(e); } };
  const credenziali = async (titolo, ok) => chiedi({ titolo, ok, campi: [
    { k: 'email', label: 'Email', tipo: 'email', richiesto: true, auto: 'username' },
    { k: 'pw', label: 'Password (almeno 8 caratteri)', tipo: 'password', richiesto: true, auto: titolo.startsWith('Crea') ? 'new-password' : 'current-password' }] });
  const sceltaTipi = async (attuali = PICODOC.tipi.slice(0, 8).map(t => t[0])) => {
    const valore = Object.fromEntries(PICODOC.tipi.map(([id]) => [id, attuali.includes(id)]));
    const d = await chiedi({ titolo: 'Documenti che lo studio accetta', ok: 'Salva', valore, nota: 'I clienti potranno inviare dall’app solo questi tipi di documento.',
      campi: PICODOC.tipi.map(([id, voce, nome]) => ({ k: id, label: nome || voce, tipo: 'spunta', w: 6 })) });
    return d && PICODOC.tipi.map(t => t[0]).filter(id => d[id]);
  };

  async function disegna() {
    const st = await pd.stato();
    if (!st.utente) {
      corpo.replaceChildren(
        h('p.testo', 'Collega lo studio a Pico Doc: potrai invitare i clienti dalla loro scheda e ricevere i documenti che scansionano con l’app. Serve un account Pico Doc dello studio (email e password), diverso dall’accesso al CRM.'),
        h('div.riga',
          btn('Entra', azione(async () => { const d = await credenziali('Entra in Pico Doc', 'Entra'); if (d) await pd.entra(d.email, d.pw); }), { tipo: 'primary' }),
          btn('Crea account', azione(async () => {
            const d = await credenziali('Crea l’account Pico Doc dello studio', 'Crea');
            if (d) { await pd.creaAccount(d.email, d.pw); toast('Account creato: conferma l’email dal link che ti abbiamo inviato'); }
          }))));
      return;
    }
    const righe = [h('div.riga', h('span', `Pico Doc: ${st.utente.email}`), btn('Esci da Pico Doc', azione(() => pd.esci()), { tipo: 'sm' }))];
    if (!st.utente.verificata) {
      righe.push(h('p.testo', 'Conferma l’indirizzo email dal link che ti abbiamo inviato, poi premi «Ho confermato».'),
        h('div.riga', btn('Ho confermato', azione(() => pd.ricarica()), { tipo: 'sm.primary' }), btn('Invia di nuovo', azione(() => pd.inviaVerifica().then(() => toast('Email inviata'))), { tipo: 'sm' })));
    } else if (!st.destinatario) {
      righe.push(h('p.testo', `Ultimo passo: scegli quali documenti accettare e attiva «${PICODOC.nome}» come destinatario.`),
        btn('Scegli i documenti e attiva', azione(async () => { const t = await sceltaTipi(); if (t) { await pd.attiva(t); toast('Pico Doc attivato'); } }), { tipo: 'primary' }));
    } else if (!st.membro) {
      righe.push(h('p.testo', `Il destinatario «${st.destinatario.nome}» esiste già ed è gestito da un altro account Pico Doc. Entra con quello.`));
    } else {
      const nomi = new Map(PICODOC.tipi.map(([id, voce, nome]) => [id, nome || voce]));
      righe.push(
        h('div.riga', chip('Attivo come «' + st.destinatario.nome + '»', 'verde')),
        h('dl.dati', h('div', h('dt', 'Documenti accettati'), h('dd', (st.destinatario.tipi || []).map(t => nomi.get(t) || t).join(', ') || '—'))),
        h('div.riga', btn('Modifica documenti accettati', azione(async () => { const t = await sceltaTipi(st.destinatario.tipi); if (t) { await pd.attiva(t); toast('Salvato'); } }), { tipo: 'sm', ic: 'matita' })),
        h('p.dim', { style: { fontSize: '12.5px', margin: '12px 0 0' } }, 'Per invitare un cliente apri la sua scheda. I documenti inviati arrivano in «Da Pico Doc».'));
    }
    corpo.replaceChildren(...righe);
  }
  ridisegna();
  return card;
}
