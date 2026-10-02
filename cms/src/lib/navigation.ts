import type { NavItem, Page, Sector, Service } from '@prisma/client';
import { prisma } from './prisma.js';

export type NavTarget = {
  id: string;
  layer: string;
  targetType: string;
  href: string;
  labelAr: string;
  labelEn: string;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
  parentId: string | null;
  pageId?: string | null;
  sectorId?: string | null;
  serviceId?: string | null;
  page?: Page | null;
  sector?: Sector | null;
  service?: Service | null;
  children?: NavTarget[];
};

export function pathForPage(slug: string) {
  if (slug === 'home') return '/';
  if (slug.startsWith('sector-')) return `/sectors/${slug.slice(7)}`;
  if (slug === 'sectors') return '/sectors';
  return `/${slug}`;
}

export function pathForSector(slug: string) {
  return `/sectors/${slug}`;
}

export function pathForService(slug: string) {
  return `/services#service-${slug.replace(/_/g, '-')}`;
}

/** Map known service slugs to existing site anchors */
const SERVICE_ANCHORS: Record<string, string> = {
  'general-contracting': '/services#service-contracting',
  'civil-engineering': '/services#service-civil',
  infrastructure: '/services#service-infrastructure',
  'roads-bridges': '/services#service-roads',
  'project-management': '/services#service-management',
  industrial: '/services#service-industrial',
};

export function resolveServiceHref(slug: string, sectorSlug?: string | null) {
  if (sectorSlug) return pathForSector(sectorSlug);
  return SERVICE_ANCHORS[slug] || `/services#service-${slug}`;
}

export async function resolveNavHref(item: {
  targetType: string;
  href?: string | null;
  pageId?: string | null;
  sectorId?: string | null;
  serviceId?: string | null;
  page?: { slug: string } | null;
  sector?: { slug: string } | null;
  service?: { slug: string; sectorId?: string | null } | null;
}) {
  if (item.targetType === 'custom' && item.href) return item.href;
  if (item.targetType === 'page') {
    const page = item.page || (item.pageId ? await prisma.page.findUnique({ where: { id: item.pageId } }) : null);
    return page ? pathForPage(page.slug) : item.href || '/';
  }
  if (item.targetType === 'sector') {
    const sector =
      item.sector || (item.sectorId ? await prisma.sector.findUnique({ where: { id: item.sectorId } }) : null);
    return sector ? pathForSector(sector.slug) : item.href || '/sectors';
  }
  if (item.targetType === 'service') {
    const service =
      item.service ||
      (item.serviceId
        ? await prisma.service.findUnique({
            where: { id: item.serviceId },
            include: { sector: { select: { slug: true, status: true } } },
          })
        : null);
    if (!service) return item.href || '/services';
    const sectorSlug =
      (service as { sector?: { slug: string; status: string } | null }).sector?.status === 'PUBLISHED'
        ? (service as { sector?: { slug: string } | null }).sector?.slug
        : null;
    return resolveServiceHref(service.slug, sectorSlug);
  }
  return item.href || '/';
}

function isTargetPublic(item: NavTarget) {
  if (item.targetType === 'page') return item.page?.status === 'PUBLISHED';
  if (item.targetType === 'sector') return item.sector?.status === 'PUBLISHED';
  if (item.targetType === 'service') return !item.service || item.service.status === 'PUBLISHED';
  return true;
}

export async function loadNavLayer(layer: 'draft' | 'published') {
  const items = await prisma.navItem.findMany({
    where: { layer },
    orderBy: { sortOrder: 'asc' },
    include: {
      page: true,
      sector: true,
      service: true,
    },
  });
  return items as unknown as NavTarget[];
}

export function buildNavTree(items: NavTarget[], opts?: { header?: boolean; footer?: boolean; publicOnly?: boolean }) {
  const filtered = items.filter((i) => {
    if (opts?.header && !i.showInHeader) return false;
    if (opts?.footer && !i.showInFooter) return false;
    if (opts?.publicOnly && !isTargetPublic(i)) return false;
    return true;
  });
  const byParent = new Map<string | null, NavTarget[]>();
  for (const item of filtered) {
    const key = item.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  }
  const attach = (parentId: string | null): NavTarget[] =>
    (byParent.get(parentId) || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({ ...item, children: attach(item.id) }));
  return attach(null);
}

function esc(s: string) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderHeaderNavHtml(tree: NavTarget[], currentPath = '/') {
  const links = tree
    .map((item) => {
      const current = item.href === currentPath || (item.href !== '/' && currentPath.startsWith(item.href));
      const kids = item.children || [];
      const caret = kids.length ? '<i class="nav-caret" aria-hidden="true"></i>' : '';
      const label = `<span data-ar="${esc(item.labelAr)}" data-en="${esc(item.labelEn)}">${esc(item.labelAr)}</span>${caret}`;
      if (kids.length) {
        const mega = kids
          .map(
            (c) =>
              `<a href="${esc(c.href)}"><span data-ar="${esc(c.labelAr)}" data-en="${esc(c.labelEn)}">${esc(c.labelAr)}</span></a>`,
          )
          .join('');
        return `<a class="has-mega" href="${esc(item.href)}"${current ? ' aria-current="page"' : ''}>${label}</a><div class="mega" aria-label="${esc(item.labelEn || item.labelAr)}">${mega}</div>`;
      }
      return `<a href="${esc(item.href)}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
    })
    .join('');
  return links;
}

export function renderMobileNavHtml(tree: NavTarget[], currentPath = '/') {
  const flat: string[] = [];
  const walk = (items: NavTarget[], depth = 0) => {
    for (const item of items) {
      const current = item.href === currentPath || (item.href !== '/' && currentPath.startsWith(item.href));
      flat.push(
        `<a href="${esc(item.href)}"${current ? ' aria-current="page"' : ''}${depth ? ' class="nav-child"' : ''}><span data-ar="${esc(item.labelAr)}" data-en="${esc(item.labelEn)}">${esc(item.labelAr)}</span></a>`,
      );
      if (item.children?.length) walk(item.children, depth + 1);
    }
  };
  walk(tree);
  return flat.join('');
}

export function renderFooterNavHtml(tree: NavTarget[]) {
  return tree
    .map(
      (item) =>
        `<a href="${esc(item.href)}"><span data-ar="${esc(item.labelAr)}" data-en="${esc(item.labelEn)}">${esc(item.labelAr)}</span></a>`,
    )
    .join('');
}

export async function getPublicNavigation() {
  const items = await loadNavLayer('published');
  // refresh hrefs from live targets
  for (const item of items) {
    item.href = await resolveNavHref(item);
  }
  return {
    header: buildNavTree(items, { header: true, publicOnly: true }),
    footer: buildNavTree(items, { footer: true, publicOnly: true }),
  };
}

export function injectNavigation(html: string, nav: { header: NavTarget[]; footer: NavTarget[] }, currentPath = '/') {
  const headerInner = renderHeaderNavHtml(nav.header, currentPath);
  const mobileInner = renderMobileNavHtml(nav.header, currentPath);
  const footerInner = renderFooterNavHtml(nav.footer);

  let out = html;
  // Replace desktop nav inner (keep element)
  out = out.replace(
    /(<nav class="desktop-nav"[^>]*>)([\s\S]*?)(<\/nav>)/i,
    (_m, open, _inner, close) => `${open}${headerInner || _inner}${close}`,
  );
  out = out.replace(
    /(<nav class="mobile-nav"[^>]*>)([\s\S]*?)(<\/nav>)/i,
    (_m, open, _inner, close) => `${open}${mobileInner || _inner}${close}`,
  );
  // Footer quick links column: first footer column after about often has h3 + links
  // Prefer explicit slot if present
  if (out.includes('data-nav-slot="footer"')) {
    out = out.replace(
      /(<[^>]*data-nav-slot="footer"[^>]*>)([\s\S]*?)(<\/div>)/i,
      (_m, open, _inner, close) => `${open}${footerInner}${close}`,
    );
  } else {
    // Replace links inside footer column that contains "روابط سريعة" / Quick Links
    out = out.replace(
      /(<h3[^>]*>[\s\S]*?(?:روابط سريعة|Quick Links)[\s\S]*?<\/h3>)([\s\S]*?)(<\/div>)/i,
      (_m, h3, _links, close) => `${h3}${footerInner}${close}`,
    );
  }
  return out;
}

export async function publishNavigation() {
  const drafts = await prisma.navItem.findMany({ where: { layer: 'draft' }, orderBy: { sortOrder: 'asc' } });
  await prisma.navItem.deleteMany({ where: { layer: 'published' } });

  const idMap = new Map<string, string>();
  // First pass create without parents
  for (const d of drafts) {
    const href = await resolveNavHref(d);
    const created = await prisma.navItem.create({
      data: {
        layer: 'published',
        targetType: d.targetType,
        pageId: d.pageId,
        sectorId: d.sectorId,
        serviceId: d.serviceId,
        href,
        labelAr: d.labelAr,
        labelEn: d.labelEn,
        showInHeader: d.showInHeader,
        showInFooter: d.showInFooter,
        sortOrder: d.sortOrder,
        parentId: null,
      },
    });
    idMap.set(d.id, created.id);
  }
  // Second pass set parents
  for (const d of drafts) {
    if (!d.parentId) continue;
    const pubId = idMap.get(d.id);
    const pubParent = idMap.get(d.parentId);
    if (pubId && pubParent) {
      await prisma.navItem.update({ where: { id: pubId }, data: { parentId: pubParent } });
    }
  }
}

export async function findInboundLinksToPath(path: string) {
  // Search published page blocks and nav for references
  const needle = path === '/' ? null : path;
  const blocks = await prisma.contentBlock.findMany({
    where: {
      page: { status: 'PUBLISHED' },
      OR: needle
        ? [
            { valueAr: { contains: path } },
            { valueEn: { contains: path } },
            { draftAr: { contains: path } },
            { draftEn: { contains: path } },
          ]
        : undefined,
    },
    include: { page: { select: { slug: true, titleAr: true } } },
    take: 50,
  });
  const nav = await prisma.navItem.findMany({
    where: { layer: 'published', href: path },
    take: 20,
  });
  return {
    contentBlocks: blocks.map((b) => ({ pageSlug: b.page.slug, pageTitle: b.page.titleAr, key: b.key })),
    navItems: nav.map((n) => ({ id: n.id, labelAr: n.labelAr })),
  };
}
