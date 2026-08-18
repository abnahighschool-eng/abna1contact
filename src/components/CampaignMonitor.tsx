import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RefreshCw, Send, AlertCircle, CheckCircle2, XCircle, Loader2, ArrowRight, Clock, ShieldCheck, Search, Filter, MessageSquare, Plus, Smartphone, Smile, CheckCheck, Info, Users } from "lucide-react";
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
  const [delayMs, setDelayMs] = useState(3000);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [campaignName, setCampaignName] = useState("");
  const [validationError, setValidationError] = useState("");

  // Filtering & Selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

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

  // Synchronize selection on students load
  useEffect(() => {
    if (students && students.length > 0) {
      setSelectedStudentIds(students.map(s => s.id));
    }
  }, [students]);

  // Extract unique grades and classes
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade || s["الصف"] || "").filter(Boolean))) as string[];
  const uniqueClasses = Array.from(new Set(students.map(s => s.className || s["الفصل"] || "").filter(Boolean))) as string[];

  // Filtered list
  const filteredStudents = students.filter(student => {
    const studentGrade = student.grade || student["الصف"] || "";
    const studentClass = student.className || student["الفصل"] || "";
    
    const matchesGrade = gradeFilter === "all" || studentGrade === gradeFilter;
    const matchesClass = classFilter === "all" || studentClass === classFilter;
    
    return matchesGrade && matchesClass;
  });

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => {
      const otherIds = prev.filter(id => !filteredIds.includes(id));
      return [...otherIds, ...filteredIds];
    });
  };

  const deselectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(prev => prev.filter(id => !filteredIds.includes(id)));
  };

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
    
    setValidationError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/whatsapp/campaign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          students: studentsToSubmit,
          template,
          delayMs,
        }),
      });

      const data = await response.json();

      if (response.ok && data.campaignId) {
        setCampaignId(data.campaignId);
        
        // Fetch immediately
        const campRes = await fetch(`/api/whatsapp/campaign/${data.campaignId}`);
        if (campRes.ok) {
          setCampaign(await campRes.json());
        }
      } else {
        setValidationError(data.error || "تعذر إطلاق الحملة، يرجى التحقق من صحة البيانات.");
      }
    } catch (err: any) {
      console.error(err);
      setValidationError("حدث خطأ أثناء الاتصال بالخادم لإطلاق الحملة.");
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
                      <h4 className="text-[10px] font-bold leading-none">ABNA SCHOOL 1</h4>
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
            
            {/* Campaign Parameters Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                2. تحديد المستهدفين واختيار الطلاب
              </h3>

              {/* Camp Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">تسمية الحملة الدراسية:</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="أدخل اسماً للحملة للرجوع إليها لاحقاً..."
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  id="input-campaign-name"
                />
              </div>

              {/* Filtering Controls */}
              <div className="grid grid-cols-1 gap-3 border-t border-slate-200/50 pt-3">
                
                {/* Grade Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">اختيار صف كامل:</label>
                  <select
                    value={gradeFilter}
                    onChange={(e) => {
                      setGradeFilter(e.target.value);
                      setPreviewStudentIdx(0);
                    }}
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="all">كل الصفوف الدراسية ({uniqueGrades.length})</option>
                    {uniqueGrades.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                {/* Class Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">اختيار الشعبة / الفصل:</label>
                  <select
                    value={classFilter}
                    onChange={(e) => {
                      setClassFilter(e.target.value);
                      setPreviewStudentIdx(0);
                    }}
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="all">كل الفصول / الشعب ({uniqueClasses.length})</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick selectors & Summary */}
              <div className="flex flex-col gap-2 bg-white p-3 border border-slate-150 rounded-xl mt-1">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                  <span>الطلاب بالتصفية الحالية:</span>
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{filteredStudents.length} طلاب</span>
                </div>
                
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                  <span>المستهدفون المحددون للإرسال:</span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    {students.filter(s => selectedStudentIds.includes(s.id)).length} طالب
                  </span>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-2.5 mt-1">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="flex-1 text-center py-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all border border-emerald-100 cursor-pointer"
                  >
                    تحديد الكل بالتصفية
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    className="flex-1 text-center py-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all border border-slate-200 cursor-pointer"
                  >
                    إلغاء الكل بالتصفية
                  </button>
                </div>
              </div>

              {/* Scrollable list of students with checkboxes */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white shadow-inner">
                <table className="w-full text-right border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">إرسال؟</th>
                      <th className="px-2 py-2">اسم الطالب</th>
                      <th className="px-2 py-2">الصف/الفصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                          لا يوجد طلاب يطابقون خيارات التصفية المحددة.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map(student => {
                        const isSelected = selectedStudentIds.includes(student.id);
                        return (
                          <tr
                            key={student.id}
                            onClick={() => toggleStudentSelection(student.id)}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-50/20 font-semibold' : ''}`}
                          >
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(student.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                              />
                            </td>
                            <td className="px-2 py-2 font-medium text-slate-800">{student.name}</td>
                            <td className="px-2 py-2 text-slate-500 text-[10px]">
                              {student.grade || student["الصف"] || ""}/{student.className || student["الفصل"] || ""}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Delay & Launch Controls Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                3. إعدادات الإرسال والتشغيل
              </h3>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  الفاصل الزمني المُحدد بين الرسائل (بالثواني):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={Math.round(delayMs / 1000)}
                    onChange={(e) => setDelayMs(Math.max(1, Number(e.target.value)) * 1000)}
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-24 text-center font-bold"
                    id="input-delay"
                  />
                  <span className="text-xs text-slate-500 font-semibold">ثوانٍ بين كل رسالة</span>
                </div>
              </div>

              {Math.round(delayMs / 1000) >= 3 ? (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200/80 text-emerald-800 p-3 rounded-xl text-[11px] leading-relaxed shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>الفاصل الزمني آمن ومثالي:</strong> تم اعتماد <strong>{Math.round(delayMs / 1000)} ثوانٍ</strong> بين كل رسالة لحماية حسابك وضمان وصول مستقر.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] leading-relaxed shadow-xs">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>تنبيه سرعة الإرسال:</strong> الفاصل المحدد ({Math.round(delayMs / 1000)} ثانية) سريع جداً. نوصي بـ 3 ثوانٍ أو أكثر لإرسال جماعي آمن ومستقر لمنع الحظر.
                  </span>
                </div>
              )}

              {/* Ready targets summary */}
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 bg-white border border-slate-200/80 px-3.5 py-2.5 rounded-xl">
                <span>جاهز للإرسال الفعلي إلى:</span>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-lg text-xs">
                  {students.filter(s => selectedStudentIds.includes(s.id)).length} طالب محدد
                </span>
              </div>

              {validationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl text-center font-bold">
                  {validationError}
                </div>
              )}

              <button
                onClick={handleStartCampaign}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-3.5 px-6 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer mt-1"
                id="btn-trigger-campaign"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                أطلق حملة الإرسال الجماعي الآن 🚀
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
