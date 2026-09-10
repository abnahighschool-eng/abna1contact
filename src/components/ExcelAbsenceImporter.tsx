import React, { useState, useRef, useMemo, useEffect } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Edit3, 
  Check, 
  X, 
  Send, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  Search, 
  RotateCcw, 
  UserX, 
  Users, 
  Filter, 
  Download, 
  Smartphone, 
  Loader2, 
  PauseCircle, 
  CheckSquare, 
  Square,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Printer,
  FileText
} from "lucide-react";
import * as XLSX from "xlsx";
import { Student, SchoolSignatories } from "../types";
import { 
  extractStudentName, 
  extractStudentPhone, 
  extractStudentGrade, 
  extractStudentClass 
} from "./AttendanceSystem";
import { saveAttendanceDataToCloud } from "../firebaseService";

export interface ImportedAbsenceRecord {
  id: string;
  rowIndex: number;
  rawName: string;
  rawGrade: string;
  rawClass: string;
  effectiveName: string;
  effectiveGrade: string;
  effectiveClass: string;
  phone: string;
  matchStatus: "matched" | "mismatch_grade_class" | "not_found";
  matchedStudentId?: string;
  rosterStudent?: Student;
  gradeMismatchNote?: string;
  classMismatchNote?: string;
  userDecision?: "use_roster" | "use_excel" | "manual_edit" | "keep_as_is";
  isManuallyEdited?: boolean;
  notes?: string;
}

interface ExcelAbsenceImporterProps {
  students: Student[];
  signatories: SchoolSignatories;
  selectedDate: string;
  formattedDayName: string;
  isWhatsAppConnected: boolean;
  onNavigateToMessages: (tab?: "connection" | "upload" | "send" | "individual" | "reports") => void;
  onNavigateToSubTab?: (tab: "daily_absence" | "daily_tardiness" | "excel_absence_import" | "notifications" | "reports") => void;
  attendanceRecords: Record<string, Record<string, any>>;
  setAttendanceRecords: React.Dispatch<React.SetStateAction<Record<string, Record<string, any>>>>;
  todaySentMap: Record<string, { time: string; phone: string; campaignName: string; status: string }>;
  setTodaySentMap: React.Dispatch<React.SetStateAction<Record<string, { time: string; phone: string; campaignName: string; status: string }>>>;
  absenceTemplate: string;
  setAbsenceTemplate: (template: string) => void;
}

// Arabic Text Normalization Helper
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
    .replace(/ـ+/g, "") // remove tatweel
    .replace(/[إأآٱ]/g, "ا") // normalize alef
    .replace(/ة/g, "ه") // normalize ta marbuta
    .replace(/[يى]/g, "ي") // normalize ya
    .replace(/[\-\_\.\,]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Remove common genealogical particles (بن, ابن, بنت) for fuzzy comparison
function stripArabicParticles(name: string): string {
  return normalizeArabicText(name)
    .replace(/\bبن\b/g, "")
    .replace(/\bابن\b/g, "")
    .replace(/\bبنت\b/g, "")
    .replace(/\bابنة\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Intelligent Grade and Class Separation:
// Handles formats like "1 أول ثانوي", "أول ثانوي", "ثاني ثانوي 4", "3/ث", etc.
export function parseGradeAndSection(rawGradeStr: string, rawClassStr: string): { grade: string; section: string } {
  let grade = String(rawGradeStr || "").trim();
  let section = String(rawClassStr || "").trim();

  // If section is empty, try to extract leading or trailing section number from Grade string (e.g. "1 أول ثانوي" or "3 ثاني ثانوي")
  if (!section && grade) {
    // Pattern: Leading number followed by grade name: "1 أول ثانوي"
    const leadingNumMatch = grade.match(/^(\d+)\s+(.+)$/);
    if (leadingNumMatch) {
      section = leadingNumMatch[1].trim();
      grade = leadingNumMatch[2].trim();
    } else {
      // Pattern: Grade name followed by number: "أول ثانوي 1"
      const trailingNumMatch = grade.match(/^(.+)\s+(\d+)$/);
      if (trailingNumMatch) {
        grade = trailingNumMatch[1].trim();
        section = trailingNumMatch[2].trim();
      }
    }
  }

  // Normalize common grade names
  const normG = normalizeArabicText(grade);
  if (normG.includes("اول ثانوي") || normG === "الاول ثانوي" || normG === "1ث") {
    grade = "الأول ثانوي";
  } else if (normG.includes("ثاني ثانوي") || normG === "الثاني ثانوي" || normG === "2ث") {
    grade = "الثاني ثانوي";
  } else if (normG.includes("ثالث ثانوي") || normG === "الثالث ثانوي" || normG === "3ث") {
    grade = "الثالث ثانوي";
  }

  // Clean section/class (remove "فصل", "شعبة")
  section = section.replace(/(فصل|شعبة|صف)\s*/g, "").trim();

  return { grade, section };
}

export default function ExcelAbsenceImporter({
  students,
  signatories,
  selectedDate,
  formattedDayName,
  isWhatsAppConnected,
  onNavigateToMessages,
  onNavigateToSubTab,
  attendanceRecords,
  setAttendanceRecords,
  todaySentMap,
  setTodaySentMap,
  absenceTemplate,
  setAbsenceTemplate,
}: ExcelAbsenceImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortBatchRef = useRef<boolean>(false);

  const [dragActive, setDragActive] = useState(false);
  const [importedRecords, setImportedRecords] = useState<ImportedAbsenceRecord[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [filterTab, setFilterTab] = useState<"ALL" | "matched" | "mismatch" | "not_found" | "need_phone" | "sent">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [excludeAlreadySentToday, setExcludeAlreadySentToday] = useState(true);

  // Manual Editing Dialog State
  const [editingRecord, setEditingRecord] = useState<ImportedAbsenceRecord | null>(null);
  const [manualEditName, setManualEditName] = useState("");
  const [manualEditGrade, setManualEditGrade] = useState("");
  const [manualEditClass, setManualEditClass] = useState("");
  const [manualEditPhone, setManualEditPhone] = useState("");

  // Notification Status per record
  const [sendingStatusMap, setSendingStatusMap] = useState<Record<string, "idle" | "sending" | "sent" | "failed">>({});
  const [lastSentNotice, setLastSentNotice] = useState<{ studentName: string; time: string; message?: string } | null>(null);

  // Batch Sending Modal State
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean;
    isRunning: boolean;
    currentIndex: number;
    total: number;
    sentCount: number;
    failedCount: number;
    currentStudentName: string;
    countdownSeconds: number;
    isBreak?: boolean;
    isCompleted: boolean;
    logs: Array<{
      id: string;
      studentName: string;
      phone: string;
      status: "success" | "failed";
      message?: string;
      error?: string;
    }>;
  }>({
    isOpen: false,
    isRunning: false,
    currentIndex: 0,
    total: 0,
    sentCount: 0,
    failedCount: 0,
    currentStudentName: "",
    countdownSeconds: 0,
    isCompleted: false,
    logs: [],
  });

  const showToastMsg = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Helper to normalize phone
  const normalizePhone = (phoneStr?: string) => {
    if (!phoneStr) return "";
    return String(phoneStr).replace(/[^\d]/g, "");
  };

  // Check if student was already sent today
  const checkRecordSentToday = (record: ImportedAbsenceRecord) => {
    if (record.matchedStudentId && todaySentMap[`id_${record.matchedStudentId}`]) {
      return todaySentMap[`id_${record.matchedStudentId}`];
    }
    const cleanPhone = normalizePhone(record.phone);
    if (cleanPhone && todaySentMap[`phone_${cleanPhone}`]) {
      return todaySentMap[`phone_${cleanPhone}`];
    }
    const normName = normalizeArabicText(record.effectiveName);
    if (normName && todaySentMap[`name_${normName}`]) {
      return todaySentMap[`name_${normName}`];
    }
    // Also check currentDayData in attendanceRecords
    const dayData = attendanceRecords[selectedDate] || {};
    if (record.matchedStudentId && dayData[record.matchedStudentId]?.notified) {
      return {
        time: dayData[record.matchedStudentId]?.notifiedAt || "اليوم",
        phone: record.phone,
        campaignName: "إشعار غياب إكسل",
        status: "success",
      };
    }
    if (dayData[record.id]?.notified) {
      return {
        time: dayData[record.id]?.notifiedAt || "اليوم",
        phone: record.phone,
        campaignName: "إشعار غياب إكسل",
        status: "success",
      };
    }
    return null;
  };

  // Roster lookup index by normalized name for fast O(1) matching
  const rosterIndex = useMemo(() => {
    const map = new Map<string, Student>();
    const strippedMap = new Map<string, Student>();
    const tokensList: Array<{ tokens: string[]; student: Student }> = [];

    students.forEach((st) => {
      const name = extractStudentName(st).trim();
      const norm = normalizeArabicText(name);
      const stripped = stripArabicParticles(name);
      
      if (norm) map.set(norm, st);
      if (stripped) strippedMap.set(stripped, st);

      const words = stripped.split(" ").filter((w) => w.length > 2);
      if (words.length >= 2) {
        tokensList.push({ tokens: words, student: st });
      }
    });

    return { map, strippedMap, tokensList };
  }, [students]);

  // Match imported row against registered school roster
  const matchRowWithRoster = (rawName: string, rawGrade: string, rawClass: string): {
    matchStatus: "matched" | "mismatch_grade_class" | "not_found";
    matchedStudent?: Student;
    gradeMismatchNote?: string;
    classMismatchNote?: string;
    parsedGrade: string;
    parsedSection: string;
  } => {
    const { grade: parsedGrade, section: parsedSection } = parseGradeAndSection(rawGrade, rawClass);
    const normInput = normalizeArabicText(rawName);
    const strippedInput = stripArabicParticles(rawName);

    // 1. Direct exact normalized match
    let matchedStudent = rosterIndex.map.get(normInput) || rosterIndex.strippedMap.get(strippedInput);

    // 2. Token subset match (e.g. 3 of 4 words match in sequence)
    if (!matchedStudent) {
      const inputWords = strippedInput.split(" ").filter((w) => w.length > 2);
      if (inputWords.length >= 3) {
        const found = rosterIndex.tokensList.find((item) => {
          // Check if first name and family name match, plus at least one middle name
          const firstName = inputWords[0];
          const lastName = inputWords[inputWords.length - 1];
          const hasFirst = item.tokens.includes(firstName);
          const hasLast = item.tokens.includes(lastName);
          if (hasFirst && hasLast) {
            const commonWords = inputWords.filter((w) => item.tokens.includes(w));
            return commonWords.length >= Math.min(3, inputWords.length);
          }
          return false;
        });
        if (found) {
          matchedStudent = found.student;
        }
      }
    }

    // If not found in roster
    if (!matchedStudent) {
      return {
        matchStatus: "not_found",
        parsedGrade,
        parsedSection,
      };
    }

    // Found student! Now check Grade and Section consistency
    const rosterGrade = extractStudentGrade(matchedStudent);
    const rosterClass = extractStudentClass(matchedStudent);

    const normRosterGrade = normalizeArabicText(rosterGrade);
    const normExcelGrade = normalizeArabicText(parsedGrade);

    const normRosterClass = normalizeArabicText(rosterClass);
    const normExcelClass = normalizeArabicText(parsedSection);

    let gradeMismatchNote = "";
    let classMismatchNote = "";

    // Check grade mismatch (ignore if Excel grade is completely empty)
    if (normExcelGrade && normRosterGrade && !normRosterGrade.includes(normExcelGrade) && !normExcelGrade.includes(normRosterGrade)) {
      gradeMismatchNote = `الصف مختلف (بالكشف: ${rosterGrade} | بالإكسل: ${parsedGrade})`;
    }

    // Check class/section mismatch (ignore if Excel section is completely empty)
    if (normExcelClass && normRosterClass && normRosterClass !== normExcelClass) {
      classMismatchNote = `الفصل مختلف (بالكشف: ${rosterClass} | بالإكسل: ${parsedSection})`;
    }

    if (gradeMismatchNote || classMismatchNote) {
      return {
        matchStatus: "mismatch_grade_class",
        matchedStudent,
        gradeMismatchNote,
        classMismatchNote,
        parsedGrade,
        parsedSection,
      };
    }

    return {
      matchStatus: "matched",
      matchedStudent,
      parsedGrade,
      parsedSection,
    };
  };

  // Parse Excel file according to User Specification:
  // Column B = Student Name
  // Column C = Grade
  // Column D = Section/Class
  const processExcelMatrix = (rawMatrix: any[][], sourceFileName: string) => {
    if (!rawMatrix || rawMatrix.length === 0) {
      alert("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.");
      return;
    }

    // Detect if row 0 is header
    let startRow = 0;
    const firstRowStr = (rawMatrix[0] || []).map((c) => String(c || "").trim()).join(" ");
    if (
      firstRowStr.includes("اسم") ||
      firstRowStr.includes("الاسم") ||
      firstRowStr.includes("طالب") ||
      firstRowStr.includes("صف") ||
      firstRowStr.includes("فصل") ||
      firstRowStr.includes("حالة") ||
      firstRowStr.includes("م")
    ) {
      startRow = 1;
    }

    const records: ImportedAbsenceRecord[] = [];

    for (let r = startRow; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || !Array.isArray(row)) continue;

      // Column B is index 1, Column C is index 2, Column D is index 3
      const rawName = String(row[1] || "").trim();
      const rawGrade = String(row[2] || "").trim();
      const rawClass = String(row[3] || "").trim();

      // Skip empty name rows or repeated header rows
      if (!rawName || rawName === "الاسم" || rawName === "اسم الطالب" || rawName === "اسم") {
        continue;
      }

      const matchResult = matchRowWithRoster(rawName, rawGrade, rawClass);

      let effectiveName = rawName;
      let effectiveGrade = matchResult.parsedGrade;
      let effectiveClass = matchResult.parsedSection;
      let phone = "";

      if (matchResult.matchedStudent) {
        phone = extractStudentPhone(matchResult.matchedStudent);
        // By default, if matched, use Roster's canonical name, grade, and class
        effectiveName = extractStudentName(matchResult.matchedStudent);
        if (matchResult.matchStatus === "matched") {
          effectiveGrade = extractStudentGrade(matchResult.matchedStudent) || matchResult.parsedGrade;
          effectiveClass = extractStudentClass(matchResult.matchedStudent) || matchResult.parsedSection;
        } else {
          // In mismatch case, initially show Excel values but keep roster reference
          effectiveGrade = matchResult.parsedGrade || extractStudentGrade(matchResult.matchedStudent);
          effectiveClass = matchResult.parsedSection || extractStudentClass(matchResult.matchedStudent);
        }
      }

      records.push({
        id: `imp_${Date.now()}_${r}`,
        rowIndex: r + 1,
        rawName,
        rawGrade,
        rawClass,
        effectiveName,
        effectiveGrade,
        effectiveClass,
        phone,
        matchStatus: matchResult.matchStatus,
        matchedStudentId: matchResult.matchedStudent?.id,
        rosterStudent: matchResult.matchedStudent,
        gradeMismatchNote: matchResult.gradeMismatchNote,
        classMismatchNote: matchResult.classMismatchNote,
        userDecision: matchResult.matchStatus === "matched" ? "use_roster" : "keep_as_is",
      });
    }

    if (records.length === 0) {
      alert("لم يتم العثور على أي أسماء طلاب في العمود B من الملف المرفوع.");
      return;
    }

    setImportedRecords(records);
    setFileName(sourceFileName);
    setSelectedRecordIds(records.map((r) => r.id));

    // Automatically record imported students into attendanceRecords for selectedDate so they appear in discipline reports
    setAttendanceRecords((prev) => {
      const dayData = prev[selectedDate] ? { ...prev[selectedDate] } : {};
      records.forEach((record) => {
        const studentKey = record.matchedStudentId || record.id;
        dayData[studentKey] = {
          ...(dayData[studentKey] || {}),
          status: "absent_unexcused",
          notes: record.matchStatus === "not_found" ? `غياب إكسل (طالب غير مدرج بالكشف - صف: ${record.effectiveGrade} فصل: ${record.effectiveClass})` : "غياب مستورد من ملف إكسل",
          customName: record.effectiveName,
          customPhone: record.phone,
          customGrade: record.effectiveGrade,
          customClass: record.effectiveClass,
          importedFromExcel: true,
          notified: dayData[studentKey]?.notified || false,
          notifiedAt: dayData[studentKey]?.notifiedAt,
          sentMessage: dayData[studentKey]?.sentMessage,
        };
      });
      const next = { ...prev, [selectedDate]: dayData };
      try {
        localStorage.setItem("school_attendance_records", JSON.stringify(next));
        saveAttendanceDataToCloud(next).catch(console.error);
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    showToastMsg(`✓ تم استيراد (${records.length}) طالب غائب بنجاح وتوثيقهم فوراً في كشف الانضباط والطباعة`);
  };

  const handleFileUpload = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("فشل قراءة الملف");

        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawMatrix: any[][] = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

        processExcelMatrix(rawMatrix, file.name);
      } catch (err: any) {
        console.error(err);
        alert(`حدث خطأ أثناء قراءة ملف الإكسل:\n${err.message || err}`);
      } finally {
        setIsParsing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Quick Demo Samples Loader matching user screenshot (تركي عادل سعيد الغامدي, صقر فواز المطيري, etc.)
  const loadDemoFromScreenshot = () => {
    const demoMatrix = [
      ["م", "الاسم", "الصف", "الفصل", "الحالة"],
      ["1", "تركي عادل سعيد الغامدي", "1 أول ثانوي", "", "غائب"],
      ["2", "صقر فواز بن شاكر المطيري", "1 أول ثانوي", "", "غائب"],
      ["3", "عساف طلال بن عوض الرشيدي", "1 أول ثانوي", "", "غائب"],
      ["4", "فيصل محمد عبده سهلي", "1 أول ثانوي", "", "غائب"],
      ["5", "مالك بدر بن علي البلوي", "1 أول ثانوي", "", "غائب"],
      ["6", "مالك بن احمد بن هليل بن حماد الشما", "1 أول ثانوي", "", "غائب"],
      ["7", "امير محمد حماد العنزي", "2 أول ثانوي", "", "غائب"],
      ["8", "عائض محمد عائض القحطاني", "2 أول ثانوي", "", "غائب"],
      ["9", "قصي محمد حماد العنزي", "2 أول ثانوي", "", "غائب"],
      ["10", "ماجد جمعان بن حمد الغامدي", "2 أول ثانوي", "", "غائب"],
      ["11", "براء احمد سمير متولي", "3 أول ثانوي", "", "غائب"],
      ["12", "طالب غير مسجل في الكشف للتجربة", "3 أول ثانوي", "3", "غائب"],
    ];
    processExcelMatrix(demoMatrix, "كشف_الغياب_اليومي_نموذج.xlsx");
  };

  // Resolve Grade/Class Mismatch: Choose Roster
  const handleResolveMismatchUseRoster = (recordId: string) => {
    setImportedRecords((prev) =>
      prev.map((r) => {
        if (r.id === recordId && r.rosterStudent) {
          const rGrade = extractStudentGrade(r.rosterStudent);
          const rClass = extractStudentClass(r.rosterStudent);
          return {
            ...r,
            effectiveGrade: rGrade || r.effectiveGrade,
            effectiveClass: rClass || r.effectiveClass,
            userDecision: "use_roster",
            matchStatus: "matched",
            gradeMismatchNote: undefined,
            classMismatchNote: undefined,
          };
        }
        return r;
      })
    );
    showToastMsg("✓ تم اعتماد بيانات الصف والفصل من الكشف المعتمد");
  };

  // Resolve Grade/Class Mismatch: Choose Excel
  const handleResolveMismatchUseExcel = (recordId: string) => {
    setImportedRecords((prev) =>
      prev.map((r) => {
        if (r.id === recordId) {
          return {
            ...r,
            effectiveGrade: r.rawGrade || r.effectiveGrade,
            effectiveClass: r.rawClass || r.effectiveClass,
            userDecision: "use_excel",
            gradeMismatchNote: undefined,
            classMismatchNote: undefined,
          };
        }
        return r;
      })
    );
    showToastMsg("✓ تم اعتماد بيانات الصف والفصل من ملف الإكسل");
  };

  // Resolve Grade/Class Mismatch: Keep as is
  const handleResolveMismatchKeep = (recordId: string) => {
    setImportedRecords((prev) =>
      prev.map((r) => {
        if (r.id === recordId) {
          return {
            ...r,
            userDecision: "keep_as_is",
          };
        }
        return r;
      })
    );
    showToastMsg("✓ تم الإبقاء على البيانات كما هي");
  };

  // Open Edit Dialog for Record (for manual phone entry, or editing name/grade/class)
  const handleOpenEditRecord = (record: ImportedAbsenceRecord) => {
    setEditingRecord(record);
    setManualEditName(record.effectiveName);
    setManualEditGrade(record.effectiveGrade);
    setManualEditClass(record.effectiveClass);
    setManualEditPhone(record.phone);
  };

  // Save manual edit
  const handleSaveManualEdit = () => {
    if (!editingRecord) return;
    const newName = manualEditName.trim() || editingRecord.effectiveName;
    const newGrade = manualEditGrade.trim() || editingRecord.effectiveGrade;
    const newClass = manualEditClass.trim() || editingRecord.effectiveClass;
    const newPhone = manualEditPhone.trim();

    setImportedRecords((prev) =>
      prev.map((r) => {
        if (r.id === editingRecord.id) {
          return {
            ...r,
            effectiveName: newName,
            effectiveGrade: newGrade,
            effectiveClass: newClass,
            phone: newPhone,
            isManuallyEdited: true,
            userDecision: "manual_edit",
          };
        }
        return r;
      })
    );

    // Sync with attendanceRecords for discipline reporting
    const studentKey = editingRecord.matchedStudentId || editingRecord.id;
    setAttendanceRecords((prev) => {
      if (!prev[selectedDate] || !prev[selectedDate][studentKey]) return prev;
      const day = { ...prev[selectedDate] };
      day[studentKey] = {
        ...day[studentKey],
        customName: newName,
        customGrade: newGrade,
        customClass: newClass,
        customPhone: newPhone,
      };
      const next = { ...prev, [selectedDate]: day };
      try {
        localStorage.setItem("school_attendance_records", JSON.stringify(next));
        saveAttendanceDataToCloud(next).catch(console.error);
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    setEditingRecord(null);
    showToastMsg("✓ تم تحديث بيانات الطالب وتحديث كشف الانضباط بنجاح");
  };

  // Quick inline update for phone
  const handleUpdateRecordPhoneInline = (recordId: string, newPhone: string) => {
    setImportedRecords((prev) =>
      prev.map((r) => {
        if (r.id === recordId) {
          return { ...r, phone: newPhone };
        }
        return r;
      })
    );

    const target = importedRecords.find((r) => r.id === recordId);
    if (target) {
      const studentKey = target.matchedStudentId || target.id;
      setAttendanceRecords((prev) => {
        if (!prev[selectedDate] || !prev[selectedDate][studentKey]) return prev;
        const day = { ...prev[selectedDate] };
        day[studentKey] = {
          ...day[studentKey],
          customPhone: newPhone.trim(),
        };
        const next = { ...prev, [selectedDate]: day };
        try {
          localStorage.setItem("school_attendance_records", JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    }
  };

  // Construct dynamic personalized WhatsApp message
  const constructRecordMessage = (record: ImportedAbsenceRecord): string => {
    let tmpl = absenceTemplate;
    return tmpl
      .replace(/{اسم الطالب}/g, record.effectiveName)
      .replace(/{الطالب}/g, record.effectiveName)
      .replace(/{الصف}/g, record.effectiveGrade || "-")
      .replace(/{الفصل}/g, record.effectiveClass || "-")
      .replace(/{اليوم}/g, formattedDayName)
      .replace(/{التاريخ}/g, selectedDate)
      .replace(/{اسم المدرسة}/g, signatories.schoolName || "إدارة المدرسة")
      .replace(/{نوع الغياب}/g, "بدون عذر مسبق")
      .replace(/{ملاحظات}/g, record.notes || "");
  };

  // Apply and Record Attendance in School Records & Discipline Sheet
  const handleApplyToAttendanceRecords = () => {
    if (importedRecords.length === 0) {
      alert("لا يوجد طلاب مستوردين لتسجيلهم كغياب.");
      return;
    }

    const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

    setAttendanceRecords((prev) => {
      const dayData = prev[selectedDate] ? { ...prev[selectedDate] } : {};

      importedRecords.forEach((record) => {
        const studentKey = record.matchedStudentId || record.id;
        dayData[studentKey] = {
          status: "absent_unexcused",
          notes: record.matchStatus === "not_found" ? `غياب إكسل (طالب غير مدرج بالكشف - صف: ${record.effectiveGrade} فصل: ${record.effectiveClass})` : "غياب مستورد من ملف إكسل",
          customName: record.effectiveName,
          customPhone: record.phone,
          customGrade: record.effectiveGrade,
          customClass: record.effectiveClass,
          importedFromExcel: true,
          notified: dayData[studentKey]?.notified || false,
          notifiedAt: dayData[studentKey]?.notifiedAt,
        };
      });

      const updatedAll = { ...prev, [selectedDate]: dayData };
      try {
        localStorage.setItem("school_attendance_records", JSON.stringify(updatedAll));
        saveAttendanceDataToCloud(updatedAll).catch(console.error);
      } catch (e) {
        console.error(e);
      }
      return updatedAll;
    });

    showToastMsg(`✓ تم رصد واعتماد غياب (${importedRecords.length}) طالب في كشف الانضباط وسجلات المدرسة بنجاح`);
  };

  // Single WhatsApp notification sending
  const handleSendSingleRecord = async (record: ImportedAbsenceRecord, force = false) => {
    if (!record.phone) {
      alert(`⚠️ يرجى إدخال رقم جوال ولي أمر الطالب (${record.effectiveName}) أولاً لتتمكن من إرسال الإشعار.`);
      handleOpenEditRecord(record);
      return;
    }

    const sentTodayInfo = checkRecordSentToday(record);
    if (sentTodayInfo && !force) {
      const confirmSend = window.confirm(
        `🛡️ درع الحماية من تكرار الرسائل:\n\nتم إرسال رسالة اليوم بالفعل لولي أمر الطالب (${record.effectiveName}) في تمام الساعة (${sentTodayInfo.time}).\n\nهل ترغب في تجاوز درع الحماية وإعادة إرسال إشعار الغياب له مجدداً؟`
      );
      if (!confirmSend) return;
    }

    const message = constructRecordMessage(record);
    setSendingStatusMap((prev) => ({ ...prev, [record.id]: "sending" }));

    try {
      const response = await fetch("/api/whatsapp/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: record.phone,
          message,
          studentName: record.effectiveName,
          grade: record.effectiveGrade,
          className: record.effectiveClass,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSendingStatusMap((prev) => ({ ...prev, [record.id]: "sent" }));

        const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

        // Update attendance records
        const studentKey = record.matchedStudentId || record.id;
        setAttendanceRecords((prev) => {
          const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
          day[studentKey] = {
            ...(day[studentKey] || {}),
            status: "absent_unexcused",
            notified: true,
            notifiedAt: nowTime,
            sentMessage: message,
            customName: record.effectiveName,
            customPhone: record.phone,
            customGrade: record.effectiveGrade,
            customClass: record.effectiveClass,
            importedFromExcel: true,
            notes: day[studentKey]?.notes || (record.matchStatus === "not_found" ? `غياب إكسل (طالب غير مدرج بالكشف - صف: ${record.effectiveGrade} فصل: ${record.effectiveClass})` : "غياب مستورد من ملف إكسل"),
          };
          const next = { ...prev, [selectedDate]: day };
          try {
            localStorage.setItem("school_attendance_records", JSON.stringify(next));
            saveAttendanceDataToCloud(next).catch(console.error);
          } catch (e) {
            console.error(e);
          }
          return next;
        });

        // Update todaySentMap
        const cleanP = normalizePhone(record.phone);
        const normName = normalizeArabicText(record.effectiveName);
        setTodaySentMap((prev) => {
          const updated = { ...prev };
          const info = {
            time: nowTime,
            phone: record.phone,
            campaignName: "إشعار غياب إكسل",
            status: "success",
          };
          if (record.matchedStudentId) updated[`id_${record.matchedStudentId}`] = info;
          if (record.id) updated[`id_${record.id}`] = info;
          if (normName) updated[`name_${normName}`] = info;
          if (cleanP) updated[`phone_${cleanP}`] = info;
          return updated;
        });

        setLastSentNotice({
          studentName: record.effectiveName,
          time: nowTime,
          message,
        });

        showToastMsg(`✓ تم إرسال إشعار ولي أمر (${record.effectiveName}) وتوثيق الغياب في كشف الانضباط والطباعة`);
      } else {
        setSendingStatusMap((prev) => ({ ...prev, [record.id]: "failed" }));
        alert(`❌ تعذر إرسال الإشعار لـ (${record.effectiveName}):\n${data.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      setSendingStatusMap((prev) => ({ ...prev, [record.id]: "failed" }));
      alert(`❌ خطأ في الاتصال بالخادم:\n${err.message || err}`);
    }
  };

  // Launch Batch WhatsApp sending with interactive live modal and 15-second anti-ban interval + random jitter
  const handleStartBatchSending = async () => {
    let batchCandidates: ImportedAbsenceRecord[] = [];

    if (selectedRecordIds.length > 0) {
      batchCandidates = importedRecords.filter((r) => selectedRecordIds.includes(r.id));
    } else if (excludeAlreadySentToday) {
      batchCandidates = importedRecords.filter((r) => !checkRecordSentToday(r));
    } else {
      batchCandidates = importedRecords;
    }

    if (batchCandidates.length === 0) {
      if (importedRecords.length > 0 && excludeAlreadySentToday) {
        alert(
          "🛡️ درع الحماية نشط:\nتم إرسال إشعارات الغياب لجميع هؤلاء الطلاب اليوم بالفعل ولا يوجد طلاب متبقين للإرسال.\nإذا كنت ترغب في إعادة الإرسال، يرجى تحديد الطلاب أو إلغاء تفعيل درع الحماية."
        );
      } else {
        alert("لا يوجد طلاب محددين لإرسال الإشعارات لهم. يرجى تحديد طالب واحد على الأقل.");
      }
      return;
    }

    // Filter those with valid phones
    const withPhones = batchCandidates.filter((r) => !!r.phone);
    const withoutPhones = batchCandidates.filter((r) => !r.phone);

    if (withPhones.length === 0) {
      alert("⚠️ لا يوجد أي طالب يمتلك رقم جوال مسجل في القائمة المحددة. يرجى إدخال أرقام الجوال أولاً.");
      return;
    }

    // If only 1 student, send directly
    if (batchCandidates.length === 1) {
      await handleSendSingleRecord(batchCandidates[0], true);
      return;
    }

    abortBatchRef.current = false;
    setBatchModal({
      isOpen: true,
      isRunning: true,
      currentIndex: 0,
      total: batchCandidates.length,
      sentCount: 0,
      failedCount: 0,
      currentStudentName: "",
      countdownSeconds: 0,
      isCompleted: false,
      logs: [],
    });

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < batchCandidates.length; i++) {
      if (abortBatchRef.current) break;

      const record = batchCandidates[i];
      setBatchModal((prev) => ({
        ...prev,
        currentIndex: i + 1,
        currentStudentName: record.effectiveName,
        countdownSeconds: 0,
      }));

      if (!record.phone) {
        failed++;
        setBatchModal((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName: record.effectiveName,
              phone: "بدون جوال",
              status: "failed",
              error: "لا يوجد رقم جوال مسجل (يرجى إدخاله يدوياً)",
            },
            ...prev.logs,
          ],
        }));
        setSendingStatusMap((prev) => ({ ...prev, [record.id]: "failed" }));
        continue;
      }

      const message = constructRecordMessage(record);

      try {
        const res = await fetch("/api/whatsapp/send-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: record.phone,
            message,
            studentName: record.effectiveName,
            grade: record.effectiveGrade,
            className: record.effectiveClass,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          sent++;
          setSendingStatusMap((prev) => ({ ...prev, [record.id]: "sent" }));

          const nowTime = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

          // Mark in attendance
          const studentKey = record.matchedStudentId || record.id;
          setAttendanceRecords((prev) => {
            const day = prev[selectedDate] ? { ...prev[selectedDate] } : {};
            day[studentKey] = {
              ...(day[studentKey] || {}),
              status: "absent_unexcused",
              notified: true,
              notifiedAt: nowTime,
              sentMessage: message,
              customName: record.effectiveName,
              customPhone: record.phone,
              customGrade: record.effectiveGrade,
              customClass: record.effectiveClass,
              importedFromExcel: true,
              notes: day[studentKey]?.notes || (record.matchStatus === "not_found" ? `غياب إكسل (طالب غير مدرج بالكشف - صف: ${record.effectiveGrade} فصل: ${record.effectiveClass})` : "غياب مستورد من ملف إكسل"),
            };
            const next = { ...prev, [selectedDate]: day };
            try {
              localStorage.setItem("school_attendance_records", JSON.stringify(next));
              saveAttendanceDataToCloud(next).catch(console.error);
            } catch (e) {
              console.error(e);
            }
            return next;
          });

          // Update todaySentMap
          const cleanP = normalizePhone(record.phone);
          const normName = normalizeArabicText(record.effectiveName);
          setTodaySentMap((prev) => {
            const updated = { ...prev };
            const info = {
              time: nowTime,
              phone: record.phone,
              campaignName: "إشعار غياب إكسل",
              status: "success",
            };
            if (record.matchedStudentId) updated[`id_${record.matchedStudentId}`] = info;
            if (record.id) updated[`id_${record.id}`] = info;
            if (normName) updated[`name_${normName}`] = info;
            if (cleanP) updated[`phone_${cleanP}`] = info;
            return updated;
          });

          // Automatically unselect notified record
          setSelectedRecordIds((prev) => prev.filter((id) => id !== record.id));

          setBatchModal((prev) => ({
            ...prev,
            sentCount: sent,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName: record.effectiveName,
                phone: record.phone,
                status: "success",
                message: "تم الإرسال بنجاح عبر الواتساب",
              },
              ...prev.logs,
            ],
          }));
        } else {
          failed++;
          setSendingStatusMap((prev) => ({ ...prev, [record.id]: "failed" }));
          setBatchModal((prev) => ({
            ...prev,
            failedCount: failed,
            logs: [
              {
                id: `log_${Date.now()}_${i}`,
                studentName: record.effectiveName,
                phone: record.phone,
                status: "failed",
                error: data.error || "تعذر إرسال الرسالة من الخادم",
              },
              ...prev.logs,
            ],
          }));
        }
      } catch (err: any) {
        failed++;
        setSendingStatusMap((prev) => ({ ...prev, [record.id]: "failed" }));
        setBatchModal((prev) => ({
          ...prev,
          failedCount: failed,
          logs: [
            {
              id: `log_${Date.now()}_${i}`,
              studentName: record.effectiveName,
              phone: record.phone,
              status: "failed",
              error: err.message || "خطأ في الاتصال بالشبكة",
            },
            ...prev.logs,
          ],
        }));
      }

      // Safe Anti-Ban Delay with human-like jitter variation and smart micro-breaks
      if (i < batchCandidates.length - 1 && !abortBatchRef.current) {
        const totalSentSoFar = sent + failed;
        const isBreak = totalSentSoFar > 0 && totalSentSoFar % 7 === 0;

        // Realistic human interval (13s - 20s) or smart micro-break (25s - 35s)
        const jitterSecs = Math.floor(Math.random() * 7) - 2; // -2 to +4
        const totalDelaySecs = isBreak 
          ? Math.floor(Math.random() * 11) + 25 
          : Math.max(13, 15 + jitterSecs);

        for (let countdown = totalDelaySecs; countdown > 0; countdown--) {
          if (abortBatchRef.current) break;
          setBatchModal((prev) => ({
            ...prev,
            countdownSeconds: countdown,
            isBreak,
          }));
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        setBatchModal((prev) => ({ ...prev, isBreak: false }));
      }
    }

    if (!abortBatchRef.current) {
      setBatchModal((prev) => ({
        ...prev,
        isRunning: false,
        isCompleted: true,
        countdownSeconds: 0,
      }));
      showToastMsg("✓ اكتمل إرسال إشعارات كشف غياب الإكسل بنجاح وتوثيق كافة الحالات في كشف الانضباط والطباعة");
    } else {
      setBatchModal((prev) => ({
        ...prev,
        isRunning: false,
        countdownSeconds: 0,
      }));
      showToastMsg("تم إيقاف الإرسال مؤقتاً. تم حفظ وتوثيق الطلاب الذين تم إرسال الرسائل لهم في كشف الانضباط.");
    }
  };

  // Launch as Official Campaign in Campaign Monitor
  const handleLaunchAsOfficialCampaign = async () => {
    let candidates = excludeAlreadySentToday
      ? importedRecords.filter((r) => !checkRecordSentToday(r))
      : importedRecords;

    const withPhones = candidates.filter((r) => !!r.phone);

    if (withPhones.length === 0) {
      alert("لا يوجد طلاب يمتلكون أرقام جوال صالحة لإطلاق الحملة لهم.");
      return;
    }

    const campaignStudents = withPhones.map((record, idx) => ({
      id: record.matchedStudentId || record.id || `imp_${idx}`,
      name: record.effectiveName,
      "اسم الطالب": record.effectiveName,
      phone: record.phone,
      "رقم الجوال": record.phone,
      "الجوال": record.phone,
      grade: record.effectiveGrade,
      "الصف": record.effectiveGrade,
      className: record.effectiveClass,
      "الفصل": record.effectiveClass,
      customMessage: constructRecordMessage(record),
    }));

    try {
      const campaignName = `حملة غياب إكسل (فاصل 15 ثانية آمن) - ${formattedDayName} (${selectedDate})`;
      const response = await fetch("/api/whatsapp/campaign/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          students: campaignStudents,
          template: absenceTemplate,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        showToastMsg(`✓ تم إنشاء حملة الواتساب (${campaignName}) بنجاح`);
        onNavigateToMessages("send");
      } else {
        alert(`❌ فشل إنشاء الحملة: ${data.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ في الاتصال بالخادم: ${err.message || err}`);
    }
  };

  // Filtered Records based on search and tab
  const filteredRecords = useMemo(() => {
    return importedRecords.filter((record) => {
      // Tab filter
      if (filterTab === "matched" && record.matchStatus !== "matched") return false;
      if (filterTab === "mismatch" && record.matchStatus !== "mismatch_grade_class") return false;
      if (filterTab === "not_found" && record.matchStatus !== "not_found") return false;
      if (filterTab === "need_phone" && !!record.phone) return false;
      if (filterTab === "sent" && !checkRecordSentToday(record)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const mName = record.effectiveName.toLowerCase().includes(q) || record.rawName.toLowerCase().includes(q);
        const mGrade = record.effectiveGrade.toLowerCase().includes(q) || record.rawGrade.toLowerCase().includes(q);
        const mClass = record.effectiveClass.toLowerCase().includes(q) || record.rawClass.toLowerCase().includes(q);
        const mPhone = record.phone.includes(q);
        if (!mName && !mGrade && !mClass && !mPhone) return false;
      }

      return true;
    });
  }, [importedRecords, filterTab, searchQuery, todaySentMap, attendanceRecords, selectedDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = importedRecords.length;
    const matched = importedRecords.filter((r) => r.matchStatus === "matched").length;
    const mismatch = importedRecords.filter((r) => r.matchStatus === "mismatch_grade_class").length;
    const notFound = importedRecords.filter((r) => r.matchStatus === "not_found").length;
    const withPhone = importedRecords.filter((r) => !!r.phone).length;
    const missingPhone = total - withPhone;
    const sentCount = importedRecords.filter((r) => !!checkRecordSentToday(r)).length;
    return { total, matched, mismatch, notFound, withPhone, missingPhone, sentCount };
  }, [importedRecords, todaySentMap, attendanceRecords, selectedDate]);

  // Selection toggles
  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredRecords.map((r) => r.id);
    setSelectedRecordIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleDeselectAll = () => {
    setSelectedRecordIds([]);
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6 no-print" id="excel-absence-section">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>استيراد كشف الغائبين من ملف إكسل</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  مطابقة ذكية وتنبيه تلقائي
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                استيراد أسماء الغائبين من ملف الإكسل (العمود B: الاسم، العمود C: الصف، العمود D: الفصل) والتعرف التلقائي مع كشف المدرسة المعتمد
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick jump to Discipline Report */}
          {onNavigateToSubTab && (
            <button
              type="button"
              onClick={() => onNavigateToSubTab("reports")}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
              title="الانتقال إلى كشف الانضباط والطباعة"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>كشف الانضباط والطباعة ⎙</span>
            </button>
          )}

          {/* Load Sample Demo */}
          <button
            type="button"
            onClick={loadDemoFromScreenshot}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
            title="تحميل عينة تجريبية مطابقة لكشف الغياب (تركي عادل الغامدي وزملاؤه)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>تحميل نموذج تجريبي مطابق</span>
          </button>

          {/* Reset List */}
          {importedRecords.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("هل أنت متأكد من مسح بيانات كشف الإكسل المستورد؟")) {
                  setImportedRecords([]);
                  setFileName("");
                  setSelectedRecordIds([]);
                }
              }}
              className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-red-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إفراغ القائمة</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      {importedRecords.length === 0 ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
            dragActive
              ? "border-emerald-500 bg-emerald-50/60 scale-[1.01]"
              : "border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-3xl bg-white shadow-md border border-slate-200 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            {isParsing ? (
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            ) : (
              <Upload className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1.5 max-w-lg">
            <h4 className="text-sm font-extrabold text-slate-900">
              اضغط لاختيار ملف الإكسل أو اسحب الملف وأفلته هنا
            </h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              يدعم ملفات (.xlsx, .xls, .csv). يقوم النظام بقراءة:
              <br />
              <span className="font-bold text-slate-700">العمود B: اسم الطالب</span> |{" "}
              <span className="font-bold text-slate-700">العمود C: الصف</span> |{" "}
              <span className="font-bold text-slate-700">العمود D: الفصل أو الشعبة</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
              التعرف التلقائي الذكي على أسماء الطلاب
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
              تنبيه لاختلاف الصف أو الفصل
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
              إدخال الجوال يدوياً للطلاب غير المسجلين
            </span>
          </div>
        </div>
      ) : (
        /* Top Summary of Loaded File */
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900">{fileName || "كشف الغياب المستورد"}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                  {importedRecords.length} طالب غائب
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                تمت مطابقة الأسماء آلياً مع كشف المدرسة المعتمد ({students.length} طالب مسجل)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToSubTab && (
              <button
                type="button"
                onClick={() => onNavigateToSubTab("reports")}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                <span>كشف الانضباط والطباعة</span>
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>استيراد ملف آخر</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* When records exist: Stats, Filters, Template, Actions & Table */}
      {importedRecords.length > 0 && (
        <div className="space-y-6">

          {/* Quick Statistics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-right">
            
            <div 
              onClick={() => setFilterTab("ALL")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "ALL" ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "bg-slate-50 border-slate-200/80 hover:bg-slate-100"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
                إجمالي الغائبين
              </span>
              <span className="text-lg font-black">{stats.total}</span>
            </div>

            <div 
              onClick={() => setFilterTab("matched")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "matched" ? "bg-emerald-700 text-white border-emerald-700 shadow-xs" : "bg-emerald-50 border-emerald-200/80 hover:bg-emerald-100 text-emerald-900"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "matched" ? "text-emerald-200" : "text-emerald-700"}`}>
                مطابق ومعتمد ✓
              </span>
              <span className="text-lg font-black">{stats.matched}</span>
            </div>

            <div 
              onClick={() => setFilterTab("mismatch")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "mismatch" ? "bg-amber-600 text-white border-amber-600 shadow-xs" : "bg-amber-50 border-amber-200/80 hover:bg-amber-100 text-amber-900"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "mismatch" ? "text-amber-200" : "text-amber-700"}`}>
                اختلاف بالصف/الفصل ⚠️
              </span>
              <span className="text-lg font-black">{stats.mismatch}</span>
            </div>

            <div 
              onClick={() => setFilterTab("not_found")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "not_found" ? "bg-rose-700 text-white border-rose-700 shadow-xs" : "bg-rose-50 border-rose-200/80 hover:bg-rose-100 text-rose-900"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "not_found" ? "text-rose-200" : "text-rose-700"}`}>
                غير موجود بالكشف ✕
              </span>
              <span className="text-lg font-black">{stats.notFound}</span>
            </div>

            <div 
              onClick={() => setFilterTab("need_phone")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "need_phone" ? "bg-orange-600 text-white border-orange-600 shadow-xs" : "bg-orange-50 border-orange-200/80 hover:bg-orange-100 text-orange-900"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "need_phone" ? "text-orange-200" : "text-orange-700"}`}>
                ينقصه رقم جوال 📱
              </span>
              <span className="text-lg font-black">{stats.missingPhone}</span>
            </div>

            <div 
              onClick={() => setFilterTab("sent")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                filterTab === "sent" ? "bg-blue-700 text-white border-blue-700 shadow-xs" : "bg-blue-50 border-blue-200/80 hover:bg-blue-100 text-blue-900"
              }`}
            >
              <span className={`text-[10px] font-bold block ${filterTab === "sent" ? "text-blue-200" : "text-blue-700"}`}>
                مرسل إشعار اليوم 💬
              </span>
              <span className="text-lg font-black">{stats.sentCount}</span>
            </div>

          </div>

          {/* Action Bar & WhatsApp Controls (Same timing, jitter, interval as daily attendance) */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-extrabold text-white">
                    نظام إرسال إشعارات الغياب عبر الواتساب (فاصل 15 ثانية آمن مع تفاوت زمني)
                  </h4>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  نفس آلية الإرسال المعتمدة: فاصل زمني 15 ثانية عشوائي بين الرسائل لحماية الرقم، درع منع التكرار، وتوثيق فوري في كشف الانضباط
                </p>
              </div>

              {/* Anti-Duplicate Protection Toggle */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={excludeAlreadySentToday}
                  onChange={(e) => setExcludeAlreadySentToday(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>استثناء من تم إرسال رسالة له اليوم (درع منع التكرار)</span>
              </label>

            </div>

            {/* Template Preview / Edit Drawer */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>صيغة رسالة غياب الإكسل (قابلة للتعديل وتتغير متغيراتها تلقائياً لكل طالب):</span>
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  المتغيرات: {"{اسم الطالب}"} - {"{الصف}"} - {"{الفصل}"} - {"{اليوم}"} - {"{التاريخ}"}
                </span>
              </div>
              <textarea
                rows={3}
                value={absenceTemplate}
                onChange={(e) => setAbsenceTemplate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                dir="rtl"
              />
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
                <span>المحدد للإرسال:</span>
                <span className="bg-emerald-500 text-slate-900 px-2 py-0.5 rounded-full font-black text-xs">
                  {selectedRecordIds.length} من أصل {importedRecords.length}
                </span>
                {selectedRecordIds.length < importedRecords.length ? (
                  <button
                    onClick={handleSelectAllFiltered}
                    className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer text-xs mr-2"
                  >
                    تحديد الكل
                  </button>
                ) : (
                  <button
                    onClick={handleDeselectAll}
                    className="text-slate-400 hover:text-slate-300 underline cursor-pointer text-xs mr-2"
                  >
                    إلغاء التحديد
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">

                {/* 0. Direct Navigation to Discipline & Attendance Report */}
                {onNavigateToSubTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateToSubTab("reports")}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all border border-cyan-500/30 shadow-xs"
                    title="فتح كشف الانضباط والطباعة لمراجعة الغياب وتصدير أو طباعة الكشف"
                  >
                    <Printer className="w-4 h-4 text-cyan-400" />
                    <span>كشف الانضباط والطباعة ⎙</span>
                  </button>
                )}
                
                {/* 1. Record & Sync to Discipline Sheet */}
                <button
                  type="button"
                  onClick={handleApplyToAttendanceRecords}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all border border-emerald-500/30 shadow-xs"
                  title="حفظ واعتماد هذا الغياب في سجلات المدرسة وكشف الانضباط والطباعة"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>اعتماد الغياب في كشف الانضباط</span>
                </button>

                {/* 2. Launch as Official Campaign in Monitor */}
                <button
                  type="button"
                  onClick={handleLaunchAsOfficialCampaign}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all border border-slate-700 shadow-xs"
                  title="إطلاق كحملة رسمية يمكن متابعتها من شاشة مراقب الحملات"
                >
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                  <span>إطلاق كحملة في مراقب الحملات</span>
                </button>

                {/* 3. Interactive Batch Sending via WhatsApp */}
                <button
                  type="button"
                  onClick={handleStartBatchSending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-emerald-600/30"
                >
                  <Send className="w-4 h-4" />
                  <span>بدء الإرسال الجماعي الآمن عبر الواتساب ({selectedRecordIds.length})</span>
                </button>

              </div>

            </div>

          </div>

          {/* Last Sent Notice Banner with Direct Link to Discipline Report */}
          {lastSentNotice && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 animate-fadeIn shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-900">
                      تم إرسال إشعار الغياب وتوثيق الحالة في كشف الانضباط والطباعة بنجاح
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                      {lastSentNotice.time}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    الطالب: <strong className="text-emerald-950">{lastSentNotice.studentName}</strong> | تم إدراج السجل تلقائياً في كشوف الانضباط والطباعة المعتمدة متضمناً حالة ووقت الإرسال.
                  </p>
                </div>
              </div>

              {onNavigateToSubTab && (
                <button
                  type="button"
                  onClick={() => onNavigateToSubTab("reports")}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>فتح كشف الانضباط والطباعة ⎙</span>
                </button>
              )}
            </div>
          )}

          {/* Search and Table Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الطالب، الصف، الفصل، أو رقم الجوال..."
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

            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTab("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                الكل ({stats.total})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("mismatch")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === "mismatch" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                اختلاف بالصف/الفصل ({stats.mismatch})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("not_found")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === "not_found" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                }`}
              >
                غير موجود بالكشف ({stats.notFound})
              </button>

              <button
                type="button"
                onClick={() => setFilterTab("need_phone")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === "need_phone" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-800 hover:bg-orange-100"
                }`}
              >
                ينقصه رقم ({stats.missingPhone})
              </button>
            </div>

          </div>

          {/* Records Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) handleSelectAllFiltered();
                          else handleDeselectAll();
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم الطالب (العمود B)</th>
                    <th className="p-3">الصف (العمود C)</th>
                    <th className="p-3">الفصل (العمود D)</th>
                    <th className="p-3">حالة المطابقة مع الكشف</th>
                    <th className="p-3">رقم الجوال (لإرسال الواتساب)</th>
                    <th className="p-3 text-center">إجراءات الإرسال والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                        لا توجد بيانات مطابقة لخيارات التصفية الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, idx) => {
                      const isSelected = selectedRecordIds.includes(record.id);
                      const sentTodayInfo = checkRecordSentToday(record);
                      const sendingState = sendingStatusMap[record.id] || "idle";

                      return (
                        <tr
                          key={record.id}
                          className={`transition-colors ${
                            isSelected ? "bg-emerald-50/40" : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRecord(record.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          {/* Index */}
                          <td className="p-3 font-semibold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Student Name */}
                          <td className="p-3">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-slate-900 block text-xs">
                                {record.effectiveName}
                              </span>
                              {record.effectiveName !== record.rawName && (
                                <span className="text-[10px] text-slate-400 block">
                                  في الملف: {record.rawName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Grade */}
                          <td className="p-3">
                            <span className="font-bold text-slate-700">
                              {record.effectiveGrade || "-"}
                            </span>
                          </td>

                          {/* Class / Section */}
                          <td className="p-3">
                            <span className="font-bold text-slate-700">
                              {record.effectiveClass || "-"}
                            </span>
                          </td>

                          {/* Match Status & Decision Alerts */}
                          <td className="p-3">
                            {record.matchStatus === "matched" && (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>مطابق في كشف المدرسة</span>
                              </div>
                            )}

                            {record.matchStatus === "mismatch_grade_class" && (
                              <div className="space-y-1.5 max-w-xs">
                                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-300 w-fit">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>تنبيه: اختلاف في الصف أو الفصل</span>
                                </div>
                                
                                <div className="text-[10px] text-slate-600 font-medium space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <div className="text-emerald-700">
                                    • بالكشف المعتمد: {record.rosterStudent ? `${extractStudentGrade(record.rosterStudent)} - فصل ${extractStudentClass(record.rosterStudent)}` : "-"}
                                  </div>
                                  <div className="text-amber-800">
                                    • بملف الإكسل: {record.rawGrade} - فصل {record.rawClass || "-"}
                                  </div>
                                </div>

                                {/* Decision Action Buttons */}
                                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => handleResolveMismatchUseRoster(record.id)}
                                    className={`px-2 py-0.8 rounded-lg font-bold transition-all cursor-pointer ${
                                      record.userDecision === "use_roster"
                                        ? "bg-emerald-700 text-white"
                                        : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    }`}
                                  >
                                    اعتماد بيانات الكشف
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleResolveMismatchUseExcel(record.id)}
                                    className={`px-2 py-0.8 rounded-lg font-bold transition-all cursor-pointer ${
                                      record.userDecision === "use_excel"
                                        ? "bg-amber-700 text-white"
                                        : "bg-amber-100 text-amber-900 hover:bg-amber-200"
                                    }`}
                                  >
                                    اعتماد بيانات الإكسل
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditRecord(record)}
                                    className="px-2 py-0.8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
                                  >
                                    تعديل يدوي
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleResolveMismatchKeep(record.id)}
                                    className="px-2 py-0.8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-all cursor-pointer"
                                  >
                                    البقاء كما هو
                                  </button>
                                </div>
                              </div>
                            )}

                            {record.matchStatus === "not_found" && (
                              <div className="space-y-1.5 max-w-xs">
                                <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[11px] bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-300 w-fit">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>طالب غير موجود بالكشوف المعتمدة</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium block">
                                  تم استخراج الاسم والصف ({record.effectiveGrade}) والفصل ({record.effectiveClass || "-"}) من الإكسل
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Phone Column with Inline Editing for Missing Numbers */}
                          <td className="p-3">
                            {record.phone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-800 dir-ltr text-right">
                                  {record.phone}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRecord(record)}
                                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                                  title="تعديل رقم الجوال"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1 max-w-[190px]">
                                <div className="flex items-center gap-1 text-orange-700 text-[10px] font-bold">
                                  <Phone className="w-3 h-3" />
                                  <span>أدخل رقم الجوال يدوياً:</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="05XXXXXXXX"
                                    defaultValue=""
                                    onBlur={(e) => handleUpdateRecordPhoneInline(record.id, e.target.value.trim())}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleUpdateRecordPhoneInline(record.id, (e.target as HTMLInputElement).value.trim());
                                        showToastMsg("✓ تم حفظ رقم الجوال للطالب");
                                      }
                                    }}
                                    className="w-full px-2 py-1 bg-orange-50/70 border border-orange-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    dir="ltr"
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              
                              {/* Single WhatsApp Send Button */}
                              <button
                                type="button"
                                disabled={sendingState === "sending"}
                                onClick={() => handleSendSingleRecord(record)}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                  sendingState === "sending"
                                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                    : sentTodayInfo
                                    ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                }`}
                                title={sentTodayInfo ? `تم الإرسال اليوم في تمام الساعة (${sentTodayInfo.time})` : "إرسال إشعار غياب فوري لولي الأمر"}
                              >
                                {sendingState === "sending" ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {sendingState === "sending"
                                    ? "جارِ الإرسال..."
                                    : sentTodayInfo
                                    ? "مرسل اليوم ✓"
                                    : "إشعار واتساب"}
                                </span>
                              </button>

                              {/* Edit Modal Trigger */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditRecord(record)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                                title="تعديل بيانات الطالب ورقم الهاتف"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                            </div>
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

      {/* Manual Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 text-right">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>تعديل بيانات الطالب ورقم الجوال</span>
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">اسم الطالب:</label>
                <input
                  type="text"
                  value={manualEditName}
                  onChange={(e) => setManualEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">الصف:</label>
                  <input
                    type="text"
                    value={manualEditGrade}
                    onChange={(e) => setManualEditGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">الفصل/الشعبة:</label>
                  <input
                    type="text"
                    value={manualEditClass}
                    onChange={(e) => setManualEditClass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  رقم جوال ولي الأمر (لإرسال إشعار الواتساب):
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="05XXXXXXXX أو 9665XXXXXXXX"
                    value={manualEditPhone}
                    onChange={(e) => setManualEditPhone(e.target.value)}
                    className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 dir-ltr text-right"
                  />
                </div>
              </div>

              {editingRecord.rosterStudent && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 space-y-1">
                  <span className="font-bold block">بيانات الطالب بالكشف المعتمد:</span>
                  <div>الاسم: {extractStudentName(editingRecord.rosterStudent)}</div>
                  <div>الصف: {extractStudentGrade(editingRecord.rosterStudent)} - الفصل: {extractStudentClass(editingRecord.rosterStudent)}</div>
                  <div>الجوال: {extractStudentPhone(editingRecord.rosterStudent)}</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveManualEdit}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
              >
                حفظ التعديلات
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Batch WhatsApp Sending Modal with Human Delay & Jitter */}
      {batchModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 text-right">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {batchModal.isCompleted
                      ? "اكتمل إرسال إشعارات غياب الإكسل بنجاح"
                      : "جارِ إرسال إشعارات غياب الإكسل عبر الواتساب"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    فاصل زمني آمن 15 ثانية وتفاوت عشوائي لحماية الرقم من الحظر
                  </p>
                </div>
              </div>

              {!batchModal.isRunning && (
                <button
                  onClick={() => setBatchModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>
                  تم إرسال {batchModal.sentCount} من {batchModal.total} طالب
                </span>
                <span className="text-emerald-700 font-mono">
                  {Math.round(((batchModal.sentCount + batchModal.failedCount) / Math.max(1, batchModal.total)) * 100)}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${((batchModal.sentCount + batchModal.failedCount) / Math.max(1, batchModal.total)) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Current Student & Countdown Timer */}
            {batchModal.isRunning && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 block">الطالب الحالي:</span>
                  <span className="text-xs font-black text-slate-800">{batchModal.currentStudentName}</span>
                </div>

                {batchModal.countdownSeconds > 0 && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                    batchModal.isBreak
                      ? "bg-amber-50 text-amber-900 border-amber-300"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}>
                    <Clock className={`w-4 h-4 ${batchModal.isBreak ? "text-amber-600 animate-bounce" : "text-emerald-600 animate-spin"}`} />
                    <span className="text-xs font-bold">
                      {batchModal.isBreak 
                        ? `استراحة أمان ذكية: ${batchModal.countdownSeconds} ثانية` 
                        : `فاصل الأمان: ${batchModal.countdownSeconds} ثانية`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Live Logs */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block">سجل الإرسال المباشر:</span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {batchModal.logs.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs font-medium">
                    بدء تهيئة الرسائل وجدولتها...
                  </div>
                ) : (
                  batchModal.logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg flex items-center justify-between text-xs font-semibold ${
                        log.status === "success"
                          ? "bg-emerald-50/90 text-emerald-900 border border-emerald-200"
                          : "bg-rose-50/90 text-rose-900 border border-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {log.status === "success" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span>{log.studentName}</span>
                        <span className="text-[10px] font-mono text-slate-500">({log.phone})</span>
                      </div>
                      <span className="text-[10px] font-bold">
                        {log.message || log.error}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Completion Banner */}
            {batchModal.isCompleted && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تم توثيق كافة إشعارات الغياب في كشف الانضباط والطباعة بنجاح ✓</span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                  أصبح بإمكانك الآن استعراض التقرير الموحد الشامل لكشف الانضباط والطباعة متضمناً أوقات الإرسال وحالة كل طالب بدقة تامة.
                </p>
                {onNavigateToSubTab && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchModal((prev) => ({ ...prev, isOpen: false }));
                      onNavigateToSubTab("reports");
                    }}
                    className="w-full mt-1.5 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>الانتقال لكشف الانضباط والطباعة الآن ⎙</span>
                  </button>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-4 gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="text-emerald-700">ناجح: {batchModal.sentCount}</span>
                <span>•</span>
                <span className="text-rose-700">فشل: {batchModal.failedCount}</span>
              </div>

              <div className="flex items-center gap-2">
                {batchModal.isRunning ? (
                  <button
                    type="button"
                    onClick={() => {
                      abortBatchRef.current = true;
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <PauseCircle className="w-4 h-4" />
                    <span>إيقاف الإرسال مؤقتاً</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {onNavigateToSubTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchModal((prev) => ({ ...prev, isOpen: false }));
                          onNavigateToSubTab("reports");
                        }}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        <span>كشف الانضباط والطباعة ⎙</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setBatchModal((prev) => ({ ...prev, isOpen: false }))}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
