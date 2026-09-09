export interface Student {
  id: string;
  name?: string;
  phone?: string;
  className?: string;
  grade?: string;
  notes?: string;
  [key: string]: any; // Allow other Excel columns dynamically
}

export interface WhatsAppConfig {
  mode: "simulated" | "real" | "cloud_api";
  simulatedStatus: "disconnected" | "qr_ready" | "connecting" | "connected";
  simulatedPhone: string;
  hasCloudApiKey: boolean;
  cloudPhoneId: string;
  cloudAccountId: string;
}

export interface CampaignLog {
  id: string;
  studentName: string;
  phone: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  total: number;
  sent: number;
  failed: number;
  status: "idle" | "running" | "completed" | "paused";
  startTime: string | null;
  endTime: string | null;
  restBreakUntil?: number | null;
  logs?: CampaignLog[];
}

export interface ReportItem {
  id: string;
  studentName: string;
  phone: string;
  grade?: string;
  className?: string;
  message: string;
  status: "pending" | "sending" | "success" | "failed";
  timestamp: string;
  campaignId?: string;
  campaignName?: string;
  type: "campaign" | "individual";
  error?: string;
}

export interface ReportFilterState {
  dateMode: "all" | "today" | "yesterday" | "last7days" | "last30days" | "specific_date" | "range";
  specificDate: string;
  startDate: string;
  endDate: string;
  grade: string;
  className: string;
  studentSearch: string;
  status: "all" | "success" | "failed";
  sourceType: "all" | "campaign" | "individual";
}

export interface SchoolSignatories {
  countryName?: string;
  ministryName?: string;
  administrationName?: string;
  schoolName?: string;
  principalName: string;
  vicePrincipalName: string;
  counselorName: string;
  systemManagerName?: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  showStudentGuidanceLine?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  phone?: string;
  grade?: string;
  className?: string;
  date: string; // YYYY-MM-DD
  status: "present" | "absent_unexcused" | "absent_excused" | "tardy";
  tardyMinutes?: number;
  notes?: string;
  notified?: boolean;
  notifiedAt?: string;
  timestamp: string;
}

export interface DailyAttendanceSummary {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentUnexcusedCount: number;
  absentExcusedCount: number;
  tardyCount: number;
}

export interface ReportPrintOptions {
  messageDisplayMode: "header_summary" | "table_column" | "both" | "hidden";
  tableFontSize: "normal" | "compact" | "ultra_compact";
  removeBlankLines: boolean;
  showSignatures: boolean;
  showStatsBox: boolean;
  showSentMessageInTable?: boolean;
}

// Noor System Student Absence Record
export interface NoorStudentAbsence {
  id: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  className?: string;
  track?: string; // e.g. السنة المشتركة / مسارات
  phone?: string;
  // Excused absence count and specific dates from Noor
  excusedDaysCount: number;
  excusedDates: string[]; // e.g. ["1447/08/10", "1447/08/15", ...]
  // Unexcused absence count and specific dates from Noor
  unexcusedDaysCount: number;
  unexcusedDates: string[]; // e.g. ["1447/08/12", "1447/08/14", ...]
  // Absence percentage or total rate from Noor report (نسبة غياب الطالب)
  absenceRate?: string | number;
  // Tardiness count
  tardyCount?: number;
  lastUpdated?: string;
  source?: "noor_tool" | "manual" | "excel_import";
  notes?: string;
}

// Guidance & Counseling Procedural Action History
export interface GuidanceStudentAction {
  id: string;
  studentId: string;
  studentName: string;
  absenceType: "excused" | "unexcused";
  threshold: "3_days" | "5_days" | "10_days";
  actionType: "learning_plan" | "case_study" | "parent_whatsapp" | "committee_meeting" | "principal_referral" | "child_protection_escalation";
  title: string;
  details?: string;
  generatedDocumentType?: "learning_plan" | "case_study" | "committee_minutes" | "principal_referral";
  generatedDocumentContent?: string;
  whatsappMessageSent?: string;
  whatsappSentAt?: string;
  createdAt: string;
  status: "completed" | "pending";
}

// Guidance Committee Member
export interface GuidanceCommitteeMember {
  role: string;
  name: string;
}

// User Authentication & Management Types
export interface AppUser {
  id: string;
  name: string; // اسم الشخص / المعلم / الموظف
  username: string; // اسم المستخدم
  password: string; // كلمة المرور
  role: "admin" | "user"; // مدير نظام أو مستخدم
  phone?: string; // رقم الجوال لإرسال بيانات الدخول
  status: "active" | "blocked"; // مفعل أو محظور
  createdAt: string;
  lastLogin?: string;
  notes?: string;
  masterPin?: string; // رمز أمان الطوارئ السري لاستعادة الحساب
}

export interface AuthSession {
  user: AppUser;
  token?: string;
  loginAt: string;
}

// ----------------------------------------------------
// Teacher & Schedule Management Types (بيانات المعلمين والجدول المدرسي)
// ----------------------------------------------------
export interface Teacher {
  id: string;
  name: string; // الاسم الرباعي للمعلم
  phone: string; // رقم الجوال (9665xxxxxxxx أو 05xxxxxxxx)
  subject?: string; // مجال التدريس / المادة
  subjectSpecialty?: string; // مجال التدريس (مثل: الحاسب الآلي، فيزياء، اللغة العربية...)
  specialty?: string; // التخصص
  nationalId?: string; // رقم الهوية الوطنية
  notes?: string;
  isArchived?: boolean; // تم حفظه وأرشفته تلقائياً عند تحديث كشف المعلمين لحفظ كامل سجلاته
  archivedAt?: string;
  archivedReason?: string;
}

export interface ScheduleAssignment {
  id: string;
  teacherId?: string;
  teacherName: string; // اسم المعلم
  teacherPhone?: string;
  subject: string; // اسم المادة (مثل: الفيزياء 2، الكيمياء 1، الكفايات اللغوية 1...)
  section: string; // رقم الشعبة أو اسم الفصل (مثل: "شعبة 1" أو "1" أو "شعبة 5")
  grade?: string; // الصف الدراسي إن وجد
  day?: string; // اليوم (الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس)
  period?: number | string; // الحصة (1 إلى 7)
}

// ----------------------------------------------------
// Student Inquiry & Teacher Evaluation Types (الاستعلام عن طالب وتقييم المعلمين)
// ----------------------------------------------------
export type EvaluationRating = "ممتاز" | "جيد جداً" | "جيد" | "مقبول" | "ضعيف";

export interface StudentEvaluationItem {
  studentId: string;
  studentName: string;
  grade?: string;
  className?: string; // الشعبة
  nationalId?: string;

  // 1. التحصيل الدراسي (إلزامي) + ملاحظات (اختياري)
  academicAchievement: EvaluationRating;
  academicLevel?: EvaluationRating;
  academicNotes?: string;

  // 2. الانضباط والالتزام (إلزامي) + ملاحظات (اختياري)
  disciplineAndCommitment: EvaluationRating;
  disciplineLevel?: EvaluationRating;
  disciplineNotes?: string;

  // 3. السلوك والأخلاق (إلزامي) + ملاحظات (اختياري)
  behaviorAndEthics: EvaluationRating;
  behaviorLevel?: EvaluationRating;
  behaviorNotes?: string;

  // 4. المشاركة والتفاعل (إلزامي) + ملاحظات (اختياري)
  participationAndInteraction: EvaluationRating;
  participationLevel?: EvaluationRating;
  participationNotes?: string;

  // توصية أو ملاحظة عامة إضافية من المعلم (اختياري)
  generalRecommendation?: string;
  teacherNotes?: string;

  // وقت التقييم
  evaluatedAt?: string;
}

export interface TeacherInquiryRequest {
  id: string; // معرف فريد للاستعلام e.g. "inq_1725150000_abc"
  accessCode: string; // رمز دخول وتفعيل رقمي فريد e.g. "482910"
  teacherId?: string;
  teacherName: string;
  teacherPhone: string;
  subject: string; // المادة المسندة
  section: string; // الشعبة المستعلم عنها
  grade?: string; // الصف
  schoolName?: string;
  
  // الطلاب المستعلم عنهم
  students: {
    id: string;
    name: string;
    grade?: string;
    className?: string;
    nationalId?: string;
  }[];

  // حالة الاستعلام
  status: "pending" | "opened" | "completed" | "failed";
  whatsappStatus?: "pending" | "success" | "failed";
  whatsappError?: string;
  sentAt: string;
  createdAt?: string;
  openedAt?: string;
  completedAt?: string;

  // تقييمات المعلم بعد تعبئتها
  evaluations?: StudentEvaluationItem[];

  // هل التقييم موثق برمز التفعيل
  isVerified: boolean;
}

/**
 * Types and interfaces for Parent Councils (مجالس أولياء الأمور في التعليم العام)
 * ضوابط العضوية، استمارة الترشيح، الفرز الآلي، وتوليد الاستمارة الرسمية
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
  isParentOrStaff: boolean; // 1. ولي أمر لطالب أو أكثر مسجل بالمدرسة أو عضو هيئة تعليمية
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
  studentName: string; // اسم الطالب
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
  assignedRole?: "رئيس المجلس" | "نائب الرئيس" | "أمين السر" | "عضو مجلس" | "عضو احتياط" | string;
  smartEvaluation?: SmartEvaluationResult;
  adminNotes?: string;
  isManuallySelected?: boolean;
  isManuallyExcluded?: boolean;
  inviteSentAt?: string;
  inviteStatus?: "not_sent" | "sent" | "failed";
}

export interface ParentCouncilVote {
  id: string;
  studentId: string;
  studentName?: string;
  guardianPhone?: string;
  token?: string;
  selectedCandidateIds: string[]; // المعرفات الخاصة بالمرشحين الذين صوت لهم ولي الأمر
  votedAt: string;
  codeUsed?: string;
}

export interface ParentCouncilVotingConfig {
  isActive: boolean; // هل التصويت مفتوح حالياً
  candidateIds: string[]; // قائمة معرفات المرشحين في ورقة الاقتراع
  maxVotesPerParent: number; // الحد الأقصى للمرشحين الذين يمكن لولي الأمر اختيارهم (افتراضياً 9)
  createdAt?: string;
  closedAt?: string;
  messageTemplate?: string;
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
  isSurveyClosed?: boolean; // هل الاستبيان مغلق بقرار الإدارة
  surveyClosedMessage?: string;
  votingConfig?: ParentCouncilVotingConfig;
}

export interface ParentCouncilInvite {
  studentId: string;
  studentName: string;
  studentGrade: string;
  studentClass: string;
  guardianPhone: string;
  guardianName?: string;
  code: string;
  token: string;
  isSent?: boolean;
  sentAt?: string;
  createdAt?: string;
  hasOpened?: boolean;
  openedAt?: string;
  lastOpenedAt?: string;
  openCount?: number;
  isSubmitted?: boolean;
  submittedAt?: string;
  applicationId?: string;
}

/**
 * خوارزمية الفرز الآلي والتقييم النظامي لطلبات مجالس أولياء الأمور
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
/**
 * Types and interfaces for Student Needs Survey
 * نظام الرصد الذكي للحالات الاجتماعية والصحية ودعم الطالب
 */

export type SurveyPriorityLevel = "low" | "medium" | "high" | "urgent";

export type SurveyCategory =
  | "academic"
  | "social"
  | "behavioral"
  | "health"
  | "family"
  | "attendance"
  | "temporary"
  | "general";

export type SurveyStatus =
  | "not_sent"
  | "sent"
  | "new_submission"
  | "under_review"
  | "in_progress"
  | "stable"
  | "closed";

export interface SurveyResponses {
  // 1. الوضع العام للطالب
  generalStatus: "very_stable" | "stable" | "some_changes" | "noticeable_changes" | "needs_attention";
  recentChanges: string[]; // التحصيل الدراسي، النوم، الشهية، المزاج، الحضور، العلاقات الاجتماعية، السلوك، لا يوجد تغير ملحوظ

  // 2. الجانب الدراسي
  academicDifficulties: "none" | "simple" | "moderate" | "significant";
  academicNeeds: string[]; // تشجيع وتحفيز، تنظيم الوقت، متابعة دراسية، دعم في مادة معينة، تحسين التركيز، لا توجد حاجة محددة، أخرى
  academicNeedsOther?: string;

  // 3. الجانب الاجتماعي والسلوكي
  socialRelationships: "very_good" | "good" | "acceptable" | "some_difficulties" | "noticeable_difficulties";
  recentImpactingEvent: "no" | "yes" | "prefer_not_to_say";
  impactingEventNeedsContact?: "yes" | "no" | "not_sure";
  behaviorsToMonitor: "no" | "yes_simple" | "yes_needs_followup";

  // 4. الجانب الصحي (خصوصية مشددة)
  hasHealthInfo: "no" | "yes_counselor_only" | "yes_general_teachers";
  healthNeedType?: string[]; // احتياج متعلق بالحضور أو النشاط، احتياج متعلق بالتعامل أثناء اليوم الدراسي، احتياج طارئ يجب مراعاته، احتياج مؤقت، أخرى
  healthNeedTypeOther?: string;
  healthInstructions?: string;

  // 5. الدعم المطلوب والملاحظات
  schoolSupportExpected: string[]; // متابعة الطالب، دعم تربوي، متابعة دراسية، تواصل مع ولي الأمر، مراعاة ظروف معينة، لقاء مع الموجه الطلابي، لا يحتاج إلى إجراء حالياً، أخرى
  schoolSupportOther?: string;
  additionalNotes?: string;
}

export interface IndicatorExplanation {
  category: SurveyCategory;
  categoryLabel: string;
  reasons: string[];
  severity: SurveyPriorityLevel;
}

export interface CaseAction {
  id: string;
  actionDate: string;
  actionType:
    | "review_survey"
    | "contact_guardian"
    | "interview_student"
    | "counselor_note"
    | "teacher_guidance_issued"
    | "schedule_followup"
    | "case_stabilized"
    | "case_closed";
  actionLabel: string;
  performedBy: string;
  notes?: string;
}

export interface TeacherGuidanceCard {
  studentName: string;
  grade?: string;
  className?: string;
  attentionLevel: "routine" | "needs_attention" | "high_care";
  whatStudentNeeds: string[];
  whatToAvoid: string[];
  whatToObserve: string[];
  isApprovedByCounselor: boolean;
  approvedAt?: string;
  approvedBy?: string;
  customGuidanceNote?: string;
}

export interface StudentNeedsProfile {
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  className?: string;
  guardianName?: string;
  guardianPhone?: string;

  // Activation & Security
  activationToken: string;
  activationCode: string; // 6-digit numeric PIN
  isActivated: boolean;
  activatedAt?: string;
  lastUpdatedAt?: string;
  submissionCount: number;

  // Status & Progress
  status: SurveyStatus;
  responses?: SurveyResponses;

  // Smart Engine Outputs
  overallPriority: SurveyPriorityLevel;
  primaryCategories: SurveyCategory[];
  indicatorExplanations: IndicatorExplanation[];
  smartSummary: string;
  smartRecommendations: string[];
  teacherGuidance: TeacherGuidanceCard;

  // Actions & Audit
  actions: CaseAction[];
  counselorPrivateNotes?: string;
  nextFollowUpDate?: string;

  // Dispatch Log
  lastInviteSentAt?: string;
  inviteStatus?: "pending" | "sent" | "failed";
}

export interface SurveyAuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  studentId: string;
  studentName: string;
  action: "view_sensitive" | "edit_profile" | "approve_guidance" | "add_action" | "export";
  details: string;
}
/**
 * Student Support & Health Tracker Types
 * نظام ملف دعم الطالب والمتابعة الصحية الشاملة
 */

export type IndicatorLevel = "none" | "awareness" | "followup" | "evaluation" | "urgent";

export interface IndicatorData {
  level: IndicatorLevel;
  label: string;
  evidence: string[];
  updatedAt: string;
}

export interface StudentIndicators {
  health: IndicatorData;
  learning: IndicatorData;
  social: IndicatorData;
  wellbeing: IndicatorData;
  behavior: IndicatorData;
}

export type GeneralResponseChoice = "yes" | "no" | "unknown" | "prefer_not_to_answer";
export type FrequencyChoice = "none" | "sometimes" | "frequent" | "unknown" | "prefer_not_to_answer";
export type BehaviorChoice = "none" | "sometimes" | "frequent" | "affects_study" | "unknown";

export interface StudentSupportProfile {
  studentId: string;
  studentName: string;
  nationalId?: string;
  grade?: string;
  className?: string;
  birthDate?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  
  // Security & Token Access
  activationToken: string;
  activatedPhone?: string; // الهاتف الموثق الذي ادخل التفعيل لأول مرة
  isActivated: boolean;
  activatedAt?: string;
  lastUpdatedAt?: string;
  completionPercentage: number;
  status: "not_started" | "in_progress" | "completed" | "needs_review";
  needsReviewReason?: string;
  expiresAt?: string; // تاريخ انتهاء الصلاحية للمراجعة الدورية

  // 1. Basic Info
  basicInfoConfirmed: boolean;

  // 2. Physical Health
  hasChronicCondition: GeneralResponseChoice;
  conditionTypes: string[]; // الربو، السكري، الحساسية، الصرع، أمراض القلب، مشاكل التنفس، مشاكل النظر، مشاكل السمع، حالة صحية مؤقتة، حالة أخرى
  conditionOther?: string;
  schoolImpacts: string[]; // النشاط البدني، التركيز، الحضور، المشاركة في الأنشطة، تناول الطعام، الجلوس لفترات طويلة، الاختبارات، لا تؤثر حالياً، أخرى
  schoolImpactOther?: string;
  schoolHealthNotes?: string;

  // 3. Medications, Allergies & Emergency
  takesRegularMedication: GeneralResponseChoice;
  medicationDetails?: {
    name: string;
    reason: string;
    timing: string;
    neededDuringSchool: "yes" | "no" | "unknown";
    hasEmergencyMedication: "yes" | "no";
    medicationLocation: string;
    schoolInstructions: string;
  };
  hasAllergies: GeneralResponseChoice;
  allergyDetails?: {
    types: string[]; // غذائية، دوائية، حشرات، بيئية، جلدية، أخرى
    severity: "mild" | "moderate" | "severe_emergency" | "unknown";
    previousSymptoms: string;
    schoolAction: string;
    isEmergencyNotice: boolean; // Emergency Flag
  };
  emergencyInfo?: {
    requiresUrgentIntervention: "yes" | "no" | "unknown";
    warningSigns: string;
    initialEmergencyAction: string;
    hasEmergencyMedication: "yes" | "no";
    medicationLocation: string;
    primaryContact: { name: string; relationship: string; phone: string };
    secondaryContact: { name: string; relationship: string; phone: string };
  };

  // 4. Emotional & Wellbeing (ملاحظات سلوكية غير تشخيصية)
  emotionalObservations: {
    isolation: FrequencyChoice; // الانعزال
    anxiety: FrequencyChoice; // القلق
    irritability: FrequencyChoice; // سرعة الانفعال
    sleepDisturbance: FrequencyChoice; // اضطراب النوم
    appetiteChange: FrequencyChoice; // تغير الشهية
    concentrationDifficulty: FrequencyChoice; // صعوبة التركيز
    lowMotivation: FrequencyChoice; // انخفاض الدافعية
    lossOfInterest: FrequencyChoice; // فقدان الاهتمام
    fatigueComplaints: FrequencyChoice; // كثرة الشكوى من التعب
  };

  // 5. Behavior
  behaviorDifficulties: {
    followingInstructions: BehaviorChoice; // الالتزام بالتعليمات
    emotionalRegulation: BehaviorChoice; // ضبط الانفعال
    peerInteraction: BehaviorChoice; // التعامل مع الزملاء
    waitingTurn: BehaviorChoice; // الانتظار
    focus: BehaviorChoice; // التركيز
    completingTasks: BehaviorChoice; // إكمال المهام
    activityTransitions: BehaviorChoice; // الانتقال بين الأنشطة
    expressingNeeds: BehaviorChoice; // التعبير عن الاحتياجات
    handlingCriticism: BehaviorChoice; // التعامل مع النقد
    handlingChange: BehaviorChoice; // التعامل مع التغيير
  };

  // 6. Learning Needs & Strategies
  learningDifficulties: string[]; // القراءة، الكتابة، الحساب، التركيز، الحفظ، فهم التعليمات، تنظيم الوقت، الواجبات، الاختبارات
  helpfulLearningStrategies: string[]; // الهدوء، تعليمات قصيرة، التكرار، الصور والأمثلة، وقت إضافي، تقسيم المهمة إلى خطوات، الجلوس بالقرب من المعلم، العمل الفردي، العمل الجماعي، التعزيز الإيجابي، أخرى
  helpfulLearningOther?: string;

  // 7. Family & Social Circumstances
  hasFamilyCircumstances: "yes" | "no" | "unknown" | "prefer_counselor_private";
  circumstanceTypes?: string[];
  circumstanceDetails?: string;

  // 8. Confidential Counselor Note (visibility = COUNSELOR_ONLY)
  hasConfidentialNote: "yes" | "no";
  confidentialNote?: string;

  // 9. Peer & Social Relations
  peerRelationshipQuality: "very_good" | "good" | "needs_support" | "struggles" | "unknown";
  negativeExperiences: string[]; // تنمر، عزلة اجتماعية، خلافات متكررة، مضايقات إلكترونية، لا شيء، لا أعلم، أفضل عدم الإجابة

  // 10. Support Preferences & One Thing
  supportPreferences: string[];
  supportPreferencesOther?: string;
  oneThingSchoolShouldKnow?: string;

  // 11. Privacy & Audit
  privacyConsentAccepted: boolean;
  privacyConsentAcceptedAt?: string;
  source: "guardian" | "school_update";
  
  // Historical updates timeline
  timeline: {
    id: string;
    date: string;
    author: string;
    summary: string;
    changedSections: string[];
  }[];

  // Calculated Indicators
  indicators: StudentIndicators;
  overallPriority: "low" | "medium" | "high" | "urgent";

  // Last WhatsApp Invitation
  lastInviteSentAt?: string;
  inviteWhatsAppStatus?: "pending" | "success" | "failed";
}

export interface SupportCaseAction {
  id: string;
  type: 
    | "contacted_guardian"
    | "interviewed_student"
    | "observed_student"
    | "prepared_support_plan"
    | "referred_case"
    | "contacted_teacher"
    | "needs_later_followup"
    | "closed_case";
  label: string;
  performedBy: string;
  timestamp: string;
  notes?: string;
}

export interface SupportCase {
  id: string;
  studentId: string;
  studentName: string;
  grade?: string;
  className?: string;
  domain: "health" | "learning" | "social" | "wellbeing" | "behavior" | "general";
  reason: string;
  priority: "low" | "medium" | "high" | "urgent";
  openedAt: string;
  assignedTo: string;
  status: "new" | "in_progress" | "needs_action" | "referred" | "stable" | "closed";
  actions: SupportCaseAction[];
  supportPlan?: string;
  nextFollowUpDate?: string;
  notes?: string;
  updatedAt?: string;
}

export interface HealthAuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  studentId?: string;
  studentName?: string;
  dataType: "health" | "confidential_counselor" | "wellbeing" | "full_profile" | "export_print" | "case_management";
  action: "view" | "edit" | "delete" | "export" | "print";
  timestamp: string;
  reason: string;
}

export type SupportRoleView = "parent" | "teacher" | "counselor" | "health_counselor" | "admin" | "super_admin";
