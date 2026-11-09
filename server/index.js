import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v4 as uuid, validate as isUuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const MAX_MB = +process.env.MAX_FILE_MB || 100;
const MAX_FILES = +process.env.MAX_FILES || 20;
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, 'storage'));
const UPLOADS = path.join(STORAGE, 'uploads');
const DB = path.join(STORAGE, 'shares.json');
fs.mkdirSync(UPLOADS, { recursive: true });

const EXPIRY = { '1h': 3600e3, '24h': 86400e3, '7d': 7 * 86400e3 };
const TYPES = ['file', 'text', 'link', 'contact', 'wifi', 'custom'];
const BLOCKED_EXT = /\.(exe|bat|cmd|com|scr|msi|vbs|ps1|jar|dll)$/i;
const INLINE_OK = /^(image\/(png|jpe?g|gif|webp)|video\/|audio\/|application\/pdf)/;

let shares = {};
try { shares = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch {}
const save = () => fs.writeFileSync(DB, JSON.stringify(shares));
const pub = ({ id, code, type, payload, files, createdAt, expiresAt, downloads }) => ({
  id, code, type, payload, createdAt, expiresAt, downloads,
  files: files.map(({ id, name, size, mime }) => ({ id, name, size, mime })), // never expose stored paths
});
function removeShare(id) {
  const s = shares[id]; if (!s) return;
  for (const f of s.files) fs.rm(path.join(UPLOADS, f.stored), { force: true }, () => {});
  delete shares[id]; save();
}
const sweep = () => { const now = Date.now(); for (const s of Object.values(shares)) if (s.expiresAt <= now) removeShare(s.id); };
sweep(); setInterval(sweep, 60e3);

const upload = multer({
  storage: multer.diskStorage({ destination: UPLOADS, filename: (_r, _f, cb) => cb(null, uuid()) }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_r, f, cb) => {
    f.originalname = path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8')).replace(/[\u0000-\u001f]/g, '');
    BLOCKED_EXT.test(f.originalname) ? cb(new Error(`"${f.originalname}" is an unsupported file type.`)) : cb(null, true);
  },
}).array('files');

const app = express();
app.set('trust proxy', 1); // so rate limiting sees the real client IP behind Railway
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/config', (_q, res) => res.json({ maxFileMb: MAX_MB, maxFiles: MAX_FILES }));

// Look up a share by its 7-digit code (rate limited: 10 tries/minute per IP to stop guessing)
const hits = new Map(); setInterval(() => hits.clear(), 10 * 60e3);
app.get('/api/code/:code', (req, res) => {
  const now = Date.now(), recent = (hits.get(req.ip) || []).filter((t) => now - t < 60e3);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
  hits.set(req.ip, [...recent, now]);
  if (!/^\d{7}$/.test(req.params.code)) return res.status(400).json({ error: 'Enter a valid 7-digit code.' });
  const s = Object.values(shares).find((x) => x.code === req.params.code);
  if (!s) return res.status(404).json({ error: 'No share found for that code.' });
  if (s.expiresAt <= now) { removeShare(s.id); return res.status(410).json({ error: 'This share has expired.' }); }
  res.json({ id: s.id });
});

app.post('/api/shares', (req, res) => {
  upload(req, res, (err) => {
    const files = req.files || [];
    const fail = (code, msg) => { files.forEach((f) => fs.rm(f.path, { force: true }, () => {})); res.status(code).json({ error: msg }); };
    if (err) return fail(400, err.code === 'LIMIT_FILE_SIZE' ? `Each file must be ${MAX_MB} MB or smaller.` : err.code === 'LIMIT_FILE_COUNT' ? `You can share up to ${MAX_FILES} files at once.` : err.message);
    const { type, expiresIn = '24h' } = req.body;
    if (!TYPES.includes(type)) return fail(400, 'Unknown share type.');
    if (!EXPIRY[expiresIn]) return fail(400, 'Invalid expiry.');
    let payload = null;
    if (type === 'file') { if (!files.length) return fail(400, 'Add at least one file.'); }
    else {
      try { payload = JSON.parse(req.body.payload || '{}'); } catch { return fail(400, 'Invalid data.'); }
      const clean = {}; for (const [k, v] of Object.entries(payload)) clean[String(k).slice(0, 40)] = String(v ?? '').slice(0, 20000);
      payload = clean;
      const need = { text: ['text'], link: ['url'], contact: ['name'], wifi: ['ssid'], custom: ['value'] }[type];
      if (need.some((k) => !payload[k]?.trim())) return fail(400, 'Please fill in the required fields.');
      if (type === 'link' && !/^https?:\/\//i.test(payload.url)) return fail(400, 'Links must start with http:// or https://');
    }
    let code; do { code = String(crypto.randomInt(1000000, 10000000)); } while (Object.values(shares).some((x) => x.code === code));
    const id = uuid(), deleteToken = crypto.randomBytes(24).toString('hex'), now = Date.now();
    shares[id] = { id, code, type, payload, deleteToken, createdAt: now, expiresAt: now + EXPIRY[expiresIn], downloads: 0,
      files: files.map((f) => ({ id: uuid(), name: f.originalname, size: f.size, mime: f.mimetype || 'application/octet-stream', stored: f.filename })) };
    save();
    res.status(201).json({ id, code, deleteToken, expiresAt: shares[id].expiresAt });
  });
});

const getShare = (req, res, next) => {
  const s = isUuid(req.params.id) && shares[req.params.id];
  if (!s) return res.status(404).json({ error: 'This share does not exist.' });
  if (s.expiresAt <= Date.now()) { removeShare(s.id); return res.status(410).json({ error: 'This share has expired.' }); }
  req.share = s; next();
};

app.get('/api/shares/:id', getShare, (req, res) => res.json(pub(req.share)));

app.get('/api/shares/:id/files/:fid', getShare, (req, res) => {
  const f = isUuid(req.params.fid) && req.share.files.find((x) => x.id === req.params.fid);
  if (!f) return res.status(404).json({ error: 'File not found.' });
  const inline = req.query.inline === '1' && INLINE_OK.test(f.mime);
  if (!inline) { req.share.downloads++; save(); }
  res.sendFile(path.join(UPLOADS, f.stored), { headers: {
    'Content-Type': inline ? f.mime : 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}` } });
});

app.get('/api/shares/:id/zip', getShare, (req, res) => {
  const s = req.share; if (!s.files.length) return res.status(404).json({ error: 'No files.' });
  s.downloads++; save();
  res.attachment(`quick-share-${s.id.slice(0, 8)}.zip`);
  const zip = archiver('zip', { zlib: { level: 3 } });
  zip.on('error', () => res.destroy()); zip.pipe(res);
  const seen = {};
  for (const f of s.files) { const n = seen[f.name] = (seen[f.name] || 0) + 1; const name = n > 1 ? f.name.replace(/(\.[^.]*)?$/, ` (${n})$1`) : f.name; zip.file(path.join(UPLOADS, f.stored), { name }); }
  zip.finalize();
});

app.delete('/api/shares/:id', getShare, (req, res) => {
  const t = Buffer.from(req.get('x-delete-token') || ''), k = Buffer.from(req.share.deleteToken);
  if (t.length !== k.length || !crypto.timingSafeEqual(t, k)) return res.status(403).json({ error: 'Not allowed.' });
  removeShare(req.share.id); res.json({ ok: true });
});

const DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(DIST)) { app.use(express.static(DIST)); app.get('*', (_q, res) => res.sendFile(path.join(DIST, 'index.html'))); }
app.use((_e, _q, res, _n) => res.status(500).json({ error: 'Something went wrong. Try again.' }));
app.listen(PORT, () => console.log(`Quick Share on :${PORT}`));
