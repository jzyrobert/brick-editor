// Builds the marketplace mapping pack (src/catalog/mappings.json, locked in
// data.json): the individually reviewed catalogue mappings
// (scripts/bricklink-review.json) and the derived table for every other
// official part, taken from the LDraw part files' own BrickLink keywords
// (scripts/marketplace-mappings.ts, src/catalog/mappings-derived.json).
// Both are written by the catalogue build, which owns the catalogue they key.
//   npm run library:mappings
import "./build-parts";
