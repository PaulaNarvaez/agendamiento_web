import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyHours, camilaSchedule } from '../weekly-hours.js';
import { instant, slotsFor } from '../scheduling.js';
import { missingSettings } from '../configuration.js';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

test('miércoles y viernes tienen horas propias, respetan almuerzo y duración 55', () => {
 const settings=camilaSchedule('20:00','13:00');const {duration,days,schedule}=weeklyHours(settings);
 assert.equal(duration,55);assert.deepEqual(days,[3,5]);
 assert.deepEqual(schedule[3],['15:00','16:00','17:00','18:00','19:00']);
 assert.deepEqual(schedule[5],['10:00','11:00','12:00','15:00','16:00','17:00','18:00']);
 assert.equal(schedule[1],undefined);assert.ok(!schedule[3].includes('10:00'));
 const wed=slotsFor('2030-01-09',schedule[3],duration,[],new Date('2029-01-01'));
 assert.equal(wed.at(-1).end,instant('2030-01-09','19:55').toISOString());
 assert.ok(wed.every(s=>Date.parse(s.end)-Date.parse(s.start)===55*60000));
 const fri=slotsFor('2030-01-11',schedule[5],duration,[{start:instant('2030-01-11','15:00'),end:instant('2030-01-11','15:55')}],new Date('2029-01-01'));
 assert.ok(!fri.some(s=>['13:00','14:00','15:00'].includes(s.hour)));
});
test('rechaza JSON inválido, días incorrectos y horas superpuestas sin usar el horario antiguo',()=>{
 const valid=camilaSchedule('20:00','13:00');
 for(const value of ['bad','[]','null','{}','{"3":["15:00"]}','{"3":["25:00"],"5":["10:00"]}','{"3":["15:00","15:30"],"5":["10:00"]}','{"3":["15:00"],"5":["10:00"],"1":["11:00"]}']) assert.throws(()=>weeklyHours({...valid,AVAILABLE_HOURS_BY_DAY:value,AVAILABLE_HOURS:'09:00'}));
});
test('conserva configuración anterior si no hay horarios por día',()=>{
 assert.deepEqual(weeklyHours({SESSION_DURATION_MINUTES:'50',AVAILABLE_WEEKDAYS:'1,2',AVAILABLE_HOURS:'09:00,10:00'}).schedule,{1:['09:00','10:00'],2:['09:00','10:00']});
 assert.ok(!missingSettings(camilaSchedule('20:00','13:00')).includes('AVAILABLE_HOURS'));
});
test('guardar agenda confirmada conserva Google y precio, no imprime secretos',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'camila-weekly-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const original='GOOGLE_CLIENT_SECRET=fake-private-secret\nGOOGLE_REFRESH_TOKEN=fake-private-refresh\nSESSION_PRICE_CLP=30000\nAVAILABLE_WEEKDAYS=1,2,3,4,5\nAVAILABLE_HOURS=09:00\n';
 await writeFile(join(dir,'.env'),original);
 const script=fileURLToPath(new URL('../scripts/setup-agenda.js',import.meta.url));
 const result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes('fake-private'));
 const env=parseEnv(await readFile(join(dir,'.env'),'utf8'));
 assert.equal(env.GOOGLE_CLIENT_SECRET,'fake-private-secret');assert.equal(env.GOOGLE_REFRESH_TOKEN,'fake-private-refresh');assert.equal(env.SESSION_PRICE_CLP,'30000');assert.equal(env.AVAILABLE_WEEKDAYS,'3,5');assert.equal(env.AVAILABLE_HOURS,'');assert.equal(weeklyHours(env).duration,55);
});

test('API aplica horarios por día y rechaza reservas fuera de agenda', async t=>{
 const {spawn}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'camila-weekly-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const mock=join(dir,'google.mjs');
 await writeFile(mock,`globalThis.fetch=async(url)=>{if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fake',expires_in:3600});if(url==='https://openidconnect.googleapis.com/v1/userinfo')return Response.json({email:'t.frecuenciaamorosa@gmail.com',email_verified:true});if(url.endsWith('/freeBusy'))return Response.json({calendars:{'t.frecuenciaamorosa@gmail.com':{busy:[]}}});throw new Error('No se debe crear ningún evento en esta prueba');}`);
 const {pathToFileURL}=await import('node:url');
 const child=spawn(process.execPath,['--import',pathToFileURL(mock).href,'server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,...camilaSchedule('20:00','13:00'),PORT:'0',GOOGLE_CLIENT_ID:'fake',GOOGLE_CLIENT_SECRET:'fake',GOOGLE_REFRESH_TOKEN:'fake',GOOGLE_CALENDAR_ID:'t.frecuenciaamorosa@gmail.com',GOOGLE_ACCOUNT_EMAIL:'t.frecuenciaamorosa@gmail.com',SESSION_PRICE_CLP:'30000'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 const port=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('No inició servidor')),5000);child.stdout.on('data',c=>{out+=c;const m=out.match(/Local: http:\/\/localhost:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Falló servidor'));});});
 const base=`http://127.0.0.1:${port}`;const config=await(await fetch(base+'/api/config')).json();assert.deepEqual(config.weekdays,[3,5]);assert.equal(config.duration,55);
 for(const day of [1,3,5]){
  const date=new Date(config.today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);while(date.getUTCDay()!==day)date.setUTCDate(date.getUTCDate()+1);
  const value=date.toISOString().slice(0,10);const availability=await(await fetch(base+'/api/availability?date='+value)).json();
  assert.deepEqual(availability.slots.map(s=>s.hour),day===1?[]:JSON.parse(camilaSchedule('20:00','13:00').AVAILABLE_HOURS_BY_DAY)[day]);
  const response=await fetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:value,hour:day===3?'10:00':'13:00',name:'Paciente prueba',email:'test@example.test',mode:'online',consent:true})});
  assert.equal(response.status,409);
 }
});
