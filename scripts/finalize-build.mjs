import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = process.argv[2];
if (!['chrome', 'firefox'].includes(target)) {
  throw new Error('Expected build target: chrome or firefox');
}

const root = process.cwd();
const output = path.join(root, 'dist', target);
const manifestSource = path.join(root, `manifest.${target}.json`);
const manifest = JSON.parse(await readFile(manifestSource, 'utf8'));

await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

for (const size of [16, 32, 48, 128]) {
  await copyFile(
    path.join(root, 'public', `${size}.png`),
    path.join(output, `${size}.png`)
  );
}

console.log(`Prepared ${target} package in ${path.relative(root, output)}`);
