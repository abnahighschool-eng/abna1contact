import React, { useState, useEffect, useMemo } from "react";
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
  UserCheck
} from "lucide-react";
import { Student, ReportItem, ReportFilterState, SchoolSignatories } from "../types";

interface ReportsPrinterProps {
  students: Student[];
  signatories?: SchoolSignatories;
  onNavigateToTab?: (tab: "connection" | "upload" | "send" | "individual" | "reports") => void;
}

export default function ReportsPrinter({ students, signatories, onNavigateToTab }: ReportsPrinterProps) {
  const [logs, setLogs] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

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

  // Handle Native Print / PDF Save (A4 with 1.5cm margin)
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel / CSV
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

  return (
    <div className="flex flex-col gap-8 text-right font-sans" id="reports-printer-root">
      
      {/* Dynamic Print CSS Injection */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #main-header, #main-footer, #wizard-navigation-tabs, #report-filter-controls, #report-quick-kpis, .no-print {
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
        }
      `}</style>

      {/* TOP CONTROLS & QUERY FILTER BAR (Hidden during printing) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6 no-print" id="report-filter-controls">
        
        {/* Header and Quick Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
              <Printer className="w-5 h-5 text-emerald-600" />
              التقارير والطباعة (PDF مقاس A4 بهوامش 1.5 سم)
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              استعلام واستعراض تقارير دقيقة لمن تم الإرسال لهم، مجهزة للطباعة والتصدير بصيغة A4 وهوامش معتمدة
            </p>
          </div>

          {/* Print, Export & Refresh Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePrint}
              disabled={filteredLogs.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              id="btn-print-report"
              title="طباعة التقرير أو حفظه بصيغة PDF مقاس A4"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير / حفظ PDF (A4)
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-2.5 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              id="btn-export-csv"
              title="تصدير السجلات إلى جدول إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              تصدير Excel
            </button>

            <button
              onClick={fetchReportLogs}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              id="btn-refresh-report"
              title="تحديث البيانات من الخادم"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
              تحديث
            </button>

            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2.5 px-3 rounded-xl transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
                title="مسح سجل الإرسال"
              >
                <Trash2 className="w-3.5 h-3.5" />
                مسح
              </button>
            )}
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
            <span className="font-bold text-slate-700">النطاق الحالي المستعلم عنه:</span>
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

      {/* A4 PRINTABLE DOCUMENT CONTAINER (Strict standard A4 with exact 1.5cm margins) */}
      <div 
        id="printable-a4-document"
        className="w-full max-w-[210mm] mx-auto bg-white border border-slate-300 shadow-xl rounded-2xl print:rounded-none print:shadow-none print:border-none p-[1.5cm] flex flex-col gap-6 text-slate-900 transition-all"
        style={{ minHeight: "297mm" }}
      >
        
        {/* OFFICIAL INSTITUTIONAL HEADER */}
        <div className="border-b-2 border-slate-900 pb-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            
            {/* Right: State & Ministry Details */}
            <div className="text-right flex flex-col text-xs leading-relaxed text-slate-800">
              <span className="font-bold text-sm text-slate-950">المملكة العربية السعودية</span>
              <span className="font-medium text-slate-700">وزارة التعليم</span>
              <span className="font-medium text-slate-700">الإدارة العامة للتعليم</span>
              <span className="font-extrabold text-sm text-emerald-800 mt-0.5">ثانوية الأبناء الأولى</span>
            </div>

            {/* Center: Emblem & Document Title */}
            <div className="flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm mb-1.5 print:bg-slate-900">
                <Printer className="w-6 h-6" />
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                تقرير توثيق إرسال الرسائل والإشعارات
              </h1>
              <span className="text-[11px] font-semibold text-slate-600 mt-0.5">
                (نظام إرسال أولياء الأمور والطلاب الذكي عبر واتساب)
              </span>
            </div>

            {/* Left: Metadata & Timestamps */}
            <div className="text-left flex flex-col text-xs leading-relaxed text-slate-800 font-mono">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-sans font-bold text-slate-900">تاريخ التقرير:</span>
                <span className="font-bold">{reportMeta.dateStr}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-sans font-medium text-slate-600">وقت الإصدار:</span>
                <span>{reportMeta.timeStr}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="font-sans font-medium text-slate-600">الرقم المرجعي:</span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-800 border border-slate-200">
                  {reportMeta.refNumber}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* REPORT SPECIFICATION & STATISTICAL SUMMARY BOX */}
        <div className="bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 flex flex-col gap-2.5 text-xs">
          
          {/* Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 pb-2">
            <div>
              <span className="text-slate-500 font-medium block text-[10px]">نطاق الاستعلام الزمني:</span>
              <span className="font-bold text-slate-900">{getFilterDateDescription()}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[10px]">الصف الدراسي المحدد:</span>
              <span className="font-bold text-slate-900">{filter.grade === "all" ? "كافة الصفوف" : filter.grade}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[10px]">الشعبة / الفصل:</span>
              <span className="font-bold text-slate-900">{filter.className === "all" ? "كافة الفصول" : filter.className}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block text-[10px]">حالة السجلات:</span>
              <span className="font-bold text-slate-900">
                {filter.status === "all" ? "الكل" : filter.status === "success" ? "الناجحة فقط" : "المتعثرة فقط"}
              </span>
            </div>
          </div>

          {/* KPI Summary Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <div className="flex items-center gap-4">
              <span><strong>إجمالي العمليات:</strong> {stats.total}</span>
              <span className="text-emerald-800"><strong>الناجحة:</strong> {stats.success} ({stats.successRate}%)</span>
              {stats.failed > 0 && (
                <span className="text-rose-800"><strong>المتعثرة:</strong> {stats.failed}</span>
              )}
            </div>
            <div className="font-semibold text-slate-700">
              عدد الطلاب المشمولين: <strong>{stats.uniqueStudents} طالب</strong>
            </div>
          </div>

        </div>

        {/* DETAILED DATA TABLE */}
        <div className="flex-1 flex flex-col">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 text-slate-400 gap-3 border border-dashed border-slate-200 rounded-xl my-4">
              <FileText className="w-12 h-12 text-slate-300" />
              <div className="font-bold text-sm text-slate-600">لا توجد سجلات إرسال تطابق محددات الاستعلام</div>
              <p className="text-xs text-slate-400 max-w-md">
                قم بإطلاق حملة إرسال جماعي جديدة من قسم "حملة الإرسال الجماعي" أو إرسال رسائل فردية ليتم توثيقها وعرضها هنا فوراً.
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
              <table className="w-full text-right border-collapse text-[11px] border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-300">
                    <th className="p-2 w-8 text-center border-l border-slate-300">م</th>
                    <th className="p-2 w-36 border-l border-slate-300">اسم الطالب</th>
                    <th className="p-2 w-24 border-l border-slate-300 text-center">الصف / الفصل</th>
                    <th className="p-2 w-28 border-l border-slate-300 text-center font-mono">رقم الجوال</th>
                    <th className="p-2 w-28 border-l border-slate-300 text-center">تاريخ ووقت الإرسال</th>
                    <th className="p-2 border-l border-slate-300">نص الرسالة / الإشعار</th>
                    <th className="p-2 w-20 text-center">حالة الإرسال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.map((log, index) => {
                    const isSuccess = log.status === "success";
                    const formattedDate = new Date(log.timestamp).toLocaleDateString("ar-SA");
                    const formattedTime = new Date(log.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <tr key={log.id || index} className="hover:bg-slate-50/80 transition-colors print-avoid-break">
                        <td className="p-2 text-center font-bold text-slate-600 border-l border-slate-200">
                          {index + 1}
                        </td>
                        <td className="p-2 font-bold text-slate-900 border-l border-slate-200">
                          {log.studentName || "طالب"}
                        </td>
                        <td className="p-2 text-center text-slate-700 border-l border-slate-200">
                          {(log.grade || log.className) ? (
                            <span>{log.grade} {log.className ? `/ ${log.className}` : ""}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-700 text-[10px] border-l border-slate-200" dir="ltr">
                          {log.phone || "-"}
                        </td>
                        <td className="p-2 text-center text-slate-600 text-[10px] border-l border-slate-200">
                          <div>{formattedDate}</div>
                          <div className="text-slate-400 font-mono">{formattedTime}</div>
                        </td>
                        <td className="p-2 text-slate-700 leading-relaxed border-l border-slate-200 break-words font-medium">
                          {log.message}
                          {log.error && (
                            <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                              (سبب التعثر: {log.error})
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-none">
                              ✓ ناجح
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-800 text-[10px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200 print:border-none">
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
        <div className="border-t-2 border-slate-800 pt-6 mt-6 print-avoid-break">
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            
            <div className="flex flex-col gap-6 items-center">
              <span className="font-bold text-slate-900">وكيل شؤون الطلاب</span>
              <div className="flex flex-col items-center min-h-[32px] justify-end">
                {signatories?.vicePrincipalName?.trim() ? (
                  <span className="font-extrabold text-slate-950 text-xs">{signatories.vicePrincipalName}</span>
                ) : (
                  <span className="text-slate-400 text-[11px] font-mono">...................................</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6 items-center">
              <span className="font-bold text-slate-900">الموجه الطلابي</span>
              <div className="flex flex-col items-center min-h-[32px] justify-end">
                {signatories?.counselorName?.trim() ? (
                  <span className="font-extrabold text-slate-950 text-xs">{signatories.counselorName}</span>
                ) : (
                  <span className="text-slate-400 text-[11px] font-mono">...................................</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6 items-center">
              <span className="font-bold text-slate-900">مدير ثانوية الأبناء الأولى</span>
              <div className="flex flex-col items-center min-h-[32px] justify-end">
                {signatories?.principalName?.trim() ? (
                  <span className="font-extrabold text-slate-950 text-xs">{signatories.principalName}</span>
                ) : (
                  <span className="text-slate-400 text-[11px] font-mono">...................................</span>
                )}
                <span className="text-[9px] text-slate-400 border border-slate-300 px-2 py-0.5 rounded mt-1">
                  (الختم الرسمي للمدرسة)
                </span>
              </div>
            </div>

          </div>

          {/* Document Footer Strip */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200 pt-3 mt-6">
            <span>نظام إرسال الإشعارات والرسائل الذكي - ثانوية الأبناء الأولى 2026 - 2027</span>
          </div>

        </div>

      </div>

    </div>
  );
}
