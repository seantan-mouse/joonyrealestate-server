# scripts/migrate-all.sh
set -e

node scripts/exportSqlData2.js
node scripts/transformBuildings.js
MIGRATION_NUKE_OK=YES npx tsx scripts/importBuildings.ts
NORMALIZE_NUKE_OK=YES npx tsx scripts/normalizeBuildingsToCollections.ts
npx tsx scripts/verifyNormalizedData.js

# run this in terminal: bash scripts/migrate-all.sh
