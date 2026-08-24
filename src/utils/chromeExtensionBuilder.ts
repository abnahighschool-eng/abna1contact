import JSZip from "jszip";

/**
 * Creates a valid 128x128 PNG Blob for the extension icon using HTML5 Canvas or minimal PNG bytes
 */
async function createExtensionIconBlob(): Promise<Blob> {
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Emerald background
        ctx.fillStyle = "#059669";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(0, 0, 128, 128, 28);
        } else {
          ctx.rect(0, 0, 128, 128);
        }
        ctx.fill();

        // Border
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Text / Symbol
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚡", 64, 66);
      }

      return await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(new Blob([getMinimalPngBytes()], { type: "image/png" }));
          }
        }, "image/png");
      });
    } catch {
      return new Blob([getMinimalPngBytes()], { type: "image/png" });
    }
  }
  return new Blob([getMinimalPngBytes()], { type: "image/png" });
}

function getMinimalPngBytes(): Uint8Array {
  // Minimal valid 1x1 transparent PNG byte array (67 bytes)
  return new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);
}

/**
 * Generates the full Chrome Extension ZIP package (Manifest V3)
 * Equipped with Daily Absence Updating, Cumulative Repeat-Absence Threshold Engine,
 * WhatsApp Messaging, In-Page HUD and Popup Dashboard.
 */
export async function generateNoorChromeExtensionZip(): Promise<Blob> {
  const zip = new JSZip();

  // 1. manifest.json (Manifest V3)
  const manifest = {
    manifest_version: 3,
    name: "مساعد رصد وتحديث الغياب المتكرر بنظام نور - منصة أبناء",
    short_name: "أبناء - غياب نور",
    version: "3.5.0",
    description: "إضافة متصفح ذكية لرصد وتحديث غياب الطلاب يومياً بنظام نور، وكشف حالات الغياب المتكرر (3، 5، 10 أيام) مع إرسال إشعارات الواتساب والربط المباشر بمنصة أبناء.",
    icons: {
      "128": "icon.png"
    },
    action: {
      default_popup: "popup.html",
      default_title: "لوحة تحكم وتحديث الغياب المتكرر - منصة أبناء",
      default_icon: {
        "128": "icon.png"
      }
    },
    permissions: [
      "activeTab",
      "storage",
      "scripting",
      "clipboardWrite",
      "notifications"
    ],
    host_permissions: [
      "https://noor.moe.gov.sa/*",
      "http://noor.moe.gov.sa/*"
    ],
    background: {
      service_worker: "background.js"
    },
    content_scripts: [
      {
        matches: [
          "https://noor.moe.gov.sa/*",
          "http://noor.moe.gov.sa/*"
        ],
        js: ["content.js"],
        run_at: "document_idle"
      }
    ]
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // 2. icon.png
  const iconBlob = await createExtensionIconBlob();
  zip.file("icon.png", iconBlob);

  // 3. background.js
  const backgroundJs = `// Background Service Worker for Abna Noor Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Abna Noor Extension] Installed successfully.");
  updateBadge();
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadge") {
    updateBadge();
    sendResponse({ success: true });
  } else if (request.action === "showNotification") {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: request.title || "تنبيه غياب متكرر - منصة أبناء",
        message: request.message || "وصل طالب لحد الغياب المتكرر المطلوب للإجراء الإرشادي",
        priority: 2
      });
    }
    sendResponse({ success: true });
  }
});

function updateBadge() {
  chrome.storage.local.get(["cumulativeStudents"], (result) => {
    const list = result.cumulativeStudents || [];
    // Count students with repeated unexcused absence (>= 3 days)
    const repeated = list.filter(s => (s.unexcusedDaysCount || 0) >= 3);
    const count = repeated.length;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: "#e11d48" }); // Rose red
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  });
}
`;
  zip.file("background.js", backgroundJs);

  // 4. content.js
  const contentJs = `/**
 * Abna Noor In-Page Absence Monitor & Multi-Page Smart Extractor (v4.0)
 * Designed for Noor Microsoft ReportViewer & Daily Attendance Pages
 */
(function() {
  if (window.top !== window) return;

  function clean(str) {
    if (!str) return "";
    return String(str).replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").trim();
  }

  function normalizeArabic(text) {
    if (!text) return "";
    return String(text)
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\\u064B-\\u065F]/g, "") // remove harakat
      .replace(/\\s+/g, " ")
      .trim();
  }

  function extractDates(text) {
    if (!text) return [];
    var matches = text.match(/(?:14\\d{2}|20\\d{2})[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:14\\d{2}|20\\d{2})/g) || [];
    return matches.map(function(m) { return m.replace(/\\-/g, "/"); });
  }

  function extractFieldValue(label, text) {
    if (!text || text.indexOf(label) === -1) return "";
    var idx = text.indexOf(label);
    var sub = text.substring(idx + label.length);
    sub = sub.replace(/^[\\s:\\t-]+/, "");
    var endMatch = sub.match(/[\\n\\r\\t]|الصف|القسم|الفصل|النظام|تقرير|اسم/);
    if (endMatch && endMatch.index !== undefined && endMatch.index > 0) {
      sub = sub.substring(0, endMatch.index);
    }
    return clean(sub);
  }

  function getPageDate() {
    var d = "";
    var dateInputs = document.querySelectorAll("input[id*='Date'], input[id*='txtDate'], span[id*='Date'], select[id*='Date']");
    dateInputs.forEach(function(el) {
      if (d) return;
      var val = clean(el.value || el.innerText);
      var m = val.match(/(\\b(?:14\\d{2}|20\\d{2})[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}\\b|\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:14\\d{2}|20\\d{2})\\b)/);
      if (m) d = m[0].replace(/\\-/g, "/");
    });
    if (!d) {
      try {
        d = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      } catch(e) {
        d = new Date().toISOString().split("T")[0];
      }
    }
    return d;
  }

  // Detect ReportViewer Page Status (e.g. Page 1 of 2)
  function getReportViewerPageInfo() {
    var allDocs = [document];
    var iframes = document.querySelectorAll("iframe, frame");
    for (var f = 0; f < iframes.length; f++) {
      try {
        var fDoc = iframes[f].contentDocument || iframes[f].contentWindow.document;
        if (fDoc && allDocs.indexOf(fDoc) === -1) allDocs.push(fDoc);
      } catch (e) {}
    }

    var pageInfo = { currentPage: 1, totalPages: 1, hasNext: false, nextBtn: null };

    allDocs.forEach(function(doc) {
      // Find page count text e.g. "صفحة 1 من 2" or "1 of 2"
      var bText = doc.body ? clean(doc.body.innerText) : "";
      var pMatch = bText.match(/صفحة\\s*(\\d+)\\s*من\\s*(\\d+)/) || bText.match(/(\\d+)\\s*of\\s*(\\d+)/i);
      if (pMatch) {
        pageInfo.currentPage = parseInt(pMatch[1], 10) || 1;
        pageInfo.totalPages = parseInt(pMatch[2], 10) || 1;
      }

      // Look for next page button
      var nextCandidates = Array.from(doc.querySelectorAll("input[type='image'], input[type='submit'], input[type='button'], a, button, img"));
      for (var i = 0; i < nextCandidates.length; i++) {
        var el = nextCandidates[i];
        var title = (el.getAttribute("title") || el.getAttribute("alt") || el.innerText || el.id || "").toLowerCase();
        if (title.indexOf("الصفحة التالية") > -1 || title.indexOf("التالية") > -1 || title.indexOf("next page") > -1 || (el.id && el.id.indexOf("Next") > -1 && el.id.indexOf("ReportViewer") > -1)) {
          // Check if not disabled
          var isDisabled = el.disabled || el.getAttribute("aria-disabled") === "true" || el.classList.contains("disabled") || (el.style && el.style.cursor === "default" && title.indexOf("disabled") > -1);
          if (!isDisabled) {
            pageInfo.hasNext = true;
            pageInfo.nextBtn = el;
            break;
          }
        }
      }
    });

    if (pageInfo.currentPage < pageInfo.totalPages) {
      pageInfo.hasNext = true;
    }

    return pageInfo;
  }

  // Scan Noor page for absences (Supports Noor ReportViewer Student Absence Reports & Daily Attendance)
  function scanPageAbsences() {
    var pageDate = getPageDate();
    var allDocs = [document];
    var iframes = document.querySelectorAll("iframe, frame");
    for (var f = 0; f < iframes.length; f++) {
      try {
        var fDoc = iframes[f].contentDocument || iframes[f].contentWindow.document;
        if (fDoc && allDocs.indexOf(fDoc) === -1) allDocs.push(fDoc);
      } catch (e) {}
    }

    var absentees = [];
    var seen = new Set();

    // Strategy 1: Noor "تقرير الغياب على مستوى الطالب" (ReportViewer Tables)
    allDocs.forEach(function(doc) {
      var bodyText = doc.body ? clean(doc.body.innerText) : "";
      var isStudentReport = bodyText.indexOf("تقرير الغياب على مستوى الطالب") > -1 || 
        (bodyText.indexOf("اسم الطالب") > -1 && (bodyText.indexOf("نوع الغياب") > -1 || bodyText.indexOf("نسبة غياب الطالب") > -1 || bodyText.indexOf("غياب الطالب") > -1));

      if (!isStudentReport) return;

      var globalGrade = extractFieldValue("الصف", bodyText);
      var globalClass = extractFieldValue("الفصل", bodyText);
      var globalTrack = extractFieldValue("القسم", bodyText);

      // Search all elements containing "اسم الطالب"
      var allCells = Array.from(doc.querySelectorAll("td, th, span, div, p"));
      var nameLabels = allCells.filter(function(el) {
        var t = clean(el.innerText);
        return t === "اسم الطالب" || t === "اسم الطالب:" || (t.indexOf("اسم الطالب") === 0 && t.length < 55);
      });

      nameLabels.forEach(function(labelEl) {
        var stName = "";
        var labelText = clean(labelEl.innerText);

        if (labelText.indexOf(":") > -1) {
          var p = labelText.split(":");
          if (p[1] && p[1].trim().length > 3) stName = clean(p[1]);
        }

        if (!stName && labelEl.nextElementSibling) {
          stName = clean(labelEl.nextElementSibling.innerText);
        }

        if (!stName && labelEl.parentElement) {
          var rowCells = Array.from(labelEl.parentElement.querySelectorAll("td, th"));
          var idx = rowCells.indexOf(labelEl);
          if (idx > -1 && idx < rowCells.length - 1) {
            stName = clean(rowCells[idx + 1].innerText);
          }
        }

        if (!stName || stName.indexOf("اسم الطالب") > -1 || stName.length < 3) return;
        stName = stName.replace(/^[:\\s\\t-]+/, "").replace(/من تاريخ.*$/, "").replace(/اليوم.*$/, "").trim();

        if (seen.has(stName)) return;
        seen.add(stName);

        var allTrs = Array.from(doc.querySelectorAll("tr"));
        var labelTr = labelEl.closest("tr");
        var sIdx = labelTr ? allTrs.indexOf(labelTr) : 0;
        var nextTr = null;
        for (var n = sIdx + 1; n < allTrs.length; n++) {
          if (allTrs[n].innerText.indexOf("اسم الطالب") > -1) {
            nextTr = allTrs[n];
            break;
          }
        }
        var eIdx = nextTr ? allTrs.indexOf(nextTr) : allTrs.length;
        var studentTrs = allTrs.slice(sIdx, eIdx);

        var unexcusedDates = [];
        var excusedDates = [];
        var absenceRate = "";
        var nationalId = "";

        studentTrs.forEach(function(row) {
          var rText = clean(row.innerText);
          
          if (/[12]\\d{9}/.test(rText) && !nationalId) {
            var mN = rText.match(/[12]\\d{9}/);
            if (mN) nationalId = mN[0];
          }

          if (rText.indexOf("نسبة غياب الطالب") > -1 || rText.indexOf("نسبة الغياب") > -1) {
            var parts = rText.split(/[\\t: ]+/);
            var rCandidates = parts.filter(function(x) { return x.indexOf("نسبة") === -1 && x.indexOf("غياب") === -1 && x.indexOf("الطالب") === -1 && clean(x).length > 0; });
            if (rCandidates.length > 0) absenceRate = clean(rCandidates[0]);
            return;
          }

          var rowDates = extractDates(rText);
          if (rowDates.length > 0) {
            if (rText.indexOf("من تاريخ") > -1 && rText.indexOf("الى تاريخ") > -1) return;
            var d = rowDates[0];
            if (rText.indexOf("بعذر") > -1 || rText.indexOf("عذر مقبول") > -1) {
              if (excusedDates.indexOf(d) === -1) excusedDates.push(d);
            } else if (rText.indexOf("بدون عذر") > -1 || rText.indexOf("غير مبرر") > -1 || rText.indexOf("غياب") > -1 || rText.indexOf("الأحد") > -1 || rText.indexOf("الإثنين") > -1 || rText.indexOf("الثلاثاء") > -1 || rText.indexOf("الأربعاء") > -1 || rText.indexOf("الخميس") > -1) {
              if (unexcusedDates.indexOf(d) === -1) unexcusedDates.push(d);
            }
          }
        });

        var unCount = unexcusedDates.length;
        var exCount = excusedDates.length;
        var totalAbs = unCount + exCount;
        if (!absenceRate) absenceRate = String(totalAbs || 1);

        // Accept any absence record, even 1 single day!
        absentees.push({
          rowElement: labelTr || doc.body,
          id: nationalId || ("noor_rep_" + Math.random().toString(36).substr(2, 8)),
          studentName: stName,
          nationalId: nationalId,
          grade: globalGrade || "الأول الثانوي",
          className: globalClass || "",
          track: globalTrack || "",
          phone: "",
          isReport: true,
          isExcused: exCount > 0 && unCount === 0,
          excusedDates: excusedDates,
          unexcusedDates: unexcusedDates.length > 0 ? unexcusedDates : (exCount === 0 ? [pageDate] : []),
          excusedDaysCount: exCount,
          unexcusedDaysCount: unCount > 0 ? unCount : (exCount === 0 ? 1 : 0),
          absenceRate: absenceRate,
          totalAbsent: totalAbs > 0 ? totalAbs : 1,
          date: unexcusedDates[0] || excusedDates[0] || pageDate
        });
      });
    });

    // Strategy 2: Standard Daily Attendance Grids (Daily Attendance Screen)
    if (absentees.length === 0) {
      allDocs.forEach(function(doc) {
        var tables = doc.querySelectorAll("table, div[role='grid'], .ui-datatable, .dxgvTable");
        tables.forEach(function(tbl) {
          var rows = Array.from(tbl.querySelectorAll("tr, div[role='row']"));
          if (rows.length < 2) return;

          var headers = [];
          Array.from(rows[0].querySelectorAll("th, td")).forEach(function(th) {
            headers.push(clean(th.innerText));
          });

          for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            var cells = Array.from(row.querySelectorAll("td, th, div[role='gridcell']"));
            if (cells.length < 2) continue;

            var name = "";
            var nationalId = "";
            var grade = "";
            var className = "";
            var phone = "";
            var excused = false;
            var unexcused = false;

            // Check Select inputs
            row.querySelectorAll("select").forEach(function(sel) {
              var text = sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? clean(sel.options[sel.selectedIndex].text) : "";
              if (text.indexOf("بعذر") > -1 || text.indexOf("مقبول") > -1) excused = true;
              else if (text.indexOf("بدون") > -1 || text.indexOf("غير مبرر") > -1 || text === "غائب" || text === "غياب") unexcused = true;
            });

            // Check Checkboxes / Radios
            row.querySelectorAll("input[type='radio']:checked, input[type='checkbox']:checked").forEach(function(chk) {
              var lbl = clean((chk.closest("label") || chk.parentElement || {}).innerText);
              if (lbl.indexOf("بعذر") > -1) excused = true;
              else if (lbl.indexOf("بدون") > -1 || lbl.indexOf("غائب") > -1 || (chk.id && chk.id.toLowerCase().indexOf("absent") > -1)) unexcused = true;
            });

            // Scan cells
            cells.forEach(function(c, cIdx) {
              var h = headers[cIdx] || "";
              var val = clean(c.innerText);

              if (/[12]\\d{9}/.test(val) && !nationalId) {
                var m = val.match(/[12]\\d{9}/);
                if (m) nationalId = m[0];
              }
              if (/^(05\\d{8}|9665\\d{8})$/.test(val.replace(/\\s+/g, "")) && !phone) {
                phone = val.replace(/\\s+/g, "");
              }
              if (!name && (h.indexOf("اسم") > -1 || h.indexOf("طالب") > -1)) {
                if (val.split(" ").length >= 2 && !/\\d{5,}/.test(val)) name = val;
              }
              if (h.indexOf("صف") > -1 || h.indexOf("مرحلة") > -1) grade = val;
              if (h.indexOf("فصل") > -1 || h.indexOf("شعبة") > -1) className = val;

              if (h.indexOf("حالة") > -1 || h.indexOf("الغياب") > -1) {
                if (val.indexOf("بعذر") > -1) excused = true;
                else if (val.indexOf("بدون") > -1 || val === "غائب" || val === "غياب") unexcused = true;
              }
            });

            if (!name) {
              cells.forEach(function(c) {
                if (name) return;
                var t = clean(c.innerText);
                if (/^[\\u0621-\\u064A\\s]{6,60}$/.test(t) && t.split(" ").length >= 2 && t.indexOf("الصف") === -1 && t.indexOf("غائب") === -1 && t.indexOf("حاضر") === -1) {
                  name = t;
                }
              });
            }

            if (name && (excused || unexcused)) {
              var k = (nationalId || name).trim();
              if (!seen.has(k)) {
                seen.add(k);
                absentees.push({
                  rowElement: row,
                  id: nationalId || ("st_" + Math.random().toString(36).substr(2, 7)),
                  studentName: name,
                  nationalId: nationalId,
                  grade: grade || "المرحلة الثانوية",
                  className: className || "",
                  phone: phone,
                  isReport: false,
                  isExcused: excused,
                  excusedDates: excused ? [pageDate] : [],
                  unexcusedDates: unexcused ? [pageDate] : [],
                  excusedDaysCount: excused ? 1 : 0,
                  unexcusedDaysCount: unexcused ? 1 : 0,
                  absenceRate: "1",
                  totalAbsent: 1,
                  date: pageDate
                });
              }
            }
          }
        });
      });
    }

    return absentees;
  }

  // Update Cumulative Storage & Detect Repeat Absence (Supports 1 Day, 2 Days, 3+ Days)
  function recordDailyAbsences(absentees, callback) {
    chrome.storage.local.get(["cumulativeStudents", "absenceHistory"], function(data) {
      var currentList = data.cumulativeStudents || [];
      var history = data.absenceHistory || [];
      var pageDate = getPageDate();
      var newlyRepeated = [];

      var map = {};
      currentList.forEach(function(s) {
        var k = s.nationalId || normalizeArabic(s.studentName);
        map[k] = s;
      });

      absentees.forEach(function(a) {
        var k = a.nationalId || normalizeArabic(a.studentName);
        var existing = map[k];
        if (!existing) {
          existing = {
            id: a.id,
            studentName: a.studentName,
            nationalId: a.nationalId || "",
            grade: a.grade || "",
            className: a.className || "",
            track: a.track || "",
            phone: a.phone || "",
            excusedDaysCount: 0,
            excusedDates: [],
            unexcusedDaysCount: 0,
            unexcusedDates: [],
            absenceRate: a.absenceRate || "",
            totalAbsent: 0,
            lastUpdated: new Date().toISOString()
          };
          map[k] = existing;
          currentList.push(existing);
        }

        var prevUnexcused = existing.unexcusedDaysCount || 0;

        if (a.isReport) {
          // Merge exact dates from report
          (a.unexcusedDates || []).forEach(function(ud) {
            if (existing.unexcusedDates.indexOf(ud) === -1) existing.unexcusedDates.push(ud);
          });
          (a.excusedDates || []).forEach(function(ed) {
            if (existing.excusedDates.indexOf(ed) === -1) existing.excusedDates.push(ed);
          });
          existing.unexcusedDaysCount = existing.unexcusedDates.length > 0 ? existing.unexcusedDates.length : (a.unexcusedDaysCount || 1);
          existing.excusedDaysCount = existing.excusedDates.length;
          if (a.absenceRate) existing.absenceRate = a.absenceRate;
          if (a.track) existing.track = a.track;
        } else {
          // Daily attendance mark
          if (a.isExcused) {
            if (existing.excusedDates.indexOf(pageDate) === -1) {
              existing.excusedDates.push(pageDate);
              existing.excusedDaysCount = existing.excusedDates.length;
            }
          } else {
            if (existing.unexcusedDates.indexOf(pageDate) === -1) {
              existing.unexcusedDates.push(pageDate);
              existing.unexcusedDaysCount = existing.unexcusedDates.length;
            }
          }
        }

        existing.totalAbsent = (existing.excusedDaysCount || 0) + (existing.unexcusedDaysCount || 0);
        existing.lastUpdated = new Date().toISOString();
        if (a.phone && !existing.phone) existing.phone = a.phone;
        if (a.grade && !existing.grade) existing.grade = a.grade;
        if (a.className && !existing.className) existing.className = a.className;

        // Check if reached a warning milestone today
        var newUnexcused = existing.unexcusedDaysCount;
        if (prevUnexcused < 3 && newUnexcused >= 3) {
          newlyRepeated.push({ student: existing, threshold: 3, label: "إنذار أول (3 أيام)" });
        } else if (prevUnexcused < 5 && newUnexcused >= 5) {
          newlyRepeated.push({ student: existing, threshold: 5, label: "إنذار ثانٍ واستدعاء (5 أيام)" });
        } else if (prevUnexcused < 10 && newUnexcused >= 10) {
          newlyRepeated.push({ student: existing, threshold: 10, label: "إحالة موجه طلابي (10 أيام)" });
        } else if (prevUnexcused < 15 && newUnexcused >= 15) {
          newlyRepeated.push({ student: existing, threshold: 15, label: "إنذار نهائي وحسم درجات (15 يوم)" });
        }
      });

      // Add to history log
      history.push({
        date: pageDate,
        timestamp: new Date().toISOString(),
        absenteesCount: absentees.length
      });

      chrome.storage.local.set({
        cumulativeStudents: currentList,
        absenceHistory: history,
        lastSyncDate: pageDate
      }, function() {
        chrome.runtime.sendMessage({ action: "updateBadge" });
        if (callback) callback({ success: true, count: absentees.length, newlyRepeated: newlyRepeated, allList: currentList });
      });
    });
  }

  // Multi-Page Auto-Navigator Engine
  var isAutoNavigating = false;

  function runSmartMultiPageScan(onProgress, onComplete) {
    if (isAutoNavigating) return;
    isAutoNavigating = true;

    var collectedTotal = 0;
    var scannedPages = 0;

    function step() {
      scannedPages++;
      var pageInfo = getReportViewerPageInfo();
      var currentAbs = scanPageAbsences();
      collectedTotal += currentAbs.length;

      if (onProgress) {
        onProgress({
          page: scannedPages,
          totalPages: pageInfo.totalPages,
          countThisPage: currentAbs.length,
          totalSoFar: collectedTotal
        });
      }

      recordDailyAbsences(currentAbs, function() {
        highlightRowsWithBadges();

        // Check if there is another page to scan
        var nextBtn = pageInfo.nextBtn;
        if (pageInfo.hasNext && nextBtn && scannedPages < 25) {
          try {
            nextBtn.click();
            // Wait for ReportViewer Async postback / re-render
            setTimeout(step, 2200);
          } catch (e) {
            isAutoNavigating = false;
            if (onComplete) onComplete({ totalScanned: collectedTotal, pages: scannedPages });
          }
        } else {
          isAutoNavigating = false;
          if (onComplete) onComplete({ totalScanned: collectedTotal, pages: scannedPages });
        }
      });
    }

    step();
  }

  // Inject Visual Badges in Noor Table Rows
  function highlightRowsWithBadges() {
    chrome.storage.local.get(["cumulativeStudents"], function(data) {
      var list = data.cumulativeStudents || [];
      var map = {};
      list.forEach(function(s) {
        var k = s.nationalId || normalizeArabic(s.studentName);
        map[k] = s;
      });

      var absentees = scanPageAbsences();
      absentees.forEach(function(a) {
        var k = a.nationalId || normalizeArabic(a.studentName);
        var rec = map[k];
        var days = rec ? rec.unexcusedDaysCount : (a.isExcused ? 0 : (a.unexcusedDaysCount || 1));

        var badgeId = "abna-badge-" + a.id;
        var oldBadge = document.getElementById(badgeId);
        if (oldBadge) oldBadge.remove();

        var badge = document.createElement("span");
        badge.id = badgeId;
        badge.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:bold;margin-right:6px;font-family:Tahoma,sans-serif;";

        if (days >= 15) {
          badge.style.background = "#4c0519";
          badge.style.color = "#fda4af";
          badge.style.border = "1px solid #f43f5e";
          badge.innerText = "⛔ إنذار نهائي (" + days + " يوم)";
        } else if (days >= 10) {
          badge.style.background = "#7f1d1d";
          badge.style.color = "#fca5a5";
          badge.style.border = "1px solid #ef4444";
          badge.innerText = "🔴 إحالة موجه طلابي (" + days + " أيام)";
        } else if (days >= 5) {
          badge.style.background = "#78350f";
          badge.style.color = "#fcd34d";
          badge.style.border = "1px solid #f59e0b";
          badge.innerText = "🚨 إنذار 2 واستدعاء (" + days + " أيام)";
        } else if (days >= 3) {
          badge.style.background = "#713f12";
          badge.style.color = "#fef08a";
          badge.style.border = "1px solid #eab308";
          badge.innerText = "⚠️ إنذار 1 (" + days + " أيام)";
        } else if (days >= 1) {
          badge.style.background = "#064e3b";
          badge.style.color = "#6ee7b7";
          badge.style.border = "1px solid #10b981";
          badge.innerText = "✓ غياب اليوم (" + days + " يوم)";
        }

        var targetCell = a.rowElement.querySelector("td, th");
        if (targetCell) {
          targetCell.appendChild(badge);
        }
      });
    });
  }

  // Create Floating Widget (HUD) in Noor
  function initFloatingWidget() {
    if (document.getElementById("abna-noor-hud-widget")) return;

    var pInfo = getReportViewerPageInfo();

    var hud = document.createElement("div");
    hud.id = "abna-noor-hud-widget";
    hud.style.cssText = "position:fixed;bottom:20px;left:20px;z-index:999999999;background:#0f172a;color:#ffffff;border:2px solid #10b981;border-radius:24px;padding:14px 18px;box-shadow:0 20px 50px rgba(0,0,0,0.7);font-family:Tahoma,Segoe UI,sans-serif;direction:rtl;text-align:right;min-width:320px;user-select:none;transition:all 0.3s ease;";

    var pageIndicator = pInfo.totalPages > 1 ? '<span style="background:#065f46;color:#a7f3d0;font-size:10px;padding:2px 8px;border-radius:10px;">📄 صفحة ' + pInfo.currentPage + ' من ' + pInfo.totalPages + '</span>' : '';

    hud.innerHTML = 
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<div style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;"></div>' +
          '<strong style="color:#34d399;font-size:13px;">مساعد رصد الغياب الذكي - أبناء</strong>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;">' +
          pageIndicator +
          '<button id="abna-hud-close" style="background:#1e293b;color:#94a3b8;border:none;border-radius:8px;padding:2px 8px;cursor:pointer;font-size:12px;">✕</button>' +
        '</div>' +
      '</div>' +
      '<div id="abna-hud-status" style="font-size:11px;color:#cbd5e1;margin-bottom:10px;line-height:1.5;">' +
        '📅 تاريخ الرصد: <strong>' + getPageDate() + '</strong><br />' +
        'يسحب جميع حالات الغياب (من يوم واحد فأكثر) ويكشف الغياب المتكرر تلقائياً.' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' +
        (pInfo.totalPages > 1 ? 
          '<button id="abna-hud-multipage-btn" style="width:100%;background:#0284c7;color:#ffffff;border:none;border-radius:12px;padding:9px 12px;font-weight:900;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(2,132,199,0.3);">' +
            '🚀 السحب التلقائي الذكي لكافة الصفحات (' + pInfo.totalPages + ' صفحات)' +
          '</button>' : '') +
        '<button id="abna-hud-update-btn" style="width:100%;background:#10b981;color:#022c22;border:none;border-radius:12px;padding:9px 12px;font-weight:900;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 4px 12px rgba(16,185,129,0.3);">' +
          '⚡ سحب وحفظ غياب الصفحة الحالية' +
        '</button>' +
        '<div style="display:flex;gap:6px;margin-top:2px;">' +
          '<button id="abna-hud-copy-btn" style="flex:1;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:10px;padding:7px;font-size:11px;font-weight:bold;cursor:pointer;">' +
            '📋 نسخ لمنصة أبناء' +
          '</button>' +
          '<button id="abna-hud-highlight-btn" style="flex:1;background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:10px;padding:7px;font-size:11px;font-weight:bold;cursor:pointer;">' +
            '🔍 تمييز بالجدول' +
          '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(hud);

    document.getElementById("abna-hud-close").onclick = function() {
      hud.style.display = "none";
    };

    document.getElementById("abna-hud-highlight-btn").onclick = function() {
      highlightRowsWithBadges();
      alert("✓ تم وضع شارات الغياب والإنذارات بجانب أسماء الطلاب في جدول نور!");
    };

    document.getElementById("abna-hud-copy-btn").onclick = function() {
      chrome.storage.local.get(["cumulativeStudents"], function(d) {
        var list = d.cumulativeStudents || [];
        if (list.length === 0) {
          var pageAbs = scanPageAbsences();
          if (pageAbs.length === 0) {
            alert("⚠️ لا توجد بيانات غياب مسجلة حالياً. تأكد من الضغط على زر (عرض) في تقرير نور أولاً.");
            return;
          }
          recordDailyAbsences(pageAbs, function(res) {
            navigator.clipboard.writeText(JSON.stringify(res.allList, null, 2)).then(function() {
              alert("✓ تم سحب ونسخ بيانات (" + res.allList.length + " طالب غائب) لحافظة جهازك بنجاح!\\n\\nافتح منصة أبناء واضغط على زر (لصق السجل من الإضافة).");
            });
          });
          return;
        }
        navigator.clipboard.writeText(JSON.stringify(list, null, 2)).then(function() {
          alert("✓ تم نسخ سجل الغياب الكامل (" + list.length + " طالب غائب) لمنصة أبناء بنجاح!\\n\\nافتح منصة أبناء واضغط على زر (لصق السجل من الإضافة).");
        });
      });
    };

    // Multi-page Auto Scan Button
    var multiBtn = document.getElementById("abna-hud-multipage-btn");
    if (multiBtn) {
      multiBtn.onclick = function() {
        var btn = this;
        btn.innerText = "جارِ التنقل والسحب التلقائي...";
        btn.disabled = true;

        runSmartMultiPageScan(function(progress) {
          btn.innerText = "جارِ سحب صفحة " + progress.page + " من " + progress.totalPages + "... (مجموع: " + progress.totalSoFar + ")";
        }, function(summary) {
          btn.innerText = "✓ اكتمل سحب كافة الصفحات!";
          btn.disabled = false;
          alert("🎉 تم بنجاح السحب الذكي لجميع الصفحات (" + summary.pages + " صفحات)!\\n\\nتم رصد وتسجيل (" + summary.totalScanned + " طالب غائب) في السجل التراكمي.\\n\\nاضغط على (نسخ لمنصة أبناء) لنقل البيانات فوراً.");
        });
      };
    }

    // Single Page Scan Button
    document.getElementById("abna-hud-update-btn").onclick = function() {
      var btn = document.getElementById("abna-hud-update-btn");
      btn.innerText = "جارِ الفحص والالتقاط...";
      btn.disabled = true;

      var absentees = scanPageAbsences();
      if (absentees.length === 0) {
        alert("⚠️ لم يتم العثور على طلاب مسجلين كغياب في هذه الصفحة.\\n\\nتأكد من الضغط على زر (عرض) في تقرير نور وظهور جدول الغياب.");
        btn.innerText = "⚡ سحب وحفظ غياب الصفحة الحالية";
        btn.disabled = false;
        return;
      }

      recordDailyAbsences(absentees, function(res) {
        btn.innerText = "✓ تم الحفظ بنجاح!";
        btn.disabled = false;
        highlightRowsWithBadges();

        var repMsg = "";
        if (res.newlyRepeated && res.newlyRepeated.length > 0) {
          repMsg = "\\n\\n🚨 تنبيه: وصل (" + res.newlyRepeated.length + ") طالب لحد الغياب المتكرر:\\n" +
            res.newlyRepeated.map(function(r) { return "• " + r.student.studentName + " (" + r.label + ")"; }).join("\\n");
        }

        alert("✅ تم بنجاح رصد غياب اليوم (" + res.count + " طالب غائب) وحفظه في السجل!\\n(تم شمل كافة الطلاب حتى من غاب يوماً واحداً)" + repMsg + "\\n\\nيمكنك الضغط على (نسخ لمنصة أبناء) لنقل السجل فوراً.");
      });
    };
  }

  // Auto-init on Noor Pages
  setTimeout(initFloatingWidget, 1500);
  setTimeout(highlightRowsWithBadges, 2500);
})();
`;
  zip.file("content.js", contentJs);

  // 5. popup.html
  const popupHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مساعد الغياب الذكي - منصة أبناء</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
    body { width: 440px; background: #0f172a; color: #f8fafc; font-size: 13px; direction: rtl; text-align: right; }
    .header { background: #022c22; border-bottom: 2px solid #059669; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 15px; font-weight: 900; color: #34d399; display: flex; align-items: center; gap: 8px; }
    .header .tag { background: #065f46; color: #a7f3d0; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: bold; }
    
    .tabs { display: flex; background: #1e293b; padding: 4px; gap: 4px; border-bottom: 1px solid #334155; }
    .tab-btn { flex: 1; padding: 8px 4px; background: transparent; border: none; color: #94a3b8; font-size: 11px; font-weight: bold; border-radius: 8px; cursor: pointer; text-align: center; }
    .tab-btn.active { background: #059669; color: #ffffff; }

    .content { padding: 14px; max-height: 480px; overflow-y: auto; }
    
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 12px; margin-bottom: 12px; }
    .card-title { font-size: 12px; font-weight: bold; color: #cbd5e1; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
    .stat-box { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 8px 4px; text-align: center; }
    .stat-val { font-size: 16px; font-weight: 900; color: #38bdf8; }
    .stat-lbl { font-size: 9px; color: #94a3b8; margin-top: 2px; }

    .btn-multi { width: 100%; background: #0284c7; color: #ffffff; border: none; border-radius: 12px; padding: 11px; font-weight: 900; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(2,132,199,0.3); }
    .btn-multi:hover { background: #0369a1; }

    .btn-main { width: 100%; background: #10b981; color: #022c22; border: none; border-radius: 12px; padding: 11px; font-weight: 900; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
    .btn-main:hover { background: #34d399; }
    .btn-sub { width: 100%; background: #334155; color: #f8fafc; border: 1px solid #475569; border-radius: 10px; padding: 8px; font-weight: bold; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn-sub:hover { background: #475569; }

    .student-item { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
    .st-header { display: flex; justify-content: space-between; align-items: center; }
    .st-name { font-weight: bold; font-size: 12px; color: #f8fafc; }
    .st-badge { font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 6px; }
    .badge-1 { background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; }
    .badge-3 { background: #713f12; color: #fef08a; border: 1px solid #eab308; }
    .badge-5 { background: #78350f; color: #fcd34d; border: 1px solid #f59e0b; }
    .badge-10 { background: #7f1d1d; color: #fca5a5; border: 1px solid #ef4444; }
    .badge-15 { background: #4c0519; color: #fda4af; border: 1px solid #f43f5e; }

    .st-meta { font-size: 10px; color: #94a3b8; display: flex; gap: 8px; }
    .st-actions { display: flex; gap: 6px; margin-top: 4px; }
    .btn-wa { background: #059669; color: #fff; border: none; border-radius: 6px; padding: 4px 8px; font-size: 10px; font-weight: bold; cursor: pointer; flex: 1; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .btn-wa:hover { background: #047857; }
    .btn-copy-st { background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 4px 8px; font-size: 10px; cursor: pointer; }

    .empty-state { text-align: center; padding: 30px 10px; color: #64748b; font-size: 12px; }
    .footer { background: #090d16; padding: 10px 14px; border-top: 1px solid #1e293b; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>
      <span>⚡</span>
      <span>مساعد الغياب الذكي</span>
    </h1>
    <span class="tag">إصدار 4.0 المتطور</span>
  </div>

  <!-- Tabs Navigation -->
  <div class="tabs">
    <button class="tab-btn active" id="tab-btn-dashboard">📊 لوحة الرصد</button>
    <button class="tab-btn" id="tab-btn-day1">🟢 غياب اليوم الأول (جديد)</button>
    <button class="tab-btn" id="tab-btn-warnings">🚨 الغياب المتكرر والإنذارات</button>
    <button class="tab-btn" id="tab-btn-all">📋 السجل الشامل</button>
  </div>

  <!-- Main Content Container -->
  <div class="content">

    <!-- Tab 1: Dashboard -->
    <div id="tab-dashboard">
      <div class="card">
        <div class="card-title">
          <span>ملخص الغياب الشامل للمدرسة</span>
          <span id="display-date" style="font-size:10px;color:#34d399;font-weight:normal;"></span>
        </div>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-val" id="stat-total-students">0</div>
            <div class="stat-lbl">إجمالي الغائبين</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color:#34d399;" id="stat-day-1">0</div>
            <div class="stat-lbl">يوم 1 أو 2</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color:#eab308;" id="stat-warn-3">0</div>
            <div class="stat-lbl">إنذار 1 (3 أيام)</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" style="color:#ef4444;" id="stat-warn-5">0</div>
            <div class="stat-lbl">5+ أيام</div>
          </div>
        </div>

        <button class="btn-multi" id="btn-popup-multipage-now">
          <span>🚀 سحب تلقائي ذكي لجميع الصفحات من نور</span>
        </button>

        <button class="btn-main" id="btn-popup-update-now">
          <span>⚡ سحب وحفظ الصفحة الحالية فقط</span>
        </button>

        <button class="btn-sub" id="btn-popup-copy-all">
          <span>📋 نسخ سجل الغياب الكامل لمنصة أبناء</span>
        </button>
      </div>

      <div class="card">
        <div class="card-title">
          <span>أحدث الطلاب المرصودين اليوم</span>
        </div>
        <div id="recent-alerts-list">
          <div class="empty-state">لا توجد حالات غياب مسجلة حتى الآن. انقر على زر السحب الذكي للبدء.</div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Day 1 & Day 2 Early Absence -->
    <div id="tab-day1" style="display: none;">
      <div class="card">
        <div class="card-title">
          <span>طلاب اليوم الأول والثاني (متابعة مبكرة)</span>
          <span style="font-size:10px;color:#34d399;" id="day1-count-badge">0 طالب</span>
        </div>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:10px;line-height:1.4;">
          هؤلاء الطلاب في بداية الغياب (1 أو 2 يوم) — يمكنك إرسال تنبيه ودي لولي الأمر أو متابعتهم مبكراً قبل وصولهم للإنذارات.
        </p>
        <div id="day1-list">
          <div class="empty-state">لا يوجد طلاب في هذه الفئة حالياً.</div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Warnings (3, 5, 10 Days) -->
    <div id="tab-warnings" style="display: none;">
      <div class="card">
        <div class="card-title">
          <span>الطلاب في مرحلة الغياب المتكرر والإنذار (3+ أيام)</span>
          <span style="font-size:10px;color:#f87171;" id="warnings-count-badge">0 طالب</span>
        </div>
        <div id="warnings-list">
          <div class="empty-state">ممتاز! لا يوجد طلاب تجاوزوا حدود الغياب المتكرر حالياً.</div>
        </div>
      </div>
    </div>

    <!-- Tab 4: All Cumulative Students -->
    <div id="tab-all" style="display: none;">
      <div class="card">
        <div class="card-title">
          <span>قائمة جميع الطلاب المسجلين بالسجل التراكمي</span>
          <button id="btn-clear-data" style="background:transparent;border:none;color:#ef4444;font-size:10px;cursor:pointer;">تصفير السجل 🗑️</button>
        </div>
        <input type="text" id="search-student-input" placeholder="🔍 بحث بالاسم أو السجل المدني..." style="width:100%;padding:8px 10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#fff;font-size:11px;margin-bottom:10px;" />
        <div id="all-students-list">
          <div class="empty-state">لا توجد بيانات مسجلة بالسجل التراكمي.</div>
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <span>منصة أبناء - المساعد المدرسي الذكي</span>
    <span id="sync-status-indicator">جاهز للرصد ✓</span>
  </div>

  <script src="popup.js"></script>
</body>
</html>
`;
  zip.file("popup.html", popupHtml);

  // 6. popup.js
  const popupJs = `document.addEventListener("DOMContentLoaded", function() {
  var currentStudents = [];

  // Tab switching
  var tabDash = document.getElementById("tab-dashboard");
  var tabDay1 = document.getElementById("tab-day1");
  var tabWarn = document.getElementById("tab-warnings");
  var tabAll = document.getElementById("tab-all");

  var btnDash = document.getElementById("tab-btn-dashboard");
  var btnDay1 = document.getElementById("tab-btn-day1");
  var btnWarn = document.getElementById("tab-btn-warnings");
  var btnAll = document.getElementById("tab-btn-all");

  function showTab(tab) {
    tabDash.style.display = tab === "dash" ? "block" : "none";
    tabDay1.style.display = tab === "day1" ? "block" : "none";
    tabWarn.style.display = tab === "warn" ? "block" : "none";
    tabAll.style.display = tab === "all" ? "block" : "none";

    btnDash.className = "tab-btn" + (tab === "dash" ? " active" : "");
    btnDay1.className = "tab-btn" + (tab === "day1" ? " active" : "");
    btnWarn.className = "tab-btn" + (tab === "warn" ? " active" : "");
    btnAll.className = "tab-btn" + (tab === "all" ? " active" : "");
  }

  btnDash.onclick = function() { showTab("dash"); };
  btnDay1.onclick = function() { showTab("day1"); renderDay1Students(); };
  btnWarn.onclick = function() { showTab("warn"); renderWarnings(); };
  btnAll.onclick = function() { showTab("all"); renderAllStudents(); };

  // Load Data
  function loadData() {
    chrome.storage.local.get(["cumulativeStudents", "lastSyncDate"], function(res) {
      currentStudents = res.cumulativeStudents || [];
      document.getElementById("display-date").innerText = res.lastSyncDate ? "آخر تحديث: " + res.lastSyncDate : "";
      renderStats();
      renderRecentAlerts();
    });
  }

  function renderStats() {
    var total = currentStudents.length;
    var d1 = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) < 3; }).length;
    var w3 = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) >= 3 && (s.unexcusedDaysCount || 0) < 5; }).length;
    var w5 = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) >= 5; }).length;

    document.getElementById("stat-total-students").innerText = String(total);
    document.getElementById("stat-day-1").innerText = String(d1);
    document.getElementById("stat-warn-3").innerText = String(w3);
    document.getElementById("stat-warn-5").innerText = String(w5);

    var totalWarnings = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) >= 3; }).length;
    document.getElementById("warnings-count-badge").innerText = totalWarnings + " طالب";
    document.getElementById("day1-count-badge").innerText = d1 + " طالب";
  }

  function getBadgeHtml(days) {
    if (days >= 15) return '<span class="st-badge badge-15">⛔ إنذار نهائي (' + days + ' يوم)</span>';
    if (days >= 10) return '<span class="st-badge badge-10">🔴 إحالة موجه طلابي (' + days + ' أيام)</span>';
    if (days >= 5) return '<span class="st-badge badge-5">🚨 إنذار 2 واستدعاء (' + days + ' أيام)</span>';
    if (days >= 3) return '<span class="st-badge badge-3">⚠️ إنذار 1 (' + days + ' أيام)</span>';
    return '<span class="st-badge badge-1">✓ غياب اليوم الأول (' + days + ' يوم)</span>';
  }

  function buildWhatsAppMsg(st) {
    var unexcused = st.unexcusedDaysCount || 0;
    var dates = (st.unexcusedDates || []).join("، ");
    var msg = "المكرم ولي أمر الطالب/ " + st.studentName + " المحترم\\n" +
              "السلام عليكم ورحمة الله وبركاته،،\\n\\n";

    if (unexcused <= 2) {
      msg += "نحيطكم علماً بأن ابنكم تغيب عن المدرسة اليوم (" + (dates || "تاريخ اليوم") + ")، نأمل موافاتنا بسبب الغياب وتقديم العذر المقبول حرصاً على انتظام مسيرته التعليمية وتفادي تراكم الغياب.\\n";
    } else {
      msg += "نحيطكم علماً بأن ابنكم تغيب عن المدرسة لعدد (" + unexcused + " أيام) بدون عذر مقبول، وتواريخ الغياب هي: [" + dates + "].\\n";
      if (unexcused >= 10) {
        msg += "نظراً لوصول غياب الطالب إلى (10 أيام)، فقد تم تحويل حالته للموجه الطلابي وتطبيق لائحة السلوك والمواظبة بحسم درجات المواظبة.\\n";
      } else if (unexcused >= 5) {
        msg += "نظراً لوصول غياب الطالب إلى (5 أيام)، نأمل مراجعة إدارة المدرسة والموجه الطلابي لتوقيع التعهد وتفادي استمرار الحسم.\\n";
      } else if (unexcused >= 3) {
        msg += "نظراً لوصول غياب الطالب إلى (3 أيام)، يرجى حث الطالب على الانتظام الدراسي تفادياً للإجراءات النظامية.\\n";
      }
    }
    msg += "\\nشاكرين ومقدرين حسن تعاونكم وحرصكم على مستقبل ابنكم.\\nإدارة المدرسة";
    return encodeURIComponent(msg);
  }

  // Render Day 1 and Day 2 Students
  function renderDay1Students() {
    var container = document.getElementById("day1-list");
    var list = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) < 3; });

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد حالات غياب في اليوم الأول أو الثاني حالياً.</div>';
      return;
    }

    var html = "";
    list.forEach(function(st) {
      var phoneClean = (st.phone || "").replace(/[^0-9]/g, "");
      if (phoneClean.startsWith("05")) phoneClean = "966" + phoneClean.substring(1);
      var waUrl = phoneClean ? "https://wa.me/" + phoneClean + "?text=" + buildWhatsAppMsg(st) : "";
      var datesList = (st.unexcusedDates || []).join(", ");

      html += '<div class="student-item">' +
        '<div class="st-header">' +
          '<span class="st-name">' + st.studentName + '</span>' +
          getBadgeHtml(st.unexcusedDaysCount || 1) +
        '</div>' +
        '<div class="st-meta">' +
          '<span>الصف: ' + (st.grade || "") + ' ' + (st.className ? " - فصل " + st.className : "") + '</span>' +
          '<span>• عدد الأيام: <strong>' + (st.unexcusedDaysCount || 1) + '</strong></span>' +
        '</div>' +
        (datesList ? '<div style="font-size:10px;color:#94a3b8;margin-top:2px;">📅 التواريخ: ' + datesList + '</div>' : '') +
        '<div class="st-actions" style="margin-top:6px;">' +
          (phoneClean ? '<a href="' + waUrl + '" target="_blank" class="btn-wa">💬 إرسال إشعار غياب اليوم لولي الأمر</a>' : '<span style="font-size:10px;color:#64748b;">(لا يوجد رقم جوال مسجل)</span>') +
          '<button class="btn-copy-st" data-name="' + st.studentName + '" data-days="' + (st.unexcusedDaysCount || 1) + '">📋 نسخ</button>' +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll(".btn-copy-st").forEach(function(btn) {
      btn.onclick = function() {
        var n = this.getAttribute("data-name");
        var d = this.getAttribute("data-days");
        navigator.clipboard.writeText("الطالب: " + n + " - غياب: " + d + " يوم");
        this.innerText = "✓ تم النسخ";
      };
    });
  }

  function renderWarnings() {
    var container = document.getElementById("warnings-list");
    var repeated = currentStudents.filter(function(s) { return (s.unexcusedDaysCount || 0) >= 3; });
    repeated.sort(function(a, b) { return (b.unexcusedDaysCount || 0) - (a.unexcusedDaysCount || 0); });

    if (repeated.length === 0) {
      container.innerHTML = '<div class="empty-state">ممتاز! لا يوجد طلاب تجاوزوا حدود الغياب المتكرر (3 أيام فأكثر).</div>';
      return;
    }

    var html = "";
    repeated.forEach(function(st) {
      var phoneClean = (st.phone || "").replace(/[^0-9]/g, "");
      if (phoneClean.startsWith("05")) phoneClean = "966" + phoneClean.substring(1);
      var waUrl = phoneClean ? "https://wa.me/" + phoneClean + "?text=" + buildWhatsAppMsg(st) : "";
      var datesList = (st.unexcusedDates || []).slice(0, 4).join(", ") + ((st.unexcusedDates || []).length > 4 ? "..." : "");

      html += '<div class="student-item">' +
        '<div class="st-header">' +
          '<span class="st-name">' + st.studentName + '</span>' +
          getBadgeHtml(st.unexcusedDaysCount || 0) +
        '</div>' +
        '<div class="st-meta">' +
          '<span>الصف: ' + (st.grade || "") + ' ' + (st.className ? " - فصل " + st.className : "") + (st.track ? " (" + st.track + ")" : "") + '</span>' +
          '<span>• غياب بدون عذر: <strong>' + (st.unexcusedDaysCount || 0) + '</strong></span>' +
          '<span>• نسبة الغياب: ' + (st.absenceRate || st.unexcusedDaysCount || 0) + '</span>' +
        '</div>' +
        (datesList ? '<div style="font-size:10px;color:#94a3b8;margin-top:4px;background:#0f172a;padding:4px 8px;border-radius:6px;">📅 تواريخ الغياب: ' + datesList + '</div>' : '') +
        '<div class="st-actions" style="margin-top:8px;">' +
          (phoneClean ? '<a href="' + waUrl + '" target="_blank" class="btn-wa">💬 إرسال إشعار إنذار واتساب لولي الأمر</a>' : '<span style="font-size:10px;color:#64748b;">(لا يوجد رقم جوال)</span>') +
          '<button class="btn-copy-st" data-name="' + st.studentName + '" data-days="' + st.unexcusedDaysCount + '">📋 نسخ بيانات الطالب</button>' +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll(".btn-copy-st").forEach(function(btn) {
      btn.onclick = function() {
        var n = this.getAttribute("data-name");
        var d = this.getAttribute("data-days");
        navigator.clipboard.writeText("الطالب: " + n + " - غياب متكرر: " + d + " أيام");
        this.innerText = "✓ تم النسخ";
      };
    });
  }

  function renderRecentAlerts() {
    var container = document.getElementById("recent-alerts-list");
    var recent = currentStudents.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد حالات غياب مسجلة حتى الآن.</div>';
      return;
    }

    var html = "";
    recent.forEach(function(st) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #334155;">' +
        '<span style="font-size:11px;font-weight:bold;color:#f8fafc;">' + st.studentName + '</span>' +
        getBadgeHtml(st.unexcusedDaysCount || 1) +
      '</div>';
    });
    container.innerHTML = html;
  }

  function renderAllStudents(filterText) {
    var container = document.getElementById("all-students-list");
    var list = currentStudents;
    if (filterText) {
      list = list.filter(function(s) {
        return (s.studentName || "").indexOf(filterText) > -1 || (s.nationalId || "").indexOf(filterText) > -1;
      });
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد نتائج مطابقة.</div>';
      return;
    }

    var html = "";
    list.forEach(function(st) {
      html += '<div class="student-item">' +
        '<div class="st-header">' +
          '<span class="st-name">' + st.studentName + '</span>' +
          getBadgeHtml(st.unexcusedDaysCount || 1) +
        '</div>' +
        '<div class="st-meta">' +
          '<span>سجل: ' + (st.nationalId || "-") + '</span>' +
          '<span>• غياب بدون عذر: ' + (st.unexcusedDaysCount || 1) + '</span>' +
          '<span>• بعذر: ' + (st.excusedDaysCount || 0) + '</span>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;
  }

  document.getElementById("search-student-input").oninput = function() {
    renderAllStudents(this.value.trim());
  };

  // Copy All to Abna
  document.getElementById("btn-popup-copy-all").onclick = function() {
    if (currentStudents.length === 0) {
      alert("⚠️ السجل فارغ حالياً.");
      return;
    }
    navigator.clipboard.writeText(JSON.stringify(currentStudents, null, 2)).then(function() {
      alert("✓ تم نسخ سجل الغياب الكامل (" + currentStudents.length + " طالب) لحافظة جهازك!\\n\\nافتح منصة أبناء واضغط على زر (لصق السجل من الإضافة).");
    });
  };

  // Multipage Auto-Scan from Active Tab
  var multiBtn = document.getElementById("btn-popup-multipage-now");
  if (multiBtn) {
    multiBtn.onclick = function() {
      var btn = this;
      btn.innerText = "جارِ السحب التلقائي لكافة الصفحات...";
      btn.disabled = true;

      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var tab = tabs[0];
        if (!tab || (tab.url.indexOf("noor.moe.gov.sa") === -1 && tab.url.indexOf("moe.gov.sa") === -1)) {
          alert("⚠️ يرجى فتح صفحة نظام نور (تقرير الغياب على مستوى الطالب) في التبويب النشط أولاً ثم إعادة المحاولة.");
          btn.innerText = "🚀 سحب تلقائي ذكي لجميع الصفحات من نور";
          btn.disabled = false;
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: function() {
            var btnInHud = document.getElementById("abna-hud-multipage-btn") || document.getElementById("abna-hud-update-btn");
            if (btnInHud) {
              btnInHud.click();
              return { triggered: true };
            }
            return { triggered: false };
          }
        }, function() {
          setTimeout(function() {
            loadData();
            btn.innerText = "✓ اكتمل السحب بنجاح!";
            btn.disabled = false;
          }, 3000);
        });
      });
    };
  }

  // Single Page Scan from Active Tab
  document.getElementById("btn-popup-update-now").onclick = function() {
    var btn = this;
    btn.innerText = "جارِ السحب والالتقاط من نور...";
    btn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      var tab = tabs[0];
      if (!tab || (tab.url.indexOf("noor.moe.gov.sa") === -1 && tab.url.indexOf("moe.gov.sa") === -1)) {
        alert("⚠️ يرجى فتح صفحة نظام نور (تقرير الغياب على مستوى الطالب أو تثبيت الغياب) في التبويب النشط أولاً.");
        btn.innerText = "⚡ سحب وحفظ الصفحة الحالية فقط";
        btn.disabled = false;
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: function() {
          var btnInHud = document.getElementById("abna-hud-update-btn");
          if (btnInHud) {
            btnInHud.click();
            return { triggered: true };
          }
          return { triggered: false };
        }
      }, function() {
        setTimeout(function() {
          loadData();
          btn.innerText = "✓ تم سحب الصفحة بنجاح!";
          btn.disabled = false;
        }, 1200);
      });
    });
  };

  // Clear data
  document.getElementById("btn-clear-data").onclick = function() {
    if (confirm("هل أنت متأكد من رغبتك في تصفير سجل الغياب وبدء فترة جديدة؟")) {
      chrome.storage.local.set({ cumulativeStudents: [], absenceHistory: [] }, function() {
        loadData();
        renderAllStudents();
        renderWarnings();
        renderDay1Students();
        chrome.runtime.sendMessage({ action: "updateBadge" });
      });
    }
  };

  loadData();
});
`;
  zip.file("popup.js", popupJs);

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Generates single file user script (for Tampermonkey / Violentmonkey)
 */
export function generateSingleFileUserScript(): string {
  return `// ==UserScript==
// @name         مساعد رصد وتحديث الغياب المتكرر بنظام نور - منصة أبناء
// @namespace    https://noor.moe.gov.sa/
// @version      3.5.0
// @description  رصد وتحديث غياب الطلاب يومياً بنظام نور، وكشف حالات الغياب المتكرر (3، 5، 10 أيام) مع ربط منصة أبناء
// @author       منصة أبناء
// @match        https://noor.moe.gov.sa/*
// @match        http://noor.moe.gov.sa/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  if (window.top !== window) return;

  function clean(str) {
    if (!str) return "";
    return String(str).replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").trim();
  }

  function extractDates(text) {
    if (!text) return [];
    var matches = text.match(/(?:14\\d{2}|20\\d{2})[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:14\\d{2}|20\\d{2})/g) || [];
    return matches.map(function(m) { return m.replace(/\\-/g, "/"); });
  }

  function extractFieldValue(label, text) {
    if (!text || text.indexOf(label) === -1) return "";
    var idx = text.indexOf(label);
    var sub = text.substring(idx + label.length);
    sub = sub.replace(/^[\\s:\\t-]+/, "");
    var endMatch = sub.match(/[\\n\\r\\t]|الصف|القسم|الفصل|النظام|تقرير|اسم/);
    if (endMatch && endMatch.index !== undefined && endMatch.index > 0) {
      sub = sub.substring(0, endMatch.index);
    }
    return clean(sub);
  }

  function getPageDate() {
    var d = "";
    var dateInputs = document.querySelectorAll("input[id*='Date'], input[id*='txtDate'], span[id*='Date'], select[id*='Date']");
    dateInputs.forEach(function(el) {
      if (d) return;
      var val = clean(el.value || el.innerText);
      var m = val.match(/(\\b(?:14\\d{2}|20\\d{2})[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}\\b|\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:14\\d{2}|20\\d{2})\\b)/);
      if (m) d = m[0].replace(/\\-/g, "/");
    });
    if (!d) {
      try {
        d = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      } catch(e) {
        d = new Date().toISOString().split("T")[0];
      }
    }
    return d;
  }

  function scanPageAbsences() {
    var pageDate = getPageDate();
    var allDocs = [document];
    var iframes = document.querySelectorAll("iframe, frame");
    for (var f = 0; f < iframes.length; f++) {
      try {
        var fDoc = iframes[f].contentDocument || iframes[f].contentWindow.document;
        if (fDoc && allDocs.indexOf(fDoc) === -1) allDocs.push(fDoc);
      } catch (e) {}
    }

    var absentees = [];
    var seen = new Set();

    // Strategy 1: Noor Student Absence Report
    allDocs.forEach(function(doc) {
      var bodyText = doc.body ? clean(doc.body.innerText) : "";
      var isStudentReport = bodyText.indexOf("تقرير الغياب على مستوى الطالب") > -1 || 
        (bodyText.indexOf("اسم الطالب") > -1 && (bodyText.indexOf("نوع الغياب") > -1 || bodyText.indexOf("نسبة غياب الطالب") > -1 || bodyText.indexOf("غياب الطالب") > -1));

      if (!isStudentReport) return;

      var globalGrade = extractFieldValue("الصف", bodyText);
      var globalClass = extractFieldValue("الفصل", bodyText);
      var globalTrack = extractFieldValue("القسم", bodyText);

      var allCells = Array.from(doc.querySelectorAll("td, th, span, div, p"));
      var nameLabels = allCells.filter(function(el) {
        var t = clean(el.innerText);
        return t === "اسم الطالب" || t === "اسم الطالب:" || (t.indexOf("اسم الطالب") === 0 && t.length < 50);
      });

      nameLabels.forEach(function(labelEl) {
        var stName = "";
        var labelText = clean(labelEl.innerText);

        if (labelText.indexOf(":") > -1) {
          var p = labelText.split(":");
          if (p[1] && p[1].trim().length > 3) stName = clean(p[1]);
        }

        if (!stName && labelEl.nextElementSibling) {
          stName = clean(labelEl.nextElementSibling.innerText);
        }

        if (!stName && labelEl.parentElement) {
          var rowCells = Array.from(labelEl.parentElement.querySelectorAll("td, th"));
          var idx = rowCells.indexOf(labelEl);
          if (idx > -1 && idx < rowCells.length - 1) {
            stName = clean(rowCells[idx + 1].innerText);
          }
        }

        if (!stName || stName.indexOf("اسم الطالب") > -1 || stName.length < 3) return;
        stName = stName.replace(/^[:\\s\\t-]+/, "").replace(/من تاريخ.*$/, "").trim();

        if (seen.has(stName)) return;
        seen.add(stName);

        var allTrs = Array.from(doc.querySelectorAll("tr"));
        var labelTr = labelEl.closest("tr");
        var sIdx = labelTr ? allTrs.indexOf(labelTr) : 0;
        var nextTr = null;
        for (var n = sIdx + 1; n < allTrs.length; n++) {
          if (allTrs[n].innerText.indexOf("اسم الطالب") > -1) {
            nextTr = allTrs[n];
            break;
          }
        }
        var eIdx = nextTr ? allTrs.indexOf(nextTr) : allTrs.length;
        var studentTrs = allTrs.slice(sIdx, eIdx);

        var unexcusedDates = [];
        var excusedDates = [];
        var absenceRate = "";
        var nationalId = "";

        studentTrs.forEach(function(row) {
          var rText = clean(row.innerText);
          
          if (/[12]\\d{9}/.test(rText) && !nationalId) {
            var mN = rText.match(/[12]\\d{9}/);
            if (mN) nationalId = mN[0];
          }

          if (rText.indexOf("نسبة غياب الطالب") > -1 || rText.indexOf("نسبة الغياب") > -1) {
            var parts = rText.split(/[\\t: ]+/);
            var rCandidates = parts.filter(function(x) { return x.indexOf("نسبة") === -1 && x.indexOf("غياب") === -1 && x.indexOf("الطالب") === -1 && clean(x).length > 0; });
            if (rCandidates.length > 0) absenceRate = clean(rCandidates[0]);
            return;
          }

          var rowDates = extractDates(rText);
          if (rowDates.length > 0) {
            if (rText.indexOf("من تاريخ") > -1 && rText.indexOf("الى تاريخ") > -1) return;
            var d = rowDates[0];
            if (rText.indexOf("بعذر") > -1 || rText.indexOf("عذر مقبول") > -1) {
              if (excusedDates.indexOf(d) === -1) excusedDates.push(d);
            } else if (rText.indexOf("بدون عذر") > -1 || rText.indexOf("غير مبرر") > -1 || rText.indexOf("غياب") > -1 || rText.indexOf("الأحد") > -1 || rText.indexOf("الإثنين") > -1 || rText.indexOf("الثلاثاء") > -1 || rText.indexOf("الأربعاء") > -1 || rText.indexOf("الخميس") > -1) {
              if (unexcusedDates.indexOf(d) === -1) unexcusedDates.push(d);
            }
          }
        });

        var unCount = unexcusedDates.length;
        var exCount = excusedDates.length;
        var totalAbs = unCount + exCount;
        if (!absenceRate) absenceRate = String(totalAbs || 1);

        absentees.push({
          rowElement: labelTr || doc.body,
          id: nationalId || ("noor_rep_" + Math.random().toString(36).substr(2, 8)),
          studentName: stName,
          nationalId: nationalId,
          grade: globalGrade || "الأول الثانوي",
          className: globalClass || "",
          track: globalTrack || "",
          phone: "",
          isReport: true,
          isExcused: exCount > 0 && unCount === 0,
          excusedDates: excusedDates,
          unexcusedDates: unexcusedDates,
          excusedDaysCount: exCount,
          unexcusedDaysCount: unCount > 0 ? unCount : (exCount === 0 ? 1 : 0),
          absenceRate: absenceRate,
          totalAbsent: totalAbs || 1,
          date: unexcusedDates[0] || excusedDates[0] || pageDate
        });
      });
    });

    // Strategy 2: Standard Daily Grid
    if (absentees.length === 0) {
      allDocs.forEach(function(doc) {
        var tables = doc.querySelectorAll("table, div[role='grid'], .ui-datatable, .dxgvTable");
        tables.forEach(function(tbl) {
          var rows = Array.from(tbl.querySelectorAll("tr, div[role='row']"));
          if (rows.length < 2) return;

          var headers = [];
          Array.from(rows[0].querySelectorAll("th, td")).forEach(function(th) {
            headers.push(clean(th.innerText));
          });

          for (var r = 1; r < rows.length; r++) {
            var row = rows[r];
            var cells = Array.from(row.querySelectorAll("td, th, div[role='gridcell']"));
            if (cells.length < 2) continue;

            var name = "";
            var nationalId = "";
            var grade = "";
            var className = "";
            var phone = "";
            var excused = false;
            var unexcused = false;

            row.querySelectorAll("select").forEach(function(sel) {
              var text = sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? clean(sel.options[sel.selectedIndex].text) : "";
              if (text.indexOf("بعذر") > -1 || text.indexOf("مقبول") > -1) excused = true;
              else if (text.indexOf("بدون") > -1 || text.indexOf("غير مبرر") > -1 || text === "غائب" || text === "غياب") unexcused = true;
            });

            row.querySelectorAll("input[type='radio']:checked, input[type='checkbox']:checked").forEach(function(chk) {
              var lbl = clean((chk.closest("label") || chk.parentElement || {}).innerText);
              if (lbl.indexOf("بعذر") > -1) excused = true;
              else if (lbl.indexOf("بدون") > -1 || lbl.indexOf("غائب") > -1 || (chk.id && chk.id.toLowerCase().indexOf("absent") > -1)) unexcused = true;
            });

            cells.forEach(function(c, cIdx) {
              var h = headers[cIdx] || "";
              var val = clean(c.innerText);

              if (/[12]\\d{9}/.test(val) && !nationalId) {
                var m = val.match(/[12]\\d{9}/);
                if (m) nationalId = m[0];
              }
              if (/^(05\\d{8}|9665\\d{8})$/.test(val.replace(/\\s+/g, "")) && !phone) {
                phone = val.replace(/\\s+/g, "");
              }
              if (!name && (h.indexOf("اسم") > -1 || h.indexOf("طالب") > -1)) {
                if (val.split(" ").length >= 2 && !/\\d{5,}/.test(val)) name = val;
              }
              if (h.indexOf("صف") > -1 || h.indexOf("مرحلة") > -1) grade = val;
              if (h.indexOf("فصل") > -1 || h.indexOf("شعبة") > -1) className = val;

              if (h.indexOf("حالة") > -1 || h.indexOf("الغياب") > -1) {
                if (val.indexOf("بعذر") > -1) excused = true;
                else if (val.indexOf("بدون") > -1 || val === "غائب" || val === "غياب") unexcused = true;
              }
            });

            if (!name) {
              cells.forEach(function(c) {
                if (name) return;
                var t = clean(c.innerText);
                if (/^[\\u0621-\\u064A\\s]{6,60}$/.test(t) && t.split(" ").length >= 2 && t.indexOf("الصف") === -1 && t.indexOf("غائب") === -1 && t.indexOf("حاضر") === -1) {
                  name = t;
                }
              });
            }

            if (name && (excused || unexcused)) {
              var k = (nationalId || name).trim();
              if (!seen.has(k)) {
                seen.add(k);
                absentees.push({
                  rowElement: row,
                  id: nationalId || ("st_" + Math.random().toString(36).substr(2, 7)),
                  studentName: name,
                  nationalId: nationalId,
                  grade: grade || "المرحلة الثانوية",
                  className: className || "",
                  phone: phone,
                  isExcused: excused,
                  excusedDates: excused ? [pageDate] : [],
                  unexcusedDates: unexcused ? [pageDate] : [],
                  excusedDaysCount: excused ? 1 : 0,
                  unexcusedDaysCount: unexcused ? 1 : 0,
                  absenceRate: "1",
                  totalAbsent: 1,
                  date: pageDate
                });
              }
            }
          }
        });
      });
    }

    return absentees;
  }

  function initHud() {
    if (document.getElementById("abna-noor-tamper-hud")) return;

    var hud = document.createElement("div");
    hud.id = "abna-noor-tamper-hud";
    hud.style.cssText = "position:fixed;bottom:25px;left:25px;z-index:999999999;background:#0f172a;color:#ffffff;border:2px solid #10b981;border-radius:24px;padding:14px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.8);font-family:Tahoma,Segoe UI,sans-serif;direction:rtl;text-align:right;min-width:280px;user-select:none;";

    hud.innerHTML = 
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<strong style="color:#34d399;font-size:14px;">⚡ مساعد الغياب المتكرر - أبناء</strong>' +
        '<button onclick="this.parentElement.parentElement.remove()" style="background:#1e293b;color:#94a3b8;border:none;border-radius:6px;padding:2px 6px;cursor:pointer;">✕</button>' +
      '</div>' +
      '<p style="font-size:11px;color:#cbd5e1;margin:0 0 10px 0;">تاريخ اليوم: ' + getPageDate() + '</p>' +
      '<button id="abna-tamper-scan" style="width:100%;background:#10b981;color:#022c22;border:none;border-radius:12px;padding:10px;font-weight:900;font-size:12px;cursor:pointer;">' +
        '⚡ تحديث ونسخ غياب اليوم لمنصة أبناء' +
      '</button>';

    document.body.appendChild(hud);

    document.getElementById("abna-tamper-scan").onclick = function() {
      var list = scanPageAbsences();
      if (list.length === 0) {
        alert("⚠️ لم يتم العثور على طلاب غائبين في هذه الصفحة.");
        return;
      }
      var out = list.map(function(s) {
        return {
          id: s.id,
          studentName: s.studentName,
          nationalId: s.nationalId,
          grade: s.grade,
          className: s.className,
          phone: s.phone,
          excusedDaysCount: s.isExcused ? 1 : 0,
          excusedDates: s.isExcused ? [s.date] : [],
          unexcusedDaysCount: !s.isExcused ? 1 : 0,
          unexcusedDates: !s.isExcused ? [s.date] : [],
          totalAbsent: 1,
          lastUpdated: new Date().toISOString(),
          source: "noor_tool"
        };
      });

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(JSON.stringify(out, null, 2)).then(function() {
          alert("✓ تم سحب ونسخ بيانات (" + out.length + ") طالب غائب بنجاح! افتح منصة أبناء واضغط على زر لصق.");
        });
      }
    };
  }

  setTimeout(initHud, 1500);
})();
`;
}
