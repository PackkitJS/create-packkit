import { V } from '../versions.js';
// Background-worker target. A transport-agnostic queue/event consumer: a
// unit-testable handler seam, a runner that drains in-flight work on
// SIGTERM/SIGINT and exits 0, structured JSON stdout logs, a poison-message seam,
// env config, and a Dockerfile with NO HTTP port (liveness is the process). No
// transport SDK is baked in — wire receive() to your queue.

export default {
  id: 'worker',
  active: (cfg) => cfg.hasWorker,
  apply(cfg) {
    const ext = cfg.ext;
    const files = {
      [`src/handler.${ext}`]: handlerFile(cfg),
      [`src/worker.${ext}`]: workerFile(cfg),
      [`src/index.${ext}`]: entryFile(),
      Dockerfile: dockerfile(cfg),
      '.dockerignore': ['node_modules', 'dist', 'coverage', '.git', '.github', '.env', '.env.*', '!.env.example', '*.log', 'Dockerfile', '.dockerignore', ''].join('\n'),
    };
    if (cfg.test === 'vitest') files[`src/worker.test.${ext}`] = testFile(cfg);
    return {
      files,
      pkg: {
        private: true,
        scripts: {
          start: 'node dist/index.js',
          dev: cfg.isTs ? 'tsx watch src/index.ts' : 'node --watch src/index.js',
        },
        devDependencies: { ...(cfg.isTs ? { tsx: V.tsx } : {}) },
      },
    };
  },
};

// `: Type` for TS, nothing for JS — so one template serves both languages.
const t = (cfg, type) => (cfg.isTs ? `: ${type}` : '');

function handlerFile(cfg) {
  return [
    '/**',
    ' * Business logic for one message — the unit-testable seam. Pure: no queue, no',
    ' * logging. Throw to signal a failure the worker should retry (and, after',
    ' * WORKER_MAX_ATTEMPTS, route to the poison-message handler).',
    ' */',
    `export async function handle(message${t(cfg, 'string')})${t(cfg, 'Promise<void>')} {`,
    `\tif (!message.trim()) throw new Error('empty message');`,
    '\t// TODO: replace with your processing.',
    '}',
    '',
  ].join('\n');
}

function workerFile(cfg) {
  return [
    '/**',
    ' * A transport-agnostic background worker: pull messages from a source, run the',
    ' * handler with bounded retries, and drain in-flight work on SIGTERM/SIGINT before',
    ' * exiting 0. No queue SDK is baked in — wire receive() to your transport. Logs are',
    ' * JSON lines on stdout; liveness is the process, so there is no HTTP port.',
    ' */',
    `import { createInterface } from 'node:readline';`,
    `import { handle } from './handler.js';`,
    '',
    ...(cfg.isTs ? ['interface Config {', '\tmaxAttempts: number;', '\tlogLevel: string;', '}', ''] : []),
    `export function loadConfig()${t(cfg, 'Config')} {`,
    '\treturn {',
    '\t\tmaxAttempts: Number(process.env.WORKER_MAX_ATTEMPTS ?? 3),',
    "\t\tlogLevel: process.env.WORKER_LOG_LEVEL ?? 'info',",
    '\t};',
    '}',
    '',
    `export function log(event${t(cfg, 'string')}, fields${t(cfg, 'Record<string, unknown>')} = {})${t(cfg, 'void')} {`,
    "\tprocess.stdout.write(JSON.stringify({ level: 'info', event, ...fields }) + '\\n');",
    '}',
    '',
    '/** A message that failed every attempt. Default: log and drop. Replace with a',
    ' *  dead-letter queue, a table, an alert — whatever poison means for your system. */',
    `export async function onPoison(message${t(cfg, 'string')}, error${t(cfg, 'unknown')})${t(cfg, 'Promise<void>')} {`,
    "\tlog('poison_message', { level: 'error', message, error: String(error) });",
    '}',
    '',
    `async function processMessage(message${t(cfg, 'string')}, config${t(cfg, 'Config')})${t(cfg, 'Promise<void>')} {`,
    '\tfor (let attempt = 1; attempt <= config.maxAttempts; attempt++) {',
    '\t\ttry {',
    '\t\t\tawait handle(message);',
    "\t\t\tlog('handled', { message, attempt });",
    '\t\t\treturn;',
    '\t\t} catch (error) {',
    "\t\t\tlog('handle_failed', { level: 'warning', message, attempt, error: String(error) });",
    '\t\t\tif (attempt === config.maxAttempts) await onPoison(message, error);',
    '\t\t}',
    '\t}',
    '}',
    '',
    `export async function run()${t(cfg, 'Promise<number>')} {`,
    '\tconst config = loadConfig();',
    '\tconst rl = createInterface({ input: process.stdin });',
    '\tlet shuttingDown = false;',
    `\tconst requestShutdown = (signal${t(cfg, 'string')}) => {`,
    '\t\tif (shuttingDown) return;',
    '\t\tshuttingDown = true;',
    "\t\tlog('shutdown_requested', { signal });",
    '\t\trl.close(); // end the async iterator so a drain is not stuck waiting for input',
    '\t};',
    "\tprocess.on('SIGTERM', () => requestShutdown('SIGTERM'));",
    "\tprocess.on('SIGINT', () => requestShutdown('SIGINT'));",
    "\tlog('worker_started', { maxAttempts: config.maxAttempts });",
    '',
    '\tlet processed = 0;',
    '\tfor await (const line of rl) {',
    '\t\tawait processMessage(line, config); // finish this message before re-checking shutdown',
    '\t\tprocessed++;',
    '\t\tif (shuttingDown) break;',
    '\t}',
    "\tlog('worker_stopped', { processed, drained: shuttingDown });",
    '\treturn 0;',
    '}',
    '',
  ].join('\n');
}

function entryFile() {
  return [
    `import { run } from './worker.js';`,
    '',
    'run()',
    '\t.then((code) => process.exit(code))',
    '\t.catch((error) => {',
    '\t\tconsole.error(error);',
    '\t\tprocess.exit(1);',
    '\t});',
    '',
  ].join('\n');
}

function testFile(cfg) {
  const spawnArgs = cfg.isTs ? "[process.execPath, ['--import', 'tsx', 'src/index.ts']]" : "[process.execPath, ['src/index.js']]";
  return [
    `import { spawn } from 'node:child_process';`,
    `import { describe, it, expect } from 'vitest';`,
    `import { handle } from './handler.js';`,
    '',
    `describe('handler', () => {`,
    `\tit('accepts a message', async () => {`,
    `\t\tawait expect(handle('hello')).resolves.toBeUndefined();`,
    '\t});',
    `\tit('rejects an empty message', async () => {`,
    `\t\tawait expect(handle('   ')).rejects.toThrow();`,
    '\t});',
    '});',
    '',
    `describe('worker', () => {`,
    `\tit('drains on SIGTERM and exits 0', async () => {`,
    `\t\tconst child = spawn(...${spawnArgs}, { stdio: ['pipe', 'pipe', 'inherit'] });`,
    "\t\tlet out = '';",
    `\t\tchild.stdout.on('data', (d) => (out += String(d)));`,
    `\t\tchild.stdin.write('one\\n');`,
    '\t\tawait new Promise((r) => setTimeout(r, 600)); // let the in-flight message be handled',
    `\t\tchild.kill('SIGTERM');`,
    `\t\tconst code = await new Promise((resolve) => child.on('exit', resolve));`,
    '\t\texpect(code).toBe(0);',
    `\t\texpect(out).toContain('"event":"handled"');`,
    `\t\texpect(out).toContain('"event":"worker_stopped"');`,
    '\t}, 15000);',
    '});',
    '',
  ].join('\n');
}

function dockerfile(cfg) {
  const node = cfg.nodeVersion;
  const pm = cfg.packageManager;
  const install = pm === 'npm' ? 'npm ci' : `${pm} install --frozen-lockfile`;
  const prune = pm === 'npm' ? 'npm ci --omit=dev' : `${pm} install --prod --frozen-lockfile`;
  const build = pm === 'npm' ? 'npm run build' : `${pm} run build`;
  return [
    `# A worker is a long-running process, NOT an HTTP server — so there is no EXPOSE`,
    `# and no HTTP HEALTHCHECK; liveness is the process. STOPSIGNAL makes \`docker stop\``,
    `# send SIGTERM so the worker drains in-flight work before exiting.`,
    `# --- build stage ---`,
    `FROM node:${node}-slim AS build`,
    `WORKDIR /app`,
    `COPY package*.json ./`,
    `RUN ${install}`,
    `COPY . .`,
    `RUN ${build}`,
    ``,
    `# --- deps stage: production-only node_modules ---`,
    `FROM node:${node}-slim AS deps`,
    `WORKDIR /app`,
    `COPY package*.json ./`,
    `RUN ${prune}`,
    ``,
    `# --- runtime stage: slim, non-root ---`,
    `FROM node:${node}-slim`,
    `WORKDIR /app`,
    `ENV NODE_ENV=production`,
    `COPY --from=deps /app/node_modules ./node_modules`,
    `COPY --from=build /app/dist ./dist`,
    `COPY package.json ./`,
    `USER node`,
    `STOPSIGNAL SIGTERM`,
    `CMD ["node", "dist/index.js"]`,
    ``,
  ].join('\n');
}
