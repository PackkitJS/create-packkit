// Minimal {{var}} template rendering — feature modules mostly use template
// literals directly; this is for the few multi-line string templates.

/** Replace {{ key }} / {{ a.b }} tokens from `vars`. Missing keys render empty. */
export function render(template, vars = {}) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? o : o[k]), vars);
    return val == null ? '' : String(val);
  });
}

// Keys that would let a merged-in object reach an object's prototype. The
// embedded API deep-merges host-supplied data (extension package.json), so
// these are skipped defensively even though the merge is immutable.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Deep-merge plain objects (arrays are concatenated + de-duped). Used to fold
 *  each feature's package.json fragment into the accumulator. */
export function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...new Set([...target, ...source])];
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const out = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (UNSAFE_KEYS.has(k)) continue;
      out[k] = k in target ? deepMerge(target[k], v) : v;
    }
    return out;
  }
  return source;
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

// Stable, human-friendly stringify (2-space indent + trailing newline) — now the
// shared deterministic serializer in @packkit/core, re-exported here.
export { toJson } from '@packkit/core';
