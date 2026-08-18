import React, { useState, useEffect } from "react";
import { Link2, FileSpreadsheet, MessageSquare, Send, CheckCircle2, AlertCircle, Sparkles, Smartphone, ShieldCheck, Database, User } from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import ExcelUploader from "./components/ExcelUploader";
import CampaignMonitor from "./components/CampaignMonitor";
import IndividualSender from "./components/IndividualSender";
import { Student, WhatsAppConfig } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<"connection" | "upload" | "send" | "individual">("connection");
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

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/whatsapp/config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Error fetching WhatsApp configuration", err);
    }
  };

  useEffect(() => {
    fetchConfig();
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
  }, []);

  const handleUpdateStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    localStorage.setItem("whatsapp_student_list", JSON.stringify(newStudents));
  };

  const handleTemplateChange = (newTmpl: string) => {
    setTemplate(newTmpl);
    localStorage.setItem("whatsapp_student_template", newTmpl);
  };

  const isWhatsAppConnected = config.simulatedStatus === "connected";

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
              <h1 className="text-lg font-bold text-slate-800 leading-none">ABNA SCHOOL 1 - مرسل الطلاب الذكي</h1>
              <span className="text-[10px] text-slate-400 font-medium">نظام إرسال رسائل وتنبيهات الطلاب عبر واتساب</span>
            </div>
          </div>

          {/* Core Applet Status Indicators */}
          <div className="flex flex-wrap items-center gap-3 text-xs" id="header-status-indicators">
            
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
      </header>

      {/* Primary Dashboard Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-8">
        
        {/* Navigation / Wizard Tab Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-slate-200/80 p-1.5 rounded-2xl shadow-sm text-sm font-semibold text-slate-500 animate-fadeIn" id="wizard-navigation-tabs">
          
          <button
            onClick={() => setActiveTab("connection")}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "connection"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-connection"
          >
            <Link2 className="w-4 h-4 shrink-0" />
            الربط والاتصال
          </button>

          <button
            onClick={() => setActiveTab("upload")}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "upload"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-upload"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            رفع كشوف الطلاب
          </button>

          <button
            onClick={() => setActiveTab("send")}
            disabled={students.length === 0}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === "send"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-send"
          >
            <Send className="w-4 h-4 shrink-0 rotate-180" />
            حملة الإرسال الجماعي (صياغة وإرسال)
          </button>

          <button
            onClick={() => setActiveTab("individual")}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "individual"
                ? "bg-slate-900 text-white shadow-sm"
                : "hover:text-slate-800 hover:bg-slate-50"
            }`}
            id="tab-btn-individual"
          >
            <User className="w-4 h-4 shrink-0" />
            إرسال فردي سريع
          </button>

        </div>

        {/* Wizard Main Panel */}
        <div className="flex-1" id="wizard-panels-viewport">
          {activeTab === "connection" && (
            <ConnectionPanel 
              config={config} 
              onUpdateConfig={(updated) => setConfig((prev) => ({ ...prev, ...updated }))} 
              onRefreshConfig={fetchConfig}
            />
          )}

          {activeTab === "upload" && (
            <ExcelUploader 
              students={students} 
              onStudentsLoaded={handleUpdateStudents} 
            />
          )}

          {activeTab === "send" && (
            <CampaignMonitor 
              students={students} 
              template={template} 
              onTemplateChange={handleTemplateChange}
              isWhatsAppConnected={isWhatsAppConnected}
            />
          )}

          {activeTab === "individual" && (
            <IndividualSender isWhatsAppConnected={isWhatsAppConnected} />
          )}
        </div>

      </main>

      {/* System Footer Info */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-center text-xs text-slate-400 select-none mt-12" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} مُرْسِل الطلاب الذكي - نظام متكامل وآمن لتوزيع الإشعارات المدرسية.</p>
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
