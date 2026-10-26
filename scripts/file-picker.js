import { execFileSync } from 'node:child_process';

const choices = {
  google: { title: 'Selecciona el JSON descargado de Google Cloud', filter: 'Credenciales de Google (*.json)|*.json', prompt: 'Ruta del archivo JSON descargado de Google: ' },
  photo: { title: 'Selecciona la fotografía de Camila', filter: 'Fotografía (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp', prompt: 'Ruta de la fotografía de Camila: ' },
};
export async function selectLocalFile(path, question, kind = 'google') {
  const choice = choices[kind];
  if (!choice) throw new Error('Tipo de archivo no permitido.');
  let selected = path;
  if (!selected && process.platform === 'win32') {
    const command = [
      '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$localDialog = New-Object System.Windows.Forms.OpenFileDialog',
      `$localDialog.Title = "${choice.title}"`,
      `$localDialog.Filter = "${choice.filter}"`,
      '$localDialog.Multiselect = $false',
      '$localDialog.InitialDirectory = [System.IO.Path]::Combine([Environment]::GetFolderPath("UserProfile"), "Downloads")',
      'if ($localDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($localDialog.FileName) } else { exit 2 }',
    ].join('; ');
    try {
      selected = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).replace(/^\uFEFF/, '').trim();
    } catch (error) {
      if (error.status === 2) throw new Error('Selección cancelada. No se guardaron cambios.');
      console.log('No se pudo abrir el selector. Indica la ruta del archivo a continuación.');
    }
  }
  if (!selected) selected = await question(choice.prompt);
  selected = selected.trim().replace(/^(["'])(.*)\1$/, '$2');
  if (!selected) throw new Error('No seleccionaste ningún archivo.');
  return selected;
}
