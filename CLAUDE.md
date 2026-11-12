# Studio Accogli — istruzioni di lavoro

Sito statico su GitHub Pages (`www.studioaccogli.it`), pubblicato dal ramo `main`. Il repository è pubblico.

## Regole per il CRM
- Si lavora **solo in `crm-test/`** (dati finti nel browser). `crm/` è la produzione con i dati veri dei clienti:
  si aggiorna esclusivamente con `tools/pubblica.sh`, **dopo l'approvazione esplicita dell'utente** per quella modifica.
- **Mai dati reali nel repository**: niente anagrafiche, IBAN, password o e-mail private. File con dati dei clienti
  vanno solo nello scratchpad e consegnati all'utente.
- Non accedere al CRM vero né chiedere credenziali: le modifiche si provano con i dati finti.
- Le regole in `firebase/firestore.rules` le incolla l'utente nella console Firebase: se cambiano, dirlo e consegnare il file.
  Devono restare allineate a `crm-test/js/data/utenti.js`.
- Tutto gratuito: niente servizi a pagamento (no Firebase Storage, no Cloud Functions).
- Interfaccia e testi in italiano; coerenza grafica con `/preferiti`. Rispondere all'utente in italiano, senza gergo tecnico.
- Aggiornare `VERSIONE` in `crm-test/js/config.js` a ogni modifica pubblicata.

## Pico Doc (app dei clienti)
- L'app è nel repository privato `Azzarina2026/picodoc` e ha un **progetto Firebase separato** («picodoc»):
  il database del CRM non viene mai aperto all'app. Il CRM è un «destinatario» di Pico Doc.
- File del CRM coinvolti: `js/data/picodoc.js` (collegamento), `js/domain/picodoc.js` (regole di sostituzione dei
  documenti, provate da `tools/collaudo/picodoc.mjs`), `js/views/arrivi.js` («Da Pico Doc»), riquadri in
  `js/views/clienti.js` e `js/views/impostazioni.js`, chiavi e tipi in `PICODOC` di `js/config.js`.
- Le regole di sicurezza di Pico Doc stanno nel repository picodoc (`firebase/firestore.rules`), non qui.
- Il CRM di prova usa il destinatario `studio-accogli-prova`, la produzione `studio-accogli`.

## Accesso all'ambiente di prova
`/crm-test/` apre su un accesso rapido: PIN `1990`, poi si sceglie l'utente da simulare (Super admin, Anna,
Studio Accogli). Esiste solo con i dati finti (`BACKEND === 'demo'`); in produzione non compare.

## Struttura e collaudi
Vedi `docs/ARCHITETTURA.md` (dove mettere le mani) e `docs/ATTIVAZIONE.md`.
Prima di proporre la pubblicazione: `python3 -m http.server 8765` dalla radice, poi
`node tools/collaudo/funzioni.js <cartella-immagini>` (flusso completo, dati finti; se Playwright non ha un suo
browser: `CHROME=/usr/bin/google-chrome NODE_PATH=$(npm root -g) node …`) e `node tools/collaudo/picodoc.mjs`.
Se cambiano regole o `js/data/firebase.js`: emulatore Firebase (`npm i firebase-tools`, auth+firestore su 9099/8080,
progetto `demo-crm`, regole con gli UID veri sostituiti da `uid-admin`/`uid-anna`/`uid-studio`) e `node tools/collaudo/regole.js`.
