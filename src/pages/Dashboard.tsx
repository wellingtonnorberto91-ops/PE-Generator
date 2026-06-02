import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { 
  TrendingUp, Users, Calendar, AlertCircle, BarChart2, 
  Activity, BookOpen, Clock, ChevronDown, ShieldAlert, ArrowLeft
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
  classId: string;
}

interface StudentMetrics {
  id: string;
  name: string;
  ra: string;
  averageGrade: number;
  attendanceRate: number;
  status: 'critical' | 'warning' | 'stable';
}

interface ClassSummary {
  id: string;
  name: string;
  studentCount: number;
  averageGrade: number;
  attendanceRate: number;
  criticalCount: number;
  warningCount: number;
  status: 'critical' | 'warning' | 'stable';
  deviation: number;
}

export function Dashboard() {
  const [classes, setClasses] = useState<ClassPlan[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Controle de Visualização (Drill-Down)
  const [viewMode, setViewMode] = useState<'geral' | 'turma'>('geral');
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  
  // Filtros Globais (Visão Geral)
  const [filterTurno, setFilterTurno] = useState<string>('todos');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('todos');

  // Carregar dados de turmas e alunos em lote para alta performance
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // 1. Carregar todas as turmas
        const plansSnap = await getDocs(query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc')));
        const loadedClasses: ClassPlan[] = [];
        plansSnap.forEach(d => {
          const docData = d.data();
          loadedClasses.push({ 
            id: d.id, 
            name: docData.name || 'Sem Nome',
            startDate: docData.startDate,
            endDate: docData.endDate,
            modules: docData.modules || []
          });
        });
        setClasses(loadedClasses);
        if (loadedClasses.length > 0) {
          setSelectedClassId(loadedClasses[0].id);
        }

        // 2. Carregar todos os estudantes de uma vez (evita requisições repetidas)
        const studentsSnap = await getDocs(collection(db, 'students'));
        const list: Student[] = [];
        studentsSnap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Student);
        });
        setAllStudents(list);
      } catch (e) {
        console.error("Erro ao carregar dados consolidados no Dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Filtrar estudantes pertencentes à turma selecionada na Visão Turma
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return allStudents.filter(s => s.classId === selectedClassId);
  }, [allStudents, selectedClassId]);

  // Consolidar métricas para cada estudante da turma selecionada (Visão Turma)
  const studentMetrics = useMemo<StudentMetrics[]>(() => {
    if (classStudents.length === 0) return [];

    return classStudents.map(s => {
      const charSum = s.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const simulatedAverage = 35 + (charSum % 64); 
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
  }, [classStudents]);

  // Métricas Consolidadas para a Turma Selecionada (Visão Turma)
  const activeClassSummary = useMemo(() => {
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

  // Consolidar métricas de TODAS as turmas para a Visão Geral (Macro)
  const allClassSummaries = useMemo<ClassSummary[]>(() => {
    return classes.map(c => {
      const classStuds = allStudents.filter(s => s.classId === c.id);
      
      if (classStuds.length === 0) {
        return {
          id: c.id,
          name: c.name,
          studentCount: 0,
          averageGrade: 0,
          attendanceRate: 0,
          criticalCount: 0,
          warningCount: 0,
          status: 'stable' as const,
          deviation: 0
        };
      }

      const metrics = classStuds.map(s => {
        const charSum = s.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const simulatedAverage = 35 + (charSum % 64);
        const simulatedAttendance = 62 + (charSum % 39);

        let status: 'critical' | 'warning' | 'stable' = 'stable';
        if (simulatedAttendance < 75 || simulatedAverage < 50) {
          status = 'critical';
        } else if (simulatedAttendance < 85 || simulatedAverage < 70) {
          status = 'warning';
        }

        return { averageGrade: simulatedAverage, attendanceRate: simulatedAttendance, status };
      });

      const totalGrade = metrics.reduce((acc, m) => acc + m.averageGrade, 0);
      const totalAttendance = metrics.reduce((acc, m) => acc + m.attendanceRate, 0);
      const criticalCount = metrics.filter(m => m.status === 'critical').length;
      const warningCount = metrics.filter(m => m.status === 'warning').length;
      
      const meanGrade = totalGrade / metrics.length;
      const variance = metrics.reduce((acc, m) => acc + Math.pow(m.averageGrade - meanGrade, 2), 0) / metrics.length;
      const deviation = Math.sqrt(variance);

      let classStatus: 'critical' | 'warning' | 'stable' = 'stable';
      if (criticalCount > 2) {
        classStatus = 'critical';
      } else if (criticalCount > 0 || warningCount > 2) {
        classStatus = 'warning';
      }

      return {
        id: c.id,
        name: c.name,
        studentCount: classStuds.length,
        averageGrade: Math.round(meanGrade),
        attendanceRate: Math.round(totalAttendance / metrics.length),
        criticalCount,
        warningCount,
        status: classStatus,
        deviation: Math.round(deviation * 10) / 10
      };
    });
  }, [classes, allStudents]);

  // Aplicar Filtros Globais na Visão Geral
  const filteredClassSummaries = useMemo(() => {
    return allClassSummaries.filter(cs => {
      // Filtragem por Turno simulada baseada na nomenclatura das turmas (ex: "MANHÃ" ou "TARDE")
      if (filterTurno !== 'todos') {
        const nameUpper = cs.name.toUpperCase();
        if (filterTurno === 'manha' && !nameUpper.includes('MANHÃ') && !nameUpper.includes('MATUTINO')) return false;
        if (filterTurno === 'tarde' && !nameUpper.includes('TARDE') && !nameUpper.includes('VESPERTINO')) return false;
        if (filterTurno === 'noite' && !nameUpper.includes('NOITE') && !nameUpper.includes('NOTURNO')) return false;
      }
      // Filtragem por Semestre/Período
      if (filterPeriodo !== 'todos') {
        const nameUpper = cs.name.toUpperCase();
        if (filterPeriodo === '1' && !nameUpper.includes('1º') && !nameUpper.includes('1/') && !nameUpper.includes('MÓDULO 1')) return false;
        if (filterPeriodo === '2' && !nameUpper.includes('2º') && !nameUpper.includes('2/') && !nameUpper.includes('MÓDULO 2')) return false;
      }
      return true;
    });
  }, [allClassSummaries, filterTurno, filterPeriodo]);

  // Métricas Consolidadas da Escola
  const schoolSummary = useMemo(() => {
    const activeSummaries = filteredClassSummaries.filter(cs => cs.studentCount > 0);
    if (activeSummaries.length === 0) {
      return { totalStudents: 0, averageGrade: 0, attendanceRate: 0, criticalCount: 0 };
    }

    const totalStudents = activeSummaries.reduce((acc, cs) => acc + cs.studentCount, 0);
    const sumGrades = activeSummaries.reduce((acc, cs) => acc + (cs.averageGrade * cs.studentCount), 0);
    const sumAttendance = activeSummaries.reduce((acc, cs) => acc + (cs.attendanceRate * cs.studentCount), 0);
    const criticalCount = activeSummaries.reduce((acc, cs) => acc + cs.criticalCount, 0);

    return {
      totalStudents,
      averageGrade: Math.round((sumGrades / totalStudents) * 10) / 10,
      attendanceRate: Math.round(sumAttendance / totalStudents),
      criticalCount
    };
  }, [filteredClassSummaries]);

  // Ranking de Aproveitamento Geral das Turmas
  const classRanking = useMemo(() => {
    return [...filteredClassSummaries]
      .filter(cs => cs.studentCount > 0)
      .sort((a, b) => b.averageGrade - a.averageGrade);
  }, [filteredClassSummaries]);

  // Ranking de Disciplinas Gargalo da Instituição (Consolidado de turmas/módulos)
  const globalDisciplinesGargalos = useMemo(() => {
    const list = [
      { name: 'Cálculo de Parâmetros de Processo', average: 46, code: 'CPP-01', reprovRate: 28 },
      { name: 'Manipulação de Estruturas de Dados Complexas', average: 44, code: 'MEDC-02', reprovRate: 32 },
      { name: 'Metrologia Dimensional Aplicada', average: 61, code: 'MDA-03', reprovRate: 15 },
      { name: 'Desenho Técnico Assistido por Computador', average: 78, code: 'DTAC-04', reprovRate: 8 },
      { name: 'Algoritmos e Lógica de Programação', average: 75, code: 'ALP-05', reprovRate: 10 }
    ];
    return list.sort((a, b) => b.reprovRate - a.reprovRate);
  }, []);

  // Alunos Críticos (Visão Turma)
  const criticalStudents = useMemo(() => {
    return studentMetrics.filter(m => m.status === 'critical').slice(0, 4);
  }, [studentMetrics]);

  // Mapa de Calor de Faltas Simuladas (Visão Turma)
  const heatmapData = useMemo(() => {
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const periods = ['1º Tempo', '2º Tempo', '3º Tempo', '4º Tempo', '5º Tempo'];
    
    const baseGrid: Record<string, Record<string, number>> = {
      'Segunda': { '1º Tempo': 16, '2º Tempo': 12, '3º Tempo': 4, '4º Tempo': 5, '5º Tempo': 7 },
      'Terça': { '1º Tempo': 3, '2º Tempo': 2, '3º Tempo': 1, '4º Tempo': 2, '5º Tempo': 3 },
      'Quarta': { '1º Tempo': 4, '2º Tempo': 3, '3º Tempo': 2, '4º Tempo': 2, '5º Tempo': 2 },
      'Quinta': { '1º Tempo': 5, '2º Tempo': 4, '3º Tempo': 3, '4º Tempo': 3, '5º Tempo': 4 },
      'Sexta': { '1º Tempo': 6, '2º Tempo': 5, '3º Tempo': 8, '4º Tempo': 14, '5º Tempo': 21 }
    };

    return { days, periods, grid: baseGrid };
  }, []);

  // Gargalos de Aprendizado (Visão Turma)
  const curricularCompetencies = useMemo(() => {
    const activeClass = classes.find(c => c.id === selectedClassId);
    const currentModuleName = activeClass?.modules?.[selectedModuleIndex]?.name || 'Fundamentos da Tecnologia';
    
    let list = [
      { name: 'Interpretação de Desenho e Tolerâncias', average: 78, type: 'Technical' },
      { name: 'Cálculo de Parâmetros de Processo', average: 46, type: 'Technical' }, 
      { name: 'Segurança Operacional e Uso de EPIs', average: 92, type: 'Socioemotional' },
      { name: 'Manutenção Preditiva e Ajustes Finos', average: 61, type: 'Technical' }
    ];

    if (currentModuleName.toUpperCase().includes('PROGRAMAÇÃO') || currentModuleName.toUpperCase().includes('TI')) {
      list = [
        { name: 'Lógica Algorítmica Estruturada', average: 75, type: 'Technical' },
        { name: 'Manipulação de Estruturas de Dados Complexas', average: 44, type: 'Technical' }, 
        { name: 'Versionamento e Trabalho Colaborativo', average: 88, type: 'Socioemotional' },
        { name: 'Integração de APIs e Depuração de Bugs', average: 63, type: 'Technical' }
      ];
    }

    return list.sort((a, b) => a.average - b.average);
  }, [classes, selectedClassId, selectedModuleIndex]);

  // Progresso do Cronograma
  const cronometro = useMemo(() => {
    return { planned: 60, completed: 48, rate: Math.round((48 / 60) * 100) };
  }, []);

  // Gatilho de Drill-down
  const handleDrillDown = (classId: string) => {
    setSelectedClassId(classId);
    setViewMode('turma');
  };

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
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Nenhuma Turma Cadastrada</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Para visualizar os painéis analíticos, cadastre planos de curso e alunos no sistema escolar.
        </p>
        <div className="flex justify-center">
          <a href="/classes" className="px-6 py-2.5 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
            Cadastrar Turmas
          </a>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDERIZAÇÃO: VISÃO GERAL (MACRO)
  // ==========================================
  const renderVisaoGeral = () => (
    <div className="space-y-8">
      {/* Topo / Filtros Globais */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-industrial-900/40 p-6 border border-industrial-700 rounded-none">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 className="text-primary" size={24} />
            Saúde Pedagógica Escolar (Visão Geral)
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Cockpit analítico de acompanhamento consolidado para coordenação escolar.
          </p>
        </div>

        {/* Filtros em Cascata */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1 font-mono">Filtrar por Turno</label>
            <div className="relative">
              <select
                value={filterTurno}
                onChange={e => setFilterTurno(e.target.value)}
                className="bg-industrial-950 border-2 border-industrial-750 hover:border-primary text-white text-xs font-bold px-4 py-2 pr-8 outline-none rounded-none transition-all cursor-pointer appearance-none uppercase tracking-wider"
              >
                <option value="todos">Todos os Turnos</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" size={12} />
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1 font-mono">Filtrar por Período</label>
            <div className="relative">
              <select
                value={filterPeriodo}
                onChange={e => setFilterPeriodo(e.target.value)}
                className="bg-industrial-950 border-2 border-industrial-750 hover:border-primary text-white text-xs font-bold px-4 py-2 pr-8 outline-none rounded-none transition-all cursor-pointer appearance-none uppercase tracking-wider"
              >
                <option value="todos">Todos Semestres</option>
                <option value="1">1º Semestre</option>
                <option value="2">2º Semestre</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* Cards de KPIs Escolares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`p-6 border-2 rounded-none transition-colors ${schoolSummary.criticalCount > 0 ? 'bg-red-950/20 border-red-900/60' : 'bg-industrial-800 border-industrial-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Alunos em Risco Global</span>
            <ShieldAlert className={schoolSummary.criticalCount > 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'} size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{schoolSummary.criticalCount}</span>
            <span className="text-xs text-slate-400 font-mono">alunos</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono leading-relaxed">
            Consolidado escolar de estudantes com risco de reprovação.
          </p>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Assiduidade Geral</span>
            <Users className="text-primary" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{schoolSummary.attendanceRate}%</span>
            <span className="text-xs text-slate-500 font-mono">frequência</span>
          </div>
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div className="bg-emerald-500 h-full" style={{ width: `${schoolSummary.attendanceRate}%` }} />
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Aproveitamento Médio</span>
            <TrendingUp className="text-indigo-400" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{schoolSummary.averageGrade}</span>
            <span className="text-xs text-slate-500 font-mono">média geral</span>
          </div>
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div className="bg-indigo-500 h-full" style={{ width: `${schoolSummary.averageGrade}%` }} />
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Capacidade Instalada</span>
            <Users className="text-amber-500" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{schoolSummary.totalStudents}</span>
            <span className="text-xs text-slate-400 font-mono">estudantes ativos</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono leading-relaxed">
            Volume de matriculados nos segmentos selecionados.
          </p>
        </div>
      </div>

      {/* Grade de Cartões de Turmas (Nível Macro) */}
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-industrial-700 pb-2">
          Monitoramento Consolidado de Turmas (Clique na Turma para Detalhar)
        </h3>
        
        {filteredClassSummaries.length === 0 ? (
          <div className="bg-industrial-800 border border-industrial-700 p-12 text-center text-slate-400 text-xs italic">
            Nenhuma turma corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClassSummaries.map(cs => {
              // Definir cores das bordas baseados no status da turma
              let statusBorder = 'border-industrial-700 hover:border-primary/60';
              let statusTag = <span className="text-[9px] font-mono bg-industrial-950 text-slate-400 px-2 py-0.5 border border-industrial-750 uppercase">Estável</span>;
              
              if (cs.status === 'critical') {
                statusBorder = 'border-red-900/60 bg-red-950/5 hover:border-red-500';
                statusTag = <span className="text-[9px] font-mono bg-red-950 text-red-400 px-2 py-0.5 border border-red-900/50 uppercase font-bold animate-pulse">Crítica</span>;
              } else if (cs.status === 'warning') {
                statusBorder = 'border-amber-900/60 bg-amber-950/5 hover:border-amber-500';
                statusTag = <span className="text-[9px] font-mono bg-amber-950 text-amber-400 px-2 py-0.5 border border-amber-900/50 uppercase font-bold">Atenção</span>;
              }

              return (
                <div 
                  key={cs.id}
                  onClick={() => cs.studentCount > 0 && handleDrillDown(cs.id)}
                  className={`bg-industrial-800 border-2 p-5 flex flex-col justify-between cursor-pointer transition-all ${statusBorder}`}
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider truncate">{cs.name}</h4>
                      {statusTag}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono">Volume: {cs.studentCount} Alunos</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 pt-3 border-t border-industrial-750 text-xs font-mono">
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase tracking-wider">Aproveitamento</p>
                      <p className="text-sm font-bold text-white mt-0.5">{cs.averageGrade}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase tracking-wider">Presença Média</p>
                      <p className="text-sm font-bold text-white mt-0.5">{cs.attendanceRate}%</p>
                    </div>
                  </div>
                  
                  {cs.criticalCount > 0 && (
                    <div className="mt-4 flex items-center gap-1.5 text-[9px] text-red-400 bg-red-950/30 p-1.5 border border-red-900/20">
                      <AlertCircle size={10} />
                      <span>{cs.criticalCount} alunos sob atenção crítica na sala</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Linha Inferior: Rankings de Turmas e Disciplinas Gargalo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Turmas */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              Ranking de Desempenho (Proficiência de Turmas)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4">Turmas organizadas pela média geral acumulada no período.</p>
          </div>

          <div className="space-y-3.5 flex-1">
            {classRanking.map((item, idx) => (
              <div key={item.id} className="flex justify-between items-center bg-industrial-900/40 p-2.5 border border-industrial-750 text-xs font-mono">
                <span className="flex items-center gap-2 truncate">
                  <span className="w-5 h-5 bg-industrial-950 text-[10px] flex items-center justify-center font-bold text-slate-400 border border-industrial-750">
                    {idx + 1}
                  </span>
                  <span className="text-white font-bold truncate uppercase">{item.name}</span>
                </span>
                <span className="text-indigo-400 font-bold">{item.averageGrade}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Disciplinas com Maior Reprovação (Gargalos) */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <ShieldAlert size={16} />
              Gargalos Institucionais (Matérias Críticas)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4 font-mono">Disciplinas com maiores índices de retenção e reprovação projetada.</p>
          </div>

          <div className="space-y-4 flex-1">
            {globalDisciplinesGargalos.map((disc, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-300 truncate max-w-sm" title={disc.name}>
                    {disc.code} - {disc.name}
                  </span>
                  <span className="text-red-400 font-bold">
                    {disc.reprovRate}% Reprovação
                  </span>
                </div>
                <div className="w-full bg-industrial-950 h-2.5 overflow-hidden rounded-none border border-industrial-750 flex">
                  <div className="bg-red-500/80 h-full" style={{ width: `${disc.reprovRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // RENDERIZAÇÃO: VISÃO POR TURMA (MICRO)
  // ==========================================
  const renderVisaoTurma = () => (
    <div className="space-y-8">
      {/* Botão de Retorno e Identificação */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-industrial-900/40 p-6 border border-industrial-700 rounded-none">
        <div className="space-y-2">
          <button 
            onClick={() => setViewMode('geral')}
            className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider border-2 border-industrial-750 bg-industrial-950 px-3 py-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft size={12} /> Voltar ao Painel Geral
          </button>
          
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart2 className="text-primary" size={24} />
            Indicadores de Turma: {classes.find(c => c.id === selectedClassId)?.name}
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Módulo selecionado: <span className="text-primary font-bold">{classes.find(c => c.id === selectedClassId)?.modules?.[selectedModuleIndex]?.name || 'Geral'}</span>
          </p>
        </div>

        {/* Seletores de Módulo (Subnível) */}
        <div className="flex flex-wrap items-center gap-3">
          {classes.find(c => c.id === selectedClassId)?.modules && (classes.find(c => c.id === selectedClassId)?.modules?.length ?? 0) > 0 && (
            <div className="relative">
              <select
                value={selectedModuleIndex}
                onChange={e => setSelectedModuleIndex(Number(e.target.value))}
                className="bg-industrial-950 border-2 border-industrial-750 hover:border-primary text-white text-xs font-bold px-4 py-2.5 pr-8 outline-none rounded-none transition-all cursor-pointer appearance-none uppercase tracking-wider"
              >
                {classes.find(c => c.id === selectedClassId)?.modules?.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m.name.slice(0, 20)}...
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" size={12} />
            </div>
          )}
        </div>
      </div>

      {/* Grid de KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`p-6 border-2 rounded-none transition-colors ${activeClassSummary.criticalCount > 0 ? 'bg-red-950/20 border-red-900/60' : 'bg-industrial-800 border-industrial-700'}`}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Risco Crítico</span>
            <ShieldAlert className={activeClassSummary.criticalCount > 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'} size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeClassSummary.criticalCount}</span>
            <span className="text-xs text-slate-400 font-mono">estudantes</span>
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Assiduidade Turma</span>
            <Users className="text-primary" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeClassSummary.attendanceRate}%</span>
          </div>
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div className="bg-emerald-500 h-full" style={{ width: `${activeClassSummary.attendanceRate}%` }} />
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Progresso Grade</span>
            <Calendar className="text-amber-500" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{cronometro.rate}%</span>
            <span className="text-xs text-slate-400 font-mono">{cronometro.completed}/{cronometro.planned} aulas</span>
          </div>
          <div className="w-full bg-industrial-950 h-1.5 mt-3 overflow-hidden rounded-none border border-industrial-750">
            <div className="bg-amber-500 h-full" style={{ width: `${cronometro.rate}%` }} />
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">Média Geral / Dispersão</span>
            <TrendingUp className="text-indigo-400" size={20} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeClassSummary.averageGrade}</span>
            <span className="text-[10px] text-slate-400 font-mono">DP: ±{activeClassSummary.deviation}</span>
          </div>
        </div>
      </div>

      {/* Scatter Plot e Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Scatter Plot */}
        <div className="xl:col-span-2 bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              Matriz de Risco Individual (Presença vs. Média de Notas)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-6">Passe o mouse nos pontos para obter os dados de identificação do aluno.</p>
          </div>

          <div className="relative border-b-2 border-l-2 border-industrial-600 h-80 flex-1 my-4 mx-4">
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-15 pointer-events-none">
              <div className="border-r border-b border-dashed border-red-500 bg-red-500/10" />
              <div className="border-b border-dashed border-amber-500 bg-amber-500/5" />
              <div className="border-r border-dashed border-amber-500 bg-amber-500/5" />
              <div className="bg-emerald-500/10" />
            </div>

            <span className="absolute bottom-2 left-2 text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-950/40 px-1.5 py-0.5 rounded-none border border-red-900/30">Área Crítica</span>
            <span className="absolute top-2 right-2 text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/40 px-1.5 py-0.5 rounded-none border border-emerald-900/30">Excelente/Estável</span>

            {studentMetrics.map((st) => {
              const bottomPercent = st.averageGrade;
              const leftPercent = ((st.attendanceRate - 50) / 50) * 100;

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

          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono px-4">
            <span className="flex items-center gap-1"><Clock size={10} /> Frequência Mínima (50%)</span>
            <span className="text-center font-bold text-slate-400">FREQUÊNCIA (Eixo X)</span>
            <span className="flex items-center gap-1">Frequência Máxima (100%) <Clock size={10} /></span>
          </div>
        </div>

        {/* Heatmap de Absenteísmo */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Mapa de Calor de Absenteísmo
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4 font-mono">Volume de faltas acumuladas por dia e período da aula.</p>
          </div>

          <div className="grid grid-cols-6 gap-1.5 text-center my-2">
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
                      className="h-9 flex items-center justify-center rounded-none text-xs transition-colors font-mono"
                      title={`${day} no ${period}: ${count} faltas`}
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
            * Faltas recorrentes no início da semana e final da sexta demandam intervenção.
          </div>
        </div>
      </div>

      {/* Lista de Alunos e Gargalos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Alunos sob Risco */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <ShieldAlert size={16} />
              Ações Preventivas (Estudantes sob Risco Crítico)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-4">Estudantes que demandam apoio pedagógico imediato.</p>
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
                      <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Média</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-mono text-red-400 font-bold">{st.attendanceRate}%</p>
                      <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Presença</p>
                    </div>

                    <a href="/evaluation" className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/50 border border-red-900/50 text-red-400 text-[10px] font-bold transition-all uppercase tracking-wider">
                      Intervir
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gargalos Pedagógicos */}
        <div className="bg-industrial-800 border border-industrial-700 p-6 rounded-none flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-400" />
              Gargalos de Aprendizagem (Proficiência por Competência)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mb-6">Média de aproveitamento da turma nas capacidades do plano de ensino.</p>
          </div>

          <div className="space-y-4 flex-1">
            {curricularCompetencies.map((comp, idx) => {
              const isGargalo = comp.average < 50;
              const barColor = isGargalo ? 'bg-red-500' : comp.average < 75 ? 'bg-amber-500' : 'bg-emerald-500';
              const textGradeColor = isGargalo ? 'text-red-400 font-bold' : comp.average < 75 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold';

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
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
        </div>
      </div>
    </div>
  );

  return viewMode === 'geral' ? renderVisaoGeral() : renderVisaoTurma();
}
