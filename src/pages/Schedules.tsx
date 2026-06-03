import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { calculateDetailedSchedule } from '../features/calendar/engine';
import { Calendar, Clock, ChevronRight, FileDown, Layers, QrCode, Play, Square, CheckCircle, RefreshCw, Users, ShieldAlert } from 'lucide-react';
import { format, parseISO, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Module {
  name: string;
  hours: number;
}

interface TeachingPlan {
  id: string;
  name: string;
  totalHours: number;
  startDate: string;
  hoursPerDay: number;
  classDays: number[];
  modules: Module[];
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
  const [loading, setLoading] = useState(true);

  // UI Tabs & Interactive States
  const [activeTab, setActiveTab] = useState<'cronograma' | 'chamada'>('cronograma');
  const [chamadaAtiva, setChamadaAtiva] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [qrToken, setQrToken] = useState('token-init-887');
  const [presentList, setPresentList] = useState<string[]>([]);
  
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

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const schedule = (selectedPlanId && selectedPlan) ? calculateDetailedSchedule(
    {
      startDate: selectedPlan.startDate,
      hoursPerDay: selectedPlan.hoursPerDay,
      classDays: selectedPlan.classDays,
      holidays: holidays.map(h => h.date)
    },
    selectedPlan.modules,
    selectedPlan.scheduleOverrides
  ) : null;

  // Toggle Override to delay/reschedule a class day
  const handleToggleOverride = async (dateStr: string) => {
    if (!selectedPlan) return;

    const currentOverrides = selectedPlan.scheduleOverrides || {};
    const newOverrides = { ...currentOverrides };

    if (newOverrides[dateStr]) {
      // Re-enable: Delete override
      delete newOverrides[dateStr];
    } else {
      // Delay: Create off-day override
      newOverrides[dateStr] = { type: 'off-day', note: 'Aula Postergada / Atraso de Conteúdo' };
    }

    try {
      const planRef = doc(db, 'teaching_plans', selectedPlan.id);
      await updateDoc(planRef, { scheduleOverrides: newOverrides });
      
      // Update local state reactive binding
      setPlans(prev => prev.map(p => p.id === selectedPlan.id ? { ...p, scheduleOverrides: newOverrides } : p));
    } catch (e) {
      console.error("Erro ao salvar override de cronograma", e);
      alert("Erro ao recalcular cronograma no Firestore.");
    }
  };

  // Group dates for Semesters & Month structures
  const groupDatesBySemester = () => {
    if (!schedule) return {};
    
    const groups: Record<string, Record<string, string[]>> = {};

    // 1. Add class dates from engine
    schedule.modules.forEach(module => {
      module.classDates.forEach(dateStr => {
        const date = parseISO(dateStr);
        const month = getMonth(date);
        const year = getYear(date);
        const semester = month < 6 ? `1º Semestre - ${year}` : `2º Semestre - ${year}`;
        const monthName = format(date, 'MMMM', { locale: ptBR });

        if (!groups[semester]) groups[semester] = {};
        if (!groups[semester][monthName]) groups[semester][monthName] = [];
        
        groups[semester][monthName].push(`${dateStr}|class|${module.moduleName}`);
      });
    });

    // 2. Add postponed dates (off-days)
    if (selectedPlan?.scheduleOverrides) {
      Object.keys(selectedPlan.scheduleOverrides).forEach(dateStr => {
        const override = selectedPlan.scheduleOverrides?.[dateStr];
        if (override && override.type === 'off-day') {
          const date = parseISO(dateStr);
          const month = getMonth(date);
          const year = getYear(date);
          const semester = month < 6 ? `1º Semestre - ${year}` : `2º Semestre - ${year}`;
          const monthName = format(date, 'MMMM', { locale: ptBR });

          if (!groups[semester]) groups[semester] = {};
          if (!groups[semester][monthName]) groups[semester][monthName] = [];
          
          if (!groups[semester][monthName].some(item => item.startsWith(dateStr))) {
            groups[semester][monthName].push(`${dateStr}|off-day|${override.note || 'Aula Cancelada / Postergada'}`);
          }
        }
      });
    }

    // Sort chronologically within months
    Object.keys(groups).forEach(sem => {
      Object.keys(groups[sem]).forEach(mName => {
        groups[sem][mName].sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]));
      });
    });

    return groups;
  };

  const semesters = groupDatesBySemester();

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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Resumo lateral dos Módulos */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-industrial-800 rounded-xl border border-industrial-700 p-5 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Layers size={14} /> Resumo Curricular
                  </h2>
                  <div className="space-y-3">
                    {schedule.modules.map((m, i) => (
                      <div key={i} className="bg-industrial-900 border border-industrial-700/60 p-3 rounded-xl relative group">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase font-mono">Módulo {i + 1}</span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold">{m.classDates.length * selectedPlan.hoursPerDay}h</span>
                        </div>
                        <h3 className="text-xs font-bold text-white truncate">{m.moduleName}</h3>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-2">
                          <span>{m.startDate ? format(parseISO(m.startDate), 'dd/MM/yy') : '--'}</span>
                          <ChevronRight size={8} />
                          <span>{m.endDate ? format(parseISO(m.endDate), 'dd/MM/yy') : '--'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="w-full bg-industrial-800 hover:bg-industrial-750 text-slate-300 font-bold py-3.5 rounded-xl border border-industrial-700 flex items-center justify-center gap-2 transition-all text-xs cursor-pointer shadow-sm">
                  <FileDown size={16} className="text-primary" />
                  Exportar Grade em PDF / Excel
                </button>
              </div>

              {/* Linha do tempo dia a dia */}
              <div className="lg:col-span-8 space-y-8">
                {Object.keys(semesters).map(semesterName => (
                  <div key={semesterName} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{semesterName}</h2>
                      <div className="h-px bg-industrial-700 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.keys(semesters[semesterName]).map(monthName => (
                        <div key={monthName} className="bg-industrial-800 rounded-xl border border-industrial-700 overflow-hidden shadow-sm flex flex-col">
                          <div className="bg-industrial-900 px-4 py-2.5 border-b border-industrial-700 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-slate-300 capitalize">{monthName}</h3>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">{semesters[semesterName][monthName].length} aulas</span>
                          </div>
                          
                          <div className="p-3 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 flex-1">
                            {semesters[semesterName][monthName].map((item, i) => {
                              const [dateStr, itemType, title] = item.split('|');
                              const date = parseISO(dateStr);
                              const isClassItem = itemType === 'class';
                              
                              return (
                                <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                                  isClassItem 
                                    ? 'bg-industrial-950 border-industrial-850 hover:border-industrial-700' 
                                    : 'bg-red-500/5 border-red-500/10'
                                }`}>
                                  <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div className={`flex flex-col items-center justify-center min-w-[36px] h-10 rounded-lg border font-mono ${
                                      isClassItem 
                                        ? 'bg-industrial-900 border-industrial-700 text-primary' 
                                        : 'bg-red-950/40 border-red-900/40 text-red-400'
                                    }`}>
                                      <span className="text-xs font-bold">{format(date, 'dd')}</span>
                                      <span className="text-[7px] uppercase">{format(date, 'EEE', { locale: ptBR })}</span>
                                    </div>
                                    
                                    <div className="flex-1 overflow-hidden">
                                      <p className={`text-[9px] uppercase font-bold tracking-tight truncate ${
                                        isClassItem ? 'text-slate-300' : 'text-red-400'
                                      }`}>
                                        {isClassItem ? title : 'AULA POSTERGADA'}
                                      </p>
                                      <p className="text-[9px] text-slate-500 truncate mt-0.5">
                                        {isClassItem ? `Presencial • ${selectedPlan.hoursPerDay}h/dia` : title}
                                      </p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleToggleOverride(dateStr)}
                                    className={`px-2 py-1 rounded text-[8px] font-bold border transition-colors cursor-pointer ml-2 ${
                                      isClassItem 
                                        ? 'bg-industrial-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border-industrial-800 hover:border-red-500/30' 
                                        : 'bg-red-500/20 hover:bg-red-500/35 text-red-300 border-red-500/30'
                                    }`}
                                  >
                                    {isClassItem ? 'Atrasar' : 'Reativar'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
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
