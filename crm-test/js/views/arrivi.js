/* Documenti inviati dai clienti con l'app Pico Doc, in attesa di essere portati nella loro scheda.
   Dopo l'importazione (o il rifiuto) il documento viene cancellato dai server di Pico Doc. */
import { S, salva, cliente } from '../core/stato.js';
import { h, btn, chip, scheda, tabella, conferma, toast, errore, scaricaBlob } from '../core/ui.js';
import { dmy, today, uid, fileSize } from '../core/util.js';
import { testata } from '../main.js';
import { caricaFile } from '../core/allegati.js';
import { PICODOC } from '../config.js';
import { pd } from '../data/picodoc.js';

const voce = id => PICODOC.tipi.find(t => t[0] === id) || [id, 'Altro', id];
const IDENTITA = ['carta_identita', 'passaporto', 'patente', 'tessera_sanitaria', 'permesso_soggiorno'];

export function vista() {
  const corpo = h('div', h('p.dim', 'Controllo i documenti in arrivo…'));
  const ridisegna = () => disegna().catch(e => corpo.replaceChildren(scheda(null, h('p.testo', e.message), btn('Riprova', ridisegna, { tipo: 'sm' }))));

  async function porta(inv, c) {
    try {
      toast('Scarico il documento…');
      const blob = await pd.scarica(inv);
      const [, tipoCrm, nomeTipo] = voce(inv.tipo);
      const file = new File([blob], `${inv.nome}.pdf`, { type: 'application/pdf' });
      const rif = await caricaFile(c.id, file);
      const documento = { id: uid(), ambito: IDENTITA.includes(inv.tipo) ? 'personale' : 'aziendale', tipo: tipoCrm,
        intestatario: c.nome, numero: nomeTipo && tipoCrm === 'Altro' ? nomeTipo : '', rilascio: '', scadenza: inv.scadenza || '',
        fonte: 'app', file: rif, aggiornato: today() };
      await salva('clienti', { ...c, documenti: [...(c.documenti || []), documento] });
      await pd.cancella(inv);
      toast(`Aggiunto ai documenti di ${c.nome}`);
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
    const arrivi = await pd.inArrivo();
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
    h('p.dim', { style: { fontSize: '12.5px' } }, 'I documenti restano su Pico Doc solo finché non li porti nella scheda o li rifiuti: poi vengono cancellati.'));
  }
  ridisegna();
  return h('div', testata('Da Pico Doc', btn('Aggiorna', ridisegna, { ic: 'freccia' })), corpo);
}
