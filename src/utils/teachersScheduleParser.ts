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
  const normalized = str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  const matches = normalized.match(/\d+/g);
  return matches || [];
}

/**
 * Normalize section names to easily match between students and timetable
 * e.g. "شعبة 5", "5", "فصل 5", "شعبة 5/علمي", "5/أ", "الصف الأول / 1" -> standardized
 */
export function normalizeSectionName(sectionInput: string): string {
  if (!sectionInput) return "";
  let str = sectionInput
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim()
    .toLowerCase();
  
  // Remove unnecessary prefixes
  str = str.replace(/^(شعبة|فصل|صف|الصف)\s*/i, "").trim();
  return str;
}

/**
 * Checks if a student section matches a schedule assignment section
 */
export function isSectionMatching(studentSec: string, schedSec: string): boolean {
  if (!studentSec || !schedSec) return false;

  const sNorm = normalizeSectionName(studentSec);
  const scNorm = normalizeSectionName(schedSec);

  if (sNorm === scNorm) return true;
  if (sNorm.includes(scNorm) || scNorm.includes(sNorm)) return true;

  // Extract digits (e.g., student in "شعبة 5" or "2/5" and schedule in "شعبة 5")
  const sDigits = extractSectionDigits(studentSec);
  const scDigits = extractSectionDigits(schedSec);

  if (sDigits.length > 0 && scDigits.length > 0) {
    // If exact single digit match
    if (sDigits.some((d) => scDigits.includes(d))) return true;
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
 */
export function isNonAcademicDuty(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  if (!clean || clean === "#" || clean === "-" || clean === "_" || clean === "." || /^\d+$/.test(clean)) {
    return true;
  }
  return /^(منتظر|انتظار|نشاط|ريادة|اشراف|إشراف|احتياط|فراغ|شاغر|حصة فراغ|طابور|استراحة|فسحة)(\s*\d+)?$/i.test(clean) ||
         /(منتظر\s*\d+|انتظار\s*\d+|حصة\s*نشاط|نشاط\s*مدرسي|إشراف\s*يومي)/i.test(clean);
}

/**
 * Clean & Extract Subject and Section from a schedule cell text with extreme precision
 */
export function extractSubjectAndSectionFromCell(cellText: string): { subject: string; section: string } {
  if (!cellText) return { subject: "", section: "" };
  let clean = cellText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  
  // Ignore purely numbers, administrative duty codes, or blank placeholders (e.g. منتظر, منتظر 1, انتظار, نشاط, ريادة)
  if (isNonAcademicDuty(clean)) {
    return { subject: "", section: "" };
  }

  let lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

  // Filter out any non-academic lines (e.g. if one line says "منتظر 1")
  lines = lines.filter((l) => !isNonAcademicDuty(l));
  if (lines.length === 0) {
    return { subject: "", section: "" };
  }

  // Common Saudi High School subjects patterns for validation
  const subjectPatterns = /(فيزياء|كيمياء|احياء|أحياء|رياضيات|حاسب|تقنية رقمية|كفايات|لغتي|لغة عربية|انجليزي|إنجليزي|علم الأرض|علوم الأرض|تاريخ|جغرافيا|دراسات|اجتماعيات|قرآن|قران|تفسير|توحيد|فقه|حديث|تربية بدنية|بدنية|صحية|تفكير ناقد|مهارات حياتية|فنون|علم بيئة|إدارة|تسويق|هندسة|ذكاء اصطناعي|بيانات)/i;

  let section = "";
  let subject = "";

  if (lines.length >= 2) {
    const l0 = lines[0];
    const l1 = lines.slice(1).join(" ");

    const l0HasSec = /شعبة|فصل|صف/i.test(l0) || /^\d+$/.test(l0);
    const l1HasSubj = subjectPatterns.test(l1);
    const l1HasSec = /شعبة|فصل|صف/i.test(l1) || /^\d+$/.test(l1);
    const l0HasSubj = subjectPatterns.test(l0);

    if (l0HasSec && !l0HasSubj) {
      section = l0;
      subject = l1;
    } else if (l1HasSec && !l1HasSubj) {
      subject = l0;
      section = l1;
    } else if (l0HasSubj && !l1HasSubj) {
      subject = l0;
      section = l1;
    } else {
      section = l0;
      subject = l1;
    }
  } else {
    // Single line text: e.g. "شعبة 5 - الفيزياء 2" or "الفيزياء 2 (شعبة 5)" or "كيمياء 1 / ش 2"
    const single = lines[0] || clean;
    const matchedSec = single.match(/(شعبة\s*\d+|فصل\s*\d+|ش\s*\d+|\(\s*شعبة\s*\d+\s*\))/i);
    if (matchedSec) {
      section = matchedSec[0].replace(/[\(\)]/g, "").trim();
      subject = single.replace(matchedSec[0], "").replace(/^[\-\:\/\–\s]+|[\-\:\/\–\s]+$/g, "").trim();
    } else {
      // Look for digit at the end or start
      const trailingDigitSec = single.match(/\b\d+\b/);
      if (trailingDigitSec && subjectPatterns.test(single)) {
        // e.g. "الفيزياء 2 شعبة 5" or "أحياء 1 فصل 2"
        const secRegex = /(?:شعبة|فصل|صف)?\s*(\d+)$/;
        const match = single.match(secRegex);
        if (match) {
          section = `شعبة ${match[1]}`;
          subject = single.replace(secRegex, "").trim();
        } else {
          subject = single;
        }
      } else {
        subject = single;
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

  // Final check: If subject is non-academic or section itself is non-academic
  if (isNonAcademicDuty(subject)) {
    subject = "";
  }
  if (isNonAcademicDuty(section)) {
    section = "";
  }

  return { subject, section };
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
  let startRowIdx = -1;

  for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
    const row = rawMatrix[r];
    for (let c = 0; c < Math.min(10, row.length); c++) {
      const val = String(row[c] || "").trim();
      if (val === "المعلم" || val === "اسم المعلم" || val === "الأستاذ") {
        teacherColIdx = c;
        startRowIdx = r + 1;
        break;
      }
    }
    if (teacherColIdx !== -1) break;
  }

  // If "المعلم" header was not explicitly written, inspect column containing teacher names from existing teachers
  if (teacherColIdx === -1) {
    teacherColIdx = 1; // Default col B in Image 2
    startRowIdx = 3;
  }

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
      /^(المعلم|مدرسة|الفصول|المجموع|الحصص|الإجمالي|#|م)$/i.test(teacherName) ||
      !isNaN(Number(teacherName))
    ) {
      continue;
    }

    detectedTeachersSet.add(teacherName);

    // Scan all schedule cells in this teacher's row
    for (let c = 0; c < row.length; c++) {
      if (c === teacherColIdx) continue;
      const cellVal = String(row[c] || "").trim();
      if (!cellVal) continue;

      const { subject, section } = extractSubjectAndSectionFromCell(cellVal);

      if (section) {
        detectedSectionsSet.add(section);
      }

      if (subject || section) {
        // Avoid adding duplicate identical (teacher, subject, section) multiple times per week
        const exists = assignments.some(
          (a) => a.teacherName === teacherName && a.subject === (subject || "المادة المقررة") && a.section === (section || "عام")
        );

        if (!exists) {
          assignments.push({
            id: `asg_${r}_${c}_${Math.random().toString(36).substring(2, 6)}`,
            teacherName,
            subject: subject || "المادة المقررة",
            section: section || "عام",
          });
        }
      }
    }
  }

  return {
    assignments,
    detectedTeachers: Array.from(detectedTeachersSet),
    detectedSections: Array.from(detectedSectionsSet),
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
  { id: "sch_1", teacherName: "احمد عايض عبدالله القحطاني", subject: "الفيزياء 2", section: "شعبة 5" },
  { id: "sch_2", teacherName: "احمد عايض عبدالله القحطاني", subject: "الفيزياء 2", section: "شعبة 4" },
  { id: "sch_3", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 1" },
  { id: "sch_4", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 2" },
  { id: "sch_5", teacherName: "انس عيد مطير العمراني", subject: "الكفايات اللغوية 1", section: "شعبة 3" },
  { id: "sch_6", teacherName: "جاسر ناجي سعيد الجهني", subject: "الكفايات اللغوية 2", section: "شعبة 4" },
  { id: "sch_7", teacherName: "جاسر ناجي سعيد الجهني", subject: "الكفايات اللغوية 2", section: "شعبة 5" },
  { id: "sch_8", teacherName: "جاسر ناجي سعيد الجهني", subject: "البحث ومصادر المعلومات", section: "شعبة 6" },
  { id: "sch_9", teacherName: "صالح أحمد عيد الحويطي", subject: "التربية الصحية والبدنية 3", section: "شعبة 7" },
  { id: "sch_10", teacherName: "صالح أحمد عيد الحويطي", subject: "التربية الصحية والبدنية 3", section: "شعبة 8" },
  { id: "sch_11", teacherName: "صالح محمد صالح الحسيني", subject: "الفيزياء 3", section: "شعبة 7" },
  { id: "sch_12", teacherName: "صالح محمد صالح الحسيني", subject: "الفيزياء 3", section: "شعبة 6" },
  { id: "sch_13", teacherName: "طارق ضاوي عويض العتيبي", subject: "التقنية الرقمية 3", section: "شعبة 8" },
  { id: "sch_14", teacherName: "طارق ضاوي عويض العتيبي", subject: "التقنية الرقمية 3", section: "شعبة 7" },
  { id: "sch_15", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 1", section: "شعبة 1" },
  { id: "sch_16", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 1", section: "شعبة 2" },
  { id: "sch_17", teacherName: "عادل عبدي دعسان العنزي", subject: "الكيمياء 3", section: "شعبة 8" },
  { id: "sch_18", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 4" },
  { id: "sch_19", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 5" },
  { id: "sch_20", teacherName: "عبدالرحمن هلال عابد المطيري", subject: "اللغة الإنجليزية 2", section: "شعبة 6" },
  { id: "sch_21", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 1" },
  { id: "sch_22", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 2" },
  { id: "sch_23", teacherName: "عبدالعزيز محمد علي كعبي", subject: "التقنية الرقمية 1", section: "شعبة 3" },
  { id: "sch_24", teacherName: "فهد عقيل محمد العطوي", subject: "علوم الأرض والفضاء 3", section: "شعبة 8" },
  { id: "sch_25", teacherName: "فهد عقيل محمد العطوي", subject: "علوم الأرض والفضاء 3", section: "شعبة 7" },
  { id: "sch_26", teacherName: "محمد صالح مفرح العمري", subject: "الأحياء 1", section: "شعبة 3" },
  { id: "sch_27", teacherName: "محمد صالح مفرح العمري", subject: "الأحياء 1", section: "شعبة 2" },
  { id: "sch_28", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 1" },
  { id: "sch_29", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 2" },
  { id: "sch_30", teacherName: "فيصل مطلق هويمل العطوي", subject: "القرآن الكريم وتفسيره", section: "شعبة 3" },
];

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

/**
 * Find all schedule assignments for a specific student based on their class/section
 */
export function findAssignmentsForStudent(
  scheduleAssignments: ScheduleAssignment[],
  studentSection: string
): ScheduleAssignment[] {
  return findTeachersForSection(scheduleAssignments, studentSection);
}
