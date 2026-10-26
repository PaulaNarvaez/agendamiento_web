import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const clientId='123456789-testclient.apps.googleusercontent.com';
const script=fileURLToPath(new URL('../scripts/setup-env.js',import.meta.url));
async function directory(t) {
  const path=await mkdtemp(join(tmpdir(),'camila-env-setup-'));
  t.after(()=>rm(path,{recursive:true,force:true}));
  await writeFile(join(path,'.env.example'),'PORT=3000\nGOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nGOOGLE_REFRESH_TOKEN=\nGOOGLE_ACCOUNT_EMAIL=pruebacami12@gmail.com\nGOOGLE_CALENDAR_ID=pruebacami12@gmail.com\nSESSION_DURATION_MINUTES=\n');
  return path;
}
function run(path,input,args=[]) { return spawnSync(process.execPath,[script,...args],{cwd:path,input,encoding:'utf8'}); }
test('crea un .env vacío con los datos locales y no imprime el secreto',async t=>{
  const path=await directory(t);await writeFile(join(path,'.env'),'');
  const result=run(path,clientId+'\nfake-private-secret\n');
  assert.equal(result.status,0,result.stderr);
  const env=parseEnv(await readFile(join(path,'.env'),'utf8'));
  assert.equal(env.GOOGLE_CLIENT_ID,clientId);assert.equal(env.GOOGLE_CLIENT_SECRET,'fake-private-secret');
  assert.equal(env.GOOGLE_ACCOUNT_EMAIL,'pruebacami12@gmail.com');assert.equal(env.GOOGLE_REFRESH_TOKEN,'');
  assert.ok(!result.stdout.includes('fake-private-secret'));assert.ok(!result.stderr.includes('fake-private-secret'));
});
test('conserva credenciales, token y horarios que ya estaban configurados',async t=>{
  const path=await directory(t);
  await writeFile(join(path,'.env'),`GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=fake-private-secret\nGOOGLE_REFRESH_TOKEN=fake-existing-refresh\nGOOGLE_ACCOUNT_EMAIL=pruebacami12@gmail.com\nGOOGLE_CALENDAR_ID=pruebacami12@gmail.com\nAVAILABLE_HOURS=09:00\n`);
  const result=run(path,'');assert.equal(result.status,0,result.stderr);
  const env=parseEnv(await readFile(join(path,'.env'),'utf8'));
  assert.equal(env.GOOGLE_REFRESH_TOKEN,'fake-existing-refresh');assert.equal(env.AVAILABLE_HOURS,'09:00');
  assert.ok(!result.stdout.includes('fake-existing-refresh'));
});
test('cambiar de cuenta descarta el token anterior y conserva los datos de atención',async t=>{
  const path=await directory(t);
  await writeFile(join(path,'.env'),`GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=fake-private-secret\nGOOGLE_REFRESH_TOKEN=fake-old-refresh\nGOOGLE_ACCOUNT_EMAIL=old@example.com\nGOOGLE_CALENDAR_ID=old@example.com\nSESSION_PRICE_CLP=30000\n`);
  assert.equal(run(path,'').status,0);
  const env=parseEnv(await readFile(join(path,'.env'),'utf8'));
  assert.equal(env.GOOGLE_REFRESH_TOKEN,'');assert.equal(env.GOOGLE_CALENDAR_ID,'pruebacami12@gmail.com');assert.equal(env.SESSION_PRICE_CLP,'30000');
});
test('si se interrumpe la configuración no sobrescribe el archivo privado',async t=>{
  const path=await directory(t);await writeFile(join(path,'.env'),'EXISTING_SETTING=keep-me\n');
  const result=run(path,'');assert.equal(result.status,1);
  assert.equal(await readFile(join(path,'.env'),'utf8'),'EXISTING_SETTING=keep-me\n');
});
test('permite reemplazar el secreto sin mostrarlo y solicita nueva autorización',async t=>{
  const path=await directory(t);
  await writeFile(join(path,'.env'),`GOOGLE_CLIENT_ID=${clientId}\nGOOGLE_CLIENT_SECRET=fake-old-secret\nGOOGLE_REFRESH_TOKEN=fake-old-refresh\nGOOGLE_ACCOUNT_EMAIL=pruebacami12@gmail.com\nGOOGLE_CALENDAR_ID=pruebacami12@gmail.com\n`);
  const result=run(path,'\nfake-new-secret\n',['--replace-google']);assert.equal(result.status,0,result.stderr);
  const env=parseEnv(await readFile(join(path,'.env'),'utf8'));
  assert.equal(env.GOOGLE_CLIENT_SECRET,'fake-new-secret');assert.equal(env.GOOGLE_REFRESH_TOKEN,'');
  assert.ok(!result.stdout.includes('fake-new-secret'));assert.ok(!result.stdout.includes('fake-old-secret'));
});
