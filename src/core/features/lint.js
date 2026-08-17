import { toJson } from '../render.js';
import { V } from '../versions.js';
import { biomeConfig } from '../biome-config.js';

export default {
  id: 'lint',
  active: (cfg) => cfg.lint !== 'none',
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: {} };

    if (cfg.lint === 'eslint-prettier' || cfg.lint === 'oxlint') {
      // Prettier is shared by both.
      files['.prettierrc.json'] = toJson({
        useTabs: true,
        singleQuote: true,
        semi: true,
        printWidth: 100,
        trailingComma: 'all',
      });
      files['.prettierignore'] = 'dist\ncoverage\n';
      pkg.scripts.format = 'prettier --write .';
      pkg.scripts['format:check'] = 'prettier --check .';
      pkg.devDependencies.prettier = V.prettier;
    }

    if (cfg.lint === 'eslint-prettier') {
      files['eslint.config.js'] = eslintFlatConfig(cfg);
      pkg.scripts.lint = 'eslint .';
      pkg.scripts['lint:fix'] = 'eslint . --fix';
      pkg.devDependencies.eslint = V.eslint;
      pkg.devDependencies['@eslint/js'] = V['@eslint/js'];
      if (cfg.isTs) pkg.devDependencies['typescript-eslint'] = V['typescript-eslint'];
    } else if (cfg.lint === 'oxlint') {
      pkg.scripts.lint = 'oxlint';
      pkg.devDependencies.oxlint = V.oxlint;
    } else if (cfg.lint === 'biome') {
      files['biome.json'] = toJson(biomeConfig());
      pkg.scripts.lint = 'biome lint .';
      pkg.scripts['lint:fix'] = 'biome lint --write .';
      pkg.scripts.format = 'biome format --write .';
      pkg.devDependencies['@biomejs/biome'] = V['@biomejs/biome'];
    }

    return { files, pkg };
  },
};

function eslintFlatConfig(cfg) {
  if (cfg.isTs) {
    return [
      `import js from '@eslint/js';`,
      `import tseslint from 'typescript-eslint';`,
      ``,
      `export default tseslint.config(`,
      `\tjs.configs.recommended,`,
      `\t...tseslint.configs.recommended,`,
      `\t{ ignores: ['dist', 'coverage'] },`,
      `);`,
      ``,
    ].join('\n');
  }
  return [
    `import js from '@eslint/js';`,
    ``,
    `export default [`,
    `\tjs.configs.recommended,`,
    `\t{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } },`,
    `\t{ ignores: ['dist', 'coverage'] },`,
    `];`,
    ``,
  ].join('\n');
}
