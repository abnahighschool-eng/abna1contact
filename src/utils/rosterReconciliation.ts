import { Student, Teacher } from "../types";

/**
 * Normalizes Arabic text for high-accuracy phonetic and semantic matching
 */
export function normalizeArabicName(text: string): string {
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
    // Normalize Hamzas
    .replace(/[\u0624\u0626]/g, "و")
    // Normalize compound prefixes and common words
    .replace(/\bعبد\s+/g, "عبد")
    .replace(/\bابو\s+/g, "ابو")
    .replace(/\bال\s+/g, "ال")
    .replace(/\b(بن|ابن|بنت)\b/g, "")
    .replace(/^(أستاذ|استاذ|الاستاذ|الأستاذ|أ\/|أ\.|د\/|د\.|دكتور|الدكتور|معلم|المعلم|الأستاذ\/|الاستاذ\/|طالب|الطالب)\s*/g, "")
    // Replace non-letters with spaces
    .replace(/[^a-zA-Z0-9\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes Phone numbers into standard Saudi format 9665XXXXXXXX or 05XXXXXXXX
 */
export function normalizePhoneNumber(phone: any): string {
  if (!phone) return "";
  let cleaned = String(phone)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^0-9]/g, "")
    .trim();

  if (cleaned.startsWith("00966")) {
    cleaned = "966" + cleaned.substring(5);
  } else if (cleaned.startsWith("966")) {
    // Already in standard international
  } else if (cleaned.startsWith("05")) {
    cleaned = "966" + cleaned.substring(1);
  } else if (cleaned.startsWith("5") && cleaned.length === 9) {
    cleaned = "966" + cleaned;
  }
  return cleaned;
}

/**
 * Normalizes National / Civil ID
 */
export function normalizeCivilId(id: any): string {
  if (!id) return "";
  return String(id)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^0-9]/g, "")
    .trim();
}

export interface ReconcileStudentsResult {
  reconciledStudents: Student[];
  stats: {
    totalCombined: number;
    activeCount: number;
    archivedPreservedCount: number;
    matchedExistingCount: number;
    newlyAddedCount: number;
    updatedInfoCount: number;
    removedJunkCount?: number;
    removedDuplicatesCount?: number;
  };
  summaryMessage: string;
}

export interface StudentImportAnalysis {
  rawRowCount: number;
  cleanedCount: number;
  junkCount: number;
  duplicateCount: number;
  matchedCount: number;
  newCount: number;
  unmatchedExistingCount: number;
  sampleMatches: Array<{
    name: string;
    existingId: string;
    phone: string;
    grade: string;
    className: string;
    matchType: "nationalId" | "exactId" | "nameAndGrade" | "phone";
  }>;
  sampleNew: Array<{
    name: string;
    phone: string;
    grade: string;
    className: string;
  }>;
  sampleUnmatchedExisting: Array<{
    name: string;
    id: string;
    phone: string;
    grade: string;
  }>;
}

/**
 * Checks if a parsed row from Excel is junk (footer signatures, totals, blank, headers)
 */
export function isJunkStudentRow(row: any, nameCol?: string): boolean {
  if (!row || typeof row !== "object") return true;

  // Extract candidate name
  let rawName = "";
  if (nameCol && row[nameCol] !== undefined && row[nameCol] !== null) {
    rawName = String(row[nameCol]).trim();
  }
  if (!rawName) {
    rawName = String(
      row["اسم الطالب"] ||
      row["الاسم"] ||
      row["name"] ||
      row["studentName"] ||
      row["الطالب"] ||
      row["اسم الطالب الثلاثي"] ||
      row["اسم الطالب الرباعي"] ||
      ""
    ).trim();
  }

  // If no name found at all, check if whole row has meaningful info
  if (!rawName) {
    const values = Object.values(row).map(v => String(v || "").trim()).filter(Boolean);
    if (values.length === 0) return true; // entirely empty
    return true; // no name is fatal for a student row
  }

  // Pure digits or symbols
  if (/^[\d\s\-_.,/\\#@!$%^&*()+=]+$/.test(rawName)) {
    return true;
  }

  // Less than 3 characters (e.g. "أ", "1", "لا")
  if (rawName.length < 3) {
    return true;
  }

  // Header, Footer, Summary, Signature keywords in Arabic / English
  const junkKeywords = [
    "المجموع", "إجمالي", "اجمالي", "مجموع", "العدد", "الكلي", "العدد الكلي",
    "مدير المدرسة", "المدير", "وكيل", "الوكيل", "المرشد", "المرشد الطلابي", "الموجه", "الموجه الطلابي",
    "معلم", "المعلم", "معلم المادة", "رائد النشاط", "أمين المصادر", "سكرتير", "الكاتب",
    "توقيع", "التوقيع", "ختم", "الختم", "يعتمد", "المشرف", "مشرف",
    "ملاحظة", "ملاحظات", "الغياب", "الحضور", "الحاضرين", "الغائبين", "النسبة", "المعدل",
    "صفحة", "الصفحة", "page", "total", "sum", "count", "average", "signature",
    "اسم الطالب", "اسم الطالبة", "رقم الهوية", "السجل المدني", "اسم ولي الأمر", "رقم الجوال", "هاتف ولي الأمر",
    "الصف الدراسي", "الفصل", "الشعبة", "المرحلة"
  ];

  const lower = rawName.toLowerCase().replace(/[\s\-_:]+/g, " ").trim();
  for (const kw of junkKeywords) {
    if (lower === kw || lower.startsWith(kw + " ") || lower.startsWith(kw + ":") || lower.endsWith(" " + kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Cleans raw rows and removes junk rows & internal duplicates within the uploaded file
 */
export function cleanAndDeduplicateStudentRows(
  rawRows: any[],
  nameCol?: string,
  phoneCol?: string,
  gradeCol?: string,
  classCol?: string
): { cleanRows: any[]; junkCount: number; duplicateCount: number } {
  if (!Array.isArray(rawRows)) return { cleanRows: [], junkCount: 0, duplicateCount: 0 };

  const cleanRows: any[] = [];
  let junkCount = 0;
  let duplicateCount = 0;

  const seenKeys = new Set<string>();

  rawRows.forEach((row, idx) => {
    if (isJunkStudentRow(row, nameCol)) {
      junkCount++;
      return;
    }

    const rawName = String(
      (nameCol && row[nameCol]) ||
      row.name ||
      row["اسم الطالب"] ||
      row["الاسم"] ||
      row.studentName ||
      ""
    ).trim();

    const rawPhone = String(
      (phoneCol && row[phoneCol]) ||
      row.phone ||
      row["رقم الجوال"] ||
      row["الجوال"] ||
      row["هاتف"] ||
      ""
    ).trim();

    const rawGrade = String(
      (gradeCol && row[gradeCol]) ||
      row.grade ||
      row["الصف"] ||
      row["المرحلة"] ||
      row["الصف الدراسي"] ||
      ""
    ).trim();

    const rawClass = String(
      (classCol && row[classCol]) ||
      row.className ||
      row["الفصل"] ||
      row["الشعبة"] ||
      row["فصل"] ||
      ""
    ).trim();

    const rawNid = normalizeCivilId(
      row.nationalId ||
      row["السجل المدني"] ||
      row["رقم الهوية"] ||
      row["الهوية"] ||
      ""
    );

    const normName = normalizeArabicName(rawName);

    // Build deduplication key inside this sheet
    let dedupeKey = "";
    if (rawNid && rawNid.length >= 8) {
      dedupeKey = `nid_${rawNid}`;
    } else if (normName) {
      dedupeKey = `name_${normName}_${rawGrade}_${rawClass}`;
    } else {
      dedupeKey = `idx_${idx}`;
    }

    if (seenKeys.has(dedupeKey)) {
      duplicateCount++;
      return; // Skip duplicate inside same sheet
    }

    seenKeys.add(dedupeKey);
    cleanRows.push(row);
  });

  return { cleanRows, junkCount, duplicateCount };
}

/**
 * Pre-analyzes incoming student rows against existing database students
 * to give the user exact figures and previews before choosing import mode.
 */
export function analyzeStudentsImport(
  existingStudents: Student[] = [],
  incomingCleanRows: any[],
  nameCol?: string,
  phoneCol?: string,
  gradeCol?: string,
  classCol?: string
): StudentImportAnalysis {
  // Build lookup indexes for existing students
  const byNationalId = new Map<string, Student>();
  const byExactId = new Map<string, Student>();
  const byNormalizedName = new Map<string, Student[]>();
  const byNormalizedPhone = new Map<string, Student[]>();

  existingStudents.forEach((std) => {
    if (std.id) byExactId.set(std.id, std);

    const nid = normalizeCivilId(std.nationalId || std["السجل المدني"] || std["رقم الهوية"] || std["الهوية"]);
    if (nid && nid.length >= 8) {
      byNationalId.set(nid, std);
    }

    const normName = normalizeArabicName(std.name || std["اسم الطالب"] || std["الاسم"] || "");
    if (normName) {
      const list = byNormalizedName.get(normName) || [];
      list.push(std);
      byNormalizedName.set(normName, list);
    }

    const normPhone = normalizePhoneNumber(std.phone || std["رقم الجوال"] || std["الجوال"] || "");
    if (normPhone && normPhone.length >= 9) {
      const list = byNormalizedPhone.get(normPhone) || [];
      list.push(std);
      byNormalizedPhone.set(normPhone, list);
    }
  });

  const matchedExistingIds = new Set<string>();
  const sampleMatches: StudentImportAnalysis["sampleMatches"] = [];
  const sampleNew: StudentImportAnalysis["sampleNew"] = [];

  let matchedCount = 0;
  let newCount = 0;

  incomingCleanRows.forEach((row) => {
    const rawName = String(
      (nameCol && row[nameCol]) ||
      row.name ||
      row["اسم الطالب"] ||
      row["الاسم"] ||
      row.studentName ||
      ""
    ).trim();

    const rawPhone = String(
      (phoneCol && row[phoneCol]) ||
      row.phone ||
      row["رقم الجوال"] ||
      row["الجوال"] ||
      row["هاتف"] ||
      ""
    ).trim();

    const rawGrade = String(
      (gradeCol && row[gradeCol]) ||
      row.grade ||
      row["الصف"] ||
      row["المرحلة"] ||
      row["الصف الدراسي"] ||
      ""
    ).trim();

    const rawClass = String(
      (classCol && row[classCol]) ||
      row.className ||
      row["الفصل"] ||
      row["الشعبة"] ||
      row["فصل"] ||
      ""
    ).trim();

    const rawNid = normalizeCivilId(
      row.nationalId ||
      row["السجل المدني"] ||
      row["رقم الهوية"] ||
      row["الهوية"] ||
      ""
    );

    const normName = normalizeArabicName(rawName);
    const normPhone = normalizePhoneNumber(rawPhone);

    let matchedStudent: Student | undefined;
    let matchType: "nationalId" | "exactId" | "nameAndGrade" | "phone" = "nameAndGrade";

    // 1. Match by National ID
    if (rawNid && byNationalId.has(rawNid)) {
      matchedStudent = byNationalId.get(rawNid);
      matchType = "nationalId";
    }

    // 2. Match by exact ID
    if (!matchedStudent && row.id && byExactId.has(row.id)) {
      matchedStudent = byExactId.get(row.id);
      matchType = "exactId";
    }

    // 3. Match by Normalized Name + Grade / Class
    if (!matchedStudent && normName) {
      const candidates = byNormalizedName.get(normName);
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          matchedStudent = candidates[0];
          matchType = "nameAndGrade";
        } else {
          matchedStudent = candidates.find((c) => {
            const cClass = String(c.className || c["الفصل"] || "").trim();
            const cGrade = String(c.grade || c["الصف"] || "").trim();
            const cPhone = normalizePhoneNumber(c.phone || c["رقم الجوال"] || "");
            if (rawClass && cClass && (rawClass === cClass || cClass.includes(rawClass))) return true;
            if (rawGrade && cGrade && (rawGrade === cGrade || cGrade.includes(rawGrade))) return true;
            if (normPhone && cPhone && normPhone === cPhone) return true;
            return false;
          }) || candidates[0];
          matchType = "nameAndGrade";
        }
      }
    }

    // 4. Match by Phone
    if (!matchedStudent && normPhone) {
      const candidates = byNormalizedPhone.get(normPhone);
      if (candidates && candidates.length === 1) {
        matchedStudent = candidates[0];
        matchType = "phone";
      }
    }

    if (matchedStudent) {
      matchedExistingIds.add(matchedStudent.id);
      matchedCount++;
      if (sampleMatches.length < 5) {
        sampleMatches.push({
          name: rawName || matchedStudent.name || "",
          existingId: matchedStudent.id,
          phone: rawPhone || matchedStudent.phone || "",
          grade: rawGrade || matchedStudent.grade || "",
          className: rawClass || matchedStudent.className || "",
          matchType,
        });
      }
    } else {
      newCount++;
      if (sampleNew.length < 5) {
        sampleNew.push({
          name: rawName,
          phone: rawPhone,
          grade: rawGrade,
          className: rawClass,
        });
      }
    }
  });

  const sampleUnmatchedExisting: StudentImportAnalysis["sampleUnmatchedExisting"] = [];
  existingStudents.forEach((std) => {
    if (!matchedExistingIds.has(std.id) && sampleUnmatchedExisting.length < 5) {
      sampleUnmatchedExisting.push({
        name: std.name || std["اسم الطالب"] || "",
        id: std.id,
        phone: std.phone || std["رقم الجوال"] || "",
        grade: std.grade || std["الصف"] || "",
      });
    }
  });

  const unmatchedExistingCount = existingStudents.length - matchedExistingIds.size;

  return {
    rawRowCount: incomingCleanRows.length,
    cleanedCount: incomingCleanRows.length,
    junkCount: 0,
    duplicateCount: 0,
    matchedCount,
    newCount,
    unmatchedExistingCount,
    sampleMatches,
    sampleNew,
    sampleUnmatchedExisting,
  };
}

/**
 * Executes either smart merge (preserving past operations without duplicate names)
 * or full replacement (discarding old roster and adopting clean new sheet).
 */
export function executeStudentsImport(
  existingStudents: Student[] = [],
  incomingCleanRows: any[],
  options: {
    mode: "smart_merge" | "full_replace";
    archiveUnmatched?: boolean;
  },
  nameCol?: string,
  phoneCol?: string,
  gradeCol?: string,
  classCol?: string
): ReconcileStudentsResult {
  // Option 2: Full Replacement Mode
  if (options.mode === "full_replace") {
    const formattedNewStudents: Student[] = incomingCleanRows.map((row, idx) => {
      const rawName = String(
        (nameCol && row[nameCol]) ||
        row.name ||
        row["اسم الطالب"] ||
        row["الاسم"] ||
        row.studentName ||
        `طالب ${idx + 1}`
      ).trim();

      const rawPhone = String(
        (phoneCol && row[phoneCol]) ||
        row.phone ||
        row["رقم الجوال"] ||
        row["الجوال"] ||
        row["هاتف"] ||
        ""
      ).trim();

      const rawGrade = String(
        (gradeCol && row[gradeCol]) ||
        row.grade ||
        row["الصف"] ||
        row["المرحلة"] ||
        row["الصف الدراسي"] ||
        ""
      ).trim();

      const rawClass = String(
        (classCol && row[classCol]) ||
        row.className ||
        row["الفصل"] ||
        row["الشعبة"] ||
        row["فصل"] ||
        ""
      ).trim();

      const rawNid = normalizeCivilId(
        row.nationalId ||
        row["السجل المدني"] ||
        row["رقم الهوية"] ||
        row["الهوية"] ||
        ""
      );

      const stableId = rawNid ? `std_nid_${rawNid}` : `std_${Date.now()}_${idx + 1}`;

      const student: Student = {
        ...row,
        id: stableId,
        name: rawName,
        phone: rawPhone,
        grade: rawGrade,
        className: rawClass,
        nationalId: rawNid || undefined,
        "اسم الطالب": rawName,
        "الاسم": rawName,
        "رقم الجوال": rawPhone,
        "الجوال": rawPhone,
        "الصف": rawGrade,
        "الفصل": rawClass,
        isArchived: false,
        status: "active",
        createdAt: new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
      };

      return student;
    });

    const summaryMessage = `تم استبدال الكشف بالكامل بنجاح: تم اعتماد ${formattedNewStudents.length} طالباً جديداً ونظيفاً دون أي تكرار مع حذف الكشوف السابقة.`;

    return {
      reconciledStudents: formattedNewStudents,
      stats: {
        totalCombined: formattedNewStudents.length,
        activeCount: formattedNewStudents.length,
        archivedPreservedCount: 0,
        matchedExistingCount: 0,
        newlyAddedCount: formattedNewStudents.length,
        updatedInfoCount: 0,
      },
      summaryMessage,
    };
  }

  // Option 1: Smart Merge Mode (Preserve IDs, keep all operations without duplicate names)
  const byNationalId = new Map<string, Student>();
  const byExactId = new Map<string, Student>();
  const byNormalizedName = new Map<string, Student[]>();
  const byNormalizedPhone = new Map<string, Student[]>();

  existingStudents.forEach((std) => {
    if (std.id) byExactId.set(std.id, std);

    const nid = normalizeCivilId(std.nationalId || std["السجل المدني"] || std["رقم الهوية"] || std["الهوية"]);
    if (nid && nid.length >= 8) {
      byNationalId.set(nid, std);
    }

    const normName = normalizeArabicName(std.name || std["اسم الطالب"] || std["الاسم"] || "");
    if (normName) {
      const list = byNormalizedName.get(normName) || [];
      list.push(std);
      byNormalizedName.set(normName, list);
    }

    const normPhone = normalizePhoneNumber(std.phone || std["رقم الجوال"] || std["الجوال"] || "");
    if (normPhone && normPhone.length >= 9) {
      const list = byNormalizedPhone.get(normPhone) || [];
      list.push(std);
      byNormalizedPhone.set(normPhone, list);
    }
  });

  const matchedExistingIds = new Set<string>();
  const reconciledActiveList: Student[] = [];
  let matchedCount = 0;
  let newlyAddedCount = 0;
  let updatedInfoCount = 0;

  incomingCleanRows.forEach((row, idx) => {
    const rawName = String(
      (nameCol && row[nameCol]) ||
      row.name ||
      row["اسم الطالب"] ||
      row["الاسم"] ||
      row.studentName ||
      ""
    ).trim();

    const rawPhone = String(
      (phoneCol && row[phoneCol]) ||
      row.phone ||
      row["رقم الجوال"] ||
      row["الجوال"] ||
      row["هاتف"] ||
      ""
    ).trim();

    const rawGrade = String(
      (gradeCol && row[gradeCol]) ||
      row.grade ||
      row["الصف"] ||
      row["المرحلة"] ||
      row["الصف الدراسي"] ||
      ""
    ).trim();

    const rawClass = String(
      (classCol && row[classCol]) ||
      row.className ||
      row["الفصل"] ||
      row["الشعبة"] ||
      row["فصل"] ||
      ""
    ).trim();

    const rawNid = normalizeCivilId(
      row.nationalId ||
      row["السجل المدني"] ||
      row["رقم الهوية"] ||
      row["الهوية"] ||
      ""
    );

    const normName = normalizeArabicName(rawName);
    const normPhone = normalizePhoneNumber(rawPhone);

    let matchedStudent: Student | undefined;

    // 1. Match by National ID
    if (rawNid && byNationalId.has(rawNid)) {
      matchedStudent = byNationalId.get(rawNid);
    }

    // 2. Match by existing ID
    if (!matchedStudent && row.id && byExactId.has(row.id)) {
      matchedStudent = byExactId.get(row.id);
    }

    // 3. Match by Normalized Name + Grade / Class
    if (!matchedStudent && normName) {
      const candidates = byNormalizedName.get(normName);
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          matchedStudent = candidates[0];
        } else {
          matchedStudent = candidates.find((c) => {
            const cClass = String(c.className || c["الفصل"] || "").trim();
            const cGrade = String(c.grade || c["الصف"] || "").trim();
            const cPhone = normalizePhoneNumber(c.phone || c["رقم الجوال"] || "");
            if (rawClass && cClass && (rawClass === cClass || cClass.includes(rawClass))) return true;
            if (rawGrade && cGrade && (rawGrade === cGrade || cGrade.includes(rawGrade))) return true;
            if (normPhone && cPhone && normPhone === cPhone) return true;
            return false;
          }) || candidates[0];
        }
      }
    }

    // 4. Match by Phone
    if (!matchedStudent && normPhone) {
      const candidates = byNormalizedPhone.get(normPhone);
      if (candidates && candidates.length === 1) {
        matchedStudent = candidates[0];
      }
    }

    if (matchedStudent) {
      // PRESERVE PERSISTENT ID - KEEPS ALL ATTENDANCE, WHATSAPP LOGS, HEALTH FILES INTACT
      matchedExistingIds.add(matchedStudent.id);
      matchedCount++;

      let hasUpdates = false;
      if (rawPhone && rawPhone !== matchedStudent.phone) hasUpdates = true;
      if (rawGrade && rawGrade !== matchedStudent.grade) hasUpdates = true;
      if (rawClass && rawClass !== matchedStudent.className) hasUpdates = true;
      if (hasUpdates) updatedInfoCount++;

      const mergedStudent: Student = {
        ...matchedStudent,
        ...row,
        id: matchedStudent.id, // Strictly preserve original ID!
        name: rawName || matchedStudent.name || "",
        phone: rawPhone || matchedStudent.phone || "",
        grade: rawGrade || matchedStudent.grade || "",
        className: rawClass || matchedStudent.className || "",
        nationalId: rawNid || matchedStudent.nationalId || "",
        "اسم الطالب": rawName || matchedStudent.name || "",
        "الاسم": rawName || matchedStudent.name || "",
        "رقم الجوال": rawPhone || matchedStudent.phone || "",
        "الجوال": rawPhone || matchedStudent.phone || "",
        "الصف": rawGrade || matchedStudent.grade || "",
        "الفصل": rawClass || matchedStudent.className || "",
        isArchived: false,
        status: "active",
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveList.push(mergedStudent);
    } else {
      // Newly joined student - assign collision-free stable ID
      newlyAddedCount++;
      const stableId = rawNid 
        ? `std_nid_${rawNid}` 
        : `std_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;

      const newStudent: Student = {
        ...row,
        id: stableId,
        name: rawName || `طالب ${idx + 1}`,
        phone: rawPhone,
        grade: rawGrade,
        className: rawClass,
        nationalId: rawNid || undefined,
        "اسم الطالب": rawName || `طالب ${idx + 1}`,
        "الاسم": rawName || `طالب ${idx + 1}`,
        "رقم الجوال": rawPhone,
        "الجوال": rawPhone,
        "الصف": rawGrade,
        "الفصل": rawClass,
        isArchived: false,
        status: "active",
        createdAt: new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveList.push(newStudent);
    }
  });

  // Handle existing students not in incoming sheet (Transferred / from other classes)
  const preservedArchivedList: Student[] = [];
  const shouldArchiveUnmatched = options.archiveUnmatched !== false;

  existingStudents.forEach((existingStd) => {
    if (!matchedExistingIds.has(existingStd.id)) {
      if (shouldArchiveUnmatched) {
        preservedArchivedList.push({
          ...existingStd,
          isArchived: true,
          archivedReason: "غير مدرج في أحدث كشف مستورد - محفوظ بكافة عملياته وسجلاته",
          lastSeenInRoster: existingStd.lastSeenInRoster || new Date().toISOString(),
        });
      } else {
        // Keep active if requested
        reconciledActiveList.push(existingStd);
      }
    }
  });

  const allReconciled = [...reconciledActiveList, ...preservedArchivedList];

  const summaryMessage = `تمت المطابقة الذكية بنجاح: تم الحفاظ على هويات وسجلات ${matchedCount} طالباً مطابقاً (مع كامل عمليات الغياب والرسائل السابقة دون تكرار)، وإضافة ${newlyAddedCount} طالباً جديداً للمدرسة، وحفظ ${preservedArchivedList.length} طالباً سابقاً في الأرشيف الآمن.`;

  return {
    reconciledStudents: allReconciled,
    stats: {
      totalCombined: allReconciled.length,
      activeCount: reconciledActiveList.length,
      archivedPreservedCount: preservedArchivedList.length,
      matchedExistingCount: matchedCount,
      newlyAddedCount,
      updatedInfoCount,
    },
    summaryMessage,
  };
}

/**
 * Reconciles incoming students against existing database records:
 * 1. Matches new records with existing students to preserve persistent IDs and historical operations.
 * 2. Retains removed students ("الكشوف المزالة") safely in the archive so no attendance, logs, or health cases are lost.
 * 3. Integrates newly added students with unique permanent IDs.
 */
export function reconcileStudentsRoster(
  existingStudents: Student[] = [],
  incomingRawList: any[] = []
): ReconcileStudentsResult {
  if (!Array.isArray(incomingRawList) || incomingRawList.length === 0) {
    return {
      reconciledStudents: existingStudents,
      stats: {
        totalCombined: existingStudents.length,
        activeCount: existingStudents.filter((s) => !s.isArchived).length,
        archivedPreservedCount: existingStudents.filter((s) => s.isArchived).length,
        matchedExistingCount: 0,
        newlyAddedCount: 0,
        updatedInfoCount: 0,
      },
      summaryMessage: "لم يتم تقديم كشف جديد للمطابقة.",
    };
  }

  // 1. Build fast-lookup indexes for existing students
  const byNationalId = new Map<string, Student>();
  const byExactId = new Map<string, Student>();
  const byNormalizedName = new Map<string, Student[]>();
  const byNormalizedPhone = new Map<string, Student[]>();

  existingStudents.forEach((std) => {
    if (std.id) byExactId.set(std.id, std);

    const nid = normalizeCivilId(std.nationalId || std["السجل المدني"] || std["رقم الهوية"] || std["الهوية"]);
    if (nid && nid.length >= 8) {
      byNationalId.set(nid, std);
    }

    const normName = normalizeArabicName(std.name || std["اسم الطالب"] || std["الاسم"] || "");
    if (normName) {
      const list = byNormalizedName.get(normName) || [];
      list.push(std);
      byNormalizedName.set(normName, list);
    }

    const normPhone = normalizePhoneNumber(std.phone || std["رقم الجوال"] || std["الجوال"] || "");
    if (normPhone && normPhone.length >= 9) {
      const list = byNormalizedPhone.get(normPhone) || [];
      list.push(std);
      byNormalizedPhone.set(normPhone, list);
    }
  });

  const matchedExistingIds = new Set<string>();
  const reconciledActiveList: Student[] = [];
  let matchedCount = 0;
  let newlyAddedCount = 0;
  let updatedInfoCount = 0;

  // 2. Process each incoming student row
  incomingRawList.forEach((incomingRow, idx) => {
    const rawName = String(
      incomingRow.name ||
      incomingRow["اسم الطالب"] ||
      incomingRow["الاسم"] ||
      incomingRow.studentName ||
      ""
    ).trim();

    const rawPhone = String(
      incomingRow.phone ||
      incomingRow["رقم الجوال"] ||
      incomingRow["الجوال"] ||
      incomingRow["هاتف"] ||
      ""
    ).trim();

    const rawGrade = String(
      incomingRow.grade ||
      incomingRow["الصف"] ||
      incomingRow["المرحلة"] ||
      incomingRow["الصف الدراسي"] ||
      ""
    ).trim();

    const rawClass = String(
      incomingRow.className ||
      incomingRow["الفصل"] ||
      incomingRow["الشعبة"] ||
      incomingRow["فصل"] ||
      ""
    ).trim();

    const rawNid = normalizeCivilId(
      incomingRow.nationalId ||
      incomingRow["السجل المدني"] ||
      incomingRow["رقم الهوية"] ||
      incomingRow["الهوية"] ||
      ""
    );

    const normName = normalizeArabicName(rawName);
    const normPhone = normalizePhoneNumber(rawPhone);

    // Multi-Tier Matching Strategy
    let matchedStudent: Student | undefined;

    // Level 1: Match by National / Civil ID if available
    if (rawNid && byNationalId.has(rawNid)) {
      matchedStudent = byNationalId.get(rawNid);
    }

    // Level 2: Match by existing ID if explicitly preserved
    if (!matchedStudent && incomingRow.id && byExactId.has(incomingRow.id)) {
      matchedStudent = byExactId.get(incomingRow.id);
    }

    // Level 3: Match by Name + Grade / Class
    if (!matchedStudent && normName) {
      const candidates = byNormalizedName.get(normName);
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          matchedStudent = candidates[0];
        } else {
          // Disambiguate by Class or Grade or Phone
          matchedStudent = candidates.find((c) => {
            const cClass = String(c.className || c["الفصل"] || "").trim();
            const cGrade = String(c.grade || c["الصف"] || "").trim();
            const cPhone = normalizePhoneNumber(c.phone || c["رقم الجوال"] || "");
            if (rawClass && cClass && (rawClass === cClass || cClass.includes(rawClass))) return true;
            if (rawGrade && cGrade && (rawGrade === cGrade || cGrade.includes(rawGrade))) return true;
            if (normPhone && cPhone && normPhone === cPhone) return true;
            return false;
          }) || candidates[0];
        }
      }
    }

    // Level 4: Match by Phone number alone if only 1 student has that phone
    if (!matchedStudent && normPhone) {
      const candidates = byNormalizedPhone.get(normPhone);
      if (candidates && candidates.length === 1) {
        matchedStudent = candidates[0];
      }
    }

    if (matchedStudent) {
      // PRESERVE PERSISTENT ID
      matchedExistingIds.add(matchedStudent.id);
      matchedCount++;

      // Detect if updated info
      let hasUpdates = false;
      if (rawPhone && rawPhone !== matchedStudent.phone) hasUpdates = true;
      if (rawGrade && rawGrade !== matchedStudent.grade) hasUpdates = true;
      if (rawClass && rawClass !== matchedStudent.className) hasUpdates = true;
      if (hasUpdates) updatedInfoCount++;

      // Merge incoming data onto existing student, retaining previous keys and custom attributes
      const mergedStudent: Student = {
        ...matchedStudent,
        ...incomingRow,
        id: matchedStudent.id, // Strictly preserve original ID
        name: rawName || matchedStudent.name || "",
        phone: rawPhone || matchedStudent.phone || "",
        grade: rawGrade || matchedStudent.grade || "",
        className: rawClass || matchedStudent.className || "",
        nationalId: rawNid || matchedStudent.nationalId || "",
        // Standard Arabic aliases
        "اسم الطالب": rawName || matchedStudent.name || "",
        "الاسم": rawName || matchedStudent.name || "",
        "رقم الجوال": rawPhone || matchedStudent.phone || "",
        "الجوال": rawPhone || matchedStudent.phone || "",
        "الصف": rawGrade || matchedStudent.grade || "",
        "الفصل": rawClass || matchedStudent.className || "",
        // State flags
        isArchived: false,
        status: "active",
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveList.push(mergedStudent);
    } else {
      // Brand New Student - assign a permanent stable collision-free ID
      newlyAddedCount++;
      const stableId = rawNid 
        ? `std_nid_${rawNid}` 
        : `std_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;

      const newStudent: Student = {
        ...incomingRow,
        id: stableId,
        name: rawName || `طالب ${idx + 1}`,
        phone: rawPhone,
        grade: rawGrade,
        className: rawClass,
        nationalId: rawNid,
        "اسم الطالب": rawName || `طالب ${idx + 1}`,
        "الاسم": rawName || `طالب ${idx + 1}`,
        "رقم الجوال": rawPhone,
        "الجوال": rawPhone,
        "الصف": rawGrade,
        "الفصل": rawClass,
        isArchived: false,
        status: "active",
        createdAt: new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveList.push(newStudent);
    }
  });

  // 3. Identify and PRESERVE removed students ("الكشوف المزالة")
  const preservedArchivedList: Student[] = [];
  existingStudents.forEach((existingStd) => {
    if (!matchedExistingIds.has(existingStd.id)) {
      // Student is NOT in the new incoming sheet: PRESERVE THEM!
      preservedArchivedList.push({
        ...existingStd,
        isArchived: true,
        archivedReason: "غير مدرج في أحدث كشف مستورد - محفوظ بكافة عملياته وسجلاته",
        lastSeenInRoster: existingStd.lastSeenInRoster || new Date().toISOString(),
      });
    }
  });

  // Combined master list: Active students first, followed by safely preserved historical records
  const allReconciled = [...reconciledActiveList, ...preservedArchivedList];

  const summaryMessage = `تمت مطابقة الكشف بنجاح وحماية كافة البيانات: (${matchedCount} طالب مطابق تم الحفاظ على هوياتهم وسجلاتهم السابقة، ${newlyAddedCount} طالب جديد أضيف، ${preservedArchivedList.length} طالب من الكشوف السابقة تم حفظهم في الأرشيف الآمن دون أي فقد للبيانات).`;

  return {
    reconciledStudents: allReconciled,
    stats: {
      totalCombined: allReconciled.length,
      activeCount: reconciledActiveList.length,
      archivedPreservedCount: preservedArchivedList.length,
      matchedExistingCount: matchedCount,
      newlyAddedCount,
      updatedInfoCount,
    },
    summaryMessage,
  };
}

export interface ReconcileTeachersResult {
  reconciledTeachers: Teacher[];
  stats: {
    totalCombined: number;
    activeCount: number;
    archivedPreservedCount: number;
    matchedExistingCount: number;
    newlyAddedCount: number;
    updatedInfoCount: number;
  };
  summaryMessage: string;
}

/**
 * Reconciles incoming teachers against existing database records:
 * 1. Preserves teacher persistent IDs so inquiry requests, schedule assignments, and teacher evaluations remain linked.
 * 2. Retains removed teachers safely in the archive.
 * 3. Integrates new teachers.
 */
export function reconcileTeachersRoster(
  existingTeachers: Teacher[] = [],
  incomingRawList: any[] = []
): ReconcileTeachersResult {
  if (!Array.isArray(incomingRawList) || incomingRawList.length === 0) {
    return {
      reconciledTeachers: existingTeachers,
      stats: {
        totalCombined: existingTeachers.length,
        activeCount: existingTeachers.filter((t) => !t.isArchived).length,
        archivedPreservedCount: existingTeachers.filter((t) => t.isArchived).length,
        matchedExistingCount: 0,
        newlyAddedCount: 0,
        updatedInfoCount: 0,
      },
      summaryMessage: "لم يتم تقديم كشف معلمين جديد للمطابقة.",
    };
  }

  // Fast lookup indexes for existing teachers
  const byNationalId = new Map<string, Teacher>();
  const byExactId = new Map<string, Teacher>();
  const byNormalizedName = new Map<string, Teacher[]>();
  const byNormalizedPhone = new Map<string, Teacher[]>();

  existingTeachers.forEach((t) => {
    if (t.id) byExactId.set(t.id, t);

    const nid = normalizeCivilId(t.nationalId);
    if (nid && nid.length >= 8) {
      byNationalId.set(nid, t);
    }

    const normName = normalizeArabicName(t.name);
    if (normName) {
      const list = byNormalizedName.get(normName) || [];
      list.push(t);
      byNormalizedName.set(normName, list);
    }

    const normPhone = normalizePhoneNumber(t.phone);
    if (normPhone && normPhone.length >= 9) {
      const list = byNormalizedPhone.get(normPhone) || [];
      list.push(t);
      byNormalizedPhone.set(normPhone, list);
    }
  });

  const matchedExistingIds = new Set<string>();
  const reconciledActiveTeachers: Teacher[] = [];
  let matchedCount = 0;
  let newlyAddedCount = 0;
  let updatedInfoCount = 0;

  incomingRawList.forEach((incomingRow, idx) => {
    const rawName = String(
      incomingRow.name ||
      incomingRow["المعلم"] ||
      incomingRow["الاسم"] ||
      incomingRow["الاسم الرباعي"] ||
      incomingRow.teacherName ||
      ""
    ).trim();

    if (!rawName || rawName === "المعلم" || rawName === "الاسم الرباعي") return;

    const rawPhone = String(
      incomingRow.phone ||
      incomingRow["رقم الجوال"] ||
      incomingRow["الجوال"] ||
      incomingRow["الهاتف"] ||
      ""
    ).trim();

    const rawSubject = String(
      incomingRow.subject ||
      incomingRow.subjectSpecialty ||
      incomingRow["المادة"] ||
      incomingRow["مجال التدريس"] ||
      ""
    ).trim();

    const rawSpecialty = String(
      incomingRow.specialty ||
      incomingRow["التخصص"] ||
      ""
    ).trim();

    const rawNid = normalizeCivilId(
      incomingRow.nationalId ||
      incomingRow["السجل المدني"] ||
      incomingRow["رقم الهوية"] ||
      ""
    );

    const normName = normalizeArabicName(rawName);
    const normPhone = normalizePhoneNumber(rawPhone);

    // Multi-tier teacher matching
    let matchedTeacher: Teacher | undefined;

    if (rawNid && byNationalId.has(rawNid)) {
      matchedTeacher = byNationalId.get(rawNid);
    }

    if (!matchedTeacher && incomingRow.id && byExactId.has(incomingRow.id)) {
      matchedTeacher = byExactId.get(incomingRow.id);
    }

    if (!matchedTeacher && normName) {
      const candidates = byNormalizedName.get(normName);
      if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
          matchedTeacher = candidates[0];
        } else {
          matchedTeacher = candidates.find((c) => {
            const cPhone = normalizePhoneNumber(c.phone);
            if (normPhone && cPhone && normPhone === cPhone) return true;
            return false;
          }) || candidates[0];
        }
      }
    }

    if (!matchedTeacher && normPhone) {
      const candidates = byNormalizedPhone.get(normPhone);
      if (candidates && candidates.length === 1) {
        matchedTeacher = candidates[0];
      }
    }

    if (matchedTeacher) {
      matchedExistingIds.add(matchedTeacher.id);
      matchedCount++;

      let hasUpdates = false;
      if (rawPhone && rawPhone !== matchedTeacher.phone) hasUpdates = true;
      if (rawSubject && rawSubject !== matchedTeacher.subjectSpecialty) hasUpdates = true;
      if (hasUpdates) updatedInfoCount++;

      const mergedTeacher: Teacher = {
        ...matchedTeacher,
        ...incomingRow,
        id: matchedTeacher.id, // Strictly preserve original ID
        name: rawName || matchedTeacher.name,
        phone: rawPhone || matchedTeacher.phone,
        subject: rawSubject || matchedTeacher.subject || "عام",
        subjectSpecialty: rawSubject || matchedTeacher.subjectSpecialty || "عام",
        specialty: rawSpecialty || matchedTeacher.specialty || "",
        nationalId: rawNid || matchedTeacher.nationalId || "",
        isArchived: false,
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveTeachers.push(mergedTeacher);
    } else {
      newlyAddedCount++;
      const stableId = rawNid
        ? `tch_nid_${rawNid}`
        : `tch_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`;

      const newTeacher: Teacher = {
        ...incomingRow,
        id: stableId,
        name: rawName,
        phone: rawPhone,
        subject: rawSubject || "عام",
        subjectSpecialty: rawSubject || "عام",
        specialty: rawSpecialty,
        nationalId: rawNid,
        isArchived: false,
        createdAt: new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
      };

      reconciledActiveTeachers.push(newTeacher);
    }
  });

  // Preserve removed teachers
  const preservedArchivedTeachers: Teacher[] = [];
  existingTeachers.forEach((existingTch) => {
    if (!matchedExistingIds.has(existingTch.id)) {
      preservedArchivedTeachers.push({
        ...existingTch,
        isArchived: true,
        archivedReason: "غير مدرج في أحدث كشف معلمين - محفوظ بكامل مهامه وجدوله وسجلاته السابقة",
      });
    }
  });

  const allReconciledTeachers = [...reconciledActiveTeachers, ...preservedArchivedTeachers];

  const summaryMessage = `تمت مطابقة كشف المعلمين وحماية البيانات: (${matchedCount} معلم مطابق تم الحفاظ على هوياتهم وجداولهم وطلبات استعلامهم، ${newlyAddedCount} معلم جديد أضيف، ${preservedArchivedTeachers.length} معلم من الكشوف السابقة تم حفظهم في الأرشيف دون أي فقد للبيانات).`;

  return {
    reconciledTeachers: allReconciledTeachers,
    stats: {
      totalCombined: allReconciledTeachers.length,
      activeCount: reconciledActiveTeachers.length,
      archivedPreservedCount: preservedArchivedTeachers.length,
      matchedExistingCount: matchedCount,
      newlyAddedCount,
      updatedInfoCount,
    },
    summaryMessage,
  };
}
