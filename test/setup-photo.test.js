import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../scripts/setup-photo.js',import.meta.url));
async function directory(t){const path=await mkdtemp(join(tmpdir(),'camila-photo-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
test('copia la foto sin alterar sus bytes y usa el nombre que carga la web',async t=>{
  const path=await directory(t);const file=join(path,'Foto Camila.JPEG');const bytes=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3,0xff,0xd9]);
  await writeFile(file,bytes);
  const result=spawnSync(process.execPath,[script,file],{cwd:path,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(await readFile(join(path,'public','camila.jpg')),bytes);
});
test('al reemplazar la foto conserva el archivo anterior en un respaldo local',async t=>{
  const path=await directory(t);await mkdir(join(path,'public'));const previous=Buffer.from([0xff,0xd8,0xff,1]);const next=Buffer.from([0xff,0xd8,0xff,2]);
  await writeFile(join(path,'public','camila.jpg'),previous);await writeFile(join(path,'new.jpg'),next);
  assert.equal(spawnSync(process.execPath,[script,join(path,'new.jpg')],{cwd:path,encoding:'utf8'}).status,0);
  const backups=await readdir(join(path,'.local-backups'));assert.equal(backups.length,1);
  assert.deepEqual(await readFile(join(path,'.local-backups',backups[0])),previous);
});
test('rechaza un archivo que solo cambió de extensión sin tocar la foto existente',async t=>{
  const path=await directory(t);await mkdir(join(path,'public'));await writeFile(join(path,'public','camila.jpg'),'previous');await writeFile(join(path,'not-a-photo.jpg'),'invalid');
  assert.equal(spawnSync(process.execPath,[script,join(path,'not-a-photo.jpg')],{cwd:path,encoding:'utf8'}).status,1);
  assert.equal(await readFile(join(path,'public','camila.jpg'),'utf8'),'previous');
});
test('importa PNG sin convertirla y retira la JPG antigua después de respaldarla',async t=>{
  const path=await directory(t);await mkdir(join(path,'public'));
  await writeFile(join(path,'public','camila.jpg'),'previous-jpg');
  const png=Buffer.from([137,80,78,71,13,10,26,10,1,2]);await writeFile(join(path,'new.png'),png);
  const result=spawnSync(process.execPath,[script,join(path,'new.png')],{cwd:path,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(await readFile(join(path,'public','camila.png')),png);
  assert.ok(!(await readdir(join(path,'public'))).includes('camila.jpg'));
  const backups=await readdir(join(path,'.local-backups'));assert.equal(backups.length,1);
  assert.equal(await readFile(join(path,'.local-backups',backups[0]),'utf8'),'previous-jpg');
});
