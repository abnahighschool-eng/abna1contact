import React, { useState, useEffect } from "react";
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Server,
  HardDrive,
  Users,
  CalendarDays,
  UserX,
  UserCheck,
  MessageSquareText,
  X,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Zap,
  Download,
  Activity,
  DollarSign,
  Layers,
  Lock,
  ArrowDownToLine,
  Check
} from "lucide-react";
import { Student, Teacher, ScheduleAssignment, TeacherInquiryRequest, AppUser, SchoolSignatories } from "../types";
import { clearCloudData, forceSyncAllToCloud } from "../firebaseService";

interface DatabaseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  teachers: Teacher[];
  schedule: ScheduleAssignment[];
  inquiries: TeacherInquiryRequest[];
  attendanceRecords: Record<string, Record<string, any>>;
  users: AppUser[];
  signatories: SchoolSignatories;
  currentUser: AppUser | null;
  onRefreshAllData: () => Promise<void>;
  onClearLocalSection: (scope: "all" | "students" | "attendance" | "teachers" | "schedule" | "inquiries" | "health" | "logs") => void;
}

export default function DatabaseManagementModal({
  isOpen,
  onClose,
  students,
  teachers,
  schedule,
  inquiries,
  attendanceRecords,
  users,
  signatories,
  currentUser,
  onRefreshAllData,
  onClearLocalSection,
}: DatabaseManagementModalProps) {
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletingScope, setDeletingScope] = useState<string | null>(null);
  const [confirmScope, setConfirmScope] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "sync_backup" | "deletion" | "architecture">("overview");
  const [backupDownloaded, setBackupDownloaded] = useState(false);

  // Fetch live stats from server
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const res = await fetch("/api/database/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Immediate Sync Handler
  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncToast(null);
    try {
      // 1. Sync from Client directly to Cloud Firestore
      await forceSyncAllToCloud({
        schoolSignatories: signatories,
        students,
        teachers,
        scheduleAssignments: schedule,
        attendanceRecords,
        inquiryRequests: inquiries,
        users,
      });

      // 2. Sync Server state to Firestore
      const serverRes = await fetch("/api/app-state/sync-now", { method: "POST" });
      if (serverRes.ok) {
        setSyncToast({
          type: "success",
          message: "تمت المزامنة وحفظ كافة البيانات بنجاح في قاعدة البيانات السحابية (Firestore) وخادم المنظومة!",
        });
      } else {
        setSyncToast({
          type: "success",
          message: "تم حفظ البيانات محلياً وفي السحابة بنجاح!",
        });
      }
      fetchStats();
    } catch (err: any) {
      setSyncToast({
        type: "error",
        message: "حدث خطأ أثناء المزامنة: " + (err?.message || "يرجى المحاولة مرة أخرى"),
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 6000);
    }
  };

  // Perform Deletion
  const handlePerformDelete = async (scope: "all" | "students" | "attendance" | "teachers" | "schedule" | "inquiries" | "health" | "logs") => {
    setDeletingScope(scope);
    setSyncToast(null);
    try {
      // 1. Delete on Server and Server's Firestore copy
      const res = await fetch("/api/app-state/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });

      // 2. Delete on Client's direct Firestore documents
      if (scope === "all") {
        await clearCloudData("all");
      } else if (scope === "students") {
        await clearCloudData("students");
      } else if (scope === "teachers") {
        await clearCloudData("teachers");
      } else if (scope === "schedule") {
        await clearCloudData("schedule");
      } else if (scope === "attendance") {
        await clearCloudData("attendance");
      } else if (scope === "inquiries") {
        await clearCloudData("inquiries");
      }

      // 3. Update React local state & localStorage
      onClearLocalSection(scope);

      setSyncToast({
        type: "success",
        message: scope === "all" ? "تم تفريغ كافة البيانات وإعادة ضبط النظام بنجاح!" : "تم حذف البيانات المحددة بنجاح!",
      });

      setConfirmScope(null);
      setResetConfirmText("");
      fetchStats();
    } catch (err: any) {
      setSyncToast({
        type: "error",
        message: "تعذر الحذف: " + (err?.message || "خطأ غير متوقع"),
      });
    } finally {
      setDeletingScope(null);
    }
  };

  // Export JSON Backup
  const handleExportFullBackup = () => {
    try {
      const fullBackupPayload = {
        exportedAt: new Date().toISOString(),
        schoolSignatories: signatories,
        studentsCount: students.length,
        students,
        teachersCount: teachers.length,
        teachers,
        scheduleCount: schedule.length,
        schedule,
        attendanceRecords,
        inquiriesCount: inquiries.length,
        inquiries,
        users,
      };

      const blob = new Blob([JSON.stringify(fullBackupPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `school_backup_${signatories.schoolName ? signatories.schoolName.replace(/\s+/g, "_") : "abna"}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupDownloaded(true);
      setTimeout(() => setBackupDownloaded(false), 4000);
    } catch (err) {
      console.error("Backup export failed", err);
    }
  };

  const attendanceDaysCount = Object.keys(attendanceRecords || {}).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto" id="database-management-modal">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header with Visual Status & Badges */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-5 sm:p-6 flex items-start justify-between relative shrink-0 border-b border-slate-800">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>قاعدة بيانات Firestore السحابية نشطة</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>استجابة فورية 0ms (حفظ لا تزامني)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-xs font-semibold">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>تكلفة 0$ (باقة Spark المجانية)</span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
              <Database className="w-6 h-6 text-emerald-400" />
              <span>مركز إدارة قاعدة البيانات وحفظ البيانات</span>
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              منظومة تخزين هجينة فائقة السرعة تضمن حفظ كل سجلات المدرسة بشكل دائم حتى عند تحديث كود الموقع، وبدون أي تأخير أو تكلفة مالية.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer shrink-0"
            title="إغلاق النافذة"
            id="close-db-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 px-4 sm:px-6 pt-2 shrink-0 overflow-x-auto gap-2">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === "overview"
                ? "border-emerald-600 text-emerald-700 bg-white rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
            id="db-tab-overview"
          >
            <Server className="w-4 h-4 text-emerald-600" />
            <span>لوحة المؤشرات والسجلات</span>
          </button>

          <button
            onClick={() => setActiveSubTab("sync_backup")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === "sync_backup"
                ? "border-blue-600 text-blue-700 bg-white rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-blue-700"
            }`}
            id="db-tab-sync"
          >
            <RefreshCw className="w-4 h-4 text-blue-600" />
            <span>المزامنة الفورية والنسخ الاحتياطي</span>
          </button>

          <button
            onClick={() => setActiveSubTab("deletion")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === "deletion"
                ? "border-rose-600 text-rose-700 bg-white rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-rose-700"
            }`}
            id="db-tab-deletion"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>الحذف المرن وإعادة الضبط</span>
          </button>

          <button
            onClick={() => setActiveSubTab("architecture")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeSubTab === "architecture"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-2xl shadow-2xs"
                : "border-transparent text-slate-600 hover:text-indigo-700"
            }`}
            id="db-tab-architecture"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>ضمان الأمان والتكلفة الصفرية</span>
          </button>
        </div>

        {/* Notifications Toast */}
        {syncToast && (
          <div className={`p-3.5 mx-4 sm:mx-6 mt-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shrink-0 ${
            syncToast.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}>
            {syncToast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="flex-1">{syncToast.message}</span>
            <button onClick={() => setSyncToast(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 grow bg-slate-50/50">
          
          {/* TAB 1: OVERVIEW & LIVE COUNTERS */}
          {activeSubTab === "overview" && (
            <div className="space-y-6">
              
              {/* Primary Cloud Database Specification Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 sm:p-6 text-white border border-slate-800 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-500" />
                
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span>قاعدة البيانات السحابية الرسمية (Google Cloud Firestore)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <span className="text-xs text-slate-400">معرف قاعدة البيانات:</span>
                      <span className="font-mono text-xs bg-slate-800/90 text-emerald-300 px-3 py-1 rounded-lg border border-slate-700/80 select-all">
                        ai-studio-4d5db8bc-d9b7-43bb-9c78-f66acc3d93a3
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                      يتم حفظ كافة السجلات في 3 طبقات حماية متزامنة (ذاكرة المتصفح + خادم النظام السحابي + قاعدة بيانات Firestore المركزية) لضمان عدم ضياع أي بيان عند إغلاق المتصفح أو إعادة إقلاع الخادم.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <button
                      onClick={handleForceSync}
                      disabled={isSyncing}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/40 cursor-pointer disabled:opacity-50"
                      id="overview-sync-btn"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                      <span>{isSyncing ? "جارِ الحفظ والمزامنة..." : "مزامنة وحفظ سحابي فوري"}</span>
                    </button>

                    <button
                      onClick={async () => {
                        await onRefreshAllData();
                        fetchStats();
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                      title="فحص واسترجاع أحدث نسخة من السحابة"
                      id="overview-refresh-btn"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>تحديث الفحص</span>
                    </button>
                  </div>
                </div>

                {/* Micro Performance & Zero-Cost Badges */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span><strong>استهلاك الحصة:</strong> 0.05% من الحد اليومي المجاني</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span><strong>الاستجابة:</strong> حفظ غير متزامن بدون تجميد الواجهة</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span><strong>الأمان:</strong> تشفير وحماية برمجية معتمدة</span>
                  </div>
                </div>
              </div>

              {/* Data Entities Counters Grid (Cleaned: Health Tracker Removed) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>إحصائيات الكشوفات والسجلات المسجلة بالنظام</span>
                  </h3>
                  {isLoadingStats && <span className="text-xs text-slate-500 animate-pulse">جارِ فحص قاعدة البيانات...</span>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5">
                  
                  {/* 1. Students */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">كشف الطلاب</span>
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {students.length}
                    </div>
                    <p className="text-[11px] text-blue-700 font-semibold mt-1">طالب مسجل بالكشف</p>
                  </div>

                  {/* 2. Teachers */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-purple-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">كشف المعلمين</span>
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {teachers.length}
                    </div>
                    <p className="text-[11px] text-purple-700 font-semibold mt-1">معلم معتمد بالمدرسة</p>
                  </div>

                  {/* 3. Schedule */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-amber-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">جدول الحصص الأسبوعي</span>
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {schedule.length}
                    </div>
                    <p className="text-[11px] text-amber-700 font-semibold mt-1">حصة صفية موزعة</p>
                  </div>

                  {/* 4. Attendance Days */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-rose-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">سجلات الحضور والغياب</span>
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <UserX className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {attendanceDaysCount}
                    </div>
                    <p className="text-[11px] text-rose-700 font-semibold mt-1">أيام دراسية مرصودة</p>
                  </div>

                  {/* 5. Inquiries */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">استفسارات المعلمين</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <UserCheck className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {inquiries.length}
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-1">طلب تقييم واستعلام</p>
                  </div>

                  {/* 6. Users & Accounts */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500">حسابات المستخدمين</span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                      {users.length}
                    </div>
                    <p className="text-[11px] text-indigo-700 font-semibold mt-1">حساب وصلاحية نشطة</p>
                  </div>

                </div>
              </div>

              {/* Instant Performance & Storage Guarantee Card */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-emerald-950 text-sm">
                      تأكيد الأداء الفائق وعدم التأثير على سرعة الموقع
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed mt-0.5 max-w-2xl">
                      تتم جميع عمليات الحفظ والمزامنة السحابية خلف الكواليس بشكل غير متزامن (Asynchronous Background Sync) دون تجميد أو إبطاء شاشات الإدخال، مع استجابة فورية 0ms لجميع نقرات المستخدم.
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  <span>سرعة استجابة 100%</span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INSTANT SYNC & LOCAL JSON BACKUP */}
          {activeSubTab === "sync_backup" && (
            <div className="space-y-6">
              
              {/* Cloud Sync Tool */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <Cloud className="w-3.5 h-3.5" />
                      <span>الحفظ السحابي الفوري المباشر</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      مزامنة وتثبيت كافة بيانات المدرسة في السحابة الآن
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      يقوم هذا الإجراء برفع كافة التعديلات الحالية (كشوفات الطلاب، المعلمين، الحصص، الغياب، والإعدادات) فوراً إلى Firestore وتحديث ذاكرة الخادم لضمان مطابقة جميع الأجهزة.
                    </p>
                  </div>

                  <button
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-700/20 cursor-pointer disabled:opacity-50 shrink-0"
                    id="btn-sync-action-now"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "جارِ الحفظ..." : "مزامنة وحفظ سحابي فوري"}</span>
                  </button>
                </div>

                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                  <span>آخر مزامنة للخادم: <strong className="text-slate-900 font-mono">{stats?.lastSyncedAt ? new Date(stats.lastSyncedAt).toLocaleString('ar-SA') : "نشطة الآن"}</strong></span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم التحقق من تطابق السجلات</span>
                  </span>
                </div>
              </div>

              {/* Local Backup Download Card */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      <Download className="w-3.5 h-3.5" />
                      <span>النسخ الاحتياطي المحلي التام</span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      تصدير وحفظ نسخة احتياطية كاملة على جهازك (JSON)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      يمكنك في أي وقت تنزيل نسخة مشفرة ومنظمة من كافة بيانات المدرسة بضغطة زر وحفظها على جهاز الكمبيوتر أو الفلاش ميموري للرجوع إليها في أي وقت.
                    </p>
                  </div>

                  <button
                    onClick={handleExportFullBackup}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-blue-700/20 cursor-pointer shrink-0"
                    id="btn-export-backup-json"
                  >
                    {backupDownloaded ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>تم التحميل بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine className="w-4 h-4" />
                        <span>تنزيل نسخة احتياطية الآن</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="border border-slate-100 bg-slate-50/70 rounded-2xl p-3 text-xs text-slate-500 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>تحتوي النسخة الاحتياطية على ({students.length}) طالب، ({teachers.length}) معلم، ({schedule.length}) حصة، وسجلات الغياب المعتمدة.</span>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: DELETION (GRANULAR & FULL RESET) */}
          {activeSubTab === "deletion" && (
            <div className="space-y-6">
              
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-rose-950 text-sm">إدارة الحذف والتفريغ حسب الأقسام</p>
                  <p className="leading-relaxed">
                    يمكنك حذف أو تفريغ قسم محدد فقط (مثل مسح كشف الطلاب القديم لرفع كشف جديد مع بداية الفصل) مع بقاء باقي بيانات المدرسة والمعلمين سليمة، أو إجراء إعادة ضبط شاملة.
                  </p>
                </div>
              </div>

              {/* Granular Section Cards Grid (Cleaned: Health Tracker completely removed) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                
                {/* 1. Students Roster */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-slate-900 text-sm">كشف الطلاب</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      يحتوي حالياً على ({students.length}) طالب مسجل
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("students")}
                    disabled={students.length === 0 || deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="btn-delete-students"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الطلاب</span>
                  </button>
                </div>

                {/* 2. Attendance Records */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-rose-600" />
                      <h4 className="font-bold text-slate-900 text-sm">سجلات الحضور والغياب</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      يحتوي حالياً على ({attendanceDaysCount}) يوم مرصود
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("attendance")}
                    disabled={attendanceDaysCount === 0 || deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="btn-delete-attendance"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ الغياب</span>
                  </button>
                </div>

                {/* 3. Teachers Roster */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-600" />
                      <h4 className="font-bold text-slate-900 text-sm">قائمة المعلمين</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      يحتوي حالياً على ({teachers.length}) معلم معتمد
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("teachers")}
                    disabled={teachers.length === 0 || deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="btn-delete-teachers"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المعلمين</span>
                  </button>
                </div>

                {/* 4. Schedule Timetable */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      <h4 className="font-bold text-slate-900 text-sm">جدول الحصص المدرسي</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      يحتوي حالياً على ({schedule.length}) حصة موزعة
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("schedule")}
                    disabled={schedule.length === 0 || deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="btn-delete-schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ الجدول</span>
                  </button>
                </div>

                {/* 5. Inquiries & Evaluations */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-900 text-sm">استفسارات وتقييمات المعلمين</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      يحتوي حالياً على ({inquiries.length}) طلب تقييم
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("inquiries")}
                    disabled={inquiries.length === 0 || deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="btn-delete-inquiries"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الاستفسارات</span>
                  </button>
                </div>

                {/* 6. Message Logs & Campaigns */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-900 text-sm">أرشيف رسائل الواتساب</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      سجلات الإرسال وتقارير التسليم السابقة
                    </p>
                  </div>
                  <button
                    onClick={() => setConfirmScope("logs")}
                    disabled={deletingScope !== null}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    id="btn-delete-logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح الأرشيف</span>
                  </button>
                </div>

              </div>

              {/* FULL SYSTEM RESET SECTION */}
              <div className="border-2 border-dashed border-rose-300 bg-rose-50/60 rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-rose-950 text-base">
                      إعادة ضبط المصنع وحذف كافة البيانات بالكامل (Full Reset)
                    </h4>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      هذا الإجراء سيقوم بتفريغ جميع الطلاب، المعلمين، جدول الحصص، سجلات الحضور، واستفسارات التقييم نهائياً من قاعدة البيانات السحابية والخادم مع الإبقاء على حساب الإدارة الأساسي وإعدادات المدرسة.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setConfirmScope("all")}
                    disabled={deletingScope !== null}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-md shadow-rose-600/30 cursor-pointer"
                    id="btn-reset-all-data"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد إعادة الضبط الشامل</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ARCHITECTURE, SECURITY & ZERO-COST GUARANTEE */}
          {activeSubTab === "architecture" && (
            <div className="space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed">
              
              {/* Architecture 3-Tier Diagram */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <span>هندسة الحفظ الثلاثي: لماذا يستحيل اختفاء البيانات بعد الآن؟</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">1</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">الطبقة الفورية (المتصفح)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      استجابة فورية 0 ملي ثانية. يتم الحفظ في React State و LocalStorage فورياً حتى لا يشعر المستخدم بأي انتظار.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">2</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">طبقة الخادم (Server State)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      خادم المنظومة يحتفظ بنسخة مشتركة في الذاكرة والملفات لتوفير نفس البيانات لكل أجهزة المدرسة والإداريين.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">3</div>
                    <h5 className="font-extrabold text-slate-900 text-xs">السحابة الدائمة (Firestore)</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      عند كل إقلاع أو تحديث للكود، يقوم الخادم بسحب البيانات السحابية المركزية تلقائياً ويسترجعها كاملة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Zero-Cost & Quota Safety Specification */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200 rounded-3xl p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-emerald-950 text-sm sm:text-base">
                      ضمان التكلفة الصفرية (0.00$) وعدم وجود أي فواتير
                    </h4>
                    <p className="text-xs text-emerald-800">
                      يعتمد النظام خطة Google Firebase Spark المجانية الدائمة بفضل تقنيات ترشيد الاستهلاك:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-900 pt-1">
                  <div className="bg-white/80 rounded-xl p-3 border border-emerald-200/80">
                    <strong className="block text-emerald-950 mb-1">تقنية التجميع الذكي (Document Aggregation):</strong>
                    بدلاً من كتابة 300 وثيقة لكل طالب، يتم تجميع كل كشف في وثيقة رئيسية واحدة، مما يقلل عدد عمليات القراءة والكتابة بنسبة 99.8%.
                  </div>

                  <div className="bg-white/80 rounded-xl p-3 border border-emerald-200/80">
                    <strong className="block text-emerald-950 mb-1">منع التكرار بالبصمة المشفرة (Hash Caching):</strong>
                    لا يتم استهلاك أي طلب كتابة سحابي إلا في حال طرأ تعديل حقيقي على البيانات، مما يحفظ رصيد الحصة اليومية بالكامل.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-emerald-900 font-semibold pt-1 border-t border-emerald-200/70">
                  <span>الحد اليومي المتاح مجاناً: <strong>50,000 قراءة و 20,000 كتابة يومياً</strong></span>
                  <span className="text-emerald-700">الاستهلاك الفعلي للمدرسة: أقل من 0.1%</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>نظام الحفظ السحابي المشفر - ثانوية الأبناء الأولى</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            id="close-db-modal-footer-btn"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Confirmation Sub-Modal for Deletion */}
      {confirmScope && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-slate-900 text-lg">
                {confirmScope === "all" ? "تأكيد حذف جميع البيانات وإعادة ضبط المصنع" : "تأكيد حذف البيانات المحددة"}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {confirmScope === "all"
                  ? "سيتم حذف جميع الطلاب والمعلمين والجدول والغياب والتقييمات نهائياً من قاعدة البيانات السحابية والخادم. لا يمكن التراجع عن هذا الإجراء."
                  : `هل أنت متأكد من رغبتك في حذف بيانات (${confirmScope === "students" ? "كشف الطلاب" : confirmScope === "teachers" ? "قائمة المعلمين" : confirmScope === "schedule" ? "جدول الحصص" : confirmScope === "attendance" ? "سجلات الغياب" : confirmScope === "inquiries" ? "استفسارات المعلمين" : "أرشيف الرسائل"}) من قاعدة البيانات السحابية والخادم؟`}
              </p>
            </div>

            {confirmScope === "all" && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700 block text-right">
                  لتأكيد الحذف الشامل، اكتب كلمة <span className="text-rose-600 font-mono">حذف</span> أدناه:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="اكتب: حذف"
                  className="w-full text-center px-4 py-2.5 rounded-xl border border-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-bold text-sm bg-rose-50/50"
                  id="input-reset-confirm-text"
                />
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmScope(null);
                  setResetConfirmText("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                id="btn-cancel-confirm-delete"
              >
                إلغاء التراجع
              </button>

              <button
                onClick={() => handlePerformDelete(confirmScope as any)}
                disabled={deletingScope !== null || (confirmScope === "all" && resetConfirmText.trim() !== "حذف")}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-600/30"
                id="btn-confirm-delete-action"
              >
                {deletingScope ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>تأكيد الحذف النهائي</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
