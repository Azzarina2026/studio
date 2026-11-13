/* Firme e-mail dello studio: dati e generazione dell'HTML.
   Usato sia dalla pagina /firme/ (anteprima e «Copia firma») sia dalla GitHub Action
   che aggiorna da sola le firme in Gmail (tools/firme-gmail.mjs).
   Per aggiungere una persona basta aggiungere un oggetto a FIRME. */

export const SITO = 'https://www.studioaccogli.it';
export const NOTE_LEGALI = SITO + '/note-legali/';

export const STUDIO = {
  nome: 'Studio dr Anna Maria Accogli e Associati',
  sedi: [
    {citta: 'Bari', indirizzo: 'Via Abate Gimma 3B, 70122'},
    {citta: 'Roma', indirizzo: 'Via Panama 96, 00198'}
  ],
  telefoni: ['+39 080 5576000', '+39 080 5573990'],
  staff: 'staff@studioaccogli.it'
};

/* email   = indirizzo mostrato nella firma e casella Gmail da aggiornare in automatico.
   gmail   = (facoltativo) account Google della persona, se diverso da email (per esempio quando
             email è un alias). La firma viene impostata sull'indirizzo «email» di quell'account.
   automatica = false per escludere la persona dall'aggiornamento automatico. */
export const FIRME = [{
  titolo: 'Dott.ssa Anna Maria Accogli',
  firmaImg: SITO + '/firme/img/firma-anna-accogli.png', firmaW: 251, firmaH: 40, firmaAlt: 'Anna Maria Accogli',
  mobile: '+39 348 2238108',
  email: 'anna@studioaccogli.it',
  pec: 'annamaria.accogli@pec.commercialisti.it'
}];

/* ---- Stile (solo in linea, caratteri sicuri per tutte le caselle di posta) ---- */
const C = {blu: '#1c2a5a', rosso: '#a3121b', testo: '#3a3f4b', tenue: '#8a8f9c'};
const SANS = "'Century Gothic',CenturyGothic,'Avenir Next',Futura,Arial,Helvetica,sans-serif";
export const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const tel = n => `<a href="tel:${n.replace(/\s/g,'')}" style="color:${C.testo};text-decoration:none">${esc(n)}</a>`;
const mail = (m, pre='') => `<a href="mailto:${m}" style="color:${C.blu};text-decoration:none">${pre}${esc(m)}</a>`;
const sep = `<span style="color:${C.rosso}">&nbsp;·&nbsp;</span>`;

function legale(){
  return `<tr><td colspan="2" style="padding:12px 0 0 0;font-family:${SANS};font-size:10px;line-height:14px;color:${C.tenue}">`
    + `Messaggio riservato ai soli destinatari: se lo ha ricevuto per errore, avvisi il mittente e lo cancelli.<br>`
    + `<i>Confidential: if received in error, please notify the sender and delete it.</i><br>`
    + `<a href="${NOTE_LEGALI}" style="color:${C.tenue};text-decoration:underline">Riservatezza, privacy e uso dell'intelligenza artificiale · Confidentiality, privacy &amp; AI notice</a>`
    + `</td></tr>`;
}

export function completa(p){
  const sedi = STUDIO.sedi.map(s => `<b style="color:${C.blu};font-weight:bold">${s.citta}</b> ${esc(s.indirizzo)}`).join(sep);
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${SANS};color:${C.testo}">`
    + `<tr><td colspan="2" style="padding:0 0 8px 0"><img src="${p.firmaImg}" width="${p.firmaW}" height="${p.firmaH}" alt="${esc(p.firmaAlt)}" style="display:block;border:0;width:${p.firmaW}px;height:${p.firmaH}px"></td></tr>`
    + `<tr>`
    + `<td valign="top" style="padding:3px 14px 0 0;vertical-align:top"><a href="${SITO}"><img src="${SITO}/firme/img/logo-studio.png" width="48" height="49" alt="Studio Accogli" style="display:block;border:0;width:48px;height:49px"></a></td>`
    + `<td valign="top" style="border-left:1px solid ${C.rosso};padding:0 0 0 14px;vertical-align:top">`
    +   `<div style="font-family:${SANS};font-size:16px;line-height:22px;color:${C.blu}">${esc(p.titolo)}</div>`
    +   `<div style="font-family:${SANS};font-size:10px;line-height:15px;letter-spacing:1px;text-transform:uppercase;color:${C.rosso};padding:0 0 6px 0">${esc(STUDIO.nome)}</div>`
    +   `<div style="font-family:${SANS};font-size:11px;line-height:17px;color:${C.testo}">${sedi}</div>`
    +   `<div style="font-family:${SANS};font-size:11px;line-height:17px;color:${C.testo}">T ${STUDIO.telefoni.map(tel).join(' / ')}${sep}M ${tel(p.mobile)}</div>`
    +   `<div style="font-family:${SANS};font-size:11px;line-height:17px;color:${C.testo}">${mail(p.email)}${sep}PEC ${mail(p.pec)}${sep}${mail(STUDIO.staff)}</div>`
    + `</td></tr>`
    + legale()
    + `</table>`;
}

export function compatta(p){
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${SANS};color:${C.testo}">`
    + `<tr><td colspan="2" style="border-left:1px solid ${C.rosso};padding:0 0 0 12px">`
    +   `<div style="font-family:${SANS};font-size:14px;line-height:20px;color:${C.blu}">${esc(p.titolo)}</div>`
    +   `<div style="font-family:${SANS};font-size:11px;line-height:17px;color:${C.testo}">${esc(STUDIO.nome)}${sep}${STUDIO.sedi.map(s=>s.citta).join(' | ')}</div>`
    +   `<div style="font-family:${SANS};font-size:11px;line-height:17px;color:${C.testo}">T ${tel(STUDIO.telefoni[0])}${sep}M ${tel(p.mobile)}${sep}${mail(p.email)}</div>`
    + `</td></tr>`
    + legale()
    + `</table>`;
}
