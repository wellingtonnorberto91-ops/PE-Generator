import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { BookOpen, ChevronRight, ChevronDown, Target, Brain, Lightbulb, Info, ShieldCheck } from 'lucide-react';

interface Module {
  name: string;
  hours: number;
  objective?: string;
  technicalCapabilities?: string[];
  socioemotionalCapabilities?: string[];
  knowledge?: string[];
  recommendations?: string;
  aiSuggestions?: string;
}

interface TeachingPlan {
  id: string;
  name: string;
  totalHours: number;
  modules: Module[];
}

export function CurricularUnits() {
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: TeachingPlan[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as TeachingPlan);
        });
        setPlans(data);
        if (data.length > 0) {
          setSelectedPlanId(data[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar planos", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  const toggleModule = (moduleName: string) => {
    setExpandedModule(expandedModule === moduleName ? null : moduleName);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-industrial-800 p-6 rounded-2xl border border-industrial-700 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="text-primary" />
            Unidades Curriculares
          </h1>
          <p className="text-slate-400 mt-1">Detalhamento pedagógico e competências por módulo</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-400">Selecionar Plano:</label>
          <select 
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="bg-industrial-900 border border-industrial-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 outline-none transition-all"
          >
            {plans.map(plan => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-slate-400 animate-pulse">Carregando unidades...</p>
        </div>
      ) : selectedPlan ? (
        <div className="space-y-4">
          {selectedPlan.modules && selectedPlan.modules.length > 0 ? (
            selectedPlan.modules.map((module, index) => (
              <div 
                key={`${module.name}-${index}`}
                className="bg-industrial-800 border border-industrial-700 rounded-xl overflow-hidden transition-all duration-300 hover:border-industrial-600 shadow-lg"
              >
                <button 
                  onClick={() => toggleModule(module.name)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-industrial-700/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-industrial-900 border border-industrial-700 flex items-center justify-center text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{module.name}</h3>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">{module.hours} Horas</span>
                    </div>
                  </div>
                  {expandedModule === module.name ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {expandedModule === module.name && (
                  <div className="p-6 border-t border-industrial-700 bg-industrial-900/50 space-y-8 animate-in slide-in-from-top-2 duration-300">
                    
                    {/* Objetivos Section */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                        <Target size={16} />
                        Objetivos da Unidade
                      </h4>
                      <p className="text-slate-300 leading-relaxed bg-industrial-800/50 p-4 rounded-lg border border-industrial-700/50">
                        {module.objective || "Não extraído do plano de curso."}
                      </p>
                    </div>

                    {/* Capacidades & Conhecimentos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 uppercase tracking-widest">
                          <Brain size={16} />
                          Capacidades Técnicas
                        </h4>
                        <ul className="space-y-2">
                          {module.technicalCapabilities?.map((cap, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-300 bg-industrial-800 p-3 rounded-lg border border-industrial-700/30">
                              <ShieldCheck size={14} className="text-amber-500 shrink-0 mt-0.5" />
                              {cap}
                            </li>
                          )) || <li className="text-slate-500 italic text-sm">Não listadas.</li>}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
                          <Users size={16} />
                          Capacidades Socioemocionais
                        </h4>
                        <ul className="space-y-2">
                          {module.socioemotionalCapabilities?.map((cap, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-300 bg-industrial-800 p-3 rounded-lg border border-industrial-700/30">
                              <ShieldCheck size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                              {cap}
                            </li>
                          )) || <li className="text-slate-500 italic text-sm">Não listadas.</li>}
                        </ul>
                      </div>
                    </div>

                    {/* Conhecimentos Necessários */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                        <BookOpen size={16} />
                        Conhecimentos Necessários
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {module.knowledge?.map((k, i) => (
                          <span key={i} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-medium">
                            {k}
                          </span>
                        )) || <span className="text-slate-500 italic text-sm">Não listados.</span>}
                      </div>
                    </div>

                    {/* Recomendações e Sugestões IA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-industrial-700">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                          <Info size={14} />
                          Recomendações do Plano
                        </h4>
                        <p className="text-sm text-slate-400 bg-industrial-800/30 p-4 rounded-xl italic">
                          "{module.recommendations || "Nenhuma recomendação específica encontrada."}"
                        </p>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                          <Lightbulb size={14} />
                          Sugestões do Sentry AI
                        </h4>
                        <div className="text-sm text-slate-300 bg-primary/5 p-4 rounded-xl border border-primary/10 relative group">
                          <Sparkles className="absolute -top-2 -right-2 text-primary/40 group-hover:scale-125 transition-transform" size={24} />
                          {module.aiSuggestions || "Aguardando nova extração para gerar sugestões."}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-industrial-800 p-12 rounded-2xl text-center border border-dashed border-industrial-700">
              <p className="text-slate-400">Este plano não possui módulos cadastrados.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-industrial-800 p-20 rounded-2xl text-center border border-industrial-700">
          <BookOpen size={48} className="mx-auto text-industrial-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Nenhum Plano Encontrado</h2>
          <p className="text-slate-400">Importe um Plano de Ensino primeiro para ver suas unidades curriculares.</p>
        </div>
      )}
    </div>
  );
}

function Sparkles({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
