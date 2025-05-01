import multer from 'multer';
const upload = multer({ dest: '/data' });   // /data is your Render disk mount
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'public')));
// receives MP4 uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
  console.log('Saved MP4:', req.file.path);
  // TODO: kick off analysis worker here
  res.sendStatus(200);
});
app.get('/api/health', (_, res) => res.json({status:'ok'}));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log('running on', PORT));
