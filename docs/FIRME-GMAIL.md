# Firme Gmail aggiornate in automatico

Quando cambia qualcosa in `firme/` sul ramo `main`, la GitHub Action **Firme Gmail**
(`.github/workflows/firme-gmail.yml`) imposta da sola la firma in Gmail di ogni persona elencata in `FIRME`
dentro `firme/firme.js`. La pagina `/firme/` usa gli stessi dati, quindi anteprima e Gmail restano uguali.

Finché il segreto `GOOGLE_SERVICE_ACCOUNT_JSON` non c'è, la Action non tocca Gmail: lo dice con un avviso e finisce senza errori.

## Configurazione una tantum (amministratore Google Workspace)

1. **Progetto Google Cloud.** Su <https://console.cloud.google.com>, entrando con l'account amministratore del dominio,
   crea un progetto (per esempio `firme-studio`). È gratuito.
2. **API Gmail.** Nel progetto: *API e servizi → Libreria → Gmail API → Abilita*.
3. **Account di servizio.** *IAM e amministrazione → Account di servizio → Crea account di servizio*,
   nome `firme-gmail`. Non servono ruoli: *Continua* e *Fine*.
4. **Chiave JSON.** Apri l'account appena creato → scheda *Chiavi → Aggiungi chiave → Crea nuova chiave → JSON*.
   Si scarica un file `.json`: è la password dell'automatismo, non inviarlo per e-mail.
   Se compare «La creazione di chiavi per account di servizio è disattivata», vai in
   *IAM e amministrazione → Criteri dell'organizzazione*, cerca «Disable service account key creation»
   (`iam.disableServiceAccountKeyCreation`), *Gestisci criterio → Sostituisci criterio dell'elemento padre → Non applicare*
   e salva (serve il ruolo «Amministratore criteri dell'organizzazione»), poi riprova.
5. **ID client.** Nella scheda *Dettagli* dell'account di servizio copia l'**ID univoco** (un numero di circa 21 cifre).
6. **Delega a livello di dominio.** Su <https://admin.google.com>: *Sicurezza → Accesso e controllo dei dati →
   Controlli API → Gestisci delega a livello di dominio → Aggiungi nuovo*.
   - ID client: il numero del punto 5
   - Ambiti OAuth: `https://www.googleapis.com/auth/gmail.settings.basic`
   - *Autorizza*. Può servire qualche minuto (a volte fino a un'ora) prima che funzioni.
7. **Segreto su GitHub.** Nel repository: *Settings → Secrets and variables → Actions → New repository secret*.
   - Name: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - Secret: tutto il contenuto del file `.json` (aprilo con un editor di testo, copia tutto, incolla).
   Poi cancella il file dal computer.
8. *(Facoltativo)* Per impostare la versione compatta invece della completa: stessa pagina, scheda *Variables*,
   variabile `FIRMA_GMAIL` = `compatta`.

## Caselle da aggiornare

Una persona = un oggetto in `FIRME` (`firme/firme.js`). `email` deve essere una casella vera del dominio
(un utente Workspace, non un gruppo). Se l'indirizzo è un alias di un altro account, aggiungi `gmail: 'account@studioaccogli.it'`.
Per escludere qualcuno dall'automatismo: `automatica: false`.

## Prova

GitHub → *Actions → Firme Gmail → Run workflow*: prima con «Solo prova» spuntato (non scrive nulla), poi senza.
Il registro mostra `✓ indirizzo: firma aggiornata` per ogni casella; le firme generate restano scaricabili come allegato dell'esecuzione.

## Limiti da sapere

- L'API di Gmail gestisce **una sola firma per indirizzo**: quella predefinita. Le firme con nome create a mano
  (per esempio una «Compatta» per le risposte) restano com'erano e non vengono aggiornate.
- L'ambito `gmail.settings.basic` non permette di leggere la posta, ma consente di cambiare le impostazioni di base
  di qualsiasi casella del dominio: per questo la chiave sta solo nei segreti di GitHub. Se si perde, si revoca
  dalla scheda *Chiavi* dell'account di servizio e se ne crea un'altra.
- Le immagini della firma sono servite da www.studioaccogli.it: devono restare pubblicate.
