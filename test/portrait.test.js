import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPortrait } from '../portrait.js';

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'camila-portrait-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
test('acepta JPEG y mayúsculas, e indica su tipo real según la extensión', async t => {
  const path = await directory(t);
  await writeFile(join(path,'CAMILA.JPEG'),'test-image');
  assert.deepEqual(await findPortrait(path), { name:'CAMILA.JPEG', type:'image/jpeg' });
});
test('si solo existe una foto la detecta aunque conserve el nombre del teléfono', async t => {
  const path = await directory(t);
  await writeFile(join(path,'IMG_20261022.PNG'),'test-image');
  assert.deepEqual(await findPortrait(path), { name:'IMG_20261022.PNG', type:'image/png' });
});
test('si hay varias fotos prefiere camila y evita elegir otras arbitrariamente', async t => {
  const path = await directory(t);
  await writeFile(join(path,'one.jpg'),'test-image');
  await writeFile(join(path,'two.png'),'test-image');
  assert.equal(await findPortrait(path),null);
  await writeFile(join(path,'camila.webp'),'test-image');
  assert.deepEqual(await findPortrait(path),{name:'camila.webp',type:'image/webp'});
});
test('no sirve enlaces simbólicos como fotografías', async t => {
  const path = await directory(t);
  await writeFile(join(path,'private.txt'),'test-private');
  try { await symlink(join(path,'private.txt'),join(path,'camila.jpg')); }
  catch (error) { if (error.code === 'EPERM') { t.skip('El sistema no permite crear enlaces simbólicos sin permisos adicionales.'); return; } throw error; }
  assert.equal(await findPortrait(path),null);
});
