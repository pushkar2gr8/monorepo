import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workspaceRoot = process.cwd();
const version = process.argv[2];
const entryName = process.argv[3];
const sourceDir = resolve(workspaceRoot, 'libs/loan-page/src');
const artifactName = version === '1.0.0' ? 'loan-page' : `loan-page-v${version.split('.')[0]}`;
const outputDir = resolve(workspaceRoot, 'dist/libs', artifactName);
const entryFile = `${entryName}.tsx`;

await mkdir(outputDir, { recursive: true });
await cp(resolve(sourceDir, entryFile), resolve(outputDir, entryFile));
await writeFile(
  resolve(outputDir, 'package.json'),
  `${JSON.stringify({
    name: '@nbfc/loan-page',
    version,
    private: true,
    main: `./${entryFile}`,
    types: `./${entryFile}`,
    peerDependencies: {
      react: '^18.0.0 || ^19.0.0',
      'react-dom': '^18.0.0 || ^19.0.0'
    }
  }, null, 2)}\n`
);
