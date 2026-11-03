import { readFile, writeFile, lstat, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { camilaSchedule } from '../weekly-hours.js';
const target = resolve('.env');
try {
  console.log('Agenda de Camila: solo miércoles y viernes, sesiones de 55 minutos e inicios cada hora (5 minutos de pausa).');
  console.log('Los cierres son límites de atención, no horas de inicio. El viernes por la tarde termina a las 19:00.');
  const values = camilaSchedule('20:00','13:00');
  const file = await lstat(target).catch(error => {if(error.code==='ENOENT')return null;throw error;});
  if (file && !file.isFile()) throw new Error('.env debe ser un archivo regular.');
  let contents = await readFile(file ? target : resolve('.env.example'),'utf8');
  for (const [key,value] of Object.entries(values)) {
    const pattern = new RegExp(`^(?:export\\s+)?${key}\\s*=.*$`,'gm');
    const line = `${key}='${value}'`;
    contents = pattern.test(contents) ? contents.replace(pattern,()=>line) : `${contents.trimEnd()}\n${line}\n`;
  }
  const temporary = `${target}.${randomUUID()}.tmp`;
  try { await writeFile(temporary,contents,{flag:'wx',mode:0o600});await rename(temporary,target); }
  finally {await unlink(temporary).catch(()=>{});}
  console.log(`Agenda guardada en ${target}. Google y los precios se conservan.`);
  for(const [day,hours] of Object.entries(JSON.parse(values.AVAILABLE_HOURS_BY_DAY))) console.log(`${day==='3'?'Miércoles':'Viernes'}: ${hours.join(', ')}.`);
  console.log('Reinicia npm.cmd run dev. En Render → Environment, actualiza también estas variables públicas de horarios:');
  for(const [key,value] of Object.entries(values)) console.log(`${key}=${value}`);
} catch(error) { console.error(error.code ? 'No se pudo leer o guardar .env. Revisa la carpeta y sus permisos.' : error.message);process.exitCode=1; }

