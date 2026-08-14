import { V } from '../versions.js';
// Always-on. Owns the package entry points (exports/main/module/types/files)
// and the build tooling for the chosen bundler.

export default {
  id: 'bundler',
  active: (cfg) => !cfg.customBuild, // Vite / Svelte-lib own their own build wiring
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {} };
    const build = cfg.bundler !== 'none';

    // ---- entry points ----
    if (!build && !cfg.isTs) {
      // Plain JS, no build: ship source directly.
      pkg.files = ['src'];
      pkg.exports = { '.': `./src/index.js` };
      pkg.main = './src/index.js';
      if (cfg.hasEsm) pkg.module = './src/index.js';
    } else {
      pkg.files = ['dist'];
      // Ship source alongside dist so the JS sourcemaps resolve — consumers can
      // step into and go-to-definition on your original code.
      if (cfg.sourcemaps) pkg.files.push('src');
      const esm = './dist/index.js';
      const cjs = './dist/index.cjs';
      const dtsEsm = './dist/index.d.ts';
      // Dual builds emit a separate .d.cts so CJS consumers resolve the right
      // types under the "require" condition (publint / are-the-types-wrong).
      const dtsCjs = cfg.moduleFormat === 'dual' ? './dist/index.d.cts' : dtsEsm;

      const exp = {};
      if (cfg.hasEsm) exp.import = cfg.isTs ? { types: dtsEsm, default: esm } : esm;
      if (cfg.hasCjs) exp.require = cfg.isTs ? { types: dtsCjs, default: cjs } : cjs;
      pkg.exports = { '.': exp };

      pkg.main = cfg.hasCjs ? cjs : esm;
      if (cfg.hasEsm) pkg.module = esm;
      if (cfg.isTs) pkg.types = cfg.hasEsm ? dtsEsm : dtsCjs;
    }

    // ---- build tooling ----
    const entries = ['src/index.' + cfg.srcExt];
    if (cfg.hasCli) entries.push('src/cli.' + cfg.ext);
    const formats = [cfg.hasEsm && 'esm', cfg.hasCjs && 'cjs'].filter(Boolean);

    if (cfg.bundler === 'tsup' || cfg.bundler === 'tsdown') {
      const tool = cfg.bundler;
      files[`${tool}.config.${cfg.ext}`] = tsupConfig(cfg, entries, formats, tool);
      pkg.scripts.build = tool;
      pkg.scripts.dev = `${tool} --watch`;
      pkg.devDependencies = { [tool]: tool === 'tsup' ? V.tsup : V.tsdown };
      // tsup/tsdown resolve `typescript` even for plain-JS builds; TS projects
      // already get it from the typescript feature.
      if (!cfg.isTs) pkg.devDependencies.typescript = V.typescript;
    } else if (cfg.bundler === 'unbuild') {
      files['build.config.ts'] = unbuildConfig(cfg);
      pkg.scripts.build = 'unbuild';
      pkg.scripts.dev = 'unbuild --stub';
      pkg.devDependencies = { unbuild: V.unbuild };
    } else if (cfg.bundler === 'rollup') {
      // Always a .js config — rollup can't load a .ts config without a loader.
      files['rollup.config.js'] = rollupConfig(cfg, formats);
      pkg.scripts.build = 'rollup -c';
      pkg.scripts.dev = 'rollup -c -w';
      pkg.devDependencies = {
        rollup: V.rollup,
        ...(cfg.isTs ? { '@rollup/plugin-typescript': V['@rollup/plugin-typescript'], tslib: V.tslib } : {}),
        ...(cfg.minify ? { '@rollup/plugin-terser': V['@rollup/plugin-terser'] } : {}),
      };
    } else if (cfg.bundler === 'none' && cfg.isTs) {
      // tsc-only build for TypeScript.
      pkg.scripts.build = 'tsc';
      pkg.scripts.dev = 'tsc --watch';
    }

    // A service or worker owns its `dev` script (tsx/node --watch on the process
    // entry); the bundler only builds it. Don't also contribute a `dev` — that was a
    // silent conflict the two features "resolved" purely by array order.
    if (cfg.hasService || cfg.hasWorker) delete pkg.scripts.dev;

    if (build) pkg.scripts.prepublishOnly = pkg.scripts.build;
    pkg.scripts.clean = 'rimraf dist';
    if (build) pkg.devDependencies = { ...pkg.devDependencies, rimraf: V.rimraf };

    return { files, pkg };
  },
};

function tsupConfig(cfg, entries, formats, tool) {
  return [
    `import { defineConfig } from '${tool}';`,
    ``,
    `export default defineConfig({`,
    `\tentry: [${entries.map((e) => `'${e}'`).join(', ')}],`,
    `\tformat: [${formats.map((f) => `'${f}'`).join(', ')}],`,
    cfg.isTs ? `\tdts: true,` : null,
    `\tsourcemap: true,`,
    `\tclean: true,`,
    `\ttreeshake: true,`,
    cfg.minify ? `\tminify: true,` : null,
    `});`,
    ``,
  ].filter((l) => l !== null).join('\n');
}

function unbuildConfig(cfg) {
  return [
    `import { defineBuildConfig } from 'unbuild';`,
    ``,
    `export default defineBuildConfig({`,
    `\tentries: ['src/index'],`,
    `\tdeclaration: ${cfg.isTs},`,
    `\tclean: true,`,
    `\tfailOnWarn: false,`,
    `\trollup: { emitCJS: ${cfg.hasCjs}${cfg.minify ? ', esbuild: { minify: true }' : ''} },`,
    `});`,
    ``,
  ].join('\n');
}

function rollupConfig(cfg, formats) {
  const out = formats
    .map((f) => `\t\t{ file: 'dist/index.${f === 'cjs' ? 'cjs' : 'js'}', format: '${f}', sourcemap: true }`)
    .join(',\n');
  const imports = [
    cfg.isTs ? `import typescript from '@rollup/plugin-typescript';` : null,
    cfg.minify ? `import terser from '@rollup/plugin-terser';` : null,
  ].filter(Boolean);
  // plugin-typescript needs a declarationDir when the tsconfig enables declarations.
  const plugins = [cfg.isTs ? `typescript({ declarationDir: 'dist', rootDir: 'src', exclude: ['**/*.test.ts'] })` : null, cfg.minify ? 'terser()' : null].filter(Boolean);
  const pluginLine = plugins.length ? `\n\tplugins: [${plugins.join(', ')}],` : '';
  return [
    (imports.length ? imports.join('\n') + '\n' : '') + `export default {`,
    `\tinput: 'src/index.${cfg.ext}',`,
    `\toutput: [`,
    out,
    `\t],${pluginLine}`,
    `};`,
    ``,
  ].join('\n');
}
