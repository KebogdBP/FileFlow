import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const webRoot = fileURLToPath(new URL('../apps/web', import.meta.url));
const nextBin = fileURLToPath(
  new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url),
);
const output = fileURLToPath(new URL('../apps/web/out', import.meta.url));
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const clientDist = fileURLToPath(new URL('../dist/client', import.meta.url));
const serverDist = fileURLToPath(new URL('../dist/server', import.meta.url));
const hostingDist = fileURLToPath(new URL('../dist/.openai', import.meta.url));
const hostingConfig = fileURLToPath(new URL('../.openai/hosting.json', import.meta.url));
const workerSource = fileURLToPath(new URL('../sites-worker/index.js', import.meta.url));

const build = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: webRoot,
  env: {
    ...process.env,
    FILEFLOW_STATIC_EXPORT: '1',
  },
  stdio: 'inherit',
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

rmSync(dist, { recursive: true, force: true });
mkdirSync(clientDist, { recursive: true });
mkdirSync(serverDist, { recursive: true });
mkdirSync(hostingDist, { recursive: true });
cpSync(output, clientDist, { recursive: true });
cpSync(hostingConfig, `${hostingDist}/hosting.json`);
cpSync(workerSource, `${serverDist}/index.js`);

console.log(`Static site copied to ${dist.replace(`${projectRoot}\\`, '')}`);
