export const zone = 'America/Santiago';
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function instant(date, hour) {
  const target = `${date}T${hour}:00`;
  let result = new Date(`${target}Z`);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(result).map(p => [p.type, p.value]));
    const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    result = new Date(result.getTime() + Date.parse(`${target}Z`) - represented);
  }
  return result;
}
export function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date;
}
export function slotsFor(date, hours, duration, busy = [], now = new Date()) {
  if (!validDate(date)) return [];
  return hours.map(hour => ({ hour, start: instant(date, hour), end: new Date(instant(date, hour).getTime() + duration * 60000) }))
    .filter(slot => slot.start > now && !busy.some(event => slot.start < new Date(event.end) && slot.end > new Date(event.start)))
    .map(slot => ({ hour: slot.hour, start: slot.start.toISOString(), end: slot.end.toISOString() }));
}
export function validateBooking(input) {
  return typeof input.name === 'string' && input.name.trim().length >= 2 && input.name.length <= 100
    && typeof input.email === 'string' && input.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
    && validDate(input.date) && /^\d{2}:\d{2}$/.test(input.hour || '') && ['online', 'presencial'].includes(input.mode) && input.consent === true;
}
