/* Documenti inviati dai clienti con l'app Pico Doc, in attesa di essere portati nella loro scheda.
   Dopo l'importazione (o il rifiuto) il documento viene cancellato dai server di Pico Doc. */
import { salva, cliente, admin } from '../core/stato.js';
import { h, btn, scheda, tabella, conferma, finestra, toast, errore, scaricaBlob } from '../core/ui.js';
import { dmy, today, uid, fileSize } from '../core/util.js';
import { testata } from '../main.js';
import { caricaFile, eliminaFile } from '../core/allegati.js';
import { PICODOC } from '../config.js';
import { pd } from '../data/picodoc.js';
import { voceTipo, documentoDaInvio, confronta, scadenzaPiuLontana } from '../domain/picodoc.js';

const voce = id => voceTipo(PICODOC.tipi, id);

/* Tre risposte possibili: 'sostituisci', 'entrambi', oppure null se si chiude la finestra. */
const chiediDubbio = (titolo, testo) => new Promise(res => {
  let esito = null;
  finestra({ titolo, corpo: h('p.testo', testo), onChiudi: () => res(esito), azioni: [
    c => btn('Annulla', () => c()),
    c => btn('Tieni entrambi', () => { esito = 'entrambi'; c(); }),
    c => btn('Sostituisci', () => { esito = 'sostituisci'; c(); }, { tipo: 'primary' })] });
});

export function vista() {
  const corpo = h('div', h('p.dim', 'Controllo i documenti in arrivo…'));
  const ridisegna = () => disegna().catch(e => corpo.replaceChildren(scheda(null, h('p.testo', e.message), btn('Riprova', ridisegna, { tipo: 'sm' }))));

  async function porta(inv, c) {
    try {
      // l'email di chi ha inviato serve a distinguere i documenti personali nelle schede aziendali
      const email = (await pd.collegati(c.id).catch(() => [])).find(x => x.utente === inv.utente)?.email;
      const nuovo = documentoDaInvio(inv, c, PICODOC.tipi, email, { id: uid(), oggi: today(), file: null });
      const { sostituire, dubbi } = confronta(c.documenti, nuovo, c);
      const vecchi = [...sostituire];
      if (dubbi.length) {
        const r = await chiediDubbio('In scheda c’è già un documento simile',
          `Tra i documenti di «${c.nome}» c’è già «${nuovo.tipo}» caricato a mano. Se è della stessa persona conviene sostituirlo; se è di un’altra persona (per esempio un altro socio) tienili entrambi.`);
        if (!r) return;
        if (r === 'sostituisci') vecchi.push(...dubbi);
      }
      const recente = scadenzaPiuLontana(vecchi);
      // Se in scheda c'è già un documento che scade dopo, quello arrivato è meno aggiornato: si chiede.
      if (vecchi.length && inv.scadenza && recente && inv.scadenza < recente
        && !await conferma('In scheda c’è un documento più recente', `Il documento in scheda scade il ${dmy(recente)}, quello arrivato il ${dmy(inv.scadenza)}. Sostituirlo comunque?`, { ok: 'Sostituisci' })) return;
      toast('Scarico il documento…');
      const blob = await pd.scarica(inv);
      nuovo.file = await caricaFile(c.id, new File([blob], `${inv.nome}.pdf`, { type: 'application/pdf' }));
      const restanti = (c.documenti || []).filter(d => !vecchi.includes(d));
      await salva('clienti', { ...c, documenti: [...restanti, nuovo] });
      for (const d of vecchi) await eliminaFile(c.id, d.file);
      await pd.cancella(inv);
      toast(vecchi.length ? `Documento di ${c.nome} aggiornato: il precedente è stato sostituito` : `Aggiunto ai documenti di ${c.nome}`);
      ridisegna();
    } catch (e) { errore(e); }
  }
  async function apri(inv) {
    try { scaricaBlob(await pd.scarica(inv), `${inv.nome}.pdf`); } catch (e) { errore(e); }
  }
  async function rifiuta(inv) {
    if (!await conferma('Rifiutare il documento?', 'Verrà cancellato da Pico Doc senza essere salvato nel CRM.', { ok: 'Rifiuta', pericolo: true })) return;
    try { await pd.cancella(inv); toast('Documento rifiutato'); ridisegna(); } catch (e) { errore(e); }
  }

  async function disegna() {
    const st = await pd.stato();
    if (!st.utente || !st.membro) {
      corpo.replaceChildren(scheda(null, h('p.testo', { style: { margin: 0 } }, 'Pico Doc non è ancora collegato: vai in ', h('a', { href: '#/impostazioni' }, 'Impostazioni'), ' → Pico Doc.')));
      return;
    }
    const tutti = await pd.inArrivo();
    /* Ogni profilo vede solo i documenti dei propri clienti. Il super admin vede anche quelli rimasti
       senza scheda (cliente eliminato), per poterli rifiutare. */
    const arrivi = tutti.filter(x => cliente(x.scheda) || admin());
    const nascosti = tutti.length - arrivi.length;
    corpo.replaceChildren(h('div.card', tabella([
      { t: 'Cliente', v: x => { const c = cliente(x.scheda); return c ? h('a', { href: '#/clienti/' + c.id }, h('span.princ', c.nome)) : h('span.dim', 'Scheda non trovata'); } },
      { t: 'Documento', v: x => h('div', h('div.princ', x.nome), h('div.sotto', `${voce(x.tipo)[2] || voce(x.tipo)[1]} · ${x.pagine} pag. · ${fileSize(x.byte)}`)) },
      { t: 'Scadenza', v: x => x.scadenza ? dmy(x.scadenza) : h('span.dim', '—') },
      { t: 'Arrivato', v: x => x.creato ? dmy(x.creato.toISOString().slice(0, 10)) : '—' },
      { t: '', v: x => { const c = cliente(x.scheda); return h('div.riga',
        btn('Apri', () => apri(x), { tipo: 'sm', ic: 'occhio' }),
        c && btn('Porta nella scheda', () => porta(x, c), { tipo: 'sm.primary', ic: 'ok' }),
        btn('Rifiuta', () => rifiuta(x), { tipo: 'sm', ic: 'cestino' })); } },
    ], arrivi, { vuoto: 'Nessun documento in arrivo.' })),
    nascosti > 0 && h('p.dim', { style: { fontSize: '12.5px' } }, `${nascosti === 1 ? 'C’è 1 altro documento' : `Ci sono altri ${nascosti} documenti`} per clienti che non rientrano in questo profilo.`),
    h('p.dim', { style: { fontSize: '12.5px' } }, 'I documenti restano su Pico Doc solo finché non li porti nella scheda o li rifiuti: poi vengono cancellati. Se in scheda c’è già lo stesso documento della stessa persona, quello nuovo lo sostituisce.'));
  }
  ridisegna();
  return h('div', testata('Da Pico Doc', btn('Aggiorna', ridisegna, { ic: 'freccia' })), corpo);
}
