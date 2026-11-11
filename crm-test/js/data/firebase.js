/* Backend VERO: Firebase Authentication + Firestore (piano gratuito, nessun servizio a pagamento).
   Stessa interfaccia di demo.js. La sicurezza non sta qui ma nelle regole (firebase/firestore.rules):
   anche modificando questo file nessuno può leggere dati che le regole non gli concedono. */
import { FIREBASE, FB_SDK, BACKEND, LIMITI } from '../config.js';
import { UTENTI, UTENTI_EMULATORE } from './utenti.js';
import { uid } from '../core/util.js';

const EMU = BACKEND === 'emulatore';
const elenco = EMU ? UTENTI_EMULATORE : UTENTI;
const R = r => 'crm_' + r;
let A, F, auth, db, sessione = null, ascolta = () => {}, inSospeso = null, rifiuto = null;

const MESSAGGI = {
  'auth/invalid-credential': 'Nome utente o password non corretti.', 'auth/wrong-password': 'Nome utente o password non corretti.', 'auth/user-not-found': 'Nome utente o password non corretti.',
  'auth/invalid-email': 'Nome utente non valido.', 'auth/too-many-requests': 'Troppi tentativi: riprova tra qualche minuto.', 'auth/network-request-failed': 'Connessione assente.',
  'auth/user-disabled': 'Account disattivato.', 'auth/weak-password': 'Password troppo debole.', 'auth/requires-recent-login': 'Per sicurezza esci, rientra e riprova.',
  'auth/invalid-verification-code': 'Codice non corretto.', 'auth/unverified-email': 'Prima conferma il tuo indirizzo e-mail dal messaggio che ti abbiamo inviato.',
  'permission-denied': 'Accesso negato dalle regole di sicurezza.', 'unavailable': 'Servizio non raggiungibile: controlla la connessione.',
};
const tradotto = e => Object.assign(new Error(MESSAGGI[e?.code] || e?.message || String(e)), { code: e?.code });
const prova = async f => { try { return await f(); } catch (e) { throw tradotto(e); } };

async function leggiStato(u) {
  const info = elenco[u.uid];
  if (!info) throw new Error('Questo account non è abilitato al CRM.');
  const s = await F.getDoc(F.doc(db, 'crm_utenti', u.uid));
  return { uid: u.uid, email: u.email, ...info, cambiaPassword: !(s.exists() && s.data().pwCambiata === true), dueFattori: A.multiFactor(u).enrolledFactors.length > 0, emailVerificata: u.emailVerified };
}

export const backend = {
  nome: 'firebase',
  async avvia(cb) {
    ascolta = cb;
    const [app, a, f] = await Promise.all(['app', 'auth', 'firestore'].map(m => import(`${FB_SDK}firebase-${m}.js`)));
    A = a; F = f;
    const istanza = app.initializeApp(EMU ? { ...FIREBASE, projectId: 'demo-crm', apiKey: 'emulatore' } : FIREBASE, 'crm');
    auth = A.getAuth(istanza); db = F.getFirestore(istanza);
    if (EMU) { A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); F.connectFirestoreEmulator(db, '127.0.0.1', 8080); }
    await A.setPersistence(auth, A.browserSessionPersistence);     // chiudendo il browser si esce
    await new Promise(pronto => {
      let primo = true;
      A.onAuthStateChanged(auth, async u => {
        try {
          if (!u) { await sonda(); sessione = null; const e = rifiuto; rifiuto = null; cb(null, e); }
          else { sessione = await leggiStato(u); cb(sessione); }
        } catch (e) {
          sessione = null;
          if (auth.currentUser) { rifiuto = tradotto(e); await A.signOut(auth); }   // l'avviso viene mostrato appena l'uscita è completata
          else cb(null, tradotto(e));
        }
        if (primo) { primo = false; pronto(); }
      });
    });
  },
  /* se serve il codice dell'app Authenticator l'errore ha code 'serve-codice': richiamare entra() con il codice */
  async entra(email, pw, codice) {
    return prova(async () => {
      if (codice && inSospeso) { const r = inSospeso; await r.resolveSignIn(A.TotpMultiFactorGenerator.assertionForSignIn(r.hints[0].uid, codice)); inSospeso = null; return; }
      try { await A.signInWithEmailAndPassword(auth, String(email).trim(), pw); }
      catch (e) {
        if (e.code !== 'auth/multi-factor-auth-required') throw e;
        inSospeso = A.getMultiFactorResolver(auth, e);
        throw Object.assign(new Error('Inserisci il codice a 6 cifre dell’app Authenticator.'), { code: 'serve-codice' });
      }
    });
  },
  async esci() { await A.signOut(auth); },
  async cambiaPassword(attuale, nuova) {
    return prova(async () => {
      const u = auth.currentUser;
      // prima di toccare la password verifica che le regole del CRM siano pubblicate, altrimenti il cambio resterebbe a metà
      try { await F.getDoc(F.doc(db, 'crm_utenti', u.uid)); } catch (e) { throw new Error('Le regole di sicurezza del CRM non sono ancora state pubblicate nella console Firebase: la password non è stata cambiata.'); }
      await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, attuale));
      await A.updatePassword(u, nuova);
      await F.setDoc(F.doc(db, 'crm_utenti', u.uid), { pwCambiata: true, quando: new Date().toISOString() });
      ascolta(sessione = await leggiStato(u));
    });
  },
  /* verifica in due passaggi (richiede l'attivazione TOTP nel progetto: vedi docs/ATTIVAZIONE.md) */
  async verificaEmail() { return prova(() => A.sendEmailVerification(auth.currentUser)); },
  async totpInizia() {
    return prova(async () => {
      const u = auth.currentUser; await u.reload();
      if (!u.emailVerified) throw { code: 'auth/unverified-email' };
      const segreto = await A.TotpMultiFactorGenerator.generateSecret(await A.multiFactor(u).getSession());
      return { chiave: segreto.secretKey, uri: segreto.generateQrCodeUrl(u.email, 'CRM Studio Accogli'), conferma: codice => prova(() => A.multiFactor(u).enroll(A.TotpMultiFactorGenerator.assertionForEnrollment(segreto, codice), 'Authenticator')) };
    });
  },

  async leggi(raccolta) {
    return prova(async () => {
      if (raccolta === 'profili') return (await Promise.all(sessione.profili.map(p => F.getDoc(F.doc(db, R('profili'), p))))).filter(d => d.exists()).map(d => ({ ...d.data(), id: d.id }));
      // una richiesta per profilo: così le regole possono verificare che ogni risultato sia lecito
      const campo = raccolta === 'clienti' ? p => F.where('profili', 'array-contains', p) : p => F.where('profilo', '==', p);
      const gruppi = await Promise.all(sessione.profili.map(p => F.getDocs(F.query(F.collection(db, R(raccolta)), campo(p)))));
      const mappa = new Map();
      gruppi.forEach(g => g.forEach(d => mappa.set(d.id, { ...d.data(), id: d.id })));
      return [...mappa.values()];
    });
  },
  async salva(raccolta, id, dati) { return prova(() => F.setDoc(F.doc(db, R(raccolta), id), JSON.parse(JSON.stringify({ ...dati, id })))); },
  async elimina(raccolta, id) { return prova(() => F.deleteDoc(F.doc(db, R(raccolta), id))); },

  async fileSalva(clienteId, meta, blob) {
    return prova(async () => {
      const id = uid(), dati = new Uint8Array(await blob.arrayBuffer()), n = Math.max(1, Math.ceil(dati.length / LIMITI.parte));
      const base = F.doc(db, R('clienti'), clienteId, 'file', id);
      await F.setDoc(base, { ...meta, parti: n, creato: new Date().toISOString(), da: sessione.uid });
      for (let i = 0; i < n; i++) await F.setDoc(F.doc(base, 'parti', String(i).padStart(3, '0')), { d: F.Bytes.fromUint8Array(dati.subarray(i * LIMITI.parte, (i + 1) * LIMITI.parte)) });
      return id;
    });
  },
  async fileLeggi(clienteId, id) {
    return prova(async () => {
      const parti = await F.getDocs(F.collection(db, R('clienti'), clienteId, 'file', id, 'parti'));
      if (parti.empty) throw new Error('Allegato non trovato.');
      return new Blob(parti.docs.sort((a, b) => a.id < b.id ? -1 : 1).map(d => d.data().d.toUint8Array()));
    });
  },
  async fileElimina(clienteId, id) {
    return prova(async () => {
      const base = F.doc(db, R('clienti'), clienteId, 'file', id);
      const parti = await F.getDocs(F.collection(base, 'parti'));
      await Promise.all(parti.docs.map(d => F.deleteDoc(d.ref)));
      await F.deleteDoc(base);
    });
  },
};

/* Controllo di sicurezza all'avvio: senza login il database DEVE rifiutare la lettura.
   Se risponde, le regole non sono state attivate e il CRM si ferma. */
async function sonda() {
  try { await F.getDoc(F.doc(db, 'crm_clienti', 'sonda')); }
  catch (e) { if (e.code === 'permission-denied') return; if (e.code === 'unavailable') return; throw e; }
  throw Object.assign(new Error('ATTENZIONE: le regole di sicurezza del database non sono attive. Il CRM resta bloccato finché non vengono pubblicate (vedi docs/ATTIVAZIONE.md).'), { code: 'regole-aperte' });
}
