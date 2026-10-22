import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { findPortrait } from './portrait.js';
import { fileURLToPath } from 'node:url';
import { missingSettings, configurationReport } from './configuration.js';
import { reserveWithMeet, createGoogleClient, googleDiagnostic } from './calendar.js';
import { localDate, slotsFor, validDate, validateBooking, zone } from './scheduling.js';

const live = missingSettings().length === 0;
const duration = Number(process.env.SESSION_DURATION_MINUTES || 50);
const weekdays = (process.env.AVAILABLE_WEEKDAYS || '1,2,3,4,5').split(',').map(Number);
const hours = [...new Set((process.env.AVAILABLE_HOURS || '09:00,10:00,11:00,15:00,16:00,17:00').split(','))].sort();
if (!Number.isInteger(duration) || duration < 15 || duration > 180 || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || hours.some(hour => !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))) throw new Error('Configuración de horarios no válida');
if (live && (!Number.isFinite(Number(process.env.SESSION_PRICE_CLP)) || Number(process.env.SESSION_PRICE_CLP) < 0)) throw new Error('Precio no válido');
const google = createGoogleClient({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, refreshToken: process.env.GOOGLE_REFRESH_TOKEN });
async function available(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!weekdays.includes(day)) return [];
  const candidates = slotsFor(date, hours, duration);
  if (!live || !candidates.length) return candidates;
  const data = await google('freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: candidates[0].start, timeMax: candidates.at(-1).end, timeZone: zone, items: [{ id: process.env.GOOGLE_CALENDAR_ID }] }) });
  const calendar = data.calendars?.[process.env.GOOGLE_CALENDAR_ID];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error('Calendar availability unavailable');
  return slotsFor(date, hours, duration, calendar.busy);
}
let bookingQueue = Promise.resolve();
const rates = new Map();
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
const root = fileURLToPath(new URL('./public/', import.meta.url));
const assets = { '/': ['index.html','text/html'], '/styles.css': ['styles.css','text/css'], '/app.js': ['app.js','text/javascript'], '/sculpture.svg': ['sculpture.svg', 'image/svg+xml'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { bookingEnabled: live, duration: live ? duration : null, price: live ? Number(process.env.SESSION_PRICE_CLP) : null, modality: 'online', hasPortrait: Boolean(await findPortrait(root)), timeZone: zone, today: localDate() });
    if (req.method === 'GET' && url.pathname === '/api/availability') {
      if (!live) return json(res, 503, { code: 'AGENDA_UNAVAILABLE', error: 'La agenda aún no está habilitada. No se pueden realizar reservas en este momento.' });
      const date = url.searchParams.get('date');
      if (!validDate(date) || date < localDate() || Date.parse(date) > Date.now() + 90 * 86400000) return json(res, 400, { error: 'Elige una fecha entre hoy y los próximos 90 días.' });
      return json(res, 200, { slots: await available(date) });
    }
    if (req.method === 'POST' && url.pathname === '/api/bookings') {
      if (!live) return json(res, 503, { code: 'AGENDA_UNAVAILABLE', error: 'La agenda aún no está habilitada. No se ha realizado ninguna reserva.' });
      if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== `http://${req.headers.host}`)) return json(res, 403, { error: 'Solicitud no permitida.' });
      const address = req.socket.remoteAddress;
      const rate = rates.get(address);
      if (rate && rate.until > Date.now() && rate.count >= 8) return json(res, 429, { error: 'Demasiados intentos. Intenta nuevamente en unos minutos.' });
      rates.set(address, { count: rate && rate.until > Date.now() ? rate.count + 1 : 1, until: rate && rate.until > Date.now() ? rate.until : Date.now() + 600000 });
      if (rates.size > 10000) for (const [key, entry] of rates) if (entry.until < Date.now()) rates.delete(key);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'Solicitud demasiado grande.' }); }
      let input;
      try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'Solicitud no válida.' }); }
      if (!input || !validateBooking(input) || input.date < localDate() || Date.parse(input.date) > Date.now() + 90 * 86400000) return json(res, 400, { error: 'Revisa tu nombre, correo y el horario seleccionado.' });
      const action = bookingQueue.then(async () => {
        const slot = (await available(input.date)).find(s => s.hour === input.hour);
        if (!slot) return json(res, 409, { error: 'Este horario ya no está disponible. Elige otro.' });
        const { onlineUrl } = await reserveWithMeet(google, process.env.GOOGLE_CALENDAR_ID, input, slot);
        return json(res, 201, { booked: true, start: slot.start, onlineUrl, message: 'Tu reserva está registrada. Google Calendar enviará una invitación con tu enlace exclusivo de Google Meet.' });
      });
      bookingQueue = action.catch(() => {});
      return await action;
    }
    if (req.method === 'GET' && ['/api/portrait', '/camila.jpg'].includes(url.pathname)) {
      const portrait = await findPortrait(root);
      if (!portrait) return json(res, 404, { error: 'Fotografía no disponible.' });
      const data = await readFile(root + portrait.name);
      res.writeHead(200, { 'Content-Type': portrait.type, 'Cache-Control': 'no-store' });
      return res.end(data);
    }
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname];
      const data = await readFile(root + file);
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); return res.end(data);
    }
    json(res, 404, { error: 'No encontrado.' });
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'No encontrado.' });
    console.error(googleDiagnostic(error));
    if (error.reservationNeedsReview) return json(res, 503, { reservationNeedsReview: true, onlineUrl: error.onlineUrl, error: 'La sesión se creó en el calendario, pero no pudimos confirmar el envío de la invitación. No vuelvas a reservar: contacta con la profesional para revisar el evento y enviar la invitación.' });
    if (error.code === 'MEET_UNAVAILABLE') return json(res, 503, { error: 'Google no pudo generar la videollamada. El evento provisional se eliminó y la reserva no se confirmó. Intenta nuevamente más tarde.' });
    console.error('No se pudo completar la operación con el servicio de agenda.');
    json(res, 503, { error: 'No pudimos confirmar la operación. Antes de reintentar, revisa tu correo o consulta con la profesional para comprobar si existe una reserva y evitar duplicados.' });
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${process.env.PORT || 3000} está ocupado. Cierra la otra instancia o cambia PORT en .env.` : 'No se pudo iniciar el servidor.');
  process.exitCode = 1;
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`\nCamila Leiva | Psicología online\n`);
  console.log(`  Local: http://localhost:${server.address().port}`);
  console.log(`  Estado: ${live ? 'Google Calendar configurado' : 'Reservas deshabilitadas: falta completar la configuración'}`);
  if (!live) console.log(`\n${configurationReport()}`);
  console.log('\nAbre la URL en tu navegador. Para detener: Ctrl+C.\n');
});
