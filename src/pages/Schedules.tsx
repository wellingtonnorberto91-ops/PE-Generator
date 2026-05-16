import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { calculateDetailedSchedule, DetailedScheduleResult } from '../features/calendar/engine';
import { Calendar, Clock, ChevronRight, FileDown, Layers, MapPin, Sparkles } from 'lucide-react';
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
}

interface Holiday {
  date: string;
  description: string;
}

export function Schedules() {
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [schedule, setSchedule] = useState<DetailedScheduleResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Plans
        const plansQuery = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const plansSnapshot = await getDocs(plansQuery);
        const plansData: TeachingPlan[] = [];
        plansSnapshot.forEach((doc) => {
          plansData.push({ id: doc.id, ...doc.data() } as TeachingPlan);
        });
        setPlans(plansData);
        if (plansData.length > 0) setSelectedPlanId(plansData[0].id);

        // Fetch Holidays
        const holidaysSnapshot = await getDocs(collection(db, 'calendars'));
        const holidaysData: Holiday[] = [];
        holidaysSnapshot.forEach((doc) => {
          holidaysData.push(doc.data() as Holiday);
        });
        setHolidays(holidaysData);
      } catch (error) {
        console.error("Erro ao carregar dados", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (plan) {
        const result = calculateDetailedSchedule(
          {
            startDate: plan.startDate,
            hoursPerDay: plan.hoursPerDay,
            classDays: plan.classDays,
            holidays: holidays.map(h => h.date)
          },
          plan.modules
        );
        setSchedule(result);
      }
    }
  }, [selectedPlanId, plans, holidays]);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // Grouping logic for semesters
  const groupDatesBySemester = () => {
    if (!schedule) return {};
    
    const groups: Record<string, Record<string, string[]>> = {};

    schedule.modules.forEach(module => {
      module.classDates.forEach(dateStr => {
        const date = parseISO(dateStr);
        const month = getMonth(date);
        const year = getYear(date);
        const semester = month < 6 ? `1º Semestre - ${year}` : `2º Semestre - ${year}`;
        const monthName = format(date, 'MMMM', { locale: ptBR });

        if (!groups[semester]) groups[semester] = {};
        if (!groups[semester][monthName]) groups[semester][monthName] = [];
        
        // Store as "Date|ModuleName"
        groups[semester][monthName].push(`${dateStr}|${module.moduleName}`);
      });
    });

    return groups;
  };

  const semesters = groupDatesBySemester();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-industrial-800 p-8 rounded-3xl border border-industrial-700 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Calendar size={120} />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Clock className="text-primary" size={28} />
            </div>
            Cronogramas
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Distribuição temporal das unidades curriculares</p>
        </div>

        <div className="relative z-10 flex flex-col gap-2 min-w-[300px]">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Turma / Plano de Ensino</label>
          <select 
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="bg-industrial-900 border-2 border-industrial-700 text-white text-md rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary block w-full p-4 outline-none transition-all cursor-pointer hover:border-industrial-600 appearance-none shadow-inner"
          >
            {plans.map(plan => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/50 animate-pulse" size={20} />
          </div>
          <p className="text-slate-400 font-medium tracking-wide">Orquestrando datas e feriados...</p>
        </div>
      ) : schedule && selectedPlan ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Summary and Modules List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-industrial-800 rounded-3xl border border-industrial-700 p-6 shadow-xl">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Layers size={16} /> Resumo dos Módulos
                </h2>
                <div className="space-y-4">
                    {schedule.modules.map((m, i) => (
                        <div key={i} className="bg-industrial-900/50 border border-industrial-700/50 p-4 rounded-2xl relative group hover:border-primary/30 transition-all">
                             <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-tighter">Módulo {i + 1}</span>
                                <span className="text-xs font-mono text-slate-500">{m.classDates.length * selectedPlan.hoursPerDay}h</span>
                             </div>
                             <h3 className="text-sm font-semibold text-white mb-3">{m.moduleName}</h3>
                             <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                <div className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    <span>{m.startDate ? format(parseISO(m.startDate), 'dd/MM/yy') : '--/--/--'}</span>
                                </div>
                                <ChevronRight size={10} className="text-slate-700" />
                                <div className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    <span>{m.endDate ? format(parseISO(m.endDate), 'dd/MM/yy') : '--/--/--'}</span>
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            <button className="w-full bg-industrial-800 hover:bg-industrial-700 text-white font-bold py-4 rounded-2xl border border-industrial-700 flex items-center justify-center gap-3 transition-all shadow-lg group">
                <FileDown size={20} className="text-primary group-hover:bounce" />
                Exportar para PDF / Excel
            </button>
          </div>

          {/* Right: Detailed Day-by-Day Timeline */}
          <div className="lg:col-span-8 space-y-12">
            {Object.keys(semesters).map(semesterName => (
                <div key={semesterName} className="space-y-8">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white whitespace-nowrap">{semesterName}</h2>
                        <div className="h-px bg-industrial-700 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.keys(semesters[semesterName]).map(monthName => (
                            <div key={monthName} className="bg-industrial-800 rounded-3xl border border-industrial-700 overflow-hidden shadow-xl">
                                <div className="bg-industrial-700/30 px-6 py-4 border-b border-industrial-700 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white capitalize">{monthName}</h3>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{semesters[semesterName][monthName].length} aulas</span>
                                </div>
                                <div className="p-4 max-h-[300px] overflow-auto custom-scrollbar">
                                    <div className="space-y-2">
                                        {semesters[semesterName][monthName].map((item, i) => {
                                            const [dateStr, moduleName] = item.split('|');
                                            const date = parseISO(dateStr);
                                            return (
                                                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-industrial-700/20 transition-colors border border-transparent hover:border-industrial-700/50">
                                                    <div className="flex flex-col items-center justify-center min-w-[40px] h-12 rounded-xl bg-industrial-900 border border-industrial-700">
                                                        <span className="text-xs font-bold text-primary">{format(date, 'dd')}</span>
                                                        <span className="text-[8px] uppercase text-slate-500">{format(date, 'EEE', { locale: ptBR })}</span>
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter truncate">{moduleName}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <MapPin size={8} className="text-slate-600" />
                                                            <span className="text-[9px] text-slate-400">Presencial - {selectedPlan.hoursPerDay}h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-industrial-800 p-24 rounded-3xl text-center border-2 border-dashed border-industrial-700">
          <Calendar size={64} className="mx-auto text-industrial-600 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Configure um Plano de Ensino</h2>
          <p className="text-slate-400 max-w-md mx-auto">Para gerar o cronograma, você precisa ter uma turma cadastrada com data de início e carga horária definida.</p>
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
