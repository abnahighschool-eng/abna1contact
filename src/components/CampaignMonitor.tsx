import React, { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RefreshCw, Send, AlertCircle, CheckCircle2, XCircle, Loader2, ArrowRight, Clock, ShieldCheck, Search, Filter, MessageSquare, Plus, Smartphone, Smile, CheckCheck, Info, Users, CheckSquare, Square, UserCheck, UserX, GraduationCap, School } from "lucide-react";
import { Student, Campaign, CampaignLog } from "../types";

interface CampaignMonitorProps {
  students: Student[];
  template: string;
  onTemplateChange: (val: string) => void;
  isWhatsAppConnected: boolean;
}

export default function CampaignMonitor({ students, template, onTemplateChange, isWhatsAppConnected }: CampaignMonitorProps) {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [delayMs, setDelayMs] = useState(15000);
  const [delayPreset, setDelayPreset] = useState<"safe" | "balanced" | "custom">("safe");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [campaignName, setCampaignName] = useState("");
  const [validationError, setValidationError] = useState("");

  // Filtering & Selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [viewSelectionFilter, setViewSelectionFilter] = useState<"unsent_today" | "all" | "sent_today" | "selected" | "unselected">("unsent_today");
  const [excludeAlreadySentToday, setExcludeAlreadySentToday] = useState(true);
  const [todaySentMap, setTodaySentMap] = useState<Record<string, { time: string; phone: string; campaignName: string; status: string }>>({});

  // Normalize phone number helper
  const normalizePhone = (phoneStr?: string) => {
    if (!phoneStr) return "";
    return String(phoneStr).replace(/[^\d]/g, "");
  };

  // Helper to check if student was sent a successful message today
  const getStudentSentTodayInfo = (student: Student) => {
    if (!student) return null;
    const name = (student.name || student["اسم الطالب"] || student["الاسم"] || student["الاسم الكامل"] || "").trim();
    const phone = (student.phone || student["رقم الجوال"] || student["الجوال"] || "").trim();
    const cleanPhone = normalizePhone(phone);

    if (student.id && todaySentMap[`id_${student.id}`]) {
      return todaySentMap[`id_${student.id}`];
    }
    if (cleanPhone && cleanPhone.length >= 8 && todaySentMap[`phone_${cleanPhone}`]) {
      return todaySentMap[`phone_${cleanPhone}`];
    }
    if (name && todaySentMap[`name_${name}`]) {
      return todaySentMap[`name_${name}`];
    }
    return null;
  };

  // Fetch today's sent logs on mount and periodically
  const loadTodaySentHistory = async () => {
    try {
      const res = await fetch("/api/whatsapp/reports");
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      const todayISO = new Date().toISOString().split("T")[0];

      const map: Record<string, { time: string; phone: string; campaignName: string; status: string }> = {};

      logs.forEach((lg: any) => {
        if (lg.status === "success" && lg.timestamp) {
          const logDateISO = new Date(lg.timestamp).toISOString().split("T")[0];
          if (logDateISO === todayISO) {
            const timeFormatted = new Date(lg.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
            const info = {
              time: timeFormatted,
              phone: lg.phone,
              campaignName: lg.campaignName || "إرسال اليوم",
              status: "success",
            };
            if (lg.studentName && lg.studentName !== "إرسال فردي مباشر") {
              map[`name_${lg.studentName.trim()}`] = info;
            }
            const cleanP = normalizePhone(lg.phone);
            if (cleanP && cleanP.length >= 8) {
              map[`phone_${cleanP}`] = info;
            }
            if (lg.id) {
              map[`id_${lg.id}`] = info;
            }
          }
        }
      });

      setTodaySentMap(map);
    } catch (err) {
      console.error("Error loading today's sent reports:", err);
    }
  };

  useEffect(() => {
    loadTodaySentHistory();
  }, []);

  // Template Preview states
  const [previewStudentIdx, setPreviewStudentIdx] = useState(0);
  const [currentTime, setCurrentTime] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set real clock on phone mockup
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Default campaign name
  useEffect(() => {
    const formattedDate = new Date().toLocaleDateString("ar-SA", { year: 'numeric', month: 'long', day: 'numeric' });
    setCampaignName(`حملة إشعار الطلاب - ${formattedDate}`);
  }, []);

  // Dynamic extraction of unique grades and classes per grade from students
  const uniqueGrades = useMemo(() => {
    const gSet = new Set<string>();
    students.forEach(s => {
      const g = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      if (g) gSet.add(g);
    });
    return Array.from(gSet);
  }, [students]);

  const gradeToClassesMap = useMemo(() => {
    const map: Record<string, string[]> = { all: [] };
    const allClsSet = new Set<string>();

    uniqueGrades.forEach(g => {
      map[g] = [];
    });

    students.forEach(s => {
      const g = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      const c = (s.className || s["الفصل"] || s["الشعبة"] || "").trim();
      if (c) {
        allClsSet.add(c);
        if (g && map[g] && !map[g].includes(c)) {
          map[g].push(c);
        }
      }
    });

    map.all = Array.from(allClsSet);
    return map;
  }, [students, uniqueGrades]);

  // Current available classes for the active grade
  const availableClassesForCurrentGrade = useMemo(() => {
    if (gradeFilter === "all") {
      return gradeToClassesMap.all || [];
    }
    return gradeToClassesMap[gradeFilter] || [];
  }, [gradeFilter, gradeToClassesMap]);

  // Synchronize selection on initial load of students (auto excluding already-sent today)
  useEffect(() => {
    if (students && students.length > 0) {
      const targetIds = students
        .filter(s => !excludeAlreadySentToday || !getStudentSentTodayInfo(s))
        .map(s => s.id);
      setSelectedStudentIds(targetIds);
      setSelectedClasses(gradeToClassesMap.all || []);
    }
  }, [students, todaySentMap]);

  // Handle Grade Change: "كل الصفوف" vs Specific Grade
  const handleGradeChange = (newGrade: string) => {
    setGradeFilter(newGrade);
    setPreviewStudentIdx(0);

    if (newGrade === "all") {
      const allClassList = gradeToClassesMap.all || [];
      setSelectedClasses(allClassList);
      const targetIds = students
        .filter(s => !excludeAlreadySentToday || !getStudentSentTodayInfo(s))
        .map(s => s.id);
      setSelectedStudentIds(targetIds);
    } else {
      const gradeClasses = gradeToClassesMap[newGrade] || [];
      setSelectedClasses(gradeClasses);
      
      const gradeStudentIds = students
        .filter(s => {
          const matchesGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim() === newGrade;
          if (!matchesGrade) return false;
          if (excludeAlreadySentToday && getStudentSentTodayInfo(s)) return false;
          return true;
        })
        .map(s => s.id);
      setSelectedStudentIds(gradeStudentIds);
    }
  };

  // Handle Toggling individual Class / Section checkbox
  const handleToggleClass = (cls: string) => {
    const isCurrentlySelected = selectedClasses.includes(cls);
    const nextSelectedClasses = isCurrentlySelected
      ? selectedClasses.filter(c => c !== cls)
      : [...selectedClasses, cls];
    
    setSelectedClasses(nextSelectedClasses);

    // Identify affected students within the current grade view
    const affectedStudents = students.filter(s => {
      const studentGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      const studentClass = (s.className || s["الفصل"] || s["الشعبة"] || "").trim();
      const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
      return matchesGrade && studentClass === cls;
    });

    const eligibleAffectedStudents = affectedStudents.filter(s => !excludeAlreadySentToday || !getStudentSentTodayInfo(s));
    const eligibleIds = eligibleAffectedStudents.map(s => s.id);

    if (isCurrentlySelected) {
      // Remove all affected students
      const allAffectedIds = affectedStudents.map(s => s.id);
      setSelectedStudentIds(prev => prev.filter(id => !allAffectedIds.includes(id)));
    } else {
      // Add eligible students back into active send list
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...eligibleIds])));
    }
  };

  // Select all classes for the active grade
  const handleSelectAllClassesForCurrentGrade = () => {
    setSelectedClasses(availableClassesForCurrentGrade);
    const targetStudents = students.filter(s => {
      const studentGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
      if (!matchesGrade) return false;
      if (excludeAlreadySentToday && getStudentSentTodayInfo(s)) return false;
      return true;
    });
    const targetIds = targetStudents.map(s => s.id);
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...targetIds])));
  };

  // Deselect all classes for the active grade
  const handleDeselectAllClassesForCurrentGrade = () => {
    setSelectedClasses([]);
    const targetStudents = students.filter(s => {
      const studentGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      return gradeFilter === "all" || studentGrade === gradeFilter;
    });
    const targetIds = targetStudents.map(s => s.id);
    setSelectedStudentIds(prev => prev.filter(id => !targetIds.includes(id)));
  };

  // Toggle exclusion of already sent today
  const handleToggleExcludeSentToday = (enabled: boolean) => {
    setExcludeAlreadySentToday(enabled);
    if (enabled) {
      // Remove any student sent today from active selection
      setSelectedStudentIds(prev => prev.filter(id => {
        const student = students.find(s => s.id === id);
        return student ? !getStudentSentTodayInfo(student) : true;
      }));
    }
  };

  // Count how many students in whole roster or current grade received messages today
  const totalSentTodayCount = useMemo(() => {
    return students.filter(s => !!getStudentSentTodayInfo(s)).length;
  }, [students, todaySentMap]);

  const currentGradeSentTodayCount = useMemo(() => {
    return students.filter(s => {
      const sGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
      const matchesGrade = gradeFilter === "all" || sGrade === gradeFilter;
      return matchesGrade && !!getStudentSentTodayInfo(s);
    }).length;
  }, [students, gradeFilter, todaySentMap]);

  // Filtered list based on Search Query, Grade, and Selection view tabs
  const filteredStudents = students.filter(student => {
    const studentGrade = (student.grade || student["الصف"] || student["المستوى"] || "").trim();
    const studentClass = (student.className || student["الفصل"] || student["الشعبة"] || "").trim();
    const studentName = (student.name || student["اسم الطالب"] || student["الاسم"] || student["الاسم الكامل"] || "").trim();
    const studentPhone = (student.phone || student["رقم الجوال"] || student["الجوال"] || "").trim();
    
    const isSelected = selectedStudentIds.includes(student.id);
    const sentTodayInfo = getStudentSentTodayInfo(student);
    const isSentToday = !!sentTodayInfo;

    // If search query is entered, search across entire roster or current filter
    const q = studentSearchQuery.trim().toLowerCase();
    if (q) {
      const matchesSearch = 
        studentName.toLowerCase().includes(q) ||
        studentPhone.includes(q) ||
        studentGrade.toLowerCase().includes(q) ||
        studentClass.toLowerCase().includes(q);
      
      if (!matchesSearch) return false;

      if (viewSelectionFilter === "unsent_today") return !isSentToday;
      if (viewSelectionFilter === "sent_today") return isSentToday;
      if (viewSelectionFilter === "selected") return isSelected;
      if (viewSelectionFilter === "unselected") return !isSelected;
      return true;
    }

    // Standard filter by Grade
    const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
    if (!matchesGrade) return false;

    if (viewSelectionFilter === "unsent_today") return !isSentToday;
    if (viewSelectionFilter === "sent_today") return isSentToday;
    if (viewSelectionFilter === "selected") return isSelected;
    if (viewSelectionFilter === "unselected") return !isSelected;
    
    return true;
  });

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const deselectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
  };

  const invertSelectionFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => {
      const newlySelected = filteredIds.filter(id => !prev.includes(id));
      const kept = prev.filter(id => !filteredIds.includes(id));
      return [...kept, ...newlySelected];
    });
  };

  const isAllFilteredSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id));
  const isSomeFilteredSelected = filteredStudents.some(s => selectedStudentIds.includes(s.id)) && !isAllFilteredSelected;

  const toggleMasterCheckbox = () => {
    if (isAllFilteredSelected) {
      deselectAllFiltered();
    } else {
      selectAllFiltered();
    }
  };

  const targetedCount = students.filter(s => selectedStudentIds.includes(s.id)).length;
  const excludedCount = students.length - targetedCount;

  // Automatically check and restore any active running or saved campaign on component mount
  useEffect(() => {
    const checkActiveCampaign = async () => {
      try {
        // 1. Check if there's an ongoing running or paused campaign on the server
        const res = await fetch("/api/whatsapp/campaigns");
        if (res.ok) {
          const campaignsList = await res.json();
          if (Array.isArray(campaignsList)) {
            const runningOrPaused = campaignsList.find((c: any) => c.status === "running" || c.status === "paused");
            if (runningOrPaused) {
              setCampaignId(runningOrPaused.id);
              localStorage.setItem("active_campaign_id", runningOrPaused.id);
              const detailRes = await fetch(`/api/whatsapp/campaign/${runningOrPaused.id}`);
              if (detailRes.ok) {
                setCampaign(await detailRes.json());
              }
              return;
            }
          }
        }

        // 2. Otherwise check if there is a saved recent campaign ID in localStorage
        const savedId = localStorage.getItem("active_campaign_id");
        if (savedId) {
          const detailRes = await fetch(`/api/whatsapp/campaign/${savedId}`);
          if (detailRes.ok) {
            const data = await detailRes.json();
            if (data && data.id) {
              setCampaignId(data.id);
              setCampaign(data);
            }
          }
        }
      } catch {
        // ignore background restore errors
      }
    };

    checkActiveCampaign();
  }, []);

  // Poll campaign status when running or initialized
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (campaignId && campaign?.status !== "completed") {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/whatsapp/campaign/${campaignId}`);
          if (response.ok) {
            const data = await response.json();
            setCampaign(data);
          }
        } catch (err) {
          console.error("Error polling campaign", err);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [campaignId, campaign?.status]);

  const handleStartCampaign = async () => {
    if (!isWhatsAppConnected) {
      setValidationError("تنبيه: حساب الواتساب غير متصل حالياً. يرجى التوجه لتبويب «1. الربط والاتصال» لمسح الباركود أو إدخال رمز الربط أولاً.");
      return;
    }

    const studentsToSubmit = students.filter(s => selectedStudentIds.includes(s.id));
    if (studentsToSubmit.length === 0) {
      setValidationError("يرجى تحديد طالب واحد على الأقل قبل بدء الإرسال (تأكد من وجود علامة صح أمام أسماء الطلاب المستهدفين).");
      return;
    }
    if (!template || template.trim() === "") {
      setValidationError("يرجى كتابة نص الرسالة أولاً في محرر الصياغة قبل إطلاق الحملة.");
      return;
    }
    
    // Sanitize students payload to keep it clean and lightweight
    const sanitizedStudents = studentsToSubmit.map((std) => {
      const cleanObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(std)) {
        if (v !== undefined && v !== null) {
          cleanObj[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
        }
      }
      return cleanObj;
    });

    setValidationError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/whatsapp/campaign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          students: sanitizedStudents,
          template,
          delayMs,
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        data = { error: `استجابة الخادم غير متوقعة (رمز ${response.status})` };
      }

      if (response.ok && data.campaignId) {
        setCampaignId(data.campaignId);
        localStorage.setItem("active_campaign_id", data.campaignId);
        
        // Fetch immediately
        try {
          const campRes = await fetch(`/api/whatsapp/campaign/${data.campaignId}`);
          if (campRes.ok) {
            setCampaign(await campRes.json());
          }
        } catch (fetchErr) {
          console.error("Initial campaign fetch error:", fetchErr);
        }
      } else {
        setValidationError(data.error || "تعذر إطلاق الحملة، يرجى التحقق من صحة البيانات.");
      }
    } catch (err: any) {
      console.error("Campaign start error:", err);
      setValidationError(err.message ? `فشل الاتصال: ${err.message}` : "حدث خطأ أثناء الاتصال بالخادم لإطلاق الحملة.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseCampaign = async () => {
    if (!campaignId) return;
    try {
      const response = await fetch(`/api/whatsapp/campaign/${campaignId}/pause`, {
        method: "POST",
      });
      if (response.ok) {
        setCampaign(prev => prev ? { ...prev, status: "paused" } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeCampaign = async () => {
    if (!campaignId) return;
    try {
      const response = await fetch(`/api/whatsapp/campaign/${campaignId}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayMs }),
      });
      if (response.ok) {
        setCampaign(prev => prev ? { ...prev, status: "running" } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Get available tags
  const availableTags = students.length > 0
    ? Object.keys(students[0]).filter(k => k !== "id")
    : ["اسم الطالب", "رقم الجوال", "الصف", "الدرجة", "حالة الغياب", "ملاحظات"];

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const tagToInsert = `{${tag}}`;
    
    const newText = text.substring(0, start) + tagToInsert + text.substring(end);
    onTemplateChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tagToInsert.length;
    }, 50);
  };

  // Compile template for preview
  const getCompiledPreview = () => {
    if (!template) return "أدخل نص الرسالة في المحرر لرؤية المعاينة المباشرة هنا...";
    
    let compiled = template;
    const sampleStudent = students.length > 0 ? students[previewStudentIdx] : {
      "اسم الطالب": "عبد الله بن فهد الراشد",
      "الاسم": "عبد الله بن فهد الراشد",
      "رقم الجوال": "+966501234567",
      "الصف": "أول ثانوي / ب",
      "الدرجة": "95%",
      "حالة الغياب": "حاضر",
      "ملاحظات": "طالب متميز ومشارك فعال في الأنشطة الصفية"
    };

    // Replace short name placeholders
    const studentFullName = sampleStudent["اسم الطالب"] || sampleStudent["الاسم"] || sampleStudent["الاسم الكامل"] || sampleStudent["name"] || sampleStudent["Name"] || "";
    const getShortName = (nameStr: string) => {
      if (!nameStr) return "";
      const parts = nameStr.trim().split(/\s+/).filter(Boolean);
      if (parts.length <= 1) return nameStr;
      return `${parts[0]} ${parts[parts.length - 1]}`;
    };
    const shortName = getShortName(studentFullName);

    compiled = compiled.replace(/{اسم الطالب الأول والأخير}/g, shortName);
    compiled = compiled.replace(/{الاسم الأول والأخير}/g, shortName);

    // Replace other placeholders
    Object.keys(sampleStudent).forEach((key) => {
      const val = (sampleStudent as any)[key];
      compiled = compiled.replace(new RegExp(`{${key}}`, "g"), String(val || ""));
    });

    // Parse simple WhatsApp markdown (*bold*, _italic_, ~strike~)
    let htmlPreview = compiled
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(/\n/g, "<br />");

    return htmlPreview;
  };

  const handleNextStudent = () => {
    if (students.length === 0) return;
    setPreviewStudentIdx((prev) => (prev + 1) % students.length);
  };

  // Calculations
  const total = campaign ? campaign.total : students.length;
  const sent = campaign ? campaign.sent : 0;
  const failed = campaign ? campaign.failed : 0;
  const processed = sent + failed;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const successRate = processed > 0 ? Math.round((sent / processed) * 100) : 0;

  // Filter logs
  const logsList: CampaignLog[] = campaign?.logs || [];
  const filteredLogs = logsList.filter((log) => {
    const matchesSearch = log.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.phone.includes(searchQuery);
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && log.status === statusFilter;
  });

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="campaign-monitor">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-right">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 justify-end md:justify-start">
            <Send className="w-5 h-5 text-emerald-600 rotate-180" />
            حملة الإرسال الجماعي (صياغة وإرسال)
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            صغ نص رسالتك وحدد فئات الطلاب المستهدفين وأطلق حملة الإرسال في وقت واحد وبشكل متكامل
          </p>
        </div>
      </div>

      {!campaignId ? (
        // INTEGRATED CAMPAIGN INITIATION SCREEN (DUAL COLUMNS)
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
          
          {/* RIGHT COLUMN: Message Editor & Live Phone Preview (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6 text-right">
            
            {/* Header section of the editor */}
            <div className="bg-slate-50/60 border border-slate-100 p-4 rounded-2xl flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                1. صياغة نص الرسالة الذكي
              </h3>

              {/* Dynamic tag buttons */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-600">انقر لإدراج متغير في نص الرسالة:</span>
                  <span className="text-[10px] text-slate-400 font-medium">(يتم استبدال المتغير تلقائياً لكل طالب)</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5" id="tag-buttons-container">
                  
                  {/* Highlighted short student name button */}
                  <button
                    key="الاسم الأول والأخير"
                    onClick={() => insertTag("الاسم الأول والأخير")}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-lg border border-amber-200/60 font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                    title="يكتب اسم الطالب وأخر اسم فقط (مثال: محمد العتيبي) لمنع الإطالة عند كتابة المكرم ولي أمر الطالب"
                  >
                    <span className="text-amber-500 font-extrabold">✨ +</span>
                    {"{الاسم الأول والأخير}"}
                  </button>

                  {/* Standard column tag buttons */}
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => insertTag(tag)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1.5 rounded-lg border border-emerald-100/30 font-semibold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                      id={`btn-tag-${tag}`}
                    >
                      <Plus className="w-3 h-3 text-emerald-500" />
                      {`{${tag}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">محرر الرسائل المدرسية:</label>
                  <span className="text-[10px] text-slate-400">تلميح: استخدم *للخط العريض* و _للخط المائل_</span>
                </div>
                
                <textarea
                  ref={textareaRef}
                  value={template}
                  onChange={(e) => onTemplateChange(e.target.value)}
                  placeholder="اكتب رسالتك هنا... مثال:
السلام عليكم ورحمة الله وبركاته،
المكرم ولي أمر الطالب {الاسم الأول والأخير}،
نود إبلاغكم بأن ابننا قد حصل على درجة {الدرجة} في مادة الرياضيات."
                  className="border border-slate-200 bg-white rounded-xl p-4 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 h-60 resize-none leading-relaxed text-right"
                  id="template-textarea"
                />
              </div>
            </div>

            {/* Live WhatsApp phone preview card */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150 p-5 rounded-2xl">
              <span className="text-xs font-bold text-slate-500 mb-3 block text-center">المعاينة المباشرة على الواتساب 📱</span>
              
              <div className="w-full max-w-[310px] bg-slate-900 rounded-[38px] p-2.5 shadow-md border-4 border-slate-800 relative aspect-[9/18]">
                {/* Speaker & Bezel */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                  <div className="w-12 h-1 bg-slate-800 rounded-full" />
                  <div className="w-2 h-2 bg-slate-800 rounded-full ml-1" />
                </div>

                {/* Internal Screen */}
                <div className="w-full h-full rounded-[30px] overflow-hidden relative flex flex-col bg-[#efeae2]">
                  
                  {/* Status Bar */}
                  <div className="bg-[#075e54] text-white px-5 pt-5 pb-1.5 flex justify-between items-center text-[9px] font-semibold select-none z-10">
                    <span className="font-mono">{currentTime}</span>
                    <div className="flex items-center gap-1 font-mono">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Header */}
                  <div className="bg-[#075e54] text-white px-3 py-2 flex items-center gap-2 select-none shadow-sm z-10 text-right" dir="rtl">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[#075e54] font-bold text-[10px]">
                      AB
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold leading-none">ثانوية الأبناء الأولى</h4>
                      <span className="text-[7px] text-emerald-200">متصل الآن</span>
                    </div>
                  </div>

                  {/* Message Bubble Container */}
                  <div className="flex-1 p-3 flex flex-col justify-end gap-3 overflow-y-auto" dir="rtl">
                    <div className="bg-white rounded-2xl rounded-tr-none p-3 shadow-sm max-w-[85%] self-start relative flex flex-col gap-1 text-right">
                      <div 
                        className="text-[10px] text-slate-800 leading-relaxed break-words font-medium"
                        dangerouslySetInnerHTML={{ __html: getCompiledPreview() }}
                      />
                      <div className="flex items-center justify-end gap-1 select-none self-end mt-1">
                        <span className="text-[7px] text-slate-400 font-mono">{currentTime}</span>
                        <CheckCheck className="w-3 h-3 text-[#34b7f1]" />
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="bg-[#f0f0f0] p-1.5 flex items-center justify-between gap-2 border-t border-[#dfdfdf] select-none" dir="rtl">
                    <div className="flex-1 bg-white rounded-full py-1 px-3 flex items-center justify-between text-slate-400 text-[8px]">
                      <span>كتابة رسالة...</span>
                      <Smile className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#075e54] flex items-center justify-center text-white shrink-0">
                      <Send className="w-2.5 h-2.5 rotate-180" />
                    </div>
                  </div>

                </div>
              </div>

              {/* Navigation within preview */}
              {students.length > 0 && (
                <div className="flex items-center gap-3 mt-3 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs font-medium">
                  <button
                    onClick={handleNextStudent}
                    className="text-emerald-700 hover:text-emerald-800 font-bold transition-colors cursor-pointer"
                  >
                    عرض كرت الطالب التالي ◀
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {previewStudentIdx + 1} / {students.length}
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* LEFT COLUMN: Targeting, Grade, Class Filters, and Campaign Controls (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6 text-right">
            
            {/* Campaign Parameters & Student Selection Card */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  2. تحديد المستهدفين واختيار الطلاب
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {targetedCount} محدد للإرسال
                </span>
              </div>

              {/* Campaign Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">تسمية الحملة الدراسية:</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="أدخل اسماً للحملة للرجوع إليها لاحقاً..."
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  id="input-campaign-name"
                />
              </div>

              {/* Grade Selection (4 primary choices & dynamic list) */}
              <div className="flex flex-col gap-2 border-t border-slate-200/60 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تحديد الصف المستهدف للإرسال:</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {gradeFilter === "all" ? "محدد: كافة المراحل والصفوف" : `محدد: ${gradeFilter} فقط`}
                  </span>
                </div>

                {/* Grade Segmented Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {/* Choice 1: All Grades */}
                  <button
                    type="button"
                    onClick={() => handleGradeChange("all")}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      gradeFilter === "all"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                    id="btn-grade-all"
                  >
                    <span>كل الصفوف</span>
                    <span className={`text-[9px] ${gradeFilter === "all" ? "text-emerald-100" : "text-slate-400"}`}>
                      ({students.length} طالب)
                    </span>
                  </button>

                  {/* Choice 2, 3, 4... Specific Grades */}
                  {uniqueGrades.map((grade) => {
                    const gradeStudentsCount = students.filter(s => (s.grade || s["الصف"] || s["المستوى"] || "").trim() === grade).length;
                    const isSelected = gradeFilter === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => handleGradeChange(grade)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                        id={`btn-grade-${grade}`}
                      >
                        <span className="truncate max-w-[100px]">{grade}</span>
                        <span className={`text-[9px] ${isSelected ? "text-emerald-100" : "text-slate-400"}`}>
                          ({gradeStudentsCount} طالب)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sections / Classes Checkbox Area (خانة الفصول والشعب) */}
              <div className="flex flex-col gap-2 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-purple-600" />
                    <label className="text-xs font-bold text-slate-800">
                      الفصول والشعب ({gradeFilter === "all" ? "لكل الصفوف" : gradeFilter}):
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllClassesForCurrentGrade}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                    >
                      تحديد كل الشعب (✓)
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllClassesForCurrentGrade}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                    >
                      إلغاء التحديد (✕)
                    </button>
                  </div>
                </div>

                {/* Interactive Checkbox Chips for Sections */}
                {availableClassesForCurrentGrade.length === 0 ? (
                  <div className="text-center py-2 text-slate-400 text-xs font-medium">
                    لا توجد فصول أو شعب محددة في هذا الصف.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableClassesForCurrentGrade.map((cls) => {
                      const isChecked = selectedClasses.includes(cls);
                      const classStudentsCount = students.filter(s => {
                        const sGrade = (s.grade || s["الصف"] || s["المستوى"] || "").trim();
                        const sClass = (s.className || s["الفصل"] || s["الشعبة"] || "").trim();
                        const matchesGrade = gradeFilter === "all" || sGrade === gradeFilter;
                        return matchesGrade && sClass === cls;
                      }).length;

                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleToggleClass(cls)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                            isChecked
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs ring-1 ring-emerald-400/40"
                              : "bg-slate-50 text-slate-400 border-slate-200 line-through opacity-70 hover:opacity-100"
                          }`}
                          id={`btn-class-${cls}`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] font-mono border ${isChecked ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-transparent border-slate-300"}`}>
                            {isChecked ? "✓" : ""}
                          </span>
                          <span>شعبة / فصل {cls}</span>
                          <span className="text-[10px] font-normal text-slate-500">({classStudentsCount})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Smart Anti-Duplicate Alert Banner */}
              {totalSentTodayCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-900 shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-extrabold text-emerald-800">
                        درع منع تكرار الرسائل الذكي نشط ✓
                      </span>
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {totalSentTodayCount} طالب استلموا رسائل اليوم
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      النظام يستثني تلقائياً الطلاب الذين تم إرسال رسائل لهم اليوم ووصلتهم بنجاح لمنع الإزعاج والتكرار على أولياء الأمور عند إرسال دفعات أخرى لنفس الصف أو لصفوف مختلفة.
                    </p>
                  </div>
                </div>
              )}

              {/* Exclusion Mode Toggle Switch */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${excludeAlreadySentToday ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="toggle-exclude-sent" className="text-xs font-black text-slate-800 cursor-pointer block">
                      استثناء من تم الإرسال لهم اليوم تلقائياً
                    </label>
                    <span className="text-[10px] text-slate-500 block">
                      {excludeAlreadySentToday ? "مفعل (يخفي أو يستثني المستلمين اليوم من التحديد)" : "معطل (يسمح بإعادة الإرسال للجميع)"}
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    id="toggle-exclude-sent"
                    checked={excludeAlreadySentToday}
                    onChange={(e) => handleToggleExcludeSentToday(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Student Quick Search with Multi-Selection Preservation */}
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="ابحث باسم الطالب أو رقم الجوال لإضافته أو استبعاده..."
                    className="w-full border border-slate-200 bg-white rounded-xl pr-8 pl-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    id="input-student-search"
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery("")}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* View Selection Tabs (Unsent Today / Sent Today / Checked / Unchecked / All) */}
              <div className="flex items-center bg-slate-200/60 p-1 rounded-xl gap-1 text-[10px] font-bold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setViewSelectionFilter("unsent_today")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-center whitespace-nowrap shrink-0 ${viewSelectionFilter === "unsent_today" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800 hover:bg-white/50"}`}
                >
                  المتبقون للإرسال ({students.length - totalSentTodayCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewSelectionFilter("sent_today")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-center whitespace-nowrap shrink-0 ${viewSelectionFilter === "sent_today" ? "bg-teal-700 text-white shadow-xs" : "text-teal-800 hover:bg-white/50"}`}
                >
                  ✓ تم الإرسال اليوم ({totalSentTodayCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewSelectionFilter("selected")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-center whitespace-nowrap shrink-0 ${viewSelectionFilter === "selected" ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-700 hover:bg-white/50"}`}
                >
                  محدد ({targetedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewSelectionFilter("unselected")}
                  className={`px-2.5 py-1.5 rounded-lg transition-all text-center whitespace-nowrap shrink-0 ${viewSelectionFilter === "unselected" ? "bg-rose-600 text-white shadow-xs" : "text-slate-500 hover:bg-white/50"}`}
                >
                  ✕ مستبعد ({excludedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewSelectionFilter("all")}
                  className={`px-2 py-1.5 rounded-lg transition-all text-center whitespace-nowrap shrink-0 ${viewSelectionFilter === "all" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:bg-white/50"}`}
                >
                  الكل ({students.length})
                </button>
              </div>

              {/* Quick Action Selector Buttons */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="flex-1 text-center py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all border border-emerald-200 cursor-pointer flex items-center justify-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  تحديد المعروض
                </button>
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="flex-1 text-center py-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200 cursor-pointer flex items-center justify-center gap-1"
                >
                  <UserX className="w-3.5 h-3.5 text-slate-500" />
                  إلغاء المعروض
                </button>
                <button
                  type="button"
                  onClick={invertSelectionFiltered}
                  className="text-center px-2.5 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all border border-blue-200 cursor-pointer"
                  title="عكس التحديد الحالي"
                >
                  عكس
                </button>
                <button
                  type="button"
                  onClick={loadTodaySentHistory}
                  className="text-center px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200 cursor-pointer flex items-center gap-1"
                  title="تحديث سجل إرسال اليوم"
                >
                  <RefreshCw className="w-3 h-3 text-slate-500" />
                </button>
              </div>

              {/* Scrollable List with Master Header Checkbox */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-white shadow-inner">
                <table className="w-full text-right border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isAllFilteredSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeFilteredSelected;
                            }}
                            onChange={toggleMasterCheckbox}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            title="تحديد أو إلغاء تحديد جميع الطلاب الظاهرين بالقائمة"
                          />
                        </div>
                      </th>
                      <th className="px-2 py-2">اسم الطالب وبياناته</th>
                      <th className="px-2 py-2 text-center w-28">حالة اليوم والارسال</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-slate-400">
                          {viewSelectionFilter === "unsent_today" && totalSentTodayCount > 0 
                            ? "✓ تم إرسال الرسائل لجميع الطلاب المسجلين اليوم بنجاح!" 
                            : "لا يوجد طلاب يطابقون معايير البحث والتصفية المحددة."}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => {
                        const isSelected = selectedStudentIds.includes(student.id);
                        const sName = student.name || student["اسم الطالب"] || student["الاسم"] || student["الاسم الكامل"] || "بدون اسم";
                        const sPhone = student.phone || student["رقم الجوال"] || student["الجوال"] || "";
                        const sGrade = student.grade || student["الصف"] || "";
                        const sClass = student.className || student["الفصل"] || "";
                        const sentTodayInfo = getStudentSentTodayInfo(student);

                        return (
                          <tr
                            key={student.id}
                            onClick={() => toggleStudentSelection(student.id)}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                              sentTodayInfo 
                                ? 'bg-teal-50/40 opacity-80' 
                                : isSelected 
                                ? 'bg-emerald-50/30' 
                                : 'opacity-60 bg-slate-50/40'
                            }`}
                          >
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(student.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <span>{sName}</span>
                                {sentTodayInfo && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-full border border-teal-200">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" />
                                    أُرسل {sentTodayInfo.time}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                {sPhone && <span className="font-mono text-slate-600">{sPhone}</span>}
                                {(sGrade || sClass) && (
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px]">
                                    {sGrade} {sClass ? `/ ${sClass}` : ""}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100/90 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                                  ✓ مشمول
                                </span>
                              ) : sentTodayInfo ? (
                                <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full text-[10px] border border-teal-200">
                                  ✓ تم اليوم
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full text-[10px] border border-slate-200">
                                  ✕ مستبعد
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Selection Summary footer */}
              <div className="flex justify-between items-center bg-white p-2.5 border border-slate-200 rounded-xl text-xs">
                <span className="font-medium text-slate-600">المشمولون بعلامة صح:</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {targetedCount} من أصل {students.length} طالب
                </span>
              </div>

            </div>

            {/* Delay & Launch Controls Card with Anti-Ban Protection */}
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  3. إعدادات الفاصل الزمني والحماية ضد الحظر
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  درع الأمان نشط
                </span>
              </div>

              {/* Delay Preset Buttons */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">اختر نمط الإرسال الموصى به:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDelayPreset("safe");
                      setDelayMs(15000);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      delayPreset === "safe"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>🛡️ مدرسي آمن (موصى)</span>
                    <span className={`text-[9px] font-normal ${delayPreset === "safe" ? "text-emerald-100" : "text-slate-400"}`}>15 ثانية + تفاوت</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDelayPreset("balanced");
                      setDelayMs(10000);
                    }}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      delayPreset === "balanced"
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>⚡ وضع متوازن</span>
                    <span className={`text-[9px] font-normal ${delayPreset === "balanced" ? "text-sky-100" : "text-slate-400"}`}>10 ثوانٍ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDelayPreset("custom")}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all text-center flex flex-col items-center gap-1 ${
                      delayPreset === "custom"
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>⏱️ مخصص يدوي</span>
                    <span className={`text-[9px] font-normal ${delayPreset === "custom" ? "text-purple-100" : "text-slate-400"}`}>تحديد الثواني</span>
                  </button>
                </div>
              </div>

              {/* Custom Delay Input (Visible when custom or always as fine-tune) */}
              <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">الفاصل الأساسي (بالثواني):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={Math.round(delayMs / 1000)}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value)) * 1000;
                        setDelayMs(val);
                        setDelayPreset("custom");
                      }}
                      className="border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-16 text-center font-extrabold"
                      id="input-delay"
                    />
                    <span className="text-xs text-slate-500 font-bold">ثوانٍ</span>
                  </div>
                </div>
              </div>

              {/* Ready targets summary */}
              <div className="flex flex-col gap-1.5 bg-white border border-slate-200/80 p-3 rounded-xl">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>المستهدفون المعتمدون للإرسال الفعلي:</span>
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-xs font-extrabold">
                    {targetedCount} طالب محدد
                  </span>
                </div>
                {excludedCount > 0 && (
                  <div className="text-[11px] text-slate-500 font-medium">
                    (سيتم استبعاد وتجاوز {excludedCount} طالب بدون علامة صح تلقائياً)
                  </div>
                )}
              </div>

              {validationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl text-center font-bold">
                  {validationError}
                </div>
              )}

              <button
                onClick={handleStartCampaign}
                disabled={isLoading || targetedCount === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer mt-1"
                id="btn-trigger-campaign"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {targetedCount > 0 
                  ? `أطلق حملة الإرسال لـ (${targetedCount}) طالب محدد 🚀`
                  : "يرجى تحديد طالب واحد على الأقل بعلامة (✓)"}
              </button>
              
              {!isWhatsAppConnected && (
                <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-center text-[11px] font-semibold mt-1">
                  💡 تلميح: عند النقر سيتم التنبيه في حال كان حساب الواتساب غير متصل.
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        // ACTIVE RUNNING CAMPAIGN MONITOR
        <div className="flex flex-col gap-6 animate-fadeIn" id="active-campaign-interface">
          
          {/* Campaign summary panel */}
          <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex flex-col gap-5 text-right">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full uppercase">
                  {campaign?.status === "running" ? "جاري الإرسال" : campaign?.status === "paused" ? "متوقف مؤقتاً" : "مكتملة"}
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-1.5">{campaign?.name}</h3>
              </div>

              {/* Campaign Control Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    localStorage.removeItem("active_campaign_id");
                    setCampaignId(null);
                    setCampaign(null);
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  id="btn-back-to-editor"
                  title="الرجوع لشاشة الصياغة وتحديد الطلاب"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  <span>بدء حملة جديدة / المحرر</span>
                </button>

                {campaign?.status === "running" && (
                  <button
                    onClick={handlePauseCampaign}
                    className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    id="btn-pause"
                  >
                    <Pause className="w-3.5 h-3.5 fill-amber-700" />
                    إيقاف مؤقت للعملية
                  </button>
                )}

                {campaign?.status === "paused" && (
                  <button
                    onClick={handleResumeCampaign}
                    className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200/80 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    id="btn-resume"
                  >
                    <Play className="w-3.5 h-3.5 fill-emerald-700" />
                    استئناف الإرسال
                  </button>
                )}
              </div>
            </div>

            {/* Stats Metric Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="stats-grid">
              
              <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px] block font-bold">إجمالي الطلاب</span>
                <span className="text-xl font-bold text-slate-800">{total}</span>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px] block font-bold">تم الإرسال</span>
                <span className="text-xl font-bold text-emerald-600">{sent}</span>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px] block font-bold">فشل الإرسال</span>
                <span className="text-xl font-bold text-rose-600">{failed}</span>
              </div>

              <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-slate-400 text-[10px] block font-bold">معدل النجاح</span>
                <span className="text-xl font-bold text-sky-600">{successRate}%</span>
              </div>

            </div>

            {/* Active Safety Rest Break Alert */}
            {campaign?.restBreakUntil && campaign.restBreakUntil > Date.now() && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl flex items-center justify-between text-xs font-bold animate-pulse">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>🛡️ استراحة أمان ذكية جارية لحماية الحساب من الحظر... سيستأنف الإرسال تلقائياً بعد ثوانٍ</span>
                </div>
                <span className="text-emerald-700 font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">
                  درع الحماية نشط
                </span>
              </div>
            )}

            {/* Progress Bar & Percentage */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600 font-mono">
                <span>{progressPercent}% مكتمل</span>
                <span>{processed} من أصل {total}</span>
              </div>
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${campaign?.status === "completed" ? "bg-emerald-500" : "bg-sky-500"}`} 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>

          </div>

          {/* Table list and Search / Filters */}
          <div className="flex flex-col gap-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-right">
              <h4 className="font-bold text-slate-800 text-sm">سجل تسليم الرسائل الفردي</h4>

              <div className="flex flex-wrap items-center gap-2" id="logs-filters">
                
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن طالب أو رقم..."
                    className="border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                    id="input-log-search"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Status selector */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold" id="logs-status-filter">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setStatusFilter("success")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === "success" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    تم بنجاح
                  </button>
                  <button
                    onClick={() => setStatusFilter("failed")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === "failed" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    فشل
                  </button>
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === "pending" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    قيد الانتظار
                  </button>
                </div>

              </div>
            </div>

            {/* Logs roster grid table */}
            <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-sm" id="logs-roster-table">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-bold sticky top-0 z-10">
                      <th className="px-4 py-2 w-12">#</th>
                      <th className="px-4 py-2">اسم الطالب</th>
                      <th className="px-4 py-2">رقم الجوال</th>
                      <th className="px-4 py-2">الرسالة المرسلة</th>
                      <th className="px-4 py-2 w-28 text-center">حالة التسليم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-500 font-medium">
                    {filteredLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{log.studentName}</td>
                        <td className="px-4 py-2.5 font-mono">{log.phone}</td>
                        <td className="px-4 py-2.5 max-w-xs truncate" title={log.message}>
                          {log.message}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            
                            {log.status === "pending" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                <Clock className="w-3 h-3" />
                                بانتظار الدور
                              </span>
                            )}

                            {log.status === "sending" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-600 animate-pulse border border-sky-100">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                جاري الإرسال
                              </span>
                            )}

                            {log.status === "success" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                تم الإرسال
                              </span>
                            )}

                            {log.status === "failed" && (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 cursor-help"
                                title={log.error || "خطأ غير معروف"}
                              >
                                <XCircle className="w-3 h-3 text-rose-600" />
                                فشل
                              </span>
                            )}

                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          لا توجد نتائج مطابقة لبحثك.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
