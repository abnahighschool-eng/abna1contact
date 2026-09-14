import React, { useState, useRef, useMemo } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  Edit3, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  Save, 
  Smartphone, 
  User, 
  GraduationCap, 
  School,
  RefreshCw,
  ShieldCheck,
  Archive,
  RotateCcw,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { Student } from "../types";
import { reconcileStudentsRoster, ReconcileStudentsResult } from "../utils/rosterReconciliation";

interface ExcelUploaderProps {
  onStudentsLoaded: (students: Student[]) => void;
  students: Student[];
}

export default function ExcelUploader({ onStudentsLoaded, students }: ExcelUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [rawRowsData, setRawRowsData] = useState<any[]>([]);
  const [selectedNameCol, setSelectedNameCol] = useState("");
  const [selectedPhoneCol, setSelectedPhoneCol] = useState("");
  const [selectedGradeCol, setSelectedGradeCol] = useState("");
  const [selectedClassCol, setSelectedClassCol] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rosterTab, setRosterTab] = useState<"all" | "active" | "archived">("active");
  const [reconcileStats, setReconcileStats] = useState<any | null>(null);
  const [reconcileNotification, setReconcileNotification] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual student modal / form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");

  // Edit student modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGrade, setEditGrade] = useState("");
  const [editClass, setEditClass] = useState("");

  // Generate high fidelity demo roster
  const generateDemoRoster = () => {
    const demoStudents: Student[] = [
      { id: "1", "اسم الطالب": "أحمد بن عبد العزيز الشمري", name: "أحمد بن عبد العزيز الشمري", "رقم الجوال": "+966501234567", phone: "+966501234567", "الصف": "أول ثانوي", grade: "أول ثانوي", "الفصل": "أ", className: "أ" },
      { id: "2", "اسم الطالب": "سعد بن محمد القحطاني", name: "سعد بن محمد القحطاني", "رقم الجوال": "+966505551234", phone: "+966505551234", "الصف": "أول ثانوي", grade: "أول ثانوي", "الفصل": "أ", className: "أ" },
      { id: "3", "اسم الطالب": "خالد بن الوليد المطيري", name: "خالد بن الوليد المطيري", "رقم الجوال": "+966509876543", phone: "+966509876543", "الصف": "أول ثانوي", grade: "أول ثانوي", "الفصل": "ب", className: "ب" },
      { id: "4", "اسم الطالب": "فيصل بن خالد الدوسري", name: "فيصل بن خالد الدوسري", "رقم الجوال": "+966556677889", phone: "+966556677889", "الصف": "ثاني ثانوي", grade: "ثاني ثانوي", "الفصل": "أ", className: "أ" },
      { id: "5", "اسم الطالب": "عبد الرحمن بن سليمان الفهد", name: "عبد الرحمن بن سليمان الفهد", "رقم الجوال": "0539871234", phone: "0539871234", "الصف": "ثاني ثانوي", grade: "ثاني ثانوي", "الفصل": "ج", className: "ج" },
      { id: "6", "اسم الطالب": "نوف بنت عبد الله السبيعي", name: "نوف بنت عبد الله السبيعي", "رقم الجوال": "0541122334", phone: "0541122334", "الصف": "ثالث ثانوي", grade: "ثالث ثانوي", "الفصل": "علمي", className: "علمي" },
      { id: "7", "اسم الطالب": "سارة بنت فهد الحارثي", name: "سارة بنت فهد الحارثي", "رقم الجوال": "0564455667", phone: "0564455667", "الصف": "ثالث ثانوي", grade: "ثالث ثانوي", "الفصل": "علمي", className: "علمي" }
    ];
    setColumns(["اسم الطالب", "رقم الجوال", "الصف", "الفصل"]);
    setSelectedNameCol("اسم الطالب");
    setSelectedPhoneCol("رقم الجوال");
    setSelectedGradeCol("الصف");
    setSelectedClassCol("الفصل");
    
    if (students && students.length > 0) {
      const reconcileRes = reconcileStudentsRoster(students, demoStudents);
      onStudentsLoaded(reconcileRes.reconciledStudents);
      setReconcileStats(reconcileRes.stats);
      setReconcileNotification(reconcileRes.summaryMessage);
    } else {
      onStudentsLoaded(demoStudents);
      setReconcileStats(null);
      setReconcileNotification("تم توليد كشف الطلاب التجريبي بنجاح وهو محصن في النظام.");
    }
    setErrorMsg("");
  };

  // Helper to validate phone number format
  const isValidPhone = (phoneStr: string) => {
    if (!phoneStr) return false;
    const cleaned = phoneStr.replace(/[\s\-\+\(\)]/g, "");
    return /^\d{9,14}$/.test(cleaned);
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    setErrorMsg("");
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("فشل قراءة الملف");

        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read sheet as raw 2D matrix
        const rawMatrix: any[][] = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

        if (!rawMatrix || rawMatrix.length === 0) {
          throw new Error("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة");
        }

        // 1. Detect Header Row: Look at the first 5 rows to see which one looks like column headers
        let headerRowIdx = -1;
        const headerKeywords = ["اسم", "طالب", "هاتف", "جوال", "موبايل", "صف", "فصل", "شعبة", "رقم", "name", "phone", "mobile", "grade", "class", "section"];
        
        for (let r = 0; r < Math.min(rawMatrix.length, 5); r++) {
          const row = rawMatrix[r];
          if (!row || !Array.isArray(row)) continue;
          const matchCount = row.filter(cell => {
            const str = String(cell || "").toLowerCase().trim();
            return headerKeywords.some(kw => str.includes(kw));
          }).length;

          if (matchCount >= 2) {
            headerRowIdx = r;
            break;
          }
        }

        // Determine columns
        let detectedHeaders: string[] = [];
        let dataStartIdx = 0;

        if (headerRowIdx !== -1) {
          detectedHeaders = rawMatrix[headerRowIdx].map((h, i) => {
            const title = String(h || "").trim();
            return title || `العمود ${String.fromCharCode(65 + i)}`;
          });
          dataStartIdx = headerRowIdx + 1;
        } else {
          // No text header row found, generate letters A, B, C...
          const maxCols = Math.max(...rawMatrix.map(r => (r ? r.length : 0)), 4);
          for (let i = 0; i < maxCols; i++) {
            detectedHeaders.push(`العمود ${String.fromCharCode(65 + i)}`);
          }
          dataStartIdx = 0;
        }

        // Clean data rows
        const parsedRows: any[] = [];
        for (let r = dataStartIdx; r < rawMatrix.length; r++) {
          const row = rawMatrix[r];
          if (!row || !Array.isArray(row)) continue;
          
          const rowObj: any = {};
          let hasContent = false;
          
          detectedHeaders.forEach((header, colIdx) => {
            const cellVal = row[colIdx];
            const cleanVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";
            rowObj[header] = cleanVal;
            if (cleanVal !== "") hasContent = true;
          });

          if (hasContent) {
            parsedRows.push(rowObj);
          }
        }

        if (parsedRows.length === 0) {
          throw new Error("لم يتم العثور على سجلات طلاب صالحة داخل الملف.");
        }

        setColumns(detectedHeaders);
        setRawRowsData(parsedRows);

        // 2. Intelligent Scoring & Matching for the 4 core columns: Name, Phone, Grade, Class
        const colScores: Record<string, { name: number; phone: number; grade: number; class: number }> = {};
        detectedHeaders.forEach(h => {
          colScores[h] = { name: 0, phone: 0, grade: 0, class: 0 };
        });

        // Header keyword bonuses
        detectedHeaders.forEach(h => {
          const lh = h.toLowerCase();
          if (lh.includes("اسم") || lh.includes("طالب") || lh.includes("name") || lh.includes("student")) {
            colScores[h].name += 15;
          }
          if (lh.includes("جوال") || lh.includes("هاتف") || lh.includes("موبايل") || lh.includes("phone") || lh.includes("mobile") || lh.includes("رقم")) {
            colScores[h].phone += 15;
          }
          if (lh.includes("صف") || lh.includes("المستوى") || lh.includes("مستوى") || lh.includes("grade") || lh.includes("stage")) {
            colScores[h].grade += 15;
          }
          if (lh.includes("فصل") || lh.includes("شعبة") || lh.includes("class") || lh.includes("section") || lh.includes("مجموعة")) {
            colScores[h].class += 15;
          }
        });

        // Value analysis on sample rows
        const sampleSlice = parsedRows.slice(0, 20);
        sampleSlice.forEach(row => {
          detectedHeaders.forEach(h => {
            const val = String(row[h] || "").trim();
            if (!val) return;

            // Phone check
            const cleanedNum = val.replace(/[\s\-\+\(\)]/g, "");
            if (/^\d{9,14}$/.test(cleanedNum)) {
              if (cleanedNum.startsWith("9665") || cleanedNum.startsWith("05") || cleanedNum.startsWith("5")) {
                colScores[h].phone += 8;
              } else {
                colScores[h].phone += 4;
              }
            }

            // Arabic Name check (Multiple words, Arabic letters, no numbers)
            const hasArabic = /[\u0600-\u06FF]/.test(val);
            const words = val.split(/\s+/).filter(w => w.length > 1);
            const hasDigits = /\d/.test(val);
            if (hasArabic && words.length >= 2 && !hasDigits) {
              colScores[h].name += 6;
            }

            // Grade check
            const lVal = val.toLowerCase();
            if (lVal.includes("ثانوي") || lVal.includes("متوسط") || lVal.includes("ابتدائي") || lVal.includes("أول") || lVal.includes("ثاني") || lVal.includes("ثالث") || lVal.includes("رابع") || lVal.includes("خامس") || lVal.includes("سادس")) {
              colScores[h].grade += 6;
            }

            // Class check (short character like أ, ب, ج, 1, 2, 1/1, 2/3)
            if ((val.length <= 4 && !val.includes("ثانوي")) || /^[أ-يA-Za-z0-9\/\-]+$/.test(val)) {
              colScores[h].class += 3;
            }
          });
        });

        // Pick best distinct columns
        let bestName = "";
        let bestPhone = "";
        let bestGrade = "";
        let bestClass = "";

        let maxName = -1;
        let maxPhone = -1;
        let maxGrade = -1;
        let maxClass = -1;

        // 1. Pick best Phone
        detectedHeaders.forEach(h => {
          if (colScores[h].phone > maxPhone) {
            maxPhone = colScores[h].phone;
            bestPhone = h;
          }
        });

        // 2. Pick best Name (excluding Phone)
        detectedHeaders.forEach(h => {
          if (h !== bestPhone && colScores[h].name > maxName) {
            maxName = colScores[h].name;
            bestName = h;
          }
        });

        // 3. Pick best Grade (excluding Name and Phone)
        detectedHeaders.forEach(h => {
          if (h !== bestPhone && h !== bestName && colScores[h].grade > maxGrade) {
            maxGrade = colScores[h].grade;
            bestGrade = h;
          }
        });

        // 4. Pick best Class (excluding others)
        detectedHeaders.forEach(h => {
          if (h !== bestPhone && h !== bestName && h !== bestGrade && colScores[h].class > maxClass) {
            maxClass = colScores[h].class;
            bestClass = h;
          }
        });

        // Fallbacks if not detected
        if (!bestName && detectedHeaders.length > 0) bestName = detectedHeaders[0];
        if (!bestPhone && detectedHeaders.length > 1) bestPhone = detectedHeaders.find(h => h !== bestName) || detectedHeaders[1];

        setSelectedNameCol(bestName);
        setSelectedPhoneCol(bestPhone);
        setSelectedGradeCol(bestGrade);
        setSelectedClassCol(bestClass);

        // Build formatted students list
        buildAndLoadStudents(parsedRows, bestName, bestPhone, bestGrade, bestClass);

      } catch (err: any) {
        setErrorMsg(err.message || "حدث خطأ أثناء معالجة ملف Excel. يرجى التأكد من صياغة الملف بشكل صحيح.");
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("خطأ في قراءة الملف.");
      setIsParsing(false);
    };

    reader.readAsBinaryString(file);
  };

  const buildAndLoadStudents = (
    rows: any[], 
    nameCol: string, 
    phoneCol: string, 
    gradeCol: string, 
    classCol: string
  ) => {
    const formatted: Student[] = rows.map((row, idx) => {
      const nameVal = nameCol && row[nameCol] ? String(row[nameCol]).trim() : `طالب ${idx + 1}`;
      const phoneVal = phoneCol && row[phoneCol] ? String(row[phoneCol]).trim() : "";
      const gradeVal = gradeCol && row[gradeCol] ? String(row[gradeCol]).trim() : "";
      const classVal = classCol && row[classCol] ? String(row[classCol]).trim() : "";

      const nidVal = row["السجل المدني"] || row["رقم الهوية"] || row["الهوية"] || row.nationalId || "";

      const studentObj: Student = {
        id: row.id || String(idx + 1),
        name: nameVal,
        phone: phoneVal,
        grade: gradeVal,
        className: classVal,
        nationalId: nidVal ? String(nidVal).trim() : undefined,
        // Standard Arabic aliases for message templates
        "اسم الطالب": nameVal,
        "الاسم": nameVal,
        "رقم الجوال": phoneVal,
        "الجوال": phoneVal,
        "الصف": gradeVal,
        "الفصل": classVal,
        ...row // keep all other original row fields for custom tags
      };

      return studentObj;
    });

    // Smart Reconciliation against existing students:
    // Matches existing students by (National ID -> ID -> Name+Grade -> Phone),
    // preserves existing stable IDs, links with attendance/health/inquiry/messages,
    // and archives students from previous sheets without losing any records.
    const reconcileResult = reconcileStudentsRoster(students, formatted);
    onStudentsLoaded(reconcileResult.reconciledStudents);
    setReconcileStats(reconcileResult.stats);
    setReconcileNotification(reconcileResult.summaryMessage);
  };

  const handleRemapColumns = (nameCol: string, phoneCol: string, gradeCol: string, classCol: string) => {
    setSelectedNameCol(nameCol);
    setSelectedPhoneCol(phoneCol);
    setSelectedGradeCol(gradeCol);
    setSelectedClassCol(classCol);

    if (rawRowsData.length > 0) {
      buildAndLoadStudents(rawRowsData, nameCol, phoneCol, gradeCol, classCol);
    } else {
      // Remap existing students
      const remapped = students.map(std => {
        const nameVal = nameCol && std[nameCol] !== undefined ? String(std[nameCol]).trim() : (std.name || "");
        const phoneVal = phoneCol && std[phoneCol] !== undefined ? String(std[phoneCol]).trim() : (std.phone || "");
        const gradeVal = gradeCol && std[gradeCol] !== undefined ? String(std[gradeCol]).trim() : (std.grade || "");
        const classVal = classCol && std[classCol] !== undefined ? String(std[classCol]).trim() : (std.className || "");

        return {
          ...std,
          name: nameVal,
          phone: phoneVal,
          grade: gradeVal,
          className: classVal,
          "اسم الطالب": nameVal,
          "الاسم": nameVal,
          "رقم الجوال": phoneVal,
          "الجوال": phoneVal,
          "الصف": gradeVal,
          "الفصل": classVal,
        };
      });
      onStudentsLoaded(remapped);
    }
  };

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
      const file = e.dataTransfer.files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (["xlsx", "xls", "csv"].includes(ext || "")) {
        parseFile(file);
      } else {
        setErrorMsg("يرجى رفع ملفات بصيغة Excel (.xlsx, .xls) أو CSV فقط.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      parseFile(e.target.files[0]);
    }
  };

  // Student Actions: Archive, Restore & Permanent Delete
  const archiveStudent = (id: string) => {
    const updated = students.map(s => s.id === id ? { ...s, isArchived: true, archivedAt: new Date().toISOString() } : s);
    onStudentsLoaded(updated);
    setReconcileNotification("تم نقل الطالب إلى الأرشيف المحصن مع الاحتفاظ بكافة سجلاته التاريخية.");
  };

  const restoreStudent = (id: string) => {
    const updated = students.map(s => s.id === id ? { ...s, isArchived: false, archivedAt: undefined } : s);
    onStudentsLoaded(updated);
    setReconcileNotification("تمت استعادة الطالب بنجاح إلى الكشف النشط.");
  };

  const permanentlyDeleteStudent = (id: string) => {
    const confirmed = window.confirm("هل أنت متأكد من الحذف النهائي لهذا السجل؟ (يُفضل إبقاؤه في الأرشيف لحفظ السجلات التاريخية)");
    if (confirmed) {
      const updated = students.filter(s => s.id !== id);
      onStudentsLoaded(updated);
    }
  };

  const openEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditName(student.name || student["اسم الطالب"] || "");
    setEditPhone(student.phone || student["رقم الجوال"] || "");
    setEditGrade(student.grade || student["الصف"] || "");
    setEditClass(student.className || student["الفصل"] || "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const updated = students.map(s => {
      if (s.id === editingStudent.id) {
        return {
          ...s,
          name: editName.trim(),
          phone: editPhone.trim(),
          grade: editGrade.trim(),
          className: editClass.trim(),
          "اسم الطالب": editName.trim(),
          "الاسم": editName.trim(),
          "رقم الجوال": editPhone.trim(),
          "الجوال": editPhone.trim(),
          "الصف": editGrade.trim(),
          "الفصل": editClass.trim(),
        };
      }
      return s;
    });

    onStudentsLoaded(updated);
    setEditingStudent(null);
  };

  const handleAddManualStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentPhone) {
      setErrorMsg("الرجاء إدخال الاسم ورقم الهاتف على الأقل.");
      return;
    }

    const cleanPhone = newStudentPhone.trim();
    const newStudent: Student = {
      id: "manual-" + Date.now(),
      name: newStudentName.trim(),
      phone: cleanPhone,
      grade: newStudentGrade.trim(),
      className: newStudentClass.trim(),
      "اسم الطالب": newStudentName.trim(),
      "الاسم": newStudentName.trim(),
      "رقم الجوال": cleanPhone,
      "الجوال": cleanPhone,
      "الصف": newStudentGrade.trim(),
      "الفصل": newStudentClass.trim(),
    };

    onStudentsLoaded([...students, newStudent]);
    setNewStudentName("");
    setNewStudentPhone("");
    setNewStudentGrade("");
    setNewStudentClass("");
    setShowManualForm(false);
    setErrorMsg("");
  };

  const clearRoster = () => {
    if (students.length > 0) {
      const confirmArchive = window.confirm("هل ترغب في أرشفة الطلاب الحاليين لحفظ سجلاتهم التاريخية (الغياب، الرعاية، الرسائل) بدلاً من الحذف الكامل؟\n\n- موافق (OK): أرشفة وحفظ السجلات بأمان.\n- إلغاء (Cancel): البقاء دون تغيير.");
      if (confirmArchive) {
        const archived = students.map(s => ({ ...s, isArchived: true, archivedAt: new Date().toISOString() }));
        onStudentsLoaded(archived);
        setReconcileNotification("تمت أرشفة الكشف بنجاح مع تحصين وحفظ كافة السجلات التاريخية.");
      }
    }
  };

  const activeStudentsCount = useMemo(() => students.filter(s => !s.isArchived).length, [students]);
  const archivedStudentsCount = useMemo(() => students.filter(s => !!s.isArchived).length, [students]);

  // Filter students by search and active/archived tab
  const filteredStudents = useMemo(() => {
    let list = students;
    if (rosterTab === "active") {
      list = list.filter(s => !s.isArchived);
    } else if (rosterTab === "archived") {
      list = list.filter(s => !!s.isArchived);
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(s => {
      const name = (s.name || s["اسم الطالب"] || "").toLowerCase();
      const phone = (s.phone || s["رقم الجوال"] || "").toLowerCase();
      const grade = (s.grade || s["الصف"] || "").toLowerCase();
      const cls = (s.className || s["الفصل"] || "").toLowerCase();
      const nid = (s.nationalId || s["السجل المدني"] || s["رقم الهوية"] || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || grade.includes(q) || cls.includes(q) || nid.includes(q);
    });
  }, [students, searchQuery, rosterTab]);

  // Phone stats
  const validPhonesCount = useMemo(() => {
    return students.filter(s => isValidPhone(s.phone || s["رقم الجوال"] || "")).length;
  }, [students]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="excel-uploader">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 text-right">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            رفع كشوف الطلاب والتعرف الذكي على الأعمدة
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            يقوم النظام الذكي بالتعرف تلقائياً على أعمدة (الاسم، رقم الجوال، الصف، الفصل) مع إمكانية التعديل والحذف المباشر
          </p>
        </div>

        {students.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="رفع ملف إكسل آخر"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>استبدال الملف</span>
            </button>
            <button
              onClick={clearRoster}
              className="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200/60"
              id="btn-clear-roster"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح الكشف</span>
            </button>
          </div>
        )}
      </div>

      {students.length === 0 ? (
        // UPLOADER DROPZONE
        <div className="flex flex-col gap-4">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
              dragActive
                ? "border-emerald-500 bg-emerald-50/40 shadow-inner"
                : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50"
            }`}
            id="excel-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
            />

            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm border border-emerald-100/50">
              <Upload className="w-7 h-7" />
            </div>

            <h3 className="font-bold text-slate-800 text-base">اسحب وأفلت ملف كشف الطلاب (Excel) هنا</h3>
            <p className="text-slate-500 text-xs mt-1.5 max-w-md leading-relaxed">
              يدعم ملفات <span className="font-bold text-slate-700 font-mono">.xlsx</span> و <span className="font-bold text-slate-700 font-mono">.xls</span> و <span className="font-bold text-slate-700 font-mono">.csv</span>.
              <br />
              <strong className="text-emerald-700">النظام الذكي يتعرف تلقائياً على:</strong> عمود الاسم، عمود رقم الجوال، عمود الصف، وعمود الفصل.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-right">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                هل ترغب في تجربة النظام مباشرة بدون ملف؟ يمكنك توليد كشف طلاب تجريبي فوري.
              </p>
            </div>
            <button
              onClick={generateDemoRoster}
              className="px-4 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              id="btn-demo-roster"
            >
              <Plus className="w-4 h-4" />
              توليد كشف تجريبي فوري
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl border border-rose-200 leading-relaxed text-right flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      ) : (
        // TABLE & SMART MAPPING VERIFICATION INTERFACE
        <div className="flex flex-col gap-5 text-right" id="excel-mapping-interface">
          
          {/* Smart Column Recognition & Verification Card */}
          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">مطابقة وتأكيد أعمدة ملف الإكسل الذكية:</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {students.length} طالب (منهم {validPhonesCount} رقم جوال صالح)
                </span>
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  id="btn-toggle-manual-form"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  إضافة طالب يدوياً
                </button>
              </div>
            </div>

            {/* 4 Essential Column Mapping Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              
              {/* Name Column */}
              <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1. عمود الاسم:</span>
                </label>
                <select
                  value={selectedNameCol}
                  onChange={(e) => handleRemapColumns(e.target.value, selectedPhoneCol, selectedGradeCol, selectedClassCol)}
                  className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-name-col"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Phone Column */}
              <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. عمود رقم الجوال:</span>
                </label>
                <select
                  value={selectedPhoneCol}
                  onChange={(e) => handleRemapColumns(selectedNameCol, e.target.value, selectedGradeCol, selectedClassCol)}
                  className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-phone-col"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Grade Column */}
              <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-sky-600" />
                  <span>3. عمود الصف الدراسي:</span>
                </label>
                <select
                  value={selectedGradeCol}
                  onChange={(e) => handleRemapColumns(selectedNameCol, selectedPhoneCol, e.target.value, selectedClassCol)}
                  className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-grade-col"
                >
                  <option value="">-- غير محدد أو اختياري --</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Class Column */}
              <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-purple-600" />
                  <span>4. عمود الفصل / الشعبة:</span>
                </label>
                <select
                  value={selectedClassCol}
                  onChange={(e) => handleRemapColumns(selectedNameCol, selectedPhoneCol, selectedGradeCol, e.target.value)}
                  className="border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-class-col"
                >
                  <option value="">-- غير محدد أو اختياري --</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Smart Confirmation Info Box */}
            <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-950 px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  تم التحقق من ملف الإكسل: <strong>الاسم:</strong> {selectedNameCol || "-"} | <strong>الجوال:</strong> {selectedPhoneCol || "-"} | <strong>الصف:</strong> {selectedGradeCol || "تلقائي"} | <strong>الفصل:</strong> {selectedClassCol || "تلقائي"}
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                جاهز للإرسال الفوري
              </span>
            </div>

          </div>

          {/* Manual Entry Form */}
          {showManualForm && (
            <form onSubmit={handleAddManualStudent} className="bg-slate-50 border border-emerald-200 rounded-2xl p-5 flex flex-col gap-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  إضافة طالب جديد يدوياً إلى الكشف الحالي
                </h4>
                <button type="button" onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">اسم الطالب *</label>
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="مثل: فيصل بن سعد القحطاني"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">رقم الجوال *</label>
                  <input
                    type="text"
                    required
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="مثل: 0501234567"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-left"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">الصف الدراسي</label>
                  <input
                    type="text"
                    value={newStudentGrade}
                    onChange={(e) => setNewStudentGrade(e.target.value)}
                    placeholder="مثل: أول ثانوي"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">الفصل / الشعبة</label>
                  <input
                    type="text"
                    value={newStudentClass}
                    onChange={(e) => setNewStudentClass(e.target.value)}
                    placeholder="مثل: أ"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  حفظ وإضافة الطالب
                </button>
              </div>
            </form>
          )}

          {/* Reconciliation Shield Alert Banner */}
          {reconcileNotification && (
            <div className="bg-emerald-50/90 border border-emerald-300 text-emerald-950 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right shadow-xs">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    <span>🛡️ نظام مطابقة الكشوف وتحصين البيانات الذكي:</span>
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed font-medium">
                    {reconcileNotification}
                  </p>
                  {reconcileStats && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-bold">
                      <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900 shadow-xs">
                        ✓ مطابقة {reconcileStats.matchedCount} طالب والاحتفاظ بهوياتهم وسجلاتهم
                      </span>
                      <span className="bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900 shadow-xs">
                        + إضافة {reconcileStats.newCount} طالب جديد
                      </span>
                      {reconcileStats.archivedPreservedCount > 0 && (
                        <span className="bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 text-amber-950 shadow-xs">
                          🛡️ حفظ {reconcileStats.archivedPreservedCount} طالب سابق في الأرشيف الآمن دون فقد سجلاتهم
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setReconcileNotification("")}
                className="text-emerald-700 hover:text-emerald-950 p-1.5 rounded-lg hover:bg-emerald-100 cursor-pointer self-end sm:self-center transition-colors"
                title="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Search, Filter Tabs & Table Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setRosterTab("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  rosterTab === "active"
                    ? "bg-white text-emerald-800 shadow-xs border border-emerald-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>الكشف الحالي النشط ({activeStudentsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setRosterTab("archived")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  rosterTab === "archived"
                    ? "bg-white text-amber-900 shadow-xs border border-amber-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Archive className="w-3.5 h-3.5 text-amber-600" />
                <span>السجلات المحفوظة تاريخياً ({archivedStudentsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setRosterTab("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rosterTab === "all"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>الكل ({students.length})</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، الجوال، الصف، الهوية..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                عرض <strong>{filteredStudents.length}</strong>
              </span>
            </div>

          </div>

          {/* Clean 4-Column + Actions Student Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white" id="students-grid-container">
            <div className="overflow-x-auto smooth-touch-scroll max-h-96">
              <table className="w-full min-w-[600px] text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-200 font-bold sticky top-0 backdrop-blur-sm z-10">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">اسم الطالب</th>
                    <th className="px-4 py-3">رقم الجوال</th>
                    <th className="px-4 py-3">الصف الدراسي</th>
                    <th className="px-4 py-3">الفصل / الشعبة</th>
                    <th className="px-4 py-3 w-32 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400 font-medium text-xs">
                        {rosterTab === "archived" 
                          ? "لا توجد سجلات مؤرشفة، كافة الطلاب متواجدون في الكشف النشط الحالي" 
                          : "لا توجد نتائج مطابقة للبحث"}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => {
                      const sName = student.name || student["اسم الطالب"] || student["الاسم"] || "-";
                      const sPhone = student.phone || student["رقم الجوال"] || student["الجوال"] || "";
                      const sGrade = student.grade || student["الصف"] || "-";
                      const sClass = student.className || student["الفصل"] || "-";
                      const phoneValid = isValidPhone(sPhone);
                      const isArchived = !!student.isArchived;

                      return (
                        <tr 
                          key={student.id || idx} 
                          className={`transition-colors ${isArchived ? "bg-amber-50/40 hover:bg-amber-50/80" : "hover:bg-slate-50/90"}`}
                        >
                          <td className="px-4 py-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{sName}</span>
                              {isArchived && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                                  محفوظ من كشف سابق
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <span dir="ltr" className="font-semibold">{sPhone || "بدون رقم"}</span>
                              {phoneValid ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" title="رقم جوال صالح" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="يرجى مراجعة رقم الجوال" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-sky-50 text-sky-800 border border-sky-200/60 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                              {sGrade}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                              {sClass}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* If archived: show Restore button */}
                              {isArchived ? (
                                <button
                                  onClick={() => restoreStudent(student.id)}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-100 bg-white rounded-lg transition-colors border border-emerald-300 cursor-pointer shadow-xs"
                                  title="استعادة الطالب إلى الكشف النشط"
                                  id={`btn-restore-${student.id}`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                /* If active: show Archive button (preserves history safely) */
                                <button
                                  onClick={() => archiveStudent(student.id)}
                                  className="p-1.5 text-amber-700 hover:bg-amber-100 bg-white rounded-lg transition-colors border border-amber-200 cursor-pointer shadow-xs"
                                  title="أرشفة الطالب (حفظه في الأرشيف دون فقد سجلاته)"
                                  id={`btn-archive-${student.id}`}
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Edit Action */}
                              <button
                                onClick={() => openEditStudent(student)}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 bg-white rounded-lg transition-colors border border-slate-200 hover:border-emerald-300 cursor-pointer"
                                title="تعديل بيانات الطالب"
                                id={`btn-edit-${student.id}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Permanent Delete Action */}
                              <button
                                onClick={() => permanentlyDeleteStudent(student.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 bg-white rounded-lg transition-colors border border-slate-200 hover:border-rose-300 cursor-pointer"
                                title="حذف نهائي للسجل"
                                id={`btn-delete-${student.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl text-right flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                تعديل بيانات الطالب
              </h3>
              <button 
                onClick={() => setEditingStudent(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">اسم الطالب الكامل:</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">رقم جوال ولي الأمر:</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-left font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">الصف الدراسي:</label>
                  <input
                    type="text"
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    placeholder="مثل: أول ثانوي"
                    className="border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">الفصل / الشعبة:</label>
                  <input
                    type="text"
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    placeholder="مثل: أ"
                    className="border border-slate-200 bg-slate-50 focus:bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  حفظ التعديلات
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
