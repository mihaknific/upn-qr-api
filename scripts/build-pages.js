import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '_site');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, 'pages'), output, { recursive: true });

const licenses = [
    ['qrcode', 'license'],
    ['dijkstrajs', 'LICENSE.md'],
    ['pdf-lib', 'LICENSE.md'],
    ['@pdf-lib/standard-fonts', 'LICENSE.md'],
    ['@pdf-lib/upng', 'LICENSE'],
    ['pako', 'LICENSE'],
    ['tslib', 'LICENSE.txt']
];
const licenseOutput = path.join(output, 'licenses');
await mkdir(licenseOutput, { recursive: true });
for (const [packageName, filename] of licenses) {
    const packagePath = packageName.startsWith('@')
        ? path.join(root, 'node_modules', ...packageName.split('/'))
        : path.join(root, 'node_modules', packageName);
    await cp(path.join(packagePath, filename), path.join(licenseOutput, `${packageName.replaceAll('/', '-')}.txt`));
}

await build({
    entryPoints: [path.join(root, 'src', 'browser-entry.js')],
    outfile: path.join(output, 'app.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    target: ['es2022'],
    legalComments: 'external',
    loader: { '.ttf': 'dataurl' }
});
