import { useState, useEffect } from 'react';
import { Dropzone } from '../components/ui/Dropzone';
import { extractDataFromFile } from '../features/ai-core/gemini';
import { calculateEndDate } from '../features/calendar/engine';
import { BookOpen, Sparkles, Loader2, Play } from 'lucide-react';
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
  modules: { name: string; hours: number }[];
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
  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Form states
  const [tempPlanData, setTempPlanData] = useState<any>(null);
  const [className, setClassName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

  useEffect(() => {
    fetchPlans();
  }, []);

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
    } catch (error: any) {
      alert(error.message || "Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
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
      await fetchPlans();
    } catch (error: any) {
      alert("Erro ao calcular logística: " + error.message);
    }
  };

  const weekDays = [
    { id: 0, label: 'Dom' }, { id: 1, label: 'Seg' }, { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Turmas e Planos de Ensino</h1>
        <p className="text-slate-400 mt-1">Importe a matriz curricular. O Motor Logístico calculará o fim do curso baseado nos calendários salvos.</p>
      </div>

      {/* Sentry AI Zone */}
      {!tempPlanData ? (
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
          )}
        </div>
      ) : (
        /* Checkout Engine Panel */
        <div className="bg-industrial-800 border border-primary/30 rounded-xl p-6 relative shadow-[0_0_15px_rgba(59,130,246,0.1)]">
          <h2 className="text-xl font-medium text-white mb-4">Configuração Logística da Turma</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-industrial-900 p-4 rounded-lg border border-industrial-700">
                <p className="text-sm text-slate-400">Dados extraídos via IA:</p>
                <p className="text-2xl font-bold text-primary mt-1">{tempPlanData.totalHours} Horas Totais</p>
                <p className="text-sm text-slate-300">{tempPlanData.modules.length} Módulos Curriculares</p>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">Nome da Turma</label>
                <input type="text" value={className} onChange={e => setClassName(e.target.value)} className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white" />
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
            <div className="mt-8 pt-8 border-t border-industrial-700">
              
              <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                <BookOpen size={18} className="text-slate-400" />
                Dados Extraídos da Matriz
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Objetivo Geral</label>
                  <textarea 
                    value={tempPlanData.msep.objetivoGeral} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, objetivoGeral: e.target.value}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white h-16"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Capacidades Básicas</label>
                  <textarea 
                    value={tempPlanData.msep.capacidadesBasicas.join(', ')} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, capacidadesBasicas: e.target.value.split(',').map((s:string) => s.trim())}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Capacidades Técnicas</label>
                  <textarea 
                    value={tempPlanData.msep.capacidadesTecnicas.join(', ')} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, capacidadesTecnicas: e.target.value.split(',').map((s:string) => s.trim())}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Capacidades Socioemocionais</label>
                  <textarea 
                    value={tempPlanData.msep.capacidadesSocioemocionais.join(', ')} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, capacidadesSocioemocionais: e.target.value.split(',').map((s:string) => s.trim())}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-300 mb-1">Conhecimentos / Temas</label>
                  <textarea 
                    value={tempPlanData.msep.conhecimentos.join(', ')} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, conhecimentos: e.target.value.split(',').map((s:string) => s.trim())}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white h-20"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Infraestrutura Necessária</label>
                  <input 
                    type="text"
                    value={tempPlanData.msep.infraestrutura} 
                    onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, infraestrutura: e.target.value}})}
                    className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              {/* Seção Sugerida pela IA */}
              <div className="bg-industrial-900/50 border border-primary/20 rounded-xl p-6 relative">
                <div className="absolute top-0 right-0 bg-accent/10 text-accent text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-accent/20">
                  <Sparkles size={14} /> Sentry AI
                </div>
                
                <h3 className="text-lg font-medium text-primary mb-6 flex items-center gap-2">
                  Sugestões Pedagógicas
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Situações de Aprendizagem</label>
                    <textarea 
                      value={tempPlanData.msep.situacoesAprendizagem} 
                      onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, situacoesAprendizagem: e.target.value}})}
                      className="w-full bg-industrial-900 border border-primary/30 rounded p-2 text-white h-20 focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Atividades Práticas (Separadas por vírgula)</label>
                    <textarea 
                      value={tempPlanData.msep.atividadesPraticas.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, atividadesPraticas: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-primary/30 rounded p-2 text-white h-20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Estratégias de Ensino</label>
                    <textarea 
                      value={tempPlanData.msep.estrategiasEnsino} 
                      onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, estrategiasEnsino: e.target.value}})}
                      className="w-full bg-industrial-900 border border-primary/30 rounded p-2 text-white h-20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Critérios de Avaliação</label>
                    <textarea 
                      value={tempPlanData.msep.criteriosAvaliacao} 
                      onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, criteriosAvaliacao: e.target.value}})}
                      className="w-full bg-industrial-900 border border-primary/30 rounded p-2 text-white h-20"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Instrumentos de Avaliação</label>
                    <input 
                      type="text"
                      value={tempPlanData.msep.instrumentosAvaliacao.join(', ')} 
                      onChange={e => setTempPlanData({...tempPlanData, msep: {...tempPlanData.msep, instrumentosAvaliacao: e.target.value.split(',').map((s:string) => s.trim())}})}
                      className="w-full bg-industrial-900 border border-primary/30 rounded p-2 text-white"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          <div className="mt-8 flex justify-end gap-4">
            <button onClick={() => setTempPlanData(null)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancelar</button>
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
              <div key={p.id || i} className="bg-industrial-900 border border-industrial-700 p-5 rounded-lg border-l-4 border-l-primary">
                <h3 className="text-white font-medium text-lg mb-2">{p.name}</h3>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
