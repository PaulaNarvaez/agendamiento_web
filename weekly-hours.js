// Cada día tiene su propia lista de horas de inicio, en horario de Chile.
export function weeklyHours(environment = process.env) {
  const duration = Number(environment.SESSION_DURATION_MINUTES || 50);
  const days = (environment.AVAILABLE_WEEKDAYS || '1,2,3,4,5').split(',').map(part => Number(part.trim()));
  if (!Number.isInteger(duration) || duration < 15 || duration > 180 || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Configuración de duración o días no válida.');
  let source;
  if (environment.AVAILABLE_HOURS_BY_DAY?.trim()) {
    try { source = JSON.parse(environment.AVAILABLE_HOURS_BY_DAY); } catch { throw new Error('AVAILABLE_HOURS_BY_DAY debe contener un JSON válido.'); }
    if (!source || Array.isArray(source) || typeof source !== 'object' || Object.keys(source).some(day => !/^[0-6]$/.test(day) || !days.includes(Number(day))) || days.some(day => !Object.hasOwn(source, day))) throw new Error('AVAILABLE_HOURS_BY_DAY debe incluir exactamente los días de AVAILABLE_WEEKDAYS.');
  } else {
    const hours = (environment.AVAILABLE_HOURS || '09:00,10:00,11:00,15:00,16:00,17:00').split(',').map(part => part.trim());
    source = Object.fromEntries(days.map(day => [day, hours]));
  }
  const schedule = {};
  for (const [day, values] of Object.entries(source)) {
    if (!Array.isArray(values) || !values.length || values.some(hour => typeof hour !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))) throw new Error('Las horas de cada día deben ser una lista de inicios HH:MM.');
    const hours = [...new Set(values)].sort();
    const minute = hour => Number(hour.slice(0,2)) * 60 + Number(hour.slice(3));
    if (hours.some((hour,index) => minute(hour) + duration > 1440 || index > 0 && minute(hour) < minute(hours[index-1]) + duration)) throw new Error('Las sesiones de un mismo día no pueden superponerse ni terminar al día siguiente.');
    schedule[day] = hours;
  }
  return { duration, days: [...new Set(days)].sort(), schedule };
}

// Sesiones de 55 minutos, con 5 minutos entre cada inicio (cada hora).
export function camilaSchedule(wednesdayClose, fridayMorningClose) {
  if (!['19:00','20:00'].includes(wednesdayClose) || !['12:00','13:00'].includes(fridayMorningClose)) throw new Error('Confirma los cierres: miércoles 19:00 o 20:00; viernes por la mañana 12:00 o 13:00.');
  const starts = (first, end) => Array.from({length:end-first}, (_,index) => `${String(first+index).padStart(2,'0')}:00`);
  return {
    SESSION_DURATION_MINUTES: '55', AVAILABLE_WEEKDAYS: '3,5', AVAILABLE_HOURS: '',
    AVAILABLE_HOURS_BY_DAY: JSON.stringify({ 3: starts(15,Number(wednesdayClose.slice(0,2))), 5: [...starts(10,Number(fridayMorningClose.slice(0,2))), ...starts(15,19)] }),
  };
}
