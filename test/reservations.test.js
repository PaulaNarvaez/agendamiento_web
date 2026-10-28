import test from 'node:test';
import assert from 'node:assert/strict';
import { listSessions, getSession, moveTimes, moveSession, cancelSession } from '../reservations.js';
const event = { id: 'abc123', etag: '"v1"', summary: 'Sesión online · Camila Leiva, psicóloga', start: { dateTime: '2030-01-10T12:00:00Z' }, end: { dateTime: '2030-01-10T12:50:00Z' }, attendees: [{ email: 'paciente@example.test', displayName: 'Paciente' }], description: 'Nota administrativa.\nFecha: antigua.\nHorario: anterior.', hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc' };
test('busca pacientes en todas las páginas y excluye eventos ajenos', async () => {
 let count = 0;
 const rows = await listSessions(async path => { count++; return path.includes('pageToken=') ? { items: [event] } : { items: [{ ...event, summary: 'Privado' }], nextPageToken: 'next' }; }, 'calendar', '2030-01-01', '2030-02-01', 'PACIENTE');
 assert.equal(count, 2); assert.deepEqual(rows, [event]);
});
test('impide modificar eventos ajenos, recurrentes o sin versión', async () => {
 for (const changed of [{ summary: 'Otro' }, { recurringEventId: 'series' }, { etag: null }]) await assert.rejects(getSession(async () => ({ ...event, ...changed }), 'calendar', event.id));
});
test('reprograma conservando duración, Meet e invitados; usa If-Match y notificaciones', async () => {
 const slot = moveTimes(event, '2030-01-12', '11:00', new Date('2029-01-01'));
 assert.equal(Date.parse(slot.end) - Date.parse(slot.start), 50 * 60000);
 const calls = [];
 await moveSession(async (path, options) => { calls.push({path, options}); return options ? { id: event.id } : { items: [event] }; }, 'calendar', event, slot);
 const patch = calls[1];const body = JSON.parse(patch.options.body);
 assert.equal(patch.options.headers['If-Match'], event.etag); assert.match(patch.path, /sendUpdates=all/);
 assert.equal(body.attendees, undefined); assert.equal(body.conferenceData, undefined); assert.match(body.description, /11:00/); assert.match(body.description, /Nota administrativa/);
});
test('bloquea conflictos de otro evento, incluso en páginas posteriores', async () => {
 let calls = 0;
 await assert.rejects(moveSession(async () => { calls++; return calls === 1 ? {items: [event], nextPageToken: 'next'} : {items: [{ ...event, id: 'occupied' }]}; }, 'calendar', event, { start: '2030-01-12T14:00:00Z', end: '2030-01-12T14:50:00Z' }), /ocupado/);
 assert.equal(calls, 2);
});
test('cancelación notifica a los invitados y comprueba la versión del evento', async () => {
 await cancelSession(async (path, options) => { assert.match(path, /abc123\?sendUpdates=all$/); assert.equal(options.method, 'DELETE'); assert.equal(options.headers['If-Match'], event.etag); }, 'calendar', event);
});
test('rechaza horarios pasados, inválidos y fechas normalizadas', () => {
 for (const [date, hour] of [['2030-02-30','10:00'], ['2030-01-12','25:00'], ['2020-01-01','10:00']]) assert.throws(() => moveTimes(event,date,hour));
});
