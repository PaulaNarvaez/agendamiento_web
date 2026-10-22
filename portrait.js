import { readdir } from 'node:fs/promises';

const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export async function findPortrait(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = entries.filter(entry => entry.isFile() && /\.(jpe?g|png|webp)$/i.test(entry.name));
  // Preferir el nombre documentado; aceptar extensiones y mayúsculas habituales.
  const preferred = images.filter(entry => /^camila(?:[-_ ]leiva)?\.(jpe?g|png|webp)$/i.test(entry.name));
  preferred.sort((a, b) => {
    const priority = name => /^camila\.jpg$/i.test(name) ? 0 : /^camila\./i.test(name) ? 1 : 2;
    return priority(a.name) - priority(b.name) || a.name.localeCompare(b.name);
  });
  const entry = preferred[0] || (images.length === 1 ? images[0] : null);
  if (!entry) return null;
  return { name: entry.name, type: types[entry.name.split('.').at(-1).toLowerCase()] };
}
