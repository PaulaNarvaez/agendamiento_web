import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('reserva online: Calendar simulado, invitación y horario bloqueado', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'camila-google-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const mock = join(dir, 'mock.mjs');
  await writeFile(mock, `
    import assert from 'node:assert/strict';
    let event;
    globalThis.fetch = async (url, options) => {
      if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'fake', expires_in: 3600 });
      if (url.endsWith('/freeBusy')) return Response.json({ calendars: { 'heatherroseyt@gmail.com': { busy: event ? [{ start: event.start.dateTime, end: event.end.dateTime }] : [] } } });
      assert.equal(url, 'https://www.googleapis.com/calendar/v3/calendars/heatherroseyt%40gmail.com/events?sendUpdates=all');
      event = JSON.parse(options.body);
      assert.match(event.description, /Camila Leiva/);
      assert.equal(event.location, 'https://example.com/private-session');
      assert.equal(event.attendees[0].email, 'patient@example.com');
      return Response.json({ id: 'mock-event' });
    };
  `);
  const child = spawn(process.execPath, ['--import', pathToFileURL(mock).href, 'server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: '0', GOOGLE_CLIENT_ID: 'fake', GOOGLE_CLIENT_SECRET: 'fake', GOOGLE_REFRESH_TOKEN: 'fake', GOOGLE_CALENDAR_ID: 'heatherroseyt@gmail.com', SESSION_DURATION_MINUTES: '50', SESSION_PRICE_CLP: '30000', AVAILABLE_WEEKDAYS: '0,1,2,3,4,5,6', AVAILABLE_HOURS: '09:00,10:00', ONLINE_SESSION_URL: 'https://example.com/private-session' },
    stdio: ['ignore','pipe','pipe'],
  });
  t.after(() => child.kill());
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Servidor no inició')), 5000);
    child.stdout.on('data', data => { output += data; const match = output.match(/Local: http:\/\/localhost:(\d+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Servidor terminó antes de iniciar')); });
  });
  const base = `http://127.0.0.1:${port}`;
  const config = await (await fetch(base+'/api/config')).json();
  assert.equal(config.demo, false);
  const date = new Date(config.today+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+1);
  const input = { date: date.toISOString().slice(0,10), hour: '09:00', name: 'Paciente', email: 'patient@example.com', consent: true, mode: 'online' };
  const book = (data, headers = {}) => fetch(base+'/api/bookings', { method:'POST', headers:{'Content-Type':'application/json', ...headers}, body:JSON.stringify(data) });
  assert.equal((await book({ ...input, mode: 'presencial' })).status, 400);
  assert.equal((await book(input, { origin:'https://other.example.com' })).status, 403);
  const results = await Promise.all([book(input), book(input)]);
  assert.deepEqual(results.map(r=>r.status).sort(), [201,409], 'solo se confirma una reserva del mismo horario');
  const result = await results.find(r=>r.status===201).json();
  assert.equal(result.onlineUrl, 'https://example.com/private-session');
  const available = await (await fetch(base+'/api/availability?date='+input.date)).json();
  assert.deepEqual(available.slots.map(s=>s.hour), ['10:00']);
});
