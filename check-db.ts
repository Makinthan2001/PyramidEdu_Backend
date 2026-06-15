import prisma from './src/config/prisma.config';
import { processRAGIngestion } from './src/utils/rag.util';

async function check() {
  try {
    const materials = await prisma.studyMaterial.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    console.log('Recent materials:');
    for (const m of materials) {
      console.log(`- ID: ${m.id}, Title: ${m.title}, FileUrls: ${m.fileUrls}`);
      const chunks = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM study_material_chunks WHERE material_id = $1`, m.id);
      console.log(`  Chunks count:`, chunks);
      
      // Let's re-run ingestion for this material manually to see what happens
      console.log(`  Re-running ingestion...`);
      await processRAGIngestion(m.id, m.fileUrls as string[]);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
