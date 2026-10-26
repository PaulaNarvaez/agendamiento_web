import test from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress } from '../client-address.js';

test('sin proxy configurado no confía en cabeceras enviadas por el visitante',()=>{
  assert.equal(clientAddress({socket:{remoteAddress:'192.0.2.1'},headers:{'x-forwarded-for':'198.51.100.1'}}),'192.0.2.1');
});
test('con un proxy usa la última IP añadida y no una dirección falsa al principio',()=>{
  assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'203.0.113.99, 198.51.100.1'}},1),'198.51.100.1');
});
test('una cabecera mal formada vuelve a la dirección de la conexión',()=>{
  assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'invalid, 198.51.100.1'}},1),'127.0.0.1');
});
