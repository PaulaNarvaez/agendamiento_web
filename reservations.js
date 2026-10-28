import { bookingEvent, meetingLink } from './calendar.js';
import { instant, validDate, zone } from './scheduling.js';

export const collectionFor = calendar => `calendars/${encodeURIComponent(calendar)}/events`;
export function isSession(event) {
  return event.status !== 'cancelled' && event.summary === 'Sesión online · Camila Leiva, psicóloga' && Boolean(event.start?.dateTime && event.end?.dateTime);
}
export async function listSessions(google, calendar, from, to, search = '') {
  if (!validDate(from) || !validDate(to) || from >= to) throw new Error('Usa fechas válidas AAAA-MM-DD; la fecha final debe ser posterior a la inicial.');
  const sessions = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ timeMin: instant(from, '00:00').toISOString(), timeMax: instant(to, '00:00').toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await google(`${collectionFor(calendar)}?${query}`);
    sessions.push(...(page.items || []).filter(isSession));
    pageToken = page.nextPageToken;
  } while (pageToken);
  const term = search.trim().toLocaleLowerCase('es');
  return sessions.filter(event => !term || [event.id, ...(event.attendees || []).flatMap(person => [person.email, person.displayName])].join(' ').toLocaleLowerCase('es').includes(term));
}
export async function getSession(google, calendar, id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id || '')) throw new Error('ID de reserva inválido. Copia el ID que aparece en la lista.');
  const event = await google(`${collectionFor(calendar)}/${encodeURIComponent(id)}`);
  if (!isSession(event)) throw new Error('Este evento no es una reserva activa de la web. No se modificará.');
  if (event.recurringEventId || event.recurrence) throw new Error('Edita las sesiones recurrentes directamente en Google Calendar.');
  if (!event.etag) throw new Error('No se pudo verificar la versión del evento. Vuelve a consultar.');
  return event;
}
export function moveTimes(event, date, hour, now = new Date()) {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour || '')) throw new Error('Usa fecha AAAA-MM-DD y hora HH:MM de Chile.');
  const start = instant(date, hour);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(start).map(p => [p.type, p.value]));
  if (`${parts.year}-${parts.month}-${parts.day}` !== date || `${parts.hour}:${parts.minute}` !== hour) throw new Error('Ese horario no existe en Chile por el cambio de hora.');
  const duration = Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime);
  if (start <= now || !Number.isFinite(duration) || duration <= 0) throw new Error('La nueva hora debe ser futura y la duración original válida.');
  return { start: start.toISOString(), end: new Date(start.getTime() + duration).toISOString() };
}
export async function moveSession(google, calendar, event, slot) {
  // Comprobar inmediatamente antes del PATCH. Incluye eventos ajenos a la web.
  const query = new URLSearchParams({ timeMin: slot.start, timeMax: slot.end, singleEvents: 'true', maxResults: '250' });
  let pageToken;
  do {
    if (pageToken) query.set('pageToken', pageToken);
    const page = await google(`${collectionFor(calendar)}?${query}`);
    const occupied = (page.items || []).some(other => other.id !== event.id && other.status !== 'cancelled' && other.transparency !== 'transparent' && !(other.attendees || []).some(a => a.self && a.responseStatus === 'declined'));
    if (occupied) throw new Error('Ese horario ya está ocupado en Google Calendar. Elige otro.');
    pageToken = page.nextPageToken;
  } while (pageToken);
  const updatedDescription = bookingEvent({ name: '', email: '' }, slot).description;
  const link = meetingLink(event);
  // Conserva cualquier nota agregada manualmente; actualiza solo fecha y horario.
  let description = event.description || updatedDescription;
  for (const label of ['Fecha', 'Horario']) {
    const line = updatedDescription.split('\n').find(value => value.startsWith(`${label}:`));
    const pattern = new RegExp(`^${label}:.*$`, 'm');
    description = pattern.test(description) ? description.replace(pattern, () => line) : `${description}\n${line}`;
  }
  const body = {
    start: { dateTime: slot.start, timeZone: zone }, end: { dateTime: slot.end, timeZone: zone },
    description: link ? description.replace('El acceso de Google Meet se incluirá en esta invitación.', `Acceso a la sesión: ${link}`) : description,
  };
  return google(`${collectionFor(calendar)}/${encodeURIComponent(event.id)}?sendUpdates=all`, { method: 'PATCH', headers: { 'If-Match': event.etag }, body: JSON.stringify(body) });
}
export async function cancelSession(google, calendar, event) {
  return google(`${collectionFor(calendar)}/${encodeURIComponent(event.id)}?sendUpdates=all`, { method: 'DELETE', headers: { 'If-Match': event.etag } });
}
