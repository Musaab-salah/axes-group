import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WORKS = [
  {
    slug: 'private-house-port-sudan',
    nameAr: 'منزل خاص',
    nameEn: 'Private House',
    summaryAr: 'تنفيذ ميداني مع لوحة مشروع واضحة ومتابعة يومية في الموقع.',
    summaryEn: 'On-site delivery with clear project board and daily follow-up.',
    categoryAr: 'إنشاءات',
    categoryEn: 'Construction',
    locationAr: 'بورتسودان',
    locationEn: 'Port Sudan',
    imagePath: '/assets/sectors/engineering/eng-private-house.jpg',
    sectorSlug: 'engineering',
    featured: true,
    sortOrder: 1,
  },
  {
    slug: 'building-execution',
    nameAr: 'تنفيذ مبنى',
    nameEn: 'Building Delivery',
    summaryAr: 'من الهيكل الإنشائي إلى الواجهة المنجزة.',
    summaryEn: 'From structural frame to completed facade.',
    categoryAr: 'إنشاءات',
    categoryEn: 'Construction',
    locationAr: '',
    locationEn: '',
    imagePath: '/assets/exterior.mp4',
    sectorSlug: 'engineering',
    featured: true,
    sortOrder: 2,
  },
  {
    slug: 'mobile-site-office',
    nameAr: 'المكتب المتحرك',
    nameEn: 'Mobile Site Office',
    summaryAr: 'قاعدة ميدانية للمتابعة الهندسية وضبط السلامة في الموقع.',
    summaryEn: 'Field base for engineering follow-up and site safety control.',
    categoryAr: 'الموقع',
    categoryEn: 'Site Operations',
    locationAr: '',
    locationEn: '',
    imagePath: '/assets/sectors/engineering/eng-crew-slab.jpg',
    sectorSlug: 'engineering',
    featured: true,
    sortOrder: 3,
  },
  {
    slug: 'brickwork-crew',
    nameAr: 'أعمال البناء',
    nameEn: 'Masonry Works',
    summaryAr: 'فرق عمل منسّقة بسترات عاكسة وخوذات أثناء التنفيذ.',
    summaryEn: 'Coordinated crews with reflective vests and helmets during execution.',
    categoryAr: 'إنشاءات',
    categoryEn: 'Construction',
    locationAr: '',
    locationEn: '',
    imagePath: '/assets/sectors/engineering/eng-brick-branded.jpg',
    sectorSlug: 'engineering',
    featured: false,
    sortOrder: 4,
  },
  {
    slug: 'site-team-coordination',
    nameAr: 'تنسيق فرق الموقع',
    nameEn: 'Site Team Coordination',
    summaryAr: 'مهام مشتركة بين الفرق مع التزام واضح بمعدات السلامة.',
    summaryEn: 'Shared tasks across teams with clear PPE discipline.',
    categoryAr: 'الموقع',
    categoryEn: 'Site Operations',
    locationAr: '',
    locationEn: '',
    imagePath: '/assets/sectors/engineering/eng-cover-engineer.jpg',
    sectorSlug: 'engineering',
    featured: false,
    sortOrder: 5,
  },
  {
    slug: 'bashayer-station-maintenance',
    nameAr: 'صيانة محطة بشائر',
    nameEn: 'Bashayer Station Maintenance',
    summaryAr: 'مشاهد من أعمال الصيانة الواردة في بروفايل الشركة.',
    summaryEn: 'Maintenance scenes from the company profile.',
    categoryAr: 'صيانة',
    categoryEn: 'Maintenance',
    locationAr: '',
    locationEn: '',
    imagePath: '/assets/sectors/import-export/imp-cover-unload.jpg',
    sectorSlug: 'import-export',
    featured: true,
    sortOrder: 6,
  },
];

const SERVICE_IMAGES: Record<string, string> = {
  'general-contracting': '/assets/sectors/engineering/eng-pump-truck.jpg',
  'civil-engineering': '/assets/sectors/engineering/eng-column-pour.jpg',
  infrastructure: '/assets/sectors/engineering/eng-scaffold.jpg',
  'roads-bridges': '/assets/service-roads.webp',
  'project-management': '/assets/sectors/engineering/eng-cover-engineer.jpg',
  industrial: '/assets/service-industrial.webp',
};

const SERVICE_SUMMARIES: Record<string, { ar: string; en: string }> = {
  'general-contracting': {
    ar: 'تنفيذ متكامل للمباني والمنشآت مع ضبط الجودة والجدول الزمني.',
    en: 'Integrated building delivery with quality and schedule control.',
  },
  'civil-engineering': {
    ar: 'حلول هندسية مدنية من التصميم إلى التنفيذ الميداني.',
    en: 'Civil engineering solutions from design to field execution.',
  },
  infrastructure: {
    ar: 'تطوير شبكات وبنى تحتية تدعم استمرارية المشاريع.',
    en: 'Infrastructure networks that keep projects moving.',
  },
  'roads-bridges': {
    ar: 'أعمال طرق وجسور وفق معايير السلامة والمتانة.',
    en: 'Roads and bridges to safety and durability standards.',
  },
  'project-management': {
    ar: 'إدارة مشاريع واضحة من التخطيط حتى التسليم.',
    en: 'Clear project management from planning to handover.',
  },
  industrial: {
    ar: 'منشآت صناعية وتنفيذ متخصص للبيئات التشغيلية.',
    en: 'Industrial facilities and specialized operational delivery.',
  },
};

async function main() {
  const sectors = await prisma.sector.findMany();
  const bySlug = Object.fromEntries(sectors.map((s) => [s.slug, s]));
  const engineering = bySlug.engineering;
  if (!engineering) throw new Error('engineering sector missing — run migrate-sectors first');

  for (const w of WORKS) {
    const sector = bySlug[w.sectorSlug];
    if (!sector) {
      console.warn('skip work, missing sector', w.sectorSlug);
      continue;
    }
    await prisma.project.upsert({
      where: { slug: w.slug },
      update: {
        nameAr: w.nameAr,
        nameEn: w.nameEn,
        summaryAr: w.summaryAr,
        summaryEn: w.summaryEn,
        categoryAr: w.categoryAr,
        categoryEn: w.categoryEn,
        locationAr: w.locationAr,
        locationEn: w.locationEn,
        imagePath: w.imagePath,
        featured: w.featured,
        sortOrder: w.sortOrder,
        status: 'PUBLISHED',
        sectorId: sector.id,
      },
      create: {
        slug: w.slug,
        nameAr: w.nameAr,
        nameEn: w.nameEn,
        summaryAr: w.summaryAr,
        summaryEn: w.summaryEn,
        categoryAr: w.categoryAr,
        categoryEn: w.categoryEn,
        locationAr: w.locationAr,
        locationEn: w.locationEn,
        imagePath: w.imagePath,
        featured: w.featured,
        sortOrder: w.sortOrder,
        status: 'PUBLISHED',
        sectorId: sector.id,
      },
    });
    console.log('project', w.slug, '->', sector.slug);
  }

  const services = await prisma.service.findMany();
  for (const s of services) {
    await prisma.service.update({
      where: { id: s.id },
      data: {
        sectorId: s.sectorId || engineering.id,
        imagePath: s.imagePath || SERVICE_IMAGES[s.slug] || null,
        summaryAr: s.summaryAr || SERVICE_SUMMARIES[s.slug]?.ar || '',
        summaryEn: s.summaryEn || SERVICE_SUMMARIES[s.slug]?.en || '',
        status: 'PUBLISHED',
      },
    });
    console.log('service', s.slug, '-> engineering');
  }

  console.log('migrate-works done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
