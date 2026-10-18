import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
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
    return response.status === 204 ? null : response.json();
  };
}

export function bookingEvent(input, slot) {
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
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    description: [
      'Confirmación de reserva',
      'Profesional: Camila Leiva, psicóloga.',
      'Modalidad: atención telemática por videollamada.',
      `Fecha: ${date}.`,
      `Horario: ${time(slot.start)} a ${time(slot.end)} (Chile, ${zone}).`,
      'El acceso de Google Meet se incluirá en esta invitación.',
      'Conéctate desde un lugar privado, con cámara, micrófono y conexión a internet.',
      'La invitación de Google Calendar muestra el horario en la zona horaria configurada en tu dispositivo.',
    ].join('\n'),
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 30 }] },
  };
}

export function meetingLink(event) {
  const links = [event.hangoutLink, ...(event.conferenceData?.entryPoints || []).filter(point => point.entryPointType === 'video').map(point => point.uri)];
  return links.find(link => {
    try { const url = new URL(link); return url.protocol === 'https:' && url.hostname === 'meet.google.com'; }
    catch { return false; }
  });
}

// Primero se genera un Meet exclusivo. La invitación se solicita solo cuando
// el enlace está listo; una creación de Meet fallida revierte el evento provisional.
export async function reserveWithMeet(google, calendarId, input, slot, wait = delay) {
  const collection = `calendars/${encodeURIComponent(calendarId)}/events`;
  const body = bookingEvent(input, slot);
  let event = await google(`${collection}?conferenceDataVersion=1&sendUpdates=none`, { method: 'POST', body: JSON.stringify(body) });
  if (!event?.id) throw new Error('Event creation unconfirmed');
  const path = `${collection}/${encodeURIComponent(event.id)}`;
  let onlineUrl;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const status = event.conferenceData?.createRequest?.status?.statusCode;
      if (status === 'failure') throw new Error('Google Meet creation failed');
      onlineUrl = meetingLink(event);
      if (onlineUrl) break;
      if (attempt === 5) throw new Error('Google Meet creation timed out');
      await wait([150, 300, 600, 1200, 1800][attempt]);
      event = await google(path);
    }
  } catch {
    // Si la reversión falla, no se declara cancelada una reserva incierta.
    await google(`${path}?sendUpdates=none`, { method: 'DELETE' });
    const error = new Error('Meet unavailable; provisional event removed');
    error.code = 'MEET_UNAVAILABLE';
    throw error;
  }
  const confirmed = await google(`${path}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify({ location: onlineUrl, description: body.description.replace('El acceso de Google Meet se incluirá en esta invitación.', `Acceso a la sesión: ${onlineUrl}`) }),
  });
  if (!confirmed?.id) throw new Error('Invitation update unconfirmed');
  return { onlineUrl };
}
