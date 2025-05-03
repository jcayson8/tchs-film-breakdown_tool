import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { Client } from 'pg';
import { analyzeClip } from './analysis.js';

// resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR    = process.env.DATA_DIR    || '/data';
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// connect to Postgres
const db = new Client({ connectionString: DATABASE_URL });
await db.connect();
console.log('✅ Connected to Postgres');

// ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// watch for new .mp4 files
const watcher = chokidar.watch(DATA_DIR, {
  ignoreInitial: true,
  depth: 0,
  awaitWriteFinish: { stabilityThreshold: 2000 }
});

watcher.on('add', async filePath => {
  if (!filePath.toLowerCase().endsWith('.mp4')) return;
  console.log(`▶ Detected new clip: ${filePath}`);

  try {
    // run your ML analysis
    const plays = await analyzeClip(filePath);
    console.log(`↳ Extracted ${plays.length} plays`);

    // insert each play into the DB
    for (const p of plays) {
      const res = await db.query(
        `INSERT INTO plays
         (team, clip, start_time, end_time, offense_formation, defense_formation,
          blitz, coverage, run_direction, pass_type, completed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          p.team,
          path.basename(filePath),
          p.startTime,
          p.endTime,
          p.offenseFormation,
          p.defenseFormation,
          p.blitz,
          p.coverage,
          p.runDirection,
          p.passType,
          p.completed
        ]
      );
    }
    console.log(`☑ Wrote ${plays.length} rows to DB`);

    // move processed clip out of /data
    const doneDir = path.join(DATA_DIR, 'processed');
    if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir);
    fs.renameSync(filePath, path.join(doneDir, path.basename(filePath)));
    console.log(`✔ Moved clip to /data/processed`);

  } catch (err) {
    console.error('❌ Error processing clip:', err);
  }
});

watcher.on('error', err => {
  console.error('Watcher error:', err);
});

console.log(`🎬 Worker watching for new clips in ${DATA_DIR}`);
