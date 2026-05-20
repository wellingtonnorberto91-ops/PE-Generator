import { useState, useEffect } from 'react';
import { Dropzone } from '../components/ui/Dropzone';
import { extractDataFromFile } from '../features/ai-core/gemini';
import { Calendar as CalendarIcon, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

interface Holiday {
  id?: string;
  date: string;
  description: string;
}

export function Calendars() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const fetchHolidays = async () => {
    try {
      const q = query(collection(db, 'calendars'), orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      const data: Holiday[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Holiday);
      });
      setHolidays(data);
    } catch (error) {
      console.error("Erro ao buscar calendários", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const q = query(collection(db, 'calendars'), orderBy('date', 'asc'));
        const querySnapshot = await getDocs(q);
        const data: Holiday[] = [];
        querySnapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() } as Holiday);
        });
        if (active) {
          setHolidays(data);
          setFetching(false);
        }
      } catch (error) {
        console.error("Erro ao buscar calendários", error);
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
    try {
      // Magia do Sentry AI acontece aqui
      const data = await extractDataFromFile(file, 'CALENDAR');
      if (data && data.holidays && Array.isArray(data.holidays)) {
        // Concatenar os feriados extraídos com os existentes no estado local (ainda não salvos)
        const newHolidays = data.holidays.filter((h) => h.date && h.description);
        
        for (const holiday of newHolidays) {
          await addDoc(collection(db, 'calendars'), {
            date: holiday.date,
            description: holiday.description
          });
        }
        await fetchHolidays(); // recarrega do firebase
        alert(`${newHolidays.length} feriados importados com sucesso!`);
      } else {
        alert("A IA não conseguiu encontrar feriados válidos no documento.");
      }
    } catch (error: unknown) {
      const err = error as Error;
      alert(err.message || "Erro ao processar o arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta data?')) return;
    try {
      await deleteDoc(doc(db, 'calendars', id));
      setHolidays(holidays.filter(h => h.id !== id));
    } catch (error) {
      console.error("Erro ao deletar", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Calendário Escolar e Feriados</h1>
        <p className="text-slate-400 mt-1">Importe o arquivo com os recessos da sua unidade escolar. O motor logístico pulará estas datas automaticamente.</p>
      </div>

      {/* Sentry AI Zone */}
      <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-accent/10 text-accent text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 border-b border-l border-accent/20">
          <Sparkles size={14} /> Sentry AI
        </div>
        
        <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <CalendarIcon size={20} className="text-primary" />
          Importação Inteligente
        </h2>
        
        {loading ? (
          <div className="h-64 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-slate-300 font-medium">Sentry AI está analisando o documento...</p>
            <p className="text-sm text-slate-500 mt-2">Extraindo feriados e recessos. Isso pode levar alguns segundos.</p>
          </div>
        ) : (
          <Dropzone 
            onDrop={handleFileUpload} 
            accept={{
              'application/pdf': ['.pdf'],
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'text/csv': ['.csv']
            }} 
            label="Arraste o PDF ou Excel do Calendário Escolar"
          />
        )}
      </div>

      {/* Lista de Feriados Salvos */}
      <div className="bg-industrial-800 border border-industrial-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Dias Não-Letivos da Unidade</h2>
          <button className="bg-industrial-700 hover:bg-industrial-600 text-white px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2">
            <Plus size={16} /> Adicionar Manualmente
          </button>
        </div>

        {fetching ? (
          <div className="text-center py-8 text-slate-500">Carregando calendário...</div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-12 text-slate-500 border border-dashed border-industrial-700 rounded-lg">
            Nenhum feriado cadastrado para esta unidade. Use a importação acima.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holidays.map((h, i) => (
              <div key={h.id || i} className="bg-industrial-900 border border-industrial-700 p-4 rounded-lg flex items-start justify-between group">
                <div>
                  <div className="text-sm font-medium text-primary mb-1">
                    {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                  <div className="text-slate-300 text-sm">{h.description}</div>
                </div>
                <button 
                  onClick={() => h.id && handleDelete(h.id)}
                  className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
