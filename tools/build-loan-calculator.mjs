import { cp, mkdir, readFile, watch, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = process.cwd();
const artifactVersion = process.argv[2] ?? '1.0.0';
const sourceDir = resolve(workspaceRoot, 'libs/loan-calculator');
const outputDir = resolve(
  workspaceRoot,
  'dist/libs',
  artifactVersion === '1.0.0' ? 'loan-calculator' : `loan-calculator-v${artifactVersion.split('.')[0]}`
);

async function copyLibrary() {
  await mkdir(outputDir, { recursive: true });
  await cp(resolve(sourceDir, 'src'), resolve(outputDir, 'src'), { recursive: true });
  const packageJson = JSON.parse(await readFile(resolve(sourceDir, 'package.json'), 'utf8'));
  await writeFile(
    resolve(outputDir, 'package.json'),
    `${JSON.stringify({ ...packageJson, version: artifactVersion ?? packageJson.version }, null, 2)}\n`
  );
  await writeFile(
    resolve(outputDir, 'index.d.ts'),
    "export { default as LoanCalculator } from './src/loan-calculator';\n"
  );
}

if (process.argv.includes('--watch')) {
  await copyLibrary();
  for await (const event of watch(sourceDir, { recursive: true })) {
    if (event.eventType) await copyLibrary();
  }
} else {
  await copyLibrary();
}
