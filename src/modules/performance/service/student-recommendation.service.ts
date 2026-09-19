import OpenAI from 'openai';
import prisma from '../../../config/prisma.config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export class StudentRecommendationService {
  /**
   * Generates a personalized AI study recommendation for a student based on their academic metrics
   * and saves it alongside existing system recommendations.
   */
  async generateStudentAiRecommendation(studentIdOrIndex: string) {
    // 1. Fetch student details (supports UUID or indexNumber)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentIdOrIndex);
    const student = await prisma.student.findFirst({
      where: isUuid ? { id: studentIdOrIndex } : { indexNumber: studentIdOrIndex },
      include: {
        user: { select: { fullName: true, email: true } },
        stream: { select: { streamName: true } },
        batchRecord: { select: { batchName: true } },
        enrollments: {
          include: {
            subject: { select: { id: true, subjectName: true, subjectCode: true } },
            teacher: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
    });

    if (!student) {
      throw new Error(`Student with ID ${studentIdOrIndex} not found.`);
    }

    const studentId = student.id;

    // 2. Fetch latest performance prediction
    const latestPrediction = await prisma.performancePrediction.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestPrediction) {
      throw new Error(`No performance calculation found for student ${student.user.fullName}. Please calculate performance first.`);
    }

    // 3. Extract metrics
    const attendanceScore = Number(latestPrediction.attendanceScore);
    const mcqScore = Number(latestPrediction.mcqScore);
    const essayScore = Number(latestPrediction.essayScore);
    const manualScore = Number(latestPrediction.manualExamScore);
    const finalScore = Number(latestPrediction.finalScore);
    const performanceLevel = latestPrediction.performanceLevel;
    const trendStatus = latestPrediction.trendStatus;
    const missedExams = latestPrediction.missedExamCount;
    const absentManual = latestPrediction.absentManualExamCount;

    // Extract enrolled subjects (deduplicated)
    const enrolledSubjectsMap = new Map<string, { id: string; name: string; teacher: string }>();
    student.enrollments.forEach((e) => {
      if (e.subject && !enrolledSubjectsMap.has(e.subject.id)) {
        enrolledSubjectsMap.set(e.subject.id, {
          id: e.subject.id,
          name: e.subject.subjectName,
          teacher: e.teacher?.user?.fullName || 'Assigned Instructor',
        });
      }
    });
    const enrolledSubjects = Array.from(enrolledSubjectsMap.values());
    const subjectNamesList = enrolledSubjects.map((s) => s.name).join(', ') || 'Enrolled AL Subjects';

    // 4. Fetch available study materials in PyramidEdu for their enrolled subjects
    const enrolledSubjectIds = enrolledSubjects.map((s) => s.id);
    const availableMaterials = await prisma.studyMaterial.findMany({
      where: {
        subjectId: { in: enrolledSubjectIds },
        deletedAt: null,
      },
      select: {
        title: true,
        subject: { select: { subjectName: true } },
      },
      take: 6,
    });
    const materialsSummary =
      availableMaterials.length > 0
        ? availableMaterials.map((m) => `"${m.title}" (${m.subject?.subjectName})`).join(', ')
        : 'Topic Lecture Notes & Practice Problem Sets';

    // 5. Fetch recent student results
    const recentResults = await prisma.result.findMany({
      where: { studentId },
      include: {
        exam: { include: { subject: { select: { subjectName: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 5,
    });
    const recentResultsSummary =
      recentResults.length > 0
        ? recentResults
            .map((r) => `${r.exam?.subject?.subjectName || 'Exam'}: ${Number(r.marks).toFixed(1)}%`)
            .join(', ')
        : 'No recent exam marks recorded';

    // Filter existing system recommendations
    const existingRecs = latestPrediction.recommendations || [];
    const systemRecs = existingRecs.filter(
      (r) =>
        !r.startsWith('AI Strategy:') &&
        !r.startsWith('AI Recommendation:') &&
        !r.startsWith('💡 AI Strategy:')
    );

    // 6. Construct prompt for OpenAI
    const prompt = `You are a high-level Senior Academic Mentor and Subject Specialist at PyramidEdu.
Analyze this student's comprehensive academic profile and generate a detailed, structured, highly practical study roadmap and diagnostic report for them.

Student Profile:
- Name: ${student.user.fullName} (${student.indexNumber || 'Student'})
- Stream: ${student.stream?.streamName || 'General Advanced Level'}
- Batch: ${student.batchRecord?.batchName || student.batch || '2026 A/L'}
- Overall Academic Score: ${finalScore.toFixed(1)}% (${performanceLevel})
- Performance Trend: ${trendStatus}
- Attendance Rate: ${attendanceScore.toFixed(1)}%
- MCQ Assessment Score: ${mcqScore.toFixed(1)}%
- Essay Assessment Score: ${essayScore.toFixed(1)}%
- Physical/Lab Exam Score: ${manualScore.toFixed(1)}%
- Missed Online Assessments: ${missedExams}
- Absent Physical Assessments: ${absentManual}
- Enrolled Subjects: ${subjectNamesList}
- Recent Exam Marks: ${recentResultsSummary}
- PyramidEdu Portal Study Materials Available: ${materialsSummary}
- Active System Action Flags: ${systemRecs.length > 0 ? systemRecs.join(', ') : 'Maintain active progress'}

Instructions:
You must format your response strictly using clean, neat markdown with the following 4 structured sections:

1. 📊 Academic Standing & Current Level:
Clearly state their current performance tier (${performanceLevel} - ${finalScore.toFixed(1)}%), trend status (${trendStatus}), and attendance rate (${attendanceScore.toFixed(1)}%). Provide an honest, constructive diagnostic of their engagement and exam readiness.

2. 🎯 Subject Focus & Improvement Areas:
Directly address their enrolled subjects (${subjectNamesList}). Detail which specific subjects or core modules (e.g., Theory, Problem Solving, Analytical Writing) need the most urgent attention, and provide clear concept targets.

3. 📖 PyramidEdu Study Materials & Action Plan:
Reference available portal materials (${materialsSummary}) and outline a concrete weekly study and revision routine (attendance commitments, reviewing lecture handouts, and solving past papers).

4. 📺 Curated YouTube & Learning Links:
Provide 2-3 clean, directly clickable markdown search links tailored specifically to their enrolled subjects and challenging topics. Use standard markdown link syntax with YouTube search queries:
• [Subject Topic - Tutorial / Past Paper Walkthrough](https://www.youtube.com/results?search_query=Target+Keywords)
Ensure each link query is URL-encoded, realistic, and matches their actual subjects.

Important:
- Be encouraging, pedagogical, and highly specific to their subjects.
- Start your entire response directly with "AI Strategy:\n"`;

    let aiRecommendation = '';
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert pedagogical consultant and academic coach at PyramidEdu. Provide structured, comprehensive, and neat study roadmaps with real subject guidance, study materials advice, and clickable YouTube search links.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 700,
        temperature: 0.7,
      });

      aiRecommendation = completion.choices[0]?.message?.content?.trim() || '';
    } catch (err: any) {
      console.error(`[OpenAI Recommendation] Generation failed for ${studentId}:`, err);
      // Intelligent fallback structured with student's real subjects and portal materials
      const primarySubject = enrolledSubjects[0]?.name || 'Combined Mathematics';
      const secondarySubject = enrolledSubjects[1]?.name || 'Physics';

      const primaryQuery = encodeURIComponent(`${primarySubject} AL Revision Tutorial`);
      const secondaryQuery = encodeURIComponent(`${secondarySubject} AL Past Paper Solutions`);

      aiRecommendation = `AI Strategy:\n` +
        `### 1. 📊 Academic Standing & Current Level\n` +
        `• **Current Standing**: **${performanceLevel}** (${finalScore.toFixed(1)}% Overall Score)\n` +
        `• **Attendance Rate**: **${attendanceScore.toFixed(1)}%** | **Trend**: **${trendStatus}**\n` +
        `• **Evaluation**: ${
          finalScore < 40
            ? 'Immediate academic intervention is necessary. Low attendance and unattempted exams are severely impacting your subject mastery.'
            : finalScore < 65
            ? 'Solid foundation, but inconsistent test attendance and structured essay performance are limiting your potential.'
            : 'Commendable performance. Consistency in regular revision and advanced problem-solving will secure top-tier exam grades.'
        }\n\n` +
        `### 2. 🎯 Subject Focus & Improvement Areas\n` +
        `• **Enrolled Subjects**: ${subjectNamesList}\n` +
        `• **Priority Focus**: Focus intensive revision on **${primarySubject}** and **${secondarySubject}**. Target foundational theorem proofs, formula derivations, and timed question practice.\n` +
        `• **Exam Strategy**: Target daily 30-minute practice blocks for MCQ speed and structure essays clearly using standard marking rubrics.\n\n` +
        `### 3. 📖 PyramidEdu Study Materials & Action Plan\n` +
        `• **Portal Materials**: Review uploaded study guides: *${materialsSummary}* available in your student portal.\n` +
        `• **Weekly Schedule**: Ensure 100% attendance in scheduled classes this month. Summarize key concepts after each lecture and solve chapter-end exercises before the next session.\n\n` +
        `### 4. 📺 Curated YouTube & Learning Links\n` +
        `• [${primarySubject} - Comprehensive Revision & Core Concepts](https://www.youtube.com/results?search_query=${primaryQuery})\n` +
        `• [${secondarySubject} - Past Paper Problem Solving Walkthroughs](https://www.youtube.com/results?search_query=${secondaryQuery})`;
    }

    if (!aiRecommendation.startsWith('AI Strategy:')) {
      aiRecommendation = `AI Strategy:\n${aiRecommendation}`;
    }

    // 7. Combine with existing system recommendations (preserve existing without changing them)
    const updatedRecommendations = [...systemRecs, aiRecommendation];

    // 8. Save to DB
    const updatedPrediction = await prisma.performancePrediction.update({
      where: { id: latestPrediction.id },
      data: {
        recommendations: updatedRecommendations,
      },
    });

    return {
      studentId,
      studentName: student.user.fullName,
      aiRecommendation,
      recommendations: updatedRecommendations,
      prediction: updatedPrediction,
    };
  }
}

export const studentRecommendationService = new StudentRecommendationService();
