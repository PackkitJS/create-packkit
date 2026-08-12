// Public types for the embedded API (create-packkit/embedded).

import type { PackkitConfig, ResolvedPackkitConfig, ProjectSummary } from './core.js';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  field?: string;
  source?: string;
  previousValue?: unknown;
  resolvedValue?: unknown;
}

export interface GeneratedProjectMetadata {
  /** The generator's stable platform id — 'javascript' for create-packkit. */
  generatorId: string;
  /** The generator (package) version. Renamed from `packkitVersion` in 4.0. */
  generatorVersion: string;
  /** The @packkit/core protocol version this output conforms to. */
  protocolVersion: number;
  schemaVersion: number;
  preset?: string;
  generatedAt?: string;
  extension?: Record<string, unknown>;
}

export type DeploymentType = 'static' | 'node-service' | 'library' | 'cli' | 'fullstack';

export interface StaticDeploymentContract {
  type: 'static';
  buildCommand: string;
  outputDirectory: string;
}

export interface NodeServiceDeploymentContract {
  type: 'node-service';
  runtime: 'node';
  buildCommand?: string;
  startCommand: string;
  /** The port the server binds to with no configuration. */
  defaultPort: number;
  /** The env var that overrides the port (so PORT is optional, not required). */
  portEnvironmentVariable: string;
  healthCheckPath: string;
  containerFile?: string;
  requiredEnvironmentVariables: string[];
  optionalEnvironmentVariables: string[];
}

export interface CliDeploymentContract {
  type: 'cli';
  buildCommand?: string;
}

export interface LibraryDeploymentContract {
  type: 'library';
  buildCommand?: string;
}

/** Front end and back end exposed separately — the host may deploy them together
 *  (the server serves the web build) or apart. */
export interface FullstackDeploymentContract {
  type: 'fullstack';
  frontend: StaticDeploymentContract;
  backend: NodeServiceDeploymentContract;
}

export type DeploymentContract =
  | StaticDeploymentContract
  | NodeServiceDeploymentContract
  | CliDeploymentContract
  | LibraryDeploymentContract
  | FullstackDeploymentContract;

export interface GeneratedProject {
  config: ResolvedPackkitConfig;
  files: Record<string, string>;
  summary: ProjectSummary;
  diagnostics: Diagnostic[];
  metadata: GeneratedProjectMetadata;
  deploymentContract: DeploymentContract;
}

export interface CreateProjectInput {
  name?: string;
  preset?: string;
  config?: PackkitConfig;
  overrides?: PackkitConfig;
}

export type CollisionPolicy = 'error' | 'skip' | 'overwrite';

export interface ProjectExtension {
  files?: Record<string, string>;
  packageJson?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  collisionPolicy?: CollisionPolicy;
}

/** How a stored extension file relates to generated output: `add` = the host
 *  introduced a new path; `replace` = it deliberately overrode a generated one. */
export interface StoredExtensionFile {
  content: string;
  mode: 'add' | 'replace';
}

export interface PackkitProjectDefinition {
  schemaVersion: number;
  packkitVersion: string;
  preset?: string;
  config: PackkitConfig;
  extensions?: {
    files?: Record<string, StoredExtensionFile>;
    packageJson?: Record<string, unknown>;
  };
}

export class PackkitValidationError extends Error {
  readonly code: 'PACKKIT_VALIDATION_FAILED';
  diagnostics: Diagnostic[];
}

export const SCHEMA_VERSION: number;

export function createProject(input?: CreateProjectInput): GeneratedProject;
export function resolveProjectConfig(input?: CreateProjectInput): { config: ResolvedPackkitConfig; diagnostics: Diagnostic[] };
export function createProjectFromResolvedConfig(config: ResolvedPackkitConfig, options?: { diagnostics?: Diagnostic[] }): GeneratedProject;
export function extendProject(project: GeneratedProject, extension?: ProjectExtension): GeneratedProject;
export function exportProjectDefinition(project: GeneratedProject): PackkitProjectDefinition;
export function createProjectFromDefinition(
  definition: PackkitProjectDefinition,
  options?: { driftPolicy?: 'report' | 'error' },
): GeneratedProject;
export function calculateProjectDigest(project: GeneratedProject): string;
export function deriveDeploymentContract(config: ResolvedPackkitConfig): DeploymentContract;

/** Whether a project fully matches the Packkit version it was last upgraded to.
 *  `partial` means an upgrade applied some changes but left others unresolved
 *  (preserved user edits / conflicts); `current` means nothing was left. */
export type UpgradeStatus = 'current' | 'partial' | 'conflicted';

/** The upgrade-tracking fields Packkit writes into `packkit.json`. All are
 *  additive and optional, so pre-existing packkit.json files stay valid. */
export interface UpgradeProvenance {
  /** The version the project was originally scaffolded with. An upgrade never
   *  changes this — it is historical provenance, not the current state. */
  version?: string;
  /** The Packkit version used to compute the most recent upgrade plan. */
  lastUpgradeCheckedWith?: string;
  /** The Packkit version whose patch was most recently applied. */
  lastUpgradeAppliedWith?: string;
  upgradeStatus?: UpgradeStatus;
  /** Count of changes an upgrade left unresolved; omitted when fully current. */
  unresolvedChanges?: number;
}

export type DependencySection = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';

/** Three-way classification of a value that differs from the current template. */
export type ChangeStatus = 'changed' | 'template-only-change' | 'user-only-change' | 'both-changed';

export interface ChangeClassification {
  /** Present on *changed* items; 'changed' when there's no baseline to compare. */
  status?: ChangeStatus;
  /** True for a template-only change (the user hadn't edited it). */
  safeToApply?: boolean;
  reason?: string;
}

export interface DependencyChange extends ChangeClassification {
  /** Absent when the dependency is newly added. */
  current?: string;
  generated: string;
}

/** Dependency changes keyed by section, then package name — never by name alone. */
export type DependencyChangeMap = Record<DependencySection, Record<string, DependencyChange>>;

export interface PackageFieldChange extends ChangeClassification {
  field: string;
  current?: unknown;
  generated: unknown;
}

export interface PackageUpgradePlan {
  addedScripts: Record<string, string>;
  changedScripts: Record<string, { current: string; generated: string } & ChangeClassification>;
  addedDependencies: DependencyChangeMap;
  changedDependencies: DependencyChangeMap;
  addedFields: PackageFieldChange[];
  changedFields: PackageFieldChange[];
}

export type FileUpgradeStatus =
  | 'new-generated-file'
  | 'unchanged'
  | 'changed'
  | 'template-only-change'
  | 'user-only-change'
  | 'both-changed';

export interface UpgradePlan {
  files: {
    added: string[];
    changed: string[];
    unchanged: string[];
    /** Classification of each changed file (three-way when a baseline exists). */
    entries: Record<string, ChangeClassification>;
  };
  packageJson: PackageUpgradePlan;
  /** True when the project's packkit.json carried a baseline to compare against. */
  baselineAvailable: boolean;
  diagnostics: Diagnostic[];
  provenanceOutdated: boolean;
}

export type UpgradeApplyMode = 'add-only' | 'replace-changed';

/** Per-category apply policy. Default is add-only everywhere (non-destructive). */
export interface UpgradeApplyPolicy {
  files: UpgradeApplyMode;
  scripts: UpgradeApplyMode;
  dependencies: UpgradeApplyMode;
  packageFields: UpgradeApplyMode;
}

export const DEFAULT_UPGRADE_POLICY: Readonly<UpgradeApplyPolicy>;

export interface UpgradeSummary {
  safeChanges: number;
  reviewChanges: number;
  conflicts: number;
}

export interface UpgradeProjectInput {
  definition: PackkitProjectDefinition;
  currentFiles: Record<string, string>;
  currentPackageJson?: Record<string, unknown>;
  policy?: Partial<UpgradeApplyPolicy>;
}

export interface ProjectUpgradeResult {
  generatedProject: GeneratedProject;
  plan: UpgradePlan;
  patch: Record<string, string>;
  diagnostics: Diagnostic[];
  metadata: {
    fromPackkitVersion?: string;
    toPackkitVersion: string;
    baselineAvailable: boolean;
    hasConflicts: boolean;
    hasSafeChanges: boolean;
  };
}

/** In-memory upgrade orchestration for host apps: recreate, diff, and build a
 *  patch under a policy. No filesystem, git, network, or command execution. */
export function upgradeProject(input: UpgradeProjectInput): ProjectUpgradeResult;

export function planUpgrade(input: { generated: Record<string, string>; onDisk: Record<string, string | undefined> }): UpgradePlan;
export function summarizeUpgrade(plan: UpgradePlan): UpgradeSummary;
export function isUpgradeEmpty(plan: UpgradePlan): boolean;
export function buildUpgradeWrite(input: {
  generated: Record<string, string>;
  onDisk: Record<string, string | undefined>;
  plan: UpgradePlan;
  policy?: Partial<UpgradeApplyPolicy>;
}): Record<string, string>;
