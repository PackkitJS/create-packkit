// create-packkit as a @packkit/core PackkitGenerator.
//
// Since 4.0 the embedded API's GeneratedProject is already protocol-native (its
// metadata is the @packkit/core shape), so this adapter is a thin wrapper: it
// advertises identity + capabilities, exposes presets/schema, and translates
// only the ProjectDefinition format (create-packkit's PackkitProjectDefinition
// <-> the platform's ProjectDefinition). The underlying machinery does the work.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PACKKIT_PROTOCOL_VERSION } from '@packkit/core';
import { OPTIONS, PRESET_NAMES, PRESET_INFO } from '../core/index.js';
import { GENERATOR_ID } from './constants.js';
import {
  SCHEMA_VERSION,
  createProject as ccCreateProject,
  createProjectFromDefinition as ccCreateProjectFromDefinition,
  exportProjectDefinition as ccExportProjectDefinition,
  upgradeProject as ccUpgradeProject,
} from './index.js';

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')).version;

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
      options: Object.entries(OPTIONS).map(([id, spec]) => ({ id, choices: spec.choices, default: spec.default })),
    };
  },

  createProject(input) {
    return ccCreateProject(input ?? {});
  },

  exportDefinition(project) {
    return toCoreDefinition(ccExportProjectDefinition(project));
  },

  createProjectFromDefinition(definition) {
    return ccCreateProjectFromDefinition(toCreatePackkitDefinition(definition));
  },

  upgradeProject(input) {
    return ccUpgradeProject(input ?? {});
  },
};
