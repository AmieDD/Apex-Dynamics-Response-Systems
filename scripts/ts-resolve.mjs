// Zero-dependency resolver shim so native `node` can execute the TypeScript
// generator that imports the shared src/mock core.
//
// Why this exists: the app modules under src/mock/ use extensionless relative
// imports (e.g. `import { posFromFrac } from './leviathans'`) because the app is
// bundled by Vite (`moduleResolution: "bundler"`). Node's built-in TypeScript
// type stripping runs the .ts files fine, but Node's ESM resolver does NOT add
// extensions, so those extensionless specifiers fail with ERR_MODULE_NOT_FOUND.
// We cannot edit src/ (shared with the app) and we must not add an npm
// dependency, so this uses ONLY node:module built-in resolution hooks to append
// `.ts` when an extensionless relative import points at an existing .ts file.
//
// Preloaded via `node --import ./scripts/ts-resolve.mjs scripts/generate-sensor-log.ts`.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
    const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
    if (isRelative && !hasExtension && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (candidate.protocol === 'file:' && existsSync(candidate)) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
