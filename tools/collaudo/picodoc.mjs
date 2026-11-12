// Prove delle regole con cui un documento arrivato da Pico Doc entra nella scheda del cliente.
// Uso: node tools/collaudo/picodoc.mjs
import assert from 'node:assert/strict';
import { documentoDaInvio, confronta, scadenzaPiuLontana } from '../../crm-test/js/domain/picodoc.js';

const TIPI = [['carta_identita', 'Carta d’identità'], ['visura_camerale', 'Visura camerale'], ['f24', 'Altro', 'F24 / quietanza'], ['bolletta', 'Altro', 'Bolletta / utenza']];
const persona = { id: 'c1', nome: 'Mario Rossi', tipo: 'persona' };
const azienda = { id: 'c2', nome: 'Rossi S.r.l.', tipo: 'azienda' };
const invio = (tipo, utente, scadenza = '') => ({ tipo, utente, scadenza });
const nuovo = (inv, cliente, email) => documentoDaInvio(inv, cliente, TIPI, email, { id: 'n', oggi: '2026-11-12', file: null });
let prove = 0;
const prova = (nome, f) => { f(); prove++; console.log('✓', nome); };

prova('persona: la carta d’identità è intestata al cliente', () => {
  const d = nuovo(invio('carta_identita', 'u-mario', '2031-03-12'), persona, 'mario@esempio.it');
  assert.deepEqual([d.tipo, d.intestatario, d.ambito, d.fonte, d.mittente, d.scadenza], ['Carta d’identità', 'Mario Rossi', 'personale', 'app', 'u-mario', '2031-03-12']);
});
prova('azienda: la carta d’identità porta l’email di chi l’ha inviata', () => {
  assert.equal(nuovo(invio('carta_identita', 'u-socio1'), azienda, 'socio1@esempio.it').intestatario, 'socio1@esempio.it');
  assert.equal(nuovo(invio('visura_camerale', 'u-socio1'), azienda, 'socio1@esempio.it').intestatario, 'Rossi S.r.l.');
});
prova('lo stesso utente rimanda il documento: sostituisce il precedente', () => {
  const vecchio = { ...nuovo(invio('carta_identita', 'u-mario', '2026-01-01'), persona), id: 'v' };
  const r = confronta([vecchio], nuovo(invio('carta_identita', 'u-mario', '2036-01-01'), persona), persona);
  assert.deepEqual([r.sostituire.map(d => d.id), r.dubbi.length], [['v'], 0]);
});
prova('due soci: la carta d’identità di uno NON cancella quella dell’altro', () => {
  const socio1 = { ...nuovo(invio('carta_identita', 'u-socio1'), azienda, 'socio1@esempio.it'), id: 's1' };
  const r = confronta([socio1], nuovo(invio('carta_identita', 'u-socio2'), azienda, 'socio2@esempio.it'), azienda);
  assert.deepEqual([r.sostituire.length, r.dubbi.length], [0, 0]);
});
prova('due soci: ognuno aggiorna solo la propria', () => {
  const socio1 = { ...nuovo(invio('carta_identita', 'u-socio1'), azienda, 'socio1@esempio.it'), id: 's1' };
  const socio2 = { ...nuovo(invio('carta_identita', 'u-socio2'), azienda, 'socio2@esempio.it'), id: 's2' };
  const r = confronta([socio1, socio2], nuovo(invio('carta_identita', 'u-socio2'), azienda, 'socio2@esempio.it'), azienda);
  assert.deepEqual(r.sostituire.map(d => d.id), ['s2']);
});
prova('persona: sostituisce anche il documento caricato a mano intestato al cliente', () => {
  const manuale = { id: 'm', tipo: 'Carta d’identità', intestatario: 'Mario Rossi', fonte: 'manuale' };
  const diAltri = { id: 'a', tipo: 'Carta d’identità', intestatario: 'Anna Bianchi (coniuge)', fonte: 'manuale' };
  const r = confronta([manuale, diAltri], nuovo(invio('carta_identita', 'u-mario'), persona), persona);
  assert.deepEqual([r.sostituire.map(d => d.id), r.dubbi.length], [['m'], 0]);
});
prova('azienda: documento d’identità caricato a mano → si chiede, non si sostituisce da solo', () => {
  const manuale = { id: 'm', tipo: 'Carta d’identità', intestatario: 'Rossi S.r.l.', fonte: 'manuale' };
  const r = confronta([manuale], nuovo(invio('carta_identita', 'u-socio1'), azienda, 'socio1@esempio.it'), azienda);
  assert.deepEqual([r.sostituire.length, r.dubbi.map(d => d.id)], [0, ['m']]);
});
prova('azienda: la visura nuova sostituisce quella caricata a mano', () => {
  const manuale = { id: 'm', tipo: 'Visura camerale', intestatario: 'Rossi S.r.l.', fonte: 'manuale' };
  const r = confronta([manuale], nuovo(invio('visura_camerale', 'u-socio1'), azienda), azienda);
  assert.deepEqual(r.sostituire.map(d => d.id), ['m']);
});
prova('tipi diversi non si toccano; tra gli «Altro» conta la descrizione', () => {
  const f24 = { ...nuovo(invio('f24', 'u-mario'), persona), id: 'f' };
  const bolletta = { ...nuovo(invio('bolletta', 'u-mario'), persona), id: 'b' };
  const visura = { ...nuovo(invio('visura_camerale', 'u-mario'), persona), id: 'v' };
  const r = confronta([f24, bolletta, visura], nuovo(invio('bolletta', 'u-mario'), persona), persona);
  assert.deepEqual(r.sostituire.map(d => d.id), ['b']);
});
prova('scheda senza documenti', () => assert.deepEqual(confronta(undefined, nuovo(invio('f24', 'u'), persona), persona), { sostituire: [], dubbi: [] }));
prova('scadenza più lontana', () => {
  assert.equal(scadenzaPiuLontana([{ scadenza: '2027-01-01' }, { scadenza: '' }, { scadenza: '2031-05-05' }]), '2031-05-05');
  assert.equal(scadenzaPiuLontana([{}]), '');
});
console.log(`\nTutte le ${prove} prove superate.`);
