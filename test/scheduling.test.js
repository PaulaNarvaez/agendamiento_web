import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { instant, slotsFor, validDate, validateBooking } from '../scheduling.js';
test('Chile: los horarios respetan el cambio de hora', () => {
  assert.equal(instant('2026-07-06', '09:00').toISOString(), '2026-07-06T13:00:00.000Z');
  assert.equal(instant('2026-12-07', '09:00').toISOString(), '2026-12-07T12:00:00.000Z');
});
test('excluye horas pasadas y superpuestas; permite eventos contiguos', () => {
  const busy = [{ start: '2026-12-07T13:00:00Z', end: '2026-12-07T14:00:00Z' }];
  assert.deepEqual(slotsFor('2026-12-07', ['09:00','10:00','11:00'], 50, busy, new Date('2026-12-07T12:10:00Z')).map(s => s.hour), ['11:00']);
});
test('valida fechas, consentimiento, correo y modalidad', () => {
  assert.equal(validDate('2026-02-30'), false);
  const input = { name: 'Ana Pérez', email: 'ana@example.com', date: '2026-12-07', hour: '09:00', mode: 'online', consent: true };
  assert.equal(validateBooking(input), true);
  for (const change of [{ consent: false }, { email: 'inválido' }, { mode: 'otro' }, { mode: 'presencial' }, { name: '' }]) assert.equal(validateBooking({ ...input, ...change }), false);
});
test('servidor: página, agenda, rechazo de reserva demo y rutas protegidas', async t => {
  const child = spawn(process.execPath, ['server.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '3198', GOOGLE_CLIENT_ID: '' }, stdio: ['ignore','pipe','pipe'] });
  t.after(() => child.kill());
  await once(child.stdout, 'data');
  const base = 'http://127.0.0.1:3198';
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Camila Leiva/);
  const config = await (await fetch(base+'/api/config')).json(); assert.equal(config.demo, true); assert.equal(config.modality, 'online');
  const date = new Date(`${config.today}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+1); while ([0,6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate()+1);
  const response = await fetch(base+'/api/availability?date='+date.toISOString().slice(0,10));
  const agenda = await response.json(); assert.equal(response.status,200); assert.ok(agenda.slots.length>0);
  assert.equal((await fetch(base+'/api/availability?date=2026-02-30')).status,400);
  assert.equal((await fetch(base+'/api/bookings', { method:'POST', body:'{}' })).status,409);
  assert.equal((await fetch(base+'/.git/config')).status,404);
});
