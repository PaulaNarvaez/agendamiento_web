import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleCredentials } from '../scripts/google-json.js';

const credentials = {web:{client_id:'123456789-testclient.apps.googleusercontent.com',client_secret:'fake-private-json-secret',redirect_uris:['http://127.0.0.1:53682/callback']}};
test('importa el ID y secreto del mismo cliente sin utilizar URLs suministradas como destinos',()=>{
  assert.deepEqual(parseGoogleCredentials(JSON.stringify(credentials)),{clientId:credentials.web.client_id,clientSecret:credentials.web.client_secret});
});
test('rechaza JSON incompleto sin incluir su contenido en el error',()=>{
  assert.throws(()=>parseGoogleCredentials('{"client_secret":"fake-private-json-secret"'),error=>!error.message.includes('fake-private-json-secret')&&error.message.includes('JSON no válido'));
});
test('rechaza un cliente web sin la URI de retorno del asistente',()=>{
  assert.throws(()=>parseGoogleCredentials(JSON.stringify({web:{...credentials.web,redirect_uris:['https://other.example.com']}})),/53682\/callback/);
});
