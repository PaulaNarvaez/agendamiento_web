import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

test('fallar al leer horarios no se presenta como una reserva incierta ni expone errores privados', async t=>{
 const dir=await mkdtemp(join(tmpdir(),'camila-read-error-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const mock=join(dir,'mock.mjs');
 await writeFile(mock,`globalThis.fetch=async()=>Response.json({error:'invalid_grant',error_description:'fake-private-description'},{status:400});`);
 const child=spawn(process.execPath,['--import',pathToFileURL(mock).href,'server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',GOOGLE_CLIENT_ID:'fake',GOOGLE_CLIENT_SECRET:'fake-secret',GOOGLE_REFRESH_TOKEN:'fake-refresh',GOOGLE_ACCOUNT_EMAIL:'t.frecuenciaamorosa@gmail.com',GOOGLE_CALENDAR_ID:'t.frecuenciaamorosa@gmail.com',SESSION_DURATION_MINUTES:'55',SESSION_PRICE_CLP:'30000',AVAILABLE_WEEKDAYS:'0,1,2,3,4,5,6',AVAILABLE_HOURS:'10:00',AVAILABLE_HOURS_BY_DAY:''},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 let stderr='';child.stderr.on('data',d=>stderr+=d);
 const port=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(Error('Servidor no inició')),5000);child.stdout.on('data',d=>{out+=d;const m=out.match(/Local: http:\/\/localhost:(\d+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});child.once('exit',()=>{clearTimeout(timeout);reject(Error('Servidor terminó'));});});
 const base=`http://127.0.0.1:${port}`;const config=await(await fetch(base+'/api/config')).json();
 const tomorrow=new Date(config.today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const response=await fetch(base+'/api/availability?date='+tomorrow.toISOString().slice(0,10));const body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,'AVAILABILITY_UNAVAILABLE');assert.match(body.error,/horarios/);assert.doesNotMatch(body.error,/reserva|fake-private|invalid_grant/i);
 await new Promise(resolve=>setImmediate(resolve));assert.match(stderr,/motivo=invalid_grant/);assert.doesNotMatch(stderr,/fake-private|fake-secret|fake-refresh/);
});
