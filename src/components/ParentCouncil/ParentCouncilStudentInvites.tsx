import React, { useState, useMemo, useRef } from "react";
import {
  Send,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
  Phone,
  UserCheck,
  ShieldCheck,
  Play,
  Square,
  Sparkles,
  Users,
  CheckSquare,
  SquareMinus,
  KeyRound,
  FileCheck,
  MessageSquare,
  Lock,
  Unlock,
} from "lucide-react";
import { Student, SchoolSignatories } from "../../types";
import { ParentCouncilApplication } from "../../types/parentCouncil";
import UnifiedCampaignModal from "../common/UnifiedCampaignModal";
import CampaignLaunchButtons from "../common/CampaignLaunchButtons";
import { launchOfficialCampaign } from "../../utils/campaignLauncher";

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
  isSubmitted?: boolean;
}

// Deterministic stable code/token per student ID (fixed, stable, unique per student/parent)
export const getStableCodeForStudent = (studentId: string | number): string => {
  let hash = 0;
  const str = `pc_salt_abna_${studentId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const codeNum = 100000 + (hash % 900000);
  return codeNum.toString();
};

export const getStableTokenForStudent = (studentId: string | number): string => {
  let hash = 0;
  const str = `tok_pc_${studentId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 37 + str.charCodeAt(i)) >>> 0;
  }
  return `pc_${studentId}_${hash.toString(36)}`;
};

interface ParentCouncilStudentInvitesProps {
  students: Student[];
  schoolSignatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToWhatsApp?: () => void;
  onNavigateToMessages?: (tab?: string) => void;
  applications: Record<string, ParentCouncilApplication>;
  invites: Record<string, ParentCouncilInvite>;
  onUpdateInvites: (newInvites: Record<string, ParentCouncilInvite>) => void;
  showToast: (msg: string) => void;
  isSurveyClosed?: boolean;
  onToggleSurveyStatus?: () => void;
}

export default function ParentCouncilStudentInvites({
  students,
  schoolSignatories,
  isWhatsAppConnected,
  onNavigateToWhatsApp,
  onNavigateToMessages,
  applications,
  invites,
  onUpdateInvites,
  showToast,
  isSurveyClosed = false,
  onToggleSurveyStatus,
}: ParentCouncilStudentInvitesProps) {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "NOT_INVITED" | "INVITED" | "SUBMITTED">("ALL");

  // Selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const DEFAULT_PARENT_COUNCIL_TEMPLATE =
    `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ {اسم_الطالب} ({الصف})،\n\nحرصاً من إدارة {المدرسة} على تفعيل الشراكة والتكامل بين البيت والمدرسة، يسرنا دعوتكم للترشح لعضوية "مجلس أولياء الأمور" للعام الدراسي الحالي.\n\nرابط استمارة الترشح الخاصة بكم:\n{الرابط}\n\nرمز التفعيل الخاص بكم: {رمز_التفعيل}\n\nنأمل التكرم بالدخول وتعبئة الاستمارة، شاكرين ومقدرين كريم تعاونكم،،\nإدارة المدرسة`;

  // Message Template with localStorage persistence
  const [messageTemplate, setMessageTemplate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("parent_council_invite_template");
      if (saved && saved.trim()) return saved;
    }
    return DEFAULT_PARENT_COUNCIL_TEMPLATE;
  });

  const handleTemplateChange = (val: string) => {
    setMessageTemplate(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("parent_council_invite_template", val);
    }
  };

  const handleResetTemplate = () => {
    setMessageTemplate(DEFAULT_PARENT_COUNCIL_TEMPLATE);
    if (typeof window !== "undefined") {
      localStorage.setItem("parent_council_invite_template", DEFAULT_PARENT_COUNCIL_TEMPLATE);
    }
    showToast("تمت استعادة صيغة الرسالة الافتراضية بنجاح.");
  };

  // Batch Sending Progress
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    total: number;
    sentCount: number;
    failedCount: number;
    countdownSeconds: number;
    currentStudentName: string;
    logs: Array<{
      id: string;
      studentName: string;
      phone: string;
      code: string;
      status: "success" | "failed";
      message?: string;
      error?: string;
      time: string;
    }>;
  }>({
    isRunning: false,
    total: 0,
    sentCount: 0,
    failedCount: 0,
    countdownSeconds: 0,
    currentStudentName: "",
    logs: [],
  });

  const abortBatchRef = useRef(false);

  // Derive distinct Grades and Classes from students
  const distinctGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const g = s.grade || (s as any)["الصف"];
      if (g) set.add(String(g).trim());
    });
    return Array.from(set);
  }, [students]);

  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const g = s.grade || (s as any)["الصف"];
      if (selectedGrade === "ALL" || String(g).trim() === selectedGrade) {
        const c = s.className || (s as any)["الفصل"] || (s as any)["الشعبة"];
        if (c) set.add(String(c).trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, selectedGrade]);

  // Submission map by studentId
  const submittedStudentIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(applications).forEach((app) => {
      if (app.studentId) set.add(app.studentId);
    });
    return set;
  }, [applications]);

  // Helper to get or create an invite
  const getOrCreateInvite = (student: Student): ParentCouncilInvite => {
    if (invites[student.id]) {
      return invites[student.id];
    }
    const studentName = student.name || (student as any)["اسم الطالب"] || "طالب";
    const studentPhone = student.phone || (student as any)["رقم الجوال"] || "";
    const studentGrade = student.grade || (student as any)["الصف"] || "الأول ثانوي";
    const studentClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "1";

    // Stable deterministic code and token per student (never random, never flickers)
    const code = getStableCodeForStudent(student.id);
    const token = getStableTokenForStudent(student.id);

    return {
      studentId: student.id,
      studentName,
      studentGrade,
      studentClass,
      guardianPhone: studentPhone,
      code,
      token,
      isSent: false,
      createdAt: new Date().toISOString(),
    };
  };

  // Helper to construct invite link
  const buildInviteUrl = (token: string, code: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?portal=parent-council&parent_council=true&council_token=${token}&token=${token}`;
  };

  // Filter students based on user selection
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const sName = student.name || (student as any)["اسم الطالب"] || "";
      const sGrade = student.grade || (student as any)["الصف"] || "";
      const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";
      const sPhone = student.phone || (student as any)["رقم الجوال"] || "";

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          sName.toLowerCase().includes(q) ||
          sPhone.includes(q) ||
          sGrade.toLowerCase().includes(q) ||
          String(sClass).includes(q) ||
          String(student.id).includes(q);
        if (!matches) return false;
      }

      // Grade Filter
      if (selectedGrade !== "ALL" && String(sGrade).trim() !== selectedGrade) {
        return false;
      }

      // Class Filter
      if (selectedClass !== "ALL" && String(sClass).trim() !== selectedClass) {
        return false;
      }

      const invite = invites[student.id];
      const isSubmitted = submittedStudentIds.has(student.id);

      if (statusFilter === "NOT_INVITED" && invite?.isSent) return false;
      if (statusFilter === "INVITED" && !invite?.isSent) return false;
      if (statusFilter === "SUBMITTED" && !isSubmitted) return false;

      return true;
    });
  }, [students, searchQuery, selectedGrade, selectedClass, statusFilter, invites, submittedStudentIds]);

  // Bulk Selection Handlers
  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...allFilteredIds])));
  };

  const handleDeselectAllFiltered = () => {
    const allFilteredIds = new Set(filteredStudents.map((s) => s.id));
    setSelectedStudentIds(selectedStudentIds.filter((id) => !allFilteredIds.has(id)));
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Regenerate Code for a student
  const handleRegenerateCode = (student: Student) => {
    const current = getOrCreateInvite(student);
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const updated: Record<string, ParentCouncilInvite> = {
      ...invites,
      [student.id]: {
        ...current,
        code: newCode,
      },
    };
    onUpdateInvites(updated);
    showToast(`تم توليد رمز تفعيل جديد لولي أمر الطالب (${student.name}): ${newCode}`);
  };

  // Helper to build WhatsApp Message text for a student
  const buildStudentMessage = (student: Student, invite: ParentCouncilInvite) => {
    const sName = student.name || (student as any)["اسم الطالب"] || (student as any)["الاسم"] || "الطالب";
    const sGrade = student.grade || (student as any)["الصف"] || (student as any)["رقم الصف"] || "";
    const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";
    const url = buildInviteUrl(invite.token, invite.code);

    const templateToUse =
      (messageTemplate && messageTemplate.trim()) || DEFAULT_PARENT_COUNCIL_TEMPLATE;

    const classLabel = sGrade
      ? `${sGrade}${sClass ? ` - شعبة ${sClass}` : ""}`
      : sClass
      ? `شعبة ${sClass}`
      : "";

    return templateToUse
      .replace(/{المدرسة}/g, schoolSignatories?.schoolName || "ثانوية الأبناء الأولى")
      .replace(/{اسم_الطالب}/g, sName)
      .replace(/{الطالب}/g, sName)
      .replace(/{الصف}/g, classLabel)
      .replace(/{الفصل}/g, sClass)
      .replace(/{الشعبة}/g, sClass)
      .replace(/{الرابط}/g, url)
      .replace(/{رابط}/g, url)
      .replace(/{رمز_التفعيل}/g, invite.code)
      .replace(/{رمز}/g, invite.code)
      .replace(/{الرمز}/g, invite.code)
      .replace(/{كود}/g, invite.code);
  };

  // Single Send WhatsApp Handler
  const handleSendSingleWhatsApp = async (student: Student) => {
    const invite = getOrCreateInvite(student);
    const sName = student.name || (student as any)["اسم الطالب"] || "الطالب";
    const sPhone = student.phone || (student as any)["رقم الجوال"] || "";
    const sGrade = student.grade || (student as any)["الصف"] || "";
    const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";

    if (!sPhone) {
      alert(`لا يوجد رقم جوال مسجل للطالب (${sName}).`);
      return;
    }

    const message = buildStudentMessage(student, invite);

    try {
      showToast(`جارٍ إرسال الدعوة لولي أمر الطالب: ${sName}...`);
      const res = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: sPhone,
          message,
          studentName: sName,
          grade: sGrade,
          className: sClass,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updatedInvites = {
          ...invites,
          [student.id]: {
            ...invite,
            isSent: true,
            sentAt: new Date().toISOString(),
          },
        };
        onUpdateInvites(updatedInvites);
        showToast(`✓ تم إرسال رسالة الدعوة ورمز التفعيل بنجاح لـ ${sName}`);
      } else {
        throw new Error(data.error || "فشل الإرسال عبر الخادم");
      }
    } catch (err: any) {
      // Fallback: open WhatsApp web directly and record invite as sent
      const updatedInvites = {
        ...invites,
        [student.id]: {
          ...invite,
          isSent: true,
          sentAt: new Date().toISOString(),
        },
      };
      onUpdateInvites(updatedInvites);

      const cleanP = sPhone.replace(/\D/g, "");
      const finalP = cleanP.startsWith("05") ? "966" + cleanP.substring(1) : cleanP;
      window.open(`https://api.whatsapp.com/send?phone=${finalP}&text=${encodeURIComponent(message)}`, "_blank");
      showToast(`تم فتح تطبيق واتساب لإرسال الرسالة وتسجيلها في سجل الرسائل المرسلة.`);
    }
  };

  // Copy Direct Link & Message
  const handleCopyStudentMessage = (student: Student) => {
    const invite = getOrCreateInvite(student);
    const msg = buildStudentMessage(student, invite);
    navigator.clipboard.writeText(msg);
    showToast(`تم نسخ رسالة الدعوة الخاصة بـ (${student.name}) برابط التفعيل ورمز التفعيل.`);
  };

  // Prepare recipients for UnifiedCampaignModal
  const modalRecipients = useMemo(() => {
    const currentInvites = { ...invites };
    return students
      .filter((s) => selectedStudentIds.includes(s.id))
      .map((student) => {
        let invite = currentInvites[student.id];
        if (!invite) {
          invite = getOrCreateInvite(student);
        }
        const sName = student.name || (student as any)["اسم الطالب"] || (student as any)["الاسم"] || "طالب";
        const sPhone =
          student.phone ||
          (student as any)["رقم الجوال"] ||
          (student as any)["الجوال"] ||
          (student as any)["هاتف ولي الأمر"] ||
          (student as any)["جوال ولي الأمر"] ||
          "";
        const sGrade = student.grade || (student as any)["الصف"] || (student as any)["رقم الصف"] || "";
        const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";
        const message = buildStudentMessage(student, invite);
        return {
          id: student.id,
          name: sName,
          phone: sPhone,
          grade: sGrade,
          className: sClass,
          message,
          customMessage: message,
        };
      });
  }, [students, selectedStudentIds, invites, messageTemplate]);

  // Option 2: Launch as Official Campaign into Campaign Monitor
  const handleLaunchAsOfficialCampaign = async () => {
    if (selectedStudentIds.length === 0) {
      alert("يرجى تحديد طالب واحد على الأقل لإرسال دعوة الترشح لولي أمره.");
      return;
    }
    const targets = students.filter((s) => selectedStudentIds.includes(s.id));
    const currentInvites = { ...invites };
    const recipients = targets.map((student) => {
      let invite = currentInvites[student.id];
      if (!invite) {
        invite = getOrCreateInvite(student);
        currentInvites[student.id] = invite;
      }
      return {
        id: student.id,
        name: student.name || (student as any)["اسم الطالب"] || "طالب",
        phone: student.phone || (student as any)["رقم الجوال"] || "",
        grade: student.grade || (student as any)["الصف"] || "",
        className: student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "",
        customMessage: buildStudentMessage(student, invite),
      };
    });

    await launchOfficialCampaign({
      campaignName: `حملة دعوات الترشح لمجلس أولياء الأمور (${new Date().toLocaleDateString("ar-SA")})`,
      recipients,
      delayMs: 15000,
      onNavigateToMessages,
      onSuccess: () => {
        targets.forEach((student) => {
          let inv = currentInvites[student.id];
          if (inv) {
            currentInvites[student.id] = {
              ...inv,
              isSent: true,
              sentAt: new Date().toISOString(),
            };
          }
        });
        onUpdateInvites(currentInvites);
        showToast(`تم إطلاق الحملة بنجاح لـ ${targets.length} طالب`);
      },
    });
  };

  // Batch Send WhatsApp with 15s delay + jitter
  const handleStartBatchWhatsApp = async () => {
    if (selectedStudentIds.length === 0) {
      alert("يرجى تحديد طالب واحد على الأقل لإرسال دعوة الترشح لولي أمره.");
      return;
    }

    const candidates = students.filter((s) => selectedStudentIds.includes(s.id));
    if (candidates.length === 0) return;

    abortBatchRef.current = false;
    setBatchProgress({
      isRunning: true,
      total: candidates.length,
      sentCount: 0,
      failedCount: 0,
      countdownSeconds: 0,
      currentStudentName: "",
      logs: [],
    });

    let sent = 0;
    let failed = 0;
    const currentInvites = { ...invites };

    for (let i = 0; i < candidates.length; i++) {
      if (abortBatchRef.current) break;

      const student = candidates[i];
      const sName = student.name || (student as any)["اسم الطالب"] || "طالب";
      const sPhone = student.phone || (student as any)["رقم الجوال"] || "";
      const sGrade = student.grade || (student as any)["الصف"] || "";
      const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";

      setBatchProgress((prev) => ({
        ...prev,
        currentStudentName: sName,
      }));

      // Ensure invite exists with unique code
      let invite = currentInvites[student.id];
      if (!invite) {
        invite = getOrCreateInvite(student);
        currentInvites[student.id] = invite;
      }

      const message = buildStudentMessage(student, invite);
      const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

      if (!sPhone) {
        failed++;
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName: sName,
              phone: "—",
              code: invite.code,
              status: "failed",
              error: "لا يوجد رقم جوال مسجل",
              time: nowTime,
            },
            ...prev.logs,
          ],
        }));
        continue;
      }

      try {
        const res = await fetch("/api/whatsapp/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: sPhone,
            message,
            studentName: sName,
            grade: sGrade,
            className: sClass,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          sent++;
          currentInvites[student.id] = {
            ...invite,
            isSent: true,
            sentAt: new Date().toISOString(),
          };

          setBatchProgress((prev) => ({
            ...prev,
            sentCount: sent,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName: sName,
                phone: sPhone,
                code: invite.code,
                status: "success",
                message: "تم الإرسال بنجاح عبر الواتساب",
                time: nowTime,
              },
              ...prev.logs,
            ],
          }));
        } else {
          failed++;
          setBatchProgress((prev) => ({
            ...prev,
            failedCount: failed,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName: sName,
                phone: sPhone,
                code: invite.code,
                status: "failed",
                error: data.error || "فشل الإرسال عبر الخادم",
                time: nowTime,
              },
              ...prev.logs,
            ],
          }));
        }
      } catch (err: any) {
        failed++;
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName: sName,
              phone: sPhone,
              code: invite.code,
              status: "failed",
              error: err.message || "خطأ في الشبكة",
              time: nowTime,
            },
            ...prev.logs,
          ],
        }));
      }

      // Safe 15-second Anti-Ban Delay with human-like jitter variation (between 14s and 18s)
      if (i < candidates.length - 1 && !abortBatchRef.current) {
        const jitterSecs = Math.floor(Math.random() * 4) - 1; // -1 to +2
        const totalDelaySecs = Math.max(14, 15 + jitterSecs);

        for (let countdown = totalDelaySecs; countdown > 0; countdown--) {
          if (abortBatchRef.current) break;
          setBatchProgress((prev) => ({
            ...prev,
            countdownSeconds: countdown,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Save state & sync
    onUpdateInvites(currentInvites);

    setBatchProgress((prev) => ({
      ...prev,
      isRunning: false,
      countdownSeconds: 0,
    }));

    if (!abortBatchRef.current) {
      showToast(`✓ اكتمل إرسال دعوات الترشح بنجاح إلى (${sent}) ولي أمر.`);
    } else {
      showToast(`تم إيقاف الإرسال مؤقتاً.`);
    }
  };

  const handleAbortBatch = () => {
    abortBatchRef.current = true;
    setBatchProgress((prev) => ({
      ...prev,
      isRunning: false,
      countdownSeconds: 0,
    }));
    showToast("تم إيقاف الإرسال الجماعي.");
  };

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.id));

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Banner: Context & WhatsApp Status */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <Send className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>تحديد الطلاب وإرسال روابط الترشح لأولياء الأمور</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-200">
                  رمز تفعيل فريد لكل ولي أمر
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تحديد الطلاب بالبحث أو بتحديد الصف والشعبة، وإرسال رابط الاستمارة مع الفاصل الزمني الآمن (15 ثانية) لتفادي الحظر.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* Survey Status Toggle Button */}
            {onToggleSurveyStatus && (
              <button
                type="button"
                onClick={onToggleSurveyStatus}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer border transition-colors ${
                  isSurveyClosed
                    ? "bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200"
                    : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                }`}
                title={isSurveyClosed ? "الاستبيان موقوف حالياً، اضغط لإعادة الفتح" : "الاستبيان متاح، اضغط لإيقاف استقبال الاستبيانات"}
              >
                {isSurveyClosed ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-700" />
                    <span>الاستبيان موقوف (اضغط للفتح)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>الاستبيان متاح (اضغط للإيقاف)</span>
                  </>
                )}
              </button>
            )}

            {!isWhatsAppConnected ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>الواتساب غير متصل</span>
                {onNavigateToWhatsApp && (
                  <button
                    type="button"
                    onClick={onNavigateToWhatsApp}
                    className="underline text-amber-950 font-black cursor-pointer hover:text-amber-700 mr-1"
                  >
                    ربط الآن
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>الواتساب متصل وجاهز</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Survey Closed Warning Banner */}
      {isSurveyClosed && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-rose-950 flex items-center gap-2">
                <span>الاستبيان مغلق حالياً بقرار من إدارة المدرسة</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-extrabold">
                  موقوف لجميع أولياء الأمور
                </span>
              </div>
              <div className="text-xs text-rose-800 mt-0.5">
                لن يتمكن أي ولي أمر من فتح الاستبيان أو تقديم الاستمارة حتى تقوم الإدارة بإعادة فتحه.
              </div>
            </div>
          </div>
          {onToggleSurveyStatus && (
            <button
              type="button"
              onClick={onToggleSurveyStatus}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shrink-0 cursor-pointer shadow-xs transition-all flex items-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              <span>إعادة فتح الاستبيان الآن</span>
            </button>
          )}
        </div>
      )}

      {/* Progress Card during Batch Sending */}
      {batchProgress.isRunning && (
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl border border-slate-700 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
            <div>
              <div className="text-xs font-black text-teal-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping" />
                <span>جارٍ إرسال دعوات الترشح لأولياء الأمور...</span>
              </div>
              <div className="text-sm font-extrabold text-white mt-1">
                الطالب الحالي: {batchProgress.currentStudentName || "..."}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {batchProgress.countdownSeconds > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-950/80 border border-teal-500/40 text-xs font-mono text-teal-200">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>فاصل زمني آمن: {batchProgress.countdownSeconds}ث</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAbortBatch}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>إيقاف الإرسال</span>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>تم الإرسال: {batchProgress.sentCount} من {batchProgress.total}</span>
              <span>فشل: {batchProgress.failedCount}</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-l from-teal-400 to-emerald-500 transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round(((batchProgress.sentCount + batchProgress.failedCount) / Math.max(1, batchProgress.total)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Message Template Editor Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-700" />
            <span>صيغة رسالة الدعوة عبر واتساب (تحتوي على الرابط المباشر ورمز التفعيل الخاص)</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
            >
              استعادة الصيغة الافتراضية
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-400">
              يتم استبدال المتغيرات تلقائياً لكل طالب
            </span>
          </div>
        </div>

        <div>
          <textarea
            rows={5}
            value={messageTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-teal-600 focus:outline-hidden leading-relaxed"
          />
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 mt-2 font-mono">
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">&#123;اسم_الطالب&#125;</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">&#123;الصف&#125;</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">&#123;الرابط&#125;</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">&#123;رمز_التفعيل&#125;</span>
            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">&#123;المدرسة&#125;</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (طريقة الاستعلام ونظام الغياب تماماً) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search by Student Name / Phone */}
          <div className="relative">
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              البحث باسم الطالب أو الجوال:
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اكتب اسم الطالب للبحث المباشر..."
                className="w-full pl-8 pr-9 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Grade Selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              تحديد الصف الدراسي:
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedClass("ALL");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white"
            >
              <option value="ALL">جميع المراحل والصفوف ({distinctGrades.length})</option>
              {distinctGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Class / Section Selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              تحديد الشعبة / الفصل:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white"
            >
              <option value="ALL">جميع الشعب ({distinctClasses.length})</option>
              {distinctClasses.map((c) => (
                <option key={c} value={c}>
                  شعبة {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              حالة الدعوة والاستمارة:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-hidden bg-white"
            >
              <option value="ALL">الكل ({students.length})</option>
              <option value="NOT_INVITED">لم تُرسل الدعوة بعد</option>
              <option value="INVITED">تم إرسال الدعوة</option>
              <option value="SUBMITTED">تم تقديم الاستمارة بالفعل</option>
            </select>
          </div>

        </div>

        {/* Selection Actions Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer border ${
                allFilteredSelected
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
              }`}
            >
              {allFilteredSelected ? <SquareMinus className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
              <span>{allFilteredSelected ? "إلغاء تحديد المعروض" : "تحديد كافة الطلاب المعروضين"}</span>
            </button>

            {selectedStudentIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
              >
                إلغاء التحديد ({selectedStudentIds.length})
              </button>
            )}
          </div>

          {/* Standardized Dual Campaign Launch Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <CampaignLaunchButtons
              count={selectedStudentIds.length}
              recipientLabel="طالب"
              intervalSeconds={15}
              onLaunchModal={() => setIsBatchModalOpen(true)}
              onLaunchOfficialCampaign={handleLaunchAsOfficialCampaign}
              disabled={selectedStudentIds.length === 0}
              customModalLabel={`إرسال حملة جماعية (${selectedStudentIds.length} طالب) - بفاصل 15 ثانية`}
              customOfficialLabel="نظام الحملات الجماعية"
              modalButtonId="btn-batch-send-parent-council-modal"
              officialButtonId="btn-batch-send-parent-council-official"
            />
          </div>

        </div>

      </div>

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-black text-slate-800">
            قائمة الطلاب المستهدفين: {filteredStudents.length} طالب
          </div>
          <div className="text-[11px] text-slate-400">
            لكل ولي أمر رمز تفعيل ورابط مخصص يتم تحديثهما وحفظهما تلقائياً
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            لا توجد بيانات مطابقة لمعايير البحث والتصفية الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={allFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">اسم الطالب</th>
                  <th className="p-3">الصف والشعبة</th>
                  <th className="p-3">رقم الجوال</th>
                  <th className="p-3 text-center">حالة الدعوة</th>
                  <th className="p-3 text-center">الاستمارة</th>
                  <th className="p-3 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const sName = student.name || (student as any)["اسم الطالب"] || "طالب";
                  const sGrade = student.grade || (student as any)["الصف"] || "";
                  const sClass = student.className || (student as any)["الفصل"] || (student as any)["الشعبة"] || "";
                  const sPhone = student.phone || (student as any)["رقم الجوال"] || "";
                  const isSelected = selectedStudentIds.includes(student.id);
                  const invite = getOrCreateInvite(student);
                  const isSubmitted = submittedStudentIds.has(student.id);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? "bg-teal-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>

                      {/* Student Name */}
                      <td className="p-3 min-w-[180px] max-w-[320px]">
                        <div className="font-extrabold text-slate-900 break-words whitespace-normal leading-snug">
                          {sName}
                        </div>
                        {student.id && (
                          <div className="text-[10px] text-slate-400 font-mono">ID: {student.id}</div>
                        )}
                      </td>

                      {/* Grade & Section */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{sGrade}</span>
                        {sClass && <span className="text-slate-500 mr-1">(شعبة {sClass})</span>}
                      </td>

                      {/* Phone */}
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap" dir="ltr">
                        {sPhone || <span className="text-slate-400 italic">غير مسجل</span>}
                      </td>

                      {/* Invitation Status */}
                      <td className="p-3 text-center">
                        {invite.isSent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>تم الإرسال</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>لم تُرسل</span>
                          </span>
                        )}
                      </td>

                      {/* Submission Status */}
                      <td className="p-3 text-center">
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-300">
                            <FileCheck className="w-3 h-3 text-teal-700" />
                            <span>تم التقديم ✓</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">بانتظار التقديم</span>
                        )}
                      </td>

                      {/* Quick Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Send WhatsApp directly */}
                          <button
                            type="button"
                            onClick={() => handleSendSingleWhatsApp(student)}
                            title="إرسال عبر الواتساب مباشرة"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Copy Message */}
                          <button
                            type="button"
                            onClick={() => handleCopyStudentMessage(student)}
                            title="نسخ رسالة ولي الأمر"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Open Parent Form Preview */}
                          <a
                            href={buildInviteUrl(invite.token, invite.code)}
                            target="_blank"
                            rel="noreferrer"
                            title="معاينة استمارة ولي الأمر"
                            className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 cursor-pointer transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Batch Activity Logs (if any) */}
      {batchProgress.logs.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-700" />
              <span>سجل الإرسال الحديث عبر واتساب</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              {batchProgress.logs.length} عمليات
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
            {batchProgress.logs.map((log) => (
              <div key={log.id} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-extrabold text-slate-900">{log.studentName}</span>
                    <span className="text-slate-400 mx-1.5">|</span>
                    <span className="font-mono text-slate-500" dir="ltr">{log.phone}</span>
                    <span className="text-slate-400 mx-1.5">|</span>
                    <span className="text-teal-700 font-bold font-mono">الرمز: {log.code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${log.status === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                    {log.status === "success" ? "تم بنجاح" : log.error}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standardized Batch Sending Progress Modal */}
      <UnifiedCampaignModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="إرسال دعوات الترشح لمجلس أولياء الأمور عبر الواتساب"
        subtitle={`سيتم إرسال دعوة الترشح المخصصة متضمنة رمز التفعيل والرابط الآمن إلى ${modalRecipients.length} من أولياء الأمور.`}
        recipients={modalRecipients}
        recipientLabel="ولي أمر"
        intervalSeconds={15}
        onSendSingle={async (item) => {
          const sPhone = item.phone || (item as any)["رقم الجوال"] || (item as any).guardianPhone;
          const sMsg = item.customMessage || (item as any).message;
          if (!sPhone || !String(sPhone).trim()) {
            return { success: false, error: "لا يوجد رقم جوال مسجل" };
          }
          if (!sMsg || !String(sMsg).trim()) {
            return { success: false, error: "نص الرسالة غير محدد" };
          }
          try {
            const res = await fetch("/api/whatsapp/send-single", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: sPhone,
                message: sMsg,
                customMessage: sMsg,
                studentName: item.name,
                grade: item.grade,
                className: item.className,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
              return { success: true };
            }
            return { success: false, error: data.error || "تعذر الإرسال عبر الخادم" };
          } catch (err: any) {
            return { success: false, error: err.message || "خطأ في الشبكة" };
          }
        }}
        onItemSuccess={(item) => {
          const currentInvites = { ...invites };
          const inv = currentInvites[item.id] || getOrCreateInvite(students.find((s) => s.id === item.id)!);
          currentInvites[item.id] = {
            ...inv,
            isSent: true,
            sentAt: new Date().toISOString(),
          };
          onUpdateInvites(currentInvites);
        }}
        onComplete={() => {
          showToast("اكتمل إرسال دعوات مجلس أولياء الأمور بنجاح.");
        }}
      />

    </div>
  );
}
