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
  HelpCircle
} from "lucide-react";
import { AppUser, SchoolSignatories } from "../types";

interface LoginScreenProps {
  users: AppUser[];
  signatories: SchoolSignatories;
  onLoginSuccess: (user: AppUser) => void;
}

export default function LoginScreen({ users, signatories, onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

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
        setErrorMsg("اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات والمحاولة مجدداً.");
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

  const handleFillDefaultAdmin = () => {
    const adminUser = users.find(u => u.role === "admin" && u.status === "active") || users[0];
    if (adminUser) {
      setUsername(adminUser.username);
      setPassword(adminUser.password);
      setErrorMsg("");
    } else {
      setUsername("admin");
      setPassword("123456");
      setErrorMsg("");
    }
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
                  placeholder="مثال: admin أو اسم المستخدم"
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

            {/* Remember Me Option */}
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
            </div>

            {/* Submit Button */}
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

          {/* Quick Helper for Default Admin Credentials */}
          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 sm:p-5 rounded-b-3xl text-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>بيانات دخول المدير الافتراضية:</span>
              </div>
              <button
                type="button"
                onClick={handleFillDefaultAdmin}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-100/70 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                id="btn-auto-fill-admin"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>ملء تلقائي</span>
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200/80 font-mono text-slate-600">
              <div>
                <span className="text-slate-400 font-sans ml-1">المستخدم:</span>
                <strong className="text-slate-800">admin</strong>
              </div>
              <div>
                <span className="text-slate-400 font-sans ml-1">كلمة المرور:</span>
                <strong className="text-slate-800">123456</strong>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">
              💡 يمكنك من خلال صفحة "إدارة" بعد الدخول إنشاء حسابات جديدة للمعلمين وتوليد كلمات مرور لهم وحظرهم أو تفعيلهم.
            </p>
          </div>

        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400 font-medium mt-6">
          نظام الإرسال المدرسي المعتمد لثانوية الأبناء الأولى © 2026
        </p>

      </div>

    </div>
  );
}
