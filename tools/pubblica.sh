#!/usr/bin/env bash
# Porta in produzione (/crm/) la versione approvata di /crm-test/.
# Il codice è identico: è l'indirizzo della pagina a decidere se usare dati finti o veri.
# Da eseguire SOLO dopo l'approvazione esplicita.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f crm-test/index.html ] || { echo "crm-test non trovato"; exit 1; }
grep -q "^  // 'UID" crm-test/js/data/utenti.js && { echo "ATTENZIONE: in utenti.js non ci sono ancora gli account veri (vedi docs/ATTIVAZIONE.md)"; exit 1; }
rsync -a --delete crm-test/ crm/
echo "Copiato crm-test → crm. Ora: git add crm && git commit && git push"
