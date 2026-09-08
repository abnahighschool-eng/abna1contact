/**
 * Rules Engine & Indicator Generator for Student Support
 * محرك القواعد وتحليل الملاحظات دون إصدار أي تشخيص طبي أو نفسي
 */

import {
  StudentSupportProfile,
  StudentIndicators,
  IndicatorLevel,
  IndicatorData,
} from "../types/studentSupport";

const LEVEL_COLORS: Record<IndicatorLevel, { bg: string; text: string; border: string; dot: string }> = {
  none: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  awareness: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  followup: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  evaluation: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  urgent: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

const LEVEL_LABELS: Record<IndicatorLevel, string> = {
  none: "لا توجد ملاحظات",
  awareness: "يحتاج معرفة/مراعاة",
  followup: "يحتاج متابعة",
  evaluation: "يحتاج تقييم مختص",
  urgent: "عاجل / طوارئ",
};

export function getIndicatorColor(level: IndicatorLevel) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.none;
}

export function getIndicatorLabel(level: IndicatorLevel) {
  return LEVEL_LABELS[level] || LEVEL_LABELS.none;
}

/**
 * Calculates the 5 independent indicators from parent observations
 */
export function calculateStudentIndicators(profile: Partial<StudentSupportProfile>): StudentIndicators {
  const now = new Date().toISOString();

  // 1. Health Indicator
  const healthEvidence: string[] = [];
  let healthLevel: IndicatorLevel = "none";

  if (profile.emergencyInfo?.requiresUrgentIntervention === "yes" || profile.allergyDetails?.severity === "severe_emergency" || profile.allergyDetails?.isEmergencyNotice) {
    healthLevel = "urgent";
    healthEvidence.push("توجد مؤشرات طوارئ صحية معلنة تستوجب خطة تدخل عاجل ومتابعة فورية من الإرشاد الصحي.");
    if (profile.allergyDetails?.isEmergencyNotice) {
      healthEvidence.push(`حساسية مصنفة كطارئة (${profile.allergyDetails?.types?.join("، ") || "حساسية غير محددة"}).`);
    }
  } else if (profile.hasChronicCondition === "yes") {
    healthLevel = "awareness";
    const conditions = profile.conditionTypes || [];
    if (conditions.length > 0) {
      healthEvidence.push(`حالة صحية مستمرة أو مزمنة: ${conditions.join("، ")}.`);
    }
    const impacts = profile.schoolImpacts || [];
    if (impacts.some(i => i.includes("النشاط البدني") || i.includes("الاختبارات") || i.includes("الجلوس"))) {
      healthLevel = "followup";
      healthEvidence.push(`الحالة تؤثر على الجوانب المدرسية: ${impacts.join("، ")}.`);
    }
    if (profile.medicationDetails?.neededDuringSchool === "yes" || profile.medicationDetails?.hasEmergencyMedication === "yes") {
      healthLevel = "followup";
      healthEvidence.push("يتطلب دواءً أو دواء طوارئ أثناء الدوام المدرسي.");
    }
  } else if (profile.hasAllergies === "yes") {
    healthLevel = "awareness";
    healthEvidence.push(`لدى الطالب حساسية: ${(profile.allergyDetails?.types || []).join("، ")}.`);
  }

  // 2. Learning Indicator
  const learningEvidence: string[] = [];
  let learningLevel: IndicatorLevel = "none";

  const diffs = profile.learningDifficulties || [];
  if (diffs.length >= 4) {
    learningLevel = "evaluation";
    learningEvidence.push(`ملاحظة ولي الأمر لصعوبات متعددة في: ${diffs.join("، ")}.`);
  } else if (diffs.length >= 2) {
    learningLevel = "followup";
    learningEvidence.push(`ملاحظة ولي الأمر لصعوبات في: ${diffs.join("، ")}.`);
  } else if (diffs.length === 1) {
    learningLevel = "awareness";
    learningEvidence.push(`ملاحظة ولي الأمر لصعوبة في: ${diffs[0]}.`);
  }

  const strategies = profile.helpfulLearningStrategies || [];
  if (strategies.length > 0) {
    learningEvidence.push(`الأساليب المفضلة للدعم الصفي: ${strategies.join("، ")}.`);
  }

  // 3. Social Indicator
  const socialEvidence: string[] = [];
  let socialLevel: IndicatorLevel = "none";

  const negExp = profile.negativeExperiences || [];
  const peerQuality = profile.peerRelationshipQuality;

  if (negExp.some(e => e.includes("تنمر") || e.includes("مضايقات"))) {
    socialLevel = "followup";
    socialEvidence.push(`إفادة ولي الأمر بذكر الطالب لتعرضه لـ (${negExp.filter(e => !e.includes("لا شيء")).join("، ")}).`);
  }

  if (peerQuality === "struggles") {
    socialLevel = socialLevel === "followup" ? "evaluation" : "followup";
    socialEvidence.push("يواجه صعوبة في التفاعل وتكوين العلاقات مع الزملاء.");
  } else if (peerQuality === "needs_support") {
    if (socialLevel === "none") socialLevel = "awareness";
    socialEvidence.push("يحتاج إلى دعم وتشجيع في بناء العلاقات الاجتماعية المدرسية.");
  }

  if (negExp.some(e => e.includes("عزلة اجتماعية"))) {
    if (socialLevel === "none" || socialLevel === "awareness") socialLevel = "followup";
    socialEvidence.push("ملاحظة ميل نحو العزلة الاجتماعية في المدرسة.");
  }

  // 4. Wellbeing Indicator (مؤشرات سلوكية وملاحظات - دون تشخيص)
  const wellbeingEvidence: string[] = [];
  let wellbeingLevel: IndicatorLevel = "none";

  const obs = profile.emotionalObservations || ({} as any);
  let frequentCount = 0;
  let sometimesCount = 0;

  const fieldLabels: Record<string, string> = {
    isolation: "الانعزال",
    anxiety: "القلق",
    irritability: "سرعة الانفعال",
    sleepDisturbance: "اضطراب النوم",
    appetiteChange: "تغير الشهية",
    concentrationDifficulty: "صعوبة التركيز",
    lowMotivation: "انخفاض الدافعية",
    lossOfInterest: "فقدان الاهتمام",
    fatigueComplaints: "كثرة الشكوى من التعب",
  };

  const notedFrequent: string[] = [];
  const notedSometimes: string[] = [];

  Object.entries(obs).forEach(([key, val]) => {
    const label = fieldLabels[key] || key;
    if (val === "frequent") {
      frequentCount++;
      notedFrequent.push(label);
    } else if (val === "sometimes") {
      sometimesCount++;
      notedSometimes.push(label);
    }
  });

  if (frequentCount >= 3) {
    wellbeingLevel = "evaluation";
    wellbeingEvidence.push(`ملاحظة تكرار عالٍ في: ${notedFrequent.join("، ")}. يوصى بجلسة استكشافية مع المرشد الطلابي.`);
  } else if (frequentCount >= 1 || sometimesCount >= 3) {
    wellbeingLevel = "followup";
    if (notedFrequent.length > 0) wellbeingEvidence.push(`ملاحظات متكررة في: ${notedFrequent.join("، ")}.`);
    if (notedSometimes.length > 0) wellbeingEvidence.push(`ملاحظات تظهر أحياناً في: ${notedSometimes.join("، ")}.`);
  } else if (sometimesCount > 0) {
    wellbeingLevel = "awareness";
    wellbeingEvidence.push(`ملاحظات عابرة تظهر أحياناً في: ${notedSometimes.join("، ")}.`);
  }

  // Family circumstances impact
  if (profile.hasFamilyCircumstances === "yes" || profile.hasFamilyCircumstances === "prefer_counselor_private") {
    if (wellbeingLevel === "none") wellbeingLevel = "awareness";
    wellbeingEvidence.push("توجد ظروف أسرية أو اجتماعية راهنة قد تؤثر على حضور أو تركيز الطالب، يراعى تقديم الدعم.");
  }

  // 5. Behavior Indicator
  const behaviorEvidence: string[] = [];
  let behaviorLevel: IndicatorLevel = "none";

  const beh = profile.behaviorDifficulties || ({} as any);
  let studyAffectCount = 0;
  let behFrequentCount = 0;

  const behLabels: Record<string, string> = {
    followingInstructions: "الالتزام بالتعليمات",
    emotionalRegulation: "ضبط الانفعال",
    peerInteraction: "التعامل مع الزملاء",
    waitingTurn: "الانتظار",
    focus: "التركيز",
    completingTasks: "إكمال المهام",
    activityTransitions: "الانتقال بين الأنشطة",
    expressingNeeds: "التعبير عن الاحتياجات",
    handlingCriticism: "التعامل مع النقد",
    handlingChange: "التعامل مع التغيير",
  };

  const notedStudyAffect: string[] = [];
  const notedBehFrequent: string[] = [];

  Object.entries(beh).forEach(([key, val]) => {
    const label = behLabels[key] || key;
    if (val === "affects_study") {
      studyAffectCount++;
      notedStudyAffect.push(label);
    } else if (val === "frequent") {
      behFrequentCount++;
      notedBehFrequent.push(label);
    }
  });

  if (studyAffectCount >= 2) {
    behaviorLevel = "evaluation";
    behaviorEvidence.push(`صعوبات سلوكية تؤثر على التحصيل الدراسي في: ${notedStudyAffect.join("، ")}.`);
  } else if (studyAffectCount === 1 || behFrequentCount >= 2) {
    behaviorLevel = "followup";
    if (notedStudyAffect.length > 0) behaviorEvidence.push(`ملاحظات تؤثر على الدراسة في: ${notedStudyAffect.join("، ")}.`);
    if (notedBehFrequent.length > 0) behaviorEvidence.push(`ملاحظات متكررة في: ${notedBehFrequent.join("، ")}.`);
  } else if (behFrequentCount === 1) {
    behaviorLevel = "awareness";
    behaviorEvidence.push(`ملاحظة تكرار في: ${notedBehFrequent.join("، ")}.`);
  }

  return {
    health: {
      level: healthLevel,
      label: getIndicatorLabel(healthLevel),
      evidence: healthEvidence.length > 0 ? healthEvidence : ["لا توجد ملاحظات صحية مسجلة تتطلب تدخلاً."],
      updatedAt: now,
    },
    learning: {
      level: learningLevel,
      label: getIndicatorLabel(learningLevel),
      evidence: learningEvidence.length > 0 ? learningEvidence : ["لا توجد صعوبات تعليمية مسجلة من ولي الأمر."],
      updatedAt: now,
    },
    social: {
      level: socialLevel,
      label: getIndicatorLabel(socialLevel),
      evidence: socialEvidence.length > 0 ? socialEvidence : ["العلاقات الاجتماعية والتفاعل مع الزملاء ضمن المعدل الطبيعي."],
      updatedAt: now,
    },
    wellbeing: {
      level: wellbeingLevel,
      label: getIndicatorLabel(wellbeingLevel),
      evidence: wellbeingEvidence.length > 0 ? wellbeingEvidence : ["لا توجد مؤشرات انفعالية أو نفسية تستدعي المتابعة الخاصة."],
      updatedAt: now,
    },
    behavior: {
      level: behaviorLevel,
      label: getIndicatorLabel(behaviorLevel),
      evidence: behaviorEvidence.length > 0 ? behaviorEvidence : ["السلوك والانضباط المدرسي منتظم ولا توجد معوقات ملحوظة."],
      updatedAt: now,
    },
  };
}

/**
 * Calculates overall priority from the 5 indicators
 */
export function calculateOverallPriority(indicators: StudentIndicators): "low" | "medium" | "high" | "urgent" {
  const levels = [
    indicators.health.level,
    indicators.learning.level,
    indicators.social.level,
    indicators.wellbeing.level,
    indicators.behavior.level,
  ];

  if (levels.includes("urgent")) return "urgent";
  if (levels.includes("evaluation")) return "high";
  if (levels.includes("followup")) return "medium";
  return "low";
}

/**
 * Generates practical, actionable recommendations for the Teacher Support Card
 * (Strictly excludes confidential family/medical secrets!)
 */
export function generateTeacherSupportCard(profile: StudentSupportProfile) {
  const tips: string[] = [];

  // Strategies from Learning & What Helps
  const strategies = profile.helpfulLearningStrategies || [];
  const preferences = profile.supportPreferences || [];
  const combined = Array.from(new Set([...strategies, ...preferences]));

  combined.forEach(item => {
    if (item.includes("الهدوء")) tips.push("توفير بيئة صفية هادئة تقلل من المشتتات الصوتية.");
    if (item.includes("تعليمات قصيرة") || item.includes("واضحة ومختصرة")) tips.push("صياغة التعليمات والمهام بعبارات قصيرة ومباشرة خطوة بخطوة.");
    if (item.includes("التكرار")) tips.push("تكرار المفاهيم الأساسية والتأكد من استيعابه قبل الانتقال للنقطة التالية.");
    if (item.includes("الصور والأمثلة")) tips.push("الاعتماد على الوسائل البصرية والرسوم التوضيحية والأمثلة العملية.");
    if (item.includes("وقت إضافي")) tips.push("منحه وقتاً إضافياً مرناً لإكمال المهام الكتابية أو الاختبارات القصيرة.");
    if (item.includes("تقسيم المهمة")) tips.push("تجزئة الواجبات والأنشطة إلى مراحل صغيرة يسهل إنجازها تباعاً.");
    if (item.includes("بالقرب من المعلم")) tips.push("اختيار موقع جلوس مناسب في الصف بالقرب من المعلم لتسهيل المتابعة المباشرة.");
    if (item.includes("التعزيز الإيجابي") || item.includes("التشجيع")) tips.push("الاستمرار في التعزيز الإيجابي اللفظي والتحفيز الفوري عند إتمام المهام.");
    if (item.includes("تغيير الروتين")) tips.push("تنبيه الطالب مسبقاً وبشكل هادئ قبل تغيير موعد الحصة أو نمط النشاط.");
    if (item.includes("عدم التحدث أمام الآخرين بشكل مفاجئ")) tips.push("تجنب مطالبته بالإجابة أو القراءة أمام الصف بشكل مفاجئ دون تمهيد.");
  });

  if (tips.length === 0) {
    tips.push("التشجيع والتعزيز الإيجابي ومراعاة وتيرة الفهم الفردية.");
  }

  // Safe Classroom Health Notice
  let classroomHealthAlert: { hasAlert: boolean; message: string; severity: "info" | "warning" | "urgent" } = {
    hasAlert: false,
    message: "لا توجد تنبيهات صحية صفية خاصة.",
    severity: "info",
  };

  if (profile.emergencyInfo?.requiresUrgentIntervention === "yes" || profile.allergyDetails?.isEmergencyNotice) {
    classroomHealthAlert = {
      hasAlert: true,
      message: `تنبيه هام للطوارئ: الطالب لديه حالة صحية/حساسية تتطلب الانتباه السريع. في حال ملاحظة أي إعياء، يرجى التوجه فوراً للمرشد الصحي أو إدارة المدرسة (${profile.allergyDetails?.types?.join("، ") || "حساسية طارئة"}).`,
      severity: "urgent",
    };
  } else if (profile.hasChronicCondition === "yes") {
    const impacts = profile.schoolImpacts || [];
    const condition = (profile.conditionTypes || []).join("، ");
    const impactText = impacts.length > 0 ? ` (تؤثر على: ${impacts.join("، ")})` : "";
    classroomHealthAlert = {
      hasAlert: true,
      message: `مراعاة صحية صفية: الطالب لديه حالة متابعة (${condition})${impactText}. يرجى مراعاة ذلك في الأنشطة الصفية والبدنية.`,
      severity: "warning",
    };
  }

  // Social & Peer notes
  let socialNotice = "التفاعل الصفي مع الزملاء ضمن المعدل الطبيعي.";
  if (profile.indicators?.social?.level === "followup" || profile.indicators?.social?.level === "evaluation") {
    socialNotice = "يحتاج إلى دعم في الاندماج الصفي، وملاحظة تفاعله أثناء العمل الجماعي لتجنب أي انعزال.";
  }

  return {
    studentName: profile.studentName,
    grade: profile.grade || "ثانوي",
    className: profile.className || "عام",
    overallLevel: profile.overallPriority,
    classroomTips: tips,
    healthAlert: classroomHealthAlert,
    socialNotice,
    hasCounselorDetails: profile.hasConfidentialNote === "yes" || profile.hasFamilyCircumstances === "prefer_counselor_private" || profile.indicators?.wellbeing?.level !== "none",
  };
}
