export const requiredSettings = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_ID',
  'SESSION_DURATION_MINUTES',
  'AVAILABLE_WEEKDAYS',
  'AVAILABLE_HOURS',
  'SESSION_PRICE_CLP',
];

export function missingSettings(environment = process.env) {
  return requiredSettings.filter(name => !environment[name]?.trim());
}

export function configurationReport(environment = process.env) {
  const missing = missingSettings(environment);
  if (!missing.length) return 'Configuración completa. Reinicia npm.cmd start y recarga la página. La conexión real con Google se comprueba al consultar la agenda.';
  const lines = ['Las reservas están deshabilitadas porque faltan estos campos en .env:'];
  lines.push(...missing.map(name => `  - ${name}`));
  if (missing.includes('GOOGLE_REFRESH_TOKEN')) lines.push('Para generar GOOGLE_REFRESH_TOKEN, completa la autorización con npm.cmd run connect:google.');
  lines.push('Completa los campos indicados en tu .env local, guarda y reinicia el servidor.');
  lines.push('No compartas el archivo .env ni sus valores. Este informe solo muestra nombres.');
  return lines.join('\n');
}
