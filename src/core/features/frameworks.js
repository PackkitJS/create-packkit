import { V, PEER } from '../versions.js';
// React / Vue / Svelte source + dependencies, for both component libraries and
// Vite apps. The Vite build wiring lives in vite.js; here we emit the source
// files, the runtime deps (peer for libs, direct for apps), and — for Svelte
// libraries, which ship uncompiled source — the package entry points.

export default {
  id: 'frameworks',
  active: (cfg) => cfg.hasFramework,
  apply(cfg) {
    const files = {};
    const pkg = { devDependencies: {}, scripts: {} };
    const forApp = cfg.hasApp;

    if (cfg.isReact) react(cfg, files, pkg, forApp);
    else if (cfg.isVue) vue(cfg, files, pkg, forApp);
    else if (cfg.isSvelte) svelte(cfg, files, pkg, forApp);

    return { files, pkg };
  },
};

/* --------------------------------- React --------------------------------- */
function react(cfg, files, pkg, forApp) {
  const x = cfg.isTs ? 'tsx' : 'jsx';
  if (forApp) {
    files['index.html'] = htmlShell(cfg, `/src/main.${x}`);
    files[`src/main.${x}`] = [
      `import { StrictMode } from 'react';`,
      `import { createRoot } from 'react-dom/client';`,
      `import { App } from './App.${x === 'tsx' ? 'js' : 'js'}';`,
      ``,
      // A guarded lookup instead of a non-null assertion: it's honest about the
      // failure and keeps the fresh scaffold clean under a strict linter (Biome's
      // noNonNullAssertion flags the `!` form).
      `const root = document.getElementById('root');`,
      `if (!root) throw new Error('Root element #root not found');`,
      ``,
      `createRoot(root).render(`,
      `\t<StrictMode><App /></StrictMode>,`,
      `);`,
      ``,
    ].join('\n');
    files[`src/App.${x}`] = [
      `export function App() {`,
      `\treturn <h1>Hello from ${cfg.name}</h1>;`,
      `}`,
      ``,
    ].join('\n');
    pkg.dependencies = { react: V.react, 'react-dom': V['react-dom'] };
  } else {
    files[`src/index.${x}`] = cfg.isTs
      ? [
          `export interface ButtonProps {`,
          `\tlabel: string;`,
          `\tonClick?: () => void;`,
          `}`,
          ``,
          `export function Button({ label, onClick }: ButtonProps) {`,
          `\treturn <button onClick={onClick}>{label}</button>;`,
          `}`,
          ``,
        ].join('\n')
      : [`export function Button({ label, onClick }) {`, `\treturn <button onClick={onClick}>{label}</button>;`, `}`, ``].join('\n');
    pkg.peerDependencies = { react: PEER.react, 'react-dom': PEER['react-dom'] };
    pkg.devDependencies.react = V.react;
    pkg.devDependencies['react-dom'] = V['react-dom'];
  }
  if (cfg.isTs) {
    pkg.devDependencies['@types/react'] = V['@types/react'];
    pkg.devDependencies['@types/react-dom'] = V['@types/react-dom'];
  }
}

/* ---------------------------------- Vue ---------------------------------- */
function vue(cfg, files, pkg, forApp) {
  const script = cfg.isTs ? `<script setup lang="ts">` : `<script setup>`;
  if (forApp) {
    files['index.html'] = htmlShell(cfg, `/src/main.${cfg.ext}`);
    files[`src/main.${cfg.ext}`] = [
      `import { createApp } from 'vue';`,
      `import App from './App.vue';`,
      ``,
      `createApp(App).mount('#root');`,
      ``,
    ].join('\n');
    files['src/App.vue'] = [script, `</script>`, ``, `<template>`, `\t<h1>Hello from ${cfg.name}</h1>`, `</template>`, ``].join('\n');
    pkg.dependencies = { vue: V.vue };
  } else {
    files[`src/index.${cfg.ext}`] = `export { default as Button } from './Button.vue';\n`;
    files['src/Button.vue'] = [
      script,
      `defineProps${cfg.isTs ? '<{ label: string }>()' : "(['label'])"};`,
      `</script>`,
      ``,
      `<template>`,
      `\t<button><slot>{{ label }}</slot></button>`,
      `</template>`,
      ``,
    ].join('\n');
    pkg.peerDependencies = { vue: PEER.vue };
    pkg.devDependencies.vue = V.vue;
  }
}

/* -------------------------------- Svelte --------------------------------- */
function svelte(cfg, files, pkg, forApp) {
  const script = cfg.isTs ? `<script lang="ts">` : `<script>`;
  // Shared by the Vite app build and the Vitest (test) config; enables TS in SFCs.
  files['svelte.config.js'] = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nexport default { preprocess: vitePreprocess() };\n`;
  pkg.devDependencies['@sveltejs/vite-plugin-svelte'] = V['@sveltejs/vite-plugin-svelte'];
  if (cfg.isTs) pkg.devDependencies['svelte-check'] = V['svelte-check'];
  if (forApp) {
    files['index.html'] = htmlShell(cfg, `/src/main.${cfg.ext}`);
    files[`src/main.${cfg.ext}`] = [
      `import { mount } from 'svelte';`,
      `import App from './App.svelte';`,
      ``,
      // Guarded lookup rather than a non-null assertion (clean under strict lint).
      `const target = document.getElementById('root');`,
      `if (!target) throw new Error('Root element #root not found');`,
      ``,
      `const app = mount(App, { target });`,
      `export default app;`,
      ``,
    ].join('\n');
    files['src/App.svelte'] = [script, `</script>`, ``, `<h1>Hello from ${cfg.name}</h1>`, ``].join('\n');
    pkg.dependencies = { svelte: V.svelte };
  } else {
    // Svelte libraries ship uncompiled source; the consumer's bundler compiles.
    files[`src/index.${cfg.ext}`] = `export { default as Button } from './Button.svelte';\n`;
    files['src/Button.svelte'] = [
      script,
      cfg.isTs ? `\tinterface Props { label: string; }` : ``,
      cfg.isTs ? `\tconst { label }: Props = $props();` : `\tconst { label } = $props();`,
      `</script>`,
      ``,
      `<button>{label}</button>`,
      ``,
    ].filter((l) => l !== ``).join('\n') + '\n';
    pkg.peerDependencies = { svelte: PEER.svelte };
    pkg.devDependencies.svelte = V.svelte;
    // Ship source; point consumers at it.
    pkg.svelte = `./src/index.${cfg.ext}`;
    pkg.exports = { '.': { svelte: `./src/index.${cfg.ext}`, default: `./src/index.${cfg.ext}` } };
    pkg.files = ['src'];
    pkg.type = 'module';
  }
}

function htmlShell(cfg, entry) {
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `\t<head>`,
    `\t\t<meta charset="UTF-8" />`,
    `\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `\t\t<title>${cfg.name}</title>`,
    `\t</head>`,
    `\t<body>`,
    `\t\t<div id="root"></div>`,
    `\t\t<script type="module" src="${entry}"></script>`,
    `\t</body>`,
    `</html>`,
    ``,
  ].join('\n');
}
