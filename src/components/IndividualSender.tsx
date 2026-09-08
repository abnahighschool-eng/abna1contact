import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  User,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  AlertCircle,
  Link2,
  Smartphone,
  Search,
  Filter,
  Users,
  GraduationCap,
  School,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  X,
  Sparkles,
  CheckSquare,
  Square,
  Trash2,
  BookOpen,
  Briefcase
} from "lucide-react";
import { Student, Teacher } from "../types";
import UnifiedCampaignModal from "./UnifiedCampaignModal";
import { CampaignRecipientItem } from "../utils/campaignLauncher";

interface IndividualSenderProps {
  students?: Student[];
  teachers?: Teacher[];
  isWhatsAppConnected: boolean;
  onNavigateToConnection?: () => void;
}

interface SentIndividualLog {
  id: string;
  recipientName?: string;
  phone: string;
  message: string;
  timestamp: string;
  status: "success" | "failed";
  error?: string;
}

// Utility: Normalize phone
function cleanPhoneNumber(phoneStr?: string): string {
  if (!phoneStr) return "";
  return String(phoneStr).replace(/[^\d+]/g, "").trim();
}

// Utility: Extract student name
function getStudentName(student: any): string {
  if (!student) return "";
  const keys = [
    "name", "studentName", "اسم الطالب", "اسم_الطالب", "اسم الطالب رباعي",
    "اسم الطالب ثلاثي", "الاسم", "اسم_الطالب_رباعي", "اسم_الطالب_ثلاثي", "طالب"
  ];
  for (const k of keys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return String(student[k]).trim();
    }
  }
  for (const [k, v] of Object.entries(student)) {
    if (v && typeof v !== "object" && (k.includes("اسم") || k.toLowerCase().includes("name"))) {
      return String(v).trim();
    }
  }
  return "";
}

// Utility: Extract student phone
function getStudentPhone(student: any): string {
  if (!student) return "";
  const keys = [
    "phone", "mobile", "رقم الجوال", "جوال", "الجوال", "الهاتف", "رقم الهاتف",
    "هاتف", "رقم_الجوال", "رقم_الهاتف", "جوال ولي الأمر", "جوال_ولي_الأمر",
    "جوال ولي الامر", "جوال_ولي_الامر", "هاتف ولي الأمر", "هاتف_ولي_الأمر",
    "هاتف ولي الامر", "هاتف_ولي_الامر", "رقم جوال ولي الامر", "رقم جوال ولي الأمر",
    "جوال الأب", "جوال الاب", "جوال الأم", "جوال الام", "هاتف المنزل"
  ];
  for (const k of keys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return cleanPhoneNumber(String(student[k]));
    }
  }
  for (const [k, v] of Object.entries(student)) {
    if (v && typeof v !== "object") {
      const lower = k.toLowerCase();
      if (k.includes("جوال") || k.includes("هاتف") || lower.includes("phone") || lower.includes("mobile")) {
        return cleanPhoneNumber(String(v));
      }
    }
  }
  return "";
}

// Utility: Extract student grade
function getStudentGrade(student: any): string {
  if (!student) return "";
  const keys = ["grade", "الصف", "المرحلة", "المستوى", "الصف الدراسي", "المرحلة الدراسية"];
  for (const k of keys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return String(student[k]).trim();
    }
  }
  return "";
}

// Utility: Extract student class/section
function getStudentClass(student: any): string {
  if (!student) return "";
  const keys = ["className", "class", "الفصل", "الشعبة", "الصف/الفصل", "الفصل الدراسي"];
  for (const k of keys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return String(student[k]).trim();
    }
  }
  return "";
}

export default function IndividualSender({
  students = [],
  teachers = [],
  isWhatsAppConnected,
  onNavigateToConnection,
}: IndividualSenderProps) {
  // Manual Input State
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [message, setMessage] = useState("");

  // Target Filter & Selection States: Students
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isStudentListOpen, setIsStudentListOpen] = useState(true);

  // Target Filter & Selection States: Teachers
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false);

  // Anti-ban interval & jitter settings
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [enableJitter, setEnableJitter] = useState(true);

  // Modal batch sending state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; text: string }>({
    type: "idle",
    text: "",
  });
  const [history, setHistory] = useState<SentIndividualLog[]>([]);

  // Load local history
  useEffect(() => {
    const saved = localStorage.getItem("whatsapp_individual_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse individual history:", e);
      }
    }
  }, []);

  // Save to history helper
  const addLogToHistory = (newLogs: SentIndividualLog[]) => {
    setHistory((prev) => {
      const updated = [...newLogs, ...prev];
      localStorage.setItem("whatsapp_individual_history", JSON.stringify(updated.slice(0, 200)));
      return updated;
    });
  };

  // Extract unique available grades
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => {
      const g = getStudentGrade(st);
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [students]);

  // Extract unique available classes for selected grade
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => {
      const g = getStudentGrade(st);
      if (selectedGrade === "ALL" || g === selectedGrade) {
        const c = getStudentClass(st);
        if (c) set.add(c);
      }
    });
    return Array.from(set).sort();
  }, [students, selectedGrade]);

  // Filtered students list based on Grade, Class/Section, and Search query
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const name = getStudentName(st);
      const phone = getStudentPhone(st);
      const grade = getStudentGrade(st);
      const className = getStudentClass(st);
      const nationalId = st.nationalId || st["رقم الهوية"] || st["السجل المدني"] || st.id || "";

      // Grade filter
      if (selectedGrade !== "ALL" && grade !== selectedGrade) {
        return false;
      }

      // Class/Section filter
      if (selectedClass !== "ALL" && className !== selectedClass) {
        return false;
      }

      // Search Query filter
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase().trim();
        const matchesName = name.toLowerCase().includes(q);
        const matchesPhone = phone.includes(q);
        const matchesId = String(nationalId).toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId) return false;
      }

      return true;
    });
  }, [students, selectedGrade, selectedClass, studentSearchQuery]);

  // Filtered teachers list based on Search query
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (t.isArchived) return false;
      if (!teacherSearchQuery.trim()) return true;
      const q = teacherSearchQuery.toLowerCase().trim();
      const matchesName = (t.name || "").toLowerCase().includes(q);
      const matchesSubject = (t.subject || t.subjectSpecialty || t.specialty || "").toLowerCase().includes(q);
      const matchesPhone = (t.phone || "").includes(q);
      return matchesName || matchesSubject || matchesPhone;
    });
  }, [teachers, teacherSearchQuery]);

  // Student selection helpers
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleSelectAllFilteredStudents = () => {
    const ids = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAllFilteredStudents = () => {
    const idsToRemove = new Set(filteredStudents.map((s) => s.id));
    setSelectedStudentIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  // Teacher selection helpers
  const handleToggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      if (prev.includes(teacherId)) {
        return prev.filter((id) => id !== teacherId);
      } else {
        return [...prev, teacherId];
      }
    });
  };

  const handleSelectAllFilteredTeachers = () => {
    const ids = filteredTeachers.map((t) => t.id);
    setSelectedTeacherIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAllTeachers = () => {
    setSelectedTeacherIds([]);
  };

  const handleClearAllSelections = () => {
    setSelectedStudentIds([]);
    setSelectedTeacherIds([]);
    setManualPhone("");
    setManualName("");
  };

  // Build resolved recipients list
  interface ResolvedRecipient {
    id: string;
    name: string;
    phone: string;
    type: "student" | "teacher" | "manual";
    grade?: string;
    className?: string;
    subject?: string;
  }

  const selectedStudentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const selectedTeachersMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  const activeRecipients = useMemo<ResolvedRecipient[]>(() => {
    const list: ResolvedRecipient[] = [];

    // 1. Students
    selectedStudentIds.forEach((sid) => {
      const st = selectedStudentsMap.get(sid);
      if (st) {
        list.push({
          id: `st_${st.id}`,
          name: getStudentName(st) || `طالب (${st.id})`,
          phone: getStudentPhone(st),
          type: "student",
          grade: getStudentGrade(st),
          className: getStudentClass(st),
        });
      }
    });

    // 2. Teachers
    selectedTeacherIds.forEach((tid) => {
      const tc = selectedTeachersMap.get(tid);
      if (tc) {
        list.push({
          id: `tc_${tc.id}`,
          name: tc.name || `معلم (${tc.id})`,
          phone: cleanPhoneNumber(tc.phone),
          type: "teacher",
          subject: tc.subject || tc.subjectSpecialty || tc.specialty,
        });
      }
    });

    // 3. Manual entry if entered and no students/teachers chosen
    if (list.length === 0 && manualPhone.trim()) {
      list.push({
        id: `manual_${Date.now()}`,
        name: manualName.trim() || "مستلم مباشر",
        phone: cleanPhoneNumber(manualPhone),
        type: "manual",
      });
    }

    return list;
  }, [selectedStudentIds, selectedTeacherIds, selectedStudentsMap, selectedTeachersMap, manualPhone, manualName]);

  // When a single student is selected, sync to manual fields for user clarity
  useEffect(() => {
    if (selectedStudentIds.length === 1 && selectedTeacherIds.length === 0) {
      const st = selectedStudentsMap.get(selectedStudentIds[0]);
      if (st) {
        setManualPhone(getStudentPhone(st));
        setManualName(getStudentName(st));
      }
    } else if (selectedTeacherIds.length === 1 && selectedStudentIds.length === 0) {
      const tc = selectedTeachersMap.get(selectedTeacherIds[0]);
      if (tc) {
        setManualPhone(cleanPhoneNumber(tc.phone));
        setManualName(tc.name);
      }
    }
  }, [selectedStudentIds, selectedTeacherIds, selectedStudentsMap, selectedTeachersMap]);

  // Dynamic message personalizer for a given recipient
  const personalizeMessage = (rawTemplate: string, recipient: ResolvedRecipient): string => {
    let text = rawTemplate;
    text = text.replace(/\{اسم الطالب\}|\{اسم_الطالب\}|\{اسم المعلم\}|\{اسم_المعلم\}|\{الاسم\}/g, recipient.name || "");
    text = text.replace(/\{الصف\}|\{الصف الدراسي\}/g, recipient.grade || "");
    text = text.replace(/\{الشعبة\}|\{الفصل\}/g, recipient.className || "");
    text = text.replace(/\{المادة\}|\{التخصص\}/g, recipient.subject || "");
    return text;
  };

  // Insert variable into message textarea
  const handleInsertVariable = (variableTag: string) => {
    setMessage((prev) => prev + " " + variableTag + " ");
  };

  // Prepare batch recipients for UnifiedCampaignModal
  const modalCampaignRecipients = useMemo<CampaignRecipientItem[]>(() => {
    return activeRecipients.map((rec) => {
      const personalized = personalizeMessage(message, rec);
      return {
        id: rec.id,
        name: rec.name,
        phone: rec.phone,
        grade: rec.grade,
        className: rec.className,
        customMessage: personalized,
        message: personalized,
      };
    });
  }, [activeRecipients, message]);

  // Handle single send (for 1 recipient)
  const handleSendSingleDirect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (activeRecipients.length === 0) {
      setStatus({ type: "error", text: "يرجى تحديد طالب أو معلم، أو إدخال رقم جوال المستلم." });
      return;
    }

    const singleRec = activeRecipients[0];
    if (!singleRec.phone || singleRec.phone.length < 8) {
      setStatus({ type: "error", text: `رقم الجوال غير صالح أو غير متوفر للمستلم: ${singleRec.name}` });
      return;
    }

    if (!message.trim()) {
      setStatus({ type: "error", text: "يرجى كتابة نص الرسالة أولاً." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "idle", text: "" });

    const personalizedMsg = personalizeMessage(message, singleRec);

    try {
      const response = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: singleRec.phone,
          message: personalizedMsg,
          studentName: singleRec.name,
          grade: singleRec.grade,
          className: singleRec.className,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: "success",
          text: `تم إرسال الرسالة إلى (${singleRec.name} - ${singleRec.phone}) عبر واتساب بنجاح!`,
        });

        const newLog: SentIndividualLog = {
          id: `ind_${Date.now()}`,
          recipientName: singleRec.name,
          phone: singleRec.phone,
          message: personalizedMsg,
          timestamp: new Date().toLocaleTimeString("ar-SA") + " - " + new Date().toLocaleDateString("ar-SA"),
          status: "success",
        };
        addLogToHistory([newLog]);
      } else {
        throw new Error(data.error || "فشل إرسال الرسالة عبر واتساب.");
      }
    } catch (err: any) {
      setStatus({ type: "error", text: err.message || "فشل الاتصال بالخادم." });

      const newLog: SentIndividualLog = {
        id: `ind_${Date.now()}`,
        recipientName: singleRec.name,
        phone: singleRec.phone,
        message: personalizedMsg,
        timestamp: new Date().toLocaleTimeString("ar-SA") + " - " + new Date().toLocaleDateString("ar-SA"),
        status: "failed",
        error: err.message || "خطأ غير معروف",
      };
      addLogToHistory([newLog]);
    } finally {
      setIsLoading(false);
    }
  };

  // Main submit dispatcher: 1 recipient -> direct send; >1 recipients -> open Interval Modal
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeRecipients.length === 0) {
      setStatus({ type: "error", text: "يرجى اختيار مستلم من قائمة الطلاب أو قائمة المعلمين، أو إدخال رقم جوال مباشر." });
      return;
    }

    if (!message.trim()) {
      setStatus({ type: "error", text: "يرجى كتابة نص الرسالة قبل الإرسال." });
      return;
    }

    if (activeRecipients.length === 1) {
      handleSendSingleDirect();
    } else {
      // Multiple recipients -> Launch interval & jitter batch modal
      setIsBatchModalOpen(true);
    }
  };

  // Single sender callback for UnifiedCampaignModal
  const handleModalSendSingle = async (
    item: CampaignRecipientItem
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: item.phone,
          message: item.customMessage || item.message || message,
          studentName: item.name,
          grade: item.grade,
          className: item.className,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || "فشل التسليم عبر واتساب" };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "خطأ في الاتصال بالخادم" };
    }
  };

  // Callback when all batch items complete in modal
  const handleModalCompleted = (summary: { sent: number; failed: number; total: number }) => {
    setStatus({
      type: "success",
      text: `اكتمل الإرسال الجماعي لـ (${summary.sent} من ${summary.total}) مستلم بنظام الفاصل الزمني والتفاوت بنجاح.`,
    });

    // Record summary to history
    const batchSummaryLog: SentIndividualLog = {
      id: `batch_${Date.now()}`,
      recipientName: `حملة إرسال لـ ${summary.total} مستلم`,
      phone: `${summary.sent} ناجح / ${summary.failed} متعثر`,
      message: message,
      timestamp: new Date().toLocaleTimeString("ar-SA") + " - " + new Date().toLocaleDateString("ar-SA"),
      status: summary.failed === 0 ? "success" : "failed",
      error: summary.failed > 0 ? `تعثر إرسال ${summary.failed} رسائل` : undefined,
    };
    addLogToHistory([batchSummaryLog]);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("whatsapp_individual_history");
  };

  // Quick message template options
  const quickTemplates = [
    {
      title: "تنبيه دراسي",
      text: "السلام عليكم ورحمة الله، نود تذكيركم بمتابعة أداء الطالب {الاسم}، ومساعدته في حل الواجبات والاستعداد للاختبارات القادمة. شاكرين حسن تعاونكم.",
    },
    {
      title: "استدعاء ولي أمر",
      text: "المكرم ولي أمر الطالب {الاسم} المحترم، نرجو التكرم بالحضور للمدرسة لمناقشة بعض الأمور التربوية الخاصة بالطالب. دمتم بخير.",
    },
    {
      title: "شكر وتقدير",
      text: "يسر إدارة المدرسة أن تتقدم بجزيل الشكر والتقدير لكم وللطالب {الاسم} على التميز والمواظبة الإيجابية، سائلين الله له دوام التوفيق والنجاح.",
    },
    {
      title: "إشعار معلم",
      text: "الأستاذ الفاضل {اسم المعلم} المحترم، نرجو التكرم بالاطلاع على التوجيهات الإدارية وتحديث سجلات الحصص والشعب المسندة لديكم. شاكرين جهودكم المتميزة.",
    },
  ];

  return (
    <div className="flex flex-col gap-6 text-right" id="individual-sender-root">
      
      {/* WhatsApp Connection Banner */}
      {isWhatsAppConnected ? (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-600/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>الواتساب متصل وجاهز للإرسال المباشر الفعلي</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ● نشط الآن
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                تصل الرسائل فوراً ومباشرة لهواتف المستلمين عبر حساب الواتساب المتصل.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-rose-600/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>تنبيه: الواتساب غير مرتبط حالياً</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  غير متصل
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                لن يتم تسليم الرسائل للأرقام حتى يتم ربط جهازك عبر نافذة الربط بمسح الباركود أو الرمز.
              </p>
            </div>
          </div>
          {onNavigateToConnection && (
            <button
              type="button"
              onClick={onNavigateToConnection}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              id="btn-navigate-connect-whatsapp"
            >
              <Link2 className="w-4 h-4" />
              ربط الواتساب الآن
            </button>
          )}
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            نظام الإرسال الفردي والمتتابع للطلاب والمعلمين
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            اختر طالباً أو أكثر عبر الصفوف والشعب أو البحث بالاسم، أو اختر من قائمة المعلمين مع نظام الفاصل الزمني والتفاوت البشري لحماية الرقم.
          </p>
        </div>

        {/* Selected Recipients Summary Tag */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            activeRecipients.length > 0
              ? activeRecipients.length > 1
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}>
            <Users className="w-3.5 h-3.5" />
            <span>المستلمون المحددون: <strong>{activeRecipients.length}</strong></span>
            {activeRecipients.length > 1 && (
              <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded-md">
                إرسال بفاصل زمني وتفاوت
              </span>
            )}
          </div>

          {activeRecipients.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllSelections}
              className="text-xs text-slate-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 font-semibold"
              title="إلغاء تحديد جميع المستلمين"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح التحديد
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Pickers and Message Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column (lg:col-span-7): The Two Pickers (Students & Teachers) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          
          {/* ========================================================================= */}
          {/* 1. القائمة الأولى: اختيار الطلاب (الصفوف، الشعبة، البحث بالاسم) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden" id="students-picker-card">
            
            {/* Header / Toggle Accordion */}
            <div
              onClick={() => setIsStudentListOpen((prev) => !prev)}
              className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    القائمة الأولى: اختيار من كشف الطلاب (الصفوف والشعب والاسم)
                    {selectedStudentIds.length > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                        {selectedStudentIds.length} محدد
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اختر طالباً أو أكثر عبر تصفية الصف والشعبة أو البحث بالاسم كما في الغياب والتأخر
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">
                  ({filteredStudents.length} طالب متاح)
                </span>
                {isStudentListOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Filter Controls & Students Roster */}
            {isStudentListOpen && (
              <div className="p-4 space-y-4">
                
                {/* Filters Row: Grade, Class/Section, Search Box */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  
                  {/* Grade Filter */}
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      الصف الدراسي:
                    </label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => {
                        setSelectedGrade(e.target.value);
                        setSelectedClass("ALL");
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      id="select-student-grade"
                    >
                      <option value="ALL">جميع الصفوف ({students.length})</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Class/Section Filter */}
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      الشعبة / الفصل:
                    </label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                      id="select-student-class"
                    >
                      <option value="ALL">جميع الفصول ({availableClasses.length})</option>
                      {availableClasses.map((c) => (
                        <option key={c} value={c}>
                          فصل / شعبة: {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Box by Name / Phone / ID (كما في الغياب والتأخر) */}
                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      مربع البحث بالاسم:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        placeholder="بحث بالاسم أو الجوال أو السجل..."
                        className="w-full pl-7 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        id="input-student-search"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      {studentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setStudentSearchQuery("")}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          title="مسح البحث"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* Bulk Action Controls */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredStudents}
                      disabled={filteredStudents.length === 0}
                      className="text-blue-700 hover:text-blue-800 text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      تحديد الكل ({filteredStudents.length})
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFilteredStudents}
                      disabled={selectedStudentIds.length === 0}
                      className="text-slate-500 hover:text-rose-600 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      إلغاء تحديد الطلاب
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    محدد: <strong className="text-blue-600">{selectedStudentIds.length}</strong> طالب
                  </span>
                </div>

                {/* Scrollable Students List */}
                <div className="border border-slate-200/80 rounded-xl overflow-y-auto max-h-56 divide-y divide-slate-100 bg-white">
                  {students.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا يوجد طلاب مسجلون في النظام حتى الآن. يمكنك استيراد كشف نور من صفحة «استيراد كشف نور».
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا توجد نتائج مطابقة لبحثك بالصف أو الشعبة أو الاسم.
                    </div>
                  ) : (
                    filteredStudents.map((st) => {
                      const name = getStudentName(st);
                      const phone = getStudentPhone(st);
                      const grade = getStudentGrade(st);
                      const className = getStudentClass(st);
                      const isSelected = selectedStudentIds.includes(st.id);

                      return (
                        <div
                          key={st.id}
                          onClick={() => handleToggleStudent(st.id)}
                          className={`p-2.5 px-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50/80 font-bold" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="text-blue-600 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="truncate">
                              <span className="text-slate-800 font-semibold">{name}</span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal mt-0.5">
                                {grade && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">{grade}</span>}
                                {className && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">فصل {className}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            {phone ? (
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100/70 px-2 py-0.5 rounded-md" dir="ltr">
                                {phone}
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-500 font-semibold">بدون جوال</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 2. القائمة الثانية: قائمة المعلمين المنسدلة (اختيار معلم أو أكثر) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden" id="teachers-picker-card">
            
            {/* Header / Toggle Accordion */}
            <div
              onClick={() => setIsTeacherDropdownOpen((prev) => !prev)}
              className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    القائمة الثانية: قائمة المعلمين المنسدلة (اختر معلماً أو أكثر)
                    {selectedTeacherIds.length > 0 && (
                      <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                        {selectedTeacherIds.length} معلماً محدد
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    قائمة منسدلة سريعة لاختيار معلم واحد أو عدة معلمين للإرسال الفردي والمتتابع
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">
                  ({teachers.length} معلم)
                </span>
                {isTeacherDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Dropdown Content */}
            {isTeacherDropdownOpen && (
              <div className="p-4 space-y-3.5">
                
                {/* Search in Teachers */}
                <div className="relative">
                  <input
                    type="text"
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    placeholder="بحث سريع باسم المعلم أو المادة أو رقم الجوال..."
                    className="w-full pl-7 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    id="input-teacher-search"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  {teacherSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearchQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Bulk controls */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredTeachers}
                      disabled={filteredTeachers.length === 0}
                      className="text-purple-700 hover:text-purple-800 text-[11px] font-bold px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      تحديد جميع المعلمين ({filteredTeachers.length})
                    </button>
                    <span className="text-slate-200">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllTeachers}
                      disabled={selectedTeacherIds.length === 0}
                      className="text-slate-500 hover:text-rose-600 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      إلغاء تحديد المعلمين
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    محدد: <strong className="text-purple-600">{selectedTeacherIds.length}</strong> معلماً
                  </span>
                </div>

                {/* Scrollable Teachers List */}
                <div className="border border-slate-200/80 rounded-xl overflow-y-auto max-h-52 divide-y divide-slate-100 bg-white">
                  {teachers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا يوجد كشف معلمين متاح حالياً. يمكنك إضافة المعلمين من قسم «الجدول المدرسي والمعلمون».
                    </div>
                  ) : filteredTeachers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا يوجد معلماً يطابق بحثك.
                    </div>
                  ) : (
                    filteredTeachers.map((tc) => {
                      const isSelected = selectedTeacherIds.includes(tc.id);
                      const cleanP = cleanPhoneNumber(tc.phone);
                      const subject = tc.subject || tc.subjectSpecialty || tc.specialty;

                      return (
                        <div
                          key={tc.id}
                          onClick={() => handleToggleTeacher(tc.id)}
                          className={`p-2.5 px-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected ? "bg-purple-50/80 font-bold" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="text-purple-600 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-purple-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="truncate">
                              <span className="text-slate-800 font-semibold">{tc.name}</span>
                              {subject && (
                                <span className="mr-2 text-[10px] text-purple-700 bg-purple-100/60 px-1.5 py-0.2 rounded font-normal">
                                  {subject}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-left shrink-0">
                            {cleanP ? (
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100/70 px-2 py-0.5 rounded-md" dir="ltr">
                                {cleanP}
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-500 font-semibold">بدون جوال</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. الإدخال اليدوي المباشر (Manual Direct Entry Option) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              أو إدخال رقم جوال مباشر يدوياً (اختياري):
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="اسم المستلم (اختياري)..."
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-right font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                id="input-manual-name"
              />
              <input
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="رقم الجوال: 05xxxxxxxx أو 9665xxxxxxxx"
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
                id="input-manual-phone"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              يمكنك كتابة رقم مباشر إذا كنت لا ترغب بالاختيار من كشف الطلاب أو قائمة المعلمين أعلاه.
            </p>
          </div>

        </div>

        {/* Right Column (lg:col-span-5): Selected Recipients & Message Composer */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-5">
            
            {/* Selected Recipients Preview Header */}
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  المستلمون المعتمدون للإرسال:
                </span>
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                  {activeRecipients.length} مستلم
                </span>
              </div>

              {/* Chips / Badges for active recipients */}
              {activeRecipients.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl text-center">
                  لم تقم بتحديد أي مستلم بعد. اختر من كشف الطلاب أو المعلمين أو أدخل رقماً مباشراً.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50/70 border border-slate-100 rounded-xl">
                  {activeRecipients.map((rec) => (
                    <span
                      key={rec.id}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                        rec.type === "student"
                          ? "bg-blue-50 text-blue-900 border-blue-200/80"
                          : rec.type === "teacher"
                          ? "bg-purple-50 text-purple-900 border-purple-200/80"
                          : "bg-emerald-50 text-emerald-900 border-emerald-200/80"
                      }`}
                    >
                      {rec.type === "student" ? "🎓" : rec.type === "teacher" ? "👨‍🏫" : "📱"}
                      <span className="truncate max-w-[130px]">{rec.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (rec.type === "student") {
                            setSelectedStudentIds((prev) => prev.filter((id) => `st_${id}` !== rec.id));
                          } else if (rec.type === "teacher") {
                            setSelectedTeacherIds((prev) => prev.filter((id) => `tc_${id}` !== rec.id));
                          } else {
                            setManualPhone("");
                            setManualName("");
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 mr-0.5"
                        title="إزالة هذا المستلم"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Ban Protection Alert (Interval & Jitter Alert) */}
            {activeRecipients.length > 1 && (
              <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white rounded-2xl p-4 shadow-sm border border-emerald-700/50 space-y-3 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-400/30">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-emerald-200">
                      درع الأمان والفاصل الزمني والتفاوت البشري نشط
                    </h5>
                    <p className="text-[11px] text-emerald-100/90 leading-relaxed mt-0.5">
                      نظراً لاختيار أكثر من مستلم ({activeRecipients.length})، سيتم الإرسال بنظام الفاصل الزمني والتفاوت البشري العشوائي لحماية رقمك من الحظر كما في نظام الحملات المعتمد بالموقع.
                    </p>
                  </div>
                </div>

                {/* Interval and Jitter Settings */}
                <div className="bg-emerald-950/50 rounded-xl p-3 border border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="text-[11px] text-emerald-200 font-bold">الفاصل الزمني:</span>
                    <div className="flex items-center gap-1">
                      {[5, 10, 15, 20].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setIntervalSeconds(sec)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                            intervalSeconds === sec
                              ? "bg-emerald-400 text-emerald-950 shadow-xs"
                              : "bg-emerald-900/80 text-emerald-200 hover:bg-emerald-800"
                          }`}
                        >
                          {sec} ث
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-emerald-200 font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={enableJitter}
                      onChange={(e) => setEnableJitter(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>تفاوت بشري (±2 ث)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Message Composer Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              
              {/* Variable Buttons */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    نص الرسالة:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    انقر لإدراج المتغيرات بالرسالة:
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertVariable("{الاسم}")}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                    title="يستبدل باسم الطالب أو اسم المعلم تلقائياً"
                  >
                    + {"{الاسم}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable("{الصف}")}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    + {"{الصف}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertVariable("{الشعبة}")}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 transition-colors"
                  >
                    + {"{الشعبة}"}
                  </button>
                </div>
              </div>

              {/* Message Textarea */}
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب نص الرسالة هنا... (يمكنك استخدام المتغيرات أعلاه ليتم استبدال اسم كل طالب أو معلم تلقائياً عند الإرسال)"
                className="w-full border border-slate-200 rounded-xl p-3.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 h-36 resize-none leading-relaxed text-right"
                id="textarea-ind-message"
              />

              {/* Quick Template Chips */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  قوالب سريعة جاهزة:
                </span>
                <div className="flex flex-wrap gap-1">
                  {quickTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setMessage(tpl.text)}
                      className="text-[10px] text-slate-600 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/70 hover:border-emerald-200 px-2 py-0.5 rounded-md transition-colors"
                    >
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  {activeRecipients.length > 1 ? (
                    <span>سيتم الإرسال لـ <strong>{activeRecipients.length}</strong> بفاصل <strong>{intervalSeconds} ثانية</strong></span>
                  ) : activeRecipients.length === 1 ? (
                    <span>إرسال فوري مباشر إلى: <strong>{activeRecipients[0].name}</strong></span>
                  ) : (
                    <span>حدد المستلمين للبدء</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !isWhatsAppConnected || activeRecipients.length === 0}
                  className={`font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeRecipients.length > 1
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  }`}
                  id="btn-ind-send-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : activeRecipients.length > 1 ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>بدء الإرسال بفاصل زمني ({activeRecipients.length} مستلم)</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 rotate-180" />
                      <span>إرسال الرسالة الفردية الآن</span>
                    </>
                  )}
                </button>
              </div>

              {/* In-place status message */}
              {status.type === "success" && (
                <div className="bg-emerald-50 text-emerald-800 text-xs py-3 px-4 rounded-xl border border-emerald-100 text-center flex items-center justify-center gap-2 font-bold animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {status.text}
                </div>
              )}

              {status.type === "error" && (
                <div className="bg-rose-50 text-rose-800 text-xs py-3 px-4 rounded-xl border border-rose-100 text-center flex items-center justify-center gap-2 font-bold animate-fadeIn">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  {status.text}
                </div>
              )}

            </form>

          </div>

          {/* History Log Section */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                سجل الرسائل الفردية والمتتابعة
              </h3>
              
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                  id="btn-clear-ind-history"
                >
                  مسح السجل
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-64 pr-1">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-2">
                  <History className="w-8 h-8 text-slate-200" />
                  <span className="text-xs">لم تقم بإرسال أي رسائل فردية في هذه الجلسة بعد.</span>
                </div>
              ) : (
                history.map((log) => (
                  <div key={log.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {log.recipientName && (
                          <span className="font-bold text-slate-800">{log.recipientName}</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{log.phone}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        log.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {log.status === "success" ? "تم التسليم" : "فشل"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-white border border-slate-100 p-2 rounded-lg leading-relaxed break-words font-medium">
                      {log.message}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                      <span>{log.timestamp}</span>
                      {log.error && (
                        <span className="text-rose-600 font-semibold">{log.error}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL: Unified Campaign Modal for Batch Sending with Interval & Jitter */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <UnifiedCampaignModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          title="إرسال الرسائل الفردية المتتابعة"
          subtitle={`سيتم إرسال الرسائل الفردية المخصصة إلى (${modalCampaignRecipients.length}) مستلم بفاصل أمان (${intervalSeconds} ثانية) مع تفاوت زمني بشري عشوائي لمنع الحظر.`}
          recipients={modalCampaignRecipients}
          recipientLabel="مستلم"
          intervalSeconds={intervalSeconds}
          enableJitter={enableJitter}
          onSendSingle={handleModalSendSingle}
          onAllCompleted={handleModalCompleted}
        />
      )}

    </div>
  );
}
