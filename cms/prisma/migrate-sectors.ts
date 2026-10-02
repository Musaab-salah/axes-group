import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { cmsPageSlugForSector } from '../src/lib/sectors.js';

const prisma = new PrismaClient();

async function upsertSectorPage(slug: string, nameAr: string, nameEn: string) {
  const pageSlug = cmsPageSlugForSector(slug);
  return prisma.page.upsert({
    where: { slug: pageSlug },
    update: { titleAr: nameAr, titleEn: nameEn, template: 'sector' },
    create: { slug: pageSlug, titleAr: nameAr, titleEn: nameEn, template: 'sector', status: 'DRAFT' },
  });
}

async function main() {
  // Engineering — published, from existing site content only
  const engPage = await upsertSectorPage('engineering', 'اكسس الهندسية', 'AXES Engineering');
  const engineering = await prisma.sector.upsert({
    where: { slug: 'engineering' },
    update: {
      nameAr: 'اكسس الهندسية',
      nameEn: 'AXES Engineering',
      summaryAr:
        'الذراع الهندسي للمجموعة في المقاولات والأعمال المدنية والبنية التحتية وإدارة المشاريع.',
      summaryEn:
        'The group’s engineering arm for contracting, civil works, infrastructure and project management.',
      bodyAr:
        'تعمل اكسس الهندسية في الإنشاءات والأعمال المدنية وإدارة المشاريع.\nنجمع بين التخطيط الدقيق والمتابعة في الموقع لتنفيذ الأعمال بعناية في كل مرحلة.\nنبرز من خلال تقديم الحلول الهندسية المتكاملة، والتصاميم المبتكرة، وإدارة المشاريع وفق أعلى معايير الجودة والاستدامة.',
      bodyEn:
        'AXES Engineering delivers construction, civil works and project management.\nWe pair careful planning with on-site oversight at every stage of delivery.\nWe provide integrated engineering solutions, thoughtful design, and project management to high standards of quality and sustainability.',
      coverPath: '/assets/service-construction.jpg',
      iconPath: '/assets/axes-group-mark.png',
      galleryJson: JSON.stringify([
        '/assets/field/oversight.jpg',
        '/assets/service-concrete.webp',
        '/assets/mobile-office.jpg',
      ]),
      contactEmail: 'info@axessud.com',
      contactPhone: '+249 91 234 8243',
      contactWhatsapp: '249912348243',
      ctaLabelAr: 'طلب خدمة هندسية',
      ctaLabelEn: 'Request Engineering Service',
      ctaUrl: '/contact',
      seoTitleAr: 'اكسس الهندسية',
      seoTitleEn: 'AXES Engineering',
      seoDescAr: 'المقاولات والهندسة المدنية والبنية التحتية وإدارة المشاريع.',
      seoDescEn: 'Contracting, civil engineering, infrastructure and project management.',
      sortOrder: 1,
      showInHome: true,
      showInNav: true,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      pageId: engPage.id,
      draftJson: null,
    },
    create: {
      slug: 'engineering',
      nameAr: 'اكسس الهندسية',
      nameEn: 'AXES Engineering',
      summaryAr:
        'الذراع الهندسي للمجموعة في المقاولات والأعمال المدنية والبنية التحتية وإدارة المشاريع.',
      summaryEn:
        'The group’s engineering arm for contracting, civil works, infrastructure and project management.',
      bodyAr:
        'تعمل اكسس الهندسية في الإنشاءات والأعمال المدنية وإدارة المشاريع.\nنجمع بين التخطيط الدقيق والمتابعة في الموقع لتنفيذ الأعمال بعناية في كل مرحلة.\nنبرز من خلال تقديم الحلول الهندسية المتكاملة، والتصاميم المبتكرة، وإدارة المشاريع وفق أعلى معايير الجودة والاستدامة.',
      bodyEn:
        'AXES Engineering delivers construction, civil works and project management.\nWe pair careful planning with on-site oversight at every stage of delivery.\nWe provide integrated engineering solutions, thoughtful design, and project management to high standards of quality and sustainability.',
      coverPath: '/assets/service-construction.jpg',
      iconPath: '/assets/axes-group-mark.png',
      galleryJson: JSON.stringify([
        '/assets/field/oversight.jpg',
        '/assets/service-concrete.webp',
        '/assets/mobile-office.jpg',
      ]),
      contactEmail: 'info@axessud.com',
      contactPhone: '+249 91 234 8243',
      contactWhatsapp: '249912348243',
      ctaLabelAr: 'طلب خدمة هندسية',
      ctaLabelEn: 'Request Engineering Service',
      ctaUrl: '/contact',
      seoTitleAr: 'اكسس الهندسية',
      seoTitleEn: 'AXES Engineering',
      seoDescAr: 'المقاولات والهندسة المدنية والبنية التحتية وإدارة المشاريع.',
      seoDescEn: 'Contracting, civil engineering, infrastructure and project management.',
      sortOrder: 1,
      showInHome: true,
      showInNav: true,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      pageId: engPage.id,
    },
  });

  await prisma.page.update({ where: { id: engPage.id }, data: { status: 'PUBLISHED' } });

  // Link existing services to engineering (no invented services)
  await prisma.service.updateMany({
    data: { sectorId: engineering.id },
  });

  // Import / Export — draft only, no invented claims
  const tradePage = await upsertSectorPage('import-export', 'الاستيراد والتصدير', 'Import & Export');
  await prisma.sector.upsert({
    where: { slug: 'import-export' },
    update: {
      nameAr: 'الاستيراد والتصدير',
      nameEn: 'Import & Export',
      summaryAr: '',
      summaryEn: '',
      bodyAr: '',
      bodyEn: '',
      coverPath: null,
      iconPath: '/assets/axes-group-mark.png',
      galleryJson: '[]',
      contactEmail: 'info@axessud.com',
      ctaUrl: '/contact',
      seoTitleAr: 'الاستيراد والتصدير',
      seoTitleEn: 'Import & Export',
      sortOrder: 2,
      showInHome: false,
      showInNav: false,
      status: 'DRAFT',
      pageId: tradePage.id,
      draftJson: null,
    },
    create: {
      slug: 'import-export',
      nameAr: 'الاستيراد والتصدير',
      nameEn: 'Import & Export',
      summaryAr: '',
      summaryEn: '',
      bodyAr: '',
      bodyEn: '',
      iconPath: '/assets/axes-group-mark.png',
      galleryJson: '[]',
      contactEmail: 'info@axessud.com',
      ctaUrl: '/contact',
      seoTitleAr: 'الاستيراد والتصدير',
      seoTitleEn: 'Import & Export',
      sortOrder: 2,
      showInHome: false,
      showInNav: false,
      status: 'DRAFT',
      pageId: tradePage.id,
    },
  });
  await prisma.page.update({ where: { id: tradePage.id }, data: { status: 'DRAFT' } });

  // Soften home hero blocks toward multi-activity group (keep existing construction meaning)
  const home = await prisma.page.findUnique({ where: { slug: 'home' } });
  if (home) {
    await prisma.contentBlock.upsert({
      where: { pageId_key: { pageId: home.id, key: 'hero.subtitle' } },
      update: {
        valueAr: 'اكسس قروب — مجموعة لأنشطة متعددة تشمل الإنشاءات والهندسة وقطاعات أعمال أخرى.',
        valueEn: 'AXES GROUP — a diversified group spanning construction, engineering and other business sectors.',
        draftAr: null,
        draftEn: null,
      },
      create: {
        pageId: home.id,
        key: 'hero.subtitle',
        type: 'text',
        valueAr: 'اكسس قروب — مجموعة لأنشطة متعددة تشمل الإنشاءات والهندسة وقطاعات أعمال أخرى.',
        valueEn: 'AXES GROUP — a diversified group spanning construction, engineering and other business sectors.',
        sortOrder: 2,
      },
    });
  }

  console.log('Sectors migration complete');
  console.log('- engineering: PUBLISHED');
  console.log('- import-export: DRAFT (empty content for completion)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
