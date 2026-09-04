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
