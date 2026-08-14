// Always-on: base package.json descriptive fields + the source entry + README.

import { engineFloor, nodePin } from '../node.js';

export default {
  id: 'meta',
  active: () => true,
  apply(cfg) {
    const files = {};
    const pkg = {
      name: cfg.name,
      version: '0.0.0',
      description: cfg.description || '',
      type: cfg.moduleFormat === 'cjs' ? 'commonjs' : 'module',
      engines: { node: `>=${engineFloor(cfg.nodeVersion)}` },
      scripts: {},
    };

    const kw = String(cfg.keywords || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (kw.length) pkg.keywords = kw;
    if (cfg.license !== 'none') pkg.license = cfg.license;
    if (cfg.author) pkg.author = cfg.author;
    if (cfg.repo) {
      pkg.repository = { type: 'git', url: `git+${cfg.repo.replace(/\.git$/, '')}.git` };
      pkg.bugs = { url: `${cfg.repo.replace(/\.git$/, '')}/issues` };
      pkg.homepage = `${cfg.repo.replace(/\.git$/, '')}#readme`;
    }

    // Source entry point — only the plain library entry lives here; framework
    // and app/cli/service modules write their own source.
    if (cfg.hasLibrary && !cfg.hasFramework) {
      files[`src/index.${cfg.ext}`] = libraryEntry(cfg);
    }

    // README
    files['README.md'] = readme(cfg);

    // Node version pin — that line's newest patch (from Node's own data), so
    // `nvm use` lands on a current, real release.
    files['.nvmrc'] = `${nodePin(cfg.nodeVersion)}\n`;

    // A typecheck script for TS projects — framework-aware (plain tsc can't
    // resolve .vue/.svelte modules).
    if (cfg.isTs) {
      pkg.scripts.typecheck = cfg.isVue
        ? 'vue-tsc --noEmit'
        : cfg.isSvelte
          ? 'svelte-check --tsconfig ./tsconfig.json'
          : 'tsc --noEmit';
    }

    return { files, pkg };
  },
};

function libraryEntry(cfg) {
  // Only reached for a plain library (the caller guards on !cfg.hasFramework),
  // so framework entries never come through here — frameworks.js writes those.
  if (cfg.isTs) {
    return [
      `/** Greet someone by name. */`,
      `export function greet(name: string): string {`,
      `\treturn \`Hello, \${name}!\`;`,
      `}`,
      ``,
    ].join('\n');
  }
  return [
    `/**`,
    ` * Greet someone by name.`,
    ` * @param {string} name`,
    ` * @returns {string}`,
    ` */`,
    `export function greet(name) {`,
    `\treturn \`Hello, \${name}!\`;`,
    `}`,
    ``,
  ].join('\n');
}

function run(cfg, script) {
  return cfg.packageManager === 'npm' ? `npm run ${script}` : `${cfg.packageManager} ${script}`;
}

function makeBadges(cfg) {
  const badges = [];
  const publishable = (cfg.hasLibrary || cfg.hasCli) && !cfg.hasApp && !cfg.hasService;
  if (publishable) {
    const enc = encodeURIComponent(cfg.name);
    badges.push(`[![npm](https://img.shields.io/npm/v/${enc}.svg)](https://www.npmjs.com/package/${cfg.name})`);
  }
  const repo = cfg.repo ? cfg.repo.replace(/\.git$/, '') : '';
  if (repo && (cfg.workflows || []).includes('ci')) {
    badges.push(`[![CI](${repo}/actions/workflows/ci.yml/badge.svg)](${repo}/actions/workflows/ci.yml)`);
  }
  if (cfg.license !== 'none') {
    badges.push(`[![License: ${cfg.license}](https://img.shields.io/badge/license-${encodeURIComponent(cfg.license)}-blue.svg)](LICENSE)`);
  }
  return badges.join(' ');
}

function readme(cfg) {
  const install = {
    npm: `npm install ${cfg.name}`,
    pnpm: `pnpm add ${cfg.name}`,
    yarn: `yarn add ${cfg.name}`,
    bun: `bun add ${cfg.name}`,
  }[cfg.packageManager];

  const lines = [
    `# ${cfg.name}`,
    '',
    cfg.description || '_A modern package scaffolded with [Packkit](https://packkitjs.github.io/create-packkit-js/)._',
    '',
  ];

  const badges = makeBadges(cfg);
  if (badges) lines.push(badges, '');

  lines.push(
    '## Requirements',
    '',
    `Node.js >= ${engineFloor(cfg.nodeVersion)} (\`.nvmrc\` pins ${nodePin(cfg.nodeVersion)}; run \`nvm use\`). Enforced via \`engine-strict\`, so installs fail fast on an unsupported version.`,
    '',
  );

  lines.push('## Install', '', '```sh', install, '```', '');

  if (cfg.hasApp) {
    lines.push('## Develop', '', '```sh', run(cfg, 'dev') + '     # start the dev server', run(cfg, 'build') + '   # production build', '```', '');
  } else if (cfg.hasLibrary && cfg.isReact) {
    lines.push('## Usage', '', '```' + (cfg.isTs ? 'tsx' : 'jsx'),
      `import { Button } from '${cfg.name}';`, '', `<Button label="Click me" />`, '```', '');
  } else if (cfg.hasLibrary && cfg.isVue) {
    lines.push('## Usage', '', '```' + (cfg.isTs ? 'ts' : 'js'),
      `import { Button } from '${cfg.name}';`, '// then <Button label="Click me" /> in your template', '```', '');
  } else if (cfg.hasLibrary && cfg.isSvelte) {
    lines.push('## Usage', '', '```svelte',
      `<script>import { Button } from '${cfg.name}';</script>`, '', `<Button label="Click me" />`, '```', '');
  } else if (cfg.hasLibrary) {
    const imp = cfg.isTs || cfg.hasEsm ? `import { greet } from '${cfg.name}';` : `const { greet } = require('${cfg.name}');`;
    lines.push('## Usage', '', '```' + (cfg.isTs ? 'ts' : 'js'), imp, '', `greet('world'); // "Hello, world!"`, '```', '');
  }
  if (cfg.hasCli) {
    lines.push('## CLI', '', '```sh', `npx ${cfg.name} --help`, '```', '');
  }

  // Publishing needs a credential the repo doesn't have yet. The changesets
  // workflow runs on every push, so without this note the first thing a new
  // repo does is fail a job for a reason that's only explained in a YAML
  // comment. Say it where someone will actually read it.
  if (cfg.workflows?.includes('npm-publish')) {
    const changesets = cfg.release === 'changesets';
    lines.push(
      '## Releasing',
      '',
      changesets
        ? 'Releases are handled by the `Release` workflow: push a changeset (`npx changeset`) and it opens a version PR, then publishes when that PR merges.'
        : 'Pushing a `v*` tag triggers the `Publish` workflow, which publishes to npm with provenance.',
      '',
      '**Publishing needs npm credentials, which a new repository does not have.** Either:',
      '',
      '- Set up [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) — no secret to store or rotate, and the recommended option; or',
      '- Add an [npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) as an `NPM_TOKEN` repository secret.',
      '',
      changesets
        ? 'Until one of those is in place the `Release` workflow will fail with `ENEEDAUTH` on every push. That is expected on a brand-new repo.'
        : 'Until one of those is in place, tag pushes will fail with `ENEEDAUTH`.',
      '',
    );
  }

  lines.push('## License', '', cfg.license === 'none' ? 'Unlicensed.' : `${cfg.license}${cfg.author ? ' © ' + cfg.author : ''}`, '');
  return lines.join('\n');
}
