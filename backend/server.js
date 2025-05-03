// backend/server.js
import express from 'express';
import multer  from 'multer';
import path    from 'path';
import { fileURLToPath } from 'url';
import fs      from 'fs';
import cors    from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve all files from public/, including index.html
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Explicitly serve index.html on GET /
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', build: 'final' });
});

// Upload route
const DATA_DIR = '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const storage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, DATA_DIR),
  filename:    (_req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });
app.post('/api/upload', upload.array('files'), (req, res) => {
  console.log('Uploaded files:', req.files.map(f => f.filename));
  res.json({ uploaded: req.files.map(f => f.filename) });
});

// Fallback: any other path also serve index.html (for client‐side routing)
app.get('/*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Listen on the port Render assigns
const PORT = parseInt(process.env.PORT, 10) || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

