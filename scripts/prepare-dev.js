import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { missingSettings, configurationReport, organizerConfigurationIssue, organizerEmail } from '../configuration.js';

const missing = missingSettings();
const missingCredentials = missing.filter(name => ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'].includes(name));
if (missingCredentials.length) {
  console.error(configurationReport());
  console.error('No se iniciará una agenda ficticia. Completa tu .env local y vuelve a ejecutar npm.cmd run dev.');
  process.exit(1);
}
const needsAuthorization = missing.includes('GOOGLE_REFRESH_TOKEN') || Boolean(organizerConfigurationIssue());
if (needsAuthorization) {
  console.log(`Autoriza ${organizerEmail}. Se abrirá el navegador: elige esa cuenta y acepta los permisos.`);
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', fileURLToPath(new URL('./connect-google.js', import.meta.url))], { stdio: 'inherit' });
  const exitCode = await new Promise(resolve => {
    child.once('error', () => resolve(1));
    child.once('exit', code => resolve(code ?? 1));
  });
  if (exitCode) process.exit(exitCode);
}
// El asistente puede completar la cuenta y el token al guardar el archivo.
const remaining = missing.filter(name => !['GOOGLE_REFRESH_TOKEN','GOOGLE_CALENDAR_ID'].includes(name));
if (remaining.length || (missing.includes('GOOGLE_CALENDAR_ID') && !needsAuthorization)) {
  if (missing.includes('GOOGLE_CALENDAR_ID') && !needsAuthorization) remaining.push('GOOGLE_CALENDAR_ID');
  console.error('Falta completar en .env:\n' + remaining.map(name => `  - ${name}`).join('\n'));
  console.error('Ejecuta npm.cmd run setup:sessions para completar los datos de atención sin editar archivos. Después ejecuta npm.cmd run dev.');
  process.exit(1);
}
console.log('Configuración presente. Iniciando la agenda; la disponibilidad se consultará en Google Calendar.');
