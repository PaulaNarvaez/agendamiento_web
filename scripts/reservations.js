import { createInterface } from 'node:readline/promises';
import { createGoogleClient, googleDiagnostic } from '../calendar.js';
import { organizerConfigurationIssue, organizerEmail } from '../configuration.js';
import { localDate, zone } from '../scheduling.js';
import { listSessions, getSession, moveTimes, moveSession, cancelSession } from '../reservations.js';

const help = `Administrar reservas (Google Calendar real)
  npm.cmd run reservas
  npm.cmd run reservas -- listar --buscar "nombre o correo"
  npm.cmd run reservas -- listar --desde 2026-10-01 --hasta 2026-12-01
  npm.cmd run reservas -- ver ID
  npm.cmd run reservas -- mover ID AAAA-MM-DD HH:MM
  npm.cmd run reservas -- cancelar ID

Sin fechas: hoy y los próximos 90 días. --hasta es exclusiva.
Hora de Chile. Copia el ID completo desde la lista. Mover/cancelar pide confirmación.
No requiere iniciar el servidor; sí el .env local conectado a Google.
La lista contiene datos de pacientes: úsala solo en tu terminal privada.`;
const args = process.argv.slice(2);
const command = args.shift() || 'listar';
const clean = value => String(value || '').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').slice(0, 300);
const dateLabel = value => new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short', timeZone: zone }).format(new Date(value));
function show(event) {
  console.log(`\nID: ${clean(event.id)}\n  ${dateLabel(event.start.dateTime)} → ${dateLabel(event.end.dateTime)} (Chile)`);
  for (const person of event.attendees || []) if (!person.organizer) console.log(`  ${clean(person.displayName)} <${clean(person.email)}>`);
}
async function confirm(event, action) {
  show(event);
  if (!process.stdin.isTTY) throw new Error('Para confirmar usa una terminal interactiva. No se hizo ningún cambio.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(`${action}\nGoogle recibirá la solicitud de notificar a los invitados. Escribe CONFIRMAR: `)).trim() === 'CONFIRMAR'; }
  finally { rl.close(); }
}
try {
  if (command === '--help' || command === 'ayuda') { console.log(help); process.exit(0); }
  if (!['listar', 'ver', 'mover', 'cancelar'].includes(command)) throw new Error(help);
  if (!['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REFRESH_TOKEN'].every(key => process.env[key]?.trim())) throw new Error('Faltan credenciales de Google en el .env local. Ejecuta npm.cmd run setup:google y npm.cmd run connect:google.');
  if (organizerConfigurationIssue()) throw new Error(organizerConfigurationIssue());
  const google = createGoogleClient({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, refreshToken: process.env.GOOGLE_REFRESH_TOKEN, accountEmail: organizerEmail });
  const calendar = process.env.GOOGLE_CALENDAR_ID;
  if (command === 'listar') {
    const options = {};
    while (args.length) { const key = args.shift(); if (!['--buscar','--desde','--hasta'].includes(key) || !args.length || options[key]) throw new Error(help); options[key] = args.shift(); }
    const future = new Date(); future.setUTCDate(future.getUTCDate() + 90);
    const sessions = await listSessions(google, calendar, options['--desde'] || localDate(), options['--hasta'] || localDate(future), options['--buscar']);
    console.log(`Reservas encontradas: ${sessions.length}. Horario de Chile.`);
    sessions.forEach(show);
  } else {
    const expected = command === 'mover' ? 3 : 1;
    if (args.length !== expected) throw new Error(help);
    const event = await getSession(google, calendar, args[0]);
    if (command === 'ver') show(event);
    else if (command === 'cancelar') {
      if (!await confirm(event, 'Cancelar esta reserva y liberar su horario.')) console.log('Operación cancelada.');
      else { await cancelSession(google, calendar, event); console.log('Reserva cancelada. Google aceptó la solicitud de notificación; no verifica la entrega del correo.'); }
    } else {
      const slot = moveTimes(event, args[1], args[2]);
      if (!await confirm(event, `Mover a ${dateLabel(slot.start)} (Chile). Se conserva duración, invitados y Meet. Puede ser fuera de los horarios publicados.`)) console.log('Operación cancelada.');
      else { await moveSession(google, calendar, event, slot); console.log('Reserva reprogramada. Google aceptó la solicitud de notificación; no verifica la entrega del correo.'); }
    }
  }
} catch (error) {
  if (error.httpStatus || error.googleReason || error.name === 'TimeoutError' || error instanceof TypeError) {
    console.error(googleDiagnostic(error));
    console.error(error.httpStatus === 412 ? 'La reserva cambió mientras la revisabas. Vuelve a consultarla.' : 'No se pudo confirmar la operación. Revisa el evento en Google Calendar antes de repetirla.');
  } else console.error(error.message);
  process.exitCode = 1;
}
