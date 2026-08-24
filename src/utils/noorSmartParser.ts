import * as XLSX from "xlsx";
import { NoorStudentAbsence, Student } from "../types";

/**
 * Clean and normalize text strings from Noor
 */
export function cleanText(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract Hijri or Gregorian dates from any text string
 */
export function extractDatesFromText(txt: string): string[] {
  if (!txt) return [];
  // Match YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY (Hijri 144x or Gregorian 202x)
  const regex = /(\b(?:14\d{2}|20\d{2})[\/\-]\d{1,2}[\/\-]\d{1,2}\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-](?:14\d{2}|20\d{2})\b)/g;
  const matches = txt.match(regex);
  if (!matches) return [];
  return Array.from(new Set(matches.map((d) => d.replace(/-/g, "/"))));
}

/**
 * Get current date in Hijri format as fallback
 */
export function getCurrentHijriDate(): string {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Match and enrich student phone numbers and class from existing student database
 */
export function enrichWithExistingStudents(
  absences: NoorStudentAbsence[],
  existingStudents: Student[] = []
): NoorStudentAbsence[] {
  if (!existingStudents || existingStudents.length === 0) return absences;

  return absences.map((st) => {
    let matched: Student | undefined;

    // 1. Try match by National ID
    if (st.nationalId) {
      matched = existingStudents.find(
        (s) =>
          String(s.id).trim() === st.nationalId ||
          String(s.nationalId || "").trim() === st.nationalId
      );
    }

    // 2. Try match by Name (Exact or Fuzzy)
    if (!matched && st.studentName) {
      const cleanTarget = st.studentName.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").trim();
      matched = existingStudents.find((s) => {
        const sName = (s.name || s.studentName || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").trim();
        return sName === cleanTarget || (sName.length > 5 && (sName.includes(cleanTarget) || cleanTarget.includes(sName)));
      });
    }

    if (matched) {
      const phone = st.phone || matched.phone || matched.mobile || matched["رقم الجوال"] || matched["جوال"] || "";
      const grade = st.grade && st.grade !== "المرحلة الثانوية" ? st.grade : (matched.grade || matched["الصف"] || st.grade);
      const className = st.className ? st.className : (matched.className || matched["الفصل"] || matched["الشعبة"] || "");

      return {
        ...st,
        phone: phone ? String(phone).trim() : st.phone,
        grade: grade || st.grade,
        className: className || st.className,
      };
    }

    return st;
  });
}

/**
 * Specialized parser for Noor's "تقرير الغياب على مستوى الطالب"
 * (Reports -> Students Reports -> Student-Level Absence Report)
 * Extracts: Student Name, Grade, Track, Class, Absence Dates, Excused/Unexcused count, and Absence Rate.
 */
export function parseStudentLevelAbsenceReport(text: string): {
  matched: boolean;
  absences: NoorStudentAbsence[];
  message: string;
} {
  const isReportMatch = 
    text.includes("تقرير الغياب على مستوى الطالب") ||
    (text.includes("اسم الطالب") && (text.includes("نوع الغياب") || text.includes("نسبة غياب الطالب") || text.includes("غياب الطالب")));

  if (!isReportMatch) {
    return { matched: false, absences: [], message: "" };
  }

  // 1. Extract Global Page Metadata (الصف، القسم، الفصل، النظام الدراسي)
  let globalGrade = "";
  let globalClass = "";
  let globalTrack = "";

  const gradeMatch = text.match(/الصف\s*[:\t]\s*([^\n\r\t]+?)(?=\s*(القسم|الفصل|النظام|تقرير|اسم|$))/i);
  if (gradeMatch) globalGrade = cleanText(gradeMatch[1]);

  const classMatch = text.match(/الفصل\s*[:\t]\s*([^\n\r\t]+?)(?=\s*(القسم|الصف|النظام|تقرير|اسم|$))/i);
  if (classMatch) globalClass = cleanText(classMatch[1]);

  const trackMatch = text.match(/القسم\s*[:\t]\s*([^\n\r\t]+?)(?=\s*(الصف|الفصل|النظام|تقرير|اسم|$))/i);
  if (trackMatch) globalTrack = cleanText(trackMatch[1]);

  // 2. Split document into Student Sections (each starting with "اسم الطالب")
  const studentSections = text.split(/(?=اسم الطالب)/g);
  const absences: NoorStudentAbsence[] = [];
  const seenNames = new Set<string>();

  for (let sIdx = 0; sIdx < studentSections.length; sIdx++) {
    const sec = studentSections[sIdx];
    if (!sec.includes("اسم الطالب")) continue;

    const lines = sec.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;

    let studentName = "";
    let nationalId = "";
    let localGrade = globalGrade;
    let localClass = globalClass;
    let localTrack = globalTrack;
    let absenceRate = "";
    const unexcusedDates: string[] = [];
    const excusedDates: string[] = [];

    // Find student name from the line containing "اسم الطالب" or following line
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (line.includes("اسم الطالب")) {
        // e.g. "اسم الطالب	حمد ابراهيم بن عوض البلوي" or "اسم الطالب: حمد ابراهيم"
        const parts = line.split(/[\t:]/).map(p => cleanText(p)).filter(p => p.length > 0);
        const nameCandidates = parts.filter(p => p !== "اسم الطالب" && !p.includes("من تاريخ") && p.length > 2);
        if (nameCandidates.length > 0) {
          studentName = nameCandidates[0];
        } else if (l + 1 < lines.length) {
          const nextLine = lines[l + 1];
          if (!nextLine.includes("من تاريخ") && !nextLine.includes("غياب الطالب") && !nextLine.includes("الصف")) {
            studentName = cleanText(nextLine);
          }
        }
        break;
      }
    }

    if (!studentName || studentName.length < 3 || studentName === "اسم الطالب") {
      continue;
    }

    // Clean name of extra artifacts
    studentName = studentName
      .replace(/^[:\s\t-]+/, "")
      .replace(/من تاريخ.*$/, "")
      .trim();

    if (seenNames.has(studentName)) continue;
    seenNames.add(studentName);

    // Scan all lines in this student section for absence rows and rates
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];

      // Match Grade / Class / Track if overridden locally
      if (!localGrade && line.includes("الصف")) {
        const gm = line.match(/الصف\s*[:\t]\s*([^\n\r\t]+)/);
        if (gm) localGrade = cleanText(gm[1]);
      }
      if (!localClass && line.includes("الفصل")) {
        const cm = line.match(/الفصل\s*[:\t]\s*([^\n\r\t]+)/);
        if (cm) localClass = cleanText(cm[1]);
      }

      // Check for Absence Rate: "نسبة غياب الطالب	1"
      if (line.includes("نسبة غياب الطالب") || line.includes("نسبة الغياب")) {
        const parts = line.split(/[\t: ]+/).map(p => cleanText(p)).filter(p => p.length > 0);
        const rateCandidates = parts.filter(p => !p.includes("نسبة") && !p.includes("غياب") && !p.includes("الطالب"));
        if (rateCandidates.length > 0) {
          absenceRate = rateCandidates[0];
        }
      }

      // Look for National ID (10 digits starting with 1 or 2)
      if (!nationalId && /[12]\d{9}/.test(line)) {
        const nidMatch = line.match(/[12]\d{9}/);
        if (nidMatch) nationalId = nidMatch[0];
      }

      // Look for absence record lines with dates
      const dates = extractDatesFromText(line);
      if (dates.length > 0) {
        // Exclude the interval period line ("من تاريخ 10/03/1448 الى تاريخ 10/03/1448")
        if (line.includes("من تاريخ") && line.includes("الى تاريخ")) {
          continue;
        }

        const date = dates[0];
        if (line.includes("بعذر") || line.includes("عذر مقبول") || line.includes("مقبول")) {
          if (!excusedDates.includes(date)) excusedDates.push(date);
        } else if (
          line.includes("بدون عذر") || 
          line.includes("غير مبرر") || 
          line.includes("غياب") || 
          line.includes("الأحد") || 
          line.includes("الإثنين") || 
          line.includes("الثلاثاء") || 
          line.includes("الأربعاء") || 
          line.includes("الخميس")
        ) {
          if (!unexcusedDates.includes(date)) unexcusedDates.push(date);
        }
      }
    }

    const unexcusedCount = unexcusedDates.length;
    const excusedCount = excusedDates.length;
    const totalAbsent = unexcusedCount + excusedCount;

    // Fallback if no dates were extracted but count was found
    if (totalAbsent === 0 && absenceRate) {
      const parsedNum = parseInt(absenceRate.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        const todayH = getCurrentHijriDate();
        unexcusedDates.push(todayH);
      }
    }

    absences.push({
      id: nationalId || `noor_rep_${Date.now()}_${absences.length}`,
      studentName,
      nationalId,
      grade: localGrade || "الأول الثانوي",
      className: localClass || "",
      track: localTrack || "",
      phone: "",
      excusedDaysCount: excusedDates.length,
      excusedDates,
      unexcusedDaysCount: unexcusedDates.length > 0 ? unexcusedDates.length : (excusedDates.length === 0 ? 1 : 0),
      unexcusedDates: unexcusedDates.length > 0 ? unexcusedDates : (excusedDates.length === 0 ? [getCurrentHijriDate()] : []),
      absenceRate: absenceRate || String(unexcusedDates.length + excusedDates.length || 1),
      tardyCount: 0,
      lastUpdated: new Date().toISOString(),
      source: "noor_tool",
    });
  }

  if (absences.length > 0) {
    return {
      matched: true,
      absences,
      message: `تم سحب بيانات (${absences.length}) طالب بدقة عالية من تقرير الغياب على مستوى الطالب بنظام نور!`,
    };
  }

  return { matched: false, absences: [], message: "" };
}

/**
 * Intelligent Smart Parser for any text copied from Noor system
 * Handles:
 * - Student-Level Absence Reports (تقرير الغياب على مستوى الطالب)
 * - JSON output from Browser Extension / Console Script
 * - Table copies (TSV from Chrome/Edge)
 * - Space-separated text dumps from Noor WebForms
 * - Line-by-line copies from Noor reports
 */
export function parseNoorRawText(raw: string): {
  success: boolean;
  absences: NoorStudentAbsence[];
  message: string;
} {
  const text = (raw || "").trim();
  if (!text) {
    return { success: false, absences: [], message: "النص المدخل فارغ. يرجى نسخ تقرير أو جدول الغياب من نظام نور ولصقه هنا." };
  }

  const defaultDate = getCurrentHijriDate();

  // Method 1: Check if input is JSON (from Console Script or Extension)
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const absences: NoorStudentAbsence[] = parsed.map((item, idx) => {
          const excused = Number(item.excusedDaysCount || 0);
          const unexcused = Number(
            item.unexcusedDaysCount !== undefined
              ? item.unexcusedDaysCount
              : item.totalAbsent && excused === 0
              ? item.totalAbsent
              : 0
          );
          const exDates = Array.isArray(item.excusedDates) && item.excusedDates.length > 0 ? item.excusedDates : excused > 0 ? [defaultDate] : [];
          const unDates = Array.isArray(item.unexcusedDates) && item.unexcusedDates.length > 0 ? item.unexcusedDates : unexcused > 0 ? [defaultDate] : [];

          return {
            id: String(item.nationalId || item.id || `noor_${Date.now()}_${idx}`),
            studentName: cleanText(item.studentName || item.name || `طالب ${idx + 1}`),
            nationalId: item.nationalId ? String(item.nationalId).trim() : "",
            grade: cleanText(item.grade) || "المرحلة الثانوية",
            className: cleanText(item.className) || "",
            track: cleanText(item.track) || "",
            phone: item.phone ? String(item.phone).trim() : "",
            excusedDaysCount: excused,
            excusedDates: exDates,
            unexcusedDaysCount: unexcused > 0 ? unexcused : (excused === 0 ? 1 : 0),
            unexcusedDates: unDates.length > 0 ? unDates : (excused === 0 ? [defaultDate] : []),
            absenceRate: item.absenceRate || String(excused + unexcused || 1),
            tardyCount: Number(item.tardyCount || 0),
            lastUpdated: new Date().toISOString(),
            source: "noor_tool",
          };
        });

        return {
          success: true,
          absences,
          message: `تم استيراد (${absences.length}) طالب غائب بنجاح من أداة نور الذكية.`,
        };
      }
    } catch (e) {
      // Continue to textual parser
    }
  }

  // Method 2: Check for Noor Student-Level Absence Report (تقرير الغياب على مستوى الطالب)
  const reportResult = parseStudentLevelAbsenceReport(text);
  if (reportResult.matched && reportResult.absences.length > 0) {
    return {
      success: true,
      absences: reportResult.absences,
      message: reportResult.message,
    };
  }

  // Method 2: Intelligent Multi-line / Tabular Parser
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const absences: NoorStudentAbsence[] = [];
  const seenIds = new Set<string>();

  // Detect dates from the entire text to use as context
  const allDocDates = extractDatesFromText(text);
  const contextDate = allDocDates.length > 0 ? allDocDates[0] : defaultDate;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip known header lines
    if (
      line.includes("اسم الطالب") &&
      (line.includes("السجل") || line.includes("الهوية") || line.includes("الصف") || line.includes("حالة"))
    ) {
      continue;
    }
    if (line.includes("المجموع الكلي") || line.includes("صفحة 1 من") || line.includes("وزارة التعليم")) {
      continue;
    }

    // Split line by Tabs, Comma, Pipe or multiple spaces
    const parts = line
      .split(/[\t,|;]|\s{2,}/)
      .map((p) => cleanText(p))
      .filter((p) => p.length > 0);

    let name = "";
    let nationalId = "";
    let grade = "";
    let className = "";
    let phone = "";
    let excusedCount = 0;
    let unexcusedCount = 0;
    let lineDates = extractDatesFromText(line);
    let isAbsent = false;

    // Check each cell / segment
    for (const part of parts) {
      // 1. National ID (10 digits starting with 1 or 2)
      if (/[12]\d{9}/.test(part) && !nationalId) {
        const m = part.match(/[12]\d{9}/);
        if (m) nationalId = m[0];
      }
      // 2. Phone number (05xxxxxxxx or 9665xxxxxxxx)
      else if (/^(05\d{8}|9665\d{8}|\+9665\d{8})$/.test(part.replace(/\s+/g, "")) && !phone) {
        phone = part.replace(/\s+/g, "");
      }
      // 3. Arabic Student Name (2 to 6 words, not grade names)
      else if (
        !name &&
        /^[\u0621-\u064A\s]{6,60}$/.test(part) &&
        part.split(" ").length >= 2 &&
        !part.includes("الصف") &&
        !part.includes("المرحلة") &&
        !part.includes("غائب") &&
        !part.includes("حاضر") &&
        !part.includes("تأخر") &&
        !part.includes("شعبة") &&
        !part.includes("مدرسة")
      ) {
        name = part;
      }
      // 4. Grade Name
      else if (
        !grade &&
        (part.includes("أول ثانوي") ||
          part.includes("ثاني ثانوي") ||
          part.includes("ثالث ثانوي") ||
          part.includes("الأول الثانوي") ||
          part.includes("الثاني الثانوي") ||
          part.includes("الثالث الثانوي") ||
          part.includes("مسارات") ||
          part.includes("ابتدائي") ||
          part.includes("متوسط") ||
          part.includes("ثانوي"))
      ) {
        grade = part;
      }
      // 5. Class / Section Name
      else if (
        !className &&
        (/^\d{1,3}$/.test(part) ||
          part.includes("فصل") ||
          part.includes("شعبة") ||
          /^(\d{3}|\d{1,2}\/\d{1,2})$/.test(part))
      ) {
        className = part;
      }
      // 6. Absence Status Checks
      else if (part.includes("بعذر") || part.includes("مقبول") || part.includes("عذر مقبول")) {
        excusedCount = Math.max(excusedCount, 1);
        isAbsent = true;
      } else if (
        part.includes("بدون عذر") ||
        part.includes("غير مبرر") ||
        part === "غائب" ||
        part === "غياب" ||
        part.includes("غياب كامل")
      ) {
        unexcusedCount = Math.max(unexcusedCount, 1);
        isAbsent = true;
      }
    }

    // Direct line check for absence keywords
    if (!isAbsent) {
      if (line.includes("بعذر")) {
        excusedCount = Math.max(excusedCount, 1);
        isAbsent = true;
      } else if (line.includes("بدون عذر") || line.includes("غائب") || line.includes("غياب")) {
        unexcusedCount = Math.max(unexcusedCount, 1);
        isAbsent = true;
      }
    }

    // If we have a valid student name and marked absent
    if (name && (isAbsent || line.includes("غائب") || line.includes("غياب") || excusedCount > 0 || unexcusedCount > 0)) {
      const key = (nationalId || name).trim();
      if (!seenIds.has(key)) {
        seenIds.add(key);

        const chosenDate = lineDates.length > 0 ? lineDates[0] : contextDate;
        const exList = excusedCount > 0 ? (lineDates.length > 0 ? lineDates : [chosenDate]) : [];
        const unList =
          unexcusedCount > 0
            ? lineDates.length > 0
              ? lineDates
              : [chosenDate]
            : excusedCount === 0
            ? [chosenDate]
            : [];

        absences.push({
          id: nationalId || `p_${Date.now()}_${absences.length}`,
          studentName: name,
          nationalId: nationalId,
          grade: grade || "المرحلة الثانوية",
          className: className || "",
          phone: phone || "",
          excusedDaysCount: excusedCount,
          excusedDates: exList,
          unexcusedDaysCount: unexcusedCount > 0 ? unexcusedCount : (excusedCount === 0 ? 1 : 0),
          unexcusedDates: unList,
          lastUpdated: new Date().toISOString(),
          source: "manual",
        });
      }
    }
  }

  // If simple line iteration found students, return them
  if (absences.length > 0) {
    return {
      success: true,
      absences,
      message: `تم التعرف بذكاء على (${absences.length}) طالب غائب مع كافة تفاصيل الغياب.`,
    };
  }

  return {
    success: false,
    absences: [],
    message:
      "لم نتمكن من العثور على أسماء طلاب غائبين في النص. تأكد من تحديد جدول الغياب في نور والضغط على نسخ (Ctrl + C) ثم اللصق هنا.",
  };
}

/**
 * Intelligent Excel / CSV File Parser for Noor Reports
 */
export async function parseNoorExcelFile(file: File): Promise<{
  success: boolean;
  absences: NoorStudentAbsence[];
  message: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!jsonRows || jsonRows.length === 0) {
          resolve({ success: false, absences: [], message: "ملف الإكسل فارغ." });
          return;
        }

        // Convert entire sheet to text dump for our smart text parser,
        // while also scanning structured columns
        const textDump = jsonRows
          .map((row) => (Array.isArray(row) ? row.join("\t") : String(row)))
          .join("\n");

        const result = parseNoorRawText(textDump);
        if (result.success && result.absences.length > 0) {
          resolve({
            success: true,
            absences: result.absences.map((st) => ({ ...st, source: "excel_import" })),
            message: `تم استخراج (${result.absences.length}) طالب غائب بنجاح من ملف الإكسل.`,
          });
        } else {
          resolve({
            success: false,
            absences: [],
            message: "لم يتم العثور على سجلات غياب في ملف الإكسل. تأكد من أنه كشف غياب صحيح من نظام نور.",
          });
        }
      } catch (err: any) {
        resolve({
          success: false,
          absences: [],
          message: "حدث خطأ أثناء قراءة ملف الإكسل: " + err.message,
        });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, absences: [], message: "تعذر قراءة الملف المختار." });
    };

    reader.readAsArrayBuffer(file);
  });
}
