import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pathForPage, resolveServiceHref, pathForSector, publishNavigation } from '../src/lib/navigation.js';

const prisma = new PrismaClient();

async function ensurePage(
  slug: string,
  titleAr: string,
  titleEn: string,
  opts: { showInHeader?: boolean; showInFooter?: boolean; navSortOrder?: number; isHome?: boolean; status?: 'PUBLISHED' | 'DRAFT' },
) {
  return prisma.page.upsert({
    where: { slug },
    update: {
      titleAr,
      titleEn,
      navLabelAr: titleAr,
      navLabelEn: titleEn,
      showInHeader: opts.showInHeader ?? false,
      showInFooter: opts.showInFooter ?? false,
      navSortOrder: opts.navSortOrder ?? 0,
      isHome: opts.isHome ?? false,
      status: opts.status ?? 'PUBLISHED',
    },
    create: {
      slug,
      titleAr,
      titleEn,
      navLabelAr: titleAr,
      navLabelEn: titleEn,
      showInHeader: opts.showInHeader ?? false,
      showInFooter: opts.showInFooter ?? false,
      navSortOrder: opts.navSortOrder ?? 0,
      isHome: opts.isHome ?? false,
      status: opts.status ?? 'PUBLISHED',
      template: slug.startsWith('sector-') ? 'sector' : slug === 'sectors' ? 'sectors' : 'standard',
    },
  });
}

async function main() {
  const home = await ensurePage('home', 'الرئيسية', 'Home', {
    showInHeader: true,
    showInFooter: false,
    navSortOrder: 0,
    isHome: true,
  });
  const about = await ensurePage('about', 'من نحن', 'About', {
    showInHeader: true,
    showInFooter: true,
    navSortOrder: 1,
  });
  const sectorsPage = await ensurePage('sectors', 'قطاعاتنا', 'Our Sectors', {
    showInHeader: true,
    showInFooter: true,
    navSortOrder: 2,
  });
  const services = await ensurePage('services', 'الخدمات', 'Services', {
    showInHeader: true,
    showInFooter: true,
    navSortOrder: 3,
  });
  const projects = await ensurePage('projects', 'المشاريع', 'Projects', {
    showInHeader: true,
    showInFooter: true,
    navSortOrder: 4,
  });
  const quality = await ensurePage('quality', 'الجودة والسلامة', 'Quality & Safety', {
    showInHeader: true,
    showInFooter: false,
    navSortOrder: 5,
  });
  const contact = await ensurePage('contact', 'اتصل بنا', 'Contact', {
    showInHeader: true,
    showInFooter: true,
    navSortOrder: 6,
  });

  // Keep existing sector-* pages published flags
  await prisma.page.updateMany({
    where: { slug: { startsWith: 'sector-' } },
    data: { showInHeader: false, showInFooter: false },
  });

  const existingDraft = await prisma.navItem.count({ where: { layer: 'draft' } });
  if (existingDraft > 0) {
    console.log('Draft nav already exists — skipping recreate, publishing sync only if published empty');
    const pub = await prisma.navItem.count({ where: { layer: 'published' } });
    if (pub === 0) await publishNavigation();
    console.log('Navigation migration skipped recreate');
    return;
  }

  await prisma.navItem.deleteMany({});

  const tops: Array<{ page: { id: string; slug: string }; labelAr: string; labelEn: string; header: boolean; footer: boolean; order: number }> = [
    { page: home, labelAr: 'الرئيسية', labelEn: 'Home', header: true, footer: false, order: 0 },
    { page: about, labelAr: 'من نحن', labelEn: 'About', header: true, footer: true, order: 1 },
    { page: sectorsPage, labelAr: 'قطاعاتنا', labelEn: 'Our Sectors', header: true, footer: true, order: 2 },
    { page: services, labelAr: 'الخدمات', labelEn: 'Services', header: true, footer: true, order: 3 },
    { page: projects, labelAr: 'المشاريع', labelEn: 'Projects', header: true, footer: true, order: 4 },
    { page: quality, labelAr: 'الجودة والسلامة', labelEn: 'Quality & Safety', header: true, footer: false, order: 5 },
    { page: contact, labelAr: 'اتصل بنا', labelEn: 'Contact', header: true, footer: true, order: 6 },
  ];

  const createdTops: Record<string, string> = {};
  for (const t of tops) {
    const item = await prisma.navItem.create({
      data: {
        layer: 'draft',
        targetType: 'page',
        pageId: t.page.id,
        href: pathForPage(t.page.slug),
        labelAr: t.labelAr,
        labelEn: t.labelEn,
        showInHeader: t.header,
        showInFooter: t.footer,
        sortOrder: t.order,
      },
    });
    createdTops[t.page.slug] = item.id;
  }

  // Service mega under Services (published services)
  const svcList = await prisma.service.findMany({ where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } });
  let i = 0;
  for (const s of svcList) {
    await prisma.navItem.create({
      data: {
        layer: 'draft',
        targetType: 'service',
        serviceId: s.id,
        href: resolveServiceHref(s.slug),
        labelAr: s.nameAr,
        labelEn: s.nameEn,
        showInHeader: true,
        showInFooter: false,
        sortOrder: i++,
        parentId: createdTops.services,
      },
    });
  }

  // Published sectors as optional children under sectors page (not required in old mega)
  const sectors = await prisma.sector.findMany({ where: { status: 'PUBLISHED' }, orderBy: { sortOrder: 'asc' } });
  i = 0;
  for (const s of sectors) {
    await prisma.navItem.create({
      data: {
        layer: 'draft',
        targetType: 'sector',
        sectorId: s.id,
        href: pathForSector(s.slug),
        labelAr: s.nameAr,
        labelEn: s.nameEn,
        showInHeader: true,
        showInFooter: false,
        sortOrder: i++,
        parentId: createdTops.sectors,
      },
    });
  }

  await publishNavigation();
  console.log('Navigation migrated and published');
  console.log(`Top items: ${tops.length}, services: ${svcList.length}, sectors: ${sectors.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
