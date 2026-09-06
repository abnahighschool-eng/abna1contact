/**
 * Types and interfaces for Parent Councils (مجالس أولياء الأمور في التعليم العام)
 * ضوابط العضوية، استمارة الترشيح، الفرز الذكي، وتوليد الاستمارة الرسمية
 */

export interface CouncilSkills {
  organizationalManagement: boolean;
  organizationalDetails?: string; // سريعة: الدور التنظيمي/الإداري الممارس
  volunteerExperience: boolean;
  volunteerDetails?: string; // سريعة: جهة أو مجال العمل التطوعي
  reportingAndDoc: boolean;
  reportingDetails?: string; // سريعة: توثيق التقارير والنماذج المستخدمة
  digitalPlatforms: boolean;
  digitalPlatformsDetails?: string; // سريعة: المنصات الرقمية المستخدمة
  previousCommittees: boolean;
  committeeDetails?: string; // سريعة: اللجان المدرسية أو الاجتماعية السابقة
}

export interface CouncilCompliance {
  isParentOrStaff: boolean; // 1. ولي أمر لطالب/طالبة أو أكثر مسجل بالمدرسة أو عضو هيئة تعليمية
  commitmentToAttend: boolean; // 2. الالتزام بحضور اجتماعات المجلس والمشاركة الفاعلة
  notMemberInOtherSchool: boolean; // 3. ألا يجمع بين عضوية مجلسين من مجالس أولياء الأمور
  hasKidsInOtherSchoolsOnlyOneCouncil: boolean; // 5. إذا كان لديه أبناء في أكثر من مدرسة يُسمح بعضوية مجلس مدرسة واحدة
  goodConductAndNoLegalJudgments: boolean; // 6. حسن السيرة والسلوك وعدم صدور أحكام قضائية قطعية
  isEducationalStaff?: boolean; // 4. هل هو عضو هيئة تعليمية داخل المدرسة وولي أمر
}

export interface SmartEvaluationResult {
  isEligible: boolean;
  disqualificationReasons: string[];
  skillsScore: number; // 0 - 40
  goalsScore: number; // 0 - 25
  experienceScore: number; // 0 - 20
  readinessScore: number; // 0 - 15
  overallScore: number; // 0 - 100
  recommendation: "strongly_recommended" | "recommended" | "reserve" | "disqualified";
  summaryReasons: string[];
  suggestedRole?: "رئيس المجلس" | "نائب الرئيس" | "أمين السر" | "عضو مجلس" | "عضو احتياط";
}

export interface ParentCouncilApplication {
  id: string;
  activationCode: string; // 6-digit numeric PIN
  activationToken: string; // URL access token
  studentId?: string;
  studentName: string; // اسم الطالب / الطالبة
  studentGrade: string; // الصف الدراسي
  studentClass?: string; // الشعبة
  fullName: string; // الاسم الرباعي لولي الأمر
  guardianRelation?: "father" | "mother" | "brother" | "guardian" | "other"; // صلة القرابة (الأب، الأم، الأخ، الوكيل...)
  relationLabel?: string; // التسمية المعروضة
  additionalStudents?: Array<{ name: string; grade: string; className?: string }>; // أبناء إضافيون مسجلون بالمدرسة
  nationalId: string; // رقم الهوية الوطنية
  phone: string; // رقم الجوال
  email: string; // البريد الإلكتروني
  skills: CouncilSkills;
  goals: [string, string, string]; // أهدافي من الانضمام للمجلس 1، 2، 3
  compliance: CouncilCompliance;
  pledgeAccepted: boolean;
  signature: string; // الاسم أو التوقيع المعتمد
  submissionDateHijri: string;
  submittedAt: string;
  status: "submitted" | "approved" | "reserve" | "disqualified";
  assignedRole?: "رئيس المجلس" | "نائب الرئيس" | "أمين السر" | "عضو مجلس" | "عضو احتياط";
  smartEvaluation?: SmartEvaluationResult;
  adminNotes?: string;
  isManuallySelected?: boolean;
  isManuallyExcluded?: boolean;
  inviteSentAt?: string;
  inviteStatus?: "not_sent" | "sent" | "failed";
}

export interface ParentCouncilConfig {
  academicYear: string;
  councilTerm: string;
  generalActivationCode: string;
  seatsCount: number; // عدد أعضاء المجلس المطلوبين (مثلاً 7 أو 9)
  reserveSeatsCount: number; // عدد أعضاء الاحتياط (مثلاً 2 أو 3)
  formationApproved: boolean;
  formationApprovedAt?: string;
  selectedMemberIds: string[];
  reserveMemberIds: string[];
}

/**
 * خوارزمية الفرز الذكي والتقييم الآلي لطلبات مجالس أولياء الأمور
 */
export function evaluateParentCouncilApplication(app: Partial<ParentCouncilApplication>): SmartEvaluationResult {
  const disqualificationReasons: string[] = [];
  const comp = app.compliance || {
    isParentOrStaff: false,
    commitmentToAttend: false,
    notMemberInOtherSchool: false,
    hasKidsInOtherSchoolsOnlyOneCouncil: false,
    goodConductAndNoLegalJudgments: false,
  };

  // 1. فحص الشروط الإلزامية للمادة (الثالثة)
  if (!comp.isParentOrStaff) {
    disqualificationReasons.push("المادة 3 (بند 1): المتقدم ليس ولي أمر لطالب مسجل بالمدرسة ولا عضواً بالهيئة التعليمية.");
  }
  if (!comp.commitmentToAttend) {
    disqualificationReasons.push("المادة 3 (بند 2): عدم التعهد بالالتزام بحضور الاجتماعات والمشاركة الفاعلة.");
  }
  if (!comp.notMemberInOtherSchool) {
    disqualificationReasons.push("المادة 3 (بند 3): الجمع بين عضوية مجلسين من مجالس أولياء الأمور بالمدارس.");
  }
  if (!comp.hasKidsInOtherSchoolsOnlyOneCouncil) {
    disqualificationReasons.push("المادة 3 (بند 5): تم قبول عضويته في مجلس مدرسة أخرى هذا العام ولا يجوز الجمع.");
  }
  if (!comp.goodConductAndNoLegalJudgments) {
    disqualificationReasons.push("المادة 3 (بند 6): عدم استيفاء شرط حسن السيرة والسلوك والأحكام القضائية المنصوص عليها.");
  }
  if (!app.pledgeAccepted) {
    disqualificationReasons.push("عدم التوقيع على التعهد النظامي المعتمد للاستمارة.");
  }

  const isEligible = disqualificationReasons.length === 0;

  if (!isEligible) {
    return {
      isEligible: false,
      disqualificationReasons,
      skillsScore: 0,
      goalsScore: 0,
      experienceScore: 0,
      readinessScore: 0,
      overallScore: 0,
      recommendation: "disqualified",
      summaryReasons: ["استبعاد نظامي بموجب المادة (الثالثة) لضوابط العضوية."],
      suggestedRole: undefined,
    };
  }

  // 2. تقييم المهارات المعتمدة والتحقق منها (حتى 40 نقطة)
  let skillsScore = 0;
  const skills = app.skills || {
    organizationalManagement: false,
    volunteerExperience: false,
    reportingAndDoc: false,
    digitalPlatforms: false,
    previousCommittees: false,
  };

  if (skills.organizationalManagement) {
    skillsScore += 8;
    if (skills.organizationalDetails && skills.organizationalDetails.trim().length > 3) {
      skillsScore += 2; // نقاط توثيق إضافية
    }
  }
  if (skills.volunteerExperience) {
    skillsScore += 7;
    if (skills.volunteerDetails && skills.volunteerDetails.trim().length > 3) {
      skillsScore += 2;
    }
  }
  if (skills.reportingAndDoc) {
    skillsScore += 6;
    if (skills.reportingDetails && skills.reportingDetails.trim().length > 3) {
      skillsScore += 2;
    }
  }
  if (skills.digitalPlatforms) {
    skillsScore += 5;
    if (skills.digitalPlatformsDetails && skills.digitalPlatformsDetails.trim().length > 2) {
      skillsScore += 2;
    }
  }
  if (skills.previousCommittees) {
    skillsScore += 4;
    if (skills.committeeDetails && skills.committeeDetails.trim().length > 3) {
      skillsScore += 2;
    }
  }
  skillsScore = Math.min(40, skillsScore);

  // 3. تقييم الأهداف وجدية الطرح (حتى 25 نقطة)
  let goalsScore = 0;
  const goals = app.goals || ["", "", ""];
  goals.forEach((g) => {
    const trimmed = (g || "").trim();
    if (trimmed.length >= 15) {
      goalsScore += 8;
    } else if (trimmed.length >= 5) {
      goalsScore += 5;
    }
  });
  if (goals.filter((g) => (g || "").trim().length > 0).length === 3) {
    goalsScore += 1; // اكتمال الأهداف الثلاثة
  }
  goalsScore = Math.min(25, goalsScore);

  // 4. تقييم الخبرة والتنوع التنظيمي (حتى 20 نقطة)
  let experienceScore = 0;
  if (skills.previousCommittees && skills.organizationalManagement) {
    experienceScore += 12;
  } else if (skills.previousCommittees || skills.organizationalManagement) {
    experienceScore += 8;
  }
  if (skills.volunteerExperience) {
    experienceScore += 5;
  }
  if (comp.isEducationalStaff) {
    experienceScore += 3; // خبرة تعليمية داخل البيئة المدرسية
  }
  experienceScore = Math.min(20, experienceScore);

  // 5. الجاهزية والالتزام (حتى 15 نقطة)
  let readinessScore = 15;
  if (!app.email || !app.email.includes("@")) {
    readinessScore -= 3;
  }
  if (!app.phone || app.phone.length < 9) {
    readinessScore -= 2;
  }

  const overallScore = Math.min(100, Math.round(skillsScore + goalsScore + experienceScore + readinessScore));

  let recommendation: "strongly_recommended" | "recommended" | "reserve" | "disqualified" = "recommended";
  let suggestedRole: "رئيس المجلس" | "نائب الرئيس" | "أمين السر" | "عضو مجلس" | "عضو احتياط" = "عضو مجلس";

  if (overallScore >= 80) {
    recommendation = "strongly_recommended";
    if (skills.organizationalManagement && skills.previousCommittees) {
      suggestedRole = "نائب الرئيس";
    } else if (skills.reportingAndDoc && skills.digitalPlatforms) {
      suggestedRole = "أمين السر";
    } else {
      suggestedRole = "عضو مجلس";
    }
  } else if (overallScore >= 60) {
    recommendation = "recommended";
    suggestedRole = "عضو مجلس";
  } else {
    recommendation = "reserve";
    suggestedRole = "عضو احتياط";
  }

  const summaryReasons: string[] = [];
  if (skillsScore >= 25) summaryReasons.push("مهارات إدارية وتطوعية عالية ومحققة");
  if (goalsScore >= 18) summaryReasons.push("أهداف نوعية ومحددة لدعم المجتمع المدرسي");
  if (skills.reportingAndDoc) summaryReasons.push("قدرة موثقة على الصياغة والتوثيق");
  if (skills.previousCommittees) summaryReasons.push("خبرة سابقة في المجالس واللجان المدرسية");
  if (summaryReasons.length === 0) summaryReasons.push("استيفاء الشروط النظامية والمشاركة الفاعلة");

  return {
    isEligible: true,
    disqualificationReasons: [],
    skillsScore,
    goalsScore,
    experienceScore,
    readinessScore,
    overallScore,
    recommendation,
    summaryReasons,
    suggestedRole,
  };
}
