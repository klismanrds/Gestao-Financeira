import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Sparkles,
  Bot,
  Lightbulb,
  X,
  Settings,
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import Login from './Login';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- Gemini API ---
const callGemini = async (prompt: string) => {
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};

// --- Types ---
type TransactionType = 'income' | 'expense';

interface Transaction {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO String
  created_at: string;
  installment_current?: number;
  installment_total?: number;
  is_auto_salary?: boolean;
}

interface SalaryConfig {
  enabled: boolean;
  amount: number;
  day: number;
}

// --- UI Components ---
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${className}`}>
    {children}
  </div>
);

const Badge = ({ type }: { type: TransactionType }) => {
  const isIncome = type === 'income';
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}>
      {isIncome ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isIncome ? 'Receita' : 'Despesa'}
    </span>
  );
};

export default function FinanceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('Outros');

  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [monthsToRepeat, setMonthsToRepeat] = useState('2');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI State
  const [smartInput, setSmartInput] = useState('');
  const [isProcessingSmart, setIsProcessingSmart] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [showSmartInput, setShowSmartInput] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>({ enabled: false, amount: 0, day: 5 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Categories
  const categories = [
    'Habitação', 'Alimentação', 'Transporte', 'Lazer', 'Saúde',
    'Educação', 'Salário', 'Investimentos', 'Cartão de Crédito', 'Outros'
  ];

  // 1. Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load Data (Transactions & Settings)
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Transactions
      const { data: transactionsData, error: tError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (tError) {
        console.error("Error fetching transactions:", tError);
      } else {
        setAllTransactions(transactionsData || []);
      }

      // Settings
      const { data: settingsData, error: sError } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsData) {
        setSalaryConfig({
          enabled: settingsData.salary_enabled,
          amount: settingsData.salary_amount,
          day: settingsData.salary_day
        });
      }
    };

    fetchData();
  }, [user]);

  // 3. Auto Salary Logic (Client-side generation for simplicity, though scheduled function is better)
  useEffect(() => {
    if (!user || !salaryConfig.enabled || !salaryConfig.amount || loading) return;

    const checkAndGenerateSalary = async () => {
      const now = new Date();
      const currentDay = now.getDate();

      if (currentDay >= salaryConfig.day) {
        // Check if salary for this month/year already exists
        const alreadyExists = allTransactions.some(t => {
          if (!t.is_auto_salary) return false;
          const tDate = new Date(t.date);
          // Use UTC or local handling consistently. Assuming local for simplicity.
          return tDate.getMonth() === now.getMonth() &&
            tDate.getFullYear() === now.getFullYear();
        });

        if (!alreadyExists) {
          console.log("Generating auto salary...");
          try {
            const targetDate = new Date(now.getFullYear(), now.getMonth(), salaryConfig.day);

            const { data, error } = await supabase.from('transactions').insert({
              user_id: user.id,
              description: 'Salário Mensal (Automático)',
              amount: salaryConfig.amount,
              type: 'income',
              category: 'Salário',
              date: targetDate.toISOString(),
              is_auto_salary: true
            }).select();

            if (data) {
              setAllTransactions(prev => [data[0], ...prev]);
            }
          } catch (err) {
            console.error("Error generating salary:", err);
          }
        }
      }
    };

    checkAndGenerateSalary();
  }, [user, salaryConfig, allTransactions, loading]);

  // --- Logic ---

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingSettings(true);
    try {
      // Upsert settings
      const { error } = await supabase.from('settings').upsert({
        user_id: user.id,
        salary_enabled: salaryConfig.enabled,
        salary_amount: salaryConfig.amount,
        salary_day: salaryConfig.day
      });

      if (error) throw error;

      setShowSettings(false);
      alert("Configurações salvas com sucesso!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      alert("Erro ao salvar configurações.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("Erro: Usuário não autenticado.");
      return;
    }
    if (!description || !amount) return;

    setIsSubmitting(true);
    try {
      const val = parseFloat(amount.replace(',', '.'));
      if (isNaN(val) || val <= 0) return;

      const numMonths = isRecurring ? parseInt(monthsToRepeat) : 1;
      const newTransactions = [];

      for (let i = 0; i < numMonths; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);

        const newTx = {
          user_id: user.id,
          description: isRecurring ? `${description} (${i + 1}/${numMonths})` : description,
          amount: val,
          type,
          category,
          date: d.toISOString(),
          installment_current: isRecurring ? i + 1 : undefined,
          installment_total: isRecurring ? numMonths : undefined
        };
        newTransactions.push(newTx);
      }

      const { data, error } = await supabase.from('transactions').insert(newTransactions).select();

      if (error) throw error;

      if (data) {
        setAllTransactions(prev => [...data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }

      setDescription('');
      setAmount('');
      setCategory('Outros');
      setIsRecurring(false);
      setMonthsToRepeat('2');
      setSmartInput('');
      setShowSmartInput(false);
    } catch (err: any) {
      console.error("Error adding:", err);
      alert("Erro ao salvar lançamento: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setAllTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- Filters ---

  const changeMonth = (increment: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setCurrentDate(newDate);
    setAiAdvice(null);
  };

  const currentMonthName = useMemo(() => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentDate.getMonth() &&
        tDate.getFullYear() === currentDate.getFullYear();
    });
  }, [allTransactions, currentDate]);

  const accumulatedBalance = useMemo(() => {
    // Sum everything up to end of current month
    return allTransactions.reduce((acc, curr) => {
      if (!curr.date) return acc;
      const tDate = new Date(curr.date);
      const limitDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      if (tDate <= limitDate) {
        if (curr.type === 'income') {
          return acc + curr.amount;
        } else {
          return acc - curr.amount;
        }
      }
      return acc;
    }, 0);
  }, [allTransactions, currentDate]);

  const monthlySummary = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') {
        acc.income += curr.amount;
        acc.total += curr.amount;
      } else {
        acc.expense += curr.amount;
        acc.total -= curr.amount;
      }
      return acc;
    }, { income: 0, expense: 0, total: 0 });
  }, [filteredTransactions]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // --- Gemini AI ---

  const handleSmartEntry = async () => {
    if (!smartInput.trim()) return;
    setIsProcessingSmart(true);

    const prompt = `
      Você é um assistente financeiro. Extraia os dados desta frase de transação: "${smartInput}".
      Responda APENAS um JSON válido (sem markdown) com este formato:
      {
        "description": "descrição curta e clara",
        "amount": número (use ponto para decimal),
        "type": "income" ou "expense" (padrão expense se não claro),
        "category": "uma destas: ${categories.join(', ')}" (escolha a mais adequada ou 'Outros')
      }
    `;

    try {
      const result = await callGemini(prompt);
      if (result) {
        const cleanJson = result.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        if (data.description) setDescription(data.description);
        if (data.amount) setAmount(data.amount.toString());
        if (data.type) setType(data.type);
        if (data.category) setCategory(data.category);
        setShowSmartInput(false);
      }
    } catch (e) {
      console.error("AI Error", e);
      alert("Não consegui entender a frase. Tente novamente.");
    } finally {
      setIsProcessingSmart(false);
    }
  };

  const handleGenerateAdvice = async () => {
    setIsLoadingAdvice(true);

    const financialData = {
      month: currentMonthName,
      accumulatedBalance: accumulatedBalance,
      monthlySummary: monthlySummary,
      topTransactions: filteredTransactions
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map(t => ({ desc: t.description, val: t.amount, cat: t.category, type: t.type }))
    };

    const prompt = `
      Atue como um consultor financeiro pessoal amigável e sábio.
      Analise estes dados financeiros do usuário para o mês de ${currentMonthName}:
      ${JSON.stringify(financialData)}
      
      Considere o saldo acumulado (accumulatedBalance) como o dinheiro real disponível, e o monthlySummary como o desempenho deste mês específico.
      
      Forneça:
      1. Uma breve análise da saúde financeira (máximo 2 frases).
      2. Dois conselhos práticos ou observações sobre os gastos (ex: gastou muito em lazer, parabéns por economizar, etc).
      
      Mantenha o tom encorajador e use emojis. Responda em Português do Brasil.
      Não use formatação Markdown complexa, apenas texto corrido e parágrafos.
    `;

    const result = await callGemini(prompt);
    setAiAdvice(result);
    setIsLoadingAdvice(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin text-green-600">
          <PieChart size={40} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 relative">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="text-green-600" />
              Configurar Salário
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="font-semibold text-green-900">Salário Automático</label>
                  <button
                    type="button"
                    onClick={() => setSalaryConfig({ ...salaryConfig, enabled: !salaryConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${salaryConfig.enabled ? 'bg-green-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${salaryConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <p className="text-xs text-green-700 leading-relaxed">
                  Quando ativado, o sistema lançará automaticamente o valor do seu salário no dia escolhido, todos os meses.
                </p>
              </div>

              <div className={`space-y-4 transition-all duration-300 ${salaryConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Dia do Recebimento</label>
                  <select
                    value={salaryConfig.day}
                    onChange={(e) => setSalaryConfig({ ...salaryConfig, day: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Dia {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Valor do Salário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salaryConfig.amount}
                    onChange={(e) => setSalaryConfig({ ...salaryConfig, amount: parseFloat(e.target.value) })}
                    placeholder="Ex: 3500.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-all"
              >
                {isSavingSettings ? 'Salvando...' : (
                  <>
                    <Save size={18} /> Salvar Configuração
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-600 p-2 rounded-lg text-white">
                <Wallet size={24} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 hidden sm:block">Finanças BR <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded-full ml-2">AI Powered ✨</span></h1>
            </div>

            {/* Month Selector */}
            <div className="flex items-center bg-slate-100 rounded-full p-1 shadow-inner">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-full transition-all text-slate-600">
                <ChevronLeft size={20} />
              </button>
              <span className="w-32 sm:w-40 text-center font-bold text-slate-700 capitalize text-sm sm:text-base select-none">
                {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-full transition-all text-slate-600">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                title="Configurações"
              >
                <Settings size={22} />
              </button>

              <div className="hidden sm:flex flex-col items-end border-r pr-3 border-slate-200 mr-1">
                <span className="text-xs font-bold text-slate-700">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-rose-500 font-bold hover:underline"
                >
                  SAIR
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Summary & AI */}
        <div className="space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-600 to-emerald-700 text-white border-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign size={100} />
              </div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <p className="text-green-100 text-sm font-medium">Saldo Acumulado</p>
                  <h2 className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(accumulatedBalance)}</h2>
                </div>
              </div>
              <div className="text-sm text-green-100 relative z-10 flex flex-col gap-1">
                <div className="flex items-center gap-2 opacity-90">
                  {accumulatedBalance >= 0 ? 'Conta no azul' : 'Conta no vermelho'}
                </div>
                {/* Month Indicator */}
                <div className="mt-2 pt-2 border-t border-white/20 text-xs font-medium flex justify-between items-center">
                  <span>Resultado de {currentDate.toLocaleString('pt-BR', { month: 'short' })}:</span>
                  <span className={monthlySummary.total >= 0 ? 'text-emerald-200' : 'text-rose-200'}>
                    {monthlySummary.total > 0 ? '+' : ''}{formatCurrency(monthlySummary.total)}
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <span className="text-slate-500 text-sm font-medium">Receitas ({currentDate.getMonth() + 1})</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{formatCurrency(monthlySummary.income)}</h2>
            </Card>

            <Card>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <TrendingDown size={20} />
                </div>
                <span className="text-slate-500 text-sm font-medium">Despesas ({currentDate.getMonth() + 1})</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{formatCurrency(monthlySummary.expense)}</h2>
            </Card>
          </section>

          {/* AI Advisor Card */}
          <div className="w-full">
            {!aiAdvice ? (
              <button
                onClick={handleGenerateAdvice}
                disabled={isLoadingAdvice}
                className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 p-4 rounded-xl flex items-center justify-center gap-2 transition-all group"
              >
                {isLoadingAdvice ? (
                  <span className="animate-pulse">Analisando suas finanças...</span>
                ) : (
                  <>
                    <Bot className="group-hover:scale-110 transition-transform" />
                    <span className="font-semibold">Pedir Análise Financeira à IA</span>
                    <Sparkles size={16} />
                  </>
                )}
              </button>
            ) : (
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl relative animate-in fade-in slide-in-from-top-4">
                <button
                  onClick={() => setAiAdvice(null)}
                  className="absolute top-4 right-4 text-indigo-300 hover:text-indigo-600"
                >
                  <X size={20} />
                </button>
                <div className="flex items-start gap-4">
                  <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 shrink-0">
                    <Lightbulb size={24} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-indigo-900">Consultor Financeiro Diz:</h3>
                    <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-line">{aiAdvice}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Form (Left) */}
          <section className="lg:col-span-1">
            <Card className="sticky top-24 border-green-100 shadow-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Plus size={20} className="text-green-600" />
                  Novo Lançamento
                </h3>
                <button
                  onClick={() => setShowSmartInput(!showSmartInput)}
                  className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:shadow-md transition-all font-medium"
                >
                  <Sparkles size={12} />
                  {showSmartInput ? 'Fechar IA' : 'Preencher com IA'}
                </button>
              </div>

              {/* Smart Input Area */}
              {showSmartInput && (
                <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-in slide-in-from-top-2">
                  <label className="block text-xs font-bold text-indigo-700 mb-2">
                    DIGITE ALGO COMO "ALMOÇO 45 REAIS":
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={smartInput}
                      onChange={(e) => setSmartInput(e.target.value)}
                      placeholder="Ex: Uber para o trabalho 25"
                      className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handleSmartEntry()}
                    />
                    <button
                      onClick={handleSmartEntry}
                      disabled={isProcessingSmart || !smartInput}
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isProcessingSmart ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddTransaction} className="space-y-4">
                {/* Type Toggle */}
                <div className="bg-slate-100 p-1 rounded-xl flex">
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'income'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${type === 'expense'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Despesa
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descrição</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Supermercado, Aluguel"
                    className="w-full pl-3 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-mono text-lg"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Recurrence Option */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setIsRecurring(!isRecurring)}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${isRecurring ? 'text-green-600' : 'text-slate-500'}`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${isRecurring ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 bg-white'}`}>
                        {isRecurring && <Repeat size={12} />}
                      </div>
                      Repetir mensalmente?
                    </button>
                  </div>

                  {isRecurring && (
                    <div className="bg-green-50 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Número de Meses</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="2"
                          max="60"
                          value={monthsToRepeat}
                          onChange={(e) => setMonthsToRepeat(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-green-800 font-bold"
                        />
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                          {parseInt(monthsToRepeat) > 0 ? `Até ${(() => {
                            const d = new Date();
                            d.setMonth(d.getMonth() + parseInt(monthsToRepeat) - 1);
                            return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                          })()}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-200 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSubmitting ? 'Salvando...' : 'Adicionar Lançamento'}
                </button>
              </form>
            </Card>
          </section>

          {/* Transaction List (Right) */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-800">
                Movimentos de <span className="capitalize text-green-600">{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}</span>
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                {filteredTransactions.length} itens
              </span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-slate-300" size={32} />
                </div>
                <h4 className="text-slate-900 font-bold text-lg">Mês Livre</h4>
                <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                  Não há lançamentos para este mês ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-green-200 hover:shadow-md transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full shrink-0 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                        {t.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{t.description}</p>
                          {t.is_auto_salary && (
                            <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold border border-green-200">
                              <CheckCircle size={10} /> AUTO
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge type={t.type} />
                          <span className="text-xs font-medium text-slate-400">• {t.category}</span>
                          <span className="text-xs font-medium text-slate-400">• {new Date(t.date).toLocaleDateString('pt-BR')}</span>
                          {t.installment_current && t.installment_total && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                              {t.installment_current}/{t.installment_total}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-bold text-lg tabular-nums ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'
                        }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                        title="Eliminar este lançamento"
                      >
                        <Trash2 size={12} /> Apagar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  );
}
