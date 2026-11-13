# Gmail: logo dello studio senza sfondo

Estensione per Chrome (e per Edge, Brave e gli altri browser basati su Chromium) che toglie il riquadro
bianco dietro il logo dello studio nell'intestazione di Gmail, accanto alla foto profilo.

È un solo foglio di stile, attivo soltanto su `https://mail.google.com/`. Non chiede permessi, non legge
la posta e non invia nulla.

## Installazione

1. Scaricare `gmail-logo-trasparente.zip` (nella cartella `estensioni/`) ed estrarlo in una cartella che
   non verrà spostata né cancellata, per esempio `Documenti/Estensioni/gmail-logo-trasparente`.
2. In Chrome aprire `chrome://extensions`.
3. Attivare **Modalità sviluppatore** in alto a destra.
4. Premere **Carica estensione non pacchettizzata** e scegliere la cartella estratta.
5. Ricaricare la scheda di Gmail.

Per tutto lo studio, senza installarla a mano su ogni computer: dalla Console di amministrazione di Google
(Dispositivi → Chrome → App ed estensioni) si può imporre l'installazione, ma l'estensione va prima
pubblicata sul Chrome Web Store, anche come «non in elenco».

## Limiti

- Funziona solo nei browser in cui è installata: non nell'app Gmail del telefono e non per chi riceve la posta.
- Se Google cambia la struttura dell'intestazione di Gmail può servire un aggiornamento.
- Senza il riquadro bianco, un logo blu scuro si legge male sul tema scuro: conviene un logo a mezzo tono.

## Se il riquadro bianco rimane

In Gmail: tasto destro sul riquadro bianco → **Ispeziona**. Nel pannello che si apre, scheda **Elementi**,
passare il mouse sulle righe attorno a quella evidenziata finché si illumina proprio il riquadro bianco.
Poi tasto destro su quella riga → **Copia → Copia outerHTML**, e dalla scheda **Calcolato** (Computed)
annotare i valori di `background-color`, `background-image` e `box-shadow`. Con questi due dati
l'estensione si corregge in pochi minuti.
