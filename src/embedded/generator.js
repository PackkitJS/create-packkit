// create-packkit as a @packkit/core PackkitGenerator.
//
// A thin adapter over the existing embedded API: it maps create-packkit's
// GeneratedProject/ProjectDefinition to the platform's shapes and advertises the
// capabilities it implements. The underlying create-packkit machinery does the
// real work (and the real definition round-trip), so behavior is unchanged — this
// is the interface that lets MCP, the web configurator, and the registry treat JS
// and Python identically.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PACKKIT_PROTOCOL_VERSION } from '@packkit/core';
import { OPTIONS, PRESET_NAMES, PRESET_INFO } from '../core/index.js';
import {
  SCHEMA_VERSION,
  createProject as ccCreateProject,
  createProjectFromDefinition as ccCreateProjectFromDefinition,
  exportProjectDefinition as ccExportProjectDefinition,
  upgradeProject as ccUpgradeProject,
} from './index.js';

export const GENERATOR_ID = 'javascript';

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')).version;

// Keep the underlying create-packkit project linked to the core-shaped one we
// hand out, so exportDefinition can use the real (extension-aware) machinery.
const underlying = new WeakMap();

function toCoreProject(cc) {
  const core = {
    config: cc.config,
    files: cc.files,
    diagnostics: cc.diagnostics,
    metadata: {
      generatorId: GENERATOR_ID,
      generatorVersion: cc.metadata.packkitVersion,
      protocolVersion: PACKKIT_PROTOCOL_VERSION,
      schemaVersion: cc.metadata.schemaVersion,
      preset: cc.metadata.preset,
    },
    deploymentContract: cc.deploymentContract,
  };
  underlying.set(core, cc);
  return core;
}

function toCoreDefinition(def) {
  return {
    schemaVersion: def.schemaVersion,
    protocolVersion: PACKKIT_PROTOCOL_VERSION,
    generator: { id: GENERATOR_ID, version: def.packkitVersion },
    preset: def.preset,
    config: def.config,
    extensions: def.extensions,
  };
}

function toCreatePackkitDefinition(def) {
  return {
    schemaVersion: def.schemaVersion,
    packkitVersion: def.generator?.version,
    preset: def.preset,
    config: def.config,
    extensions: def.extensions,
  };
}

/** create-packkit implemented as a platform generator. */
export const packkitGenerator = {
  id: GENERATOR_ID,
  language: 'javascript',
  version: VERSION,
  maturity: 'stable',
  protocol: {
    version: PACKKIT_PROTOCOL_VERSION,
    capabilities: ['generate', 'deployment-contract', 'project-definition', 'baseline-upgrade'],
  },

  listPresets() {
    return PRESET_NAMES.map((id) => ({ id, description: PRESET_INFO[id], maturity: 'stable' }));
  },

  getSchema() {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatorId: GENERATOR_ID,
      options: Object.entries(OPTIONS).map(([id, spec]) => ({
        id,
        choices: spec.choices,
        default: spec.default,
      })),
    };
  },

  createProject(input) {
    return toCoreProject(ccCreateProject(input ?? {}));
  },

  exportDefinition(project) {
    const cc = underlying.get(project);
    // Fall back to reconstructing from the core project if it wasn't produced
    // by this generator (still round-trips via preset + config).
    if (cc) return toCoreDefinition(ccExportProjectDefinition(cc));
    return {
      schemaVersion: SCHEMA_VERSION,
      protocolVersion: PACKKIT_PROTOCOL_VERSION,
      generator: { id: GENERATOR_ID, version: project.metadata.generatorVersion },
      preset: project.metadata.preset,
      config: project.config,
    };
  },

  createProjectFromDefinition(definition) {
    return toCoreProject(ccCreateProjectFromDefinition(toCreatePackkitDefinition(definition)));
  },

  upgradeProject(input) {
    return ccUpgradeProject(input ?? {});
  },
};
