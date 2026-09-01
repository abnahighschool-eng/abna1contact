import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Printer, 
  FileText, 
  Calendar, 
  Filter, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Download, 
  RefreshCw, 
  GraduationCap, 
  Layers, 
  Clock, 
  FileSpreadsheet, 
  Info,
  Sparkles,
  Settings,
  Image as ImageIcon,
  Check,
  UserX,
  UserCheck,
  School,
  AlertTriangle,
  Send,
  Eye
} from "lucide-react";
import { Student, SchoolSignatories, ReportPrintOptions } from "../types";
import { extractStudentName, extractStudentPhone, extractStudentGrade, extractStudentClass } from "./AttendanceSystem";
import { saveSchoolDataToCloud } from "../firebaseService";

export interface AttendanceRecordEntry {
  status: "present" | "absent_unexcused" | "absent_excused" | "tardy";
  tardyMinutes?: number;
  notes?: string;
  notified?: boolean;
  notifiedAt?: string;
}

export interface DisciplineReportItem {
  id: string;
  studentId: string;
  studentName: string;
  civilId?: string;
  grade: string;
  className: string;
  phone: string;
  date: string;
  dayName: string;
  status: "present" | "absent_unexcused" | "absent_excused" | "tardy";
  tardyMinutes?: number;
  notes?: string;
  notified?: boolean;
  notifiedAt?: string;
}

interface DisciplineReportsPrinterProps {
  students: Student[];
  attendanceRecords?: Record<string, Record<string, AttendanceRecordEntry>>;
  signatories: SchoolSignatories;
  initialDate?: string;
  isWhatsAppConnected?: boolean;
  onUpdateSignatory?: (updated: Partial<SchoolSignatories>) => void;
  onNavigateToTab?: (tab: "guidance_workflow" | "daily_absence" | "daily_tardiness" | "notifications" | "reports") => void;
}

export default function DisciplineReportsPrinter({
  students,
  attendanceRecords: propsAttendanceRecords,
  signatories,
  initialDate,
  isWhatsAppConnected,
  onUpdateSignatory,
  onNavigateToTab,
}: DisciplineReportsPrinterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolved attendance records: props or localStorage
  const attendanceRecords = useMemo(() => {
    if (propsAttendanceRecords && Object.keys(propsAttendanceRecords).length > 0) {
      return propsAttendanceRecords;
    }
    try {
      const stored = localStorage.getItem("attendance_records");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading stored attendance_records:", e);
    }
    return propsAttendanceRecords || {};
  }, [propsAttendanceRecords, lastRefreshed]);

  // Local copy of signatories for live in-report editing
  const [localSignatories, setLocalSignatories] = useState<SchoolSignatories>({
    countryName: signatories?.countryName || "المملكة العربية السعودية",
    ministryName: signatories?.ministryName || "وزارة التعليم",
    administrationName: signatories?.administrationName || "الإدارة العامة للتعليم",
    schoolName: signatories?.schoolName || "ثانوية الأبناء الأولى",
    principalName: signatories?.principalName || "",
    vicePrincipalName: signatories?.vicePrincipalName || "",
    counselorName: signatories?.counselorName || "",
    systemManagerName: signatories?.systemManagerName || "",
    logoUrl: signatories?.logoUrl || "",
    logoWidth: signatories?.logoWidth || 65,
    logoHeight: signatories?.logoHeight || 65,
  });

  useEffect(() => {
    if (signatories) {
      setLocalSignatories((prev) => ({
        ...prev,
        ...signatories,
        countryName: signatories.countryName || prev.countryName || "المملكة العربية السعودية",
        ministryName: signatories.ministryName || prev.ministryName || "وزارة التعليم",
        administrationName: signatories.administrationName || prev.administrationName || "الإدارة العامة للتعليم",
        schoolName: signatories.schoolName || prev.schoolName || "ثانوية الأبناء الأولى",
        logoWidth: signatories.logoWidth || prev.logoWidth || 65,
        logoHeight: signatories.logoHeight || prev.logoHeight || 65,
      }));
    }
  }, [signatories]);

  // Paper & Layout settings for Discipline report
  const [printOptions, setPrintOptions] = useState<ReportPrintOptions>(() => {
    const saved = localStorage.getItem("discipline_print_options");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      messageDisplayMode: "header_summary",
      tableFontSize: "compact",
      removeBlankLines: true,
      showSignatures: true,
      showStatsBox: true,
    };
  });

  const handleUpdatePrintOptions = (updates: Partial<ReportPrintOptions>) => {
    setPrintOptions((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("discipline_print_options", JSON.stringify(next));
      return next;
    });
  };

  // Fixed report meta
  const [reportMeta, setReportMeta] = useState<{
    dateStr: string;
    timeStr: string;
    refNumber: string;
  }>(() => {
    const now = new Date();
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    return {
      dateStr: now.toLocaleDateString("ar-SA"),
      timeStr: now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      refNumber: `DISC-${now.getFullYear()}-${randomCode}`,
    };
  });

  // Filter State
  const [filter, setFilter] = useState<{
    dateMode: "today" | "yesterday" | "last7days" | "last30days" | "specific_date" | "range" | "all";
    specificDate: string;
    startDate: string;
    endDate: string;
    grade: string;
    className: string;
    status: "all" | "present" | "all_absence" | "absent_unexcused" | "absent_excused" | "tardy";
    studentSearch: string;
    notifiedOnly: "all" | "notified" | "not_notified";
  }>(() => {
    const todayISO = new Date().toISOString().split("T")[0];
    return {
      dateMode: "specific_date",
      specificDate: initialDate || todayISO,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      endDate: todayISO,
      grade: "all",
      className: "all",
      status: "all",
      studentSearch: "",
      notifiedOnly: "all",
    };
  });

  // Keep specific date in sync with initialDate prop changes
  useEffect(() => {
    if (initialDate) {
      setFilter((prev) => ({
        ...prev,
        specificDate: initialDate,
      }));
    }
  }, [initialDate]);

  // Unique Grades and Classes
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((st) => {
      const g = extractStudentGrade(st);
      if (g) grades.add(g);
    });
    return Array.from(grades).sort();
  }, [students]);

  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    students.forEach((st) => {
      const g = extractStudentGrade(st);
      if (filter.grade === "all" || g === filter.grade) {
        const c = extractStudentClass(st);
        if (c) classes.add(c);
      }
    });
    return Array.from(classes).sort();
  }, [students, filter.grade]);

  // Extract helper for civil ID
  const extractCivilId = (st: any): string => {
    if (!st) return "";
    const idKeys = ["id", "civilId", "السجل المدني", "سجل مدني", "رقم الهوية", "الهوية", "رقم السجل", "الوطني", "رقم_الهوية"];
    for (const k of idKeys) {
      if (st[k] && String(st[k]).trim() !== "") return String(st[k]).trim();
    }
    return "";
  };

  // Helper to get Arabic Day name
  const getArabicDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("ar-SA", { weekday: "long" });
    } catch {
      return "اليوم";
    }
  };

  // Build full flattened discipline records list based on dates in state and query
  const allDisciplineItems = useMemo<DisciplineReportItem[]>(() => {
    const items: DisciplineReportItem[] = [];
    const targetDatesSet = new Set<string>(Object.keys(attendanceRecords));
    
    // Ensure queried date, today, and yesterday are always represented
    if (filter.specificDate) targetDatesSet.add(filter.specificDate);
    const todayStr = new Date().toISOString().split("T")[0];
    targetDatesSet.add(todayStr);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    targetDatesSet.add(yesterdayStr);

    const targetDates = Array.from(targetDatesSet);

    targetDates.forEach((dStr) => {
      const dayData = attendanceRecords[dStr] || {};
      const dayName = getArabicDayName(dStr);

      students.forEach((st, idx) => {
        const rec = dayData[st.id];
        const status = rec?.status || "present";
        const studentName = extractStudentName(st, idx + 1);
        const grade = extractStudentGrade(st);
        const className = extractStudentClass(st);
        const phone = extractStudentPhone(st);
        const civilId = extractCivilId(st);

        items.push({
          id: `${dStr}_${st.id}`,
          studentId: st.id,
          studentName,
          civilId,
          grade,
          className,
          phone,
          date: dStr,
          dayName,
          status,
          tardyMinutes: rec?.tardyMinutes,
          notes: rec?.notes,
          notified: rec?.notified,
          notifiedAt: rec?.notifiedAt,
        });
      });
    });

    return items;
  }, [students, attendanceRecords, filter.specificDate]);

  // Filter items based on active criteria
  const filteredItems = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    return allDisciplineItems.filter((item) => {
      // 1. Date Filtering
      if (filter.dateMode === "today") {
        if (item.date !== todayStr) return false;
      } else if (filter.dateMode === "yesterday") {
        if (item.date !== yesterday) return false;
      } else if (filter.dateMode === "last7days") {
        if (item.date < sevenDaysAgo || item.date > todayStr) return false;
      } else if (filter.dateMode === "last30days") {
        if (item.date < thirtyDaysAgo || item.date > todayStr) return false;
      } else if (filter.dateMode === "specific_date") {
        if (item.date !== filter.specificDate) return false;
      } else if (filter.dateMode === "range") {
        if (item.date < filter.startDate || item.date > filter.endDate) return false;
      }

      // 2. Grade Filter
      if (filter.grade !== "all" && item.grade !== filter.grade) {
        return false;
      }

      // 3. Class Filter
      if (filter.className !== "all" && item.className !== filter.className) {
        return false;
      }

      // 4. Status Filter
      if (filter.status === "present" && item.status !== "present") return false;
      if (filter.status === "all_absence" && item.status !== "absent_unexcused" && item.status !== "absent_excused") return false;
      if (filter.status === "absent_unexcused" && item.status !== "absent_unexcused") return false;
      if (filter.status === "absent_excused" && item.status !== "absent_excused") return false;
      if (filter.status === "tardy" && item.status !== "tardy") return false;

      // 5. Notification Filter
      if (filter.notifiedOnly === "notified" && !item.notified) return false;
      if (filter.notifiedOnly === "not_notified" && item.notified) return false;

      // 6. Free Search
      if (filter.studentSearch.trim()) {
        const q = filter.studentSearch.toLowerCase().trim();
        const matchesName = item.studentName.toLowerCase().includes(q);
        const matchesPhone = item.phone.toLowerCase().includes(q);
        const matchesCivil = item.civilId ? item.civilId.toLowerCase().includes(q) : false;
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesPhone && !matchesCivil && !matchesNotes) return false;
      }

      return true;
    });
  }, [allDisciplineItems, filter]);

  // Statistics for the filtered view
  const stats = useMemo(() => {
    let present = 0;
    let absentUnexcused = 0;
    let absentExcused = 0;
    let tardy = 0;
    let notifiedCount = 0;
    const uniqueStudentSet = new Set<string>();

    filteredItems.forEach((it) => {
      uniqueStudentSet.add(it.studentId);
      if (it.status === "present") present++;
      else if (it.status === "absent_unexcused") absentUnexcused++;
      else if (it.status === "absent_excused") absentExcused++;
      else if (it.status === "tardy") tardy++;

      if (it.notified) notifiedCount++;
    });

    const total = filteredItems.length;
    const totalAbsence = absentUnexcused + absentExcused;
    const disciplineRate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      absentUnexcused,
      absentExcused,
      totalAbsence,
      tardy,
      notifiedCount,
      uniqueStudents: uniqueStudentSet.size,
      disciplineRate,
    };
  }, [filteredItems]);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("يرجى اختيار ملف صورة صالح (PNG, JPG, SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميغابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLocalSignatories((prev) => ({ ...prev, logoUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  // Save Signatories
  const handleSaveSignatories = () => {
    if (onUpdateSignatory) {
      onUpdateSignatory(localSignatories);
    }
    saveSchoolDataToCloud({
      countryName: localSignatories.countryName,
      ministryName: localSignatories.ministryName,
      administrationName: localSignatories.administrationName,
      schoolName: localSignatories.schoolName,
      principalName: localSignatories.principalName,
      vicePrincipalName: localSignatories.vicePrincipalName,
      counselorName: localSignatories.counselorName,
      systemManagerName: localSignatories.systemManagerName,
      logoUrl: localSignatories.logoUrl,
    }).catch(console.error);

    setShowConfigModal(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  // Export to Excel / CSV
  const handleExportToExcel = () => {
    if (filteredItems.length === 0) {
      alert("لا توجد بيانات لتصديرها.");
      return;
    }

    const headers = [
      "م",
      "اسم الطالب",
      "السجل المدني",
      "الصف",
      "الفصل",
      "رقم الجوال",
      "التاريخ",
      "اليوم",
      "حالة الانضباط",
      "دقائق التأخر / السبب",
      "إشعار الواتساب",
      "وقت الإشعار",
    ];

    const rows = filteredItems.map((item, idx) => {
      let statusArabic = "حاضر";
      if (item.status === "absent_unexcused") statusArabic = "غائب بدون عذر";
      else if (item.status === "absent_excused") statusArabic = "غائب بعذر مقبول";
      else if (item.status === "tardy") statusArabic = `متأخر (${item.tardyMinutes || 15} دقيقة)`;

      return [
        idx + 1,
        `"${item.studentName.replace(/"/g, '""')}"`,
        `"${item.civilId || ""}"`,
        `"${item.grade || ""}"`,
        `"${item.className || ""}"`,
        `"${item.phone || ""}"`,
        `"${item.date}"`,
        `"${item.dayName}"`,
        `"${statusArabic}"`,
        `"${item.notes || (item.status === "tardy" ? `${item.tardyMinutes || 15} دقيقة` : "")}"`,
        `"${item.notified ? "تم الإرسال بنجاح" : "لم يتم"}"`,
        `"${item.notifiedAt || ""}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `كشف_الانضباط_المدرسي_${filter.specificDate || "تقرير"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct Print
  const handlePrint = () => {
    window.print();
  };

  // Human date label
  const getFilterDateDescription = () => {
    if (filter.dateMode === "today") return "اليوم الحالي";
    if (filter.dateMode === "yesterday") return "يوم أمس";
    if (filter.dateMode === "last7days") return "آخر 7 أيام";
    if (filter.dateMode === "last30days") return "آخر 30 يوماً";
    if (filter.dateMode === "specific_date") return `يوم ${filter.specificDate} (${getArabicDayName(filter.specificDate)})`;
    if (filter.dateMode === "range") return `من ${filter.startDate} إلى ${filter.endDate}`;
    return "كافة الفترات المسجلة";
  };

  const getTableDensityClass = () => {
    if (printOptions.tableFontSize === "compact") return "text-[10px]";
    if (printOptions.tableFontSize === "large") return "text-xs";
    return "text-[11px]";
  };

  const getRowPaddingClass = () => {
    if (printOptions.tableFontSize === "compact") return "py-1.5 px-2";
    if (printOptions.tableFontSize === "large") return "py-2.5 px-3";
    return "py-2 px-2.5";
  };

  return (
    <div className="space-y-6" id="discipline-reports-printer-root">
      
      {/* Strict A4 Print CSS Styles (Exact 1.5cm margins on all 4 sides) */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 1.5cm !important;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #discipline-reports-printer-root {
            margin: 0 !important;
            padding: 0 !important;
          }
          #official-discipline-printable-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            min-height: auto !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {savedToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-bounce no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>تم حفظ إعدادات وترويسة كشف الانضباط بنجاح</span>
        </div>
      )}

      {/* 1. TOP CONTROL BAR (Filters, Refresh, Excel Export, Print, Signatories Config) */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 no-print" id="discipline-report-filters-card">
        
        {/* Title and Top Action Buttons */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-emerald-600" />
              <span>كشف الانضباط والطباعة الرسمي</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              استعلام شامل وتوليد تقارير الانضباط المدرسي وطباعتها مباشرة بحجم A4 مع الترويسة والتواقيع المعتمدة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            
            {/* Signatories & Header Setup Button */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="تعديل ترويسة المدرسة وأسماء المعتمدين للطباعة"
              id="btn-discipline-signatories-config"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>إعدادات الترويسة والتواقيع</span>
            </button>

            {/* Export to Excel */}
            <button
              onClick={handleExportToExcel}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-200"
              title="تصدير جدول الاستعلام إلى ملف Excel"
              id="btn-discipline-export-excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>

            {/* Print Official Sheet Button */}
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              id="btn-discipline-print-now"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة الكشف الرسمي (A4)</span>
            </button>

          </div>
        </div>

        {/* Query Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* 1. Date Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>المدى الزمني للاستعلام:</span>
            </label>
            <select
              value={filter.dateMode}
              onChange={(e) => setFilter((prev) => ({ ...prev, dateMode: e.target.value as any }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800 cursor-pointer"
              id="select-discipline-date-mode"
            >
              <option value="specific_date">استعلام بيوم محدد 📅</option>
              <option value="today">اليوم الحالي</option>
              <option value="yesterday">يوم أمس</option>
              <option value="last7days">آخر 7 أيام</option>
              <option value="last30days">آخر 30 يوماً</option>
              <option value="range">مدى زمني مخصص (من - إلى) 🗓️</option>
              <option value="all">كافة التواريخ المسجلة</option>
            </select>
          </div>

          {/* Conditional Specific Date Picker */}
          {filter.dateMode === "specific_date" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">اليوم المحدد:</label>
              <input
                type="date"
                value={filter.specificDate}
                onChange={(e) => setFilter((prev) => ({ ...prev, specificDate: e.target.value }))}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center font-bold text-slate-800 cursor-pointer"
              />
            </div>
          )}

          {/* Conditional Date Range Pickers */}
          {filter.dateMode === "range" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">من تاريخ:</label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center font-bold text-slate-800"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">إلى تاريخ:</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-center font-bold text-slate-800"
                />
              </div>
            </>
          )}

          {/* 2. Grade Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>تحديد الصف الدراسي:</span>
            </label>
            <select
              value={filter.grade}
              onChange={(e) => setFilter((prev) => ({ ...prev, grade: e.target.value, className: "all" }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800 cursor-pointer"
              id="select-discipline-grade"
            >
              <option value="all">كافة الصفوف الدراسية ({uniqueGrades.length})</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 3. Class / Section Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>تحديد الشعبة / الفصل:</span>
            </label>
            <select
              value={filter.className}
              onChange={(e) => setFilter((prev) => ({ ...prev, className: e.target.value }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800 cursor-pointer"
              id="select-discipline-class"
            >
              <option value="all">كافة الفصول / الشعب ({uniqueClasses.length})</option>
              {uniqueClasses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Discipline Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>حالة الانضباط المطلوبة:</span>
            </label>
            <select
              value={filter.status}
              onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value as any }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800 cursor-pointer"
              id="select-discipline-status"
            >
              <option value="all">كافة الحالات (حضور + غياب + تأخر)</option>
              <option value="all_absence">الغياب فقط (بعذر وبدون عذر)</option>
              <option value="absent_unexcused">غائب بدون عذر فقط</option>
              <option value="absent_excused">غائب بعذر مقبول فقط</option>
              <option value="tardy">المتأخرون صباحاً فقط</option>
              <option value="present">الحاضرون فقط</option>
            </select>
          </div>

          {/* 5. Notification Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Send className="w-3.5 h-3.5 text-slate-500 rotate-180" />
              <span>حالة إشعار ولي الأمر:</span>
            </label>
            <select
              value={filter.notifiedOnly}
              onChange={(e) => setFilter((prev) => ({ ...prev, notifiedOnly: e.target.value as any }))}
              className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800 cursor-pointer"
            >
              <option value="all">الكل (تم الإشعار وبانتظار الإرسال)</option>
              <option value="notified">تم إشعار ولي الأمر فقط (✓)</option>
              <option value="not_notified">لم يتم الإشعار بعد</option>
            </select>
          </div>

          {/* 6. Free Search (Student Name, Civil ID, Phone) */}
          <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>بحث سريع (اسم الطالب، السجل المدني، رقم الجوال):</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={filter.studentSearch}
                onChange={(e) => setFilter((prev) => ({ ...prev, studentSearch: e.target.value }))}
                placeholder="ابحث باسم الطالب، رقم الهوية، رقم الجوال، أو الملاحظات..."
                className="w-full border border-slate-200 bg-slate-50 rounded-xl pr-3 pl-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold text-slate-800"
                id="input-discipline-search"
              />
              {filter.studentSearch && (
                <button
                  onClick={() => setFilter((prev) => ({ ...prev, studentSearch: "" }))}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Paper & Formatting Controls Strip (Print Options) */}
        <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-xs gap-3">
          
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>خيارات الطباعة وتوفير الورق:</span>
            </span>

            {/* Font size */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => handleUpdatePrintOptions({ tableFontSize: "compact" })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  printOptions.tableFontSize === "compact" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                مضغوط (أوفر للورق)
              </button>
              <button
                onClick={() => handleUpdatePrintOptions({ tableFontSize: "normal" })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  printOptions.tableFontSize === "normal" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                عادي
              </button>
            </div>

            {/* Toggle Stats Box */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={printOptions.showStatsBox}
                onChange={(e) => handleUpdatePrintOptions({ showStatsBox: e.target.checked })}
                className="w-3.5 h-3.5 accent-slate-900 rounded"
              />
              <span>إظهار إحصائيات الانضباط</span>
            </label>

            {/* Toggle Signatures */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-700">
              <input
                type="checkbox"
                checked={printOptions.showSignatures}
                onChange={(e) => handleUpdatePrintOptions({ showSignatures: e.target.checked })}
                className="w-3.5 h-3.5 accent-slate-900 rounded"
              />
              <span>إظهار قسم التواقيع الرسمية</span>
            </label>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold">
            النطاق: <strong>{getFilterDateDescription()}</strong> | الصف: <strong>{filter.grade === "all" ? "الكل" : filter.grade}</strong>
          </div>

        </div>

      </div>

      {/* 2. QUICK KPI METRICS STRIP (Hidden on print) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 no-print" id="discipline-quick-kpis">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-1 text-right">
          <span className="text-[11px] font-bold text-slate-500">إجمالي سجلات الكشف</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
            <span className="text-xs text-slate-400">سجل</span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-1 text-right">
          <span className="text-[11px] font-bold text-emerald-700">الحاضرون (الانضباط)</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">{stats.present}</span>
            <span className="text-xs font-bold text-emerald-700">({stats.disciplineRate}%)</span>
          </div>
        </div>

        <div className="bg-white border border-red-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-1 text-right">
          <span className="text-[11px] font-bold text-red-700">غائب بدون عذر</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-red-600">{stats.absentUnexcused}</span>
            <span className="text-xs text-slate-400">طالب</span>
          </div>
        </div>

        <div className="bg-white border border-blue-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-1 text-right">
          <span className="text-[11px] font-bold text-blue-700">غائب بعذر مقبول</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-600">{stats.absentExcused}</span>
            <span className="text-xs text-slate-400">طالب</span>
          </div>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-2xs flex flex-col gap-1 text-right col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-amber-700">المتأخرون صباحاً</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-600">{stats.tardy}</span>
            <span className="text-xs text-slate-400">طالب</span>
          </div>
        </div>

      </div>

      {/* 3. A4 PRINTABLE DOCUMENT CONTAINER (Strict standard A4 matching ReportsPrinter with 1.5cm margins) */}
      <div 
        id="official-discipline-printable-sheet"
        className="w-full max-w-[210mm] mx-auto bg-white border border-slate-300 shadow-xl rounded-2xl print:rounded-none print:shadow-none print:border-none p-[1.5cm] print:p-0 flex flex-col gap-4 text-slate-900 transition-all text-right"
        style={{ minHeight: "297mm" }}
      >
        
        {/* OFFICIAL INSTITUTIONAL HEADER */}
        <div className="border-b-2 border-slate-900 pb-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-4">
            
            {/* Right: State, Ministry, Administration & School Details */}
            <div className="text-right flex flex-col text-xs leading-snug text-slate-800 flex-1">
              <span className="font-extrabold text-xs sm:text-sm text-slate-950 tracking-wide">
                {localSignatories.countryName || "المملكة العربية السعودية"}
              </span>
              <span className="font-bold text-xs text-slate-900 mt-0.5">
                {localSignatories.ministryName || "وزارة التعليم"}
              </span>
              <span className="font-semibold text-slate-700 text-[11px] mt-0.5">
                {localSignatories.administrationName || "الإدارة العامة للتعليم"}
              </span>
              <span className="font-extrabold text-xs text-emerald-900 mt-0.5">
                {localSignatories.schoolName || "ثانوية الأبناء الأولى"}
              </span>
            </div>

            {/* Center: Customizable Logo & Official Title */}
            <div className="flex flex-col items-center justify-center text-center shrink-0 px-2">
              
              {/* Logo */}
              {localSignatories.logoUrl ? (
                <div className="mb-1 flex items-center justify-center">
                  <img
                    src={localSignatories.logoUrl}
                    alt="شعار المدرسة"
                    referrerPolicy="no-referrer"
                    style={{
                      width: `${localSignatories.logoWidth || 60}px`,
                      height: `${localSignatories.logoHeight || 60}px`,
                      objectFit: "contain",
                    }}
                    className="rounded-md"
                  />
                </div>
              ) : (
                <div className="mb-1 flex items-center justify-center text-emerald-800">
                  <div className="w-10 h-10 rounded-xl border border-emerald-700 flex items-center justify-center bg-emerald-50/50">
                    <School className="w-5 h-5 text-emerald-800" />
                  </div>
                </div>
              )}

              <h1 className="text-sm sm:text-base font-black text-slate-950 tracking-tight leading-snug">
                كشف الانضباط والغياب والتأخر اليومي للطلاب
              </h1>
              <span className="text-[10px] font-semibold text-slate-600">
                (نظام الإشعار والمتابعة المدرسية المعتمد)
              </span>
            </div>

            {/* Left: Metadata & Timestamps */}
            <div className="text-left flex flex-col text-[11px] leading-tight text-slate-800 font-mono flex-1">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-sans font-bold text-slate-900">تاريخ التقرير:</span>
                <span className="font-bold">{reportMeta.dateStr}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="font-sans font-medium text-slate-600">وقت الإصدار:</span>
                <span>{reportMeta.timeStr}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                <span className="font-sans font-medium text-slate-600">الرقم المرجعي:</span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-800 border border-slate-200">
                  {reportMeta.refNumber}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* STATISTICAL SUMMARY BOX */}
        {printOptions.showStatsBox && (
          <div className="bg-slate-50/80 border border-slate-300 rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] print-avoid-break">
            
            {/* Metadata Row */}
            <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-1.5 text-right">
              <div>
                <span className="text-slate-500 font-medium block text-[9px]">نطاق الاستعلام:</span>
                <span className="font-bold text-slate-900 text-[10px]">{getFilterDateDescription()}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block text-[9px]">الصف المحدد:</span>
                <span className="font-bold text-slate-900 text-[10px]">{filter.grade === "all" ? "كافة الصفوف" : filter.grade}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block text-[9px]">الشعبة / الفصل:</span>
                <span className="font-bold text-slate-900 text-[10px]">{filter.className === "all" ? "كافة الفصول" : filter.className}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block text-[9px]">حالة الاستعلام:</span>
                <span className="font-bold text-slate-900 text-[10px]">
                  {filter.status === "all" ? "جميع الحالات" : filter.status === "all_absence" ? "الغياب فقط" : filter.status === "tardy" ? "المتأخرون فقط" : filter.status}
                </span>
              </div>
            </div>

            {/* KPI Summary Row */}
            <div className="flex items-center justify-between text-[10px] pt-0.5">
              <div className="flex items-center gap-3 font-semibold">
                <span><strong>إجمالي السجلات:</strong> {stats.total}</span>
                <span className="text-emerald-800"><strong>الحاضرون:</strong> {stats.present} ({stats.disciplineRate}%)</span>
                <span className="text-red-800"><strong>إجمالي الغياب:</strong> {stats.totalAbsence} (بدون عذر: {stats.absentUnexcused} / بعذر: {stats.absentExcused})</span>
                <span className="text-amber-800"><strong>المتأخرون:</strong> {stats.tardy}</span>
              </div>
              <div className="font-semibold text-slate-700">
                الطلاب المشمولون: <strong>{stats.uniqueStudents} طالب</strong>
              </div>
            </div>

          </div>
        )}

        {/* DETAILED DATA TABLE */}
        <div className="flex-1 flex flex-col">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 gap-3 border border-dashed border-slate-200 rounded-xl my-4">
              <FileText className="w-10 h-10 text-slate-300" />
              <div className="font-bold text-sm text-slate-600">لا توجد سجلات انضباط تطابق محددات الاستعلام</div>
              <p className="text-xs text-slate-400 max-w-md">
                قم بتغيير محددات البحث أو التاريخ أو رصد غياب وتأخر الطلاب ليتم إدراجهم هنا فوراً.
              </p>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("daily_absence")}
                  className="mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center gap-1.5 no-print cursor-pointer"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>الذهاب لرصد الغياب اليومي</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-right border-collapse border border-slate-300 ${getTableDensityClass()}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                    <th className={`${getRowPaddingClass()} w-8 text-center border-l border-slate-300`}>م</th>
                    <th className={`${getRowPaddingClass()} border-l border-slate-300 w-44`}>اسم الطالب</th>
                    <th className={`${getRowPaddingClass()} w-24 border-l border-slate-300 text-center font-mono`}>السجل المدني</th>
                    <th className={`${getRowPaddingClass()} w-24 border-l border-slate-300 text-center`}>الصف / الفصل</th>
                    <th className={`${getRowPaddingClass()} w-24 border-l border-slate-300 text-center font-mono`}>جوال ولي الأمر</th>
                    <th className={`${getRowPaddingClass()} w-20 border-l border-slate-300 text-center`}>التاريخ</th>
                    <th className={`${getRowPaddingClass()} w-28 border-l border-slate-300 text-center`}>حالة الانضباط</th>
                    <th className={`${getRowPaddingClass()} border-l border-slate-300 min-w-[120px]`}>ملاحظات / السبب</th>
                    <th className={`${getRowPaddingClass()} w-24 text-center`}>إشعار ولي الأمر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.map((item, index) => {
                    const isPresent = item.status === "present";
                    const isTardy = item.status === "tardy";
                    const isUnexcused = item.status === "absent_unexcused";
                    const isExcused = item.status === "absent_excused";

                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors print-avoid-break print-compact-row">
                        <td className={`${getRowPaddingClass()} text-center font-bold text-slate-600 border-l border-slate-200`}>
                          {index + 1}
                        </td>
                        <td className={`${getRowPaddingClass()} font-bold text-slate-900 border-l border-slate-200`}>
                          {item.studentName}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center font-mono text-slate-700 text-[10px] border-l border-slate-200`} dir="ltr">
                          {item.civilId || "-"}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center text-slate-700 border-l border-slate-200`}>
                          {item.grade ? `${item.grade} ${item.className ? `/ ${item.className}` : ""}` : "-"}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center font-mono text-slate-700 text-[10px] border-l border-slate-200`} dir="ltr">
                          {item.phone || "-"}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center text-slate-600 text-[10px] border-l border-slate-200`}>
                          {item.date}
                        </td>
                        
                        {/* Discipline Status Badge */}
                        <td className={`${getRowPaddingClass()} text-center border-l border-slate-200`}>
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-[9.5px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 print:border-none">
                              حاضر ✓
                            </span>
                          ) : isTardy ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-800 text-[9.5px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 print:border-none">
                              تأخر ({item.tardyMinutes || 15} د)
                            </span>
                          ) : isExcused ? (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-800 text-[9.5px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 print:border-none">
                              غياب بعذر
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-800 text-[9.5px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 print:border-none">
                              غياب بدون عذر
                            </span>
                          )}
                        </td>

                        {/* Notes / Reason */}
                        <td className={`${getRowPaddingClass()} text-slate-700 border-l border-slate-200 text-[10px]`}>
                          {item.notes || (isTardy ? `تأخر ${item.tardyMinutes || 15} دقيقة عن الاصطفاف` : "-")}
                        </td>

                        {/* WhatsApp Notification Status */}
                        <td className={`${getRowPaddingClass()} text-center`}>
                          {item.notified ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-[9.5px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 print:border-none">
                              ✓ تم الإرسال {item.notifiedAt ? `(${item.notifiedAt})` : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[9.5px]">
                              {isPresent ? "-" : "لم يتم"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* OFFICIAL SIGNATURES & STAMP SECTION */}
        {printOptions.showSignatures && (
          <div className="border-t-2 border-slate-800 pt-4 mt-4 print-avoid-break">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              
              {/* 1. Vice Principal */}
              <div className="flex flex-col gap-4 items-center">
                <span className="font-bold text-slate-900 text-[11px]">وكيل شؤون الطلاب</span>
                <div className="flex flex-col items-center min-h-[28px] justify-end">
                  {localSignatories.vicePrincipalName?.trim() ? (
                    <span className="font-extrabold text-slate-950 text-xs">{localSignatories.vicePrincipalName}</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-mono">...................................</span>
                  )}
                </div>
              </div>

              {/* 2. Counselor */}
              <div className="flex flex-col gap-4 items-center">
                <span className="font-bold text-slate-900 text-[11px]">الموجه الطلابي</span>
                <div className="flex flex-col items-center min-h-[28px] justify-end">
                  {localSignatories.counselorName?.trim() ? (
                    <span className="font-extrabold text-slate-950 text-xs">{localSignatories.counselorName}</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-mono">...................................</span>
                  )}
                </div>
              </div>

              {/* 3. Principal */}
              <div className="flex flex-col gap-4 items-center">
                <span className="font-bold text-slate-900 text-[11px]">مدير المدرسة</span>
                <div className="flex flex-col items-center min-h-[28px] justify-end">
                  {localSignatories.principalName?.trim() ? (
                    <span className="font-extrabold text-slate-950 text-xs">{localSignatories.principalName}</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-mono">...................................</span>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* 4. SIGNATORIES & HEADER CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-right space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">إعدادات ترويسة وتواقيع كشف الانضباط</h3>
                  <p className="text-xs text-slate-500">تخصيص البيانات الرسمية المعروضة في أعلى وأسفل الكشوف المطبوعة</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* State & Ministry Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الدولة:</label>
                  <input
                    type="text"
                    value={localSignatories.countryName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, countryName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الوزارة:</label>
                  <input
                    type="text"
                    value={localSignatories.ministryName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, ministryName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الإدارة التعليمية:</label>
                  <input
                    type="text"
                    value={localSignatories.administrationName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, administrationName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم المدرسة:</label>
                  <input
                    type="text"
                    value={localSignatories.schoolName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, schoolName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900"
                  />
                </div>
              </div>

              {/* Logo Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <span className="font-bold text-slate-800 block">شعار المدرسة / الوزارة للترويسة:</span>
                <div className="flex items-center gap-4">
                  {localSignatories.logoUrl ? (
                    <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 bg-white flex items-center justify-center relative">
                      <img src={localSignatories.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      <button
                        onClick={() => setLocalSignatories((prev) => ({ ...prev, logoUrl: "" }))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]"
                        title="حذف الشعار"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 cursor-pointer transition-all"
                    >
                      {localSignatories.logoUrl ? "تغيير الشعار" : "رفع شعار من الجهاز"}
                    </button>
                    <p className="text-[10px] text-slate-400">يدعم PNG و JPG الشفافة حتى 2 ميغابايت.</p>
                  </div>
                </div>
              </div>

              {/* Signatories Names */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم الموجه الطلابي:</label>
                  <input
                    type="text"
                    value={localSignatories.counselorName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, counselorName: e.target.value }))}
                    placeholder="مثال: أ. عبد الله الأحمد"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم وكيل شؤون الطلاب:</label>
                  <input
                    type="text"
                    value={localSignatories.vicePrincipalName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, vicePrincipalName: e.target.value }))}
                    placeholder="مثال: أ. محمد العتيبي"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم مدير المدرسة:</label>
                  <input
                    type="text"
                    value={localSignatories.principalName}
                    onChange={(e) => setLocalSignatories((prev) => ({ ...prev, principalName: e.target.value }))}
                    placeholder="مثال: أ. خالد الغامدي"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSignatories}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>حفظ وتطبيق على الكشوف</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
