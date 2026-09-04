import React from "react";
import { 
  MessageSquareText, 
  UserX, 
  FileSpreadsheet, 
  Printer, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Database, 
  Sparkles, 
  Clock, 
  ArrowLeft,
  School,
  Building,
  ShieldCheck,
  Zap,
  Users,
  CalendarDays,
  UserCheck
} from "lucide-react";
import { Student, SchoolSignatories, WhatsAppConfig } from "../types";

interface HomeDashboardProps {
  students: Student[];
  teachersCount?: number;
  signatories: SchoolSignatories;
  config: WhatsAppConfig;
  onNavigateToMessages: (subTab?: "connection" | "upload" | "send" | "individual" | "reports") => void;
  onNavigateToAttendance: () => void;
  onNavigateToTeachersSchedule?: () => void;
  onNavigateToInquiry?: () => void;
  onOpenSignatoriesConfig: () => void;
}

export default function HomeDashboard({
  students,
  teachersCount = 0,
  signatories,
  config,
  onNavigateToMessages,
  onNavigateToAttendance,
  onNavigateToTeachersSchedule,
  onNavigateToInquiry,
  onOpenSignatoriesConfig,
}: HomeDashboardProps) {
  const isWhatsAppConnected = config.simulatedStatus === "connected" || (config as any).isConnected === true;

  return (
    <div className="space-y-6 animate-fadeIn" id="home-dashboard-view">
      
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>لوحة التحكم الرئيسية للمدرسة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              أهلاً بكم في {signatories.schoolName || "ثانوية الأبناء الأولى"}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              منظومة إلكترونية متكاملة للتواصل الفوري مع أولياء الأمور وإدارة الطلاب وإصدار التقارير الرسمية وإدارة الحضور والغياب.
            </p>
          </div>

          {/* Quick status pill inside banner */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => onNavigateToMessages("connection")}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isWhatsAppConnected
                  ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
                  : "bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>{isWhatsAppConnected ? "واتساب متصل ✓" : "ربط واتساب الآن"}</span>
            </button>

            <button
              onClick={onOpenSignatoriesConfig}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
            >
              <Building className="w-4 h-4" />
              <span>بيانات المدرسة</span>
            </button>
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute top-0 left-0 -mt-8 -ml-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 right-1/4 -mb-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Quick Statistics Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Card 1: WhatsApp Connection */}
        <div 
          onClick={() => onNavigateToMessages("connection")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400">حالة الاتصال</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {isWhatsAppConnected ? "واتساب نشط" : "غير مرتبط"}
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isWhatsAppConnected ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500"
            }`}>
              <Smartphone className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className={isWhatsAppConnected ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
              {isWhatsAppConnected ? `الرقم: ${config.simulatedPhone || "متصل"}` : "اضغط لربط حساب واتساب"}
            </span>
            <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-transform group-hover:-translate-x-1" />
          </div>
        </div>

        {/* Card 2: Loaded Students */}
        <div 
          onClick={() => onNavigateToMessages("upload")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400">الطلاب المسجلون</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {students.length > 0 ? `${students.length} طالب` : "لم يتم الرفع"}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-blue-600 font-semibold">
              {students.length > 0 ? "عرض وتعديل كشوف الطلاب" : "رفع ملف إكسل جديد"}
            </span>
            <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-transform group-hover:-translate-x-1" />
          </div>
        </div>

        {/* Card 3: Messaging System */}
        <div 
          onClick={() => onNavigateToMessages("send")}
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400">حملات الإرسال</span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                نظام الرسائل والتقارير
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageSquareText className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-semibold">بدء حملة إرسال جماعي أو فردي</span>
            <ArrowLeft className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-transform group-hover:-translate-x-1" />
          </div>
        </div>

      </div>

      {/* Main Modules Shortcuts Grid */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>الوصول السريع إلى أقسام النظام</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Section 1: نظام الرسائل */}
          <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-slate-50/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <MessageSquareText className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">نظام الرسائل والتواصل</h3>
                <p className="text-xs text-slate-500">إرسال وتخصيص الرسائل والدرجات وإصدار التقارير</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                onClick={() => onNavigateToMessages("upload")}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>رفع كشوف الطلاب</span>
              </button>

              <button
                onClick={() => onNavigateToMessages("send")}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-blue-600 rotate-180" />
                <span>الإرسال الجماعي</span>
              </button>

              <button
                onClick={() => onNavigateToMessages("individual")}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                <span>إرسال فردي سريع</span>
              </button>

              <button
                onClick={() => onNavigateToMessages("reports")}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>التقارير والطباعة</span>
              </button>
            </div>
          </div>

          {/* Section 2: نظام الغياب والتأخر */}
          <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-slate-50/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center">
                    <UserX className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">نظام الغياب والتأخر</h3>
                    <p className="text-xs text-slate-500">رصد وإشعارات الحضور والغياب اليومي</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  قسم مخصص
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                يتيح لك هذا القسم مستقبلاً رصد حالات الغياب والتأخر الصباحي وإرسال إشعارات فورية مباشرة لأولياء الأمور وطباعة كشوف الانضباط اليومية.
              </p>
            </div>

            <button
              onClick={onNavigateToAttendance}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>فتح قسم الغياب والتأخر</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Section 3: الجدول المدرسي وكشف المعلمين */}
          {onNavigateToTeachersSchedule && (
            <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-purple-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-900 text-white flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">الجدول المدرسي وكشف المعلمين</h3>
                      <p className="text-xs text-slate-500">إدارة الحصص، كشوف المعلمين، وتوزيع الشعب</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                    {teachersCount > 0 ? `${teachersCount} معلماً` : "جدول الحصص"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-2">
                  منظومة متكاملة لربط كشوف المعلمين بالجدول المدرسي وتوزيع المواد والأنصبة مع المعاينة التفاعلية والطباعة الرسمية المعتمدة.
                </p>
              </div>

              <button
                onClick={onNavigateToTeachersSchedule}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-purple-900 text-white hover:bg-purple-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>فتح الجدول المدرسي وكشف المعلمين</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 4: الاستعلام عن طالب */}
          {onNavigateToInquiry && (
            <div className="border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-all bg-emerald-50/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-900 text-white flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">الاستعلام عن طالب</h3>
                      <p className="text-xs text-slate-500">استعلام المعلمين عن درجات وسلوك الطلاب</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                    استعلام تفاعلي
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mt-2">
                  إرسال روابط تقييم واستعلام آلية لمعلمي الطالب عبر واتساب مع جمع الردود وإصدار التقارير التجميعية الشاملة.
                </p>
              </div>

              <button
                onClick={onNavigateToInquiry}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-900 text-white hover:bg-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>فتح قسم الاستعلام عن طالب</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
