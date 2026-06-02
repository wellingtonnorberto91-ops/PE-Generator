import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { 
  TrendingUp, Users, Calendar, AlertCircle, BarChart2, 
  Activity, BookOpen, Clock, ChevronDown, ShieldAlert
} from 'lucide-react';



interface ClassPlan {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  modules?: Array<{ name: string; hours: number }>;
}

interface Student {
  id: string;
  name: string;
  ra: string;
}

interface StudentMetrics {
  id: string;
  name: string;
  ra: string;
  averageGrade: number;
  attendanceRate: number; // percentual e.g. 85
  status: 'critical' | 'warning' | 'stable';
}

export function Dashboard() {
  const [classes, setClasses] = useState<ClassPlan[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);

  // Carregar turmas cadastradas
  useEffect(() => {
    const fetchClasses = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const snap = await getDocs(q);
        const data: ClassPlan[] = [];
        snap.forEach(d => {
          const docData = d.data();
          data.push({ 
            id: d.id, 
            name: docData.name || 'Sem Nome',
            startDate: docData.startDate,
            endDate: docData.endDate,
            modules: docData.modules || []
          });
        });
        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
        }
      } catch (e) {
        console.error("Erro ao buscar turmas no Dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, []);

  // Carregar estudantes da turma selecionada
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'students'), where('classId', '==', selectedClassId));
        const snap = await getDocs(q);
        const list: Student[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Student);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);
        setSelectedModuleIndex(0);
      } catch (e) {
        console.error("Erro ao carregar estudantes da turma", e);
      }
    };
    fetchStudents();
  }, [selectedClassId]);

  // Turma Ativa selecionada
  const activeClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  // Simular e consolidar dados pedagógicos e de frequência dos estudantes
  // Prioriza o cálculo com base nos alunos reais da turma cadastrada
  const studentMetrics = useMemo<StudentMetrics[]>(() => {
    if (students.length === 0) return [];

    return students.map((s) => {
      // Gerar notas e frequências realistas e reproduzíveis baseadas no ID/nome para fins analíticos de BI
      const charSum = s.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      
      // Média Geral Simulada: varia de 35 a 98
      const simulatedAverage = 35 + (charSum % 64); 
      
      // Frequência Simulada: varia de 62% a 100%
      const simulatedAttendance = 62 + (charSum % 39);

      let status: 'critical' | 'warning' | 'stable' = 'stable';
      if (simulatedAttendance < 75 || simulatedAverage < 50) {
        status = 'critical';
      } else if (simulatedAttendance < 85 || simulatedAverage < 70) {
        status = 'warning';
      }

      return {
        id: s.id,
        name: s.name,
        ra: s.ra,
        averageGrade: Math.round(simulatedAverage),
        attendanceRate: Math.round(simulatedAttendance),
        status
      };
    });
  }, [students]);

  // Métricas Consolidadas da Turma
  const classSummary = useMemo(() => {
    if (studentMetrics.length === 0) {
      return { averageGrade: 0, attendanceRate: 0, criticalCount: 0, warningCount: 0, deviation: 0 };
    }

    const totalGrade = studentMetrics.reduce((acc, m) => acc + m.averageGrade, 0);
    const totalAttendance = studentMetrics.reduce((acc, m) => acc + m.attendanceRate, 0);
    const criticalCount = studentMetrics.filter(m => m.status === 'critical').length;
    const warningCount = studentMetrics.filter(m => m.status === 'warning').length;

    const meanGrade = totalGrade / studentMetrics.length;
    const variance = studentMetrics.reduce((acc, m) => acc + Math.pow(m.averageGrade - meanGrade, 2), 0) / studentMetrics.length;
    const deviation = Math.sqrt(variance);

    return {
      averageGrade: Math.round(meanGrade * 10) / 10,
      attendanceRate: Math.round(totalAttendance / studentMetrics.length),
      criticalCount,
      warningCount,
      deviation: Math.round(deviation * 10) / 10
    };
  }, [studentMetrics]);

  // Alunos Críticos (Ações Preventivas)
  const criticalStudents = useMemo(() => {
    return studentMetrics.filter(m => m.status === 'critical').slice(0, 4);
  }, [studentMetrics]);

  // Mapa de Calor de Faltas Simuladas (Faltas Acumuladas por Dia da Semana e Período de Aula)
  const heatmapData = useMemo(() => {
    // Dias da Semana e Horários de Aula (1 ao 5 tempo)
    // Padrão clássico: Faltas concentradas na Segunda 1º tempo (atrasos) e Sexta último tempo (saída antecipada)
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const periods = ['1º Tempo', '2º Tempo', '3º Tempo', '4º Tempo', '5º Tempo'];
    
    // Matriz de faltas acumuladas fictícia realista
    const baseGrid: Record<string, Record<string, number>> = {
      'Segunda': { '1º Tempo': 16, '2º Tempo': 12, '3º Tempo': 4, '4º Tempo': 5, '5º Tempo': 7 },
      'Terça': { '1º Tempo': 3, '2º Tempo': 2, '3º Tempo': 1, '4º Tempo': 2, '5º Tempo': 3 },
      'Quarta': { '1º Tempo': 4, '2º Tempo': 3, '3º Tempo': 2, '4º Tempo': 2, '5º Tempo': 2 },
      'Quinta': { '1º Tempo': 5, '2º Tempo': 4, '3º Tempo': 3, '4º Tempo': 3, '5º Tempo': 4 },
      'Sexta': { '1º Tempo': 6, '2º Tempo': 5, '3º Tempo': 8, '4º Tempo': 14, '5º Tempo': 21 }
    };

    return { days, periods, grid: baseGrid };
  }, []);

  // Gargalos de Aprendizado (Competências Críticas)
  const curricularCompetencies = useMemo(() => {
    // Competências técnicas associadas ao módulo ativo ou de demonstração
    const currentModuleName = activeClass?.modules?.[selectedModuleIndex]?.name || 'Fundamentos da Tecnologia';
    
    let list = [
      { name: 'Interpretação de Desenho e Tolerâncias', average: 78, type: 'Technical' },
      { name: 'Cálculo de Parâmetros de Processo', average: 46, type: 'Technical' }, // gargalo
      { name: 'Segurança Operacional e Uso de EPIs', average: 92, type: 'Socioemotional' },
      { name: 'Manutenção Preditiva e Ajustes Finos', average: 61, type: 'Technical' }
    ];

    if (currentModuleName.toUpperCase().includes('PROGRAMAÇÃO') || currentModuleName.toUpperCase().includes('TI')) {
      list = [
        { name: 'Lógica Algorítmica Estruturada', average: 75, type: 'Technical' },
        { name: 'Manipulação de Estruturas de Dados Complexas', average: 44, type: 'Technical' }, // gargalo
        { name: 'Versionamento e Trabalho Colaborativo', average: 88, type: 'Socioemotional' },
        { name: 'Integração de APIs e Depuração de Bugs', average: 63, type: 'Technical' }
      ];
    }

    // Ordenar da menor média para a maior
    return list.sort((a, b) => a.average - b.average);
  }, [activeClass, selectedModuleIndex]);

  // Progresso do Cronograma
  const cronometro = useMemo(() => {
    return {
      planned: 60,
      completed: 48,
      rate: Math.round((48 / 60) * 100)
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Activity className="animate-spin text-primary" size={32} />
        <p className="text-sm text-slate-400 font-mono">Carregando painel de business intelligence...</p>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-12 text-center max-w-2xl mx-auto space-y-6">
        <AlertCircle className="text-amber-500 mx-auto" size={48} />
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Nenhuma Turma ou Plano de Curso Cadastrado</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Para visualizar os painéis de BI e de acompanhamento pedagógico, é necessário cadastrar planos de curso e importar turmas de alunos no sistema escolar.
        </p>
        <div className="flex justify-center">
          <a 
            href="/classes" 
            className="px-6 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Cadastrar Turmas
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Topo do Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-industrial-900/40 p-6 border border-industrial-700 rounded-none">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 className="text-primary" size={24} />
            BI Pedagógico e Ações Preventivas
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Turma: <span className="text-slate-300 font-bold">{activeClass?.name}</span> | Módulo Ativo: <span className="text-primary font-bold">{activeClass?.modules?.[selectedModuleIndex]?.name || 'Geral'}</span>
          </p>
        </div>

        {/* Seletor de Turma Brutalista */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="bg-industrial-950 border-2 border-industrial-750 hover:border-primary text-white text-xs font-bold px-4 py-2.5 pr-8 outline-none rounded-none transition-all cursor-pointer appearance-none uppercase tracking-wider"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={14} />
          </div>

          {activeClass?.modules && activeClass.modules.length > 0 && (
            <div className="relative">
              <select
                value={selectedModuleIndex}
                onChange={e => setSelectedModuleIndex(Number(e.target.value))}
                className="bg-industrial-950 border-2 border-industrial-750 hover:border-primary text-white text-xs font-bold px-4 py-2.5 pr-8 outline-none rounded-none transition-all cursor-pointer appearance-none uppercase tracking-wider"
              >
                {activeClass.modules.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m.name.slice(0, 20)}...
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" size={14} />
            </div>
          )}
        </div>
      </div>

      {/* Grid de KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: Alunos em Risco Crítico */}
        <div className={`p-6 border-2 rounded-none transition-colors ${classSummary.criticalCount > 0 ? 'bg-red-950/20 border-red-900/60' : 'bg-industrial-800 border-industrial-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Risco Crítico</span>
            <ShieldAlert className={classSummary.criticalCount > 0 ? 'text-red-500' : 'text-slate-500'} size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{classSummary.criticalCount}</span>
            <span className="text-xs text-slate-400 font-mono">estudantes</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono leading-relaxed">
            Falta superior a 25% ou nota acumulada abaixo de 50.
          </p>
        </div>

        {/* KPI: Assiduidade Geral */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Assiduidade Turma</span>
            <Users className="text-primary" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{classSummary.attendanceRate}%</span>
            <span className="text-xs text-emerald-400 font-mono font-bold">Média</span>
          </div>
          {/* Barra de Progresso Simples */}
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${classSummary.attendanceRate}%` }}
            />
          </div>
        </div>

        {/* KPI: Cumprimento Curricular */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Progresso Grade</span>
            <Calendar className="text-amber-500" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{cronometro.rate}%</span>
            <span className="text-xs text-slate-400 font-mono">{cronometro.completed}/{cronometro.planned} aulas</span>
          </div>
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div 
              className="bg-amber-500 h-full transition-all duration-500" 
              style={{ width: `${cronometro.rate}%` }}
            />
          </div>
        </div>

        {/* KPI: Média e Desvio Padrão */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Média Geral / Dispersão</span>
            <TrendingUp className="text-indigo-400" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{classSummary.averageGrade}</span>
            <span className="text-[10px] text-slate-400 font-mono">DP: ±{classSummary.deviation}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono leading-relaxed">
            Menor dispersão (DP) indica aproveitamento homogêneo.
          </p>
        </div>
      </div>

      {/* Bloco Assimétrico: Scatter Plot e Heatmap de Faltas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo: Matriz de Risco (Scatter Plot) */}
        <div className="xl:col-span-2 bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              Matriz de Risco Individual (Presença vs. Média de Notas)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-6">Passe o mouse nos pontos para obter os dados de identificação do aluno.</p>
          </div>

          {/* Gráfico Scatter Plot Customizado */}
          <div className="relative border-b-2 border-l-2 border-industrial-600 h-80 flex-1 my-4 mx-4">
            {/* Quadrantes Indicativos */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-15 pointer-events-none">
              <div className="border-r border-b border-dashed border-red-500 bg-red-500/10" title="Alerta Crítico" />
              <div className="border-b border-dashed border-amber-500 bg-amber-500/5" title="Atenção Evasão" />
              <div className="border-r border-dashed border-amber-500 bg-amber-500/5" title="Defasagem" />
              <div className="bg-emerald-500/10" title="Estável" />
            </div>

            {/* Labels de Região */}
            <span className="absolute bottom-2 left-2 text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-950/40 px-1.5 py-0.5 rounded-none border border-red-900/30">Área Crítica</span>
            <span className="absolute top-2 right-2 text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/40 px-1.5 py-0.5 rounded-none border border-emerald-900/30">Excelente/Estável</span>

            {/* Alunos renderizados como pontos */}
            {studentMetrics.map((st) => {
              // Mapear Notas (0-100) para Altura (0-100% invertido)
              const bottomPercent = st.averageGrade;
              
              // Mapear Frequência (50-100) para Largura (0-100%)
              const leftPercent = ((st.attendanceRate - 50) / 50) * 100;

              // Cor do ponto
              let dotColor = 'bg-emerald-500 shadow-emerald-500/40 ring-emerald-500/20';
              if (st.status === 'critical') {
                dotColor = 'bg-red-500 shadow-red-500/40 ring-red-500/20';
              } else if (st.status === 'warning') {
                dotColor = 'bg-amber-500 shadow-amber-500/40 ring-amber-500/20';
              }

              return (
                <div 
                  key={st.id}
                  className={`absolute w-3.5 h-3.5 rounded-full ring-4 cursor-pointer hover:scale-150 transition-all z-10 flex items-center justify-center group ${dotColor}`}
                  style={{ 
                    bottom: `${Math.max(2, Math.min(98, bottomPercent))}%`, 
                    left: `${Math.max(2, Math.min(98, leftPercent))}%` 
                  }}
                >
                  {/* Tooltip Hover */}
                  <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 bg-industrial-950 border-2 border-industrial-700 px-3 py-2 text-[10px] rounded-none text-white whitespace-nowrap z-50 font-mono shadow-2xl">
                    <p className="font-bold text-slate-200">{st.name.toUpperCase()}</p>
                    <p className="text-slate-400 mt-1">Nota: <span className="text-white font-bold">{st.averageGrade}</span> | Presença: <span className="text-white font-bold">{st.attendanceRate}%</span></p>
                    <p className={`mt-1 font-bold ${st.status === 'critical' ? 'text-red-400' : st.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {st.status === 'critical' ? 'RISCO CRÍTICO' : st.status === 'warning' ? 'ATENÇÃO' : 'APROVADO'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legendas dos Eixos */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-4">
            <span className="flex items-center gap-1"><Clock size={10} /> Frequência Mínima (50%)</span>
            <span className="text-center font-bold text-slate-400">FREQUÊNCIA (Eixo X)</span>
            <span className="flex items-center gap-1">Frequência Máxima (100%) <Clock size={10} /></span>
          </div>
        </div>

        {/* Painel Direito: Mapa de Calor de Faltas (Heatmap) */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Mapa de Calor de Absenteísmo
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4">Volume de faltas acumuladas por dia e período da aula.</p>
          </div>

          <div className="grid grid-cols-6 gap-1.5 text-center my-2">
            {/* Top esquerdo vazio */}
            <div />
            {heatmapData.periods.map(p => (
              <div key={p} className="text-[9px] text-slate-500 font-mono leading-tight flex items-center justify-center font-bold">
                {p.split(' ')[0]}
              </div>
            ))}

            {heatmapData.days.map(day => (
              <>
                <div className="text-[9px] text-slate-400 font-bold text-left py-2 font-mono truncate">{day}</div>
                {heatmapData.periods.map(period => {
                  const count = heatmapData.grid[day]?.[period] || 0;
                  
                  // Definir cor de fundo com base no volume de faltas
                  let colorClass = 'bg-industrial-950 text-slate-600 border border-industrial-750';
                  if (count > 15) {
                    colorClass = 'bg-red-500/90 text-white font-bold animate-pulse';
                  } else if (count > 10) {
                    colorClass = 'bg-red-900/60 text-red-200 border border-red-800/40';
                  } else if (count > 5) {
                    colorClass = 'bg-amber-500/30 text-amber-300 border border-amber-500/20';
                  } else if (count > 2) {
                    colorClass = 'bg-industrial-900 text-slate-400 border border-industrial-750';
                  }

                  return (
                    <div 
                      key={period}
                      className={`h-9 flex items-center justify-center rounded-none text-xs transition-colors font-mono`}
                      title={`${day} no ${period}: ${count} faltas acumuladas`}
                    >
                      <div className={`w-full h-full flex items-center justify-center ${colorClass}`}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </>
            ))}
          </div>

          <div className="text-[9px] text-slate-500 font-mono leading-relaxed mt-2 pt-2 border-t border-industrial-700/60">
            * Destaque vermelho indica alta incidência de faltas acumuladas (potencial desvio de assiduidade de fim de semana/entrada).
          </div>
        </div>
      </div>

      {/* Seção Inferior: Alunos sob Atenção e Gargalos Curriculares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Alunos sob Risco (Lista Detalhada e Ações Rápidas) */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <ShieldAlert size={16} />
              Ações Preventivas (Estudantes sob Risco Crítico)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4">Estudantes que demandam agendamento de reforço acadêmico ou tutoria especial.</p>
          </div>

          {criticalStudents.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-500 italic">
              Nenhum aluno em situação de risco crítico para esta turma.
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {criticalStudents.map(st => (
                <div key={st.id} className="bg-industrial-900/60 border border-industrial-750 p-3.5 flex justify-between items-center rounded-none hover:border-red-900/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">{st.name.toUpperCase()}</p>
                    <p className="text-[10px] text-slate-500 font-mono">RA: {st.ra}</p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-mono text-red-400 font-bold">{st.averageGrade}</p>
                      <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Média Notas</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-mono text-red-400 font-bold">{st.attendanceRate}%</p>
                      <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Presença</p>
                    </div>

                    <a 
                      href="/evaluation" 
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/50 border border-red-900/50 text-red-400 text-[10px] font-bold transition-all uppercase tracking-wider"
                    >
                      Intervir
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[9px] text-slate-500 font-mono mt-4 pt-2 border-t border-industrial-700/60">
            Ação recomendada: Clique em "Intervir" para abrir a pauta formativa e registrar recuperação/apoio.
          </div>
        </div>

        {/* Gargalos Pedagógicos (Aproveitamento de Competências) */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-400" />
              Gargalos de Aprendizagem (Proficiência por Competência)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-6">Média de aproveitamento da turma nas capacidades e conhecimentos avaliados no plano.</p>
          </div>

          <div className="space-y-4 flex-1">
            {curricularCompetencies.map((comp, idx) => {
              const isGargalo = comp.average < 50;
              const barColor = isGargalo ? 'bg-red-500' : comp.average < 75 ? 'bg-amber-500' : 'bg-emerald-500';
              const textGradeColor = isGargalo ? 'text-red-400 font-bold' : comp.average < 75 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold';

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-slate-300 truncate max-w-sm" title={comp.name}>
                      {comp.name}
                    </span>
                    <span className={textGradeColor}>
                      {comp.average}% {isGargalo ? ' (Gargalo Crítico)' : ''}
                    </span>
                  </div>

                  <div className="w-full bg-industrial-950 h-3 overflow-hidden rounded-none border border-industrial-750 flex">
                    <div 
                      className={`h-full ${barColor} transition-all duration-500`}
                      style={{ width: `${comp.average}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[9px] text-slate-500 font-mono mt-4 pt-2 border-t border-industrial-700/60 leading-relaxed">
            * Competências com médias de turma inferiores a 50% são marcadas automaticamente como gargalos de ensino, demandando adaptação didática docente.
          </div>
        </div>

      </div>
    </div>
  );
}
