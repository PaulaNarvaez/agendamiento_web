import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingEvent, createGoogleClient, reserveWithMeet, googleDiagnostic } from '../calendar.js';

const slot = { start: '2026-12-07T12:00:00.000Z', end: '2026-12-07T12:50:00.000Z' };
test('la invitación incluye profesional, horario de Chile, modalidad y conexión', () => {
  const event = bookingEvent({ name: ' Ana ', email: ' ana@example.com ' }, slot);
  assert.match(event.summary, /Camila Leiva, psicóloga/);
  assert.equal(event.start.timeZone, 'America/Santiago');
  assert.match(event.description, /09:00 a 09:50/);
  assert.match(event.description, /telemática/);
  assert.match(event.description, /7 de diciembre de 2026/);
  assert.equal(event.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.notEqual(event.conferenceData.createRequest.requestId, bookingEvent({ name: 'Ana', email: 'ana@example.com' }, slot).conferenceData.createRequest.requestId);
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
  await google(path, { method: 'POST', body: JSON.stringify(bookingEvent({ name: 'Ana', email: 'ana@example.com' }, slot)) });
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

test('espera el Meet antes de enviar invitaciones y genera enlaces distintos', async () => {
  let sequence = 0;
  const requests = [];
  const events = new Map();
  const google = async (path, options = {}) => {
    requests.push({ path, options });
    if (options.method === 'POST') {
      assert.match(path, /conferenceDataVersion=1&sendUpdates=none/);
      const body = JSON.parse(options.body);
      assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
      assert.equal(body.attendees, undefined);
      const id = String(++sequence);
      events.set(id, body);
      return { id, conferenceData: { createRequest: { status: { statusCode: 'pending' } } } };
    }
    const id = path.split('/events/')[1].split('?')[0];
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      assert.match(path, /sendUpdates=all/);
      assert.equal(body.attendees[0].email, 'ana@example.com');
      assert.equal(body.location, `https://meet.google.com/unique-${id}`);
      assert.ok(body.description.includes(body.location));
      return { id };
    }
    return { id, conferenceData: { createRequest: { status: { statusCode: 'success' } }, entryPoints: [{ entryPointType: 'video', uri: `https://meet.google.com/unique-${id}` }] } };
  };
  const input = { name: 'Ana', email: 'ana@example.com' };
  const first = await reserveWithMeet(google, 'test@example.com', input, slot, async () => {});
  const second = await reserveWithMeet(google, 'test@example.com', input, slot, async () => {});
  assert.notEqual(first.onlineUrl, second.onlineUrl);
  assert.equal(requests.filter(r => r.options.method === 'PATCH').length, 2);
  assert.notEqual(events.get('1').conferenceData.createRequest.requestId, events.get('2').conferenceData.createRequest.requestId);
});
test('si Meet falla revierte el evento sin enviar una invitación incompleta', async () => {
  const calls = [];
  const google = async (path, options = {}) => {
    calls.push({ path, method: options.method });
    if (options.method === 'POST') return { id: 'failed-event', conferenceData: { createRequest: { status: { statusCode: 'failure' } } } };
    if (options.method === 'DELETE') return null;
    throw new Error('Unexpected request');
  };
  await assert.rejects(reserveWithMeet(google, 'calendar', { name: 'Ana', email: 'ana@example.com' }, slot, async () => {}), { code: 'MEET_UNAVAILABLE' });
  assert.deepEqual(calls.map(call => call.method), ['POST','DELETE']);
  assert.ok(calls.every(call => call.path.includes('sendUpdates=none')));
});
test('si Meet queda pendiente se agotan los intentos y se revierte el evento', async () => {
  let reads = 0, deletes = 0;
  const pending = { id: 'pending-event', conferenceData: { createRequest: { status: { statusCode: 'pending' } } } };
  const google = async (path, options = {}) => {
    if (options.method === 'POST') return pending;
    if (options.method === 'DELETE') { deletes++; return null; }
    reads++; return pending;
  };
  await assert.rejects(reserveWithMeet(google, 'calendar', { name: 'Ana', email: 'ana@example.com' }, slot, async () => {}), { code: 'MEET_UNAVAILABLE' });
  assert.equal(reads, 5); assert.equal(deletes, 1);
});
test('cliente admite la respuesta 204 al eliminar un evento provisional', async () => {
  let count = 0;
  const google = createGoogleClient({}, async () => ++count === 1 ? Response.json({ access_token: 'fake', expires_in: 3600 }) : new Response(null, { status: 204 }));
  assert.equal(await google('calendars/calendar/events/event', { method: 'DELETE' }), null);
});
test('no cancela el evento si la notificación final queda incierta', async () => {
  const methods = [];
  const google = async (path, options = {}) => {
    methods.push(options.method);
    if (options.method === 'POST') return { id: 'event', hangoutLink: 'https://meet.google.com/unique-event' };
    throw new Error('Notification update timed out');
  };
  await assert.rejects(reserveWithMeet(google, 'calendar', { name: 'Ana', email: 'ana@example.com' }, slot), /Notification update timed out/);
  assert.deepEqual(methods, ['POST','PATCH']);
});
test('diagnóstico de error de Google conserva etapa y código sin incluir mensajes privados', async () => {
  let calls = 0;
  const google = createGoogleClient({}, async () => ++calls === 1
    ? Response.json({ access_token:'fake', expires_in:3600 })
    : Response.json({ error:{ message:'private-secret-and-patient-email', errors:[{reason:'forbidden'}] } }, {status:403}));
  await assert.rejects(google('calendars/calendar/events', {method:'PATCH'}), error => {
    error.phase='enviar_invitacion';
    assert.equal(googleDiagnostic(error), '[Agenda] etapa=enviar_invitacion; HTTP=403; motivo=forbidden');
    assert.ok(!String(error).includes('private-secret-and-patient-email'));
    return true;
  });
});
test('fallo de invitación informa que hay que revisar el evento y conserva su Meet', async () => {
  const google=async (path, options={})=>{
    if(options.method==='POST')return {id:'event',hangoutLink:'https://meet.google.com/unique-event'};
    const error=new Error('Google calendar request failed');error.httpStatus=403;error.googleReason='forbidden';throw error;
  };
  await assert.rejects(reserveWithMeet(google,'calendar',{name:'Ana',email:'ana@example.com'},slot),error=>{
    assert.equal(error.reservationNeedsReview,true);
    assert.equal(error.phase,'enviar_invitacion');
    assert.equal(error.onlineUrl,'https://meet.google.com/unique-event');
    return true;
  });
});
