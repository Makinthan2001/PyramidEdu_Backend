import OpenAI from 'openai';
import { generateRAGAnswer } from './rag.util';
import prisma from '../config/prisma.config';
import { studentRecommendationService } from '../modules/performance/service/student-recommendation.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const PRIMARY_MODEL = 'gpt-4o-mini';

const ROUTER_SYSTEM_PROMPT = `You are an AI Assistant Router for the PyramidEdu learning management system. You must NOT directly execute SQL. Instead, you must convert user natural language queries into structured tool/API calls that the backend will execute securely.

Your job is to detect intent, extract parameters, and call the correct backend tool.

========================
SUPPORTED TOOLS (ONLY USE THESE)
========================

1. getPerformance
Purpose: Fetch student academic performance calculations, predicted scores, performance levels (e.g. Excellent, Good, Average, Needs Improvement, At Risk), trends, score breakdowns, study recommendations, or inquiries asking for a student's overall performance, standing, or details (e.g. "can you give about Makinthan", "tell me about Makinthan", "how is Makinthan doing", "Makinthan performance and details", "details about Sivatheevan").
Input: studentId (optional: string OR array of strings — can be student ID, index number, or student name)

2. getAtRiskStudents
Purpose: Identify and list at-risk, struggling, or failing students who need academic intervention, have low attendance (<75%), or missed exams.
Input: threshold (optional: number), batch (optional: string)

3. getClassSummary
Purpose: Fetch class roster, enrolled students list, assigned subjects, batches, and total student counts for the teacher.
Input: batch (optional: string)

4. getClassAnalytics
Purpose: Fetch class-wide academic performance analytics, average score, score distribution tiers, and highest/lowest performers.
Input: batch (optional: string)

5. getClassSchedule
Purpose: Fetch upcoming and recent class sessions, schedule, and timetable for the teacher.
Input: days (optional: number)

6. getTeacherExams
Purpose: Fetch exams, manual exams, and quizzes created by the teacher, including dates, total marks, and submission/grading statistics.
Input: type (optional: "online" | "manual" | "all")

7. getStudyMaterials / getTeacherMaterials
Purpose: Fetch study notes, PDFs, and learning materials.
- For STUDENTS: Fetch study materials and documents uploaded by teachers for the student's enrolled subjects or batch.
- For TEACHERS: Fetch materials the teacher has uploaded, including review statuses and download links. (ONLY use when specifically asking for uploaded documents, notes, or PDFs, NOT for student inquiries).
Input: subject (optional: string)

8. getAttendance
Purpose: Fetch student attendance records or percentages
Input: studentId (optional: string OR array of strings)

9. getMarks
Purpose: Fetch exam marks and quiz results for students
Input: studentId (optional: string OR array), examId (optional), subject (optional)

10. getFeeStatus
Purpose: Fetch student fee status and payment records
Input: studentId (optional: string OR array)

11. searchNotes / getSubjectPDF
Purpose: Search and fetch uploaded PDFs or study materials for a specific subject/topic
Input: subject (string), topic (optional)

12. getAnnouncements
Purpose: Fetch recent announcements and notices for teachers, batches, or institution
Input: limit (optional: number)

13. generalRAG
Purpose: Use vector database (pgvector) for study-related questions or subject notes content
Input: question (string)

14. generalAI
Purpose: For general knowledge, conceptual explanations, casual greetings, lesson planning, quiz/question generation, educational advice, or pedagogical planning
Input: message (string)

15. generateAiRecommendation
Purpose: Generate a personalized AI study recommendation for a student using their performance data and OpenAI, and save it to their student profile alongside system recommendations.
Input: studentName (optional: string), studentId (optional: string)

========================
INTENT CLASSIFICATION RULES
========================
- Performance calculations, prediction, final score, trend, study recommendations, or inquiring about a specific student (e.g. "can you give about Makinthan", "tell me about Makinthan", "how is Makinthan doing", "Makinthan performance and details", "details about Sivatheevan") → MUST route to getPerformance (with studentId set to the student's name, index, or ID). NEVER route to getTeacherMaterials unless the user explicitly mentions study notes or uploaded files!
- Generate AI recommendation, personalized study recommendation, study advice for student, create study plan for student → generateAiRecommendation
- Student asks for study materials, notes, PDFs, can I access my study materials, materials teacher uploaded for me, study documents → getStudyMaterials
- Teacher asks for materials they uploaded, my uploads, my uploaded documents, upload status (ONLY when specifically asking for study notes, PDFs, or uploaded documents) → getTeacherMaterials
- At-risk students, struggling students, students needing help, failing students, attendance warnings → getAtRiskStudents
- Class summary, list my students, student roster, who is in my class, how many students do I have, batch student list → getClassSummary
- Class average, class performance analytics, score distribution, batch comparison, overall class stats → getClassAnalytics
- Class schedule, timetable, when is my next class, upcoming sessions, today's classes → getClassSchedule
- Teacher's exams, what exams did I create, list my manual exams, quiz overview, upcoming tests → getTeacherExams
- Announcements, notices, school circulars, updates → getAnnouncements
- Attendance records / percentage for specific student(s) → getAttendance
- Exam marks / quiz scores for specific student(s) → getMarks
- Fee related queries → getFeeStatus
- Search general notes or download specific topic PDFs → getSubjectPDF
- Questions on study material content → generalRAG
- General knowledge, concepts, greetings, lesson plan requests, quiz generation, teaching advice → generalAI

========================
MULTI-ID SUPPORT RULES
========================
If user provides multiple IDs:
- Convert to array
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
- If unclear or general conversation → default to generalAI
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
      const status = error?.status || error?.response?.status;
      if (attempt >= maxRetries || (status !== 503 && status !== 429)) {
        throw error;
      }
      console.warn(`[OpenAI API] Error ${status}: Retrying ${attempt}/${maxRetries} in ${delayMs}ms...`);
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
  filters: { subjectId?: string; batchId?: string; userId?: string; userRole?: string } = {},
  conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
  try {
    const historyContext = conversationHistory
      .slice(-4)
      .map(m => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content.slice(0, 150)}`)
      .join('\n');

    const roleContext = filters.userRole ? `Current User Role: ${filters.userRole}\n` : '';
    const routerUserContent = historyContext
      ? `${roleContext}Recent Conversation Context:\n${historyContext}\n\nCurrent User Query: "${question}"`
      : `${roleContext}User Query: "${question}"`;

    let responseText: string;
    try {
      const result = await withRetry(() => openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: ROUTER_SYSTEM_PROMPT },
          { role: 'user', content: routerUserContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
      }));
      responseText = result.choices[0]?.message?.content || '{}';
    } catch (primaryErr) {
      console.warn(`[AI Router] Primary model (${PRIMARY_MODEL}) failed:`, primaryErr);
      // Retry with same model (OpenAI is generally reliable)
      const result = await withRetry(() => openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: ROUTER_SYSTEM_PROMPT },
          { role: 'user', content: routerUserContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 512,
      }));
      responseText = result.choices[0]?.message?.content || '{}';
    }

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

    return await executeTool(routeData, filters, question, conversationHistory);
  } catch (error) {
    console.error("Router Execution Error:", error);
    // Graceful fallback to generalAI instead of hard error
    try {
      const fallbackSystemPrompt = filters.userRole === 'TEACHER'
        ? "You are PyramidEdu's smart AI Teaching Assistant. Help the teacher with student analytics, schedules, exams, or lesson planning. Be concise, polite, and practical. Do not output robotic walls of text."
        : "You are PyramidEdu's friendly student tutor. Answer helpfully, encouragingly, and concisely.";
      const aiResult = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: fallbackSystemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 1024,
      });
      return aiResult.choices[0]?.message?.content?.trim() || "I'm having trouble processing your request right now.";
    } catch (fallbackErr) {
      return "I'm having trouble processing your request right now. You can ask about student performance calculations, attendance, exam marks, fees, or study notes.";
    }
  }
}

interface TeacherDataContext {
  teacher: any | null;
  studentIds: string[];
  students: any[];
  batchIds: string[];
  subjectIds: string[];
}

async function getTeacherDataContext(userId?: string): Promise<TeacherDataContext> {
  if (!userId) {
    return { teacher: null, studentIds: [], students: [], batchIds: [], subjectIds: [] };
  }

  const teacher = await prisma.teacher.findFirst({
    where: { userId, deletedAt: null },
    include: {
      user: true,
      subjectAllocations: {
        where: { status: 'ACTIVE' },
        include: {
          batches: true,
          subject: true,
        },
      },
    },
  });

  if (!teacher) {
    return { teacher: null, studentIds: [], students: [], batchIds: [], subjectIds: [] };
  }

  const batchIds: string[] = [];
  const subjectIds: string[] = [];
  if (teacher.subjectId) subjectIds.push(teacher.subjectId);

  const orConditions: any[] = [
    { enrollments: { some: { teacherId: teacher.id, enrollmentStatus: 'ACTIVE' } } }
  ];

  for (const alloc of teacher.subjectAllocations) {
    if (!subjectIds.includes(alloc.subjectId)) subjectIds.push(alloc.subjectId);
    for (const b of alloc.batches) {
      if (!batchIds.includes(b.id)) batchIds.push(b.id);
    }
    const allocBatchIds = alloc.batches.map(b => b.id);
    if (allocBatchIds.length > 0) {
      orConditions.push({
        batchId: { in: allocBatchIds },
        enrollments: {
          some: {
            subjectId: alloc.subjectId,
            enrollmentStatus: 'ACTIVE',
          },
        },
      });
    }
  }

  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      approvalStatus: 'APPROVED',
      OR: orConditions,
    },
    include: {
      user: true,
      batchRecord: true,
      performancePredictions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      attendances: {
        orderBy: { attendanceDate: 'desc' },
        take: 5,
      },
      results: {
        include: { exam: true, quiz: true },
        orderBy: { recordedAt: 'desc' },
        take: 5,
      },
      fees: {
        orderBy: { monthYear: 'desc' },
        take: 3,
      },
    },
  });

  const studentIds = students.map(s => s.id);
  return { teacher, studentIds, students, batchIds, subjectIds };
}

async function resolveStudentRecords(
  inputIdsOrNames: (string | undefined)[],
  teacherCtx?: { studentIds: string[]; students: any[] }
): Promise<any[]> {
  if (!inputIdsOrNames || inputIdsOrNames.length === 0) return [];

  const foundStudents: any[] = [];
  const foundIds = new Set<string>();

  for (const raw of inputIdsOrNames) {
    if (!raw) continue;
    const term = String(raw).trim();
    if (!term) continue;
    const termLower = term.toLowerCase();

    // 1. Match from teacher's enrolled students first (accurate & context-aware)
    if (teacherCtx && teacherCtx.students && teacherCtx.students.length > 0) {
      const matches = teacherCtx.students.filter((s: any) => {
        const idMatch = s.id.toLowerCase() === termLower;
        const idxMatch = (s.indexNumber || '').toLowerCase() === termLower;
        const fullName = (s.user?.fullName || '').toLowerCase();
        const nameMatch = fullName.includes(termLower) || termLower.includes(fullName);
        const nameParts = fullName.split(/\s+/);
        const partMatch = nameParts.some((part: string) => part.length >= 3 && (termLower.includes(part) || part.includes(termLower)));
        return idMatch || idxMatch || nameMatch || partMatch;
      });

      if (matches.length > 0) {
        matches.forEach((m: any) => {
          if (!foundIds.has(m.id)) {
            foundIds.add(m.id);
            foundStudents.push(m);
          }
        });
        continue;
      }
    }

    // 2. Query Prisma database by UUID, indexNumber, or fullName
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term);
    const dbMatches = await prisma.student.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(isUuid ? [{ id: term }] : []),
          { indexNumber: { equals: term, mode: 'insensitive' } },
          { user: { fullName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: true,
        batchRecord: true,
        performancePredictions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        attendances: {
          orderBy: { attendanceDate: 'desc' },
          take: 5,
        },
        results: {
          include: { exam: true, quiz: true },
          orderBy: { recordedAt: 'desc' },
          take: 5,
        },
        fees: {
          orderBy: { monthYear: 'desc' },
          take: 3,
        },
      },
      take: 5,
    });

    dbMatches.forEach((m: any) => {
      if (!foundIds.has(m.id)) {
        foundIds.add(m.id);
        foundStudents.push(m);
      }
    });
  }

  return foundStudents;
}

async function executeTool(
  routeData: RouterResponse,
  filters: { subjectId?: string; batchId?: string; userId?: string; userRole?: string },
  userQuestion: string = '',
  conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
  const { tool, parameters } = routeData;

  switch (tool) {
    case 'getPerformance': {
      const teacherCtx = filters.userId ? await getTeacherDataContext(filters.userId) : undefined;
      const rawStudentInputs: string[] = [];

      if (parameters.studentId) {
        if (Array.isArray(parameters.studentId)) rawStudentInputs.push(...parameters.studentId);
        else rawStudentInputs.push(parameters.studentId);
      }
      if (parameters.studentName) {
        if (Array.isArray(parameters.studentName)) rawStudentInputs.push(...parameters.studentName);
        else rawStudentInputs.push(parameters.studentName);
      }

      // Check if user mentioned a student name directly in the question
      if (rawStudentInputs.length === 0 && teacherCtx && teacherCtx.students.length > 0) {
        const qLower = userQuestion.toLowerCase();
        for (const s of teacherCtx.students) {
          const fn = (s.user?.fullName || '').toLowerCase();
          const firstWord = fn.split(' ')[0];
          const lastWord = fn.split(' ').slice(-1)[0];
          if ((firstWord && firstWord.length >= 3 && qLower.includes(firstWord)) ||
              (lastWord && lastWord.length >= 3 && qLower.includes(lastWord)) ||
              (s.indexNumber && qLower.includes(s.indexNumber.toLowerCase()))) {
            rawStudentInputs.push(s.id);
          }
        }
      }

      let students: any[] = [];
      if (rawStudentInputs.length > 0) {
        students = await resolveStudentRecords(rawStudentInputs, teacherCtx);
      } else if (filters.userId) {
        if (teacherCtx && teacherCtx.teacher) {
          students = teacherCtx.students;
        } else {
          const student = await prisma.student.findUnique({
            where: { userId: filters.userId },
            include: {
              user: true,
              batchRecord: true,
              performancePredictions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });
          if (student) {
            students = [student];
          } else {
            const user = await prisma.user.findUnique({ where: { id: filters.userId } });
            if (user && (user.role === 'MANAGER' || user.role === 'ADMIN')) {
              students = await prisma.student.findMany({
                take: 10,
                include: {
                  user: true,
                  batchRecord: true,
                  performancePredictions: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
              });
            }
          }
        }
      }

      if (students.length === 0) {
        return `No performance calculation records found for the requested student(s).`;
      }

      let response = `📊 **Performance Summary** (${students.length} student${students.length > 1 ? 's' : ''})\n\n`;
      students.forEach((student, idx) => {
        const latest = student.performancePredictions[0];
        const name = student.user?.fullName || student.indexNumber;
        const index = student.indexNumber || 'N/A';
        const batch = student.batchRecord?.batchName || 'N/A';

        if (idx > 0) response += `---\n\n`;

        response += `**${name}** · \`${index}\` · ${batch}\n\n`;

        if (!latest) {
          response += `⏳ Status: ${student.performanceStatus || 'Not Calculated'}\n`;
          response += `_No performance data available yet._\n\n`;
        } else {
          const score = Number(latest.finalScore).toFixed(1);
          const level = latest.performanceLevel.replace(/_/g, ' ');
          const trendIcon = latest.trendStatus === 'IMPROVING' ? '📈' : latest.trendStatus === 'DECLINING' ? '📉' : '➡️';
          const trendLabel = latest.trendStatus === 'IMPROVING' ? 'Improving' : latest.trendStatus === 'DECLINING' ? 'Declining' : 'Stable';

          // Score with level badge
          const levelEmoji = Number(score) >= 75 ? '🟢' : Number(score) >= 60 ? '🔵' : Number(score) >= 45 ? '🟡' : '🔴';
          response += `${levelEmoji} **${score}%** — ${level} ${trendIcon} ${trendLabel}\n\n`;

          // Component scores in a compact table-like format
          const att = Number(latest.attendanceScore).toFixed(0);
          const mcq = Number(latest.mcqScore).toFixed(0);
          const essay = Number(latest.essayScore).toFixed(0);
          const manual = Number(latest.manualExamScore).toFixed(0);

          response += `**Component Breakdown:**\n`;
          response += `• Attendance: **${att}%** · MCQ Exams: **${mcq}%**\n`;
          response += `• Essay Exams: **${essay}%** · Manual Exams: **${manual}%**\n\n`;

          // Recommendations
          if (latest.recommendations && latest.recommendations.length > 0) {
            response += `**Recommendations:**\n`;
            latest.recommendations.forEach((rec: string) => {
              response += `• ${rec}\n`;
            });
          } else {
            response += `✅ No critical interventions needed.\n`;
          }
          response += `\n`;
        }
      });

      return response.trim();
    }

    case 'generateAiRecommendation': {
      const studentIdInput = parameters.studentId as string;
      const studentNameInput = parameters.studentName as string;

      let targetStudent: any = null;

      if (studentIdInput) {
        targetStudent = await prisma.student.findFirst({
          where: {
            OR: [
              { id: studentIdInput },
              { indexNumber: studentIdInput },
            ],
          },
          include: { user: true },
        });
      }

      if (!targetStudent && studentNameInput) {
        targetStudent = await prisma.student.findFirst({
          where: {
            user: { fullName: { contains: studentNameInput, mode: 'insensitive' } },
          },
          include: { user: true },
        });
      }

      // If still not found, check teacher's enrolled students
      if (!targetStudent && filters.userId) {
        const teacherCtx = await getTeacherDataContext(filters.userId);
        if (teacherCtx.students && teacherCtx.students.length > 0) {
          const queryLower = `${userQuestion} ${studentNameInput || ''}`.toLowerCase();
          const match = teacherCtx.students.find((s) =>
            queryLower.includes(s.user.fullName.toLowerCase()) ||
            (s.indexNumber && queryLower.includes(s.indexNumber.toLowerCase()))
          );
          if (match) {
            targetStudent = match;
          } else if (teacherCtx.students.length === 1) {
            targetStudent = teacherCtx.students[0];
          }
        }
      }

      if (!targetStudent) {
        return "Please specify the student's name or index number so I can generate their personalized AI recommendation.";
      }

      try {
        const result = await studentRecommendationService.generateStudentAiRecommendation(targetStudent.id);
        return `🎓 **AI Academic Diagnostic & Study Roadmap Generated!**\n\n**Student:** ${result.studentName}\n\n${result.aiRecommendation}\n\n---\n✅ *This personalized recommendation has been saved to the student's profile and is available on their mobile app and performance dashboard.*`;
      } catch (err: any) {
        return `⚠️ Could not generate recommendation for ${targetStudent.user?.fullName || 'student'}: ${err.message}`;
      }
    }

    case 'getAttendance': {
      const teacherCtx = filters.userId ? await getTeacherDataContext(filters.userId) : undefined;
      const rawStudentInputs: string[] = [];

      if (parameters.studentId) {
        if (Array.isArray(parameters.studentId)) rawStudentInputs.push(...parameters.studentId);
        else rawStudentInputs.push(parameters.studentId);
      }
      if (parameters.studentName) {
        if (Array.isArray(parameters.studentName)) rawStudentInputs.push(...parameters.studentName);
        else rawStudentInputs.push(parameters.studentName);
      }

      if (rawStudentInputs.length === 0 && teacherCtx && teacherCtx.students.length > 0) {
        const qLower = userQuestion.toLowerCase();
        for (const s of teacherCtx.students) {
          const fn = (s.user?.fullName || '').toLowerCase();
          const firstWord = fn.split(' ')[0];
          const lastWord = fn.split(' ').slice(-1)[0];
          if ((firstWord && firstWord.length >= 3 && qLower.includes(firstWord)) ||
              (lastWord && lastWord.length >= 3 && qLower.includes(lastWord)) ||
              (s.indexNumber && qLower.includes(s.indexNumber.toLowerCase()))) {
            rawStudentInputs.push(s.id);
          }
        }
      }

      let students: any[] = [];
      if (rawStudentInputs.length > 0) {
        students = await resolveStudentRecords(rawStudentInputs, teacherCtx);
      } else if (filters.userId) {
        if (teacherCtx && teacherCtx.teacher) {
          students = teacherCtx.students;
        } else {
          const student = await prisma.student.findUnique({
            where: { userId: filters.userId },
            include: {
              user: true,
              attendances: { orderBy: { attendanceDate: 'desc' }, take: 5 },
            },
          });
          if (student) students = [student];
        }
      }

      if (students.length === 0) {
        return `No attendance records found for student(s): ${rawStudentInputs.join(', ') || 'selected'}.`;
      }

      let response = `📅 **Attendance Records** (${students.length} student${students.length > 1 ? 's' : ''})\n\n`;
      students.forEach((student, idx) => {
        const name = student.user?.fullName || student.indexNumber;
        const index = student.indexNumber || 'N/A';
        const overallAtt = Number(student.attendancePercentage || 0).toFixed(1);
        const attBadge = Number(overallAtt) >= 80 ? '🟢' : Number(overallAtt) >= 65 ? '🟡' : '🔴';

        if (idx > 0) response += `---\n\n`;
        response += `👤 **${name}** · \`${index}\`\n`;
        response += `Overall Attendance: ${attBadge} **${overallAtt}%**\n\n`;

        if (!student.attendances || student.attendances.length === 0) {
          response += `• _No recent session records logged._\n\n`;
        } else {
          response += `**Recent Sessions:**\n`;
          student.attendances.forEach((att: any) => {
            const dateStr = new Date(att.attendanceDate).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });
            const statusIcon = att.attendanceStatus === 'PRESENT' ? '🟢' : att.attendanceStatus === 'LATE' ? '🟡' : '🔴';
            response += `• ${statusIcon} **${att.attendanceStatus}** — ${dateStr}${att.remarks ? ` (${att.remarks})` : ''}\n`;
          });
          response += '\n';
        }
      });
      return response.trim();
    }

    case 'getMarks': {
      const teacherCtx = filters.userId ? await getTeacherDataContext(filters.userId) : undefined;
      const rawStudentInputs: string[] = [];

      if (parameters.studentId) {
        if (Array.isArray(parameters.studentId)) rawStudentInputs.push(...parameters.studentId);
        else rawStudentInputs.push(parameters.studentId);
      }
      if (parameters.studentName) {
        if (Array.isArray(parameters.studentName)) rawStudentInputs.push(...parameters.studentName);
        else rawStudentInputs.push(parameters.studentName);
      }

      if (rawStudentInputs.length === 0 && teacherCtx && teacherCtx.students.length > 0) {
        const qLower = userQuestion.toLowerCase();
        for (const s of teacherCtx.students) {
          const fn = (s.user?.fullName || '').toLowerCase();
          const firstWord = fn.split(' ')[0];
          const lastWord = fn.split(' ').slice(-1)[0];
          if ((firstWord && firstWord.length >= 3 && qLower.includes(firstWord)) ||
              (lastWord && lastWord.length >= 3 && qLower.includes(lastWord)) ||
              (s.indexNumber && qLower.includes(s.indexNumber.toLowerCase()))) {
            rawStudentInputs.push(s.id);
          }
        }
      }

      let students: any[] = [];
      if (rawStudentInputs.length > 0) {
        students = await resolveStudentRecords(rawStudentInputs, teacherCtx);
      } else if (filters.userId) {
        if (teacherCtx && teacherCtx.teacher) {
          students = teacherCtx.students;
        } else {
          const student = await prisma.student.findUnique({
            where: { userId: filters.userId },
            include: {
              user: true,
              results: {
                include: { exam: true, quiz: true },
                orderBy: { recordedAt: 'desc' },
                take: 5
              }
            },
          });
          if (student) students = [student];
        }
      }

      if (students.length === 0) {
        return `No marks found for student(s): ${rawStudentInputs.join(', ') || 'selected'}.`;
      }

      let response = `📝 **Exam & Assessment Results** (${students.length} student${students.length > 1 ? 's' : ''})\n\n`;
      students.forEach((student, idx) => {
        const name = student.user?.fullName || student.indexNumber;
        const index = student.indexNumber || 'N/A';

        if (idx > 0) response += `---\n\n`;
        response += `👤 **${name}** · \`${index}\`\n\n`;

        if (!student.results || student.results.length === 0) {
          response += `• _No recent marks recorded._\n\n`;
        } else {
          response += `**Recent Marks:**\n`;
          student.results.forEach((res: any) => {
            const assessmentName = res.exam?.examTitle || res.quiz?.quizTitle || 'Assessment';
            const markNum = Number(res.marks);
            const badge = markNum >= 75 ? '🟢' : markNum >= 60 ? '🔵' : markNum >= 45 ? '🟡' : '🔴';
            const gradeStr = res.grade ? `(${res.grade})` : '';
            const dateStr = new Date(res.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            response += `• ${badge} **${assessmentName}**: **${markNum.toFixed(1)}%** ${gradeStr} · _${dateStr}_\n`;
          });
          response += '\n';
        }
      });
      return response.trim();
    }

    case 'getFeeStatus': {
      const teacherCtx = filters.userId ? await getTeacherDataContext(filters.userId) : undefined;
      const rawStudentInputs: string[] = [];

      if (parameters.studentId) {
        if (Array.isArray(parameters.studentId)) rawStudentInputs.push(...parameters.studentId);
        else rawStudentInputs.push(parameters.studentId);
      }
      if (parameters.studentName) {
        if (Array.isArray(parameters.studentName)) rawStudentInputs.push(...parameters.studentName);
        else rawStudentInputs.push(parameters.studentName);
      }

      // Check if user mentioned a student name directly in the question
      if (rawStudentInputs.length === 0 && teacherCtx && teacherCtx.students.length > 0) {
        const qLower = userQuestion.toLowerCase();
        for (const s of teacherCtx.students) {
          const fn = (s.user?.fullName || '').toLowerCase();
          const firstWord = fn.split(' ')[0];
          const lastWord = fn.split(' ').slice(-1)[0];
          if ((firstWord && firstWord.length >= 3 && qLower.includes(firstWord)) ||
              (lastWord && lastWord.length >= 3 && qLower.includes(lastWord)) ||
              (s.indexNumber && qLower.includes(s.indexNumber.toLowerCase()))) {
            rawStudentInputs.push(s.id);
          }
        }
      }

      let students: any[] = [];
      if (rawStudentInputs.length > 0) {
        students = await resolveStudentRecords(rawStudentInputs, teacherCtx);
      } else if (filters.userId) {
        if (teacherCtx && teacherCtx.teacher) {
          students = teacherCtx.students;
        } else {
          const student = await prisma.student.findUnique({
            where: { userId: filters.userId },
            include: {
              user: true,
              fees: {
                orderBy: { monthYear: 'desc' },
                take: 3,
              },
            },
          });
          if (student) students = [student];
        }
      }

      if (students.length === 0) {
        return `No fee records found for student(s): ${rawStudentInputs.join(', ') || 'selected'}.`;
      }

      let response = `💳 **Fee & Payment Records** (${students.length} student${students.length > 1 ? 's' : ''})\n\n`;
      students.forEach((student, idx) => {
        const name = student.user?.fullName || student.indexNumber;
        const index = student.indexNumber || 'N/A';

        if (idx > 0) response += `---\n\n`;
        response += `👤 **${name}** · \`${index}\`\n\n`;

        if (!student.fees || student.fees.length === 0) {
          response += `• _No billing or fee records found._\n\n`;
        } else {
          student.fees.forEach((fee: any) => {
            const monthStr = new Date(fee.monthYear).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            const paid = Number(fee.paid).toLocaleString('en-US', { minimumFractionDigits: 2 });
            const total = Number(fee.total).toLocaleString('en-US', { minimumFractionDigits: 2 });
            const due = Number(fee.total) - Number(fee.paid);
            const badge = fee.status === 'PAID' ? '🟢' : fee.status === 'PARTIAL' ? '🟡' : '🔴';

            response += `• ${badge} **${monthStr}**: **${fee.status}**\n`;
            response += `  Paid: LKR ${paid} / Total: LKR ${total}${due > 0 ? ` · Due: LKR ${due.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}\n`;
          });
          response += '\n';
        }
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

      let response = `📚 **Study Materials & Notes** (${materials.length} match${materials.length > 1 ? 'es' : ''})\n\n`;
      materials.forEach((mat, idx) => {
        const subj = mat.subject?.subjectName || 'General';
        const teacherName = mat.teacher?.user?.fullName || 'Teacher';
        const dateStr = new Date(mat.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        if (idx > 0) response += `---\n\n`;
        response += `📖 **${mat.title}**\n`;
        response += `• Subject: **${subj}** · Uploaded by: **${teacherName}** (${dateStr})\n`;
        if (mat.fileUrls && mat.fileUrls.length > 0) {
          response += `• Documents: `;
          response += mat.fileUrls.map((url: string, i: number) => `[📄 Document ${i + 1}](${url})`).join(' · ') + '\n';
        } else {
          response += `• _No attached downloadable documents._\n`;
        }
        response += '\n';
      });

      return response.trim();
    }

    case 'getAtRiskStudents': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      let targetStudents = teacherCtx.students;

      // If user is Admin/Manager and not a teacher, fetch system-wide students
      if (targetStudents.length === 0 && filters.userId) {
        const user = await prisma.user.findUnique({ where: { id: filters.userId } });
        if (user && (user.role === 'ADMIN' || user.role === 'MANAGER')) {
          targetStudents = await prisma.student.findMany({
            where: { deletedAt: null, approvalStatus: 'APPROVED' },
            include: {
              user: true,
              batchRecord: true,
              performancePredictions: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              attendances: {
                orderBy: { attendanceDate: 'desc' },
                take: 5,
              },
            },
            take: 30,
          });
        }
      }

      if (targetStudents.length === 0) {
        return "No enrolled students found for your profile to evaluate risk levels.";
      }

      // Filter for batch if specified
      if (parameters.batch) {
        const bLower = String(parameters.batch).toLowerCase();
        targetStudents = targetStudents.filter(s =>
          s.batchRecord?.batchName?.toLowerCase().includes(bLower) ||
          s.batch?.toLowerCase().includes(bLower)
        );
      }

      const threshold = parameters.threshold ? Number(parameters.threshold) : 50;

      // Identify at-risk students
      const atRiskList = targetStudents
        .map(student => {
          const latest = student.performancePredictions[0];
          const score = latest ? Number(latest.finalScore) : null;
          const level = latest?.performanceLevel || student.performanceStatus || 'UNKNOWN';
          const attendanceRate = Number(student.attendancePercentage || 0);
          const missedExams = (latest?.missedExamCount || 0) + (latest?.absentManualExamCount || 0);

          const reasons: string[] = [];
          let isAtRisk = false;

          if (score !== null && score < threshold) {
            isAtRisk = true;
            reasons.push(`Score below ${threshold}% (${score.toFixed(1)}%)`);
          }
          if (level === 'AT_RISK' || level === 'NEEDS_IMPROVEMENT') {
            isAtRisk = true;
            if (!reasons.some(r => r.includes('Score'))) {
              reasons.push(`Tier: ${level.replace('_', ' ')}`);
            }
          }
          if (attendanceRate < 75 && attendanceRate > 0) {
            isAtRisk = true;
            reasons.push(`Low Attendance (${attendanceRate.toFixed(0)}%)`);
          }
          if (missedExams > 0) {
            isAtRisk = true;
            reasons.push(`Missed ${missedExams} exam${missedExams > 1 ? 's' : ''}`);
          }

          return {
            student,
            latest,
            score,
            level,
            attendanceRate,
            missedExams,
            isAtRisk,
            reasons,
          };
        })
        .filter(item => item.isAtRisk)
        .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

      if (atRiskList.length === 0) {
        return `🎉 **Great news!** None of your enrolled students currently fall into the at-risk or low-performing categories. All students have maintained satisfactory attendance and performance levels above ${threshold}%.`;
      }

      let response = `⚠️ **At-Risk & Low-Performing Students** (${atRiskList.length} student${atRiskList.length > 1 ? 's' : ''} flagged)\n\n`;
      response += `These students require academic intervention, counseling, or attendance follow-up:\n\n`;

      atRiskList.slice(0, 10).forEach((item, i) => {
        const name = item.student.user?.fullName || item.student.indexNumber;
        const index = item.student.indexNumber || 'N/A';
        const batch = item.student.batchRecord?.batchName || 'N/A';
        const scoreStr = item.score !== null ? `${item.score.toFixed(1)}%` : 'N/A';
        const badge = (item.score !== null && item.score < 45) || item.level === 'AT_RISK' ? '🔴' : '🟡';
        const levelStr = item.level.replace(/_/g, ' ');
        const attStr = `${item.attendanceRate.toFixed(0)}%`;
        const riskSummary = item.reasons.join(' · ') || 'Needs monitoring';

        response += `${i + 1}. ${badge} **${name}** (\`${index}\`) · ${batch}\n`;
        response += `   • Overall Score: **${scoreStr}** (${levelStr}) · Attendance: **${attStr}**\n`;
        response += `   • Risk Alerts: ${riskSummary}\n\n`;
      });

      response += `💡 **Recommended Teacher Actions:**\n`;
      response += `• Schedule individual counseling for students marked with 🔴.\n`;
      response += `• Assign targeted practice questions or revision study materials.\n`;
      response += `• Monitor student attendance before the upcoming grading period.\n`;

      return response.trim();
    }

    case 'getClassSummary': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const { teacher, students } = teacherCtx;

      if (!teacher) {
        return "Teacher profile could not be resolved. Please ensure you are logged in with an active teacher account.";
      }

      const teacherName = teacher.user?.fullName || 'Educator';
      const allocations = teacher.subjectAllocations || [];

      let response = `👥 **Class & Student Roster Overview**\n\n`;
      response += `👨‍🏫 **Teacher:** ${teacherName}\n`;
      if (allocations.length > 0) {
        const subjList = allocations.map((a: any) => `${a.subject?.subjectName} (${a.batches.map((b: any) => b.batchName).join(', ') || 'All Batches'})`).join('; ');
        response += `📚 **Assigned Classes:** ${subjList}\n`;
      }
      response += `📊 **Total Enrolled Students:** **${students.length}**\n\n`;

      if (students.length === 0) {
        response += `_No active students are currently enrolled in your assigned classes._`;
        return response;
      }

      // Group by batch
      const batchMap = new Map<string, any[]>();
      students.forEach(s => {
        const bName = s.batchRecord?.batchName || s.batch || 'Unassigned Batch';
        if (!batchMap.has(bName)) batchMap.set(bName, []);
        batchMap.get(bName)!.push(s);
      });

      response += `**Batch Distribution:**\n`;
      batchMap.forEach((sList, bName) => {
        response += `• **${bName}**: **${sList.length}** student${sList.length > 1 ? 's' : ''}\n`;
      });
      response += `\n`;

      response += `📋 **Enrolled Students Roster** (Showing top ${Math.min(students.length, 12)}):\n`;
      students.slice(0, 12).forEach((s, i) => {
        const idx = s.indexNumber || 'N/A';
        const name = s.user?.fullName || 'N/A';
        const batch = s.batchRecord?.batchName || s.batch || 'N/A';
        const att = `${Number(s.attendancePercentage || 0).toFixed(0)}%`;
        const perf = s.performanceStatus ? s.performanceStatus.replace(/_/g, ' ') : 'Pending';
        response += `${i + 1}. **${name}** (\`${idx}\`) · ${batch} · Att: **${att}** · ${perf}\n`;
      });

      if (students.length > 12) {
        response += `\n_...and ${students.length - 12} more students enrolled._\n`;
      }

      return response.trim();
    }

    case 'getClassAnalytics': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const { teacher, students } = teacherCtx;

      if (!teacher) {
        return "Teacher profile could not be resolved. Please log in as a teacher to view class analytics.";
      }

      if (students.length === 0) {
        return "No enrolled students found to compute class analytics.";
      }

      let evaluatedCount = 0;
      let totalScoreSum = 0;
      let totalAttSum = 0;
      let excellentCount = 0;
      let goodCount = 0;
      let needsImpCount = 0;
      let atRiskCount = 0;

      const studentScores: { name: string; index: string; score: number; level: string; batch: string }[] = [];

      students.forEach(s => {
        const att = Number(s.attendancePercentage || 0);
        totalAttSum += att;

        const latest = s.performancePredictions[0];
        if (latest) {
          evaluatedCount++;
          const score = Number(latest.finalScore);
          totalScoreSum += score;
          studentScores.push({
            name: s.user?.fullName || s.indexNumber,
            index: s.indexNumber || 'N/A',
            score,
            level: latest.performanceLevel,
            batch: s.batchRecord?.batchName || 'N/A',
          });

          if (score >= 75 || latest.performanceLevel === 'EXCELLENT') excellentCount++;
          else if (score >= 60 || latest.performanceLevel === 'GOOD') goodCount++;
          else if (score >= 45 || latest.performanceLevel === 'NEEDS_IMPROVEMENT') needsImpCount++;
          else atRiskCount++;
        }
      });

      const avgScore = evaluatedCount > 0 ? (totalScoreSum / evaluatedCount).toFixed(1) : 'N/A';
      const avgAtt = (totalAttSum / students.length).toFixed(1);

      studentScores.sort((a, b) => b.score - a.score);
      const topPerformers = studentScores.slice(0, 3);

      let response = `📈 **Class Academic Performance Analytics**\n\n`;
      response += `| Metric | Value |\n|---|---|\n`;
      response += `| **Total Enrolled** | ${students.length} students |\n`;
      response += `| **Evaluated by AI Engine** | ${evaluatedCount} students |\n`;
      response += `| **Class Average Score** | **${avgScore}%** |\n`;
      response += `| **Class Average Attendance** | **${avgAtt}%** |\n\n`;

      response += `📊 **Performance Tier Distribution:**\n`;
      response += `- 🟢 **Excellent (≥75%):** ${excellentCount} (${evaluatedCount ? Math.round((excellentCount / evaluatedCount) * 100) : 0}%)\n`;
      response += `- 🔵 **Good (60–74%):** ${goodCount} (${evaluatedCount ? Math.round((goodCount / evaluatedCount) * 100) : 0}%)\n`;
      response += `- 🟡 **Needs Improvement (45–59%):** ${needsImpCount} (${evaluatedCount ? Math.round((needsImpCount / evaluatedCount) * 100) : 0}%)\n`;
      response += `- 🔴 **At Risk (<45%):** ${atRiskCount} (${evaluatedCount ? Math.round((atRiskCount / evaluatedCount) * 100) : 0}%)\n\n`;

      if (topPerformers.length > 0) {
        response += `🏆 **Top Performers:**\n`;
        topPerformers.forEach((tp, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          response += `${medal} **${tp.name}** (\`${tp.index}\`) — **${tp.score.toFixed(1)}%** (${tp.batch})\n`;
        });
        response += `\n`;
      }

      if (atRiskCount > 0) {
        response += `⚠️ **Teacher Alert:** ${atRiskCount} student${atRiskCount > 1 ? 's are' : ' is'} currently in the At-Risk tier. Ask *"Predict at-risk students"* to view full details.\n`;
      }

      return response.trim();
    }

    case 'getClassSchedule': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const { teacher } = teacherCtx;

      if (!teacher) {
        return "Teacher profile could not be resolved. Please log in as a teacher to check your schedule.";
      }

      // Fetch upcoming or recent class sessions
      const sessions = await prisma.classSession.findMany({
        where: {
          teacherId: teacher.id,
        },
        include: {
          subject: true,
          batch: true,
          _count: { select: { attendances: true } },
        },
        orderBy: { sessionDate: 'desc' },
        take: 10,
      });

      if (sessions.length === 0) {
        return `📅 **Class Timetable & Sessions**\n\nNo class sessions have been scheduled yet for your teacher account. Contact administration or create a session in the attendance module.`;
      }

      // Sort upcoming first
      const now = new Date();
      const sorted = [...sessions].sort((a, b) => {
        const diffA = Math.abs(new Date(a.sessionDate).getTime() - now.getTime());
        const diffB = Math.abs(new Date(b.sessionDate).getTime() - now.getTime());
        return diffA - diffB;
      });

      let response = `📅 **Class Schedule & Timetable** (Recent & Upcoming)\n\n`;

      sorted.slice(0, 7).forEach((s, i) => {
        const dateStr = new Date(s.sessionDate).toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const timeStr = s.sessionTime || 'N/A';
        const subjStr = s.subject?.subjectName || 'General';
        const batchStr = s.batch?.batchName || 'All Batches';
        const statusBadge = s.status === 'COMPLETED' ? '✅ Completed' : s.status === 'ACTIVE' ? '🟢 Active' : '⏳ Scheduled';
        const attCount = s._count.attendances;

        response += `${i + 1}. **${subjStr}** · ${batchStr}\n`;
        response += `   • Date & Time: **${dateStr}** at **${timeStr}**\n`;
        response += `   • Status: ${statusBadge} · Attendance: **${attCount}** student${attCount === 1 ? '' : 's'}\n\n`;
      });

      return response.trim();
    }

    case 'getTeacherExams': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const { teacher } = teacherCtx;

      if (!teacher) {
        return "Teacher profile could not be resolved. Please log in as a teacher to view your exams.";
      }

      const [onlineExams, manualExams, quizzes] = await Promise.all([
        prisma.exam.findMany({
          where: { teacherId: teacher.id, deletedAt: null },
          include: {
            subject: true,
            batchRecord: true,
            _count: { select: { submissions: true, questions: true } },
          },
          orderBy: { examDate: 'desc' },
          take: 6,
        }),
        prisma.manualExam.findMany({
          where: { teacherId: teacher.id },
          include: {
            subject: true,
            batch: true,
            _count: { select: { marks: true } },
          },
          orderBy: { examDate: 'desc' },
          take: 6,
        }),
        prisma.quiz.findMany({
          where: { teacherId: teacher.id, deletedAt: null },
          include: {
            subject: true,
            _count: { select: { questions: true, results: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      const totalCreated = onlineExams.length + manualExams.length + quizzes.length;
      if (totalCreated === 0) {
        return `📝 **Teacher Assessments & Exams**\n\nYou haven't created any exams or quizzes yet. You can create online exams or manual exams from the Exam Management tab.`;
      }

      let response = `📝 **Teacher Assessments & Exam Overview**\n\n`;

      if (onlineExams.length > 0) {
        response += `💻 **Online Exams (${onlineExams.length}):**\n`;
        onlineExams.forEach((e, i) => {
          const dateStr = new Date(e.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const subj = e.subject?.subjectName || 'General';
          const batch = e.batchRecord?.batchName || 'All Batches';
          response += `${i + 1}. **${e.examTitle}** · ${subj} (${batch})\n`;
          response += `   • Date: **${dateStr}** · Total Marks: **${e.totalMarks}** · Type: **${e.examType}**\n`;
          response += `   • Submissions: **${e._count.submissions}** students submitted\n\n`;
        });
      }

      if (manualExams.length > 0) {
        response += `📄 **Physical / Manual Exams (${manualExams.length}):**\n`;
        manualExams.forEach((m, i) => {
          const dateStr = new Date(m.examDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const subj = m.subject?.subjectName || 'General';
          const batch = m.batch?.batchName || 'All Batches';
          response += `${i + 1}. **${m.examTitle}** · ${subj} (${batch})\n`;
          response += `   • Date: **${dateStr}** · Total Marks: **${m.totalMarks}**\n`;
          response += `   • Grading: **${m._count.marks}** marks entered\n\n`;
        });
      }

      if (quizzes.length > 0) {
        response += `🎯 **Quizzes (${quizzes.length}):**\n`;
        quizzes.forEach((q, i) => {
          const subj = q.subject?.subjectName || 'General';
          const status = q.isPublished ? '🟢 Published' : '⚪ Draft';
          response += `${i + 1}. **${q.quizTitle}** (${subj}) — **${q._count.questions}** questions · ${status} · **${q._count.results}** completed\n`;
        });
        response += `\n`;
      }

      return response.trim();
    }

    case 'getStudyMaterials':
    case 'getTeacherMaterials': {
      // 1. Check if user is a Student requesting their study materials
      let student = null;
      if (filters.userId) {
        student = await prisma.student.findUnique({
          where: { userId: filters.userId },
          include: {
            enrollments: {
              where: { enrollmentStatus: 'ACTIVE' },
              select: { subjectId: true },
            },
          },
        });
      }

      if (student || filters.userRole === 'STUDENT') {
        const subjectIds = student ? student.enrollments.map((e) => e.subjectId) : [];
        const whereClause: any = { deletedAt: null };

        if (parameters.subject) {
          whereClause.OR = [
            { subject: { subjectName: { contains: parameters.subject, mode: 'insensitive' } } },
            { subject: { subjectCode: { contains: parameters.subject, mode: 'insensitive' } } },
            { title: { contains: parameters.subject, mode: 'insensitive' } },
          ];
        } else if (subjectIds.length > 0) {
          whereClause.OR = [
            { subjectId: { in: subjectIds } },
            ...(student?.batch ? [{ batch: student.batch }] : []),
            { batch: null },
          ];
        }

        const materials = await prisma.studyMaterial.findMany({
          where: whereClause,
          include: {
            subject: true,
            teacher: { include: { user: true } },
          },
          orderBy: { uploadedAt: 'desc' },
          take: 8,
        });

        if (materials.length === 0) {
          return `📚 **Study Materials**\n\nNo study materials have been uploaded for your enrolled subjects yet. Please check back later or contact your instructor.`;
        }

        let response = `📚 **Your Study Materials** (${materials.length} document${materials.length > 1 ? 's' : ''})\n\nHere are the study materials uploaded by your teachers:\n\n`;

        materials.forEach((m, i) => {
          const dateStr = new Date(m.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const subj = m.subject?.subjectName || 'General';
          const teacherName = m.teacher?.user?.fullName || 'Teacher';
          const fileLinks = m.fileUrls && m.fileUrls.length > 0
            ? m.fileUrls.map((url, idx) => `[📄 Document ${idx + 1}](${url})`).join(' · ')
            : '_No downloadable files_';

          response += `${i + 1}. **${m.title}** (${subj})\n`;
          response += `   • Uploaded by: **${teacherName}** · _${dateStr}_\n`;
          response += `   • Documents: ${fileLinks}\n\n`;
        });

        return response.trim();
      }

      // 2. User is a Teacher
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const { teacher } = teacherCtx;

      if (!teacher) {
        return "Teacher profile could not be resolved. Please log in as a teacher to check your uploaded materials.";
      }

      const materials = await prisma.studyMaterial.findMany({
        where: { teacherId: teacher.id, deletedAt: null },
        include: {
          subject: true,
          batchRecord: true,
        },
        orderBy: { uploadedAt: 'desc' },
        take: 10,
      });

      if (materials.length === 0) {
        return `📚 **Teacher Study Materials**\n\nYou haven't uploaded any study materials or notes yet. You can upload PDFs and documents from the Notes section.`;
      }

      let response = `📚 **My Uploaded Study Materials** (${materials.length} document${materials.length > 1 ? 's' : ''})\n\n`;

      materials.forEach((m, i) => {
        const dateStr = new Date(m.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const subj = m.subject?.subjectName || 'General';
        const batch = m.batchRecord?.batchName || 'All Batches';
        const statusBadge = m.status === 'Approved' ? '🟢 Approved' : m.status === 'Rejected' ? '🔴 Rejected' : '🟡 ' + m.status;
        const fileLinks = m.fileUrls && m.fileUrls.length > 0
          ? m.fileUrls.map((url, idx) => `[📄 File ${idx + 1}](${url})`).join(' · ')
          : '_No files_';

        response += `${i + 1}. **${m.title}** · ${subj} (${batch})\n`;
        response += `   • Uploaded: **${dateStr}** · Status: ${statusBadge}\n`;
        response += `   • Documents: ${fileLinks}\n\n`;
      });

      return response.trim();
    }

    case 'getAnnouncements': {
      const teacherCtx = await getTeacherDataContext(filters.userId);
      const batchIds = teacherCtx.batchIds || [];

      const announcements = await prisma.announcement.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          publishDate: { lte: new Date() },
          OR: [
            { target: 'ALL' },
            { target: 'TEACHERS' as any },
            ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : []),
            ...(filters.userId ? [{ senderId: filters.userId }] : []),
          ],
        },
        include: {
          sender: { select: { fullName: true } },
          batchRecord: true,
        },
        orderBy: { publishDate: 'desc' },
        take: 5,
      });

      if (announcements.length === 0) {
        return `📢 **Announcements & Notices**\n\nThere are no active announcements at this time.`;
      }

      let response = `📢 **Recent Announcements & Circulars**\n\n`;
      announcements.forEach((a, i) => {
        const pBadge = a.priority === 'HIGH' ? '🔴 HIGH' : a.priority === 'LOW' ? '🔵 LOW' : '🟡 MEDIUM';
        const dateStr = new Date(a.publishDate).toLocaleDateString();
        const author = a.sender?.fullName ? `by ${a.sender.fullName}` : '';
        const targetStr = a.batchRecord ? `[Batch: ${a.batchRecord.batchName}]` : `[${a.target}]`;

        if (i > 0) response += `---\n\n`;
        response += `**${a.title}** ${pBadge} ${targetStr}\n`;
        response += `_Published ${dateStr} ${author}_\n\n`;
        response += `${a.content}\n\n`;
        if (a.attachmentUrl) {
          response += `📎 [View Attached Document](${a.attachmentUrl})\n\n`;
        }
      });

      return response.trim();
    }

    case 'generalRAG':
      // Forward to existing RAG logic
      return await generateRAGAnswer(parameters.question, filters);

    case 'generalAI': {
      // Role-specific AI response
      const isTeacher = filters.userRole === 'TEACHER';
      const promptText = parameters.message || userQuestion || routeData.reason;

      const trimmedQuery = (promptText || '').trim().toLowerCase();
      const isDirectGreeting = /^(?:h+i+|h+e+l+l+o+|h+e+y+|good\s*(?:morning|afternoon|evening)|vanakkam|ayubowan)(?:\s+there|\s+pyramid|\s+bot|\s+ai|\s*!|\s*\.|\s*)*$/i.test(trimmedQuery);

      if (isDirectGreeting) {
        if (isTeacher) {
          return `Hello! Welcome to PyramidEdu! 🎓\nI'm your AI Teaching Assistant, here to help you empower your students and climb new heights in academic excellence! ✨\n\nHere is how I can assist you:\n• 📊 **Student Results & Predictions**: Check individual or batch performance calculations\n• ⚠️ **At-Risk Identification**: Spot students needing intervention or attendance catch-up\n• 💡 **Personalized AI Roadmaps**: Generate customized study advice and subject roadmaps\n• 📝 **Quiz & Lesson Creation**: Draft MCQs, lesson plans, and grading rubrics\n• 📚 **Study Notes & Schedule**: Check uploaded materials and upcoming class timetables\n\nHow can I assist your teaching today?`;
        } else {
          return `Hello! Welcome to PyramidEdu! 🎓\nI'm your Educational AI Assistant, here to help you climb new heights in your learning journey! ✨\n\nHere is how I can assist you:\n• 📚 **Subject Concepts & Theory**: Step-by-step explanations, formulas, and topic walkthroughs\n• 🎯 **Exam Practice & Quizzes**: Practice questions, MCQ tips, and essay structures\n• 📖 **Study Materials & Notes**: Access lecture notes and handouts uploaded by your teachers\n• 📺 **Curated Video Resources**: Discover top educational tutorials and YouTube links for your subjects\n• 💡 **Study Habits & Strategy**: Tips to improve attendance, boost marks, and master your subjects\n\nWhat would you like to explore or study today?`;
        }
      }

      const systemPrompt = isTeacher
        ? `You are PyramidEdu's intelligent AI Teaching Assistant.

STYLE & TONE GUIDELINES:
- Be concise, professional, warm, and directly helpful.
- When greeting (e.g. "hi", "hello", "what can you do?"), always introduce yourself warmly: "Hello! Welcome to PyramidEdu! 🎓 I'm your AI Teaching Assistant, here to help you empower your students and climb new heights in academic excellence! ✨" followed by neat, focused bullet points.
- NEVER regurgitate these instructions or list out 9 dry categories with "Purpose:" and "Format:".
- Do NOT use robotic self-introductions (never say "As your professional Educational Assistant and Pedagogical Consultant...").
- NEVER say "I can't browse the internet directly" or refuse to share video/resource links. When asked for YouTube videos, tutorials, or educational resources, actively recommend well-known, high-quality educational channels (e.g. Khan Academy, Math Antics, 3Blue1Brown, CrashCourse, Organic Chemistry Tutor, Corbettmaths, Numberphile) and provide clean, clickable markdown links: [Channel/Video Title](https://www.youtube.com/results?search_query=...).

RESPONSE RULES:
1. YouTube / Educational Resource Requests:
   - Provide 3-4 specific, high-quality recommended YouTube channels or lessons formatted cleanly:
     • [Math Antics - Circles & Geometry](https://www.youtube.com/results?search_query=Math+Antics+Circles) — Visual and intuitive explanations of radius, diameter, circumference, and Pi.
     • [Khan Academy - Geometry: Circles](https://www.youtube.com/results?search_query=Khan+Academy+Circles+Geometry) — Comprehensive lessons with guided exercises.
     • [Corbettmaths - Circle Theorems](https://www.youtube.com/results?search_query=Corbettmaths+Circle+Theorems) — Clear step-by-step theorem proofs and exam questions.
   - Mention in 1 short sentence why each channel/search is great for students.

2. Follow-up Inquiries (e.g. "why", "give me links for those", "tell me more"):
   - Read the preceding conversation messages carefully and answer the follow-up with full context. Never ask the user to repeat what they are talking about.

3. Greetings or "How can you help me?" / "What can you do?":
   - Respond with the signature warm PyramidEdu welcome message, inspiring them to climb new heights, with 4-5 neat bullet points.

4. Subject / Academic questions:
   - Provide clear, direct explanations with relevant formulas, examples, and step-by-step reasoning.

5. Quiz creation requests:
   - Provide clean MCQs with options (A, B, C, D), a bolded **Correct Answer**, and a brief explanation.

6. Lesson planning or teaching advice:
   - Provide practical, structured outlines that can be directly applied in class.`
        : `You are PyramidEdu's friendly, encouraging educational tutor for students.

STYLE & TONE GUIDELINES:
- Be clear, supportive, inspiring, and student-friendly.
- When greeting (e.g. "hi", "hello", "hey", "how can you help me"), always greet warmly:
  "Hello! Welcome to PyramidEdu! 🎓
  I'm your Educational AI Assistant, here to help you climb new heights in your learning journey! ✨"
  followed by neat, structured bullet points of how you can help them (concepts, exam practice, study materials, video tutorials).
- Never say "I can't browse the internet" when asked for YouTube videos or tutorials. Provide top educational YouTube channel links in markdown: [Channel/Topic](https://www.youtube.com/results?search_query=...).
- Understand follow-up questions using the recent conversation history.
- Use clean formatting, bold text, and bullet points.`;

      const recentMessages: OpenAI.ChatCompletionMessageParam[] = conversationHistory
        .slice(-6)
        .map(m => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: m.content,
        }));

      const aiResult = await withRetry(() => openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...recentMessages,
          { role: 'user', content: promptText },
        ],
        max_tokens: 1024,
      }));
      return aiResult.choices[0]?.message?.content?.trim() || 'I could not generate a response.';
    }

    default:
      console.warn(`Unknown tool called by router: ${tool}`);
      return `I'm sorry, I don't know how to handle the request for '${tool}'.`;
  }
}
