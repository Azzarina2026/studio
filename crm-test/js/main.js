/* Avvio, accesso, struttura della pagina e navigazione.
   Ogni schermata è un modulo in js/views/ che esporta una funzione: per aggiungerne una
   basta scriverla e registrarla nell'elenco PAGINE qui sotto. */
import { AMBIENTE, BACKEND, VERSIONE, LIMITI } from './config.js';
import { S, be, avvia, quandoCambia, scegliProfilo, admin, ID_PROFILI } from './core/stato.js';
import { h, icona, btn, toast, errore, modulo, chiedi } from './core/ui.js';
import { PROFILI } from './domain/profili.js';
import { generaBozze, avvisi } from './domain/servizi.js';

const PAGINE = [
  { id: 'cruscotto', nome: 'Cruscotto', ic: 'casa', carica: () => import('./views/cruscotto.js') },
  { id: 'clienti', nome: 'Clienti', ic: 'persone', carica: () => import('./views/clienti.js') },
  { id: 'proforma', nome: 'Proforma', ic: 'doc', carica: () => import('./views/proforma.js') },
  { id: 'arrivi', nome: 'Da Pico Doc', ic: 'graffetta', carica: () => import('./views/arrivi.js') },
  { id: 'scadenze', nome: 'Scadenze', ic: 'campana', carica: () => import('./views/scadenze.js'), badge: () => avvisi().filter(a => a.livello === 'rosso').length },
  { id: 'impostazioni', nome: 'Impostazioni', ic: 'ingranaggio', carica: () => import('./views/impostazioni.js') },
  { id: 'admin', nome: 'Super admin', ic: 'scudo', carica: () => import('./views/admin.js'), solo: admin },
];
const app = document.getElementById('app');
const provaBanner = () => AMBIENTE === 'prova' ? h('div.prova-banner', BACKEND === 'demo' ? 'AMBIENTE DI PROVA — dati finti, salvati solo in questo browser' : 'AMBIENTE DI PROVA — emulatore locale') : null;

/* ---------- accesso ---------- */
function schermataAccesso(msg) {
  const m = modulo([
    { k: 'email', label: 'Nome utente (e-mail)', tipo: 'email', richiesto: true, auto: 'username' },
    { k: 'pw', label: 'Password', tipo: 'password', richiesto: true, auto: 'current-password' },
  ]);
  let codice = null;
  const stato = h('div.avviso' + (msg ? '.rosso' : ''), { hidden: !msg, role: 'alert' }, msg || '');
  const entra = async (email, pw) => {
    stato.hidden = true; pulsante.disabled = true; pulsante.textContent = 'Accesso…';
    try { await be.entra(email, pw, codice?.value.trim()); }
    catch (e) {
      if (e.code === 'serve-codice' && !codice) { codice = h('input', { type: 'text', inputMode: 'numeric', maxLength: 6, autocomplete: 'one-time-code', placeholder: 'Codice a 6 cifre', 'aria-label': 'Codice Authenticator' }); m.el.append(h('div.campo', h('label', 'Codice dell’app Authenticator'), codice)); codice.focus(); }
      stato.hidden = false; stato.className = 'avviso' + (e.code === 'serve-codice' ? '' : ' rosso'); stato.textContent = e.message; pulsante.disabled = false; pulsante.textContent = 'Accedi';
    }
  };
  const pulsante = btn('Accedi', () => { const d = m.leggi(); if (d) entra(d.email, d.pw); }, { tipo: 'primary' });
  m.el.addEventListener('keydown', e => { if (e.key === 'Enter') pulsante.click(); });
  const rapidi = BACKEND === 'demo' ? import('./data/demo.js').then(({ ACCESSI_PROVA, backend }) => {
    box.append(h('div.rapidi', h('small.dim', 'Solo in prova: entra con un clic, oppure usa nome utente (es. anna@prova) e password «prova123».'),
      ACCESSI_PROVA.map(a => btn('Entra come ' + a.nome, () => backend.entraRapido(a.email))),
      btn('Azzera i dati di prova', () => { backend.azzera(); location.reload(); }, { tipo: 'danger' })));
  }) : null;
  void rapidi;
  const box = h('div.card',
    h('div.brand', h('div.mark', h('span', 'SA')), h('h1', 'Studio ', h('b', 'Accogli')), h('p', 'CRM · accesso riservato')),
    stato, m.el, pulsante);
  app.replaceChildren(provaBanner() || '', h('div.accesso', box));
  m.el.querySelector('input').focus();
}

const forzaPw = pw => (pw.length >= 12 ? 1 : 0) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0) + (pw.length >= 16 ? 1 : 0);
const controllaPw = pw => pw.length < 12 ? 'Almeno 12 caratteri' : forzaPw(pw) < 4 ? 'Usa maiuscole, minuscole, numeri e un simbolo' : '';
export const campiPassword = () => [
  { k: 'attuale', label: 'Password attuale', tipo: 'password', richiesto: true, auto: 'current-password' },
  { k: 'nuova', label: 'Nuova password', tipo: 'password', richiesto: true, auto: 'new-password', valida: controllaPw, aiuto: 'Almeno 12 caratteri con maiuscole, minuscole, numeri e un simbolo.' },
  { k: 'ripeti', label: 'Ripeti la nuova password', tipo: 'password', richiesto: true, auto: 'new-password' },
];
function schermataCambioPassword() {
  const m = modulo(campiPassword());
  const barra = h('div.forza', h('i'));
  m.campi[1].inp.addEventListener('input', e => { const f = forzaPw(e.target.value); barra.firstChild.style.width = f * 20 + '%'; barra.firstChild.style.background = f >= 4 ? 'var(--ok)' : f >= 2 ? 'var(--s3)' : 'var(--danger)'; });
  m.campi[1].campo.append(barra);
  const stato = h('div.avviso.rosso', { hidden: true, role: 'alert' });
  const ok = btn('Imposta la nuova password', async () => {
    const d = m.leggi(); if (!d) return;
    if (d.nuova !== d.ripeti) { stato.hidden = false; stato.textContent = 'Le due password nuove non coincidono.'; return; }
    if (d.nuova === d.attuale) { stato.hidden = false; stato.textContent = 'La nuova password deve essere diversa da quella temporanea.'; return; }
    ok.disabled = true;
    try { await be.cambiaPassword(d.attuale, d.nuova); toast('Password aggiornata'); }
    catch (e) { stato.hidden = false; stato.textContent = e.message; ok.disabled = false; }
  }, { tipo: 'primary' });
  app.replaceChildren(provaBanner() || '', h('div.accesso', h('div.card',
    h('div.brand', h('div.mark', h('span', 'SA')), h('h1', 'Primo ', h('b', 'accesso'))),
    h('p.testo', `Ciao ${S.sessione.nome}. Stai usando una password temporanea: scegline una personale per continuare. Nessun altro potrà vederla.`),
    stato, m.el, ok, btn('Esci', () => be.esci()))));
}

/* ---------- struttura ---------- */
let contenitore, corrente = '';
function selettoreProfilo(extra = '') {
  if (S.sessione.profili.length < 2) return null;
  return h('div.seg' + extra, { role: 'group', 'aria-label': 'Profilo di lavoro' }, S.sessione.profili.map(id =>
    h('button', { type: 'button', 'aria-pressed': String(S.profilo === id), onclick: () => scegliProfilo(id) }, PROFILI[id].nome)));
}
function guscio() {
  const pag = rotta().pagina;
  return h('div.guscio',
    h('aside.lato',
      h('div.brand', h('div.mark.sm', h('span', 'SA')), h('div', h('b', 'Studio Accogli'), h('small', 'CRM'))),
      h('div.seg-wrap', { style: { padding: '0 4px 10px' } }, selettoreProfilo()),
      h('nav.nav', { 'aria-label': 'Sezioni' }, PAGINE.filter(p => !p.solo || p.solo()).map(p => {
        const n = p.badge?.() || 0;
        return h('a', { href: '#/' + p.id, 'aria-current': pag === p.id ? 'page' : null }, icona(p.ic, 19), h('span', p.nome), n ? h('span.badge', { 'aria-label': n + ' avvisi urgenti' }, n) : null);
      })),
      h('div.fondo',
        h('div.utente', h('div.chi', h('b', S.sessione.nome), admin() ? 'Super admin' : 'Utente'),
          h('div.azioni',
            h('button.icbtn', { type: 'button', title: 'Tema chiaro / scuro', 'aria-label': 'Cambia tema', onclick: cambiaTema }, icona('sole')),
            h('button.icbtn', { type: 'button', title: 'Esci', 'aria-label': 'Esci', onclick: () => be.esci() }, icona('esci')))),
        h('span.ver', 'Versione ' + VERSIONE))),
    contenitore = h('main.principale', { id: 'contenuto' }));
}
function cambiaTema() {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sa-theme', t); } catch (e) {}
}
export const testata = (titolo, azioni = [], { indietro } = {}) => h('div', indietro && h('a.indietro', { href: indietro[0] }, icona('freccia', 14), indietro[1]),
  h('div.testa', h('h1', titolo), h('div.azioni', selettoreProfilo('.seg-mobile'), azioni)));

const rotta = () => { const [pagina = 'cruscotto', ...resto] = location.hash.replace(/^#\/?/, '').split('/'); return { pagina: pagina || 'cruscotto', resto }; };
export const vai = hash => { location.hash = hash; };

async function disegna() {
  if (!S.sessione || S.sessione.cambiaPassword) return;
  const { pagina, resto } = rotta();
  const p = PAGINE.find(x => x.id === pagina && (!x.solo || x.solo())) || PAGINE[0];
  const y = corrente === location.hash ? scrollY : 0;
  corrente = location.hash;
  app.replaceChildren(provaBanner() || '', guscio());
  try { contenitore.replaceChildren((await p.carica()).vista(resto)); }
  catch (e) { contenitore.replaceChildren(h('div.avviso.rosso', 'Errore nella schermata: ' + e.message)); console.error(e); }
  scrollTo(0, y);
}
addEventListener('hashchange', disegna);
quandoCambia(disegna);

/* ---------- uscita automatica per inattività ---------- */
let timer;
const sveglia = () => { clearTimeout(timer); if (S.sessione) timer = setTimeout(() => { be.esci(); setTimeout(() => toast('Sessione chiusa per inattività', 'err'), 300); }, LIMITI.inattivitaMin * 60000); };
['pointerdown', 'keydown', 'scroll'].forEach(ev => addEventListener(ev, sveglia, { passive: true }));

avvia(async (s, err) => {
  sveglia();
  if (!s && err?.code === 'regole-aperte') { app.replaceChildren(h('div.accesso', h('div.card', h('div.avviso.rosso', { role: 'alert' }, err.message)))); return; }
  if (!s) return schermataAccesso(err?.message);
  if (s.cambiaPassword) return schermataCambioPassword();
  if (err) { app.replaceChildren(h('div.accesso', h('div.card', h('div.avviso.rosso', 'Impossibile leggere i dati: ' + err.message), btn('Esci', () => be.esci())))); return; }
  try { const n = await generaBozze(); if (n) toast(n === 1 ? 'Creata 1 bozza di proforma in scadenza' : `Create ${n} bozze di proforma in scadenza`); } catch (e) { errore(e); }
  disegna();
}).catch(e => { app.replaceChildren(h('div.accesso', h('div.card', h('div.avviso.rosso', 'Avvio non riuscito: ' + e.message)))); console.error(e); });

export { chiedi, ID_PROFILI };
