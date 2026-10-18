import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingEvent, createGoogleClient } from '../calendar.js';

const slot = { start: '2026-12-07T12:00:00.000Z', end: '2026-12-07T12:50:00.000Z' };
test('la invitación incluye profesional, horario de Chile, modalidad y conexión', () => {
  const event = bookingEvent({ name: ' Ana ', email: ' ana@example.com ' }, slot, 'https://meet.google.com/example');
  assert.match(event.summary, /Camila Leiva, psicóloga/);
  assert.equal(event.start.timeZone, 'America/Santiago');
  assert.match(event.description, /09:00 a 09:50/);
  assert.match(event.description, /telemática/);
  assert.match(event.description, /7 de diciembre de 2026/);
  assert.match(event.description, /https:\/\/meet.google.com\/example/);
  assert.deepEqual(event.attendees, [{ email: 'ana@example.com', displayName: 'Ana' }]);
  assert.equal(event.visibility, 'private');
  assert.equal(event.guestsCanInviteOthers, false);
});
test('cliente Google renueva token y pide envío de invitación sin exponer credenciales', async () => {
  const calls = [];
  const google = createGoogleClient({ clientId: 'fake-client', clientSecret: 'fake-secret', refreshToken: 'fake-refresh' }, async (url, options) => {
    calls.push({ url, options });
    return Response.json(calls.length === 1 ? { access_token: 'fake-access', expires_in: 3600 } : { id: 'fake-event' });
  });
  const path = `calendars/${encodeURIComponent('heatherroseyt@gmail.com')}/events?sendUpdates=all`;
  await google(path, { method: 'POST', body: JSON.stringify(bookingEvent({ name: 'Ana', email: 'ana@example.com' }, slot, 'https://example.com/session')) });
  await google('freeBusy', { method: 'POST', body: '{}' });
  assert.equal(calls.length, 3, 'reutiliza token vigente');
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(calls[0].options.body.get('grant_type'), 'refresh_token');
  assert.match(calls[1].url, /heatherroseyt%40gmail.com\/events\?sendUpdates=all/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fake-access');
});
test('falla de autenticación no se interpreta como reserva confirmada', async () => {
  const google = createGoogleClient({}, async () => new Response('{}', { status: 401 }));
  await assert.rejects(google('freeBusy'), /authentication failed/);
});
