import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/ui/Dropzone';
import { extractDataFromFile, type ExtractedTeachingPlan } from '../features/ai-core/gemini';
import { calculateEndDate } from '../features/calendar/engine';
import { BookOpen, Sparkles, Loader2, Play, Edit3, Plus } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

interface TeachingPlan {
  id?: string;
  name: string;
  totalHours: number;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  classDays: number[];
  modules: { 
    name: string; 
    hours: number;
    objective?: string;
    technicalCapabilities?: string[];
    socioemotionalCapabilities?: string[];
    knowledge?: string[];
    recommendations?: string;
    aiSuggestions?: string;
  }[];
  msep?: {
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
  };
}

export function Classes() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Form states
  const [tempPlanData, setTempPlanData] = useState<ExtractedTeachingPlan | null>(null);
  const [className, setClassName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [showCreateArea, setShowCreateArea] = useState(false);

  const fetchPlans = async () => {
    try {
      const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const data: TeachingPlan[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as TeachingPlan);
      });
      setPlans(data);
    } catch (error) {
      console.error("Erro ao buscar planos", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: TeachingPlan[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as TeachingPlan);
        });
        if (active) {
          setPlans(data);
          setFetching(false);
        }
      } catch (error) {
        console.error("Erro ao buscar planos", error);
        if (active) {
          setFetching(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setLoading(true);
    setTempPlanData(null);
    try {
      const data = await extractDataFromFile(file, 'TEACHING_PLAN');
      if (data && data.totalHours && data.modules) {
        // Sanitizar dados do MSEP para evitar crash de arrays undefined
        if (data.msep) {
          data.msep.objetivoGeral = data.msep.objetivoGeral || '';
          data.msep.capacidadesBasicas = Array.isArray(data.msep.capacidadesBasicas) ? data.msep.capacidadesBasicas : [];
          data.msep.capacidadesTecnicas = Array.isArray(data.msep.capacidadesTecnicas) ? data.msep.capacidadesTecnicas : [];
          data.msep.capacidadesSocioemocionais = Array.isArray(data.msep.capacidadesSocioemocionais) ? data.msep.capacidadesSocioemocionais : [];
          data.msep.conhecimentos = Array.isArray(data.msep.conhecimentos) ? data.msep.conhecimentos : [];
          data.msep.infraestrutura = data.msep.infraestrutura || '';
          data.msep.situacoesAprendizagem = data.msep.situacoesAprendizagem || '';
          data.msep.criteriosAvaliacao = data.msep.criteriosAvaliacao || '';
          data.msep.estrategiasEnsino = data.msep.estrategiasEnsino || '';
          data.msep.atividadesPraticas = Array.isArray(data.msep.atividadesPraticas) ? data.msep.atividadesPraticas : [];
          data.msep.instrumentosAvaliacao = Array.isArray(data.msep.instrumentosAvaliacao) ? data.msep.instrumentosAvaliacao : [];
        }
        setTempPlanData(data);
        setClassName(file.name.split('.')[0]); // Default name
      } else {
        alert("A IA não conseguiu extrair a Carga Horária e Módulos do documento.");
      }
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message || "Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualPlan = () => {
    setTempPlanData({
      totalHours: 120,
      modules: [
        { name: 'Módulo Técnico I', hours: 60, objective: '', technicalCapabilities: [], socioemotionalCapabilities: [], knowledge: [] }
      ],
      msep: {
        objetivoGeral: 'Capacitar os alunos nos fundamentos operacionais e teóricos aplicados no setor produtivo.',
        capacidadesBasicas: ['Comunicação ativa', 'Trabalho em equipe'],
        capacidadesTecnicas: ['Ler desenhos mecânicos', 'Operar instrumentos de metrologia'],
        capacidadesSocioemocionais: ['Resiliência', 'Ética profissional'],
        conhecimentos: ['Leitura e interpretação de desenhos', 'Conceitos de física básica'],
        infraestrutura: 'Laboratório de Metrologia e Ajustagem Mecânica',
        situacoesAprendizagem: 'Contexto: Uma empresa local precisa calibrar lote de eixos com precisão de micrômetro.\nDesafio: Realizar o ensaio, laudar o desvio e certificar o lote.',
        criteriosAvaliacao: 'Mapeia os desvios de precisão nos eixos e gera laudo técnico em conformidade com as tolerâncias operacionais.',
        estrategiasEnsino: 'Aulas teóricas expositivas com demonstração prática em bancada e exercícios de simulação.',
        atividadesPraticas: ['Prática 1: Ensaios dimensionais de eixos', 'Prática 2: Emissão de relatórios técnicos'],
        instrumentosAvaliacao: ['Rubricas de avaliação prática', 'Laudo técnico da entrega']
      }
    });
    setClassName('Nova Turma Manual');
    setStartDate('');
    setHoursPerDay(4);
    setSelectedDays([1, 2, 3, 4, 5]);
    setShowCreateArea(false);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleCalculateAndSave = async () => {
    if (!startDate) {
      alert("Selecione a data de início.");
      return;
    }
    if (selectedDays.length === 0) {
      alert("Selecione ao menos um dia da semana.");
      return;
    }
    if (!tempPlanData) {
      alert("Nenhum plano de curso carregado.");
      return;
    }

    try {
      // 1. Fetch holidays from database
      const hSnap = await getDocs(collection(db, 'calendars'));
      const holidaysList: string[] = [];
      hSnap.forEach(d => holidaysList.push(d.data().date));

      // 2. Call Logistics Engine
      const result = calculateEndDate({
        startDate,
        totalHours: tempPlanData.totalHours,
        hoursPerDay,
        classDays: selectedDays,
        holidays: holidaysList
      });

      // 3. Save to Firestore
      const newPlan = {
        name: className,
        totalHours: tempPlanData.totalHours,
        startDate,
        endDate: result.endDate,
        hoursPerDay,
        classDays: selectedDays,
        modules: tempPlanData.modules,
        msep: tempPlanData.msep || null
      };

      await addDoc(collection(db, 'teaching_plans'), newPlan);
      alert(`Turma planejada com sucesso! Fim do curso calculado para: ${result.endDate}`);
      
      // 4. Reset states
      setTempPlanData(null);
      setClassName('');
      setStartDate('');
      setShowCreateArea(false);
      await fetchPlans();
    } catch (error: unknown) {
      const err = error as Error;
      alert("Erro ao calcular logística: " + err.message);
    }
  };

  const weekDays = [
    { id: 0, label: 'Dom' }, { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-industrial-900/40 p-4 border border-industrial-800 rounded-xl">
        <div>
          <h1 className="text-2xl font-semibold text-white">Turmas</h1>
          <p className="text-slate-400 mt-1 text-xs">Importe a matriz ou gerencie as turmas ativas e o planejamento de datas.</p>
        </div>
        {!tempPlanData && (
          <button
            onClick={() => setShowCreateArea(!showCreateArea)}
            className="px-4 py-2 bg-primary hover:bg-primary/95 text-white border border-primary/20 hover:border-primary/45 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            {showCreateArea ? (
              <>Recolher Importação</>
            ) : (
              <>
                <Plus size={14} className="text-white" />
                Nova Turma
              </>
            )}
          </button>
        )}
      </div>

      {/* Sentry AI Zone */}
      {!tempPlanData && showCreateArea && (
        <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-accent/10 text-accent text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-accent/20">
            <Sparkles size={14} /> Sentry AI
          </div>
          
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            Importação de Grade / Matriz
          </h2>
          
          {loading ? (
            <div className="h-64 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-slate-300 font-medium">Sentry AI lendo a Matriz Curricular...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Dropzone 
                onDrop={handleFileUpload} 
                accept={{
                  'application/pdf': ['.pdf'],
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                  'text/plain': ['.txt']
                }} 
                label="Arraste o PDF, Excel, Word ou TXT da Matriz do Curso"
              />
              <div className="flex items-center justify-center gap-4 py-2">
                <span className="h-[1px] bg-industrial-700 flex-1"></span>
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">OU</span>
                <span className="h-[1px] bg-industrial-700 flex-1"></span>
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCreateManualPlan}
                  className="px-5 py-2.5 bg-industrial-900 hover:bg-industrial-750 text-slate-300 hover:text-white border border-industrial-700 hover:border-industrial-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} className="text-primary" />
                  Criar Turma Manualmente (Sem Arquivo)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checkout Engine Panel */}
      {tempPlanData && (
        <div className="bg-industrial-800 border border-primary/30 rounded-xl p-6 relative shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          <h2 className="text-xl font-medium text-white mb-4">Configuração Logística da Turma</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Nome da Turma</label>
                <input 
                  type="text" 
                  value={className} 
                  onChange={e => setClassName(e.target.value)} 
                  className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white focus:border-primary outline-none text-sm" 
                />
              </div>

              <div className="bg-industrial-900 p-4 rounded-lg border border-industrial-700 space-y-4">
                <div className="flex justify-between items-center border-b border-industrial-750 pb-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Estrutura Curricular</h4>
                    <p className="text-[9px] text-slate-500 font-mono">Carga Horária Total: <span className="text-primary font-bold">{tempPlanData.totalHours}h</span></p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      const updatedModules = [...tempPlanData.modules, { name: `Módulo ${tempPlanData.modules.length + 1}`, hours: 40 }];
                      const newTotal = updatedModules.reduce((sum, m) => sum + m.hours, 0);
                      setTempPlanData({...tempPlanData, modules: updatedModules, totalHours: newTotal});
                    }}
                    className="text-[10px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-2 py-1 rounded font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={10} /> Adicionar Módulo
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {tempPlanData.modules.map((mod, mIdx) => (
                    <div key={mIdx} className="flex gap-2 items-center bg-industrial-950 p-2 border border-industrial-750">
                      <input 
                        type="text" 
                        value={mod.name} 
                        onChange={e => {
                          const updated = [...tempPlanData.modules];
                          updated[mIdx] = { ...updated[mIdx], name: e.target.value };
                          setTempPlanData({...tempPlanData, modules: updated});
                        }}
                        placeholder="Nome do Módulo"
                        className="flex-1 bg-industrial-900 border border-industrial-700 rounded p-1 text-[11px] text-white focus:border-primary outline-none"
                      />
                      <input 
                        type="number" 
                        value={mod.hours} 
                        onChange={e => {
                          const updated = [...tempPlanData.modules];
                          updated[mIdx] = { ...updated[mIdx], hours: Number(e.target.value) };
                          const newTotal = updated.reduce((sum, m) => sum + m.hours, 0);
                          setTempPlanData({...tempPlanData, modules: updated, totalHours: newTotal});
                        }}
                        placeholder="C.H."
                        className="w-16 bg-industrial-900 border border-industrial-700 rounded p-1 text-[11px] text-white text-center focus:border-primary outline-none font-bold"
                        min={1}
                      />
                      {tempPlanData.modules.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => {
                            const updated = tempPlanData.modules.filter((_, idx) => idx !== mIdx);
                            const newTotal = updated.reduce((sum, m) => sum + m.hours, 0);
                            setTempPlanData({...tempPlanData, modules: updated, totalHours: newTotal});
                          }}
                          className="text-red-500 hover:text-red-400 text-xs px-1 cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Data de Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white [color-scheme:dark]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Horas por Dia</label>
                  <input type="number" min={1} max={12} value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value))} className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">Dias com Aula</label>
                <div className="flex gap-2">
                  {weekDays.map(d => (
                    <button key={d.id} onClick={() => toggleDay(d.id)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedDays.includes(d.id) ? 'bg-primary text-white' : 'bg-industrial-900 text-slate-400 border border-industrial-700'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Painel MSEP Sentry AI */}
          {tempPlanData.msep && (
            <details className="group mt-8 pt-6 border-t border-industrial-700">
              <summary className="flex justify-between items-center cursor-pointer font-bold text-xs uppercase text-slate-400 hover:text-white select-none transition-colors mb-4">
                <span className="flex items-center gap-2">
                  <BookOpen size={16} className="text-primary group-open:animate-spin" />
                  Dados e Metodologia MSEP Extraídos (Opcional - Expandir para Editar)
                </span>
                <span className="text-[10px] text-primary group-open:hidden font-mono">Visualizar / Editar</span>
                <span className="text-[10px] text-slate-500 hidden group-open:inline font-mono">Recolher</span>
              </summary>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Objetivo Geral</label>
                    <textarea 
                      value={tempPlanData!.msep!.objetivoGeral} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, objetivoGeral: e.target.value}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white h-10 outline-none focus:border-primary text-[11px] resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Capacidades Básicas</label>
                    <textarea 
                      value={tempPlanData!.msep!.capacidadesBasicas.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, capacidadesBasicas: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white h-10 outline-none focus:border-primary text-[11px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Capacidades Técnicas</label>
                    <textarea 
                      value={tempPlanData!.msep!.capacidadesTecnicas.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, capacidadesTecnicas: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white h-10 outline-none focus:border-primary text-[11px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Capacidades Socioemocionais</label>
                    <textarea 
                      value={tempPlanData!.msep!.capacidadesSocioemocionais.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, capacidadesSocioemocionais: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white h-10 outline-none focus:border-primary text-[11px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Conhecimentos / Temas</label>
                    <textarea 
                      value={tempPlanData!.msep!.conhecimentos.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, conhecimentos: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white h-10 outline-none focus:border-primary text-[11px] resize-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Infraestrutura Necessária</label>
                    <input 
                      type="text"
                      value={tempPlanData!.msep!.infraestrutura} 
                      onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, infraestrutura: e.target.value}})}
                      className="w-full bg-industrial-900 border border-industrial-700 rounded p-1.5 text-white text-[11px] outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Seção Sugerida pela IA */}
                <div className="bg-industrial-900/50 border border-primary/20 rounded-xl p-4 relative">
                  <div className="absolute top-0 right-0 bg-accent/10 text-accent text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-accent/20">
                    <Sparkles size={14} /> Sentry AI
                  </div>
                  
                  <h3 className="text-sm font-medium text-primary mb-4 flex items-center gap-2">
                    Sugestões Pedagógicas
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Situações de Aprendizagem</label>
                      <textarea 
                        value={tempPlanData!.msep!.situacoesAprendizagem} 
                        onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, situacoesAprendizagem: e.target.value}})}
                        className="w-full bg-industrial-900 border border-primary/30 rounded p-1.5 text-white h-12 focus:border-primary focus:ring-1 focus:ring-primary text-[11px] resize-none"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Atividades Práticas (Separadas por vírgula)</label>
                      <textarea 
                        value={tempPlanData!.msep!.atividadesPraticas.join(', ')} 
                        onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, atividadesPraticas: e.target.value.split(',').map((s:string) => s.trim())}})}
                        className="w-full bg-industrial-900 border border-primary/30 rounded p-1.5 text-white h-10 text-[11px] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Estratégias de Ensino</label>
                      <textarea 
                        value={tempPlanData!.msep!.estrategiasEnsino} 
                        onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, estrategiasEnsino: e.target.value}})}
                        className="w-full bg-industrial-900 border border-primary/30 rounded p-1.5 text-white h-10 text-[11px] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Critérios de Avaliação</label>
                      <textarea 
                        value={tempPlanData!.msep!.criteriosAvaliacao} 
                        onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, criteriosAvaliacao: e.target.value}})}
                        className="w-full bg-industrial-900 border border-primary/30 rounded p-1.5 text-white h-10 text-[11px] resize-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Instrumentos de Avaliação</label>
                      <input 
                        type="text"
                        value={tempPlanData!.msep!.instrumentosAvaliacao.join(', ')} 
                        onChange={e => setTempPlanData({...tempPlanData!, msep: {...tempPlanData!.msep!, instrumentosAvaliacao: e.target.value.split(',').map((s:string) => s.trim())}})}
                        className="w-full bg-industrial-900 border border-primary/30 rounded p-1.5 text-white text-[11px] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </details>
          )}

          <div className="mt-8 flex justify-end gap-4">
            <button onClick={() => { setTempPlanData(null); setShowCreateArea(false); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleCalculateAndSave} className="bg-accent hover:bg-emerald-600 text-white px-6 py-2 rounded font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <Play size={18} />
              Rodar Motor Logístico e Salvar
            </button>
          </div>
        </div>
      )}

      {/* Lista de Turmas Salvas */}
      <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6">
        <h2 className="text-lg font-medium text-white mb-6">Turmas Planejadas</h2>
        
        {fetching ? (
          <div className="text-center py-8 text-slate-500">Carregando turmas...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border border-dashed border-industrial-700 rounded-lg">
            Nenhuma turma criada. Faça a importação acima.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((p, i) => (
              <div key={p.id || i} className="bg-industrial-900 border border-industrial-700 p-5 rounded-lg border-l-4 border-l-primary flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="text-white font-medium text-lg leading-snug">{p.name}</h3>
                    {p.id && (
                      <button 
                        onClick={() => navigate(`/classes/edit/${p.id}`)}
                        className="p-2 bg-industrial-800 hover:bg-industrial-700/80 text-slate-400 hover:text-white rounded-lg border border-industrial-700 hover:border-industrial-600 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm"
                        title="Editar Turma"
                      >
                        <Edit3 size={14} />
                        Editar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-slate-500">Início</p>
                      <p className="text-slate-200">{new Date(p.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Término Calculado</p>
                      <p className="text-accent font-medium">{new Date(p.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Carga Horária</p>
                      <p className="text-slate-200">{p.totalHours}h ({p.hoursPerDay}h/dia)</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Módulos</p>
                      <p className="text-slate-200">{p.modules?.length || 0} extraídos</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
