// contentHash now lives in @packkit/core — the browser-safe platform primitives
// shared by every generator, so a project's packkit.json baseline hashes are
// computed identically across the ecosystem. Re-exported here to keep
// create-packkit's internal imports stable through the platform migration.
export { contentHash } from '@packkit/core';
