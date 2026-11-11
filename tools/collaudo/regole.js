// Collaudo regole + backend Firebase contro l'emulatore locale.
const { chromium } = require('playwright');
const URL = 'http://localhost:8765/crm-test/?backend=emulatore';
const PW0 = 'Temporanea!123', PW1 = 'Definitiva!2026xyz';
let ok = 0, ko = 0;
const check = (nome, cond, extra = '') => { cond ? ok++ : ko++; console.log((cond ? 'OK   ' : 'FAIL ') + nome + (cond ? '' : '  ' + extra)); };

(async () => {
  // reset emulatori e creazione account
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-crm/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-crm/accounts', { method: 'DELETE' });
  for (const u of ['admin', 'anna', 'studio', 'intruso']) {
    const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-crm/accounts', { method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: 'uid-' + u, email: u + '@test.it', password: PW0, emailVerified: true }) });
    if (!r.ok) console.log('creazione account', u, r.status, await r.text());
  }
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const b = await chromium.launch({ proxy });
  const nuova = async () => { const c = await b.newContext({ bypassCSP: true, ignoreHTTPSErrors: true }); const p = await c.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message)); return p; };
  const entra = async (pg, chi, pw) => { await pg.goto(URL); await pg.waitForSelector('.accesso input[type=email]', { timeout: 30000 }); await pg.fill('input[type=email]', chi + '@test.it'); await pg.fill('input[type=password]', pw); await pg.click('text=Accedi'); };
  // esegue codice nella pagina con accesso ai moduli dell'app; restituisce 'OK' oppure il messaggio d'errore
  const run = (pg, corpo) => pg.evaluate(async (corpo) => {
    const st = await import('/crm-test/js/core/stato.js'); const be = st.be;
    try { const r = await (new Function('st', 'be', 'return (async () => {' + corpo + '})()'))(st, be); return r === undefined ? 'OK' : r; } catch (e) { return 'ERR ' + (e.code || '') + ' ' + e.message; }
  }, corpo);
  const negato = r => typeof r === 'string' && r.startsWith('ERR') && /permission-denied|Accesso negato/.test(r);

  // --- intruso: account esistente ma non in elenco ---
  let pg = await nuova(); await entra(pg, 'intruso', PW0);
  await pg.waitForSelector('.avviso.rosso:not([hidden])', { timeout: 15000 });
  check('account non in elenco respinto', /non è abilitato/.test(await pg.textContent('.avviso.rosso')));

  // --- anna ---
  const anna = await nuova(); await entra(anna, 'anna', PW0);
  await anna.waitForSelector('text=Primo', { timeout: 15000 });
  check('primo accesso: cambio password obbligatorio', true);
  check('prima del cambio password i dati sono negati', negato(await run(anna, `await be.leggi('clienti')`)), await run(anna, `await be.leggi('clienti')`));
  check('non si può creare un cliente prima del cambio password', negato(await run(anna, `await be.salva('clienti','x0',{nome:'X',profili:['anna']})`)));
  const i = await anna.$$('input[type=password]'); await i[0].fill(PW0); await i[1].fill(PW1); await i[2].fill(PW1);
  await anna.click('text=Imposta la nuova password'); await anna.waitForSelector('.guscio', { timeout: 15000 });
  check('dopo il cambio password si entra', true);
  check('anna crea cliente nel proprio profilo', await run(anna, `await st.salva('clienti',{id:'c1',nome:'Cliente Uno',piva:'111',profili:['anna'],stato:{anna:{attivo:true,codice:'10'}},note:[],documenti:[],aml:[]})`) === 'OK');
  check('anna NON crea cliente nel profilo studio', negato(await run(anna, `await be.salva('clienti','c2',{nome:'Z',profili:['studio']})`)));
  check('anna NON crea cliente condiviso', negato(await run(anna, `await be.salva('clienti','c3',{nome:'Z',profili:['anna','studio']})`)));
  check('anna aggiunge una nota', await run(anna, `const c=st.cliente('c1'); await st.salva('clienti',{...c,note:[{id:'n1',testo:'ciao'}]})`) === 'OK');
  check('anna disattiva il cliente per sé', await run(anna, `const c=st.cliente('c1'); await st.salva('clienti',{...c,stato:{anna:{attivo:false,codice:'10'}}})`) === 'OK');
  check('anna NON modifica anagrafica', negato(await run(anna, `const c=st.cliente('c1'); await be.salva('clienti','c1',{...c,nome:'Altro nome'})`)));
  check('anna NON si auto-condivide/cambia profili', negato(await run(anna, `const c=st.cliente('c1'); await be.salva('clienti','c1',{...c,profili:['anna','studio']})`)));
  check('anna NON tocca lo stato del profilo studio', negato(await run(anna, `const c=st.cliente('c1'); await be.salva('clienti','c1',{...c,stato:{...c.stato,studio:{attivo:true}}})`)));
  check('anna NON elimina clienti', negato(await run(anna, `await be.elimina('clienti','c1')`)));
  check('anna crea incarico proprio', await run(anna, `await st.salva('incarichi',{id:'i1',profilo:'anna',clienteId:'c1',oggetto:'x',compenso:{importo:100,periodicita:'mensile',prima:'2026-01-31'}})`) === 'OK');
  check('anna NON crea incarico per studio', negato(await run(anna, `await be.salva('incarichi','i2',{profilo:'studio',clienteId:'c1'})`)));
  check('anna NON sposta un proprio incarico a studio', negato(await run(anna, `await be.salva('incarichi','i1',{profilo:'studio',clienteId:'c1'})`)));
  check('anna salva proforma e spesa', await run(anna, `await st.salva('proforma',{id:'p1',profilo:'anna',clienteId:'c1',stato:'bozza',data:'2026-11-01',anno:2026,voci:[],pagamenti:[]}); await st.salva('spese',{id:'s1',profilo:'anna',clienteId:'c1',importo:5})`) === 'OK');
  check('anna salva le proprie impostazioni', await run(anna, `await be.salva('profili','anna',{numerazione:{anno:2026,prossimo:7}})`) === 'OK');
  check('anna NON legge/scrive impostazioni studio', negato(await run(anna, `await be.salva('profili','studio',{x:1})`)));
  check('anna NON si promuove (crm_utenti con campi extra)', negato(await run(anna, `const F=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'); const A=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'); const db=F.getFirestore(A.getApp('crm')); await F.setDoc(F.doc(db,'crm_utenti','uid-anna'),{pwCambiata:true,ruolo:'admin'})`)));
  check('anna NON scrive crm_utenti altrui', negato(await run(anna, `const F=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'); const A=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'); const db=F.getFirestore(A.getApp('crm')); await F.setDoc(F.doc(db,'crm_utenti','uid-studio'),{pwCambiata:true})`)));
  check('raccolte sconosciute negate', negato(await run(anna, `await be.salva('altro','z',{a:1})`)));
  const f1 = await run(anna, `const dati=new Uint8Array(1600000); for(let i=0;i<dati.length;i++) dati[i]=i%251; const id=await be.fileSalva('c1',{nome:'mandato.pdf',tipo:'application/pdf',dim:dati.length,ambito:'anna'},new Blob([dati])); const b=new Uint8Array(await (await be.fileLeggi('c1',id)).arrayBuffer()); if(b.length!==dati.length||b[1599999]!==dati[1599999]||b[700001]!==dati[700001]) throw new Error('contenuto diverso'); return 'ID:'+id`);
  check('allegato da 1,6 MB salvato a pezzi e riletto identico', String(f1).startsWith('ID:'), f1);
  const f2 = await run(anna, `const id=await be.fileSalva('c1',{nome:'ci.jpg',tipo:'image/jpeg',dim:3,ambito:'condiviso'},new Blob([new Uint8Array([1,2,3])])); return 'ID:'+id`);
  check('allegato condiviso salvato', String(f2).startsWith('ID:'), f2);
  check('allegato oltre 4 MB rifiutato', negato(await run(anna, `await be.fileSalva('c1',{nome:'big',tipo:'x',dim:5000000,ambito:'condiviso'},new Blob([new Uint8Array(10)]))`)));
  check('allegato con ambito altrui rifiutato', negato(await run(anna, `await be.fileSalva('c1',{nome:'x',tipo:'x',dim:3,ambito:'studio'},new Blob([new Uint8Array(3)]))`)));

  // --- studio ---
  const studio = await nuova(); await entra(studio, 'studio', PW0); await studio.waitForSelector('text=Primo', { timeout: 15000 });
  const j = await studio.$$('input[type=password]'); await j[0].fill(PW0); await j[1].fill(PW1); await j[2].fill(PW1);
  await studio.click('text=Imposta la nuova password'); await studio.waitForSelector('.guscio', { timeout: 15000 });
  check('studio non vede i clienti di anna', await run(studio, `return (await be.leggi('clienti')).length`) === 0);
  check('studio non vede incarichi/proforma di anna', await run(studio, `return (await be.leggi('incarichi')).length + (await be.leggi('proforma')).length + (await be.leggi('spese')).length`) === 0);
  const diretto = (racc, id) => `const F=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'); const A=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'); const db=F.getFirestore(A.getApp('crm')); const d=await F.getDoc(F.doc(db,'${racc}','${id}')); return d.exists()?'LETTO':'vuoto'`;
  check('studio NON legge direttamente il cliente di anna', negato(await run(studio, diretto('crm_clienti', 'c1'))), await run(studio, diretto('crm_clienti', 'c1')));
  check('studio NON legge direttamente il proforma di anna', negato(await run(studio, diretto('crm_proforma', 'p1'))));
  check('studio NON legge tutta la raccolta clienti', negato(await run(studio, `const F=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'); const A=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'); const db=F.getFirestore(A.getApp('crm')); return (await F.getDocs(F.collection(db,'crm_clienti'))).size`)));
  check('studio NON legge gli allegati del cliente di anna', negato(await run(studio, `await be.fileLeggi('c1','${String(f2).slice(3)}')`)));
  check('studio NON modifica il proforma di anna', negato(await run(studio, `await be.salva('proforma','p1',{profilo:'studio'})`)));

  // --- admin ---
  const admin = await nuova(); await entra(admin, 'admin', PW0); await admin.waitForSelector('text=Primo', { timeout: 15000 });
  const k = await admin.$$('input[type=password]'); await k[0].fill(PW0); await k[1].fill(PW1); await k[2].fill(PW1);
  await admin.click('text=Imposta la nuova password'); await admin.waitForSelector('.guscio', { timeout: 15000 });
  check('admin vede il cliente', await run(admin, `return st.S.clienti.length`) === 1);
  check('admin modifica anagrafica e condivide con studio', await run(admin, `const c=st.cliente('c1'); await st.salva('clienti',{...c,nome:'Cliente Uno S.r.l.',profili:['anna','studio'],stato:{...c.stato,studio:{attivo:true,codice:'77'}}})`) === 'OK');
  check('ora studio vede il cliente condiviso', await run(studio, `const l=await be.leggi('clienti'); return l.length+':'+l[0].stato.studio.codice`) === '1:77');
  check('studio legge l’allegato condiviso', await run(studio, `return (await be.fileLeggi('c1','${String(f2).slice(3)}')).size`) === 3);
  check('studio NON legge il mandato di anna', negato(await run(studio, `await be.fileLeggi('c1','${String(f1).slice(3)}')`)), await run(studio, `await be.fileLeggi('c1','${String(f1).slice(3)}')`));
  check('studio continua a non vedere incarichi di anna', await run(studio, `return (await be.leggi('incarichi')).length`) === 0);
  check('studio aggiorna il proprio codice ditta', await run(studio, `const c=(await be.leggi('clienti'))[0]; await be.salva('clienti','c1',{...c,stato:{...c.stato,studio:{attivo:true,codice:'78'}}})`) === 'OK');
  check('studio NON tocca il codice ditta di anna', negato(await run(studio, `const c=(await be.leggi('clienti'))[0]; await be.salva('clienti','c1',{...c,stato:{...c.stato,anna:{attivo:true,codice:'99'}}})`)));
  check('profilo inesistente rifiutato anche all’admin', negato(await run(admin, `await be.salva('clienti','c9',{nome:'x',profili:['altro']})`)));
  check('admin elimina allegati e cliente', await run(admin, `await be.fileElimina('c1','${String(f1).slice(3)}'); await be.fileElimina('c1','${String(f2).slice(3)}'); await st.elimina('clienti','c1')`) === 'OK');

  // --- senza login ---
  const anon = await nuova(); await anon.goto(URL); await anon.waitForSelector('.accesso input[type=email]');
  check('senza login: nessuna lettura', negato(await run(anon, diretto('crm_proforma', 'p1'))));
  check('senza login: nessuna scrittura', negato(await run(anon, `await be.salva('clienti','h',{nome:'x',profili:['anna']})`)));
  // --- vecchia password non funziona più, uscita e rientro con la nuova ---
  await run(anna, `await be.esci()`); await anna.waitForSelector('.accesso input[type=email]');
  await anna.fill('input[type=email]', 'anna@test.it'); await anna.fill('input[type=password]', PW0); await anna.click('text=Accedi');
  await anna.waitForSelector('.avviso.rosso:not([hidden])'); check('la password temporanea non vale più', true);
  await anna.fill('input[type=password]', PW1); await anna.click('text=Accedi'); await anna.waitForSelector('.guscio', { timeout: 15000 });
  check('rientro con la nuova password, senza richiesta di cambio', true);

  console.log(`\n${ok} superati, ${ko} falliti`);
  await b.close(); process.exit(ko ? 1 : 0);
})().catch(e => { console.error('ERRORE COLLAUDO', e); process.exit(2); });
