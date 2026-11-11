# Attivazione del CRM vero (`/crm/`)

Finché questi passaggi non sono completati, `/crm/` resta il segnaposto e si lavora solo su
`/crm-test/` (dati finti, salvati nel browser di chi prova).

Tutti i passaggi si fanno nella [console Firebase](https://console.firebase.google.com/) del
progetto **studio-accogli**. Restano nel piano gratuito (Spark): non serve carta di credito.

## 1. Attivare il login

1. **Authentication → Inizia**.
2. Scheda **Metodo di accesso → Email/Password → Abilita** (lasciare spento «Link via email»).

A questo punto avvisare Claude: creerà i tre account con una password temporanea ciascuno
(Anna, Studio Accogli, Super admin) e inserirà i loro identificativi nel codice e nelle regole.
Le password temporanee vanno cambiate al primo accesso: da quel momento le conosce solo chi le ha scelte.

## 2. Chiudere le registrazioni

Dopo che gli account sono stati creati:

- **Authentication → Impostazioni → Azioni utente**: togliere la spunta a **«Abilita creazione (registrazione)»**
  e attivare la **protezione dall'enumerazione degli indirizzi e-mail**.
- **Authentication → Impostazioni → Domini autorizzati**: lasciare solo `www.studioaccogli.it`,
  `studioaccogli.it` e i due domini `studio-accogli.*` già presenti; rimuovere `localhost`.

## 3. Pubblicare le regole di sicurezza

1. **Firestore Database → Regole**: copiare il testo attuale e inviarlo a Claude (serve a non
   rompere la pagina `/preferiti`, che usa lo stesso database).
2. Claude prepara `firebase/firestore.rules` completo; incollarlo al posto delle regole attuali e premere **Pubblica**.

Il CRM controlla da solo a ogni avvio che il database rifiuti le letture senza login:
se le regole non sono attive si blocca e mostra un avviso rosso.

## 4. Verifica in due passaggi per il super admin (Google Authenticator)

Richiede due interventi una tantum sul progetto, da fare insieme:

1. **Authentication → Impostazioni → «Esegui l'upgrade a Identity Platform»** (gratuito entro le soglie del piano Spark).
2. Abilitare il metodo TOTP nel progetto (un comando da Google Cloud Shell, che forniremo al momento).

Poi, nel CRM: **Impostazioni → Accesso → Attiva la verifica in due passaggi**.
Questa funzione è scritta ma **non ancora collaudata sul progetto vero**: la proviamo insieme prima di considerarla attiva.

## 5. Consigliato: limitare la chiave web

Google Cloud Console → API e servizi → Credenziali → chiave «Browser key»: in **Restrizioni applicazione**
scegliere «Siti web» e indicare `https://www.studioaccogli.it/*` e `https://studioaccogli.it/*`.

## 6. Messa in produzione

Dopo l'approvazione della versione di prova: `tools/pubblica.sh` copia `crm-test/` in `crm/`.
