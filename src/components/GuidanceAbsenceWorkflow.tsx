import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Send, 
  Printer, 
  Calendar, 
  Sparkles, 
  UserCheck, 
  CheckCircle2, 
  HelpCircle,
  Users,
  Search,
  Filter,
  Eye,
  MessageSquare,
  Zap,
  Bookmark,
  Share2,
  Clock,
  ShieldAlert,
  Download,
  Check,
  Package,
  Layers,
  FileCheck
} from "lucide-react";
import { NoorStudentAbsence, SchoolSignatories, Student } from "../types";
import GuidanceDocumentModal, { GuidanceDocType } from "./GuidanceDocumentModal";
import NoorImporterModal from "./NoorImporterModal";
import { generateNoorChromeExtensionZip } from "../utils/chromeExtensionBuilder";

interface GuidanceAbsenceWorkflowProps {
  students: Student[];
  signatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onSendSingleMessage: (phone: string, message: string, studentName: string, grade?: string, className?: string) => Promise<boolean>;
}

export default function GuidanceAbsenceWorkflow({
  students,
  signatories,
  isWhatsAppConnected,
  onSendSingleMessage,
}: GuidanceAbsenceWorkflowProps) {
  // Noor Absences State (saved to local storage + backend sync)
  const [noorAbsences, setNoorAbsences] = useState<NoorStudentAbsence[]>(() => {
    const saved = localStorage.getItem("noor_student_absences");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [activeCategory, setActiveCategory] = useState<"excused" | "unexcused">("unexcused");
  const [activeTier, setActiveTier] = useState<"all" | "tier_1" | "tier_2" | "tier_3" | "tier_5" | "tier_10">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [isNoorModalOpen, setIsNoorModalOpen] = useState(false);
  const [isDownloadingExt, setIsDownloadingExt] = useState(false);

  // Document Generator Modal State
  const [docModal, setDocModal] = useState<{
    isOpen: boolean;
    docType: GuidanceDocType;
    student: NoorStudentAbsence | null;
    absenceCategory: "excused" | "unexcused";
    thresholdDays: 3 | 5 | 10;
  }>({
    isOpen: false,
    docType: "case_study",
    student: null,
    absenceCategory: "unexcused",
    thresholdDays: 3,
  });

  // Action status tracker (per student ID)
  const [actionStatuses, setActionStatuses] = useState<Record<string, {
    whatsappSent?: boolean;
    whatsappSentAt?: string;
    caseStudyGenerated?: boolean;
    planGenerated?: boolean;
    meetingMinutesGenerated?: boolean;
    referralGenerated?: boolean;
  }>>(() => {
    const saved = localStorage.getItem("guidance_action_statuses");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [sendingPhoneMap, setSendingPhoneMap] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync to local storage & server
  useEffect(() => {
    localStorage.setItem("noor_student_absences", JSON.stringify(noorAbsences));
    fetch("/api/noor/sync-absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ absences: noorAbsences })
    }).catch(() => {});
  }, [noorAbsences]);

  useEffect(() => {
    localStorage.setItem("guidance_action_statuses", JSON.stringify(actionStatuses));
  }, [actionStatuses]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Helper to match phone number from students roster if missing in Noor export
  const getStudentPhone = (student: NoorStudentAbsence): string => {
    if (student.phone && student.phone.trim().length >= 8) return student.phone.trim();
    // Search in uploaded Excel students roster
    const match = students.find((s) => {
      const sName = (s.name || s.studentName || "").trim();
      const stName = student.studentName.trim();
      return (
        (student.nationalId && s.id === student.nationalId) ||
        (sName && stName && (sName.includes(stName) || stName.includes(sName)))
      );
    });
    if (match) {
      return match.phone || match.mobile || match["رقم الجوال"] || match["جوال ولي الأمر"] || "";
    }
    return "";
  };

  // Handle importing absences from the Noor Extractor tool
  const handleImportAbsences = (imported: NoorStudentAbsence[]) => {
    const mergedMap = new Map<string, NoorStudentAbsence>();
    noorAbsences.forEach((s) => mergedMap.set(s.id, s));
    imported.forEach((s) => {
      const phone = getStudentPhone(s);
      mergedMap.set(s.id, { ...s, phone: phone || s.phone });
    });
    const updatedList = Array.from(mergedMap.values());
    setNoorAbsences(updatedList);
    showToast(`✓ تم سحب وتحديث بيانات (${imported.length}) طالب من نظام نور بنجاح.`);
  };

  // Generate Sample 1-Day Absences for Early School Year Testing
  const handleLoadDay1SampleData = () => {
    const todayHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());

    const sampleDay1: NoorStudentAbsence[] = [
      {
        id: "1123456781",
        studentName: "سعود فيصل خالد الحربي",
        nationalId: "1123456781",
        grade: "أول ثانوي",
        className: "101",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 1,
        unexcusedDates: [todayHijri],
        phone: "0501234567",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1123456782",
        studentName: "عبدالرحمن فهد ناصر الدوسري",
        nationalId: "1123456782",
        grade: "أول ثانوي",
        className: "102",
        excusedDaysCount: 1,
        excusedDates: [todayHijri],
        unexcusedDaysCount: 0,
        unexcusedDates: [],
        phone: "0559876543",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1123456783",
        studentName: "فهد ماجد سلطان العتيبي",
        nationalId: "1123456783",
        grade: "ثاني ثانوي",
        className: "201",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 1,
        unexcusedDates: [todayHijri],
        phone: "0543219876",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1123456784",
        studentName: "خالد محمد عبدالله القرني",
        nationalId: "1123456784",
        grade: "ثاني ثانوي",
        className: "202",
        excusedDaysCount: 1,
        excusedDates: [todayHijri],
        unexcusedDaysCount: 0,
        unexcusedDates: [],
        phone: "0533344556",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1123456785",
        studentName: "ريان عبدالعزيز صالح المطيري",
        nationalId: "1123456785",
        grade: "ثالث ثانوي",
        className: "301",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 1,
        unexcusedDates: [todayHijri],
        phone: "0567788990",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1123456786",
        studentName: "بندر نواف مشعل الغامدي",
        nationalId: "1123456786",
        grade: "ثالث ثانوي",
        className: "302",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 1,
        unexcusedDates: [todayHijri],
        phone: "0571122334",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      }
    ];

    handleImportAbsences(sampleDay1);
    setActiveTier("all");
    showToast("✓ تم تحميل كشف تجريبي لغياب اليوم الأول بنجاح (6 طلاب - بداية العام الدراسي).");
  };

  // Download Chrome Extension (.zip)
  const handleDownloadExtension = async () => {
    try {
      setIsDownloadingExt(true);
      const zipBlob = await generateNoorChromeExtensionZip();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "noor-abna-extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("✓ تم تنزيل حزمة إضافة Google Chrome الرسمية (.zip) بنجاح.");
    } catch (e: any) {
      showToast("❌ حدث خطأ أثناء إنشاء حزمة الإضافة: " + e.message, "error");
    } finally {
      setIsDownloadingExt(false);
    }
  };

  // Filtered List calculation
  const filteredStudents = noorAbsences.filter((st) => {
    const daysCount = activeCategory === "excused" ? st.excusedDaysCount : st.unexcusedDaysCount;
    
    // If student has 0 days in current active category, hide unless viewing total
    if (daysCount === 0) return false;

    // Tier filtering
    if (activeTier === "tier_1" && daysCount !== 1) return false;
    if (activeTier === "tier_2" && daysCount !== 2) return false;
    if (activeTier === "tier_3" && (daysCount < 3 || daysCount >= 5)) return false;
    if (activeTier === "tier_5" && (daysCount < 5 || daysCount >= 10)) return false;
    if (activeTier === "tier_10" && daysCount < 10) return false;

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = st.studentName.toLowerCase();
      const nid = (st.nationalId || "").toLowerCase();
      if (!name.includes(q) && !nid.includes(q)) return false;
    }

    // Grade filter
    if (selectedGrade !== "ALL" && st.grade !== selectedGrade) {
      return false;
    }

    return true;
  });

  // Calculate high level statistics
  const stats = {
    totalNoor: noorAbsences.length,
    day1Excused: noorAbsences.filter((s) => s.excusedDaysCount === 1).length,
    day1Unexcused: noorAbsences.filter((s) => s.unexcusedDaysCount === 1).length,
    day2Excused: noorAbsences.filter((s) => s.excusedDaysCount === 2).length,
    day2Unexcused: noorAbsences.filter((s) => s.unexcusedDaysCount === 2).length,
    excused3Plus: noorAbsences.filter((s) => s.excusedDaysCount >= 3 && s.excusedDaysCount < 5).length,
    excused5Plus: noorAbsences.filter((s) => s.excusedDaysCount >= 5 && s.excusedDaysCount < 10).length,
    excused10Plus: noorAbsences.filter((s) => s.excusedDaysCount >= 10).length,
    unexcused3Plus: noorAbsences.filter((s) => s.unexcusedDaysCount >= 3 && s.unexcusedDaysCount < 5).length,
    unexcused5Plus: noorAbsences.filter((s) => s.unexcusedDaysCount >= 5 && s.unexcusedDaysCount < 10).length,
    unexcused10Plus: noorAbsences.filter((s) => s.unexcusedDaysCount >= 10).length,
  };

  // Grade list for filter dropdown
  const uniqueGrades = Array.from(
    new Set(noorAbsences.map((s) => s.grade).filter(Boolean))
  );

  // Send WhatsApp Action Handler according to Ministry Regulations
  const handleSendWhatsAppNotification = async (
    student: NoorStudentAbsence,
    category: "excused" | "unexcused",
    daysCount: number
  ) => {
    const phone = getStudentPhone(student);
    if (!phone) {
      showToast(`⚠️ رقم جوال ولي أمر الطالب (${student.studentName}) غير متوفر. يرجى تزويد الرقم أو رفع كشف الإكسل.`, "error");
      return;
    }

    const datesList = category === "excused" ? student.excusedDates : student.unexcusedDates;
    const formattedDates = datesList.length > 0 ? datesList.join(" ، ") : "اليوم";
    const school = signatories.schoolName || "ثانوية الأبناء الأولى";

    let messageText = "";

    if (daysCount === 1) {
      // Day 1: Immediate polite notification to parent
      if (category === "excused") {
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً بتسجيل غياب بعذر مقبول لابنكم اليوم [${formattedDates}].\nنأمل متابعة الدروس والواجبات عبر منصة مدرستي ونتمنى للطالب دوام التوفيق والنجاح.\n- إدارة المدرسة | ${school}`;
      } else {
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً بتسجيل غياب لابنكم اليوم [${formattedDates}].\nنأمل تبرير الغياب أو التواصل مع إدارة المدرسة للاطمئنان على الطالب، مع ضرورة متابعة الدروس عبر منصة مدرستي حفاظاً على تحصيله الدراسي.\n- إدارة المدرسة | ${school}`;
      }
    } else if (daysCount === 2) {
      // Day 2: Reminder before reaching Day 3 threshold
      if (category === "excused") {
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً ببلوغ غياب ابنكم بعذر يومين بالتواريخ: [${formattedDates}].\nنأمل حث الطالب على الانتظام ومتابعة الفاقد التعليمي عبر منصة مدرستي.\n- إدارة المدرسة | ${school}`;
      } else {
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً ببلوغ غياب ابنكم بدون عذر يومين بالتواريخ: [${formattedDates}].\nنأمل المبادرة بتقديم العذر والتواصل مع الموجه الطلابي تجنباً لتطبيق الإجراءات الإرشادية وحسم درجات المواظبة عند بلوغ 3 أيام.\n- قسم التوجيه الطلابي | ${school}`;
      }
    } else if (category === "excused") {
      if (daysCount < 5) {
        // 3-4 Days Excused: Learning Plan + Notification
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً بأن رصيد غياب ابنكم بعذر مقبول قد بلغ (${daysCount}) أيام، بالتواريخ: [${formattedDates}].\nوحرصاً على مستواه الأكاديمي، أعدت المدرسة خطة التعلم أثناء أيام الغياب ودراسة الحالة، ونأمل متابعة الدروس والواجبات عبر منصة مدرستي.\n- قسم التوجيه الطلابي | ${school}`;
      } else if (daysCount < 10) {
        // 5-9 Days Excused: Summon for Awareness Session with Committee
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنظراً لتكرار غياب ابنكم بعذر وبلوغه (${daysCount}) أيام وعدم الالتزام بالخطة التربوية، فقد تقرر إحالة الطالب إلى لجنة التوجيه الطلابي.\nنأمل حضوركم الكريم للمدرسة لعقد جلسة توعوية لمناقشة الخطة التربوية والعلاجية المناسبة لابنكم.\n- لجنة التوجيه والإرشاد | ${school}`;
      } else {
        // 10+ Days Excused: Protection / Escalation notice
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً ببلوغ غياب ابنكم (${daysCount}) أيام. ونظراً لأهمية حق الطالب في التعليم، نؤكد على ضرورة الحضور الفوري لإدارة المدرسة لمراجعة الإجراءات الإرشادية والنظامية تفادياً لرفع الحالة للجهات المختصة وفق نظام حماية الطفل.\n- إدارة المدرسة | ${school}`;
      }
    } else {
      if (daysCount < 5) {
        // 3-4 Days Unexcused: Notification with exact dates + Case study
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنحيطكم علماً بتسجيل غياب بدون عذر لابنكم بمجموع (${daysCount}) أيام بالتواريخ المدونة بنظام نور: [${formattedDates}].\nوقد قام الموجه الطلابي ببدء دراسة حالة الطالب، ونأمل مراجعة المدرسة أو تبرير الغياب لضمان عدم تأثر درجات المواظبة والتحصيل الدراسي.\n- الموجه الطلابي | ${school}`;
      } else if (daysCount < 10) {
        // 5-9 Days Unexcused: Referral to Committee + Meeting Summon
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنظراً لبلوغ غياب ابنكم بدون عذر (${daysCount}) أيام، نفيدكم بإحالة الطالب إلى لجنة التوجيه الطلابي وتحديث الخطة العلاجية.\nيُرجى الحضور للمدرسة بصفة عاجلة لحضور اجتماع اللجنة واستكمال المحضر الرسمي.\n- رئيس لجنة التوجيه والإرشاد | ${school}`;
      } else {
        // 10+ Days Unexcused: Referral to Department of Education / Child Protection
        messageText = `السلام عليكم ورحمة الله وبركاته،\nالمكرم ولي أمر الطالب/ ${student.studentName} المحترم،\nنظراً لتجاوز غياب ابنكم بدون عذر (${daysCount}) أيام، نفيدكم باتخاذ الإجراءات النظامية المعتمدة وإحالة الملف لسعادة مدير المدرسة للرفع لإدارة التعليم والجهات ذات الاختصاص تطبيقاً لنظام حماية الطفل ولائحته التنفيذية.\n- إدارة المدرسة | ${school}`;
      }
    }

    setSendingPhoneMap((prev) => ({ ...prev, [student.id]: true }));
    const success = await onSendSingleMessage(phone, messageText, student.studentName, student.grade, student.className);
    setSendingPhoneMap((prev) => ({ ...prev, [student.id]: false }));

    if (success) {
      setActionStatuses((prev) => ({
        ...prev,
        [student.id]: {
          ...(prev[student.id] || {}),
          whatsappSent: true,
          whatsappSentAt: new Date().toISOString(),
        }
      }));
      showToast(`✓ تم إرسال رسالة الواتساب لولي أمر الطالب (${student.studentName}) بنجاح.`);
    } else {
      showToast(`❌ تعذر إرسال الرسالة للطالب (${student.studentName}). تحقق من اتصال الواتساب وصحة الرقم.`, "error");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-bounce ${
          toastMsg.type === "success" ? "bg-emerald-900 text-white border-emerald-600" : "bg-red-900 text-white border-red-600"
        }`}>
          {toastMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* 1. Noor Smart Tool Banner & Quick Launch */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                سحب كشوف نور بضغطة زر
              </span>
              <span className="text-xs text-yellow-400 font-bold bg-yellow-400/10 px-2.5 py-0.5 rounded-full border border-yellow-400/20">
                ✨ يدعم غياب اليوم الأول (بداية العام الدراسي)
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-black tracking-wide text-white">
              سحب غيابات الطلاب التلقائي وإجراءات الغياب والتوجيه الطلابي
            </h3>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              تسحب الأداة كشوف الغياب اليومي (يوم واحد) والتراكمي مباشرة من شاشة تثبيت الغياب أو التقارير في نظام نور. يقوم النظام تلقائياً بإنشاء إشعارات غياب اليوم الأول بالواتساب، خطط التعلم، دراسات الحالة، محاضر لجنة التوجيه، وإحالات حماية الطفل.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            
            <button
              onClick={() => setIsNoorModalOpen(true)}
              className="px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-emerald-500/30 transition-all animate-pulse"
            >
              <Zap className="w-4 h-4" />
              <span>⚡ المعالج الذكي لسحب كشوف نور (فوري)</span>
            </button>

            <button
              onClick={handleLoadDay1SampleData}
              className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-yellow-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-yellow-500/30 transition-all"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span>تجربة كشف يوم 1 (6 طلاب)</span>
            </button>

          </div>
        </div>
      </div>

      {/* 2. Top Metric Statistics Cards (Day 1 + Ministry Thresholds) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        
        {/* Day 1 (Early Year) */}
        <div 
          onClick={() => { setActiveTier("tier_1"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTier === "tier_1"
              ? "bg-yellow-50 border-yellow-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-yellow-300"
          }`}
        >
          <div className="flex items-center justify-between text-yellow-800 mb-1">
            <span className="text-[11px] font-black">اليوم الأول (1 يوم)</span>
            <Clock className="w-3.5 h-3.5 text-yellow-600" />
          </div>
          <p className="text-xl font-black text-yellow-950">
            {activeCategory === "excused" ? stats.day1Excused : stats.day1Unexcused}
          </p>
          <span className="text-[10px] text-yellow-700 block mt-0.5 font-bold">إشعار فوري لولي الأمر</span>
        </div>

        {/* Day 2 */}
        <div 
          onClick={() => { setActiveTier("tier_2"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeTier === "tier_2"
              ? "bg-slate-100 border-slate-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-700 mb-1">
            <span className="text-[11px] font-bold">اليوم الثاني (2 يوم)</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {activeCategory === "excused" ? stats.day2Excused : stats.day2Unexcused}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">تنبيه قبل الإجراءات</span>
        </div>

        {/* Excused 3+ */}
        <div 
          onClick={() => { setActiveCategory("excused"); setActiveTier("tier_3"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "excused" && activeTier === "tier_3"
              ? "bg-blue-50 border-blue-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-[11px] font-bold">بعذر (3 فأكثر)</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black text-blue-950">{stats.excused3Plus}</p>
          <span className="text-[10px] text-blue-600 block mt-0.5 font-medium">خطة التعلم + دراسة حالة</span>
        </div>

        {/* Excused 5+ */}
        <div 
          onClick={() => { setActiveCategory("excused"); setActiveTier("tier_5"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "excused" && activeTier === "tier_5"
              ? "bg-indigo-50 border-indigo-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[11px] font-bold">بعذر (5 فأكثر)</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black text-indigo-950">{stats.excused5Plus}</p>
          <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">لجنة التوجيه + استدعاء</span>
        </div>

        {/* Unexcused 3+ */}
        <div 
          onClick={() => { setActiveCategory("unexcused"); setActiveTier("tier_3"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "unexcused" && activeTier === "tier_3"
              ? "bg-amber-50 border-amber-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold">بدون عذر (3+)</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black text-amber-950">{stats.unexcused3Plus}</p>
          <span className="text-[10px] text-amber-600 block mt-0.5 font-medium">دراسة حالة + إشعار</span>
        </div>

        {/* Unexcused 5+ */}
        <div 
          onClick={() => { setActiveCategory("unexcused"); setActiveTier("tier_5"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "unexcused" && activeTier === "tier_5"
              ? "bg-orange-50 border-orange-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-orange-300"
          }`}
        >
          <div className="flex items-center justify-between text-orange-700 mb-1">
            <span className="text-[11px] font-bold">بدون عذر (5+)</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <p className="text-xl font-black text-orange-950">{stats.unexcused5Plus}</p>
          <span className="text-[10px] text-orange-600 block mt-0.5 font-medium">محضر اللجنة + خطة</span>
        </div>

        {/* Unexcused 10+ */}
        <div 
          onClick={() => { setActiveCategory("unexcused"); setActiveTier("tier_10"); }}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
            activeCategory === "unexcused" && activeTier === "tier_10"
              ? "bg-red-50 border-red-400 shadow-sm"
              : "bg-white border-slate-200/80 hover:border-red-300"
          }`}
        >
          <div className="flex items-center justify-between text-red-700 mb-1">
            <span className="text-[11px] font-bold">بدون عذر (10+)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          </div>
          <p className="text-xl font-black text-red-950">{stats.unexcused10Plus}</p>
          <span className="text-[10px] text-red-600 block mt-0.5 font-medium">حماية الطفل + إحالة</span>
        </div>

      </div>

      {/* 3. Workflow Category & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          
          {/* Category Toggle: Excused vs Unexcused */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setActiveCategory("unexcused")}
              className={`py-2 px-4 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeCategory === "unexcused"
                  ? "bg-red-600 text-white shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>الغياب بدون عذر</span>
            </button>

            <button
              onClick={() => setActiveCategory("excused")}
              className={`py-2 px-4 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeCategory === "excused"
                  ? "bg-blue-600 text-white shadow-xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>الغياب بعذر مقبول</span>
            </button>
          </div>

          {/* Sub Tier Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setActiveTier("all")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل ({noorAbsences.filter((s) => (activeCategory === "excused" ? s.excusedDaysCount : s.unexcusedDaysCount) > 0).length})
            </button>

            <button
              onClick={() => setActiveTier("tier_1")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "tier_1" ? "bg-yellow-500 text-slate-950 font-black" : "bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100"
              }`}
            >
              📌 اليوم الأول (1 يوم - بداية العام)
            </button>

            <button
              onClick={() => setActiveTier("tier_2")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "tier_2" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              يومان (2 أيام)
            </button>

            <button
              onClick={() => setActiveTier("tier_3")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "tier_3" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              3+ أيام (دراسة حالة / خطة)
            </button>

            <button
              onClick={() => setActiveTier("tier_5")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "tier_5" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              5+ أيام (لجنة التوجيه)
            </button>

            <button
              onClick={() => setActiveTier("tier_10")}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeTier === "tier_10" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              10+ أيام (حماية الطفل)
            </button>
          </div>

        </div>

        {/* Search & Grade Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب أو رقم الهوية..."
              className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {uniqueGrades.length > 0 && (
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
              >
                <option value="ALL">جميع الصفوف الدراسية</option>
                {uniqueGrades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            <span className="text-slate-500 font-semibold text-xs whitespace-nowrap">
              الطلاب المعروضون: <strong className="text-slate-900 font-bold">{filteredStudents.length}</strong> طالب
            </span>
          </div>
        </div>

      </div>

      {/* 4. Active Guidance Students Table & Actions */}
      <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
        
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-800">
                {noorAbsences.length === 0 
                  ? "لم يتم سحب أو رصد غيابات من نظام نور بعد" 
                  : "لا يوجد طلاب يطابقون الفلتر المحدد"}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {noorAbsences.length === 0
                  ? "يمكنك الضغط على 'تجربة غياب يوم واحد' لتجربة النظام فوراً، أو استخدام إضافة سحب غيابات نور."
                  : "جرب اختيار تبويب آخر أو الضغط على زر 'الكل'."}
              </p>
            </div>
            {noorAbsences.length === 0 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleLoadDay1SampleData}
                  className="px-5 py-2.5 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>🧪 تجربة غياب اليوم الأول (6 طلاب)</span>
                </button>
                <button
                  onClick={() => setIsNoorModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Zap className="w-4 h-4" />
                  <span>أداة سحب كشف نور</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            
            {filteredStudents.map((st, index) => {
              const daysCount = activeCategory === "excused" ? st.excusedDaysCount : st.unexcusedDaysCount;
              const datesList = activeCategory === "excused" ? st.excusedDates : st.unexcusedDates;
              const formattedDates = datesList.length > 0 ? datesList.join(" ، ") : "اليوم";
              const phone = getStudentPhone(st);
              const status = actionStatuses[st.id] || {};
              const isSending = sendingPhoneMap[st.id] || false;

              // Determine threshold tier
              const tierNumber: 3 | 5 | 10 = daysCount >= 10 ? 10 : daysCount >= 5 ? 5 : 3;

              return (
                <div key={st.id} className="p-5 sm:p-6 hover:bg-slate-50/70 transition-all space-y-4">
                  
                  {/* Top Row: Student Identity & Absence Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {index + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">{st.studentName}</h4>
                          
                          {daysCount === 1 ? (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-black bg-yellow-100 text-yellow-900 border border-yellow-300 flex items-center gap-1">
                              <span>📌 غياب اليوم الأول (بداية العام)</span>
                            </span>
                          ) : daysCount === 2 ? (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-800">
                              ⚠️ غياب يومين
                            </span>
                          ) : (
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold ${
                              tierNumber === 10
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : tierNumber === 5
                                ? "bg-orange-100 text-orange-800 border border-orange-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                              {tierNumber === 10 ? "🚨 مرحلة 10 أيام (إحالة لإدارة التعليم)" : tierNumber === 5 ? "⚠️ مرحلة 5 أيام (لجنة التوجيه)" : "📋 مرحلة 3 أيام (دراسة حالة)"}
                            </span>
                          )}

                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                            {st.grade || "الصف"} {st.className ? `- (${st.className})` : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {st.nationalId && <span>الهوية: <strong className="font-mono text-slate-700">{st.nationalId}</strong></span>}
                          <span>الجوال: <strong className="font-mono text-slate-700" dir="ltr">{phone || "غير متوفر"}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Absence Days Pill Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right sm:text-left">
                        <span className="text-[10px] text-slate-500 font-semibold block">رصيد الغياب بنور:</span>
                        <strong className={`text-base font-black ${activeCategory === "excused" ? "text-blue-700" : "text-red-700"}`}>
                          {daysCount} {daysCount === 1 ? "يوم" : daysCount === 2 ? "يومان" : "أيام"} {activeCategory === "excused" ? "بعذر" : "بدون عذر"}
                        </strong>
                      </div>
                    </div>

                  </div>

                  {/* Middle Row: Exact Dates from Noor */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800">تواريخ الغياب المدونة بنظام نور:</span>
                      <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
                        {formattedDates}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Row: Actions */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                    
                    {/* Guidance Documents Generation Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      
                      {daysCount >= 3 ? (
                        <>
                          {/* Excused Actions */}
                          {activeCategory === "excused" && (
                            <>
                              <button
                                onClick={() => setDocModal({
                                  isOpen: true,
                                  docType: "learning_plan",
                                  student: st,
                                  absenceCategory: "excused",
                                  thresholdDays: tierNumber,
                                })}
                                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>خطة التعلم أثناء الغياب</span>
                              </button>

                              <button
                                onClick={() => setDocModal({
                                  isOpen: true,
                                  docType: "case_study",
                                  student: st,
                                  absenceCategory: "excused",
                                  thresholdDays: tierNumber,
                                })}
                                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>دراسة حالة الطالب</span>
                              </button>

                              {daysCount >= 5 && (
                                <button
                                  onClick={() => setDocModal({
                                    isOpen: true,
                                    docType: "committee_minutes",
                                    student: st,
                                    absenceCategory: "excused",
                                    thresholdDays: tierNumber,
                                  })}
                                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                >
                                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>محضر اجتماع لجنة التوجيه</span>
                                </button>
                              )}

                              {daysCount >= 10 && (
                                <button
                                  onClick={() => setDocModal({
                                    isOpen: true,
                                    docType: "principal_referral",
                                    student: st,
                                    absenceCategory: "excused",
                                    thresholdDays: tierNumber,
                                  })}
                                  className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                                  <span>استمارة الإحالة لمدير المدرسة</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* Unexcused Actions */}
                          {activeCategory === "unexcused" && (
                            <>
                              <button
                                onClick={() => setDocModal({
                                  isOpen: true,
                                  docType: "case_study",
                                  student: st,
                                  absenceCategory: "unexcused",
                                  thresholdDays: tierNumber,
                                })}
                                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>توليد دراسة حالة ذكية</span>
                              </button>

                              {daysCount >= 5 && (
                                <button
                                  onClick={() => setDocModal({
                                    isOpen: true,
                                    docType: "committee_minutes",
                                    student: st,
                                    absenceCategory: "unexcused",
                                    thresholdDays: tierNumber,
                                  })}
                                  className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                >
                                  <Users className="w-3.5 h-3.5 text-orange-600" />
                                  <span>محضر اجتماع اللجنة والخطة العلاجية</span>
                                </button>
                              )}

                              {daysCount >= 10 && (
                                <button
                                  onClick={() => setDocModal({
                                    isOpen: true,
                                    docType: "principal_referral",
                                    student: st,
                                    absenceCategory: "unexcused",
                                    thresholdDays: tierNumber,
                                  })}
                                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-white" />
                                  <span>استمارة الإحالة لنظام حماية الطفل</span>
                                </button>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        /* Day 1 and Day 2 Actions */
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-xl">
                            📋 تم التوثيق في سجل الغياب اليومي
                          </span>
                        </div>
                      )}

                      {/* View Actions History Summary */}
                      <button
                        onClick={() => setDocModal({
                          isOpen: true,
                          docType: "actions_history",
                          student: st,
                          absenceCategory: activeCategory,
                          thresholdDays: tierNumber,
                        })}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>سجل ما تم عمله</span>
                      </button>

                    </div>

                    {/* WhatsApp Instant Trigger Button */}
                    <div className="flex items-center gap-2">
                      {status.whatsappSent && (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم الإشعار ✓</span>
                        </span>
                      )}

                      <button
                        disabled={isSending}
                        onClick={() => handleSendWhatsAppNotification(st, activeCategory, daysCount)}
                        className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all ${
                          status.whatsappSent 
                            ? "bg-slate-800 hover:bg-slate-700 text-white" 
                            : daysCount === 1
                            ? "bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black shadow-md"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSending
                            ? "جارِ الإرسال..." 
                            : daysCount === 1
                            ? "إرسال إشعار غياب اليوم الأول بالواتساب ⚡"
                            : daysCount === 2
                            ? "إرسال تذكير غياب يومين بالواتساب"
                            : tierNumber === 10
                            ? "إشعار ولي الأمر بالإحالة النظامية" 
                            : tierNumber === 5
                            ? "إرسال استدعاء جلسة توعوية بالواتساب" 
                            : "إرسال الخطة والتواريخ بالواتساب"}
                        </span>
                      </button>
                    </div>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>

      {/* Guidance Document Modal */}
      {docModal.isOpen && docModal.student && (
        <GuidanceDocumentModal
          isOpen={docModal.isOpen}
          onClose={() => setDocModal((prev) => ({ ...prev, isOpen: false }))}
          docType={docModal.docType}
          student={docModal.student}
          signatories={signatories}
          absenceCategory={docModal.absenceCategory}
          thresholdDays={docModal.thresholdDays}
          onSendWhatsApp={(msg) => {
            if (docModal.student) {
              const p = getStudentPhone(docModal.student);
              if (p) onSendSingleMessage(p, msg, docModal.student.studentName);
            }
          }}
        />
      )}

      {/* Noor Importer & Bookmarklet Modal */}
      <NoorImporterModal
        isOpen={isNoorModalOpen}
        onClose={() => setIsNoorModalOpen(false)}
        onImportAbsences={handleImportAbsences}
        students={students}
      />

    </div>
  );
}
