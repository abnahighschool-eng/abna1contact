/**
 * Utility functions for Parent Councils (مجالس أولياء الأمور)
 * - Unique Activation Code Generation
 * - Validation for National ID, Phone (05xxxxxxxx, 10 digits), and Email
 * - URL tokens and link construction
 */

import { Student } from "../types";

// Convert Arabic-Indic numerals (٠-٩) to standard English numerals (0-9) and strip whitespace
export function normalizeDigits(input?: string): string {
  if (!input) return "";
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  return String(input)
    .trim()
    .replace(/[٠-٩]/g, (d) => arabicIndic.indexOf(d).toString())
    .replace(/\s+/g, "");
}

// Clean phone to exactly digits
export function cleanPhoneNumber(phone?: string): string {
  const digits = normalizeDigits(phone).replace(/\D/g, "");
  return digits;
}

// Check if Phone is exactly 10 digits and starts with 05
export function isValidSaudiPhone(phone?: string): boolean {
  const clean = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(clean);
}
export const validateSaudiPhone = isValidSaudiPhone;

// Format Saudi phone to clean standard 05xxxxxxxx
export function formatSaudiPhone(phone?: string): string {
  const clean = cleanPhoneNumber(phone);
  if (clean.startsWith("9665") && clean.length === 12) {
    return "0" + clean.slice(3);
  }
  return clean;
}

// Check if National ID is exactly 10 digits
export function isValidNationalId(nationalId?: string): boolean {
  const clean = normalizeDigits(nationalId).replace(/\D/g, "");
  return /^\d{10}$/.test(clean);
}
export const validateNationalId = isValidNationalId;

// Check if Email is valid format
export function isValidEmail(email?: string): boolean {
  if (!email || !email.trim()) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}
export const validateEmail = isValidEmail;

// Generate a deterministic unique 6-digit numeric activation code for a student
export function generateStudentActivationCode(studentId?: string, studentName?: string, phone?: string): string {
  const seed = `${studentId || ""}_${studentName || ""}_${cleanPhoneNumber(phone)}`;
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const codeNum = Math.abs(hash) % 900000 + 100000;
  return codeNum.toString();
}

// Generate a unique access token for the council form URL
export function generateStudentCouncilToken(studentId?: string): string {
  const cleanId = String(studentId || "student").replace(/[^a-zA-Z0-9]/g, "");
  return `pc_${cleanId}_${Date.now().toString(36)}`;
}

// Format direct link for a parent
export function buildParentCouncilUrl(
  origin: string,
  params: {
    token?: string;
    studentId?: string;
    code?: string;
    studentName?: string;
    grade?: string;
    className?: string;
    phone?: string;
    guardian?: string;
  }
): string {
  const query = new URLSearchParams();
  query.set("page", "parent_council_portal");
  query.set("parent_council", "true");
  if (params.token) {
    query.set("council_token", params.token);
    query.set("token", params.token);
  }
  if (params.code) {
    query.set("council_code", params.code);
    query.set("code", params.code);
  }
  if (params.studentId) query.set("student_id", params.studentId);
  if (params.studentName) query.set("student_name", params.studentName);
  if (params.grade) query.set("grade", params.grade);
  if (params.className) query.set("class", params.className);
  if (params.phone) query.set("phone", params.phone);
  if (params.guardian) query.set("guardian", params.guardian);
  return `${origin}?${query.toString()}`;
}

/**
 * Strips leading standalone 'بن' or 'ابن' or 'إبن' if separated by spaces.
 * Strictly preserves authentic names starting with these characters like "بندر", "بنيان", "بنان".
 */
export function stripLeadingSonOf(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  // Regex strictly matches standalone 'بن', 'ابن', or 'إبن' followed by whitespace
  return trimmed.replace(/^(?:بن|ابن|إبن)\s+/u, "").trim();
}

/**
 * Derives the father's/guardian's full name from the student's full name or student record.
 * 1. Checks explicit student record fields first (اسم الأب, fatherName, اسم ولي الأمر, etc.).
 * 2. If deriving from student full name:
 *    - Accounts for Arabic compound first names (عبد الله, عبد الرحمن, أبو بكر, سيف الدين, etc.).
 *    - Strips isolated connector words 'بن' or 'ابن' or 'إبن' between the student and the father.
 *    - Strictly preserves authentic names starting with these letters like "بندر" or "بنيان".
 *    - Preserves internal 'بن' in the father's lineage (e.g. "تركي بن طلال").
 */
export function deriveFatherFullName(studentFullName: string, studentRecord?: any): string {
  if (studentRecord) {
    const directFather =
      studentRecord["اسم الأب"] ||
      studentRecord.fatherName ||
      studentRecord["اسم ولي الأمر"] ||
      studentRecord.guardianName ||
      studentRecord["ولي الأمر"] ||
      studentRecord.guardian;

    if (directFather && String(directFather).trim()) {
      return stripLeadingSonOf(String(directFather).trim());
    }
  }

  const rawName = (studentFullName || "").trim();
  if (!rawName) return "";

  // Split strictly by whitespace into discrete word tokens
  const parts = rawName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return rawName;

  // Compound student first names in Arabic (e.g. "عبد الله", "أبو بكر", "سيف الدين", etc.)
  const compoundPrefixes = [
    "عبد", "أبو", "ابو", "سيف", "نور", "ضياء", "علاء", "شمس", "تقي", "جمال", "بدر", "حسام", "محي", "محيي", "صلاح", "شرف", "زين"
  ];

  let skipWords = 1;
  // If the first name is compound (e.g. "عبد الله"), skip first 2 words
  if (parts.length >= 3 && compoundPrefixes.includes(parts[0])) {
    skipWords = 2;
  }

  // Check if the word immediately following the student's first name is an isolated "بن" or "ابن" or "إبن"
  // Note: Since parts is an array of individual words, checking parts[skipWords] === "بن" strictly
  // matches only when the word is exactly "بن" or "ابن" or "إبن", and never matches "بندر" or "بنيان"!
  if (
    parts.length > skipWords + 1 &&
    (parts[skipWords] === "بن" || parts[skipWords] === "ابن" || parts[skipWords] === "إبن")
  ) {
    skipWords += 1;
  }

  if (parts.length > skipWords) {
    const fatherName = parts.slice(skipWords).join(" ").trim();
    return stripLeadingSonOf(fatherName);
  }

  return rawName;
}
