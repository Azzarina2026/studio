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

## Struttura e collaudi
Vedi `docs/ARCHITETTURA.md` (dove mettere le mani) e `docs/ATTIVAZIONE.md`.
Prima di proporre la pubblicazione: `python3 -m http.server 8765` dalla radice, poi
`node tools/collaudo/funzioni.js <cartella-immagini>` (flusso completo, dati finti).
Se cambiano regole o `js/data/firebase.js`: emulatore Firebase (`npm i firebase-tools`, auth+firestore su 9099/8080,
progetto `demo-crm`, regole con gli UID veri sostituiti da `uid-admin`/`uid-anna`/`uid-studio`) e `node tools/collaudo/regole.js`.
