/* Dati FINTI per l'ambiente di prova. Nomi, partite IVA e importi sono inventati. */
import { addMonths, addDays, today, iso } from '../core/util.js';
import { scadenze } from '../domain/scadenze.js';
import { calcola, OPZIONI_BASE } from '../domain/calcolo.js';
import { clone } from '../core/util.js';
import { PROFILI } from '../domain/profili.js';

const AZIENDE = [
  ['Officine Rossi S.r.l.', 'Via Roma 12', '70121 Bari', '01234560721', 'ABC1234', ['anna'], 1350, 'trimestrale'],
  ['Panificio Del Borgo S.n.c.', 'Corso Italia 45', '70123 Bari', '02345670722', 'M5UXCR1', ['anna'], 480, 'mensile'],
  ['Edil Murgia S.r.l.', 'Via Appia 3', '70022 Altamura', '03456780723', 'KRRH6B9', ['studio'], 2400, 'trimestrale'],
  ['Farmacia San Nicola', 'Piazza Mercantile 8', '70122 Bari', '04567890724', '0000000', ['studio'], 900, 'bimestrale'],
  ['Trasporti Levante S.p.A.', 'Via Napoli 210', '70132 Bari', '05678900725', 'SUBM70N', ['anna', 'studio'], 3200, 'semestrale'],
  ['Studio Tecnico Bianchi', 'Via Sparano 77', '70121 Bari', '06789010726', 'T04ZHR3', ['anna'], 600, 'trimestrale', true],
  ['Oleificio Terra di Bari', 'Contrada Macchia 1', '70032 Bitonto', '07890120727', 'W7YVJK9', ['studio'], 1800, 'annuale'],
  ['Mare Blu Ristorazione S.r.l.', 'Lungomare Nazario Sauro 5', '70121 Bari', '08901230728', 'P62QHVQ', ['studio'], 750, 'mensile'],
  ['Sartoria Fiore di Fiore G.', 'Via Melo 31', '70121 Bari', '09012340729', '0000000', ['anna'], 350, 'trimestrale', true],
  ['Tecno Puglia Impianti S.r.l.', 'Via Amendola 162', '70126 Bari', '01122330720', 'XL13LG4', ['anna', 'studio'], 1500, 'trimestrale'],
  ['Cantine Dei Trulli S.a.s.', 'Via Monte Grappa 9', '70011 Alberobello', '02233440721', 'BA6ET11', ['studio'], 1100, 'quadrimestrale'],
  ['Immobiliare Petruzzelli S.r.l.', 'Via Cavour 20', '70121 Bari', '03344550722', 'N92GLON', ['anna'], 2000, 'semestrale', false, true],
];

export function semina(db) {
  const oggi = today(), inizio = addMonths(oggi.slice(0, 8) + '01', -15);
  const num = { anna: {}, studio: {} };
  AZIENDE.forEach((a, i) => {
    const [nome, via, citta, piva, sdi, profili, importo, periodicita, forf, inattivo] = a;
    const id = 'c' + (i + 1);
    const stato = {};
    profili.forEach((p, j) => stato[p] = { attivo: !inattivo, codice: String(100 + i * 7 + j * 300) });
    db.clienti[id] = {
      id, tipo: 'azienda', nome, sedeLegale: { via, citta }, sedeOperativa: i % 4 === 0 ? { via: 'Zona Industriale, lotto ' + (i + 2), citta: '70026 Modugno' } : { via: '', citta: '' },
      piva, cf: piva, sdi, pec: 'amministrazione@' + nome.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12) + '.example', email: '', telefono: '080 55' + (10000 + i * 731),
      referente: ['Mario Rossi', 'Lucia Bianchi', 'Paolo Verdi'][i % 3], forfettario: !!forf, profili, stato,
      note: i % 3 === 0 ? [{ id: 'n' + i, testo: 'Preferisce essere contattato al mattino. Cartella condivisa: https://example.com/cartella/' + id, data: addDays(oggi, -40 - i), autore: 'Anna' }] : [],
      documenti: [
        { id: 'd' + i + 'a', ambito: 'personale', tipo: 'Carta d’identità', intestatario: ['Mario Rossi', 'Lucia Bianchi', 'Paolo Verdi'][i % 3], numero: 'CA' + (10000 + i * 913) + 'XX', rilascio: addMonths(oggi, -110), scadenza: addDays(oggi, [5, 22, 48, 200, 400, -12][i % 6]), fonte: 'manuale' },
        { id: 'd' + i + 'b', ambito: 'aziendale', tipo: 'Visura camerale', intestatario: nome, numero: '', rilascio: addMonths(oggi, -5), scadenza: addMonths(oggi, 1 + (i % 5)), fonte: 'manuale' },
      ],
      aml: i % 2 === 0 ? [{ id: 'a' + i, tipo: 'Adeguata verifica della clientela', rischio: ['basso', 'medio', 'alto'][i % 3], data: addMonths(oggi, -20), scadenza: addMonths(oggi, 4 - (i % 5) * 2), nota: '' }] : [],
      portale: { abilitato: false }, creato: addMonths(oggi, -18), agg: oggi,
    };
    profili.forEach(profilo => {
      const iid = `i-${id}-${profilo}`;
      const inc = {
        id: iid, profilo, clienteId: id, attivo: !inattivo, dataMandato: addMonths(inizio, -6 - i), oggetto: 'Consulenza fiscale e societaria', qualita: 'consulenza fiscale e societaria', fileMandato: null,
        compenso: { importo, periodicita, prima: addDays(addMonths(inizio, i % 3), 0), fine: '', rate: '', competenza: 'posticipata', dateLibere: [],
          adeguamenti: i % 4 === 1 ? [{ dal: addMonths(oggi, -5), tipo: 'perc', valore: 3, ripeti: 'annuale', nota: 'Adeguamento ISTAT' }] : [] },
      };
      db.incarichi[iid] = inc;
      if (i % 2 === 0) db.spese[`s-${id}-${profilo}`] = { id: `s-${id}-${profilo}`, profilo, clienteId: id, data: addDays(oggi, -20 - i * 3), descr: ['Diritti camerali', 'Marche da bollo', 'Visure catastali', 'Imposta di registro'][i % 4], importo: 40 + i * 11.5, addebiti: [] };
      // storico: proforma emessi e in buona parte incassati
      for (const s of scadenze(inc, inizio, oggi)) {
        const anno = Number(s.data.slice(0, 4));
        const n = num[profilo][anno] = (num[profilo][anno] || 0) + 1;
        const vecchio = s.data < addDays(oggi, -45), recente = s.data > addDays(oggi, -10);
        const p = {
          id: `p-${iid}-${s.data}`, profilo, clienteId: id, incaricoId: iid, origine: s.chiave, stato: recente ? 'bozza' : 'emessa',
          numero: recente ? null : n, anno, data: s.data, scadenzaPagamento: addDays(s.data, 30), competenza: s.competenza, dataMandato: inc.dataMandato, qualita: inc.qualita,
          voci: [{ d: s.competenza, imp: s.importo }], anticipazioni: [], opz: clone(OPZIONI_BASE), forzati: {}, etichette: {}, diciture: [], forfettario: !!forf, ibanId: null, pagamenti: [],
        };
        if (forf) p.opz.rit.on = false;
        if (recente) num[profilo][anno]--;
        p.descr = PROFILI[profilo].descrizione.replace('{dataMandato}', inc.dataMandato.split('-').reverse().join('/')).replace('{qualita}', inc.qualita).replace('{cliente}', nome).replace('{competenza}', s.competenza);
        const tot = calcola(p).tot;
        p.totali = tot;
        if (!recente && (vecchio ? (i + n) % 7 !== 0 : (i + n) % 2 === 0)) p.pagamenti = [{ data: [addDays(s.data, 12 + ((i * 5 + n) % 40)), oggi].sort()[0], importo: tot.netto, metodo: 'Bonifico' }];
        db.proforma[p.id] = p;
      }
    });
  });
  for (const pr of ['anna', 'studio']) {
    const anno = new Date().getFullYear();
    db.profili[pr] = { id: pr, profilo: pr, numerazione: { anno, prossimo: (num[pr][anno] || 0) + 1 },
      iban: pr === 'anna'
        ? [{ id: 'ib1', banca: 'Intesa San Paolo sede di Bari', iban: 'IT00 X000 0000 0000 0000 0000 001', predefinito: true }]
        : [{ id: 'ib2', banca: 'BPP', iban: 'IT00 X000 0000 0000 0000 0000 002', predefinito: true }, { id: 'ib3', banca: 'Banca di prova', iban: 'IT00 X000 0000 0000 0000 0000 003', predefinito: false }] };
  }
  void iso;
}
