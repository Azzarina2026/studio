/* Stato dell'applicazione in memoria + unico punto di accesso ai dati.
   Le schermate leggono da S e scrivono con salva()/elimina(): non parlano mai col backend. */
import { BACKEND } from '../config.js';
import { uid, today } from './util.js';
import { impostazioniProfilo, ID_PROFILI } from '../domain/profili.js';

export const S = { sessione: null, profilo: null, clienti: [], incarichi: [], spese: [], proforma: [], profili: {} };
export let be = null;
const RACCOLTE = ['clienti', 'incarichi', 'spese', 'proforma'];
const ascoltatori = new Set();
export const quandoCambia = f => ascoltatori.add(f);
export const avvisa = () => ascoltatori.forEach(f => f());

export async function avvia(suSessione) {
  be = (await import(BACKEND === 'demo' ? '../data/demo.js' : '../data/firebase.js')).backend;
  await be.avvia(async (s, errore = null) => {
    S.sessione = s;
    if (s && !s.cambiaPassword) { try { await carica(); } catch (e) { errore = e; } }
    suSessione(s, errore);
  });
}

export async function carica() {
  const [clienti, incarichi, spese, proforma, profili] = await Promise.all([...RACCOLTE, 'profili'].map(r => be.leggi(r)));
  Object.assign(S, { clienti, incarichi, spese, proforma });
  S.profili = {};
  for (const id of S.sessione.profili) S.profili[id] = impostazioniProfilo(id, profili.find(p => p.id === id));
  let pref = null; try { pref = localStorage.getItem('sa-crm-profilo'); } catch (e) {}
  S.profilo = S.sessione.profili.includes(pref) ? pref : S.sessione.profili[0];
}

export function scegliProfilo(id) { S.profilo = id; try { localStorage.setItem('sa-crm-profilo', id); } catch (e) {} avvisa(); }
export const admin = () => S.sessione?.ruolo === 'admin';
export const profilo = () => S.profili[S.profilo];

export async function salva(raccolta, obj, { silenzioso } = {}) {
  if (!obj.id) obj.id = uid();
  obj.agg = today();
  await be.salva(raccolta, obj.id, obj);
  if (raccolta === 'profili') S.profili[obj.id] = impostazioniProfilo(obj.id, obj);
  else { const i = S[raccolta].findIndex(x => x.id === obj.id); i < 0 ? S[raccolta].push(obj) : S[raccolta][i] = obj; }
  if (!silenzioso) avvisa();
  return obj;
}
export async function elimina(raccolta, id) {
  await be.elimina(raccolta, id);
  S[raccolta] = S[raccolta].filter(x => x.id !== id);
  avvisa();
}

/* Scorciatoie di lettura */
export const cliente = id => S.clienti.find(c => c.id === id);
export const clientiDi = (p = S.profilo, { inattivi = false } = {}) => S.clienti.filter(c => c.profili.includes(p) && (inattivi || c.stato?.[p]?.attivo !== false));
export const diProfilo = (raccolta, p = S.profilo) => S[raccolta].filter(x => x.profilo === p);
export { ID_PROFILI };
