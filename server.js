import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { localDate, slotsFor, validDate, validateBooking, zone } from './scheduling.js';

const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_CALENDAR_ID', 'SESSION_DURATION_MINUTES', 'AVAILABLE_WEEKDAYS', 'AVAILABLE_HOURS', 'SESSION_PRICE_CLP', 'SESSION_LOCATION', 'ONLINE_SESSION_URL'];
const live = required.every(name => Boolean(process.env[name]));
const duration = Number(process.env.SESSION_DURATION_MINUTES || 50);
const weekdays = (process.env.AVAILABLE_WEEKDAYS || '1,2,3,4,5').split(',').map(Number);
const hours = [...new Set((process.env.AVAILABLE_HOURS || '09:00,10:00,11:00,15:00,16:00,17:00').split(','))].sort();
if (!Number.isInteger(duration) || duration < 15 || duration > 180 || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || hours.some(hour => !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))) throw new Error('Configuración de horarios no válida');
if (live && (!Number.isFinite(Number(process.env.SESSION_PRICE_CLP)) || Number(process.env.SESSION_PRICE_CLP) < 0 || !process.env.ONLINE_SESSION_URL.startsWith('https://'))) throw new Error('Precio o enlace online no válido');
let token;
let expires = 0;
async function google(path, options = {}) {
  if (Date.now() > expires) {
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Google authentication failed');
    const data = await response.json();
    token = data.access_token;
    expires = Date.now() + (data.expires_in - 60) * 1000;
  }
  const response = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Google calendar request failed');
  return response.json();
}
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
const assets = { '/': ['index.html','text/html'], '/styles.css': ['styles.css','text/css'], '/app.js': ['app.js','text/javascript'], '/camila.jpg': ['camila.jpg','image/jpeg'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { demo: !live, duration: live ? duration : null, price: live ? Number(process.env.SESSION_PRICE_CLP) : null, location: live ? process.env.SESSION_LOCATION : null, timeZone: zone, today: localDate() });
    if (req.method === 'GET' && url.pathname === '/api/availability') {
      const date = url.searchParams.get('date');
      if (!validDate(date) || date < localDate() || Date.parse(date) > Date.now() + 90 * 86400000) return json(res, 400, { error: 'Elige una fecha entre hoy y los próximos 90 días.' });
      return json(res, 200, { slots: await available(date), demo: !live });
    }
    if (req.method === 'POST' && url.pathname === '/api/bookings') {
      if (!live) return json(res, 409, { error: 'Esta agenda es una demostración. No se ha realizado una reserva ni enviado un correo.' });
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
        const event = await google(`calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}/events?sendUpdates=all`, { method: 'POST', body: JSON.stringify({ summary: 'Sesión · Camila Leiva', start: { dateTime: slot.start, timeZone: zone }, end: { dateTime: slot.end, timeZone: zone }, attendees: [{ email: input.email, displayName: input.name.trim() }], visibility: 'private', location: input.mode === 'online' ? process.env.ONLINE_SESSION_URL : process.env.SESSION_LOCATION, description: `Sesión ${input.mode}. Reserva realizada en el sitio de Camila Leiva.` }) });
        if (!event.id) throw new Error('Event creation unconfirmed');
        return json(res, 201, { booked: true, start: slot.start, message: 'Tu reserva está registrada. Google Calendar enviará una invitación a tu correo.' });
      });
      bookingQueue = action.catch(() => {});
      return await action;
    }
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname];
      const data = await readFile(root + file);
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); return res.end(data);
    }
    json(res, 404, { error: 'No encontrado.' });
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, 404, { error: 'No encontrado.' });
    console.error('No se pudo completar la operación con el servicio de agenda.');
    json(res, 503, { error: 'No pudimos confirmar la operación. Antes de reintentar, revisa tu correo para evitar duplicados.' });
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log(`Camila Leiva · puerto ${process.env.PORT || 3000} · ${live ? 'Google Calendar' : 'modo demostración'}`));
