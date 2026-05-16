import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { Search, User, FileSignature, Save, Loader2, CheckCircle2, Circle } from 'lucide-react';

interface ClassPlan {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  ra: string;
}

interface DossierData {
  technicalCompetencies: { name: string; achieved: boolean }[];
  socioEmotional: { name: string; achieved: boolean }[];
  report: string;
}

const DEFAULT_SOCIOEMOTIONAL = [
  "Trabalho em Equipe e Colaboração",
  "Comunicação Assertiva",
  "Resolução de Problemas",
  "Pensamento Crítico",
  "Autogestão e Organização"
];

const DEFAULT_TECHNICAL = [
  "Fundamentos Teóricos do Módulo",
  "Execução Prática de Projetos",
  "Uso Adequado de Ferramentas/Softwares",
  "Aderência a Normas de Segurança (NRs)"
];

export function Dossier() {
  const [classes, setClasses] = useState<ClassPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Dossier state
  const [dossier, setDossier] = useState<DossierData>({
    technicalCompetencies: DEFAULT_TECHNICAL.map(n => ({ name: n, achieved: false })),
    socioEmotional: DEFAULT_SOCIOEMOTIONAL.map(n => ({ name: n, achieved: false })),
    report: ''
  });
  
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
      const snap = await getDocs(q);
      const data: ClassPlan[] = [];
      snap.forEach(d => data.push({ id: d.id, name: d.data().name }));
      setClasses(data);
      if (data.length > 0) setSelectedClass(data[0].id);
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    const fetchStudents = async () => {
      setLoadingList(true);
      setSelectedStudent(null);
      const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
      const snap = await getDocs(q);
      const data: Student[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Student));
      data.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(data);
      setFilteredStudents(data);
      setLoadingList(false);
    };
    fetchStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredStudents(students);
    } else {
      const lowerQ = searchQuery.toLowerCase();
      setFilteredStudents(students.filter(s => 
        s.name.toLowerCase().includes(lowerQ) || s.ra.includes(lowerQ)
      ));
    }
  }, [searchQuery, students]);

  // Load Dossier
  useEffect(() => {
    if (!selectedStudent) return;
    const loadDossier = async () => {
      setLoadingDossier(true);
      try {
        const docRef = doc(db, 'dossiers', selectedStudent.id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDossier(snap.data() as DossierData);
        } else {
          // Reset to default
          setDossier({
            technicalCompetencies: DEFAULT_TECHNICAL.map(n => ({ name: n, achieved: false })),
            socioEmotional: DEFAULT_SOCIOEMOTIONAL.map(n => ({ name: n, achieved: false })),
            report: ''
          });
        }
      } catch (e) {
        console.error("Erro ao carregar dossiê", e);
      } finally {
        setLoadingDossier(false);
      }
    };
    loadDossier();
  }, [selectedStudent]);

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'dossiers', selectedStudent.id);
      await setDoc(docRef, dossier);
      alert('Dossiê salvo com sucesso!');
    } catch (e) {
      alert('Erro ao salvar dossiê.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleTechnical = (index: number) => {
    const newData = [...dossier.technicalCompetencies];
    newData[index].achieved = !newData[index].achieved;
    setDossier({ ...dossier, technicalCompetencies: newData });
  };

  const toggleSocio = (index: number) => {
    const newData = [...dossier.socioEmotional];
    newData[index].achieved = !newData[index].achieved;
    setDossier({ ...dossier, socioEmotional: newData });
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dossiê Digital do Aluno</h1>
        <p className="text-slate-400 mt-1">Avaliação de competências técnicas, socioemocionais e relatório individual do docente.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[600px]">
        {/* Sidebar: Class & Students */}
        <div className="lg:col-span-1 bg-industrial-800 border border-industrial-700 rounded-xl flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-industrial-700 bg-industrial-800/50">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Turma Ativa</label>
            <select 
              value={selectedClass} 
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full bg-industrial-900 border border-industrial-700 rounded p-2 text-sm text-white focus:border-primary outline-none"
            >
              <option value="" disabled>Selecione...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="p-4 border-b border-industrial-700">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar por Nome ou RA..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-industrial-900 border border-industrial-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {loadingList ? (
              <div className="text-center py-8 text-slate-500 text-sm">Carregando...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">Nenhum aluno encontrado.</div>
            ) : (
              filteredStudents.map(student => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                    selectedStudent?.id === student.id 
                      ? 'bg-primary/20 border border-primary/30 text-white' 
                      : 'bg-transparent text-slate-300 hover:bg-industrial-700 border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    selectedStudent?.id === student.id ? 'bg-primary text-white' : 'bg-industrial-700 text-slate-400'
                  }`}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{student.name}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">RA: {student.ra}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Content: Dossier Editor */}
        <div className="lg:col-span-3 bg-industrial-800 border border-industrial-700 rounded-xl flex flex-col h-full overflow-hidden shadow-xl">
          {selectedStudent ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-industrial-700 bg-gradient-to-r from-industrial-800 to-industrial-900 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-industrial-700 border-2 border-primary flex items-center justify-center text-xl font-bold text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedStudent.name}</h2>
                    <p className="text-sm text-slate-400 font-mono mt-1">Registro Acadêmico: {selectedStudent.ra}</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleSave}
                  disabled={saving || loadingDossier}
                  className="bg-accent hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Salvar Dossiê
                </button>
              </div>

              {/* Dossier Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {loadingDossier ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Technical Competencies */}
                      <div className="bg-industrial-900 border border-industrial-700 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <FileSignature className="text-primary" size={20} />
                          <h3 className="text-lg font-medium text-white">Competências Técnicas</h3>
                        </div>
                        <div className="space-y-3">
                          {dossier.technicalCompetencies.map((comp, idx) => (
                            <div 
                              key={idx}
                              onClick={() => toggleTechnical(idx)}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                comp.achieved 
                                  ? 'bg-primary/10 border-primary/30 text-white' 
                                  : 'bg-industrial-800 border-industrial-700 text-slate-400 hover:border-industrial-600'
                              }`}
                            >
                              {comp.achieved ? <CheckCircle2 className="text-primary shrink-0" size={20} /> : <Circle className="text-slate-500 shrink-0" size={20} />}
                              <span className="text-sm leading-tight pt-0.5">{comp.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Socio-Emotional Competencies */}
                      <div className="bg-industrial-900 border border-industrial-700 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <User className="text-accent" size={20} />
                          <h3 className="text-lg font-medium text-white">Competências Socioemocionais</h3>
                        </div>
                        <div className="space-y-3">
                          {dossier.socioEmotional.map((comp, idx) => (
                            <div 
                              key={idx}
                              onClick={() => toggleSocio(idx)}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                comp.achieved 
                                  ? 'bg-accent/10 border-accent/30 text-white' 
                                  : 'bg-industrial-800 border-industrial-700 text-slate-400 hover:border-industrial-600'
                              }`}
                            >
                              {comp.achieved ? <CheckCircle2 className="text-accent shrink-0" size={20} /> : <Circle className="text-slate-500 shrink-0" size={20} />}
                              <span className="text-sm leading-tight pt-0.5">{comp.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Descriptive Report */}
                    <div className="bg-industrial-900 border border-industrial-700 rounded-xl p-5">
                      <h3 className="text-lg font-medium text-white mb-4">Relatório Descritivo</h3>
                      <textarea
                        value={dossier.report}
                        onChange={e => setDossier({ ...dossier, report: e.target.value })}
                        placeholder="Descreva observações adicionais sobre o desenvolvimento do aluno durante a unidade curricular..."
                        className="w-full h-40 bg-industrial-800 border border-industrial-700 rounded-lg p-4 text-white placeholder-slate-500 outline-none focus:border-primary resize-none transition-colors"
                      ></textarea>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <User size={64} className="mb-4 text-industrial-700" />
              <p className="text-lg font-medium">Nenhum Aluno Selecionado</p>
              <p className="text-sm mt-1">Selecione um aluno na lista à esquerda para editar o dossiê.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
