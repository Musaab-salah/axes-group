import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(__dirname, '../text-blocks.json');
const items = JSON.parse(fs.readFileSync(file, 'utf8'));

async function main() {
  let n = 0;
  for (const item of items) {
    const page = await prisma.page.findUnique({ where: { slug: item.page } });
    if (!page) continue;
    await prisma.contentBlock.upsert({
      where: { pageId_key: { pageId: page.id, key: item.key } },
      update: {
        type: 'text',
        valueAr: item.valueAr,
        valueEn: item.valueEn,
      },
      create: {
        pageId: page.id,
        key: item.key,
        type: 'text',
        valueAr: item.valueAr,
        valueEn: item.valueEn,
        sortOrder: 200 + n,
      },
    });
    n += 1;
  }
  console.log('seeded text blocks', n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
