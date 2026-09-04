import React, { useState, useEffect, useRef } from "react";
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
  Award,
  Building,
  School,
  Settings,
  CloudCheck,
  Cloud,
  Menu,
  X
} from "lucide-react";
import ConnectionPanel from "./components/ConnectionPanel";
import ExcelUploader from "./components/ExcelUploader";
import CampaignMonitor from "./components/CampaignMonitor";
import IndividualSender from "./components/IndividualSender";
import ReportsPrinter from "./components/ReportsPrinter";
import Sidebar, { MainSectionType } from "./components/Sidebar";
import HomeDashboard from "./components/HomeDashboard";
import AttendanceSystem from "./components/AttendanceSystem";
import LoginScreen from "./components/LoginScreen";
import UserManagement from "./components/UserManagement";
import StudentInquiry from "./components/StudentInquiry";
import TeachersScheduleManager from "./components/TeachersScheduleManager";
import TeacherEvaluationPortal from "./components/TeacherEvaluationPortal";
import { Student, WhatsAppConfig, SchoolSignatories, AppUser, Teacher, ScheduleAssignment, TeacherInquiryRequest } from "./types";
import { 
  loadInitialAppData, 
  saveSchoolDataToCloud, 
  saveStudentsDataToCloud,
  saveUsersDataToCloud,
  saveTeachersDataToCloud,
  saveScheduleDataToCloud,
  saveInquiriesDataToCloud,
  DEFAULT_ADMIN_USER,
  getCloudStorageStatus
} from "./firebaseService";
import { DEFAULT_SAMPLE_TEACHERS, DEFAULT_SAMPLE_SCHEDULE } from "./utils/teachersScheduleParser";
import { LogOut } from "lucide-react";

export default function App() {
  const [mainSection, setMainSection] = useState<MainSectionType>("messages");
  const [activeTab, setActiveTab] = useState<"connection" | "upload" | "send" | "individual" | "reports">("connection");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Authentication & Users State
  const [users, setUsers] = useState<AppUser[]>(() => {
    const savedUsers = localStorage.getItem("abna_system_users");
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [DEFAULT_ADMIN_USER];
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("abna_auth_current_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.status === "active") return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });

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

  // School Information & Signatories State (synced across server & browsers)
  const [signatories, setSignatories] = useState<SchoolSignatories>(() => {
    const saved = localStorage.getItem("school_signatories");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          countryName: parsed.countryName || "المملكة العربية السعودية",
          ministryName: parsed.ministryName || "وزارة التعليم",
          administrationName: parsed.administrationName || "الإدارة العامة للتعليم",
          schoolName: parsed.schoolName || "ثانوية الأبناء الأولى",
          principalName: parsed.principalName || "",
          vicePrincipalName: parsed.vicePrincipalName || "",
          counselorName: parsed.counselorName || "",
          systemManagerName: parsed.systemManagerName || "",
          logoUrl: parsed.logoUrl || "",
          logoWidth: parsed.logoWidth || 60,
          logoHeight: parsed.logoHeight || 60,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      countryName: "المملكة العربية السعودية",
      ministryName: "وزارة التعليم",
      administrationName: "الإدارة العامة للتعليم",
      schoolName: "ثانوية الأبناء الأولى",
      principalName: "",
      vicePrincipalName: "",
      counselorName: "",
      systemManagerName: "",
      logoUrl: "",
      logoWidth: 60,
      logoHeight: 60,
    };
  });
  
  const [showSignatoriesConfig, setShowSignatoriesConfig] = useState(false);
  const [signatoriesSavedToast, setSignatoriesSavedToast] = useState(false);

  // Direct Teacher Evaluation Portal URL parameter (?eval=<id>)
  const [evaluationInquiryId, setEvaluationInquiryId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("eval");
    }
    return null;
  });

  // Teachers, Timetable Schedule, and Inquiry Requests State
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem("abna_teachers_roster");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_SAMPLE_TEACHERS;
  });

  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>(() => {
    const saved = localStorage.getItem("abna_school_schedule");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any stale quota items from Column AI (such as section 12 or 18)
          return parsed.filter((a: ScheduleAssignment) => {
            if (a.id && a.id.includes("_34_")) return false;
            const sec = (a.section || "").trim();
            return sec !== "شعبة 12" && sec !== "شعبة 18" && sec !== "12" && sec !== "18";
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_SAMPLE_SCHEDULE;
  });

  const [inquiryRequests, setInquiryRequests] = useState<TeacherInquiryRequest[]>(() => {
    const saved = localStorage.getItem("abna_inquiry_requests");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Debounced cloud sync timer ref for template edits
  const templateSyncTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync state to Cloud Firestore, server & local storage
  const handleUpdateSignatory = (field: keyof SchoolSignatories, val: any) => {
    const updated = { ...signatories, [field]: val };
    setSignatories(updated);
    localStorage.setItem("school_signatories", JSON.stringify(updated));
    setSignatoriesSavedToast(true);
    setTimeout(() => setSignatoriesSavedToast(false), 2000);

    // Save to Cloud Firestore (Single lightweight write)
    saveSchoolDataToCloud(updated, template).catch(() => {});

    // Save to local server
    fetch("/api/app-state/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  const handleBulkUpdateSignatories = (updatedFields: Partial<SchoolSignatories>) => {
    const updated = { ...signatories, ...updatedFields };
    setSignatories(updated);
    localStorage.setItem("school_signatories", JSON.stringify(updated));
    setSignatoriesSavedToast(true);
    setTimeout(() => setSignatoriesSavedToast(false), 2000);

    // Save to Cloud Firestore (Single lightweight write)
    saveSchoolDataToCloud(updated, template).catch(() => {});

    // Save to local server
    fetch("/api/app-state/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {});
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/whatsapp/config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch {
      // Handled quietly
    }
  };

  // Hydrate full state from Cloud Firestore and Server on app mount
  const fetchFullAppState = async () => {
    try {
      // 1. First fetch from Cloud Firestore (Permanent storage across devices/browsers)
      const cloudData = await loadInitialAppData();
      
      if (cloudData.schoolSignatories) {
        setSignatories(prev => ({ ...prev, ...cloudData.schoolSignatories }));
        localStorage.setItem("school_signatories", JSON.stringify(cloudData.schoolSignatories));
      }
      if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
        setStudents(cloudData.students);
        localStorage.setItem("whatsapp_student_list", JSON.stringify(cloudData.students));
      }
      if (cloudData.savedTemplate) {
        setTemplate(cloudData.savedTemplate);
        localStorage.setItem("whatsapp_student_template", cloudData.savedTemplate);
      }
      if (Array.isArray(cloudData.users) && cloudData.users.length > 0) {
        setUsers(cloudData.users);
        localStorage.setItem("abna_system_users", JSON.stringify(cloudData.users));
      }
      if (Array.isArray(cloudData.teachers) && cloudData.teachers.length > 0) {
        setTeachers(cloudData.teachers);
        localStorage.setItem("abna_teachers_roster", JSON.stringify(cloudData.teachers));
      }
      if (Array.isArray(cloudData.scheduleAssignments) && cloudData.scheduleAssignments.length > 0) {
        const cleanCloudSchedule = cloudData.scheduleAssignments.filter((a: ScheduleAssignment) => {
          if (a.id && a.id.includes("_34_")) return false;
          const sec = (a.section || "").trim();
          return sec !== "شعبة 12" && sec !== "شعبة 18" && sec !== "12" && sec !== "18";
        });
        setScheduleAssignments(cleanCloudSchedule);
        localStorage.setItem("abna_school_schedule", JSON.stringify(cleanCloudSchedule));
      }
      if (Array.isArray(cloudData.inquiryRequests) && cloudData.inquiryRequests.length > 0) {
        setInquiryRequests(cloudData.inquiryRequests);
        localStorage.setItem("abna_inquiry_requests", JSON.stringify(cloudData.inquiryRequests));
      }

      // 2. Sync from local server state (Live source of truth for inquiries & real-time evaluations)
      const res = await fetch("/api/app-state");
      if (res.ok) {
        const data = await res.json();
        if (data.settings && !cloudData.schoolSignatories) {
          setSignatories(prev => ({ ...prev, ...data.settings }));
          localStorage.setItem("school_signatories", JSON.stringify(data.settings));
        }
        if (Array.isArray(data.students) && data.students.length > 0 && (!cloudData.students || cloudData.students.length === 0)) {
          setStudents(data.students);
          localStorage.setItem("whatsapp_student_list", JSON.stringify(data.students));
        }
        if (data.template && !cloudData.savedTemplate) {
          setTemplate(data.template);
          localStorage.setItem("whatsapp_student_template", data.template);
        }
        if (Array.isArray(data.users) && data.users.length > 0 && (!cloudData.users || cloudData.users.length === 0)) {
          setUsers(data.users);
          localStorage.setItem("abna_system_users", JSON.stringify(data.users));
        }
        if (Array.isArray(data.teachers) && data.teachers.length > 0 && (!cloudData.teachers || cloudData.teachers.length === 0)) {
          setTeachers(data.teachers);
          localStorage.setItem("abna_teachers_roster", JSON.stringify(data.teachers));
        }
        if (Array.isArray(data.schedule) && data.schedule.length > 0 && (!cloudData.scheduleAssignments || cloudData.scheduleAssignments.length === 0)) {
          const cleanServerSchedule = data.schedule.filter((a: ScheduleAssignment) => {
            if (a.id && a.id.includes("_34_")) return false;
            const sec = (a.section || "").trim();
            return sec !== "شعبة 12" && sec !== "شعبة 18" && sec !== "12" && sec !== "18";
          });
          setScheduleAssignments(cleanServerSchedule);
          localStorage.setItem("abna_school_schedule", JSON.stringify(cleanServerSchedule));
        }
        if (Array.isArray(data.inquiries) && data.inquiries.length > 0) {
          setInquiryRequests(data.inquiries);
          localStorage.setItem("abna_inquiry_requests", JSON.stringify(data.inquiries));
        }
      }
    } catch (e) {
      console.error("Could not fetch remote app-state", e);
    }
  };

  // Dedicated real-time sync for inquiries so teacher submissions reflect instantly
  const syncInquiriesFromServer = async () => {
    try {
      const res = await fetch("/api/inquiries");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.inquiries)) {
          setInquiryRequests((prev) => {
            // Check if there are changes before triggering re-renders
            const prevSerialized = JSON.stringify(prev);
            const nextSerialized = JSON.stringify(data.inquiries);
            if (prevSerialized !== nextSerialized) {
              localStorage.setItem("abna_inquiry_requests", nextSerialized);
              return data.inquiries;
            }
            return prev;
          });
        }
      }
    } catch {
      // Quiet background polling error handling
    }
  };

  const handleLoginSuccess = (user: AppUser) => {
    // Update lastLogin
    const updatedUsers = users.map((u) => (u.id === user.id ? { ...u, lastLogin: new Date().toISOString() } : u));
    setUsers(updatedUsers);
    localStorage.setItem("abna_system_users", JSON.stringify(updatedUsers));
    saveUsersDataToCloud(updatedUsers).catch(() => {});

    const activeLoggedInUser = { ...user, lastLogin: new Date().toISOString() };
    setCurrentUser(activeLoggedInUser);
    localStorage.setItem("abna_auth_current_user", JSON.stringify(activeLoggedInUser));
    
    // Redirect to default home or admin section depending on user
    if (activeLoggedInUser.role === "admin") {
      setMainSection("messages");
    } else {
      setMainSection("messages");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("abna_auth_current_user");
    setMainSection("messages");
  };

  const handleSaveUsers = (updatedUsers: AppUser[]) => {
    setUsers(updatedUsers);
    localStorage.setItem("abna_system_users", JSON.stringify(updatedUsers));

    // If current logged-in user was updated, update currentUser state
    if (currentUser) {
      const refreshedCurrent = updatedUsers.find((u) => u.id === currentUser.id);
      if (refreshedCurrent) {
        if (refreshedCurrent.status === "blocked") {
          handleLogout();
          return;
        }
        setCurrentUser(refreshedCurrent);
        localStorage.setItem("abna_auth_current_user", JSON.stringify(refreshedCurrent));
      }
    }

    // Save to Cloud Firestore
    saveUsersDataToCloud(updatedUsers).catch(() => {});

    // Save to Server
    fetch("/api/app-state/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: updatedUsers }),
    }).catch(() => {});
  };

  useEffect(() => {
    fetchConfig();
    fetchFullAppState();

    const interval = setInterval(() => {
      fetchConfig();
      syncInquiriesFromServer();
    }, 3000);

    // Initial local fallback if server hasn't responded yet
    const savedTemplate = localStorage.getItem("whatsapp_student_template");
    if (savedTemplate) setTemplate(savedTemplate);

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
    
    // Save to Cloud Firestore (1 Single Write for all students list)
    saveStudentsDataToCloud(newStudents).catch(() => {});

    // Save to server for cross-device/browser sync
    fetch("/api/app-state/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: newStudents }),
    }).catch(() => {});
  };

  const handleTemplateChange = (newTmpl: string) => {
    setTemplate(newTmpl);
    localStorage.setItem("whatsapp_student_template", newTmpl);

    // Debounced Cloud Save to avoid high write counts while typing (1 write after done typing)
    if (templateSyncTimeout.current) clearTimeout(templateSyncTimeout.current);
    templateSyncTimeout.current = setTimeout(() => {
      saveSchoolDataToCloud(signatories, newTmpl).catch(() => {});
    }, 1500);

    // Save to server for cross-device/browser sync
    fetch("/api/app-state/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: newTmpl }),
    }).catch(() => {});
  };

  const handleUpdateTeachers = (newTeachers: Teacher[]) => {
    setTeachers(newTeachers);
    localStorage.setItem("abna_teachers_roster", JSON.stringify(newTeachers));
    saveTeachersDataToCloud(newTeachers).catch(() => {});
    fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teachers: newTeachers }),
    }).catch(() => {});
  };

  const handleUpdateSchedule = (newSchedule: ScheduleAssignment[]) => {
    setScheduleAssignments(newSchedule);
    localStorage.setItem("abna_school_schedule", JSON.stringify(newSchedule));
    saveScheduleDataToCloud(newSchedule).catch(() => {});
    fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments: newSchedule }),
    }).catch(() => {});
  };

  const handleUpdateInquiries = (newInquiries: TeacherInquiryRequest[]) => {
    setInquiryRequests(newInquiries);
    localStorage.setItem("abna_inquiry_requests", JSON.stringify(newInquiries));
    saveInquiriesDataToCloud(newInquiries).catch(() => {});
  };

  const isWhatsAppConnected = (config as any).isConnected === true && (config.realStatus === "connected" || config.simulatedStatus === "connected");

  // Direct Teacher Evaluation Portal (Accessed directly via WhatsApp link)
  if (evaluationInquiryId) {
    return (
      <TeacherEvaluationPortal
        inquiryId={evaluationInquiryId}
        onClose={() => {
          setEvaluationInquiryId(null);
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      />
    );
  }

  // 1. Full Authentication Guard: Show login screen if not authenticated or blocked
  if (!currentUser || currentUser.status === "blocked") {
    return (
      <LoginScreen
        users={users}
        signatories={signatories}
        onLoginSuccess={handleLoginSuccess}
        onUpdateUsers={handleSaveUsers}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans" dir="rtl" id="app-root">
      
      {/* Dynamic Navigation Banner */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm" id="main-header">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Dynamic School Name */}
          <div className="flex items-center gap-3">
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار"
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5 bg-white shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/10 shrink-0">
                <Send className="w-5 h-5 rotate-180" />
              </div>
            )}

            <div className="text-right">
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-none">
                {signatories.schoolName || "ثانوية الأبناء الأولى"} - مرسل الطلاب الذكي
              </h1>
              <span className="text-[10px] text-slate-400 font-medium">
                {signatories.administrationName || "الإدارة العامة للتعليم"} • نظام الإرسال والتقارير الرسمية
              </span>
            </div>
          </div>

          {/* Core Applet Status Indicators & Signatories Toggle & Top Logout */}
          <div className="flex flex-wrap items-center gap-2 text-xs" id="header-status-indicators">
            
            {/* Logged in User Profile Info Chip */}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/90 rounded-full border border-slate-200/80 text-xs" id="header-user-badge">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                currentUser.role === "admin" ? "bg-blue-600 text-white" : "bg-slate-700 text-white"
              }`}>
                {currentUser.name.charAt(0) || "U"}
              </div>
              <span className="font-bold text-slate-800 max-w-32 sm:max-w-40 truncate">
                {currentUser.name}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                currentUser.role === "admin"
                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                  : "bg-slate-200 text-slate-700"
              }`}>
                {currentUser.role === "admin" ? "مدير نظام" : "مستخدم"}
              </span>
            </div>

            {/* School & Signatories Configuration Trigger */}
            <button
              onClick={() => setShowSignatoriesConfig(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-[11px] font-medium cursor-pointer ${
                showSignatoriesConfig
                  ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                  : (signatories.principalName || signatories.schoolName)
                    ? "bg-amber-50/90 text-amber-900 border-amber-200 hover:bg-amber-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-800 hover:bg-slate-100"
              }`}
              title="تخصيص بيانات المدرسة، الإدارة وأسماء المعتمدين بالتقارير"
              id="btn-toggle-signatories"
            >
              <Building className="w-3.5 h-3.5 text-amber-500" />
              <span>بيانات المدرسة والمعتمدين</span>
              {showSignatoriesConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Connection Status Badge */}
            <button
              type="button"
              onClick={() => setActiveTab("connection")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                isWhatsAppConnected 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs" 
                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-2xs animate-pulse"
              }`}
              title={isWhatsAppConnected ? "الواتساب متصل وجاهز للإرسال الفعلي" : "اضغط هنا لربط الواتساب بمسح الباركود أو الرمز"}
              id="header-wa-status-badge"
            >
              <span className={`w-2 h-2 rounded-full ${isWhatsAppConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span>
                {isWhatsAppConnected 
                  ? `متصل: ${config.simulatedPhone || "نشط"}` 
                  : "واتساب غير مرتبط (اضغط للربط)"
                }
              </span>
            </button>

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

            {/* Top Logout Button for all users including Admin */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold transition-all text-xs cursor-pointer shadow-xs active:scale-95 ml-1"
              title="تسجيل الخروج من الحساب"
              id="btn-top-logout"
            >
              <LogOut className="w-3.5 h-3.5 rotate-180 text-rose-600" />
              <span>خروج</span>
            </button>

          </div>

        </div>

        {/* EXPANDED EDITABLE SCHOOL, ADMINISTRATION & SIGNATORIES PANEL */}
        {showSignatoriesConfig && (
          <div className="bg-slate-50 border-t border-slate-200/90 py-4 px-4 animate-fadeIn no-print" id="subtle-signatories-panel">
            <div className="max-w-7xl mx-auto flex flex-col gap-3">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    تعديل بيانات المدرسة والإدارة وأسماء المعتمدين (تنعكس فوراً على الترويسة والتقارير المطبوعة):
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {signatoriesSavedToast && (
                    <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Check className="w-3 h-3" />
                      تم الحفظ سحابياً ومحلياً
                    </span>
                  )}
                  <button
                    onClick={() => setShowSignatoriesConfig(false)}
                    className="text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded text-xs cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                
                {/* 1. Country Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الدولة:</span>
                  <input
                    type="text"
                    value={signatories.countryName || "المملكة العربية السعودية"}
                    onChange={(e) => handleUpdateSignatory("countryName", e.target.value)}
                    placeholder="المملكة العربية السعودية"
                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-country-name"
                  />
                </div>

                {/* 2. Ministry Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الوزارة:</span>
                  <input
                    type="text"
                    value={signatories.ministryName || "وزارة التعليم"}
                    onChange={(e) => handleUpdateSignatory("ministryName", e.target.value)}
                    placeholder="وزارة التعليم"
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-ministry-name"
                  />
                </div>

                {/* 3. Administration Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الإدارة:</span>
                  <input
                    type="text"
                    value={signatories.administrationName || ""}
                    onChange={(e) => handleUpdateSignatory("administrationName", e.target.value)}
                    placeholder="الإدارة العامة للتعليم..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-admin-name"
                  />
                </div>

                {/* 4. School Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">المدرسة:</span>
                  <input
                    type="text"
                    value={signatories.schoolName || ""}
                    onChange={(e) => handleUpdateSignatory("schoolName", e.target.value)}
                    placeholder="ثانوية الأبناء الأولى"
                    className="w-full text-xs font-bold text-emerald-950 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-school-name"
                  />
                </div>

                {/* 5. Principal Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">المدير:</span>
                  <input
                    type="text"
                    value={signatories.principalName || ""}
                    onChange={(e) => handleUpdateSignatory("principalName", e.target.value)}
                    placeholder="اسم مدير المدرسة..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-principal-name"
                  />
                </div>

                {/* 6. Vice Principal Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الوكيل:</span>
                  <input
                    type="text"
                    value={signatories.vicePrincipalName || ""}
                    onChange={(e) => handleUpdateSignatory("vicePrincipalName", e.target.value)}
                    placeholder="اسم وكيل شؤون الطلاب..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-vice-principal-name"
                  />
                </div>

                {/* 5. Counselor Name */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <span className="text-[10px] font-bold text-slate-400 ml-1.5 shrink-0">الموجه:</span>
                  <input
                    type="text"
                    value={signatories.counselorName || ""}
                    onChange={(e) => handleUpdateSignatory("counselorName", e.target.value)}
                    placeholder="اسم الموجه الطلابي..."
                    className="w-full text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                    id="input-counselor-name"
                  />
                </div>

              </div>

            </div>
          </div>
        )}

      </header>

      {/* Primary Dashboard Container with Sidebar and Content Area */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-5 items-start">
        
        {/* Main Side Navigation Bar */}
        <Sidebar
          currentSection={mainSection}
          onSelectSection={(sec) => setMainSection(sec)}
          studentsCount={students.length}
          teachersCount={teachers.length}
          isWhatsAppConnected={isWhatsAppConnected}
          currentUser={currentUser}
          schoolName={signatories.schoolName}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {/* Dynamic Section Content Viewport */}
        <main className="flex-1 min-w-0 flex flex-col gap-6" id="primary-content-viewport">
          
          {/* 1. Main Section: Home / Dashboard */}
          {mainSection === "home" && (
            <HomeDashboard
              students={students}
              teachersCount={teachers.length}
              signatories={signatories}
              config={config}
              onNavigateToMessages={(tab) => {
                setMainSection("messages");
                if (tab) setActiveTab(tab);
              }}
              onNavigateToAttendance={() => setMainSection("attendance")}
              onNavigateToTeachersSchedule={() => setMainSection("teachers_schedule")}
              onNavigateToInquiry={() => setMainSection("inquiry")}
              onOpenSignatoriesConfig={() => setShowSignatoriesConfig(true)}
            />
          )}

          {/* 2. Main Section: Teachers Registry & School Schedule (Placed under Home) */}
          {mainSection === "teachers_schedule" && (
            <TeachersScheduleManager
              teachers={teachers}
              scheduleAssignments={scheduleAssignments}
              students={students}
              onUpdateTeachers={handleUpdateTeachers}
              onUpdateSchedule={handleUpdateSchedule}
              schoolSignatories={signatories}
              isWhatsAppConnected={isWhatsAppConnected}
              onNavigateToInquiry={() => setMainSection("inquiry")}
              onNavigateToMessages={() => {
                setMainSection("messages");
                setActiveTab("connection");
              }}
            />
          )}

          {/* 2. Main Section: Messaging System (Existing tabs & features) */}
          <div className={mainSection === "messages" ? "flex flex-col gap-6 w-full animate-fadeIn" : "hidden"}>
            
            {/* Navigation / Wizard Tab Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 bg-white border border-slate-200/80 p-1.5 rounded-2xl shadow-sm text-sm font-semibold text-slate-500 gap-1" id="wizard-navigation-tabs">
              
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
                <IndividualSender 
                  isWhatsAppConnected={isWhatsAppConnected} 
                  onNavigateToConnection={() => setActiveTab("connection")}
                />
              </div>

              <div className={activeTab === "reports" ? "block" : "hidden"}>
                <ReportsPrinter 
                  students={students}
                  signatories={signatories}
                  template={template}
                  onUpdateSignatory={handleBulkUpdateSignatories}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              </div>
            </div>

          </div>

          {/* 3. Main Section: Attendance & Tardiness */}
          {mainSection === "attendance" && (
            <AttendanceSystem
              students={students}
              signatories={signatories}
              isWhatsAppConnected={isWhatsAppConnected}
              onNavigateToMessages={(tab) => {
                setMainSection("messages");
                if (tab) setActiveTab(tab);
              }}
            />
          )}

          {/* 4. Main Section: Student Inquiry & Teacher Feedback */}
          {mainSection === "inquiry" && (
            <StudentInquiry
              students={students}
              teachers={teachers}
              scheduleAssignments={scheduleAssignments}
              inquiryRequests={inquiryRequests}
              onUpdateTeachers={handleUpdateTeachers}
              onUpdateSchedule={handleUpdateSchedule}
              onUpdateInquiries={handleUpdateInquiries}
              schoolSignatories={signatories}
              isWhatsAppConnected={isWhatsAppConnected}
              onNavigateToWhatsApp={() => {
                setMainSection("messages");
                setActiveTab("connection");
              }}
              onNavigateToTeachersSchedule={() => setMainSection("teachers_schedule")}
            />
          )}

          {/* 5. Main Section: Admin & User Management */}
          {mainSection === "admin" && currentUser.role === "admin" && (
            <UserManagement
              users={users}
              currentUser={currentUser}
              signatories={signatories}
              isWhatsAppConnected={isWhatsAppConnected}
              onSaveUsers={handleSaveUsers}
            />
          )}

        </main>

      </div>

      {/* System Footer Info */}
      <footer className="bg-white border-t border-slate-200/80 py-5 text-center text-xs text-slate-500 select-none mt-8" id="main-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="font-medium">
            جميع الحقوق محفوظة لـ {signatories.schoolName || "ثانوية الأبناء الأولى"} 2026 - 2027
          </p>
          <div className="flex items-center gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" />
              تشفير واتصال آمن
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Smartphone className="w-3.5 h-3.5" />
              متوافق مع الجوال والمتصفحات
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
