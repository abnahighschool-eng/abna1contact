import React, { useState, useRef } from "react";
import { 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Terminal,
  FileCode,
  ArrowRight,
  Package,
  FileText,
  ClipboardPaste,
  Info,
  PhoneCall
} from "lucide-react";
import { NOOR_CONSOLE_CODE, NOOR_BOOKMARKLET_URL } from "../utils/noorBookmarklet";
import { NoorStudentAbsence, Student } from "../types";
import { generateNoorChromeExtensionZip, generateSingleFileUserScript } from "../utils/chromeExtensionBuilder";
import { parseNoorRawText, parseNoorExcelFile, enrichWithExistingStudents, getCurrentHijriDate } from "../utils/noorSmartParser";

interface NoorImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportAbsences: (absences: NoorStudentAbsence[]) => void;
  students?: Student[];
}

export default function NoorImporterModal({
  isOpen,
  onClose,
  onImportAbsences,
  students = [],
}: NoorImporterModalProps) {
  if (!isOpen) return null;

  const [activeMethod, setActiveMethod] = useState<"smart_paste" | "excel_file" | "console_code" | "extension">("smart_paste");
  const [pasteContent, setPasteContent] = useState("");
  const [copiedConsole, setCopiedConsole] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [isDownloadingExt, setIsDownloadingExt] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPreview, setParsedPreview] = useState<NoorStudentAbsence[]>([]);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Instant Smart Clipboard Reader
  const handleReadClipboard = async () => {
    try {
      setIsReadingClipboard(true);
      setParseError("");
      let text = "";
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text) {
        setParseError("الحافظة فارغة حالياً. تأكد من تحديد ونسخ جدول الغياب في نظام نور ثم أعد المحاولة.");
        return;
      }
      setPasteContent(text);
      processRawText(text);
    } catch (err: any) {
      setParseError("تعذر قراءة الحافظة تلقائياً من المتصفح. يرجى الضغط داخل المربع واستخدام (Ctrl + V) للصق النص.");
    } finally {
      setIsReadingClipboard(false);
    }
  };

  const processRawText = (raw: string) => {
    setParseError("");
    setParsedPreview([]);
    if (!raw.trim()) return;

    const result = parseNoorRawText(raw);
    if (result.success && result.absences.length > 0) {
      // Enrich with school database phones
      const enriched = enrichWithExistingStudents(result.absences, students);
      setParsedPreview(enriched);
    } else {
      setParseError(result.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setParseError("");
      const res = await parseNoorExcelFile(file);
      if (res.success && res.absences.length > 0) {
        const enriched = enrichWithExistingStudents(res.absences, students);
        setParsedPreview(enriched);
        setActiveMethod("smart_paste");
      } else {
        setParseError(res.message);
      }
    } catch (err: any) {
      setParseError("حدث خطأ أثناء معالجة ملف الإكسل: " + err.message);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCopyConsoleCode = () => {
    navigator.clipboard.writeText(NOOR_CONSOLE_CODE);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 2500);
  };

  const handleCopySingleScript = () => {
    navigator.clipboard.writeText(generateSingleFileUserScript());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleDownloadSingleFileUserScript = () => {
    const script = generateSingleFileUserScript();
    const blob = new Blob([script], { type: "application/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "noor-abna-extractor.user.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExtension = async () => {
    try {
      setIsDownloadingExt(true);
      const zipBlob = await generateNoorChromeExtensionZip();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "noor-abna-extension.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloadingExt(false);
    }
  };

  const handleLoadSampleDay1 = () => {
    const todayHijri = getCurrentHijriDate();
    const sample: NoorStudentAbsence[] = [
      {
        id: "1102938471",
        studentName: "عبدالله محمد إبراهيم الشهري",
        nationalId: "1102938471",
        grade: "أول ثانوي",
        className: "101",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 1,
        unexcusedDates: [todayHijri],
        phone: "0501122334",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1102938472",
        studentName: "سلمان فهد سعد الدوسري",
        nationalId: "1102938472",
        grade: "أول ثانوي",
        className: "102",
        excusedDaysCount: 1,
        excusedDates: [todayHijri],
        unexcusedDaysCount: 0,
        unexcusedDates: [],
        phone: "0559988776",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1102938473",
        studentName: "تركي ماجد حمد القحطاني",
        nationalId: "1102938473",
        grade: "ثاني ثانوي",
        className: "201",
        excusedDaysCount: 0,
        excusedDates: [],
        unexcusedDaysCount: 3, // Hit 3 days warning
        unexcusedDates: ["1447/08/01", "1447/08/05", todayHijri],
        phone: "0543322110",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1102938474",
        studentName: "مشعل خالد فيصل العتيبي",
        nationalId: "1102938474",
        grade: "ثاني ثانوي",
        className: "202",
        excusedDaysCount: 1,
        excusedDates: ["1447/08/03"],
        unexcusedDaysCount: 5, // Hit 5 days warning + call parent
        unexcusedDates: ["1447/08/02", "1447/08/04", "1447/08/08", "1447/08/10", todayHijri],
        phone: "0536677889",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      },
      {
        id: "1102938475",
        studentName: "يزيد نايف عبدالرحمن الزهراني",
        nationalId: "1102938475",
        grade: "ثالث ثانوي",
        className: "301",
        excusedDaysCount: 2,
        excusedDates: ["1447/07/28", "1447/08/02"],
        unexcusedDaysCount: 10, // Hit 10 days referral to counselor
        unexcusedDates: ["1447/07/20", "1447/07/22", "1447/07/25", "1447/07/29", "1447/08/01", "1447/08/03", "1447/08/06", "1447/08/08", "1447/08/11", todayHijri],
        phone: "0578899001",
        lastUpdated: new Date().toISOString(),
        source: "noor_tool"
      }
    ];

    const enriched = enrichWithExistingStudents(sample, students);
    setParsedPreview(enriched);
    setActiveMethod("smart_paste");
  };

  const handleApplyImport = () => {
    if (parsedPreview.length === 0) return;
    onImportAbsences(parsedPreview);
    onClose();
  };

  const matchedPhoneCount = parsedPreview.filter((p) => Boolean(p.phone)).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full my-auto shadow-2xl border border-slate-200 text-right space-y-4 max-h-[94vh] flex flex-col animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-900 text-white rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">المعالج الذكي لسحب كشوف غياب نظام نور</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  فائق السرعة والدقة 100%
                </span>
              </div>
              <p className="text-xs text-slate-300">
                اختر الطريقة الأنسب لك لسحب كشوف الغياب اليومي (يوم 1) والتراكمي فوراً
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selector Tabs */}
        <div className="px-6 pt-2 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
            
            <button
              onClick={() => setActiveMethod("smart_paste")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMethod === "smart_paste"
                  ? "bg-white text-emerald-950 shadow-xs border border-emerald-300 font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-600" />
              <span>1. لصق ذكي فوري ⚡ (الأسهل)</span>
            </button>

            <button
              onClick={() => setActiveMethod("excel_file")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMethod === "excel_file"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              <span>2. ملف إكسل من نور 📊</span>
            </button>

            <button
              onClick={() => setActiveMethod("console_code")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMethod === "console_code"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span>3. كود الكونسول السحري 💻</span>
            </button>

            <button
              onClick={() => setActiveMethod("extension")}
              className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMethod === "extension"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="w-4 h-4 text-blue-600" />
              <span>4. إضافة Chrome 📦</span>
            </button>

          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 space-y-4">
          
          {/* Method 1: Instant Smart Paste */}
          {activeMethod === "smart_paste" && (
            <div className="space-y-4">
              
              {/* Quick Instruction Banner */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-950">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>طريقة السحب الفوري المباشر من تقارير نظام نور:</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    1. في نظام نور: افتح <strong>التقارير</strong> ⬅️ <strong>تقارير الطلاب</strong> ⬅️ <strong>تقرير الغياب على مستوى الطالب</strong> (أو كشف تثبيت الغياب اليومي).<br />
                    2. انسخ الصفحة (<kbd className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-emerald-900">Ctrl + A</kbd> ثم <kbd className="bg-emerald-100 px-1 py-0.5 rounded font-mono text-emerald-900">Ctrl + C</kbd>) واضغط الزر الأخضر بالأسفل.<br />
                    3. يتعرف النظام الذكي تلقائياً على اسم الطالب، الصف، الفصل، المسار، عدد أيام الغياب، وتواريخ الغياب ونسبة الغياب!
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleReadClipboard}
                    disabled={isReadingClipboard}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-emerald-500/20 transition-all shrink-0"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>{isReadingClipboard ? "جارِ القراءة..." : "⚡ لصق فوري من الحافظة"}</span>
                  </button>

                  <button
                    onClick={handleLoadSampleDay1}
                    className="px-3 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
                    title="تحميل نموذج من تقرير الغياب على مستوى الطالب"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                    <span>نموذج تقرير نور 📑</span>
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    أو الصق النص المنسوخ من تقرير نظام نور هنا يدوياً (Ctrl + V):
                  </label>
                  {pasteContent && (
                    <button
                      onClick={() => {
                        setPasteContent("");
                        setParsedPreview([]);
                        setParseError("");
                      }}
                      className="text-[11px] text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                      مسح النص
                    </button>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={pasteContent}
                  onChange={(e) => {
                    setPasteContent(e.target.value);
                    processRawText(e.target.value);
                  }}
                  placeholder="الصق هنا نص تقرير الغياب على مستوى الطالب أو جدول تثبيت الغياب من نور (يتعرف تلقائياً على اسم الطالب، الصف، الفصل، عدد الغياب، تواريخ الغياب، ونسبة الغياب)..."
                  className="w-full border border-slate-300 rounded-2xl p-3.5 text-xs font-mono text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all leading-relaxed"
                />
              </div>

              {/* Error Message */}
              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Extracted Preview */}
              {parsedPreview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تم التعرف الذكي على ({parsedPreview.length}) طالب من كشوفات وتقارير نور</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <PhoneCall className="w-3 h-3 text-emerald-600" />
                        <span>({matchedPhoneCount}) جوال مرتبط تلقائياً</span>
                      </span>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2 w-8 text-center">م</th>
                          <th className="p-2">اسم الطالب</th>
                          <th className="p-2">الصف / الفصل</th>
                          <th className="p-2 text-center">بدون عذر</th>
                          <th className="p-2 text-center">بعذر</th>
                          <th className="p-2 text-center">نسبة الغياب</th>
                          <th className="p-2">تواريخ الغياب</th>
                          <th className="p-2">الجوال</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.map((st, i) => (
                          <tr key={i} className="hover:bg-emerald-50/40">
                            <td className="p-2 text-center font-bold text-slate-400">{i + 1}</td>
                            <td className="p-2">
                              <span className="font-bold text-slate-900 block">{st.studentName}</span>
                              {st.nationalId && <span className="text-[10px] text-slate-400 font-mono">سجل: {st.nationalId}</span>}
                            </td>
                            <td className="p-2 text-slate-600">
                              <span className="font-semibold text-slate-800 block">{st.grade} {st.className ? `- ${st.className}` : ""}</span>
                              {st.track && <span className="text-[10px] text-slate-500">{st.track}</span>}
                            </td>
                            <td className="p-2 text-center font-bold text-red-700">
                              {st.unexcusedDaysCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono">
                                  {st.unexcusedDaysCount}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-2 text-center font-bold text-blue-700">
                              {st.excusedDaysCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                                  {st.excusedDaysCount}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-2 text-center font-mono font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                                {st.absenceRate || (st.unexcusedDaysCount + st.excusedDaysCount) || 1}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] font-mono text-slate-600 max-w-[140px] truncate" title={(st.unexcusedDates.concat(st.excusedDates)).join(", ")}>
                              {(st.unexcusedDates.concat(st.excusedDates)).join("، ") || "-"}
                            </td>
                            <td className="p-2 font-mono text-[11px]">
                              {st.phone ? (
                                <span className="text-emerald-700 font-bold">{st.phone}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Method 2: Excel File Import */}
          {activeMethod === "excel_file" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50 hover:bg-emerald-50/20 transition-all flex flex-col items-center justify-center space-y-3 cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="noor-excel-input"
                />
                <label htmlFor="noor-excel-input" className="cursor-pointer flex flex-col items-center space-y-3 w-full">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div>
                    <strong className="text-sm text-slate-900 block font-black">
                      {isProcessingFile ? "جارِ معالجة الملف واستخراج البيانات..." : "اضغط هنا لاختيار ملف إكسل المصدر من نظام نور (.xlsx / .xls / .csv)"}
                    </strong>
                    <span className="text-xs text-slate-500 mt-1 block">
                      يقوم النظام بقراءة أسماء الطلاب، السجلات المدنية، وحالات الغياب والتواريخ تلقائياً
                    </span>
                  </div>
                  <span className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md">
                    اختيار ملف من جهازك 📁
                  </span>
                </label>
              </div>

              {parseError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* Method 3: Console 1-Click Code (Runs inside Noor Console) */}
          {activeMethod === "console_code" && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 space-y-4 shadow-xl border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                    <Terminal className="w-5 h-5" />
                    <span>كود الكونسول السحري (يعمل فوراً بدون تثبيت أي ملفات أو إضافات):</span>
                  </div>

                  <button
                    onClick={handleCopyConsoleCode}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                  >
                    {copiedConsole ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedConsole ? "✓ تم نسخ الكود بنجاح!" : "نسخ الكود بالكامل بنقرة واحدة 📋"}</span>
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-300 leading-relaxed font-medium">
                  <span className="text-emerald-400 font-bold block">خطوات التشغيل البسيطة في صفحة نور (30 ثانية):</span>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                    <li>افتح صفحة <strong>تثبيت الغياب اليومي</strong> أو <strong>كشف الغياب</strong> في نظام نور.</li>
                    <li>اضغط من لوحة المفاتيح على زر <kbd className="bg-slate-800 text-yellow-300 px-2 py-0.5 rounded font-mono font-bold">F12</kbd> (أو كليك يمين ثم فحص / Inspect).</li>
                    <li>اختر تبويب <strong>Console</strong> في الأعلى، ثم اضغط <kbd className="bg-slate-800 text-white px-2 py-0.5 rounded font-mono font-bold">Ctrl + V</kbd> للصق واضغط <kbd className="bg-slate-800 text-white px-2 py-0.5 rounded font-mono font-bold">Enter</kbd>.</li>
                    <li>سيظهر فوراً زر أخضر عائم يسحب بيانات جميع الغائبين وينسخها لجهازك فوراً!</li>
                  </ol>
                </div>

                <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-24 select-all border border-slate-800" dir="ltr">
                  {NOOR_CONSOLE_CODE.slice(0, 220)}...
                </div>
              </div>
            </div>
          )}

          {/* Method 4: Chrome Extension */}
          {activeMethod === "extension" && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 text-white shadow-xl">
                
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <span>إضافة Google Chrome لرصد وتحديث الغياب المتكرر</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                          إصدار 3.5.0
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        تحديث الغياب اليومي تلقائياً وحساب التراكمي وتنبيهك فوراً عند وصول الطالب لحد الغياب المتكرر
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadExtension}
                    disabled={isDownloadingExt}
                    className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2.5 cursor-pointer shadow-lg hover:shadow-emerald-500/30 transition-all shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloadingExt ? "جارِ إنشاء الحزمة..." : "تحميل الإضافة (noor-abna-extension.zip) 📥"}</span>
                  </button>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Zap className="w-4 h-4" />
                      <span>تحديث الغياب يومياً ⚡</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      عند تثبيت الغياب بنظام نور، تضغط زراً واحداً ليتم تسجيل غياب اليوم وإضافته للسجل التراكمي للطالب.
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-yellow-400 font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>كشف الغياب المتكرر 🚨</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      تمييز فوري للطلاب الذين وصلوا لحدود: 3 أيام (إنذار 1)، 5 أيام (إنذار 2 واستدعاء)، 10 أيام (إحالة للموجه).
                    </p>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>إشعارات الواتساب 💬</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      إرسال رسائل الإنذار وتنبيهات الغياب لأولياء الأمور مباشرة عبر الواتساب، والنسخ الفوري لمنصة أبناء.
                    </p>
                  </div>
                </div>

                {/* Installation Steps */}
                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <span className="font-bold text-emerald-400 text-xs block">
                    📌 خطوات التثبيت في متصفح Google Chrome (دقيقة واحدة):
                  </span>
                  <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-300 leading-relaxed">
                    <li>اضغط على زر <strong>تحميل الإضافة (noor-abna-extension.zip)</strong> بالأعلى.</li>
                    <li>افتح مجلد التنزيلات واضغط كليك يمين على الملف واختر <strong>استخراج الكل (Extract All)</strong>.</li>
                    <li>في شريط عنوان كروم اكتب: <code className="bg-slate-800 text-emerald-300 px-2 py-0.5 rounded font-mono" dir="ltr">chrome://extensions</code></li>
                    <li>فعّل زر <strong>وضع مطور البرامج (Developer mode)</strong> في أعلى الزاوية اليسرى/اليمنى.</li>
                    <li>اضغط على <strong>تحميل حزمة غير مضغوطة (Load unpacked)</strong> واختر المجلد المستخرج. ستظهر لك الإضافة فوراً!</li>
                  </ol>
                </div>

                {/* Alternative Quick Script */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">أو تود تشغيلها كسكربت مستخدم (Tampermonkey):</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySingleScript}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? "✓ تم نسخ السكربت" : "نسخ كود السكربت"}</span>
                    </button>
                    <button
                      onClick={handleDownloadSingleFileUserScript}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>تحميل ملف .user.js</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50 rounded-b-3xl shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-all"
          >
            إلغاء
          </button>

          {parsedPreview.length > 0 ? (
            <button
              onClick={handleApplyImport}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all animate-bounce"
            >
              <Check className="w-4 h-4" />
              <span>استيراد وتحديث ({parsedPreview.length}) طالب غائب الآن ⚡</span>
            </button>
          ) : (
            <button
              onClick={handleReadClipboard}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <ClipboardPaste className="w-4 h-4 text-emerald-400" />
              <span>لصق البيانات من الحافظة</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
