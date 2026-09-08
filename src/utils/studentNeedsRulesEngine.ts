/**
 * Smart Analysis & Indicators Engine for Student Needs Survey
 * محرك التحليل الذكي وتوليد المؤشرات والتوصيات وبطاقة توجيه المعلم
 */

import {
  SurveyResponses,
  SurveyPriorityLevel,
  SurveyCategory,
  IndicatorExplanation,
  TeacherGuidanceCard,
} from "../types";

/**
 * Generate a consistent 6-digit numeric activation code for a student
 */
export function generateActivationCode(studentId: string): string {
  let hash = 5381;
  const str = String(studentId);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const positive = Math.abs(hash);
  const code = (positive % 900000) + 100000;
  return String(code);
}

export interface EngineAnalysisResult {
  overallPriority: SurveyPriorityLevel;
  primaryCategories: SurveyCategory[];
  indicatorExplanations: IndicatorExplanation[];
  smartSummary: string;
  smartRecommendations: string[];
  teacherGuidance: TeacherGuidanceCard;
}

export function analyzeSurveyResponses(
  studentName: string,
  grade: string = "",
  className: string = "",
  responses: SurveyResponses
): EngineAnalysisResult {
  const primaryCategories: SurveyCategory[] = [];
  const explanations: IndicatorExplanation[] = [];
  let score = 0;

  // --- 1. تحليل الوضع العام والتغيرات ---
  const generalReasons: string[] = [];
  if (responses.generalStatus === "needs_attention") {
    score += 4;
    generalReasons.push("تم وصف الوضع العام للطالب بأنه (يحتاج إلى اهتمام)");
  } else if (responses.generalStatus === "noticeable_changes") {
    score += 3;
    generalReasons.push("رصد تغيرات ملحوظة في وضع الطالب خلال الفترة الأخيرة");
  } else if (responses.generalStatus === "some_changes") {
    score += 1;
    generalReasons.push("ملاحظة بعض التغيرات الحديثة في الوضع العام");
  }

  const changes = responses.recentChanges || [];
  if (changes.length > 0 && !changes.includes("لا يوجد تغير ملحوظ")) {
    score += Math.min(changes.length, 3);
    generalReasons.push(`رصد تغيرات في: ${changes.join("، ")}`);

    if (changes.includes("التحصيل الدراسي")) {
      if (!primaryCategories.includes("academic")) primaryCategories.push("academic");
    }
    if (changes.includes("المزاج") || changes.includes("النوم") || changes.includes("الشهية")) {
      if (!primaryCategories.includes("family")) primaryCategories.push("family");
    }
    if (changes.includes("العلاقات الاجتماعية")) {
      if (!primaryCategories.includes("social")) primaryCategories.push("social");
    }
    if (changes.includes("السلوك")) {
      if (!primaryCategories.includes("behavioral")) primaryCategories.push("behavioral");
    }
    if (changes.includes("الحضور")) {
      if (!primaryCategories.includes("attendance")) primaryCategories.push("attendance");
    }
  }

  if (generalReasons.length > 0) {
    explanations.push({
      category: "general",
      categoryLabel: "الوضع العام ومؤشرات التغير",
      reasons: generalReasons,
      severity: score >= 4 ? "high" : score >= 2 ? "medium" : "low",
    });
  }

  // --- 2. الجانب الدراسي ---
  const academicReasons: string[] = [];
  let academicSeverity: SurveyPriorityLevel = "low";
  if (responses.academicDifficulties === "significant") {
    score += 4;
    academicSeverity = "high";
    academicReasons.push("وجود صعوبات دراسية كبيرة تؤثر على تعلم الطالب حالياً");
    if (!primaryCategories.includes("academic")) primaryCategories.push("academic");
  } else if (responses.academicDifficulties === "moderate") {
    score += 2;
    academicSeverity = "medium";
    academicReasons.push("وجود صعوبات دراسية متوسطة في التعلم");
    if (!primaryCategories.includes("academic")) primaryCategories.push("academic");
  } else if (responses.academicDifficulties === "simple") {
    score += 1;
    academicReasons.push("وجود صعوبات دراسية بسيطة قابلة للتدارك");
    if (!primaryCategories.includes("academic")) primaryCategories.push("academic");
  }

  const needs = responses.academicNeeds || [];
  if (needs.length > 0 && !needs.includes("لا توجد حاجة محددة")) {
    academicReasons.push(`يحتاج الطالب إلى: ${needs.join("، ")}`);
    if (!primaryCategories.includes("academic")) primaryCategories.push("academic");
  }

  if (academicReasons.length > 0) {
    explanations.push({
      category: "academic",
      categoryLabel: "الجانب الدراسي والتعليمي",
      reasons: academicReasons,
      severity: academicSeverity,
    });
  }

  // --- 3. الجانب الاجتماعي والسلوكي ---
  const socialReasons: string[] = [];
  let socialSeverity: SurveyPriorityLevel = "low";
  if (responses.socialRelationships === "noticeable_difficulties") {
    score += 3;
    socialSeverity = "high";
    socialReasons.push("صعوبات ملحوظة في العلاقات الاجتماعية والتواصل مع الأقران");
    if (!primaryCategories.includes("social")) primaryCategories.push("social");
  } else if (responses.socialRelationships === "some_difficulties") {
    score += 1.5;
    socialSeverity = "medium";
    socialReasons.push("بعض الصعوبات في التكيف والعلاقات الاجتماعية");
    if (!primaryCategories.includes("social")) primaryCategories.push("social");
  }

  if (responses.recentImpactingEvent === "yes") {
    score += 2.5;
    socialReasons.push("تعرض الطالب لموقف مؤثر مؤخراً");
    if (responses.impactingEventNeedsContact === "yes") {
      score += 2;
      socialSeverity = "urgent";
      socialReasons.push("طلب ولي الأمر التواصل مع المدرسة بخصوص الموقف المؤثر");
    }
    if (!primaryCategories.includes("social")) primaryCategories.push("social");
    if (!primaryCategories.includes("family")) primaryCategories.push("family");
  }

  if (responses.behaviorsToMonitor === "yes_needs_followup") {
    score += 3;
    socialReasons.push("وجود سلوكيات يرى ولي الأمر أنها تتطلب متابعة مستمرة من المدرسة");
    if (!primaryCategories.includes("behavioral")) primaryCategories.push("behavioral");
  } else if (responses.behaviorsToMonitor === "yes_simple") {
    score += 1;
    socialReasons.push("رغبة ولي الأمر في مراعاة بعض السلوكيات بشكل بسيط");
    if (!primaryCategories.includes("behavioral")) primaryCategories.push("behavioral");
  }

  if (socialReasons.length > 0) {
    explanations.push({
      category: "social",
      categoryLabel: "الجانب الاجتماعي والسلوكي",
      reasons: socialReasons,
      severity: socialSeverity,
    });
  }

  // --- 4. الجانب الصحي الحساس ---
  const healthReasons: string[] = [];
  let healthSeverity: SurveyPriorityLevel = "low";
  if (responses.hasHealthInfo && responses.hasHealthInfo !== "no") {
    score += 2;
    healthSeverity = "medium";
    healthReasons.push(
      responses.hasHealthInfo === "yes_counselor_only"
        ? "توجد معلومات صحية خاصة موجهة للمختص فقط"
        : "توجد معلومات صحية عامة ينبغي مراعاتها من المعلمين"
    );
    if (!primaryCategories.includes("health")) primaryCategories.push("health");

    const healthTypes = responses.healthNeedType || [];
    if (healthTypes.length > 0) {
      healthReasons.push(`نوع الاحتياج الصحي: ${healthTypes.join("، ")}`);
      if (healthTypes.includes("احتياج طارئ يجب مراعاته")) {
        score += 4;
        healthSeverity = "urgent";
      }
      if (healthTypes.includes("احتياج مؤقت")) {
        if (!primaryCategories.includes("temporary")) primaryCategories.push("temporary");
      }
      if (healthTypes.includes("احتياج متعلق بالحضور أو النشاط")) {
        if (!primaryCategories.includes("attendance")) primaryCategories.push("attendance");
      }
    }

    if (responses.healthInstructions?.trim()) {
      healthReasons.push("توجد تعليمات مهمة مدخلة من ولي الأمر للتعامل داخل المدرسة");
    }
  }

  if (healthReasons.length > 0) {
    explanations.push({
      category: "health",
      categoryLabel: "الجانب الصحي الوقائي",
      reasons: healthReasons,
      severity: healthSeverity,
    });
  }

  // --- 5. الدعم المطلوب والملاحظات ---
  const supportExpected = responses.schoolSupportExpected || [];
  if (supportExpected.includes("لقاء مع الموجه الطلابي")) {
    score += 2.5;
    generalReasons.push("طلب صريح من ولي الأمر لعقد لقاء مع الموجه الطلابي");
  }
  if (supportExpected.includes("تواصل مع ولي الأمر")) {
    score += 1.5;
  }

  // تحديد مستوى الأولوية العام بدقة وموضوعية
  let overallPriority: SurveyPriorityLevel = "low";
  if (
    score >= 7 ||
    responses.impactingEventNeedsContact === "yes" ||
    (responses.hasHealthInfo !== "no" && responses.healthNeedType?.includes("احتياج طارئ يجب مراعاته"))
  ) {
    overallPriority = score >= 9 ? "urgent" : "high";
  } else if (score >= 3.5) {
    overallPriority = "medium";
  } else {
    overallPriority = "low";
  }

  if (primaryCategories.length === 0) {
    primaryCategories.push("general");
  }

  // توليد الملخص الذكي
  const summaryParts: string[] = [];
  if (overallPriority === "urgent" || overallPriority === "high") {
    summaryParts.push(
      `تشير إجابات ولي الأمر إلى وجود مؤشرات هامة تستوجب المراجعة السريعة من الموجه الطلابي.`
    );
  } else if (overallPriority === "medium") {
    summaryParts.push(
      `تشير إفادة ولي الأمر إلى استقرار عام مع وجود بعض الجوانب التي تستحق المتابعة الدورية والدعم التربوي.`
    );
  } else {
    summaryParts.push(
      `تظهر مؤشرات الاستبيان استقراراً عاماً لوضع الطالب ولا توجد صعوبات ملحوظة تستدعي تدخلاً استثنائياً.`
    );
  }

  if (primaryCategories.includes("academic")) {
    summaryParts.push(
      `تم رصد حاجة لتعزيز الجانب الدراسي ${
        needs.length > 0 ? `من خلال: (${needs.join("، ")})` : ""
      }.`
    );
  }
  if (primaryCategories.includes("social") || primaryCategories.includes("behavioral")) {
    summaryParts.push(`يوصى بملاحظة التفاعل الصفي والاجتماعي للطالب مع زملائه بلطف.`);
  }
  if (primaryCategories.includes("health")) {
    summaryParts.push(
      `توجد تنبيهات صحية وقائية تم توثيقها مع الالتزام التام بالخصوصية وعدم إحراج الطالب.`
    );
  }
  if (supportExpected.length > 0 && !supportExpected.includes("لا يحتاج إلى إجراء حالياً")) {
    summaryParts.push(`تطلعات ولي الأمر تركز على: ${supportExpected.join("، ")}.`);
  }

  const smartSummary = summaryParts.join(" ");

  // توليد التوصيات المقترحة للموجه الطلابي
  const smartRecommendations: string[] = [];
  if (overallPriority === "urgent") {
    smartRecommendations.push("مراجعة فورية للملف والتواصل مع ولي الأمر خلال 24 ساعة.");
    smartRecommendations.push("عقد جلسة إرشادية فردية وتنسيق الدعم الوقائي اللازم.");
  } else if (overallPriority === "high") {
    smartRecommendations.push("مراجعة الحالة خلال 3 أيام والتنسيق مع ولي الأمر.");
    smartRecommendations.push("متابعة مستوى المشاركة والحضور الصفي بانتظام.");
  } else if (overallPriority === "medium") {
    smartRecommendations.push("مراجعة الملف الإرشادي خلال أسبوع وملاحظة مسار الطالب.");
    smartRecommendations.push("تزويد معلمي الشعبة بالتوجيهات التربوية العامة المعززة.");
  } else {
    smartRecommendations.push("حفظ الاستبيان ضمن سجل المتابعة العامة مع الاستمرار في التحفيز.");
  }

  if (supportExpected.includes("لقاء مع الموجه الطلابي")) {
    smartRecommendations.push("جدولة موعد لقاء مباشر أو هاتفي مع ولي الأمر لتلبية رغبته.");
  }
  if (primaryCategories.includes("academic")) {
    smartRecommendations.push("التنسيق مع المعلمين لتقديم دعم دراسي وتشجيع إيجابي مستمر.");
  }

  // توليد بطاقة توجيه المعلم المخصصة والآمنة تماماً (خالية من الأمراض والخصوصيات)
  const whatStudentNeeds: string[] = [
    "التشجيع الإيجابي وبناء الثقة بالنفس داخل الحصة",
    "مراعاة الفروق الفردية وتقدير جهود الطالب في المشاركة",
  ];
  if (primaryCategories.includes("academic")) {
    whatStudentNeeds.push("تقسيم المهام وتوضيح التعليمات الدراسية بأسلوب ميسر");
    whatStudentNeeds.push("إتاحة فرصة للتفكير وطرح الأسئلة دون تردد");
  }
  if (primaryCategories.includes("health") && responses.hasHealthInfo === "yes_general_teachers") {
    whatStudentNeeds.push("مراعاة المرونة والراحة عند الحاجة أثناء اليوم الدراسي");
  }

  const whatToAvoid: string[] = [
    "تجنب إحراج الطالب أو مقارنته بالآخرين أمام زملائه",
    "تجنب مناقشة أي معلومات شخصية أو خاصة داخل الصف",
    "تجنب الضغط الزائد وإتاحة فرصة للتدرج في الإنجاز",
  ];

  const whatToObserve: string[] = [
    "مستوى الاندماج والتفاعل مع الأنشطة الصفية",
    "مستوى الحضور والتركيز خلال الحصص الدراسية",
    "إشعار الموجه الطلابي بلطف عند ملاحظة أي تغير مفاجئ ومستمر",
  ];

  const attentionLevel =
    overallPriority === "urgent" || overallPriority === "high"
      ? "high_care"
      : overallPriority === "medium"
      ? "needs_attention"
      : "routine";

  const teacherGuidance: TeacherGuidanceCard = {
    studentName,
    grade,
    className,
    attentionLevel,
    whatStudentNeeds,
    whatToAvoid,
    whatToObserve,
    isApprovedByCounselor: false,
  };

  return {
    overallPriority,
    primaryCategories,
    indicatorExplanations: explanations,
    smartSummary,
    smartRecommendations,
    teacherGuidance,
  };
}
