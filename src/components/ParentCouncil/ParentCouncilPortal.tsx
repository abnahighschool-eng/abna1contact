import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Send,
  HelpCircle,
  FileCheck2,
  Sparkles,
  School,
  Lock,
  User,
  Heart,
  Users,
  Award,
  ChevronLeft,
  Printer,
  FileText,
  Building,
  Check,
  Edit3,
  GraduationCap,
} from "lucide-react";
import {
  ParentCouncilApplication,
  CouncilSkills,
  CouncilCompliance,
  evaluateParentCouncilApplication,
} from "../../types";
import { SchoolSignatories, Student } from "../../types";
import { ParentCouncilPrintSheet } from "./ParentCouncilPrintSheets";
import {
  validateNationalId,
  validateSaudiPhone,
  validateEmail,
  formatSaudiPhone,
} from "../../utils/parentCouncilUtils";

interface ParentCouncilPortalProps {
  token?: string | null;
  initialCode?: string | null;
  signatories?: SchoolSignatories;
  students?: Student[];
  onExit?: () => void;
}

// Helper to derive father's full name from student record or student full name
export function deriveFatherFullName(studentFullName: string, studentRecord?: any): string {
  if (studentRecord) {
    if (studentRecord["اسم الأب"] && String(studentRecord["اسم الأب"]).trim()) {
      return String(studentRecord["اسم الأب"]).trim();
    }
    if (studentRecord.fatherName && String(studentRecord.fatherName).trim()) {
      return String(studentRecord.fatherName).trim();
    }
    if (studentRecord["اسم ولي الأمر"] && String(studentRecord["اسم ولي الأمر"]).trim()) {
      return String(studentRecord["اسم ولي الأمر"]).trim();
    }
    if (studentRecord.guardianName && String(studentRecord.guardianName).trim()) {
      return String(studentRecord.guardianName).trim();
    }
    if (studentRecord["ولي الأمر"] && String(studentRecord["ولي الأمر"]).trim()) {
      return String(studentRecord["ولي الأمر"]).trim();
    }
    if (studentRecord.guardian && String(studentRecord.guardian).trim()) {
      return String(studentRecord.guardian).trim();
    }
  }

  const rawName = (studentFullName || "").trim();
  if (!rawName) return "";

  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return rawName;

  // Compound student first names in Arabic (e.g. "عبد الله", "أبو بكر", "سيف الدين", etc.)
  const compoundPrefixes = [
    "عبد", "أبو", "ابو", "سيف", "نور", "ضياء", "علاء", "شمس", "تقي", "جمال", "بدر", "حسام", "محي", "محيي", "صلاح", "شرف", "زين"
  ];

  let skipWords = 1;
  if (parts.length >= 3 && compoundPrefixes.includes(parts[0])) {
    skipWords = 2;
  }

  if (parts.length > skipWords) {
    return parts.slice(skipWords).join(" ");
  }
  return rawName;
}

// Helpers for extracting guardian name & detecting siblings
function extractGuardianFullName(student: any): string {
  return deriveFatherFullName(student?.name || student?.["اسم الطالب"] || "", student);
}

function findStudentSiblings(
  currentStudent: any,
  allStudents: any[]
): Array<{ name: string; grade: string; className?: string }> {
  if (!allStudents || allStudents.length <= 1) return [];
  const currentPhone = (
    currentStudent.phone ||
    currentStudent["رقم الجوال"] ||
    ""
  ).replace(/\D/g, "");
  const currentName = (
    currentStudent.name ||
    currentStudent["اسم الطالب"] ||
    ""
  ).trim();
  const currentParts = currentName.split(/\s+/).filter(Boolean);
  const currentFatherFamily =
    currentParts.length >= 3 ? currentParts.slice(1).join(" ") : "";

  const siblings: Array<{ name: string; grade: string; className?: string }> = [];

  for (const st of allStudents) {
    if (st.id === currentStudent.id) continue;
    const stPhone = (st.phone || st["رقم الجوال"] || "").replace(/\D/g, "");
    const stName = (st.name || st["اسم الطالب"] || "").trim();
    const stParts = stName.split(/\s+/).filter(Boolean);
    const stFatherFamily =
      stParts.length >= 3 ? stParts.slice(1).join(" ") : "";

    let isSibling = false;
    if (
      currentPhone.length >= 8 &&
      stPhone.length >= 8 &&
      currentPhone === stPhone
    ) {
      isSibling = true;
    } else if (
      currentFatherFamily &&
      stFatherFamily &&
      currentFatherFamily === stFatherFamily &&
      currentParts[0] !== stParts[0]
    ) {
      isSibling = true;
    }

    if (isSibling) {
      siblings.push({
        name: stName,
        grade: st.grade || st["الصف"] || "المرحلة الثانوية",
        className: st.className || st["الفصل"] || st["الشعبة"] || "1",
      });
    }
  }

  return siblings;
}

export default function ParentCouncilPortal({
  token,
  initialCode,
  signatories: propSignatories,
  students: propStudents,
  onExit,
}: ParentCouncilPortalProps) {
  // Final session completion & closed state (no returning to main site or login screen)
  const [isPageClosed, setIsPageClosed] = useState(false);
  const isPortalMode = Boolean(
    token ||
    (typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("token") ||
        window.location.pathname.includes("/parent-council")))
  );

  const handleFinalClose = () => {
    setIsPageClosed(true);

    // 1. Mark session as permanently closed so browser cannot re-enter portal
    try {
      sessionStorage.setItem("parent_council_session_closed", "true");
      if (token) {
        localStorage.setItem(`pc_submitted_${token}`, "true");
      }
    } catch (e) {}

    // 2. Lock history so back button cannot return to school or unclosed portal
    try {
      window.history.pushState(null, "", window.location.href);
      window.onpopstate = () => {
        window.history.pushState(null, "", window.location.href);
        try { window.close(); } catch (e) {}
      };
    } catch (e) {}

    // 3. Multi-strategy attempt to close browser window across all platforms (Mobile Safari, Chrome, Desktop, Tablets)
    try {
      window.close();
    } catch (e) {}

    try {
      window.open("", "_self", "");
      window.close();
    } catch (e) {}

    try {
      if ((window as any).opener) {
        (window as any).opener = null;
        window.open("", "_self");
        window.close();
      }
    } catch (e) {}

    try {
      if ((window as any).WeixinJSBridge) {
        (window as any).WeixinJSBridge.call("closeWindow");
      }
    } catch (e) {}

    try {
      if (window.top && window.top !== window) {
        window.top.close();
      }
    } catch (e) {}

    // Secondary delayed attempt for asynchronous mobile browsers
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {}
    }, 200);
  };

  // Verification states - strictly manual entry by guardian
  const [activationCodeInput, setActivationCodeInput] = useState("");
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // School signatories and info
  const [signatories, setSignatories] = useState<SchoolSignatories>(
    propSignatories || {
      countryName: "المملكة العربية السعودية",
      ministryName: "وزارة التعليم",
      administrationName: "الإدارة العامة للتعليم",
      schoolName: "ثانوية الأبناء الأولى",
      principalName: "مدير المدرسة",
      vicePrincipalName: "وكيل المدرسة",
      counselorName: "الموجه الطلابي",
    }
  );

  // Students list for quick lookup if available
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [currentStudentObj, setCurrentStudentObj] = useState<any>(null);

  // Guardian relationship & detected siblings state
  const [guardianRelation, setGuardianRelation] = useState<
    "father" | "mother" | "brother" | "guardian" | "other"
  >("father");
  const [relationLabel, setRelationLabel] = useState<string>("الأب");
  const [isEditingGuardianName, setIsEditingGuardianName] = useState(false);
  const [detectedSiblings, setDetectedSiblings] = useState<
    Array<{ name: string; grade: string; className?: string }>
  >([]);
  const guardianNameInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentGrade, setStudentGrade] = useState("الأول ثانوي");
  const [studentClass, setStudentClass] = useState("1");

  // Skills & Rapid Verification
  const [skills, setSkills] = useState<CouncilSkills>({
    organizationalManagement: false,
    organizationalDetails: "",
    volunteerExperience: false,
    volunteerDetails: "",
    reportingAndDoc: false,
    reportingDetails: "",
    digitalPlatforms: false,
    digitalPlatformsDetails: "",
    previousCommittees: false,
    committeeDetails: "",
  });

  // Goals - MUST be empty by default as per user request
  const [goals, setGoals] = useState<[string, string, string]>(["", "", ""]);

  // Compliance with Article 3
  const [compliance, setCompliance] = useState<CouncilCompliance>({
    isParentOrStaff: true,
    commitmentToAttend: true,
    notMemberInOtherSchool: true,
    hasKidsInOtherSchoolsOnlyOneCouncil: true,
    goodConductAndNoLegalJudgments: true,
    isEducationalStaff: false,
  });

  // Pledge & Signature
  const [pledgeAccepted, setPledgeAccepted] = useState(true);
  const [signature, setSignature] = useState("");
  const [submissionDateHijri, setSubmissionDateHijri] = useState("1447/03/15هـ");

  // Flow & Submission State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<ParentCouncilApplication | null>(null);
  const [alreadySubmittedApplication, setAlreadySubmittedApplication] = useState<ParentCouncilApplication | null>(null);
  const [isSurveyClosed, setIsSurveyClosed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Scroll to top helper when switching steps
  const goToStep = (newStep: 1 | 2 | 3 | 4) => {
    setStep(newStep);
    setSubmitError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Comprehensive field validator with smooth auto-scroll to invalid field and inline red alerts
  const validateStep = (stepNumber: number): boolean => {
    const errors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!fullName.trim()) {
        errors.fullName = "يرجى استكمال هذا الحقل الإلزامي: الاسم الرباعي لولي الأمر كما في الهوية";
      }
      if (!nationalId.trim()) {
        errors.nationalId = "يرجى استكمال هذا الحقل الإلزامي: رقم الهوية الوطنية لولي الأمر";
      } else if (!validateNationalId(nationalId)) {
        errors.nationalId = "رقم الهوية الوطنية غير صالح (يجب أن يتكون من 10 أرقام تبدأ بـ 1 أو 2)";
      }
      if (!phone.trim()) {
        errors.phone = "يرجى استكمال هذا الحقل الإلزامي: رقم الجوال للتواصل";
      } else if (!validateSaudiPhone(phone)) {
        errors.phone = "رقم الجوال غير صالح (يجب أن يتكون من 10 أرقام يبدأ بـ 05)";
      }
      if (!email.trim()) {
        errors.email = "يرجى استكمال هذا الحقل الإلزامي: البريد الإلكتروني";
      } else if (!validateEmail(email)) {
        errors.email = "صيغة البريد الإلكتروني غير صحيحة (مثال: name@example.com)";
      }
      if (!studentName.trim()) {
        errors.studentName = "يرجى استكمال هذا الحقل الإلزامي: اسم الطالب الرباعي";
      }
      if (!studentGrade.trim()) {
        errors.studentGrade = "يرجى استكمال هذا الحقل الإلزامي: الصف الدراسي";
      }
      if (!studentClass.trim()) {
        errors.studentClass = "يرجى استكمال هذا الحقل الإلزامي: الشعبة أو الفصل";
      }
    } else if (stepNumber === 4) {
      if (!pledgeAccepted) {
        errors.pledgeAccepted = "يرجى الموافقة على التعهد النظامي المعتمد للمتابعة واعتماد الاستمارة";
      }
      if (!signature.trim() && !fullName.trim()) {
        errors.signature = "يرجى استكمال هذا الحقل الإلزامي: كتابة الاسم أو التوقيع المعتمد";
      }
    }

    setFieldErrors(errors);

    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const fieldPriority = [
        "fullName",
        "nationalId",
        "phone",
        "email",
        "studentName",
        "studentGrade",
        "studentClass",
        "pledgeAccepted",
        "signature",
      ];
      const firstInvalid = fieldPriority.find((k) => errors[k]) || errorKeys[0];

      // Smooth scroll to the invalid field and focus it immediately
      setTimeout(() => {
        const el = document.getElementById(`field-${firstInvalid}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const inputEl = el.querySelector("input, select, textarea") as HTMLElement | null;
          if (inputEl && typeof inputEl.focus === "function") {
            inputEl.focus();
          } else if (typeof (el as HTMLElement).focus === "function") {
            (el as HTMLElement).focus();
          }
        }
      }, 80);

      return false;
    }

    return true;
  };

  // Switch relationship & auto-recognize father
  const handleSelectRelation = (
    relId: "father" | "mother" | "brother" | "guardian" | "other",
    label: string
  ) => {
    setGuardianRelation(relId);
    setRelationLabel(label);

    if (relId === "father") {
      const fatherName = deriveFatherFullName(studentName, currentStudentObj);
      if (fatherName) {
        setFullName(fatherName);
      }
      setIsEditingGuardianName(false);
    } else {
      setIsEditingGuardianName(true);
      setTimeout(() => guardianNameInputRef.current?.focus(), 100);
    }
  };

  // Sync prop students
  useEffect(() => {
    if (propStudents && propStudents.length > 0) {
      setStudents(propStudents);
    }
  }, [propStudents]);

  // Load School Settings & URL params & Initial Check
  useEffect(() => {
    // 0. Check global survey status from server
    fetch("/api/parent-councils/data")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config?.isSurveyClosed) {
          setIsSurveyClosed(true);
        }
      })
      .catch(() => {});

    // 1. Load local school signatories
    const savedSignatories = localStorage.getItem("school_signatories");
    if (savedSignatories) {
      try {
        setSignatories((prev) => ({ ...prev, ...JSON.parse(savedSignatories) }));
      } catch (e) {
        console.error(e);
      }
    }

    // 2. Load cached students if any
    let loadedStudents: Student[] = propStudents || [];
    const savedStudents = localStorage.getItem("whatsapp_student_list");
    if (savedStudents && loadedStudents.length === 0) {
      try {
        const parsed = JSON.parse(savedStudents);
        if (Array.isArray(parsed)) {
          loadedStudents = parsed;
          setStudents(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 3. Inspect URL query parameters for student pre-filling
    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const paramStudentId = searchParams.get("student_id") || searchParams.get("studentId");
    const paramStudentName = searchParams.get("student_name") || searchParams.get("studentName");
    const paramGrade = searchParams.get("grade") || searchParams.get("student_grade");
    const paramClass = searchParams.get("class") || searchParams.get("student_class");
    const paramPhone = searchParams.get("phone");
    const paramGuardian = searchParams.get("parent_name") || searchParams.get("guardian");
    // Activation code is never auto-filled; guardian must type it manually from the message

    if (typeof window !== "undefined") {
      // Try matching student in roster
      let matched: any = undefined;
      if (paramStudentId && loadedStudents.length > 0) {
        matched = loadedStudents.find(
          (s) => s.id === paramStudentId || (s as any)["رقم الطالب"] === paramStudentId
        );
      }
      if (!matched && paramPhone && loadedStudents.length > 0) {
        const cleanP = paramPhone.replace(/\D/g, "");
        matched = loadedStudents.find((s) => {
          const sp = (s.phone || (s as any)["رقم الجوال"] || "").replace(/\D/g, "");
          return sp && (sp.includes(cleanP) || cleanP.includes(sp));
        });
      }
      if (!matched && paramStudentName && loadedStudents.length > 0) {
        matched = loadedStudents.find(
          (s) => (s.name || "").trim() === paramStudentName.trim()
        );
      }

      if (matched) {
        setCurrentStudentObj(matched);
        const sName = matched.name || (matched as any)["اسم الطالب"] || paramStudentName || "";
        const sGrade = matched.grade || (matched as any)["الصف"] || paramGrade || "الأول ثانوي";
        const sClass = matched.className || (matched as any)["الفصل"] || (matched as any)["الشعبة"] || paramClass || "1";
        const sPhone = matched.phone || (matched as any)["رقم الجوال"] || paramPhone || "";

        setStudentName(sName);
        setStudentGrade(sGrade);
        setStudentClass(sClass);
        setStudentId(matched.id || "");
        if (sPhone) setPhone(sPhone);

        // Auto-fill father name when relation is father
        if (guardianRelation === "father") {
          const fatherName = deriveFatherFullName(sName, matched);
          if (fatherName) setFullName(fatherName);
        }

        const siblings = findStudentSiblings(matched, loadedStudents);
        setDetectedSiblings(siblings);
      } else {
        if (paramStudentName) {
          setStudentName(paramStudentName);
          if (guardianRelation === "father") {
            const fatherName = deriveFatherFullName(paramStudentName);
            if (fatherName) setFullName(fatherName);
          }
        }
        if (paramGrade) setStudentGrade(paramGrade);
        if (paramClass) setStudentClass(paramClass);
        if (paramPhone) setPhone(paramPhone);
        if (paramGuardian) setFullName(paramGuardian);
      }
    }

    // 4. Track Link Opening & Fetch server data for this token if available
    const effectiveToken = token || searchParams.get("council_token") || searchParams.get("token") || null;
    const effectiveCode = initialCode || searchParams.get("council_code") || searchParams.get("code") || null;
    let effectiveStudentId = studentId || searchParams.get("student_id") || searchParams.get("studentId") || null;
    if (!effectiveStudentId && effectiveToken && effectiveToken.startsWith("pc_")) {
      const parts = effectiveToken.split("_");
      if (parts[1]) effectiveStudentId = parts[1];
    }
    const effectivePhone = searchParams.get("phone");
    const effectiveNationalId = searchParams.get("national_id") || searchParams.get("nationalId");

    // Track open immediately
    if (effectiveToken || effectiveStudentId) {
      fetch("/api/parent-councils/track-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: effectiveToken || undefined, studentId: effectiveStudentId || undefined }),
      }).catch(() => {});
    }

    const queryParams = new URLSearchParams();
    if (effectiveStudentId) queryParams.set("studentId", effectiveStudentId);
    if (effectivePhone) queryParams.set("phone", effectivePhone);
    if (effectiveNationalId) queryParams.set("nationalId", effectiveNationalId);
    if (effectiveCode) queryParams.set("code", effectiveCode);

    if (effectiveToken) {
      fetch(`/api/parent-councils/token/${encodeURIComponent(effectiveToken)}?${queryParams.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          if (data.isSurveyClosed) {
            setIsSurveyClosed(true);
            return;
          }
          if (data.isExpired) {
            setIsExpired(true);
            return;
          }

          // If parent has active submitted form in the server database
          if (data.alreadySubmitted && data.application) {
            setAlreadySubmittedApplication(data.application as ParentCouncilApplication);
            setIsCodeVerified(true);
            try {
              localStorage.setItem(`pc_submitted_${effectiveToken}`, "true");
              if (data.application.studentId) {
                localStorage.setItem(`pc_submitted_student_${data.application.studentId}`, "true");
              }
            } catch (e) {}
            return;
          } else {
            // Application is not submitted or was deleted by administration - allow re-entry
            setAlreadySubmittedApplication(null);
            setSubmittedApplication(null);
            setIsPageClosed(false);
            try {
              localStorage.removeItem(`pc_submitted_${effectiveToken}`);
              const targetStudentId = data?.invite?.studentId || data?.studentId || effectiveStudentId;
              if (targetStudentId) {
                localStorage.removeItem(`pc_submitted_student_${targetStudentId}`);
              }
              sessionStorage.removeItem("parent_council_session_closed");
            } catch (e) {}
          }

          if (data.invite) {
            if (data.invite.studentName && !studentName) {
              setStudentName(data.invite.studentName);
              if (guardianRelation === "father") {
                const fatherName = deriveFatherFullName(data.invite.studentName);
                if (fatherName) setFullName(fatherName);
              }
            }
            if (data.invite.studentGrade && !studentGrade) setStudentGrade(data.invite.studentGrade);
            if (data.invite.studentClass && !studentClass) setStudentClass(data.invite.studentClass);
            if (data.invite.guardianPhone && !phone) setPhone(data.invite.guardianPhone);
            if (data.invite.studentId && !studentId) setStudentId(data.invite.studentId);
          }
          if (data.application) {
            const app = data.application as ParentCouncilApplication;
            if (app.fullName) setFullName(app.fullName);
            if (app.nationalId) setNationalId(app.nationalId);
            if (app.phone) setPhone(app.phone);
            if (app.email) setEmail(app.email);
            if (app.studentName) setStudentName(app.studentName);
            if (app.studentId) setStudentId(app.studentId);
            if (app.studentGrade) setStudentGrade(app.studentGrade);
            if (app.studentClass) setStudentClass(app.studentClass);
            if (app.skills) setSkills(app.skills);
            if (app.goals) setGoals(app.goals);
            if (app.compliance) setCompliance(app.compliance);
            if (app.guardianRelation) setGuardianRelation(app.guardianRelation);
            if (app.relationLabel) setRelationLabel(app.relationLabel);
            if (app.additionalStudents) setDetectedSiblings(app.additionalStudents);
            if (app.signature) setSignature(app.signature);
          }
        })
        .catch(() => {});
    } else if (effectiveStudentId) {
      // Check if this student already has a submitted application
      fetch(`/api/parent-councils/check-submission?${queryParams.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.alreadySubmitted && data?.application) {
            setAlreadySubmittedApplication(data.application as ParentCouncilApplication);
            setIsCodeVerified(true);
            try {
              if (effectiveStudentId) {
                localStorage.setItem(`pc_submitted_student_${effectiveStudentId}`, "true");
              }
            } catch (e) {}
          }
        })
        .catch(() => {});
    }
  }, [token, propStudents]);

  // Code Verification Handler
  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = activationCodeInput.trim().replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    if (!cleanCode) {
      setCodeError("يرجى إدخال رمز التفعيل المكون من 6 أرقام");
      return;
    }

    setVerifyingCode(true);
    setCodeError(null);

    try {
      const res = await fetch("/api/parent-councils/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode, token }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data?.isSurveyClosed) {
          setIsSurveyClosed(true);
          return;
        }
        if (data?.isExpired) {
          setIsExpired(true);
          return;
        }
        throw new Error(data.error || "رمز التفعيل غير صحيح أو انتهت صلاحيته");
      }

      setIsCodeVerified(true);

      // If already submitted application was returned
      if (data.alreadySubmitted && data.application) {
        setAlreadySubmittedApplication(data.application as ParentCouncilApplication);
        return;
      } else {
        // Not submitted or application was deleted from dashboard
        setAlreadySubmittedApplication(null);
        try {
          if (token) localStorage.removeItem(`pc_submitted_${token}`);
          if (studentId) localStorage.removeItem(`pc_submitted_student_${studentId}`);
        } catch (e) {}
      }

      // If invite data is returned, prefill
      if (data.invite) {
        const sName = data.invite.studentName || studentName;
        if (data.invite.studentName) setStudentName(data.invite.studentName);
        if (data.invite.studentGrade) setStudentGrade(data.invite.studentGrade);
        if (data.invite.studentClass) setStudentClass(data.invite.studentClass);
        if (data.invite.guardianPhone && !phone) setPhone(data.invite.guardianPhone);
        if (data.invite.studentId && !studentId) setStudentId(data.invite.studentId);

        if (guardianRelation === "father" && sName) {
          const fatherName = deriveFatherFullName(sName, currentStudentObj);
          if (fatherName) setFullName(fatherName);
        }
      }

      // If existing application was returned, fill the fields
      if (data.application) {
        const app = data.application as ParentCouncilApplication;
        if (app.status === "submitted" || app.status === "approved" || app.status === "disqualified") {
          setAlreadySubmittedApplication(app);
          return;
        }
        setFullName(app.fullName || "");
        setNationalId(app.nationalId || "");
        setPhone(app.phone || "");
        setEmail(app.email || "");
        setStudentName(app.studentName || "");
        setStudentId(app.studentId || "");
        setStudentGrade(app.studentGrade || "الأول ثانوي");
        setStudentClass(app.studentClass || "1");
        if (app.skills) setSkills(app.skills);
        if (app.goals) setGoals(app.goals);
        if (app.compliance) setCompliance(app.compliance);
        if (app.guardianRelation) setGuardianRelation(app.guardianRelation);
        if (app.relationLabel) setRelationLabel(app.relationLabel);
        if (app.additionalStudents) setDetectedSiblings(app.additionalStudents);
        setSignature(app.signature || app.fullName || "");
      }
    } catch (err: any) {
      setCodeError(err.message || "رمز التفعيل غير مطابق. يرجى التواصل مع إدارة المدرسة للحصول على الرمز الصحيح.");
    } finally {
      setVerifyingCode(false);
    }
  };

  // Student Match helper
  const handleStudentSelect = (selectedStudent: Student) => {
    setStudentName(selectedStudent.name || "");
    setStudentId(selectedStudent.id || "");
    setStudentGrade(selectedStudent.grade || "الأول ثانوي");
    setStudentClass(selectedStudent.className || "1");
    if (selectedStudent.phone && !phone) {
      setPhone(selectedStudent.phone);
    }
  };

  // Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateStep(1)) {
      setStep(1);
      return;
    }

    if (!validateStep(4)) {
      setStep(4);
      return;
    }

    setIsSubmitting(true);

    const newApp: ParentCouncilApplication = {
      id: token ? `app_${token}` : `app_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      activationCode: activationCodeInput || "202601",
      activationToken: token || `pc_${Date.now()}`,
      studentId: studentId || undefined,
      studentName: studentName.trim(),
      studentGrade: studentGrade.trim(),
      studentClass: studentClass.trim(),
      fullName: fullName.trim(),
      nationalId: nationalId.trim(),
      phone: phone.trim(),
      email: email.trim(),
      guardianRelation,
      relationLabel,
      additionalStudents: detectedSiblings.length > 0 ? detectedSiblings : undefined,
      skills,
      goals,
      compliance,
      pledgeAccepted,
      signature: signature.trim() || fullName.trim(),
      submissionDateHijri: submissionDateHijri || "1447/03/15هـ",
      submittedAt: new Date().toISOString(),
      status: "submitted",
    };

    // Calculate evaluation immediately
    const evaluation = evaluateParentCouncilApplication(newApp);
    newApp.smartEvaluation = evaluation;
    newApp.status = "submitted";

    try {
      const res = await fetch("/api/parent-councils/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application: newApp }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر حفظ الاستمارة، يرجى المحاولة مرة أخرى");
      }

      const finalSavedApp = data.application || newApp;
      setSubmittedApplication(finalSavedApp);

      // Sync to local storage immediately
      try {
        const localSaved = JSON.parse(localStorage.getItem("parent_councils_apps") || "{}");
        localSaved[finalSavedApp.id] = finalSavedApp;
        localStorage.setItem("parent_councils_apps", JSON.stringify(localSaved));

        // Update local invites store
        const localInvites = JSON.parse(localStorage.getItem("parent_councils_invites") || "{}");
        if (finalSavedApp.studentId && localInvites[finalSavedApp.studentId]) {
          localInvites[finalSavedApp.studentId].isSubmitted = true;
          localInvites[finalSavedApp.studentId].submittedAt = finalSavedApp.submittedAt;
          localInvites[finalSavedApp.studentId].hasOpened = true;
          localInvites[finalSavedApp.studentId].applicationId = finalSavedApp.id;
          localStorage.setItem("parent_councils_invites", JSON.stringify(localInvites));
        }

        if (finalSavedApp.token) {
          localStorage.setItem(`pc_submitted_${finalSavedApp.token}`, "true");
        }
        if (finalSavedApp.activationToken) {
          localStorage.setItem(`pc_submitted_${finalSavedApp.activationToken}`, "true");
        }
        if (token) {
          localStorage.setItem(`pc_submitted_${token}`, "true");
        }
        if (finalSavedApp.studentId) {
          localStorage.setItem(`pc_submitted_student_${finalSavedApp.studentId}`, "true");
        }

        // Broadcast to other tabs / admin dashboard
        try {
          const bc = new BroadcastChannel("parent_councils_channel");
          bc.postMessage({ type: "APPLICATION_SUBMITTED", application: finalSavedApp });
          bc.close();
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("parent_councils_data_changed", { detail: finalSavedApp }));
      } catch (e) {}
    } catch (err: any) {
      // Fallback: save locally in localStorage so work is never lost
      try {
        const localSaved = JSON.parse(localStorage.getItem("parent_councils_apps") || "{}");
        localSaved[newApp.id] = newApp;
        localStorage.setItem("parent_councils_apps", JSON.stringify(localSaved));

        const localInvites = JSON.parse(localStorage.getItem("parent_councils_invites") || "{}");
        if (newApp.studentId && localInvites[newApp.studentId]) {
          localInvites[newApp.studentId].isSubmitted = true;
          localInvites[newApp.studentId].submittedAt = newApp.submittedAt;
          localInvites[newApp.studentId].hasOpened = true;
          localInvites[newApp.studentId].applicationId = newApp.id;
          localStorage.setItem("parent_councils_invites", JSON.stringify(localInvites));
        }

        if ((newApp as any).token || newApp.activationToken) {
          localStorage.setItem(`pc_submitted_${(newApp as any).token || newApp.activationToken}`, "true");
        }
        if (token) {
          localStorage.setItem(`pc_submitted_${token}`, "true");
        }
        if (newApp.studentId) {
          localStorage.setItem(`pc_submitted_student_${newApp.studentId}`, "true");
        }

        try {
          const bc = new BroadcastChannel("parent_councils_channel");
          bc.postMessage({ type: "APPLICATION_SUBMITTED", application: newApp });
          bc.close();
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("parent_councils_data_changed", { detail: newApp }));
        setSubmittedApplication(newApp);
      } catch (e) {
        setSubmitError(err.message || "حدث خطأ أثناء إرسال الاستمارة");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // View 0: Completed and Closed Page (لا عودة للموقع أو رابط الدخول)
  if (isPageClosed) {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-800/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6 backdrop-blur-xs">
          <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              تم إغلاق الاستمارة بنجاح
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              شكراً لتعاونكم ومشاركتكم في مجالس أولياء الأمور بـ{" "}
              <span className="text-teal-300 font-bold">{signatories.schoolName || "المدرسة"}</span>. تم حفظ وتوثيق استمارتكم بنجاح في سجلات المدرسة.
            </p>
          </div>

          <div className="bg-slate-700/50 rounded-2xl p-4 border border-slate-600/50 text-xs text-slate-300 space-y-1.5 text-center">
            <div className="font-bold text-emerald-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>تم إنهاء الجلسة والخروج بأمان</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-0.5">
              يمكنكم الآن إغلاق هذا التبويب أو نافذة المتصفح.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                try { window.close(); } catch (e) {}
                try { window.open("", "_self", ""); window.close(); } catch (e) {}
                try {
                  if ((window as any).opener) {
                    (window as any).opener = null;
                    window.open("", "_self");
                    window.close();
                  }
                } catch (e) {}
                try {
                  if ((window as any).WeixinJSBridge) {
                    (window as any).WeixinJSBridge.call("closeWindow");
                  }
                } catch (e) {}
                try {
                  if (window.top && window.top !== window) {
                    window.top.close();
                  }
                } catch (e) {}
              }}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-black text-xs sm:text-sm cursor-pointer transition-all shadow-lg"
            >
              إغلاق المتصفح الآن
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View: Print Official Form Modal
  if (showPrintModal && (submittedApplication || alreadySubmittedApplication)) {
    return (
      <ParentCouncilPrintSheet
        application={(submittedApplication || alreadySubmittedApplication)!}
        signatories={signatories}
        onClose={() => setShowPrintModal(false)}
      />
    );
  }

  // View 1: Thank You Screen immediately following submission
  if (submittedApplication) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-3 sm:p-6" dir="rtl">
        <div className="max-w-xl mx-auto my-4 sm:my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-l from-teal-800 to-teal-700 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30 shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-emerald-300" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black mb-2">
              شكراً لكم على إكمال استمارة الترشح
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed max-w-md mx-auto">
              تم استلام استمارتكم بنجاح، وستتواصل إدارة المدرسة مع المرشحين لعضوية مجلس أولياء الأمور.
            </p>
          </div>

          {/* Details & Official Closure Notice */}
          <div className="p-5 sm:p-8 space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs font-bold leading-relaxed flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">تم إكمال الاستمارة واستلامها بنجاح</span>
                <span className="text-slate-600 font-medium text-xs">
                  تم تسجيل ترشيحكم وتوثيقه رسمياً، وستتواصل إدارة المدرسة مع المرشحين.
                </span>
              </div>
            </div>

            {/* Summary Data */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-600 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>بيانات الترشيح المستلمة:</span>
                <span className="text-[11px] font-mono text-teal-800">
                  {submittedApplication.id}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم ولي الأمر:</span>
                  <span className="font-extrabold text-slate-900">{submittedApplication.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم الطالب:</span>
                  <span className="font-extrabold text-slate-900">{submittedApplication.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">الصف والشعبة:</span>
                  <span className="font-bold text-slate-800">
                    {submittedApplication.studentGrade} - الشعبة {submittedApplication.studentClass}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">رقم الجوال:</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{submittedApplication.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">تاريخ التقديم:</span>
                  <span className="font-bold text-slate-800">{submittedApplication.submissionDateHijri}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">حالة الطلب:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                    <Check className="w-3.5 h-3.5" />
                    <span>مكتمل ومستلم بنجاح</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions: Browser tab close only - NO BUTTONS to return to site or form */}
            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-1.5">
              <div className="text-xs sm:text-sm font-black text-slate-800">
                فضلاً قم بإغلاق المتصفح الآن
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                تم حفظ وتوثيق بياناتكم بأمان، ولا توجد أي خطوات أخرى مطلوبة منكم. يرجى إغلاق نافذة أو علامة تبويب المتصفح.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View 0A: Survey Closed by Administration
  if (isSurveyClosed) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6" dir="rtl">
        <div className="max-w-2xl mx-auto my-8 sm:my-14 bg-white rounded-3xl border border-rose-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-l from-rose-900 via-rose-800 to-rose-700 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <Lock className="w-9 h-9 text-rose-200" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black mb-2">
              الاستبيان مغلق حالياً
            </h1>
            <p className="text-xs sm:text-sm text-rose-100 font-medium leading-relaxed max-w-lg mx-auto">
              عذراً، تم إيقاف استقبال طلبات الترشح والاستبيان لعضوية مجلس أولياء الأمور من قِبل إدارة المدرسة، ولا يمكن تعبئة الاستمارة في الوقت الحالي.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 text-xs font-bold leading-relaxed flex items-center gap-3 text-right">
              <AlertCircle className="w-6 h-6 text-rose-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">تم إيقاف الاستبيان بقرار من إدارة المدرسة</span>
                <span>إذا كانت لديكم أي استفسارات، يرجى التواصل مباشرة مع إدارة المدرسة أو الموجه الطلابي.</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {signatories.schoolName || "ثانوية الأبناء الأولى"} — مجالس أولياء الأمور في التعليم العام
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View 0B: Survey Expired (3 Days)
  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6" dir="rtl">
        <div className="max-w-2xl mx-auto my-8 sm:my-14 bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-l from-amber-800 via-amber-700 to-amber-600 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <Clock className="w-9 h-9 text-amber-200" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black mb-2">
              انتهاء الوقت المخصص للإجابة عن الاستبيان
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 font-medium leading-relaxed max-w-lg mx-auto">
              عذراً، لقد انتهت المهلة المحددة للإجابة على استبيان الترشح لعضوية مجلس أولياء الأمور (المدة المحددة للتقديم هي 3 أيام من تاريخ إرسال الدعوة).
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-xs font-bold leading-relaxed flex items-center gap-3 text-right">
              <Clock className="w-6 h-6 text-amber-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">انقضاء فترة التقديم المتاحة (3 أيام)</span>
                <span>نقدر عالياً اهتمامكم وحرصكم الكريم، ونتطلع لمشاركتكم الفعالة في الأنشطة والبرامج المدرسية القادمة.</span>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              {signatories.schoolName || "ثانوية الأبناء الأولى"} — مجالس أولياء الأمور في التعليم العام
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View 2: Re-entry Check Screen (when parent re-enters after submission)
  if (alreadySubmittedApplication) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-3 sm:p-6" dir="rtl">
        <div className="max-w-xl mx-auto my-4 sm:my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-teal-900 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20 shadow-inner">
              <CheckCircle2 className="w-10 h-10 text-teal-300" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black mb-2">
              تم تعبئة الاستمارة من قبل
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-md mx-auto">
              المكرم ولي الأمر، نود إشعاركم بأنه قد تم تعبئة استمارة الترشح لعضوية مجلس أولياء الأمور مسبقاً، وبياناتكم مسجلة ومحفوظة لدى إدارة المدرسة، وستتواصل إدارة المدرسة مع المرشحين.
            </p>
          </div>

          <div className="p-5 sm:p-8 space-y-5">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-teal-950 text-xs font-bold leading-relaxed flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-teal-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">تم استلام استمارتكم وتوثيقها مسبقاً</span>
                <span className="text-slate-600 font-medium text-xs">
                  لقد تم تسجيل بياناتكم في النظام ولا يمكن إعادة تعبئة الاستمارة، وستتواصل المدرسة مع المرشحين.
                </span>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-600 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>بيانات الاستمارة المعبأة مسبقاً:</span>
                <span className="text-[11px] font-mono text-teal-800">
                  {alreadySubmittedApplication.id}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم ولي الأمر:</span>
                  <span className="font-extrabold text-slate-900">{alreadySubmittedApplication.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">اسم الطالب:</span>
                  <span className="font-extrabold text-slate-900">{alreadySubmittedApplication.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">الصف والشعبة:</span>
                  <span className="font-bold text-slate-800">
                    {alreadySubmittedApplication.studentGrade} - الشعبة {alreadySubmittedApplication.studentClass}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">رقم الجوال:</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">{alreadySubmittedApplication.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">تاريخ التقديم:</span>
                  <span className="font-bold text-slate-800">{alreadySubmittedApplication.submissionDateHijri}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">الحالة:</span>
                  <span className="font-bold text-emerald-800">معبأة ومكتملة مسبقاً</span>
                </div>
              </div>
            </div>

            {/* Instructions: Browser tab close */}
            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center space-y-1.5">
              <div className="text-xs sm:text-sm font-black text-slate-800">
                فضلاً قم بإغلاق المتصفح الآن
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-relaxed">
                بياناتكم مسجلة مسبقاً ولا توجد خطوات إضافية مطلوبة منكم. يرجى إغلاق نافذة أو علامة تبويب المتصفح.
              </p>
            </div>

            {/* Re-entry button if application was deleted by administration */}
            <div className="pt-2 text-center">
              <button
                type="button"
                id="btn-re-enter-portal"
                onClick={() => {
                  setAlreadySubmittedApplication(null);
                  setIsCodeVerified(false);
                  setActivationCodeInput("");
                  setCodeError(null);
                  try {
                    const urlParams = new URLSearchParams(window.location.search);
                    const curTok = token || urlParams.get("token") || urlParams.get("council_token");
                    const curSid = studentId || urlParams.get("studentId") || urlParams.get("sid");
                    if (curTok) localStorage.removeItem(`pc_submitted_${curTok}`);
                    if (curSid) localStorage.removeItem(`pc_submitted_student_${curSid}`);
                    sessionStorage.removeItem("parent_council_session_closed");
                  } catch (e) {}
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-teal-700" />
                <span>في حال تم حذف استمارتكم من قبل المدرسة، اضغط هنا لإدخال كود التفعيل وإعادة التعبئة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" dir="rtl">
      
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/90 shadow-xs sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h1 className="text-xs sm:text-base font-black text-slate-900 leading-tight">
                مجالس أولياء الأمور في التعليم العام
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[210px] sm:max-w-none">
                بوابة ترشيح عضوية المجلس بـ {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </p>
            </div>
          </div>

          {!isPortalMode && onExit && (
            <button
              onClick={onExit}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              إغلاق المعاينة
            </button>
          )}

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        
        {/* Step 0: Activation Code Verification Gate */}
        {!isCodeVerified ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-5 sm:p-10 text-center max-w-md mx-auto my-2 sm:my-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-2xs">
              <KeyRound className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h2 className="text-base sm:text-lg font-black text-slate-900 mb-1.5 sm:mb-2">
              رمز التفعيل لترشيح مجلس أولياء الأمور
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 sm:mb-6 leading-relaxed">
              يرجى إدخال رمز التفعيل المكون من 6 أرقام المرسل عبر رسالة الواتساب أو الصادر من إدارة المدرسة للبدء في تعبئة استمارة الترشيح.
            </p>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={10}
                  value={activationCodeInput}
                  onChange={(e) => {
                    setActivationCodeInput(e.target.value);
                    setCodeError(null);
                  }}
                  placeholder="أدخل رمز التفعيل (مثال: 202601)"
                  className="w-full text-center text-xl sm:text-2xl font-mono font-black tracking-widest py-3 sm:py-3.5 px-4 rounded-2xl bg-slate-50 border-2 border-slate-300 focus:border-teal-600 focus:bg-white focus:outline-hidden transition-all min-h-[48px]"
                  dir="ltr"
                  autoFocus
                />
              </div>

              {codeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 text-right">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingCode || !activationCodeInput.trim()}
                className="w-full py-3 sm:py-3.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
              >
                {verifyingCode ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جارٍ التحقق...</span>
                  </>
                ) : (
                  <>
                    <span>التحقق والدخول للاستمارة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 text-[11px] text-slate-500">
              في حال عدم توفر الرمز، يمكنك التواصل مع لجنة التوجيه الطلابي بالمدرسة للحصول على رمز تفعيل الترشيح.
            </div>
          </div>
        ) : (
          /* Multi-step Application Wizard Form */
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-md overflow-hidden">
            
            {/* Step Progress Indicators */}
            <div className="bg-slate-50 border-b border-slate-200 px-2.5 sm:px-8 py-3 sm:py-4">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {[
                  { num: 1, label: "ولي الأمر" },
                  { num: 2, label: "الخبرات" },
                  { num: 3, label: "الأهداف" },
                  { num: 4, label: "التعهد" },
                ].map((s) => {
                  const isActive = step === s.num;
                  const isDone = step > s.num;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (s.num > step) {
                          if (!validateStep(step)) return;
                        }
                        setStep(s.num as any);
                      }}
                      className={`text-center py-2 px-1 rounded-xl transition-all cursor-pointer min-h-[44px] flex flex-col items-center justify-center ${
                        isActive
                          ? "bg-teal-700 text-white font-black shadow-xs"
                          : isDone
                          ? "bg-teal-50 text-teal-800 font-bold border border-teal-200"
                          : "text-slate-400 font-medium hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-mono font-bold leading-none mb-0.5">{s.num}</div>
                      <div className="text-[10px] sm:text-xs truncate max-w-[65px] sm:max-w-none">{s.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-8">
              
              {/* Error banner if any */}
              {submitError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* STEP 1: بيانات ولي الأمر والطالب */}
              {step === 1 && (
                <div className="space-y-6">
                  
                  {/* Header */}
                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <User className="w-5 h-5 text-teal-700" />
                        <span>القسم الأول: بيانات ولي الأمر والطالب</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        مطابقة للاستمارة الرسمية لطلب عضوية مجلس أولياء الأمور
                      </p>
                    </div>

                    {studentName && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-full text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>تم التعرف على الطالب آلياً</span>
                      </span>
                    )}
                  </div>

                  {/* Auto-detected Student & Siblings Card */}
                  {studentName ? (
                    <div className="bg-gradient-to-r from-teal-50/90 to-emerald-50/70 border border-teal-200/90 rounded-2xl p-4.5 space-y-3 shadow-2xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[11px] font-extrabold text-teal-800">
                              بيانات الطالب الأساسي المسجل بالمدرسة:
                            </div>
                            <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                              {studentName}
                            </div>
                            <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5 font-bold">
                              <span>الصف: <strong className="text-slate-800">{studentGrade}</strong></span>
                              <span>•</span>
                              <span>الشعبة: <strong className="text-slate-800">{studentClass}</strong></span>
                              {studentId && (
                                <>
                                  <span>•</span>
                                  <span className="text-[11px] font-mono text-slate-500">رقم الطالب: {studentId}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 bg-white border border-teal-300 text-teal-800 rounded-xl text-[11px] font-extrabold shrink-0">
                          بيانات معتمدة
                        </span>
                      </div>

                      {/* If multiple siblings detected in school */}
                      {detectedSiblings && detectedSiblings.length > 0 && (
                        <div className="pt-3 border-t border-teal-200/60 mt-2">
                          <div className="text-xs font-black text-teal-950 flex items-center gap-1.5 mb-2">
                            <Users className="w-4 h-4 text-teal-700" />
                            <span>الأبناء الآخرون المسجلون بالمدرسة ({detectedSiblings.length} طالب):</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {detectedSiblings.map((sib, sIdx) => (
                              <div
                                key={sIdx}
                                className="bg-white/95 border border-teal-200 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 text-slate-800 shadow-2xs"
                              >
                                <span className="font-black text-teal-900">{sib.name}</span>
                                <span className="text-[11px] text-slate-500 font-bold">
                                  ({sib.grade} {sib.className ? `- شعبة ${sib.className}` : ""})
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-teal-800 mt-1.5 font-medium">
                            • يسري طلب الترشيح ممثلاً لجميع أبنائك المسجلين بالمدرسة وفق القواعد المنظمة.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Relationship selector */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-slate-800">
                        صلة القرابة للطالب (صفة مقدم الطلب):
                      </label>
                      {guardianRelation === "father" && (
                        <span className="text-[11px] font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-lg border border-teal-200">
                          ✓ تم التعرف على الأب تلقائياً
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "father", label: "الأب" },
                        { id: "brother", label: "الأخ" },
                        { id: "guardian", label: "الوكيل الشرعي" },
                        { id: "other", label: "صلة قرابة أخرى" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectRelation(item.id as any, item.label)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                            guardianRelation === item.id
                              ? "bg-teal-700 text-white shadow-xs font-black ring-2 ring-teal-500"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {guardianRelation === "father" && (
                      <p className="text-[11px] text-teal-900 font-medium pt-1">
                        • تم وضع اسم الأب تلقائياً في خانة ولي الأمر بناءً على بيانات الطالب ولا حاجة لإعادة كتابته.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Full Name of Guardian */}
                    <div id="field-fullName" className="sm:col-span-2 space-y-1.5 scroll-mt-24">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                          <span>الاسم الرباعي لمقدم الطلب / ولي الأمر</span>
                          <span className="text-rose-600">*</span>
                          {guardianRelation === "father" ? (
                            <span className="text-[11px] font-bold text-teal-700">(اسم الأب تلقائياً)</span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-700">({relationLabel})</span>
                          )}
                        </label>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingGuardianName(true);
                            guardianNameInputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-700 hover:text-teal-900 cursor-pointer bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل الاسم يدوياً</span>
                        </button>
                      </div>

                      <input
                        ref={guardianNameInputRef}
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fieldErrors.fullName) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.fullName;
                              return copy;
                            });
                          }
                        }}
                        placeholder="أدخل الاسم الرباعي لولي الأمر كما في الهوية"
                        className={`w-full px-4 py-2.5 rounded-xl border text-base sm:text-sm font-bold focus:outline-hidden transition-all ${
                          fieldErrors.fullName
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : isEditingGuardianName
                            ? "border-teal-500 bg-white text-slate-900 ring-2 ring-teal-100"
                            : "border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                      />

                      {fieldErrors.fullName && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-shake">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.fullName}</span>
                        </div>
                      )}

                      {/* Notice banner for editable guardian name */}
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                        <span className="text-teal-700 font-black shrink-0">معلومة:</span>
                        <span>
                          {guardianRelation === "father"
                            ? "تم إدراج اسم الأب آلياً من سجل الطالب لراحتكم، ويمكنكم التعديل يدوياً إذا لزم الأمر."
                            : "يرجى كتابة الاسم الرباعي لولي الأمر/مقدم الطلب كما هو مدون بالهوية الوطنية."}
                        </span>
                      </div>
                    </div>

                    {/* National ID */}
                    <div id="field-nationalId" className="scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        رقم الهوية الوطنية لولي الأمر <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={nationalId}
                        onChange={(e) => {
                          setNationalId(e.target.value);
                          if (fieldErrors.nationalId) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.nationalId;
                              return copy;
                            });
                          }
                        }}
                        placeholder="10 أرقام تبدأ بـ 1 أو 2"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-mono font-bold focus:outline-hidden transition-all ${
                          fieldErrors.nationalId
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                        dir="ltr"
                      />
                      {fieldErrors.nationalId && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.nationalId}</span>
                        </div>
                      )}
                    </div>

                    {/* Mobile Number */}
                    <div id="field-phone" className="scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        رقم الجوال <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (fieldErrors.phone) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.phone;
                              return copy;
                            });
                          }
                        }}
                        placeholder="05xxxxxxxx"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-mono font-bold focus:outline-hidden transition-all ${
                          fieldErrors.phone
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                        dir="ltr"
                      />
                      {fieldErrors.phone && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div id="field-email" className="sm:col-span-2 scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        البريد الإلكتروني <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.email;
                              return copy;
                            });
                          }
                        }}
                        placeholder="example@domain.com"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-mono focus:outline-hidden transition-all ${
                          fieldErrors.email
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                        dir="ltr"
                      />
                      {fieldErrors.email && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Student Name */}
                    <div id="field-studentName" className="scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        اسم الطالب <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value);
                          if (fieldErrors.studentName) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.studentName;
                              return copy;
                            });
                          }
                        }}
                        placeholder="اسم الطالب المسجل بالمدرسة"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold focus:outline-hidden transition-all ${
                          fieldErrors.studentName
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                      />
                      {fieldErrors.studentName && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.studentName}</span>
                        </div>
                      )}
                    </div>

                    {/* Grade & Section */}
                    <div id="field-studentGrade" className="scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        الصف الدراسي والشعبة <span className="text-rose-600">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={studentGrade}
                          onChange={(e) => {
                            setStudentGrade(e.target.value);
                            if (fieldErrors.studentGrade) {
                              setFieldErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.studentGrade;
                                return copy;
                              });
                            }
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold focus:outline-hidden bg-white ${
                            fieldErrors.studentGrade
                              ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                              : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                          }`}
                        >
                          <option value="الأول ثانوي">الأول ثانوي</option>
                          <option value="الثاني ثانوي">الثاني ثانوي</option>
                          <option value="الثالث ثانوي">الثالث ثانوي</option>
                          <option value="المرحلة المتوسطة">المرحلة المتوسطة</option>
                          <option value="المرحلة الابتدائية">المرحلة الابتدائية</option>
                        </select>
                        <div id="field-studentClass">
                          <input
                            type="text"
                            value={studentClass}
                            onChange={(e) => {
                              setStudentClass(e.target.value);
                              if (fieldErrors.studentClass) {
                                setFieldErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy.studentClass;
                                  return copy;
                                });
                              }
                            }}
                            placeholder="الشعبة (مثال: 1)"
                            className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold focus:outline-hidden ${
                              fieldErrors.studentClass
                                ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                                : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                            }`}
                          />
                        </div>
                      </div>
                      {(fieldErrors.studentGrade || fieldErrors.studentClass) && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.studentGrade || fieldErrors.studentClass}</span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Educational Staff Clause 4 */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compliance.isEducationalStaff || false}
                        onChange={(e) =>
                          setCompliance((prev) => ({ ...prev, isEducationalStaff: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        هل أنت عضو في الهيئة التعليمية بالمدرسة ونفسك ولي أمر لطالب؟ (المادة 3 بند 4)
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!validateStep(1)) return;
                        goToStep(2);
                      }}
                      className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>التالي: الخبرات والمهارات</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: الخبرات والمهارات مع التحقق السريع (طلب المستخدم الصريح) */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-teal-700" />
                      <span>القسم الثاني: الخبرات والمهارات ذات العلاقة</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      يرجى وضع علامة (✓) أمام ما ينطبق، مع تقديم إثبات أو بيان سريع وموجز يوضح امتلاكك للمهارة.
                    </p>
                  </div>

                  <div className="space-y-4">
                    
                    {/* 1. مهارات تنظيمية / إدارية */}
                    <div className="border border-slate-200 rounded-2xl p-4 transition-all hover:border-teal-300">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.organizationalManagement}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, organizationalManagement: e.target.checked }))
                          }
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            مهارات تنظيمية / إدارية
                          </span>
                          <span className="text-xs text-slate-500">
                            القدرة على قيادة وتنسيق الأعمال وإدارة المبادرات وفرق العمل
                          </span>
                        </div>
                      </label>

                      {skills.organizationalManagement && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pr-8 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {["إدارة فرق عمل", "تخطيط ومتابعة", "رئاسة لجان", "إدارة مشاريع"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setSkills((prev) => ({
                                    ...prev,
                                    organizationalDetails: prev.organizationalDetails
                                      ? `${prev.organizationalDetails}، ${chip}`
                                      : chip,
                                  }))
                                }
                                className="text-[11px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={skills.organizationalDetails || ""}
                            onChange={(e) =>
                              setSkills((prev) => ({ ...prev, organizationalDetails: e.target.value }))
                            }
                            placeholder="تحقق سريع: أبرز منصب أو دور تنظيمي مارسته (سطر واحد)"
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* 2. خبرة في العمل التطوعي أو المجتمعي */}
                    <div className="border border-slate-200 rounded-2xl p-4 transition-all hover:border-teal-300">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.volunteerExperience}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, volunteerExperience: e.target.checked }))
                          }
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            خبرة في العمل التطوعي أو المجتمعي
                          </span>
                          <span className="text-xs text-slate-500">
                            مشاركات تطوعية سابقة أو عضوية في جمعيات ومبادرات غير ربحية
                          </span>
                        </div>
                      </label>

                      {skills.volunteerExperience && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pr-8 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {["عضو جمعية خيرية", "منصة العمل التطوعي", "مبادرات الحي", "تطوع مدرسي سابق"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setSkills((prev) => ({
                                    ...prev,
                                    volunteerDetails: prev.volunteerDetails
                                      ? `${prev.volunteerDetails}، ${chip}`
                                      : chip,
                                  }))
                                }
                                className="text-[11px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={skills.volunteerDetails || ""}
                            onChange={(e) =>
                              setSkills((prev) => ({ ...prev, volunteerDetails: e.target.value }))
                            }
                            placeholder="تحقق سريع: أبرز جهة أو نشاط تطوعي شاركت به"
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* 3. قدرة على إعداد التقارير والتوثيق */}
                    <div className="border border-slate-200 rounded-2xl p-4 transition-all hover:border-teal-300">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.reportingAndDoc}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, reportingAndDoc: e.target.checked }))
                          }
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            قدرة على إعداد التقارير والتوثيق
                          </span>
                          <span className="text-xs text-slate-500">
                            صياغة محاضر الاجتماعات وإعداد التقارير الإدارية والإحصائية
                          </span>
                        </div>
                      </label>

                      {skills.reportingAndDoc && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pr-8 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {["توثيق المحاضر", "تقارير دورية وإحصاءات", "عروض تقديمية", "Google Workspace"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setSkills((prev) => ({
                                    ...prev,
                                    reportingDetails: prev.reportingDetails
                                      ? `${prev.reportingDetails}، ${chip}`
                                      : chip,
                                  }))
                                }
                                className="text-[11px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={skills.reportingDetails || ""}
                            onChange={(e) =>
                              setSkills((prev) => ({ ...prev, reportingDetails: e.target.value }))
                            }
                            placeholder="تحقق سريع: النماذج والبرامج التي تجيد إعداد التقارير بها"
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* 4. استخدام المنصات الرقمية */}
                    <div className="border border-slate-200 rounded-2xl p-4 transition-all hover:border-teal-300">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.digitalPlatforms}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, digitalPlatforms: e.target.checked }))
                          }
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            استخدام المنصات الرقمية
                          </span>
                          <span className="text-xs text-slate-500">
                            التعامل مع المنصات التعليمية والاجتماعات الافتراضية والخدمات السحابية
                          </span>
                        </div>
                      </label>

                      {skills.digitalPlatforms && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pr-8 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {["منصة مدرستي", "مايكروسوفت تيمز", "Zoom", "نماذج رقمية وسحابية"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setSkills((prev) => ({
                                    ...prev,
                                    digitalPlatformsDetails: prev.digitalPlatformsDetails
                                      ? `${prev.digitalPlatformsDetails}، ${chip}`
                                      : chip,
                                  }))
                                }
                                className="text-[11px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={skills.digitalPlatformsDetails || ""}
                            onChange={(e) =>
                              setSkills((prev) => ({ ...prev, digitalPlatformsDetails: e.target.value }))
                            }
                            placeholder="تحقق سريع: المنصات الرقمية التي تتقن استخدامها"
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      )}
                    </div>

                    {/* 5. مشاركة سابقة في لجان مدرسية أو اجتماعية */}
                    <div className="border border-slate-200 rounded-2xl p-4 transition-all hover:border-teal-300">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skills.previousCommittees}
                          onChange={(e) =>
                            setSkills((prev) => ({ ...prev, previousCommittees: e.target.checked }))
                          }
                          className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <div className="flex-1">
                          <span className="font-extrabold text-sm text-slate-900 block">
                            مشاركة سابقة في لجان مدرسية أو اجتماعية
                          </span>
                          <span className="text-xs text-slate-500">
                            عضوية سابقة في مجالس أولياء الأمور أو لجان الأنشطة والتوجيه الطلابي
                          </span>
                        </div>
                      </label>

                      {skills.previousCommittees && (
                        <div className="mt-3 pt-3 border-t border-slate-100 pr-8 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {["مجلس أولياء أمور سابق", "لجنة شراكة مجتمعية", "لجان أحياء", "لجنة توجيه وإرشاد"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() =>
                                  setSkills((prev) => ({
                                    ...prev,
                                    committeeDetails: prev.committeeDetails
                                      ? `${prev.committeeDetails}، ${chip}`
                                      : chip,
                                  }))
                                }
                                className="text-[11px] font-bold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={skills.committeeDetails || ""}
                            onChange={(e) =>
                              setSkills((prev) => ({ ...prev, committeeDetails: e.target.value }))
                            }
                            placeholder="تحقق سريع: اسم المدرسة أو اللجنة السابقة والعام"
                            className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                          />
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
                    >
                      السابق
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>التالي: الأهداف والضوابط</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: أهدافي من الانضمام وضوابط المادة الثالثة (الصورة 2) */}
              {step === 3 && (
                <div className="space-y-6">
                  
                  {/* Goals Section */}
                  <div>
                    <h2 className="text-base font-black text-slate-900 mb-1">
                      القسم الثالث: أهدافي من الانضمام للمجلس
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      اذكر أبرز الأهداف التي تسعى لتحقيقها من خلال عضويتك في المجلس (٣ أهداف):
                    </p>

                    <div className="space-y-3">
                      {[0, 1, 2].map((idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-900 font-extrabold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            required
                            value={goals[idx]}
                            onChange={(e) => {
                              const newGoals = [...goals] as [string, string, string];
                              newGoals[idx] = e.target.value;
                              setGoals(newGoals);
                            }}
                            placeholder={
                              idx === 0
                                ? "الهدف الأول (أدخل هدفك الشخصي من الانضمام للمجلس...)"
                                : idx === 1
                                ? "الهدف الثاني..."
                                : "الهدف الثالث..."
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mandatory Conditions Check (المادة الثالثة - الصورة 2) */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                      <h3 className="text-xs sm:text-sm font-black text-amber-950 flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-4 h-4 text-amber-700" />
                        <span>المادة (الثالثة): ضوابط العضوية في مجلس أولياء الأمور بالمدارس</span>
                      </h3>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        يتم التحقق من هذه الشروط النظامية لقبول الترشيح واستبعاد من لا تنطبق عليه الضوابط تلقائياً:
                      </p>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compliance.isParentOrStaff}
                          onChange={(e) =>
                            setCompliance((prev) => ({ ...prev, isParentOrStaff: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <span className="text-xs font-bold text-slate-800 leading-relaxed">
                          1. أن يكون ولي أمر لطالب أو أكثر مُسجل بالمدرسة أو عضواً بالهيئة التعليمية بالمدرسة.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compliance.commitmentToAttend}
                          onChange={(e) =>
                            setCompliance((prev) => ({ ...prev, commitmentToAttend: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <span className="text-xs font-bold text-slate-800 leading-relaxed">
                          2. الالتزام بحضور اجتماعات المجلس والمشاركة الفاعلة في أعماله.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compliance.notMemberInOtherSchool}
                          onChange={(e) =>
                            setCompliance((prev) => ({ ...prev, notMemberInOtherSchool: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <span className="text-xs font-bold text-slate-800 leading-relaxed">
                          3. ألا يجمع بين عضوية مجلسين من مجالس أولياء الأمور بالمدارس.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compliance.hasKidsInOtherSchoolsOnlyOneCouncil}
                          onChange={(e) =>
                            setCompliance((prev) => ({
                              ...prev,
                              hasKidsInOtherSchoolsOnlyOneCouncil: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <span className="text-xs font-bold text-slate-800 leading-relaxed">
                          5. إذا كان لدي أبناء في أكثر من مدرسة، التزم بعضوية مجلس مدرسة واحدة فقط واعتماد ما تم قبوله أولاً.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compliance.goodConductAndNoLegalJudgments}
                          onChange={(e) =>
                            setCompliance((prev) => ({
                              ...prev,
                              goodConductAndNoLegalJudgments: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                        />
                        <span className="text-xs font-bold text-slate-800 leading-relaxed">
                          6. أن أكون حسن السيرة والسلوك، وألا يكون قد صدر بحقي حكم قضائي نهائي بحد أو قصاص أو سجن يزيد على سنة أو إدانة بجرائم مخلة بالشرف والأمانة وفق نص المادة (3).
                        </span>
                      </label>

                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
                    >
                      السابق
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>التالي: التعهد والتوقيع</span>
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: التعهد والتوقيع والاعتماد */}
              {step === 4 && (
                <div className="space-y-6">
                  
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-teal-700" />
                      <span>القسم الرابع: التعهد الرسمي والتوقيع</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      الإقرار النهائي واعتماد الاستمارة الرسمية
                    </p>
                  </div>

                  {/* Official Pledge Box (مطابق لنص الصورة 1) */}
                  <div
                    id="field-pledgeAccepted"
                    className={`p-5 rounded-2xl border-2 transition-all scroll-mt-24 ${
                      fieldErrors.pledgeAccepted
                        ? "bg-rose-50/80 border-rose-400 ring-2 ring-rose-200"
                        : "bg-teal-50/70 border-teal-600/30"
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pledgeAccepted}
                        onChange={(e) => {
                          setPledgeAccepted(e.target.checked);
                          if (fieldErrors.pledgeAccepted) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.pledgeAccepted;
                              return copy;
                            });
                          }
                        }}
                        className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500 mt-0.5"
                      />
                      <div>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 block leading-relaxed">
                          تعهد: أتعهد بالالتزام بحضور الاجتماعات، والتفاعل الإيجابي، والتقيد بالمهام والضوابط التنظيمية الخاصة بمجلس أولياء الأمور.
                        </span>
                        <span className="text-[11px] text-teal-800 mt-1 block">
                          تُسلَّم الاستمارة لإدارة المدرسة ضمن المدة المحددة في إعلان الترشيح، وتحفظ ضمن ملف الترشيحات الرسمي.
                        </span>
                      </div>
                    </label>
                    {fieldErrors.pledgeAccepted && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-2.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{fieldErrors.pledgeAccepted}</span>
                      </div>
                    )}
                  </div>

                  {/* Signature and Hijri Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div id="field-signature" className="scroll-mt-24 space-y-1.5">
                      <label className="block text-xs font-extrabold text-slate-700">
                        التوقيع المعتمد (الاسم أو التوقيع الرقمي) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={signature || fullName}
                        onChange={(e) => {
                          setSignature(e.target.value);
                          if (fieldErrors.signature) {
                            setFieldErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.signature;
                              return copy;
                            });
                          }
                        }}
                        placeholder="اكتب اسمك الكامل كتوقيع إلكتروني رسمي"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold focus:outline-hidden transition-all ${
                          fieldErrors.signature
                            ? "border-rose-500 bg-rose-50/30 text-rose-900 ring-2 ring-rose-200 focus:ring-rose-500"
                            : "border-slate-300 text-slate-900 focus:ring-2 focus:ring-teal-600"
                        }`}
                      />
                      {fieldErrors.signature && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-1 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>{fieldErrors.signature}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        تاريخ تقديم الطلب (هجري)
                      </label>
                      <input
                        type="text"
                        value={submissionDateHijri}
                        onChange={(e) => setSubmissionDateHijri(e.target.value)}
                        placeholder="1447/03/15هـ"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
                    >
                      السابق
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !pledgeAccepted}
                      className="px-6 sm:px-8 py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-98 flex items-center gap-2 cursor-pointer min-h-[44px]"
                      id="btn-submit-parent-council-application"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>جارٍ تسليم الاستمارة لإدارة المدرسة...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>تسليم الاستمارة رسمياً لإدارة المدرسة</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </form>
          </div>
        )}

      </main>

    </div>
  );
}
