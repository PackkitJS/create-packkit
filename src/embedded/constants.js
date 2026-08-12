// Standalone so both index.js and generator.js can import it without forming an
// import cycle (generator.js needs it at module top-level for packkitGenerator.id).

/** This generator's stable platform id. */
export const GENERATOR_ID = 'javascript';
