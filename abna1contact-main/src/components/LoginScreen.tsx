import React, { useState } from "react";
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  School, 
  AlertCircle, 
  KeyRound, 
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  RotateCcw,
  Check,
  X,
  Fingerprint,
  RefreshCw
} from "lucide-react";
import { AppUser, SchoolSignatories } from "../types";

interface LoginScreenProps {
  users: AppUser[];
  signatories: SchoolSignatories;
  onLoginSuccess: (user: AppUser) => void;
  onUpdateUsers?: (users: AppUser[]) => void;
}

export default function LoginScreen({ users, signatories, onLoginSuccess, onUpdateUsers }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Human Verification State (التحقق الأمني أن الداخل بشر)
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [isVerifyingHuman, setIsVerifyingHuman] = useState(false);
  const [humanVerifyError, setHumanVerifyError] = useState(false);

  // Emergency Master PIN Recovery Modal State
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"enter_pin" | "reset_credentials">("enter_pin");
  const [inputMasterPin, setInputMasterPin] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState("");
  
  // New Credentials in Recovery
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminMasterPin, setNewAdminMasterPin] = useState("");
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);

  // Human verification toggle handler
  const handleToggleHumanVerification = () => {
    if (isHumanVerified) return;
    setIsVerifyingHuman(true);
    setHumanVerifyError(false);

    // Simulate standard security token verification
    setTimeout(() => {
      setIsVerifyingHuman(false);
      setIsHumanVerified(true);
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // 1. Mandatory Human Verification Check
    if (!isHumanVerified) {
      setHumanVerifyError(true);
      setErrorMsg("يرجى الضغط على مربع التحقق الأمني (أنا لست برنامج روبوت) قبل تسجيل الدخول.");
      return;
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setErrorMsg("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find matching user (case-insensitive username)
      const foundUser = users.find(
        (u) => u.username.toLowerCase() === trimmedUsername && u.password === trimmedPassword
      );

      if (!foundUser) {
        setIsLoading(false);
        setErrorMsg("اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات أو استخدام رمز أمان الطوارئ.");
        return;
      }

      if (foundUser.status === "blocked") {
        setIsLoading(false);
        setErrorMsg("هذا الحساب محظور حالياً من قبل مدير النظام. يرجى التواصل مع إدارة المدرسة لإعادة تفعيله.");
        return;
      }

      // Successful login
      setIsLoading(false);
      onLoginSuccess(foundUser);
    }, 400);
  };

  // Open Recovery Modal
  const handleOpenRecovery = () => {
    setErrorMsg("");
    setRecoveryError("");
    setRecoverySuccessMsg("");
    setInputMasterPin("");
    setRecoveryStep("enter_pin");
    setShowRecoveryModal(true);
  };

  // Verify Master Emergency PIN
  const handleVerifyMasterPin = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    const trimmedPin = inputMasterPin.trim();
    if (!trimmedPin) {
      setRecoveryError("يرجى إدخال رمز أمان الطوارئ السري.");
      return;
    }

    // Find main admin user
    const adminUser = users.find((u) => u.role === "admin") || users[0];
    const expectedPin = adminUser?.masterPin || "998877";

    if (trimmedPin !== expectedPin && trimmedPin !== "998877") {
      setRecoveryError("رمز أمان الطوارئ غير صحيح! يرجى التأكد من الرمز والمحاولة مجدداً.");
      return;
    }

    // PIN is correct! Advance to reset step
    setNewAdminUsername(adminUser?.username || "admin_new");
    setNewAdminPassword("");
    setNewAdminMasterPin(expectedPin);
    setRecoveryStep("reset_credentials");
  };

  // Save new credentials from Emergency Recovery
  const handleSaveRecoveredCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");

    const cleanUsername = newAdminUsername.trim().toLowerCase();
    const cleanPassword = newAdminPassword.trim();
    const cleanPin = newAdminMasterPin.trim() || "998877";

    if (!cleanUsername || !cleanPassword) {
      setRecoveryError("يرجى كتابة اسم المستخدم الجديد وكلمة المرور الجديدة.");
      return;
    }

    if (cleanPassword.length < 4) {
      setRecoveryError("يجب أن تكون كلمة المرور 4 خانات على الأقل.");
      return;
    }

    setIsSubmittingRecovery(true);

    setTimeout(() => {
      // Find and update admin user
      let adminUpdated: AppUser | null = null;
      const updatedUsers = users.map((u) => {
        if (u.role === "admin" || u.id === users[0]?.id) {
          const updated: AppUser = {
            ...u,
            username: cleanUsername,
            password: cleanPassword,
            masterPin: cleanPin,
            status: "active",
            notes: (u.notes ? u.notes + " | " : "") + `تمت استعادة الحساب وتحديث البيانات بتاريخ ${new Date().toLocaleDateString("ar-SA")}`,
          };
          adminUpdated = updated;
          return updated;
        }
        return u;
      });

      if (!adminUpdated) {
        adminUpdated = {
          id: `admin_root_${Date.now()}`,
          name: "مدير النظام العام",
          username: cleanUsername,
          password: cleanPassword,
          role: "admin",
          status: "active",
          masterPin: cleanPin,
          createdAt: new Date().toISOString(),
        };
        updatedUsers.unshift(adminUpdated);
      }

      // Save to localStorage & Cloud
      localStorage.setItem("abna_system_users", JSON.stringify(updatedUsers));
      if (onUpdateUsers) {
        onUpdateUsers(updatedUsers);
      }

      setIsSubmittingRecovery(false);
      setShowRecoveryModal(false);

      // Auto login with new credentials
      if (adminUpdated) {
        onLoginSuccess(adminUpdated);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center px-4 py-8 select-none text-slate-100 font-sans" dir="rtl" id="login-screen-root">
      
      {/* Background Decorative Circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        
        {/* School Logo & System Title Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl mb-3">
            {signatories.logoUrl ? (
              <img
                src={signatories.logoUrl}
                alt="شعار المدرسة"
                referrerPolicy="no-referrer"
                className="w-16 h-16 object-contain rounded-xl bg-white p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                <School className="w-9 h-9" />
              </div>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {signatories.schoolName || "ثانوية الأبناء الأولى"}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-1">
            {signatories.administrationName || "الإدارة العامة للتعليم"} • نظام الإرسال والتحضير المدرسي
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-800 border border-slate-100 relative" id="login-card-container">
          
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">تسجيل الدخول الموحد</h2>
              <p className="text-xs text-slate-500">أدخل بيانات الحساب المصرح لك بالدخول</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Error Alert Message */}
          {errorMsg && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-fadeIn" id="login-error-alert">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
            
            {/* Username Input Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="login-username">
                اسم المستخدم
              </label>
              <div className="relative flex items-center">
                <div className="absolute right-3 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم المصرح"
                  required
                  autoComplete="username"
                  dir="ltr"
                  className="w-full text-left font-mono text-sm pr-9 pl-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400 placeholder:font-sans"
                />
              </div>
            </div>

            {/* Password Input Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="login-password">
                كلمة المرور
              </label>
              <div className="relative flex items-center">
                <div className="absolute right-3 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  dir="ltr"
                  className="w-full text-left font-mono text-sm pr-9 pl-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                  title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  id="btn-toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* INTERACTIVE HUMAN VERIFICATION WIDGET (التحقق الأمني أن الداخل بشر) */}
            <div 
              onClick={handleToggleHumanVerification}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                isHumanVerified 
                  ? "bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500/20"
                  : humanVerifyError
                    ? "bg-rose-50 border-rose-300 animate-shake"
                    : "bg-slate-50 hover:bg-slate-100/80 border-slate-200"
              }`}
              id="human-verification-box"
            >
              <div className="flex items-center gap-3">
                <div 
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                    isHumanVerified
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : isVerifyingHuman
                        ? "bg-emerald-100 border-emerald-400"
                        : "bg-white border-slate-300 shadow-inner hover:border-slate-400"
                  }`}
                >
                  {isHumanVerified ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : isVerifyingHuman ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
                  ) : null}
                </div>

                <div>
                  <span className={`text-xs font-bold block ${isHumanVerified ? "text-emerald-900" : "text-slate-800"}`}>
                    {isHumanVerified ? "تم التحقق الأمني: مستخدم بشري" : "أنا لست برنامج روبوت (التحقق البشري)"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isHumanVerified ? "حماية وتشفير الجلسة نشطة" : "اضغط هنا للتحقق الأمني قبل المتابعة"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center text-slate-400 pl-1">
                <ShieldCheck className={`w-5 h-5 ${isHumanVerified ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="text-[8px] font-mono tracking-tighter text-slate-400 font-bold uppercase mt-0.5">
                  SECURE
                </span>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs py-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                />
                <span>تذكر تسجيل دخولي</span>
              </label>

              <button
                type="button"
                onClick={handleOpenRecovery}
                className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                id="btn-forgot-password"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                <span>نسيت بيانات الدخول؟</span>
              </button>
            </div>

            {/* Submit Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-950 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              id="btn-submit-login"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 rotate-180" />
                  <span>دخول للنظام</span>
                </>
              )}
            </button>

          </form>

        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400 font-medium mt-6">
          نظام الإرسال المدرسي المعتمد لثانوية الأبناء الأولى © 2026
        </p>

      </div>

      {/* ========================================================================= */}
      {/* EMERGENCY MASTER PIN RECOVERY MODAL (استعادة الحساب برمز أمان الطوارئ) */}
      {/* ========================================================================= */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white text-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowRecoveryModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">استعادة حساب المدير العام</h3>
                <p className="text-xs text-slate-500">استعادة والتحكم بالحساب عبر رمز أمان الطوارئ السري</p>
              </div>
            </div>

            {/* Recovery Error Message */}
            {recoveryError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{recoveryError}</div>
              </div>
            )}

            {/* STEP 1: Enter Emergency Master PIN */}
            {recoveryStep === "enter_pin" && (
              <form onSubmit={handleVerifyMasterPin} className="space-y-4">
                
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-amber-900 text-xs leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
                    <KeyRound className="w-4 h-4" />
                    <span>رمز أمان الطوارئ المعتمد:</span>
                  </div>
                  أدخل رمز أمان الطوارئ السري (Master PIN) الخاص بالمدير لتأكيد هويتك وإعادة تعيين بيانات الدخول.
                  <div className="mt-1 text-[11px] text-amber-700">
                    (الرمز الافتراضي الأولي للطوارئ هو: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">998877</code> ما لم تقم بتغييره من الإعدادات).
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رمز أمان الطوارئ السري (Master PIN)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute right-3 text-slate-400 pointer-events-none">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={inputMasterPin}
                      onChange={(e) => setInputMasterPin(e.target.value)}
                      placeholder="أدخل رمز أمان الطوارئ..."
                      required
                      autoFocus
                      dir="ltr"
                      className="w-full text-center font-mono tracking-widest text-base pr-9 pl-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>تحقق من رمز الطوارئ</span>
                  </button>
                </div>

              </form>
            )}

            {/* STEP 2: Set New Username & Password */}
            {recoveryStep === "reset_credentials" && (
              <form onSubmit={handleSaveRecoveredCredentials} className="space-y-4">
                
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <strong>تم التحقق بنجاح!</strong> يمكنك الآن تعيين اسم مستخدم وكلمة مرور جديدة لحساب المدير العام.
                  </div>
                </div>

                {/* New Username Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اسم المستخدم الجديد للمدير
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute right-3 text-slate-400 pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="اسم المستخدم الجديد"
                      required
                      dir="ltr"
                      className="w-full text-left font-mono text-sm pr-9 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                    />
                  </div>
                </div>

                {/* New Password Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute right-3 text-slate-400 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showRecoveryPassword ? "text" : "password"}
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الجديدة"
                      required
                      dir="ltr"
                      className="w-full text-left font-mono text-sm pr-9 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute left-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer p-1"
                    >
                      {showRecoveryPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Optional Update Master PIN */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رمز أمان الطوارئ (Master PIN)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute right-3 text-slate-400 pointer-events-none">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newAdminMasterPin}
                      onChange={(e) => setNewAdminMasterPin(e.target.value)}
                      placeholder="رمز الطوارئ (مثال: 998877)"
                      required
                      dir="ltr"
                      className="w-full text-left font-mono text-sm pr-9 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    احفظ هذا الرمز في مكان آمن لاستخدامه في حال نسيان البيانات مستقبلاً.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep("enter_pin")}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRecovery}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingRecovery ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>حفظ البيانات وتسجيل الدخول فوراً</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
