import React, { useState, useEffect } from "react";
import { Link2, Unlink, QrCode, Globe, Shield, HelpCircle, CheckCircle2, Loader2, ArrowRight, Settings, Smartphone, Copy, Check } from "lucide-react";
import { WhatsAppConfig } from "../types";

interface ConnectionPanelProps {
  config: WhatsAppConfig;
  onUpdateConfig: (newConfig: Partial<WhatsAppConfig>) => void;
  onRefreshConfig: () => void;
}

export default function ConnectionPanel({ config, onUpdateConfig, onRefreshConfig }: ConnectionPanelProps) {
  const [activeTab, setActiveTab] = useState<"simulated" | "real" | "cloud_api">("real");
  const [cloudKey, setCloudKey] = useState("");
  const [phoneId, setPhoneId] = useState(config.cloudPhoneId || "");
  const [accountId, setAccountId] = useState(config.cloudAccountId || "");
  const [simulatedNum, setSimulatedNum] = useState("");
  const [qrProgress, setQrProgress] = useState(100);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Real WhatsApp polling state
  const [realStatus, setRealStatus] = useState<{ status: string; qr: string; phone: string }>({
    status: "disconnected",
    qr: "",
    phone: "",
  });

  useEffect(() => {
    let interval: any = null;
    
    const fetchRealStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp/real/status");
        if (res.ok) {
          const data = await res.json();
          setRealStatus(data);
          
          if (data.status === "connected" && config.simulatedStatus !== "connected" && config.mode === "real") {
            onRefreshConfig();
          }
        }
      } catch (err) {
        console.error("Error fetching real status:", err);
      }
    };

    fetchRealStatus();
    interval = setInterval(fetchRealStatus, 2500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [config.mode, activeTab]);

  const handleStartRealPairing = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/real/start", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setRealStatus(prev => ({ ...prev, status: data.status }));
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
        setRealStatus({ status: "disconnected", qr: "", phone: "" });
        onRefreshConfig();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  // New pairing method states (QR vs Phone Code)
  const [pairingMethod, setPairingMethod] = useState<"qr" | "phone_code">("qr");
  const [pairingCode, setPairingCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (config.mode !== "real") {
      handleModeSwitch("real");
    }
    setActiveTab("real");
    setPhoneId(config.cloudPhoneId);
    setAccountId(config.cloudAccountId);
  }, [config.mode]);

  // Handle QR Refresh countdown simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (config.simulatedStatus === "qr_ready") {
      setQrProgress(100);
      interval = setInterval(() => {
        setQrProgress((prev) => {
          if (prev <= 1) {
            // Simulate changing QR token
            return 100;
          }
          return prev - 1;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [config.simulatedStatus]);

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
        payload.phone = simulatedNum || "+966501234567";
      }
      
      const response = await fetch("/api/whatsapp/simulated/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        onRefreshConfig();
        // If we confirmed scan, trigger local state refresh after simulated server delay
        if (action === "confirm_scan") {
          setTimeout(() => {
            onRefreshConfig();
            setIsActionLoading(false);
          }, 2600);
          return;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (action !== "confirm_scan") {
        setIsActionLoading(false);
      }
    }
  };

  const handleModeSwitch = async (mode: "simulated" | "real" | "cloud_api") => {
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

  // Generate a random pairing code (e.g. G7T1-H8Y4)
  const handleGeneratePairingCode = () => {
    if (!simulatedNum) {
      alert("الرجاء إدخال رقم الجوال أولاً لطلب رمز الربط");
      return;
    }
    setIsActionLoading(true);
    setTimeout(() => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code1 = "";
      let code2 = "";
      for (let i = 0; i < 4; i++) {
        code1 += chars.charAt(Math.floor(Math.random() * chars.length));
        code2 += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setPairingCode(`${code1}-${code2}`);
      setIsActionLoading(false);
    }, 1200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
            قم بمسح رمز الاستجابة السريعة (QR Code) لتوصيل جوالك والبدء بإرسال الرسائل والتنبيهات المدرسية مباشرة عبر رقمك الخاص.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Connection Guidance / Left Side */}
        <div className="lg:col-span-5 flex flex-col gap-5 justify-between">
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/60 flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-emerald-800 text-sm">أمان وخصوصية تامة</h3>
                <p className="text-emerald-700/80 text-xs mt-1 leading-relaxed">
                  يتم الاتصال مباشرة بخوادم واتساب لضمان حماية بيانات طلابك وخصوصيتهم. لا نقوم بتخزين محتوى رسائلك أو وسائطك بشكل دائم.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-semibold text-slate-700 text-sm">كيف تعمل هذه الخطوة؟</h4>
              <ul className="text-xs text-slate-500 flex flex-col gap-2.5 list-disc list-inside leading-relaxed pr-1">
                <li>عند ربط الحساب، يقوم موقعنا بإرسال الأوامر بالنيابة عنك دون تدخل يدوي مستمر.</li>
                <li>تستطيع رفع ملفات Excel بها آلاف الأرقام وسيرسل النظام الرسائل تلقائياً وبفواصل زمنية لمنع الحظر.</li>
                <li>تأكد من بقاء حسابك متصلاً طوال فترة الإرسال لتحقيق أفضل النتائج.</li>
              </ul>
            </div>
          </div>

          {/* Connected Device Card */}
          {realStatus.status === "connected" && (
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">الحساب المرتبط حالياً 📱</h4>
                  <p className="text-slate-500 text-xs font-mono mt-0.5">+{realStatus.phone}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectReal}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                قطع الاتصال
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Action / Right Side */}
        <div className="lg:col-span-7 border-t lg:border-t-0 lg:border-r border-slate-100 lg:pr-8 pt-6 lg:pt-0">
          <div className="flex flex-col items-center justify-center text-center py-2">
            {realStatus.status === "disconnected" && (
              <div className="flex flex-col items-center gap-5 max-w-sm">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  <QrCode className="w-10 h-10 text-emerald-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    ربط حساب واتساب (الرقم الفعلي)
                  </h3>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                    هذا الخيار يتيح لك ربط رقم هاتفك الفعلي بالموقع عبر مسح رمز استجابة سريعة (QR Code) حقيقي من جوالك. سيقوم الموقع بإرسال الرسائل والتنبيهات المدرسية مباشرة بالنيابة عن رقمك!
                  </p>
                </div>
                <button
                  onClick={handleStartRealPairing}
                  disabled={isActionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  بدء وتوليد الرمز المباشر
                </button>
              </div>
            )}

            {realStatus.status === "connecting" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">جاري تشغيل بوابة الواتساب...</h4>
                  <p className="text-slate-400 text-xs mt-1">يرجى الانتظار لحين توليد الباركود الحقيقي من خوادم واتساب المباشرة</p>
                </div>
              </div>
            )}

            {realStatus.status === "qr_ready" && (
              <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-around animate-fade-in">
                
                {/* Step list for Real QR code pairing */}
                <div className="flex flex-col gap-3 text-right max-w-xs">
                  <span className="text-xs font-bold text-emerald-600 tracking-wider">خطوات الربط الحقيقي 📱</span>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span className="text-xs text-slate-600 leading-relaxed">افتح تطبيق واتساب على هاتفك.</span>
                    </div>
                    <div className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span className="text-xs text-slate-600 leading-relaxed">اضغط على <b>الأجهزة المرتبطة</b> ثم <b>ربط جهاز</b>.</span>
                    </div>
                    <div className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span className="text-xs text-slate-600 leading-relaxed">وجّه كاميرا الهاتف نحو الباركود المقابل لمسحه ضوئياً.</span>
                    </div>
                  </div>
                </div>

                {/* Real scanable QR code image */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative p-3 bg-white border border-slate-200 rounded-2xl shadow-md">
                    {/* Laser scanning effect */}
                    <div className="absolute left-3 right-3 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-bounce" style={{ top: '15%', animationDuration: '3s' }} />
                    
                    <div className="w-44 h-44 bg-white rounded-lg flex items-center justify-center relative overflow-hidden">
                      {realStatus.qr ? (
                        <img 
                          src={realStatus.qr} 
                          alt="WhatsApp pairing QR code" 
                          className="w-40 h-40 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium animate-pulse">يرجى مسح الرمز بجوالك الفعلي للربط المباشر</span>
                </div>

              </div>
            )}

            {realStatus.status === "connected" && (
              <div className="flex flex-col items-center gap-5 max-w-sm py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">تم ربط جهازك بنجاح! 🎉</h3>
                  <p className="text-slate-500 text-xs mt-1">الرقم المتصل حالياً بالفحص المباشر:</p>
                  <p className="text-emerald-600 text-base font-bold font-mono mt-2 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">+{realStatus.phone}</p>
                </div>
                <button
                  onClick={handleDisconnectReal}
                  disabled={isActionLoading}
                  className="mt-2 w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-xs py-2 px-4 rounded-xl border border-rose-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  فصل وإلغاء ربط الحساب الفعلي
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
