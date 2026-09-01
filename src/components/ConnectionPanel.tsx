import React, { useState, useEffect } from "react";
import { Link2, Unlink, QrCode, Shield, CheckCircle2, Loader2, Smartphone, Copy, Check, RotateCcw, AlertTriangle, Key, ExternalLink, HelpCircle, Send, Sparkles } from "lucide-react";
import { WhatsAppConfig } from "../types";

interface ConnectionPanelProps {
  config: WhatsAppConfig;
  onUpdateConfig: (newConfig: Partial<WhatsAppConfig>) => void;
  onRefreshConfig: () => void;
}

export default function ConnectionPanel({ config, onUpdateConfig, onRefreshConfig }: ConnectionPanelProps) {
  const [activeTab, setActiveTab] = useState<"real" | "simulated" | "cloud_api">("real");
  const [realMethod, setRealMethod] = useState<"pairing_code" | "qr">("pairing_code");
  const [phoneNumberInput, setPhoneNumberInput] = useState("");
  const [cloudKey, setCloudKey] = useState("");
  const [phoneId, setPhoneId] = useState(config.cloudPhoneId || "");
  const [accountId, setAccountId] = useState(config.cloudAccountId || "");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Live Test Message State
  const [testPhoneInput, setTestPhoneInput] = useState("");
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [testSendResult, setTestSendResult] = useState<string | null>(null);
  const [testSendError, setTestSendError] = useState<string | null>(null);

  // Real WhatsApp polling state
  const [realStatus, setRealStatus] = useState<{
    status: string;
    qr: string;
    pairingCode: string;
    error: string;
    phone: string;
  }>({
    status: "disconnected",
    qr: "",
    pairingCode: "",
    error: "",
    phone: "",
  });

  const fetchRealStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/real/status");
      if (res.ok) {
        const data = await res.json();
        setRealStatus(data);
        
        if (data.status === "connected" && config.simulatedStatus !== "connected") {
          onRefreshConfig();
        }
      }
    } catch {
      // Quietly handle transient network hiccups during server restart/initialization
    }
  };

  useEffect(() => {
    fetchRealStatus();
    // Fast polling while connecting or waiting for scan/pairing (1200ms), standard otherwise (3000ms)
    const pollInterval = (realStatus.status === "connecting" || realStatus.status === "qr_ready" || realStatus.status === "pairing_code_ready") ? 1200 : 3000;
    const interval = setInterval(fetchRealStatus, pollInterval);
    return () => clearInterval(interval);
  }, [config.mode, activeTab, realStatus.status]);

  const handleSwitchMethod = (method: "pairing_code" | "qr") => {
    setRealMethod(method);
    if (realStatus.status === "error" || (realStatus.status === "qr_ready" && method === "pairing_code") || (realStatus.status === "pairing_code_ready" && method === "qr")) {
      setRealStatus(prev => ({ ...prev, status: "disconnected", error: "" }));
    }
  };

  const handleStartRealPairing = async (method: "pairing_code" | "qr") => {
    if (method === "pairing_code" && !phoneNumberInput.trim()) {
      alert("يرجى إدخال رقم جوالك الخاص بالواتساب أولاً لطلب رمز الربط.");
      return;
    }

    setIsActionLoading(true);
    setRealStatus(prev => ({ ...prev, status: "connecting", qr: "", pairingCode: "", error: "" }));
    
    try {
      const res = await fetch("/api/whatsapp/real/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          phone: phoneNumberInput.trim(),
          force: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRealStatus(prev => ({ ...prev, status: data.status, error: "" }));
        // Immediate follow-up status checks
        setTimeout(fetchRealStatus, 400);
        setTimeout(fetchRealStatus, 1000);
        setTimeout(fetchRealStatus, 2200);
        setTimeout(fetchRealStatus, 4000);
      }
    } catch (e) {
      console.error(e);
      setRealStatus(prev => ({ ...prev, status: "error", error: "فشل إرسال طلب الربط، يرجى المحاولة مرة أخرى." }));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetSession = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/real/reset", { method: "POST" });
      if (res.ok) {
        setRealStatus({ status: "disconnected", qr: "", pairingCode: "", error: "", phone: "" });
        onRefreshConfig();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnectReal = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/real/disconnect", { method: "POST" });
      if (res.ok) {
        setRealStatus({ status: "disconnected", qr: "", pairingCode: "", error: "", phone: "" });
        onRefreshConfig();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const normalizeArabicDigits = (str: string) => {
    return str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
  };

  const handleSendTestMessage = async () => {
    const target = testPhoneInput.trim() || realStatus.phone || config.simulatedPhone;
    if (!target) {
      setTestSendError("يرجى كتابة رقم الجوال لإرسال الرسالة التجريبية إليه.");
      return;
    }

    setIsTestingSend(true);
    setTestSendResult(null);
    setTestSendError(null);

    try {
      const res = await fetch("/api/whatsapp/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: target,
          message: `✨ رسالة اختبار وصول وتأكيد ربط من نظام الإرسال المدرسي الذكي.\nتم إرسال هذه الرسالة مباشرة وتأكيد استلامها.\nالوقت: ${new Date().toLocaleTimeString("ar-SA")}`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestSendResult(data.message || `تم إرسال الرسالة بنجاح إلى الرقم (+${target})! تفقد هاتفك الآن.`);
      } else {
        setTestSendError(data.error || "تعذر تسليم الرسالة التجريبية. تأكد من أن الرقم مسجل بواتساب.");
      }
    } catch (err: any) {
      setTestSendError(err.message || "حدث خطأ في الاتصال بالخادم.");
    } finally {
      setIsTestingSend(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (realStatus.pairingCode) {
      const cleanCode = realStatus.pairingCode.replace(/[^A-Za-z0-9]/g, "");
      navigator.clipboard.writeText(cleanCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleSaveCloudAPI = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const response = await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "cloud_api",
          cloudApiKey: cloudKey,
          cloudPhoneId: phoneId,
          cloudAccountId: accountId,
        }),
      });
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        onRefreshConfig();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSimulatedAction = async (action: "start_qr" | "confirm_scan" | "disconnect") => {
    setIsActionLoading(true);
    try {
      const payload: any = { action };
      if (action === "confirm_scan") {
        payload.phone = phoneNumberInput || "+966501234567";
      }
      
      const response = await fetch("/api/whatsapp/simulated/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        onRefreshConfig();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleModeSwitch = async (mode: "real" | "simulated" | "cloud_api") => {
    setActiveTab(mode);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      onRefreshConfig();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6" id="connection-panel">
      {/* Header and Mode selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-emerald-600" />
            ربط واتساب
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            قم بمسح رمز الاستجابة السريعة (QR Code) أو طلب رمز الربط لتوصيل جوالك والبدء بإرسال الرسائل والتنبيهات المدرسية مباشرة عبر رقمك الخاص.
          </p>
        </div>

        {/* Display only Direct Linking */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
          <div className="px-3.5 py-2 rounded-lg bg-white text-emerald-700 shadow-sm font-bold flex items-center gap-1.5 border border-slate-200/50">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            الربط المباشر
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Tips & Explanation */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/60 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-emerald-800 text-sm">أمان وخصوصية تامة</h3>
                <p className="text-emerald-700/80 text-xs mt-1 leading-relaxed">
                  يتم الاتصال مباشرة بين متصفحك وخوادم واتساب. يتم تشفير الرسائل بطريقة طرف-إلى-طرف (End-to-End Encryption) ولا يتم تخزين أي محادثات خاصة.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <h4 className="font-semibold text-slate-700 text-xs">طريقة الربط برمز التحقق (Pairing Code):</h4>
              <ol className="text-xs text-slate-600 flex flex-col gap-2 list-decimal list-inside leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <li>أدخل رقم جوالك واضغط على <b>طلب رمز الربط</b>.</li>
                <li>افتح تطبيق واتساب على هاتفك.</li>
                <li>انتقل إلى <b>الإعدادات &gt; الأجهزة المرتبطة &gt; ربط جهاز</b>.</li>
                <li>اختر من أسفل الشاشة <b>«الربط باستخدام رقم الهاتف بدلاً من ذلك»</b>.</li>
                <li>أدخل الرمز المكوّن من 8 خانات الظاهر في الشاشة.</li>
              </ol>
            </div>

          </div>

          {/* Connected Device Card */}
          {(realStatus.status === "connected" || config.simulatedStatus === "connected") && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">الحساب المرتبط حالياً 📱</h4>
                  <p className="text-slate-600 text-xs font-mono mt-0.5 font-bold">
                    {realStatus.phone ? `+${realStatus.phone}` : config.simulatedPhone || "متصل"}
                  </p>
                </div>
              </div>
              <button
                onClick={activeTab === "real" ? handleDisconnectReal : () => handleSimulatedAction("disconnect")}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                قطع الاتصال
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Action Panel */}
        <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-r border-slate-100 lg:pr-8 pt-6 lg:pt-0">
          
          {/* TAB 1: REAL WHATSAPP */}
          {activeTab === "real" && (
            <div className="flex flex-col gap-5">
              
              {/* Method Toggle */}
              {realStatus.status !== "connected" && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod("pairing_code")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      realMethod === "pairing_code"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    رمز الربط بالهاتف (Pairing Code)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMethod("qr")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      realMethod === "qr"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    مسح الباركود (QR Code)
                  </button>
                </div>
              )}

              {/* State 1: Disconnected / Input / Mode Switch */}
              {(realStatus.status === "disconnected" || 
                (realStatus.status === "qr_ready" && realMethod === "pairing_code") ||
                (realStatus.status === "pairing_code_ready" && realMethod === "qr")
              ) && (
                <div className="flex flex-col gap-4">
                  {realMethod === "pairing_code" ? (
                    <div className="flex flex-col gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          أدخل رقم جوالك المسجل في واتساب:
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          placeholder="مثال: 0501234567 أو 966501234567"
                          value={phoneNumberInput}
                          onChange={(e) => setPhoneNumberInput(normalizeArabicDigits(e.target.value))}
                          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          سيتم توليد كود مكوّن من 8 خانات لتدخله في تطبيق واتساب بجوالك فوراً.
                        </p>
                      </div>

                      <button
                        onClick={() => handleStartRealPairing("pairing_code")}
                        disabled={isActionLoading || !phoneNumberInput.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                        طلب رمز الربط (Pairing Code)
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                        <QrCode className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">توليد باركود الاستجابة السريعة (QR)</h3>
                        <p className="text-slate-500 text-xs mt-1 max-w-sm">
                          اضغط على الزر أدناه لبدء جلسة الواتساب وتوليد الباركود لمسحه بكاميرا الهاتف.
                        </p>
                      </div>
                      <button
                        onClick={() => handleStartRealPairing("qr")}
                        disabled={isActionLoading}
                        className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        توليد باركود QR الآن
                      </button>
                    </div>
                  )}

                  {/* Reset session button */}
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleResetSession}
                      disabled={isActionLoading}
                      className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-slate-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      إعادة تعيين الجلسة ومسح الذاكرة المؤقتة (Reset Session)
                    </button>
                  </div>
                </div>
              )}

              {/* State 2: Connecting / Loading */}
              {realStatus.status === "connecting" && (
                <div className="flex flex-col items-center justify-center text-center gap-4 py-10 bg-slate-50/50 rounded-2xl border border-slate-100 animate-fadeIn">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">جاري تهيئة الاتصال بخوادم واتساب...</h4>
                    <p className="text-slate-500 text-xs mt-1 max-w-xs mx-auto">
                      {realMethod === "pairing_code" 
                        ? "جاري طلب رمز التحقق المباشر من واتساب..."
                        : "جاري إنشاء وتجهيز باركود الاستجابة السريعة..."}
                    </p>
                  </div>
                  <button
                    onClick={handleResetSession}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1 mt-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    إلغاء وإعادة المحاولة
                  </button>
                </div>
              )}

              {/* State 3: Pairing Code Ready */}
              {realStatus.status === "pairing_code_ready" && realMethod === "pairing_code" && realStatus.pairingCode && (
                <div className="flex flex-col items-center text-center gap-5 bg-emerald-50/40 p-6 rounded-2xl border border-emerald-200 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="w-full">
                    <span className="text-xs font-bold text-emerald-800 block mb-3">
                      أدخل الرمز التالي في تطبيق واتساب بجوالك:
                    </span>
                    
                    {/* Character Boxes */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap mb-3" dir="ltr">
                      {(() => {
                        const clean = realStatus.pairingCode.replace(/[^A-Za-z0-9]/g, "");
                        const part1 = clean.slice(0, 4).split("");
                        const part2 = clean.slice(4, 8).split("");
                        return (
                          <>
                            {part1.map((char, idx) => (
                              <div
                                key={`p1-${idx}`}
                                className="w-9 h-12 sm:w-11 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold bg-white text-slate-900 border-2 border-emerald-500 rounded-xl shadow-sm select-all"
                              >
                                {char}
                              </div>
                            ))}
                            {part2.length > 0 && (
                              <span className="text-slate-400 font-bold text-xl px-1">-</span>
                            )}
                            {part2.map((char, idx) => (
                              <div
                                key={`p2-${idx}`}
                                className="w-9 h-12 sm:w-11 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold bg-white text-slate-900 border-2 border-emerald-500 rounded-xl shadow-sm select-all"
                              >
                                {char}
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={handleCopyPairingCode}
                        className="px-4 py-2 bg-white hover:bg-emerald-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        title="نسخ الرمز"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                        {isCopied ? "تم نسخ الرمز!" : "نسخ الرمز كاملاً"}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-emerald-100 text-right w-full text-xs text-slate-700 flex flex-col gap-2 shadow-xs">
                    <p className="font-bold text-emerald-800">خطوات تفعيل الرمز في هاتفك:</p>
                    <p>1. افتح واتساب &gt; <b>الإعدادات</b> &gt; <b>الأجهزة المرتبطة</b> &gt; <b>ربط جهاز</b>.</p>
                    <p>2. اضغط بالأسفل على <b>«الربط باستخدام رقم الهاتف بدلاً من ذلك»</b>.</p>
                    <p>3. أدخل هذا الرمز وسيتصل النظام تلقائياً خلال ثوانٍ معدودة.</p>
                  </div>

                  <button
                    onClick={handleResetSession}
                    className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    إلغاء وطلب رمز جديد
                  </button>
                </div>
              )}

              {/* State 4: QR Code Ready */}
              {realStatus.status === "qr_ready" && realMethod === "qr" && (
                <div className="flex flex-col items-center text-center gap-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">امسح الباركود بجوالك للربط المباشر</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full animate-pulse">
                      مباشر ومحدث
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-md">
                    {realStatus.qr ? (
                      <img
                        src={realStatus.qr}
                        alt="WhatsApp QR Code"
                        className="w-52 h-52 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    افتح واتساب على جوالك &gt; <b>الأجهزة المرتبطة</b> &gt; <b>ربط جهاز</b> &gt; وجّه كاميرا الجوال نحو هذا الباركود.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleStartRealPairing("qr")}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      تحديث الباركود (Refresh)
                    </button>
                    <button
                      onClick={handleResetSession}
                      className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      إعادة تعيين الجلسة
                    </button>
                  </div>
                </div>
              )}

              {/* State 5: Error Message */}
              {realStatus.status === "error" && (
                <div className="flex flex-col items-center text-center gap-4 bg-rose-50/70 p-6 rounded-2xl border border-rose-200 animate-fadeIn">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-900 text-sm">تنبيه أثناء الاتصال</h4>
                    <p className="text-rose-700 text-xs mt-1 max-w-sm">
                      {realStatus.error || "تعذر إكمال الاتصال بخوادم واتساب. يرجى تجربة خيار رمز الربط بالهاتف أو إعادة التعيين."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center w-full">
                    <button
                      onClick={() => {
                        setRealMethod("pairing_code");
                        handleResetSession();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      تجربة رمز الربط بالهاتف (Pairing Code)
                    </button>
                    <button
                      onClick={handleResetSession}
                      className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      إعادة تعيين الجلسة (Reset)
                    </button>
                  </div>
                </div>
              )}

              {/* State 6: Connected */}
              {realStatus.status === "connected" && (
                <div className="flex flex-col gap-5 animate-fadeIn">
                  <div className="flex flex-col items-center text-center gap-3 bg-emerald-50/70 p-6 rounded-2xl border border-emerald-200 shadow-xs">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200 shadow-xs">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">تم ربط حساب الواتساب بنجاح! 🎉</h3>
                      <p className="text-slate-500 text-xs mt-0.5">الرقم المتصل والجاهز للإرسال الفعلي:</p>
                      <p className="text-emerald-800 text-base font-bold font-mono mt-1 bg-white px-4 py-1 rounded-full border border-emerald-200 inline-block shadow-2xs">
                        +{realStatus.phone}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                      جهازك متصل ومستقر. جميع الرسائل والحملات الصادرة ستصل الآن مباشرة إلى أجهزة أولياء الأمور والمعلمين عبر هذا الرقم.
                    </p>
                  </div>

                  {/* Interactive Test Send Tool */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-800">اختبار إرسال رسالة فورية إلى هاتفك</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">لتأكيد وصول الرسائل لجهازك</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder={`مثال: 0501234567 أو ${realStatus.phone || "966500000000"}`}
                        value={testPhoneInput}
                        onChange={(e) => setTestPhoneInput(normalizeArabicDigits(e.target.value))}
                        className="w-full sm:flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        onClick={handleSendTestMessage}
                        disabled={isTestingSend}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isTestingSend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        إرسال رسالة تجريبية الآن
                      </button>
                    </div>

                    {testSendResult && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-fadeIn">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold">تم الإرسال بنجاح!</p>
                          <p className="text-[11px] text-emerald-700 mt-0.5">{testSendResult}</p>
                        </div>
                      </div>
                    )}

                    {testSendError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                        <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-bold">فشل الإرسال:</p>
                          <p className="text-[11px] text-rose-700 mt-0.5">{testSendError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: SIMULATED */}
          {activeTab === "simulated" && (
            <div className="flex flex-col gap-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">وضع المحاكاة التجريبي 🧪</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  يتيح لك هذا الوضع اختبار كافة مزايا النظام وإرسال الحملات وقراءة ملفات Excel بدون الحاجة إلى ربط هاتف فعلي.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <label className="block text-xs font-bold text-slate-700">رقم الهاتف التجريبي للظهور في النظام:</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="+966501234567"
                  value={phoneNumberInput || "+966501234567"}
                  onChange={(e) => setPhoneNumberInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleSimulatedAction("confirm_scan")}
                  disabled={isActionLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  تفعيل الاتصال التجريبي فوراً
                </button>
                <button
                  onClick={() => handleSimulatedAction("disconnect")}
                  disabled={isActionLoading}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  قطع الاتصال
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD API */}
          {activeTab === "cloud_api" && (
            <form onSubmit={handleSaveCloudAPI} className="flex flex-col gap-4 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">إعدادات WhatsApp Cloud API الرسمية (Meta)</h3>
                <p className="text-slate-500 text-xs mt-1">
                  أدخل بيانات حسابك المطور في Meta Business لإرسال الرسائل عبر البوابة الرسمية.
                </p>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Permanent Access Token:</label>
                  <input
                    type="password"
                    dir="ltr"
                    placeholder="EAABw..."
                    value={cloudKey}
                    onChange={(e) => setCloudKey(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number ID:</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="1029384756..."
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WABA Account ID:</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="5647382910..."
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors mt-2 cursor-pointer"
              >
                {isActionLoading ? "جاري الحفظ..." : "حفظ إعدادات Meta API"}
              </button>

              {saveSuccess && (
                <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs text-center font-bold">
                  تم حفظ إعدادات Cloud API بنجاح!
                </div>
              )}
            </form>
          )}

        </div>

      </div>
    </div>
  );
}

