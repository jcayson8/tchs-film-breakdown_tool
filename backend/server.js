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

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Serve static UI from public/
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('/*', (_req, res) =>
  res.sendFile(path.join(publicDir, 'index.html'))
);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// File upload endpoint
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

// Database client
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}
const db = new Client({ connectionString: DATABASE_URL });

// Connect & initialize
(async () => {
  try {
    await db.connect();
    console.log('✅ DB connected');
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
        created_at         TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Ensured plays table exists');
  } catch (err) {
    console.error('❌ DB init error:', err);
    process.exit(1);
  }

  // API: fetch all plays
  app.get('/api/plays', async (_req, res) => {
    try {
      const result = await db.query('SELECT * FROM plays ORDER BY id DESC');
      res.json(result.rows);
    } catch (err) {
      console.error('❌ /api/plays error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // API: aggregated metrics
  app.get('/api/metrics', async (_req, res) => {
    try {
      const formations = await db.query(`
        SELECT offense_formation AS category,
               COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS pct
          FROM plays
         GROUP BY offense_formation
      `);
      const defense = await db.query(`
        SELECT defense_formation AS category,
               COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS pct
          FROM plays
         GROUP BY defense_formation
      `);
      res.json({
        formations: formations.rows,
        defense:    defense.rows
      });
    } catch (err) {
      console.error('❌ /api/metrics error:', err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // Watch for new clips
  const watcher = chokidar.watch(DATA_DIR, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000 }
  });
  watcher.on('add', async filePath => {
    if (!filePath.toLowerCase().endsWith('.mp4')) return;
    console.log(`▶ New clip: ${filePath}`);
    try {
      const plays = await analyzeClip(filePath);
      console.log(`↳ Extracted ${plays.length} plays`);
      for (const p of plays) {
        await db.query(
          `INSERT INTO plays
             (team, clip, start_time, end_time,
              offense_formation, defense_formation,
              blitz, coverage, run_direction,
              pass_type, completed)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
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
      console.log(`☑ Wrote ${plays.length} rows`);
      const done = path.join(DATA_DIR, 'processed');
      if (!fs.existsSync(done)) fs.mkdirSync(done, { recursive: true });
      fs.renameSync(filePath, path.join(done, path.basename(filePath)));
      console.log('✔ Moved clip to processed');
    } catch (err) {
      console.error('❌ Processing error:', err);
    }
  });
  watcher.on('error', err => console.error('Watcher error:', err));
  console.log('🎬 Watching /data for new clips');
})();

// Start server
const PORT = parseInt(process.env.PORT, 10) || 8080;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
