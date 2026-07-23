import { GoogleGenerativeAI } from '@google/generative-ai';
const pdfParse = require('pdf-parse') as any;
import prisma from '../config/prisma.config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

// Initialise the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface TextChunk {
  index: number;
  text: string;
}

/**
 * Utility function to retry promises with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= maxRetries || (error.status !== 503 && error.status !== 429)) {
        throw error;
      }
      console.warn(`[Gemini API] Error ${error.status}: Retrying ${attempt}/${maxRetries} in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
  throw new Error('Unreachable');
}

/**
 * Extract clean text from a PDF file buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = require('pdf-parse');
  const PDFParseClass = pdfParseModule.PDFParse || (pdfParseModule.default && pdfParseModule.default.PDFParse);
  if (!PDFParseClass) {
    throw new Error('PDFParse class not found in pdf-parse module');
  }
  const parser = new PDFParseClass({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  let text = result.text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .trim();

  const numpages = Math.max(result.numpages || 1, 1);
  const avgCharsPerPage = text.length / numpages;

  if (avgCharsPerPage < 20) {
    console.log(`[PDF Classification] IMAGE_BASED detected (${avgCharsPerPage.toFixed(1)} chars/page). Falling back to Gemini OCR...`);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = "Extract all text from this document accurately. Preserve structure where possible. If it's handwriting, transcribe it to the best of your ability. Do not include any conversational filler.";
    
    try {
      const response = await withRetry(() => model.generateContent([
        prompt,
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
      ]));
      text = response.response.text().trim();
      console.log(`[Gemini OCR] Extracted ${text.length} characters.`);
    } catch (error) {
      console.error("[Gemini OCR] Fallback failed:", error);
    }
  } else {
    console.log(`[PDF Classification] TEXT_BASED detected (${avgCharsPerPage.toFixed(1)} chars/page).`);
  }

  if (!text || text.length < 20) {
    console.warn('Could not extract meaningful text from PDF even after fallback.');
  }

  return text;
}

/**
 * Split text into semantic chunks with sliding window overlap
 */
export function chunkText(text: string, chunkSize = 800, overlap = 100): TextChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: TextChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);
    const chunkTextContent = chunkWords.join(' ');

    if (chunkWords.length > 15) {
      chunks.push({
        index: index++,
        text: chunkTextContent.trim(),
      });
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Generate 768-dimensional text embedding using gemini-embedding-001
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await withRetry(() => model.embedContent({
    content: { parts: [{ text }] },
    outputDimensionality: 768,
  } as any));
  return result.embedding.values;
}

/**
 * Batch generate embeddings with 200ms rate-limiting safety delay
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  delayMs = 200
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbedding(texts[i]);
    embeddings.push(embedding);
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return embeddings;
}

/**
 * Store a PDF study material's chunks with their vector embeddings in the DB
 */
export async function storeMaterialChunks(
  materialId: string,
  chunks: TextChunk[],
  embeddings: number[][]
): Promise<void> {
  // Use raw queries since prisma doesn't support vector writes natively
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    const vectorString = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO study_material_chunks (id, material_id, chunk_index, chunk_text, embedding, created_at)
       VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
      crypto.randomUUID(),
      materialId,
      chunk.index,
      chunk.text,
      vectorString
    );
  }
}

export interface SimilarChunk {
  chunk_text: string;
  title: string;
  similarity: number;
}

/**
 * Query database using cosine similarity to find top similar chunks
 */
export async function querySimilarChunks(
  questionEmbedding: number[],
  filters: { subjectId?: string; batchId?: string; topK?: number } = {}
): Promise<SimilarChunk[]> {
  const topK = filters.topK || 5;
  const vectorString = `[${questionEmbedding.join(',')}]`;

  // We construct the query raw to handle neon pgvector cosine similarity search
  // Cosine distance operator is <=> in pgvector. Cosine similarity is 1 - (embedding <=> :vector)
  let query = `
    SELECT 
      smc.chunk_text,
      sm.title,
      1 - (smc.embedding <=> $1::vector) as similarity
    FROM study_material_chunks smc
    JOIN study_materials sm ON sm.id = smc.material_id
    WHERE sm.deleted_at IS NULL
  `;

  const params: any[] = [vectorString];

  if (filters.subjectId) {
    params.push(filters.subjectId);
    query += ` AND sm.subject_id = $${params.length}`;
  }

  if (filters.batchId) {
    params.push(filters.batchId);
    query += ` AND sm.batch_id = $${params.length}`;
  }

  query += ` ORDER BY smc.embedding <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(topK);

  const results = await prisma.$queryRawUnsafe<SimilarChunk[]>(query, ...params);

  return results || [];
}

/**
 * Execute full RAG grounding flow and get grounded response from Gemini
 */
export async function generateRAGAnswer(
  question: string,
  filters: { subjectId?: string; batchId?: string } = {}
): Promise<string> {
  const SIMILARITY_THRESHOLD = 0.3;

  console.log(`\n--- Chatbot Processing ---`);
  console.log(`Question: "${question}"`);

  // 1 & 2. Process Question and Generate Embedding
  const qEmbedding = await generateEmbedding(question);

  // 3. Vector Similarity Search
  const allChunks = await querySimilarChunks(qEmbedding, filters);

  // 4. Relevance Evaluation
  const relevantChunks = allChunks.filter(c => c.similarity >= SIMILARITY_THRESHOLD);

  console.log(`Total chunks retrieved: ${allChunks.length}`);
  if (allChunks.length > 0) {
    console.log(`Similarity Scores: ${allChunks.map(c => c.similarity.toFixed(3)).join(', ')}`);
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  let prompt = '';

  if (relevantChunks.length > 0) {
    // 5. RAG Prompt Construction
    console.log(`Status: Valid chunks found. Activating RAG Mode.`);

    const context = relevantChunks
      .map((c) => `[Source: ${c.title}]\n${c.chunk_text}`)
      .join('\n\n---\n\n');

    prompt = `You are PyramidEdu's educational AI assistant.
Your task is to answer the STUDENT QUESTION using the provided CONTEXT FROM NOTES.
If the answer is present in the context, you must prioritize the notes over your general knowledge.
If the context contains the answer, start your response with a phrase like "Based on the uploaded study materials," or "According to the notes,".
Keep explanations educational and student-friendly.

CONTEXT FROM NOTES:
${context}

STUDENT QUESTION: ${question}
ANSWER:`;
  } else {
    // General Mode Fallback
    console.log(`Status: No relevant chunks met the threshold (${SIMILARITY_THRESHOLD}). Activating General AI Mode.`);

    prompt = `You are PyramidEdu's helpful educational AI assistant.
Answer the STUDENT QUESTION using your general knowledge. Behave as a helpful and friendly assistant.
Support casual conversations, language requests, coding questions, and general educational queries.

STUDENT QUESTION: ${question}
ANSWER:`;
  }

  // 6 & 7. Gemini Answer Generation
  const result = await withRetry(() => model.generateContent(prompt));
  console.log(`--- End Processing ---\n`);

  return result.response.text();
}

/**
 * Background task to ingest uploaded study material PDF files, chunk them,
 * generate embeddings, and store them in the vector database.
 */
export async function processRAGIngestion(
  materialId: string,
  fileUrlsOrPaths: string[]
): Promise<void> {
  try {
    console.log(`Starting background RAG ingestion for material ${materialId} with ${fileUrlsOrPaths.length} items...`);
    for (const item of fileUrlsOrPaths) {
      let buffer: Buffer;
      let displayName = item;

      if (item.startsWith('http://') || item.startsWith('https://')) {
        console.log(`Downloading PDF from URL: ${item}`);
        try {
          const response = await axios.get<ArrayBuffer>(item, {
            responseType: 'arraybuffer',
            timeout: 30_000,
          });
          buffer = Buffer.from(response.data);
          displayName = item.split('/').pop() || item;
        } catch (e) {
          console.error(`Failed to download from ${item}`, e);
          continue;
        }
      } else {
        if (!fs.existsSync(item)) {
          console.warn(`File does not exist: ${item}`);
          continue;
        }
        // Remove .pdf extension check as Multer temp files do not have extensions
        buffer = fs.readFileSync(item);
      }

      const text = await extractTextFromPDF(buffer);
      const chunks = chunkText(text);
      const embeddings = await generateEmbeddingsBatch(chunks.map((c) => c.text));
      await storeMaterialChunks(materialId, chunks, embeddings);
      console.log(`Successfully ingested PDF ${displayName} (${chunks.length} chunks) for material ${materialId}`);
    }
  } catch (error) {
    console.error(`Error during RAG ingestion for material ${materialId}:`, error);
  }
}
