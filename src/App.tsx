import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Sparkles,
  Bot,
  X,
  Settings,
  Save,
  CheckCircle,
  Send,
  Search,
  Filter,
  Loader2,
  Pencil,
  DollarSign,
  LayoutDashboard,
  History
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { type User } from '@supabase/supabase-js';
import Login from './Login';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- Gemini API ---
const callGemini = async (prompt: string) => {
  if (!apiKey) {
    alert("Erro: Chave da API Gemini não encontrada no arquivo .env");
    return null;
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Gemini API Error details:", errData);
      throw new Error(`API Error: ${response.status} - ${errData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    alert("Falha ao consultar a IA: " + (error.message || "Erro desconhecido"));
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
  is_paid?: boolean;
  due_date?: string;
}

interface SalaryConfig {
  enabled: boolean;
  amount: number;
  day: number;
}

interface Category {
  id: string;
  name: string;
}

// --- UI Components ---
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`glass-card p-6 hover-lift ${className}`}>
    {children}
  </div>
);

const CountingNumber = ({ value, formatter }: { value: number, formatter: (val: number) => string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = count;
    const end = value;
    const duration = 800;
    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{formatter(count)}</span>;
};

const Badge = ({ type }: { type: TransactionType }) => {
  const isIncome = type === 'income';
  return (
    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit shadow-sm ${isIncome ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
      }`}>
      {isIncome ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isIncome ? 'Receita' : 'Despesa'}
    </span>
  );
};

export default function FinanceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');

  // Ensure light mode is strictly enforced
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Date Filter
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('Outros');

  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [isFixedRecurrence, setIsFixedRecurrence] = useState(false);
  const [monthsToRepeat, setMonthsToRepeat] = useState('2');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI State
  const [smartInput, setSmartInput] = useState('');
  const [isProcessingSmart, setIsProcessingSmart] = useState(false);
  const [showSmartInput, setShowSmartInput] = useState(false);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>({ enabled: false, amount: 0, day: 5 });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Categories State
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // 1A. Enforce Custom Categories Only
  const categories = useMemo(() => {
    return customCategories.map(c => c.name).sort();
  }, [customCategories]);

  const defaultCategories = [
    'Habitação', 'Alimentação', 'Transporte', 'Lazer', 'Saúde',
    'Educação', 'Salário', 'Investimentos', 'Cartão de Crédito', 'Outros'
  ];

  // Initialize categories if empty
  useEffect(() => {
    if (user && !loading && customCategories.length === 0) {
      const initCategories = async () => {
        const { data: existing } = await supabase.from('categories').select('id').eq('user_id', user.id).limit(1);
        if (existing && existing.length === 0) {
          const insertData = defaultCategories.map(name => ({ user_id: user.id, name }));
          await supabase.from('categories').insert(insertData);
          // Refetch to update state
          const { data: categoriesData } = await supabase.from('categories').select('*').eq('user_id', user.id);
          if (categoriesData) setCustomCategories(categoriesData);
        }
      };
      initCategories();
    }
  }, [user, loading, customCategories]);

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
  const fetchData = async () => {
    if (!user) return;
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
    const { data: settingsData } = await supabase
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

    // Categories
    const { data: categoriesData, error: cError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (cError) {
      console.error("Error fetching categories:", cError);
    } else {
      setCustomCategories(categoriesData || []);
    }
  };

  useEffect(() => {
    if (!user) {
      setAllTransactions([]);
      setSalaryConfig({ enabled: false, amount: 0, day: 5 });
      setCustomCategories([]);
      return;
    }

    fetchData();
  }, [user]);



  // 3. Auto Salary Logic
  useEffect(() => {
    if (!user || !salaryConfig.enabled || !salaryConfig.amount || loading) return;

    const checkAndGenerateSalary = async () => {
      const viewedDate = new Date(currentDate);
      const now = new Date();
      const viewedMonthKey = viewedDate.getFullYear() * 12 + viewedDate.getMonth();
      const currentMonthKey = now.getFullYear() * 12 + now.getMonth();

      // Only generate if it's the current month (and we've reached the day)
      // OR if it's a future month (relative to real-time)
      if ((viewedMonthKey === currentMonthKey && now.getDate() >= salaryConfig.day) || viewedMonthKey > currentMonthKey) {
        const alreadyExists = allTransactions.some(t => {
          if (!t.is_auto_salary) return false;
          const tDate = new Date(t.date);
          return tDate.getMonth() === viewedDate.getMonth() &&
            tDate.getFullYear() === viewedDate.getFullYear();
        });

        if (!alreadyExists) {
          console.log(`Generating auto salary for ${viewedDate.getMonth() + 1}/${viewedDate.getFullYear()}...`);
          try {
            const targetDate = new Date(viewedDate.getFullYear(), viewedDate.getMonth(), salaryConfig.day, 12, 0, 0);

            const { data } = await supabase.from('transactions').insert({
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
  }, [user, salaryConfig, allTransactions, loading, currentDate]);

  // --- Logic ---

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingSettings(true);
    try {
      // Fix for the R$ 2,00 issue: Ensure we use a clean number
      // If the user typed 2.500,00 -> we want 2500.00
      // In a number input, browsers usually handle this, but let's be safe if it's text or coming from elsewhere
      const cleanAmount = typeof salaryConfig.amount === 'string'
        ? parseFloat((salaryConfig.amount as string).replace(/\./g, '').replace(',', '.'))
        : salaryConfig.amount;

      // Upsert settings
      const { error } = await supabase.from('settings').upsert({
        user_id: user.id,
        salary_enabled: salaryConfig.enabled,
        salary_amount: cleanAmount,
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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCategoryName.trim()) return;

    setIsAddingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ user_id: user.id, name: newCategoryName.trim() })
        .select();

      if (error) throw error;
      if (data) {
        setCustomCategories(prev => [...prev, data[0]]);
        setNewCategoryName('');
      }
    } catch (err) {
      console.error("Error adding category:", err);
      alert("Erro ao adicionar categoria.");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setCustomCategories(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error deleting category:", err);
      alert("Erro ao deletar categoria.");
    }
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setDescription(tx.description.replace(/\s\(\d+\/\d+\)$|\s\(Fixo\)$/, ''));
    setAmount(tx.amount.toString().replace('.', ','));
    setType(tx.type);
    setCategory(tx.category);
    setDueDate(tx.date.split('T')[0]);
    setIsRecurring(false);
    setIsFixedRecurrence(false);
    setShowTransactionModal(true);
  };

  const handleOpenNewTransactionModal = () => {
    setEditingTransaction(null);
    setDescription('');
    setAmount('');
    setCategory('Outros');
    setIsRecurring(false);
    setIsFixedRecurrence(false);

    // Set default date to the viewed month
    const targetDate = new Date(currentDate);
    const today = new Date();

    // If we are looking at the current real-world month, use today's date
    if (targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear()) {
      setDueDate(today.toISOString().split('T')[0]);
    } else {
      // Otherwise, default to the 1st day of the viewed month
      targetDate.setDate(1);
      setDueDate(targetDate.toISOString().split('T')[0]);
    }

    setShowTransactionModal(true);
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

      if (editingTransaction) {
        const isSeries = editingTransaction.installment_current && editingTransaction.installment_total;
        const isFixedValue = editingTransaction.description.includes('(Fixo)');
        let finalDescription = description;

        if (isSeries) {
          if (isFixedValue) {
            finalDescription = `${description} (Fixo)`;
          } else {
            finalDescription = `${description} (${editingTransaction.installment_current}/${editingTransaction.installment_total})`;
          }
        }

        // Update individual transaction
        const { data, error } = await supabase
          .from('transactions')
          .update({
            description: finalDescription,
            amount: val,
            type,
            category,
            date: new Date(dueDate + 'T12:00:00').toISOString(),
            due_date: new Date(dueDate + 'T12:00:00').toISOString(),
          })
          .eq('id', editingTransaction.id)
          .select();

        if (error) throw error;

        if (data && data.length > 0) {
          const mainUpdated = data[0];

          if (isSeries) {
            // Atualização em cascata para os próximos meses
            const baseNameOriginal = editingTransaction.description.replace(/\s\(\d+\/\d+\)$|\s\(Fixo\)$/, '');

            if (isFixedValue) {
              // Para fixos, podemos atualizar todos os futuros com a mesma descrição original em uma única query
              await supabase
                .from('transactions')
                .update({
                  amount: val,
                  category,
                  description: `${description} (Fixo)`
                })
                .eq('user_id', user.id)
                .eq('description', editingTransaction.description)
                .gt('date', editingTransaction.date);
            } else {
              // Para parcelas, precisamos buscar os futuros para manter a numeração (X/Y) correta
              const { data: futureItems } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .eq('type', editingTransaction.type)
                .eq('installment_total', editingTransaction.installment_total)
                .gt('installment_current', editingTransaction.installment_current)
                .ilike('description', `${baseNameOriginal}%`);

              if (futureItems && futureItems.length > 0) {
                const updates = futureItems.map(item => {
                  const itemBaseName = item.description.replace(/\s\(\d+\/\d+\)$|\s\(Fixo\)$/, '');
                  if (itemBaseName === baseNameOriginal) {
                    return supabase
                      .from('transactions')
                      .update({
                        amount: val,
                        category,
                        description: `${description} (${item.installment_current}/${item.installment_total})`
                      })
                      .eq('id', item.id);
                  }
                  return null;
                }).filter(Boolean);

                if (updates.length > 0) {
                  await Promise.all(updates);
                }
              }
            }
            // Recarrega todos os dados para garantir sincronia do estado global
            await fetchData();
          } else {
            setAllTransactions(prev => prev.map(t => t.id === editingTransaction.id ? mainUpdated : t));
          }
        }
      } else {
        // Create new transaction(s)
        const numMonths = isRecurring ? parseInt(monthsToRepeat) : (isFixedRecurrence ? 12 : 1);
        const newTransactions = [];

        // Parse initial due date
        const baseDate = new Date(dueDate + 'T12:00:00');

        for (let i = 0; i < numMonths; i++) {
          // Correctly calculate next month without skipping
          const d = new Date(baseDate);
          d.setMonth(baseDate.getMonth() + i);

          // If the day changed (e.g. Jan 31 -> March), snap to last day of previous month
          if (d.getDate() !== baseDate.getDate()) {
            d.setDate(0);
          }

          let finalDescription = description;
          if (isRecurring) {
            finalDescription = `${description} (${i + 1}/${numMonths})`;
          } else if (isFixedRecurrence) {
            finalDescription = `${description} (Fixo)`;
          }

          const newTx = {
            user_id: user.id,
            description: finalDescription,
            amount: val,
            type,
            category,
            date: d.toISOString(),
            due_date: d.toISOString(),
            is_paid: false,
            installment_current: (isRecurring || isFixedRecurrence) ? i + 1 : undefined,
            installment_total: (isRecurring || isFixedRecurrence) ? numMonths : undefined
          };
          newTransactions.push(newTx);
        }

        const { data, error } = await supabase.from('transactions').insert(newTransactions).select();

        if (error) throw error;

        if (data) {
          setAllTransactions(prev => [...data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
      }

      setDescription('');
      setAmount('');
      setCategory('Outros');
      setIsRecurring(false);
      setIsFixedRecurrence(false);
      setMonthsToRepeat('2');
      setDueDate(new Date().toISOString().split('T')[0]);
      setSmartInput('');
      setShowSmartInput(false);
      setEditingTransaction(null);
    } catch (err: any) {
      console.error("Error adding:", err);
      alert("Erro ao salvar lançamento: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePaid = async (t: Transaction) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_paid: !t.is_paid })
        .eq('id', t.id);

      if (error) throw error;

      setAllTransactions(prev => prev.map(item =>
        item.id === t.id ? { ...item, is_paid: !t.is_paid } : item
      ));
    } catch (err) {
      console.error("Error toggling paid state:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

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
  };

  const currentMonthName = useMemo(() => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      const matchesMonth = tDate.getMonth() === currentDate.getMonth() &&
        tDate.getFullYear() === currentDate.getFullYear();

      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
      const matchesType = filterType === 'all' || t.type === filterType;

      return matchesMonth && matchesSearch && matchesCategory && matchesType;
    });
  }, [allTransactions, currentDate, searchTerm, filterCategory, filterType]);

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
        if (curr.is_paid) {
          acc.paidExpenses += curr.amount;
        }
      }
      return acc;
    }, { income: 0, expense: 0, total: 0, paidExpenses: 0 });
  }, [filteredTransactions]);

  const pieData = useMemo(() => {
    const expensesGrouped = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
        return acc;
      }, {});

    return Object.keys(expensesGrouped).map(cat => ({
      name: cat,
      value: expensesGrouped[cat]
    })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const trendData = useMemo(() => {
    const months = [];
    const year = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    for (let i = 0; i <= currentMonth; i++) {
      const d = new Date(year, i, 1);
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' });
      const monthKey = year * 12 + i;

      const monthBalance = allTransactions.reduce((acc, t) => {
        const tDate = new Date(t.date);
        const tMonthKey = tDate.getFullYear() * 12 + tDate.getMonth();
        if (tMonthKey <= monthKey) {
          return acc + (t.type === 'income' ? t.amount : -t.amount);
        }
        return acc;
      }, 0);

      months.push({
        name: monthLabel,
        saldo: parseFloat(monthBalance.toFixed(2))
      });
    }
    return months;
  }, [allTransactions, currentDate]);

  const expensesByMonthData = useMemo(() => {
    const data = [];
    const year = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    for (let i = 0; i <= currentMonth; i++) {
      const d = new Date(year, i, 1);
      const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' });

      const monthExpenses = allTransactions.reduce((acc, t) => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === year && tDate.getMonth() === i && t.type === 'expense') {
          return acc + t.amount;
        }
        return acc;
      }, 0);

      data.push({
        name: monthLabel,
        despesa: parseFloat(monthExpenses.toFixed(2))
      });
    }
    return data;
  }, [allTransactions, currentDate]);

  const comparisonData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const prevMonthDate = new Date(year, month - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    const getStats = (y: number, m: number) => {
      return allTransactions.reduce((acc, t) => {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() === y && tDate.getMonth() === m) {
          if (t.type === 'income') acc.income += t.amount;
          else acc.expense += t.amount;
        }
        return acc;
      }, { income: 0, expense: 0 });
    };

    const currentStats = getStats(year, month);
    const prevStats = getStats(prevYear, prevMonth);

    return [
      {
        name: prevMonthDate.toLocaleDateString('pt-BR', { month: 'short' }),
        Receita: prevStats.income,
        Despesa: prevStats.expense
      },
      {
        name: currentDate.toLocaleDateString('pt-BR', { month: 'short' }),
        Receita: currentStats.income,
        Despesa: currentStats.expense
      }
    ];
  }, [allTransactions, currentDate]);

  const yearlySummary = useMemo(() => {
    const year = currentDate.getFullYear();
    return allTransactions
      .filter(t => new Date(t.date).getFullYear() === year && new Date(t.date) <= currentDate)
      .reduce((acc, curr) => {
        if (curr.type === 'income') {
          acc.income += curr.amount;
          acc.total += curr.amount;
        } else {
          acc.expense += curr.amount;
          acc.total -= curr.amount;
        }
        return acc;
      }, { income: 0, expense: 0, total: 0 });
  }, [allTransactions, currentDate]);

  const CHART_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

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

  const handleSendMessage = async (text?: string) => {
    const messageToSend = text || chatInput;
    if (!messageToSend.trim()) return;

    const newMessages = [...chatMessages, { role: 'user' as const, content: messageToSend }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatLoading(true);

    const financialData = {
      month: currentMonthName,
      accumulatedBalance: accumulatedBalance,
      monthlySummary: monthlySummary,
      yearlySummary: yearlySummary,
      topCategories: pieData.slice(0, 5),
      recentTransactions: filteredTransactions.slice(0, 5).map(t => ({ desc: t.description, val: t.amount, cat: t.category, type: t.type }))
    };
    const prompt = `
      Você é um consultor financeiro direto e objetivo.
      Dados Atuais: ${JSON.stringify(financialData)}
      Histórico: ${JSON.stringify(newMessages.slice(-5))}
      
      REGRA DE OURO: Seja extremamente direto ao ponto. Responda apenas o que foi perguntado de forma concisa (máximo 2-3 frases). Use dados REAIS fornecidos. Não faça textos longos.
    `;

    try {
      const result = await callGemini(prompt);
      if (result) {
        setChatMessages([...newMessages, { role: 'assistant', content: result }]);
      }
    } catch (e) {
      console.error("Chat error", e);
      setChatMessages([...newMessages, { role: 'assistant', content: "Desculpe, tive um problema e não consegui processar sua mensagem agora. 😅" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleGenerateAdvice = async () => {
    setShowChat(true);
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="text-emerald-600" />
              Configurar Salário
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="font-semibold text-emerald-900">Salário Automático</label>
                  <button
                    type="button"
                    onClick={() => setSalaryConfig({ ...salaryConfig, enabled: !salaryConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${salaryConfig.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${salaryConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <p className="text-xs text-emerald-700 leading-relaxed">
                  Quando ativado, o sistema lançará automaticamente o valor do seu salário no dia escolhido, todos os meses.
                </p>
              </div>

              <div className={`space-y-4 transition-all duration-300 ${salaryConfig.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-1">Dia do Recebimento</label>
                  <select
                    value={salaryConfig.day}
                    onChange={(e) => setSalaryConfig({ ...salaryConfig, day: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
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

            <div className="mt-8 pt-6 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <PieChart size={16} className="text-indigo-600" />
                Minhas Categorias
              </h3>

              <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nova categoria"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                />
                <button
                  type="submit"
                  disabled={isAddingCategory || !newCategoryName.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  <Plus size={18} />
                </button>
              </form>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin">
                {customCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma categoria.</p>
                ) : (
                  customCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                      <span className="text-sm text-slate-700 font-bold">{cat.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-rose-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl p-0 relative overflow-visible border-none">
            <button
              onClick={() => {
                setShowTransactionModal(false);
                setEditingTransaction(null);
                setDescription('');
                setAmount('');
                setCategory('Outros');
              }}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
            >
              <X size={32} />
            </button>

            <div className="p-8 md:p-10">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg">
                    {editingTransaction ? <Pencil size={24} /> : <Plus size={24} />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">{editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}</h3>
                </div>
                {!editingTransaction && (
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Lançando em</span>
                      <span className="text-xs font-bold text-slate-500 capitalize">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSmartInput(!showSmartInput)}
                      className="text-[10px] bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full flex items-center gap-2 hover:bg-indigo-100 transition-all font-black uppercase tracking-wider"
                    >
                      <Sparkles size={14} />
                      {showSmartInput ? 'Fechar IA' : 'Usar IA'}
                    </button>
                  </div>
                )}
              </div>

              {!editingTransaction && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-xs font-bold text-emerald-700">
                    Atenção: Este lançamento será registrado em <span className="uppercase">{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}</span>.
                  </p>
                </div>
              )}

              {/* AI Smart Input */}
              {showSmartInput && (
                <div className="mb-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-200 animate-in slide-in-from-top-4 duration-500">
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest ml-1">
                    Assistente Inteligente
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={smartInput}
                      onChange={(e) => setSmartInput(e.target.value)}
                      placeholder='Ex: "Mercado 250 reais ontem"'
                      className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-sm"
                    />
                    <button
                      onClick={handleSmartEntry}
                      disabled={isProcessingSmart || !smartInput}
                      className="bg-indigo-600 text-white p-3.5 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg"
                    >
                      {isProcessingSmart ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={async (e) => {
                await handleAddTransaction(e);
                setShowTransactionModal(false);
              }} className="space-y-6">
                {/* Segmented Control for Type */}
                <div className="bg-slate-100 p-1.5 rounded-[1.5rem] flex border border-slate-200/50 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${type === 'income'
                      ? 'bg-white text-emerald-600 shadow-md ring-1 ring-emerald-50'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <TrendingUp size={18} />
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 py-4 rounded-2xl text-sm font-black transition-all duration-300 flex items-center justify-center gap-2 ${type === 'expense'
                      ? 'bg-white text-rose-600 shadow-md ring-1 ring-rose-50'
                      : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <TrendingDown size={18} />
                    Despesa
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Aluguel"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-800"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-slate-800"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-800 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1.25rem_center] bg-no-repeat"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {!editingTransaction && (
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex items-center gap-6">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecurring(!isRecurring);
                          if (!isRecurring) setIsFixedRecurrence(false);
                        }}
                        className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-wider transition-all ${isRecurring ? 'text-emerald-600' : 'text-slate-400'}`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isRecurring ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 bg-white'}`}>
                          {isRecurring && <Repeat size={14} />}
                        </div>
                        Parcelar Lançamento
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsFixedRecurrence(!isFixedRecurrence);
                          if (!isFixedRecurrence) setIsRecurring(false);
                        }}
                        className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-wider transition-all ${isFixedRecurrence ? 'text-indigo-600' : 'text-slate-400'}`}
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isFixedRecurrence ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white'}`}>
                          {isFixedRecurrence && <Calendar size={14} />}
                        </div>
                        Despesa Mensal (Fixa)
                      </button>
                    </div>

                    {(isRecurring || isFixedRecurrence) && (
                      <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        {isRecurring && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelas</label>
                            <input
                              type="number"
                              min="2"
                              value={monthsToRepeat}
                              onChange={(e) => setMonthsToRepeat(e.target.value)}
                              className="w-full px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-emerald-800 font-bold text-xs"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vencimento</label>
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-indigo-800 font-bold text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {editingTransaction && (
                  <div className="space-y-1 pt-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data / Vencimento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold text-xs"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.5rem] font-black text-lg transition-all transform active:scale-[0.98] shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : editingTransaction ? 'Atualizar Lançamento' : 'Salvar Transação'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )
      }

      {/* Header - Transparent & Premium */}
      <header className="bg-slate-900 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-20 shadow-xl transition-all duration-300">
        <div className="max-w-[80%] mx-auto px-4 lg:px-0 py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-1 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 bg-slate-800">
                <img src="/logo-rds.png" alt="Logo" className="w-14 h-14 object-contain rounded-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  Finanças <span className="text-emerald-400">rDs</span>
                  <button
                    onClick={() => {
                      if (!showChat && chatMessages.length === 0) {
                        handleGenerateAdvice();
                      } else {
                        setShowChat(true);
                      }
                    }}
                    className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest ml-2 hover:bg-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    Premium AI ✨
                  </button>
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão Financeira</p>
              </div>
            </div>

            {/* Month Selector Luxe */}
            <div className="flex items-center bg-slate-800/50 shadow-inner rounded-2xl p-1.5 min-w-[280px] justify-between border border-slate-700/50">
              <button onClick={() => changeMonth(-1)} className="p-2.5 hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-emerald-400 active:scale-90">
                <ChevronLeft size={22} />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{currentDate.getFullYear()}</span>
                <span className="text-base font-bold text-white capitalize leading-tight">
                  {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
                </span>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2.5 hover:bg-slate-800 hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-emerald-400 active:scale-90">
                <ChevronRight size={22} />
              </button>
            </div>

            <div className="flex items-center gap-5">
              <button
                onClick={handleOpenNewTransactionModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 transform active:scale-95"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Novo Lançamento</span>
              </button>

              <button
                onClick={() => setShowSettings(true)}
                className="p-3 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl transition-all border border-transparent hover:border-emerald-500/20"
                title="Configurações e Categorias"
              >
                <Settings size={24} className="animate-spin-slow hover:animate-spin" />
              </button>

              <div className="flex items-center gap-3 pl-5 border-l border-slate-800">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-white leading-none">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-rose-400 font-black hover:text-rose-300 uppercase tracking-tighter"
                  >
                    Encerrar Sessão
                  </button>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border-2 border-slate-700 shadow-sm flex items-center justify-center text-slate-300 font-bold overflow-hidden">
                  {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* View Selector Luxe */}
      <nav className="bg-slate-100 border-b border-slate-200 py-4 transition-all duration-300">
        <div className="max-w-[80%] mx-auto flex justify-center">
          <div className="bg-white/50 backdrop-blur-md p-1.5 rounded-2xl flex border border-slate-200/50 shadow-sm w-full max-w-md">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-black transition-all duration-500 ${activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xl scale-[1.02]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                }`}
            >
              <LayoutDashboard size={20} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-black transition-all duration-500 ${activeTab === 'history'
                ? 'bg-slate-900 text-white shadow-xl scale-[1.02]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                }`}
            >
              <History size={20} />
              Histórico
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[80%] mx-auto py-8 space-y-8 min-h-[70vh]">

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Luxe Section */}
            <div className="space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <Card className="premium-gradient-blue text-white border-none relative overflow-hidden group min-h-[160px] flex flex-col justify-between p-6 rounded-[2.5rem]">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-700">
                    <Wallet size={120} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-blue-100 text-xs font-black uppercase tracking-[0.2em] mb-1">Patrimônio Total</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tighter">
                      <CountingNumber value={accumulatedBalance} formatter={formatCurrency} />
                    </h2>
                  </div>
                  <div className="text-sm text-blue-100 relative z-10 flex flex-col gap-1 mt-4">
                    <div className="pt-3 border-t border-white/20 text-[10px] font-black uppercase tracking-widest flex justify-between items-center opacity-70">
                      <span>Saldo Acumulado</span>
                      <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse"></div>
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-1 h-1 rounded-full bg-white animate-pulse [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="premium-gradient-green text-white border-none relative overflow-hidden group min-h-[160px] flex flex-col justify-between p-6 rounded-[2.5rem]">
                  <div className="absolute -top-4 -right-4 p-6 opacity-20 group-hover:rotate-12 transition-transform duration-700">
                    <ArrowUpRight size={100} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-emerald-100 text-xs font-black uppercase tracking-[0.2em] mb-1">Entradas (Mês)</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tighter">
                      <CountingNumber value={monthlySummary.income} formatter={formatCurrency} />
                    </h2>
                  </div>
                  <div className="pt-3 border-t border-white/20 text-[10px] font-black uppercase tracking-widest flex justify-between items-center opacity-70">
                    <span>Receitas Totais</span>
                    <TrendingUp size={16} />
                  </div>
                </Card>

                <Card className="premium-gradient-rose text-white border-none relative overflow-hidden group min-h-[160px] flex flex-col justify-between p-6 rounded-[2.5rem]">
                  <div className="absolute -top-4 -right-4 p-6 opacity-20 group-hover:-rotate-12 transition-transform duration-700">
                    <ArrowDownRight size={100} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-rose-100 text-xs font-black uppercase tracking-[0.2em] mb-1">Saídas (Mês)</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tighter">
                      <CountingNumber value={monthlySummary.expense} formatter={formatCurrency} />
                    </h2>
                  </div>
                  <div className="pt-3 border-t border-white/20 text-[10px] font-black uppercase tracking-widest flex justify-between items-center opacity-70">
                    <span>Despesas Totais</span>
                    <TrendingDown size={16} />
                  </div>
                </Card>

                <Card className="premium-gradient-violet text-white border-none relative overflow-hidden group min-h-[160px] flex flex-col justify-between p-6 rounded-[2.5rem]">
                  <div className="absolute -bottom-4 -right-4 p-6 opacity-20 group-hover:scale-110 transition-transform duration-700">
                    <CheckCircle size={100} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-violet-100 text-xs font-black uppercase tracking-[0.2em] mb-1">Pagas (Mês)</p>
                    <h2 className="text-4xl font-black mt-1 tracking-tighter">
                      <CountingNumber value={monthlySummary.paidExpenses} formatter={formatCurrency} />
                    </h2>
                  </div>
                  <div className="pt-3 border-t border-white/20 text-[10px] font-black uppercase tracking-widest flex justify-between items-center opacity-70">
                    <span>Despesas Liquidadas</span>
                    <CheckCircle size={16} />
                  </div>
                </Card>

                <Card className="bg-white border-2 border-slate-100 text-slate-800 relative overflow-hidden group min-h-[160px] flex flex-col justify-between p-6 rounded-[2.5rem] hover:border-emerald-200 transition-all duration-500 shadow-sm">
                  <div className="absolute bottom-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700 text-emerald-600">
                    <PieChart size={100} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-1">Resultado (Mês)</p>
                    <h2 className={`text-4xl font-black mt-1 tracking-tighter ${monthlySummary.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      <CountingNumber value={monthlySummary.total} formatter={formatCurrency} />
                    </h2>
                  </div>
                  <div className="pt-3 border-t border-slate-100 text-[10px] font-black uppercase tracking-widest flex justify-between items-center text-slate-400">
                    <span>Saldo Líquido</span>
                    <DollarSign size={16} className="text-slate-300" />
                  </div>
                </Card>
              </section>


              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="min-h-[450px] shadow-sm hover:shadow-md transition-shadow duration-500 border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                        <PieChart size={22} />
                      </div>
                      Distribuição de Gastos
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">Visualização Mensal</div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={85}
                          outerRadius={110}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                          label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                          labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        >
                          {pieData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }}
                          itemStyle={{ fontWeight: 'bold' }}
                          formatter={(value: any) => [formatCurrency(Number(value)), 'Valor']}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold' }}
                          formatter={(value, entry: any) => (
                            <span className="text-slate-600 mr-2">
                              {value}: <span className="text-slate-900 font-black">{formatCurrency(entry.payload.value)}</span>
                            </span>
                          )}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="min-h-[450px] shadow-sm hover:shadow-md transition-shadow duration-500 border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <TrendingUp size={22} />
                      </div>
                      Evolução do Saldo
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">Acumulado do Ano</div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }}
                          formatter={(value: any) => [formatCurrency(Number(value)), 'Patrimônio']}
                        />
                        <Area
                          type="monotone"
                          dataKey="saldo"
                          stroke="#6366f1"
                          strokeWidth={4}
                          fillOpacity={1}
                          fill="url(#colorSaldo)"
                          animationDuration={1500}
                        >
                          <LabelList
                            dataKey="saldo"
                            position="top"
                            offset={15}
                            style={{ fontSize: '10px', fill: '#6366f1', fontWeight: '900' }}
                          />
                        </Area>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="min-h-[450px] shadow-sm hover:shadow-md transition-shadow duration-500 border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                      <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                        <TrendingDown size={22} />
                      </div>
                      Fluxo de Despesas
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">Análise Anual</div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={expensesByMonthData}>
                        <defs>
                          <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }}
                          formatter={(value: any) => [formatCurrency(Number(value)), 'Total Despesa']}
                        />
                        <Area
                          type="monotone"
                          dataKey="despesa"
                          stroke="none"
                          fill="url(#colorDespesa)"
                          animationDuration={1500}
                        />
                        <Line
                          type="monotone"
                          dataKey="despesa"
                          stroke="#ef4444"
                          strokeWidth={4}
                          dot={{ r: 6, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 8, strokeWidth: 0 }}
                          animationDuration={1500}
                        >
                          <LabelList
                            dataKey="despesa"
                            position="top"
                            offset={15}
                            formatter={(value: any) => formatCurrency(Number(value))}
                            style={{ fontSize: '10px', fill: '#ef4444', fontWeight: '900' }}
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="min-h-[450px] shadow-sm hover:shadow-md transition-shadow duration-500 border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <ArrowUpRight size={22} />
                      </div>
                      Comparativo Mensal
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">Atual vs Anterior</div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', padding: '12px' }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="Receita" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} animationDuration={1500}>
                          <LabelList
                            dataKey="Receita"
                            position="top"
                            formatter={(value: any) => formatCurrency(Number(value))}
                            style={{ fontSize: '9px', fill: '#10b981', fontWeight: '900' }}
                          />
                        </Bar>
                        <Bar dataKey="Despesa" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={30} animationDuration={1500}>
                          <LabelList
                            dataKey="Despesa"
                            position="top"
                            formatter={(value: any) => formatCurrency(Number(value))}
                            style={{ fontSize: '9px', fill: '#f43f5e', fontWeight: '900' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-2xl font-black text-slate-900">
                    Histórico de <span className="text-emerald-600 capitalize">{currentDate.toLocaleDateString('pt-BR', { month: 'long' })}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  {filteredTransactions.length} Operações
                </div>
              </div>

              {/* Search and Filters Luxe */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8 items-center">
                {/* Type Filter Pill (Image Inspired) */}
                <div className="bg-white p-1 rounded-full flex border border-slate-200 shadow-sm h-[56px] min-w-[300px]">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`flex-1 px-4 rounded-full text-xs font-black transition-all ${filterType === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Ambas
                  </button>
                  <button
                    onClick={() => setFilterType('income')}
                    className={`flex-1 px-4 rounded-full text-xs font-black transition-all flex items-center justify-center gap-2 ${filterType === 'income' ? 'bg-emerald-50 text-emerald-600 shadow-sm ring-1 ring-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <TrendingUp size={14} /> Entrada
                  </button>
                  <button
                    onClick={() => setFilterType('expense')}
                    className={`flex-1 px-4 rounded-full text-xs font-black transition-all flex items-center justify-center gap-2 ${filterType === 'expense' ? 'bg-rose-50 text-rose-600 shadow-sm ring-1 ring-rose-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <TrendingDown size={14} /> Saída
                  </button>
                </div>

                <div className="relative flex-1 group w-full h-[56px]">
                  <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-full pl-14 pr-6 bg-white border border-slate-200 rounded-full focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-sm"
                  />
                </div>

                <div className="relative min-w-[240px] w-full h-[56px]">
                  <Filter size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full h-full pl-14 pr-10 bg-white border border-slate-200 rounded-full focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none font-bold text-slate-700 cursor-pointer shadow-sm"
                  >
                    <option value="All">Todas Categorias</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                    <ChevronRight size={18} className="rotate-90" />
                  </div>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                  <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="text-slate-300" size={32} />
                  </div>
                  <h4 className="text-slate-900 font-bold text-lg">Sem resultados</h4>
                  <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                    {searchTerm || filterCategory !== 'All'
                      ? 'Nenhum lançamento corresponde aos filtros aplicados.'
                      : 'Não há lançamentos para este mês ainda.'}
                  </p>
                  {(searchTerm || filterCategory !== 'All') && (
                    <button
                      onClick={() => { setSearchTerm(''); setFilterCategory('All'); }}
                      className="mt-4 text-indigo-600 text-sm font-bold hover:underline"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((t) => (
                    <div
                      key={t.id}
                      className="group glass-card p-4 rounded-2xl border-none hover:shadow-xl transition-all flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center gap-4">
                        {t.type === 'expense' && (
                          <button
                            onClick={() => togglePaid(t)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${t.is_paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-emerald-300'}`}
                            title={t.is_paid ? "Marcar como não pago" : "Marcar como pago"}
                          >
                            {t.is_paid && <CheckCircle size={14} />}
                          </button>
                        )}
                        <div className={`p-3 rounded-xl shrink-0 ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {t.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                        <div className={t.is_paid ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{t.description}</p>
                            {t.is_auto_salary && (
                              <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-bold border border-green-200">
                                <CheckCircle size={10} /> AUTO
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge type={t.type} />
                            <span className="text-slate-500 font-bold">• {t.category}</span>
                            <span className={`${!t.is_paid && t.due_date && new Date(t.due_date) < new Date() ? 'text-rose-600 font-black animate-pulse' : 'text-slate-500 font-semibold'}`}>
                              • {new Date(t.date).toLocaleDateString('pt-BR')}
                              {!t.is_paid && t.due_date && new Date(t.due_date) < new Date() && ' (VENCIDO!)'}
                            </span>
                            {t.installment_current && t.installment_total && (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {t.installment_current}/{t.installment_total}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-black text-xl tabular-nums ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {!t.is_auto_salary && (
                            <button
                              onClick={() => handleOpenEditModal(t)}
                              className="text-xs text-indigo-500 hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                              title="Editar este lançamento"
                            >
                              <Pencil size={12} /> Editar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-xs text-rose-500 hover:bg-rose-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="Eliminar este lançamento"
                          >
                            <Trash2 size={12} /> Apagar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* AI Chat Floating Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        {showChat && (
          <Card className="w-[380px] h-[550px] shadow-2xl border-none flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-500 rounded-[2.5rem]">
            {/* Chat Header */}
            <div className="p-5 premium-gradient-blue text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                  <Bot size={24} className="animate-float" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Consultor rDs</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest">Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white scrollbar-thin scrollbar-thumb-slate-100">
              {chatMessages.length === 0 && !isChatLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="bg-indigo-50 p-6 rounded-full mb-4">
                    <Bot className="text-indigo-600 animate-float" size={48} />
                  </div>
                  <h4 className="font-black text-slate-800 text-lg">Olá! Como posso ajudar?</h4>
                  <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                    Estou pronto para analisar seus dados. O que você gostaria de saber agora?
                  </p>
                  <div className="mt-6 flex flex-col gap-2 w-full">
                    <button
                      onClick={() => handleSendMessage("Como está meu saldo e o resumo deste mês?")}
                      className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100 text-left"
                    >
                      📊 Resumo do Mês
                    </button>
                    <button
                      onClick={() => handleSendMessage("Quais são meus maiores gastos e onde posso economizar?")}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 text-left"
                    >
                      💸 Analisar Meus Gastos
                    </button>
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed font-medium ${msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50 shadow-sm'
                    }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 backdrop-blur-md">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pergunte qualquer coisa..."
                  className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-slate-800 font-bold transition-all"
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-2xl transition-all disabled:opacity-50 shadow-xl shadow-indigo-100 hover:scale-110 active:scale-90"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </Card>
        )}

        {/* Floating Toggle Button */}
        <button
          onClick={() => {
            if (!showChat && chatMessages.length === 0) {
              handleGenerateAdvice();
            } else {
              setShowChat(!showChat);
            }
          }}
          className={`p-4 rounded-full shadow-2xl transition-all duration-500 transform hover:scale-110 active:scale-90 flex items-center justify-center group ${showChat ? 'bg-rose-500 rotate-90' : 'premium-gradient-blue animate-bounce-slow'
            }`}
        >
          {showChat ? (
            <X size={32} className="text-white" />
          ) : (
            <div className="relative">
              <Bot size={32} className="text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
