// backend/server.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import { analyzeClip } from './analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());

// serve UI
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('/*', (_req,res) => res.sendFile(path.join(publicDir,'index.html')));

// health
app.get('/api/health', (_,_2) => _2.json({ status:'ok' }));

// upload endpoint
const DATA_DIR = '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const storage = multer.diskStorage({
  destination: (_req,file,cb) => cb(null, DATA_DIR),
  filename: (_req,file,cb) => cb(null, Date.now()+'_'+file.originalname)
});
const upload = multer({ storage });
app.post('/api/upload', upload.array('files'), (req,res) => {
  console.log('Uploaded:', req.files.map(f=>f.filename));
  res.json({ uploaded: req.files.map(f=>f.filename) });
});

// start Express
const PORT = parseInt(process.env.PORT,10)||8080;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));

// ——— begin embedded watcher ———
(async function(){
  const DATABASE_URL = process.env.DATABASE_URL;
  if(!DATABASE_URL) return console.error('No DATABASE_URL');

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log('✅ DB connected, starting file watcher');

  const watcher = chokidar.watch(DATA_DIR, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold:2000 }
  });

  watcher.on('add', async filePath => {
    if(!filePath.endsWith('.mp4')) return;
    console.log(`▶ New clip: ${filePath}`);
    try {
      const plays = await analyzeClip(filePath);
      console.log(`↳ ${plays.length} plays`);
      for(let p of plays){
        await db.query(
          `INSERT INTO plays
           (team, clip, start_time,end_time,offense_formation,
            defense_formation,blitz,coverage,run_direction,
            pass_type,completed)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [p.team, path.basename(filePath),p.startTime,p.endTime,
           p.offenseFormation,p.defenseFormation,p.blitz,p.coverage,
           p.runDirection,p.passType,p.completed]
        );
      }
      console.log(`☑ Wrote ${plays.length} rows`);
      // move it so we don't reprocess
      const done = path.join(DATA_DIR,'processed');
      if(!fs.existsSync(done)) fs.mkdirSync(done);
      fs.renameSync(filePath, path.join(done,path.basename(filePath)));
    } catch(e){
      console.error('⚠️ Error processing:', e);
    }
  });
})();


