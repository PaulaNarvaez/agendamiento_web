import { spawn } from 'node:child_process';

export function openBrowser(url) {
  if (process.env.NO_BROWSER === '1') return;
  const [command, args] = process.platform === 'win32'
    ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true });
  child.on('error', () => console.log('No se pudo abrir el navegador automáticamente. Copia el enlace de Google mostrado arriba.'));
  child.unref();
}
