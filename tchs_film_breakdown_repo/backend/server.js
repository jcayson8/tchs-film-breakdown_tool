import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static React build
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Fallback to React
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
