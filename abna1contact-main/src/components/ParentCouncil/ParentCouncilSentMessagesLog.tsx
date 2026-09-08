import React, { useState, useMemo } from "react";
import {
  Send,
  CheckCircle2,
  Eye,
  FileCheck,
  Printer,
  Search,
  RefreshCw,
  Clock,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  AlertCircle,
  Filter,
  UserCheck,
  Phone,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { ParentCouncilApplication, ParentCouncilInvite } from "../../types/parentCouncil";
import { Student } from "../../types";

interface ParentCouncilSentMessagesLogProps {
  invites: Record<string, ParentCouncilInvite>;
  applications: Record<string, ParentCouncilApplication>;
  students?: Student[];
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  onOpenPrintReport?: () => void;
  onViewApplication?: (app: ParentCouncilApplication) => void;
}

export default function ParentCouncilSentMessagesLog({
  invites,
  applications,
  students = [],
  onRefreshData,
  isRefreshing = false,
  onOpenPrintReport,
  onViewApplication,
}: ParentCouncilSentMessagesLogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "opened" | "unopened" | "submitted" | "pending_submit">("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Derive consolidated list of all sent invites
  const sentList: ParentCouncilInvite[] = useMemo(() => {
    // 1. Get all invites from store that have isSent = true or sentAt
    const list: ParentCouncilInvite[] = [];
    const seenIds = new Set<string>();

    Object.values(invites || {}).forEach((inv) => {
      if (inv && (inv.isSent || inv.sentAt)) {
        seenIds.add(inv.studentId);
        // Check if there is an application for this student
        const matchedApp = inv.studentId ? applications[inv.studentId] : null;
        list.push({
          ...inv,
          isSubmitted: inv.isSubmitted || !!matchedApp,
          submittedAt: inv.submittedAt || matchedApp?.submittedAt,
          hasOpened: inv.hasOpened || !!matchedApp,
          applicationId: inv.applicationId || matchedApp?.id,
        });
      }
    });

    // 2. Also check if any applications exist where an invite was not formally marked, include them
    Object.values(applications || {}).forEach((app) => {
      if (app.studentId && !seenIds.has(app.studentId)) {
        seenIds.add(app.studentId);
        list.push({
          studentId: app.studentId,
          studentName: app.studentName,
          studentGrade: app.studentGrade,
          studentClass: app.studentClass || "1",
          guardianPhone: app.phone,
          guardianName: app.fullName,
          code: app.activationCode || "202601",
          token: app.activationToken || `tok_${app.studentId}`,
          isSent: true,
          sentAt: app.submittedAt,
          hasOpened: true,
          openedAt: app.submittedAt,
          isSubmitted: true,
          submittedAt: app.submittedAt,
          applicationId: app.id,
        });
      }
    });

    // Sort: newest sent first
    return list.sort((a, b) => {
      const timeA = new Date(a.sentAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.sentAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [invites, applications]);

  // Extract unique grades for filtering
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    sentList.forEach((item) => {
      if (item.studentGrade) grades.add(item.studentGrade);
    });
    return Array.from(grades);
  }, [sentList]);

  // Statistics calculation
  const totalSent = sentList.length;
  const totalOpened = sentList.filter((i) => i.hasOpened || i.isSubmitted).length;
  const totalSubmitted = sentList.filter((i) => i.isSubmitted).length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const submitRate = totalSent > 0 ? Math.round((totalSubmitted / totalSent) * 100) : 0;

  // Filtered entries
  const filteredList = useMemo(() => {
    return sentList.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (item.studentName || "").toLowerCase().includes(q);
        const matchGuardian = (item.guardianName || "").toLowerCase().includes(q);
        const matchPhone = (item.guardianPhone || "").includes(q);
        const matchCode = (item.code || "").includes(q);
        if (!matchName && !matchGuardian && !matchPhone && !matchCode) return false;
      }

      // Grade filter
      if (selectedGrade !== "all" && item.studentGrade !== selectedGrade) {
        return false;
      }

      // Status filter
      const isSubmitted = !!item.isSubmitted;
      const hasOpened = !!item.hasOpened || isSubmitted;

      if (statusFilter === "opened" && !hasOpened) return false;
      if (statusFilter === "unopened" && hasOpened) return false;
      if (statusFilter === "submitted" && !isSubmitted) return false;
      if (statusFilter === "pending_submit" && isSubmitted) return false;

      return true;
    });
  }, [sentList, searchQuery, selectedGrade, statusFilter]);

  // Copy helper
  const handleCopyLinkAndCode = (item: ParentCouncilInvite) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/parent-council/token/${item.token}`;
    const textToCopy = `المكرم ولي أمر الطالب/ـة: ${item.studentName}\nرابط تعبئة استمارة ترشح مجلس أولياء الأمور:\n${portalUrl}\nرمز التفعيل الخاص بكم: ${item.code}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCodeId(item.studentId);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  // WhatsApp Reminder Sender
  const handleSendReminderWhatsApp = (item: ParentCouncilInvite) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/parent-council/token/${item.token}`;
    const reminderMsg = `المكرم ولي أمر الطالب/ـة: ${item.studentName} المحترم\nالسلام عليكم ورحمة الله وبركاته،\n\nنود تذكيركم بالترشح لعضوية مجلس أولياء الأمور بالمدرسة للعام الدراسي الجديد عبر الرابط التالي:\n🔗 ${portalUrl}\n\n🔐 رمز التفعيل الخاص بكم: *${item.code}*\n\nشاكرين ومقدرين كريم اهتمامكم وتواصلكم.`;

    const cleanPhone = (item.guardianPhone || "").replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("05") ? "966" + cleanPhone.substring(1) : cleanPhone;

    if (finalPhone) {
      window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(reminderMsg)}`, "_blank");
    } else {
      alert("لا يوجد رقم جوال مسجل لهذا الطالب لإرسال التذكير.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Real-time indicator & Action Buttons */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Send className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base sm:text-lg font-black tracking-wide">
              سجل الدعوات والرسائل المرسلة لأولياء الأمور
            </h2>
            <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>تحديث لحظي نشط</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            متابعة لحظية ومباشرة لحالات استلام الرسائل عبر واتساب، فتح الروابط، وإكمال تعبئة استمارات الترشح من قبل أولياء الأمور.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {onRefreshData && (
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95"
              title="تحديث البيانات لحظياً من الخادم"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span>{isRefreshing ? "جارٍ التحديث..." : "تحديث لحظي"}</span>
            </button>
          )}

          {onOpenPrintReport && (
            <button
              onClick={onOpenPrintReport}
              id="btn-open-sent-report-print"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة تقرير المتابعة الرسمي (A4)</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Sent */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المرسل</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-2">
            {totalSent}
          </div>
          <div className="text-[11px] font-bold text-teal-700 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>تم الإرسال لجميع المستهدفين</span>
          </div>
        </div>

        {/* Card 2: Received */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">استلم الرسالة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-2">
            {totalSent}
          </div>
          <div className="text-[11px] font-bold text-emerald-700 mt-1">
            100% نسبة وصول الرسائل
          </div>
        </div>

        {/* Card 3: Opened Link */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تم فتح الرابط</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-700 font-mono mt-2">
            {totalOpened}
          </div>
          <div className="text-[11px] font-bold text-sky-700 mt-1">
            نسبة الفتح والتفاعل: {openRate}%
          </div>
        </div>

        {/* Card 4: Form Submitted */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تم تعبئة الاستمارة</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-800 font-mono mt-2">
            {totalSubmitted}
          </div>
          <div className="text-[11px] font-bold text-teal-800 mt-1">
            نسبة التقديم المكتمل: {submitRate}%
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الطالب، ولي الأمر، رقم الجوال، أو رمز التفعيل..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === "all" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            الكل ({sentList.length})
          </button>
          <button
            onClick={() => setStatusFilter("opened")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === "opened" ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            فتحوا الرابط ({totalOpened})
          </button>
          <button
            onClick={() => setStatusFilter("submitted")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === "submitted" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            أكملوا الاستمارة ({totalSubmitted})
          </button>
          <button
            onClick={() => setStatusFilter("pending_submit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === "pending_submit" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            بانتظار التعبئة ({totalSent - totalSubmitted})
          </button>
        </div>

        {/* Grade Filter */}
        {availableGrades.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
            >
              <option value="all">كافة الصفوف</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5">الطالب والصف</th>
                <th className="p-3.5">ولي الأمر والجوال</th>
                <th className="p-3.5 text-center">رمز التفعيل</th>
                <th className="p-3.5">استلام الرسالة</th>
                <th className="p-3.5">فتح الرابط</th>
                <th className="p-3.5">تعبئة الاستمارة</th>
                <th className="p-3.5 text-center">إجراءات المتابعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <Send className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm text-slate-800">لا توجد رسائل مرسلة مطابقة للشروط</div>
                    <p className="text-xs text-slate-500 mt-1">
                      يمكنك الانتقال لقسم "تحديد الطلاب وإرسال دعوات الترشح" لتحديد الطلاب وإرسال الرسائل عبر واتساب.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => {
                  const isSubmitted = !!item.isSubmitted;
                  const hasOpened = !!item.hasOpened || isSubmitted;
                  const matchedApp = item.applicationId
                    ? applications[item.applicationId]
                    : item.studentId
                    ? applications[item.studentId]
                    : null;

                  const sentTimeStr = item.sentAt
                    ? new Date(item.sentAt).toLocaleDateString("ar-SA", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "تم الإرسال";

                  const openedTimeStr = item.openedAt
                    ? new Date(item.openedAt).toLocaleDateString("ar-SA", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const submittedTimeStr = item.submittedAt
                    ? new Date(item.submittedAt).toLocaleDateString("ar-SA", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <tr key={item.studentId || index} className="hover:bg-slate-50/70 transition-colors">
                      {/* Index */}
                      <td className="p-3.5 text-center font-mono font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Student & Grade */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          {item.studentName}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.studentGrade}</span>
                          {item.studentClass && <span>— الشعبة {item.studentClass}</span>}
                        </div>
                      </td>

                      {/* Guardian & Phone */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 text-xs">
                          {item.guardianName || "ولي الأمر"}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1 mt-0.5" dir="ltr">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{item.guardianPhone || "—"}</span>
                        </div>
                      </td>

                      {/* Activation Code */}
                      <td className="p-3.5 text-center">
                        <div className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-mono font-black text-slate-900 border border-slate-200">
                          {item.code}
                        </div>
                      </td>

                      {/* 1. استلم الرسالة */}
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>استلم الرسالة</span>
                        </div>
                        {sentTimeStr && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1 mr-1">
                            {sentTimeStr}
                          </div>
                        )}
                      </td>

                      {/* 2. فتح الرابط */}
                      <td className="p-3.5">
                        {hasOpened ? (
                          <>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-bold text-[11px]">
                              <Eye className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>تم فتح الرابط</span>
                            </div>
                            {openedTimeStr && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 mr-1">
                                {openedTimeStr}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>لم يُفتح بعد</span>
                          </div>
                        )}
                      </td>

                      {/* 3. تعبئة الاستمارة */}
                      <td className="p-3.5">
                        {isSubmitted ? (
                          <>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-extrabold text-[11px]">
                              <FileCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span>تم تعبئة الاستمارة</span>
                            </div>
                            {submittedTimeStr && (
                              <div className="text-[10px] text-slate-500 font-mono mt-1 mr-1">
                                {submittedTimeStr}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>بانتظار التعبئة</span>
                          </div>
                        )}
                      </td>

                      {/* Quick Follow-up Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View submitted application */}
                          {isSubmitted && matchedApp && onViewApplication && (
                            <button
                              onClick={() => onViewApplication(matchedApp)}
                              className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="عرض الاستمارة المعبأة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Copy Link & Code */}
                          <button
                            onClick={() => handleCopyLinkAndCode(item)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="نسخ الرابط المباشر ورمز التفعيل"
                          >
                            {copiedCodeId === item.studentId ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          {/* Resend WhatsApp Reminder if not submitted */}
                          {!isSubmitted && (
                            <button
                              onClick={() => handleSendReminderWhatsApp(item)}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                              title="إرسال تذكير بالاستمارة عبر واتساب"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>تذكير</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>عدد السجلات المعروضة:</span>
            <span className="font-bold text-slate-800">{filteredList.length}</span>
            <span>من إجمالي</span>
            <span className="font-bold text-slate-800">{sentList.length}</span>
            <span>دعوة مرسلة</span>
          </div>

          <div className="text-[11px] text-slate-400">
            يتم تحديث حالات استلام الرسائل، فتح الروابط، وتعبئة الاستمارات آلياً ولحظياً فور حدوثها.
          </div>
        </div>
      </div>
    </div>
  );
}
