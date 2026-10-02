import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { contentRouter, writePublicContentBundle } from './routes/content.js';
import { mediaRouter, serveUpload } from './routes/media.js';
import { sectorsRouter } from './routes/sectors.js';
import { sectorMediaRouter, loadSectorMedia } from './routes/sector-media.js';
import { navRouter } from './routes/navigation.js';
import { projectsRouter } from './routes/projects.js';
import { servicesCmsRouter } from './routes/services-cms.js';
import { prisma } from './lib/prisma.js';
import { loadUserFromRequest } from './lib/auth.js';
import { resolveSectorFields } from './lib/sectors.js';
import { readTemplate, renderSectorPageHtml, renderSectorsIndexHtml } from './lib/sector-render.js';
import { getPublicNavigation, injectNavigation } from './lib/navigation.js';

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

app.get('/api/public/sectors', async (req, res) => {
  const homeOnly = req.query.home === '1';
  const navOnly = req.query.nav === '1';
  const sectors = await prisma.sector.findMany({
    where: {
      status: 'PUBLISHED',
      ...(homeOnly ? { showInHome: true } : {}),
      ...(navOnly ? { showInNav: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: {
      slug: true,
      nameAr: true,
      nameEn: true,
      summaryAr: true,
      summaryEn: true,
      coverPath: true,
      iconPath: true,
      sortOrder: true,
      showInHome: true,
      showInNav: true,
    },
  });
  res.json({ sectors });
});

app.get('/api/public/sectors/:slug', async (req, res) => {
  const wantDraft = req.query.draft === '1';
  const sector = await prisma.sector.findUnique({
    where: { slug: req.params.slug },
    include: {
      services: { where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } },
      projects: { where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!sector) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (wantDraft) {
    const user = await loadUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } else if (sector.status !== 'PUBLISHED') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const fields = resolveSectorFields(sector, wantDraft);
  res.json({ sector: { ...sector, ...fields } });
});

app.get('/api/public/navigation', async (_req, res) => {
  try {
    const nav = await getPublicNavigation();
    res.json(nav);
  } catch (e) {
    console.error(e);
    res.json({ header: [], footer: [] });
  }
});

app.get('/api/public/projects', async (req, res) => {
  const featuredOnly = req.query.featured === '1';
  const sectorSlug = typeof req.query.sector === 'string' ? req.query.sector : '';
  const projects = await prisma.project.findMany({
    where: {
      status: 'PUBLISHED',
      ...(featuredOnly ? { featured: true } : {}),
      ...(sectorSlug
        ? { sector: { slug: sectorSlug, status: 'PUBLISHED' } }
        : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: {
      sector: { select: { slug: true, nameAr: true, nameEn: true, status: true } },
    },
  });
  res.json({
    projects: projects.map((p) => ({
      slug: p.slug,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      summaryAr: p.summaryAr,
      summaryEn: p.summaryEn,
      categoryAr: p.categoryAr,
      categoryEn: p.categoryEn,
      locationAr: p.locationAr,
      locationEn: p.locationEn,
      imagePath: p.imagePath,
      featured: p.featured,
      sectorSlug: p.sector?.status === 'PUBLISHED' ? p.sector.slug : null,
      sectorNameAr: p.sector?.status === 'PUBLISHED' ? p.sector.nameAr : null,
      sectorNameEn: p.sector?.status === 'PUBLISHED' ? p.sector.nameEn : null,
      href: p.sector?.status === 'PUBLISHED' ? `/sectors/${p.sector.slug}` : '/projects',
    })),
  });
});

app.get('/api/public/services', async (_req, res) => {
  const services = await prisma.service.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: {
      sector: { select: { slug: true, nameAr: true, nameEn: true, status: true, coverPath: true } },
    },
  });
  res.json({
    services: services.map((s, i) => ({
      slug: s.slug,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      summaryAr: s.summaryAr,
      summaryEn: s.summaryEn,
      imagePath: s.imagePath || s.sector?.coverPath || null,
      index: String(i + 1).padStart(2, '0'),
      sectorSlug: s.sector?.status === 'PUBLISHED' ? s.sector.slug : null,
      sectorNameAr: s.sector?.status === 'PUBLISHED' ? s.sector.nameAr : null,
      sectorNameEn: s.sector?.status === 'PUBLISHED' ? s.sector.nameEn : null,
      href:
        s.sector?.status === 'PUBLISHED'
          ? `/sectors/${s.sector.slug}`
          : `/services#service-${s.slug}`,
    })),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/cms/nav', navRouter);
app.use('/api/cms/projects', projectsRouter);
app.use('/api/cms/services', servicesCmsRouter);
app.use('/api/cms/sectors/:sectorId/media', sectorMediaRouter);
app.use('/api/cms/sectors', sectorsRouter);
app.use('/api/cms', contentRouter);
app.use('/api/media', mediaRouter);
app.get('/uploads/:filename', (req, res) => {
  void serveUpload(req, res);
});

// Legacy path redirects
app.use(async (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  try {
    const fromPath = req.path.length > 1 && req.path.endsWith('/') ? req.path.slice(0, -1) : req.path;
    const hit = await prisma.pageRedirect.findUnique({ where: { fromPath } });
    if (hit) {
      res.redirect(301, hit.toPath);
      return;
    }
  } catch {
    /* db may not be ready */
  }
  next();
});

// Admin UI (never cache dashboard assets)
app.use('/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use('/admin', express.static(adminRoot, { index: 'index.html', etag: false, lastModified: false, maxAge: 0 }));

// Preserve clean URLs for public site (inject editor bridge when cmsEdit=1)
async function sendHtml(
  req: express.Request,
  res: express.Response,
  name: string,
  slug: string,
  injectEditor = false,
) {
  const file = path.join(siteRoot, name);
  if (!fs.existsSync(file)) {
    res.status(404).send('Not found');
    return;
  }

  const page = await prisma.page.findUnique({ where: { slug } });
  const wantPreview = injectEditor || req.query.cmsPreview === '1';
  if (page && page.status !== 'PUBLISHED') {
    const user = await loadUserFromRequest(req);
    if (!user || !wantPreview) {
      res.status(404).send('Not found');
      return;
    }
  }

  let html = fs.readFileSync(file, 'utf8');
  try {
    const nav = await getPublicNavigation();
    html = injectNavigation(html, nav, req.path);
  } catch (e) {
    console.warn('nav inject failed', e);
  }

  if (injectEditor) {
    if (!html.includes('cms-editor-bridge.js')) {
      html = html.replace('</body>', '<script src="/assets/cms-editor-bridge.js"></script></body>');
    }
    if (!html.includes('cmsPreview=1')) {
      html = html.replace(
        '<script src="assets/site.js"',
        '<script>history.replaceState(null,"","?cmsEdit=1&cmsPreview=1")</script><script src="assets/site.js"',
      );
      html = html.replace(
        '<script src="/assets/site.js"',
        '<script>history.replaceState(null,"","?cmsEdit=1&cmsPreview=1")</script><script src="/assets/site.js"',
      );
    }
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

app.get('/', (req, res) => {
  void sendHtml(req, res, 'index.html', 'home', req.query.cmsEdit === '1');
});
app.get('/about', (req, res) => {
  void sendHtml(req, res, 'about.html', 'about', req.query.cmsEdit === '1');
});
app.get('/services', (req, res) => {
  void sendHtml(req, res, 'services.html', 'services', req.query.cmsEdit === '1');
});
app.get('/projects', (req, res) => {
  void sendHtml(req, res, 'projects.html', 'projects', req.query.cmsEdit === '1');
});
app.get('/quality', (req, res) => {
  void sendHtml(req, res, 'quality.html', 'quality', req.query.cmsEdit === '1');
});
app.get('/contact', (req, res) => {
  void sendHtml(req, res, 'contact.html', 'contact', req.query.cmsEdit === '1');
});

app.get('/sectors', async (req, res) => {
  try {
    const page = await prisma.page.findUnique({ where: { slug: 'sectors' } });
    const wantPreview = req.query.cmsEdit === '1' || req.query.cmsPreview === '1';
    if (page && page.status !== 'PUBLISHED') {
      const user = await loadUserFromRequest(req);
      if (!user || !wantPreview) {
        res.status(404).send('Not found');
        return;
      }
    }
    const sectors = await prisma.sector.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    let html = renderSectorsIndexHtml({
      templateHtml: readTemplate(siteRoot, 'sectors.html'),
      sectors,
    });
    try {
      html = injectNavigation(html, await getPublicNavigation(), '/sectors');
    } catch {
      /* */
    }
    if (req.query.cmsEdit === '1' && !html.includes('cms-editor-bridge.js')) {
      html = html.replace('</body>', '<script src="/assets/cms-editor-bridge.js"></script></body>');
    }
    res.type('html').send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send('Sectors page error');
  }
});

app.get('/sectors/:slug', async (req, res) => {
  try {
    const wantDraft = req.query.cmsPreview === '1' || req.query.cmsEdit === '1';
    const sector = await prisma.sector.findUnique({
      where: { slug: req.params.slug },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        projects: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!sector) {
      res.status(404).send('Sector not found');
      return;
    }
    if (wantDraft) {
      const user = await loadUserFromRequest(req);
      if (!user && sector.status !== 'PUBLISHED') {
        res.status(401).send('Login required for draft preview');
        return;
      }
    } else if (sector.status !== 'PUBLISHED') {
      res.status(404).send('Sector not found');
      return;
    }
    const preferDraft = wantDraft && !!(await loadUserFromRequest(req));
    let mediaItems = await loadSectorMedia(sector.id, preferDraft ? 'draft' : 'published');
    if (preferDraft && !mediaItems.length) {
      mediaItems = await loadSectorMedia(sector.id, 'published');
    }
    let html = renderSectorPageHtml({
      templateHtml: readTemplate(siteRoot, 'sector-template.html'),
      sector: { ...sector, mediaItems },
      preferDraft,
      injectEditor: req.query.cmsEdit === '1',
    });
    try {
      html = injectNavigation(html, await getPublicNavigation(), `/sectors/${sector.slug}`);
    } catch {
      /* */
    }
    res.type('html').send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send('Sector page error');
  }
});

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
