import { createGoogleClient, googleDiagnostic, meetingLink } from '../calendar.js';
import { missingSettings, organizerConfigurationIssue, organizerEmail } from '../configuration.js';

const missing = missingSettings().filter(name => name.startsWith('GOOGLE_'));
if (missing.length) {
  console.error('Falta configurar: ' + missing.join(', '));
  process.exit(1);
}
if (organizerConfigurationIssue()) { console.error(organizerConfigurationIssue()); process.exit(1); }
const google = createGoogleClient({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, refreshToken: process.env.GOOGLE_REFRESH_TOKEN, accountEmail: organizerEmail });
try {
  const now = new Date();
  const end = new Date(now.getTime() + 90 * 86400000);
  const response = await google('freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 86400000).toISOString(), items: [{ id: process.env.GOOGLE_CALENDAR_ID }] }) });
  const calendar = response.calendars?.[process.env.GOOGLE_CALENDAR_ID];
  if (!calendar || calendar.errors?.length) throw new Error('Availability unavailable');
  console.log(`Cuenta verificada: ${organizerEmail}. Autorización y disponibilidad correctas.`);
  const query = new URLSearchParams({ timeMin: now.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '50', fields: 'items(summary,hangoutLink,conferenceData,attendees),nextPageToken' });
  const events = await google(`calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}/events?${query}`);
  const sessions = (events.items || []).filter(event => event.summary?.includes('Camila Leiva'));
  console.log('Revisión de solo lectura de los próximos eventos (máximo 50):');
  console.log(`  Sesiones de Camila: ${sessions.length}`);
  console.log(`  Con enlace Google Meet: ${sessions.filter(event => meetingLink(event)).length}`);
  console.log(`  Con invitados: ${sessions.filter(event => event.attendees?.length).length}`);
  console.log(`  Sin invitados: ${sessions.filter(event => !event.attendees?.length).length}`);
  if (events.nextPageToken) console.log('Hay más eventos: este informe solo incluye la primera página.');
  console.log('Este diagnóstico no crea, modifica ni envía eventos. No verifica entrega de correo. No muestra datos de pacientes ni credenciales.');
} catch (error) {
  console.error(googleDiagnostic(error));
  console.error('No se pudo completar la consulta de Google. Comparte solo la línea [Agenda], no tu .env.');
  process.exitCode = 1;
}
