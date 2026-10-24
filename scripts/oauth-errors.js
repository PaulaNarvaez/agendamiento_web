const messages = {
  invalid_client: 'El ID de cliente o el secreto no son válidos. Comprueba que ambos pertenezcan al mismo cliente OAuth. Si cambiaste el secreto, actualiza GOOGLE_CLIENT_SECRET en tu .env local, guarda y reinicia el asistente.',
  invalid_grant: 'El código de autorización venció o no coincide con esta solicitud. Reinicia el asistente y abre el enlace nuevo. Comprueba también que la URI configurada sea http://127.0.0.1:53682/callback.',
  redirect_uri_mismatch: 'La URI del cliente web debe ser exactamente http://127.0.0.1:53682/callback. Guarda el cambio en Google Cloud y reinicia el asistente.',
  unauthorized_client: 'Google no permite este intercambio para el cliente OAuth configurado. Revisa el tipo de cliente y sus credenciales en Google Cloud.',
  access_denied: 'Google denegó la autorización. Comprueba que pruebacami12@gmail.com esté permitida como usuario de prueba si la aplicación sigue en pruebas.',
  invalid_request: 'Google rechazó la solicitud de autorización. Reinicia el asistente y usa el enlace nuevo; comparte únicamente la línea [OAuth] si vuelve a ocurrir.',
  temporarily_unavailable: 'Google no está disponible temporalmente. Intenta autorizar nuevamente más tarde.',
  server_error: 'Google devolvió un error temporal. Intenta autorizar nuevamente más tarde.',
};

export async function oauthExchangeFailure(response) {
  const body = await response.json().catch(() => ({}));
  const reason = typeof body?.error === 'string' ? body.error : 'unknown';
  const code = Object.hasOwn(messages, reason) ? reason : 'unknown';
  const error = new Error(messages[code] || 'Google rechazó el intercambio de autorización. Comparte únicamente la línea [OAuth] para identificar el problema.');
  // No imprimir error_description ni respuestas completas: pueden contener datos privados.
  error.oauthDiagnostic = `[OAuth] HTTP=${response.status}; motivo=${code}`;
  return error;
}
