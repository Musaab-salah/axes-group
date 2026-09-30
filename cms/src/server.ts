import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { contentRouter, writePublicContentBundle } from './routes/content.js';
import { mediaRouter } from './routes/media.js';
import { prisma } from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siteRoot = path.resolve(root, '../site');
const adminRoot = path.resolve(root, 'admin');
const uploadsRoot = path.resolve(root, 'uploads');

const app = express();
const port = Number(process.env.PORT || 8765);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'axes-cms' });
});

app.get('/api/public/content/:slug', async (req, res) => {
  const wantDraft = req.query.draft === '1';
  const page = await prisma.page.findUnique({
    where: { slug: req.params.slug },
    include: { blocks: true },
  });
  if (!page) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (wantDraft) {
    const { loadUserFromRequest } = await import('./lib/auth.js');
    const user = await loadUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } else if (page.status !== 'PUBLISHED') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const content: Record<string, { ar: string; en: string; type: string }> = {};
  for (const block of page.blocks) {
    content[block.key] = {
      ar: wantDraft ? (block.draftAr ?? block.valueAr) : block.valueAr,
      en: wantDraft ? (block.draftEn ?? block.valueEn) : block.valueEn,
      type: block.type,
    };
  }
  res.json({ slug: page.slug, content });
});

app.use('/api/auth', authRouter);
app.use('/api/cms', contentRouter);
app.use('/api/media', mediaRouter);
app.use('/uploads', express.static(uploadsRoot));

// Admin UI (never cache dashboard assets)
app.use('/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use('/admin', express.static(adminRoot, { index: 'index.html', etag: false, lastModified: false, maxAge: 0 }));

// Preserve clean URLs for public site (inject editor bridge when cmsEdit=1)
function sendHtml(res: express.Response, name: string, injectEditor = false) {
  const file = path.join(siteRoot, name);
  if (!fs.existsSync(file)) {
    res.status(404).send('Not found');
    return;
  }
  if (!injectEditor) {
    res.sendFile(file);
    return;
  }
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('cms-editor-bridge.js')) {
    html = html.replace(
      '</body>',
      '<script src="/assets/cms-editor-bridge.js"></script></body>',
    );
  }
  // force draft preview values in editor
  if (!html.includes('cmsPreview=1')) {
    html = html.replace(
      '<script src="assets/site.js"',
      '<script>history.replaceState(null,"","?cmsEdit=1&cmsPreview=1")</script><script src="assets/site.js"',
    );
  }
  res.type('html').send(html);
}

const pageFile: Record<string, string> = {
  home: 'index.html',
  about: 'about.html',
  services: 'services.html',
  projects: 'projects.html',
  quality: 'quality.html',
  contact: 'contact.html',
};

app.get('/', (req, res) => sendHtml(res, 'index.html', req.query.cmsEdit === '1'));
app.get('/about', (req, res) => sendHtml(res, 'about.html', req.query.cmsEdit === '1'));
app.get('/services', (req, res) => sendHtml(res, 'services.html', req.query.cmsEdit === '1'));
app.get('/projects', (req, res) => sendHtml(res, 'projects.html', req.query.cmsEdit === '1'));
app.get('/quality', (req, res) => sendHtml(res, 'quality.html', req.query.cmsEdit === '1'));
app.get('/contact', (req, res) => sendHtml(res, 'contact.html', req.query.cmsEdit === '1'));

app.use(express.static(siteRoot));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

async function boot() {
  fs.mkdirSync(uploadsRoot, { recursive: true });
  try {
    await writePublicContentBundle();
  } catch (e) {
    console.warn('Content bundle not written yet (run db seed):', e);
  }
  app.listen(port, () => {
    console.log(`AXES CMS + site running at http://127.0.0.1:${port}`);
    console.log(`Admin dashboard: http://127.0.0.1:${port}/admin`);
  });
}

boot();
