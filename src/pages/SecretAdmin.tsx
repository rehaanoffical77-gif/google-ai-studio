import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  KeyRound, 
  ChevronRight, 
  Utensils, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

export default function SecretAdmin() {
  const { isAdmin, login, verifyAndLoginAdminPasscode } = useAuth();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already admin, redirect to control panel immediately
  useEffect(() => {
    if (isAdmin) {
      navigate('/owner');
    }
  }, [isAdmin, navigate]);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Short timeout for high-end tactical terminal loading effect
    setTimeout(async () => {
      try {
        const success = await verifyAndLoginAdminPasscode(passcode);
        if (success) {
          navigate('/owner');
        } else {
          setError('ACCESS DENIED: INVALIID PASSCODE SIGNATURE');
          setPasscode('');
        }
      } catch (err) {
        console.error(err);
        setError('Verification failed');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login();
    } catch (err: any) {
      console.error('Google authorization error:', err);
      setError(err?.message || 'Authorization server timeout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background Ambience Dots */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      
      {/* Decorative colored glow spheres */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-red-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          Terminal Exit
        </button>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">Secure Node OS</span>
        </div>
      </header>

      {/* Center Console */}
      <main className="relative z-10 max-w-md w-full mx-auto my-auto py-12">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700/50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-950/20">
            <ShieldCheck size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-black italic uppercase tracking-tight bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent">
            Owner Access
          </h1>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.25em] mt-2">
            Rehaan Operational Gatekeeper
          </p>
        </motion.div>

        {/* Central Card with Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-slate-900/50 border border-slate-800/80 rounded-[32px] p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6"
        >
          {/* Section: Direct Google Verification */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
              Identity Protocol A
            </h3>
            
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-13 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-white/5 cursor-pointer disabled:opacity-50"
            >
              <img 
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                alt="Google" 
                className="w-4 h-4 shrink-0" 
              />
              Authentic Google Account
            </button>
            <p className="text-[9px] text-slate-400 text-center font-bold tracking-wide mt-1">
              For Rehaan's registered admin Gmail addresses
            </p>
          </div>

          {/* SaaS Divider */}
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative z-10 px-4 bg-slate-900 text-[10px] font-mono uppercase text-slate-600 tracking-widest">
              or
            </span>
          </div>

          {/* Section: Quick Passcode Override */}
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                Identity Protocol B (Passcode Bypass)
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="off"
                  required
                  disabled={loading}
                  className="w-full h-12 bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 text-sm font-bold text-center tracking-widest outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all text-white placeholder:text-slate-650"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-950/40 border border-red-900/50 rounded-2xl text-red-400 text-[10px] font-extrabold uppercase tracking-wider flex items-start gap-2"
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !passcode}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 cursor-pointer active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Verify Passcode 
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-slate-500">
          <Utensils size={12} />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Culinary Control Portal</span>
        </div>
        <p className="text-[9px] font-mono text-slate-600">
          SECURE ENCRYPTED NODE • PORT 3000 CONSOLE
        </p>
      </footer>
    </div>
  );
}
