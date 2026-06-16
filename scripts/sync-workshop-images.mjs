// Sync the mascot PNGs that the standalone workshop zine references.
//
// public/ is the single source of truth for Clipzilla art. The workshop/
// zine is a self-contained set of static HTML files (opened via file:// or
// served on its own), so its <img src="images/Clipzilla*.png"> tags need a
// local copy next to the HTML. Run this after changing any mascot art so the
// committed workshop/images/ copies do not drift from public/.
//
// Usage: npm run sync:workshop-images
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(repoRoot, 'public');
const destDir = join(repoRoot, 'workshop', 'images');

// Keep this list in sync with the mascots referenced by workshop/*.html.
const assets = ['Clipzilla.png', 'ClipzillaAngry.png', 'ClipzillaAlarm.png'];

mkdirSync(destDir, { recursive: true });
for (const name of assets) {
  copyFileSync(join(srcDir, name), join(destDir, name));
  console.log(`synced ${name} -> workshop/images/`);
}
console.log(`Done: ${assets.length} mascot asset(s) synced.`);
