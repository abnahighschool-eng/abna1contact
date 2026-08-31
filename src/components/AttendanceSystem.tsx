import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  UserX, 
  Clock, 
  Bell, 
  Send, 
  Printer, 
  Search, 
  CheckCircle2, 
  AlertTriangle,
  Check,
  X,
  Smartphone,
  Sparkles,
  Calendar,
  School,
  Loader2,
  Zap,
  PauseCircle,
  XCircle,
  FileSpreadsheet,
  ShieldCheck,
  Bookmark,
  FileText,
  RotateCcw,
  ShieldAlert,
  History
} from "lucide-react";
import { Student, SchoolSignatories } from "../types";
import { saveAttendanceDataToCloud } from "../firebaseService";
import GuidanceAbsenceWorkflow from "./GuidanceAbsenceWorkflow";
import DisciplineReportsPrinter from "./DisciplineReportsPrinter";

interface AttendanceSystemProps {
  students: Student[];
  signatories: SchoolSignatories;
  isWhatsAppConnected: boolean;
  onNavigateToMessages: (tab?: "connection" | "upload" | "send" | "individual" | "reports") => void;
}


// Utility: Normalize and extract phone number from any Excel column format
export function extractStudentPhone(student: any): string {
  if (!student) return "";
  const phoneKeys = [
    "phone", "mobile", "رقم الجوال", "جوال", "الجوال", "الهاتف", "رقم الهاتف",
    "هاتف", "رقم_الجوال", "رقم_الهاتف", "جوال ولي الأمر", "جوال_ولي_الأمر",
    "جوال ولي الامر", "جوال_ولي_الامر", "هاتف ولي الأمر", "هاتف_ولي_الأمر",
    "هاتف ولي الامر", "هاتف_ولي_الامر", "رقم جوال ولي الامر", "رقم جوال ولي الأمر",
    "جوال الأب", "جوال الاب", "جوال الأم", "جوال الام", "هاتف المنزل",
    "mobile_phone", "phone_number", "contact", "المحمول"
  ];

  for (const k of phoneKeys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return String(student[k]).trim();
    }
  }

  // Fallback: check all object keys containing phone/mobile keywords
  for (const [k, v] of Object.entries(student)) {
    if (v && typeof v !== "object") {
      const lower = k.toLowerCase();
      if (k.includes("جوال") || k.includes("هاتف") || lower.includes("phone") || lower.includes("mobile")) {
        return String(v).trim();
      }
    }
  }
  return "";
}

// Utility: Extract student name
export function extractStudentName(student: any, fallbackIdx = 1): string {
  if (!student) return `طالب ${fallbackIdx}`;
  const nameKeys = [
    "name", "studentName", "اسم الطالب", "اسم_الطالب", "اسم الطالب رباعي",
    "اسم الطالب ثلاثي", "الاسم", "اسم_الطالب_رباعي", "اسم_الطالب_ثلاثي", "طالب"
  ];

  for (const k of nameKeys) {
    if (student[k] && String(student[k]).trim() !== "") {
      return String(student[k]).trim();
    }
  }

  for (const [k, v] of Object.entries(student)) {
    if (v && typeof v !== "object") {
      if (k.includes("اسم") || k.toLowerCase().includes("name")) {
        return String(v).trim();
      }
    }
  }
  return `طالب ${fallbackIdx}`;
}

// Utility: Extract Grade
export function extractStudentGrade(student: any): string {
  if (!student) return "";
  const gradeKeys = ["grade", "الصف", "المرحلة", "المستوى", "الصف الدراسي", "المرحلة الدراسية"];
  for (const k of gradeKeys) {
    if (student[k] && String(student[k]).trim() !== "") return String(student[k]).trim();
  }
  return "";
}

// Utility: Extract Class
export function extractStudentClass(student: any): string {
  if (!student) return "";
  const classKeys = ["className", "class", "الفصل", "الشعبة", "الصف/الفصل", "الفصل الدراسي"];
  for (const k of classKeys) {
    if (student[k] && String(student[k]).trim() !== "") return String(student[k]).trim();
  }
  return "";
}

interface BatchSendProgress {
  isOpen: boolean;
  isRunning: boolean;
  currentIndex: number;
  total: number;
  sentCount: number;
  failedCount: number;
  currentStudentName: string;
  countdownSeconds?: number;
  isCompleted?: boolean;
  logs: Array<{
    id: string;
    studentName: string;
    phone: string;
    status: "success" | "failed";
    message?: string;
    error?: string;
  }>;
}

export default function AttendanceSystem({
  students,
  signatories,
  isWhatsAppConnected,
  onNavigateToMessages,
}: AttendanceSystemProps) {
  const [activeSubTab, setActiveSubTab] = useState<"guidance_workflow" | "daily_absence" | "daily_tardiness" | "notifications" | "reports">("guidance_workflow");
  
  // Direct send message handler for Guidance workflow
  const handleDirectSendSingleMessage = async (
    phone: string, 
    message: string, 
    studentName: string, 
    grade?: string, 
    className?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message, studentName, grade, className })
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  // Selected date for attendance (YYYY-MM-DD)

  const getTodayISO = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());

  // Attendance Records State (persisted per date in localStorage + Cloud)
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, Record<string, {
    status: "present" | "absent_unexcused" | "absent_excused" | "tardy";
    tardyMinutes?: number;
    notes?: string;
    notified?: boolean;
    notifiedAt?: string;
  }>>>(() => {
    const saved = localStorage.getItem("school_attendance_records");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse attendance records", e);
      }
    }
    return {};
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "present" | "absent_unexcused" | "absent_excused" | "tardy">("ALL");

  // Notification Template States
  const [absenceTemplate, setAbsenceTemplate] = useState(
    "السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب {اسم الطالب} المحترم،\nنحيطكم علماً بغياب ابنكم اليوم {اليوم} الموافق {التاريخ} عن الدوام المدرسي ({نوع الغياب}). نرجو التواصل مع المدرسة وتبرير الغياب حرصاً على مستواه الدراسي.\n- {اسم المدرسة}"
  );

  const [tardinessTemplate, setTardinessTemplate] = useState(
    "السلام عليكم ورحمة الله وبركاته،\nولي أمر الطالب {اسم الطالب} المحترم،\nنحيطكم علماً بتأخر ابنكم اليوم {اليوم} الموافق {التاريخ} عن الاصطفاف الصباحي بمقدار ({دقائق التأخر} دقيقة). نرجو حثه على الالتزام بمواعيد الدوام الرسمي.\n- {اسم المدرسة}"
  );

  const [notificationStatus, setNotificationStatus] = useState<Record<string, "idle" | "sending" | "sent" | "failed">>({});
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("تم حفظ وتحديث رصد الحضور بنجاح");

  // Live Batch Sending Modal State
  const [batchProgress, setBatchProgress] = useState<BatchSendProgress>({
    isOpen: false,
    isRunning: false,
    currentIndex: 0,
    total: 0,
    sentCount: 0,
    failedCount: 0,
    currentStudentName: "",
    logs: [],
  });

  const abortBatchRef = useRef<boolean>(false);

  // Save to localStorage & Cloud whenever records change
  useEffect(() => {
    localStorage.setItem("school_attendance_records", JSON.stringify(attendanceRecords));
    saveAttendanceDataToCloud(attendanceRecords).catch(() => {});
  }, [attendanceRecords]);

  // Current day's records
  const currentDayData = useMemo(() => {
    return attendanceRecords[selectedDate] || {};
  }, [attendanceRecords, selectedDate]);

  // Extract available unique grades and classes dynamically from the official student roster
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    students.forEach((st) => {
      const g = extractStudentGrade(st);
      if (g) grades.add(g);
    });
    return Array.from(grades).sort();
  }, [students]);

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    students.forEach((st) => {
      const stGrade = extractStudentGrade(st);
      if (selectedGrade === "ALL" || (stGrade && stGrade === selectedGrade)) {
        const c = extractStudentClass(st);
        if (c) classes.add(c);
      }
    });
    return Array.from(classes).sort();
  }, [students, selectedGrade]);

  // Filtered student roster based on search and dropdown filters
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const studentName = extractStudentName(student);
      const studentPhone = extractStudentPhone(student);
      const studentId = student.id || student["رقم الهوية"] || student["السجل المدني"] || "";
      const studentGrade = extractStudentGrade(student);
      const studentClass = extractStudentClass(student);

      // Match Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = String(studentName).toLowerCase().includes(q);
        const matchesPhone = String(studentPhone).toLowerCase().includes(q);
        const matchesId = String(studentId).toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId) return false;
      }

      // Match Grade
      if (selectedGrade !== "ALL" && String(studentGrade).trim() !== selectedGrade) {
        return false;
      }

      // Match Class
      if (selectedClass !== "ALL" && String(studentClass).trim() !== selectedClass) {
        return false;
      }

      // Match Status Filter
      if (statusFilter !== "ALL") {
        const currentStatus = currentDayData[student.id]?.status || "present";
        if (currentStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedGrade, selectedClass, statusFilter, currentDayData]);

  // Quick Counts & Statistics for Selected Date
  const attendanceStats = useMemo(() => {
    let present = 0;
    let absentUnexcused = 0;
    let absentExcused = 0;
    let tardy = 0;

    students.forEach((st) => {
      const rec = currentDayData[st.id];
      const status = rec?.status || "present";
      if (status === "present") present++;
      else if (status === "absent_unexcused") absentUnexcused++;
      else if (status === "absent_excused") absentExcused++;
      else if (status === "tardy") tardy++;
    });

    const totalAbsent = absentUnexcused + absentExcused;
    const attendancePercentage = students.length > 0 ? Math.round((present / students.length) * 100) : 0;

    return {
      total: students.length,
      present,
      absentUnexcused,
      absentExcused,
      totalAbsent,
      tardy,
      attendancePercentage,
    };
  }, [students, currentDayData]);

  // Update a student's status for the current date
  const handleSetStudentStatus = (
    studentId: string, 
    status: "present" | "absent_unexcused" | "absent_excused" | "tardy",
    tardyMinutes?: number,
    notes?: string
  ) => {
    setAttendanceRecords((prev) => {
      const dayRecords = prev[selectedDate] ? { ...prev[selectedDate] } : {};
      
      if (status === "present") {
        dayRecords[studentId] = { status: "present" };
      } else {
        dayRecords[studentId] = {
          status,
          tardyMinutes: tardyMinutes !== undefined ? tardyMinutes : dayRecords[studentId]?.tardyMinutes || (status === "tardy" ? 15 : undefined),
          notes: notes !== undefined ? notes : dayRecords[studentId]?.notes || "",
          notified: dayRecords[studentId]?.notified || false,
          notifiedAt: dayRecords[studentId]?.notifiedAt,
        };
      }

      return {
        ...prev,
        [selectedDate]: dayRecords,
      };
    });

    setToastMessage("تم حفظ وتحديث رصد الحضور بنجاح");
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 1500);
  };

  // Bulk actions (Mark all filtered as present, absent, etc.)
  const handleBulkSetStatus = (status: "present" | "absent_unexcused" | "absent_excused") => {
    setAttendanceRecords((prev) => {
      const dayRecords = prev[selectedDate] ? { ...prev[selectedDate] } : {};
      
      filteredStudents.forEach((st) => {
        dayRecords[st.id] = {
          status,
          notes: status === "present" ? "" : (dayRecords[st.id]?.notes || ""),
          notified: status === "present" ? false : (dayRecords[st.id]?.notified || false),
        };
      });

      return {
        ...prev,
        [selectedDate]: dayRecords,
      };
    });

    setToastMessage(`تم تعيين حالة (${filteredStudents.length}) طالب بنجاح`);
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 2000);
  };

  // Format arabic day name
  const formattedDayName = useMemo(() => {
    try {
      const d = new Date(selectedDate + "T00:00:00");
      return d.toLocaleDateString("ar-SA", { weekday: "long" });
    } catch {
      return "اليوم";
    }
  }, [selectedDate]);

  // Construct dynamic personalized message for a student
  const constructNotificationMessage = (student: Student, type: "absence" | "tardiness") => {
    const studentName = extractStudentName(student);
    const studentGrade = extractStudentGrade(student);
    const studentClass = extractStudentClass(student);
    const studentRecord = currentDayData[student.id];
    const tardyMins = studentRecord?.tardyMinutes || 15;
    const isExcused = studentRecord?.status === "absent_excused";
    const notes = studentRecord?.notes || "";

    let tmpl = type === "absence" ? absenceTemplate : tardinessTemplate;

    let res = tmpl
      .replace(/{اسم الطالب}/g, studentName)
      .replace(/{الطالب}/g, studentName)
      .replace(/{الصف}/g, studentGrade)
      .replace(/{الفصل}/g, studentClass)
      .replace(/{اليوم}/g, formattedDayName)
      .replace(/{التاريخ}/g, selectedDate)
      .replace(/{اسم المدرسة}/g, signatories.schoolName || "إدارة المدرسة")
      .replace(/{دقائق التأخر}/g, String(tardyMins))
      .replace(/{نوع الغياب}/g, isExcused ? "بعذر مقبول" : "بدون عذر مسبق")
      .replace(/{سبب التأخر}/g, notes || "بدون عذر")
      .replace(/{ملاحظات}/g, notes);

    return res;
  };

  // List of students with absence or tardy records for notification/report view
  const recordedStudents = useMemo(() => {
    return students.filter((st) => {
      const status = currentDayData[st.id]?.status;
      return status === "absent_unexcused" || status === "absent_excused" || status === "tardy";
    });
  }, [students, currentDayData]);

  // Send single WhatsApp notification
  const handleSendSingleNotification = async (student: Student, type: "absence" | "tardiness") => {
    const studentPhone = extractStudentPhone(student);
    const studentName = extractStudentName(student);
    const studentGrade = extractStudentGrade(student);
    const studentClass = extractStudentClass(student);

    if (!studentPhone) {
      alert(`⚠️ لا يوجد رقم جوال مسجل للطالب (${studentName}) في الكشف المعتمد.`);
      return;
    }

    const message = constructNotificationMessage(student, type);
    setNotificationStatus((prev) => ({ ...prev, [student.id]: "sending" }));

    try {
      const response = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: studentPhone,
          message,
          studentName,
          grade: studentGrade,
          className: studentClass,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setNotificationStatus((prev) => ({ ...prev, [student.id]: "sent" }));
        
        // Mark as notified in attendance record
        const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
        setAttendanceRecords((prev) => {
          const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
          if (day[student.id]) {
            day[student.id] = {
              ...day[student.id],
              notified: true,
              notifiedAt: nowTime,
            };
          }
          return { ...prev, [selectedDate]: day };
        });

        // Add to local history for reports
        try {
          const newLog = {
            id: `ind_${Date.now()}`,
            phone: studentPhone,
            studentName,
            grade: studentGrade,
            className: studentClass,
            message,
            timestamp: `${new Date().toLocaleTimeString("ar-SA")} - ${new Date().toLocaleDateString("ar-SA")}`,
            status: "success",
          };
          const savedHistory = JSON.parse(localStorage.getItem("whatsapp_individual_history") || "[]");
          localStorage.setItem("whatsapp_individual_history", JSON.stringify([newLog, ...savedHistory]));
        } catch {
          // ignore
        }

        setToastMessage(`✓ تم إرسال إشعار ولي أمر (${studentName}) بنجاح`);
        setSaveSuccessToast(true);
        setTimeout(() => setSaveSuccessToast(false), 2500);
      } else {
        const errorText = data.error || "تعذر إرسال الرسالة، يرجى التحقق من اتصال الواتساب";
        setNotificationStatus((prev) => ({ ...prev, [student.id]: "failed" }));
        alert(`❌ تعذر إرسال الإشعار لـ (${studentName}):\n${errorText}`);
      }
    } catch (err: any) {
      setNotificationStatus((prev) => ({ ...prev, [student.id]: "failed" }));
      const errTxt = err.message || "فشل الاتصال بالخادم";
      alert(`❌ خطأ في الاتصال بالخادم:\n${errTxt}`);
    }
  };

  // Manual reset & clear attendance records for the selected date
  const handleResetCurrentDayAttendance = () => {
    if (recordedStudents.length === 0) {
      alert("لا يوجد أي طلاب مسجلين كغائبين أو متأخرين لهذا اليوم لتصفيرهم.");
      return;
    }

    if (window.confirm(`هل أنت متأكد من تصفير وإعادة تعيين رصد الغياب والتأخر لتاريخ (${selectedDate})؟\nسيتم إلغاء تحديد كافة الطلاب وإفراغ قائمة إشعارات أولياء الأمور لتكون جاهزة لرصد جديد.`)) {
      setAttendanceRecords((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
      setToastMessage("✓ تمت إعادة تصفير خانات رصد الغياب والتأخر وإفراغ قائمة الإشعارات بنجاح");
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 2500);
    }
  };

  // Launch Batch WhatsApp sending with interactive live modal and 15-second anti-ban interval
  const handleStartBatchNotifications = async () => {
    if (recordedStudents.length === 0) {
      alert("لا يوجد طلاب مسجلين كغائبين أو متأخرين لهذا اليوم لإرسال الإشعارات لهم.");
      return;
    }

    abortBatchRef.current = false;
    setBatchProgress({
      isOpen: true,
      isRunning: true,
      currentIndex: 0,
      total: recordedStudents.length,
      sentCount: 0,
      failedCount: 0,
      currentStudentName: "",
      countdownSeconds: 0,
      isCompleted: false,
      logs: [],
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recordedStudents.length; i++) {
      if (abortBatchRef.current) {
        break;
      }

      const student = recordedStudents[i];
      const studentName = extractStudentName(student);
      const studentPhone = extractStudentPhone(student);
      const studentGrade = extractStudentGrade(student);
      const studentClass = extractStudentClass(student);
      const status = currentDayData[student.id]?.status;
      const type = status === "tardy" ? "tardiness" : "absence";

      setBatchProgress((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentStudentName: studentName,
        countdownSeconds: 0,
      }));

      if (!studentPhone) {
        failed++;
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName,
              phone: "بدون جوال",
              status: "failed",
              error: "لا يوجد رقم جوال مسجل في الكشف",
            },
            ...prev.logs,
          ],
        }));
        setNotificationStatus((prev) => ({ ...prev, [student.id]: "failed" }));
        continue;
      }

      const message = constructNotificationMessage(student, type);

      try {
        const res = await fetch("/api/whatsapp/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: studentPhone,
            message,
            studentName,
            grade: studentGrade,
            className: studentClass,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          sent++;
          setNotificationStatus((prev) => ({ ...prev, [student.id]: "sent" }));
          
          // Mark in attendance records and persist
          const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
          setAttendanceRecords((prev) => {
            const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
            if (day[student.id]) {
              day[student.id] = {
                ...day[student.id],
                notified: true,
                notifiedAt: nowTime,
              };
            }
            const next = { ...prev, [selectedDate]: day };
            try {
              localStorage.setItem("attendance_records", JSON.stringify(next));
              saveAttendanceDataToCloud(next).catch(console.error);
            } catch (e) {
              console.error(e);
            }
            return next;
          });

          setBatchProgress((prev) => ({
            ...prev,
            sentCount: sent,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                status: "success",
                message: "تم الإرسال بنجاح عبر الواتساب",
              },
              ...prev.logs,
            ],
          }));
        } else {
          failed++;
          setNotificationStatus((prev) => ({ ...prev, [student.id]: "failed" }));
          setBatchProgress((prev) => ({
            ...prev,
            failedCount: failed,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName,
                phone: studentPhone,
                status: "failed",
                error: data.error || "فشل الإرسال عبر الخادم",
              },
              ...prev.logs,
            ],
          }));
        }
      } catch (err: any) {
        failed++;
        setNotificationStatus((prev) => ({ ...prev, [student.id]: "failed" }));
        setBatchProgress((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName,
              phone: studentPhone,
              status: "failed",
              error: err.message || "خطأ في الاتصال بالشبكة",
            },
            ...prev.logs,
          ],
        }));
      }

      // Safe 15-second Anti-Ban Delay with human-like jitter variation between messages (except for the last message)
      if (i < recordedStudents.length - 1 && !abortBatchRef.current) {
        // Safe 15-second interval + random jitter (between 14s and 18s)
        const jitterSecs = Math.floor(Math.random() * 4) - 1; // -1 to +2
        const totalDelaySecs = Math.max(14, 15 + jitterSecs);

        for (let countdown = totalDelaySecs; countdown > 0; countdown--) {
          if (abortBatchRef.current) break;
          setBatchProgress((prev) => ({
            ...prev,
            countdownSeconds: countdown,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // Batch sending completion
    if (!abortBatchRef.current) {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        isCompleted: true,
        countdownSeconds: 0,
      }));

      setToastMessage("✓ اكتمل إرسال الإشعارات بنجاح وتم توثيق كافة حالات الغياب والتأخر في كشف الانضباط والطباعة");
      setSaveSuccessToast(true);
      setTimeout(() => setSaveSuccessToast(false), 4000);
    } else {
      setBatchProgress((prev) => ({
        ...prev,
        isRunning: false,
        countdownSeconds: 0,
      }));
    }
  };

  // Launch as an Official Campaign in the Campaign Monitor with 15-second anti-ban interval
  const handleLaunchAsOfficialCampaign = async () => {
    if (recordedStudents.length === 0) {
      alert("لا يوجد طلاب مسجلين كغائبين أو متأخرين لهذا اليوم لإطلاق الحملة لهم.");
      return;
    }

    const campaignStudents = recordedStudents.map((student, idx) => {
      const studentName = extractStudentName(student, idx + 1);
      const studentPhone = extractStudentPhone(student);
      const studentGrade = extractStudentGrade(student);
      const studentClass = extractStudentClass(student);
      const status = currentDayData[student.id]?.status;
      const type = status === "tardy" ? "tardiness" : "absence";
      const customizedMessage = constructNotificationMessage(student, type);

      return {
        id: student.id || `st_${idx}`,
        name: studentName,
        "اسم الطالب": studentName,
        phone: studentPhone,
        "رقم الجوال": studentPhone,
        "الجوال": studentPhone,
        grade: studentGrade,
        "الصف": studentGrade,
        className: studentClass,
        "الفصل": studentClass,
        customMessage: customizedMessage,
      };
    });

    try {
      const campaignName = `حملة إشعارات غياب وتأخر (فاصل 15 ثانية آمن) - ${formattedDayName} (${selectedDate})`;
      const response = await fetch("/api/whatsapp/campaign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          students: campaignStudents,
          template: "{customMessage}",
          delayMs: 15000, // 15-second anti-ban delay
        }),
      });

      const data = await response.json();
      if (response.ok && data.campaignId) {
        localStorage.setItem("active_campaign_id", data.campaignId);
        
        // Mark all recorded students as notified in local state & cloud
        const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
        setAttendanceRecords((prev) => {
          const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
          recordedStudents.forEach((st) => {
            if (day[st.id]) {
              day[st.id] = { ...day[st.id], notified: true, notifiedAt: nowTime };
            }
          });
          const next = { ...prev, [selectedDate]: day };
          try {
            localStorage.setItem("attendance_records", JSON.stringify(next));
            saveAttendanceDataToCloud(next).catch(console.error);
          } catch (e) {
            console.error(e);
          }
          return next;
        });

        alert(`🚀 تم إطلاق (${campaignName}) بنجاح لعدد (${recordedStudents.length}) طالب بفاصل أمان (15 ثانية).\nتم حفظ وتوثيق بيانات الانضباط بنجاح!\nسيتم نقلك الآن لـ «حملة الإرسال الجماعي» لمتابعة الإرسال المباشر.`);
        onNavigateToMessages("send");
      } else {
        alert(`❌ تعذر إطلاق الحملة: ${data.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ في الاتصال بالخادم: ${err.message || ""}`);
    }
  };

  // Trigger browser print
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="attendance-system-view">
      
      {/* Save indicator toast */}
      {saveSuccessToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 text-xs font-bold animate-bounce no-print">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Official Master Roster & Connectivity Header */}
      <div className="bg-gradient-to-l from-slate-950 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl relative overflow-hidden no-print">
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الكشف المعتمد: كشوف الطلاب المرفوعة في نظام الرسائل ({students.length} طالب)</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <UserX className="w-6 h-6 text-amber-400 shrink-0" />
              <span>نظام إدارة الغياب والتأخر وإشعار أولياء الأمور</span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              رصد يومي للغياب والتأخر الصباحي مع إمكانية إرسال رسائل واتساب فورية لأولياء الأمور بالاعتماد على كشف الطلاب المعتمد.
            </p>
          </div>

          {/* Quick Roster Status & WhatsApp Connectivity Badge */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* WhatsApp Connection Indicator */}
            <div className={`px-3.5 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-bold ${
              isWhatsAppConnected 
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-amber-500/15 border-amber-500/30 text-amber-300"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isWhatsAppConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{isWhatsAppConnected ? "الواتساب متصل وجاهز" : "الواتساب غير متصل"}</span>
            </div>

            <button
              onClick={() => onNavigateToMessages("connection")}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/15 cursor-pointer"
              title="إدارة اتصال الواتساب"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>إعدادات الواتساب</span>
            </button>

            <button
              onClick={() => onNavigateToMessages("upload")}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-white/15 cursor-pointer"
              title="تحديث أو رفع كشف طلاب جديد"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تحديث الكشف</span>
            </button>
          </div>

        </div>

        {/* Decorative background blurs */}
        <div className="absolute top-0 left-0 -mt-10 -ml-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 -mb-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* WhatsApp Disconnection Warning Alert */}
      {!isWhatsAppConnected && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 no-print shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-amber-950">تنبيه اتصال الواتساب</h4>
              <p className="text-[11px] text-amber-800">
                حساب الواتساب غير متصل حالياً. لإرسال رسائل الغياب والتأخر لأولياء الأمور مباشرة، يرجى إتمام ربط الواتساب أولاً.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToMessages("connection")}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>ربط حساب الواتساب الآن</span>
          </button>
        </div>
      )}

      {/* Warning when no students exist yet for daily manual tabs */}
      {activeSubTab !== "guidance_workflow" && students.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4 no-print">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-amber-900">
              لم يتم رفع كشف الطلاب بعد
            </h3>
            <p className="text-xs text-amber-700 leading-relaxed">
              للبدء في رصد الغياب والتأخر اليومي، يرجى رفع ملف كشف الطلاب من خلال "نظام الرسائل &gt; رفع كشوف الطلاب" ليكون هو المرجع المعتمد في كامل المنظومة.
            </p>
          </div>
          <button
            onClick={() => onNavigateToMessages("upload")}
            className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-md transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>الذهاب لرفع كشوف الطلاب الآن</span>
          </button>
        </div>
      )}

      {/* Main Attendance Module Interface */}
      <div className="space-y-6">
        
        {/* Subtabs for Attendance Module */}
        <div className="grid grid-cols-2 sm:grid-cols-5 bg-white border border-slate-200/80 p-1.5 rounded-2xl shadow-xs text-xs font-semibold text-slate-600 gap-1.5 no-print" id="attendance-subtabs">
          
          {/* 1. Noor Extractor & Guidance Actions Tab (Default Primary) */}
          <button
            onClick={() => setActiveSubTab("guidance_workflow")}
            className={`py-3 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              activeSubTab === "guidance_workflow"
                ? "bg-emerald-600 text-white shadow-sm font-black"
                : "hover:bg-slate-50 hover:text-slate-900 bg-emerald-50/60 text-emerald-900 border border-emerald-200/70"
            }`}
            id="tab-btn-guidance-workflow"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>سحب غيابات نور وإجراءات التوجيه</span>
          </button>

          <button
            onClick={() => setActiveSubTab("daily_absence")}
            className={`py-3 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "daily_absence"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="tab-btn-daily-absence"
          >
            <UserX className="w-4 h-4" />
            <span>رصد الغياب اليومي</span>
            {attendanceStats.totalAbsent > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {attendanceStats.totalAbsent}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("daily_tardiness")}
            className={`py-3 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "daily_tardiness"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="tab-btn-daily-tardiness"
          >
            <Clock className="w-4 h-4" />
            <span>رصد التأخر الصباحي</span>
            {attendanceStats.tardy > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {attendanceStats.tardy}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("notifications")}
            className={`py-3 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "notifications"
                ? "bg-slate-900 text-white shadow-sm font-bold"
                : "hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="tab-btn-attendance-notifications"
          >
            <Bell className="w-4 h-4" />
            <span>إشعارات أولياء الأمور</span>
            {recordedStudents.length > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {recordedStudents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("reports")}
            className={`py-3 px-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "reports"
                ? "bg-emerald-700 text-white shadow-sm font-bold"
                : "hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="tab-btn-attendance-reports"
          >
            <Printer className="w-4 h-4" />
            <span>كشف الانضباط والطباعة</span>
          </button>
        </div>

        {/* 0. Subtab: Noor Extractor & Guidance Procedures Workflow */}
        {activeSubTab === "guidance_workflow" && (
          <GuidanceAbsenceWorkflow
            students={students}
            signatories={signatories}
            isWhatsAppConnected={isWhatsAppConnected}
            onSendSingleMessage={handleDirectSendSingleMessage}
          />
        )}

        {/* Global Attendance Controls & Stats Bar for Manual Daily Tabs */}
        {activeSubTab !== "guidance_workflow" && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xs space-y-4 no-print">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              
              {/* Date Selector */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">تاريخ رصد الحضور والغياب</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                      id="attendance-date-picker"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      ({formattedDayName})
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions & Roster origin badge */}
              <div className="flex items-center gap-2">
                {recordedStudents.length > 0 && (
                  <button
                    onClick={handleResetCurrentDayAttendance}
                    className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1.5 transition-all border border-red-200 cursor-pointer shadow-2xs"
                    title="تصفير علامات الغياب والتأخر وإفراغ قائمة الإشعارات"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تصفير رصد اليوم ({recordedStudents.length})</span>
                  </button>
                )}

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>الأسماء منعكسة تلقائياً من كشف الطلاب المعتمد</span>
                </div>
              </div>

            </div>

            {/* Attendance Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-right">
                <span className="text-[11px] font-bold text-slate-500 block">إجمالي الطلاب</span>
                <span className="text-lg font-extrabold text-slate-900">{attendanceStats.total}</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 text-right">
                <span className="text-[11px] font-bold text-emerald-700 block">الحاضرون اليوم</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold text-emerald-800">{attendanceStats.present}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">({attendanceStats.attendancePercentage}%)</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200/80 rounded-2xl p-3 text-right">
                <span className="text-[11px] font-bold text-red-700 block">غائب بدون عذر</span>
                <span className="text-lg font-extrabold text-red-800">{attendanceStats.absentUnexcused}</span>
              </div>

              <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-3 text-right">
                <span className="text-[11px] font-bold text-blue-700 block">غائب بعذر مقبول</span>
                <span className="text-lg font-extrabold text-blue-800">{attendanceStats.absentExcused}</span>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3 text-right col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-amber-700 block">المتأخرون صباحاً</span>
                <span className="text-lg font-extrabold text-amber-800">{attendanceStats.tardy}</span>
              </div>

            </div>

          </div>
        )}


          {/* 1. Subtab: Daily Absence Recording */}
          {activeSubTab === "daily_absence" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 no-print">
              
              {/* Filter Bar (Search + Grade Dropdown + Class Dropdown + Bulk Actions) */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                
                {/* Search & Selects */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  
                  {/* Search Bar */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="بحث باسم الطالب أو رقم الجوال أو الهوية..."
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Grade Filter */}
                  {availableGrades.length > 0 && (
                    <select
                      value={selectedGrade}
                      onChange={(e) => {
                        setSelectedGrade(e.target.value);
                        setSelectedClass("ALL");
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="ALL">جميع الصفوف ({students.length})</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Class Filter */}
                  {availableClasses.length > 0 && (
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="ALL">جميع الفصول</option>
                      {availableClasses.map((c) => (
                        <option key={c} value={c}>
                          فصل: {c}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="ALL">جميع الحالات</option>
                    <option value="present">الحاضرون فقط</option>
                    <option value="absent_unexcused">غائب بدون عذر</option>
                    <option value="absent_excused">غائب بعذر</option>
                    <option value="tardy">متأخر</option>
                  </select>

                </div>

                {/* Bulk Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleBulkSetStatus("present")}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                    title="تعيين جميع الطلاب المعروضين كـ حاضرين"
                  >
                    رصد المعروضين (حضور)
                  </button>

                  <button
                    onClick={() => setActiveSubTab("notifications")}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <Bell className="w-3.5 h-3.5 text-emerald-400" />
                    <span>إرسال إشعارات الغياب والتأخر ({attendanceStats.totalAbsent + attendanceStats.tardy})</span>
                  </button>
                </div>

              </div>

              {/* Students Attendance Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3 min-w-[180px]">اسم الطالب</th>
                        <th className="p-3 min-w-[100px]">الصف</th>
                        <th className="p-3 min-w-[80px]">الفصل</th>
                        <th className="p-3 min-w-[120px]">جوال ولي الأمر</th>
                        <th className="p-3 min-w-[260px] text-center">حالة الحضور والغياب اليوم</th>
                        <th className="p-3 min-w-[140px]">ملاحظات / السبب</th>
                        <th className="p-3 min-w-[110px] text-center">إشعار فوري</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                            لا توجد نتائج مطابقة لبحثك في كشف الطلاب المعتمد.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, idx) => {
                          const studentName = extractStudentName(student, idx + 1);
                          const studentGrade = extractStudentGrade(student) || "-";
                          const studentClass = extractStudentClass(student) || "-";
                          const studentPhone = extractStudentPhone(student) || "-";
                          
                          const record = currentDayData[student.id];
                          const currentStatus = record?.status || "present";
                          const notes = record?.notes || "";
                          const notifState = notificationStatus[student.id];
                          const isAbsent = currentStatus === "absent_unexcused" || currentStatus === "absent_excused";
                          const isTardy = currentStatus === "tardy";

                          return (
                            <tr 
                              key={student.id} 
                              className={`transition-colors ${
                                currentStatus === "absent_unexcused" 
                                  ? "bg-red-50/50 hover:bg-red-50" 
                                  : currentStatus === "absent_excused"
                                  ? "bg-blue-50/50 hover:bg-blue-50"
                                  : currentStatus === "tardy"
                                  ? "bg-amber-50/50 hover:bg-amber-50"
                                  : "hover:bg-slate-50/80"
                              }`}
                            >
                              <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                              
                              <td className="p-3 font-bold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span>{studentName}</span>
                                  {record?.notified && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold" title={`تم الإشعار في ${record.notifiedAt || ""}`}>
                                      تم الإشعار ✓
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 text-slate-600 font-semibold">{studentGrade}</td>
                              <td className="p-3 text-slate-600 font-semibold">{studentClass}</td>
                              <td className="p-3 font-mono text-slate-600 text-[11px]" dir="ltr">{studentPhone}</td>

                              {/* Interactive 3-Way Status Toggle */}
                              <td className="p-2.5">
                                <div className="flex items-center justify-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
                                  
                                  {/* Present */}
                                  <button
                                    onClick={() => handleSetStudentStatus(student.id, "present")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                      currentStatus === "present"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-600 hover:bg-white hover:text-slate-900"
                                    }`}
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>حاضر</span>
                                  </button>

                                  {/* Absent Unexcused */}
                                  <button
                                    onClick={() => handleSetStudentStatus(student.id, "absent_unexcused")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                      currentStatus === "absent_unexcused"
                                        ? "bg-red-600 text-white shadow-xs"
                                        : "text-red-700 hover:bg-red-100/60"
                                    }`}
                                  >
                                    <X className="w-3 h-3" />
                                    <span>غائب بدون عذر</span>
                                  </button>

                                  {/* Absent Excused */}
                                  <button
                                    onClick={() => handleSetStudentStatus(student.id, "absent_excused")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                      currentStatus === "absent_excused"
                                        ? "bg-blue-600 text-white shadow-xs"
                                        : "text-blue-700 hover:bg-blue-100/60"
                                    }`}
                                  >
                                    <span>بعذر</span>
                                  </button>

                                </div>
                              </td>

                              {/* Notes Input */}
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  placeholder="ملاحظة أو سبب..."
                                  value={notes}
                                  onChange={(e) => handleSetStudentStatus(student.id, currentStatus, undefined, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                />
                              </td>

                              {/* Instant Send Action */}
                              <td className="p-2.5 text-center">
                                {(isAbsent || isTardy) ? (
                                  <button
                                    onClick={() => handleSendSingleNotification(student, isTardy ? "tardiness" : "absence")}
                                    disabled={notifState === "sending"}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer ${
                                      record?.notified
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                                        : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                                    }`}
                                    title="إرسال إشعار فوري لولي الأمر عبر واتساب"
                                  >
                                    {notifState === "sending" ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3 rotate-180 text-emerald-400" />
                                    )}
                                    <span>{notifState === "sending" ? "جارِ الإرسال..." : record?.notified ? "إعادة الإرسال" : "إشعار واتساب"}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>

                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 2. Subtab: Morning Tardiness Recording */}
          {activeSubTab === "daily_tardiness" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5 no-print">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-950">سجل رصد التأخر الصباحي</h3>
                    <p className="text-[11px] text-amber-800">
                      حدد الطلاب المتأخرين عن طابور الصباح أو الحصة الأولى وسجل دقائق التأخر لإشعار أولياء الأمور فوريًا.
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-xl">
                  المتأخرون اليوم: ({attendanceStats.tardy}) طالب
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن الطالب لرصد تأخره..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {availableGrades.length > 0 && (
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">جميع الصفوف</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tardiness Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3 min-w-[180px]">اسم الطالب</th>
                        <th className="p-3 min-w-[100px]">الصف والفصل</th>
                        <th className="p-3 min-w-[120px]">حالة التأخر</th>
                        <th className="p-3 min-w-[160px]">دقائق التأخر</th>
                        <th className="p-3 min-w-[180px]">سبب التأخر</th>
                        <th className="p-3 min-w-[120px] text-center">إشعار ولي الأمر</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredStudents.map((student, idx) => {
                        const studentName = extractStudentName(student, idx + 1);
                        const studentGrade = extractStudentGrade(student) || "-";
                        const studentClass = extractStudentClass(student) || "-";
                        const record = currentDayData[student.id];
                        const isTardy = record?.status === "tardy";
                        const tardyMins = record?.tardyMinutes || 15;
                        const notes = record?.notes || "";
                        const notifStatus = notificationStatus[student.id];

                        return (
                          <tr 
                            key={student.id} 
                            className={`transition-colors ${isTardy ? "bg-amber-50/60 font-semibold" : "hover:bg-slate-50"}`}
                          >
                            <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                            
                            <td className="p-3 font-bold text-slate-900">
                              {studentName}
                            </td>

                            <td className="p-3 text-slate-600">
                              {studentGrade} - فصل ({studentClass})
                            </td>

                            {/* Mark as tardy toggle */}
                            <td className="p-3">
                              <button
                                onClick={() => handleSetStudentStatus(student.id, isTardy ? "present" : "tardy", tardyMins, notes)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isTardy
                                    ? "bg-amber-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{isTardy ? "متأخر ✓" : "رصد كتأخر"}</span>
                              </button>
                            </td>

                            {/* Minutes selector */}
                            <td className="p-3">
                              {isTardy ? (
                                <select
                                  value={tardyMins}
                                  onChange={(e) => handleSetStudentStatus(student.id, "tardy", parseInt(e.target.value), notes)}
                                  className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-amber-950 focus:outline-none"
                                >
                                  <option value={5}>5 دقائق</option>
                                  <option value={10}>10 دقائق</option>
                                  <option value={15}>15 دقيقة</option>
                                  <option value={20}>20 دقيقة</option>
                                  <option value={30}>30 دقيقة (نصف ساعة)</option>
                                  <option value={45}>45 دقيقة (حصة كاملة)</option>
                                </select>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>

                            {/* Reason Notes */}
                            <td className="p-3">
                              {isTardy ? (
                                <input
                                  type="text"
                                  placeholder="سبب التأخر (مثال: ازدحام مروري)..."
                                  value={notes}
                                  onChange={(e) => handleSetStudentStatus(student.id, "tardy", tardyMins, e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                                />
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>

                            {/* Single Send WhatsApp Button */}
                            <td className="p-3 text-center">
                              {isTardy && (
                                <button
                                  onClick={() => handleSendSingleNotification(student, "tardiness")}
                                  disabled={notifStatus === "sending"}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer ${
                                    record?.notified
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-slate-900 hover:bg-slate-800 text-white"
                                  }`}
                                >
                                  {notifStatus === "sending" ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Smartphone className="w-3 h-3 text-emerald-400" />
                                  )}
                                  <span>{notifStatus === "sending" ? "جارِ الإرسال..." : record?.notified ? "تم الإشعار ✓" : "إشعار واتساب"}</span>
                                </button>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* 3. Subtab: Parent Notifications via WhatsApp */}
          {activeSubTab === "notifications" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6 no-print">
              
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-emerald-600" />
                    <span>إشعارات الغياب والتأخر لأولياء الأمور عبر الواتساب</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إرسال رسائل معتمدة ومخصصة لكافة أولياء أمور الطلاب المسجلين كغائبين أو متأخرين لتاريخ {selectedDate} ({recordedStudents.length} طالب).
                  </p>
                </div>

                {/* Primary Dual Actions: Direct Send OR Launch as Official Campaign */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  
                  {/* Direct Batch Sending */}
                  <button
                    onClick={handleStartBatchNotifications}
                    disabled={recordedStudents.length === 0}
                    className="flex-1 lg:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    id="btn-batch-send-notifications"
                  >
                    <Zap className="w-4 h-4 text-emerald-200" />
                    <span>إرسال الإشعارات للجميع فوريًا ({recordedStudents.length})</span>
                  </button>

                  {/* Launch as Official Campaign in Campaign Monitor */}
                  <button
                    onClick={handleLaunchAsOfficialCampaign}
                    disabled={recordedStudents.length === 0}
                    className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    title="إطلاق كحملة إرسال في نظام الرسائل مع شريط تقدم مباشر"
                  >
                    <Send className="w-4 h-4 rotate-180 text-emerald-400" />
                    <span>إطلاق كحملة إرسال جماعي</span>
                  </button>

                </div>
              </div>

              {/* Template Customizer Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Absence Template */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5 text-red-600" />
                      <span>نص رسالة الغياب (واتساب)</span>
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">قالب الغياب</span>
                  </div>
                  <textarea
                    rows={4}
                    value={absenceTemplate}
                    onChange={(e) => setAbsenceTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed font-sans"
                  />
                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 items-center pt-1">
                    <span className="font-bold text-slate-600">المتغيرات:</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اسم الطالب}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{الصف}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{الفصل}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اليوم}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{التاريخ}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{نوع الغياب}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اسم المدرسة}"}</span>
                  </div>
                </div>

                {/* Tardiness Template */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>نص رسالة التأخر الصباحي (واتساب)</span>
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">قالب التأخر</span>
                  </div>
                  <textarea
                    rows={4}
                    value={tardinessTemplate}
                    onChange={(e) => setTardinessTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed font-sans"
                  />
                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-1 items-center pt-1">
                    <span className="font-bold text-slate-600">المتغيرات:</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اسم الطالب}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{الصف}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{الفصل}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{دقائق التأخر}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اليوم}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{التاريخ}"}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-700">{"{اسم المدرسة}"}</span>
                  </div>
                </div>

              </div>

              {/* Target Students List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    الطلاب المطلوب إشعار أولياء أمورهم لتاريخ {selectedDate} ({recordedStudents.length}):
                  </h4>
                </div>

                {recordedStudents.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 text-center text-slate-500 text-xs">
                    لا يوجد أي طالب مسجل كغائب أو متأخر لتاريخ {selectedDate}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {recordedStudents.map((student, idx) => {
                      const studentName = extractStudentName(student, idx + 1);
                      const studentPhone = extractStudentPhone(student) || "-";
                      const studentGrade = extractStudentGrade(student) || "-";
                      const studentClass = extractStudentClass(student) || "-";
                      const rec = currentDayData[student.id];
                      const status = rec?.status;
                      const isTardy = status === "tardy";
                      const isExcused = status === "absent_excused";
                      const notifStatus = notificationStatus[student.id];

                      return (
                        <div
                          key={student.id}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-3 text-right hover:border-slate-300 transition-all shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                isTardy 
                                  ? "bg-amber-100 text-amber-800 border border-amber-200" 
                                  : isExcused
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}>
                                {isTardy ? `تأخر (${rec?.tardyMinutes || 15} دقيقة)` : isExcused ? "غياب بعذر مقبول" : "غياب بدون عذر"}
                              </span>

                              <span className="text-[11px] font-mono text-slate-600 font-bold bg-white px-2 py-0.5 rounded border border-slate-200" dir="ltr">
                                {studentPhone}
                              </span>
                            </div>

                            <h5 className="text-sm font-bold text-slate-900">{studentName}</h5>
                            <span className="text-[11px] text-slate-500 font-semibold">{studentGrade} - فصل ({studentClass})</span>
                          </div>

                          <div className="pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-500 font-medium">
                              {rec?.notified ? (
                                <span className="text-emerald-700 font-bold">تم الإشعار ✓ ({rec.notifiedAt || ""})</span>
                              ) : (
                                "بانتظار الإرسال"
                              )}
                            </span>

                            <button
                              onClick={() => handleSendSingleNotification(student, isTardy ? "tardiness" : "absence")}
                              disabled={notifStatus === "sending"}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                                notifStatus === "sending"
                                  ? "bg-slate-300 text-slate-600"
                                  : rec?.notified
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                              }`}
                            >
                              {notifStatus === "sending" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3 rotate-180 text-emerald-300" />
                              )}
                              <span>
                                {notifStatus === "sending" 
                                  ? "جارِ الإرسال..." 
                                  : rec?.notified 
                                  ? "إعادة الإرسال" 
                                  : "إرسال واتساب"}
                              </span>
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* 4. Subtab: Official Printable Discipline & Attendance Report */}
          {activeSubTab === "reports" && (
            <div className="space-y-6">
              <DisciplineReportsPrinter 
                students={students} 
                attendanceRecords={attendanceRecords}
                signatories={signatories} 
                initialDate={selectedDate}
                isWhatsAppConnected={isWhatsAppConnected} 
                onUpdateSignatory={(updated) => {
                  try {
                    const existing = signatories || {};
                    const merged = { ...existing, ...updated };
                    localStorage.setItem("school_signatories", JSON.stringify(merged));
                  } catch (e) {
                    console.error(e);
                  }
                }}
                onNavigateToTab={(tab) => {
                  if (tab === "daily_absence" || tab === "daily_tardiness" || tab === "notifications" || tab === "reports") {
                    setActiveSubTab(tab);
                  }
                }}
              />
            </div>
          )}

        </div>

      {/* Live Interactive Batch Sender Modal with Anti-Ban Protection Display */}
      {batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right space-y-5 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                  batchProgress.isCompleted
                    ? "bg-emerald-100 text-emerald-700"
                    : batchProgress.isRunning
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700"
                }`}>
                  {batchProgress.isRunning ? <Loader2 className="w-5 h-5 animate-spin text-amber-700" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {batchProgress.isCompleted 
                      ? "اكتمل إرسال الإشعارات وتصفير الرصد بنجاح ✓"
                      : batchProgress.isRunning 
                      ? "جارِ إرسال إشعارات أولياء الأمور بأمان..." 
                      : "تم إيقاف عملية الإرسال"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {batchProgress.isRunning 
                      ? `جاري معالجة الطالب (${batchProgress.currentStudentName})...` 
                      : batchProgress.isCompleted
                      ? `تم إرسال الإشعارات لجميع الطلاب وإعادة تعيين خانات الرصد وتفريغ قائمة الإشعارات.`
                      : `تمت معالجة (${batchProgress.currentIndex}) من أصل (${batchProgress.total}) طالب.`}
                  </p>
                </div>
              </div>

              {!batchProgress.isRunning && (
                <button
                  onClick={() => setBatchProgress((prev) => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Anti-Ban Safety Protection Status Banner */}
            <div className="bg-emerald-950 text-white rounded-2xl p-3 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-emerald-300 block">درع الحماية الذكي من حظر الواتساب نشط</span>
                  <span className="text-[10px] text-emerald-100/80">فاصل أمان (15 ثانية) مع تفاوت زمني بشري عشوائي لمنع كشف الرسائل المتتابعة.</span>
                </div>
              </div>

              {batchProgress.isRunning && (batchProgress.countdownSeconds ?? 0) > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center gap-1.5 font-mono text-xs font-black shrink-0 animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>انتظار: {batchProgress.countdownSeconds}ث</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>التقدم الإجمالي ({batchProgress.currentIndex} من {batchProgress.total})</span>
                <span>{batchProgress.total > 0 ? Math.round((batchProgress.currentIndex / batchProgress.total) * 100) : 0}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.currentIndex / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Live Counters */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-bold">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200">
                <span className="text-[10px] text-emerald-600 block">تم الإرسال بنجاح</span>
                <span className="text-lg font-extrabold">{batchProgress.sentCount}</span>
              </div>
              <div className="p-3 bg-red-50 text-red-800 rounded-2xl border border-red-200">
                <span className="text-[10px] text-red-600 block">تعذر الإرسال</span>
                <span className="text-lg font-extrabold">{batchProgress.failedCount}</span>
              </div>
              <div className="p-3 bg-slate-50 text-slate-800 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">المتبقي</span>
                <span className="text-lg font-extrabold">{Math.max(0, batchProgress.total - batchProgress.currentIndex)}</span>
              </div>
            </div>

            {/* Live Logs Feed */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-600 block">سجل الإرسال المباشر:</span>
              <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                {batchProgress.logs.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 font-medium">جاري بدء عملية الإرسال الآمنة...</p>
                ) : (
                  batchProgress.logs.map((lg) => (
                    <div 
                      key={lg.id} 
                      className={`p-2 rounded-xl flex items-center justify-between text-right border ${
                        lg.status === "success" 
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                          : "bg-red-50/80 border-red-200 text-red-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {lg.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className="font-bold">{lg.studentName}</span>
                        <span className="text-[10px] font-mono text-slate-500" dir="ltr">{lg.phone}</span>
                      </div>
                      <span className="text-[11px] font-medium">{lg.error || lg.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {batchProgress.isRunning ? (
                <button
                  onClick={() => {
                    abortBatchRef.current = true;
                    setBatchProgress((prev) => ({ ...prev, isRunning: false }));
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center gap-2"
                >
                  <PauseCircle className="w-4 h-4" />
                  <span>إيقاف الإرسال الآن</span>
                </button>
              ) : (
                <button
                  onClick={() => setBatchProgress((prev) => ({ ...prev, isOpen: false }))}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>إغلاق والعودة لرصد جديد (جاهز)</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
