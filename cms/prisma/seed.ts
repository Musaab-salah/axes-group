import 'dotenv/config';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const homeBlocks = [
  { key: 'hero.title', type: 'text', sortOrder: 1, valueAr: 'نبني الغد، اليوم', valueEn: 'Building Tomorrow, Today' },
  {
    key: 'hero.subtitle',
    type: 'text',
    sortOrder: 2,
    valueAr: 'اكسس قروب — مقاولات وهندسة مدنية وبنية تحتية بمتابعة ميدانية دقيقة.',
    valueEn: 'AXES GROUP — contracting, civil engineering and infrastructure with precise site oversight.',
  },
  { key: 'hero.cta.primary', type: 'text', sortOrder: 3, valueAr: 'استكشف مشاريعنا', valueEn: 'Explore Projects' },
  { key: 'hero.cta.secondary', type: 'text', sortOrder: 4, valueAr: 'تواصل معنا', valueEn: 'Contact Us' },
  {
    key: 'intro.title',
    type: 'text',
    sortOrder: 10,
    valueAr: 'خبرة هندسية تصنع أثرًا يدوم',
    valueEn: 'Engineering that creates lasting impact',
  },
  {
    key: 'intro.body',
    type: 'text',
    sortOrder: 11,
    valueAr:
      'تعمل اكسس قروب في الإنشاءات والأعمال المدنية وإدارة المشاريع. نجمع بين التخطيط الدقيق والمتابعة في الموقع لتنفيذ الأعمال بعناية في كل مرحلة.',
    valueEn:
      'AXES GROUP brings together construction, civil works and project management. We pair careful planning with on-site oversight at every stage of delivery.',
  },
];

const aboutBlocks = [
  {
    key: 'chairman.message.p1',
    type: 'text',
    sortOrder: 1,
    valueAr:
      'أرحب بكم في اكسس قروب للأنشطة المتعددة؛ المجموعة التي تأسست لتكون شريكًا استراتيجيًا ورائدًا في تنمية مختلف القطاعات الحيوية.',
    valueEn:
      'Welcome to AXES GROUP for diversified activities; a group founded to be a strategic partner and a leader in developing vital sectors.',
  },
  {
    key: 'chairman.message.p2',
    type: 'text',
    sortOrder: 2,
    valueAr:
      'تتنوع مجالات عملنا لتلبية تطلعات السوق الحديث، حيث نبرز بتميّز من خلال «اكسس الهندسية» الذراع الرائد للمجموعة في تقديم الحلول الهندسية المتكاملة، والتصاميم المبتكرة، وإدارة المشاريع وفق أعلى معايير الجودة والاستدامة، إلى جانب استثماراتنا الممتدة في قطاعات تجارية وخدمية متعددة.',
    valueEn:
      "Our fields of work meet the aspirations of today's market. We stand out through AXES Engineering, the group's leading arm for integrated engineering solutions, innovative design, and project management to the highest standards of quality and sustainability, alongside our broader investments across commercial and service sectors.",
  },
  {
    key: 'chairman.message.p3',
    type: 'text',
    sortOrder: 3,
    valueAr:
      'نلتزم في «اكسس قروب» بالابتكار المستمر، والتميّز التشغيلي، وبناء شراكات مستدامة تسهم في تحقيق القيمة المضافة لعملائنا ومجتمعنا.',
    valueEn:
      'At AXES GROUP, we are committed to continuous innovation, operational excellence, and building lasting partnerships that create added value for our clients and our community.',
  },
];

async function upsertPage(slug: string, titleAr: string, titleEn: string, blocks: typeof homeBlocks) {
  const page = await prisma.page.upsert({
    where: { slug },
    update: { titleAr, titleEn, status: 'PUBLISHED' },
    create: { slug, titleAr, titleEn, status: 'PUBLISHED' },
  });
  for (const block of blocks) {
    await prisma.contentBlock.upsert({
      where: { pageId_key: { pageId: page.id, key: block.key } },
      update: {
        valueAr: block.valueAr,
        valueEn: block.valueEn,
        type: block.type,
        sortOrder: block.sortOrder,
      },
      create: {
        pageId: page.id,
        key: block.key,
        type: block.type,
        sortOrder: block.sortOrder,
        valueAr: block.valueAr,
        valueEn: block.valueEn,
      },
    });
  }
}

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@axessud.com').toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMeNow!2026';
  const name = process.env.INITIAL_ADMIN_NAME || 'AXES Admin';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'SUPER_ADMIN', active: true },
    create: { email, name, passwordHash, role: 'SUPER_ADMIN', active: true },
  });

  await upsertPage('home', 'الرئيسية', 'Home', homeBlocks);
  await upsertPage('about', 'من نحن', 'About', aboutBlocks);
  await upsertPage('services', 'الخدمات', 'Services', []);
  await upsertPage('projects', 'المشاريع', 'Projects', []);
  await upsertPage('quality', 'الجودة والسلامة', 'Quality & Safety', []);
  await upsertPage('contact', 'اتصل بنا', 'Contact', []);

  // Migrate existing images/videos into CMS blocks
  const mediaBlocksPath = path.resolve(__dirname, '../media-blocks.json');
  if (fs.existsSync(mediaBlocksPath)) {
    const mediaBlocks = JSON.parse(fs.readFileSync(mediaBlocksPath, 'utf8')) as Array<{
      page: string;
      key: string;
      type: string;
      value: string;
    }>;
    let order = 100;
    for (const item of mediaBlocks) {
      const page = await prisma.page.findUnique({ where: { slug: item.page } });
      if (!page) continue;
      await prisma.contentBlock.upsert({
        where: { pageId_key: { pageId: page.id, key: item.key } },
        update: {
          type: item.type,
          valueAr: item.value,
          valueEn: item.value,
          sortOrder: order++,
        },
        create: {
          pageId: page.id,
          key: item.key,
          type: item.type,
          valueAr: item.value,
          valueEn: item.value,
          sortOrder: order++,
        },
      });

      // Register in media library if under assets/
      if (item.value.startsWith('assets/')) {
        const filename = path.basename(item.value);
        const existing = await prisma.media.findFirst({ where: { path: `/${item.value}` } });
        if (!existing) {
          await prisma.media.create({
            data: {
              filename,
              originalName: filename,
              mimeType: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
              size: 0,
              path: `/${item.value}`,
              kind: item.type === 'video' ? 'video' : 'image',
            },
          });
        }
      }
    }
    console.log(`Media blocks seeded: ${mediaBlocks.length}`);
  }

  const services = [
    { slug: 'general-contracting', nameAr: 'المقاولات العامة', nameEn: 'General Contracting', sortOrder: 1 },
    { slug: 'civil-engineering', nameAr: 'الهندسة المدنية', nameEn: 'Civil Engineering', sortOrder: 2 },
    { slug: 'infrastructure', nameAr: 'البنية التحتية', nameEn: 'Infrastructure', sortOrder: 3 },
    { slug: 'roads-bridges', nameAr: 'الطرق والجسور', nameEn: 'Roads & Bridges', sortOrder: 4 },
    { slug: 'project-management', nameAr: 'إدارة المشاريع', nameEn: 'Project Management', sortOrder: 5 },
    { slug: 'industrial', nameAr: 'المنشآت الصناعية', nameEn: 'Industrial Construction', sortOrder: 6 },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: { nameAr: s.nameAr, nameEn: s.nameEn, sortOrder: s.sortOrder, status: 'PUBLISHED' },
      create: { ...s, status: 'PUBLISHED' },
    });
  }

  console.log('Seed complete');
  console.log(`Admin login: ${email}`);
  console.log(`Admin password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
