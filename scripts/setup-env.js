import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, lstat, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { readGoogleFile } from './google-file.js';
import { parseGoogleCredentials } from './google-json.js';
import { organizerEmail } from '../configuration.js';

const target = resolve('.env');
let hideInput = false;
const terminalOutput = new Writable({ write(chunk, encoding, callback) { if (!hideInput) stdout.write(chunk, encoding); callback(); } });
terminalOutput.isTTY = stdout.isTTY;
terminalOutput.columns = stdout.columns;
const rl = createInterface({ input: stdin, output: terminalOutput, terminal: Boolean(stdin.isTTY && stdout.isTTY), crlfDelay: Infinity });
const answers = rl[Symbol.asyncIterator]();
async function question(text, secret = false) {
  stdout.write(text);
  hideInput = secret;
  try {
    const answer = await answers.next();
    if (answer.done) throw new Error('Configuración interrumpida. No se guardaron cambios.');
    return answer.value.trim();
  } finally { hideInput = false; if (secret) stdout.write('\n'); }
}
async function readPrivateFile() {
  const file = await lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (file && !file.isFile()) throw new Error('.env debe ser un archivo regular.');
  return file ? readFile(target, 'utf8') : '';
}
const validId = value => /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value || '');
const validSecret = value => /^[A-Za-z0-9_-]{10,}$/.test(value || '') && !/^(PEGA|TU_SECRETO|REEMPLAZA|SECRET_HERE)/i.test(value);
try {
  const original = await readPrivateFile();
  let seed = original;
  if (!seed.trim()) {
    seed = await readFile(resolve('.env.example'), 'utf8');
    // Una plantilla nunca se utiliza como fuente de credenciales reales.
    for (const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN']) seed = seed.replace(new RegExp(`^${key}=.*$`, 'gm'), `${key}=`);
  }
  const current = parseEnv(seed);
  console.log(`Configuración privada: ${target}`);
  console.log(`Cuenta de Google Calendar: ${organizerEmail}. Los valores privados no se mostrarán.`);
  const replace = process.argv.includes('--replace-google');
  let clientId = current.GOOGLE_CLIENT_ID?.trim();
  let clientSecret = current.GOOGLE_CLIENT_SECRET?.trim();
  const fileIndex = process.argv.indexOf('--json-file');
  const inlineFile = process.argv.find(argument => argument.startsWith('--json-file='));
  if (fileIndex !== -1 || inlineFile) {
    const supplied = inlineFile ? inlineFile.slice('--json-file='.length) : process.argv[fileIndex + 1];
    const path = supplied && !supplied.startsWith('--') ? supplied : undefined;
    const text = await readGoogleFile(path, question);
    ({ clientId, clientSecret } = parseGoogleCredentials(text));
  } else if (process.argv.includes('--json')) {
    const text = await question('Pega el JSON completo de Google en una sola línea (entrada oculta): ', true);
    ({ clientId, clientSecret } = parseGoogleCredentials(text));
  } else {
    while (!validId(clientId)) clientId = await question('Pega tu ID de cliente OAuth completo de Google Cloud: ');
    if (replace && validId(current.GOOGLE_CLIENT_ID)) {
      const entered = await question('ID de cliente (Enter para conservar el actual): ');
      if (entered) clientId = entered;
      while (!validId(clientId)) clientId = await question('ID no válido. Pega el ID completo que termina en .apps.googleusercontent.com: ');
    }
    if (!validSecret(clientSecret) || replace) {
      clientSecret = await question(`Pega el secreto completo del mismo cliente${replace && validSecret(current.GOOGLE_CLIENT_SECRET) ? ' (Enter para conservarlo)' : ''} (entrada oculta): `, true) || (replace ? current.GOOGLE_CLIENT_SECRET : '');
      while (!validSecret(clientSecret)) clientSecret = await question('Secreto vacío o formato incorrecto. Pega el valor completo (entrada oculta): ', true);
    }
  }
  // Releer justo antes de guardar para conservar otros cambios locales.
  let contents = await readPrivateFile();
  if (!contents.trim()) contents = seed;
  const latest = parseEnv(contents);
  const mustAuthorize = latest.GOOGLE_CLIENT_ID !== clientId || latest.GOOGLE_CLIENT_SECRET !== clientSecret || latest.GOOGLE_ACCOUNT_EMAIL?.trim() !== organizerEmail || latest.GOOGLE_CALENDAR_ID?.trim() !== organizerEmail;
  const values = { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_ACCOUNT_EMAIL: organizerEmail, GOOGLE_CALENDAR_ID: organizerEmail };
  if (mustAuthorize) values.GOOGLE_REFRESH_TOKEN = '';
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`, 'gm');
    const line = `${key}=${JSON.stringify(value)}`;
    contents = pattern.test(contents) ? contents.replace(pattern, () => line) : `${contents.trimEnd()}\n${line}\n`;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' }); await rename(temporary, target); }
  finally { await unlink(temporary).catch(() => {}); }
  console.log('Archivo .env guardado. Las credenciales permanecen exclusivamente en tu computador.');
  if (mustAuthorize || !latest.GOOGLE_REFRESH_TOKEN) console.log('Al ejecutar npm.cmd run dev se abrirá la autorización de Google.');
} catch (error) {
  console.error(error.code ? 'No se pudo leer o guardar .env. Revisa la carpeta y sus permisos.' : error.message);
  process.exitCode = 1;
} finally { rl.close(); }
