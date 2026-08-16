// .gitignore, .editorconfig, .npmrc — always-on repo hygiene.

const GITIGNORE = `# dependencies
node_modules/
.pnp.*
.yarn/*

# build output
dist/
coverage/
*.tsbuildinfo

# test artifacts (Playwright)
test-results/
playwright-report/
playwright/.cache/

# logs
*.log
npm-debug.log*

# env & editor
.env
.env.*
!.env.example
.DS_Store
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
`;

const EDITORCONFIG = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = tab

[*.{json,yml,yaml,md}]
indent_style = space
indent_size = 2
`;

// engine-strict turns npm/pnpm's `engines` warning into a hard install error, so
// a contributor, CI job, or agent on an unsupported Node fails immediately with a
// clear message instead of a broken install they scroll past.
const NPMRC = `engine-strict=true
`;

// Modern Yarn (Berry) defaults to Plug'n'Play, which the rest of the generated
// toolchain (tsup, vitest, ESLint) doesn't expect. node-modules linker keeps a
// conventional install so everything resolves the way every other pm does.
const YARNRC = `nodeLinker: node-modules
`;

export default {
  id: 'gitfiles',
  active: () => true,
  apply(cfg) {
    const files = { '.gitignore': GITIGNORE, '.npmrc': NPMRC };
    if (cfg.packageManager === 'yarn') files['.yarnrc.yml'] = YARNRC;
    if (cfg.editorconfig) files['.editorconfig'] = EDITORCONFIG;
    return { files, pkg: {} };
  },
};
