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
  User, 
  GraduationCap, 
  Layers, 
  Clock, 
  FileSpreadsheet, 
  Info,
  Trash2,
  Send,
  Sparkles,
  ArrowRight,
  Edit3,
  UserCheck,
  Settings,
  Upload,
  Image as ImageIcon,
  Sliders,
  Check,
  Zap,
  Minimize2,
  Maximize2
} from "lucide-react";
import { Student, ReportItem, ReportFilterState, SchoolSignatories, ReportPrintOptions } from "../types";

interface ReportsPrinterProps {
  students: Student[];
  signatories?: SchoolSignatories;
  template?: string;
  onUpdateSignatory?: (updated: Partial<SchoolSignatories>) => void;
  onNavigateToTab?: (tab: "connection" | "upload" | "send" | "individual" | "reports") => void;
}

export default function ReportsPrinter({ 
  students, 
  signatories, 
  template,
  onUpdateSignatory,
  onNavigateToTab 
}: ReportsPrinterProps) {
  const [logs, setLogs] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local copy of signatories for live editing
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
      setLocalSignatories(prev => ({
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

  // Report Print Options State (Paper saving & layout configuration)
  const [printOptions, setPrintOptions] = useState<ReportPrintOptions>(() => {
    const saved = localStorage.getItem("report_print_options");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      messageDisplayMode: "header_summary", // Default smart paper-saving mode
      tableFontSize: "compact",
      removeBlankLines: true,
      showSignatures: true,
      showStatsBox: true,
    };
  });

  const handleUpdatePrintOptions = (updates: Partial<ReportPrintOptions>) => {
    setPrintOptions(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem("report_print_options", JSON.stringify(next));
      return next;
    });
  };

  // Stabilized report generation timestamp & reference number (fixed per session/refresh)
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
      refNumber: `ABNA-${now.getFullYear()}-${randomCode}`,
    };
  });

  // Filter State
  const [filter, setFilter] = useState<ReportFilterState>({
    dateMode: "all",
    specificDate: new Date().toISOString().split("T")[0],
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    grade: "all",
    className: "all",
    studentSearch: "",
    status: "all",
    sourceType: "all",
  });

  // Fetch report logs from server & combine with client storage
  const fetchReportLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/reports");
      if (res.ok) {
        const data = await res.json();
        let serverLogs: ReportItem[] = data.logs || [];
        
        // Merge with client individual history if any exists
        const localIndHistory = localStorage.getItem("whatsapp_individual_history");
        if (localIndHistory) {
          try {
            const parsed = JSON.parse(localIndHistory);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                if (!serverLogs.some(s => s.id === item.id || (s.phone === item.phone && s.message === item.message))) {
                  serverLogs.push({
                    id: item.id || `local_${Math.random()}`,
                    studentName: "إرسال فردي",
                    phone: item.phone,
                    grade: "",
                    className: "",
                    message: item.message,
                    status: item.status || "success",
                    timestamp: item.timestamp || new Date().toISOString(),
                    type: "individual",
                    error: item.error
                  });
                }
              });
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Enrich student grades/classes if missing and matches current students list
        serverLogs = serverLogs.map(l => {
          if (!l.grade || !l.className) {
            const found = students.find(s => 
              (s.name && l.studentName && s.name.trim() === l.studentName.trim()) ||
              (s.phone && l.phone && s.phone.includes(l.phone.replace(/[^0-9]/g, "").slice(-8)))
            );
            if (found) {
              return {
                ...l,
                grade: l.grade || found.grade || found["الصف"] || found["المستوى"] || "",
                className: l.className || found.className || found["الفصل"] || found["الشعبة"] || "",
              };
            }
          }
          return l;
        });

        setLogs(serverLogs);
        setLastRefreshed(new Date().toLocaleTimeString("ar-SA"));
      }
    } catch (err) {
      console.error("Error fetching report logs", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportLogs();
    const interval = setInterval(fetchReportLogs, 4000);
    return () => clearInterval(interval);
  }, [students]);

  // Extract unique grades and classes
  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const g = s.grade || s["الصف"] || s["المستوى"];
      if (g) set.add(String(g).trim());
    });
    logs.forEach(l => {
      if (l.grade) set.add(String(l.grade).trim());
    });
    return Array.from(set).filter(Boolean);
  }, [students, logs]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const c = s.className || s["الفصل"] || s["الشعبة"];
      if (c) set.add(String(c).trim());
    });
    logs.forEach(l => {
      if (l.className) set.add(String(l.className).trim());
    });
    return Array.from(set).filter(Boolean);
  }, [students, logs]);

  // Filter logs based on criteria
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Date Filtering
      const logDate = new Date(log.timestamp);
      const todayStr = new Date().toISOString().split("T")[0];
      const logDateStr = !isNaN(logDate.getTime()) ? logDate.toISOString().split("T")[0] : "";

      if (filter.dateMode === "today") {
        if (logDateStr !== todayStr) return false;
      } else if (filter.dateMode === "yesterday") {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        if (logDateStr !== yesterday) return false;
      } else if (filter.dateMode === "last7days") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (logDate < sevenDaysAgo) return false;
      } else if (filter.dateMode === "last30days") {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (logDate < thirtyDaysAgo) return false;
      } else if (filter.dateMode === "specific_date") {
        if (logDateStr !== filter.specificDate) return false;
      } else if (filter.dateMode === "range") {
        if (filter.startDate && logDateStr < filter.startDate) return false;
        if (filter.endDate && logDateStr > filter.endDate) return false;
      }

      // 2. Grade Filtering
      if (filter.grade !== "all") {
        const g = log.grade || "";
        if (g.trim() !== filter.grade.trim()) return false;
      }

      // 3. Class Filtering
      if (filter.className !== "all") {
        const c = log.className || "";
        if (c.trim() !== filter.className.trim()) return false;
      }

      // 4. Status Filtering
      if (filter.status !== "all") {
        if (filter.status === "success" && log.status !== "success") return false;
        if (filter.status === "failed" && log.status !== "failed") return false;
      }

      // 5. Source Type Filtering
      if (filter.sourceType !== "all") {
        if (log.type !== filter.sourceType) return false;
      }

      // 6. Student Search (Name, Phone, or Message query)
      if (filter.studentSearch.trim()) {
        const query = filter.studentSearch.trim().toLowerCase();
        const sName = (log.studentName || "").toLowerCase();
        const sPhone = (log.phone || "").toLowerCase();
        const sMsg = (log.message || "").toLowerCase();
        if (!sName.includes(query) && !sPhone.includes(query) && !sMsg.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, filter]);

  // Derive common message template to display elegantly in the report header
  const commonReportMessage = useMemo(() => {
    if (filteredLogs.length === 0) return template || "";
    // Find representative campaign message or template
    const sample = filteredLogs[0]?.message || template || "";
    return sample;
  }, [filteredLogs, template]);

  // Helper to format text compactly without endless redundant empty lines
  const cleanCompactText = (text: string) => {
    if (!text) return "";
    if (printOptions.removeBlankLines) {
      return text.replace(/\n\s*\n+/g, "\n").trim();
    }
    return text.trim();
  };

  // Statistics KPIs
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const success = filteredLogs.filter(l => l.status === "success").length;
    const failed = filteredLogs.filter(l => l.status === "failed").length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
    
    // Unique students reached
    const uniqueStudents = new Set(filteredLogs.map(l => l.studentName || l.phone)).size;

    return { total, success, failed, successRate, uniqueStudents };
  }, [filteredLogs]);

  // Handle Native Print / PDF Save (A4 standard)
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel / CSV (Full complete data preserved)
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ["م", "اسم الطالب", "الصف", "الفصل", "رقم الجوال", "تاريخ ووقت الإرسال", "نوع العملية", "حالة الإرسال", "نص الرسالة"];
    const rows = filteredLogs.map((log, index) => [
      index + 1,
      `"${(log.studentName || "").replace(/"/g, '""')}"`,
      `"${(log.grade || "").replace(/"/g, '""')}"`,
      `"${(log.className || "").replace(/"/g, '""')}"`,
      `"${log.phone || ""}"`,
      `"${new Date(log.timestamp).toLocaleString("ar-SA")}"`,
      `"${log.type === "campaign" ? (log.campaignName || "حملة جماعية") : "إرسال فردي"}"`,
      `"${log.status === "success" ? "تم الإرسال بنجاح" : "تعثر الإرسال"}"`,
      `"${(log.message || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_إرسال_ثانوية_الأبناء_الأولى_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear Report Logs
  const handleClearLogs = async () => {
    if (window.confirm("هل أنت متأكد من رغبتك في مسح كافة سجلات وتقارير الإرسال؟")) {
      try {
        await fetch("/api/whatsapp/reports/clear", { method: "DELETE" });
        localStorage.removeItem("whatsapp_individual_history");
        setLogs([]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Perform Quick Cache & Stale Files Cleanup
  const handlePerformCleanup = async () => {
    try {
      const res = await fetch("/api/app-state/cleanup", { method: "POST" });
      const data = await res.json();
      setCleanupMessage(data.message || "تم تنظيف الذاكرة المؤقتة بنجاح");
      setTimeout(() => setCleanupMessage(null), 4000);
      fetchReportLogs();
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Logo Upload from local files
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("حجم ملف الشعار كبير، يرجى اختيار صورة أقل من 3 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        const updated = { ...localSignatories, logoUrl: base64 };
        setLocalSignatories(updated);
        saveSignatoriesToServer(updated);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveSignatoriesToServer = async (updatedData: SchoolSignatories) => {
    if (onUpdateSignatory) {
      onUpdateSignatory(updatedData);
    }
    localStorage.setItem("school_signatories", JSON.stringify(updatedData));
    try {
      await fetch("/api/app-state/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (err) {
      console.error("Error saving signatories to server", err);
    }
  };

  // Format descriptive date range for document header
  const getFilterDateDescription = () => {
    if (filter.dateMode === "all") return "كافة الفترات المسجلة";
    if (filter.dateMode === "today") return `اليوم (${new Date().toLocaleDateString("ar-SA")})`;
    if (filter.dateMode === "yesterday") return "يوم أمس";
    if (filter.dateMode === "last7days") return "خلال آخر 7 أيام";
    if (filter.dateMode === "last30days") return "خلال آخر 30 يوماً";
    if (filter.dateMode === "specific_date") return `يوم محدد: ${filter.specificDate}`;
    if (filter.dateMode === "range") return `من تاريخ: ${filter.startDate} إلى تاريخ: ${filter.endDate}`;
    return "فترة مخصصة";
  };

  // Compute table density classes based on font size setting
  const getTableDensityClass = () => {
    if (printOptions.tableFontSize === "ultra_compact") {
      return "text-[9px] print:text-[8.5pt]";
    }
    if (printOptions.tableFontSize === "compact") {
      return "text-[10px] print:text-[9pt]";
    }
    return "text-[11px] print:text-[10pt]";
  };

  const getRowPaddingClass = () => {
    if (printOptions.tableFontSize === "ultra_compact") {
      return "py-1 px-1.5";
    }
    if (printOptions.tableFontSize === "compact") {
      return "py-1.5 px-2";
    }
    return "py-2 px-2.5";
  };

  return (
    <div className="flex flex-col gap-6 text-right font-sans" id="reports-printer-root">
      
      {/* Dynamic Print CSS Injection for standard A4 formatting */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 1.2cm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #main-header, #main-footer, #wizard-navigation-tabs, #report-filter-controls, #report-quick-kpis, #report-print-options-bar, .no-print {
            display: none !important;
          }
          #app-root, main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            background: #ffffff !important;
          }
          #printable-a4-document {
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-compact-row {
            line-height: 1.25 !important;
          }
        }
      `}</style>

      {/* TOP CONTROLS & QUERY FILTER BAR (Hidden during printing) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6 no-print" id="report-filter-controls">
        
        {/* Header and Quick Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-emerald-600" />
              التقارير والطباعة الرسمية
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              استعلام واستعراض تقارير توثيق الإرسال بتصميم اقتصادي موفر للأوراق وجاهز للطباعة والاعتماد
            </p>
          </div>

          {/* Print, Settings, Export & Refresh Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Direct Print Button */}
            <button
              onClick={handlePrint}
              disabled={filteredLogs.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              id="btn-print-report"
              title="طباعة التقرير أو حفظه بصيغة PDF"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير / حفظ PDF
            </button>

            {/* School & Signatories Config Trigger */}
            <button
              onClick={() => setShowConfigModal(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              id="btn-edit-school-signatories"
              title="تعديل اسم المدرسة، الإدارة، الشعار وأسماء المعتمدين"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>بيانات المدرسة والشعار</span>
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              id="btn-export-csv"
              title="تصدير السجلات إلى جدول إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>

            {/* Fast Cleanup cache & temp files */}
            <button
              onClick={handlePerformCleanup}
              className="bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-xs py-2.5 px-2.5 rounded-xl transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
              title="تنظيف الذاكرة المؤقتة وتسريع النظام"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>تسريع وتنظيف</span>
            </button>

            <button
              onClick={fetchReportLogs}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-2.5 rounded-xl transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
              id="btn-refresh-report"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2.5 px-2.5 rounded-xl transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
                title="مسح سجل الإرسال"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {cleanupMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{cleanupMessage}</span>
          </div>
        )}

        {/* SMART PRINTING & PAPER SAVING CONTROLS (Top Toolbar) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 text-xs" id="report-print-options-bar">
          
          {/* Mode Selector for Message Length */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              طريقة عرض نص الرسالة بالتقرير:
            </span>
            
            <div className="inline-flex bg-white border border-slate-200 p-1 rounded-xl shadow-xs">
              
              <button
                type="button"
                onClick={() => handleUpdatePrintOptions({ messageDisplayMode: "header_summary" })}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  printOptions.messageDisplayMode === "header_summary"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="توفير هائل في الورق: وضع صيغة الرسالة المعتمدة في أعلى التقرير وجدول مدمج"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>النموذج الاقتصادي المعتمد (توفير 85% من الورق) ⭐</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdatePrintOptions({ messageDisplayMode: "table_column" })}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  printOptions.messageDisplayMode === "table_column"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="عرض نص الرسالة داخل كل صف في الجدول مع دمج الأسطر الفارغة"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>النموذج التفصيلي الكامل</span>
              </button>

              <button
                type="button"
                onClick={() => handleUpdatePrintOptions({ messageDisplayMode: "both" })}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer hidden lg:flex items-center gap-1.5 ${
                  printOptions.messageDisplayMode === "both"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="عرض الصيغة في الأعلى وداخل الجدول معاً"
              >
                <span>كلاهما</span>
              </button>

            </div>
          </div>

          {/* Table Density & Font Size */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">حجم الخط والمسافات:</span>
            <select
              value={printOptions.tableFontSize}
              onChange={(e) => handleUpdatePrintOptions({ tableFontSize: e.target.value as any })}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="normal">عادي (Standard)</option>
              <option value="compact">مدمج اقتصادي (Compact) ✓</option>
              <option value="ultra_compact">فائق التوفير (Ultra Compact)</option>
            </select>
          </div>

        </div>

        {/* QUERY FILTERS SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Date Mode Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              المدى الزمني للاستعلام:
            </label>
            <select
              value={filter.dateMode}
              onChange={(e) => setFilter(prev => ({ ...prev, dateMode: e.target.value as any }))}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              id="select-date-mode"
            >
              <option value="all">كافة الفترات والتواريخ</option>
              <option value="today">اليوم الحالي</option>
              <option value="yesterday">يوم أمس</option>
              <option value="last7days">آخر 7 أيام</option>
              <option value="last30days">آخر 30 يوماً</option>
              <option value="specific_date">استعلام بيوم محدد 📅</option>
              <option value="range">مدى زمني مخصص (من - إلى) 🗓️</option>
            </select>
          </div>

          {/* Conditional Specific Date Picker */}
          {filter.dateMode === "specific_date" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">اليوم المحدد:</label>
              <input
                type="date"
                value={filter.specificDate}
                onChange={(e) => setFilter(prev => ({ ...prev, specificDate: e.target.value }))}
                className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-center font-bold"
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
                  onChange={(e) => setFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-center font-bold"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">إلى تاريخ:</label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-center font-bold"
                />
              </div>
            </>
          )}

          {/* 2. Grade Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              تحديد الصف الدراسي:
            </label>
            <select
              value={filter.grade}
              onChange={(e) => setFilter(prev => ({ ...prev, grade: e.target.value }))}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              id="select-grade"
            >
              <option value="all">كافة الصفوف الدراسية ({uniqueGrades.length})</option>
              {uniqueGrades.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 3. Class / Section Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              تحديد الشعبة / الفصل:
            </label>
            <select
              value={filter.className}
              onChange={(e) => setFilter(prev => ({ ...prev, className: e.target.value }))}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              id="select-class"
            >
              <option value="all">كافة الفصول / الشعب ({uniqueClasses.length})</option>
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Delivery Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              حالة التسليم والإرسال:
            </label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value as any }))}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
              id="select-status"
            >
              <option value="all">كافة الحالات (ناجح ومتعثر)</option>
              <option value="success">تم الإرسال بنجاح فقط (✓)</option>
              <option value="failed">تعثر الإرسال فقط (✕)</option>
            </select>
          </div>

          {/* 5. Source Type Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Send className="w-3.5 h-3.5 text-slate-500 rotate-180" />
              مصدر الإرسال:
            </label>
            <select
              value={filter.sourceType}
              onChange={(e) => setFilter(prev => ({ ...prev, sourceType: e.target.value as any }))}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            >
              <option value="all">الكل (جماعي وفردي)</option>
              <option value="campaign">حملات الإرسال الجماعي</option>
              <option value="individual">إرسال فردي سريع</option>
            </select>
          </div>

          {/* 6. Free Search (Student Name, Phone, or Message Content) */}
          <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              بحث على مستوى اسم الطالب أو رقم الجوال:
            </label>
            <div className="relative">
              <input
                type="text"
                value={filter.studentSearch}
                onChange={(e) => setFilter(prev => ({ ...prev, studentSearch: e.target.value }))}
                placeholder="ابحث باسم الطالب، رقم الجوال، أو كلمات من نص الرسالة..."
                className="w-full border border-slate-200 bg-white rounded-xl pr-3 pl-8 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                id="input-student-search"
              />
              {filter.studentSearch && (
                <button
                  onClick={() => setFilter(prev => ({ ...prev, studentSearch: "" }))}
                  className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Quick summary strip */}
        <div className="flex flex-wrap items-center justify-between bg-slate-50 border border-slate-150 p-3 rounded-xl text-xs gap-3">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-bold text-slate-700">النطاق الحالي:</span>
            <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-800">
              {getFilterDateDescription()}
            </span>
            {filter.grade !== "all" && (
              <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-semibold">
                الصف: {filter.grade}
              </span>
            )}
            {filter.className !== "all" && (
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-semibold">
                الفصل: {filter.className}
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            {lastRefreshed && `آخر تحديث: ${lastRefreshed}`}
          </div>
        </div>

      </div>

      {/* QUICK KPI METRICS STRIP (Hidden during printing) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print" id="report-quick-kpis">
        
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-slate-500">إجمالي الرسائل بالتقرير</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800">{stats.total}</span>
            <span className="text-xs text-slate-400">سجل</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-emerald-700">المرسل بنجاح (✓)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.success}</span>
            <span className="text-xs font-bold text-emerald-700">({stats.successRate}%)</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-rose-700">المتعثر في الإرسال (✕)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">{stats.failed}</span>
            <span className="text-xs text-slate-400">رسالة</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
          <span className="text-[11px] font-bold text-blue-700">الطلاب المستهدفون</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{stats.uniqueStudents}</span>
            <span className="text-xs text-slate-400">طالب</span>
          </div>
        </div>

      </div>

      {/* A4 PRINTABLE DOCUMENT CONTAINER (Strict standard A4 with exact 1.2cm margins) */}
      <div 
        id="printable-a4-document"
        className="w-full max-w-[210mm] mx-auto bg-white border border-slate-300 shadow-xl rounded-2xl print:rounded-none print:shadow-none print:border-none p-8 print:p-0 flex flex-col gap-5 text-slate-900 transition-all"
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

            {/* Center: Customizable Logo & Official Title (No printer square!) */}
            <div className="flex flex-col items-center justify-center text-center shrink-0 px-2">
              
              {/* Custom or Official School/Ministry Logo */}
              {localSignatories.logoUrl ? (
                <div className="mb-1 flex items-center justify-center">
                  <img
                    src={localSignatories.logoUrl}
                    alt="شعار المدرسة"
                    referrerPolicy="no-referrer"
                    style={{
                      width: `${localSignatories.logoWidth || 60}px`,
                      height: `${localSignatories.logoHeight || 60}px`,
                      objectFit: "contain"
                    }}
                    className="rounded-md"
                  />
                </div>
              ) : (
                /* Elegant vector minimalist emblem if no custom logo uploaded */
                <div className="mb-1 flex items-center justify-center text-emerald-800">
                  <div className="w-10 h-10 rounded-xl border border-emerald-700 flex items-center justify-center bg-emerald-50/50">
                    <GraduationCap className="w-5 h-5 text-emerald-800" />
                  </div>
                </div>
              )}

              <h1 className="text-sm sm:text-base font-black text-slate-950 tracking-tight leading-snug">
                تقرير توثيق إرسال الرسائل والإشعارات
              </h1>
              <span className="text-[10px] font-semibold text-slate-600">
                (نظام إرسال أولياء الأمور والطلاب الذكي عبر واتساب)
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

        {/* OFFICIAL APPROVED MESSAGE TEMPLATE BOX (Smart Header Summary for Paper Saving) */}
        {(printOptions.messageDisplayMode === "header_summary" || printOptions.messageDisplayMode === "both") && commonReportMessage && (
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 flex flex-col gap-1.5 text-xs print-avoid-break">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="font-extrabold text-[11px] text-emerald-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                صيغة الرسالة / الإشعار المرسل المعتمد:
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                (تم الإرسال لجميع الطلاب المستهدفين مع تعويض المتغيرات الفردية)
              </span>
            </div>
            <div className="text-slate-800 text-[10.5px] leading-relaxed whitespace-pre-line bg-white/90 p-2 rounded-lg border border-slate-200 font-medium">
              {cleanCompactText(commonReportMessage)}
            </div>
          </div>
        )}

        {/* REPORT SPECIFICATION & STATISTICAL SUMMARY BOX */}
        {printOptions.showStatsBox && (
          <div className="bg-slate-50/80 border border-slate-300 rounded-xl p-2.5 flex flex-col gap-1.5 text-[11px] print-avoid-break">
            
            {/* Metadata Row */}
            <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-1.5">
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
                <span className="text-slate-500 font-medium block text-[9px]">حالة السجلات:</span>
                <span className="font-bold text-slate-900 text-[10px]">
                  {filter.status === "all" ? "الكل" : filter.status === "success" ? "الناجحة فقط" : "المتعثرة فقط"}
                </span>
              </div>
            </div>

            {/* KPI Summary Row */}
            <div className="flex items-center justify-between text-[10px] pt-0.5">
              <div className="flex items-center gap-3">
                <span><strong>إجمالي العمليات:</strong> {stats.total}</span>
                <span className="text-emerald-800"><strong>الناجحة:</strong> {stats.success} ({stats.successRate}%)</span>
                {stats.failed > 0 && (
                  <span className="text-rose-800"><strong>المتعثرة:</strong> {stats.failed}</span>
                )}
              </div>
              <div className="font-semibold text-slate-700">
                الطلاب المشمولين بالتقرير: <strong>{stats.uniqueStudents} طالب</strong>
              </div>
            </div>

          </div>
        )}

        {/* DETAILED DATA TABLE */}
        <div className="flex-1 flex flex-col">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400 gap-3 border border-dashed border-slate-200 rounded-xl my-4">
              <FileText className="w-10 h-10 text-slate-300" />
              <div className="font-bold text-sm text-slate-600">لا توجد سجلات إرسال تطابق محددات الاستعلام</div>
              <p className="text-xs text-slate-400 max-w-md">
                قم بإطلاق حملة إرسال جماعي جديدة أو إرسال رسائل فردية ليتم توثيقها وعرضها هنا فوراً.
              </p>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("send")}
                  className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all flex items-center gap-1.5 no-print cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 rotate-180" />
                  الانتقال إلى حملة الإرسال الجماعي
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-right border-collapse border border-slate-300 ${getTableDensityClass()}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                    <th className={`${getRowPaddingClass()} w-8 text-center border-l border-slate-300`}>م</th>
                    <th className={`${getRowPaddingClass()} border-l border-slate-300 ${printOptions.messageDisplayMode === "header_summary" ? "w-44" : "w-36"}`}>اسم الطالب</th>
                    <th className={`${getRowPaddingClass()} w-24 border-l border-slate-300 text-center`}>الصف / الفصل</th>
                    <th className={`${getRowPaddingClass()} w-28 border-l border-slate-300 text-center font-mono`}>رقم الجوال</th>
                    <th className={`${getRowPaddingClass()} w-28 border-l border-slate-300 text-center`}>تاريخ ووقت الإرسال</th>
                    
                    {/* Render message column only if full mode is chosen */}
                    {(printOptions.messageDisplayMode === "table_column" || printOptions.messageDisplayMode === "both") ? (
                      <th className={`${getRowPaddingClass()} border-l border-slate-300`}>نص الرسالة / الإشعار</th>
                    ) : (
                      <th className={`${getRowPaddingClass()} border-l border-slate-300 text-center w-36`}>الإشعار المعتمد</th>
                    )}

                    <th className={`${getRowPaddingClass()} w-20 text-center`}>حالة الإرسال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.map((log, index) => {
                    const isSuccess = log.status === "success";
                    const formattedDate = new Date(log.timestamp).toLocaleDateString("ar-SA");
                    const formattedTime = new Date(log.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <tr key={log.id || index} className="hover:bg-slate-50/80 transition-colors print-avoid-break print-compact-row">
                        <td className={`${getRowPaddingClass()} text-center font-bold text-slate-600 border-l border-slate-200`}>
                          {index + 1}
                        </td>
                        <td className={`${getRowPaddingClass()} font-bold text-slate-900 border-l border-slate-200`}>
                          {log.studentName || "طالب"}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center text-slate-700 border-l border-slate-200`}>
                          {(log.grade || log.className) ? (
                            <span>{log.grade} {log.className ? `/ ${log.className}` : ""}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center font-mono text-slate-700 text-[10px] border-l border-slate-200`} dir="ltr">
                          {log.phone || "-"}
                        </td>
                        <td className={`${getRowPaddingClass()} text-center text-slate-600 text-[10px] border-l border-slate-200`}>
                          <span>{formattedDate} {formattedTime}</span>
                        </td>
                        
                        {/* Table Message Column vs Smart Compact Badge */}
                        {(printOptions.messageDisplayMode === "table_column" || printOptions.messageDisplayMode === "both") ? (
                          <td className={`${getRowPaddingClass()} text-slate-700 border-l border-slate-200 break-words font-medium leading-snug`}>
                            <div className="whitespace-pre-line">
                              {cleanCompactText(log.message)}
                            </div>
                            {log.error && (
                              <div className="text-[9px] text-rose-600 font-bold mt-0.5">
                                (سبب التعثر: {log.error})
                              </div>
                            )}
                          </td>
                        ) : (
                          <td className={`${getRowPaddingClass()} text-center text-slate-600 border-l border-slate-200 text-[10px]`}>
                            <span className="text-slate-600 font-medium">تم تطبيق الصيغة المعتمدة</span>
                            {log.error && (
                              <div className="text-[9px] text-rose-600 font-bold">
                                {log.error}
                              </div>
                            )}
                          </td>
                        )}

                        <td className={`${getRowPaddingClass()} text-center`}>
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-[9.5px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 print:border-none">
                              ✓ ناجح
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-800 text-[9.5px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 print:border-none">
                              ✕ متعثر
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

        {/* OFFICIAL SIGNATURES & STAMP SECTION (Prints on bottom of document) */}
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
                <span className="font-bold text-slate-900 text-[11px]">
                  مدير {localSignatories.schoolName || "ثانوية الأبناء الأولى"}
                </span>
                <div className="flex flex-col items-center min-h-[28px] justify-end">
                  {localSignatories.principalName?.trim() ? (
                    <span className="font-extrabold text-slate-950 text-xs">{localSignatories.principalName}</span>
                  ) : (
                    <span className="text-slate-400 text-[10px] font-mono">...................................</span>
                  )}
                  <span className="text-[8.5px] text-slate-400 border border-slate-300 px-2 py-0.2 rounded mt-1">
                    (الختم الرسمي للمدرسة)
                  </span>
                </div>
              </div>

            </div>

            {/* Document Footer Strip */}
            <div className="flex items-center justify-between text-[9.5px] text-slate-500 border-t border-slate-200 pt-2.5 mt-4">
              <span>نظام إرسال الإشعارات والرسائل الذكي - {localSignatories.schoolName || "ثانوية الأبناء الأولى"} 2026 - 2027</span>
              <span>صفحة موثقة رسمياً</span>
            </div>

          </div>
        )}

      </div>

      {/* ================= MODAL: SCHOOL SETTINGS, LOGO & SIGNATORIES CONFIGURATION ================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 flex flex-col gap-6 animate-fadeIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">تخصيص بيانات المدرسة، الشعار والمعتمدين</h3>
                  <p className="text-xs text-slate-400">تنعكس هذه البيانات تلقائياً على ترويسة وتذييل كل التقارير المطبوعة</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Two Column Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Country Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم الدولة (السطر الأول):</label>
                <input
                  type="text"
                  value={localSignatories.countryName || ""}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, countryName: e.target.value }))}
                  placeholder="المملكة العربية السعودية"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold"
                />
              </div>

              {/* Ministry Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم الوزارة (السطر الثاني):</label>
                <input
                  type="text"
                  value={localSignatories.ministryName || ""}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, ministryName: e.target.value }))}
                  placeholder="وزارة التعليم"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* Administration Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم الإدارة العامة للتعليم (السطر الثالث):</label>
                <input
                  type="text"
                  value={localSignatories.administrationName || ""}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, administrationName: e.target.value }))}
                  placeholder="الإدارة العامة للتعليم بمنطقة..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* School Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم المدرسة (السطر الرابع):</label>
                <input
                  type="text"
                  value={localSignatories.schoolName || ""}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, schoolName: e.target.value }))}
                  placeholder="ثانوية الأبناء الأولى"
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-bold text-emerald-900"
                />
              </div>

              {/* Principal Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم مدير المدرسة:</label>
                <input
                  type="text"
                  value={localSignatories.principalName}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, principalName: e.target.value }))}
                  placeholder="أدخل اسم مدير المدرسة..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* Vice Principal Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم وكيل شؤون الطلاب:</label>
                <input
                  type="text"
                  value={localSignatories.vicePrincipalName}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, vicePrincipalName: e.target.value }))}
                  placeholder="أدخل اسم وكيل الطلاب..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* Counselor Name */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">اسم الموجه الطلابي:</label>
                <input
                  type="text"
                  value={localSignatories.counselorName}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, counselorName: e.target.value }))}
                  placeholder="أدخل اسم الموجه الطلابي..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* System Manager / Sender */}
              <div className="flex flex-col gap-1">
                <label className="font-bold text-slate-700">مسؤول النظام / التوثيق:</label>
                <input
                  type="text"
                  value={localSignatories.systemManagerName}
                  onChange={(e) => setLocalSignatories(p => ({ ...p, systemManagerName: e.target.value }))}
                  placeholder="اسم مسؤول النظام (اختياري)..."
                  className="border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none font-medium"
                />
              </div>

              {/* LOGO UPLOAD & RESIZE SECTION */}
              <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
                <span className="font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  شعار المدرسة أو الوزارة بالترويسة:
                </span>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  
                  {/* Logo Preview */}
                  <div className="w-20 h-20 rounded-xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {localSignatories.logoUrl ? (
                      <img 
                        src={localSignatories.logoUrl} 
                        alt="Logo preview" 
                        className="object-contain" 
                        style={{ width: `${localSignatories.logoWidth || 60}px`, height: `${localSignatories.logoHeight || 60}px` }}
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 text-center px-1">بدون شعار مخصص</span>
                    )}
                  </div>

                  {/* Actions & Sliders */}
                  <div className="flex-1 flex flex-col gap-2.5 w-full">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع صورة شعار من جهازك</span>
                      </button>

                      {localSignatories.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLocalSignatories(p => ({ ...p, logoUrl: "" }))}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 px-3 rounded-xl border border-rose-200 cursor-pointer"
                        >
                          إزالة الشعار
                        </button>
                      )}
                    </div>

                    {/* Logo Width & Height Slider */}
                    {localSignatories.logoUrl && (
                      <div className="flex items-center gap-4 text-[11px] pt-1">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-slate-600 font-medium">مقاس الشعار بالتقرير:</span>
                          <input
                            type="range"
                            min="40"
                            max="140"
                            value={localSignatories.logoWidth || 60}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setLocalSignatories(p => ({ ...p, logoWidth: val, logoHeight: val }));
                            }}
                            className="flex-1 accent-emerald-600"
                          />
                          <span className="font-mono font-bold text-slate-800">{localSignatories.logoWidth || 60}px</span>
                        </div>
                      </div>
                    )}

                  </div>

                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-400">يتم الحفظ في الخادم السحابي والمتصفح</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveSignatoriesToServer(localSignatories);
                    setShowConfigModal(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  حفظ وتطبيق
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
