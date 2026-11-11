/* Backend di PROVA: tutto resta nel browser (localStorage), con dati finti.
   Stessa interfaccia di firebase.js, così l'applicazione non sa quale dei due sta usando.
   Applica anche le stesse regole di visibilità (ogni utente vede solo i propri profili). */
import { uid, clone } from '../core/util.js';
import { semina } from './demo-seme.js';

const K = 'sa-crm-prova', KS = 'sa-crm-prova-sessione';
const UTENTI = {
  'anna@prova':   { uid: 'u-anna',   nome: 'Anna',           ruolo: 'utente', profili: ['anna'] },
  'studio@prova': { uid: 'u-studio', nome: 'Studio Accogli', ruolo: 'utente', profili: ['studio'] },
  'admin@prova':  { uid: 'u-admin',  nome: 'Super admin',    ruolo: 'admin',  profili: ['anna', 'studio'] },
};
export const ACCESSI_PROVA = Object.keys(UTENTI).map(email => ({ email, nome: UTENTI[email].nome }));
const PW_INIZIALE = 'prova123';

let db, sessione = null, ascolta = () => {};
const leggiDb = () => { try { return JSON.parse(localStorage.getItem(K)); } catch (e) { return null; } };
const scrivi = () => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) { throw new Error('Spazio di prova esaurito nel browser: azzera i dati di prova.'); } };
const vede = d => !sessione ? false : d.profili ? d.profili.some(p => sessione.profili.includes(p)) : d.profilo ? sessione.profili.includes(d.profilo) : true;
const attesa = () => new Promise(r => setTimeout(r, 60));

export const backend = {
  nome: 'demo',
  async avvia(cb) {
    ascolta = cb;
    db = leggiDb() || nuovo();
    const email = sessionStorage.getItem(KS);
    sessione = email && UTENTI[email] ? crea(email) : null;
    cb(sessione);
  },
  async entra(email, pw) {
    await attesa();
    email = String(email).trim().toLowerCase();
    const u = UTENTI[email];
    if (!u || (db.pw[email] || PW_INIZIALE) !== pw) throw new Error('Nome utente o password non corretti.');
    sessionStorage.setItem(KS, email);
    ascolta(sessione = crea(email));
  },
  async entraRapido(email) { sessionStorage.setItem(KS, email); ascolta(sessione = crea(email)); },
  async esci() { sessionStorage.removeItem(KS); ascolta(sessione = null); },
  async cambiaPassword(attuale, nuova) {
    await attesa();
    if ((db.pw[sessione.email] || PW_INIZIALE) !== attuale) throw new Error('La password attuale non è corretta.');
    db.pw[sessione.email] = nuova; scrivi();
    ascolta(sessione = crea(sessione.email));
  },
  async leggi(raccolta) { await attesa(); return clone(Object.values(db[raccolta] || {}).filter(vede)); },
  async salva(raccolta, id, dati) {
    const prima = db[raccolta][id];
    if (prima && !vede(prima)) throw new Error('Accesso negato.');
    if (raccolta === 'clienti' && sessione.ruolo !== 'admin' && prima) {
      // come nelle regole: l'utente normale non modifica l'anagrafica
      const liberi = ['stato', 'note', 'documenti', 'aml', 'agg'];
      for (const k of new Set([...Object.keys(prima), ...Object.keys(dati)])) if (!liberi.includes(k) && JSON.stringify(prima[k]) !== JSON.stringify(dati[k])) throw new Error('Solo il super admin può modificare l’anagrafica.');
    }
    db[raccolta][id] = clone({ ...dati, id }); scrivi();
  },
  async elimina(raccolta, id) {
    if (raccolta === 'clienti' && sessione.ruolo !== 'admin') throw new Error('Solo il super admin può eliminare un cliente.');
    delete db[raccolta][id]; scrivi();
  },
  async fileSalva(clienteId, meta, blob) {
    const id = uid();
    db.file[id] = { ...meta, id, clienteId, dati: await dataUrl(blob) }; scrivi();
    return id;
  },
  async fileLeggi(clienteId, id) {
    const f = db.file[id];
    if (!f) throw new Error('Allegato non trovato.');
    return await (await fetch(f.dati)).blob();
  },
  async fileElimina(clienteId, id) { delete db.file[id]; scrivi(); },
  azzera() { localStorage.removeItem(K); sessionStorage.removeItem(KS); },
};

function crea(email) { const u = UTENTI[email]; return { ...u, email, cambiaPassword: !db.pw[email] }; }
function nuovo() { const d = { clienti: {}, incarichi: {}, spese: {}, proforma: {}, profili: {}, file: {}, pw: {} }; semina(d); return d; }
const dataUrl = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
