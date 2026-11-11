/* I due "profili" che emettono proforma: Anna e Studio Accogli.
   Qui ci sono solo i valori di partenza presi dai modelli Word: tutto è poi modificabile
   da Impostazioni e viene salvato nel database (raccolta "profili").
   Nei testi: **grassetto**, //corsivo// e {segnaposto}. */
import { OPZIONI_BASE, DICITURE_BASE } from './calcolo.js';
import { clone } from '../core/util.js';

export const PROFILI = {
  anna: {
    id: 'anna', nome: 'Anna', modello: 'assets/modello-anna.docx',
    intestazione: { titolo: 'Anna Maria Accogli', sottotitolo: 'Dottore Commercialista', soci: [], linea: true },
    piede: [
      'Studio: Via Abate Gimma n° 3/b - in **BARI**  70122 -',
      'Tel. +39 0805576000   +39 0805573990   +39 3482238108',
      'C.F.: CCG NMR 59T46 D883G   -   P.IVA: 0352102 072 1',
      'e-mail: anna@studioaccogli.it - pec: annamaria.accogli@pec.commercialisti.it',
    ],
    titoloPrestazione: '//Prestazioni Professionali//',
    descrizione: 'Onorario ed indennità secondo quanto stabilito nel mandato conferitoci in data **{dataMandato}**, in qualità di {qualita} per la società: “**{cliente}**”**. competenza {competenza}**',
    qualita: 'consulenza fiscale e societaria',
    mostraCF: false,
    firma: ['Per Quietanza', 'Dr Anna Maria Accogli'],
    avvisoIban: 'Attenzione nuovo IBAN', avvisoIbanOn: true,
    rigaIban: '//{banca} IBAN: {iban}//',
  },
  studio: {
    id: 'studio', nome: 'Studio Accogli', modello: 'assets/modello-studio.docx',
    intestazione: { titolo: 'Studio Dr Anna Maria Accogli e Associati', sottotitolo: 'Dottori Commercialisti', soci: ['Dr Anna Maria Accogli', 'Dr Lucia Lella'], linea: false },
    piede: [
      'Studii in **Bari** 70121 – Via Abate Gimma , 3/B',
      'e-mail: staff@studioaccogli.it - annamaria.accogli@pec.commercialisti.it -',
      'Tel./Fax +39 0805576000 / +39 0805573990',
      'P.IVA – C.F.: 06799370728',
    ],
    titoloPrestazione: '**Prestazioni Professionali**',
    descrizione: 'Onorario ed indennità secondo quanto stabilito dalla tariffa dei Dottori Commercialisti Onorario **{competenza}**',
    qualita: '',
    mostraCF: true,
    firma: [],
    avvisoIban: 'Attenzione nuovo IBAN', avvisoIbanOn: true,
    rigaIban: 'Coordinate bancarie: {banca} – IBAN: {iban}',
  },
};
export const ID_PROFILI = Object.keys(PROFILI);

/* Impostazioni di un profilo = valori di partenza + ciò che è stato salvato. */
export function impostazioniProfilo(id, salvate = {}) {
  const base = clone(PROFILI[id]);
  return {
    ...base,
    iban: [],                                   // [{ id, banca, iban, predefinito }] — inseriti dagli utenti, mai nel codice
    numerazione: { anno: new Date().getFullYear(), prossimo: 1 },
    opz: clone(OPZIONI_BASE),
    diciture: [...DICITURE_BASE],
    ...salvate, id,
    intestazione: { ...base.intestazione, ...(salvate.intestazione || {}) },
  };
}
