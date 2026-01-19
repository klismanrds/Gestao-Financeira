import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Wallet, ArrowRight, Loader2, Mail, Lock, User } from 'lucide-react';

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
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 relative overflow-hidden font-sans">
            {/* Background Decorative Elements - More sophisticated */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-gradient-to-br from-emerald-200/40 to-teal-200/40 rounded-full mix-blend-multiply filter blur-[80px] animate-pulse"></div>
                <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse [animation-delay:2s]"></div>
                <div className="absolute -bottom-48 left-1/4 w-[700px] h-[700px] bg-gradient-to-br from-rose-200/30 to-orange-200/30 rounded-full mix-blend-multiply filter blur-[120px] animate-pulse [animation-delay:4s]"></div>
            </div>

            <div className="bg-white/70 backdrop-blur-[20px] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] p-8 md:p-14 w-full max-w-lg border border-white/60 relative z-10 transition-all duration-500">

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_15px_30px_rgba(16,185,129,0.3)] transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                        <Wallet className="text-white drop-shadow-md" size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
                        Finanças <span className="text-emerald-600">rDs</span>
                    </h1>
                    <p className="text-slate-500 text-lg font-medium">
                        {isRegistering ? 'Crie sua conta para começar sua jornada' : 'Bem-vindo ao futuro da sua economia'}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-8 p-4 bg-rose-50/80 backdrop-blur-md border border-rose-100 rounded-2xl text-rose-600 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">

                    {isRegistering && (
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1 tracking-wide">Nome Completo</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors duration-300" size={22} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Como quer ser chamado?"
                                    required={isRegistering}
                                    className="w-full pl-14 pr-5 py-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1 tracking-wide">E-mail Corporativo ou Pessoal</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors duration-300" size={22} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="exemplo@rds.com"
                                required
                                className="w-full pl-14 pr-5 py-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-sm font-bold text-slate-700 tracking-wide">Sua Senha</label>
                            {!isRegistering && (
                                <button type="button" className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Esqueceu?</button>
                            )}
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors duration-300" size={22} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full pl-14 pr-5 py-4 bg-white/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-lg shadow-[0_10px_25px_rgba(0,0,0,0.15)] hover:shadow-[0_15px_35px_rgba(0,0,0,0.2)] transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-6"
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
                <div className="mt-10 text-center">
                    <p className="text-slate-500 font-semibold mb-3">
                        {isRegistering ? 'Já faz parte da nossa comunidade?' : 'Novo por aqui?'}
                    </p>
                    <button
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError(null);
                        }}
                        className="px-8 py-3 rounded-xl border-2 border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 font-bold transition-all duration-300"
                    >
                        {isRegistering ? 'Fazer login na conta' : 'Começar gratuitamente'}
                    </button>
                </div>

            </div>
        </div>
    );
}
