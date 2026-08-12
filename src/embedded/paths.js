// Path validation now lives in @packkit/core (browser-safe, pure — no node:path),
// shared by every generator and the safe writer. Re-exported here to keep
// create-packkit's internal imports stable through the platform migration.
export { validateRelativePath, validatePathMap } from '@packkit/core';
