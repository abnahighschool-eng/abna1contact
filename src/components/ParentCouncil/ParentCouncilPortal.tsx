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
} from "../../types/parentCouncil";
import { SchoolSignatories, Student } from "../../types";
import ParentCouncilPrintSheet from "./ParentCouncilPrintSheet";
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

// Helpers for extracting guardian name & detecting siblings
function extractGuardianFullName(student: any): string {
  if (student.guardianName && String(student.guardianName).trim()) {
    return String(student.guardianName).trim();
  }
  if (student["اسم ولي الأمر"] && String(student["اسم ولي الأمر"]).trim()) {
    return String(student["اسم ولي الأمر"]).trim();
  }
  if (student["ولي الأمر"] && String(student["ولي الأمر"]).trim()) {
    return String(student["ولي الأمر"]).trim();
  }
  if (student.guardian && String(student.guardian).trim()) {
    return String(student.guardian).trim();
  }

  // Derive father/guardian name from student's name if 3 or 4 segments
  const rawName = (student.name || student["اسم الطالب"] || "").trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length >= 4) {
    // E.g., "عبدالله محمد إبراهيم الشمري" -> "محمد إبراهيم الشمري"
    return parts.slice(1).join(" ");
  } else if (parts.length === 3) {
    return parts.slice(1).join(" ");
  }
  return rawName;
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
  // Verification states
  const [activationCodeInput, setActivationCodeInput] = useState(initialCode || "");
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

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

  // Goals - MUST be empty by default as per user request: "الاهداف تترك فارغة ولي الامر هو من يعبيها"
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramStudentId = params.get("student_id") || params.get("studentId");
      const paramStudentName = params.get("student_name") || params.get("studentName");
      const paramGrade = params.get("grade") || params.get("student_grade");
      const paramClass = params.get("class") || params.get("student_class");
      const paramPhone = params.get("phone");
      const paramGuardian = params.get("parent_name") || params.get("guardian");
      const paramCode = params.get("code") || params.get("council_code");

      if (paramCode) {
        setActivationCodeInput(paramCode);
        setIsCodeVerified(true);
      }

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
        const sName = matched.name || (matched as any)["اسم الطالب"] || paramStudentName || "";
        const sGrade = matched.grade || (matched as any)["الصف"] || paramGrade || "الأول ثانوي";
        const sClass = matched.className || (matched as any)["الفصل"] || (matched as any)["الشعبة"] || paramClass || "1";
        const sPhone = matched.phone || (matched as any)["رقم الجوال"] || paramPhone || "";

        setStudentName(sName);
        setStudentGrade(sGrade);
        setStudentClass(sClass);
        setStudentId(matched.id || "");
        if (sPhone) setPhone(sPhone);

        const derivedGuardian = extractGuardianFullName(matched);
        if (derivedGuardian) setFullName(derivedGuardian);

        const siblings = findStudentSiblings(matched, loadedStudents);
        setDetectedSiblings(siblings);
      } else {
        if (paramStudentName) setStudentName(paramStudentName);
        if (paramGrade) setStudentGrade(paramGrade);
        if (paramClass) setStudentClass(paramClass);
        if (paramPhone) setPhone(paramPhone);
        if (paramGuardian) setFullName(paramGuardian);
      }
    }

    // 4. Fetch server data for this token if available
    if (token) {
      fetch(`/api/parent-councils/token/${token}`)
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
          if (data.alreadySubmitted && data.application) {
            setAlreadySubmittedApplication(data.application as ParentCouncilApplication);
            setIsCodeVerified(true);
            return;
          }
          if (data.invite) {
            if (data.invite.studentName && !studentName) setStudentName(data.invite.studentName);
            if (data.invite.studentGrade && !studentGrade) setStudentGrade(data.invite.studentGrade);
            if (data.invite.studentClass && !studentClass) setStudentClass(data.invite.studentClass);
            if (data.invite.guardianPhone && !phone) setPhone(data.invite.guardianPhone);
            if (data.invite.studentId && !studentId) setStudentId(data.invite.studentId);
            if (data.invite.code && !activationCodeInput) {
              setActivationCodeInput(data.invite.code);
              setIsCodeVerified(true);
            }
          }
          if (data.application) {
            const app = data.application as ParentCouncilApplication;
            if (app.status === "submitted" || app.status === "approved" || app.status === "disqualified") {
              setAlreadySubmittedApplication(app);
              setIsCodeVerified(true);
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
            setIsCodeVerified(true);
            setActivationCodeInput(app.activationCode || "");
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

    if (!fullName.trim()) {
      setSubmitError("يرجى كتابة الاسم الرباعي لولي الأمر");
      setStep(1);
      return;
    }

    if (!nationalId.trim() || !validateNationalId(nationalId)) {
      setSubmitError("رقم الهوية الوطنية يجب أن يتكون من 10 أرقام صحيحة");
      setStep(1);
      return;
    }

    if (!phone.trim() || !validateSaudiPhone(phone)) {
      setSubmitError("رقم الجوال يجب أن يتكون من 10 أرقام تبدأ بـ 05");
      setStep(1);
      return;
    }

    if (!email.trim() || !validateEmail(email)) {
      setSubmitError("يرجى إدخال بريد إلكتروني صالح (مثال: name@example.com)");
      setStep(1);
      return;
    }

    if (!studentName.trim()) {
      setSubmitError("يرجى كتابة اسم الطالب");
      setStep(1);
      return;
    }

    if (!pledgeAccepted) {
      setSubmitError("يجب الموافقة على التعهد النظامي المعتمد لإتمام طلب الترشيح");
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
    newApp.status = evaluation.isEligible ? "submitted" : "disqualified";

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

      setSubmittedApplication(data.application || newApp);
    } catch (err: any) {
      // Fallback: save locally in localStorage so work is never lost
      try {
        const localSaved = JSON.parse(localStorage.getItem("parent_councils_apps") || "{}");
        localSaved[newApp.id] = newApp;
        localStorage.setItem("parent_councils_apps", JSON.stringify(localSaved));
        setSubmittedApplication(newApp);
      } catch (e) {
        setSubmitError(err.message || "حدث خطأ أثناء إرسال الاستمارة");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // View 1: Thank You Screen immediately following submission (without redirecting to site)
  if (submittedApplication) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6" dir="rtl">
        <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-l from-teal-800 to-teal-700 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black mb-2">
              شكراً لكم على تعبئة استمارة الترشح
            </h1>
            <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed max-w-lg mx-auto">
              تم استلام طلبكم بنجاح ورفعه إلى إدارة المدرسة، وسيتم مراجعة الطلب والمفاضلة وإشعاركم بالنتائج.
            </p>
          </div>

          {/* Details & Reassurance */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs font-bold leading-relaxed flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">تم تسجيل طلبكم رسمياً</span>
                <span>تم إرسال الطلب لإدارة المدرسة، ولا حاجة لإعادة التعبئة.</span>
              </div>
            </div>

            {/* Summary Data */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-500 border-b border-slate-200 pb-2">
                ملخص بيانات الاستمارة المقدمة:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">اسم ولي الأمر:</span>
                  <span className="font-extrabold text-slate-900">{submittedApplication.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">اسم الطالب:</span>
                  <span className="font-extrabold text-slate-900">{submittedApplication.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الصف والشعبة:</span>
                  <span className="font-bold text-slate-800">
                    {submittedApplication.studentGrade} - الشعبة {submittedApplication.studentClass}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الجوال:</span>
                  <span className="font-mono font-bold text-slate-800">{submittedApplication.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهوية الوطنية:</span>
                  <span className="font-mono font-bold text-slate-800">{submittedApplication.nationalId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">البريد الإلكتروني:</span>
                  <span className="font-mono text-slate-800">{submittedApplication.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاريخ التقديم:</span>
                  <span className="font-bold text-slate-800">{submittedApplication.submissionDateHijri}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم التوثيق المرجعي:</span>
                  <span className="font-mono font-bold text-teal-800">{submittedApplication.id}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex-1 py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>استعراض وطباعة الاستمارة الرسمية</span>
              </button>
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
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6" dir="rtl">
        <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-l from-slate-900 to-teal-900 text-white p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
              <Lock className="w-9 h-9 text-teal-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black mb-2">
              تمت الإجابة على الاستبيان
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-lg mx-auto">
              المكرم ولي الأمر، نود إحاطتكم بأنه قد تمت الإجابة على استمارة الترشح لعضوية مجلس أولياء الأمور للطالب ({alreadySubmittedApplication.studentName}) مسبقاً، وتم إقفال الاستمارة ولا يمكن إعادة الدخول لتعديلها.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-teal-900 text-xs font-bold leading-relaxed flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-teal-700 shrink-0" />
              <div>
                <span className="font-black block text-sm">الاستمارة مقفلة - تم حفظ طلبكم رسمياً</span>
                <span>طلبكم مدرج ضمن ملف الترشيحات للمفاضلة الرسمية لدى إدارة المدرسة.</span>
              </div>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-500 border-b border-slate-200 pb-2">
                بيانات الاستمارة المسجلة:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">اسم ولي الأمر:</span>
                  <span className="font-extrabold text-slate-900">{alreadySubmittedApplication.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">اسم الطالب:</span>
                  <span className="font-extrabold text-slate-900">{alreadySubmittedApplication.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الصف والشعبة:</span>
                  <span className="font-bold text-slate-800">
                    {alreadySubmittedApplication.studentGrade} - الشعبة {alreadySubmittedApplication.studentClass}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الجوال:</span>
                  <span className="font-mono font-bold text-slate-800">{alreadySubmittedApplication.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهوية:</span>
                  <span className="font-mono font-bold text-slate-800">{alreadySubmittedApplication.nationalId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاريخ التقديم:</span>
                  <span className="font-bold text-slate-800">{alreadySubmittedApplication.submissionDateHijri}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم التوثيق المرجعي:</span>
                  <span className="font-mono font-bold text-teal-800">{alreadySubmittedApplication.id}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex-1 py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>استعراض وطباعة نسخة من الاستمارة الرسمية</span>
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
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                مجالس أولياء الأمور في التعليم العام
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                بوابة ترشيح عضوية المجلس بـ {signatories.schoolName || "ثانوية الأبناء الأولى"}
              </p>
            </div>
          </div>

          {onExit && (
            <button
              onClick={onExit}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              خروج
            </button>
          )}

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Step 0: Activation Code Verification Gate */}
        {!isCodeVerified ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-10 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-2">
              رمز التفعيل لترشيح مجلس أولياء الأمور
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
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
                  className="w-full text-center text-xl font-mono font-black tracking-widest py-3 px-4 rounded-2xl bg-slate-50 border-2 border-slate-300 focus:border-teal-600 focus:bg-white focus:outline-hidden transition-all"
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
                className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
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
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
            
            {/* Step Progress Indicators */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-8 py-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { num: 1, label: "بيانات ولي الأمر" },
                  { num: 2, label: "الخبرات والمهارات" },
                  { num: 3, label: "الأهداف والضوابط" },
                  { num: 4, label: "التعهد والاعتماد" },
                ].map((s) => {
                  const isActive = step === s.num;
                  const isDone = step > s.num;
                  return (
                    <button
                      key={s.num}
                      onClick={() => setStep(s.num as any)}
                      className={`text-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? "bg-teal-700 text-white font-black shadow-xs"
                          : isDone
                          ? "bg-teal-50 text-teal-800 font-bold border border-teal-200"
                          : "text-slate-400 font-medium hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-mono">{s.num}</div>
                      <div className="text-[10px] sm:text-xs truncate">{s.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8">
              
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
                    <label className="block text-xs font-extrabold text-slate-800">
                      صفة مقدم الطلب بالنسبة للطالب:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "father", label: "الأب" },
                        { id: "brother", label: "الأخ" },
                        { id: "guardian", label: "الوكيل الشرعي" },
                        { id: "other", label: "صلة قرابة أخرى" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setGuardianRelation(item.id as any);
                            setRelationLabel(item.label);
                            if (item.id !== "father") {
                              setIsEditingGuardianName(true);
                              setTimeout(() => guardianNameInputRef.current?.focus(), 100);
                            }
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            guardianRelation === item.id
                              ? "bg-teal-700 text-white shadow-xs font-black"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Full Name of Guardian */}
                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                          <span>الاسم الرباعي لمقدم الطلب / ولي الأمر</span>
                          <span className="text-rose-600">*</span>
                          {guardianRelation !== "father" && (
                            <span className="text-[11px] font-bold text-teal-700">({relationLabel})</span>
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
                          <span>تعديل الاسم</span>
                        </button>
                      </div>

                      <input
                        ref={guardianNameInputRef}
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="أدخل الاسم الرباعي لولي الأمر كما في الهوية"
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden transition-all ${
                          isEditingGuardianName
                            ? "border-teal-500 bg-white ring-2 ring-teal-100"
                            : "border-slate-300 bg-white"
                        }`}
                      />

                      {/* Notice banner for editable guardian name */}
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                        <span className="text-teal-700 font-black shrink-0">معلومة:</span>
                        <span>
                          اسم ولي الأمر مسجل وجاهز تلقائياً، ويمكنك تعديله مباشرة إذا كان مقدم الطلب غير الأب (كالأخ أو الوكيل الشرعي).
                        </span>
                      </div>
                    </div>

                    {/* National ID */}
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        رقم الهوية الوطنية لولي الأمر <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="10 أرقام تبدأ بـ 1 أو 2"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                        dir="ltr"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        رقم الجوال <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="05xxxxxxxx"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                        dir="ltr"
                      />
                    </div>

                    {/* Email */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        البريد الإلكتروني <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@domain.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                        dir="ltr"
                      />
                    </div>

                    {/* Student Name */}
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        اسم الطالب <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="اسم الطالب المسجل بالمدرسة"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                      />
                    </div>

                    {/* Grade & Section */}
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        الصف الدراسي والشعبة <span className="text-rose-600">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={studentGrade}
                          onChange={(e) => setStudentGrade(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white"
                        >
                          <option value="الأول ثانوي">الأول ثانوي</option>
                          <option value="الثاني ثانوي">الثاني ثانوي</option>
                          <option value="الثالث ثانوي">الثالث ثانوي</option>
                          <option value="المرحلة المتوسطة">المرحلة المتوسطة</option>
                          <option value="المرحلة الابتدائية">المرحلة الابتدائية</option>
                        </select>
                        <input
                          type="text"
                          value={studentClass}
                          onChange={(e) => setStudentClass(e.target.value)}
                          placeholder="الشعبة (مثال: 1)"
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                        />
                      </div>
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
                        if (!fullName.trim()) {
                          setSubmitError("يرجى إدخال الاسم الرباعي لولي الأمر");
                          return;
                        }
                        if (!nationalId.trim() || !validateNationalId(nationalId)) {
                          setSubmitError("رقم الهوية الوطنية يجب أن يتكون من 10 أرقام صحيحة");
                          return;
                        }
                        if (!phone.trim() || !validateSaudiPhone(phone)) {
                          setSubmitError("رقم الجوال يجب أن يتكون من 10 أرقام تبدأ بـ 05");
                          return;
                        }
                        if (!email.trim() || !validateEmail(email)) {
                          setSubmitError("يرجى إدخال بريد إلكتروني صالح (مثال: name@example.com)");
                          return;
                        }
                        if (!studentName.trim()) {
                          setSubmitError("يرجى كتابة اسم الطالب");
                          return;
                        }
                        setSubmitError(null);
                        setStep(2);
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
                  <div className="p-5 bg-teal-50/70 border-2 border-teal-600/30 rounded-2xl">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pledgeAccepted}
                        onChange={(e) => setPledgeAccepted(e.target.checked)}
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
                  </div>

                  {/* Signature and Hijri Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                        التوقيع المعتمد (الاسم أو التوقيع الرقمي) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={signature || fullName}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="اكتب اسمك الكامل كتوقيع إلكتروني رسمي"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                      />
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
                      className="px-8 py-3 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-98 flex items-center gap-2 cursor-pointer"
                      id="btn-submit-parent-council-application"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>جارٍ حفظ واستخراج الاستمارة الرسمية...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>إرسال طلب الترشيح واستعراض الاستمارة الرسمية</span>
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
