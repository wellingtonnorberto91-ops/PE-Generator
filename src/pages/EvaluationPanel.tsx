import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  generateActivitiesAI
} from '../features/ai-core/gemini';
import { 
  Award, Sparkles, Save, Printer, Loader2, Plus, Trash2, 
  ClipboardList, TrendingUp, Percent, AlertCircle, Upload, 
  Image, FileText, BookOpen
} from 'lucide-react';

interface ClassPlan {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  ra: string;
}

interface Module {
  name: string;
  hours: number;
  objective?: string;
  technicalCapabilities?: string[];
  capacidadesTecnicas?: string[];
  knowledge?: string[];
  conhecimentos?: string[];
}

interface TeachingPlanDetails {
  id: string;
  name: string;
  modules: Module[];
}

interface Activity {
  id: string;
  title: string;
  description: string;
  resources: string;
  expectedResult: string;
  weight: number; // e.g., 0 to 100
}

interface StudentDelivery {
  studentId: string;
  activityId: string;
  grade: number; // 0 to 100
  evaluation: 'S' | 'NS' | 'D' | ''; // Satisfatório, Não Sat., Destaque
  fileName?: string;
  fileUrl?: string; // mock image/file
}

export function EvaluationPanel() {
  const [classes, setClasses] = useState<ClassPlan[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<TeachingPlanDetails | null>(null);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState<number>(0);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deliveries, setDeliveries] = useState<StudentDelivery[]>([]);
  
  const [activeTab, setActiveTab] = useState<'atividades' | 'lancamentos' | 'kpis' | 'relatorios' | 'plano'>('atividades');
  const [activeAssessmentPlan, setActiveAssessmentPlan] = useState<any | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [activeReportType, setActiveReportType] = useState<'plano' | 'geral' | 'individual' | 'dossie' | 'criterios' | null>(null);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string>('');
  
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal/Manual Activity Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRes, setNewRes] = useState('');
  const [newResult, setNewResult] = useState('');

  // File Upload Simulations
  const [uploadingForStudent, setUploadingForStudent] = useState<{ studentId: string; activityId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load classes/plans
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const snap = await getDocs(q);
        const data: ClassPlan[] = [];
        snap.forEach(d => data.push({ id: d.id, name: d.data().name }));
        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
        }
      } catch (e) {
        console.error("Erro ao carregar turmas", e);
      }
    };
    fetchClasses();
  }, []);

  // Load details of the selected plan (modules, etc.)
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchPlanDetails = async () => {
      try {
        const planSnap = await getDoc(doc(db, 'teaching_plans', selectedClassId));
        if (planSnap.exists()) {
          const data = planSnap.data();
          setSelectedPlanDetails({
            id: planSnap.id,
            name: data.name || '',
            modules: data.modules || []
          });
          setSelectedModuleIndex(0);
        }
      } catch (e) {
        console.error("Erro ao carregar detalhes do plano de ensino", e);
      }
    };
    fetchPlanDetails();
  }, [selectedClassId]);

  // Load students & activities & deliveries & assessment plan
  useEffect(() => {
    if (!selectedClassId || !selectedPlanDetails) return;
    const fetchStudentsAndData = async () => {
      setLoadingStudents(true);
      setLoadingPlan(true);
      try {
        // 1. Fetch Students
        const q = query(collection(db, 'students'), where('classId', '==', selectedClassId));
        const snap = await getDocs(q);
        const list: Student[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Student);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);

        // 2. Fetch or load activities & deliveries for this specific module from Firestore
        const dataId = `${selectedClassId}_mod_${selectedModuleIndex}`;
        const evalSnap = await getDoc(doc(db, 'evaluation_data', dataId));
        
        if (evalSnap.exists()) {
          const evalData = evalSnap.data();
          setActivities(evalData.activities || []);
          setDeliveries(evalData.deliveries || []);
        } else {
          setActivities([]);
          setDeliveries([]);
        }

        // 3. Fetch correspondente da coleção assessments_formativa
        const activeModule = selectedPlanDetails.modules[selectedModuleIndex];
        const activeModuleName = activeModule?.name || '';
        const qPlan = query(
          collection(db, 'assessments_formativa'), 
          where('planId', '==', selectedClassId),
          where('unitName', '==', activeModuleName)
        );
        const snapPlan = await getDocs(qPlan);
        if (!snapPlan.empty) {
          const docPlan = snapPlan.docs[0];
          setActiveAssessmentPlan({ id: docPlan.id, ...docPlan.data() });
        } else {
          setActiveAssessmentPlan(null);
        }
      } catch (e) {
        console.error("Erro ao carregar dados", e);
      } finally {
        setLoadingStudents(false);
        setLoadingPlan(false);
      }
    };
    fetchStudentsAndData();
  }, [selectedClassId, selectedPlanDetails, selectedModuleIndex]);

  const activeModule = selectedPlanDetails?.modules[selectedModuleIndex];

  // AI Activity Generator
  const handleAIGenerateActivities = async () => {
    if (!activeModule) return;
    setGenerating(true);
    try {
      const criteria = activeModule.technicalCapabilities || activeModule.capacidadesTecnicas || [
        "Executar montagem industrial",
        "Garantir conformidade técnica e de segurança"
      ];
      
      const response = await generateActivitiesAI(activeModule.name, criteria);
      
      const newActs: Activity[] = response.map((act, index) => ({
        id: `act_${Date.now()}_${index}`,
        title: act.title,
        description: act.description,
        resources: act.resources,
        expectedResult: act.expectedResult,
        weight: Math.round(100 / response.length)
      }));
      
      setActivities(newActs);

      // Initialize deliveries
      const newDels: StudentDelivery[] = [];
      students.forEach(student => {
        newActs.forEach(act => {
          newDels.push({
            studentId: student.id,
            activityId: act.id,
            grade: 0,
            evaluation: ''
          });
        });
      });
      setDeliveries(newDels);
    } catch (e) {
      console.error(e);
      alert('Erro ao se comunicar com o Sentry AI.');
    } finally {
      setGenerating(false);
    }
  };

  // Add manual activity
  const handleAddManualActivity = () => {
    if (!newTitle.trim()) {
      alert('Por favor, informe o título da atividade.');
      return;
    }
    const newAct: Activity = {
      id: `act_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Sem descrição.',
      resources: newRes.trim() || 'Não especificados.',
      expectedResult: newResult.trim() || 'A combinar com o docente.',
      weight: 50
    };
    
    const updatedActs = [...activities, newAct];
    setActivities(updatedActs);
    
    // Add deliveries for the new activity
    const newDels = [...deliveries];
    students.forEach(student => {
      newDels.push({
        studentId: student.id,
        activityId: newAct.id,
        grade: 0,
        evaluation: ''
      });
    });
    setDeliveries(newDels);

    setNewTitle('');
    setNewDesc('');
    setNewRes('');
    setNewResult('');
    setShowAddForm(false);
  };

  // Delete activity
  const handleDeleteActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
    setDeliveries(deliveries.filter(d => d.activityId !== id));
  };

  // Handle grade sheet inputs
  const handleDeliveryChange = (studentId: string, activityId: string, field: 'grade' | 'evaluation', value: any) => {
    setDeliveries(prev => {
      const idx = prev.findIndex(d => d.studentId === studentId && d.activityId === activityId);
      const updated = [...prev];
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          [field]: field === 'grade' ? Number(value) : value
        };
      } else {
        updated.push({
          studentId,
          activityId,
          grade: field === 'grade' ? Number(value) : 0,
          evaluation: field === 'evaluation' ? value : '',
          fileName: ''
        });
      }
      return updated;
    });
  };

  // Mock File Upload
  const triggerFileUpload = (studentId: string, activityId: string) => {
    setUploadingForStudent({ studentId, activityId });
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingForStudent) {
      const { studentId, activityId } = uploadingForStudent;
      setDeliveries(prev => {
        const idx = prev.findIndex(d => d.studentId === studentId && d.activityId === activityId);
        const updated = [...prev];
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            fileName: file.name,
            fileUrl: file.type.startsWith('image/') 
              ? 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=200&auto=format&fit=crop'
              : 'document_icon'
          };
        }
        return updated;
      });
      setUploadingForStudent(null);
    }
  };

  // Save whole panel evaluation state to database
  const handleSaveEvaluation = async () => {
    if (!selectedClassId || !selectedPlanDetails) return;
    setSaving(true);
    try {
      const dataId = `${selectedClassId}_mod_${selectedModuleIndex}`;
      await setDoc(doc(db, 'evaluation_data', dataId), {
        classId: selectedClassId,
        moduleIndex: selectedModuleIndex,
        activities,
        deliveries,
        updatedAt: new Date()
      });
      alert('Painel de Atividades e Resultados salvo com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar os resultados no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Sincronização Inteligente: Notas de Atividades -> Critérios do Plano de Ensino
  const handleSyncActivitiesToCriteria = async () => {
    if (!activeAssessmentPlan || activities.length === 0 || students.length === 0) {
      alert("Nenhum plano de ensino ou atividades de avaliação encontradas para sincronizar.");
      return;
    }
    
    setSaving(true);
    try {
      const updatedTableRows = [...activeAssessmentPlan.tableRows];
      
      students.forEach(student => {
        const studentDels = deliveries.filter(d => d.studentId === student.id);
        if (studentDels.length === 0) return;
        
        let sumGrades = 0;
        let count = 0;
        studentDels.forEach(d => {
          sumGrades += d.grade || 0;
          count++;
        });
        
        const avg = count > 0 ? sumGrades / count : 0;
        
        let concept: 'S' | 'NS' | 'D' | '' = '';
        if (avg >= 85) {
          concept = 'D';
        } else if (avg >= 50) {
          concept = 'S';
        } else {
          concept = 'NS';
        }
        
        updatedTableRows.forEach(row => {
          if (!row.studentEvaluations) {
            row.studentEvaluations = {};
          }
          row.studentEvaluations[student.id] = concept;
        });
      });
      
      const planDocRef = doc(db, 'assessments_formativa', activeAssessmentPlan.id);
      await setDoc(planDocRef, {
        ...activeAssessmentPlan,
        tableRows: updatedTableRows,
        updatedAt: new Date()
      }, { merge: true });
      
      setActiveAssessmentPlan((prev: any) => prev ? { ...prev, tableRows: updatedTableRows } : null);
      alert("Tabela de critérios do plano de ensino alimentada com as avaliações dos alunos com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao sincronizar dados de avaliação com a tabela de critérios.");
    } finally {
      setSaving(false);
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    if (students.length === 0 || activities.length === 0) {
      return { avgGrade: 0, successRate: 0, needsSupport: [] as Student[], topStudents: [] as Student[] };
    }
    let totalGradeSum = 0;
    let totalEvaluations = 0;
    let satisfiedCount = 0;
    const studentStats: Record<string, { totalGrade: number; count: number; hasNS: boolean }> = {};
    
    students.forEach(s => {
      studentStats[s.id] = { totalGrade: 0, count: 0, hasNS: false };
    });

    deliveries.forEach(d => {
      if (studentStats[d.studentId]) {
        studentStats[d.studentId].totalGrade += d.grade || 0;
        studentStats[d.studentId].count += 1;
        totalGradeSum += d.grade || 0;
        totalEvaluations += 1;
        if (d.evaluation === 'S' || d.evaluation === 'D') {
          satisfiedCount += 1;
        } else if (d.evaluation === 'NS') {
          studentStats[d.studentId].hasNS = true;
        }
      }
    });

    const needsSupport: Student[] = [];
    const studentAvgs = students.map(s => {
      const stat = studentStats[s.id];
      const avg = stat?.count > 0 ? stat.totalGrade / stat.count : 0;
      if (stat?.hasNS || (stat?.count > 0 && avg < 50)) {
        needsSupport.push(s);
      }
      return { student: s, avg };
    });

    studentAvgs.sort((a, b) => b.avg - a.avg);

    return {
      avgGrade: totalEvaluations > 0 ? Math.round(totalGradeSum / totalEvaluations) : 0,
      successRate: totalEvaluations > 0 ? Math.round((satisfiedCount / totalEvaluations) * 100) : 0,
      needsSupport,
      topStudents: studentAvgs.slice(0, 3).map(a => a.student)
    };
  }, [students, activities, deliveries]);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Hidden File Input for mock uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
      />

      {/* ── PRINTING REPORT TEMPLATES (CONDITIONAL FOR PAPER) ── */}
      <div className="hidden print:block print:bg-white print:text-black p-6 w-full">
        
        {/* TEMPLATE 1: RELATÓRIO GERAL DA TURMA */}
        {activeReportType === 'geral' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Ficha Pedagógica de Rendimento Geral</h1>
                <p className="text-xs text-gray-600 mt-1">PE Generator • SENAI Metodologia por Competências (MSEP)</p>
              </div>
              <div className="text-right text-xs font-mono">
                <p className="font-bold">Turma: {selectedPlanDetails?.name}</p>
                <p className="text-gray-600">Módulo/UC: {activeModule?.name}</p>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 border border-gray-300 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-gray-500">Média Geral da Turma</p>
                <p className="text-xl font-bold text-gray-900 mt-1 font-mono">{kpis.avgGrade} pts</p>
              </div>
              <div className="text-center border-x border-gray-300">
                <p className="text-[10px] uppercase font-bold text-gray-500">Taxa de Satisfação</p>
                <p className="text-xl font-bold text-gray-900 mt-1 font-mono">{kpis.successRate}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-gray-500">Suporte Pedagógico</p>
                <p className="text-xl font-bold text-red-600 mt-1 font-mono">{kpis.needsSupport.length} Alunos</p>
              </div>
            </div>

            {/* Tabela de Notas Consolidadas */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-bold text-gray-800">1. Desempenho Geral dos Alunos</h3>
              <table className="w-full text-left text-[11px] border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 w-1/3">Aluno</th>
                    <th className="p-2 border-r border-gray-300 w-24">RA</th>
                    {activities.map(a => (
                      <th key={a.id} className="p-2 border-r border-gray-300 text-center">{a.title.split(':')[0]}</th>
                    ))}
                    <th className="p-2 text-center">Aproveitamento</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const sDels = deliveries.filter(d => d.studentId === s.id);
                    const sSatisfied = sDels.filter(d => d.evaluation === 'S' || d.evaluation === 'D').length;
                    const sTotal = sDels.length;
                    const percent = sTotal > 0 ? Math.round((sSatisfied / sTotal) * 100) : 0;
                    return (
                      <tr key={idx} className="border-b border-gray-300">
                        <td className="p-2 border-r border-gray-300 font-medium text-gray-900">{s.name}</td>
                        <td className="p-2 border-r border-gray-300 font-mono">{s.ra}</td>
                        {activities.map(a => {
                          const del = deliveries.find(d => d.studentId === s.id && d.activityId === a.id);
                          return (
                            <td key={a.id} className="p-2 border-r border-gray-300 text-center font-bold font-mono">
                              {del?.evaluation || '-'} <span className="text-[9px] text-gray-500 font-normal">({del?.grade || 0} pts)</span>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-bold font-mono">{percent}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Assinaturas */}
            <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between text-xs">
              <div>
                <p className="text-gray-500">Docente Responsável</p>
                <div className="mt-8 border-b border-gray-400 w-64" />
                <p className="mt-1 font-bold">Prof. Wellington</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Data de Emissão: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATE 2: BOLETIM INDIVIDUAL DO ALUNO */}
        {activeReportType === 'individual' && (() => {
          const student = students.find(s => s.id === selectedStudentForReport);
          if (!student) return <p className="text-center py-8">Nenhum aluno selecionado.</p>;
          const studentDels = deliveries.filter(d => d.studentId === student.id);
          const studentPlanRows = activeAssessmentPlan?.tableRows || [];
          
          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Ficha Individual de Avaliação Formativa</h1>
                  <p className="text-xs text-gray-600 mt-1">PE Generator • SENAI Acompanhamento de Rendimento Individual</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold">Turma: {selectedPlanDetails?.name}</p>
                  <p className="text-gray-600">Módulo/UC: {activeModule?.name}</p>
                </div>
              </div>

              {/* Identificação Aluno */}
              <div className="grid grid-cols-2 gap-4 border border-gray-300 p-4 bg-gray-50 rounded-lg text-xs">
                <div><strong>Nome do Estudante:</strong> <span className="text-gray-900 font-bold">{student.name}</span></div>
                <div><strong>Registro Acadêmico (RA):</strong> <span className="text-gray-900 font-mono font-bold">{student.ra}</span></div>
              </div>

              {/* Status de Critérios */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-bold text-gray-800">1. Desempenho nos Critérios Pedagógicos (MSEP)</h3>
                <table className="w-full text-left text-[11px] border border-gray-300 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                      <th className="p-2 border-r border-gray-300 w-1/2 font-bold">Capacidade Técnica</th>
                      <th className="p-2 border-r border-gray-300 font-bold">Critério Formulado</th>
                      <th className="p-2 text-center w-24 font-bold">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentPlanRows.map((row: any, idx: number) => {
                      const concept = row.studentEvaluations?.[student.id] || '-';
                      const conceptLabels: Record<string, string> = {
                        'D': 'Destaque',
                        'S': 'Satisfatório',
                        'NS': 'Não Satisfatório'
                      };
                      return (
                        <tr key={idx} className="border-b border-gray-300">
                          <td className="p-2 border-r border-gray-300 font-medium text-gray-900 leading-tight">{row.capability}</td>
                          <td className="p-2 border-r border-gray-300 text-gray-700 leading-tight">{row.criterion}</td>
                          <td className="p-2 text-center font-bold font-mono text-gray-900">{conceptLabels[concept] || 'A avaliar'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Atividades Práticas de Laboratório */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-bold text-gray-800">2. Notas Obtidas nos Desafios Práticos</h3>
                <table className="w-full text-left text-[11px] border border-gray-300 border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                      <th className="p-2 border-r border-gray-300 w-1/2 font-bold">Título da Atividade Prática</th>
                      <th className="p-2 border-r border-gray-300 text-center w-32 font-bold">Conceito</th>
                      <th className="p-2 text-center w-28 font-bold">Nota Obtida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a, idx) => {
                      const del = studentDels.find(d => d.activityId === a.id);
                      return (
                        <tr key={idx} className="border-b border-gray-300">
                          <td className="p-2 border-r border-gray-300 font-medium text-gray-900">{a.title}</td>
                          <td className="p-2 border-r border-gray-300 text-center">{del?.evaluation === 'D' ? 'Destaque' : del?.evaluation === 'S' ? 'Satisfatório' : del?.evaluation === 'NS' ? 'Não Sat.' : '-'}</td>
                          <td className="p-2 text-center font-bold font-mono">{del?.grade || 0} / 100 pts</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Parecer Descritivo e Assinaturas */}
              <div className="border border-gray-300 p-4 rounded-lg space-y-3">
                <p className="text-xs font-bold uppercase text-gray-700">3. Parecer Descritivo Pedagógico</p>
                <div className="h-20 border-b border-dashed border-gray-400 w-full" />
              </div>

              <div className="mt-12 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs">
                <div>
                  <p className="text-gray-500">Assinatura do Docente</p>
                  <div className="mt-8 border-b border-gray-400 w-full" />
                  <p className="mt-1 font-bold">Prof. Wellington</p>
                </div>
                <div>
                  <p className="text-gray-500">Assinatura do Estudante</p>
                  <div className="mt-8 border-b border-gray-400 w-full" />
                  <p className="mt-1 font-bold">{student.name}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TEMPLATE 3: DOSSIÊ DE EVIDÊNCIAS DIGITAL */}
        {activeReportType === 'dossie' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Dossiê Digital de Evidências Técnicas</h1>
                <p className="text-xs text-gray-600 mt-1">PE Generator • SENAI Registro de Entregáveis e Arquivos Operacionais</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Turma: {selectedPlanDetails?.name}</p>
                <p className="text-gray-600">Módulo/UC: {activeModule?.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-800">1. Lista de Evidências e Arquivos por Estudante</h3>
              <table className="w-full text-left text-[10px] border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 w-1/4 font-bold">Aluno</th>
                    <th className="p-2 border-r border-gray-300 w-24 font-bold">RA</th>
                    {activities.map(a => (
                      <th key={a.id} className="p-2 border-r border-gray-300 text-center w-48 font-bold">{a.title.split(':')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="p-2 border-r border-gray-300 font-medium text-gray-900">{s.name}</td>
                      <td className="p-2 border-r border-gray-300 font-mono">{s.ra}</td>
                      {activities.map(a => {
                        const del = deliveries.find(d => d.studentId === s.id && d.activityId === a.id);
                        return (
                          <td key={a.id} className="p-2 border-r border-gray-300 align-middle">
                            {del?.fileName ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-gray-800 truncate" title={del.fileName}>{del.fileName}</p>
                                <p className="text-[8px] text-gray-500 font-mono">Status: Entregue ({del.grade} pts)</p>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Nenhum anexo</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between text-xs">
              <div>
                <p className="text-gray-500">Assinatura da Supervisão Pedagógica</p>
                <div className="mt-8 border-b border-gray-400 w-64" />
              </div>
              <div className="text-right">
                <p className="text-gray-500">Data de Geração: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATE 4: REGISTRO DE CRITÉRIOS INTEGRADOS */}
        {activeReportType === 'criterios' && activeAssessmentPlan && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Registro de Critérios de Avaliação MSEP</h1>
                <p className="text-xs text-gray-600 mt-1">PE Generator • SENAI Relatório de Avaliação por Capacidade</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Turma: {selectedPlanDetails?.name}</p>
                <p className="text-gray-600">Módulo/UC: {activeModule?.name}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs uppercase font-bold text-gray-800">1. Matriz de Avaliação Formativa de Critérios</h3>
              <table className="w-full text-left text-[10px] border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 w-1/4 font-bold">Capacidade Pedagógica</th>
                    <th className="p-2 border-r border-gray-300 w-1/3 font-bold">Critério de Desempenho</th>
                    {students.map(s => (
                      <th key={s.id} className="p-2 border-r border-gray-300 text-center font-bold text-[9px] truncate max-w-[60px]" title={s.name}>
                        {s.name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeAssessmentPlan.tableRows.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="border-b border-gray-300">
                      <td className="p-2 border-r border-gray-300 font-medium text-gray-900 leading-tight">{row.capability}</td>
                      <td className="p-2 border-r border-gray-300 text-gray-700 leading-tight">{row.criterion}</td>
                      {students.map(s => {
                        const val = row.studentEvaluations?.[s.id] || '-';
                        return (
                          <td key={s.id} className="p-2 border-r border-gray-300 text-center font-bold font-mono text-gray-800">
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legendas */}
            <div className="border border-gray-300 p-3 rounded-lg text-[9px] font-mono space-y-1 bg-gray-50">
              <p className="font-bold text-gray-800">Legenda de Conceitos da Metodologia MSEP:</p>
              <p><strong>D</strong>: Destaque (Aproveitamento superior a 85% e domínio autônomo da capacidade)</p>
              <p><strong>S</strong>: Satisfatório (Aproveitamento de 50% a 84% com domínio básico da capacidade)</p>
              <p><strong>NS</strong>: Não Satisfatório (Aproveitamento inferior a 50%, necessitando suporte pedagógico)</p>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between text-xs">
              <div>
                <p className="text-gray-500">Docente Responsável</p>
                <div className="mt-8 border-b border-gray-400 w-64" />
                <p className="mt-1 font-bold">Prof. Wellington</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500">Data: ____/____/_______</p>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATE 5: PLANO DE ENSINO COMPLETO */}
        {activeReportType === 'plano' && activeAssessmentPlan && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b-2 border-gray-800 pb-3">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Plano de Ensino por Competências (MSEP)</h1>
                <p className="text-xs text-gray-600 mt-1 font-medium">SENAI • Educação Profissional • {activeAssessmentPlan.schoolName}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Curso: {activeAssessmentPlan.courseName}</p>
                <p className="text-gray-600">Semestre: {activeAssessmentPlan.semester}</p>
              </div>
            </div>

            {/* Identificação */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-bold text-gray-800">1. Identificação da Unidade Curricular</h3>
              <table className="w-full text-xs border border-gray-300 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-2 bg-gray-50 font-bold w-1/4">Unidade Curricular:</td>
                    <td className="p-2 w-1/4">{activeAssessmentPlan.unitName}</td>
                    <td className="p-2 bg-gray-50 font-bold w-1/4">Semestre:</td>
                    <td className="p-2 w-1/4">{activeAssessmentPlan.semester}</td>
                  </tr>
                  <tr>
                    <td className="p-2 bg-gray-50 font-bold w-1/4">Docente:</td>
                    <td className="p-2 w-1/4">Prof. Wellington</td>
                    <td className="p-2 bg-gray-50 font-bold w-1/4">Eixo Temático:</td>
                    <td className="p-2 w-1/4">{activeAssessmentPlan.subjectName || activeAssessmentPlan.unitName}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fundamentos e Conhecimentos */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-bold text-gray-800">2. Capacidades Técnicas</h3>
                <ul className="text-xs space-y-1 list-disc list-inside text-gray-700">
                  {activeAssessmentPlan.capabilities.map((c: string, idx: number) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-bold text-gray-800">3. Conhecimentos</h3>
                <ul className="text-xs space-y-1 list-disc list-inside text-gray-700">
                  {activeAssessmentPlan.knowledgeList.map((k: string, idx: number) => (
                    <li key={idx}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Situação de Aprendizagem */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-bold text-gray-800">4. Situação de Aprendizagem</h3>
              <div className="text-xs text-gray-700 border border-gray-300 p-3 bg-gray-50 rounded leading-relaxed">
                {activeAssessmentPlan.learningContext}
              </div>
            </div>

            {/* Tabela de Critérios */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-bold text-gray-800">5. Tabela de Avaliação Formativa & Critérios</h3>
              <table className="w-full text-[10px] border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 w-1/3">Capacidade Avaliada</th>
                    <th className="p-2 border-r border-gray-300 w-1/3">Critério de Desempenho</th>
                    {students.map(s => (
                      <th key={s.id} className="p-2 border-r border-gray-300 text-center font-bold text-[9px] truncate max-w-[50px]">{s.name.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeAssessmentPlan.tableRows.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="border-b border-gray-300">
                      <td className="p-2 border-r border-gray-300 font-medium text-gray-900 leading-tight">{row.capability}</td>
                      <td className="p-2 border-r border-gray-300 text-gray-700 leading-tight">{row.criterion}</td>
                      {students.map(s => (
                        <td key={s.id} className="p-2 border-r border-gray-300 text-center font-bold font-mono">{row.studentEvaluations?.[s.id] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rubricas */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase font-bold text-gray-800">6. Níveis de Desempenho (Rubricas)</h3>
              <table className="w-full text-[10px] border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 w-12 text-center">Nível</th>
                    <th className="p-2 border-r border-gray-300">Critérios Atingidos</th>
                    <th className="p-2 border-r border-gray-300 w-32 font-bold">Classificação</th>
                    <th className="p-2 w-16 text-center font-bold">Nota Final</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssessmentPlan.rubricLevels?.map((level: any, lIdx: number) => (
                    <tr key={lIdx} className="border-b border-gray-300">
                      <td className="p-2 border-r border-gray-300 text-center font-bold">{level.nivel}</td>
                      <td className="p-2 border-r border-gray-300 text-gray-700">{level.description}</td>
                      <td className="p-2 border-r border-gray-300 font-bold">{level.type}</td>
                      <td className="p-2 text-center font-bold font-mono">{level.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Assinaturas */}
            <div className="mt-12 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs">
              <div>
                <p className="text-gray-500">Docente Responsável</p>
                <div className="mt-8 border-b border-gray-400 w-full" />
                <p className="mt-1 font-bold">Prof. Wellington</p>
              </div>
              <div>
                <p className="text-gray-500">Aprovação da Coordenação Pedagógica</p>
                <div className="mt-8 border-b border-gray-400 w-full" />
                <p className="mt-1 font-bold">Data: ____/____/_______</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SCREEN HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-industrial-800 p-6 rounded-2xl border border-industrial-700 shadow-xl print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Award className="text-primary animate-pulse" />
            Painel de Atividades & Lançamentos
          </h1>
          <p className="text-slate-400 mt-1">Elaboração de avaliações guiadas por IA, portfólio de entregas e KPIs de desempenho</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase">Turma:</span>
            <select 
              value={selectedClassId} 
              onChange={e => setSelectedClassId(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-primary transition-all cursor-pointer"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedPlanDetails && selectedPlanDetails.modules.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">UC:</span>
              <select 
                value={selectedModuleIndex} 
                onChange={e => setSelectedModuleIndex(Number(e.target.value))}
                className="bg-industrial-900 border border-industrial-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-primary transition-all cursor-pointer max-w-[180px] sm:max-w-xs"
              >
                {selectedPlanDetails.modules.map((m, idx) => (
                  <option key={idx} value={idx}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── TAB NAVIGATION & SAVE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-industrial-700 pb-3 print:hidden">
        <div className="flex flex-wrap bg-industrial-950 p-1 rounded-xl border border-industrial-700 self-start gap-1">
          {[
            { id: 'atividades', label: 'Atividades por IA', icon: <Sparkles size={13} /> },
            { id: 'lancamentos', label: 'Resultados & Entregas', icon: <ClipboardList size={13} /> },
            { id: 'kpis', label: 'KPIs & Suporte', icon: <TrendingUp size={13} /> },
            { id: 'relatorios', label: 'Impressão & Relatórios', icon: <Printer size={13} /> },
            { id: 'plano', label: 'Plano de Ensino', icon: <BookOpen size={13} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activities.length > 0 && (
          <button
            onClick={handleSaveEvaluation}
            disabled={saving}
            className="px-5 py-2 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md self-end sm:self-auto cursor-pointer"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        )}
      </div>

      {/* ── TAB CONTENT: 1. ATIVIDADES ── */}
      {activeTab === 'atividades' && (
        <div className="space-y-6 print:hidden">
          {/* Header card with action */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="text-primary" size={16} />
                Gerador de Atividades Formativas por IA
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                O Sentry AI analisará os critérios de desempenho da Unidade Curricular <span className="text-primary font-semibold">{activeModule?.name}</span> para criar desafios práticos alinhados com o mercado de trabalho.
              </p>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex-1 md:flex-initial px-4 py-3 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700 text-slate-300 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} /> Atividade Manual
              </button>
              <button
                onClick={handleAIGenerateActivities}
                disabled={generating || !activeModule}
                className="flex-1 md:flex-initial px-5 py-3 bg-gradient-to-r from-primary to-accent hover:from-blue-600 hover:to-emerald-600 disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                {generating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Elaborando Atividades...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Gerar Atividades com IA
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Form for manual addition */}
          {showAddForm && (
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 space-y-4 shadow-xl">
              <h4 className="text-sm font-bold text-white uppercase border-b border-industrial-700 pb-2 flex items-center gap-1.5"><Plus size={16} /> Adicionar Atividade Avaliativa</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Título da Atividade *</label>
                  <input 
                    type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    placeholder="Ex: Prática 03: Montagem de Placa de Circuito"
                    className="w-full bg-industrial-900 border border-industrial-700 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Recursos Necessários</label>
                  <input 
                    type="text" value={newRes} onChange={e => setNewRes(e.target.value)}
                    placeholder="Ex: Soldador, Estação de Retrabalho, PCB de testes"
                    className="w-full bg-industrial-900 border border-industrial-700 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Descrição do Desafio Prático</label>
                  <textarea 
                    value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                    placeholder="Descreva detalhadamente o passo a passo que o aluno deve realizar..."
                    className="w-full bg-industrial-900 border border-industrial-700 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none resize-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Evidência de Entrega / Resultado Esperado</label>
                  <input 
                    type="text" value={newResult} onChange={e => setNewResult(e.target.value)}
                    placeholder="Ex: Circuito operando e acendendo LEDs em sequência sem falhas operacionais"
                    className="w-full bg-industrial-900 border border-industrial-700 rounded-xl px-3 py-2 text-sm text-white focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-industrial-900 hover:bg-industrial-750 text-slate-400 rounded-xl text-xs font-semibold">
                  Cancelar
                </button>
                <button onClick={handleAddManualActivity} className="px-5 py-2 bg-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold">
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {/* Activities list */}
          {activities.length === 0 ? (
            <div className="bg-industrial-800 p-20 rounded-2xl text-center border border-industrial-700 shadow-lg">
              <Award size={48} className="mx-auto text-industrial-600 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Nenhuma Atividade Definida</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Clique no botão acima para sugerir atividades estruturadas e contextualizadas por IA, perfeitamente calibradas com os critérios da MSEP.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activities.map((act, index) => (
                <div 
                  key={act.id} 
                  className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 relative flex flex-col justify-between hover:border-industrial-600 transition-all duration-300 shadow-xl group"
                >
                  <button 
                    onClick={() => handleDeleteActivity(act.id)}
                    className="absolute top-4 right-4 p-1.5 bg-industrial-900 hover:bg-red-500/10 border border-industrial-700 hover:border-red-500/20 text-slate-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    title="Excluir Atividade"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h4 className="font-bold text-white text-sm pr-6 leading-tight">{act.title}</h4>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-industrial-750 text-xs text-slate-300">
                      <p className="leading-relaxed"><strong className="text-slate-500 uppercase font-mono text-[9px] block mb-0.5">Descrição:</strong> {act.description}</p>
                      <p className="leading-relaxed"><strong className="text-slate-500 uppercase font-mono text-[9px] block mb-0.5">Recursos e Ferramentas:</strong> {act.resources}</p>
                      <p className="leading-relaxed"><strong className="text-slate-500 uppercase font-mono text-[9px] block mb-0.5">Entrega Esperada:</strong> {act.expectedResult}</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-industrial-750 flex justify-between items-center text-[10px] font-mono text-slate-500">
                    <span>Peso de Nota: <strong>{act.weight}%</strong></span>
                    <span className="bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded uppercase font-bold">Avaliação Formativa</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: 2. LANÇAMENTO DE RESULTADOS ── */}
      {activeTab === 'lancamentos' && (
        <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 overflow-hidden shadow-xl print:hidden space-y-4">
          <div className="flex justify-between items-center border-b border-industrial-700 pb-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList className="text-primary" size={18} />
              Grade de Avaliação de Atividades por Aluno
            </h3>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono">
              Atividades: {activities.length} | Alunos: {students.length}
            </span>
          </div>

          {loadingStudents ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-xs text-slate-400">Carregando alunos e notas...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Gere ou adicione atividades primeiro na primeira aba para habilitar o lançamento de notas.
            </div>
          ) : (
            <div className="overflow-x-auto border border-industrial-700 rounded-xl">
              <table className="w-full text-left text-xs min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-industrial-900 border-b border-industrial-700 text-slate-400">
                    <th className="p-3.5 border-r border-industrial-700 w-56 min-w-[180px]">Aluno</th>
                    <th className="p-3.5 border-r border-industrial-700 w-32 font-mono">Registro (RA)</th>
                    {activities.map(act => (
                      <th key={act.id} className="p-3.5 border-r border-industrial-700 text-center w-64 min-w-[220px]" title={act.description}>
                        <div className="truncate font-semibold text-white">{act.title.split(':')[0]}</div>
                        <div className="text-[9px] text-slate-500 font-normal truncate mt-0.5">{act.title.split(':')[1] || act.title}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-700">
                  {students.map((student) => (
                    <tr key={student.id} className="bg-industrial-800 hover:bg-industrial-750 transition-colors">
                      <td className="p-3 border-r border-industrial-700 font-medium text-white">{student.name}</td>
                      <td className="p-3 border-r border-industrial-700 font-mono text-slate-400">{student.ra}</td>
                      {activities.map(act => {
                        const del = deliveries.find(d => d.studentId === student.id && d.activityId === act.id) || {
                          studentId: student.id,
                          activityId: act.id,
                          grade: 0,
                          evaluation: '' as const,
                          fileName: '',
                          fileUrl: ''
                        };

                        return (
                          <td key={act.id} className="p-3 border-r border-industrial-700 align-middle">
                            <div className="flex flex-col gap-2">
                              {/* Inputs: Grade & Evaluation Dropdown */}
                              <div className="flex gap-1">
                                <input 
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={del.grade || ''}
                                  onChange={e => handleDeliveryChange(student.id, act.id, 'grade', e.target.value)}
                                  placeholder="Nota"
                                  className="w-16 bg-industrial-900 border border-industrial-700 text-white text-center text-xs rounded p-1 font-mono focus:border-primary outline-none"
                                />
                                <select
                                  value={del.evaluation || ''}
                                  onChange={e => handleDeliveryChange(student.id, act.id, 'evaluation', e.target.value)}
                                  className="flex-1 bg-industrial-900 border border-industrial-700 text-white text-xs rounded p-1 focus:border-primary outline-none cursor-pointer"
                                >
                                  <option value="">A avaliar</option>
                                  <option value="S">Satisfatório</option>
                                  <option value="NS">Não Sat.</option>
                                  <option value="D">Destaque</option>
                                </select>
                              </div>

                              {/* Upload Attachment Widget */}
                              <div className="flex items-center justify-between gap-1.5 p-1.5 bg-industrial-950/40 border border-industrial-700/60 rounded">
                                {del.fileName ? (
                                  <div className="flex items-center gap-1 min-w-0">
                                    {del.fileUrl === 'document_icon' ? <FileText size={11} className="text-slate-400 shrink-0" /> : <Image size={11} className="text-primary shrink-0" />}
                                    <span className="text-[9px] text-slate-300 truncate" title={del.fileName}>{del.fileName}</span>
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-500 italic">Nenhum arquivo enviado</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => triggerFileUpload(student.id, act.id)}
                                  className="p-1 hover:bg-industrial-700 text-slate-400 hover:text-white rounded transition-colors shrink-0"
                                  title="Enviar evidência de entrega (Imagem/Arquivo)"
                                >
                                  <Upload size={10} />
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: 3. KPIS & SUPORTE ── */}
      {activeTab === 'kpis' && (
        <div className="space-y-6 print:hidden">
          {/* KPI Mini-Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-mono">Nota Média Geral</span>
                <span className="text-3xl font-extrabold text-white block font-mono">{kpis.avgGrade} <span className="text-xs text-slate-500 font-normal">/ 100</span></span>
              </div>
              <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-mono">Taxa de Satisfação</span>
                <span className="text-3xl font-extrabold text-white block font-mono">{kpis.successRate}%</span>
              </div>
              <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent">
                <Percent size={24} />
              </div>
            </div>

            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-mono">Foco de Suporte</span>
                <span className="text-3xl font-extrabold text-red-400 block font-mono">{kpis.needsSupport.length} <span className="text-xs text-slate-500 font-normal">Alunos</span></span>
              </div>
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-400">
                <AlertCircle size={24} />
              </div>
            </div>
          </div>

          {/* Detailed Lists (Needs Support & Top Performers) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Needs Support */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-red-400 border-b border-industrial-700 pb-2 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle size={16} />
                Alunos com Desempenho Crítico ou Pendente
              </h4>
              
              {kpis.needsSupport.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Nenhum aluno identificado necessitando de suporte no momento.</p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {kpis.needsSupport.map((student) => (
                    <div key={student.id} className="flex justify-between items-center bg-industrial-900/60 p-3.5 rounded-xl border border-red-500/10 hover:border-red-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{student.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">RA: {student.ra}</p>
                        </div>
                      </div>
                      
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full uppercase">
                        Necessita Apoio
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Students */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-amber-400 border-b border-industrial-700 pb-2 uppercase tracking-widest flex items-center gap-2">
                <Award size={16} />
                Líderes de Competência (Destaque do Módulo)
              </h4>

              {kpis.topStudents.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">Aguardando lançamentos de avaliações.</p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {kpis.topStudents.map((student, idx) => (
                    <div key={student.id} className="flex justify-between items-center bg-industrial-900/60 p-3.5 rounded-xl border border-amber-500/10 hover:border-amber-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold font-mono">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{student.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">RA: {student.ra}</p>
                        </div>
                      </div>

                      <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full uppercase">
                        Excelência
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT: 4. RELATÓRIOS ── */}
      {activeTab === 'relatorios' && (
        <div className="space-y-6 print:hidden animate-in fade-in duration-300">
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Printer className="text-primary" size={18} />
              Central de Emissão de Relatórios & Documentação
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Selecione o formato de documentação que deseja gerar. Todos os relatórios são otimizados dinamicamente para exportação em PDF e folhas de impressão A4.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Opção 1: Ficha Geral da Turma */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 hover:border-industrial-600 transition-all flex flex-col justify-between shadow-xl space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary"><TrendingUp size={20} /></div>
                <h4 className="font-bold text-white text-sm">Ficha Pedagógica de Rendimento Geral</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Documento consolidado contendo as estatísticas gerais de notas da classe, percentuais de aproveitamento e listagem de alunos que necessitam de suporte para coordenação.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveReportType('geral');
                  setTimeout(() => window.print(), 150);
                }}
                disabled={activities.length === 0}
                className="w-full py-2.5 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700 hover:text-white text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Gerar Relatório Geral
              </button>
            </div>

            {/* Opção 2: Boletim Formativo Individual */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 hover:border-industrial-600 transition-all flex flex-col justify-between shadow-xl space-y-4">
              <div className="space-y-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400"><Award size={20} /></div>
                <h4 className="font-bold text-white text-sm">Boletim Individual de Avaliação Formativa</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ficha acadêmica individualizada do estudante contendo os conceitos atingidos em cada capacidade avaliada, médias das práticas e campo para parecer.
                </p>
                <div className="space-y-1">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Selecione o Aluno *</label>
                  <select
                    value={selectedStudentForReport}
                    onChange={e => setSelectedStudentForReport(e.target.value)}
                    className="w-full bg-industrial-900 border border-industrial-700 text-white text-xs rounded-lg p-2 outline-none cursor-pointer focus:border-primary"
                  >
                    <option value="">-- Escolha o aluno --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} (RA: {s.ra})</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!selectedStudentForReport) {
                    alert("Selecione um aluno na lista acima para gerar o boletim individual.");
                    return;
                  }
                  setActiveReportType('individual');
                  setTimeout(() => window.print(), 150);
                }}
                disabled={activities.length === 0 || !selectedStudentForReport}
                className="w-full py-2.5 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Gerar Ficha Individual
              </button>
            </div>

            {/* Opção 3: Dossiê Digital de Evidências */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 hover:border-industrial-600 transition-all flex flex-col justify-between shadow-xl space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400"><Upload size={20} /></div>
                <h4 className="font-bold text-white text-sm">Dossiê Digital de Evidências</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Documentação visual que lista os arquivos operacionais, fotos e relatórios anexados pelos estudantes como comprovação física das capacidades desenvolvidas.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveReportType('dossie');
                  setTimeout(() => window.print(), 150);
                }}
                disabled={activities.length === 0}
                className="w-full py-2.5 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700 hover:text-white text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Gerar Dossiê de Evidências
              </button>
            </div>

            {/* Opção 4: Registro de Critérios Integrado */}
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 hover:border-industrial-600 transition-all flex flex-col justify-between shadow-xl space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400"><ClipboardList size={20} /></div>
                <h4 className="font-bold text-white text-sm">Registro de Critérios MSEP Integrado</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Matriz oficial do Plano de Ensino vinculando cada capacidade e critério pedagógico com o conceito atingido por todos os alunos da turma.
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveReportType('criterios');
                  setTimeout(() => window.print(), 150);
                }}
                disabled={!activeAssessmentPlan}
                className="w-full py-2.5 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700 hover:text-white text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Gerar Registro de Critérios
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── TAB CONTENT: 5. PLANO DE ENSINO ── */}
      {activeTab === 'plano' && (
        <div className="space-y-6 print:hidden animate-in fade-in duration-300">
          {loadingPlan ? (
            <div className="bg-industrial-800 p-20 border border-industrial-700 rounded-2xl text-center shadow-xl">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-slate-400 text-xs font-mono">Buscando Plano de Ensino da Unidade Curricular...</p>
            </div>
          ) : !activeAssessmentPlan ? (
            <div className="bg-industrial-800 p-16 border border-industrial-700 rounded-2xl text-center shadow-xl space-y-4">
              <AlertCircle size={48} className="mx-auto text-amber-500 animate-pulse" />
              <h3 className="text-base font-bold text-white uppercase">Plano de Ensino Não Localizado</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                Não encontramos um plano de ensino estruturado para o módulo <strong className="text-primary">{activeModule?.name}</strong> no banco de dados. 
                Crie o plano na tela de <strong>Unidades Curriculares</strong> primeiro para que possamos sincronizar os critérios de avaliação com os alunos.
              </p>
            </div>
          ) : (
            <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 relative overflow-hidden space-y-6 shadow-xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
              
              {/* Plano Top Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-industrial-700 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="text-primary" size={18} />
                    Plano de Ensino & Avaliação Formativa
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Metodologia por Competências (MSEP) • {activeAssessmentPlan.schoolName}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleSyncActivitiesToCriteria}
                    disabled={saving}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 hover:border-primary text-primary hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles size={13} />
                    Sincronizar Notas
                  </button>
                  <button
                    onClick={() => {
                      setActiveReportType('plano');
                      setTimeout(() => window.print(), 150);
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2 bg-industrial-900 border border-industrial-700 hover:bg-industrial-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer size={13} />
                    Imprimir Plano
                  </button>
                </div>
              </div>

              {/* Detalhes do Plano */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-industrial-950/40 p-4 rounded-xl border border-industrial-750 font-mono">
                <div><span className="text-slate-500 uppercase font-bold text-[9px] block">Escola:</span> <span className="text-white font-medium">{activeAssessmentPlan.schoolName}</span></div>
                <div><span className="text-slate-500 uppercase font-bold text-[9px] block">Curso:</span> <span className="text-white font-medium">{activeAssessmentPlan.courseName}</span></div>
                <div><span className="text-slate-500 uppercase font-bold text-[9px] block">Semestre:</span> <span className="text-white font-medium">{activeAssessmentPlan.semester}</span></div>
                <div><span className="text-slate-500 uppercase font-bold text-[9px] block">Unidade Curricular:</span> <span className="text-white font-medium">{activeAssessmentPlan.unitName}</span></div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold text-amber-400 tracking-wider font-mono">4. Situação de Aprendizagem Contextualizada</h4>
                <p className="text-slate-300 text-xs leading-relaxed bg-industrial-900/60 p-4 rounded-xl border border-industrial-700/50">
                  {activeAssessmentPlan.learningContext}
                </p>
              </div>

              {/* Tabela de Critérios */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold text-primary tracking-wider font-mono">5. Tabela de Avaliação Formativa & Critérios</h4>
                <div className="overflow-x-auto border border-industrial-700 rounded-xl">
                  <table className="w-full text-left text-xs min-w-[700px] border-collapse">
                    <thead>
                      <tr className="bg-industrial-900 border-b border-industrial-700 text-slate-400">
                        <th className="p-3 border-r border-industrial-700 w-1/3">Capacidade a ser Avaliada</th>
                        <th className="p-3 border-r border-industrial-700 w-1/3">Critério de Avaliação (MSEP)</th>
                        {students.map(s => (
                          <th key={s.id} className="p-3 border-r border-industrial-700 text-center text-[10px] truncate max-w-[80px] font-mono" title={s.name}>
                            {s.name.split(' ')[0]} <br />
                            <span className="text-[8px] text-slate-500 font-normal">RA: {s.ra}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-700">
                      {activeAssessmentPlan.tableRows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="bg-industrial-800 hover:bg-industrial-750 transition-colors">
                          <td className="p-3 border-r border-industrial-700 font-medium text-white">{row.capability}</td>
                          <td className="p-3 border-r border-industrial-700 text-slate-300">{row.criterion}</td>
                          {students.map(s => {
                            const evalVal = row.studentEvaluations?.[s.id] || '';
                            const colorMap: Record<string, string> = {
                              'D': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                              'S': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                              'NS': 'text-red-400 bg-red-500/10 border-red-500/20'
                            };
                            return (
                              <td key={s.id} className="p-3 border-r border-industrial-700 text-center font-bold font-mono">
                                <span className={`px-2 py-0.5 rounded text-[10px] border ${evalVal ? colorMap[evalVal] : 'text-slate-600 bg-transparent border-transparent'}`}>
                                  {evalVal || '-'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Níveis de Desempenho */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase font-bold text-indigo-400 tracking-wider font-mono">6. Níveis de Desempenho (Rubricas)</h4>
                <div className="overflow-x-auto border border-industrial-700 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-industrial-900 border-b border-industrial-700 text-slate-400 font-mono">
                        <th className="p-3 border-r border-industrial-700 w-16 text-center">Nível</th>
                        <th className="p-3 border-r border-industrial-700 font-sans text-left">Critérios Atingidos (Descrição do Nível)</th>
                        <th className="p-3 border-r border-industrial-700 w-36 font-sans text-left">Classificação</th>
                        <th className="p-3 w-20 text-center">Nota Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-700 font-mono">
                      {activeAssessmentPlan.rubricLevels?.map((level: any, lIdx: number) => (
                        <tr key={lIdx} className="bg-industrial-800/40 hover:bg-industrial-800 transition-colors">
                          <td className="p-3 border-r border-industrial-700 text-center font-bold">{level.nivel}</td>
                          <td className="p-3 border-r border-industrial-700 font-sans text-slate-300">{level.description}</td>
                          <td className="p-3 border-r border-industrial-700 font-sans text-white font-bold">{level.type}</td>
                          <td className="p-3 text-center text-primary font-bold">{level.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
