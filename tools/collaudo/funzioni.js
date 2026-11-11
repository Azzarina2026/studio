// Collaudo funzionale in ambiente di prova (dati finti): flusso completo cliente → incarico → proforma → emissione → incasso → Word.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const S = process.argv[2];
let ok = 0, ko = 0;
const check = (n, c, x = '') => { c ? ok++ : ko++; console.log((c ? 'OK   ' : 'FAIL ') + n + (c ? '' : '  ' + x)); };
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1380, height: 900 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const U = 'http://localhost:8765/crm-test/';
  await pg.goto(U); await pg.click('text=Entra come Studio Accogli'); await pg.waitForSelector('text=Primo');
  const i = await pg.$$('input[type=password]'); await i[0].fill('prova123'); await i[1].fill('NuovaPassword!2026'); await i[2].fill('NuovaPassword!2026');
  await pg.click('text=Imposta la nuova password'); await pg.waitForSelector('.guscio');
  check('utente Studio non vede la voce Super admin', !(await pg.$('nav >> text=Super admin')));
  check('utente Studio non vede il selettore profilo', !(await pg.$('.lato .seg')));
  // nuovo cliente
  await pg.goto(U + '#/clienti'); await pg.click('text=Nuovo cliente');
  await pg.fill('dialog input[type=text] >> nth=0', 'Azienda Collaudo S.r.l.');
  const campi = await pg.$$('dialog input[type=text]');
  await campi[1].fill('09999990721'); await campi[3].fill('COLL123'); await campi[4].fill('555');
  await campi[6].fill('Via del Collaudo 1'); await campi[7].fill('70100 Bari');
  await pg.click('dialog >> text=Aggiungi'); await pg.waitForSelector('h1:has-text("Azienda Collaudo")');
  check('cliente creato e scheda aperta', true);
  check('utente normale non ha Modifica/Elimina anagrafica', !(await pg.$('.testa >> text=Elimina')));
  // incarico trimestrale con prima scadenza nel passato e bozze dal passato
  await pg.click('text=Incarichi e compensi'); await pg.click('text=Nuovo incarico');
  await pg.fill('dialog input[type=date] >> nth=0', '2025-01-10');
  await pg.fill('dialog input.num', '1350');
  await pg.fill('dialog input[type=date] >> nth=1', '2026-06-30');
  await pg.fill('dialog input[type=date] >> nth=3', '2026-06-01');
  await pg.click('dialog >> text=Salva'); await pg.waitForSelector('text=Prossime scadenze');
  check('incarico salvato con prossime scadenze', (await pg.textContent('.card >> nth=0')).includes('1.350,00'));
  // spesa anticipata
  await pg.click('text=Spese anticipate'); await pg.click('text=Nuova spesa');
  await pg.fill('dialog input.num', '75,115'); await pg.fill('dialog input[type=text] >> nth=1', 'Diritti camerali');
  await pg.click('dialog >> text=Salva'); await pg.waitForSelector('td:has-text("Diritti camerali")');
  // rientro: le bozze automatiche vengono generate all'avvio
  await pg.reload(); await pg.waitForSelector('.guscio'); await pg.waitForTimeout(600);
  await pg.goto(U + '#/proforma'); await pg.fill('input[type=search]', 'Collaudo'); await pg.waitForTimeout(300);
  const righe = await pg.$$('table tbody tr');
  check('bozze automatiche generate per le scadenze maturate (30/06 e 30/09)', righe.length === 2, 'righe=' + righe.length);
  await pg.click('table tbody tr >> nth=1'); await pg.waitForSelector('.foglio');
  let foglio = await pg.textContent('.foglio');
  check('competenza calcolata: Secondo Trimestre Anno 2026', foglio.includes('Secondo Trimestre Anno 2026'), foglio.slice(0, 600));
  // aggiunge la spesa e verifica i conti dell'Excel: 1350 → magg 54 → imponibile 1404 → IVA 308,88 → antic 75,12 → totale 1788,00 → rit 270 → netto 1518,00
  await pg.click('.editor label:has-text("Diritti camerali") input'); await pg.waitForTimeout(300);
  foglio = await pg.textContent('.foglio');
  for (const v of ['1.350,00', '54,00', '1.404,00', '308,88', '75,12', '1.788,00', '270,00', '1.518,00']) check('importo in tabella: ' + v, foglio.includes(v));
  // forfettario: sparisce la ritenuta e compare la dicitura in giallo
  await pg.click('.editor label:has-text("regime forfettario") input'); await pg.waitForTimeout(300);
  foglio = await pg.textContent('.foglio');
  check('forfettario: dicitura presente', foglio.includes('Regime Forfettario – Non si Applica R.A.'));
  check('forfettario: ritenuta tolta', !foglio.includes("Ritenuta d'Acconto"));
  check('forfettario: evidenziata in giallo', await pg.$eval('.f-forf span', e => getComputedStyle(e).backgroundColor) === 'rgb(255, 255, 0)');
  await pg.click('.editor label:has-text("regime forfettario") input'); await pg.waitForTimeout(300);
  // correzione manuale di una cifra direttamente sul foglio
  const cella = pg.locator('.f-tab tr.calc >> nth=0').locator('td.imp span'); await cella.click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('60'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  check('cifra corretta a mano ricalcola i totali', (await pg.textContent('.foglio')).includes('1.410,00'));
  await pg.click('text=correzioni manuali'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: S + '/20-editor.png', fullPage: true });
  // emissione: due IBAN → chiede quale
  await pg.click('.testa >> text=Emetti'); await pg.waitForSelector('dialog >> text=Su quale IBAN');
  check('con due IBAN viene chiesto quale usare', true);
  await pg.selectOption('dialog select', { index: 1 }); await pg.click('dialog >> text=Usa questo IBAN'); await pg.waitForSelector('h1:has-text("n°")');
  const titolo = await pg.textContent('h1');
  check('numero assegnato all’emissione', /n° \d+\/2026/.test(titolo), titolo);
  check('IBAN scelto nel documento', (await pg.textContent('.foglio')).replace(/\u00a0/g, ' ').includes('0000 003'));
  // Word
  const b64 = await pg.evaluate(async () => { const st = await import('/crm-test/js/core/stato.js'); const w = await import('/crm-test/js/export/word.js'); const p = st.S.proforma.find(x => x.numero && st.cliente(x.clienteId)?.nome.includes('Collaudo')); const blob = await w.documentoWord(p, st.S.profili[p.profilo], st.cliente(p.clienteId)); const a = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of a) s += String.fromCharCode(x); return btoa(s); });
  fs.writeFileSync(S + '/proforma-studio.docx', Buffer.from(b64, 'base64'));
  check('file Word generato', b64.length > 100000);
  // incasso
  await pg.click('text=Segna come saldata'); await pg.waitForTimeout(1200);
  check('proforma segnato come saldato', (await pg.textContent('.testa')).includes('Saldata'));
  // spesa risulta recuperata
  await pg.goto(U + '#/clienti'); await pg.fill('input[type=search]', 'Collaudo'); await pg.click('table tbody tr'); await pg.click('text=Spese anticipate');
  check('spesa anticipata risulta recuperata', (await pg.textContent('table')).includes('Recuperata'));
  // disattivazione: sparisce dall'elenco
  await pg.click('.testa >> text=Disattiva'); await pg.waitForTimeout(400); await pg.goto(U + '#/clienti'); await pg.fill('input[type=search]', 'Collaudo'); await pg.waitForTimeout(300);
  check('cliente disattivato non compare in elenco', !(await pg.$('table tbody tr')));
  await pg.click('text=Mostra disattivati'); await pg.waitForTimeout(300);
  check('ricompare con «Mostra disattivati»', !!(await pg.$('table tbody tr')));
  // stampa: anteprima con media print
  await pg.goto(U + '#/proforma'); await pg.fill('input[type=search]', 'Collaudo'); await pg.waitForTimeout(300); await pg.click('table tbody tr >> nth=0'); await pg.waitForSelector('.foglio');
  await pg.evaluate(async () => { const st = await import('/crm-test/js/core/stato.js'); const f = await import('/crm-test/js/export/foglio.js'); const p = st.S.proforma.find(x => x.numero && st.cliente(x.clienteId)?.nome.includes('Collaudo')); document.getElementById('stampa').replaceChildren(f.foglio(p, st.S.profili[p.profilo], st.cliente(p.clienteId))); });
  await pg.waitForTimeout(400);
  await pg.pdf({ path: S + '/proforma-studio.pdf', format: 'A4', printBackground: true });
  // admin: condivisione e duplicati; versione telefono
  const tel = await b.newPage({ ...devices['iPhone 13'] }); await tel.goto(U); await tel.click('text=Entra come Anna'); await tel.waitForSelector('text=Primo');
  const j = await tel.$$('input[type=password]'); await j[0].fill('prova123'); await j[1].fill('NuovaPassword!2026'); await j[2].fill('NuovaPassword!2026'); await tel.click('text=Imposta la nuova password'); await tel.waitForSelector('.guscio'); await tel.waitForTimeout(500);
  await tel.screenshot({ path: S + '/21-telefono.png' });
  check('telefono: nessuno scorrimento orizzontale', await tel.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await tel.goto(U + '#/clienti/c1'); await tel.waitForTimeout(400); await tel.screenshot({ path: S + '/22-telefono-cliente.png' });
  console.log(errs.length ? 'ERRORI CONSOLE:\n' + errs.join('\n') : 'nessun errore in console');
  console.log(`\n${ok} superati, ${ko} falliti`); await b.close();
})().catch(e => { console.error('ERRORE COLLAUDO', e.message.slice(0, 600)); process.exit(2); });
