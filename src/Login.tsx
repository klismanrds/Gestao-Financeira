import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { ArrowRight, Loader2, Mail, Lock, User } from 'lucide-react';

export default function Login() {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For registration
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isRegistering) {
                // Register
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name,
                        }
                    }
                });
                if (signUpError) throw signUpError;
            } else {
                // Login
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
            }
            // Success is handled by onAuthStateChange in App.tsx
        } catch (err: any) {
            console.error("Auth error:", err);
            let msg = err.message || "Ocorreu um erro. Tente novamente.";
            // Translate common Supabase errors if necessary
            if (msg.includes("Invalid login credentials")) msg = "E-mail ou senha incorretos.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden font-sans">
            {/* Background Image with Transparency for Modern Look */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/imagen-fundo.jpg"
                    alt="Background"
                    className="w-full h-full object-cover opacity-40 scale-105 animate-slow-zoom"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-900/60 blur-[2px]"></div>
            </div>

            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-1">
                <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full mix-blend-screen filter blur-[80px] animate-pulse"></div>
                <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse [animation-delay:2s]"></div>
                <div className="absolute -bottom-48 left-1/4 w-[700px] h-[700px] bg-gradient-to-br from-rose-500/20 to-orange-500/20 rounded-full mix-blend-screen filter blur-[120px] animate-pulse [animation-delay:4s]"></div>
            </div>

            <div className="bg-white/30 backdrop-blur-[35px] rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-8 md:p-14 w-full max-w-lg border border-white/30 relative z-10 transition-all duration-700 hover:shadow-emerald-500/10 active:scale-[0.99]">

                {/* Header with Custom Logo - Simplified */}
                <div className="text-center mb-12">
                    <div className="relative inline-block mb-8">
                        <img
                            src="/logo-rds.png"
                            alt="rDs Logo"
                            className="w-32 h-32 object-contain rounded-[2rem] shadow-2xl"
                        />
                    </div>

                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4 drop-shadow-sm">
                        Finanças <span className="text-emerald-400">rDs</span>
                    </h1>
                    <p className="text-emerald-50/90 text-lg font-bold tracking-tight">
                        {isRegistering ? 'Crie sua conta para começar sua jornada' : 'Gerenciando o seu financeiro'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-8 p-4 bg-rose-500/20 backdrop-blur-xl border border-rose-500/30 rounded-2xl text-rose-100 text-sm font-bold flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-7">

                    {isRegistering && (
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-emerald-100/70 uppercase tracking-widest ml-1">Nome Completo</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-100/50 group-focus-within:text-emerald-400 transition-colors duration-300" size={22} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Como quer ser chamado?"
                                    required={isRegistering}
                                    className="w-full pl-14 pr-5 py-4.5 bg-white/10 border border-white/20 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-300 font-bold text-white placeholder:text-white/30 shadow-inner"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-emerald-100/70 uppercase tracking-widest ml-1">E-mail</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-100/50 group-focus-within:text-emerald-400 transition-colors duration-300" size={22} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="exemplo@rds.com"
                                required
                                className="w-full pl-14 pr-5 py-4.5 bg-white/10 border border-white/20 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-300 font-bold text-white placeholder:text-white/30 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[11px] font-black text-emerald-100/70 uppercase tracking-widest">Sua Senha</label>
                            {!isRegistering && (
                                <button type="button" className="text-xs font-black text-emerald-400 hover:text-emerald-300 transition-colors">Esqueceu?</button>
                            )}
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-100/50 group-focus-within:text-emerald-400 transition-colors duration-300" size={22} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full pl-14 pr-5 py-4.5 bg-white/10 border border-white/20 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-300 font-bold text-white placeholder:text-white/30 shadow-inner"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-lg shadow-[0_10px_35px_rgba(16,185,129,0.3)] hover:shadow-emerald-500/40 transition-all duration-500 transform active:scale-[0.97] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-8"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                {isRegistering ? 'Criar minha conta agora' : 'Entrar no Finanças rDs'}
                                <ArrowRight size={22} />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-12 text-center border-t border-white/10 pt-10">
                    <p className="text-emerald-100/60 font-bold mb-4 text-sm">
                        {isRegistering ? 'Já faz parte da nossa comunidade?' : 'Novo por aqui?'}
                    </p>
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                        }}
                        className="w-full px-8 py-4 rounded-2xl border-2 border-white/20 hover:border-emerald-400/50 hover:bg-white/5 text-white font-black transition-all duration-500"
                    >
                        {isRegistering ? 'Fazer login na conta' : 'Começar gratuitamente'}
                    </button>
                </div>

            </div>
        </div>
    );
}
