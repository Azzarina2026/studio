# CRM Studio Accogli — com'è fatto e come si modifica

Sito statico (GitHub Pages), nessun passaggio di compilazione: HTML, CSS e moduli JavaScript.
Dati e login su Firebase (piano gratuito). Nessuna dipendenza esterna a parte l'SDK Firebase
e JSZip (copiato in `vendor/`).

## Ambienti

| Indirizzo | Dati | Scopo |
|---|---|---|
| `/crm-test/` | finti, nel browser di chi prova | provare funzioni e modifiche |
| `/crm/` | veri, su Firebase, con login | uso quotidiano |

Il codice delle due cartelle è **identico**: è l'indirizzo a scegliere l'ambiente (`js/config.js`).
Si lavora sempre in `crm-test/`; dopo l'approvazione `tools/pubblica.sh` copia in `crm/`.

## Riservatezza: chi vede cosa

- Il repository è pubblico e contiene **solo codice**: nessun dato dei clienti, nessun IBAN, nessuna password.
- I dati veri stanno nel database Firebase e si leggono solo dopo il login. Chi modifica il codice
  (Claude compreso) non ha credenziali né accesso alla console, quindi non può leggerli.
- Le modifiche si provano su `/crm-test/` con dati finti: non serve mai guardare quelli veri.
- La protezione è nelle regole `firebase/firestore.rules`, eseguite sui server Google: il codice del sito non può aggirarle.

## Struttura

```
crm-test/
  index.html            guscio della pagina + politica di sicurezza dei contenuti (CSP)
  css/app.css           interfaccia (stessi colori e caratteri di /preferiti)
  css/foglio.css        il foglio A4 del proforma (anteprima = stampa)
  js/config.js          ambiente, chiavi pubbliche Firebase, limiti
  js/main.js            accesso, menu, navigazione; elenco PAGINE
  js/core/              util (importi, date) · ui (componenti) · stato (dati in memoria) · allegati
  js/domain/            REGOLE DELLO STUDIO, senza interfaccia:
     calcolo.js           formule del proforma e diciture
     scadenze.js          piano dei compensi, adeguamenti, competenze
     profili.js           testi e valori di partenza di Anna e Studio Accogli
     servizi.js           bozze automatiche, emissione, incassi, promemoria
  js/data/              demo.js (prova) e firebase.js (vero): stessa interfaccia
  js/views/             una schermata per file
  js/export/            foglio.js (anteprima e PDF) · word.js (.docx dai modelli originali)
  assets/               logo e modelli Word dello studio
firebase/firestore.rules   regole di sicurezza
tools/pubblica.sh          messa in produzione
tools/collaudo/            collaudi automatici (regole e funzioni)
```

### Dove mettere le mani

| Voglio cambiare… | File |
|---|---|
| una formula o un'aliquota di partenza | `js/domain/calcolo.js` |
| le cadenze dei compensi o il testo della competenza | `js/domain/scadenze.js` |
| intestazione, piè di pagina, testi dei modelli | `js/domain/profili.js` (poi modificabili da Impostazioni) |
| l'aspetto del proforma | `css/foglio.css`, `js/export/foglio.js`, `js/export/word.js` |
| una schermata | `js/views/…` |
| aggiungere una schermata | nuovo file in `js/views/` + una riga in `PAGINE` (`js/main.js`) |
| aggiungere un utente | `js/data/utenti.js` + `firebase/firestore.rules` |
| aggiungere un profilo | `js/domain/profili.js` + elenco profili nelle regole |

## Dati

| Raccolta | Contenuto | Visibilità |
|---|---|---|
| `crm_clienti` | anagrafica, `profili` (chi lo vede), `stato[profilo]` (attivo, codice ditta), note, documenti, antiriciclaggio | profili del cliente; anagrafica modificabile solo dal super admin |
| `crm_clienti/{id}/file` | allegati, a pezzi da 700 KB | come il cliente; il mandato solo al profilo proprietario |
| `crm_incarichi` | mandato e compenso pattuito | un solo profilo |
| `crm_spese` | spese anticipate e addebiti | un solo profilo |
| `crm_proforma` | proforma, incassi | un solo profilo |
| `crm_profili` | IBAN, numerazione, testi | un solo profilo |
| `crm_utenti` | solo «password cambiata» | il singolo utente |
| `crm_portale` | riservata alla futura app clienti | chiusa |

Un cliente in comune è **una sola scheda** con `profili: ['anna','studio']`: anagrafica, documenti,
antiriciclaggio e note sono condivisi; incarichi, compensi, spese e proforma restano separati.

### Predisposizione per la futura app clienti

- Ogni documento ha il campo `fonte` (`manuale` oggi, `app` domani).
- Ogni cliente ha `portale: { abilitato }`.
- La raccolta `crm_portale` è riservata ai caricamenti dei clienti: l'app scriverà lì (in attesa di
  conferma) e il CRM li porterà nella scheda. Servirà aprire nelle regole solo quella raccolta.

## Limiti noti del piano gratuito

- Database: 1 GB complessivi, allegati compresi. Ogni allegato può pesare al massimo 4 MB
  (le foto vengono alleggerite da sole).
- Le bozze automatiche e i promemoria si generano quando qualcuno apre il CRM (non c'è un server che lavora di notte).

## Collaudi

```
python3 -m http.server 8765                      # dalla radice del repository
node tools/collaudo/funzioni.js <cartella-immagini>   # flusso completo sui dati finti
# regole di sicurezza: avviare l'emulatore Firebase (auth + firestore) con firestore.rules
# in cui UID_SUPER_ADMIN/UID_ANNA/UID_STUDIO sono sostituiti da uid-admin/uid-anna/uid-studio, poi:
node tools/collaudo/regole.js
```
