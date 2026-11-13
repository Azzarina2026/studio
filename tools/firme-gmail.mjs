#!/usr/bin/env node
/* Aggiorna in Gmail la firma di ogni persona elencata in firme/firme.js.
   Lo lancia la GitHub Action .github/workflows/firme-gmail.yml a ogni modifica delle firme su main.

   Come funziona: un «account di servizio» Google con delega a livello di dominio (Google Workspace)
   agisce per conto di ogni casella e chiama l'API Gmail users.settings.sendAs.patch.
   Nessuna libreria esterna: serve solo Node 22.

   Variabili d'ambiente:
     GOOGLE_SERVICE_ACCOUNT_JSON  contenuto del file JSON della chiave (segreto GitHub)
     FIRMA_GMAIL                  "completa" (predefinita) o "compatta": quale versione impostare
     SOLO_PROVA=1                 non scrive niente in Gmail: mostra solo cosa farebbe
     SOLO_INDIRIZZI               (facoltativo) aggiorna solo questi indirizzi, separati da virgola

   Uso locale per controllo:  SOLO_PROVA=1 node tools/firme-gmail.mjs */

import {createSign} from 'node:crypto';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const {FIRME, completa, compatta} = await import(pathToFileURL(join(radice, 'firme', 'firme.js')));

const SCOPE = 'https://www.googleapis.com/auth/gmail.settings.basic';
const versione = (process.env.FIRMA_GMAIL || 'completa').trim().toLowerCase();
const genera = {completa, compatta}[versione];
if (!genera) { console.error(`FIRMA_GMAIL deve essere "completa" o "compatta", non "${versione}".`); process.exit(1); }

const solo = (process.env.SOLO_INDIRIZZI || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const sconosciuti = solo.filter(x => !FIRME.some(p => p.email.toLowerCase() === x));
if (sconosciuti.length) { console.error(`SOLO_INDIRIZZI: nessuna firma per ${sconosciuti.join(', ')}. Indirizzi disponibili: ${FIRME.map(p => p.email).join(', ')}.`); process.exit(1); }
const persone = FIRME.filter(p => solo.length ? solo.includes(p.email.toLowerCase()) : p.automatica !== false);
const chiaveJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const prova = process.env.SOLO_PROVA === '1' || !chiaveJson;

// Copia delle firme generate, utile come allegato della Action e per controllo.
const uscita = join(process.env.RUNNER_TEMP || tmpdir(), 'firme-generate');
mkdirSync(uscita, {recursive: true});
for (const p of persone) writeFileSync(join(uscita, `${p.email}.html`), genera(p));

if (prova) {
  if (!chiaveJson) console.log('::warning::Segreto GOOGLE_SERVICE_ACCOUNT_JSON non impostato: nessuna firma aggiornata in Gmail (vedi la guida di configurazione).');
  for (const p of persone) console.log(`[prova] ${p.gmail || p.email} → firma «${versione}» su ${p.email} (${genera(p).length} caratteri)`);
  process.exit(0);
}

let chiave;
try { chiave = JSON.parse(chiaveJson); }
catch { console.error('GOOGLE_SERVICE_ACCOUNT_JSON non è un JSON valido: incolla nel segreto tutto il contenuto del file scaricato.'); process.exit(1); }

const b64url = x => Buffer.from(x).toString('base64url');

/* Token di accesso «a nome di» una casella (delega a livello di dominio). */
async function token(utente){
  const ora = Math.floor(Date.now() / 1000);
  const testa = b64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const corpo = b64url(JSON.stringify({iss: chiave.client_email, sub: utente, scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: ora, exp: ora + 3600}));
  const firma = createSign('RSA-SHA256').update(`${testa}.${corpo}`).sign(chiave.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${testa}.${corpo}.${firma}`})
  });
  const d = await r.json();
  if (!r.ok) {
    const aiuto = d.error === 'unauthorized_client'
      ? ' (delega a livello di dominio mancante o con ID client/ambito sbagliati nella Console di amministrazione)'
      : d.error === 'invalid_grant' ? ' (casella inesistente nel dominio, chiave revocata o account di servizio cancellato)' : '';
    throw new Error(`accesso negato per ${utente}: ${d.error} ${d.error_description || ''}${aiuto}`);
  }
  return d.access_token;
}

async function gmail(metodo, utente, indirizzo, tk, corpo){
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(utente)}/settings/sendAs/${encodeURIComponent(indirizzo)}`;
  const r = await fetch(url, {method: metodo, headers: {Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json'},
    body: corpo ? JSON.stringify(corpo) : undefined});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gmail ${metodo} ${indirizzo}: ${r.status} ${d.error?.message || ''}`);
  return d;
}

let errori = 0;
for (const p of persone) {
  const utente = p.gmail || p.email;
  try {
    const tk = await token(utente);
    const nuova = genera(p);
    const attuale = await gmail('GET', utente, p.email, tk);
    if ((attuale.signature || '') === nuova) { console.log(`= ${p.email}: firma già aggiornata`); continue; }
    await gmail('PATCH', utente, p.email, tk, {signature: nuova});
    console.log(`✓ ${p.email}: firma «${versione}» aggiornata`);
  } catch (e) {
    errori++;
    console.log(`::error::${p.email}: ${e.message}`);
  }
}
process.exit(errori ? 1 : 0);
