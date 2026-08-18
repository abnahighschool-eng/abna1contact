import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, HelpCircle, Check, Play, Edit, Trash2, Plus, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";
import { Student } from "../types";

interface ExcelUploaderProps {
  onStudentsLoaded: (students: Student[]) => void;
  students: Student[];
}

export default function ExcelUploader({ onStudentsLoaded, students }: ExcelUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedPhoneCol, setSelectedPhoneCol] = useState("");
  const [selectedNameCol, setSelectedNameCol] = useState("");
  const [selectedGradeCol, setSelectedGradeCol] = useState("");
  const [selectedClassCol, setSelectedClassCol] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual student form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");

  // Generate high fidelity demo roster
  const generateDemoRoster = () => {
    const demoStudents: Student[] = [
      { id: "1", "اسم الطالب": "أحمد بن عبد العزيز الشمري", "رقم الجوال": "+966501234567", "الصف": "أول ثانوي", "الفصل": "أ", "حالة الغياب": "حاضر", "الدرجة": "98%", "ملاحظات": "طالب متميز ومشارك", grade: "أول ثانوي", className: "أ" },
      { id: "2", "اسم الطالب": "سعد بن محمد القحطاني", "رقم الجوال": "+966505551234", "الصف": "أول ثانوي", "الفصل": "أ", "حالة الغياب": "غائب", "الدرجة": "85%", "ملاحظات": "الرجاء مراجعة الإدارة", grade: "أول ثانوي", className: "أ" },
      { id: "3", "اسم الطالب": "خالد بن الوليد المطيري", "رقم الجوال": "+966509876543", "الصف": "أول ثانوي", "الفصل": "ب", "حالة الغياب": "حاضر", "الدرجة": "92%", "ملاحظات": "نشيط في الإذاعة", grade: "أول ثانوي", className: "ب" },
      { id: "4", "اسم الطالب": "فيصل بن خالد الدوسري", "رقم الجوال": "+966556677889", "الصف": "ثاني ثانوي", "الفصل": "أ", "حالة الغياب": "حاضر", "الدرجة": "76%", "ملاحظات": "يحتاج لمزيد من التركيز", grade: "ثاني ثانوي", className: "أ" },
      { id: "5", "اسم الطالب": "عبد الرحمن بن سليمان الفهد", "رقم الجوال": "0539871234", "الصف": "ثاني ثانوي", "الفصل": "ج", "حالة الغياب": "متأخر", "الدرجة": "88%", "ملاحظات": "تأخر 15 دقيقة صباحاً", grade: "ثاني ثانوي", className: "ج" },
      { id: "6", "اسم الطالب": "نوف بنت عبد الله السبيعي", "رقم الجوال": "0541122334", "الصف": "ثالث ثانوي", "الفصل": "علمي", "حالة الغياب": "حاضر", "الدرجة": "99%", "ملاحظات": "مرشحة للمسابقة", grade: "ثالث ثانوي", className: "علمي" },
      { id: "7", "اسم الطالب": "سارة بنت فهد الحارثي", "رقم الجوال": "0564455667", "الصف": "ثالث ثانوي", "الفصل": "علمي", "حالة الغياب": "غائب بعذر", "الدرجة": "95%", "ملاحظات": "مريض ولديه تقرير طبي", grade: "ثالث ثانوي", className: "علمي" }
    ];
    setColumns(["اسم الطالب", "رقم الجوال", "الصف", "الفصل", "حالة الغياب", "الدرجة", "ملاحظات"]);
    setSelectedNameCol("اسم الطالب");
    setSelectedPhoneCol("رقم الجوال");
    setSelectedGradeCol("الصف");
    setSelectedClassCol("الفصل");
    onStudentsLoaded(demoStudents);
    setErrorMsg("");
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
        
        // Parse rows as raw 2D array of arrays (header: 1)
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawRows.length === 0) {
          throw new Error("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة");
        }

        // Find the maximum number of columns across all rows to define our A, B, C... labels
        let maxCols = 0;
        rawRows.forEach(row => {
          if (row && row.length > maxCols) {
            maxCols = row.length;
          }
        });

        // Ensure we support at least up to column H (8 columns) even if some rows are shorter
        maxCols = Math.max(maxCols, 8);

        // Helper to get Excel column letter (0 -> A, 1 -> B, etc.)
        const getColumnLetter = (colIndex: number): string => {
          let letter = "";
          let temp = colIndex;
          while (temp >= 0) {
            letter = String.fromCharCode((temp % 26) + 65) + letter;
            temp = Math.floor(temp / 26) - 1;
          }
          return letter;
        };

        const sortedKeys: string[] = [];
        for (let i = 0; i < maxCols; i++) {
          sortedKeys.push(getColumnLetter(i));
        }

        // Map the 2D array rows to objects where keys are the column letters (A, B, C...)
        const rawJsonData = rawRows.map(row => {
          const obj: any = {};
          sortedKeys.forEach((key, colIdx) => {
            const val = row[colIdx];
            obj[key] = val !== undefined && val !== null ? String(val).trim() : "";
          });
          return obj;
        });

        // Filter out empty rows or rows that don't look like data (e.g. fewer than 2 columns filled)
        const jsonData = rawJsonData.filter(row => {
          const nonSec = Object.keys(row).filter(k => row[k] !== "");
          return nonSec.length >= 2;
        });

        if (jsonData.length === 0) {
          throw new Error("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة");
        }

        // Map sorted keys to user-friendly column names
        const keyToHeaderMap: { [key: string]: string } = {};
        const headerToKeyMap: { [header: string]: string } = {};
        const headers: string[] = [];

        sortedKeys.forEach(k => {
          const header = `العمود ${k}`;
          keyToHeaderMap[k] = header;
          headerToKeyMap[header] = k;
          headers.push(header);
        });

        setColumns(headers);

        // Auto-detect which column represents names and which represents phones
        const colScores: { [key: string]: { phoneScore: number, nameScore: number } } = {};
        sortedKeys.forEach(k => {
          colScores[k] = { phoneScore: 0, nameScore: 0 };
        });

        jsonData.slice(0, 15).forEach(row => {
          sortedKeys.forEach(k => {
            const val = row[k];
            if (val === null || val === undefined) return;
            const valStr = String(val).trim();
            if (!valStr) return;

            // Check if it's a phone number (e.g., 9665..., 05..., contains numbers)
            const cleanedNum = valStr.replace(/[\s\-\+\(\)]/g, "");
            if (/^\d{9,14}$/.test(cleanedNum)) {
              if (cleanedNum.startsWith("9665") || cleanedNum.startsWith("05") || cleanedNum.startsWith("5")) {
                colScores[k].phoneScore += 5;
              } else {
                colScores[k].phoneScore += 2;
              }
            } else if (/^\+?\d+$/.test(cleanedNum)) {
              colScores[k].phoneScore += 1;
            }

            // Check if it's an Arabic student name (Arabic characters, has spaces, multiple words, no digits)
            const hasArabic = /[\u0600-\u06FF]/.test(valStr);
            const words = valStr.split(/\s+/).filter(w => w.length > 1);
            const hasDigits = /\d/.test(valStr);
            if (hasArabic && words.length >= 3 && !hasDigits) {
              colScores[k].nameScore += 5;
            } else if (hasArabic && words.length >= 2 && !hasDigits) {
              colScores[k].nameScore += 3;
            } else if (hasArabic && !hasDigits) {
              colScores[k].nameScore += 1;
            }
          });
        });

        // Determine best keys (with high-priority defaults: Column A for phone and Column D for name)
        let bestPhoneKey = sortedKeys.includes("A") ? "A" : sortedKeys[0];
        let maxPhoneScore = -1;
        let bestNameKey = sortedKeys.includes("D") ? "D" : (sortedKeys[Math.min(1, sortedKeys.length - 1)]);
        let maxNameScore = -1;

        // If A and D are not both found, use our smart scoring as a fallback
        if (!sortedKeys.includes("A") || !sortedKeys.includes("D")) {
          sortedKeys.forEach(k => {
            if (!sortedKeys.includes("A") && colScores[k].phoneScore > maxPhoneScore) {
              maxPhoneScore = colScores[k].phoneScore;
              bestPhoneKey = k;
            }
            if (!sortedKeys.includes("D") && colScores[k].nameScore > maxNameScore) {
              maxNameScore = colScores[k].nameScore;
              bestNameKey = k;
            }
          });
        }

        // Ensure we don't map same column to both unless we only have one column
        if (bestNameKey === bestPhoneKey && sortedKeys.length > 1) {
          let secondBestNameKey = sortedKeys.find(k => k !== bestPhoneKey) || sortedKeys[0];
          let secondMaxNameScore = -1;
          sortedKeys.forEach(k => {
            if (k !== bestPhoneKey && colScores[k].nameScore > secondMaxNameScore) {
              secondMaxNameScore = colScores[k].nameScore;
              secondBestNameKey = k;
            }
          });
          bestNameKey = secondBestNameKey;
        }

        // Smart detect optional Grade & Class/Section keys
        let bestGradeKey = "";
        let bestClassKey = "";

        sortedKeys.forEach(k => {
          if (k !== bestNameKey && k !== bestPhoneKey) {
            const sampleVals = jsonData.slice(0, 15).map(r => String(r[k] || "").toLowerCase());
            const hasGradeKeyword = sampleVals.some(v => v.includes("صف") || v.includes("grade") || v.includes("سنة") || v.includes("مستوى"));
            const hasClassKeyword = sampleVals.some(v => v.includes("فصل") || v.includes("شعبة") || v.includes("class") || v.includes("section") || v.includes("مجموعة"));
            
            if (hasGradeKeyword && !bestGradeKey) {
              bestGradeKey = k;
            } else if (hasClassKeyword && !bestClassKey) {
              bestClassKey = k;
            }
          }
        });

        // Fallbacks for Grade/Class if columns C or D exist and aren't used
        if (!bestGradeKey && sortedKeys.includes("C") && "C" !== bestPhoneKey && "C" !== bestNameKey) {
          bestGradeKey = "C";
        }
        if (!bestClassKey && sortedKeys.includes("D") && "D" !== bestPhoneKey && "D" !== bestNameKey) {
          bestClassKey = "D";
        }

        const autoPhoneHeader = keyToHeaderMap[bestPhoneKey];
        const autoNameHeader = keyToHeaderMap[bestNameKey];
        const autoGradeHeader = bestGradeKey ? keyToHeaderMap[bestGradeKey] : "";
        const autoClassHeader = bestClassKey ? keyToHeaderMap[bestClassKey] : "";

        setSelectedPhoneCol(autoPhoneHeader);
        setSelectedNameCol(autoNameHeader);
        setSelectedGradeCol(autoGradeHeader);
        setSelectedClassCol(autoClassHeader);

        // Map rows to structured Student objects
        const formattedStudents: Student[] = jsonData.map((row: any, idx: number) => {
          const studentObj: any = {
            id: String(idx + 1),
            name: row[bestNameKey] ? String(row[bestNameKey]).trim() : `طالب ${idx + 1}`,
            phone: row[bestPhoneKey] ? String(row[bestPhoneKey]).trim() : "",
            grade: bestGradeKey && row[bestGradeKey] ? String(row[bestGradeKey]).trim() : "",
            className: bestClassKey && row[bestClassKey] ? String(row[bestClassKey]).trim() : "",
          };

          // Store other values under friendly header names so they show in the preview table
          sortedKeys.forEach(k => {
            const headerName = keyToHeaderMap[k];
            studentObj[headerName] = row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : "";
          });

          return studentObj;
        });

        onStudentsLoaded(formattedStudents);
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

  const handleManualMapping = (phoneCol: string, nameCol: string, gradeCol: string = "", classCol: string = "") => {
    setSelectedPhoneCol(phoneCol);
    setSelectedNameCol(nameCol);
    setSelectedGradeCol(gradeCol);
    setSelectedClassCol(classCol);

    const remapped = students.map((std) => ({
      ...std,
      name: String(std[nameCol] || ""),
      phone: String(std[phoneCol] || ""),
      grade: gradeCol ? String(std[gradeCol] || "") : (std.grade || ""),
      className: classCol ? String(std[classCol] || "") : (std.className || ""),
    }));
    onStudentsLoaded(remapped);
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
    };

    // If there were no columns yet, initialize columns
    if (columns.length === 0) {
      setColumns(["الاسم", "رقم الجوال", "الصف", "الفصل"]);
      setSelectedNameCol("الاسم");
      setSelectedPhoneCol("رقم الجوال");
      setSelectedGradeCol("الصف");
      setSelectedClassCol("الفصل");
    }

    // Set custom keys on the student object for the table columns
    newStudent[selectedNameCol || "الاسم"] = newStudentName.trim();
    newStudent[selectedPhoneCol || "رقم الجوال"] = cleanPhone;
    if (selectedGradeCol) newStudent[selectedGradeCol] = newStudentGrade.trim();
    if (selectedClassCol) newStudent[selectedClassCol] = newStudentClass.trim();

    onStudentsLoaded([...students, newStudent]);
    setNewStudentName("");
    setNewStudentPhone("");
    setNewStudentGrade("");
    setNewStudentClass("");
    setShowManualForm(false);
    setErrorMsg("");
  };

  const deleteStudent = (id: string) => {
    const filtered = students.filter(s => s.id !== id);
    onStudentsLoaded(filtered);
  };

  const clearRoster = () => {
    onStudentsLoaded([]);
    setColumns([]);
    setSelectedNameCol("");
    setSelectedPhoneCol("");
    setSelectedGradeCol("");
    setSelectedClassCol("");
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="excel-uploader">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            رفع كشوف وأرقام الطلاب
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            ارفع كشف الطلاب بصيغة Excel أو CSV لتوليد الرسائل بلمح البصر
          </p>
        </div>

        {students.length > 0 && (
          <button
            onClick={clearRoster}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition-all"
            id="btn-clear-roster"
          >
            مسح الكشف الحالي
          </button>
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
                ? "border-emerald-500 bg-emerald-50/40"
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

            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-sm border border-emerald-100/30">
              <Upload className="w-6 h-6" />
            </div>

            <h3 className="font-bold text-slate-800 text-base">اسحب وأفلت ملف Excel هنا</h3>
            <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed">
              يدعم الامتدادات <span className="font-semibold text-slate-600 font-mono">.xlsx</span>, <span className="font-semibold text-slate-600 font-mono">.xls</span>, <span className="font-semibold text-slate-600 font-mono">.csv</span>. تأكد من احتواء الملف على عمود للأسماء وعمود للأرقام.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-right">
              <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                ليس لديك كشف جاهز؟ جرب كشف الطلاب الافتراضي لاختبار النظام بضغطة زر.
              </p>
            </div>
            <button
              onClick={generateDemoRoster}
              className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              id="btn-demo-roster"
            >
              <Plus className="w-3.5 h-3.5" />
              توليد كشف تجريبي فوري
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl border border-rose-100 leading-relaxed text-right">
              {errorMsg}
            </div>
          )}
        </div>
      ) : (
        // TABLE & MAPPING INTERFACE
        <div className="flex flex-col gap-6" id="excel-mapping-interface">
          {/* Mapping settings card */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex flex-col gap-5 text-right">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <h3 className="text-sm font-bold text-slate-800">إعدادات مطابقة أعمدة الكشف:</h3>
              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                id="btn-toggle-manual-form"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة طالب يدوياً
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">عمود اسم الطالب:</label>
                <select
                  value={selectedNameCol}
                  onChange={(e) => handleManualMapping(selectedPhoneCol, e.target.value, selectedGradeCol, selectedClassCol)}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-name-col"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">عمود رقم الجوال / الهاتف:</label>
                <select
                  value={selectedPhoneCol}
                  onChange={(e) => handleManualMapping(e.target.value, selectedNameCol, selectedGradeCol, selectedClassCol)}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-phone-col"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">عمود الصف الدراسي (اختياري):</label>
                <select
                  value={selectedGradeCol}
                  onChange={(e) => handleManualMapping(selectedPhoneCol, selectedNameCol, e.target.value, selectedClassCol)}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-grade-col"
                >
                  <option value="">-- تخطي أو غير محدد --</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">عمود الفصل / الشعبة (اختياري):</label>
                <select
                  value={selectedClassCol}
                  onChange={(e) => handleManualMapping(selectedPhoneCol, selectedNameCol, selectedGradeCol, e.target.value)}
                  className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                  id="select-class-col"
                >
                  <option value="">-- تخطي أو غير محدد --</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-emerald-50/60 border border-emerald-100/50 p-3 rounded-xl justify-center">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] text-emerald-800 font-medium">
                تم استيراد وتحليل وتصنيف كشوف <strong className="font-bold">{students.length}</strong> طالب بنجاح.
              </span>
            </div>
          </div>

          {/* Manual Entry Form */}
          {showManualForm && (
            <form onSubmit={handleAddManualStudent} className="bg-slate-50 border border-emerald-100 rounded-2xl p-5 flex flex-col gap-4 text-right animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                <h4 className="text-xs font-bold text-emerald-800">إضافة طالب جديد يدوياً إلى الكشف الحالي</h4>
                <button type="button" onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">الاسم الكامل للطالب *</label>
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="مثل: فيصل بن سعد القحطاني"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">رقم جوال ولي الأمر *</label>
                  <input
                    type="text"
                    required
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="مثل: 966500000000"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">الصف الدراسي (اختياري)</label>
                  <input
                    type="text"
                    value={newStudentGrade}
                    onChange={(e) => setNewStudentGrade(e.target.value)}
                    placeholder="مثل: أول ثانوي"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">الفصل / الشعبة (اختياري)</label>
                  <input
                    type="text"
                    value={newStudentClass}
                    onChange={(e) => setNewStudentClass(e.target.value)}
                    placeholder="مثل: أ"
                    className="border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all"
                >
                  حفظ وإضافة الطالب
                </button>
              </div>
            </form>
          )}

          {errorMsg && (
            <div className="bg-rose-50 text-rose-800 text-xs p-3.5 rounded-xl border border-rose-100 leading-relaxed text-right">
              {errorMsg}
            </div>
          )}

          {/* Student Grid Table */}
          <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-sm" id="students-grid-container">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/85 text-slate-700 border-b border-slate-200/80 font-semibold sticky top-0 backdrop-blur-sm z-10">
                    <th className="px-4 py-3 w-16">#</th>
                    <th className="px-4 py-3">الاسم (المطابق)</th>
                    <th className="px-4 py-3">رقم الجوال (المطابق)</th>
                    <th className="px-4 py-3">الصف</th>
                    <th className="px-4 py-3">الفصل</th>
                    {columns.filter(c => c !== selectedPhoneCol && c !== selectedNameCol && c !== selectedGradeCol && c !== selectedClassCol).slice(0, 2).map((col) => (
                      <th key={col} className="px-4 py-3">{col}</th>
                    ))}
                    <th className="px-4 py-3 w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {students.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{student.name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{student.phone}</td>
                      <td className="px-4 py-2.5">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {student.grade || student[selectedGradeCol] || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          {student.className || student[selectedClassCol] || "-"}
                        </span>
                      </td>
                      {columns.filter(c => c !== selectedPhoneCol && c !== selectedNameCol && c !== selectedGradeCol && c !== selectedClassCol).slice(0, 2).map((col) => (
                        <td key={col} className="px-4 py-2.5 max-w-[150px] truncate" title={String(student[col] || "")}>
                          {student[col] !== undefined ? String(student[col]) : "-"}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => deleteStudent(student.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="حذف الطالب"
                          id={`btn-delete-${student.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
