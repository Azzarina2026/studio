/* Allegati (mandati, documenti, antiriciclaggio). Sono salvati nel database a pezzi,
   così non serve alcun servizio a pagamento. Le immagini grandi vengono alleggerite prima del salvataggio. */
import { be } from './stato.js';
import { LIMITI } from '../config.js';
import { h, icona, errore, scaricaBlob, toast } from './ui.js';
import { fileSize } from './util.js';

async function alleggerisci(file) {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 900 * 1024) return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, 2200 / Math.max(img.width, img.height));
  const tela = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
  const blob = await new Promise(r => tela.toBlob(r, 'image/jpeg', .82));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/* Restituisce il riferimento da salvare accanto al dato: { id, nome, tipo, dim } */
export async function caricaFile(clienteId, file, ambito = 'condiviso') {
  file = await alleggerisci(file);
  if (file.size > LIMITI.fileMax) throw new Error(`Il file supera ${fileSize(LIMITI.fileMax)}: riduci la qualità della scansione e riprova.`);
  const meta = { nome: file.name, tipo: file.type || 'application/octet-stream', dim: file.size, ambito };
  const id = await be.fileSalva(clienteId, meta, file);
  return { id, nome: meta.nome, tipo: meta.tipo, dim: meta.dim };
}
export async function apriFile(clienteId, rif) {
  try {
    toast('Scarico l’allegato…');
    const blob = await be.fileLeggi(clienteId, rif.id);
    scaricaBlob(new Blob([blob], { type: rif.tipo }), rif.nome);
  } catch (e) { errore(e); }
}
export const eliminaFile = (clienteId, rif) => rif?.id ? be.fileElimina(clienteId, rif.id).catch(() => {}) : null;

export const linkFile = (clienteId, rif) => rif
  ? h('button.btn.sm', { type: 'button', onclick: () => apriFile(clienteId, rif), title: `${rif.nome} · ${fileSize(rif.dim)}` }, icona('graffetta', 14), 'Allegato')
  : h('span.dim', '—');
