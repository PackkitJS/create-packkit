// Provider-neutral deployment contract.
//
// A host application deploying a generated project needs to know how to build
// and run it — but Packkit must not know or care whether that host is Vercel,
// a Kubernetes cluster, or a Raspberry Pi. So this describes build/runtime
// requirements in provider-agnostic terms, derived purely from the resolved
// config. No AWS/Netlify/Vercel/Cloudflare/GitHub fields, by design.

/**
 * Derive the deployment contract from a resolved config.
 * @returns {import('../../types/embedded.js').DeploymentContract}
 */
export function deriveDeploymentContract(cfg) {
  const run = (script) => (cfg.packageManager === 'npm' ? `npm run ${script}` : `${cfg.packageManager} ${script}`);
  const start = cfg.packageManager === 'npm' ? 'npm start' : `${cfg.packageManager} start`;
  const { targets, build } = cfg.resolved;

  // Full-stack is a composite: a static front end plus a node service, exposed
  // separately so the host can deploy them together (the server serves the web
  // build) or apart. Checked first — its top-level target is `library`, so it
  // would otherwise fall through to the library branch.
  if (cfg.monorepo && cfg.monorepoLayout === 'fullstack') {
    return {
      type: 'fullstack',
      frontend: staticContract(run, 'apps/web/dist'),
      // The fullstack server serves /api/health and has no Dockerfile of its own.
      backend: nodeServiceContract(run('build'), start, '/api/health', undefined),
    };
  }

  if (targets.service) {
    // The generated server reads PORT but defaults to 3000, and every framework
    // Packkit generates (Hono/Fastify/Express) implements /health. The service
    // preset also emits a Dockerfile.
    return nodeServiceContract(build.has ? run('build') : undefined, start, '/health', 'Dockerfile');
  }

  if (targets.app) return staticContract(run, 'dist');

  if (targets.worker) {
    // A long-running non-HTTP process: liveness is the process (no port), it drains
    // in-flight work on SIGTERM/SIGINT, and it ships a Dockerfile with no EXPOSE.
    return {
      type: 'worker',
      runtime: `node-${cfg.nodeVersion}`,
      buildCommand: build.has ? run('build') : undefined,
      startCommand: start,
      shutdown: { signals: ['SIGTERM', 'SIGINT'], drainsInflight: true },
      health: { type: 'process' },
      containerFile: 'Dockerfile',
      requiredEnvironmentVariables: [],
      optionalEnvironmentVariables: ['WORKER_MAX_ATTEMPTS', 'WORKER_LOG_LEVEL'],
    };
  }

  if (targets.cli) return prune({ type: 'cli', buildCommand: build.has ? run('build') : undefined });

  return prune({ type: 'library', buildCommand: build.has ? run('build') : undefined });
}

function staticContract(run, outputDirectory) {
  return { type: 'static', buildCommand: run('build'), outputDirectory };
}

function nodeServiceContract(buildCommand, startCommand, healthCheckPath, containerFile) {
  // defaultPort/portEnvironmentVariable make the port semantics explicit: the
  // service binds to 3000 by default and honors PORT — so PORT is optional, not
  // required. requiredEnvironmentVariables is kept even when empty as an explicit
  // "nothing else is required" signal for a provisioning host.
  return prune({
    type: 'node-service',
    runtime: 'node',
    buildCommand,
    startCommand,
    defaultPort: 3000,
    portEnvironmentVariable: 'PORT',
    healthCheckPath,
    containerFile,
    requiredEnvironmentVariables: [],
    optionalEnvironmentVariables: ['PORT'],
  });
}

// Drop only undefined fields, so the shape stays deterministic while explicit
// empty arrays (requiredEnvironmentVariables) are preserved as meaningful.
function prune(contract) {
  const out = {};
  for (const [k, v] of Object.entries(contract)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
