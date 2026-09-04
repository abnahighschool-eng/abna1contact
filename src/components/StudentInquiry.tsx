import React, { useState, useMemo } from "react";
import {
  UserCheck,
  Search,
  Filter,
  Send,
  Users,
  Calendar,
  CalendarDays,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
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
  CheckCheck
} from "lucide-react";
import {
  Student,
  Teacher,
  ScheduleAssignment,
  TeacherInquiryRequest,
  SchoolSignatories,
  StudentEvaluationItem
} from "../types";
import ConsolidatedStudentReportModal, { AggregatedStudentEvaluation } from "./ConsolidatedStudentReportModal";
import SchedulePreviewWorkbench from "./SchedulePreviewWorkbench";
import {
  parseTeachersExcelFile,
  parseScheduleExcelFile,
  findTeachersForSection,
  findAssignmentsForStudent,
  getTeachersAndSubjectsForSection,
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

interface StudentInquiryProps {
  students: Student[];
  teachers: Teacher[];
  scheduleAssignments: ScheduleAssignment[];
  inquiryRequests: TeacherInquiryRequest[];
  onUpdateTeachers: (teachers: Teacher[]) => void;
  onUpdateSchedule: (schedule: ScheduleAssignment[]) => void;
  onUpdateInquiries: (inquiries: TeacherInquiryRequest[]) => void;
  schoolSignatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToWhatsApp?: () => void;
  onNavigateToTeachersSchedule?: () => void;
}

type TabType = "new_inquiry" | "inquiries_log" | "consolidated_reports" | "teachers_schedule";

// Candidate Teacher Assignment
interface CandidateTeacher {
  key: string;
  teacherId?: string;
  teacherName: string; // The teacher's name as recorded in the timetable schedule
  rosterName?: string; // The matched teacher name in the teachers roster
  teacherPhone: string; // Extracted phone from teacher roster
  subject: string; // Subject from schedule
  specialty?: string; // Specialty extracted from teacher roster
  section: string; // Section
  grade?: string;
  isMatchedInRoster?: boolean;
}

export default function StudentInquiry({
  students,
  teachers,
  scheduleAssignments,
  inquiryRequests,
  onUpdateTeachers,
  onUpdateSchedule,
  onUpdateInquiries,
  schoolSignatories,
  isWhatsAppConnected,
  onNavigateToWhatsApp,
  onNavigateToTeachersSchedule
}: StudentInquiryProps) {
  const [activeTab, setActiveTab] = useState<TabType>("new_inquiry");

  // --- 1. NEW INQUIRY STATE ---
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // Teachers candidate list & selected keys
  const [candidateTeachers, setCandidateTeachers] = useState<CandidateTeacher[]>([]);
  const [selectedTeacherKeys, setSelectedTeacherKeys] = useState<string[]>([]);

  // Inline edit teacher phone in Step 2
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const [inlinePhoneValue, setInlinePhoneValue] = useState<string>("");

  // Add extra teacher to step 2
  const [showAddExtraTeacherModal, setShowAddExtraTeacherModal] = useState(false);
  const [selectedExtraTeacherId, setSelectedExtraTeacherId] = useState("");
  const [extraTeacherSubject, setExtraTeacherSubject] = useState("");

  const [sendingInquiries, setSendingInquiries] = useState(false);
  const [inquirySuccessBanner, setInquirySuccessBanner] = useState<string | null>(null);

  // --- 2. INQUIRIES LOG STATE ---
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");
  const [inquiryDateFilter, setInquiryDateFilter] = useState<string>("");
  const [viewingInquiryModal, setViewingInquiryModal] = useState<TeacherInquiryRequest | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isRefreshingInquiries, setIsRefreshingInquiries] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("");

  // --- 3. CONSOLIDATED STUDENT REPORTS STATE ---
  const [consolidatedSearchTerm, setConsolidatedSearchTerm] = useState("");
  const [consolidatedStatusFilter, setConsolidatedStatusFilter] = useState<"all" | "completed" | "partial" | "pending">("all");
  const [consolidatedDateFilter, setConsolidatedDateFilter] = useState<string>("");
  const [viewingConsolidatedModal, setViewingConsolidatedModal] = useState<AggregatedStudentEvaluation | null>(null);

  // --- 4. TEACHERS & SCHEDULE STATE ---
  const [teachersSearchTerm, setTeachersSearchTerm] = useState("");
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

  // Interactive Schedule Preview Workbench State
  const [showScheduleWorkbench, setShowScheduleWorkbench] = useState(false);
  const [workbenchAssignments, setWorkbenchAssignments] = useState<ScheduleAssignment[]>([]);
  const [workbenchDetectedTeachers, setWorkbenchDetectedTeachers] = useState<string[]>([]);
  const [workbenchDetectedSections, setWorkbenchDetectedSections] = useState<string[]>([]);
  const [workbenchDefaultSection, setWorkbenchDefaultSection] = useState<string | undefined>(undefined);
  const [workbenchDefaultTeacher, setWorkbenchDefaultTeacher] = useState<string | undefined>(undefined);
  const [isWorkbenchInitialUpload, setIsWorkbenchInitialUpload] = useState(false);

  // Filter tab for Teachers & Schedule integrated registry
  const [teachersFilterTab, setTeachersFilterTab] = useState<"all" | "complete" | "needs_phone" | "no_schedule">("all");
  const [showPrintRegistryModal, setShowPrintRegistryModal] = useState(false);

  // In-page student timetable view toggle
  const [showInPageStudentTimetable, setShowInPageStudentTimetable] = useState(false);

  // Modal for Teacher Schedule Assignments & Subjects
  const [managingScheduleTeacher, setManagingScheduleTeacher] = useState<Teacher | null>(null);
  const [newAssignmentSubject, setNewAssignmentSubject] = useState("");
  const [newAssignmentSection, setNewAssignmentSection] = useState("");

  // Extract unique grades and sections
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((s) => {
      if (s.grade) grades.add(s.grade.trim());
    });
    return Array.from(grades).sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  }, [students]);

  // Extract unique sections dynamically based on selected grade
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    students.forEach((s) => {
      if (selectedGrade === "all" || s.grade?.trim() === selectedGrade) {
        const cls = s.className || (s as any)["الشعبة"] || (s as any)["الصف"] || "";
        if (cls) sections.add(cls.trim());
      }
    });
    return Array.from(sections).sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  }, [students, selectedGrade]);

  // Integrated Synthesized Teachers Registry (combines Teachers Roster & Schedule Timetable)
  const integratedTeachersRegistry = useMemo(() => {
    return extractIntegratedTeachersRegistry(teachers, scheduleAssignments);
  }, [teachers, scheduleAssignments]);

  const totalIntegratedTeachers = integratedTeachersRegistry.length;
  const countWithSchedule = useMemo(() => integratedTeachersRegistry.filter((t) => t.hasScheduleAssignments).length, [integratedTeachersRegistry]);
  const countWithPhone = useMemo(() => integratedTeachersRegistry.filter((t) => !!t.phone.trim()).length, [integratedTeachersRegistry]);
  const countComplete = useMemo(() => integratedTeachersRegistry.filter((t) => t.hasScheduleAssignments && !!t.phone.trim()).length, [integratedTeachersRegistry]);
  const countNeedsPhone = useMemo(() => integratedTeachersRegistry.filter((t) => !t.phone.trim()).length, [integratedTeachersRegistry]);
  const countNoSchedule = useMemo(() => integratedTeachersRegistry.filter((t) => !t.hasScheduleAssignments).length, [integratedTeachersRegistry]);
  const totalPeriodsQuota = useMemo(() => integratedTeachersRegistry.reduce((acc, t) => acc + t.totalPeriodsCount, 0), [integratedTeachersRegistry]);

  const filteredIntegratedTeachers = useMemo(() => {
    let list = integratedTeachersRegistry;

    if (teachersFilterTab === "complete") {
      list = list.filter((t) => t.hasScheduleAssignments && !!t.phone.trim());
    } else if (teachersFilterTab === "needs_phone") {
      list = list.filter((t) => !t.phone.trim());
    } else if (teachersFilterTab === "no_schedule") {
      list = list.filter((t) => !t.hasScheduleAssignments);
    }

    if (teachersSearchTerm.trim()) {
      const term = teachersSearchTerm.trim().toLowerCase();
      list = list.filter((t) => {
        const matchName = t.name.toLowerCase().includes(term);
        const matchSpecialty = t.specialty.toLowerCase().includes(term);
        const matchPhone = t.phone.includes(term);
        const matchSubjects = t.assignedSubjects.some((s) => s.toLowerCase().includes(term));
        const matchSections = t.assignedSections.some((sec) => sec.toLowerCase().includes(term));
        return matchName || matchSpecialty || matchPhone || matchSubjects || matchSections;
      });
    }

    return list;
  }, [integratedTeachersRegistry, teachersFilterTab, teachersSearchTerm]);


  // Selected student helpers for weekly timetable preview
  const firstSelectedStudent = useMemo(() => {
    if (selectedStudentIds.length === 0) return null;
    return students.find((s) => s.id === selectedStudentIds[0]) || null;
  }, [students, selectedStudentIds]);

  const firstSelectedStudentSection = useMemo(() => {
    if (!firstSelectedStudent) return "";
    return (
      firstSelectedStudent.className ||
      firstSelectedStudent.section ||
      (firstSelectedStudent as any)["الشعبة"] ||
      (firstSelectedStudent as any)["الشعبه"] ||
      (firstSelectedStudent as any)["الفصل"] ||
      (firstSelectedStudent as any)["الصف"] ||
      (firstSelectedStudent as any)["الصف/الفصل"] ||
      (firstSelectedStudent as any)["رقم الفصل"] ||
      (firstSelectedStudent as any)["رقم الشعبة"] ||
      ""
    ).trim();
  }, [firstSelectedStudent]);

  // Student Section Timetable Matrix for weekly inquiry preview
  const studentWeeklyMatrix = useMemo(() => {
    if (!firstSelectedStudentSection) return null;
    return buildWeeklyTimetableForSection(scheduleAssignments, firstSelectedStudentSection);
  }, [scheduleAssignments, firstSelectedStudentSection]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        !studentSearchTerm ||
        s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        (s.nationalId && s.nationalId.includes(studentSearchTerm)) ||
        (s.id && s.id.includes(studentSearchTerm));

      const matchesGrade = selectedGrade === "all" || s.grade?.trim() === selectedGrade;
      const cls =
        s.className ||
        s.section ||
        (s as any)["الشعبة"] ||
        (s as any)["الشعبه"] ||
        (s as any)["الفصل"] ||
        (s as any)["الصف"] ||
        "";
      const matchesSection = selectedSection === "all" || cls.trim() === selectedSection;

      return matchesSearch && matchesGrade && matchesSection;
    });
  }, [students, studentSearchTerm, selectedGrade, selectedSection]);

  // Auto-detect teachers who teach these students according to school schedule and teacher roster
  const autoSuggestTeachersForSelectedStudents = (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setCandidateTeachers([]);
      setSelectedTeacherKeys([]);
      return;
    }

    const selectedList = students.filter((s) => studentIds.includes(s.id));
    const sectionSet = new Set<string>();
    selectedList.forEach((s) => {
      const sec =
        s.className ||
        s.section ||
        (s as any)["الشعبة"] ||
        (s as any)["الشعبه"] ||
        (s as any)["الفصل"] ||
        (s as any)["الصف"] ||
        (s as any)["الصف/الفصل"] ||
        (s as any)["رقم الفصل"] ||
        (s as any)["رقم الشعبة"] ||
        "";
      if (sec) sectionSet.add(sec.trim());
    });

    const suggestions: CandidateTeacher[] = [];

    // Search timetable for each section using intelligent relationship extraction
    sectionSet.forEach((sec) => {
      const relations = getTeachersAndSubjectsForSection(scheduleAssignments, sec, teachers);
      relations.forEach((rel) => {
        const itemKey = rel.key;
        const exists = suggestions.some((item) => item.key === itemKey);

        if (!exists) {
          suggestions.push({
            key: itemKey,
            teacherId: rel.teacherId,
            // Displayed teacher name is from the schedule
            teacherName: rel.teacherName,
            rosterName: rel.rosterName,
            teacherPhone: rel.teacherPhone,
            subject: rel.subject || rel.specialty || "غير محدد",
            specialty: rel.specialty,
            section: rel.section || formatStandardSectionName(sec),
            isMatchedInRoster: rel.isMatchedInRoster,
          });
        }
      });
    });

    // If no schedule matched, list teachers from the teacher roster (كشوف المعلمين)
    if (suggestions.length === 0 && teachers.length > 0) {
      teachers.forEach((t, i) => {
        const itemKey = `${t.name}_${t.subject || t.specialty || t.subjectSpecialty || "التقييم العام"}_${Array.from(sectionSet)[0] || "عام"}_${i}`;
        suggestions.push({
          key: itemKey,
          teacherId: t.id,
          teacherName: t.name,
          rosterName: t.name,
          teacherPhone: t.phone || "",
          subject: t.subject || t.specialty || t.subjectSpecialty || "التقييم العام",
          specialty: t.subjectSpecialty || t.specialty || t.subject || "عام",
          section: Array.from(sectionSet)[0] || "شعبة عامة",
          isMatchedInRoster: true,
        });
      });
    }

    setCandidateTeachers(suggestions);
    // By default, select all candidate teachers
    setSelectedTeacherKeys(suggestions.map((t) => t.key));
  };

  // Handle student selection
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      autoSuggestTeachersForSelectedStudents(next);
      return next;
    });
  };

  const selectAllFilteredStudents = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
      setCandidateTeachers([]);
      setSelectedTeacherKeys([]);
    } else {
      const allIds = filteredStudents.map((s) => s.id);
      setSelectedStudentIds(allIds);
      autoSuggestTeachersForSelectedStudents(allIds);
    }
  };

  // Toggle individual teacher selection
  const toggleTeacherSelection = (key: string) => {
    setSelectedTeacherKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Select / Deselect all candidate teachers
  const selectAllTeachers = () => {
    setSelectedTeacherKeys(candidateTeachers.map((t) => t.key));
  };

  const deselectAllTeachers = () => {
    setSelectedTeacherKeys([]);
  };

  // Remove teacher from candidates
  const removeCandidateTeacher = (key: string) => {
    setCandidateTeachers((prev) => prev.filter((t) => t.key !== key));
    setSelectedTeacherKeys((prev) => prev.filter((k) => k !== key));
  };

  // Start inline editing teacher phone in Step 2
  const handleStartInlinePhoneEdit = (t: CandidateTeacher) => {
    setInlineEditingKey(t.key);
    setInlinePhoneValue(t.teacherPhone || "");
  };

  // Save inline phone edit (updates candidate list and teacher roster)
  const handleSaveInlinePhone = async (t: CandidateTeacher) => {
    const trimmedPhone = inlinePhoneValue.trim();
    
    // Update candidate list
    setCandidateTeachers((prev) =>
      prev.map((item) => (item.key === t.key ? { ...item, teacherPhone: trimmedPhone } : item))
    );

    // Update in teacher roster if exists or add
    let teacherMatched = false;
    const updatedTeachers = teachers.map((existingTeacher) => {
      if (
        (t.teacherId && existingTeacher.id === t.teacherId) ||
        existingTeacher.name.trim().toLowerCase() === t.teacherName.trim().toLowerCase()
      ) {
        teacherMatched = true;
        return { ...existingTeacher, phone: trimmedPhone };
      }
      return existingTeacher;
    });

    if (!teacherMatched && trimmedPhone) {
      updatedTeachers.push({
        id: `teach_${Date.now()}`,
        name: t.teacherName,
        phone: trimmedPhone,
        subject: t.subject,
      });
    }

    onUpdateTeachers(updatedTeachers);
    
    // Save to server
    try {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: updatedTeachers }),
      });
    } catch {}

    setInlineEditingKey(null);
  };

  // Add an extra teacher from teachers roster to candidate list
  const handleAddExtraTeacher = () => {
    if (!selectedExtraTeacherId) return;
    const foundTeacher = teachers.find((t) => t.id === selectedExtraTeacherId);
    if (!foundTeacher) return;

    const sub = extraTeacherSubject.trim() || foundTeacher.subject || "مادة إضافية";
    const sectionName = selectedSection !== "all" ? selectedSection : "شعبة عامة";
    const newKey = `extra_${foundTeacher.id}_${Date.now()}`;

    const newCandidate: CandidateTeacher = {
      key: newKey,
      teacherId: foundTeacher.id,
      teacherName: foundTeacher.name,
      teacherPhone: foundTeacher.phone || "",
      subject: sub,
      section: sectionName,
    };

    setCandidateTeachers((prev) => [newCandidate, ...prev]);
    setSelectedTeacherKeys((prev) => [newKey, ...prev]);
    setShowAddExtraTeacherModal(false);
    setSelectedExtraTeacherId("");
    setExtraTeacherSubject("");
  };

  // Get only currently selected teachers for sending
  const activeSelectedTeachers = useMemo(() => {
    return candidateTeachers.filter((t) => selectedTeacherKeys.includes(t.key));
  }, [candidateTeachers, selectedTeacherKeys]);

  // Dispatch Inquiries
  const handleSendInquiries = async () => {
    if (selectedStudentIds.length === 0) {
      alert("يرجى اختيار طالب واحد على الأقل للاستعلام عنه");
      return;
    }

    if (activeSelectedTeachers.length === 0) {
      alert("يرجى تحديد المعلمين المراد إرسال رسائل الاستعلام إليهم بوضع علامة (✓)");
      return;
    }

    const selectedStudentsList = students
      .filter((s) => selectedStudentIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        className: s.className || (s as any)["الشعبة"],
        nationalId: s.nationalId,
      }));

    const requestsPayload = activeSelectedTeachers.map((t) => ({
      teacherId: t.teacherId || "",
      teacherName: t.teacherName,
      teacherPhone: t.teacherPhone,
      subject: t.subject,
      section: t.section,
      grade: t.grade,
      students: selectedStudentsList,
    }));

    try {
      setSendingInquiries(true);
      const res = await fetch("/api/inquiries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: requestsPayload,
          origin: window.location.origin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إرسال الاستعلامات");
      }

      if (data.inquiries && Array.isArray(data.inquiries)) {
        onUpdateInquiries([...data.inquiries, ...inquiryRequests]);
      }

      setInquirySuccessBanner(
        `تم إرسال ${requestsPayload.length} طلب استعلام بنجاح إلى المعلمين المحددين عبر واتساب.`
      );
      setSelectedStudentIds([]);
      setCandidateTeachers([]);
      setSelectedTeacherKeys([]);
      setTimeout(() => setInquirySuccessBanner(null), 8000);
      setActiveTab("inquiries_log");
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إرسال طلبات الاستعلام");
    } finally {
      setSendingInquiries(false);
    }
  };

  // Resend inquiry WhatsApp message
  const handleResendInquiry = async (inquiryId: string) => {
    try {
      setResendingId(inquiryId);
      const res = await fetch("/api/inquiries/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiryId, origin: window.location.origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إعادة الإرسال");

      // Update local state
      onUpdateInquiries(
        inquiryRequests.map((item) => (item.id === inquiryId ? { ...item, ...data.inquiry } : item))
      );
      alert("تمت إعادة إرسال التذكير للمعلم بنجاح");
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء إعادة الإرسال");
    } finally {
      setResendingId(null);
    }
  };

  // Delete inquiry
  const handleDeleteInquiry = async (inquiryId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف طلب الاستعلام هذا؟")) return;
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      onUpdateInquiries(inquiryRequests.filter((item) => item.id !== inquiryId));
    } catch (err: any) {
      alert(err.message || "تعذر حذف الاستعلام");
    }
  };

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

  // Open Edit Teacher Modal (supports Teacher or IntegratedTeacherRecord)
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
    const updatedTeachers = teachers.filter(
      (t) => t.id !== record.id && normalizeArabicText(t.name) !== normalizeArabicText(record.name)
    );
    onUpdateTeachers(updatedTeachers);

    try {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: updatedTeachers }),
      });
    } catch {}

    // 2. If teacher has schedule assignments, also remove them from schedule
    if (record.hasScheduleAssignments) {
      const updatedAssignments = scheduleAssignments.filter(
        (a) =>
          normalizeArabicText(a.teacherName) !== normalizeArabicText(record.name) &&
          (record.scheduleName ? normalizeArabicText(a.teacherName) !== normalizeArabicText(record.scheduleName) : true)
      );
      onUpdateSchedule(updatedAssignments);
      try {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments: updatedAssignments }),
        });
      } catch {}
    }
  };

  // Save Edited Teacher
  const handleSaveEditTeacher = async () => {
    if (!editingTeacher) return;
    if (!editingTeacherData.name.trim()) {
      alert("يرجى إدخال اسم المعلم");
      return;
    }

    const trimmedName = editingTeacherData.name.trim();
    const trimmedPhone = editingTeacherData.phone.trim();
    const trimmedSubject = editingTeacherData.subject.trim();

    let matched = false;
    let updatedTeachers = teachers.map((t) => {
      if (
        t.id === editingTeacher.id ||
        normalizeArabicText(t.name) === normalizeArabicText(editingTeacher.name)
      ) {
        matched = true;
        return {
          ...t,
          name: trimmedName,
          phone: trimmedPhone,
          subject: trimmedSubject,
          specialty: trimmedSubject,
          subjectSpecialty: trimmedSubject,
        };
      }
      return t;
    });

    if (!matched) {
      const newTeacher: Teacher = {
        id: editingTeacher.id && !editingTeacher.id.startsWith("sched_") ? editingTeacher.id : `tch_${Date.now()}`,
        name: trimmedName,
        phone: trimmedPhone,
        subject: trimmedSubject,
        specialty: trimmedSubject,
        subjectSpecialty: trimmedSubject,
      };
      updatedTeachers = [...updatedTeachers, newTeacher];
    }

    onUpdateTeachers(updatedTeachers);

    // Also update candidate teachers in step 2 if present
    setCandidateTeachers((prev) =>
      prev.map((item) => {
        if (
          item.teacherId === editingTeacher.id ||
          item.teacherName.trim().toLowerCase() === editingTeacher.name.trim().toLowerCase()
        ) {
          return {
            ...item,
            teacherName: trimmedName,
            teacherPhone: trimmedPhone,
            subject: trimmedSubject || item.subject,
          };
        }
        return item;
      })
    );

    // Save to server
    try {
      await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teachers: updatedTeachers }),
      });
    } catch {}

    setEditingTeacher(null);
  };

  // Filtered Inquiries Log
  const filteredInquiries = useMemo(() => {
    return inquiryRequests.filter((inq) => {
      const matchesSearch =
        !logSearchTerm ||
        inq.teacherName.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
        inq.subject.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
        inq.students.some((s) => s.name.toLowerCase().includes(logSearchTerm.toLowerCase()));

      const matchesStatus = logStatusFilter === "all" || inq.status === logStatusFilter;

      let matchesDate = true;
      if (inquiryDateFilter) {
        const inqDate = inq.sentAt ? inq.sentAt.split("T")[0] : (inq.createdAt ? inq.createdAt.split("T")[0] : "");
        matchesDate = inqDate === inquiryDateFilter;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [inquiryRequests, logSearchTerm, logStatusFilter, inquiryDateFilter]);

  // Aggregate inquiries and evaluations per student across all inquiries
  const aggregatedStudentsList: AggregatedStudentEvaluation[] = useMemo(() => {
    const studentMap: Record<string, AggregatedStudentEvaluation> = {};

    inquiryRequests.forEach((inq) => {
      inq.students?.forEach((st) => {
        const studentKey = st.id || st.name;
        if (!studentMap[studentKey]) {
          studentMap[studentKey] = {
            student: {
              id: st.id,
              name: st.name,
              nationalId: st.nationalId,
              grade: st.grade || inq.grade,
              className: st.className || inq.section,
            },
            totalInquiriesCount: 0,
            completedEvaluationsCount: 0,
            teachersEvaluations: [],
          };
        }

        const evalItem = inq.evaluations?.find((e) => e.studentId === st.id);
        const isCompleted = inq.status === "completed" && !!evalItem;

        studentMap[studentKey].totalInquiriesCount += 1;
        if (isCompleted) {
          studentMap[studentKey].completedEvaluationsCount += 1;
        }

        studentMap[studentKey].teachersEvaluations.push({
          inquiryId: inq.id,
          teacherName: inq.teacherName,
          teacherPhone: inq.teacherPhone,
          subject: inq.subject,
          section: inq.section,
          grade: inq.grade,
          status: inq.status,
          isVerified: inq.isVerified,
          sentAt: inq.sentAt,
          completedAt: inq.completedAt,
          evaluation: evalItem,
        });
      });
    });

    return Object.values(studentMap);
  }, [inquiryRequests]);

  // Filtered Aggregated Students for Consolidated Reports
  const filteredAggregatedStudents = useMemo(() => {
    return aggregatedStudentsList.filter((item) => {
      const matchesSearch =
        !consolidatedSearchTerm ||
        item.student.name.toLowerCase().includes(consolidatedSearchTerm.toLowerCase()) ||
        (item.student.nationalId && item.student.nationalId.includes(consolidatedSearchTerm)) ||
        (item.student.className && item.student.className.toLowerCase().includes(consolidatedSearchTerm.toLowerCase())) ||
        (item.student.grade && item.student.grade.toLowerCase().includes(consolidatedSearchTerm.toLowerCase()));

      let matchesStatus = true;
      if (consolidatedStatusFilter === "completed") {
        matchesStatus = item.completedEvaluationsCount === item.totalInquiriesCount && item.totalInquiriesCount > 0;
      } else if (consolidatedStatusFilter === "partial") {
        matchesStatus = item.completedEvaluationsCount > 0 && item.completedEvaluationsCount < item.totalInquiriesCount;
      } else if (consolidatedStatusFilter === "pending") {
        matchesStatus = item.completedEvaluationsCount === 0;
      }

      let matchesDate = true;
      if (consolidatedDateFilter) {
        matchesDate = item.teachersEvaluations.some((t) => {
          const sentD = t.sentAt ? t.sentAt.split("T")[0] : "";
          const compD = t.completedAt ? t.completedAt.split("T")[0] : "";
          return sentD === consolidatedDateFilter || compD === consolidatedDateFilter;
        });
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [aggregatedStudentsList, consolidatedSearchTerm, consolidatedStatusFilter, consolidatedDateFilter]);

  // Manual refresh inquiries from server
  const handleManualRefreshInquiries = async () => {
    try {
      setIsRefreshingInquiries(true);
      const res = await fetch("/api/inquiries");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.inquiries)) {
          onUpdateInquiries(data.inquiries);
          setLastRefreshedTime(new Date().toLocaleTimeString("ar-SA"));
        }
      }
    } catch (e) {
      console.error("Failed to refresh inquiries", e);
    } finally {
      setIsRefreshingInquiries(false);
    }
  };

  // Copy evaluation link and access code
  const copyInquiryDetails = (inq: TeacherInquiryRequest) => {
    const link = `${window.location.origin}/?eval=${inq.id}`;
    const text = `رابط التقييم: ${link}\nرمز الدخول: ${inq.accessCode}`;
    navigator.clipboard.writeText(text);
    alert("تم نسخ رابط الاستعلام ورمز التفعيل بنجاح للحافظة");
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <UserCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">نظام الاستعلام عن طالب</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                استعلام المعلمين عن الطلاب ومتابعة مستويات التحصيل والسلوك والانضباط وإصدار التقارير التجميعية الرسمية
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onNavigateToTeachersSchedule || (() => setActiveTab("teachers_schedule"))}
              className="px-3 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="إدارة كشف المعلمين في قسم الجدول المدرسي وكشف المعلمين"
            >
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>{teachers.length} معلماً مسجلاً</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToTeachersSchedule || (() => setActiveTab("teachers_schedule"))}
              className="px-3 py-1.5 bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="إدارة جدول الحصص في قسم الجدول المدرسي وكشف المعلمين"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>{scheduleAssignments.length} حصة مجدولة</span>
            </button>
            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{inquiryRequests.length} استعلام</span>
            </span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 pt-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("new_inquiry")}
            className={`
              py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0
              ${
                activeTab === "new_inquiry"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600"
              }
            `}
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>طلب استعلام جديد وإرسال</span>
          </button>

          <button
            onClick={() => setActiveTab("inquiries_log")}
            className={`
              py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 relative
              ${
                activeTab === "inquiries_log"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600"
              }
            `}
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>سجل الاستعلامات والمتابعة</span>
            {inquiryRequests.length > 0 && (
              <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-black">
                {inquiryRequests.length}
              </span>
            )}
          </button>

          {/* Tab: Official Consolidated Student Reports */}
          <button
            onClick={() => setActiveTab("consolidated_reports")}
            className={`
              py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0 relative
              ${
                activeTab === "consolidated_reports"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600"
              }
            `}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>التقارير الرسمية التجميعية للطلاب</span>
            {aggregatedStudentsList.length > 0 && (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black">
                {aggregatedStudentsList.length}
              </span>
            )}
          </button>

          {/* Standalone Section Link or Tab */}
          {onNavigateToTeachersSchedule ? (
            <button
              type="button"
              onClick={onNavigateToTeachersSchedule}
              className="py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-all flex items-center gap-2 cursor-pointer shrink-0"
              title="الانتقال إلى القسم المستقل: الجدول المدرسي وكشف المعلمين"
            >
              <CalendarDays className="w-4 h-4 text-purple-600" />
              <span>الجدول المدرسي وكشف المعلمين</span>
              <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
            </button>
          ) : (
            <button
              onClick={() => setActiveTab("teachers_schedule")}
              className={`
                py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0
                ${
                  activeTab === "teachers_schedule"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                }
              `}
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-400" />
              <span>كشوف المعلمين والجدول المدرسي</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {inquirySuccessBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{inquirySuccessBanner}</span>
          </div>
          <button
            onClick={() => setInquirySuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: NEW INQUIRY & WHATSAPP DISPATCH */}
      {/* ========================================================================= */}
      {activeTab === "new_inquiry" && (
        <div className="space-y-6">
          
          {/* Step 1: Select Students */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ١
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  اختيار الطلاب المراد الاستعلام عنهم ({selectedStudentIds.length} محدد)
                </h2>
              </div>

              <button
                type="button"
                onClick={selectAllFilteredStudents}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
              >
                {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0
                  ? "إلغاء تحديد الكل"
                  : "تحديد كل المعروض"}
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم أو السجل المدني..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Grade select */}
              <div>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setSelectedSection("all");
                  }}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">جميع الصفوف الدراسية</option>
                  {uniqueGrades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Section select */}
              <div>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">
                    {selectedGrade === "all" ? "جميع الشعب والصفوف" : `جميع شعب ${selectedGrade}`}
                  </option>
                  {availableSections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table / Grid */}
            {students.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">لا يوجد طلاب مسجلين في كشف المدرسة</h3>
                <p className="text-xs text-slate-500">يرجى رفع كشف الطلاب أولاً من قسم الرسائل للبدء بالاستعلام.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                لا توجد نتائج مطابقة لخيارات البحث والتصفية المحددة.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {filteredStudents.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.id);
                  const cls = st.className || (st as any)["الشعبة"] || "—";
                  return (
                    <label
                      key={st.id}
                      className={`
                        p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors
                        ${isChecked ? "bg-emerald-50/70 text-emerald-950 font-bold" : "hover:bg-slate-50 text-slate-700"}
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentSelection(st.id)}
                          className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-slate-300"
                        />
                        <div className="min-w-0">
                          <span className="truncate block">{st.name}</span>
                          <span className="text-[11px] text-slate-400 font-normal block">
                            السجل: {st.nationalId || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-slate-500 font-medium">
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 text-[10px]">
                          شعبة: {cls}
                        </span>
                        {st.grade && (
                          <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 text-[10px] hidden sm:inline">
                            {st.grade}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Student Weekly Schedule Preview / Timetable Quick Bar */}
            {selectedStudentIds.length > 0 && (
              <div className="mt-4 p-4 bg-purple-50/70 border border-purple-200/90 rounded-2xl space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-purple-950 flex items-center gap-2 flex-wrap">
                        <span>
                          الطالب المحدد: {firstSelectedStudent?.name || `(${selectedStudentIds.length} طلاب)`}
                        </span>
                        {firstSelectedStudentSection && (
                          <span className="bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded-md font-bold text-[11px]">
                            شعبة: {firstSelectedStudentSection}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        الربط مباشر بجدول الحصص المدرسي، وتم استخراج اسم المعلم بالجدول وتخصصه ورقم جواله من كشف المعلمين.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {firstSelectedStudentSection && (
                      <button
                        type="button"
                        onClick={() => setShowInPageStudentTimetable(!showInPageStudentTimetable)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {showInPageStudentTimetable ? "إخفاء جدول الحصص الأسبوعي" : "معاينة جدول الحصص الأسبوعي للطالب"}
                        </span>
                        {showInPageStudentTimetable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setWorkbenchAssignments(scheduleAssignments);
                        setWorkbenchDetectedSections(availableSections);
                        setWorkbenchDefaultSection(firstSelectedStudentSection || undefined);
                        setShowScheduleWorkbench(true);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-purple-100/50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      <span>فنية المعاينة والتفاعل لجدول الحصص</span>
                    </button>
                  </div>
                </div>

                {/* In-Page Timetable Matrix when toggled */}
                {showInPageStudentTimetable && firstSelectedStudentSection && studentWeeklyMatrix && (
                  <div className="mt-3 pt-3 border-t border-purple-200/70 overflow-x-auto">
                    <div className="text-[11px] font-bold text-purple-900 mb-2 flex items-center justify-between">
                      <span>مصفوفة جدول الحصص الأسبوعي - شعبة: {firstSelectedStudentSection}</span>
                      <span className="text-[10px] text-purple-700">اضغط على "فنية المعاينة والتفاعل" لتعديل أو ضبط الحصص</span>
                    </div>

                    <table className="w-full text-xs text-center border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-purple-100/80 text-purple-950 font-bold border-b border-purple-200">
                          <th className="p-2 border-l border-purple-200">اليوم / الحصة</th>
                          {SCHOOL_PERIODS.map((p) => (
                            <th key={p} className="p-2 border-l border-purple-200 last:border-l-0 text-[11px]">
                              <div>الحصة {p}</div>
                              {p === 7 && (
                                <span className="text-[8px] text-purple-700 font-normal">
                                  (أحد/اثنين)
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100 bg-white">
                        {SCHOOL_WEEK_DAYS.map((day) => (
                          <tr key={day} className="hover:bg-purple-50/40">
                            <td className="p-2 font-bold text-slate-800 bg-purple-50/50 border-l border-purple-200 whitespace-nowrap text-[11px]">
                              <div>{day}</div>
                              <div className="text-[9px] font-medium text-slate-400">
                                {getPeriodsForDay(day).length} حصص
                              </div>
                            </td>
                            {SCHOOL_PERIODS.map((period) => {
                              const isValid = isPeriodValidForDay(day, period);
                              if (!isValid) {
                                return (
                                  <td
                                    key={period}
                                    className="p-1.5 border-l border-purple-100 last:border-l-0 text-center bg-slate-50/70 text-slate-400 select-none cursor-not-allowed"
                                    title="لا توجد حصة سابعة في هذا اليوم (نهاية الدوام 6 حصص فقط)"
                                  >
                                    <span className="text-[10px] text-slate-400 font-medium">— (6 حصص)</span>
                                  </td>
                                );
                              }

                              const cell = studentWeeklyMatrix[day]?.[period];
                              if (!cell) {
                                return (
                                  <td key={period} className="p-2 border-l border-purple-100 last:border-l-0 text-slate-300">
                                    —
                                  </td>
                                );
                              }
                              const teacherObj = matchTeacherInRoster(cell.teacherName, teachers);
                              return (
                                <td
                                  key={period}
                                  className="p-1.5 border-l border-purple-100 last:border-l-0"
                                >
                                  <div className="bg-purple-50/80 p-1.5 rounded-lg border border-purple-200/60 text-right space-y-0.5">
                                    <div className="font-extrabold text-purple-900 text-[11px] truncate">
                                      {cell.subject}
                                    </div>
                                    <div className="font-bold text-slate-700 text-[10px] truncate" title={cell.teacherName}>
                                      {cell.teacherName}
                                    </div>
                                    {teacherObj?.phone && (
                                      <div className="text-[9px] font-mono text-emerald-700 flex items-center gap-0.5" dir="ltr">
                                        <Phone className="w-2.5 h-2.5" />
                                        {teacherObj.phone}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Auto-Detected Teachers from Timetable & Manual Selection */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ٢
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                    المعلمون المرشحون للاستعلام ({activeSelectedTeachers.length} محدد من أصل {candidateTeachers.length})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    الأسماء معتمدة من جدول الحصص المدرسي، والأرقام والتخصصات مستخرجة تلقائياً من كشف المعلمين
                  </p>
                </div>
              </div>

              {candidateTeachers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={selectAllTeachers}
                    className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    تحديد جميع المعلمين
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllTeachers}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddExtraTeacherModal(true)}
                    className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة معلم آخر</span>
                  </button>
                </div>
              )}
            </div>

            {candidateTeachers.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                {selectedStudentIds.length === 0
                  ? "اختر طالباً أو أكثر من القائمة أعلاه ليتم إظهار معلمي الشعبة المعتمدين تلقائياً."
                  : "لم يتم العثور على معلمين مرتبطين بهذه الشعبة في الجدول المدرسي. يمكنك اختيار معلمين يدوياً أو رفع ملف الجدول."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidateTeachers.map((t) => {
                  const isSelected = selectedTeacherKeys.includes(t.key);
                  const isEditingThisPhone = inlineEditingKey === t.key;

                  return (
                    <div
                      key={t.key}
                      className={`
                        p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-xs
                        ${isSelected ? "bg-emerald-50/40 border-emerald-300/80 shadow-xs" : "bg-slate-50/70 border-slate-200 text-slate-500"}
                      `}
                    >
                      <div className="space-y-2">
                        {/* Header: Checkbox + Teacher Name (From Timetable Schedule) */}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTeacherSelection(t.key)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                            />
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <GraduationCap className={`w-4 h-4 shrink-0 ${isSelected ? "text-emerald-600" : "text-slate-400"}`} />
                              <h3 className={`font-extrabold truncate ${isSelected ? "text-slate-900" : "text-slate-600"}`}>
                                {t.teacherName}
                              </h3>
                              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                                مدون بالجدول
                              </span>
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() => removeCandidateTeacher(t.key)}
                            title="استبعاد هذا المعلم من القائمة"
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Subject, Section, and Specialty Tags */}
                        <div className="flex items-center gap-2 text-slate-600 flex-wrap pr-6">
                          <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-700">
                            {t.subject}
                          </span>
                          {t.section && (
                            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                              شعبة: {t.section}
                            </span>
                          )}
                          {t.specialty && (
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              التخصص: {t.specialty}
                            </span>
                          )}
                          {t.rosterName && t.rosterName !== t.teacherName && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              (مطابق مع: {t.rosterName} بكشف المعلمين)
                            </span>
                          )}
                        </div>

                        {/* Phone Number Display & Quick Edit */}
                        <div className="pt-1 pr-6 flex items-center justify-between gap-2 flex-wrap">
                          {isEditingThisPhone ? (
                            <div className="flex items-center gap-2 w-full mt-1 bg-white p-2 rounded-xl border border-emerald-300">
                              <input
                                type="text"
                                value={inlinePhoneValue}
                                onChange={(e) => setInlinePhoneValue(e.target.value)}
                                placeholder="05XXXXXXXX"
                                className="w-full text-xs font-mono px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                dir="ltr"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlinePhone(t)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer whitespace-nowrap"
                              >
                                حفظ الرقم
                              </button>
                              <button
                                type="button"
                                onClick={() => setInlineEditingKey(null)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 font-medium">رقم الواتساب:</span>
                                {t.teacherPhone ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100/80 text-emerald-900 border border-emerald-300/80 rounded-lg font-mono font-black text-xs shadow-2xs" dir="ltr">
                                    <Phone className="w-3 h-3 text-emerald-700" />
                                    {t.teacherPhone}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-bold">
                                    <AlertCircle className="w-3 h-3 text-amber-600" />
                                    بدون رقم مسجل
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleStartInlinePhoneEdit(t)}
                                className="text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                                title="تعديل أو إدخال رقم هاتف المعلم"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{t.teacherPhone ? "تعديل الرقم" : "إضافة رقم"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: Message Template Preview & Send Dispatch */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                ٣
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  صيغة الرسالة المرسلة لواتساب المعلم
                </h2>
                <p className="text-[11px] text-slate-400">
                  سيتم إرسال الرابط التفاعلي ورمز الدخول إلى أرقام المعلمين المحددين أعلاه ({activeSelectedTeachers.length} معلم)
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed space-y-2 select-all">
              <p className="text-emerald-400 font-bold">
                أهلاً أستاذ [اسم المعلم]،
              </p>
              <p>
                نأمل منك مشكوراً تزويدنا بملاحظاتك عن [اسم الطالب] (الصف: [الصف] - الشعبة: [الشعبة]) في مادة ([اسم المادة]).
              </p>
              <p className="text-cyan-300">
                🔗 رابط التقييم المباشر: {window.location.origin}/?eval=[رمز_الاستعلام]
              </p>
              <p className="text-amber-300">
                🔑 رمز الدخول (التفعيل): [رمز_مكون_من_6_أرقام]
              </p>
              <p className="text-slate-400 text-[11px]">
                شاكرين ومقدرين حسن تعاونكم،<br />
                إدارة {schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}
              </p>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {!isWhatsAppConnected && (
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>تنبيه: واتساب غير متصل. سيتم حفظ الاستعلامات في الوضع التجريبي.</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSendInquiries}
                disabled={sendingInquiries || selectedStudentIds.length === 0 || activeSelectedTeachers.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sendingInquiries ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>جاري إرسال الرسائل للمعلمين...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال رسائل الاستعلام عبر واتساب المعلمين المحددين ({activeSelectedTeachers.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INQUIRIES LOG & TRACKING */}
      {/* ========================================================================= */}
      {activeTab === "inquiries_log" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            
            {/* Filter Bar & Live Sync */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                  placeholder="ابحث باسم المعلم، الطالب، المادة..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* Date Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-2.5 py-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <input
                    type="date"
                    value={inquiryDateFilter}
                    onChange={(e) => setInquiryDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                    title="تصفية حسب تاريخ الإرسال"
                  />
                  {inquiryDateFilter && (
                    <button
                      type="button"
                      onClick={() => setInquiryDateFilter("")}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                      title="إلغاء تصفية التاريخ"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={logStatusFilter}
                  onChange={(e) => setLogStatusFilter(e.target.value)}
                  className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">بانتظار المعلم</option>
                  <option value="opened">تم فتح الرابط</option>
                  <option value="completed">تم التقييم والاعتماد</option>
                </select>

                <button
                  type="button"
                  onClick={handleManualRefreshInquiries}
                  disabled={isRefreshingInquiries}
                  title="تحديث ومزامنة الحالات فورياً من السيرفر"
                  className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshingInquiries ? "animate-spin" : ""}`} />
                  <span>تحديث الحالات</span>
                </button>

                {lastRefreshedTime && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    آخر مزامنة: {lastRefreshedTime}
                  </span>
                )}
              </div>
            </div>

            {/* List of Inquiries */}
            {filteredInquiries.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">لا توجد طلبات استعلام مسجلة</h3>
                <p className="text-xs text-slate-500">
                  يمكنك إنشاء طلب استعلام جديد واختيار الطلاب والمعلمين من التبويب الأول.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInquiries.map((inq) => {
                  const isCompleted = inq.status === "completed";
                  const isOpened = inq.status === "opened";

                  return (
                    <div
                      key={inq.id}
                      className={`
                        p-4 sm:p-5 rounded-3xl border transition-all space-y-3
                        ${
                          isCompleted
                            ? "bg-white border-emerald-200/90 shadow-xs"
                            : isOpened
                            ? "bg-white border-blue-200/90 shadow-xs"
                            : "bg-white border-slate-200/90 shadow-xs"
                        }
                      `}
                    >
                      {/* Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`
                              w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0
                              ${
                                isCompleted
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isOpened
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-700"
                              }
                            `}
                          >
                            <GraduationCap className="w-5 h-5" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-sm text-slate-900">
                                {inq.teacherName}
                              </h3>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                {inq.subject}
                              </span>
                              {inq.section && (
                                <span className="text-[11px] text-slate-500">
                                  شعبة {inq.section}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              أُرسلت: {new Date(inq.sentAt).toLocaleString("ar-SA")}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isCompleted ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>تم التقييم والاعتماد</span>
                            </span>
                          ) : isOpened ? (
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              <span>تم فتح الرابط</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>بانتظار المعلم</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Students List in this Inquiry */}
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-700">
                            الطلاب المطلوب تقييمهم ({inq.students.length} طالب):
                          </span>
                          <span className="text-[11px] text-slate-400">
                            انقر على أي طالب لعرض تقريره التجميعي الكامل
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {inq.students.map((st) => {
                            const evalItem = inq.evaluations?.find((e) => e.studentId === st.id);
                            const aggRecord = aggregatedStudentsList.find(
                              (a) => a.student.id === st.id || a.student.name === st.name
                            );

                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  if (aggRecord) {
                                    setViewingConsolidatedModal(aggRecord);
                                  }
                                }}
                                className={`
                                  px-2.5 py-1 rounded-xl text-xs border font-medium flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]
                                  ${
                                    evalItem
                                      ? "bg-white text-emerald-800 border-emerald-200 shadow-xs hover:border-emerald-400"
                                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                                  }
                                `}
                              >
                                <span>{st.name}</span>
                                {evalItem && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                    {evalItem.academicLevel}
                                  </span>
                                )}
                                <Award className="w-3 h-3 text-amber-500 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions Bottom Row */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
                        <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                          <span>رمز التفعيل: <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{inq.accessCode}</strong></span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* View details / ratings button */}
                          <button
                            type="button"
                            onClick={() => setViewingInquiryModal(inq)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض تقييم المعلم</span>
                          </button>

                          {/* Copy link & access code */}
                          <button
                            type="button"
                            onClick={() => copyInquiryDetails(inq)}
                            title="نسخ رابط الاستعلام ورمز التفعيل"
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Resend reminder button */}
                          <button
                            type="button"
                            onClick={() => handleResendInquiry(inq.id)}
                            disabled={resendingId === inq.id}
                            title="إعادة إرسال تذكير عبر واتساب للمعلم"
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${resendingId === inq.id ? "animate-spin" : ""}`} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteInquiry(inq.id)}
                            title="حذف هذا الاستعلام"
                            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: OFFICIAL CONSOLIDATED STUDENT REPORTS (تجميع تقييمات المعلمين) */}
      {/* ========================================================================= */}
      {activeTab === "consolidated_reports" && (
        <div className="space-y-6">
          {/* Top Overview & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">إجمالي الطلاب المستعلم عنهم</span>
                <span className="text-xl font-black text-slate-900">{aggregatedStudentsList.length} طالب</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-emerald-200/90 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-emerald-700 font-bold block">مكتمل التقييم من كافة المعلمين</span>
                <span className="text-xl font-black text-emerald-800">
                  {aggregatedStudentsList.filter((a) => a.completedEvaluationsCount === a.totalInquiriesCount && a.totalInquiriesCount > 0).length} طالب
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-amber-200/90 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-amber-700 font-bold block">تقييم جزئي (بانتظار بعض المواد)</span>
                <span className="text-xl font-black text-amber-800">
                  {aggregatedStudentsList.filter((a) => a.completedEvaluationsCount > 0 && a.completedEvaluationsCount < a.totalInquiriesCount).length} طالب
                </span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-purple-200/90 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-purple-700 font-bold block">إجمالي إفادات المعلمين المعتمدة</span>
                <span className="text-xl font-black text-purple-800">
                  {aggregatedStudentsList.reduce((acc, curr) => acc + curr.completedEvaluationsCount, 0)} إفادة
                </span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={consolidatedSearchTerm}
                  onChange={(e) => setConsolidatedSearchTerm(e.target.value)}
                  placeholder="ابحث باسم الطالب، الهوية، الصف، الشعبة..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* Date Filter */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-2.5 py-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <input
                    type="date"
                    value={consolidatedDateFilter}
                    onChange={(e) => setConsolidatedDateFilter(e.target.value)}
                    className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                    title="تصفية تقارير الطلاب حسب التاريخ"
                  />
                  {consolidatedDateFilter && (
                    <button
                      type="button"
                      onClick={() => setConsolidatedDateFilter("")}
                      className="text-slate-400 hover:text-red-600 p-0.5"
                      title="إلغاء تصفية التاريخ"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={consolidatedStatusFilter}
                  onChange={(e) => setConsolidatedStatusFilter(e.target.value as any)}
                  className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">جميع الحالات ({aggregatedStudentsList.length})</option>
                  <option value="completed">مكتمل التقييمات 100%</option>
                  <option value="partial">تقييم جزئي</option>
                  <option value="pending">بانتظار المعلمين</option>
                </select>

                <button
                  type="button"
                  onClick={handleManualRefreshInquiries}
                  disabled={isRefreshingInquiries}
                  className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isRefreshingInquiries ? "animate-spin" : ""}`} />
                  <span>تحديث فوري للحالات</span>
                </button>
              </div>
            </div>

            {/* List of Consolidated Student Cards */}
            {filteredAggregatedStudents.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Award className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">لا توجد بيانات طلاب مطابقة</h3>
                <p className="text-xs text-slate-500">
                  {aggregatedStudentsList.length === 0
                    ? "قم بإنشاء طلبات استعلام عن الطلاب في التبويب الأول لتظهر هنا تقاريرهم التجميعية فور استجابة المعلمين."
                    : "جرّب تغيير عبارة البحث أو الفلتر المحدد."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAggregatedStudents.map((item) => {
                  const isAllCompleted = item.completedEvaluationsCount === item.totalInquiriesCount && item.totalInquiriesCount > 0;
                  const isPartial = item.completedEvaluationsCount > 0 && item.completedEvaluationsCount < item.totalInquiriesCount;
                  const completionPercentage = item.totalInquiriesCount > 0
                    ? Math.round((item.completedEvaluationsCount / item.totalInquiriesCount) * 100)
                    : 0;

                  return (
                    <div
                      key={item.student.id || item.student.name}
                      className={`
                        p-5 rounded-3xl border transition-all space-y-4
                        ${
                          isAllCompleted
                            ? "bg-white border-emerald-200/90 shadow-xs"
                            : isPartial
                            ? "bg-white border-amber-200/90 shadow-xs"
                            : "bg-white border-slate-200/90 shadow-xs"
                        }
                      `}
                    >
                      {/* Top Student Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div
                            className={`
                              w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0
                              ${
                                isAllCompleted
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isPartial
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }
                            `}
                          >
                            <GraduationCap className="w-6 h-6" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-base text-slate-900">
                                {item.student.name}
                              </h3>
                              {item.student.nationalId && (
                                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">
                                  هوية: {item.student.nationalId}
                                </span>
                              )}
                              {item.student.grade && (
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                  {item.student.grade}
                                </span>
                              )}
                              {item.student.className && (
                                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                  شعبة {item.student.className}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                              <span>
                                تم إرسال استعلام إلى {item.totalInquiriesCount} معلماً
                              </span>
                              <span>•</span>
                              <span>
                                وردت إفادة {item.completedEvaluationsCount} من المعلمين ({completionPercentage}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Open Report Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isAllCompleted ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مكتمل التقييمات رسمياً</span>
                            </span>
                          ) : isPartial ? (
                            <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>تقييم جزئي ({item.completedEvaluationsCount}/{item.totalInquiriesCount})</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>بانتظار المعلمين</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setViewingConsolidatedModal(item)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Printer className="w-4 h-4" />
                            <span>عرض وطباعة التقرير الرسمي</span>
                          </button>
                        </div>
                      </div>

                      {/* Teachers Evaluations Breakdown */}
                      <div className="space-y-2 text-xs">
                        <div className="font-extrabold text-slate-700 flex items-center justify-between">
                          <span>إفادات المعلمين المسجلة لهذا الطالب:</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            اضغط على التقرير الرسمي أعلاه لمعاينة النموذج المعتمد للطباعة
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {item.teachersEvaluations.map((tEval, idx) => {
                            const hasEval = tEval.status === "completed" && !!tEval.evaluation;

                            return (
                              <div
                                key={idx}
                                className={`
                                  p-3 rounded-2xl border transition-all text-xs space-y-1.5
                                  ${
                                    hasEval
                                      ? "bg-emerald-50/50 border-emerald-200 text-slate-800"
                                      : "bg-slate-50 border-slate-200 text-slate-500"
                                  }
                                `}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-black text-slate-900 truncate">
                                    {tEval.subject}
                                  </div>
                                  {hasEval ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-600 text-white rounded-md flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      <span>معتمد</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md">
                                      بانتظار الإفادة
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-600">
                                  المعلم: <strong>{tEval.teacherName}</strong>
                                </div>

                                {hasEval && tEval.evaluation && (
                                  <div className="pt-1.5 border-t border-emerald-200/60 flex flex-wrap gap-1 text-[10px]">
                                    <span className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 font-bold">
                                      التحصيل: {tEval.evaluation.academicLevel}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 font-bold">
                                      الانضباط: {tEval.evaluation.attendanceLevel}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 font-bold">
                                      السلوك: {tEval.evaluation.behaviorLevel}
                                    </span>
                                    {tEval.evaluation.notes && (
                                      <div className="w-full text-slate-600 text-[10px] italic line-clamp-1 mt-0.5">
                                        "{tEval.evaluation.notes}"
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEACHERS & SCHEDULE EXCEL MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "teachers_schedule" && (
        <div className="space-y-6">
          
          {/* Notification Messages */}
          {uploadMessage && (
            <div
              className={`
                p-4 rounded-3xl border text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-xs
                ${
                  uploadMessage.type === "success"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-red-50 text-red-900 border-red-200"
                }
              `}
            >
              <span>{uploadMessage.text}</span>
              <button
                onClick={() => setUploadMessage(null)}
                className="cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Upload Teachers Excel */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">كشف أسماء المعلمين</h3>
                  <p className="text-xs text-slate-400">ملف إكسل يتضمن: اسم المعلم، مجال التدريس (المادة)، ورقم الجوال</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="font-bold text-slate-800">الأعمدة المطلوبة في الإكسل:</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">اسم المعلم</span>
                  <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono">مجال التدريس / المادة</span>
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

            {/* 2. Upload School Schedule Matrix */}
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
                  يدعم نظام الذكاء الاصطناعي قراءة مصفوفة جدول الحصص اليومي، أو الكشوف المسطحة التي تربط (المعلم - المادة - الشعبة).
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

          {/* Current Teachers & Weekly Schedule Assignments Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-5">
            {/* Header & Subtitle */}
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
                  استخلاص تكاملي آلي يجمع اسم المعلم وتخصصه ورقم هاتفه من كشف المعلمين، ويضيف المقررات والشعب المسندة إليه وأنصبة الحصص من جدول الحصص الأسبوعي.
                </p>
              </div>

              {/* Action Buttons: Print Official Registry & Add New Teacher */}
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

            {/* Quick KPI Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="text-[11px] text-slate-400 font-bold">إجمالي المعلمين بالسجل</div>
                <div className="text-lg font-black text-slate-900 mt-0.5">{totalIntegratedTeachers} <span className="text-xs font-normal text-slate-400">معلماً</span></div>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/70">
                <div className="text-[11px] text-emerald-600 font-bold">مكتمل الربط (هاتف + جدول)</div>
                <div className="text-lg font-black text-emerald-700 mt-0.5">{countComplete} <span className="text-xs font-normal text-emerald-500">معلماً</span></div>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/70">
                <div className="text-[11px] text-amber-700 font-bold">ينقصه رقم هاتف</div>
                <div className="text-lg font-black text-amber-800 mt-0.5">{countNeedsPhone} <span className="text-xs font-normal text-amber-500">معلماً</span></div>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200/70">
                <div className="text-[11px] text-purple-700 font-bold">إجمالي الحصص المسندة</div>
                <div className="text-lg font-black text-purple-800 mt-0.5">{totalPeriodsQuota} <span className="text-xs font-normal text-purple-500">حصة أسبوعية</span></div>
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
              <div className="relative w-full sm:w-72">
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

            {/* Table */}
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
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTeacherModal(record)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="تعديل رقم الجوال"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEditTeacherModal(record)}
                                className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg text-[10px] font-bold border border-amber-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                                title="إضافة رقم الجوال للمعلم"
                              >
                                <Plus className="w-3 h-3" />
                                <span>إضافة رقم جوال</span>
                              </button>
                            )}
                          </td>

                          {/* Assigned Courses from Timetable */}
                          <td className="p-3 max-w-xs">
                            {(!record.assignedSubjects || record.assignedSubjects.length === 0) ? (
                              <span className="text-[11px] text-slate-400 italic">
                                لم تسند له مواد بالجدول بعد
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 items-center">
                                {(record.subjectBreakdown || []).map((sb, sbIdx) => (
                                  <span
                                    key={sbIdx}
                                    className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-100 text-[11px] font-bold flex items-center gap-1"
                                  >
                                    <span>{sb.subject}</span>
                                    <span className="text-[9px] bg-blue-200/70 text-blue-800 px-1 rounded-md font-mono">
                                      {sb.periodsCount}ح
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Assigned Sections from Timetable */}
                          <td className="p-3 max-w-xs">
                            {record.assignedSections.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">
                                —
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1 items-center">
                                {record.assignedSections.map((sec, secIdx) => (
                                  <span
                                    key={secIdx}
                                    className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100 text-[11px] font-bold"
                                  >
                                    {sec}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Weekly Periods Quota */}
                          <td className="p-3 text-center">
                            {record.totalPeriodsCount > 0 ? (
                              <span className="bg-purple-50 text-purple-700 font-extrabold px-2.5 py-1 rounded-lg border border-purple-200/80 text-[11px] inline-flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-purple-500" />
                                {record.totalPeriodsCount} حصة
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Open Teacher Timetable Schedule */}
                              <button
                                type="button"
                                onClick={() => handleOpenTeacherTimetable(record.name)}
                                className="text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 border border-purple-200 shadow-2xs"
                                title="عرض جدول الحصص الأسبوعي لهذا المعلم"
                              >
                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                <span>جدول الحصص</span>
                              </button>

                              {/* Manage Subjects & Sections */}
                              <button
                                type="button"
                                onClick={() => {
                                  const tObj: Teacher = {
                                    id: record.id,
                                    name: record.name,
                                    phone: record.phone || "",
                                    subject: record.specialty,
                                    specialty: record.specialty,
                                  };
                                  setManagingScheduleTeacher(tObj);
                                }}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1 border border-blue-200 shadow-2xs"
                                title="إدارة وتعديل المواد والشعب المسندة لهذا المعلم"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>المواد والشعب</span>
                              </button>

                              {/* Edit Data & Phone */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditTeacherModal(record)}
                                className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات ورقم المعلم"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDeleteIntegratedTeacher(record)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="حذف المعلم من السجل"
                              >
                                <Trash2 className="w-4 h-4" />
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

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW INQUIRY DETAILS & OFFICIAL REPORT */}
      {/* ========================================================================= */}
      {viewingInquiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تقرير استعلام وتقييم المعلم: {viewingInquiryModal.teacherName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    المادة: {viewingInquiryModal.subject} • الشعبة: {viewingInquiryModal.section || "—"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setViewingInquiryModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official printable report paper */}
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-6" id="printable-inquiry-report">
              
              {/* Report Header */}
              <div className="text-center pb-4 border-b border-slate-200 space-y-1">
                <span className="text-xs text-slate-500">المملكة العربية السعودية • وزارة التعليم</span>
                <h2 className="text-lg font-black text-slate-900">
                  {viewingInquiryModal.schoolName || schoolSignatories.schoolName || "ثانوية الأبناء الأولى"}
                </h2>
                <h3 className="text-sm font-bold text-emerald-700">
                  استمارة إفادة المعلم عن المستوى الدراسي والسلوكي للطالب
                </h3>
              </div>

              {/* Inquiry Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">المعلم:</span>
                  <strong className="text-slate-900 font-bold">{viewingInquiryModal.teacherName}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">المادة:</span>
                  <strong className="text-slate-900 font-bold">{viewingInquiryModal.subject}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">الشعبة:</span>
                  <strong className="text-slate-900 font-bold">{viewingInquiryModal.section || "—"}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">حالة الاعتماد:</span>
                  <strong className={viewingInquiryModal.isVerified ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                    {viewingInquiryModal.isVerified ? "معتمد رسمياً" : "قيد المتابعة"}
                  </strong>
                </div>
              </div>

              {/* Student Evaluations Details */}
              <div className="space-y-4">
                {viewingInquiryModal.students.map((st, idx) => {
                  const evalItem = viewingInquiryModal.evaluations?.find((e) => e.studentId === st.id);

                  return (
                    <div key={st.id} className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <h4 className="font-extrabold text-sm text-slate-900">
                          {idx + 1}. الطالب: {st.name}
                        </h4>
                        <span className="text-xs text-slate-500">
                          شعبة: {st.className || viewingInquiryModal.section || "—"}
                        </span>
                      </div>

                      {evalItem ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">التحصيل الدراسي:</span>
                            <span className="font-bold text-emerald-700">{evalItem.academicLevel}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">الانضباط الصفي:</span>
                            <span className="font-bold text-blue-700">{evalItem.disciplineLevel}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">السلوك والمواظبة:</span>
                            <span className="font-bold text-purple-700">{evalItem.behaviorLevel}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-slate-400 block text-[10px]">المشاركة والواجبات:</span>
                            <span className="font-bold text-amber-700">{evalItem.participationLevel}</span>
                          </div>

                          {evalItem.teacherNotes && (
                            <div className="col-span-2 sm:col-span-4 bg-slate-50 p-3 rounded-xl text-xs space-y-1">
                              <span className="text-slate-400 block text-[10px] font-bold">ملاحظات وتوصيات المعلم:</span>
                              <p className="text-slate-800 leading-relaxed">{evalItem.teacherNotes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs">
                          لم يقم المعلم بتعبئة تقييم هذا الطالب بعد.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Official Signatures Row */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[10px]">معلم المادة:</span>
                  <strong className="text-slate-800 font-bold block">{viewingInquiryModal.teacherName}</strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[10px]">الموجه الطلابي:</span>
                  <strong className="text-slate-800 font-bold block">
                    {schoolSignatories.counselorName || "أ. فهد التوجيه"}
                  </strong>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 block text-[10px]">مدير المدرسة:</span>
                  <strong className="text-slate-800 font-bold block">
                    {schoolSignatories.principalName || "أ. مدير المدرسة"}
                  </strong>
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير الرسمي</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingInquiryModal(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MANUAL TEACHER WITH SUBJECTS & SECTIONS */}
      {/* ========================================================================= */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">إضافة معلم جديد</h3>
                  <p className="text-[11px] text-slate-400">إضافة معلم مع إمكانية إسناد المواد والشعب الدراسية له فوراً</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddTeacherModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعلم الثلاثي أو الرباعي: <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newTeacherData.name}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                  placeholder="مثال: أ. إبراهيم محمد الغامدي"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التخصص الأساسي:</label>
                  <input
                    type="text"
                    value={newTeacherData.subject}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, subject: e.target.value })}
                    placeholder="مثال: رياضيات / فيزياء..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الجوال (واتساب): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newTeacherData.phone}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Assignments to assign right away */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>المواد والشعب المسندة للمعلم (اختياري - يمكنك إضافتها الآن أو لاحقاً):</span>
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">المواد التي يدرسها (افصل بفاصلة):</label>
                  <input
                    type="text"
                    value={newTeacherData.assignedSubjects}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, assignedSubjects: e.target.value })}
                    placeholder="مثال: الفيزياء 2، الكيمياء 1"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">الشعب التي يدرسها (افصل بفاصلة):</label>
                  <input
                    type="text"
                    value={newTeacherData.assignedSections}
                    onChange={(e) => setNewTeacherData({ ...newTeacherData, assignedSections: e.target.value })}
                    placeholder="مثال: شعبة 1، شعبة 2، شعبة 5"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddManualTeacher}
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
              >
                حفظ وإسناد المعلم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TEACHER DATA & PHONE */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-slate-900">تعديل بيانات المعلم</h3>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعلم:</label>
                <input
                  type="text"
                  value={editingTeacherData.name}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, name: e.target.value })}
                  placeholder="اسم المعلم"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المادة / التخصص:</label>
                <input
                  type="text"
                  value={editingTeacherData.subject}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, subject: e.target.value })}
                  placeholder="المادة الدراسية"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف (الواتساب الذي ستصل إليه الرسالة):</label>
                <input
                  type="text"
                  value={editingTeacherData.phone}
                  onChange={(e) => setEditingTeacherData({ ...editingTeacherData, phone: e.target.value })}
                  placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono font-bold"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  تعديل هذا الرقم سيحدثه في سجل المعلمين وفي طلبات الاستعلام الجارية فوراً.
                </p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEditTeacher}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANAGE TEACHER SUBJECTS & SECTIONS IN TIMETABLE */}
      {/* ========================================================================= */}
      {managingScheduleTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold border border-blue-100">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    إدارة مواد وشعب المعلم: {managingScheduleTeacher.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    التخصص الأساسي: {managingScheduleTeacher.subject || managingScheduleTeacher.specialty || "عام"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingScheduleTeacher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Validation Banner */}
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">النظام الذكي لمطابقة المواد والشعب:</strong>
                <span>
                  يقوم النظام بالربط التلقائي الدقيق بين حصص المعلم وبيانات الطلاب بناءً على المواد والشعب المسجلة أدناه.
                </span>
              </div>
            </div>

            {/* Existing Assigned Subjects & Sections */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>المواد والشعب المسندة حالياً:</span>
                <span className="text-[11px] font-mono text-slate-400">
                  ({scheduleAssignments.filter((a) => (a.teacherName === managingScheduleTeacher.name || matchTeacherInRoster(a.teacherName, [managingScheduleTeacher]) !== undefined) && !isNonAcademicDuty(a.subject) && !isNonAcademicDuty(a.section)).length} مادة وشعبة)
                </span>
              </h4>

              {(() => {
                const currentTeacherAssignments = scheduleAssignments.filter(
                  (a) =>
                    (a.teacherName === managingScheduleTeacher.name ||
                    matchTeacherInRoster(a.teacherName, [managingScheduleTeacher]) !== undefined) &&
                    !isNonAcademicDuty(a.subject) &&
                    !isNonAcademicDuty(a.section)
                );

                if (currentTeacherAssignments.length === 0) {
                  return (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                      لا توجد مواد أو شعب مسندة لهذا المعلم بعد. يمكنك إضافة مادة وشعبة بالأسفل.
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                    {currentTeacherAssignments.map((asg) => (
                      <div
                        key={asg.id}
                        className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                            {asg.section.replace(/شعبة|فصل/g, "").trim() || "1"}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-900">{asg.subject}</div>
                            <div className="text-[11px] text-slate-500 font-bold">{asg.section}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTeacherAssignment(asg.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا الارتباط"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Add New Assignment Form */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-slate-900" />
                <span>إسناد مادة وشعبة جديدة للمعلم:</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المادة الدراسية:</label>
                  <input
                    type="text"
                    value={newAssignmentSubject}
                    onChange={(e) => setNewAssignmentSubject(e.target.value)}
                    placeholder="مثال: فيزياء 2، كفايات 1"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الشعبة / الفصل:</label>
                  <input
                    type="text"
                    value={newAssignmentSection}
                    onChange={(e) => setNewAssignmentSection(e.target.value)}
                    placeholder="مثال: شعبة 5 أو 5"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleAddTeacherAssignment(managingScheduleTeacher.name)}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة المادة والشعبة للمعلم</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 flex items-center justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setManagingScheduleTeacher(null)}
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD EXTRA TEACHER TO STEP 2 */}
      {/* ========================================================================= */}
      {showAddExtraTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">إضافة معلم إضافي للاستعلام</h3>
              <button
                onClick={() => setShowAddExtraTeacherModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر المعلم من السجل:</label>
                <select
                  value={selectedExtraTeacherId}
                  onChange={(e) => {
                    setSelectedExtraTeacherId(e.target.value);
                    const found = teachers.find((t) => t.id === e.target.value);
                    if (found && found.subject) {
                      setExtraTeacherSubject(found.subject);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">-- اختر معلماً من القائمة --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject || "بدون مادة"}) - {t.phone || "بدون رقم"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المادة المراد الاستعلام عنها:</label>
                <input
                  type="text"
                  value={extraTeacherSubject}
                  onChange={(e) => setExtraTeacherSubject(e.target.value)}
                  placeholder="مثال: لغتي الخالدة، رياضيات..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddExtraTeacherModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddExtraTeacher}
                disabled={!selectedExtraTeacherId}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                إضافة للقائمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: OFFICIAL CONSOLIDATED STUDENT EVALUATION REPORT (A4 PRINTABLE) */}
      {/* ========================================================================= */}
      {viewingConsolidatedModal && (
        <ConsolidatedStudentReportModal
          studentEval={viewingConsolidatedModal}
          allAggregatedStudents={aggregatedStudentsList}
          schoolSignatories={schoolSignatories}
          onClose={() => setViewingConsolidatedModal(null)}
          onSelectAnotherStudent={(st) => setViewingConsolidatedModal(st)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: INTERACTIVE SCHEDULE PREVIEW WORKBENCH */}
      {/* ========================================================================= */}
      {showScheduleWorkbench && (
        <SchedulePreviewWorkbench
          isOpen={showScheduleWorkbench}
          assignments={workbenchAssignments.length > 0 ? workbenchAssignments : scheduleAssignments}
          teachers={teachers}
          detectedTeachers={workbenchDetectedTeachers}
          detectedSections={workbenchDetectedSections}
          defaultSelectedSection={workbenchDefaultSection}
          defaultSelectedTeacher={workbenchDefaultTeacher}
          isInitialUpload={isWorkbenchInitialUpload}
          onConfirmSchedule={handleConfirmScheduleFromWorkbench}
          onClose={() => {
            setShowScheduleWorkbench(false);
            setIsWorkbenchInitialUpload(false);
          }}
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
