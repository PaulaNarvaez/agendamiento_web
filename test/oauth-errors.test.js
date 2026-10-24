import test from 'node:test';
import assert from 'node:assert/strict';
import { oauthExchangeFailure } from '../scripts/oauth-errors.js';

test('error de secreto identifica invalid_client sin mostrar detalles privados', async () => {
  const error=await oauthExchangeFailure(Response.json({error:'invalid_client',error_description:'private-secret'},{status:401}));
  assert.match(error.message,/GOOGLE_CLIENT_SECRET/);
  assert.equal(error.oauthDiagnostic,'[OAuth] HTTP=401; motivo=invalid_client');
  assert.ok(!String(error).includes('private-secret'));
});
test('código vencido propone iniciar una autorización nueva', async () => {
  const error=await oauthExchangeFailure(Response.json({error:'invalid_grant'},{status:400}));
  assert.match(error.message,/enlace nuevo/);
  assert.equal(error.oauthDiagnostic,'[OAuth] HTTP=400; motivo=invalid_grant');
});
test('respuestas desconocidas no se imprimen ni se convierten en códigos arbitrarios', async () => {
  const error=await oauthExchangeFailure(Response.json({error:'unexpected-private-value',error_description:'private-token'},{status:400}));
  assert.equal(error.oauthDiagnostic,'[OAuth] HTTP=400; motivo=unknown');
  assert.ok(!String(error).includes('unexpected-private-value'));
  assert.ok(!String(error).includes('private-token'));
});
