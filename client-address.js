import { isIP } from 'node:net';

// Confiar únicamente en la cantidad de proxies indicada por el despliegue.
// El valor por defecto usa la conexión directa y no confía en encabezados.
export function clientAddress(request, trustedHops = 0) {
  const direct = request.socket.remoteAddress || 'unknown';
  if (!trustedHops) return direct;
  const header = request.headers['x-forwarded-for'];
  if (typeof header !== 'string') return direct;
  const addresses = header.split(',').map(value => value.trim());
  if (addresses.length < trustedHops || addresses.some(value => !isIP(value))) return direct;
  return addresses[addresses.length - trustedHops];
}
