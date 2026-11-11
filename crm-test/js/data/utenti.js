/* Chi può entrare nel CRM vero e con quale ruolo.
   Le chiavi sono gli identificativi (UID) che Firebase assegna agli account: non sono segreti
   e non permettono l'accesso da soli. Lo stesso elenco è ripetuto in firebase/firestore.rules,
   che è ciò che protegge davvero i dati: questo file serve solo all'interfaccia.

   Per aggiungere un utente: crearne l'account, poi aggiungere qui e nelle regole il suo UID. */
export const UTENTI = {
  // 'UID_SUPER_ADMIN': { nome: 'Super admin', ruolo: 'admin', profili: ['anna', 'studio'] },
  // 'UID_ANNA': { nome: 'Anna', ruolo: 'utente', profili: ['anna'] },
  // 'UID_STUDIO': { nome: 'Studio Accogli', ruolo: 'utente', profili: ['studio'] },
};

/* Account finti usati solo con l'emulatore locale durante i collaudi. */
export const UTENTI_EMULATORE = {
  'uid-admin': { nome: 'Super admin', ruolo: 'admin', profili: ['anna', 'studio'] },
  'uid-anna': { nome: 'Anna', ruolo: 'utente', profili: ['anna'] },
  'uid-studio': { nome: 'Studio Accogli', ruolo: 'utente', profili: ['studio'] },
};
