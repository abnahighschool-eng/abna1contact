import React, { useState, useEffect } from "react";
import { 
  Link2, 
  FileSpreadsheet, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Smartphone, 
  ShieldCheck, 
  Database, 
  User, 
  Printer,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Award
} from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import ExcelUploader from "./components/ExcelUploader";
import CampaignMonitor from "./components/CampaignMonitor";
import IndividualSender from "./components/IndividualSender";
import ReportsPrinter from "./components/ReportsPrinter";
import { Student, WhatsAppConfig, SchoolSignatories } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"connection" | "upload" | "send" | "individual" | "reports">("connection");
  const [config, setConfig] = useState<WhatsAppConfig>({
    mode: "simulated",
    simulatedStatus: "disconnected",
    simulatedPhone: "",
    hasCloudApiKey: false,
    cloudPhoneId: "",
    cloudAccountId: "",
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [template, setTemplate] = useState(
    "السلام عليكم ورحمة الله وبركاته،\nأهلاً بك يا سيد {أبو الطالب}، نود إحاطتكم علماً بأن الطالب {اسم الطالب} قد حصل على درجة {الدرجة} في مادة الرياضيات.\nنتمنى له دوام التوفيق والنجاح.\n- إدارة المدرسة"
  );

  // Subtle School Signatories State for Reports
  const [signatories, setSignatories] = useState<SchoolSignatories>(() => {
    const saved = localStorage.getItem("school_signatories");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      principalName: "",
      vicePrincipalName: "",
      counselorName: "",
    };
  });
  const [showSignatoriesConfig, setShowSignatoriesConfig] = useState(false);
  const [signatoriesSavedToast, setSignatoriesSavedToast] = useState(false);

  const handleUpdateSignatory = (field: keyof SchoolSignatories, val: string) => {
    const updated = { ...signatories, [field]: val };
    setSignatories(updated);
    localStorage.setItem("school_signatories", JSON.stringify(updated));
    setSignatoriesSavedToast(true);
    setTimeout(() => setSignatoriesSavedToast(false), 2000);
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/whatsapp/config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch {
      // Quietly handle transient network hiccups during server restart/initialization
    }
  };

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 2500);

    // Load local state template if any
    const savedTemplate = localStorage.getItem("whatsapp_student_template");
    if (savedTemplate) {
      setTemplate(savedTemplate);
    }
    const savedStudents = localStorage.getItem("whatsapp_student_list");
    if (savedStudents) {
      try {
        setStudents(JSON.parse(savedStudents));
      } catch (e) {
        console.error(e);
      }
    }

    return () => clearInterval(interval);
  }, []);

  const handleUpdateStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    localStorage.setItem("whatsapp_student_list", JSON.stringify(newStudents));
  };

  const handleTemplateChange = (newTmpl: string) => {
    setTemplate(newTmpl);
    localStorage.setItem("whatsapp_student_template", newTmpl);
  };

  const isWhatsAppConnected = config.simulatedStatus === "connected" || (config as any).isConnected === true;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans" dir="rtl" id="app-root">
      
      {/* Dynamic Navigation Banner */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/10 shrink-0">
              <Send className="w-5 h-5 rotate-180" />
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-slate-800 leading-none">ثانوية الأبناء الأولى - مرسل الطلاب الذكي</h1>
              <span className="text-[10px] text-slate-400 font-medium">نظام إرسال رسائل وتنبيهات الطلاب عبر واتساب</span>
            </div>
          </div>

          {/* Core Applet Status Indicators & Subtle Signatories Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs" id="header-status-indicators">
            
            {/* Subtle Signatories Configuration Trigger (Non-intrusive / Secondary) */}
            <button
              onClick={() => setShowSignatoriesConfig(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[11px] font-medium cursor-pointer ${
                showSignatoriesConfig
                  ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                  : (signatories.principalName || signatories.vicePrincipalName || signatories.counselorName)
                    ? "bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100/80"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-700 hover:bg-slate-100"
              }`}
              title="تخصيص أسماء المعتمدين والموقعين بالتقارير (اختياري)"
              id="btn-toggle-signatories"
            >
              <Award className="w-3.5 h-3.5" />
              <span>أسماء المعتمدين بالتقارير</span>
              {showSignatoriesConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              isWhatsAppConnected 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}>
              <span className={`w-2 h-2 rounded-full ${isWhatsAppConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              <span className="font-semibold">
                {isWhatsAppConnected 
                  ? `متصل: ${config.simulatedPhone}` 
                  : "واتساب غير مرتبط"
                }
              </span>
            </div>

            {/* Students count */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              students.length > 0 
                ? "bg-blue-50 text-blue-800 border-blue-100" 
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}>
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold">
                {students.length > 0 ? `${students.length} طالب جاهز` : "لا توجد قوائم"}
              </span>
            </div>

          </div>

        </div>

        {/* SUBTLE / SECONDARY COLLAPSIBLE SIGNATORIES CONFIG PANEL */}
        {showSignatoriesConfig && (
          <div className="bg-slate-50 border-t border-slate-200/90 py-3 px-4 animate-fadeIn no-print" id="subtle-signatories-panel">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 shrink-0">
                  أسماء معتمدي التقرير:
                </span>
                <span className="text-[10px] text-slate-400 hidden lg:inline">
                  (أدخل الأسماء يدوياً هنا لتنعكس مباشرة في تذييل وخانات توقيعات التقارير المطبوعة)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-3xl">
                
                {/* Principal Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus-within:ring-1 focus-within:ring-emerald-500">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">المدير:</span>
                  <input
                    type="text"
                    value={signatories.principalName}
                    onChange={(e) => handleUpdateSignatory("principalName", e.target.value)}
                    placeholder="اسم مدير المدرسة..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-principal-name"
                  />
                </div>

                {/* Vice Principal Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus-within:ring-1 focus-within:ring-emerald-500">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الوكيل:</span>
                  <input
                    type="text"
                    value={signatories.vicePrincipalName}
                    onChange={(e) => handleUpdateSignatory("vicePrincipalName", e.target.value)}
                    placeholder="اسم وكيل شؤون الطلاب..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-vice-principal-name"
                  />
                </div>

                {/* Counselor Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus-within:ring-1 focus-within:ring-emerald-500">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الموجه:</span>
                  <input
                    type="text"
                    value={signatories.counselorName}
                    onChange={(e) => handleUpdateSignatory("counselorName", e.target.value)}
                    placeholder="اسم الموجه الطلابي..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-counselor-name"
                  />
                </div>

              </div>

              {/* Status Indicator feedback */}
              <div className="flex items-center justify-end gap-2 text-[10px]">
                {signatoriesSavedToast ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Check className="w-3 h-3" />
                    تم الحفظ
                  </span>
                ) : (
                  <button
                    onClick={() => setShowSignatoriesConfig(false)}
                    className="text-slate-400 hover:text-slate-600 px-2 py-1 rounded text-[11px] cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-8">
        
        {/* Navigation / Wizard Tab Links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-white border border-slate-200/80 p-1.5 rounded-2xl shadow-sm text-sm font-semibold text-slate-500 animate-fadeIn gap-1" id="wizard-navigation-tabs">
          
          <button
            onClick={() => setActiveTab("connection")}
            className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm ${
              activeTab === "connection"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-connection"
          >
            <Link2 className="w-4 h-4 shrink-0" />
            <span>الربط والاتصال</span>
          </button>

          <button
            onClick={() => setActiveTab("upload")}
            className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm ${
              activeTab === "upload"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-upload"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>رفع كشوف الطلاب</span>
          </button>

          <button
            onClick={() => setActiveTab("send")}
            disabled={students.length === 0}
            className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm ${
              activeTab === "send"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-send"
          >
            <Send className="w-4 h-4 shrink-0 rotate-180" />
            <span>حملة الإرسال الجماعي</span>
          </button>

          <button
            onClick={() => setActiveTab("individual")}
            className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm ${
              activeTab === "individual"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-individual"
          >
            <User className="w-4 h-4 shrink-0" />
            <span>إرسال فردي سريع</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`py-3 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-xs sm:text-sm col-span-2 sm:col-span-1 ${
              activeTab === "reports"
                ? "bg-emerald-700 text-white shadow-sm font-bold"
                : "hover:text-emerald-800 hover:bg-emerald-50/60 text-emerald-700"
            }`}
            id="tab-btn-reports"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>التقارير والطباعة</span>
          </button>

        </div>

        {/* Wizard Main Panel with Keep-Alive View Preservation */}
        <div className="flex-1" id="wizard-panels-viewport">
          <div className={activeTab === "connection" ? "block" : "hidden"}>
            <ConnectionPanel 
              config={config} 
              onUpdateConfig={(updated) => setConfig((prev) => ({ ...prev, ...updated }))} 
              onRefreshConfig={fetchConfig}
            />
          </div>

          <div className={activeTab === "upload" ? "block" : "hidden"}>
            <ExcelUploader 
              students={students} 
              onStudentsLoaded={handleUpdateStudents} 
            />
          </div>

          <div className={activeTab === "send" ? "block" : "hidden"}>
            <CampaignMonitor 
              students={students} 
              template={template} 
              onTemplateChange={handleTemplateChange}
              isWhatsAppConnected={isWhatsAppConnected}
            />
          </div>

          <div className={activeTab === "individual" ? "block" : "hidden"}>
            <IndividualSender isWhatsAppConnected={isWhatsAppConnected} />
          </div>

          <div className={activeTab === "reports" ? "block" : "hidden"}>
            <ReportsPrinter 
              students={students}
              signatories={signatories}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          </div>
        </div>

      </main>

      {/* System Footer Info */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-center text-xs text-slate-500 select-none mt-12" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-medium">جميع الحقوق محفوظة لثانوية الأبناء الأولى 2026 - 2027</p>
          <div className="flex items-center gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              تشفير اتصالات آمن
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Smartphone className="w-3.5 h-3.5" />
              واجهة مخصصة للهواتف
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

