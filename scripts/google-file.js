import { selectLocalFile } from './file-picker.js';
import { stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readGoogleFile(path, question) {
  const selected = await selectLocalFile(path, question, 'google');
  if (!selected || !/\.json$/i.test(selected)) throw new Error('Selecciona un archivo .json descargado de Google Cloud, no pegues el contenido como comando.');
  const absolute = resolve(selected);
  let file;
  try { file = await stat(absolute); }
  catch { throw new Error('No se encontró el archivo seleccionado. Vuelve a ejecutar el asistente y selecciona el JSON.'); }
  if (!file.isFile() || file.size > 64000) throw new Error('El archivo debe ser un JSON de credenciales de Google de menos de 64 KB.');
  return (await readFile(absolute, 'utf8')).replace(/^\uFEFF/, '');
}
