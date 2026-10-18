import { zone } from './scheduling.js';

export function createGoogleClient(config, request = fetch) {
  let token;
  let expires = 0;
  return async function google(path, options = {}) {
    if (Date.now() > expires) {
      const response = await request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Google authentication failed');
      const data = await response.json();
      if (!data.access_token || !Number.isFinite(data.expires_in)) throw new Error('Google authentication incomplete');
      token = data.access_token;
      expires = Date.now() + (data.expires_in - 60) * 1000;
    }
    const response = await request(`https://www.googleapis.com/calendar/v3/${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Google calendar request failed');
    return response.json();
  };
}

export function bookingEvent(input, slot, onlineUrl) {
  const date = new Intl.DateTimeFormat('es-CL', { dateStyle: 'full', timeZone: zone }).format(new Date(slot.start));
  const time = instant => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(new Date(instant));
  return {
    summary: 'Sesión online · Camila Leiva, psicóloga',
    start: { dateTime: slot.start, timeZone: zone },
    end: { dateTime: slot.end, timeZone: zone },
    attendees: [{ email: input.email.trim(), displayName: input.name.trim() }],
    visibility: 'private',
    guestsCanSeeOtherGuests: false,
    guestsCanInviteOthers: false,
    location: onlineUrl,
    description: [
      'Confirmación de reserva',
      'Profesional: Camila Leiva, psicóloga.',
      'Modalidad: atención telemática por videollamada.',
      `Fecha: ${date}.`,
      `Horario: ${time(slot.start)} a ${time(slot.end)} (Chile, ${zone}).`,
      `Acceso a la sesión: ${onlineUrl}`,
      'Conéctate desde un lugar privado, con cámara, micrófono y conexión a internet.',
      'La invitación de Google Calendar muestra el horario en la zona horaria configurada en tu dispositivo.',
    ].join('\n'),
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] },
  };
}
