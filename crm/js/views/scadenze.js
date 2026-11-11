/* Promemoria: documenti e antiriciclaggio in scadenza, compensi in arrivo. */
import { S, cliente } from '../core/stato.js';
import { h, chip, tabella, scheda } from '../core/ui.js';
import { dmy, euro, today, addMonths, by } from '../core/util.js';
import { testata, vai } from '../main.js';
import { avvisi } from '../domain/servizi.js';
import { scadenze } from '../domain/scadenze.js';
import { LIMITI } from '../config.js';

export function vista() {
  const lista = avvisi(), oggi = today();
  const compensi = S.incarichi.filter(i => i.profilo === S.profilo && i.attivo !== false && cliente(i.clienteId)?.stato?.[i.profilo]?.attivo !== false)
    .flatMap(i => scadenze(i, oggi, addMonths(oggi, 2)).map(s => ({ ...s, inc: i }))).sort(by('data'));
  return h('div',
    testata(['Scadenze']),
    h('div.pila',
      scheda(`Documenti e antiriciclaggio · prossimi ${Math.max(...LIMITI.avvisiGiorni)} giorni`,
        tabella([
          { t: 'Quando', v: a => chip(a.giorni < 0 ? `Scaduto da ${-a.giorni} g` : a.giorni === 0 ? 'Oggi' : `Tra ${a.giorni} giorni`, a.livello) },
          { t: 'Scadenza', v: a => dmy(a.doc.scadenza) },
          { t: 'Documento', v: a => h('div', h('div.princ', a.doc.tipo), h('div.sotto', a.gruppo + (a.doc.intestatario ? ' · ' + a.doc.intestatario : ''))) },
          { t: 'Cliente', v: a => a.cliente.nome },
        ], lista, { suRiga: a => vai('#/clienti/' + a.cliente.id), vuoto: 'Nessun documento in scadenza.' }),
        h('p.dim', { style: { fontSize: '12.5px', margin: '12px 0 0' } }, `Gli avvisi compaiono a ${LIMITI.avvisiGiorni.join(', ')} giorni dalla scadenza. I clienti disattivati non generano avvisi.`)),
      scheda('Compensi in scadenza · prossimi 2 mesi',
        tabella([{ t: 'Data', v: s => dmy(s.data) }, { t: 'Cliente', v: s => h('span.princ', cliente(s.inc.clienteId)?.nome) }, { t: 'Competenza', v: s => s.competenza || '—' }, { t: 'Importo', num: true, v: s => euro(s.importo) }],
          compensi, { suRiga: s => vai('#/clienti/' + s.inc.clienteId), vuoto: 'Nessun compenso in scadenza.' }),
        h('p.dim', { style: { fontSize: '12.5px', margin: '12px 0 0' } }, 'Alla data indicata il proforma viene preparato in bozza alla prima apertura del CRM.'))));
}
