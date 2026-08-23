/**
 * Comprehensive Noor System In-Browser Scraper & Console One-Liner
 * Fast, Robust, Zero-Dependency, Works Across All Noor ASP.NET / IFrame / GridView structures
 */

export const NOOR_CONSOLE_CODE = `(function() {
  try {
    function clean(str) {
      if (!str) return "";
      return String(str).replace(/[\\r\\n\\t]+/g, " ").replace(/\\s+/g, " ").trim();
    }

    function extractDates(txt) {
      if (!txt) return [];
      var regex = /(\\b(?:14\\d{2}|20\\d{2})[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}\\b|\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-](?:14\\d{2}|20\\d{2})\\b)/g;
      var matches = txt.match(regex);
      return matches ? matches.map(function(d) { return d.replace(/\\-/g, "/"); }) : [];
    }

    // 1. Gather all document frames
    var allDocs = [document];
    var iframes = document.querySelectorAll("iframe, frame");
    for (var f = 0; f < iframes.length; f++) {
      try {
        var fDoc = iframes[f].contentDocument || iframes[f].contentWindow.document;
        if (fDoc && allDocs.indexOf(fDoc) === -1) allDocs.push(fDoc);
      } catch (e) {}
    }

    // 2. Determine Date
    var pageDate = "";
    allDocs.forEach(function(doc) {
      if (pageDate) return;
      var dateInputs = doc.querySelectorAll("input[id*='Date'], input[id*='txtDate'], span[id*='Date'], select[id*='Date']");
      dateInputs.forEach(function(el) {
        if (pageDate) return;
        var val = clean(el.value || el.innerText);
        var m = extractDates(val);
        if (m.length > 0) pageDate = m[0];
      });
    });

    if (!pageDate) {
      try {
        pageDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      } catch(e) {
        pageDate = new Date().toISOString().split("T")[0];
      }
    }

    var students = [];
    var seen = new Set();

    // 3. Scan all tables in all frames
    allDocs.forEach(function(doc) {
      var tables = doc.querySelectorAll("table, div[role='grid'], .ui-datatable, .dxgvTable");
      tables.forEach(function(tbl) {
        var rows = Array.from(tbl.querySelectorAll("tr, div[role='row']"));
        if (rows.length < 2) return;

        var headers = [];
        var firstRow = rows[0];
        Array.from(firstRow.querySelectorAll("th, td")).forEach(function(th) {
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
          var excusedCount = 0;
          var excusedDates = [];
          var unexcusedCount = 0;
          var unexcusedDates = [];
          var isAbsent = false;

          // Check Select inputs (Dropdowns)
          row.querySelectorAll("select").forEach(function(sel) {
            var text = sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? clean(sel.options[sel.selectedIndex].text) : "";
            if (text.indexOf("بعذر") > -1 || text.indexOf("مقبول") > -1) {
              excusedCount = 1; excusedDates.push(pageDate); isAbsent = true;
            } else if (text.indexOf("بدون") > -1 || text.indexOf("غير مبرر") > -1 || text === "غائب" || text === "غياب") {
              unexcusedCount = 1; unexcusedDates.push(pageDate); isAbsent = true;
            }
          });

          // Check Checkboxes / Radios
          row.querySelectorAll("input[type='radio']:checked, input[type='checkbox']:checked").forEach(function(chk) {
            var lbl = clean((chk.closest("label") || chk.parentElement || {}).innerText);
            if (lbl.indexOf("بعذر") > -1) {
              excusedCount = 1; excusedDates.push(pageDate); isAbsent = true;
            } else if (lbl.indexOf("بدون") > -1 || lbl.indexOf("غائب") > -1 || (chk.id && chk.id.toLowerCase().indexOf("absent") > -1)) {
              unexcusedCount = 1; unexcusedDates.push(pageDate); isAbsent = true;
            }
          });

          // Scan cell contents
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
              if (val.indexOf("بعذر") > -1 || val.indexOf("مقبول") > -1) { excusedCount = Math.max(excusedCount, 1); isAbsent = true; }
              else if (val.indexOf("بدون") > -1 || val.indexOf("غير مبرر") > -1 || val === "غائب" || val === "غياب") { unexcusedCount = Math.max(unexcusedCount, 1); isAbsent = true; }
            }

            if (h.indexOf("بعذر") > -1 && h.indexOf("بدون") === -1) {
              var n = parseInt(val.replace(/[^0-9]/g, ""), 10);
              if (!isNaN(n) && n > 0) { excusedCount = n; var d = extractDates(val); if (d.length) excusedDates = d; isAbsent = true; }
            }

            if (h.indexOf("بدون عذر") > -1 || h.indexOf("غير مبرر") > -1) {
              var n2 = parseInt(val.replace(/[^0-9]/g, ""), 10);
              if (!isNaN(n2) && n2 > 0) { unexcusedCount = n2; var d2 = extractDates(val); if (d2.length) unexcusedDates = d2; isAbsent = true; }
            }
          });

          // Fallback name search
          if (!name) {
            cells.forEach(function(c) {
              if (name) return;
              var t = clean(c.innerText);
              if (/^[\\u0621-\\u064A\\s]{6,60}$/.test(t) && t.split(" ").length >= 2 && t.indexOf("الصف") === -1 && t.indexOf("غائب") === -1 && t.indexOf("حاضر") === -1) {
                name = t;
              }
            });
          }

          if (unexcusedCount > 0 && unexcusedDates.length === 0) unexcusedDates = [pageDate];
          if (excusedCount > 0 && excusedDates.length === 0) excusedDates = [pageDate];

          if (name && (isAbsent || excusedCount > 0 || unexcusedCount > 0)) {
            var k = (nationalId || name).trim();
            if (!seen.has(k)) {
              seen.add(k);
              students.push({
                id: nationalId || ("noor_" + Math.random().toString(36).substr(2, 8)),
                studentName: name,
                nationalId: nationalId,
                grade: grade || "المرحلة الثانوية",
                className: className || "",
                phone: phone || "",
                excusedDaysCount: excusedCount,
                excusedDates: excusedDates,
                unexcusedDaysCount: unexcusedCount > 0 ? unexcusedCount : (excusedCount === 0 ? 1 : 0),
                unexcusedDates: unexcusedDates.length > 0 ? unexcusedDates : (excusedCount === 0 ? [pageDate] : []),
                totalAbsent: (excusedCount + unexcusedCount) || 1,
                lastUpdated: new Date().toISOString(),
                source: "noor_tool"
              });
            }
          }
        }
      });
    });

    if (students.length === 0) {
      alert("⚠️ لم يتم العثور على طلاب مسجلين كغياب في هذه الصفحة.\\n\\nتأكد من فتح صفحة 'تثبيت الغياب اليومي' أو 'كشف الغياب' في نظام نور بعد تحديد الغائبين والضغط على بحث.");
      return;
    }

    var jsonStr = JSON.stringify(students, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr);
    }

    var oldBox = document.getElementById("abna-noor-quick-modal");
    if (oldBox) oldBox.remove();

    var box = document.createElement("div");
    box.id = "abna-noor-quick-modal";
    box.style.cssText = "position:fixed;top:30px;left:50%;transform:translateX(-50%);z-index:999999999;background:#0f172a;color:#ffffff;border:2px solid #10b981;border-radius:20px;padding:18px 24px;box-shadow:0 25px 60px rgba(0,0,0,0.85);font-family:Tahoma,sans-serif;direction:rtl;text-align:right;min-width:340px;max-width:90vw;";
    box.innerHTML = 
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="font-size:22px;">⚡</span>' +
          '<strong style="color:#34d399;font-size:15px;">تم سحب ونسخ بيانات (' + students.length + ') طالب غائب!</strong>' +
        '</div>' +
        '<button onclick="this.parentElement.parentElement.remove()" style="background:#334155;color:#fff;border:none;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:bold;">✕</button>' +
      '</div>' +
      '<p style="font-size:12px;color:#cbd5e1;margin:0 0 12px 0;line-height:1.5;">' +
        'تم نسخ كشف الغياب الكامل لحافظة جهازك تلقائياً. افتح منصة أبناء واضغط على زر <strong>"لصق ذكي"</strong>.' +
      '</p>' +
      '<button id="abna-noor-copy-again" style="width:100%;background:#10b981;color:#022c22;border:none;border-radius:12px;padding:10px;font-weight:bold;font-size:13px;cursor:pointer;">' +
        '📋 إعادة النسخ للحافظة' +
      '</button>';

    document.body.appendChild(box);
    document.getElementById("abna-noor-copy-again").onclick = function() {
      navigator.clipboard.writeText(jsonStr).then(function() {
        alert("✓ تم النسخ بنجاح!");
      });
    };

    console.log("[Noor Extractor] Successfully extracted " + students.length + " absent students.", students);
  } catch (err) {
    alert("حدث خطأ أثناء الفحص: " + err.message);
  }
})();`;

export const NOOR_BOOKMARKLET_URL = `javascript:${encodeURIComponent(NOOR_CONSOLE_CODE)}`;
export const NOOR_BOOKMARKLET_SOURCE = NOOR_CONSOLE_CODE;
