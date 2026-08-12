#!/usr/bin/env node
// Packkit MCP server — exposes Packkit scaffolding as Model Context Protocol
// tools so agents (Claude Desktop, Cursor, etc.) can generate projects natively.

import { join, resolve } from 'node:path';
import {
  writeProject,
  existingEntries,
  gitInit,
  installDeps,
  hasCommand,
  githubLogin,
  createGithubRepo,
  writeLockfile,
  commitAll,
} from 'create-packkit/scaffold';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  generate,
  fromPreset,
  normalizeConfig,
  OPTIONS,
  PRESET_INFO,
  PRESET_ALIASES,
} from 'create-packkit/core';

const configFrom = ({ name, preset, options }) => {
  const base = { name, ...(options || {}) };
  return preset ? fromPreset(preset, base) : normalizeConfig(base);
};

const TOOLS = [
  {
    name: 'packkit_schema',
    description:
      'START HERE. Returns every Packkit option, preset, and shortcut alias as JSON. ' +
      'Call this before scaffolding so you pick a preset that matches what the user actually wants — ' +
      'presets range from single libraries to CLIs, HTTP services, SPAs, and full-stack monorepos, ' +
      'and guessing without reading them is the main cause of scaffolding the wrong shape.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'packkit_preview',
    description:
      'Show the project structure a config would produce — the full file tree and stack summary — without writing anything. ' +
      'Use this to check the layout before committing to it, and to show the user what they are about to get. ' +
      'Cheap and side-effect free, so prefer it over scaffolding to a throwaway directory to see what happens.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        preset: { type: 'string', description: 'A preset or alias (e.g. ts-lib, react-lib, node-service, rlib)' },
        options: { type: 'object', description: 'Any options from packkit_schema (e.g. { "framework": "vue", "target": ["library"] })' },
      },
      required: ['name'],
    },
  },
  {
    name: 'packkit_scaffold',
    description:
      'Generate a project to disk. Writes files under <directory>/<name> (or ./<name>), optionally runs git init, ' +
      'installs dependencies, and creates the GitHub repository. ' +
      'Call packkit_schema first if you have not already — picking the preset by guess is how projects end up the wrong shape. ' +
      'If the target directory already has files in it (an existing clone, for instance), pass merge: true rather than failing.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name (also the folder name)' },
        preset: { type: 'string', description: 'A preset or alias' },
        options: { type: 'object', description: 'Any options from packkit_schema' },
        directory: { type: 'string', description: 'Parent directory to create the project in (default: current working directory)' },
        install: { type: 'boolean', description: 'Install dependencies (default false)' },
        git: { type: 'boolean', description: 'git init + initial commit (default false)' },
        merge: { type: 'boolean', description: 'Scaffold into a non-empty directory. Existing files are never overwritten — colliding ones are skipped and reported. Use this when the target is an already-cloned repo.' },
        github: { type: 'boolean', description: 'Create the repository on GitHub and push to it, using the `gh` CLI. Requires git. Private unless "public" is set.' },
        public: { type: 'boolean', description: 'When creating the repository, make it public (default: private)' },
      },
      required: ['name'],
    },
  },
];

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true });

function fileTree(files) {
  return Object.keys(files).sort().map((p) => `  ${p}`).join('\n');
}

const server = new Server({ name: 'packkit', version: '0.3.1' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    if (name === 'packkit_schema') {
      return text(JSON.stringify({ options: OPTIONS, presets: PRESET_INFO, aliases: PRESET_ALIASES }, null, 2));
    }

    if (name === 'packkit_preview') {
      const { files, summary } = generate(configFrom(args));
      return text(`Stack: ${summary.stack.join(' · ')}\nFiles (${summary.fileCount}):\n${fileTree(files)}`);
    }

    if (name === 'packkit_scaffold') {
      const config = configFrom(args);
      if (!config.name) return fail('A "name" is required.');
      const parent = args.directory ? resolve(args.directory) : process.cwd();
      const targetDir = join(parent, config.name);
      const occupied = existingEntries(targetDir);
      if (occupied.length && !args.merge) {
        return fail(
          `Target directory "${targetDir}" is not empty (${occupied.slice(0, 4).join(', ')}). ` +
            'Pass merge: true to scaffold around the existing files — they are never overwritten.',
        );
      }

      // Creating the repo has to be settled before generating: the repository
      // URL is baked into package.json links and README badges.
      let slug = null;
      if (args.github) {
        if (!args.git) return fail('github: true also needs git: true — there must be a commit to push.');
        if (!hasCommand('gh')) return fail('github: true needs the GitHub CLI (https://cli.github.com).');
        const login = githubLogin();
        if (!login) return fail('github: true needs an authenticated GitHub CLI. Run: gh auth login');
        slug = `${login}/${config.name}`;
        config.repo = `https://github.com/${slug}`;
      }

      const { files, summary } = generate(config);
      const { written, skipped } = await writeProject(targetDir, files, { merge: !!args.merge });

      const steps = [];
      if (skipped.length) steps.push(`kept ${skipped.length} existing file(s): ${skipped.join(', ')}`);
      if (args.git) {
        gitInit(targetDir);
        steps.push('git initialized');
      }
      if (args.install) {
        steps.push(installDeps(config.packageManager, targetDir) ? 'dependencies installed' : 'install failed (run it manually)');
      }
      if (slug) {
        // Pushing without a lockfile makes the new repo's first CI run fail.
        if (!args.install) writeLockfile(config.packageManager, targetDir);
        commitAll(targetDir, 'Add lockfile');
        const res = createGithubRepo({
          slug,
          description: config.description,
          private: !args.public,
          cwd: targetDir,
        });
        steps.push(res.ok ? `pushed to ${config.repo}` : `repo creation failed: ${res.error}`);
      }
      return text(
        `Created ${summary.name} at ${targetDir}\n${written.length} files · ${summary.stack.join(' · ')}` +
          (steps.length ? `\n${steps.join('; ')}` : ''),
      );
    }

    return fail(`Unknown tool: ${name}`);
  } catch (err) {
    return fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

await server.connect(new StdioServerTransport());
