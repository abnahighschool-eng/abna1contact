import * as XLSX from "xlsx";
import { Teacher, ScheduleAssignment } from "../types";

/**
 * Advanced Arabic Text Normalizer for robust name matching
 */
export function normalizeArabicText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    // Remove diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, "")
    // Tatweel
    .replace(/\u0640/g, "")
    // Normalize Alefs
    .replace(/[أإآٱ]/g, "ا")
    // Normalize Taa Marbuta
    .replace(/ة/g, "ه")
    // Normalize Alef Maksura / Yaa
    .replace(/[ىي]/g, "ي")
    // Normalize compound prefixes and common words
    .replace(/\bعبد\s+/g, "عبد")
    .replace(/\bابو\s+/g, "ابو")
    .replace(/\bال\s+/g, "ال")
    .replace(/\b(بن|ابن)\b/g, "")
    .replace(/^(أستاذ|استاذ|الاستاذ|الأستاذ|أ\/|أ\.|د\/|د\.|دكتور|الدكتور|معلم|المعلم|الأستاذ\/|الاستاذ\/)\s*/g, "")
    // Remove non-word and extra spaces
    .replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intelligent Match between Schedule Teacher Name and Registered Teachers in Teacher Roster
 */
export function matchTeacherInRoster(
  teacherName: string,
  teachersList: Teacher[]
): Teacher | undefined {
  if (!teacherName || !teachersList || teachersList.length === 0) return undefined;

  const cleanQuery = normalizeArabicText(teacherName);
  if (!cleanQuery) return undefined;

  const queryWords = cleanQuery.split(" ").filter((w) => w.length > 1);

  // 1. Exact match (normalized)
  for (const t of teachersList) {
    const tNorm = normalizeArabicText(t.name);
    if (tNorm === cleanQuery) return t;
  }

  // 2. Contains match (normalized)
  for (const t of teachersList) {
    const tNorm = normalizeArabicText(t.name);
    if (tNorm && (tNorm.includes(cleanQuery) || cleanQuery.includes(tNorm))) return t;
  }

  // 3. First Name + Last Name match (e.g. "احمد القحطاني" matches "احمد عايض عبدالله القحطاني")
  if (queryWords.length >= 2) {
    const qFirst = queryWords[0];
    const qLast = queryWords[queryWords.length - 1];

    for (const t of teachersList) {
      const tWords = normalizeArabicText(t.name).split(" ").filter((w) => w.length > 1);
      if (tWords.length >= 2) {
        const tFirst = tWords[0];
        const tLast = tWords[tWords.length - 1];
        if (qFirst === tFirst && qLast === tLast) {
          return t;
        }
      }
    }
  }

  // 4. Token overlap score (at least 2 matching words)
  let bestTeacher: Teacher | undefined;
  let highestScore = 0;

  for (const t of teachersList) {
    const tWords = normalizeArabicText(t.name).split(" ").filter((w) => w.length > 1);
    let matchCount = 0;
    for (const qw of queryWords) {
      if (tWords.some((tw) => tw === qw || tw.includes(qw) || qw.includes(tw))) {
        matchCount++;
      }
    }
    if (matchCount >= 2 && matchCount > highestScore) {
      highestScore = matchCount;
      bestTeacher = t;
    }
  }

  return bestTeacher;
}

/**
 * Clean and normalize phone number into standard 9665XXXXXXXX format
 */
export function normalizeTeacherPhone(phoneInput: any): string {
  if (!phoneInput) return "";
  let cleaned = String(phoneInput)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^0-9]/g, "")
    .trim();

  if (cleaned.startsWith("00966")) {
    cleaned = "966" + cleaned.substring(5);
  } else if (cleaned.startsWith("966")) {
    cleaned = cleaned;
  } else if (cleaned.startsWith("05")) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

/**
 * Extract numerical digits from section strings
 */
export function extractSectionDigits(str: string): string[] {
  if (!str) return [];
  const normalized = String(str).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  const matches = normalized.match(/\d+/g);
  return matches || [];
}

/**
 * Extracts the primary section number from any representation:
 * Examples:
 * - "3" -> "3"
 * - "شعبة 3" -> "3"
 * - "فصل 3" -> "3"
 * - "ش 3" -> "3"
 * - "1/3" -> "3" (section 3 in grade 1)
 * - "3/1" -> "3" (or "1" depending on format)
 * - "303" -> "3"
 * - "أول ثانوي - شعبة 3" -> "3"
 */
export function extractPrimarySectionNumber(str: string): string {
  if (!str) return "";
  const normalized = String(str)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim();

  // Pattern 1: Explicit keyword followed by number (e.g. شعبة 3, فصل 3, ش 3, صف 3)
  const explicitMatch = normalized.match(/(?:شعبة|فصل|صف|ش|ف)\s*(\d+)/i);
  if (explicitMatch) return explicitMatch[1];

  // Pattern 2: Slash format e.g. "1/3" or "2/3" or "3/1"
  const slashMatch = normalized.match(/(\d+)\s*[\/\-]\s*(\d+)/);
  if (slashMatch) {
    const n1 = parseInt(slashMatch[1], 10);
    const n2 = parseInt(slashMatch[2], 10);
    if (n1 >= 1 && n1 <= 3 && n2 >= 1 && n2 <= 15 && n1 !== n2) {
      return String(n2);
    }
    return String(slashMatch[2]);
  }

  // Pattern 3: Pure number e.g. "3" or "303"
  if (/^\d+$/.test(normalized)) {
    const num = parseInt(normalized, 10);
    if (num >= 101 && num <= 399) {
      return String(num % 100);
    }
    return normalized;
  }

  // Pattern 4: Any lone number bounded by word boundaries or spaces
  const loneNumMatch = normalized.match(/\b(\d+)\b/);
  if (loneNumMatch) return loneNumMatch[1];

  return normalized;
}

/**
 * Standardize section name for unified display across the app (e.g. "شعبة 3")
 */
export function formatStandardSectionName(sectionInput: string): string {
  if (!sectionInput) return "";
  const clean = String(sectionInput).trim();
  const secNum = extractPrimarySectionNumber(clean);
  if (secNum && /^\d+$/.test(secNum)) {
    return `شعبة ${secNum}`;
  }
  return clean.replace(/^(ش|ف)\s*(\d+)/i, "شعبة $2");
}

/**
 * Normalize section names to easily match between students and timetable
 * e.g. "شعبة 5", "5", "فصل 5", "شعبة 5/علمي", "5/أ", "الصف الأول / 1" -> standardized
 */
export function normalizeSectionName(sectionInput: string): string {
  if (!sectionInput) return "";
  let str = String(sectionInput)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim()
    .toLowerCase();
  
  // Remove unnecessary prefixes
  str = str.replace(/^(شعبة|فصل|صف|الصف|ش|ف)\s*/i, "").trim();
  return str;
}

/**
 * Checks if a student section matches a schedule assignment section with high precision
 * Matches "3" with "شعبة 3", "فصل 3", "1/3", "303", "أول ثانوي / 3"
 * Strictly does NOT match "3" with "13", "23", "30", "4", etc.
 */
export function isSectionMatching(studentSec: string, schedSec: string): boolean {
  if (!studentSec || !schedSec) return false;

  const sNorm = normalizeSectionName(studentSec);
  const scNorm = normalizeSectionName(schedSec);

  if (sNorm === scNorm) return true;

  // Extract primary section numbers
  const sNum = extractPrimarySectionNumber(studentSec);
  const scNum = extractPrimarySectionNumber(schedSec);

  if (sNum && scNum) {
    if (sNum === scNum) return true;
  }

  // Substring check for named sections (e.g. "علمي 1" in "ثالث ثانوي علمي 1")
  if (sNorm.length > 2 && scNorm.length > 2) {
    if (sNorm.includes(scNorm) || scNorm.includes(sNorm)) return true;
  }

  return false;
}

/**
 * Intelligent Parser for Teachers Excel (بيانات المعلمين)
 * Supports columns: رقم الهوية | الاسم الرباعي | مجال التدريس | التخصص | الجوال
 */
export function parseTeachersWorkbook(data: ArrayBuffer | Uint8Array | string): Teacher[] {
  const workbook = XLSX.read(data, { type: typeof data === "string" ? "binary" : "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to 2D array of rows
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  if (!rawMatrix || rawMatrix.length === 0) return [];

  // Find header row index
  let headerRowIndex = -1;
  let nameColIdx = -1;
  let phoneColIdx = -1;
  let subjectColIdx = -1;
  let specialtyColIdx = -1;
  let nationalIdColIdx = -1;

  for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
    const row = rawMatrix[r].map((c) => String(c).trim());
    
    // Look for indicative headers
    const nameIdx = row.findIndex((h) => 
      /اسم|الاسم|المعلم|الرباعي/i.test(h) && !/هوية|جوال|مدرسة|مدير/i.test(h)
    );
    const phoneIdx = row.findIndex((h) => 
      /جوال|الجوال|هاتف|الهاتف|واتس|موبايل|phone|mobile/i.test(h)
    );

    if (nameIdx !== -1 || phoneIdx !== -1) {
      headerRowIndex = r;
      nameColIdx = nameIdx !== -1 ? nameIdx : 1; // Default to col B as in image
      phoneColIdx = phoneIdx !== -1 ? phoneIdx : row.findIndex(h => /جوال/i.test(h));
      subjectColIdx = row.findIndex((h) => /مجال|التدريس|المادة|مادة/i.test(h));
      specialtyColIdx = row.findIndex((h) => /تخصص|التخصص/i.test(h));
      nationalIdColIdx = row.findIndex((h) => /هوية|الهوية|السجل|الوطنية|id/i.test(h));
      break;
    }
  }

  // Fallback if header not clearly identified
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    nameColIdx = 1; // col B
    subjectColIdx = 2; // col C
    specialtyColIdx = 3; // col D
    phoneColIdx = 4; // col E
    nationalIdColIdx = 0; // col A
  }

  const teachers: Teacher[] = [];
  const seenPhones = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!row || row.length === 0) continue;

    const rawName = nameColIdx !== -1 && row[nameColIdx] ? String(row[nameColIdx]).trim() : "";
    const rawPhone = phoneColIdx !== -1 && row[phoneColIdx] ? String(row[phoneColIdx]).trim() : "";
    const rawSubject = subjectColIdx !== -1 && row[subjectColIdx] ? String(row[subjectColIdx]).trim() : "";
    const rawSpecialty = specialtyColIdx !== -1 && row[specialtyColIdx] ? String(row[specialtyColIdx]).trim() : "";
    const rawNationalId = nationalIdColIdx !== -1 && row[nationalIdColIdx] ? String(row[nationalIdColIdx]).trim() : "";

    // Ignore empty or invalid rows
    if (!rawName || rawName === "المعلم" || rawName === "الاسم الرباعي") continue;

    const normalizedPhone = normalizeTeacherPhone(rawPhone);
    const id = `tch_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 6)}`;

    teachers.push({
      id,
      name: rawName,
      phone: normalizedPhone || rawPhone,
      subjectSpecialty: rawSubject || rawSpecialty || "عام",
      specialty: rawSpecialty,
      nationalId: rawNationalId,
    });
  }

  return teachers;
}

/**
 * Check if a text is a non-academic duty/period (e.g. منتظر 1, انتظار, نشاط, ريادة, إشراف, فراغ)
 * CRITICAL: Numbers like "3" or "شعبة 3" are NOT non-academic duties! They are academic sections!
 */
export function isNonAcademicDuty(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  if (!clean || clean === "#" || clean === "-" || clean === "--" || clean === "_" || clean === "." || clean === "x") {
    return true;
  }
  // If it's a section number (e.g. "3", "3/1", "1/3"), it is definitely NOT non-academic!
  if (/^\d+([\/\-]\d+)?$/.test(clean) || /^(شعبة|فصل|صف|ش)\s*\d+$/i.test(clean)) {
    return false;
  }
  return /^(منتظر|انتظار|نشاط|ريادة|اشراف|إشراف|احتياط|فراغ|شاغر|حصة فراغ|طابور|اصطفاف|استراحة|فسحة|صلاة)(\s*\d+)?$/i.test(clean) ||
         /(منتظر\s*\d+|انتظار\s*\d+|حصة\s*نشاط|نشاط\s*مدرسي|إشراف\s*يومي)/i.test(clean);
}

/**
 * Clean & Extract Subject and Section from a schedule cell text with extreme precision
 * Handles:
 * - "شعبة 3 \n الفيزياء 2"
 * - "الفيزياء 2 \n شعبة 3"
 * - "3 \n رياضيات 1"
 * - "3" (section only, fallbackSubject used)
 * - "شعبة 3" (section only)
 * - "كيمياء 1 - شعبة 3"
 * - "فيزياء 2 (3)"
 * - "أ. محمد الجعيد \n رياضيات 1" (when cell contains teacher and subject)
 */
export function extractSubjectAndSectionFromCell(
  cellText: string,
  fallbackSubject = "",
  fallbackSection = ""
): { subject: string; section: string; teacherInCell?: string } {
  if (!cellText) return { subject: fallbackSubject, section: fallbackSection };
  let clean = String(cellText).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  
  if (isNonAcademicDuty(clean)) {
    return { subject: "", section: "" };
  }

  // Pure number alone (e.g. "3" or "1/3")
  if (/^\d+$/.test(clean) || /^\d+[\/\-]\d+$/.test(clean)) {
    return {
      subject: fallbackSubject || "",
      section: formatStandardSectionName(clean),
    };
  }

  // Explicit section alone (e.g. "شعبة 3" or "ش 3" or "فصل 3")
  if (/^(شعبة|فصل|صف|ش|ف)\s*\d+$/i.test(clean)) {
    return {
      subject: fallbackSubject || "",
      section: formatStandardSectionName(clean),
    };
  }

  let lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  lines = lines.filter((l) => !isNonAcademicDuty(l));

  if (lines.length === 0) {
    return { subject: "", section: "" };
  }

  const subjectPatterns = /(فيزياء|كيمياء|احياء|أحياء|علم بيئة|بيئة|رياضيات|حاسب|تقنية رقمية|رقمية|كفايات|لغتي|لغة عربية|عربي|انجليزي|إنجليزي|انجليزية|علم الأرض|علوم الأرض|فضاء|تاريخ|جغرافيا|دراسات|اجتماعيات|قرآن|قران|تفسير|توحيد|فقه|حديث|دراسات إسلامية|إسلامية|دين|تربية بدنية|بدنية|دفاع عن النفس|تفكير ناقد|مهارات حياتية|فنون|إدارة|تسويق|هندسة|ذكاء اصطناعي|بيانات|علم اجتماع|إحصاء)/i;

  let section = fallbackSection;
  let subject = fallbackSubject;
  let teacherInCell: string | undefined = undefined;

  if (lines.length >= 2) {
    const l0 = lines[0];
    const l1 = lines.slice(1).join(" ");

    const l0HasSec = /شعبة|فصل|صف|ش\s*\d+/i.test(l0) || /^\d+$/.test(l0) || /^\d+[\/\-]\d+$/.test(l0);
    const l1HasSec = /شعبة|فصل|صف|ش\s*\d+/i.test(l1) || /^\d+$/.test(l1) || /^\d+[\/\-]\d+$/.test(l1);
    const l0HasSubj = subjectPatterns.test(l0);
    const l1HasSubj = subjectPatterns.test(l1);

    if (l0HasSec && !l0HasSubj) {
      section = l0;
      subject = l1;
    } else if (l1HasSec && !l1HasSubj) {
      subject = l0;
      section = l1;
    } else if (l0HasSubj && !l1HasSubj) {
      subject = l0;
      section = l1;
    } else if (!l0HasSubj && l1HasSubj) {
      if (l0HasSec) {
        section = l0;
      } else {
        teacherInCell = l0;
      }
      subject = l1;
    } else {
      section = l0;
      subject = l1;
    }
  } else {
    // Single line text: e.g. "شعبة 3 - الفيزياء 2" or "الفيزياء 2 (شعبة 3)" or "كيمياء 1 / 3"
    const single = lines[0] || clean;
    const matchedSec = single.match(/(شعبة\s*\d+|فصل\s*\d+|ش\s*\d+|\(\s*شعبة\s*\d+\s*\)|\(\s*\d+\s*\))/i);
    if (matchedSec) {
      section = matchedSec[0].replace(/[\(\)]/g, "").trim();
      subject = single.replace(matchedSec[0], "").replace(/^[\-\:\/\–\s]+|[\-\:\/\–\s]+$/g, "").trim();
    } else {
      // Look for trailing or leading slash/dash with number e.g. "رياضيات / 3" or "3 - كيمياء"
      const slashNumMatch = single.match(/(?:^|\/|\-|\:)\s*(\d+)\s*(?:$|\/|\-|\:)/);
      if (slashNumMatch && subjectPatterns.test(single)) {
        section = `شعبة ${slashNumMatch[1]}`;
        subject = single.replace(slashNumMatch[0], "").replace(/^[\-\:\/\–\s]+|[\-\:\/\–\s]+$/g, "").trim();
      } else {
        // Look for trailing digit if subject pattern matches
        const secRegex = /(?:شعبة|فصل|صف)?\s*(\d+)$/;
        const match = single.match(secRegex);
        if (match && subjectPatterns.test(single)) {
          section = `شعبة ${match[1]}`;
          subject = single.replace(secRegex, "").trim();
        } else {
          subject = single;
        }
      }
    }
  }

  // Format section nicely if it's just a number
  if (/^\d+$/.test(section.trim())) {
    section = `شعبة ${section.trim()}`;
  } else if (/^ش\s*\d+/i.test(section.trim())) {
    section = section.replace(/^ش\s*/i, "شعبة ");
  }

  // Clean trailing punctuation
  subject = subject.replace(/^[-\/:\s]+|[-\/:\s]+$/g, "").trim();
  section = section.replace(/^[-\/:\s]+|[-\/:\s]+$/g, "").trim();

  if (!subject && fallbackSubject) {
    subject = fallbackSubject;
  }
  if (!section && fallbackSection) {
    section = fallbackSection;
  }

  return { subject, section, teacherInCell };
}

/**
 * Intelligent Parser for School Schedule Timetable Excel (الجدول المدرسي)
 * Matches the layout from Image 2:
 * Rows: Teacher Names
 * Columns: Days (الأحد..الخميس), Periods (1..7)
 * Cells: "شعبة 5 \n الفيزياء 2" or "شعبة 1 \n الكفايات اللغوية 1"
 */
export function parseScheduleWorkbook(data: ArrayBuffer | Uint8Array | string, existingTeachers: Teacher[] = []): {
  assignments: ScheduleAssignment[];
  detectedTeachers: string[];
  detectedSections: string[];
  teacherQuotas?: Record<string, number>;
} {
  const workbook = XLSX.read(data, { type: typeof data === "string" ? "binary" : "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawMatrix: any[][] = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
  if (!rawMatrix || rawMatrix.length === 0) {
    return { assignments: [], detectedTeachers: [], detectedSections: [] };
  }

  const assignments: ScheduleAssignment[] = [];
  const detectedTeachersSet = new Set<string>();
  const detectedSectionsSet = new Set<string>();

  // Check if this is a standard list format: [المعلم / اسم المعلم, المادة, الشعبة / الفصل]
  let isTabularFormat = false;
  let tabTeacherCol = -1;
  let tabSubjectCol = -1;
  let tabSectionCol = -1;
  let tabHeaderRow = -1;

  for (let r = 0; r < Math.min(6, rawMatrix.length); r++) {
    const row = rawMatrix[r].map((c) => String(c).trim());
    const tIdx = row.findIndex((h) => /المعلم|اسم المعلم|الأستاذ/i.test(h));
    const sIdx = row.findIndex((h) => /المادة|اسم المادة|مادة/i.test(h));
    const secIdx = row.findIndex((h) => /الشعبة|الفصل|الصف|شعبة/i.test(h));

    if (tIdx !== -1 && sIdx !== -1 && secIdx !== -1) {
      isTabularFormat = true;
      tabTeacherCol = tIdx;
      tabSubjectCol = sIdx;
      tabSectionCol = secIdx;
      tabHeaderRow = r;
      break;
    }
  }

  if (isTabularFormat && tabHeaderRow !== -1) {
    for (let r = tabHeaderRow + 1; r < rawMatrix.length; r++) {
      const row = rawMatrix[r];
      if (!row || row.length === 0) continue;
      const teacherName = String(row[tabTeacherCol] || "").trim();
      const subject = String(row[tabSubjectCol] || "").trim();
      let section = String(row[tabSectionCol] || "").trim();

      if (/^\d+$/.test(section)) {
        section = `شعبة ${section}`;
      }

      if (teacherName && (subject || section)) {
        detectedTeachersSet.add(teacherName);
        if (section) detectedSectionsSet.add(section);
        assignments.push({
          id: `asg_${r}_${Math.random().toString(36).substring(2, 6)}`,
          teacherName,
          subject: subject || "المادة المقررة",
          section: section || "عام",
        });
      }
    }
    return {
      assignments,
      detectedTeachers: Array.from(detectedTeachersSet),
      detectedSections: Array.from(detectedSectionsSet),
    };
  }

  // Matrix timetable parser (as seen in Image 2)
  // Step 1: Locate row where teacher names column is (typically Col A or Col B or marked with "المعلم")
  let teacherColIdx = -1;
  let subjectColIdx = -1;
  let startRowIdx = -1;

  for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
    const row = rawMatrix[r];
    for (let c = 0; c < Math.min(12, row.length); c++) {
      const val = String(row[c] || "").trim();
      if (/^(المعلم|اسم المعلم|الأستاذ|اسم المدرس)$/i.test(val)) {
        teacherColIdx = c;
        startRowIdx = r + 1;
      }
      if (/^(المادة|اسم المادة|مادة|التخصص|تخصص)$/i.test(val)) {
        subjectColIdx = c;
      }
    }
    if (teacherColIdx !== -1) break;
  }

  // If "المعلم" header was not explicitly written, inspect column containing teacher names
  if (teacherColIdx === -1) {
    teacherColIdx = 1; // Default col B
    startRowIdx = 3;
  }

  // If startRowIdx wasn't set, default to 3
  if (startRowIdx <= 0) {
    startRowIdx = 3;
  }

  // First period column detection
  const firstTimetableCol = Math.max(teacherColIdx, subjectColIdx) + 1;

  // CRITICAL USER DIRECTIVE:
  // "فقط العمود الاخير الذي عنوانه الفصول هو ما يستبعد من الجدول والذي هو عمو AI"
  // "هناك عمود اخير فيه انصبة المعلمين انت اعتبرتها شعبه فمت تضيف شعبة برقم 12 وشعبه برقم 18 مع انها عدد انصبة المعلمين"
  // Detect and exclude the last column titled "الفصول" (Column AI, index 34 in 0-based indexing)
  // This column contains teachers' quota (e.g. 12, 18) and must NEVER be treated as a section or timetable period!
  const maxTotalCols = Math.max(...rawMatrix.map((r) => (r ? r.length : 0)));
  const excludedQuotaColSet = new Set<number>();

  for (let c = 0; c < maxTotalCols; c++) {
    let hasAlfousoulHeader = false;
    for (let r = 0; r <= Math.min(startRowIdx + 1, rawMatrix.length - 1); r++) {
      const val = String(rawMatrix[r]?.[c] || "").trim();
      if (/^الفصول$|الفصول/i.test(val)) {
        hasAlfousoulHeader = true;
        break;
      }
    }
    // Exclude if header is "الفصول" or if column is Column AI (index 34 in 0-based indexing)
    if (hasAlfousoulHeader || c === 34) {
      excludedQuotaColSet.add(c);
    }
  }
  if (maxTotalCols > 34) {
    excludedQuotaColSet.add(34);
  }

  // Scan header rows (rows above startRowIdx) to detect Days and Periods mapping for columns
  const standardDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  const colDayMap: { [col: number]: string } = {};
  const colPeriodMap: { [col: number]: number } = {};

  // Detect explicit days across header rows with carry-forward for merged day cells
  for (let r = 0; r < startRowIdx; r++) {
    const headerRow = rawMatrix[r];
    if (!headerRow) continue;
    let runningDay = "";
    for (let c = 0; c < headerRow.length; c++) {
      // Strictly exclude Column AI / "الفصول" so runningDay and periods never map to it
      if (excludedQuotaColSet.has(c)) {
        continue;
      }

      const cell = String(headerRow[c] || "").trim();
      const matchedDay = standardDays.find((d) => cell.includes(d));
      if (matchedDay) {
        runningDay = matchedDay;
      }
      if (runningDay && !colDayMap[c]) {
        colDayMap[c] = runningDay;
      }

      // Check for period numbers 1 to 7 or ١ to ٧
      const cleanDigit = cell.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
      const periodMatch = cleanDigit.match(/\b([1-7])\b/);
      if (periodMatch) {
        colPeriodMap[c] = parseInt(periodMatch[1], 10);
      }
    }
  }

  // Day & period calculation respecting the 7-7-6-6-6 periods distribution (Sun & Mon: 7, Tue to Thu: 6)
  const getDayAndPeriodForCol = (colIdx: number): { day: string; period: number } => {
    const periodOffset = Math.max(0, colIdx - firstTimetableCol);
    const fallbackSlot =
      STANDARD_WEEK_SCHEDULE_SLOTS[periodOffset] ||
      STANDARD_WEEK_SCHEDULE_SLOTS[STANDARD_WEEK_SCHEDULE_SLOTS.length - 1];

    let day = colDayMap[colIdx] ? normalizeDayOfWeek(colDayMap[colIdx]) : fallbackSlot.day;
    let period = colPeriodMap[colIdx] || fallbackSlot.period;

    // CRITICAL DOMAIN RULE: Tuesday, Wednesday, and Thursday have ONLY 6 periods (No 7th period!)
    const maxPeriods = getMaxPeriodsForDay(day);
    if (period > maxPeriods) {
      period = fallbackSlot.period <= maxPeriods ? fallbackSlot.period : maxPeriods;
    }

    return {
      day,
      period,
    };
  };

  const teacherQuotas: Record<string, number> = {};

  // Parse each teacher's row in the timetable matrix
  for (let r = startRowIdx; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    if (!row || row.length === 0) continue;

    // Get Teacher Name
    let teacherName = String(row[teacherColIdx] || "").trim();
    if (!teacherName && teacherColIdx > 0) {
      teacherName = String(row[teacherColIdx - 1] || "").trim();
    }
    if (!teacherName && row.length > 0) {
      // Try first non-numeric cell with length > 3
      const nonNum = row.find(cell => typeof cell === "string" && cell.trim().length > 3 && isNaN(Number(cell)));
      if (nonNum) teacherName = String(nonNum).trim();
    }

    // Ignore headers, totals, or empty rows
    if (
      !teacherName ||
      /^(المعلم|مدرسة|الفصول|المجموع|الحصص|الإجمالي|#|م|عدد الحصص)$/i.test(teacherName) ||
      !isNaN(Number(teacherName))
    ) {
      continue;
    }

    detectedTeachersSet.add(teacherName);

    // Get teacher's default subject from row or existing roster
    let teacherDefaultSubject = "";
    if (subjectColIdx !== -1 && row[subjectColIdx]) {
      teacherDefaultSubject = String(row[subjectColIdx]).trim();
    }
    if (!teacherDefaultSubject && existingTeachers.length > 0) {
      const matchedRoster = matchTeacherInRoster(teacherName, existingTeachers);
      if (matchedRoster) {
        teacherDefaultSubject = matchedRoster.subjectSpecialty || matchedRoster.specialty || "";
      }
    }

    // Scan all schedule cells in this teacher's row
    for (let c = firstTimetableCol; c < row.length; c++) {
      if (c === teacherColIdx || c === subjectColIdx) continue;

      // CRITICAL: Strictly exclude the last column titled "الفصول" (Column AI, index 34)
      // containing teachers' quota numbers (e.g. 12, 18) from being parsed as sections or periods!
      if (excludedQuotaColSet.has(c)) {
        const rawQuota = String(row[c] || "").trim();
        const cleanQuota = rawQuota.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
        const quotaNum = parseInt(cleanQuota, 10);
        if (!isNaN(quotaNum) && quotaNum > 0 && teacherName) {
          teacherQuotas[teacherName] = quotaNum;
        }
        continue;
      }

      const cellVal = String(row[c] || "").trim();
      if (!cellVal) continue;

      const { subject, section, teacherInCell } = extractSubjectAndSectionFromCell(
        cellVal,
        teacherDefaultSubject
      );

      const effectiveTeacherName = teacherInCell || teacherName;
      const effectiveSubject = subject || teacherDefaultSubject || "";

      if (section && section !== "شعبة 12" && section !== "شعبة 18" && section !== "12" && section !== "18") {
        detectedSectionsSet.add(section);
      }

      // Only push if there is an actual subject or section, and not purely empty or duty
      if (effectiveSubject || section) {
        const { day, period } = getDayAndPeriodForCol(c);

        assignments.push({
          id: `asg_${r}_${c}_${Math.random().toString(36).substring(2, 6)}`,
          teacherName: effectiveTeacherName,
          subject: effectiveSubject,
          section: section || "عام",
          day,
          period,
        });
      }
    }
  }

  // Post-filter safety: Guarantee that no quota numbers (12, 18) or column AI cells leak into sections or assignments
  const finalAssignments = assignments.filter((asg) => {
    if (asg.id && asg.id.includes("_34_")) return false;
    const sec = (asg.section || "").trim();
    if (sec === "شعبة 12" || sec === "شعبة 18" || sec === "12" || sec === "18") {
      return false;
    }
    return true;
  });

  const finalSections = Array.from(detectedSectionsSet).filter((sec) => {
    const cleanSec = (sec || "").trim();
    if (cleanSec === "شعبة 12" || cleanSec === "شعبة 18" || cleanSec === "12" || cleanSec === "18") {
      return false;
    }
    return true;
  });

  return {
    assignments: finalAssignments,
    detectedTeachers: Array.from(detectedTeachersSet),
    detectedSections: finalSections,
    teacherQuotas,
  };
}

/**
 * Initial Default Teachers Data (Extracted directly from the User's Image 1)
 */
export const DEFAULT_SAMPLE_TEACHERS: Teacher[] = [
  { id: "tch_0", nationalId: "1023884121", name: "عبدالله البلوي", subjectSpecialty: "التوجيه والإرشاد الطلابي", specialty: "موجه طلابي", phone: "0560599870" },
  { id: "tch_1", nationalId: "1033646026", name: "احمد سليمان علي عسيري", subjectSpecialty: "الحاسب الآلي", specialty: "حاسب", phone: "966541372626" },
  { id: "tch_2", nationalId: "1063424566", name: "احمد عايض عبدالله القحطاني", subjectSpecialty: "فيزياء", specialty: "فيزياء", phone: "966553364558" },
  { id: "tch_3", nationalId: "1068319662", name: "انس عيد مطير العمراني", subjectSpecialty: "اللغة العربية", specialty: "عربي", phone: "966558070401" },
  { id: "tch_4", nationalId: "1067999622", name: "باسم مرضي فالح العنزي", subjectSpecialty: "مختبرات علوم", specialty: "محضر مختبر علوم", phone: "966530221011" },
  { id: "tch_5", nationalId: "1058905553", name: "جاسر ناجي سعيد الجهني", subjectSpecialty: "اللغة العربية", specialty: "عربي", phone: "966532101391" },
  { id: "tch_6", nationalId: "1010296406", name: "صالح أحمد عيد الحويطي", subjectSpecialty: "التربية البدنية", specialty: "بدنية", phone: "966530400099" },
  { id: "tch_7", nationalId: "1081299552", name: "صالح محمد صالح الحسيني", subjectSpecialty: "فيزياء", specialty: "فيزياء", phone: "966567027119" },
  { id: "tch_8", nationalId: "1043283116", name: "طارق ضاوي عويض العتيبي", subjectSpecialty: "الحاسب الآلي", specialty: "حاسب", phone: "966566168687" },
  { id: "tch_9", nationalId: "1062216492", name: "عادل عبدي دعسان العنزي", subjectSpecialty: "كيمياء", specialty: "كيمياء", phone: "966546724237" },
  { id: "tch_10", nationalId: "1029369434", name: "عبدالرحمن هلال عابد المطيري", subjectSpecialty: "اللغة الإنجليزية", specialty: "إنجليزي", phone: "966581379859" },
  { id: "tch_11", nationalId: "1031185877", name: "عبدالعزيز محمد علي كعبي", subjectSpecialty: "الحاسب الآلي", specialty: "حاسب", phone: "966553300564" },
  { id: "tch_12", nationalId: "1069876389", name: "فهد عقيل محمد العطوي", subjectSpecialty: "علم الأرض", specialty: "علم أرض", phone: "966501316259" },
  { id: "tch_13", nationalId: "1075249738", name: "فيصل مطلق هويمل العطوي", subjectSpecialty: "دين", specialty: "دين", phone: "966554477062" },
  { id: "tch_14", nationalId: "1041710219", name: "محمد بن علي بن مرزوق العطوي", subjectSpecialty: "اللغة العربية", specialty: "عربي", phone: "966532175256" },
  { id: "tch_15", nationalId: "1068704723", name: "محمد حسين يزيد غزواني", subjectSpecialty: "اللغة الإنجليزية", specialty: "إنجليزي", phone: "966554993921" },
  { id: "tch_16", nationalId: "1015027095", name: "محمد صالح مفرح العمري", subjectSpecialty: "أحياء", specialty: "أحياء", phone: "966561101303" },
  { id: "tch_17", nationalId: "1067734630", name: "محمد ضيف الله رشيد الحويطي", subjectSpecialty: "فيزياء", specialty: "فيزياء", phone: "966506525658" },
  { id: "tch_18", nationalId: "1071374381", name: "محمد مسفر مستور الجعيد", subjectSpecialty: "رياضيات", specialty: "رياضيات", phone: "966509960566" },
  { id: "tch_19", nationalId: "1064699185", name: "ممدوح منصور محمد منصوري", subjectSpecialty: "التربية الاجتماعية والوطنية", specialty: "تاريخ", phone: "966500462009" },
];

/**
 * Initial Default Timetable Schedule Assignments (Extracted directly from User's Image 2)
 */
export const DEFAULT_SAMPLE_SCHEDULE: ScheduleAssignment[] = [
  { id: "sch_1", teacherName: "احمد عايض عبدالله القحطاني", subject: "الفيزياء 2", section: "شعبة 5", day: "الأحد", period: 1 },
  { id: "sch_2", teacherName: "احمد عايض عبدالله القحطاني", subject: "الفيزياء 2", section: "شعبة 4", day: "الأحد", period: 3 },
  { id: "sch_3", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 1", day: "الأحد", period: 2 },
  { id: "sch_4", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 2", day: "الأحد", period: 4 },
  { id: "sch_5", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 3", day: "الاثنين", period: 1 },
  { id: "sch_6", teacherName: "جاسر ناجي سعيد الجهني", subject: "الكفايات اللغوية 2", section: "شعبة 4", day: "الاثنين", period: 2 },
  { id: "sch_7", teacherName: "جاسر ناجي سعيد الجهني", subject: "الكفايات اللغوية 2", section: "شعبة 5", day: "الاثنين", period: 3 },
  { id: "sch_8", teacherName: "جاسر ناجي سعيد الجهني", subject: "البحث ومصادر المعلومات", section: "شعبة 6", day: "الاثنين", period: 5 },
  { id: "sch_9", teacherName: "صالح أحمد عيد الحويطي", subject: "التربية الصحية والبدنية 3", section: "شعبة 7", day: "الثلاثاء", period: 1 },
  { id: "sch_10", teacherName: "صالح أحمد عيد الحويطي", subject: "التربية الصحية والبدنية 3", section: "شعبة 8", day: "الثلاثاء", period: 3 },
  { id: "sch_11", teacherName: "صالح محمد صالح الحسيني", subject: "الفيزياء 3", section: "شعبة 7", day: "الثلاثاء", period: 2 },
  { id: "sch_12", teacherName: "صالح محمد صالح الحسيني", subject: "الفيزياء 3", section: "شعبة 6", day: "الثلاثاء", period: 4 },
  { id: "sch_13", teacherName: "طارق ضاوي عويض العتيبي", subject: "التقنية الرقمية 3", section: "شعبة 8", day: "الأربعاء", period: 1 },
  { id: "sch_14", teacherName: "طارق ضاوي عويض العتيبي", subject: "التقنية الرقمية 3", section: "شعبة 7", day: "الأربعاء", period: 2 },
  { id: "sch_15", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 1", section: "شعبة 1", day: "الأربعاء", period: 3 },
  { id: "sch_16", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 1", section: "شعبة 2", day: "الأربعاء", period: 5 },
  { id: "sch_17", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 3", section: "شعبة 8", day: "الخميس", period: 1 },
  { id: "sch_18", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 4", day: "الخميس", period: 2 },
  { id: "sch_19", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 5", day: "الخميس", period: 3 },
  { id: "sch_20", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 6", day: "الخميس", period: 4 },
  { id: "sch_21", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 1", day: "الأحد", period: 5 },
  { id: "sch_22", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 2", day: "الاثنين", period: 4 },
  { id: "sch_23", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 3", day: "الثلاثاء", period: 5 },
  { id: "sch_24", teacherName: "فهد عقيل محمد العطوي", subject: "علوم الأرض والفضاء 3", section: "شعبة 8", day: "الأربعاء", period: 4 },
  { id: "sch_25", teacherName: "فهد عقيل محمد العطوي", subject: "علوم الأرض والفضاء 3", section: "شعبة 7", day: "الخميس", period: 5 },
  { id: "sch_26", teacherName: "محمد صالح مفرح العمري", subject: "الأحياء 1", section: "شعبة 3", day: "الأحد", period: 6 },
  { id: "sch_27", teacherName: "محمد صالح مفرح العمري", subject: "الأحياء 1", section: "شعبة 2", day: "الاثنين", period: 6 },
  { id: "sch_28", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 1", day: "الأحد", period: 7 },
  { id: "sch_29", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 2", day: "الثلاثاء", period: 6 },
  { id: "sch_30", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 3", day: "الخميس", period: 6 },
  { id: "sch_31", teacherName: "احمد عايض عبدالله القحطاني", subject: "الفيزياء 2", section: "شعبة 5", day: "الاثنين", period: 7 },
  { id: "sch_32", teacherName: "جاسر ناجي سعيد الجهني", subject: "الكفايات اللغوية 2", section: "شعبة 5", day: "الأربعاء", period: 6 },
];

export const SCHOOL_WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"] as const;
export const SCHOOL_PERIODS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Returns the valid periods for a given day in the school timetable.
 * Business Rule: Sunday & Monday have 7 periods (1 to 7).
 * Tuesday, Wednesday, and Thursday have 6 periods ONLY (1 to 6).
 */
export function getPeriodsForDay(day: string): number[] {
  const norm = normalizeDayOfWeek(day);
  if (norm === "الأحد" || norm === "الاثنين") {
    return [1, 2, 3, 4, 5, 6, 7];
  }
  return [1, 2, 3, 4, 5, 6];
}

/**
 * Returns the maximum number of periods for a day.
 * Sunday & Monday: 7
 * Tuesday, Wednesday, Thursday: 6
 */
export function getMaxPeriodsForDay(day: string): number {
  const norm = normalizeDayOfWeek(day);
  if (norm === "الأحد" || norm === "الاثنين") {
    return 7;
  }
  return 6;
}

/**
 * Verifies if a given period is legally allowed on that day.
 */
export function isPeriodValidForDay(day: string, period: number): boolean {
  const max = getMaxPeriodsForDay(day);
  return period >= 1 && period <= max;
}

/**
 * Standard sequential schedule columns distribution for ministerial & school timetables:
 * Sunday: 7 periods (offsets 0..6)
 * Monday: 7 periods (offsets 7..13)
 * Tuesday: 6 periods (offsets 14..19)
 * Wednesday: 6 periods (offsets 20..25)
 * Thursday: 6 periods (offsets 26..31)
 * Total: 32 periods across the week.
 */
export const STANDARD_WEEK_SCHEDULE_SLOTS: { day: string; period: number }[] = [
  // الأحد: 7 حصص
  { day: "الأحد", period: 1 },
  { day: "الأحد", period: 2 },
  { day: "الأحد", period: 3 },
  { day: "الأحد", period: 4 },
  { day: "الأحد", period: 5 },
  { day: "الأحد", period: 6 },
  { day: "الأحد", period: 7 },
  // الاثنين: 7 حصص
  { day: "الاثنين", period: 1 },
  { day: "الاثنين", period: 2 },
  { day: "الاثنين", period: 3 },
  { day: "الاثنين", period: 4 },
  { day: "الاثنين", period: 5 },
  { day: "الاثنين", period: 6 },
  { day: "الاثنين", period: 7 },
  // الثلاثاء: 6 حصص فقط! (لا توجد حصة سابعة)
  { day: "الثلاثاء", period: 1 },
  { day: "الثلاثاء", period: 2 },
  { day: "الثلاثاء", period: 3 },
  { day: "الثلاثاء", period: 4 },
  { day: "الثلاثاء", period: 5 },
  { day: "الثلاثاء", period: 6 },
  // الأربعاء: 6 حصص فقط! (لا توجد حصة سابعة)
  { day: "الأربعاء", period: 1 },
  { day: "الأربعاء", period: 2 },
  { day: "الأربعاء", period: 3 },
  { day: "الأربعاء", period: 4 },
  { day: "الأربعاء", period: 5 },
  { day: "الأربعاء", period: 6 },
  // الخميس: 6 حصص فقط! (لا توجد حصة سابعة)
  { day: "الخميس", period: 1 },
  { day: "الخميس", period: 2 },
  { day: "الخميس", period: 3 },
  { day: "الخميس", period: 4 },
  { day: "الخميس", period: 5 },
  { day: "الخميس", period: 6 },
];

/**
 * Normalizes day name so that "الأحد", "الاحد", "الإثنين", "الاثنين", "الاربعاء", "الأربعاء", etc.
 * map accurately to the standard canonical Arabic school day names.
 */
export function normalizeDayOfWeek(day: string): string {
  if (!day) return "";
  const d = day.trim().replace(/^(يوم)\s*/i, "").replace(/[أإآٱ]/g, "ا");
  if (d.includes("احد")) return "الأحد";
  if (d.includes("اثنين")) return "الاثنين";
  if (d.includes("ثلاثاء") || d.includes("ثلوث")) return "الثلاثاء";
  if (d.includes("اربعاء")) return "الأربعاء";
  if (d.includes("خميس")) return "الخميس";
  if (d.includes("جمعة")) return "الجمعة";
  if (d.includes("سبت")) return "السبت";
  return day.trim();
}

/**
 * Returns a matrix (Day -> Period -> ScheduleAssignment | null) for a given section.
 * Enforces Sunday & Monday: 7 periods, Tuesday to Thursday: 6 periods only.
 */
export function buildWeeklyTimetableForSection(
  assignments: ScheduleAssignment[],
  section: string
): { [day: string]: { [period: number]: ScheduleAssignment | null } } {
  const matrix: { [day: string]: { [period: number]: ScheduleAssignment | null } } = {};
  
  SCHOOL_WEEK_DAYS.forEach((d) => {
    matrix[d] = {};
    const validPeriods = getPeriodsForDay(d);
    validPeriods.forEach((p) => {
      matrix[d][p] = null;
    });
  });

  const matchingAssignments = findTeachersForSection(assignments, section);

  // Place assignments that have explicit day and valid period for that day
  matchingAssignments.forEach((asg) => {
    const normDay = normalizeDayOfWeek(asg.day || "");
    const pNum = Number(asg.period);
    if (normDay && matrix[normDay] && isPeriodValidForDay(normDay, pNum)) {
      matrix[normDay][pNum] = asg;
    }
  });

  // For unplaced assignments, place them only in open valid slots
  matchingAssignments.forEach((asg) => {
    const normDay = normalizeDayOfWeek(asg.day || "");
    const pNum = Number(asg.period);
    const isAlreadyValidlyPlaced =
      normDay && isPeriodValidForDay(normDay, pNum) && matrix[normDay]?.[pNum] === asg;

    if (!isAlreadyValidlyPlaced) {
      for (const d of SCHOOL_WEEK_DAYS) {
        const validPeriods = getPeriodsForDay(d);
        for (const p of validPeriods) {
          if (!matrix[d][p]) {
            matrix[d][p] = asg;
            return;
          }
        }
      }
    }
  });

  return matrix;
}

/**
 * Returns a matrix (Day -> Period -> ScheduleAssignment | null) for a given teacher.
 * Enforces Sunday & Monday: 7 periods, Tuesday to Thursday: 6 periods only.
 */
export function buildWeeklyTimetableForTeacher(
  assignments: ScheduleAssignment[],
  teacherName: string
): { [day: string]: { [period: number]: ScheduleAssignment | null } } {
  const matrix: { [day: string]: { [period: number]: ScheduleAssignment | null } } = {};
  
  SCHOOL_WEEK_DAYS.forEach((d) => {
    matrix[d] = {};
    const validPeriods = getPeriodsForDay(d);
    validPeriods.forEach((p) => {
      matrix[d][p] = null;
    });
  });

  const cleanTeacher = normalizeArabicText(teacherName);
  const teacherAssignments = assignments.filter((asg) => {
    if (isNonAcademicDuty(asg.subject) || isNonAcademicDuty(asg.section)) return false;
    const cleanAsgTeacher = normalizeArabicText(asg.teacherName);
    return cleanAsgTeacher === cleanTeacher || cleanAsgTeacher.includes(cleanTeacher) || cleanTeacher.includes(cleanAsgTeacher);
  });

  teacherAssignments.forEach((asg) => {
    const normDay = normalizeDayOfWeek(asg.day || "");
    const pNum = Number(asg.period);
    if (normDay && matrix[normDay] && isPeriodValidForDay(normDay, pNum)) {
      matrix[normDay][pNum] = asg;
    }
  });

  teacherAssignments.forEach((asg) => {
    const normDay = normalizeDayOfWeek(asg.day || "");
    const pNum = Number(asg.period);
    const isAlreadyValidlyPlaced =
      normDay && isPeriodValidForDay(normDay, pNum) && matrix[normDay]?.[pNum] === asg;

    if (!isAlreadyValidlyPlaced) {
      for (const d of SCHOOL_WEEK_DAYS) {
        const validPeriods = getPeriodsForDay(d);
        for (const p of validPeriods) {
          if (!matrix[d][p]) {
            matrix[d][p] = asg;
            return;
          }
        }
      }
    }
  });

  return matrix;
}

/**
 * Browser helper to read a File object and parse teachers
 */
export async function parseTeachersExcelFile(
  file: File
): Promise<{ teachers: Teacher[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const teachers = parseTeachersWorkbook(arrayBuffer);
    return { teachers };
  } catch (err: any) {
    return { teachers: [], error: err.message || "فشل قراءة ملف المعلمين" };
  }
}

/**
 * Browser helper to read a File object and parse schedule matrix
 */
export async function parseScheduleExcelFile(
  file: File
): Promise<{
  assignments: ScheduleAssignment[];
  detectedTeachers?: string[];
  detectedSections?: string[];
  teacherQuotas?: Record<string, number>;
  error?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = parseScheduleWorkbook(arrayBuffer);
    return result;
  } catch (err: any) {
    return { assignments: [], error: err.message || "فشل قراءة ملف الجدول المدرسي" };
  }
}

/**
 * Find teachers assigned to a given section with fuzzy matching and digit extraction
 * Strictly ignores non-academic duties like منتظر, نشاط, انتظار, ريادة, إشراف
 */
export function findTeachersForSection(
  scheduleAssignments: ScheduleAssignment[],
  sectionInput: string
): ScheduleAssignment[] {
  if (!sectionInput) return [];
  
  return scheduleAssignments.filter((asg) => {
    if (!asg.subject || isNonAcademicDuty(asg.subject)) return false;
    if (!asg.section || isNonAcademicDuty(asg.section)) return false;
    return isSectionMatching(sectionInput, asg.section || "");
  });
}

export interface SectionTeacherRelation {
  key: string;
  teacherName: string;
  rosterName?: string;
  teacherPhone: string;
  subject: string;
  specialty: string;
  section: string;
  periodsCount: number;
  scheduleDetails: { day: string; period: number }[];
  isMatchedInRoster: boolean;
  teacherId?: string;
}

/**
 * Intelligent extraction of teachers and their subjects for a specific section (e.g. "شعبة 3", "3", "1/3")
 * Groups and deduplicates assignments while preserving timetable periods count and scheduling details
 */
export function getTeachersAndSubjectsForSection(
  scheduleAssignments: ScheduleAssignment[],
  sectionInput: string,
  teachersRoster: Teacher[] = []
): SectionTeacherRelation[] {
  if (!sectionInput) return [];

  const matchingAssignments = findTeachersForSection(scheduleAssignments, sectionInput);
  const relationMap = new Map<string, SectionTeacherRelation>();

  matchingAssignments.forEach((asg) => {
    const teacherName = asg.teacherName.trim();
    const rosterTeacher = matchTeacherInRoster(teacherName, teachersRoster);
    const teacherSpecialty = rosterTeacher?.subjectSpecialty || rosterTeacher?.specialty || "";
    
    // Use actual subject from schedule if present, otherwise teacher's registered specialty from roster
    const subject = (asg.subject && asg.subject.trim() !== "المادة المقررة") 
      ? asg.subject.trim() 
      : (teacherSpecialty || "");

    const section = asg.section?.trim() || sectionInput;
    const mapKey = `${teacherName}_${subject || "default"}_${section}`;

    if (!relationMap.has(mapKey)) {
      const phone = rosterTeacher?.phone || asg.teacherPhone || "";
      const specialty = teacherSpecialty || subject;

      relationMap.set(mapKey, {
        key: mapKey,
        teacherName: teacherName,
        rosterName: rosterTeacher?.name,
        teacherPhone: phone,
        subject: subject || specialty,
        specialty: specialty,
        section: section,
        periodsCount: 0,
        scheduleDetails: [],
        isMatchedInRoster: !!rosterTeacher,
        teacherId: rosterTeacher?.id || asg.teacherId,
      });
    }

    const rel = relationMap.get(mapKey)!;
    rel.periodsCount += 1;
    if (asg.day && asg.period) {
      rel.scheduleDetails.push({ day: asg.day, period: Number(asg.period) });
    }
  });

  return Array.from(relationMap.values());
}

/**
 * Find all schedule assignments for a specific student based on their class/section
 */
export function findAssignmentsForStudent(
  scheduleAssignments: ScheduleAssignment[],
  studentSection: string
): ScheduleAssignment[] {
  return findTeachersForSection(scheduleAssignments, studentSection);
}

export interface IntegratedTeacherRecord {
  id: string;
  name: string; // The official display name
  rosterName?: string; // Original name in teachers roster
  scheduleName?: string; // Original name in schedule timetable
  specialty: string; // Teacher's specialty / subject field (مجال التدريس / التخصص من كشف المعلمين)
  phone: string; // Mobile phone number (رقم الجوال من كشف المعلمين)
  nationalId?: string;
  isRegisteredInRoster: boolean; // True if found in teachers roster
  hasScheduleAssignments: boolean; // True if assigned classes in schedule timetable
  assignedSubjects: string[]; // List of courses/subjects taught in schedule
  assignedSections: string[]; // List of sections taught in schedule
  totalPeriodsCount: number; // Weekly periods quota (إجمالي نصاب الحصص الأسبوعي)
  subjectBreakdown: {
    subject: string;
    sections: string[];
    periodsCount: number;
  }[];
  subjectPeriodCounts: Record<string, number>;
  activeDays: string[];
  assignments: ScheduleAssignment[];
}

/**
 * Synthesizes and extracts the complete integrated Teachers Registry by combining:
 * 1. Teachers Roster (كشف أسماء المعلمين): yields teacher's name, official specialty, and mobile phone.
 * 2. Weekly Schedule Timetable (جدول الحصص الأسبوعي وتوزيع المواد): yields courses, sections, and teaching periods.
 */
export function extractIntegratedTeachersRegistry(
  teachersRoster: Teacher[] = [],
  scheduleAssignments: ScheduleAssignment[] = []
): IntegratedTeacherRecord[] {
  // Pre-filter valid academic schedule assignments (strictly ignoring non-academic duties and quota numbers like 12/18)
  const academicAssignments = scheduleAssignments.filter(
    (a) =>
      a &&
      a.teacherName &&
      !isNonAcademicDuty(a.teacherName) &&
      !isNonAcademicDuty(a.subject) &&
      !isNonAcademicDuty(a.section) &&
      a.section !== "شعبة 12" &&
      a.section !== "شعبة 18" &&
      a.section !== "12" &&
      a.section !== "18" &&
      !a.id?.includes("_34_")
  );

  // Group assignments by matched teacher in roster or by raw schedule teacher name
  const rosterAssignmentsMap = new Map<string, ScheduleAssignment[]>();
  const unmatchedScheduleAssignmentsMap = new Map<string, { rawName: string; assignments: ScheduleAssignment[] }>();

  for (const asg of academicAssignments) {
    const rawName = asg.teacherName.trim();
    if (!rawName) continue;

    const matchedRosterTeacher = matchTeacherInRoster(rawName, teachersRoster);

    if (matchedRosterTeacher) {
      const key = matchedRosterTeacher.id || matchedRosterTeacher.name;
      if (!rosterAssignmentsMap.has(key)) {
        rosterAssignmentsMap.set(key, []);
      }
      rosterAssignmentsMap.get(key)!.push(asg);
    } else {
      const normRaw = normalizeArabicText(rawName);
      if (!unmatchedScheduleAssignmentsMap.has(normRaw)) {
        unmatchedScheduleAssignmentsMap.set(normRaw, { rawName, assignments: [] });
      }
      unmatchedScheduleAssignmentsMap.get(normRaw)!.assignments.push(asg);
    }
  }

  const result: IntegratedTeacherRecord[] = [];
  const DAYS_ORDER = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

  // 1. Process all registered teachers from Teachers Roster (كشف المعلمين)
  for (const t of teachersRoster) {
    const key = t.id || t.name;
    const tAssignments = rosterAssignmentsMap.get(key) || [];

    // Group subjects and sections
    const subjectsMap = new Map<string, { sections: Set<string>; count: number }>();
    const sectionsSet = new Set<string>();
    const activeDaysSet = new Set<string>();

    for (const a of tAssignments) {
      const subj = (a.subject && a.subject.trim() !== "المادة المقررة" ? a.subject.trim() : "") ||
                   (t.subjectSpecialty || t.specialty || t.subject || "عام");
      const sec = a.section?.trim() || "";

      if (sec) sectionsSet.add(sec);
      if (a.day) activeDaysSet.add(normalizeDayOfWeek(a.day) || a.day);

      if (!subjectsMap.has(subj)) {
        subjectsMap.set(subj, { sections: new Set(), count: 0 });
      }
      const entry = subjectsMap.get(subj)!;
      entry.count += 1;
      if (sec) entry.sections.add(sec);
    }

    const assignedSubjects = Array.from(subjectsMap.keys());
    const assignedSections = Array.from(sectionsSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.replace(/\D/g, "") || "0", 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b, "ar");
    });

    const subjectBreakdown = Array.from(subjectsMap.entries()).map(([subj, data]) => ({
      subject: subj,
      sections: Array.from(data.sections),
      periodsCount: data.count,
    }));

    const subjectPeriodCounts: Record<string, number> = {};
    for (const [subj, data] of subjectsMap.entries()) {
      subjectPeriodCounts[subj] = data.count;
    }

    const activeDays = DAYS_ORDER.filter((d) => activeDaysSet.has(d));

    const officialSpecialty = t.subjectSpecialty || t.specialty || t.subject || (assignedSubjects[0] || "عام");

    result.push({
      id: t.id || `tch_${normalizeArabicText(t.name)}`,
      name: t.name,
      rosterName: t.name,
      scheduleName: tAssignments[0]?.teacherName,
      specialty: officialSpecialty,
      phone: t.phone || "",
      nationalId: t.nationalId,
      isRegisteredInRoster: true,
      hasScheduleAssignments: tAssignments.length > 0,
      assignedSubjects,
      assignedSections,
      totalPeriodsCount: tAssignments.length,
      subjectBreakdown,
      subjectPeriodCounts,
      activeDays,
      assignments: tAssignments,
    });
  }

  // 2. Process any teachers found in Schedule who were not in the Teachers Roster
  for (const [normKey, data] of unmatchedScheduleAssignmentsMap.entries()) {
    const tAssignments = data.assignments;
    const subjectsMap = new Map<string, { sections: Set<string>; count: number }>();
    const sectionsSet = new Set<string>();
    const activeDaysSet = new Set<string>();

    for (const a of tAssignments) {
      const subj = (a.subject && a.subject.trim() !== "المادة المقررة" ? a.subject.trim() : "") || "عام";
      const sec = a.section?.trim() || "";

      if (sec) sectionsSet.add(sec);
      if (a.day) activeDaysSet.add(normalizeDayOfWeek(a.day) || a.day);

      if (!subjectsMap.has(subj)) {
        subjectsMap.set(subj, { sections: new Set(), count: 0 });
      }
      const entry = subjectsMap.get(subj)!;
      entry.count += 1;
      if (sec) entry.sections.add(sec);
    }

    const assignedSubjects = Array.from(subjectsMap.keys());
    const assignedSections = Array.from(sectionsSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, "") || "0", 10);
      const numB = parseInt(b.replace(/\D/g, "") || "0", 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b, "ar");
    });

    const subjectBreakdown = Array.from(subjectsMap.entries()).map(([subj, entryData]) => ({
      subject: subj,
      sections: Array.from(entryData.sections),
      periodsCount: entryData.count,
    }));

    const subjectPeriodCounts: Record<string, number> = {};
    for (const [subj, entryData] of subjectsMap.entries()) {
      subjectPeriodCounts[subj] = entryData.count;
    }

    const activeDays = DAYS_ORDER.filter((d) => activeDaysSet.has(d));

    result.push({
      id: `sched_${normKey}`,
      name: data.rawName,
      scheduleName: data.rawName,
      specialty: assignedSubjects[0] || "غير محدد بالكشف",
      phone: "",
      isRegisteredInRoster: false,
      hasScheduleAssignments: true,
      assignedSubjects,
      assignedSections,
      totalPeriodsCount: tAssignments.length,
      subjectBreakdown,
      subjectPeriodCounts,
      activeDays,
      assignments: tAssignments,
    });
  }

  return result;
}

