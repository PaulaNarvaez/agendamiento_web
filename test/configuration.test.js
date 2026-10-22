import test from 'node:test';
import assert from 'node:assert/strict';
import { configurationReport, missingSettings, requiredSettings } from '../configuration.js';

test('autorizar Google no activa reservas si falta configurar la sesión; no muestra secretos', () => {
  const environment = { GOOGLE_CLIENT_ID: 'fake-client', GOOGLE_CLIENT_SECRET: 'private-test-secret', GOOGLE_REFRESH_TOKEN: 'private-test-token', GOOGLE_CALENDAR_ID: 'test@example.com' };
  const report = configurationReport(environment);
  assert.deepEqual(missingSettings(environment), ['SESSION_DURATION_MINUTES','AVAILABLE_WEEKDAYS','AVAILABLE_HOURS','SESSION_PRICE_CLP']);
  for (const value of Object.values(environment)) assert.ok(!report.includes(value));
  assert.match(report, /SESSION_DURATION_MINUTES/);
});
test('detecta valores vacíos y reconoce la configuración completa', () => {
  const environment = Object.fromEntries(requiredSettings.map(name => [name, 'test']));
  assert.deepEqual(missingSettings(environment), []);
  environment.AVAILABLE_HOURS = '   ';
  assert.deepEqual(missingSettings(environment), ['AVAILABLE_HOURS']);
});
test('solo permite configurar la cuenta y calendario de pruebacami12', async () => {
  const { organizerConfigurationIssue, organizerEmail } = await import('../configuration.js');
  assert.equal(organizerConfigurationIssue({GOOGLE_ACCOUNT_EMAIL:organizerEmail,GOOGLE_CALENDAR_ID:organizerEmail}),null);
  assert.ok(organizerConfigurationIssue({GOOGLE_ACCOUNT_EMAIL:'old@example.com',GOOGLE_CALENDAR_ID:'old@example.com'}));
  assert.ok(organizerConfigurationIssue({GOOGLE_ACCOUNT_EMAIL:organizerEmail,GOOGLE_CALENDAR_ID:'old@example.com'}));
});
