import { useState, useEffect } from 'react';
import { Dropzone } from '../components/ui/Dropzone';
import { extractDataFromFile } from '../features/ai-core/gemini';
import { Users, Sparkles, Loader2, UserPlus, Trash2 } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, orderBy, where, deleteDoc, doc } from 'firebase/firestore';

interface ClassPlan {
  id: string;
  name: string;
}

interface Student {
  id?: string;
  name: string;
  ra: string;
  classId: string;
}

export function Students() {
  const [classes, setClasses] = useState<ClassPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Load Classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const q = query(collection(db, 'teaching_plans'), orderBy('startDate', 'desc'));
        const snap = await getDocs(q);
        const data: ClassPlan[] = [];
        snap.forEach(d => data.push({ id: d.id, name: d.data().name }));
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0].id);
        }
      } catch (error) {
        console.error("Erro ao carregar turmas", error);
      } finally {
        setFetching(false);
      }
    };
    fetchClasses();
  }, []);

  // Load Students when class changes
  useEffect(() => {
    if (!selectedClass) return;
    const fetchStudents = async () => {
      setFetching(true);
      try {
        const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
        const snap = await getDocs(q);
        const data: Student[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as Student));
        // Client side sort since we might not have composite index
        data.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(data);
      } catch (error) {
        console.error("Erro ao carregar alunos", error);
      } finally {
        setFetching(false);
      }
    };
    fetchStudents();
  }, [selectedClass]);

  const handleFileUpload = async (files: File[]) => {
    if (!selectedClass) {
      alert("Selecione uma turma antes de importar alunos.");
      return;
    }
    const file = files[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await extractDataFromFile(file, 'STUDENTS');
      if (data && data.students && Array.isArray(data.students)) {
        const extractedStudents = data.students.filter((s) => s.name && s.ra);
        
        let added = 0;
        for (const stu of extractedStudents) {
          // Add only if not already in list (basic check by RA)
          if (!students.some(existing => existing.ra === stu.ra)) {
            const newStudent = { name: stu.name, ra: stu.ra, classId: selectedClass };
            await addDoc(collection(db, 'students'), newStudent);
            added++;
          }
        }
        
        // Reload students
        const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
        const snap = await getDocs(q);
        const newData: Student[] = [];
        snap.forEach(d => newData.push({ id: d.id, ...d.data() } as Student));
        newData.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(newData);
        
        alert(`${added} alunos matriculados com sucesso!`);
      } else {
        alert("A IA não conseguiu encontrar alunos válidos na planilha.");
      }
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message || "Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este aluno da turma?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      setStudents(students.filter(s => s.id !== id));
    } catch (error) {
      console.error("Erro ao deletar", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Alunos e Matrículas</h1>
        <p className="text-slate-400 mt-1">Importe a lista do sistema acadêmico. O Sentry AI organizará e vinculará à turma selecionada.</p>
      </div>

      <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">Selecione a Turma (Plano de Ensino)</label>
        <select 
          value={selectedClass} 
          onChange={e => setSelectedClass(e.target.value)}
          className="w-full md:w-1/2 bg-industrial-900 border border-industrial-700 rounded-lg p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
        >
          <option value="" disabled>Selecione uma turma...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Dropzone Sentry AI */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-accent/10 text-accent text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-accent/20">
                <Sparkles size={14} /> Sentry AI
              </div>
              
              <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-primary" />
                Matrícula em Lote
              </h2>
              
              {loading ? (
                <div className="h-64 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl flex flex-col items-center justify-center text-center p-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-slate-300 font-medium">Extraindo RAs e Nomes...</p>
                  <p className="text-xs text-slate-500 mt-2">Limpando sujeira da planilha.</p>
                </div>
              ) : (
                <Dropzone 
                  onDrop={handleFileUpload} 
                  accept={{
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                    'text/csv': ['.csv'],
                    'application/pdf': ['.pdf']
                  }} 
                  label="Arraste o Diário ou Planilha de Alunos"
                />
              )}
            </div>
            
            <button className="w-full bg-industrial-800 hover:bg-industrial-700 border border-industrial-700 text-white p-4 rounded-xl flex items-center justify-center gap-2 transition-colors">
              <UserPlus size={18} />
              Cadastrar Aluno Manualmente
            </button>
          </div>

          {/* Coluna da Direita: Lista de Alunos */}
          <div className="lg:col-span-2 bg-industrial-800 border border-industrial-700 rounded-xl p-6 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">Alunos Matriculados ({students.length})</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {fetching ? (
                <div className="text-center py-8 text-slate-500">Buscando alunos...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-slate-500 border border-dashed border-industrial-700 rounded-lg">
                  Nenhum aluno nesta turma.
                </div>
              ) : (
                students.map((student) => (
                  <div key={student.id} className="bg-industrial-900 border border-industrial-700 p-4 rounded-lg flex items-center justify-between group hover:border-industrial-600 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-industrial-800 border border-industrial-700 flex items-center justify-center text-slate-300 font-medium">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-slate-200 font-medium">{student.name}</div>
                        <div className="text-sm text-slate-500 font-mono">RA: {student.ra}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => student.id && handleDelete(student.id)}
                      className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      title="Remover"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
