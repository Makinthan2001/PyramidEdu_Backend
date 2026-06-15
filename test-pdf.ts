import fs from 'fs';
import { extractTextFromPDF, chunkText, generateEmbeddingsBatch, storeMaterialChunks } from './src/utils/rag.util';

async function test() {
  try {
    const file = 'd:/6th Semester/Project 2/PyramidEdu_Backend/CST328-2_L1_JavaBeans.pdf';
    console.log(`Testing file: ${file}`);
    const buffer = fs.readFileSync(file);
    const text = await extractTextFromPDF(buffer);
    const chunks = chunkText(text);
    console.log(`Generated chunks: ${chunks.length}`);
    
    console.log('Generating embeddings...');
    const embeddings = await generateEmbeddingsBatch(chunks.map(c => c.text));
    console.log(`Generated ${embeddings.length} embeddings.`);
    
    // We can't easily test storeMaterialChunks without a valid materialId
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
