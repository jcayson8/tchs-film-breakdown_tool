import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const DATA_DIR = '/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const storage = multer.diskStorage({
  destination: (req,file,cb)=>cb(null, DATA_DIR),
  filename: (req,file,cb)=>cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname,'public')));

app.get('/api/health', (_,res)=>res.json({status:'ok'}));

app.post('/api/upload', upload.array('files'), (req,res)=>{
  console.log('Uploaded', req.files.length);
  res.sendStatus(200);
});

app.get('*', (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT, ()=>console.log('Running on', PORT));
