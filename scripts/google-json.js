export function parseGoogleCredentials(text) {
  if (typeof text !== 'string' || text.length > 64000) throw new Error('El JSON de Google no tiene un formato válido.');
  let document;
  try { document = JSON.parse(text); }
  catch { throw new Error('JSON no válido. Pega el objeto completo en una sola línea; no se guardaron cambios.'); }
  const client = document?.web || document?.installed;
  if (!client || typeof client.client_id !== 'string' || !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(client.client_id) || typeof client.client_secret !== 'string' || !/^[A-Za-z0-9_-]{10,}$/.test(client.client_secret)) {
    throw new Error('El JSON debe ser de un cliente OAuth de Google e incluir client_id y client_secret completos.');
  }
  if (document.web && (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes('http://127.0.0.1:53682/callback'))) {
    throw new Error('En el cliente web agrega la URI http://127.0.0.1:53682/callback y descarga o actualiza su JSON.');
  }
  return { clientId: client.client_id, clientSecret: client.client_secret };
}
