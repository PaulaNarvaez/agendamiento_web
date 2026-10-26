import { execFileSync } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readGoogleFile(path, question) {
  let selected = path;
  if (!selected && process.platform === 'win32') {
    const command = [
      '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$googleDialog = New-Object System.Windows.Forms.OpenFileDialog',
      '$googleDialog.Title = "Selecciona el JSON de credenciales descargado de Google Cloud"',
      '$googleDialog.Filter = "Credenciales de Google (*.json)|*.json"',
      '$googleDialog.Multiselect = $false',
      '$googleDialog.InitialDirectory = [System.IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), "Downloads")',
      'if ($googleDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($googleDialog.FileName) } else { exit 2 }',
    ].join('; ');
    try {
      selected = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).replace(/^\uFEFF/, '').trim();
    } catch (error) {
      if (error.status === 2) throw new Error('Selección cancelada. No se guardaron cambios.');
      throw new Error('No se pudo abrir el selector. Usa npm.cmd run setup:env -- --json-file "RUTA_DEL_ARCHIVO.json".');
    }
  }
  if (!selected) selected = await question('Ruta del archivo JSON descargado de Google (puedes arrastrarlo aquí): ');
  selected = selected.trim().replace(/^(["'])(.*)\1$/, '$2');
  if (!selected || !/\.json$/i.test(selected)) throw new Error('Selecciona un archivo .json descargado de Google Cloud, no pegues el contenido como comando.');
  const absolute = resolve(selected);
  let file;
  try { file = await stat(absolute); }
  catch { throw new Error('No se encontró el archivo seleccionado. Vuelve a ejecutar el asistente y selecciona el JSON.'); }
  if (!file.isFile() || file.size > 64000) throw new Error('El archivo debe ser un JSON de credenciales de Google de menos de 64 KB.');
  return (await readFile(absolute, 'utf8')).replace(/^\uFEFF/, '');
}
