// backend/server.js

import express from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import cors    from 'cors';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { Client }        from 'pg';
import { analyzeClip }   from './analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ─── Serve Static UI ───────────────────────────────────────────
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('/*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ─── API: Health Check ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── API: Upload Clips ──────────────────────────────────────────
const DATA_DIR = '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, DATA_DIR),
  filename:    (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });

app.post('/api/upload', upload.array('files'), (req, res) => {
  console.log('Uploaded:', req.files.map(f => f.filename));
  res.json({ uploaded: req.files.map(f => f.filename) });
});

// ─── Start Express Server ──────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});

// ─── Embedded Watcher & DB Logic ───────────────────────────────
(async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('❌ No DATABASE_URL set; watcher disabled');
    return;
  }

  // Connect to Postgres
  const db = new Client({ connectionString: DATABASE_URL });
  try {
    await db.connect();
    console.log('✅ DB connected');
  } catch (err) {
    console.error('❌ DB connection error:', err);
    return;
  }

  // Ensure plays table exists
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS plays (
        id                 SERIAL PRIMARY KEY,
        team               TEXT     NOT NULL,
        clip               TEXT     NOT NULL,
        start_time         REAL     NOT NULL,
        end_time           REAL     NOT NULL,
        offense_formation  TEXT     NOT NULL,
        defense_formation  TEXT     NOT NULL,
        blitz              BOOLEAN  NOT NULL,
        coverage           TEXT     NOT NULL,
        run_direction      TEXT     NOT NULL,
        pass_type          TEXT     NOT NULL,
        completed          BOOLEAN  NOT NULL,
        created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Ensured plays table exists');
  } catch (err) {
    console.error('❌ Error creating plays table:', err);
    return;
  }

  // List any existing clips
  try {
    const existing = fs.readdirSync(DATA_DIR);
    console.log('🔍 Existing files in /data:', existing);
  } catch (e) {
    console.error('⚠️ Could not list /data:', e);
  }

  // Watch for new MP4s
  const watcher = chokidar.watch(DATA_DIR, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 2000 }
  });

  watcher.on('add', async filePath => {
    if (!filePath.toLowerCase().endsWith('.mp4')) return;
    console.log(`▶ Detected new clip: ${filePath}`);

    try {
      const plays = await analyzeClip(filePath);
      console.log(`↳ Extracted ${plays.length} plays`);

      for (const p of plays) {
        await db.query(
          `INSERT INTO plays
             (team, clip, start_time, end_time, offense_formation,
              defense_formation, blitz, coverage, run_direction,
              pass_type, completed)
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

      // Move processed clip
      const doneDir = path.join(DATA_DIR, 'processed');
      if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });
      fs.renameSync(filePath, path.join(doneDir, path.basename(filePath)));
      console.log(`✔ Moved clip to /data/processed`);
    } catch (err) {
      console.error('❌ Processing error:', err);
    }
  });

  watcher.on('error', err => {
    console.error('Watcher error:', err);
  });

  console.log(`🎬 Worker watching for new clips in ${DATA_DIR}`);
})();
