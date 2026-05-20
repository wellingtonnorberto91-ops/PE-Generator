import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { calculateEndDate, calculateDetailedSchedule, type DetailedScheduleResult } from '../features/calendar/engine';
import { organizeKnowledgePrecedence } from '../features/ai-core/gemini';
import { 
  ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, 
  Layers, Settings, BookOpen, Calendar, AlertTriangle, 
  ChevronRight, Info, Edit3, CheckCircle2, Sparkles, FileEdit
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Module {
  name: string;
  hours: number;
  objective: string;
  technicalCapabilities: string[];
  socioemotionalCapabilities: string[];
  knowledge: string[];
  recommendations: string;
  aiSuggestions: string;
}

interface MSEP {
  objetivoGeral: string;
  capacidadesBasicas: string[];
  capacidadesTecnicas: string[];
  capacidadesSocioemocionais: string[];
  conhecimentos: string[];
  infraestrutura: string;
  situacoesAprendizagem: string;
  criteriosAvaliacao: string;
  estrategiasEnsino: string;
  atividadesPraticas: string[];
  instrumentosAvaliacao: string[];
}

interface ScheduleOverride {
  type?: 'class' | 'holiday' | 'off-day' | 'weekend';
  note?: string;
}

interface TeachingPlan {
  id?: string;
  name: string;
  totalHours: number;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  classDays: number[];
  modules: Module[];
  msep?: MSEP;
  scheduleOverrides?: Record<string, ScheduleOverride>;
}

export function ClassEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'msep' | 'schedule'>('general');
  
  // Data State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [classDays, setClassDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [modules, setModules] = useState<Module[]>([]);
  const [msep, setMsep] = useState<MSEP>({
    objetivoGeral: '',
    capacidadesBasicas: [],
    capacidadesTecnicas: [],
    capacidadesSocioemocionais: [],
    conhecimentos: [],
    infraestrutura: '',
    situacoesAprendizagem: '',
    criteriosAvaliacao: '',
    estrategiasEnsino: '',
    atividadesPraticas: [],
    instrumentosAvaliacao: []
  });
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleOverride>>({});
  const [holidays, setHolidays] = useState<string[]>([]);
  
  // Override Modal State
  const [editingDay, setEditingDay] = useState<{
    dateStr: string;
    type: 'default' | 'class' | 'holiday' | 'off-day' | 'weekend';
    note: string;
  } | null>(null);

  // Precedence Modal State
  const [precedenceModal, setPrecedenceModal] = useState<{
    isOpen: boolean;
    moduleIndex: number;
    targetModuleNames: string[];
    currentKnowledge: string[];
    allocations?: {
      moduleName: string;
      knowledge: string[];
      justification?: string;
    }[];
    loading: boolean;
  } | null>(null);

  const openPrecedenceModal = (index: number) => {
    const mod = modules[index];
    setPrecedenceModal({
      isOpen: true,
      moduleIndex: index,
      targetModuleNames: [
        `${mod.name} - Semestre 1`,
        `${mod.name} - Semestre 2`
      ],
      currentKnowledge: mod.knowledge || [],
      loading: false
    });
  };

  const handleAddSemesterInput = () => {
    if (!precedenceModal) return;
    const count = precedenceModal.targetModuleNames.length + 1;
    setPrecedenceModal({
      ...precedenceModal,
      targetModuleNames: [
        ...precedenceModal.targetModuleNames,
        `${modules[precedenceModal.moduleIndex].name} - Semestre ${count}`
      ]
    });
  };

  const handleRemoveSemesterInput = (idx: number) => {
    if (!precedenceModal || precedenceModal.targetModuleNames.length <= 2) return;
    setPrecedenceModal({
      ...precedenceModal,
      targetModuleNames: precedenceModal.targetModuleNames.filter((_, i) => i !== idx)
    });
  };

  const handleUpdateSemesterNameInput = (idx: number, val: string) => {
    if (!precedenceModal) return;
    const copy = [...precedenceModal.targetModuleNames];
    copy[idx] = val;
    setPrecedenceModal({
      ...precedenceModal,
      targetModuleNames: copy
    });
  };

  const runPrecedenceAI = async () => {
    if (!precedenceModal) return;
    if (precedenceModal.currentKnowledge.length === 0) {
      alert("Adicione alguns conhecimentos ao módulo original primeiro para que a IA possa organizá-los por precedência.");
      return;
    }
    
    setPrecedenceModal({ ...precedenceModal, loading: true });
    try {
      const res = await organizeKnowledgePrecedence(
        modules[precedenceModal.moduleIndex].name,
        precedenceModal.currentKnowledge,
        precedenceModal.targetModuleNames
      );
      setPrecedenceModal(prev => prev ? {
        ...prev,
        loading: false,
        allocations: res.allocations
      } : null);
    } catch (err) {
      console.error("Erro na distribuição por IA", err);
      alert("Ocorreu um erro ao chamar a inteligência artificial. Tente novamente.");
      setPrecedenceModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const applyPrecedenceDistribution = () => {
    if (!precedenceModal || !precedenceModal.allocations) return;
    
    const idx = precedenceModal.moduleIndex;
    const originalMod = modules[idx];
    const newAllocations = precedenceModal.allocations;
    const count = newAllocations.length;
    
    // Split the hours evenly
    const splitHours = Math.max(10, Math.round(originalMod.hours / count));
    
    const newModulesList = newAllocations.map((alloc) => {
      return {
        name: alloc.moduleName,
        hours: splitHours,
        objective: originalMod.objective || "",
        technicalCapabilities: originalMod.technicalCapabilities || [],
        socioemotionalCapabilities: originalMod.socioemotionalCapabilities || [],
        knowledge: alloc.knowledge,
        recommendations: originalMod.recommendations || "",
        aiSuggestions: originalMod.aiSuggestions || ""
      };
    });

    setModules(prev => {
      const copy = [...prev];
      copy.splice(idx, 1, ...newModulesList);
      return copy;
    });

    setPrecedenceModal(null);
  };

  // Load holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const snap = await getDocs(collection(db, 'calendars'));
        const dates: string[] = [];
        snap.forEach(d => dates.push(d.data().date));
        setHolidays(dates);
      } catch (err) {
        console.error("Erro ao buscar feriados", err);
      }
    };
    fetchHolidays();
  }, []);

  // Load teaching plan
  useEffect(() => {
    if (!id) return;
    const loadPlan = async () => {
      try {
        const docRef = doc(db, 'teaching_plans', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TeachingPlan;
          setName(data.name || '');
          setStartDate(data.startDate || '');
          setHoursPerDay(data.hoursPerDay || 4);
          setClassDays(data.classDays || [1, 2, 3, 4, 5]);
          setModules(data.modules || []);
          
          if (data.msep) {
            setMsep({
              objetivoGeral: data.msep.objetivoGeral || '',
              capacidadesBasicas: data.msep.capacidadesBasicas || [],
              capacidadesTecnicas: data.msep.capacidadesTecnicas || [],
              capacidadesSocioemocionais: data.msep.capacidadesSocioemocionais || [],
              conhecimentos: data.msep.conhecimentos || [],
              infraestrutura: data.msep.infraestrutura || '',
              situacoesAprendizagem: data.msep.situacoesAprendizagem || '',
              criteriosAvaliacao: data.msep.criteriosAvaliacao || '',
              estrategiasEnsino: data.msep.estrategiasEnsino || '',
              atividadesPraticas: data.msep.atividadesPraticas || [],
              instrumentosAvaliacao: data.msep.instrumentosAvaliacao || []
            });
          }
          
          setScheduleOverrides(data.scheduleOverrides || {});
        } else {
          alert("Turma não encontrada.");
          navigate('/classes');
        }
      } catch (err) {
        console.error("Erro ao carregar turma", err);
        alert("Erro ao carregar dados da turma.");
      } finally {
        setLoading(false);
      }
    };
    loadPlan();
  }, [id, navigate]);

  // Weekdays handler
  const toggleDay = (day: number) => {
    setClassDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // Modules controls
  const moveModuleUp = (index: number) => {
    if (index === 0) return;
    const copy = [...modules];
    const temp = copy[index];
    copy[index] = copy[index - 1];
    copy[index - 1] = temp;
    setModules(copy);
  };

  const moveModuleDown = (index: number) => {
    if (index === modules.length - 1) return;
    const copy = [...modules];
    const temp = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temp;
    setModules(copy);
  };

  const deleteModule = (index: number) => {
    if (window.confirm("Deseja realmente remover este módulo?")) {
      setModules(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addModule = () => {
    const newModule: Module = {
      name: "Novo Módulo",
      hours: 40,
      objective: "",
      technicalCapabilities: [],
      socioemotionalCapabilities: [],
      knowledge: [],
      recommendations: "",
      aiSuggestions: ""
    };
    setModules(prev => [...prev, newModule]);
  };

  const updateModule = (index: number, key: keyof Module, value: string | number | string[]) => {
    const copy = [...modules];
    copy[index] = { ...copy[index], [key]: value };
    setModules(copy);
  };

  // Dynamic calculations
  let scheduleResult: DetailedScheduleResult | null = null;
  let calculationError = '';

  try {
    if (startDate && classDays.length > 0 && hoursPerDay > 0 && modules.length > 0) {
      scheduleResult = calculateDetailedSchedule(
        { startDate, classDays, holidays, hoursPerDay },
        modules.map(m => ({ name: m.name, hours: m.hours })),
        scheduleOverrides
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    calculationError = error.message;
  }

  // Save Day Override
  const saveDayOverride = () => {
    if (!editingDay) return;
    setScheduleOverrides(prev => {
      const copy = { ...prev };
      if (editingDay.type === 'default' && !editingDay.note.trim()) {
        delete copy[editingDay.dateStr];
      } else {
        copy[editingDay.dateStr] = {
          type: editingDay.type === 'default' ? undefined : editingDay.type,
          note: editingDay.note.trim() || undefined
        };
      }
      return copy;
    });
    setEditingDay(null);
  };

  // Save teaching plan to database
  const handleSave = async () => {
    if (!id) return;
    if (!name.trim()) {
      alert("Por favor, preencha o nome da turma.");
      return;
    }
    if (!startDate) {
      alert("Por favor, preencha a data de início.");
      return;
    }
    if (classDays.length === 0) {
      alert("Selecione pelo menos um dia de aula.");
      return;
    }
    if (modules.length === 0) {
      alert("Adicione pelo menos um módulo.");
      return;
    }

    let calculatedEndDate: string;
    try {
      const totalHours = modules.reduce((sum, m) => sum + Number(m.hours || 0), 0);
      const res = calculateEndDate({
        startDate,
        totalHours,
        hoursPerDay: Number(hoursPerDay),
        classDays,
        holidays
      }, scheduleOverrides);
      calculatedEndDate = res.endDate;
    } catch (err: unknown) {
      const error = err as Error;
      alert("Erro no cálculo logístico: " + error.message);
      return;
    }

    setSaving(true);
    try {
      const totalHours = modules.reduce((sum, m) => sum + Number(m.hours || 0), 0);
      const updatedPlan: Partial<TeachingPlan> = {
        name,
        startDate,
        endDate: calculatedEndDate,
        hoursPerDay: Number(hoursPerDay),
        classDays,
        totalHours,
        modules,
        msep,
        scheduleOverrides
      };

      await updateDoc(doc(db, 'teaching_plans', id), updatedPlan);
      alert("Alterações salvas com sucesso!");
      navigate('/classes');
    } catch (err) {
      console.error("Erro ao salvar", err);
      alert("Erro ao salvar alterações no banco de dados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 animate-pulse">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium tracking-wide">Buscando dados da turma...</p>
      </div>
    );
  }

  const totalHoursCalculated = modules.reduce((sum, m) => sum + Number(m.hours || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-550">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-industrial-800 p-6 rounded-3xl border border-industrial-700 shadow-2xl relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/classes')} 
            className="p-3 bg-industrial-900 hover:bg-industrial-700/50 rounded-2xl border border-industrial-700 text-slate-400 hover:text-white transition-all shadow-md"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
              Editar Turma: <span className="text-primary">{name || 'Sem nome'}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Configure parâmetros, reordene módulos e personalize datas do cronograma</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/classes')} 
            className="px-5 py-2.5 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700/50 text-slate-300 rounded-xl font-medium transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2.5 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={18} />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="bg-industrial-800 rounded-2xl border border-industrial-700 overflow-hidden flex shadow-lg">
        <button 
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-4 px-4 font-semibold text-sm border-b-2 text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'general' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Settings size={16} />
          Configurações Gerais
        </button>
        <button 
          onClick={() => setActiveTab('modules')}
          className={`flex-1 py-4 px-4 font-semibold text-sm border-b-2 text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'modules' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Layers size={16} />
          Módulos ({modules.length})
        </button>
        <button 
          onClick={() => setActiveTab('msep')}
          className={`flex-1 py-4 px-4 font-semibold text-sm border-b-2 text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'msep' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <BookOpen size={16} />
          Matriz Pedagógica MSEP
        </button>
        <button 
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-4 px-4 font-semibold text-sm border-b-2 text-center transition-all flex items-center justify-center gap-2 ${activeTab === 'schedule' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Calendar size={16} />
          Cronograma & Notas
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-industrial-800 border border-industrial-700 rounded-3xl p-8 shadow-xl">
        
        {/* TAB 1: General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-lg font-bold text-white mb-4">Dados Estruturais da Turma</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Nome da Turma</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all shadow-inner"
                  placeholder="Ex: Técnico em Desenvolvimento de Sistemas - Tarde"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Data de Início</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all shadow-inner cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Carga Horária Diária (Horas/Dia)</label>
                <select 
                  value={hoursPerDay} 
                  onChange={e => setHoursPerDay(Number(e.target.value))}
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all shadow-inner cursor-pointer"
                >
                  <option value={2}>2 horas por dia</option>
                  <option value={3}>3 horas por dia</option>
                  <option value={4}>4 horas por dia</option>
                  <option value={5}>5 horas por dia</option>
                  <option value={6}>6 horas por dia</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-3">Dias Letivos na Semana</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => {
                    const active = classDays.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-blue-500/10' : 'bg-industrial-900 border-industrial-700 text-slate-500 hover:text-slate-300 hover:border-industrial-600'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-industrial-900 rounded-2xl border border-industrial-700 flex items-start gap-3 mt-8">
              <Info className="text-primary mt-0.5" size={18} />
              <div className="text-xs text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-300 mb-1">Cálculo Logístico Ativo</p>
                Qualquer modificação no Nome, Data de Início, Horas/Dia ou Dias Letivos alterará automaticamente o cronograma sequencial de todas as disciplinas e a data estimada de término do curso.
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Modules Reordering & Editing */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Módulos da Turma</h2>
                <p className="text-slate-400 text-xs mt-1">Carga Horária Total: <span className="text-primary font-bold">{totalHoursCalculated}h</span></p>
              </div>
              <button 
                onClick={addModule}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-md"
              >
                <Plus size={16} />
                Adicionar Módulo
              </button>
            </div>

            {modules.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-industrial-700 rounded-2xl text-slate-500">
                Nenhum módulo cadastrado. Clique no botão acima para adicionar.
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((mod, index) => (
                  <div key={index} className="bg-industrial-900 border border-industrial-700/60 p-5 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative group hover:border-industrial-600 transition-all shadow-md">
                    
                    <div className="flex items-center gap-4 flex-1 w-full">
                      {/* Order Controls */}
                      <div className="flex flex-col gap-1.5">
                        <button 
                          onClick={() => moveModuleUp(index)} 
                          disabled={index === 0}
                          className="p-1 bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-slate-400 disabled:opacity-30 rounded transition-all"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span className="text-center text-xs font-mono font-bold text-slate-500">{index + 1}</span>
                        <button 
                          onClick={() => moveModuleDown(index)} 
                          disabled={index === modules.length - 1}
                          className="p-1 bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-slate-400 disabled:opacity-30 rounded transition-all"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 flex-1">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nome do Módulo</label>
                          <input 
                            type="text" 
                            value={mod.name} 
                            onChange={e => updateModule(index, 'name', e.target.value)}
                            className="w-full bg-industrial-800 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Carga Horária (h)</label>
                          <input 
                            type="number" 
                            value={mod.hours} 
                            onChange={e => updateModule(index, 'hours', Number(e.target.value))}
                            className="w-full bg-industrial-800 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-sm text-white outline-none transition-all font-mono"
                          />
                        </div>
                      </div>
                    </div>

                                  <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        type="button"
                        onClick={() => navigate(`/classes/${id}/modules/${index}/teaching-plan`)}
                        className="p-2.5 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs font-semibold"
                        title="Abrir Plano de Ensino deste Módulo"
                      >
                        <FileEdit size={14} />
                        <span className="hidden sm:inline">Plano de Ensino</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPrecedenceModal(index)}
                        className="p-2.5 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs font-semibold"
                        title="Vincular a Múltiplos Semestres/Módulos"
                      >
                        <Sparkles size={14} />
                        <span className="hidden sm:inline">Vincular a Semestres</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteModule(index)}
                        className="p-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all shadow-md"
                        title="Deletar Módulo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Matrix Pedagogical Suggestions (MSEP) */}
        {activeTab === 'msep' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white mb-4">Matriz Pedagógica e Orientações (MSEP)</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-2">Objetivo Geral do Curso</label>
                <textarea 
                  value={msep.objetivoGeral} 
                  onChange={e => setMsep({...msep, objetivoGeral: e.target.value})}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner"
                  placeholder="Descreva o propósito principal do plano de ensino"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Capacidades Básicas (Separadas por vírgula)</label>
                <textarea 
                  value={msep.capacidadesBasicas.join(', ')} 
                  onChange={e => setMsep({...msep, capacidadesBasicas: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                  placeholder="Comunicação, Raciocínio, ..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Capacidades Técnicas (Separadas por vírgula)</label>
                <textarea 
                  value={msep.capacidadesTecnicas.join(', ')} 
                  onChange={e => setMsep({...msep, capacidadesTecnicas: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                  placeholder="Instalação de software, Manipulação de arrays, ..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Capacidades Socioemocionais (Separadas por vírgula)</label>
                <textarea 
                  value={msep.capacidadesSocioemocionais.join(', ')} 
                  onChange={e => setMsep({...msep, capacidadesSocioemocionais: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                  placeholder="Empatia, Resiliência, Autogestão, ..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Conhecimentos / Temas de Estudo (Separados por vírgula)</label>
                <textarea 
                  value={msep.conhecimentos.join(', ')} 
                  onChange={e => setMsep({...msep, conhecimentos: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                  placeholder="Algoritmos, Loops, Estruturas Condicionais, ..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-300 mb-2">Infraestrutura Necessária</label>
                <input 
                  type="text" 
                  value={msep.infraestrutura} 
                  onChange={e => setMsep({...msep, infraestrutura: e.target.value})}
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all shadow-inner"
                  placeholder="Ex: Laboratório de informática equipado com VS Code, projetor e NodeJS"
                />
              </div>

              {/* IA SUGGESTIONS */}
              <div className="md:col-span-2 mt-4 pt-6 border-t border-industrial-700">
                <h3 className="text-md font-semibold text-primary mb-4 flex items-center gap-2">Sugestões de Apoio Pedagógico</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-2">Situações de Aprendizagem (Sugestão IA)</label>
                    <textarea 
                      value={msep.situacoesAprendizagem} 
                      onChange={e => setMsep({...msep, situacoesAprendizagem: e.target.value})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-2">Atividades Práticas (Separadas por vírgula)</label>
                    <textarea 
                      value={msep.atividadesPraticas.join(', ')} 
                      onChange={e => setMsep({...msep, atividadesPraticas: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Estratégias de Ensino (Sugestão IA)</label>
                    <textarea 
                      value={msep.estrategiasEnsino} 
                      onChange={e => setMsep({...msep, estrategiasEnsino: e.target.value})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-2">Critérios de Avaliação (Sugestão IA)</label>
                    <textarea 
                      value={msep.criteriosAvaliacao} 
                      onChange={e => setMsep({...msep, criteriosAvaliacao: e.target.value})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded-xl p-3 text-white h-24 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all shadow-inner text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-2">Instrumentos de Avaliação (Separados por vírgula)</label>
                    <input 
                      type="text" 
                      value={msep.instrumentosAvaliacao.join(', ')} 
                      onChange={e => setMsep({...msep, instrumentosAvaliacao: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                      className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all shadow-inner text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Dynamic Calendar & Schedule Notes/Overrides */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Cronograma Interativo e Customização de Datas</h2>
              <p className="text-slate-400 text-xs mt-1">Clique em qualquer dia do calendário para forçar feriados, aulas extras ou registrar anotações específicas do dia.</p>
            </div>

            {calculationError && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <p className="font-bold">Erro no Cálculo de Cronograma</p>
                  <p className="text-sm mt-1">{calculationError}</p>
                </div>
              </div>
            )}

            {!calculationError && scheduleResult && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* Modules Schedule summary */}
                <div className="xl:col-span-4 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Módulos Calculados</h3>
                  <div className="space-y-3">
                    {scheduleResult.modules.map((m, i) => (
                      <div key={i} className="bg-industrial-900 border border-industrial-700/50 p-4 rounded-2xl relative">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">Módulo {i + 1}</span>
                          <span className="text-xs font-mono text-slate-500">{m.classDates.length * hoursPerDay}h</span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{m.moduleName}</h4>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2">
                          <span>Início: {m.startDate ? format(parseISO(m.startDate), 'dd/MM/yy') : '--/--'}</span>
                          <ChevronRight size={10} className="text-slate-700" />
                          <span>Fim: {m.endDate ? format(parseISO(m.endDate), 'dd/MM/yy') : '--/--'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day list with edit option */}
                <div className="xl:col-span-8 space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Linha do Tempo Completa</h3>
                  
                  <div className="bg-industrial-900 border border-industrial-700 rounded-3xl p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                      {scheduleResult.fullHistory.map((day, i) => {
                        const date = parseISO(day.date);
                        
                        // Map status styles
                        let statusColor = 'bg-slate-800 text-slate-400 border-slate-700';
                        let label = 'Fora da Grade';
                        
                        if (day.type === 'class') {
                          statusColor = 'bg-blue-500/10 text-primary border-primary/20';
                          label = 'Dia de Aula';
                        } else if (day.type === 'holiday') {
                          statusColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                          label = 'Feriado / Recesso';
                        } else if (day.type === 'weekend') {
                          statusColor = 'bg-slate-800/40 text-slate-600 border-slate-700/30';
                          label = 'Final de Semana';
                        }

                        const hasOverride = scheduleOverrides[day.date];

                        return (
                          <div 
                            key={i} 
                            onClick={() => {
                              setEditingDay({
                                dateStr: day.date,
                                type: hasOverride?.type || 'default',
                                note: hasOverride?.note || ''
                              });
                            }}
                            className="flex items-center justify-between p-3 rounded-xl bg-industrial-800/40 border border-industrial-700/50 hover:border-primary/40 hover:bg-industrial-700/15 cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                              {/* Date badge */}
                              <div className="flex flex-col items-center justify-center min-w-[44px] h-12 rounded-xl bg-industrial-900 border border-industrial-700">
                                <span className="text-sm font-bold text-white">{format(date, 'dd')}</span>
                                <span className="text-[8px] uppercase text-slate-500">{format(date, 'EEE', { locale: ptBR })}</span>
                              </div>

                              {/* Label / Status / Note */}
                              <div className="overflow-hidden flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                                    {label}
                                  </span>
                                  {hasOverride && (
                                    <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                                      Customizado
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5 mt-1.5">
                                  {day.note ? (
                                    <span className="text-xs text-accent font-medium leading-relaxed truncate">{day.note}</span>
                                  ) : day.type === 'class' ? (
                                    <span className="text-xs text-slate-300 font-medium truncate">
                                      Aula do curso ({hoursPerDay}h letivas)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 italic truncate">Sem observações</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button className="p-2 hover:bg-industrial-700 rounded-lg text-slate-500 hover:text-slate-300 transition-colors ml-4">
                              <Edit3 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* OVERRIDE DAY DIALOG / MODAL */}
      {editingDay && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden animate-in zoom-in duration-200">
            {/* Design Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>

            <div className="mb-6">
              <h3 className="text-lg font-bold text-white">Editar Dia no Cronograma</h3>
              <p className="text-slate-400 text-xs mt-1">Data: <span className="text-primary font-bold">{format(parseISO(editingDay.dateStr), 'dd/MM/yyyy')} ({format(parseISO(editingDay.dateStr), 'EEEE', { locale: ptBR })})</span></p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Comportamento do Dia</label>
                <select 
                  value={editingDay.type}
                  onChange={e => setEditingDay({ ...editingDay, type: e.target.value as 'default' | 'class' | 'holiday' | 'off-day' | 'weekend' })}
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-white outline-none transition-all cursor-pointer"
                >
                  <option value="default">Padrão (Seguir logística da turma)</option>
                  <option value="class">Dia de Aula (Forçar dia letivo)</option>
                  <option value="holiday">Feriado / Recesso (Sem aula)</option>
                  <option value="weekend">Final de Semana (Sem aula)</option>
                  <option value="off-day">Fora de Grade (Sem aula)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Anotação / Título da Aula</label>
                <textarea 
                  value={editingDay.note}
                  onChange={e => setEditingDay({ ...editingDay, note: e.target.value })}
                  placeholder="Ex: Prova final, Visita técnica, Palestra..."
                  className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-3 text-white h-24 outline-none transition-all resize-none shadow-inner"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => setEditingDay(null)}
                className="px-4 py-2 bg-industrial-900 hover:bg-industrial-700/50 text-slate-400 rounded-xl transition-all font-medium"
              >
                Voltar
              </button>
              <button 
                onClick={saveDayOverride}
                className="px-5 py-2 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-md"
              >
                <CheckCircle2 size={16} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRECEDENCE DIALOG / MODAL */}
      {precedenceModal && precedenceModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-industrial-800 border border-industrial-700 rounded-3xl w-full max-w-2xl shadow-2xl p-8 relative overflow-hidden animate-in zoom-in duration-250 my-8">
            {/* Design Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>

            <div className="mb-6">
              <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-primary animate-pulse" />
                Vincular a Semestres / Distribuir Componente
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Duplique o componente <span className="text-white font-semibold">"{modules[precedenceModal.moduleIndex].name}"</span> em múltiplos semestres e organize seus conhecimentos usando IA.
              </p>
            </div>

            <div className="space-y-6">
              {/* Semester target inputs */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Definir Semestres de Destino</label>
                  <button
                    type="button"
                    onClick={handleAddSemesterInput}
                    className="text-[10px] bg-industrial-900 hover:bg-industrial-700 text-primary border border-industrial-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
                  >
                    <Plus size={10} /> Add Semestre
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {precedenceModal.targetModuleNames.map((name, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs font-mono font-bold text-slate-500 min-w-[20px]">{idx + 1}º</span>
                      <input
                        type="text"
                        value={name}
                        onChange={e => handleUpdateSemesterNameInput(idx, e.target.value)}
                        placeholder={`Módulo do ${idx + 1}º Semestre`}
                        className="flex-1 bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2 text-sm text-white outline-none transition-all"
                      />
                      {precedenceModal.targetModuleNames.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSemesterInput(idx)}
                          className="p-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conhecimentos a serem distribuidos */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Tópicos / Conhecimentos Originais ({precedenceModal.currentKnowledge.length})
                </label>
                <div className="bg-industrial-900 border border-industrial-700 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 shadow-inner">
                  {precedenceModal.currentKnowledge.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Sem conhecimentos cadastrados neste módulo.</p>
                  ) : (
                    precedenceModal.currentKnowledge.map((k, i) => (
                      <span key={i} className="text-[10px] text-slate-300 bg-industrial-800 border border-industrial-700 px-2.5 py-1 rounded-lg">
                        {k}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Botão de rodar IA */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={runPrecedenceAI}
                  disabled={precedenceModal.loading || precedenceModal.currentKnowledge.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all text-sm w-full md:w-auto cursor-pointer"
                >
                  {precedenceModal.loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Analisando Precedência Pedagógica...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Distribuir Conhecimentos com Sentry AI
                    </>
                  )}
                </button>
              </div>

              {/* Resultados da IA */}
              {precedenceModal.allocations && (
                <div className="space-y-4 border-t border-industrial-700 pt-6 max-h-72 overflow-y-auto custom-scrollbar pr-1 animate-in fade-in duration-300">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Sugestão de Distribuição por Precedência</h4>
                  
                  <div className="space-y-3">
                    {precedenceModal.allocations.map((alloc, idx) => (
                      <div key={idx} className="bg-industrial-900 border border-industrial-700/60 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{alloc.moduleName}</span>
                          <span className="text-[9px] font-mono text-slate-400 bg-industrial-800 px-1.5 py-0.5 rounded">
                            {alloc.knowledge.length} tópicos
                          </span>
                        </div>
                        {alloc.justification && (
                          <p className="text-[10px] text-slate-450 italic">
                            <span className="font-semibold text-slate-350">Justificativa:</span> {alloc.justification}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alloc.knowledge.map((k, i) => (
                            <span key={i} className="text-[9px] text-slate-200 bg-industrial-800 px-2 py-0.5 rounded">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-industrial-700 pt-4">
              <button
                type="button"
                onClick={() => setPrecedenceModal(null)}
                className="px-4 py-2 bg-industrial-900 hover:bg-industrial-700/50 text-slate-400 rounded-xl transition-all font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyPrecedenceDistribution}
                disabled={!precedenceModal.allocations || precedenceModal.loading}
                className="px-6 py-2 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-md text-sm cursor-pointer"
              >
                <CheckCircle2 size={16} />
                Confirmar e Aplicar no Plano
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal stylesheet scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
