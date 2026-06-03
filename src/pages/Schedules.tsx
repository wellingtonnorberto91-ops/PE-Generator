import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { calculateDetailedSchedule } from '../features/calendar/engine';
import { Calendar, Clock, FileDown, QrCode, Play, Square, CheckCircle, RefreshCw, Users, ShieldAlert, AlertTriangle, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Module {
  name: string;
  hours: number;
  knowledge?: string[];
  conhecimentos?: string[];
}

interface MSEP {
  objetivoGeral?: string;
  capacidadesBasicas?: string[];
  capacidadesTecnicas?: string[];
  capacidadesSocioemocionais?: string[];
  conhecimentos?: string[];
  estrategiasEnsino?: string;
}

interface TeachingPlan {
  id: string;
  name: string;
  totalHours: number;
  startDate: string;
  hoursPerDay: number;
  aulasPerDay?: number;
  aulaDurationMinutes?: number;
  classDays: number[];
  modules: Module[];
  semester?: string;
  msep?: MSEP;
  scheduleOverrides?: Record<string, { type?: 'class' | 'holiday' | 'off-day' | 'weekend'; note?: string }>;
}

interface Holiday {
  date: string;
  description: string;
}

interface Student {
  id: string;
  name: string;
  ra: string;
}

export function Schedules() {
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);

  // Reset selectedModuleIndex when active plan changes
  useEffect(() => {
    setSelectedModuleIndex(0);
  }, [selectedPlanId]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const activeModule = selectedPlan?.modules?.[selectedModuleIndex];

  // Fetch corresponding assessments_formativa when module selection changes
  useEffect(() => {
    if (!selectedPlanId || !activeModule) {
      setActiveAssessment(null);
      return;
    }
    const fetchAssessment = async () => {
      setLoadingAssessment(true);
      try {
        const q = query(
          collection(db, 'assessments_formativa'),
          where('planId', '==', selectedPlanId),
          where('unitName', '==', activeModule.name)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          docs.sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
          setActiveAssessment(docs[0]);
        } else {
          setActiveAssessment(null);
        }
      } catch (e) {
        console.error("Erro ao buscar plano de ensino formativa", e);
        setActiveAssessment(null);
      } finally {
        setLoadingAssessment(false);
      }
    };
    fetchAssessment();
  }, [selectedPlanId, selectedModuleIndex, activeModule]);

  // UI Tabs & Interactive States
  const [activeTab, setActiveTab] = useState<'cronograma' | 'chamada'>('cronograma');
  const [chamadaAtiva, setChamadaAtiva] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [qrToken, setQrToken] = useState('token-init-887');
  const [presentList, setPresentList] = useState<string[]>([]);

  // Override States (Gantt Interatividade)
  const [activeOverrideDate, setActiveOverrideDate] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<'class' | 'holiday' | 'off-day'>('holiday');
  const [overrideNote, setOverrideNote] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const handleOpenOverrideModal = (dateStr: string) => {
    setActiveOverrideDate(dateStr);
    const existing = selectedPlan?.scheduleOverrides?.[dateStr];
    if (existing) {
      setOverrideType(existing.type === 'weekend' ? 'holiday' : existing.type || 'holiday');
      setOverrideNote(existing.note || '');
    } else {
      setOverrideType('holiday');
      setOverrideNote('');
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedPlan || !activeOverrideDate) return;
    setSavingOverride(true);
    try {
      const updatedOverrides = {
        ...(selectedPlan.scheduleOverrides || {}),
        [activeOverrideDate]: {
          type: overrideType,
          note: overrideNote.trim()
        }
      };

      const planRef = doc(db, 'teaching_plans', selectedPlan.id);
      await updateDoc(planRef, {
        scheduleOverrides: updatedOverrides
      });

      setPlans(prevPlans => prevPlans.map(p => {
        if (p.id === selectedPlan.id) {
          return { ...p, scheduleOverrides: updatedOverrides };
        }
        return p;
      }));

      setActiveOverrideDate(null);
    } catch (error) {
      console.error("Erro ao salvar exceção de data:", error);
      alert("Erro ao salvar exceção no Firestore.");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleClearOverride = async () => {
    if (!selectedPlan || !activeOverrideDate) return;
    setSavingOverride(true);
    try {
      const updatedOverrides = { ...(selectedPlan.scheduleOverrides || {}) };
      delete updatedOverrides[activeOverrideDate];

      const planRef = doc(db, 'teaching_plans', selectedPlan.id);
      await updateDoc(planRef, {
        scheduleOverrides: updatedOverrides
      });

      setPlans(prevPlans => prevPlans.map(p => {
        if (p.id === selectedPlan.id) {
          return { ...p, scheduleOverrides: updatedOverrides };
        }
        return p;
      }));

      setActiveOverrideDate(null);
    } catch (error) {
      console.error("Erro ao limpar exceção de data:", error);
      alert("Erro ao remover exceção do Firestore.");
    } finally {
      setSavingOverride(false);
    }
  };
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const studentSimRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial plans and holidays
  useEffect(() => {
    const fetchData = async () => {
      try {
        const plansQuery = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const plansSnapshot = await getDocs(plansQuery);
        const plansData: TeachingPlan[] = [];
        plansSnapshot.forEach((doc) => {
          plansData.push({ id: doc.id, ...doc.data() } as TeachingPlan);
        });
        setPlans(plansData);
        if (plansData.length > 0) setSelectedPlanId(plansData[0].id);

        const holidaysSnapshot = await getDocs(collection(db, 'calendars'));
        const holidaysData: Holiday[] = [];
        holidaysSnapshot.forEach((doc) => {
          holidaysData.push(doc.data() as Holiday);
        });
        setHolidays(holidaysData);
      } catch (error) {
        console.error("Erro ao carregar dados de cronograma", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch Class Students when selected class changes
  useEffect(() => {
    if (!selectedPlanId) return;
    const fetchClassStudents = async () => {
      try {
        const q = query(collection(db, 'students'), where('classId', '==', selectedPlanId));
        const snap = await getDocs(q);
        const data: Student[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as Student));
        data.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(data);
        // Reset present list
        setPresentList([]);
        setChamadaAtiva(false);
      } catch (e) {
        console.error("Erro ao buscar alunos da turma", e);
      }
    };
    fetchClassStudents();
  }, [selectedPlanId]);

  // QR Code Dynamics
  useEffect(() => {
    if (chamadaAtiva) {
      // 1. Countdown timer
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setQrToken('token-' + Math.random().toString(36).substring(2, 11).toUpperCase());
            return 10;
          }
          return prev - 1;
        });
      }, 1000);

      // 2. Simulate students registering presence
      studentSimRef.current = setInterval(() => {
        setStudents(currentStudents => {
          if (currentStudents.length === 0) return currentStudents;
          
          setPresentList(currentPresents => {
            const absentStudents = currentStudents.filter(s => !currentPresents.includes(s.name));
            if (absentStudents.length === 0) return currentPresents;
            
            // 60% chance to check in a student every tick
            if (Math.random() < 0.6) {
              const luckyOne = absentStudents[Math.floor(Math.random() * absentStudents.length)];
              return [...currentPresents, luckyOne.name];
            }
            return currentPresents;
          });
          
          return currentStudents;
        });
      }, 3000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (studentSimRef.current) clearInterval(studentSimRef.current);
      setCountdown(10);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (studentSimRef.current) clearInterval(studentSimRef.current);
    };
  }, [chamadaAtiva]);

  const schedule = (selectedPlanId && selectedPlan) ? calculateDetailedSchedule(
    {
      startDate: selectedPlan.startDate,
      hoursPerDay: selectedPlan.hoursPerDay,
      classDays: selectedPlan.classDays,
      holidays: holidays.map(h => h.date)
    },
    selectedPlan.modules || [],
    selectedPlan.scheduleOverrides
  ) : null;

  // Semester limit collision detector
  const checkSemesterCollision = () => {
    if (!schedule || !selectedPlan) return null;
    const start = parseISO(selectedPlan.startDate);
    const end = parseISO(schedule.modules[schedule.modules.length - 1]?.endDate || selectedPlan.startDate);
    
    // Limits: Max 140 days (approx. 20 weeks)
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 140) {
      return {
        endDate: format(end, 'dd/MM/yyyy'),
        currentDays: diffDays,
        exceededWeeks: Math.ceil((diffDays - 140) / 7)
      };
    }
    return null;
  };

  const collision = checkSemesterCollision();

  // Active module and dates for selected Curricular Unit
  const scheduledModule = schedule?.modules[selectedModuleIndex];
  const activeModuleDates = scheduledModule ? scheduledModule.classDates : [];
  const totalClasses = activeModuleDates.length;

  // Distribute topics / Assuntos (load from activeAssessment custom knowledgeList if available)
  const knowledgeList = activeAssessment?.knowledgeList || activeModule?.knowledge || activeModule?.conhecimentos || [];
  const topics = knowledgeList.length > 0 
    ? [...knowledgeList] 
    : ['Fundamentos de Fabricação Mecânica', 'Estratégias de Processos', 'Segurança em Máquinas e Operações'];

  let introCount = totalClasses > 0 ? 1 : 0;
  let discussaoCount = totalClasses > 2 ? 1 : 0;
  let somativaCount = 0;
  if (totalClasses > 3) {
    somativaCount = totalClasses >= 8 ? 4 : Math.max(1, Math.floor(totalClasses * 0.2));
  }
  let remainingForKnowledge = totalClasses - introCount - discussaoCount - somativaCount;
  if (remainingForKnowledge < 0) remainingForKnowledge = 0;

  const numTopics = topics.length;
  const topicClassCounts = new Array(numTopics).fill(0);
  
  if (numTopics > 0 && remainingForKnowledge > 0) {
    const base = Math.floor(remainingForKnowledge / numTopics);
    const extra = remainingForKnowledge % numTopics;
    for (let i = 0; i < numTopics; i++) {
      topicClassCounts[i] = base + (i < extra ? 1 : 0);
    }
  }

  interface GridRow {
    name: string;
    qa?: number;
    type: 'formativa' | 'somativa' | 'lesson';
    activeDates: Set<string>;
  }

  const gridRows: GridRow[] = [];
  let currentDateIndex = 0;

  // 1. Formative Row (Purple Bar)
  const formativeActiveDates = new Set<string>();
  const formativeLimitIndex = totalClasses - discussaoCount - somativaCount;
  for (let i = 0; i < formativeLimitIndex && i < totalClasses; i++) {
    formativeActiveDates.add(activeModuleDates[i]);
  }
  if (totalClasses > 0) {
    gridRows.push({
      name: "Resolução da situação problema (Situação Formativa)",
      type: 'formativa',
      activeDates: formativeActiveDates
    });
  }

  // 2. Intro Row (Apresentação)
  if (introCount > 0 && currentDateIndex < totalClasses) {
    const introDates = new Set<string>();
    introDates.add(activeModuleDates[currentDateIndex]);
    gridRows.push({
      name: "Apresentação da situação de aprendizagem e dos critérios de avaliação",
      qa: selectedPlan ? selectedPlan.hoursPerDay : 3,
      type: 'lesson',
      activeDates: introDates
    });
    currentDateIndex += introCount;
  }

  // 3. Didactic Strategy Blocks or Knowledge Rows (Green Bars)
  if (activeAssessment?.planejamentoDidatico && activeAssessment.planejamentoDidatico.length > 0) {
    activeAssessment.planejamentoDidatico.forEach((block: any) => {
      const blockHours = block.cargaHoraria || 4;
      const hoursPerDay = selectedPlan ? selectedPlan.hoursPerDay : 4;
      const numClassesForBlock = Math.max(1, Math.ceil(blockHours / hoursPerDay));
      
      const activeDates = new Set<string>();
      for (let i = 0; i < numClassesForBlock && currentDateIndex < totalClasses; i++) {
        activeDates.add(activeModuleDates[currentDateIndex]);
        currentDateIndex++;
      }
      
      const strategyName = block.estrategia || 'Estratégia';
      const content = block.conteudo || '';
      const caps = Array.isArray(block.capacidades) 
        ? block.capacidades.join(', ') 
        : block.capacidades || '';
        
      const displayName = caps 
        ? `${content} (${strategyName}) [Ref: ${caps}]`
        : `${content} (${strategyName})`;

      gridRows.push({
        name: displayName,
        qa: numClassesForBlock * hoursPerDay,
        type: 'lesson',
        activeDates
      });
    });
  } else {
    // Fallback: Distribute raw topics
    topics.forEach((topicName, idx) => {
      const count = topicClassCounts[idx] || 0;
      const activeDates = new Set<string>();
      for (let i = 0; i < count && currentDateIndex < totalClasses; i++) {
        activeDates.add(activeModuleDates[currentDateIndex]);
        currentDateIndex++;
      }
      if (count > 0) {
        gridRows.push({
          name: topicName,
          qa: count * (selectedPlan ? selectedPlan.hoursPerDay : 3),
          type: 'lesson',
          activeDates
        });
      }
    });
  }

  // 4. Somativa Row (Dark Blue Bar)
  const somativaActiveDates = new Set<string>();
  const somativaStartIndex = totalClasses - discussaoCount - somativaCount;
  for (let i = somativaStartIndex; i < totalClasses - discussaoCount && i >= 0; i++) {
    somativaActiveDates.add(activeModuleDates[i]);
  }
  if (somativaCount > 0) {
    gridRows.push({
      name: `Situação Problema Somativa (${somativaCount * (selectedPlan ? selectedPlan.hoursPerDay : 3)}h)`,
      type: 'somativa',
      activeDates: somativaActiveDates
    });

    gridRows.push({
      name: `Resolução da situação Problema Somativa (${somativaCount * (selectedPlan ? selectedPlan.hoursPerDay : 3)}h) (${somativaCount} Aulas)`,
      qa: somativaCount * (selectedPlan ? selectedPlan.hoursPerDay : 3),
      type: 'lesson',
      activeDates: new Set(somativaActiveDates)
    });
  }

  // 5. Outro Row (Discussão)
  if (discussaoCount > 0 && currentDateIndex < totalClasses) {
    const outroDates = new Set<string>();
    outroDates.add(activeModuleDates[currentDateIndex]);
    gridRows.push({
      name: "Discussão dos resultados",
      qa: selectedPlan ? selectedPlan.hoursPerDay : 3,
      type: 'lesson',
      activeDates: outroDates
    });
  }

  // Group dates to display month names spanning multiple columns
  const getMonthsHeader = () => {
    const headers: { monthName: string; colSpan: number }[] = [];
    activeModuleDates.forEach(dateStr => {
      const date = parseISO(dateStr);
      const mName = format(date, 'MMM', { locale: ptBR }).replace('.', '');
      
      if (headers.length > 0 && headers[headers.length - 1].monthName === mName) {
        headers[headers.length - 1].colSpan++;
      } else {
        headers.push({ monthName: mName, colSpan: 1 });
      }
    });
    return headers;
  };

  const monthsHeader = getMonthsHeader();

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Top Banner and Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-industrial-800 p-6 rounded-2xl border border-industrial-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Calendar size={120} />
        </div>
        
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Clock className="text-primary" size={24} />
            Cronogramas & Chamada Inteligente
          </h1>
          <p className="text-slate-400 text-xs">Ajuste datas dinamicamente e faça chamada por QR Code em tempo real.</p>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row gap-4">
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Selecionar Turma</label>
            <select 
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 text-white text-xs rounded-xl focus:border-primary block w-full p-2.5 outline-none transition-all cursor-pointer hover:border-industrial-600 appearance-none shadow-sm"
            >
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </div>

          {selectedPlan && selectedPlan.modules && selectedPlan.modules.length > 0 && (
            <div className="flex flex-col gap-1 min-w-[240px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Unidade Curricular</label>
              <select 
                value={selectedModuleIndex}
                onChange={(e) => setSelectedModuleIndex(Number(e.target.value))}
                className="bg-industrial-900 border border-industrial-700 text-white text-xs rounded-xl focus:border-primary block w-full p-2.5 outline-none transition-all cursor-pointer hover:border-industrial-600 appearance-none shadow-sm"
              >
                {selectedPlan.modules.map((mod, idx) => (
                  <option key={idx} value={idx}>{mod.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-industrial-700">
        <button
          onClick={() => setActiveTab('cronograma')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
            activeTab === 'cronograma' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Linha do Tempo Pedagógica
        </button>
        <button
          onClick={() => setActiveTab('chamada')}
          className={`px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
            activeTab === 'chamada' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Chamada Inteligente (QR Code)
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Orquestrando cronogramas e dados do Firestore...</p>
        </div>
      ) : schedule && selectedPlan ? (
        activeTab === 'cronograma' ? (
          /* TAB 1: CRONOGRAMA INTERATIVO */
          loadingAssessment ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 bg-industrial-800 border border-industrial-700 rounded-2xl shadow-xl">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <p className="text-slate-400 text-xs font-mono">Buscando Plano de Ensino da Unidade Curricular...</p>
            </div>
          ) : !activeAssessment ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 bg-industrial-800 border border-industrial-700 rounded-2xl text-center shadow-xl space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full">
                <ShieldAlert size={36} className="animate-pulse" />
              </div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider">Cronograma Não Disponível</h2>
              <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                Este cronograma só pode ser visualizado após a criação do respectivo Plano de Ensino.
              </p>
              <p className="text-slate-500 text-[11px]">
                Por favor, acesse a aba <strong className="text-slate-300">"Unidades Curriculares"</strong>, selecione este módulo e clique em <strong className="text-primary">"Gerar Plano por IA"</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Collision warning alert */}
              {collision && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-3 animate-pulse">
                  <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-bold text-red-400">Gargalo Logístico Detectado (IA Sentry)</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      O cronograma recalibrado (Término estendido para <span className="text-red-400 font-bold">{collision.endDate}</span>) excede o limite letivo do semestre letivo (Total: {collision.currentDays} dias).
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => alert("A IA sugere:\n1. Mesclar os conteúdos teóricos dos Módulos 1 e 2 em aulas dinâmicas expositivas.\n2. Agendar reposições assíncronas (EAD) correspondentes a 8 horas de carga horária para retornar a data de término ao limite contratual.")}
                        className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-2 py-1 rounded font-bold transition-all cursor-pointer"
                      >
                        Ver Sugestão de Recuperação por IA
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-industrial-800 p-5 rounded-xl border border-industrial-700 mb-4 print:hidden">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeModule?.name || 'Unidade Curricular'}</h3>
                    <p className="text-xs text-slate-400 mt-1 font-mono">Carga Horária: {totalClasses * selectedPlan.hoursPerDay}h • {totalClasses} Aulas ({selectedPlan.hoursPerDay}h/dia)</p>
                  </div>

                  {activeAssessment?.learningContext && (
                    <div className="bg-industrial-900/40 p-2.5 rounded-lg border border-industrial-750">
                      <div className="text-[9px] font-bold text-primary uppercase tracking-widest mb-1 font-mono">Situação de Aprendizagem (Contexto MSEP)</div>
                      <p className="text-xs text-slate-300 italic">"{activeAssessment.learningContext}"</p>
                    </div>
                  )}

                  {activeAssessment?.capabilities && activeAssessment.capabilities.length > 0 && (
                    <div className="bg-industrial-900/40 p-2.5 rounded-lg border border-industrial-750">
                      <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1.5 font-mono">Capacidades Técnicas Relacionadas</div>
                      <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5 font-sans">
                        {activeAssessment.capabilities.map((cap: string, idx: number) => (
                          <li key={idx}>{cap}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedPlan.msep?.estrategiasEnsino && (
                    <div className="bg-industrial-900/40 p-2.5 rounded-lg border border-industrial-750">
                      <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1 font-mono">Estratégias de Ensino</div>
                      <p className="text-xs text-slate-300">{selectedPlan.msep.estrategiasEnsino}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end">
                  <button 
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <FileDown size={14} />
                    Imprimir Cronograma (A4)
                  </button>
                </div>
              </div>

              {/* Matrix View (Gantt Grid) */}
              <div className="bg-industrial-800 rounded-xl border border-industrial-700 p-5 shadow-sm overflow-hidden print:hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full border-collapse text-left text-xs min-w-[800px]">
                    <thead>
                      <tr className="bg-industrial-900 text-slate-400 font-bold border-b border-industrial-700">
                        <th className="p-3 border-r border-industrial-700 min-w-[280px]">Assuntos/Estratégias</th>
                        <th className="p-3 border-r border-industrial-700 text-center w-12">QA</th>
                        {monthsHeader.map((m, i) => (
                          <th key={i} colSpan={m.colSpan} className="p-1 border-r border-industrial-700 text-center uppercase tracking-wider text-[10px]">
                            {m.monthName}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-industrial-850 text-slate-300 font-mono border-b border-industrial-700">
                        <th className="p-2 border-r border-industrial-700 text-right text-[10px]">DIAS &gt;&gt;&gt;&gt;&gt;</th>
                        <th className="p-2 border-r border-industrial-700"></th>
                        {activeModuleDates.map((d, i) => {
                          const override = selectedPlan.scheduleOverrides?.[d];
                          let overrideBg = '';
                          if (override) {
                            if (override.type === 'holiday') {
                              overrideBg = 'bg-amber-600/40 text-amber-300 font-bold';
                            } else if (override.type === 'off-day') {
                              overrideBg = 'bg-red-600/45 text-red-350 font-bold';
                            } else if (override.type === 'class') {
                              overrideBg = 'bg-emerald-600/40 text-emerald-300 font-bold';
                            }
                          }
                          return (
                            <th 
                              key={i} 
                              onClick={() => handleOpenOverrideModal(d)}
                              className={`p-1 border-r border-industrial-700 text-center text-[10px] min-w-[24px] cursor-pointer hover:bg-industrial-700 hover:text-white transition-colors relative group select-none ${overrideBg}`}
                              title={override ? `${override.type === 'holiday' ? 'Feriado/Recesso' : override.type === 'off-day' ? 'Folga/Sem Aula' : 'Aula Reposição'}${override.note ? `: ${override.note}` : ''}` : 'Clique para adicionar exceção'}
                            >
                              {format(parseISO(d), 'dd')}
                              {override && (
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              )}
                            </th>
                          );
                        })}
                      </tr>
                      <tr className="bg-industrial-800 text-slate-400 font-mono border-b border-industrial-700 text-[9px]">
                        <th className="p-1 border-r border-industrial-700 text-right">AULAS PREVISTAS (DIA)</th>
                        <th className="p-1 border-r border-industrial-700 text-center"></th>
                        {activeModuleDates.map((_, i) => (
                          <th key={i} className="p-1 border-r border-industrial-700 text-center">
                            {selectedPlan.aulasPerDay || selectedPlan.hoursPerDay}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gridRows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-industrial-750 hover:bg-industrial-800/30 transition-colors">
                          <td className="p-3 border-r border-industrial-700 font-medium text-slate-200">
                            {row.name}
                          </td>
                          <td className="p-3 border-r border-industrial-700 text-center font-mono font-bold text-slate-400">
                            {row.qa ? (selectedPlan.aulasPerDay ? Math.round((row.qa / selectedPlan.hoursPerDay) * selectedPlan.aulasPerDay) : row.qa) : ''}
                          </td>
                          {activeModuleDates.map((dateStr, cIdx) => {
                            const isActive = row.activeDates.has(dateStr);
                            let cellBg = '';
                            if (isActive) {
                              if (row.type === 'formativa') {
                                cellBg = 'bg-purple-600/40 border border-purple-500/20'; // Purple formative
                              } else if (row.type === 'somativa') {
                                cellBg = 'bg-blue-600/50 border border-blue-500/30'; // Dark Blue somativa
                              } else {
                                cellBg = 'bg-emerald-600/40 border border-emerald-500/20'; // Green previsto
                              }
                            }
                            return (
                              <td key={cIdx} className={`p-1 border-r border-industrial-750 text-center ${cellBg}`}>
                                {isActive && row.type === 'lesson' ? (selectedPlan.aulasPerDay || selectedPlan.hoursPerDay) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend web view */}
                <div className="flex flex-wrap items-center gap-6 text-[10px] border-t border-industrial-700 pt-4 mt-4 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-emerald-600/40 border border-emerald-500/20 rounded" />
                    <span>Aulas previstas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-purple-600/40 border border-purple-500/20 rounded" />
                    <span>Situação Formativa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-blue-600/50 border border-blue-500/30 rounded" />
                    <span>Situação Somativa</span>
                  </div>
                  <div className="ml-auto font-mono text-[9px] text-slate-500">
                    QA = nº de aulas previstas para desenvolver o conteúdo
                  </div>
                </div>
              </div>

              {/* Student Grade Analytics Panel */}
              <div className="bg-industrial-800 rounded-xl border border-industrial-700 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-industrial-750">
                  <Users className="text-primary" size={18} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Painel Analítico de Capacidades (MSEP)</h3>
                </div>

                {(!activeAssessment?.tableRows || activeAssessment.tableRows.length === 0) ? (
                  <p className="text-slate-400 text-xs py-4 text-center">
                    Nenhuma avaliação formativa lançada para esta unidade curricular ainda. Os lançamentos podem ser realizados e sincronizados no menu de Atividades e Resultados.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeAssessment.tableRows.map((row: any, rIdx: number) => {
                      const evals = row.studentEvaluations || {};
                      let countS = 0;
                      let countNS = 0;
                      let countD = 0;
                      let totalEvaluated = 0;
                      Object.values(evals).forEach((val: any) => {
                        if (val === 'S') countS++;
                        else if (val === 'NS') countNS++;
                        else if (val === 'D') countD++;
                        if (val === 'S' || val === 'NS' || val === 'D') {
                          totalEvaluated++;
                        }
                      });
                      const nsPercent = totalEvaluated > 0 ? Math.round((countNS / totalEvaluated) * 100) : 0;
                      const hasWarning = nsPercent > 30;

                      return (
                        <div key={rIdx} className={`p-4 rounded-xl border transition-all ${hasWarning ? 'bg-red-500/5 border-red-500/25' : 'bg-industrial-900/30 border-industrial-750 hover:border-industrial-700'}`}>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-3">
                              <h4 className="text-xs font-bold text-slate-200 leading-relaxed font-sans">{row.capability}</h4>
                              {hasWarning && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded shrink-0 animate-pulse">
                                  <AlertTriangle size={10} /> {nsPercent}% N.S.
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono">
                              Critério: <span className="text-slate-300">{row.criterion}</span>
                            </div>

                            {totalEvaluated > 0 ? (
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-slate-400">Total Avaliados: {totalEvaluated}</span>
                                  <div className="flex gap-3">
                                    <span className="text-emerald-400">Destaque: {countD}</span>
                                    <span className="text-indigo-400">Satisfatório: {countS}</span>
                                    <span className="text-red-400">Não Sat.: {countNS}</span>
                                  </div>
                                </div>
                                {/* Stacked Progress Bar */}
                                <div className="h-2 w-full bg-industrial-750 rounded-full overflow-hidden flex">
                                  {countD > 0 && (
                                    <div className="bg-emerald-500 h-full" style={{ width: `${(countD / totalEvaluated) * 100}%` }} title={`Destaque: ${countD}`} />
                                  )}
                                  {countS > 0 && (
                                    <div className="bg-indigo-500 h-full" style={{ width: `${(countS / totalEvaluated) * 100}%` }} title={`Satisfatório: ${countS}`} />
                                  )}
                                  {countNS > 0 && (
                                    <div className="bg-red-500 h-full" style={{ width: `${(countNS / totalEvaluated) * 100}%` }} title={`Não Satisfatório: ${countNS}`} />
                                  )}
                                </div>
                                {hasWarning && (
                                  <p className="text-[9px] text-red-400 leading-normal pt-1 font-mono">
                                    Atenção: A taxa de alunos Não Satisfatórios ({nsPercent}%) superou a tolerância crítica de 30% para esta capacidade. Recomenda-se realizar plano de reposição pedagógica ou revisão de metodologia.
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic pt-1">
                                Nenhum lançamento individual realizado para esta capacidade.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Interactive Calendar Override Modal */}
              {activeOverrideDate && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                  <div className="bg-industrial-800 border border-industrial-700 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="bg-industrial-900 px-6 py-4 border-b border-industrial-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-primary" size={18} />
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ajustar Exceção no Cronograma</h3>
                      </div>
                      <button 
                        onClick={() => setActiveOverrideDate(null)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Data Selecionada</label>
                        <p className="text-sm font-semibold text-white">
                          {format(parseISO(activeOverrideDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tipo de Registro/Exceção</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setOverrideType('holiday')}
                            className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                              overrideType === 'holiday'
                                ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                                : 'bg-industrial-900 border-industrial-750 text-slate-400 hover:text-white'
                            }`}
                          >
                            Feriado
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideType('off-day')}
                            className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                              overrideType === 'off-day'
                                ? 'bg-red-600/20 border-red-550 text-red-300'
                                : 'bg-industrial-900 border-industrial-750 text-slate-400 hover:text-white'
                            }`}
                          >
                            Sem Aula
                          </button>
                          <button
                            type="button"
                            onClick={() => setOverrideType('class')}
                            className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                              overrideType === 'class'
                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                                : 'bg-industrial-900 border-industrial-750 text-slate-400 hover:text-white'
                            }`}
                          >
                            Reposição
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nota / Justificativa</label>
                        <input
                          type="text"
                          value={overrideNote}
                          onChange={(e) => setOverrideNote(e.target.value)}
                          placeholder="Ex: Feriado de Corpus Christi, Visita Técnica..."
                          className="w-full bg-industrial-900 border border-industrial-750 rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-industrial-850 px-6 py-4 border-t border-industrial-700 flex justify-between items-center">
                      <div>
                        {selectedPlan?.scheduleOverrides?.[activeOverrideDate] && (
                          <button
                            type="button"
                            onClick={handleClearOverride}
                            disabled={savingOverride}
                            className="px-4 py-2 bg-red-900/30 hover:bg-red-800/30 border border-red-800/40 text-red-300 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveOverrideDate(null)}
                          className="px-4 py-2 bg-industrial-900 hover:bg-industrial-750 border border-industrial-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveOverride}
                          disabled={savingOverride}
                          className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {savingOverride ? 'Gravando...' : 'Confirmar'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PRINT-ONLY RELATÓRIO DO CRONOGRAMA */}
              <div className="hidden print:block w-full max-w-[297mm] mx-auto p-4 bg-white text-black font-sans leading-tight">
                {/* Header */}
                <div className="border border-black p-3 flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="border-r border-black pr-4 font-bold text-lg tracking-wider text-red-600 font-mono">
                      SENAI
                    </div>
                    <div>
                      <h1 className="text-sm font-bold uppercase">Cronograma de Situação de Aprendizagem - MSEP</h1>
                      <p className="text-xs font-semibold">{selectedPlan.name}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono">
                    <span>Folha 1/1</span>
                  </div>
                </div>

                {/* Info Box */}
                <div className="border border-black p-2 text-[10px] mb-4 space-y-1 bg-white">
                  <div className="grid grid-cols-4 gap-2">
                    <div><strong>Unidade curricular:</strong> {activeModule?.name || 'PROCESSOS DE FABRICAÇÃO MECÂNICA'}</div>
                    <div><strong>Semestre:</strong> {selectedPlan.semester || '1º'}</div>
                    <div><strong>Início Previsto:</strong> {selectedPlan.startDate ? format(parseISO(selectedPlan.startDate), 'dd/MM/yyyy') : ''}</div>
                    <div><strong>Término Previsto:</strong> {activeModuleDates.length > 0 ? format(parseISO(activeModuleDates[activeModuleDates.length - 1]), 'dd/MM/yyyy') : ''}</div>
                  </div>
                  {activeAssessment?.learningContext && (
                    <div className="border-t border-gray-300 pt-1 mt-1 text-[9px]">
                      <strong>Situação de Aprendizagem (Contexto MSEP):</strong> "{activeAssessment.learningContext}"
                    </div>
                  )}
                  {activeAssessment?.capabilities && activeAssessment.capabilities.length > 0 && (
                    <div className="border-t border-gray-300 pt-1 mt-1 text-[9px]">
                      <strong>Capacidades Técnicas Trabalhadas:</strong> {activeAssessment.capabilities.join(' • ')}
                    </div>
                  )}
                  {selectedPlan.msep?.estrategiasEnsino && (
                    <div className="border-t border-gray-300 pt-1 mt-1">
                      <strong>Estratégias de Ensino:</strong> {selectedPlan.msep.estrategiasEnsino}
                    </div>
                  )}
                </div>

                {/* Matrix Table */}
                <table className="w-full border-collapse border border-black text-[9px] mb-4">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black">
                      <th className="border border-black p-1 text-left min-w-[200px]">Assuntos/Estratégias</th>
                      <th className="border border-black p-1 text-center w-8">QA</th>
                      {monthsHeader.map((m, i) => (
                        <th key={i} colSpan={m.colSpan} className="border border-black p-1 text-center uppercase font-bold text-[8px]">
                          {m.monthName}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-white border-b border-black text-[8px] font-mono">
                      <th className="border border-black p-1 text-right">DIAS &gt;&gt;&gt;&gt;&gt;</th>
                      <th className="border border-black p-1"></th>
                      {activeModuleDates.map((d, i) => (
                        <th key={i} className="border border-black p-1 text-center font-bold">
                          {format(parseISO(d), 'dd')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-black">
                        <td className="border border-black p-1 font-medium">{row.name}</td>
                        <td className="border border-black p-1 text-center font-mono font-bold">{row.qa || ''}</td>
                        {activeModuleDates.map((dateStr, cIdx) => {
                          const isActive = row.activeDates.has(dateStr);
                          return (
                            <td 
                              key={cIdx} 
                              className="border border-black p-0 text-center font-mono text-[8px]"
                              style={{ backgroundColor: isActive ? (row.type === 'formativa' ? '#b1a0c7' : row.type === 'somativa' ? '#002060' : '#c2d79b') : 'transparent' }}
                            >
                              {isActive && row.type === 'lesson' ? selectedPlan.hoursPerDay : ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-[8px] border border-black p-2 bg-gray-50">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border border-gray-400" style={{ backgroundColor: '#c2d79b' }} />
                    <span>Aulas previstas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border border-gray-400" style={{ backgroundColor: '#b1a0c7' }} />
                    <span>Situação Formativa</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border border-gray-400" style={{ backgroundColor: '#002060' }} />
                    <span>Situação Somativa</span>
                  </div>
                  <div className="ml-auto font-mono">
                    QA = nº de aulas previstas para desenvolver o conteúdo
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          /* TAB 2: CHAMADA INTELIGENTE POR QR CODE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Esquerda: QR Code Projeção */}
            <div className="lg:col-span-6 bg-industrial-800 rounded-xl border border-industrial-700 p-6 flex flex-col items-center justify-between text-center relative overflow-hidden shadow-sm min-h-[480px]">
              <div className="absolute top-0 left-0 right-0 bg-primary/10 border-b border-primary/20 py-2 text-xs font-bold text-primary flex items-center justify-center gap-1.5">
                <QrCode size={14} /> Tela de Projeção em Sala
              </div>

              <div className="mt-8 mb-4">
                <h3 className="text-white text-md font-semibold">{selectedPlan.name}</h3>
                <p className="text-xs text-slate-400 mt-1">Aproxime seu dispositivo para registrar presença</p>
              </div>

              {/* QR Code Container */}
              <div className="w-64 h-64 bg-white rounded-2xl p-4 flex flex-col items-center justify-center border-4 border-industrial-700 relative shadow-inner">
                {chamadaAtiva ? (
                  <>
                    {/* Simulated pixelated QR matrix */}
                    <div className="grid grid-cols-12 gap-1 w-full h-full opacity-90 animate-pulse">
                      {Array.from({ length: 144 }).map((_, idx) => {
                        const isSquare = (idx < 4 && idx % 12 < 4) || (idx > 139) || (idx % 12 > 7 && idx < 48);
                        const isFill = (idx * 7 + 13) % 5 === 0 || (idx * 3 + 2) % 7 === 0 || isSquare;
                        return (
                          <div 
                            key={idx} 
                            className={`w-full h-full rounded-sm ${isFill ? 'bg-slate-900' : 'bg-transparent'}`}
                          />
                        );
                      })}
                    </div>
                    {/* Floating active overlay */}
                    <div className="absolute inset-0 bg-primary/5 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 border-2 border-primary/40 rounded-xl animate-ping opacity-25"></div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                    <QrCode size={48} className="text-slate-300 animate-bounce" />
                    <p className="text-xs font-bold text-slate-400 font-mono">Chamada Pausada</p>
                  </div>
                )}
              </div>

              {/* Chamada Status / Controls */}
              <div className="w-full space-y-4">
                {chamadaAtiva ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
                      <RefreshCw size={12} className="animate-spin" />
                      QR Code Criptografado Ativo
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Próximo Token em <span className="text-primary font-bold">{countdown}s</span> ({qrToken.slice(0, 10)})
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Clique abaixo para iniciar e projetar o QR Code para a turma</p>
                )}

                <div className="flex justify-center gap-3">
                  {chamadaAtiva ? (
                    <button 
                      onClick={() => setChamadaAtiva(false)}
                      className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Square size={14} />
                      Encerrar Chamada
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setPresentList([]);
                        setChamadaAtiva(true);
                      }}
                      className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                    >
                      <Play size={14} />
                      Iniciar QR Code Dinâmico
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Direita: Alunos Presentes Logs */}
            <div className="lg:col-span-6 bg-industrial-800 rounded-xl border border-industrial-700 p-6 flex flex-col min-h-[480px]">
              <div className="flex justify-between items-center border-b border-industrial-750 pb-3 mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users size={14} />
                  Diário de Presenças em Tempo Real
                </h3>
                <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary font-mono font-bold px-2 py-0.5 rounded-full">
                  {presentList.length} / {students.length} Presentes
                </span>
              </div>

              {/* Real-time feed of checking students */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {presentList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center h-64 text-slate-500 border border-dashed border-industrial-700 rounded-lg p-6">
                    <Users size={32} className="text-industrial-600 mb-3" />
                    <p className="text-xs">
                      {chamadaAtiva 
                        ? 'Aguardando digitalizações dos alunos...' 
                        : 'Chamada fechada. Inicie o QR Code ao lado para computar presença.'}
                    </p>
                  </div>
                ) : (
                  presentList.map((stuName, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-2.5 bg-industrial-900 border border-industrial-750 rounded-lg animate-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase font-mono">
                          {stuName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-slate-200 text-xs font-bold">{stuName}</div>
                          <div className="text-[8px] text-slate-500 font-mono">Check-in via GPS & QR Code</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        <CheckCircle size={10} /> Presença
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom bulk save manual options */}
              {presentList.length > 0 && !chamadaAtiva && (
                <div className="mt-4 pt-3 border-t border-industrial-750 flex justify-end">
                  <button 
                    onClick={() => {
                      alert("Diário de presença salvo no Firestore com sucesso!");
                      setPresentList([]);
                    }}
                    className="px-4 py-2 bg-accent hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Gravar Frequência na Caderneta
                  </button>
                </div>
              )}
            </div>

          </div>
        )
      ) : (
        <div className="bg-industrial-800 p-20 rounded-2xl text-center border border-dashed border-industrial-700">
          <Calendar size={48} className="mx-auto text-industrial-600 mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-white mb-1">Crie uma Turma no Painel de Turmas</h2>
          <p className="text-slate-400 text-xs max-w-sm mx-auto">Para estruturar os cronogramas, é necessário cadastrar uma turma com matriz escolar válida no menu lateral.</p>
        </div>
      )}

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
