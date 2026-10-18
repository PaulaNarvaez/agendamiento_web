import http from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFile, lstat, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const email = process.env.GOOGLE_ACCOUNT_EMAIL || 'heatherroseyt@gmail.com';
if (!clientId || !clientSecret) {
  console.error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env. Sigue los pasos de README.md y ejecuta de nuevo npm run connect:google.');
  process.exit(1);
}
const state = randomBytes(32).toString('hex');
const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const target = resolve('.env');
const redirect = 'http://127.0.0.1:53682/callback';
let processing = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, redirect);
  if (url.pathname !== '/callback') { res.writeHead(404); return res.end('No encontrado.'); }
  const received = Buffer.from(url.searchParams.get('state') || '');
  if (received.length !== state.length || !timingSafeEqual(received, Buffer.from(state))) { res.writeHead(400); return res.end('Autorización no válida.'); }
  if (processing) { res.writeHead(409); return res.end('La autorización ya se está procesando.'); }
  processing = true;
  try {
    if (url.searchParams.has('error') || !url.searchParams.get('code')) throw new Error('Autorización cancelada. Ejecuta nuevamente el asistente cuando quieras conectar Google.');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: url.searchParams.get('code'), code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Google no autorizó el intercambio. Revisa el cliente OAuth en Google Cloud.');
    const tokens = await response.json();
    if (!tokens.refresh_token || !tokens.access_token) throw new Error('No se obtuvo acceso permanente. Vuelve a autorizar con consentimiento.');
    const granted = new Set((tokens.scope || '').split(' '));
    if (!['https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar.freebusy'].every(scope => granted.has(scope))) throw new Error('Debes conceder acceso a eventos y disponibilidad para usar la agenda.');
    const profile = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000) });
    if (!profile.ok) throw new Error('No fue posible verificar la cuenta autorizada.');
    const account = await profile.json();
    if (!account.email_verified || account.email?.toLowerCase() !== email.toLowerCase()) throw new Error('Autoriza la cuenta indicada en GOOGLE_ACCOUNT_EMAIL. No se guardaron credenciales.');
    const existing = await lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing && !existing.isFile()) throw new Error('.env debe ser un archivo regular, no un enlace.');
    let content = existing ? await readFile(target, 'utf8') : '';
    for (const [name, value] of Object.entries({ GOOGLE_REFRESH_TOKEN: tokens.refresh_token, GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || email, GOOGLE_ACCOUNT_EMAIL: email })) {
      const line = `${name}=${JSON.stringify(value)}`;
      const pattern = new RegExp(`^(?:export\\s+)?${name}\\s*=.*$`, 'm');
      content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
    }
    const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
    try { await writeFile(temporary, content, { mode: 0o600, flag: 'wx' }); await rename(temporary, target); }
    finally { await unlink(temporary).catch(() => {}); }
    res.end('Cuenta autorizada. Puedes cerrar esta pestaña. Completa horarios, duración y valor en .env; después reinicia npm start.');
    console.log('Autorización guardada en .env (archivo privado, excluido de Git). Completa la configuración y reinicia npm start.');
  } catch (error) {
    res.writeHead(400);
    // Los errores propios son mensajes fijos; nunca se imprimen respuestas OAuth ni tokens.
    const safe = error instanceof TypeError || error.name === 'TimeoutError' ? 'No se pudo conectar con Google. Revisa tu conexión y vuelve a intentar.' : error.message;
    res.end(safe);
    console.error(safe);
    process.exitCode = 1;
  } finally { clearTimeout(timeout); server.close(); }
});
const timeout = setTimeout(() => { console.error('Autorización expirada. Ejecuta nuevamente npm run connect:google.'); server.close(); process.exitCode = 1; }, 600000);
server.on('error', () => { clearTimeout(timeout); console.error('No se pudo abrir el puerto local 53682. Cierra otro asistente de conexión e inténtalo de nuevo.'); process.exitCode = 1; });
server.listen(53682, '127.0.0.1', () => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy', access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256', login_hint: email }).toString();
  console.log(`Abre este enlace en el navegador de este mismo equipo y autoriza ${email}:\n\n${url}\n\nNo compartas la URL final de retorno ni el archivo .env.`);
});
