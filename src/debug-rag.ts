import prisma from './config/prisma.config';
import { processRAGIngestion } from './utils/rag.util';

async function main() {
  console.log("Checking study materials...");
  const materials = await prisma.studyMaterial.findMany({
    orderBy: { uploadedAt: 'desc' },
    take: 3,
  });

  console.log("Latest study materials:", JSON.stringify(materials, null, 2));

  if (materials.length === 0) {
    console.log("No study materials found.");
    return;
  }

  const latest = materials[0];
  console.log(`Running RAG Ingestion manually on material ${latest.id} with files:`, latest.fileUrls);
  
  try {
    await processRAGIngestion(latest.id, latest.fileUrls);
    console.log("Manual RAG Ingestion finished!");
  } catch (err) {
    console.error("Manual ingestion threw error:", err);
  }
}

main().catch(err => {
  console.error("Global error:", err);
});
