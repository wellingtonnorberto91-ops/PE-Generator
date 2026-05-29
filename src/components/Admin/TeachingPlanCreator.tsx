import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { generateCriteriaWithMethodology } from '../../features/ai-core/gemini';
import { Dropzone } from '../ui/Dropzone';
import { X, Sparkles, Save, Loader2, Plus, Trash2 } from 'lucide-react';

interface Module {
  name: string;
  hours: number;
  objective?: string;
  technicalCapabilities?: string[];
  socioemotionalCapabilities?: string[];
  knowledge?: string[];
}

interface Student {
  id: string;
  name: string;
  ra: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  module: Module;
  courseName: string;
  planId: string;
}

interface TableRow {
  capability: string;
  criterion: string;
  studentEvaluations: Record<string, string>; // studentId -> evaluation value
}

const default12Levels = [
  { nivel: 12, description: 'Alcançou todos os critérios críticos (18) e 17 desejáveis', type: 'Excelência', grade: 100 },
  { nivel: 11, description: 'Alcançou todos os critérios críticos (18) e 15 desejáveis', type: 'Excelência', grade: 92 },
  { nivel: 10, description: 'Alcançou todos os critérios críticos (18) e 13 desejáveis', type: 'Excelência', grade: 84 },
  { nivel: 9, description: 'Alcançou todos os critérios críticos (18) e 10 desejáveis', type: 'Destaque', grade: 76 },
  { nivel: 8, description: 'Alcançou todos os critérios críticos (18) e 8 desejáveis', type: 'Destaque', grade: 68 },
  { nivel: 7, description: 'Alcançou todos os critérios críticos (18) e 5 desejáveis', type: 'Satisfatório', grade: 60 },
  { nivel: 6, description: 'Alcançou todos os critérios críticos (18) e 2 desejáveis', type: 'Satisfatório', grade: 52 },
  { nivel: 5, description: 'Alcançou todos os critérios críticos (18)', type: 'Satisfatório', grade: 50 },
  { nivel: 4, description: 'Alcançou 15 critérios críticos', type: 'Em Desenvolvimento', grade: 40 },
  { nivel: 3, description: 'Alcançou 10 critérios críticos', type: 'Em Desenvolvimento', grade: 30 },
  { nivel: 2, description: 'Alcançou 5 critérios críticos', type: 'Insatisfatório', grade: 20 },
  { nivel: 1, description: 'Alcançou 1 critério crítico', type: 'Insatisfatório', grade: 10 },
];

export function TeachingPlanCreator({ isOpen, onClose, module, courseName, planId }: Props) {
  const [schoolName, setSchoolName] = useState('Escola Técnica Sentry');
  const [unitName, setUnitName] = useState(module.name);
  const [semester, setSemester] = useState('1º Semestre');
  const [learningContext, setLearningContext] = useState(module.objective || 'Situação de aprendizagem contextualizada na prática industrial.');
  
  const [capabilities, setCapabilities] = useState<string[]>(module.technicalCapabilities || []);
  const [knowledgeList, setKnowledgeList] = useState<string[]>(module.knowledge || []);
  const [newCap, setNewCap] = useState('');
  const [newKnow, setNewKnow] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Estados para metodologias salvas no banco
  const [methodologySource, setMethodologySource] = useState<'upload' | 'database'>('upload');
  const [existingPlans, setExistingPlans] = useState<Array<{ id: string; type: 'assessment' | 'plan'; label: string; text: string }>>([]);
  const [selectedExistingPlanId, setSelectedExistingPlanId] = useState<string>('');
  const [loadingExistingPlans, setLoadingExistingPlans] = useState(false);

  // Estados para Rubricas e Níveis de Desempenho Dinâmicos
  const [rubricName, setRubricName] = useState('Rubrica Padrão SENAI');
  const [subjectName, setSubjectName] = useState(() => {
    if (!module.name) return '';
    const nameUpper = module.name.toUpperCase();
    if (nameUpper.includes('DESENHO') || nameUpper.includes('CAD') || nameUpper.includes('MODELAGEM')) {
      return 'Desenho Técnico';
    } else if (nameUpper.includes('FABRICAÇÃO') || nameUpper.includes('MECÂNICA') || nameUpper.includes('MATERIAIS') || nameUpper.includes('METAL') || nameUpper.includes('PROCESSO')) {
      return 'Processos de Fabricação';
    } else if (nameUpper.includes('LÓGICA') || nameUpper.includes('PROGRAMAÇÃO') || nameUpper.includes('WEB') || nameUpper.includes('INFORMÁTICA')) {
      return 'Tecnologia da Informação';
    }
    return module.name;
  });
  const [rubricLevels, setRubricLevels] = useState<Array<{ nivel: number; description: string; type: string; grade: number }>>(default12Levels);
  const [reusableRubrics, setReusableRubrics] = useState<Array<{ id: string; name: string; subject: string; levels: Array<{ nivel: number; description: string; type: string; grade: number }> }>>([]);
  const [selectedReusableRubricId, setSelectedReusableRubricId] = useState('');
  const [savingRubric, setSavingRubric] = useState(false);

  // Fetch students of this class
  useEffect(() => {
    if (!isOpen || !planId) return;
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const q = query(collection(db, 'students'), where('classId', '==', planId));
        const snap = await getDocs(q);
        const list: Student[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Student);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(list);

        // Initialize table rows with capabilities from course plan
        const rows: TableRow[] = (module.technicalCapabilities || []).map(cap => ({
          capability: cap,
          criterion: 'Aguardando geração com IA...',
          studentEvaluations: list.reduce((acc, s) => {
            acc[s.id] = ''; // empty initial evaluation
            return acc;
          }, {} as Record<string, string>)
        }));
        setTableRows(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [isOpen, planId, module]);

  // Buscar metodologias e planos pré-existentes
  useEffect(() => {
    if (!isOpen) return;
    const fetchExistingPlans = async () => {
      setLoadingExistingPlans(true);
      try {
        const plansList: Array<{ id: string; type: 'assessment' | 'plan'; label: string; text: string }> = [];

        // 1. Buscar da coleção assessments_formativa
        const assessmentsSnap = await getDocs(collection(db, 'assessments_formativa'));
        assessmentsSnap.forEach(d => {
          const data = d.data();
          const rows = data.tableRows || [];
          const criteriaText = rows.map((r: { capability: string; criterion: string }) => `- ${r.capability}: ${r.criterion}`).join('\n');
          if (criteriaText.trim()) {
            plansList.push({
              id: d.id,
              type: 'assessment',
              label: `${data.schoolName || 'Escola'} - ${data.courseName || 'Curso'} (${data.unitName || 'UC'}) [Anterior]`,
              text: `Critérios e Capacidades Utilizados:\n${criteriaText}`
            });
          }
        });

        // 2. Buscar da coleção teaching_plans
        const teachingPlansSnap = await getDocs(collection(db, 'teaching_plans'));
        teachingPlansSnap.forEach(d => {
          const data = d.data();
          let msepText = '';
          if (data.msep) {
            const m = data.msep;
            msepText = [
              m.objetivoGeral ? `Objetivo Geral: ${m.objetivoGeral}` : '',
              m.situacoesAprendizagem ? `Situações de Aprendizagem: ${m.situacoesAprendizagem}` : '',
              m.criteriosAvaliacao ? `Critérios de Avaliação: ${m.criteriosAvaliacao}` : '',
              m.estrategiasEnsino ? `Estratégias de Ensino: ${m.estrategiasEnsino}` : ''
            ].filter(Boolean).join('\n');
          }
          if (msepText.trim()) {
            plansList.push({
              id: d.id,
              type: 'plan',
              label: `${data.name || 'Sem nome'} [Plano de Curso]`,
              text: msepText
            });
          }
        });

        setExistingPlans(plansList);
        if (plansList.length > 0) {
          setSelectedExistingPlanId(plansList[0].id);
        }
      } catch (e) {
        console.error("Erro ao carregar planos de referência", e);
      } finally {
        setLoadingExistingPlans(false);
      }
    };
    fetchExistingPlans();
  }, [isOpen]);

  // Buscar rubricas reutilizáveis do Firestore
  useEffect(() => {
    if (!isOpen) return;
    const fetchRubrics = async () => {
      try {
        const snap = await getDocs(collection(db, 'reusable_rubrics'));
        const list: Array<{ id: string; name: string; subject: string; levels: Array<{ nivel: number; description: string; type: string; grade: number }> }> = [];
        snap.forEach(d => {
          const rData = d.data() as { name?: string; subject?: string; levels?: Array<{ nivel: number; description: string; type: string; grade: number }> };
          list.push({
            id: d.id,
            name: rData.name || '',
            subject: rData.subject || '',
            levels: rData.levels || []
          });
        });
        setReusableRubrics(list);
      } catch (e) {
        console.error("Erro ao buscar rubricas", e);
      }
    };
    fetchRubrics();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddCap = () => {
    if (!newCap.trim()) return;
    setCapabilities([...capabilities, newCap.trim()]);
    // Also add to table
    const initialEvals = students.reduce((acc, s) => {
      acc[s.id] = '';
      return acc;
    }, {} as Record<string, string>);
    setTableRows([...tableRows, { capability: newCap.trim(), criterion: 'Aguardando geração com IA...', studentEvaluations: initialEvals }]);
    setNewCap('');
  };

  const handleRemoveCap = (index: number) => {
    const list = [...capabilities];
    list.splice(index, 1);
    setCapabilities(list);
    
    const rows = [...tableRows];
    rows.splice(index, 1);
    setTableRows(rows);
  };

  const handleAddKnow = () => {
    if (!newKnow.trim()) return;
    setKnowledgeList([...knowledgeList, newKnow.trim()]);
    setNewKnow('');
  };

  const handleRemoveKnow = (index: number) => {
    const list = [...knowledgeList];
    list.splice(index, 1);
    setKnowledgeList(list);
  };

  const handleGenerateCriteria = async () => {
    if (capabilities.length === 0) {
      alert('Adicione pelo menos uma capacidade.');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      let existingMethodologyText = '';
      if (methodologySource === 'database') {
        const found = existingPlans.find(p => p.id === selectedExistingPlanId);
        if (found) {
          existingMethodologyText = found.text;
        } else {
          alert('Por favor, selecione uma metodologia de referência da lista.');
          setGenerating(false);
          return;
        }
      }

      const generated = await generateCriteriaWithMethodology(
        methodologySource === 'upload' ? pdfFile : null,
        capabilities,
        existingMethodologyText
      );
      const updatedRows = tableRows.map((row, idx) => ({
        ...row,
        criterion: generated[idx] || 'Critério gerado com sucesso.'
      }));
      setTableRows(updatedRows);
    } catch (e) {
      setError('Erro ao se comunicar com a IA para estruturar os critérios.');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCellChange = (rowIndex: number, field: 'capability' | 'criterion', value: string) => {
    const updated = [...tableRows];
    updated[rowIndex][field] = value;
    setTableRows(updated);
  };

  const handleEvalChange = (rowIndex: number, studentId: string, value: string) => {
    const updated = [...tableRows];
    updated[rowIndex].studentEvaluations[studentId] = value;
    setTableRows(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = {
        planId,
        schoolName,
        courseName,
        unitName,
        semester,
        learningContext,
        capabilities,
        knowledgeList,
        tableRows,
        rubricLevels,
        subjectName,
        createdAt: new Date()
      };
      await addDoc(collection(db, 'assessments_formativa'), dataToSave);
      alert('Plano de Ensino e Tabela de Avaliação Formativa salvos com sucesso no banco de dados!');
      onClose();
    } catch (e) {
      console.error(e);
      alert('Falha ao salvar o plano.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLevel = () => {
    const nextNivel = rubricLevels.length > 0 ? Math.max(...rubricLevels.map(l => l.nivel)) + 1 : 1;
    // Adicionar ordenado no topo
    setRubricLevels([
      { nivel: nextNivel, description: 'Nova descrição de critérios atingidos', type: 'Satisfatório', grade: 50 },
      ...rubricLevels
    ].sort((a, b) => b.nivel - a.nivel));
  };

  const handleRemoveLevel = (index: number) => {
    const list = [...rubricLevels];
    list.splice(index, 1);
    setRubricLevels(list);
  };

  const handleLevelChange = (index: number, field: 'description' | 'type' | 'grade' | 'nivel', value: string | number) => {
    const list = [...rubricLevels];
    const current = { ...list[index] };
    if (field === 'description') {
      current.description = String(value);
    } else if (field === 'type') {
      current.type = String(value);
    } else if (field === 'grade') {
      current.grade = Number(value);
    } else if (field === 'nivel') {
      current.nivel = Number(value);
    }
    list[index] = current;
    // Reordenar por nível decrescente se o nível mudar
    if (field === 'nivel') {
      list.sort((a, b) => b.nivel - a.nivel);
    }
    setRubricLevels(list);
  };

  const handleSaveReusableRubric = async () => {
    if (!rubricName.trim()) {
      alert('Por favor, informe um nome para a rubrica.');
      return;
    }
    setSavingRubric(true);
    try {
      const data = {
        name: rubricName.trim(),
        subject: subjectName.trim() || 'Geral',
        levels: rubricLevels,
        createdAt: new Date()
      };
      await addDoc(collection(db, 'reusable_rubrics'), data);
      alert('Modelo de Rubrica salvo com sucesso na biblioteca do banco de dados!');
      
      // Recarregar a lista
      const snap = await getDocs(collection(db, 'reusable_rubrics'));
      const list: Array<{ id: string; name: string; subject: string; levels: Array<{ nivel: number; description: string; type: string; grade: number }> }> = [];
      snap.forEach(d => {
        const rData = d.data() as { name?: string; subject?: string; levels?: Array<{ nivel: number; description: string; type: string; grade: number }> };
        list.push({
          id: d.id,
          name: rData.name || '',
          subject: rData.subject || '',
          levels: rData.levels || []
        });
      });
      setReusableRubrics(list);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar a rubrica no banco.');
    } finally {
      setSavingRubric(false);
    }
  };

  const handleApplyReusableRubric = (id: string) => {
    setSelectedReusableRubricId(id);
    const found = reusableRubrics.find(r => r.id === id);
    if (found) {
      setRubricLevels(found.levels);
      setRubricName(found.name);
      setSubjectName(found.subject);
      alert(`Rubrica "${found.name}" aplicada com sucesso!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-industrial-800 border border-industrial-700 w-full max-w-6xl rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-industrial-700 flex items-center justify-between bg-industrial-900/60">
          <div className="flex items-center gap-3">
            <Sparkles className="text-primary animate-pulse" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Criação de Plano de Ensino por IA</h2>
              <p className="text-xs text-slate-400 mt-1">{courseName} → <span className="text-primary font-semibold">{module.name}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-industrial-700 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Informações Básicas */}
          <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-industrial-700 pb-2">1. Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Nome da Escola</label>
                <input 
                  type="text" 
                  value={schoolName} 
                  onChange={e => setSchoolName(e.target.value)} 
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Unidade Curricular</label>
                <input 
                  type="text" 
                  value={unitName} 
                  onChange={e => setUnitName(e.target.value)} 
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Módulo / Semestre</label>
                <input 
                  type="text" 
                  value={semester} 
                  onChange={e => setSemester(e.target.value)} 
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>          {/* Capacidades e Conhecimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Capacidades */}
            <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-4">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest border-b border-industrial-700 pb-2">2. Capacidades Técnicas / Básicas</h3>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCap} 
                  onChange={e => setNewCap(e.target.value)} 
                  placeholder="Nova capacidade..."
                  className="flex-1 bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary outline-none"
                />
                <button onClick={handleAddCap} className="bg-primary hover:bg-blue-600 text-white p-2 rounded-lg transition-colors">
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {capabilities.map((cap, i) => (
                  <div key={i} className="flex justify-between items-center bg-industrial-900 p-2.5 rounded-lg border border-industrial-700 text-xs text-slate-300">
                    <span>{cap}</span>
                    <button onClick={() => handleRemoveCap(i)} className="text-red-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Conhecimentos */}
            <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-4">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-industrial-700 pb-2">3. Conhecimentos</h3>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newKnow} 
                  onChange={e => setNewKnow(e.target.value)} 
                  placeholder="Novo conhecimento..."
                  className="flex-1 bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary outline-none"
                />
                <button onClick={handleAddKnow} className="bg-primary hover:bg-blue-600 text-white p-2 rounded-lg transition-colors">
                  <Plus size={16} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {knowledgeList.map((know, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs">
                    {know}
                    <button onClick={() => handleRemoveKnow(i)} className="text-indigo-400 hover:text-indigo-200">
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Situação de Aprendizagem */}
          <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest border-b border-industrial-700 pb-2">4. Situação de Aprendizagem</h3>
            <div>
              <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Descrição / Contexto</label>
              <textarea 
                value={learningContext} 
                onChange={e => setLearningContext(e.target.value)} 
                rows={3}
                className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none resize-none"
              />
            </div>
          </div>
          {/* Metodologia de IA Baseada em PDF ou Banco de Dados */}
          <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-5">
            <div className="border-b border-industrial-700 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={16} className="text-primary animate-pulse" />
                5. Metodologia de Referência & Critérios por IA
              </h3>
              
              {/* Botões de Seleção da Fonte (Abas Brutalistas) */}
              <div className="flex bg-industrial-950 p-1 rounded-lg border border-industrial-700 self-start">
                <button
                  type="button"
                  onClick={() => setMethodologySource('upload')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${methodologySource === 'upload' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Upload de PDF
                </button>
                <button
                  type="button"
                  onClick={() => setMethodologySource('database')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${methodologySource === 'database' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Metodologia Salva
                </button>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              {methodologySource === 'upload' 
                ? 'Faça upload do documento de metodologia pedagógica da instituição (ex: MSEP) para que a inteligência artificial formule critérios de avaliação alinhados exatamente às capacidades desejadas.'
                : 'Selecione uma metodologia e critérios pedagógicos que já foram aplicados com sucesso em outro plano de ensino no banco de dados.'
              }
            </p>
            {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="md:col-span-2 space-y-4">
                {methodologySource === 'upload' ? (
                  pdfFile ? (
                    <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center font-bold text-primary text-xs uppercase">PDF</div>
                        <div>
                          <p className="text-sm font-medium text-white">{pdfFile.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button onClick={() => setPdfFile(null)} className="text-xs text-red-400 hover:text-red-300 underline font-semibold">Excluir</button>
                    </div>
                  ) : (
                    <Dropzone 
                      onDrop={files => setPdfFile(files[0] || null)}
                      accept={{ 'application/pdf': ['.pdf'] }}
                      label="Arraste o PDF de Metodologia Pedagógica para Referência da IA"
                    />
                  )
                ) : (
                  <div className="space-y-3">
                    {loadingExistingPlans ? (
                      <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                        <Loader2 className="animate-spin text-primary" size={16} />
                        Carregando metodologias do banco...
                      </div>
                    ) : existingPlans.length === 0 ? (
                      <p className="text-xs text-amber-500 italic">Nenhum plano anterior com metodologia encontrado no banco de dados.</p>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Escolha o Plano de Referência</label>
                          <select
                            value={selectedExistingPlanId}
                            onChange={e => setSelectedExistingPlanId(e.target.value)}
                            className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                          >
                            {existingPlans.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Preview da metodologia selecionada */}
                        <div className="p-3 bg-industrial-950 border border-industrial-700/60 rounded-lg max-h-32 overflow-y-auto text-[11px] text-slate-400 font-mono custom-scrollbar">
                          <p className="font-semibold text-slate-300 mb-1">Visualização do Contexto:</p>
                          <pre className="whitespace-pre-wrap">{existingPlans.find(p => p.id === selectedExistingPlanId)?.text || 'Nenhum contexto disponível.'}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="md:pt-5">
                <button
                  onClick={handleGenerateCriteria}
                  disabled={generating || capabilities.length === 0 || (methodologySource === 'upload' && !pdfFile) || (methodologySource === 'database' && !selectedExistingPlanId)}
                  className="w-full py-4 bg-gradient-to-r from-primary to-accent hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Estruturando Critérios...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Gerar Critérios com IA
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Tabela de Avaliação Formativa */}
          <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-4 overflow-hidden">
            <div className="flex justify-between items-center border-b border-industrial-700 pb-2">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">6. Tabela de Avaliação Formativa (Campos Editáveis)</h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">Total de Alunos: {students.length}</span>
            </div>

            {loadingStudents ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="animate-spin text-primary" size={24} />
                <p className="text-xs text-slate-400">Carregando lista de alunos...</p>
              </div>
            ) : tableRows.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">Adicione capacidades para estruturar a tabela.</div>
            ) : (
              <div className="overflow-x-auto border border-industrial-700 rounded-xl max-h-[400px]">
                <table className="w-full text-left text-xs min-w-[800px] border-collapse">
                  <thead>
                    <tr className="bg-industrial-900 border-b border-industrial-700 text-slate-400">
                      <th className="p-3 border-r border-industrial-700 w-64 min-w-[200px]">Capacidade a ser Avaliada</th>
                      <th className="p-3 border-r border-industrial-700 w-96 min-w-[300px]">Critério de Avaliação (Gerado ou Escrito)</th>
                      {students.map(s => (
                        <th key={s.id} className="p-3 border-r border-industrial-700 font-medium text-center w-28 min-w-[100px] truncate" title={s.name}>
                          {s.name.split(' ')[0]} <br />
                          <span className="text-[9px] text-slate-500 font-mono">RA: {s.ra}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-industrial-700">
                    {tableRows.map((row, rIdx) => (
                      <tr key={rIdx} className="bg-industrial-800 hover:bg-industrial-750 transition-colors">
                        {/* Capacidade */}
                        <td className="p-2.5 border-r border-industrial-700 align-top">
                          <textarea
                            value={row.capability}
                            onChange={e => handleCellChange(rIdx, 'capability', e.target.value)}
                            className="w-full bg-transparent text-white border-0 focus:ring-1 focus:ring-primary rounded p-1 outline-none resize-none"
                            rows={2}
                          />
                        </td>
                        {/* Critério */}
                        <td className="p-2.5 border-r border-industrial-700 align-top">
                          <textarea
                            value={row.criterion}
                            onChange={e => handleCellChange(rIdx, 'criterion', e.target.value)}
                            className="w-full bg-transparent text-slate-300 border-0 focus:ring-1 focus:ring-primary rounded p-1 outline-none resize-none"
                            rows={3}
                          />
                        </td>
                        {/* Students Evaluatios */}
                        {students.map(s => (
                          <td key={s.id} className="p-2 border-r border-industrial-700 align-middle text-center">
                            <select
                              value={row.studentEvaluations[s.id] || ''}
                              onChange={e => handleEvalChange(rIdx, s.id, e.target.value)}
                              className="w-full bg-industrial-900 border border-industrial-700 text-white text-[11px] rounded p-1 outline-none focus:border-primary text-center"
                            >
                              <option value="">A avaliar</option>
                              <option value="S">Satisfatório</option>
                              <option value="NS">Não Sat.</option>
                              <option value="D">Destaque</option>
                            </select>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Níveis de Desempenho e Rubricas Dinâmicas */}
          <div className="bg-industrial-900/50 p-6 rounded-xl border border-industrial-700 space-y-6">
            <div className="border-b border-industrial-700 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={16} className="text-primary animate-pulse" />
                  7. Níveis de Desempenho (Rubrica Personalizável)
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Configure, edite ou salve modelos de rubrica para reutilização.</p>
              </div>

              {/* Seletor de Rubricas Existentes no Banco */}
              {reusableRubrics.length > 0 && (
                <div className="flex items-center gap-2 bg-industrial-950 px-3 py-1.5 rounded-lg border border-industrial-700">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Usar Rubrica Salva:</label>
                  <select
                    value={selectedReusableRubricId}
                    onChange={e => handleApplyReusableRubric(e.target.value)}
                    className="bg-transparent border-0 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">-- Selecione para aplicar --</option>
                    {reusableRubrics.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.subject})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Inputs para salvar como modelo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-industrial-950/40 rounded-xl border border-industrial-750">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nome deste Modelo de Rubrica</label>
                <input
                  type="text"
                  value={rubricName}
                  onChange={e => setRubricName(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary outline-none"
                  placeholder="Ex: Rubrica Usinagem SENAI"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Assunto / Eixo Temático (Detectado ou Escrito)</label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={e => setSubjectName(e.target.value)}
                  className="w-full bg-industrial-900 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary outline-none"
                  placeholder="Ex: Processos de Fabricação"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveReusableRubric}
                  disabled={savingRubric || rubricLevels.length === 0}
                  className="w-full py-2 bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-xs font-bold text-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  {savingRubric ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                  Salvar Rubrica na Biblioteca
                </button>
              </div>
            </div>

            {/* Tabela de Níveis Editáveis */}
            <div className="border border-industrial-700 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-industrial-900 border-b border-industrial-700 text-slate-400">
                    <th className="p-3 border-r border-industrial-700 w-20 text-center">Nível</th>
                    <th className="p-3 border-r border-industrial-700">Critérios Atingidos (Descrição do Nível)</th>
                    <th className="p-3 border-r border-industrial-700 w-44">Classificação (Tipo)</th>
                    <th className="p-3 border-r border-industrial-700 w-24 text-center">Nota Final</th>
                    <th className="p-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-700 font-mono">
                  {rubricLevels.map((level, lIdx) => (
                    <tr key={lIdx} className="bg-industrial-800/40 hover:bg-industrial-800 transition-colors">
                      {/* Nível */}
                      <td className="p-2 border-r border-industrial-700 text-center">
                        <input
                          type="number"
                          value={level.nivel}
                          onChange={e => handleLevelChange(lIdx, 'nivel', e.target.value)}
                          className="w-12 bg-industrial-900 border border-industrial-700 rounded p-1 text-center text-white text-xs"
                        />
                      </td>
                      {/* Critérios Atingidos */}
                      <td className="p-2 border-r border-industrial-700 font-sans">
                        <input
                          type="text"
                          value={level.description}
                          onChange={e => handleLevelChange(lIdx, 'description', e.target.value)}
                          className="w-full bg-transparent text-slate-300 border-0 focus:ring-1 focus:ring-primary rounded p-1 outline-none text-xs"
                        />
                      </td>
                      {/* Classificação */}
                      <td className="p-2 border-r border-industrial-700 font-sans">
                        <select
                          value={level.type}
                          onChange={e => handleLevelChange(lIdx, 'type', e.target.value)}
                          className="w-full bg-industrial-900 border border-industrial-700 rounded p-1 text-white text-xs"
                        >
                          <option value="Excelência">Excelência</option>
                          <option value="Destaque">Destaque</option>
                          <option value="Satisfatório">Satisfatório</option>
                          <option value="Em Desenvolvimento">Em Desenv.</option>
                          <option value="Insatisfatório">Insatisfatório</option>
                        </select>
                      </td>
                      {/* Nota Final */}
                      <td className="p-2 border-r border-industrial-700 text-center">
                        <input
                          type="number"
                          value={level.grade}
                          onChange={e => handleLevelChange(lIdx, 'grade', e.target.value)}
                          className="w-16 bg-industrial-900 border border-industrial-700 rounded p-1 text-center text-white text-xs font-bold"
                          min={0}
                          max={100}
                        />
                      </td>
                      {/* Ações */}
                      <td className="p-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveLevel(lIdx)}
                          className="text-red-500 hover:text-red-400 transition-colors p-1"
                          title="Excluir Nível"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ação para Adicionar Novo Nível */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={handleAddLevel}
                className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all animate-pulse"
              >
                <Plus size={14} />
                Adicionar Nível de Desempenho
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-industrial-700 flex justify-end gap-3 bg-industrial-900/60 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 bg-industrial-800 hover:bg-industrial-700 text-slate-300 rounded-xl font-medium text-sm transition-colors">
            Cancelar
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving || tableRows.length === 0}
            className="px-6 py-2.5 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Salvar Plano e Avaliações
          </button>
        </div>
      </div>
    </div>
  );
}
