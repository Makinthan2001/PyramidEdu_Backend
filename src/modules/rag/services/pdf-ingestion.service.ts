const pdfParse = require('pdf-parse');
import prisma from '../../../config/prisma.config';

export interface IngestPdfOptions {
  submissionId?: string;
  examId?: string;
  buffer: Buffer;
  sourceUrl: string;
}

export async function enqueuePdfIngestion(options: IngestPdfOptions) {
  // Execute asynchronously without blocking the event loop or the main request
  setTimeout(async () => {
    try {
      console.log(`[RAG Pipeline] Starting background PDF text extraction for ${options.sourceUrl}`);
      
      const data = await pdfParse(options.buffer);
      const text = data.text;
      
      console.log(`[RAG Pipeline] Successfully extracted ${text.length} characters from PDF.`);
      
      // Stub for actual pgvector/embedding logic:
      // const chunks = chunkText(text, { chunkSize: 1000, overlap: 150 });
      // const embeddings = await generateEmbeddings(chunks); 
      // await prisma.studyMaterialChunk.createMany({ ... })
      
      
    } catch (err) {
      console.error(`[RAG Pipeline Error] Failed to ingest PDF from ${options.sourceUrl}:`, err);
    }
  }, 0);
}
