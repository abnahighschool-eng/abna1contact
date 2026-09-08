import React, { useState, useMemo } from "react";
import {
  Users,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Printer,
  FileSpreadsheet,
  Upload,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  ShieldCheck,
  GraduationCap,
  Award,
  Check,
  X,
  Eye,
  Plus,
  Edit3,
  Layers,
  BookOpen,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  CalendarDays
} from "lucide-react";
import {
  Student,
  Teacher,
  ScheduleAssignment,
  SchoolSignatories,
} from "../types";
import SchedulePreviewWorkbench from "./SchedulePreviewWorkbench";
import {
  parseTeachersExcelFile,
  parseScheduleExcelFile,
  formatStandardSectionName,
  matchTeacherInRoster,
  isNonAcademicDuty,
  buildWeeklyTimetableForSection,
  SCHOOL_WEEK_DAYS,
  SCHOOL_PERIODS,
  isPeriodValidForDay,
  getPeriodsForDay,
  extractIntegratedTeachersRegistry,
  IntegratedTeacherRecord,
  normalizeArabicText,
} from "../utils/teachersScheduleParser";

interface TeachersScheduleManagerProps {
  teachers: Teacher[];
  scheduleAssignments: ScheduleAssignment[];
  students: Student[];
  onUpdateTeachers: (teachers: Teacher[]) => void;
  onUpdateSchedule: (schedule: ScheduleAssignment[]) => void;
  schoolSignatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToInquiry?: () => void;
  onNavigateToMessages?: () => void;
}

export default function TeachersScheduleManager({
  teachers,
  scheduleAssignments,
  students,
  onUpdateTeachers,
  onUpdateSchedule,
  schoolSignatories,
  isWhatsAppConnected,
  onNavigateToInquiry,
  onNavigateToMessages,
}: TeachersScheduleManagerProps) {
  // Search & Filter state
  const [teachersSearchTerm, setTeachersSearchTerm] = useState("");
  const [teachersFilterTab, setTeachersFilterTab] = useState<"all" | "complete" | "needs_phone" | "no_schedule">("all");

  // File Upload states
  const [uploadingTeachers, setUploadingTeachers] = useState(false);
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals for adding & editing teachers
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState({
    name: "",
    subject: "",
    phone: "",
    assignedSubjects: "",
    assignedSections: "",
  });

  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingTeacherData, setEditingTeacherData] = useState<{
    name: string;
    phone: string;
    subject: string;
  }>({
    name: "",
    phone: "",
    subject: "",
  });

  // Modal for Teacher Schedule Assignments & Subjects
  const [managingScheduleTeacher, setManagingScheduleTeacher] = useState<Teacher | null>(null);
  const [newAssignmentSubject, setNewAssignmentSubject] = useState("");
  const [newAssignmentSection, setNewAssignmentSection] = useState("");

  // Teacher timetable view modal
  const [selectedTeacherForSchedule, setSelectedTeacherForSchedule] = useState<Teacher | null>(null);

  // Interactive Schedule Preview Workbench State
  const [showScheduleWorkbench, setShowScheduleWorkbench] = useState(false);
  const [workbenchAssignments, setWorkbenchAssignments] = useState<ScheduleAssignment[]>([]);
  const [workbenchDetectedTeachers, setWorkbenchDetectedTeachers] = useState<string[]>([]);
  const [workbenchDetectedSections, setWorkbenchDetectedSections] = useState<string[]>([]);
  const [workbenchDefaultSection, setWorkbenchDefaultSection] = useState<string | undefined>(undefined);
  const [workbenchDefaultTeacher, setWorkbenchDefaultTeacher] = useState<string | undefined>(undefined);
  const [isWorkbenchInitialUpload, setIsWorkbenchInitialUpload] = useState(false);

  // Official Print Registry Modal
  const [showPrintRegistryModal, setShowPrintRegistryModal] = useState(false);

  // In-page student timetable view toggle
  const [showInPageStudentTimetable, setShowInPageStudentTimetable] = useState(false);
  const [selectedPreviewSection, setSelectedPreviewSection] = useState<string>("");

  // Extract unique sections from students & schedule (strictly excluding teacher quota numbers 12/18)
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    students.forEach((s) => {
      const sec = s.className || (s as any)["الشعبة"] || (s as any)["الفصل"];
      if (sec) {
        const std = formatStandardSectionName(sec);
        if (std !== "شعبة 12" && std !== "شعبة 18" && std !== "12" && std !== "18") {
          sections.add(std);
        }
      }
    });
    scheduleAssignments.forEach((a) => {
      if (a.section && !a.id?.includes("_34_")) {
        const std = formatStandardSectionName(a.section);
        if (std !== "شعبة 12" && std !== "شعبة 18" && std !== "12" && std !== "18") {
          sections.add(std);
        }
      }
    });
    return Array.from(sections).sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  }, [students, scheduleAssignments]);

  // Integrated Teachers Registry (Combining Roster & Timetable)
  const integratedTeachersRegistry = useMemo(() => {
    return extractIntegratedTeachersRegistry(teachers, scheduleAssignments);
  }, [teachers, scheduleAssignments]);

  // Filtered Integrated Teachers for Registry Table
  const filteredIntegratedTeachers = useMemo(() => {
    const term = teachersSearchTerm.trim().toLowerCase();
    const cleanTerm = normalizeArabicText(term);

    return integratedTeachersRegistry.filter((rec) => {
      // 1. Tab filter
      if (teachersFilterTab === "complete") {
        if (!rec.phone || rec.assignedSubjects.length === 0) return false;
      } else if (teachersFilterTab === "needs_phone") {
        if (rec.phone) return false;
      } else if (teachersFilterTab === "no_schedule") {
        if (rec.assignedSubjects.length > 0) return false;
      }

      // 2. Search term filter
      if (!term) return true;

      const normName = normalizeArabicText(rec.name);
      const normSchedName = normalizeArabicText(rec.scheduleName || "");
      const normSpecialty = normalizeArabicText(rec.specialty || "");
      const normPhone = (rec.phone || "").replace(/[^0-9]/g, "");
      const cleanPhoneQuery = term.replace(/[^0-9]/g, "");

      const matchesName = normName.includes(cleanTerm) || normSchedName.includes(cleanTerm);
      const matchesSpecialty = normSpecialty.includes(cleanTerm);
      const matchesPhone = cleanPhoneQuery ? normPhone.includes(cleanPhoneQuery) : false;
      const matchesSubject = rec.assignedSubjects.some((s) => normalizeArabicText(s).includes(cleanTerm));
      const matchesSection = rec.assignedSections.some((sec) => normalizeArabicText(sec).includes(cleanTerm));

      return matchesName || matchesSpecialty || matchesPhone || matchesSubject || matchesSection;
    });
  }, [integratedTeachersRegistry, teachersSearchTerm, teachersFilterTab]);

  // Integrated Registry KPI Statistics
  const totalIntegratedTeachers = integratedTeachersRegistry.length;
  const countComplete = integratedTeachersRegistry.filter((r) => r.phone && r.assignedSubjects.length > 0).length;
  const countNeedsPhone = integratedTeachersRegistry.filter((r) => !r.phone).length;
  const countNoSchedule = integratedTeachersRegistry.filter((r) => r.assignedSubjects.length === 0).length;
  const totalPeriodsQuota = useMemo(() => {
    return integratedTeachersRegistry.reduce((acc, r) => acc + (r.totalPeriodsCount || 0), 0);
  }, [integratedTeachersRegistry]);

  // ----------------------------------------------------
  // Handlers for File Uploads & Updates
  // ----------------------------------------------------

  // Upload Teachers Excel file
  const handleUploadTeachersFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingTeachers(true);
      setUploadMessage(null);
      const result = await parseTeachersExcelFile(file);
      
      if (result.teachers.length === 0) {
        throw new Error(result.error || "لم يتم العثور على بيانات معلمين صالحة في الملف");
      }

      onUpdateTeachers(result.teachers);

      // Save to server
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: result.teachers }),
      });

      setUploadMessage({
        type: "success",
        text: `تم استيراد ${result.teachers.length} معلماً بنجاح من كشف المعلمين.`,
      });
    } catch (err: any) {
      setUploadMessage({ type: "error", text: err.message || "فشل استيراد ملف المعلمين" });
    } finally {
      setUploadingTeachers(false);
      e.target.value = "";
    }
  };

  // Upload Schedule Excel file
  const handleUploadScheduleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingSchedule(true);
      setUploadMessage(null);
      const result = await parseScheduleExcelFile(file);

      if (result.assignments.length === 0) {
        throw new Error(result.error || "لم يتم العثور على حصص وتوزيع مواد في الجدول المدرسي");
      }

      // Automatically open the Schedule Preview Workbench so the user can interact, verify, and confirm
      setWorkbenchAssignments(result.assignments);
      setWorkbenchDetectedTeachers(result.detectedTeachers || []);
      setWorkbenchDetectedSections(result.detectedSections || []);
      setWorkbenchDefaultSection(result.detectedSections?.[0] || undefined);
      setIsWorkbenchInitialUpload(true);
      setShowScheduleWorkbench(true);

      setUploadMessage({
        type: "success",
        text: `تم استخراج ${result.assignments.length} حصة وارتباط بالجدول. تم فتح فنية المعاينة والتفاعل لمراجعة وتأكيد البيانات.`,
      });
    } catch (err: any) {
      setUploadMessage({ type: "error", text: err.message || "فشل استيراد الجدول المدرسي" });
    } finally {
      setUploadingSchedule(false);
      e.target.value = "";
    }
  };

  // Confirm schedule changes from the Interactive Workbench
  const handleConfirmScheduleFromWorkbench = async (
    confirmedAssignments: ScheduleAssignment[],
    updatedTeachers?: Teacher[]
  ) => {
    onUpdateSchedule(confirmedAssignments);

    if (updatedTeachers && updatedTeachers.length > 0) {
      onUpdateTeachers(updatedTeachers);
      try {
        await fetch("/api/teachers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teachers: updatedTeachers }),
        });
      } catch (e) {
        console.error("Failed to save updated teachers", e);
      }
    }

    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: confirmedAssignments }),
      });
    } catch (e) {
      console.error("Failed to save schedule assignments", e);
    }

    setUploadMessage({
      type: "success",
      text: `تم اعتماد وتأكيد ${confirmedAssignments.length} حصة وارتباط في الجدول المدرسي بنجاح.`,
    });
  };

  // Add Manual Teacher (with optional assigned subjects and sections)
  const handleAddManualTeacher = async () => {
    if (!newTeacherData.name.trim() || !newTeacherData.phone.trim()) {
      alert("يرجى إدخال اسم المعلم ورقم جواله");
      return;
    }

    const newTeacher: Teacher = {
      id: `teach_${Date.now()}`,
      name: newTeacherData.name.trim(),
      phone: newTeacherData.phone.trim(),
      subject: newTeacherData.subject.trim() || "عام",
      specialty: newTeacherData.subject.trim() || "عام",
    };

    const updated = [newTeacher, ...teachers];
    onUpdateTeachers(updated);

    await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teachers: updated }),
    });

    // If subjects and sections were also specified, create schedule assignments immediately
    const rawSubjects = newTeacherData.assignedSubjects.split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean);
    const rawSections = newTeacherData.assignedSections.split(/[,،\n]+/).map((s) => s.trim()).filter(Boolean);

    if (rawSubjects.length > 0 || rawSections.length > 0) {
      const newAssignments: ScheduleAssignment[] = [];
      const subjectsList = rawSubjects.length > 0 ? rawSubjects : [newTeacherData.subject.trim() || "عام"];
      const sectionsList = rawSections.length > 0 ? rawSections : ["عام"];

      for (const subj of subjectsList) {
        for (const sec of sectionsList) {
          let formattedSec = sec;
          if (/^\d+$/.test(formattedSec)) {
            formattedSec = `شعبة ${formattedSec}`;
          }
          newAssignments.push({
            id: `asg_manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            teacherName: newTeacher.name,
            subject: subj,
            section: formattedSec,
          });
        }
      }

      const updatedSchedule = [...scheduleAssignments, ...newAssignments];
      onUpdateSchedule(updatedSchedule);

      try {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments: updatedSchedule }),
        });
      } catch {}
    }

    setNewTeacherData({
      name: "",
      subject: "",
      phone: "",
      assignedSubjects: "",
      assignedSections: "",
    });
    setShowAddTeacherModal(false);
  };

  // Add individual assignment to teacher
  const handleAddTeacherAssignment = async (teacherName: string) => {
    if (!newAssignmentSubject.trim() && !newAssignmentSection.trim()) {
      alert("يرجى كتابة اسم المادة أو الشعبة");
      return;
    }

    let sec = newAssignmentSection.trim() || "عام";
    if (/^\d+$/.test(sec)) {
      sec = `شعبة ${sec}`;
    }

    const newAsg: ScheduleAssignment = {
      id: `asg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      teacherName: teacherName,
      subject: newAssignmentSubject.trim() || "المادة المقررة",
      section: sec,
    };

    const updated = [...scheduleAssignments, newAsg];
    onUpdateSchedule(updated);

    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: updated }),
      });
    } catch {}

    setNewAssignmentSubject("");
    setNewAssignmentSection("");
  };

  // Delete individual assignment from teacher
  const handleDeleteTeacherAssignment = async (assignmentId: string) => {
    const updated = scheduleAssignments.filter((a) => a.id !== assignmentId);
    onUpdateSchedule(updated);

    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: updated }),
      });
    } catch {}
  };

  // Open Edit Teacher Modal
  const handleOpenEditTeacherModal = (teacher: Teacher | IntegratedTeacherRecord) => {
    const teacherObj: Teacher = {
      id: teacher.id,
      name: teacher.name,
      phone: teacher.phone || "",
      subject: (teacher as any).specialty || (teacher as any).subject || "",
      specialty: (teacher as any).specialty || (teacher as any).subject || "",
      subjectSpecialty: (teacher as any).specialty || (teacher as any).subject || "",
    };
    setEditingTeacher(teacherObj);
    setEditingTeacherData({
      name: teacherObj.name,
      phone: teacherObj.phone || "",
      subject: teacherObj.subject || teacherObj.specialty || "",
    });
  };

  // Save Edit Teacher
  const handleSaveEditTeacher = async () => {
    if (!editingTeacher) return;
    if (!editingTeacherData.name.trim()) {
      alert("يرجى إدخال اسم المعلم");
      return;
    }

    const oldName = editingTeacher.name;
    const newName = editingTeacherData.name.trim();

    // 1. Update teacher in teachers roster
    let teacherFound = false;
    const updatedTeachers = teachers.map((t) => {
      if (t.id === editingTeacher.id || t.name === oldName) {
        teacherFound = true;
        return {
          ...t,
          name: newName,
          phone: editingTeacherData.phone.trim(),
          subject: editingTeacherData.subject.trim(),
          specialty: editingTeacherData.subject.trim(),
        };
      }
      return t;
    });

    // If this teacher was originated from schedule only and not in roster yet, add them to roster
    if (!teacherFound) {
      updatedTeachers.push({
        id: editingTeacher.id || `teach_${Date.now()}`,
        name: newName,
        phone: editingTeacherData.phone.trim(),
        subject: editingTeacherData.subject.trim(),
        specialty: editingTeacherData.subject.trim(),
      });
    }

    onUpdateTeachers(updatedTeachers);

    // 2. If name changed, also update all corresponding schedule assignments
    if (oldName !== newName) {
      const updatedSchedule = scheduleAssignments.map((a) => {
        if (a.teacherName === oldName) {
          return { ...a, teacherName: newName, teacherPhone: editingTeacherData.phone.trim() };
        }
        return a;
      });
      onUpdateSchedule(updatedSchedule);

      try {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments: updatedSchedule }),
        });
      } catch {}
    }

    // Save teachers to server
    try {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: updatedTeachers }),
      });
    } catch {}

    setEditingTeacher(null);
  };

  // Open Teacher Timetable directly in SchedulePreviewWorkbench
  const handleOpenTeacherTimetable = (teacherName: string) => {
    setWorkbenchDefaultTeacher(teacherName);
    setWorkbenchAssignments(scheduleAssignments);
    setWorkbenchDetectedSections(availableSections);
    setIsWorkbenchInitialUpload(false);
    setShowScheduleWorkbench(true);
  };

  // Delete Teacher from integrated registry (both roster and schedule)
  const handleDeleteIntegratedTeacher = async (record: IntegratedTeacherRecord) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف المعلم (${record.name}) من السجل؟`)) return;

    // 1. Remove from teachers roster
    const updatedTeachers = teachers.filter((t) => {
      const matchesExact = t.id === record.id || t.name === record.name;
      const matchesSchedule = record.scheduleName && t.name === record.scheduleName;
      return !matchesExact && !matchesSchedule;
    });
    onUpdateTeachers(updatedTeachers);

    // 2. Remove from schedule assignments
    const updatedSchedule = scheduleAssignments.filter((a) => {
      const matchesExact = a.teacherName === record.name;
      const matchesSchedule = record.scheduleName && a.teacherName === record.scheduleName;
      return !matchesExact && !matchesSchedule;
    });
    onUpdateSchedule(updatedSchedule);

    try {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: updatedTeachers }),
      });
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: updatedSchedule }),
      });
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="teachers-schedule-manager-view">

      {/* Main Section Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>الإدارة الأكاديمية والمدرسية</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              الجدول المدرسي وكشف المعلمين
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
              منظومة متكاملة لربط كشوف المعلمين بالجدول الأسبوعي، ومتابعة أنصبة الحصص والشعب المعتمدة، مع المعاينة التفاعلية والطباعة الرسمية.
            </p>
          </div>

          {/* Quick Header Badges & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPrintRegistryModal(true)}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>طباعة الكشف المعتمد</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkbenchAssignments(scheduleAssignments);
                setWorkbenchDetectedSections(availableSections);
                setIsWorkbenchInitialUpload(false);
                setShowScheduleWorkbench(true);
              }}
              className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <Eye className="w-4 h-4" />
              <span>المعاينة التفاعلية للجدول</span>
            </button>

            {onNavigateToInquiry && (
              <button
                type="button"
                onClick={onNavigateToInquiry}
                className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                title="الانتقال إلى إرسال استعلام لمعلمي الطلاب"
              >
                <Award className="w-4 h-4 text-emerald-600" />
                <span>الاستعلام عن طالب ⬅</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Summary Metric Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="text-[11px] text-slate-400 font-bold">إجمالي المعلمين بالسجل</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {totalIntegratedTeachers} <span className="text-xs font-normal text-slate-400">معلماً</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
            <div className="text-[11px] text-emerald-700 font-bold">مكتمل الربط (هاتف + جدول)</div>
            <div className="text-xl font-black text-emerald-800 mt-1">
              {countComplete} <span className="text-xs font-normal text-emerald-600">معلماً</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80">
            <div className="text-[11px] text-amber-700 font-bold">ينقصه رقم هاتف</div>
            <div className="text-xl font-black text-amber-800 mt-1">
              {countNeedsPhone} <span className="text-xs font-normal text-amber-600">معلماً</span>
            </div>
          </div>

          <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-200/80">
            <div className="text-[11px] text-purple-700 font-bold">إجمالي الحصص المسندة</div>
            <div className="text-xl font-black text-purple-800 mt-1">
              {totalPeriodsQuota} <span className="text-xs font-normal text-purple-600">حصة أسبوعية</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Status Banner */}
      {uploadMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold shadow-xs ${
            uploadMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{uploadMessage.text}</span>
          </div>
          <button
            onClick={() => setUploadMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* 1. Upload Teachers Excel Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">كشف أسماء المعلمين والهواتف</h3>
              <p className="text-xs text-slate-400">ملف إكسل يتضمن: اسم المعلم، مجال التدريس (التخصص)، ورقم الجوال</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800">الأعمدة المطلوبة في الإكسل:</div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">اسم المعلم</span>
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">مجال التدريس / التخصص</span>
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">رقم الجوال</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
              {uploadingTeachers ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>جاري القراءة والمعالجة...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>رفع كشف المعلمين (Excel)</span>
                </>
              )}
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadTeachersFile}
                className="hidden"
                disabled={uploadingTeachers}
              />
            </label>

            <button
              type="button"
              onClick={() => setShowAddTeacherModal(true)}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 inline ml-1" />
              <span>إضافة معلم</span>
            </button>
          </div>
        </div>

        {/* 2. Upload School Schedule Matrix Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">جدول الحصص الأسبوعي وتوزيع المواد</h3>
              <p className="text-xs text-slate-400">جدول الحصص المدرسي لربط كل معلم بمادته وشعبه تلقائياً</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800">صيغ الجداول المدعومة:</div>
            <p className="text-[11px] leading-relaxed">
              يدعم النظام الذكي قراءة مصفوفة جدول الحصص اليومي، أو الكشوف المسطحة التي تربط (المعلم - المادة - الشعبة - الحصص).
            </p>
          </div>

          <div className="space-y-2">
            <label className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer">
              {uploadingSchedule ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>جاري استخراج وتوزيع الحصص...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>رفع ملف الجدول المدرسي (Excel)</span>
                </>
              )}
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadScheduleFile}
                className="hidden"
                disabled={uploadingSchedule}
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setWorkbenchAssignments(scheduleAssignments);
                setWorkbenchDetectedSections(availableSections);
                setIsWorkbenchInitialUpload(false);
                setShowScheduleWorkbench(true);
              }}
              className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-purple-600" />
              <span>فتح فنية المعاينة والتفاعل لجدول الحصص ({scheduleAssignments.length} حصة مسجلة)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Integrated Teachers & Weekly Schedule Assignments Registry Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-5">
        
        {/* Header & Title */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900">
                سجل المعلمين وتوزيع المواد والشعب المدرسية ({totalIntegratedTeachers} معلماً)
              </h3>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                مستخلص تكاملياً من كشف المعلمين وجدول الحصص
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
              كشف معتمد يجمع اسم المعلم وتخصصه ورقم هاتفه من كشف المعلمين، ويستخلص المقررات والشعب المسندة إليه وأنصبة الحصص من جدول الحصص الأسبوعي.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPrintRegistryModal(true)}
              className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="طباعة كشف توزيع المواد والشعب المعتمد"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الكشف المعتمد</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddTeacherModal(true)}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة معلم جديد</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setTeachersFilterTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teachersFilterTab === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل ({totalIntegratedTeachers})
            </button>

            <button
              type="button"
              onClick={() => setTeachersFilterTab("complete")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teachersFilterTab === "complete"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
              }`}
            >
              مكتمل الربط ({countComplete})
            </button>

            <button
              type="button"
              onClick={() => setTeachersFilterTab("needs_phone")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teachersFilterTab === "needs_phone"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100"
              }`}
            >
              ينقصه رقم هاتف ({countNeedsPhone})
            </button>

            <button
              type="button"
              onClick={() => setTeachersFilterTab("no_schedule")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                teachersFilterTab === "no_schedule"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100"
              }`}
            >
              لم تسند له حصص بالجدول ({countNoSchedule})
            </button>
          </div>

          {/* Search input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={teachersSearchTerm}
              onChange={(e) => setTeachersSearchTerm(e.target.value)}
              placeholder="ابحث بالمعلم، التخصص، المقرر، الشعبة، الهاتف..."
              className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            />
            {teachersSearchTerm && (
              <button
                type="button"
                onClick={() => setTeachersSearchTerm("")}
                className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Teachers Table */}
        {filteredIntegratedTeachers.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
            {teachersSearchTerm || teachersFilterTab !== "all"
              ? "لا توجد نتائج مطابقة لمعايير البحث أو التصفية الحالية."
              : "لم يتم العثور على معلمين. يرجى رفع ملف كشف المعلمين أو جدول الحصص الأسبوعي."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-right text-xs divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold">
                  <th className="p-3 rounded-tr-xl">م</th>
                  <th className="p-3">اسم المعلم</th>
                  <th className="p-3">المجال / التخصص الأساسي (من كشف المعلمين)</th>
                  <th className="p-3">رقم الجوال (من كشف المعلمين)</th>
                  <th className="p-3">المقررات المسندة (من جدول الحصص)</th>
                  <th className="p-3">الشعب المسندة (من جدول الحصص)</th>
                  <th className="p-3 text-center">نصاب الحصص</th>
                  <th className="p-3 rounded-tl-xl text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {filteredIntegratedTeachers.map((record, idx) => {
                  return (
                    <tr key={record.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                      
                      {/* Teacher Name */}
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900 text-sm">{record.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {record.isRegisteredInRoster ? (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              كشف المعلمين
                            </span>
                          ) : (
                            <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/80 flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              مستخلص من الجدول
                            </span>
                          )}
                          {record.scheduleName && record.scheduleName !== record.name && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              (بالجدول: {record.scheduleName})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Specialty / Teaching field */}
                      <td className="p-3">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-bold text-slate-700 inline-block border border-slate-200/60">
                          {record.specialty || "عام"}
                        </span>
                      </td>

                      {/* Mobile Phone from Roster */}
                      <td className="p-3 font-mono" dir="ltr">
                        {record.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 text-[11px] inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {record.phone}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeacherModal(record)}
                            className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="اضغط هنا لإضافة رقم الجوال للمعلم"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>إضافة هاتف</span>
                          </button>
                        )}
                      </td>

                      {/* Assigned Subjects & Quotas from Schedule */}
                      <td className="p-3">
                        {(record.assignedSubjects || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {record.assignedSubjects.map((sub, sIdx) => {
                              const count =
                                record.subjectPeriodCounts?.[sub] ??
                                record.subjectBreakdown?.find((sb) => sb.subject === sub)?.periodsCount;
                              return (
                                <span
                                  key={sIdx}
                                  className="bg-purple-50 text-purple-900 border border-purple-200/90 px-2 py-0.5 rounded-md font-bold text-[11px] flex items-center gap-1"
                                >
                                  <span>{sub}</span>
                                  {count !== undefined && count > 0 && (
                                    <span className="bg-purple-200 text-purple-900 px-1 rounded text-[9px] font-mono">
                                      {count}ح
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">لا توجد مواد مسندة بالجدول</span>
                        )}
                      </td>

                      {/* Assigned Sections from Schedule */}
                      <td className="p-3">
                        {record.assignedSections.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {record.assignedSections.map((sec, secIdx) => (
                              <span
                                key={secIdx}
                                className="bg-blue-50 text-blue-900 border border-blue-200/90 px-2 py-0.5 rounded-md font-bold text-[11px]"
                              >
                                {sec}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Weekly Quota Count */}
                      <td className="p-3 text-center">
                        {record.totalPeriodsCount > 0 ? (
                          <span className="inline-block bg-slate-900 text-white font-mono font-bold px-2 py-1 rounded-lg text-xs">
                            {record.totalPeriodsCount} ح
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Weekly Timetable */}
                          <button
                            type="button"
                            onClick={() => handleOpenTeacherTimetable(record.scheduleName || record.name)}
                            className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                            title="عرض جدول حصص المعلم الأسبوعي"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>

                          {/* Manage Subjects & Sections */}
                          <button
                            type="button"
                            onClick={() => {
                              const matchT = matchTeacherInRoster(record.name, teachers) || {
                                id: record.id,
                                name: record.name,
                                phone: record.phone || "",
                                subject: record.specialty || "عام",
                              };
                              setManagingScheduleTeacher(matchT);
                            }}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            title="إدارة المواد والشعب المسندة للمعلم"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Details (Phone / Specialty) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeacherModal(record)}
                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات المعلم والهاتف والتخصص"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Teacher */}
                          <button
                            type="button"
                            onClick={() => handleDeleteIntegratedTeacher(record)}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="حذف المعلم من السجل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* In-Page Student Timetable Section Preview */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                استعراض جدول الحصص الأسبوعي للشعب والصفوف
              </h3>
              <p className="text-xs text-slate-400">
                عرض مصفوفة جدول الحصص لأي شعبة بالمدرسة وفق التوزيع الأسبوعي للحصص
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedPreviewSection}
              onChange={(e) => {
                setSelectedPreviewSection(e.target.value);
                setShowInPageStudentTimetable(true);
              }}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="">-- اختر الشعبة لعرض جدولها --</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>

            {selectedPreviewSection && (
              <button
                type="button"
                onClick={() => setShowInPageStudentTimetable(!showInPageStudentTimetable)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                {showInPageStudentTimetable ? "إخفاء الجدول" : "إظهار الجدول"}
              </button>
            )}
          </div>
        </div>

        {/* Timetable Matrix */}
        {showInPageStudentTimetable && selectedPreviewSection && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">
                جدول حصص: <span className="font-extrabold text-purple-700 text-sm">{selectedPreviewSection}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                * الحصة السابعة يومي الأحد والاثنين فقط، وبقية الأيام 6 حصص
              </div>
            </div>

            {(() => {
              const weeklyMatrix = buildWeeklyTimetableForSection(scheduleAssignments, selectedPreviewSection);
              return (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold">
                        <th className="p-3 w-28 text-center border-l border-slate-800">اليوم</th>
                        {SCHOOL_PERIODS.map((period) => (
                          <th key={period} className="p-3 text-center border-l border-slate-800 last:border-0">
                            الحصة {period}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {SCHOOL_WEEK_DAYS.map((day) => {
                        return (
                          <tr key={day} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 font-bold text-slate-800 text-center bg-slate-50/80 border-l border-slate-200">
                              {day}
                            </td>
                            {SCHOOL_PERIODS.map((period) => {
                              const isValidPeriod = isPeriodValidForDay(day, period);
                              const assignment = weeklyMatrix[day]?.[period];

                              if (!isValidPeriod) {
                                return (
                                  <td
                                    key={period}
                                    className="p-3 text-center bg-slate-100/50 text-slate-300 text-[10px] border-l border-slate-200 last:border-0"
                                  >
                                    لا يوجد
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={period}
                                  className="p-2.5 text-center border-l border-slate-200 last:border-0"
                                >
                                  {assignment ? (
                                    <div className="space-y-1">
                                      <div className="font-bold text-slate-900 text-xs">{assignment.subject}</div>
                                      <div className="text-[10px] text-purple-700 font-medium">{assignment.teacherName}</div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 text-[11px]">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW TEACHER */}
      {/* ========================================================================= */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">إضافة معلم جديد إلى السجل</h3>
              <button
                onClick={() => setShowAddTeacherModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم المعلم الثلاثي أو الرباعي *</label>
                <input
                  type="text"
                  value={newTeacherData.name}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                  placeholder="مثال: أحمد محمد القحطاني"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">التخصص / مجال التدريس الأساسي</label>
                <input
                  type="text"
                  value={newTeacherData.subject}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, subject: e.target.value })}
                  placeholder="مثال: الرياضيات، الفيزياء، اللغة العربية"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الجوال * (لإرسال الاستعلامات عبر واتساب)</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newTeacherData.phone}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, phone: e.target.value })}
                  placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-right"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المواد المقررة المسندة (اختياري - مفصولة بفواصل)</label>
                <input
                  type="text"
                  value={newTeacherData.assignedSubjects}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, assignedSubjects: e.target.value })}
                  placeholder="مثال: الرياضيات 1، الرياضيات 2"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الشعب المسندة (اختياري - مفصولة بفواصل)</label>
                <input
                  type="text"
                  value={newTeacherData.assignedSections}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, assignedSections: e.target.value })}
                  placeholder="مثال: شعبة 1، شعبة 2، شعبة 3"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddManualTeacher}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                حفظ وإضافة المعلم
              </button>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TEACHER DETAILS */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">تعديل بيانات المعلم</h3>
              <button
                onClick={() => setEditingTeacher(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">اسم المعلم</label>
                <input
                  type="text"
                  value={editingTeacherData.name}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">المجال / التخصص الأساسي</label>
                <input
                  type="text"
                  value={editingTeacherData.subject}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, subject: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">رقم الجوال (لإرسال الاستعلامات عبر واتساب)</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={editingTeacherData.phone}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 text-right"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveEditTeacher}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANAGE TEACHER SCHEDULE ASSIGNMENTS */}
      {/* ========================================================================= */}
      {managingScheduleTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  إدارة المواد والشعب لـ: {managingScheduleTeacher.name}
                </h3>
                <p className="text-xs text-slate-400">إضافة أو حذف ارتباطات المواد والشعب المسندة للمعلم بالجدول</p>
              </div>
              <button
                onClick={() => setManagingScheduleTeacher(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current assignments list */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">المقررات والشعب الحالية المسندة:</div>
              {(() => {
                const currentTeacherAssignments = scheduleAssignments.filter((a) => {
                  return (
                    normalizeArabicText(a.teacherName) === normalizeArabicText(managingScheduleTeacher.name) ||
                    (a.teacherId && a.teacherId === managingScheduleTeacher.id)
                  );
                });

                if (currentTeacherAssignments.length === 0) {
                  return (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
                      لا توجد ارتباطات مسندة لهذا المعلم حالياً. يمكنك إضافة مادة وشعبة بالأسفل.
                    </div>
                  );
                }

                return (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2">
                    {currentTeacherAssignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{asg.subject}</span>
                          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-purple-700 font-bold text-[11px]">
                            {asg.section}
                          </span>
                          {asg.day && asg.period && (
                            <span className="text-[10px] text-slate-400">
                              ({asg.day} - الحصة {asg.period})
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTeacherAssignment(asg.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف الارتباط"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Add new assignment to this teacher */}
            <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200/80 space-y-3">
              <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>إسناد مادة وشعبة جديدة للمعلم</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم المادة / المقرر</label>
                  <input
                    type="text"
                    value={newAssignmentSubject}
                    onChange={(e) => setNewAssignmentSubject(e.target.value)}
                    placeholder="مثال: الكيمياء 2"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الشعبة المسندة</label>
                  <input
                    type="text"
                    value={newAssignmentSection}
                    onChange={(e) => setNewAssignmentSection(e.target.value)}
                    placeholder="مثال: شعبة 1"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddTeacherAssignment(managingScheduleTeacher.name)}
                className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                إضافة الارتباط
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setManagingScheduleTeacher(null)}
                className="py-2 px-5 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-slate-800"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INTERACTIVE SCHEDULE PREVIEW WORKBENCH */}
      {/* ========================================================================= */}
      {showScheduleWorkbench && (
        <SchedulePreviewWorkbench
          isOpen={showScheduleWorkbench}
          onClose={() => setShowScheduleWorkbench(false)}
          assignments={workbenchAssignments.length > 0 ? workbenchAssignments : scheduleAssignments}
          teachers={teachers}
          detectedTeachers={workbenchDetectedTeachers}
          detectedSections={workbenchDetectedSections.length > 0 ? workbenchDetectedSections : availableSections}
          onConfirmSchedule={handleConfirmScheduleFromWorkbench}
          onUpdateTeachers={onUpdateTeachers}
          defaultSelectedSection={workbenchDefaultSection}
          defaultSelectedTeacher={workbenchDefaultTeacher}
          isInitialUpload={isWorkbenchInitialUpload}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT OFFICIAL TEACHERS & SUBJECTS DISTRIBUTION REGISTRY */}
      {/* ========================================================================= */}
      {showPrintRegistryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            
            {/* Modal Actions Header (no-print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 no-print">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    معاينة وطباعة سجل توزيع المواد والشعب المدرسية المعتمد
                  </h3>
                  <p className="text-xs text-slate-400">
                    وثيقة رسمية تتضمن أسماء المعلمين، تخصصاتهم، هواتفهم، المقررات والشعب المسندة، وأنصبتهم
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الكشف الرسمي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintRegistryModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div id="official-teachers-registry-report" className="space-y-6 p-4 sm:p-6 bg-white border border-slate-200 rounded-2xl">
              
              {/* Ministerial Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 text-xs font-bold text-slate-800">
                <div className="space-y-1">
                  <div>{schoolSignatories.countryName || "المملكة العربية السعودية"}</div>
                  <div>{schoolSignatories.ministryName || "وزارة التعليم"}</div>
                  <div>{schoolSignatories.administrationName || "الإدارة العامة للتعليم بمنطقة تبوك"}</div>
                  <div>{schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}</div>
                </div>

                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-800 mx-auto flex items-center justify-center font-black text-sm">
                    تعليم
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">الشؤون التعليمية والمدرسية</div>
                </div>

                <div className="text-left space-y-1" dir="rtl">
                  <div>العام الدراسي: 1447هـ</div>
                  <div>الفصل الدراسي: الثاني</div>
                  <div>التاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1 py-2">
                <h2 className="text-lg font-black text-slate-900">
                  سجل المعلمين وتوزيع المواد والمقررات والشعب المدرسية وأنصبة الحصص
                </h2>
                <p className="text-xs text-slate-500">
                  كشف معتمد يوضح توزيع الهيئة التعليمية، تخصصات التدريس، المواد المقررة، الشعب المسندة، والأنصبة الأسبوعية
                </p>
              </div>

              {/* Summary Strip */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-center font-bold text-slate-800">
                <div>إجمالي المعلمين بالسجل: <span className="font-mono text-slate-900">{totalIntegratedTeachers}</span></div>
                <div>إجمالي الحصص الأسبوعية: <span className="font-mono text-slate-900">{totalPeriodsQuota} حصة</span></div>
                <div>الشعب المشمولة: <span className="font-mono text-slate-900">{availableSections.length} شعبة</span></div>
              </div>

              {/* Official Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                      <th className="p-2.5 border border-slate-300 w-8 text-center">م</th>
                      <th className="p-2.5 border border-slate-300">اسم المعلم</th>
                      <th className="p-2.5 border border-slate-300">التخصص الأساسي</th>
                      <th className="p-2.5 border border-slate-300">المقررات المسندة بالجدول</th>
                      <th className="p-2.5 border border-slate-300">الشعب المسندة</th>
                      <th className="p-2.5 border border-slate-300 text-center w-20">نصاب الحصص</th>
                      <th className="p-2.5 border border-slate-300 text-center" dir="ltr">رقم الجوال</th>
                      <th className="p-2.5 border border-slate-300 w-24 text-center">التوقيع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {integratedTeachersRegistry.map((rec, i) => (
                      <tr key={rec.id || i} className="even:bg-slate-50/50">
                        <td className="p-2 border border-slate-300 font-mono text-center">{i + 1}</td>
                        <td className="p-2 border border-slate-300 font-bold">{rec.name}</td>
                        <td className="p-2 border border-slate-300">{rec.specialty || "عام"}</td>
                        <td className="p-2 border border-slate-300">
                          {rec.assignedSubjects.length > 0 ? rec.assignedSubjects.join("، ") : "—"}
                        </td>
                        <td className="p-2 border border-slate-300">
                          {rec.assignedSections.length > 0 ? rec.assignedSections.join("، ") : "—"}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-center font-bold">
                          {rec.totalPeriodsCount > 0 ? `${rec.totalPeriodsCount} ح` : "—"}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-center text-[11px]" dir="ltr">
                          {rec.phone || "—"}
                        </td>
                        <td className="p-2 border border-slate-300 text-center"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-xs font-bold text-slate-800 text-center">
                <div className="space-y-4">
                  <div>وكيل الشؤون التعليمية والمدرسية</div>
                  <div className="text-slate-400 font-normal">
                    {schoolSignatories.vicePrincipalName || "................................................"}
                  </div>
                  <div>التوقيع: ................................</div>
                </div>

                <div className="space-y-4">
                  <div>مدير المدرسة</div>
                  <div className="text-slate-400 font-normal">
                    {schoolSignatories.principalName || "................................................"}
                  </div>
                  <div>التوقيع والختم: ................................</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
