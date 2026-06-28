import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateRAGAnswer } from './rag.util';
import prisma from '../config/prisma.config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const ROUTER_SYSTEM_PROMPT = `You are an AI Assistant Router for the PyramidEdu system. You must NOT directly execute SQL. Instead, you must convert user natural language queries into structured tool/API calls that the backend will execute securely.

Your job is to detect intent, extract parameters, and call the correct backend tool.

========================
SUPPORTED TOOLS (ONLY USE THESE)
========================

1. getAttendance
Purpose: Fetch student attendance data
Input: studentId (string OR array of strings)

2. getMarks
Purpose: Fetch exam marks
Input: studentId (string OR array), examId (optional), subject (optional)

3. getFeeStatus
Purpose: Fetch student fee status
Input: studentId (string OR array)

4. searchNotes / getSubjectPDF
Purpose: Fetch uploaded PDFs or notes
Input: subject (string), topic (optional)

5. generalRAG
Purpose: Use vector database (pgvector) for study-related questions
Input: question (string)

6. generalAI
Purpose: For non-academic/general conversation
Input: message (string)

========================
INTENT CLASSIFICATION RULES
========================
- Attendance → getAttendance
- Marks → getMarks
- Fee related → getFeeStatus
- PDF / Notes download → getSubjectPDF
- Study question → generalRAG
- General chat → generalAI

========================
MULTI-ID SUPPORT RULES
========================
If user provides multiple IDs:
- Convert to array

========================
OUTPUT FORMAT (STRICT)
========================
You MUST respond ONLY in JSON:
{
  "tool": "toolName",
  "parameters": {},
  "reason": "short explanation"
}

========================
CRITICAL RULES
========================
- NEVER generate SQL queries
- ONLY use provided tools
- ALWAYS return valid JSON
- NEVER hallucinate data
- If unclear → default to generalAI
- If unclear → default to generalAI
- Keep responses structured for backend execution`;

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

interface RouterResponse {
  tool: string;
  parameters: any;
  reason: string;
}

export async function routeQuery(
  question: string,
  filters: { subjectId?: string; batchId?: string; userId?: string } = {}
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `${ROUTER_SYSTEM_PROMPT}\n\nUser Query: "${question}"`;
    const result = await withRetry(() => model.generateContent(prompt));
    const responseText = result.response.text();
    
    let routeData: RouterResponse;
    try {
      routeData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse router response:", responseText);
      return "An error occurred while routing your query.";
    }

    console.log(`\n--- AI Router ---`);
    console.log(`Tool Selected: ${routeData.tool}`);
    console.log(`Reason: ${routeData.reason}`);
    console.log(`Parameters:`, routeData.parameters);
    console.log(`-----------------\n`);

    return await executeTool(routeData, filters);
  } catch (error) {
    console.error("Router Execution Error:", error);
    return "The assistant router encountered an error processing your request.";
  }
}

async function executeTool(
  routeData: RouterResponse,
  filters: { subjectId?: string; batchId?: string; userId?: string }
): Promise<string> {
  const { tool, parameters } = routeData;

  switch (tool) {
    case 'getAttendance': {
      let studentIdsInput = parameters.studentId 
        ? (Array.isArray(parameters.studentId) ? parameters.studentId : [parameters.studentId]).filter(Boolean)
        : [];

      if (studentIdsInput.length === 0 && filters.userId) {
        const student = await prisma.student.findUnique({ where: { userId: filters.userId } });
        if (student) studentIdsInput = [student.id];
      }

      if (studentIdsInput.length === 0) {
        return "I need a student ID to check attendance, or you must be logged in as a student.";
      }

      const students = await prisma.student.findMany({
        where: {
          OR: [
            { indexNumber: { in: studentIdsInput } },
            { id: { in: studentIdsInput } }
          ]
        },
        include: {
          user: true,
          attendances: {
            orderBy: { attendanceDate: 'desc' },
            take: 5
          }
        }
      });

      if (students.length === 0) {
        return `No attendance records found for student(s): ${studentIdsInput.join(', ')}.`;
      }

      let response = 'Here are the latest attendance records:\n\n';
      students.forEach(student => {
        response += `**${student.user?.fullName || student.indexNumber}** (${student.indexNumber})\n`;
        if (student.attendances.length === 0) {
          response += `- No recent attendance records.\n`;
        } else {
          student.attendances.forEach(att => {
            const dateStr = new Date(att.attendanceDate).toLocaleDateString();
            response += `- ${dateStr}: **${att.attendanceStatus}**\n`;
          });
        }
        response += '\n';
      });
      return response.trim();
    }

    case 'getMarks': {
      let studentIdsInput = parameters.studentId 
        ? (Array.isArray(parameters.studentId) ? parameters.studentId : [parameters.studentId]).filter(Boolean)
        : [];

      if (studentIdsInput.length === 0 && filters.userId) {
        const student = await prisma.student.findUnique({ where: { userId: filters.userId } });
        if (student) studentIdsInput = [student.id];
      }

      if (studentIdsInput.length === 0) {
        return "I need a student ID to check marks, or you must be logged in as a student.";
      }

      const students = await prisma.student.findMany({
        where: {
          OR: [
            { indexNumber: { in: studentIdsInput } },
            { id: { in: studentIdsInput } }
          ]
        },
        include: {
          user: true,
          results: {
            include: { exam: true, quiz: true },
            orderBy: { recordedAt: 'desc' },
            take: 5
          }
        }
      });

      if (students.length === 0) {
        return `No marks found for student(s): ${studentIdsInput.join(', ')}.`;
      }

      let response = 'Here are the latest exam/quiz marks:\n\n';
      students.forEach(student => {
        response += `**${student.user?.fullName || student.indexNumber}** (${student.indexNumber})\n`;
        if (student.results.length === 0) {
          response += `- No recent marks recorded.\n`;
        } else {
          student.results.forEach(res => {
            const assessmentName = res.exam?.examTitle || res.quiz?.quizTitle || 'Assessment';
            response += `- ${assessmentName}: **${res.marks}%** (${res.grade || 'N/A'})\n`;
          });
        }
        response += '\n';
      });
      return response.trim();
    }

    case 'getFeeStatus': {
      let studentIdsInput = parameters.studentId 
        ? (Array.isArray(parameters.studentId) ? parameters.studentId : [parameters.studentId]).filter(Boolean)
        : [];

      if (studentIdsInput.length === 0 && filters.userId) {
        const student = await prisma.student.findUnique({ where: { userId: filters.userId } });
        if (student) studentIdsInput = [student.id];
      }

      if (studentIdsInput.length === 0) {
        return "I need a student ID to check fee status, or you must be logged in as a student.";
      }

      const students = await prisma.student.findMany({
        where: {
          OR: [
            { indexNumber: { in: studentIdsInput } },
            { id: { in: studentIdsInput } }
          ]
        },
        include: {
          user: true,
          fees: {
            orderBy: { monthYear: 'desc' },
            take: 3
          }
        }
      });

      if (students.length === 0) {
        return `No fee records found for student(s): ${studentIdsInput.join(', ')}.`;
      }

      let response = 'Here is the latest fee status:\n\n';
      students.forEach(student => {
        response += `**${student.user?.fullName || student.indexNumber}** (${student.indexNumber})\n`;
        if (student.fees.length === 0) {
          response += `- No fee records found.\n`;
        } else {
          student.fees.forEach(fee => {
            const dateStr = new Date(fee.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            response += `- ${dateStr}: **${fee.status}** (Paid: ${fee.paid} / Total: ${fee.total})\n`;
          });
        }
        response += '\n';
      });
      return response.trim();
    }

    case 'getSubjectPDF':
    case 'searchNotes': {
      const subjectParam = parameters.subject || '';
      const topicParam = parameters.topic || '';
      const searchStr = `${subjectParam} ${topicParam}`.trim();
      
      if (!searchStr) {
        return "Please specify a subject or topic to search for study materials.";
      }

      const materials = await prisma.studyMaterial.findMany({
        where: {
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { subject: { subjectName: { contains: searchStr, mode: 'insensitive' } } },
            { subject: { subjectCode: { contains: searchStr, mode: 'insensitive' } } }
          ],
          deletedAt: null
        },
        include: {
          subject: true,
          teacher: { include: { user: true } }
        },
        take: 5
      });

      if (materials.length === 0) {
        return `No study materials or PDFs found matching "${searchStr}".`;
      }

      let response = `Here are the top study materials for "${searchStr}":\n\n`;
      materials.forEach(mat => {
        response += `**${mat.title}** (Subject: ${mat.subject?.subjectName || 'Unknown'})\n`;
        response += `Uploaded by: ${mat.teacher?.user?.fullName || 'Unknown'}\n`;
        if (mat.fileUrls && mat.fileUrls.length > 0) {
          mat.fileUrls.forEach((url: string, i: number) => {
            response += `- [Download/View Document ${i + 1}](${url})\n`;
          });
        } else {
          response += `- No attached files.\n`;
        }
        response += '\n';
      });

      return response.trim();
    }

    case 'generalRAG':
      // Forward to existing RAG logic
      return await generateRAGAnswer(parameters.question, filters);

    case 'generalAI':
      // Basic AI response
      const aiModel = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const aiPrompt = `You are PyramidEdu's helpful educational AI assistant. Answer the following message generally.
User message: ${parameters.message}
Answer:`;
      const aiResult = await withRetry(() => aiModel.generateContent(aiPrompt));
      return aiResult.response.text();

    default:
      console.warn(`Unknown tool called by router: ${tool}`);
      return `I'm sorry, I don't know how to handle the request for '${tool}'.`;
  }
}
