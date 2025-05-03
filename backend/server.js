// backend/server.js
import express from 'express';
import multer from 'multer';
// … other imports …

const app = express();

// your existing setup…
const upload = multer({ /* … */ });

// serve static UI, JSON endpoints, etc.
// …

// **Use the PORT env var**
const PORT = parseInt(process.env.PORT, 10) || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

