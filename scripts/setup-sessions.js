import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, rename, unlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';

const target = resolve('.env');
const rl = createInterface({ input: stdin, crlfDelay: Infinity });
const answers = rl[Symbol.asyncIterator]();
async function question(prompt) {
  stdout.write(prompt);
  const answer = await answers.next();
  if (answer.done) throw new Error('Asistente interrumpido. No se guardó ningún cambio.');
  return answer.value.trim();
}
async function ask(prompt, previous, validate) {
  for (;;) {
    const answer = await question(`${prompt}${previous ? ` [actual: ${previous}]` : ''}: `);
    const value = answer || previous || '';
    const result = validate(value);
    if (result !== null) return result;
    console.log('Valor no válido. Revisa el formato indicado y vuelve a escribirlo.');
  }
}
try {
  const file = await lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (file && !file.isFile()) throw new Error('.env debe ser un archivo regular.');
  let contents = file ? await readFile(target, 'utf8') : await readFile(resolve('.env.example'), 'utf8');
  const current = parseEnv(contents);
  console.log('Configurar sesiones de Camila. Se guardarán únicamente duración, precio, días y horas en .env.');
  console.log('Ingresa los datos reales de atención; la configuración de Google se conserva.');
  const duration = await ask('Duración en minutos (15 a 180, por ejemplo 50)', current.SESSION_DURATION_MINUTES, value => /^\d+$/.test(value) && Number(value) >= 15 && Number(value) <= 180 ? String(Number(value)) : null);
  const price = await ask('Precio en pesos chilenos (por ejemplo 30000)', current.SESSION_PRICE_CLP, value => {
    if (!/^\$?\s*\d+(?:\.\d{3})*$/.test(value)) return null;
    const number = Number(value.replace(/[$.\s]/g, ''));
    return Number.isSafeInteger(number) && number >= 0 ? String(number) : null;
  });
  console.log('Días: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado.');
  const days = await ask('Días separados por coma (por ejemplo 1,2,3,4,5)', current.AVAILABLE_WEEKDAYS, value => {
    const values = value.split(',').map(part => part.trim());
    return values.length && values.every(day => /^[0-6]$/.test(day)) ? [...new Set(values)].sort().join(',') : null;
  });
  const hours = await ask('Horas de inicio, horario de Chile (por ejemplo 09:00,10:00,15:00)', current.AVAILABLE_HOURS, value => {
    const values = value.split(',').map(part => part.trim());
    if (!values.length || !values.every(hour => /^([01]?\d|2[0-3]):[0-5]\d$/.test(hour))) return null;
    const normalized = [...new Set(values.map(hour => hour.padStart(5, '0')))].sort();
    for (let index = 1; index < normalized.length; index++) {
      const minutes = hour => Number(hour.slice(0, 2)) * 60 + Number(hour.slice(3));
      if (minutes(normalized[index]) < minutes(normalized[index - 1]) + Number(duration)) return null;
    }
    return normalized.join(',');
  });
  // Releer antes de guardar conserva una autorización de Google completada
  // mientras se respondían las preguntas.
  const latest = await lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (latest && !latest.isFile()) throw new Error('.env debe ser un archivo regular.');
  if (latest) contents = await readFile(target, 'utf8');
  const values = { SESSION_DURATION_MINUTES: duration, SESSION_PRICE_CLP: price, AVAILABLE_WEEKDAYS: days, AVAILABLE_HOURS: hours };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'gm');
    contents = pattern.test(contents) ? contents.replace(pattern, `${key}=${value}`) : `${contents.trimEnd()}\n${key}=${value}\n`;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, contents, { flag: 'wx', mode: 0o600 }); await rename(temporary, target); }
  finally { await unlink(temporary).catch(() => {}); }
  console.log(`\nDatos guardados en ${target}. La configuración de Google no se modificó.`);
  console.log(`Duración: ${duration} minutos. Precio: $${Number(price).toLocaleString('es-CL')}. Días: ${days}. Horas: ${hours}.`);
  console.log('Ahora ejecuta: npm.cmd run dev');
} catch (error) {
  console.error(error.code ? 'No se pudo leer o guardar .env. Revisa la carpeta y sus permisos.' : error.message);
  process.exitCode = 1;
} finally { rl.close(); }
