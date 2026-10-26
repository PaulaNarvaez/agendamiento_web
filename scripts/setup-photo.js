import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, stat, lstat, mkdir, rename, unlink, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { selectLocalFile } from './file-picker.js';

const rl = createInterface({ input: stdin, output: stdout });
try {
  const source = resolve(await selectLocalFile(process.argv[2], prompt => rl.question(prompt), 'photo'));
  const file = await stat(source);
  if (!file.isFile() || file.size > 10 * 1024 * 1024) throw new Error('Selecciona una fotografía de menos de 10 MB.');
  const image = await readFile(source);
  const type = image.length >= 4 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff ? 'jpg'
    : image.length >= 8 && image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
    : image.length >= 12 && image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
  if (!type) throw new Error('Selecciona una imagen JPG, PNG o WebP real. No basta con cambiarle la extensión.');
  const targetName = `camila.${type}`;
  const target = resolve('public', targetName);
  const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  await mkdir(resolve('public'), { recursive: true });
  const entries = await readdir(resolve('public'));
  const previous = entries.filter(name => /^camila\.(jpe?g|png|webp)$/i.test(name));
  for (const name of previous) {
    const old = resolve('public', name);
    const file = await lstat(old);
    if (!file.isFile()) throw new Error('Las fotos existentes deben ser archivos regulares.');
    if (samePath(old, target) && samePath(source, target)) continue;
    await mkdir(resolve('.local-backups'), { recursive: true });
    await writeFile(resolve('.local-backups', `${randomUUID()}-${name}`), await readFile(old), { flag: 'wx', mode: 0o600 });
  }
  if (!samePath(source, target)) {
    const temporary = resolve('public', `.camila-${randomUUID()}.tmp`);
    try { await writeFile(temporary, image, { flag: 'wx' }); await rename(temporary, target); }
    finally { await unlink(temporary).catch(() => {}); }
  }
  // Retirar variantes antiguas evita que una foto JPG anterior tenga prioridad
  // sobre la nueva PNG/WebP. Todas quedaron respaldadas antes de modificar nada.
  for (const name of previous) if (!samePath(resolve('public', name), target)) await unlink(resolve('public', name));
  console.log(`Foto guardada en public/${targetName}. Se mostrará con el efecto difuminado.`);
  console.log('Para que aparezca en la web alojada, agrega y sube public/camila.* a GitHub.');
} catch (error) {
  console.error(error.code ? 'No se pudo leer o guardar la foto. Revisa el archivo seleccionado y sus permisos.' : error.message);
  process.exitCode = 1;
} finally { rl.close(); }
