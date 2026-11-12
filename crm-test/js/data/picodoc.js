/* Collegamento con Pico Doc (progetto Firebase «picodoc», separato da quello del CRM).
   Il CRM è un «destinatario»: genera codici invito per le schede dei clienti e ritira i documenti
   che i clienti inviano dall'app. Le regole di sicurezza stanno nel repository di Pico Doc
   (firebase/firestore.rules): qui nulla può aggirarle. Accesso con email e password del destinatario. */
import { FB_SDK, PICODOC } from '../config.js';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
let A, F, auth, db, avviato = null;

const MESSAGGI = {
  'auth/invalid-credential': 'Email o password non corretti.', 'auth/wrong-password': 'Email o password non corretti.',
  'auth/user-not-found': 'Email o password non corretti.', 'auth/email-already-in-use': 'Esiste già un account Pico Doc con questa email: usa «Entra».',
  'auth/weak-password': 'La password deve avere almeno 8 caratteri.', 'auth/invalid-email': 'Email non valida.',
  'auth/network-request-failed': 'Connessione assente.', 'auth/too-many-requests': 'Troppi tentativi: riprova tra qualche minuto.',
  'permission-denied': 'Operazione non permessa dalle regole di Pico Doc.', 'unavailable': 'Pico Doc non raggiungibile: controlla la connessione.',
};
const tradotto = e => Object.assign(new Error(MESSAGGI[e?.code]
  || (/dynamically imported|Failed to fetch/.test(e?.message) ? 'Pico Doc non raggiungibile: controlla la connessione e riprova.' : e?.message || String(e))), { code: e?.code });
const prova = async f => { try { await avvia(); return await f(); } catch (e) { throw tradotto(e); } };

async function avvia() {
  avviato ??= (async () => {
    try {
    const [app, a, f] = await Promise.all(['app', 'auth', 'firestore'].map(m => import(`${FB_SDK}firebase-${m}.js`)));
    A = a; F = f;
    const istanza = app.getApps().find(x => x.name === 'picodoc') || app.initializeApp(PICODOC.config, 'picodoc');
    auth = A.getAuth(istanza);
    await A.setPersistence(auth, A.browserSessionPersistence);     // chiudendo il browser si esce anche da Pico Doc
    db = F.getFirestore(istanza);
    await new Promise(pronto => { const stop = A.onAuthStateChanged(auth, () => { stop(); pronto(); }); });
    } catch (e) { avviato = null; throw e; }     // al prossimo tentativo si riprova da capo
  })();
  return avviato;
}

const rifDest = () => F.doc(db, 'destinatari', PICODOC.destinatario);

export const pd = {
  /** { utente: {email, verificata} | null, destinatario: {nome, tipi, membri} | null, membro: bool } */
  async stato() {
    return prova(async () => {
      const u = auth.currentUser;
      if (!u) return { utente: null, destinatario: null, membro: false };
      const s = await F.getDoc(rifDest());
      const d = s.exists() ? s.data() : null;
      return { utente: { email: u.email, verificata: u.emailVerified }, destinatario: d, membro: !!d?.membri?.includes(u.uid) };
    });
  },
  entra: (email, pw) => prova(() => A.signInWithEmailAndPassword(auth, String(email).trim(), pw)),
  async creaAccount(email, pw) {
    return prova(async () => {
      if (String(pw).length < 8) throw Object.assign(new Error(), { code: 'auth/weak-password' });
      const r = await A.createUserWithEmailAndPassword(auth, String(email).trim(), pw);
      await A.sendEmailVerification(r.user);
    });
  },
  inviaVerifica: () => prova(() => A.sendEmailVerification(auth.currentUser)),
  /* dopo aver aperto il link di conferma: rilegge l'account e rinnova il permesso con «email verificata» */
  ricarica: () => prova(async () => { await auth.currentUser?.reload(); await auth.currentUser?.getIdToken(true); }),
  esci: () => prova(() => A.signOut(auth)),
  /* Quando si esce dal CRM si esce anche da Pico Doc, senza caricare nulla se non era stato usato. */
  async esciConIlCrm() {
    try {
      if (avviato) { await avviato; if (auth.currentUser) await A.signOut(auth); }
      Object.keys(sessionStorage).filter(k => k.startsWith('firebase:authUser:' + PICODOC.config.apiKey)).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* niente da chiudere */ }
  },

  /* Attiva lo studio come destinatario (o aggiorna i tipi di documento accettati). */
  async attiva(tipi) {
    return prova(async () => {
      const s = await F.getDoc(rifDest());
      if (s.exists()) await F.updateDoc(rifDest(), { tipi });
      else await F.setDoc(rifDest(), { nome: PICODOC.nome, tipi, membri: [auth.currentUser.uid], creato: F.serverTimestamp() });
    });
  },

  /* Nuovo codice invito per una scheda cliente: monouso, valido PICODOC.invitoGiorni giorni. */
  async creaInvito(scheda, etichetta) {
    return prova(async () => {
      for (let tentativo = 0; tentativo < 5; tentativo++) {
        const caso = crypto.getRandomValues(new Uint32Array(8));
        const codice = Array.from(caso, n => ALFABETO[n % ALFABETO.length]).join('');
        const rif = F.doc(db, 'inviti', codice);
        if ((await F.getDoc(rif)).exists()) continue;
        const scade = new Date(Date.now() + PICODOC.invitoGiorni * 86400000);
        await F.setDoc(rif, { destinatario: PICODOC.destinatario, scheda, etichetta: String(etichetta).slice(0, 120),
          scade: F.Timestamp.fromDate(scade), usato: false, creatoDa: auth.currentUser.uid, creato: F.serverTimestamp() });
        return { codice, scade };
      }
      throw new Error('Non sono riuscito a generare un codice: riprova.');
    });
  },

  /* Utenti dell'app collegati a una scheda (possono essere più di uno). */
  async collegati(scheda) {
    return prova(async () => {
      const q = F.query(F.collection(db, 'collegamenti'), F.where('destinatario', '==', PICODOC.destinatario), F.where('scheda', '==', scheda));
      return (await F.getDocs(q)).docs.map(d => ({ id: d.id, utente: d.data().utente, email: d.data().email, creato: d.data().creato?.toDate?.() }));
    });
  },
  scollega: id => prova(() => F.deleteDoc(F.doc(db, 'collegamenti', id))),

  /* Documenti inviati dai clienti e non ancora ritirati. */
  async inArrivo() {
    return prova(async () => {
      const q = F.query(F.collection(db, 'invii'), F.where('destinatario', '==', PICODOC.destinatario));
      return (await F.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data(), creato: d.data().creato?.toDate?.() }))
        .sort((a, b) => (b.creato || 0) - (a.creato || 0));
    });
  },

  /* Scarica il PDF ricomponendo le parti. */
  async scarica(invio) {
    return prova(async () => {
      const parti = (await F.getDocs(F.collection(db, 'invii', invio.id, 'parti'))).docs
        .sort((a, b) => Number(a.id) - Number(b.id)).map(d => d.data().d.toUint8Array());
      return new Blob(parti, { type: 'application/pdf' });
    });
  },

  /* Cancella l'invio da Pico Doc (dopo averlo portato nella scheda, oppure se rifiutato). */
  async cancella(invio) {
    return prova(async () => {
      const b = F.writeBatch(db);
      for (let n = 0; n < (invio.parti || 1); n++) b.delete(F.doc(db, 'invii', invio.id, 'parti', String(n)));
      b.delete(F.doc(db, 'invii', invio.id));
      await b.commit();
    });
  },
};
