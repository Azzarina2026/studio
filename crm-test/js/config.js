/* Configurazione. L'ambiente si decide dall'indirizzo della pagina, così il codice di
   /crm-test/ e quello di /crm/ sono identici e la pubblicazione è una semplice copia.

   /crm/       → PRODUZIONE: dati veri su Firebase, accesso con password.
   altrove     → PROVA: dati finti che restano solo nel browser di chi prova. */
export const VERSIONE = '2026-11-12 · 3';

const percorso = location.pathname;
export const AMBIENTE = /\/crm(\/|\/index\.html)?$/.test(percorso) ? 'produzione' : 'prova';
const locale = ['localhost', '127.0.0.1'].includes(location.hostname);
const richiesto = new URLSearchParams(location.search).get('backend');
/* l'emulatore Firebase si può usare solo in locale, mai dal sito pubblicato */
export const BACKEND = AMBIENTE === 'produzione' ? 'firebase' : (locale && richiesto === 'emulatore' ? 'emulatore' : 'demo');

/* Chiavi pubbliche del progetto Firebase (le stesse di /preferiti). Non sono segrete:
   la protezione dei dati sta nelle regole in firebase/firestore.rules e nel login. */
export const FIREBASE = {
  apiKey: 'AIzaSyAuGkzP4SbAZsLfxsaQ1Ywqa5TObVjON5Y',
  authDomain: 'studio-accogli.firebaseapp.com',
  projectId: 'studio-accogli',
  messagingSenderId: '807923308877',
  appId: '1:807923308877:web:0bb527b4acf420a092ff04',
};
export const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const LIMITI = {
  fileMax: 4 * 1024 * 1024,        // dimensione massima di un allegato
  parte: 700 * 1024,               // gli allegati sono salvati a pezzi nel database (piano gratuito, senza Storage)
  inattivitaMin: 30,               // uscita automatica dopo minuti di inattività
  avvisiGiorni: [60, 30, 7],       // promemoria scadenza documenti
};

/* Pico Doc: l'app con cui i clienti scansionano e inviano i documenti (progetto Firebase separato «picodoc").
   Chiavi pubbliche, non segrete: la protezione è nelle regole del progetto Pico Doc.
   Il CRM di prova usa un destinatario separato, così le prove non si mescolano con i documenti veri. */
export const PICODOC = {
  config: {
    apiKey: 'AIzaSyCfUyY82qNAR7zwwB35MAQoy5uU6TenzVk',
    authDomain: 'picodoc-941b0.firebaseapp.com',
    projectId: 'picodoc-941b0',
    messagingSenderId: '709731503646',
    appId: '1:709731503646:web:831ccc46f9b26fd152280f',
  },
  destinatario: AMBIENTE === 'produzione' ? 'studio-accogli' : 'studio-accogli-prova',
  nome: AMBIENTE === 'produzione' ? 'Studio Accogli' : 'Studio Accogli (prova)',
  invitoGiorni: 14,
  /* tipi di documento di Pico Doc → voce dell'elenco «Tipo di documento» del CRM */
  tipi: [
    ['carta_identita', 'Carta d’identità'], ['passaporto', 'Passaporto'], ['patente', 'Patente'],
    ['tessera_sanitaria', 'Tessera sanitaria / codice fiscale'], ['permesso_soggiorno', 'Permesso di soggiorno'],
    ['visura_camerale', 'Visura camerale'], ['durc', 'DURC'], ['contratto_affitto', 'Contratto'],
    ['certificato_residenza', 'Altro', 'Certificato di residenza'], ['f24', 'Altro', 'F24 / quietanza'],
    ['bolletta', 'Altro', 'Bolletta / utenza'], ['altro', 'Altro', 'Altro documento'],
  ],
};
