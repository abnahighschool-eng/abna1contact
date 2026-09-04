import React, { useState, useMemo } from "react";
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Phone,
  GraduationCap,
  BookOpen,
  Users,
  Edit3,
  X,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";
import { Teacher, ScheduleAssignment } from "../types";
import {
  matchTeacherInRoster,
  isNonAcademicDuty,
  SCHOOL_WEEK_DAYS,
  SCHOOL_PERIODS,
  getPeriodsForDay,
  isPeriodValidForDay,
  buildWeeklyTimetableForSection,
  buildWeeklyTimetableForTeacher,
} from "../utils/teachersScheduleParser";

interface SchedulePreviewWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: ScheduleAssignment[];
  teachers: Teacher[];
  detectedTeachers?: string[];
  detectedSections?: string[];
  onConfirmSchedule: (assignments: ScheduleAssignment[], updatedTeachers?: Teacher[]) => void;
  onUpdateTeachers?: (teachers: Teacher[]) => void;
  defaultSelectedSection?: string;
  defaultSelectedTeacher?: string;
  title?: string;
  subtitle?: string;
  isInitialUpload?: boolean;
}

export default function SchedulePreviewWorkbench({
  isOpen,
  onClose,
  assignments,
  teachers,
  detectedTeachers = [],
  detectedSections = [],
  onConfirmSchedule,
  onUpdateTeachers,
  defaultSelectedSection,
  defaultSelectedTeacher,
  title = "المعاينة التفاعلية لجدول الحصص المدرسي وتوزيع المواد والشعب",
  subtitle = "فنية المعاينة والتفاعل للتعرف على المعلم والحصص والشعب المسندة إليه وربطه بكشف الأسماء",
  isInitialUpload = false,
}: SchedulePreviewWorkbenchProps) {
  if (!isOpen) return null;

  // Local state for teachers roster to support real-time phone number additions/edits inside preview
  const [localTeachers, setLocalTeachers] = useState<Teacher[]>(teachers);
  const [activeTab, setActiveTab] = useState<"matrix" | "matching">("matrix");
  const [viewMode, setViewMode] = useState<"section" | "teacher" | "all_teachers">(
    defaultSelectedTeacher ? "teacher" : "section"
  );

  // Determine available sections
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    detectedSections.forEach((s) => s && set.add(s.trim()));
    assignments.forEach((a) => {
      if (a.section && !isNonAcademicDuty(a.section)) {
        set.add(a.section.trim());
      }
    });
    const arr = Array.from(set);
    // Sort logically (extract numbers if present)
    return arr.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.replace(/\D/g, "") || "0", 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b, "ar");
    });
  }, [assignments, detectedSections]);

  // Determine available teachers from schedule
  const availableScheduleTeachers = useMemo(() => {
    const set = new Set<string>();
    detectedTeachers.forEach((t) => t && set.add(t.trim()));
    assignments.forEach((a) => {
      if (a.teacherName) set.add(a.teacherName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [assignments, detectedTeachers]);

  const [selectedSection, setSelectedSection] = useState<string>(
    defaultSelectedSection || availableSections[0] || "شعبة 1"
  );
  const [selectedTeacher, setSelectedTeacher] = useState<string>(
    defaultSelectedTeacher || availableScheduleTeachers[0] || ""
  );

  // Cross-matching search
  const [matchingSearch, setMatchingSearch] = useState<string>("");

  // Inline editing state for phone
  const [editingTeacherScheduleName, setEditingTeacherScheduleName] = useState<string | null>(null);
  const [editPhoneValue, setEditPhoneValue] = useState<string>("");
  const [inspectedCell, setInspectedCell] = useState<{
    day: string;
    period: number;
    assignment: ScheduleAssignment;
  } | null>(null);

  // Calculate Cross-Matching Data for each unique teacher in the schedule
  const crossMatchingList = useMemo(() => {
    return availableScheduleTeachers.map((schedName) => {
      const teacherObj = matchTeacherInRoster(schedName, localTeachers);
      const tAssignments = assignments.filter((a) => a.teacherName === schedName);
      
      const uniqueSubjects = Array.from(
        new Set(tAssignments.map((a) => a.subject?.trim()).filter((s) => s && !isNonAcademicDuty(s)))
      );
      const uniqueSections = Array.from(
        new Set(tAssignments.map((a) => a.section?.trim()).filter((s) => s && !isNonAcademicDuty(s)))
      );

      const phone = teacherObj?.phone || "";
      const specialty = teacherObj?.subjectSpecialty || teacherObj?.specialty || (uniqueSubjects[0] || "عام");
      const isMatched = !!teacherObj;
      const hasPhone = !!phone.trim();

      return {
        scheduleName: schedName,
        teacherObj,
        rosterName: teacherObj?.name,
        specialty,
        phone,
        uniqueSubjects,
        uniqueSections,
        totalPeriods: tAssignments.length,
        isMatched,
        hasPhone,
      };
    });
  }, [availableScheduleTeachers, localTeachers, assignments]);

  // KPIs
  const totalTeachersCount = availableScheduleTeachers.length;
  const totalAssignmentsCount = assignments.length;
  const totalSectionsCount = availableSections.length;
  const teachersWithPhoneCount = crossMatchingList.filter((t) => t.hasPhone).length;
  const teachersNeedPhoneCount = totalTeachersCount - teachersWithPhoneCount;

  // Timetable Matrices
  const sectionMatrix = useMemo(() => {
    return buildWeeklyTimetableForSection(assignments, selectedSection);
  }, [assignments, selectedSection]);

  const teacherMatrix = useMemo(() => {
    return buildWeeklyTimetableForTeacher(assignments, selectedTeacher);
  }, [assignments, selectedTeacher]);

  const masterTeachersMatrix = useMemo(() => {
    const map: { [teacherName: string]: { [day: string]: { [period: number]: ScheduleAssignment | null } } } = {};
    availableScheduleTeachers.forEach((tName) => {
      map[tName] = buildWeeklyTimetableForTeacher(assignments, tName);
    });
    return map;
  }, [assignments, availableScheduleTeachers]);

  // Handle saving phone number for a teacher
  const handleSavePhone = (scheduleName: string, rosterTeacherId?: string) => {
    const trimmed = editPhoneValue.trim();
    if (!trimmed) return;

    let updated = false;
    let newTeachersList: Teacher[] = [];

    if (rosterTeacherId) {
      newTeachersList = localTeachers.map((t) => {
        if (t.id === rosterTeacherId) {
          updated = true;
          return { ...t, phone: trimmed };
        }
        return t;
      });
    } else {
      // Find matching teacher by schedule name
      const matched = matchTeacherInRoster(scheduleName, localTeachers);
      if (matched) {
        newTeachersList = localTeachers.map((t) => {
          if (t.id === matched.id) {
            updated = true;
            return { ...t, phone: trimmed };
          }
          return t;
        });
      } else {
        // Add as new teacher to roster
        const newTeacher: Teacher = {
          id: `teach_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: scheduleName,
          phone: trimmed,
          subject: "عام",
          specialty: "عام",
        };
        newTeachersList = [newTeacher, ...localTeachers];
        updated = true;
      }
    }

    if (updated) {
      setLocalTeachers(newTeachersList);
      if (onUpdateTeachers) {
        onUpdateTeachers(newTeachersList);
      }
    }

    setEditingTeacherScheduleName(null);
    setEditPhoneValue("");
  };

  const handleConfirm = () => {
    onConfirmSchedule(assignments, localTeachers);
    onClose();
  };

  return (
    <div
      id="schedule-preview-workbench-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">{title}</h2>
                {isInitialUpload && (
                  <span className="bg-purple-500 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    ملف جديد تم رفعه
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إغلاق المعاينة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compact KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:px-5 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-[10px] font-bold block">المعلمون بالجدول</span>
              <span className="text-base font-black text-slate-900 font-mono leading-none">{totalTeachersCount}</span>
            </div>
            <GraduationCap className="w-4 h-4 text-purple-600" />
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-[10px] font-bold block">الحصص الأسبوعية</span>
              <span className="text-base font-black text-slate-900 font-mono leading-none">{totalAssignmentsCount}</span>
            </div>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-[10px] font-bold block">الشعب والفصول</span>
              <span className="text-base font-black text-slate-900 font-mono leading-none">{totalSectionsCount}</span>
            </div>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-500 text-[10px] font-bold block">جاهزية أرقام الجوال</span>
              <div className="text-base font-black text-emerald-600 font-mono flex items-center gap-1 leading-none">
                <span>{teachersWithPhoneCount}</span>
                <span className="text-[10px] text-slate-400 font-normal">/ {totalTeachersCount}</span>
              </div>
            </div>
            <Phone className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="px-5 pt-3 bg-white flex items-center justify-between border-b border-slate-200/80 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "matrix"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>مصفوفة جدول الحصص الأسبوعي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("matching")}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "matching"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>كشف التعرف والمطابقة مع كشف المعلمين</span>
              {teachersNeedPhoneCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {teachersNeedPhoneCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === "matrix" && (
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs text-slate-500 font-bold">طريقة العرض:</span>
              <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode("section")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === "section"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  حسب الشعبة
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("teacher")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === "teacher"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  حسب المعلم
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("all_teachers")}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    viewMode === "all_teachers"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  الجدول العام الشامل
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === "matrix" ? (
            <div className="space-y-4">
              {/* Selector Bar */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {viewMode === "section" && (
                    <>
                      <span className="text-xs font-bold text-slate-700">اختر الشعبة للمعاينة:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {availableSections.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setSelectedSection(sec)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              selectedSection === sec
                                ? "bg-purple-600 text-white shadow-2xs"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {sec}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {viewMode === "teacher" && (
                    <>
                      <span className="text-xs font-bold text-slate-700">اختر المعلم لعرض جدوله:</span>
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        {availableScheduleTeachers.map((tch) => (
                          <option key={tch} value={tch}>
                            {tch}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {viewMode === "all_teachers" && (
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      <span>الجدول المدرسي العام الشامل لجميع معلمي المدرسة وأيام الأسبوع والحصص كاملاً</span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  {viewMode === "section" && `جدول الحصص الأسبوعي لـ (${selectedSection})`}
                  {viewMode === "teacher" && `جدول الحصص الأسبوعي للمعلم (${selectedTeacher})`}
                  {viewMode === "all_teachers" && `إجمالي ${availableScheduleTeachers.length} معلماً - 32 حصة أسبوعية (الأحد والاثنين 7 حصص، ومن الثلاثاء إلى الخميس 6 حصص)`}
                </div>
              </div>

              {/* Master Matrix for All Teachers */}
              {viewMode === "all_teachers" ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-right text-xs border-collapse min-w-[1100px]">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-slate-900 text-white font-bold text-center">
                        <th rowSpan={2} className="p-3 w-44 border-b border-l border-slate-800 sticky right-0 bg-slate-900 z-30 shadow-xs">
                          المعلم
                        </th>
                        {SCHOOL_WEEK_DAYS.map((day) => {
                          const periods = getPeriodsForDay(day);
                          return (
                            <th
                              key={day}
                              colSpan={periods.length}
                              className="p-2 border-b border-l border-slate-800 bg-slate-800/95 text-purple-300 font-black text-xs"
                            >
                              {day} ({periods.length} حصص)
                            </th>
                          );
                        })}
                      </tr>
                      <tr className="bg-slate-800 text-slate-300 font-bold text-center text-[10px]">
                        {SCHOOL_WEEK_DAYS.map((day) =>
                          getPeriodsForDay(day).map((p) => (
                            <th key={`${day}_${p}`} className="p-1.5 border-b border-l border-slate-700 min-w-[70px]">
                              حـ{p}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {availableScheduleTeachers.map((tchName) => {
                        const tchMat = masterTeachersMatrix[tchName] || {};
                        const matchedRoster = matchTeacherInRoster(tchName, localTeachers);
                        return (
                          <tr key={tchName} className="hover:bg-purple-50/20 transition-colors">
                            <td className="p-2.5 font-bold bg-slate-50/95 text-slate-900 border-l border-slate-200 sticky right-0 z-10 shadow-xs">
                              <div className="font-extrabold text-slate-900 text-xs truncate" title={tchName}>
                                {tchName}
                              </div>
                              {matchedRoster?.phone ? (
                                <span className="text-[10px] text-emerald-700 font-mono font-medium block" dir="ltr">
                                  {matchedRoster.phone}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-600 block">بدون جوال</span>
                              )}
                            </td>
                            {SCHOOL_WEEK_DAYS.map((day) =>
                              getPeriodsForDay(day).map((period) => {
                                const asg = tchMat[day]?.[period];
                                return (
                                  <td
                                    key={`${day}_${period}`}
                                    onClick={() => asg && setInspectedCell({ day, period, assignment: asg })}
                                    className={`p-1.5 border-l border-slate-100 align-top text-center transition-colors ${
                                      asg
                                        ? "bg-purple-50/50 hover:bg-purple-100/70 cursor-pointer"
                                        : "bg-white text-slate-200"
                                    }`}
                                  >
                                    {asg ? (
                                      <div className="text-right">
                                        <div className="font-bold text-slate-900 text-[10px] leading-tight truncate" title={asg.subject}>
                                          {asg.subject}
                                        </div>
                                        {asg.section && (
                                          <div className="text-[9px] font-black text-purple-700 bg-purple-100/80 rounded px-1 py-0.2 mt-0.5 inline-block">
                                            {asg.section}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-200 text-[10px] select-none">—</span>
                                    )}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Matrix Table for Section or Teacher (Days x Periods 1..7) */
                <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-center">
                        <th className="p-3 w-28 border-b border-slate-800">اليوم</th>
                        {SCHOOL_PERIODS.map((p) => (
                          <th key={p} className="p-3 border-b border-slate-800">
                            <span>الحصة {p}</span>
                            {p === 7 && (
                              <span className="block text-[9px] text-purple-300 font-normal">
                                (الأحد والاثنين فقط)
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {SCHOOL_WEEK_DAYS.map((day) => (
                        <tr key={day} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-extrabold bg-slate-50 text-slate-900 text-center border-l border-slate-200">
                            <div>{day}</div>
                            <div className="text-[10px] font-medium text-slate-400">
                              {getPeriodsForDay(day).length} حصص
                            </div>
                          </td>
                          {SCHOOL_PERIODS.map((period) => {
                            const isValidPeriod = isPeriodValidForDay(day, period);
                            if (!isValidPeriod) {
                              return (
                                <td
                                  key={period}
                                  className="p-2.5 border-l border-slate-100 align-middle text-center bg-slate-50/80 text-slate-400 select-none cursor-not-allowed"
                                  title="لا توجد حصة سابعة في هذا اليوم (نهاية الدوام 6 حصص فقط)"
                                >
                                  <div className="flex flex-col items-center justify-center py-2 opacity-60">
                                    <span className="text-[10px] font-bold text-slate-400">لا توجد حصة</span>
                                    <span className="text-[9px] text-slate-400 font-medium">(نهاية الدوام 6 حصص)</span>
                                  </div>
                                </td>
                              );
                            }

                            const asg =
                              viewMode === "section"
                                ? sectionMatrix[day]?.[period]
                                : teacherMatrix[day]?.[period];

                            const matchedRosterTeacher = asg
                              ? matchTeacherInRoster(asg.teacherName, localTeachers)
                              : null;
                            const hasPhone = !!matchedRosterTeacher?.phone;

                            return (
                              <td
                                key={period}
                                onClick={() => asg && setInspectedCell({ day, period, assignment: asg })}
                                className={`p-2.5 border-l border-slate-100 align-top transition-all ${
                                  asg
                                    ? "bg-purple-50/40 hover:bg-purple-100/50 cursor-pointer"
                                    : "bg-white text-slate-300 text-center"
                                }`}
                              >
                                {asg ? (
                                  <div className="space-y-1">
                                    <div className="font-extrabold text-slate-900 text-[11px] leading-tight">
                                      {asg.subject}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                      <GraduationCap className="w-3 h-3 text-purple-600 shrink-0" />
                                      <span className="truncate">{asg.teacherName}</span>
                                    </div>
                                    {viewMode === "teacher" && asg.section && (
                                      <span className="inline-block bg-white text-emerald-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                                        {asg.section}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1 mt-0.5">
                                      {hasPhone ? (
                                        <span
                                          className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 font-mono font-bold flex items-center gap-0.5"
                                          title={`الجوال: ${matchedRosterTeacher?.phone}`}
                                        >
                                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                                          واتساب
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-bold">
                                          بدون جوال
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 select-none text-[11px]">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Inspected Cell Popover */}
              {inspectedCell && (
                <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                      <span>تفاصيل حصة: {inspectedCell.day} - الحصة {inspectedCell.period}</span>
                      <span className="bg-purple-200 text-purple-900 px-2 py-0.5 rounded text-[10px] font-bold">
                        {inspectedCell.assignment.subject}
                      </span>
                    </div>
                    <div className="text-xs text-slate-700">
                      <strong>اسم المعلم بالجدول:</strong> {inspectedCell.assignment.teacherName}
                    </div>
                    {(() => {
                      const matched = matchTeacherInRoster(
                        inspectedCell.assignment.teacherName,
                        localTeachers
                      );
                      return (
                        <div className="text-[11px] text-slate-600 flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>كشف المعلمين:</strong>{" "}
                            {matched ? matched.name : "غير مطابق بعد"}
                          </span>
                          <span>
                            <strong>التخصص:</strong>{" "}
                            {matched?.subjectSpecialty || matched?.specialty || inspectedCell.assignment.subject}
                          </span>
                          <span>
                            <strong>الجوال:</strong>{" "}
                            {matched?.phone ? (
                              <span className="font-mono font-bold text-emerald-700" dir="ltr">
                                {matched.phone}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold">غير متوفر</span>
                            )}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectedCell(null)}
                    className="p-1.5 rounded-lg bg-white text-slate-400 hover:text-slate-700 text-xs border border-purple-200 cursor-pointer"
                  >
                    إغلاق التفاصيل
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Cross-Matching Table */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-xs font-black text-slate-900">
                    كشف المعلمين المتعرف عليهم من الجدول المدرسي ومطابقتهم مع كشف الأسماء
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    يمكنك تعديل أو إدخال رقم الجوال لأي معلم هنا وسوف يتم حفظه فوراً في كشف المعلمين.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={matchingSearch}
                    onChange={(e) => setMatchingSearch(e.target.value)}
                    placeholder="ابحث بالاسم، التخصص، الشعبة..."
                    className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
                <table className="w-full text-right text-xs divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold">
                      <th className="p-3 rounded-r-xl">م</th>
                      <th className="p-3">اسم المعلم المدون بالجدول المدرسي</th>
                      <th className="p-3">المطابق في كشف المعلمين</th>
                      <th className="p-3">التخصص ومجال التدريس</th>
                      <th className="p-3">الشعب المسندة بالجدول</th>
                      <th className="p-3">رقم الجوال (لإرسال الاستعلام)</th>
                      <th className="p-3 rounded-l-xl text-center">حالة الجاهزية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {crossMatchingList
                      .filter((t) => {
                        if (!matchingSearch) return true;
                        const term = matchingSearch.toLowerCase();
                        return (
                          t.scheduleName.toLowerCase().includes(term) ||
                          t.rosterName?.toLowerCase().includes(term) ||
                          t.specialty.toLowerCase().includes(term) ||
                          t.uniqueSections.some((sec) => sec.toLowerCase().includes(term)) ||
                          t.phone.includes(term)
                        );
                      })
                      .map((t, idx) => {
                        const isEditingPhone = editingTeacherScheduleName === t.scheduleName;

                        return (
                          <tr key={t.scheduleName} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                                <span>{t.scheduleName}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              {t.rosterName ? (
                                <span className="text-slate-800 font-bold">{t.rosterName}</span>
                              ) : (
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                                  غير مسجل بكشف المعلمين
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                                {t.specialty}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {t.uniqueSections.map((sec, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                  >
                                    {sec}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 min-w-[180px]">
                              {isEditingPhone ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={editPhoneValue}
                                    onChange={(e) => setEditPhoneValue(e.target.value)}
                                    placeholder="05XXXXXXXX"
                                    dir="ltr"
                                    className="w-28 px-2 py-1 bg-white border border-purple-400 rounded-lg text-xs font-mono focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSavePhone(t.scheduleName, t.teacherObj?.id)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                  >
                                    حفظ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTeacherScheduleName(null)}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] cursor-pointer"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  {t.phone ? (
                                    <span
                                      className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs"
                                      dir="ltr"
                                    >
                                      {t.phone}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-amber-700 italic">لا يوجد رقم</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTeacherScheduleName(t.scheduleName);
                                      setEditPhoneValue(t.phone);
                                    }}
                                    className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors cursor-pointer"
                                    title="تعديل أو إدخال رقم الجوال"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {t.hasPhone ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  جاهز للاستعلام
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  يحتاج رقم جوال
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            عند الاستعلام عن أي طالب، سيظهر اسم المعلم المدون بالجدول المدرسي مباشرة مع رقم جواله وتخصصه.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="py-2.5 px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>اعتماد وتأكيد جدول الحصص المدرسي</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
