import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

async function setup(t, input) {
  const directory = await mkdtemp(join(tmpdir(), 'camila-session-setup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const original = 'GOOGLE_CLIENT_SECRET="fake-private-secret"\nGOOGLE_REFRESH_TOKEN="fake-private-refresh"\nGOOGLE_ACCOUNT_EMAIL=pruebacami12@gmail.com\nSESSION_DURATION_MINUTES=\nSESSION_PRICE_CLP=\nAVAILABLE_WEEKDAYS=\nAVAILABLE_HOURS=\n';
  await writeFile(join(directory, '.env'), original);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/setup-sessions.js', import.meta.url))], { cwd: directory, input, encoding:'utf8' });
  return { result, original, contents: await readFile(join(directory,'.env'),'utf8') };
}
test('guarda las cuatro variables y conserva las credenciales sin imprimirlas', async t => {
  const {result,contents}=await setup(t,'50\n30.000\n1,2,3,4,5\n9:00,10:00,15:00\n');
  assert.equal(result.status,0,result.stderr);
  const env=parseEnv(contents);
  assert.equal(env.SESSION_DURATION_MINUTES,'50');assert.equal(env.SESSION_PRICE_CLP,'30000');
  assert.equal(env.AVAILABLE_WEEKDAYS,'1,2,3,4,5');assert.equal(env.AVAILABLE_HOURS,'09:00,10:00,15:00');
  assert.equal(env.GOOGLE_CLIENT_SECRET,'fake-private-secret');assert.equal(env.GOOGLE_REFRESH_TOKEN,'fake-private-refresh');
  assert.ok(!result.stdout.includes('fake-private'));
});
test('si el usuario interrumpe no guarda una configuración incompleta', async t => {
  const {result,contents,original}=await setup(t,'50\n');
  assert.equal(result.status,1);assert.equal(contents,original);
});
test('rechaza valores inválidos y horas superpuestas antes de guardar', async t => {
  const {result,contents}=await setup(t,'0\n50\ninvalid\n30000\n8\n1,2\n09:00,09:30\n09:00,10:00\n');
  assert.equal(result.status,0,result.stderr);
  assert.equal(parseEnv(contents).AVAILABLE_HOURS,'09:00,10:00');
  assert.equal((result.stdout.match(/Valor no válido/g)||[]).length,4);
});
