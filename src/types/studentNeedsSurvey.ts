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
