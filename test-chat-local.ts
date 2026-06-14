import { generateRAGAnswer } from './src/utils/rag.util';

async function test() {
  try {
    const answer = await generateRAGAnswer("What is RAG?");
    console.log("Answer:", answer);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
