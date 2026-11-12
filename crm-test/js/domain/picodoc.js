/* Regole per portare in scheda un documento arrivato dall'app Pico Doc. Nessuna interfaccia qui:
   sono provate in automatico da tools/collaudo/picodoc.mjs. */

/* tipi di Pico Doc che sono documenti d'identità di una persona */
export const IDENTITA = ['carta_identita', 'passaporto', 'patente', 'tessera_sanitaria', 'permesso_soggiorno'];

/* [idPicoDoc, voce del CRM, descrizione se la voce è «Altro»] */
export const voceTipo = (tipi, id) => tipi.find(t => t[0] === id) || [id, 'Altro', id];

/* Il documento del CRM che nasce da un invio.
   Nelle schede delle aziende i documenti d'identità sono di una persona (un socio, l'amministratore…):
   come intestatario si mette l'email di chi lo ha inviato, così si distingue da quelli degli altri. */
export function documentoDaInvio(invio, cliente, tipi, emailMittente, { id, oggi, file }) {
  const [, tipoCrm, descrizione] = voceTipo(tipi, invio.tipo);
  const identita = IDENTITA.includes(invio.tipo);
  return {
    id, ambito: identita ? 'personale' : 'aziendale', tipo: tipoCrm,
    intestatario: identita && cliente.tipo !== 'persona' ? (emailMittente || cliente.nome) : cliente.nome,
    numero: descrizione && tipoCrm === 'Altro' ? descrizione : '', rilascio: '', scadenza: invio.scadenza || '',
    fonte: 'app', mittente: invio.utente, file, aggiornato: oggi,
  };
}

/* Che cosa fare dei documenti già in scheda quando ne arriva uno nuovo.
   - sostituire: sono lo stesso documento, più vecchio → il nuovo ne prende il posto
       · stesso tipo, inviato dallo stesso utente dell'app;
       · stesso tipo, caricato a mano e intestato al cliente, quando non può essere di un'altra persona
         (scheda di una persona fisica, oppure documento dell'azienda e non d'identità).
   - dubbi: stesso tipo, caricato a mano e intestato al cliente, ma è un documento d'identità in una scheda
       aziendale: potrebbe essere di un altro socio → si chiede.
   I documenti inviati dall'app da ALTRI utenti non si toccano mai (i soci di una società restano distinti). */
export function confronta(documenti, nuovo, cliente) {
  const stessoTipo = d => d.tipo === nuovo.tipo && (nuovo.tipo !== 'Altro' || (d.numero || '') === (nuovo.numero || ''));
  const identita = nuovo.ambito === 'personale';
  const sostituire = [], dubbi = [];
  for (const d of documenti || []) {
    if (!stessoTipo(d)) continue;
    if (d.mittente) { if (d.mittente === nuovo.mittente) sostituire.push(d); continue; }
    if (d.intestatario !== cliente.nome) continue;
    (identita && cliente.tipo !== 'persona' ? dubbi : sostituire).push(d);
  }
  return { sostituire, dubbi };
}

/* La scadenza più lontana tra quelle dei documenti indicati ('' se nessuna). */
export const scadenzaPiuLontana = documenti => documenti.map(d => d.scadenza || '').sort().pop() || '';
