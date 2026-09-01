import React, { useState, useMemo } from "react";
import {
  UserCheck,
  Search,
  Filter,
  Send,
  Users,
  Calendar,
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
  Edit3
} from "lucide-react";
import {
  Student,
  Teacher,
  ScheduleAssignment,
  TeacherInquiryRequest,
  SchoolSignatories,
  StudentEvaluationItem
} from "../types";
import {
  parseTeachersExcelFile,
  parseScheduleExcelFile,
  findTeachersForSection,
  findAssignmentsForStudent,
  matchTeacherInRoster
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
}

type TabType = "new_inquiry" | "inquiries_log" | "teachers_schedule";

// Candidate Teacher Assignment
interface CandidateTeacher {
  key: string;
  teacherId?: string;
  teacherName: string;
  teacherPhone: string;
  subject: string;
  section: string;
  grade?: string;
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
  onNavigateToWhatsApp
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
  const [viewingInquiryModal, setViewingInquiryModal] = useState<TeacherInquiryRequest | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // --- 3. TEACHERS & SCHEDULE STATE ---
  const [teachersSearchTerm, setTeachersSearchTerm] = useState("");
  const [uploadingTeachers, setUploadingTeachers] = useState(false);
  const [uploadingSchedule, setUploadingSchedule] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Modals for adding & editing teachers
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState({ name: "", subject: "", phone: "" });
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingTeacherData, setEditingTeacherData] = useState<{ name: string; phone: string; subject: string }>({
    name: "",
    phone: "",
    subject: "",
  });

  // Extract unique grades and sections
  const uniqueGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((s) => {
      if (s.grade) grades.add(s.grade.trim());
    });
    return Array.from(grades);
  }, [students]);

  const uniqueSections = useMemo(() => {
    const sections = new Set<string>();
    students.forEach((s) => {
      const cls = s.className || (s as any)["الشعبة"] || (s as any)["الصف"] || "";
      if (cls) sections.add(cls.trim());
    });
    return Array.from(sections);
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        !studentSearchTerm ||
        s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        (s.nationalId && s.nationalId.includes(studentSearchTerm)) ||
        (s.id && s.id.includes(studentSearchTerm));

      const matchesGrade = selectedGrade === "all" || s.grade?.trim() === selectedGrade;
      const cls = s.className || (s as any)["الشعبة"] || "";
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
      const sec = s.className || (s as any)["الشعبة"] || (s as any)["الفصل"] || (s as any)["الصف"] || (s as any)["الصف/الفصل"] || "";
      if (sec) sectionSet.add(sec.trim());
    });

    const suggestions: CandidateTeacher[] = [];

    // Search timetable for each section
    sectionSet.forEach((sec) => {
      const matchingSchedule = findTeachersForSection(scheduleAssignments, sec);
      matchingSchedule.forEach((sched) => {
        // Find teacher phone and details from teacher roster using intelligent Arabic name matching
        const teacherObj = matchTeacherInRoster(sched.teacherName, teachers);
        const phone = teacherObj?.phone || sched.teacherPhone || "";
        const itemKey = `${sched.teacherName}_${sched.subject}_${sched.section}`;

        const exists = suggestions.some((item) => item.key === itemKey);

        if (!exists) {
          suggestions.push({
            key: itemKey,
            teacherId: teacherObj?.id || sched.teacherId,
            teacherName: teacherObj?.name || sched.teacherName,
            teacherPhone: phone,
            subject: sched.subject || teacherObj?.subjectSpecialty || teacherObj?.specialty || "المادة المقررة",
            section: sched.section || sec,
            grade: sched.grade,
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
          teacherPhone: t.phone || "",
          subject: t.subject || t.specialty || t.subjectSpecialty || "التقييم العام",
          section: Array.from(sectionSet)[0] || "شعبة عامة",
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

      onUpdateSchedule(result.assignments);

      // Save to server
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: result.assignments }),
      });

      setUploadMessage({
        type: "success",
        text: `تم استيراد ${result.assignments.length} ارتباط مادة وحصة في الجدول المدرسي بنجاح.`,
      });
    } catch (err: any) {
      setUploadMessage({ type: "error", text: err.message || "فشل استيراد الجدول المدرسي" });
    } finally {
      setUploadingSchedule(false);
      e.target.value = "";
    }
  };

  // Add Manual Teacher
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

    setNewTeacherData({ name: "", subject: "", phone: "" });
    setShowAddTeacherModal(false);
  };

  // Open Edit Teacher Modal
  const handleOpenEditTeacherModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditingTeacherData({
      name: teacher.name,
      phone: teacher.phone || "",
      subject: teacher.subject || teacher.specialty || "",
    });
  };

  // Save Edited Teacher
  const handleSaveEditTeacher = async () => {
    if (!editingTeacher) return;
    if (!editingTeacherData.name.trim()) {
      alert("يرجى إدخال اسم المعلم");
      return;
    }

    const updatedTeachers = teachers.map((t) => {
      if (t.id === editingTeacher.id) {
        return {
          ...t,
          name: editingTeacherData.name.trim(),
          phone: editingTeacherData.phone.trim(),
          subject: editingTeacherData.subject.trim(),
          specialty: editingTeacherData.subject.trim(),
        };
      }
      return t;
    });

    onUpdateTeachers(updatedTeachers);

    // Also update candidate teachers in step 2 if present
    setCandidateTeachers((prev) =>
      prev.map((item) => {
        if (item.teacherId === editingTeacher.id || item.teacherName.trim().toLowerCase() === editingTeacher.name.trim().toLowerCase()) {
          return {
            ...item,
            teacherName: editingTeacherData.name.trim(),
            teacherPhone: editingTeacherData.phone.trim(),
            subject: editingTeacherData.subject.trim() || item.subject,
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

      return matchesSearch && matchesStatus;
    });
  }, [inquiryRequests, logSearchTerm, logStatusFilter]);

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
                استعلام المعلمين عن الطلاب ومتابعة مستويات التحصيل والسلوك والانضباط عبر واتساب
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{teachers.length} معلماً مسجلاً</span>
            </span>
            <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{scheduleAssignments.length} حصة مجدولة</span>
            </span>
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
                  onChange={(e) => setSelectedGrade(e.target.value)}
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
                  <option value="all">جميع الشعب والصفوف</option>
                  {uniqueSections.map((s) => (
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
                    يمكنك تحديد كل أو بعض المعلمين، ومراجعة وتعديل أرقام هواتفهم قبل إرسال الرسائل
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
                        {/* Header: Checkbox + Teacher Name */}
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTeacherSelection(t.key)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer shrink-0"
                            />
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GraduationCap className={`w-4 h-4 shrink-0 ${isSelected ? "text-emerald-600" : "text-slate-400"}`} />
                              <h3 className={`font-extrabold truncate ${isSelected ? "text-slate-900" : "text-slate-600"}`}>
                                {t.teacherName}
                              </h3>
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

                        {/* Subject & Section Tags */}
                        <div className="flex items-center gap-2 text-slate-600 flex-wrap pr-6">
                          <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-700">
                            {t.subject}
                          </span>
                          {t.section && (
                            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                              شعبة: {t.section}
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
            
            {/* Filter Bar */}
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

              <div className="flex items-center gap-2 w-full sm:w-auto">
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
                        <div className="font-extrabold text-slate-700">
                          الطلاب المطلوب تقييمهم ({inq.students.length} طالب):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {inq.students.map((st) => {
                            const evalItem = inq.evaluations?.find((e) => e.studentId === st.id);
                            return (
                              <span
                                key={st.id}
                                className={`
                                  px-2.5 py-1 rounded-xl text-xs border font-medium flex items-center gap-1.5
                                  ${
                                    evalItem
                                      ? "bg-white text-emerald-800 border-emerald-200 shadow-xs"
                                      : "bg-white text-slate-700 border-slate-200"
                                  }
                                `}
                              >
                                <span>{st.name}</span>
                                {evalItem && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                    {evalItem.academicLevel}
                                  </span>
                                )}
                              </span>
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
                            <span>عرض التقييمات والتقرير</span>
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
            </div>

          </div>

          {/* Current Teachers Roster Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                سجل معلمي المدرسة المعتمدين ({teachers.length} معلماً)
              </h3>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={teachersSearchTerm}
                  onChange={(e) => setTeachersSearchTerm(e.target.value)}
                  placeholder="ابحث بالاسم أو المادة..."
                  className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>

            {teachers.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                لم يتم إدخال معلمين بعد. يمكنك رفع ملف إكسل أو إضافة معلم يدوياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold">
                      <th className="p-3 rounded-r-xl">م</th>
                      <th className="p-3">اسم المعلم</th>
                      <th className="p-3">المادة / التخصص</th>
                      <th className="p-3">رقم الجوال</th>
                      <th className="p-3 rounded-l-xl text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {teachers
                      .filter(
                        (t) =>
                          !teachersSearchTerm ||
                          t.name.toLowerCase().includes(teachersSearchTerm.toLowerCase()) ||
                          t.subject?.toLowerCase().includes(teachersSearchTerm.toLowerCase())
                      )
                      .map((t, idx) => (
                        <tr key={t.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-extrabold text-slate-900">{t.name}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-700">
                              {t.subject || t.specialty || "—"}
                            </span>
                          </td>
                          <td className="p-3 font-mono" dir="ltr">
                            {t.phone ? (
                              <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                {t.phone}
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-200">
                                غير مسجل
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditTeacherModal(t)}
                                className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="تعديل بيانات ورقم المعلم"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!confirm(`هل أنت متأكد من رغبتك في حذف المعلم (${t.name})؟`)) return;
                                  const updated = teachers.filter((_, i) => i !== idx);
                                  onUpdateTeachers(updated);
                                  fetch("/api/teachers", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ teachers: updated }),
                                  });
                                }}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="حذف المعلم"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
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
      {/* MODAL: ADD MANUAL TEACHER */}
      {/* ========================================================================= */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">إضافة معلم جديد</h3>
              <button
                onClick={() => setShowAddTeacherModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المعلم الثلاثي:</label>
                <input
                  type="text"
                  value={newTeacherData.name}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })}
                  placeholder="مثال: أ. إبراهيم محمد الغامدي"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المادة / مجال التدريس:</label>
                <input
                  type="text"
                  value={newTeacherData.subject}
                  onChange={(e) => setNewTeacherData({ ...newTeacherData, subject: e.target.value })}
                  placeholder="مثال: رياضيات، لغة عربية، فيزياء..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الجوال (واتساب):</label>
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

            <div className="pt-3 flex items-center justify-end gap-2">
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
                className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                حفظ المعلم
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

    </div>
  );
}
