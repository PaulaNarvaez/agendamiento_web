import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { requiredSettings } from '../configuration.js';

test('arranque de desarrollo se detiene indicando qué falta sin imprimir secretos', () => {
  const env = { ...process.env, ...Object.fromEntries(requiredSettings.map(key => [key, ''])), GOOGLE_CLIENT_SECRET: 'fake-private-secret' };
  const result = spawnSync(process.execPath, ['scripts/prepare-dev.js'], { cwd: new URL('../', import.meta.url), env, encoding:'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GOOGLE_CLIENT_ID/);
  assert.ok(!result.stderr.includes('fake-private-secret'));
});
test('arranque con configuración presente continúa sin volver a solicitar permisos', () => {
  const env = { ...process.env, ...Object.fromEntries(requiredSettings.map(key => [key, 'fake-test-value'])) };
  const result = spawnSync(process.execPath, ['scripts/prepare-dev.js'], { cwd: new URL('../', import.meta.url), env, encoding:'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Iniciando la agenda/);
  assert.ok(!result.stdout.includes('accounts.google.com'));
});
