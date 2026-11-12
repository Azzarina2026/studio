/* Configurazione. L'ambiente si decide dall'indirizzo della pagina, così il codice di
   /crm-test/ e quello di /crm/ sono identici e la pubblicazione è una semplice copia.

   /crm/       → PRODUZIONE: dati veri su Firebase, accesso con password.
   altrove     → PROVA: dati finti che restano solo nel browser di chi prova. */
export const VERSIONE = '2026-11-12 · 1';

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
