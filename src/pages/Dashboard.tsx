import { FileText, Calendar, Users } from 'lucide-react';
 
 export function Dashboard() {
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-semibold text-white">Dashboard Inicial</h1>
           <p className="text-slate-400 mt-1">Bem-vindo ao motor logístico PE Generator.</p>
         </div>
       </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6 hover:border-primary/50 transition-colors group">
          <div className="w-12 h-12 bg-industrial-900 rounded-md flex items-center justify-center border border-industrial-700 mb-4 group-hover:border-primary/50">
            <Calendar className="text-primary" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Calendários e Feriados</h3>
          <p className="text-sm text-slate-400 mb-4">
            Arraste um PDF do calendário oficial da escola. O Sentry AI fará a leitura e salvará os recessos automaticamente.
          </p>
          <div className="text-xs font-medium text-accent flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Sentry AI Ativo
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6 hover:border-primary/50 transition-colors group">
          <div className="w-12 h-12 bg-industrial-900 rounded-md flex items-center justify-center border border-industrial-700 mb-4 group-hover:border-primary/50">
            <FileText className="text-slate-300" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Matrizes e PEs</h3>
          <p className="text-sm text-slate-400 mb-4">
            Suba as grades curriculares. O motor logístico cruza com os calendários e gera as datas de término exatas.
          </p>
          <div className="text-xs font-medium text-accent flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Sentry AI Ativo
          </div>
        </div>

        <div className="bg-industrial-800 border border-industrial-700 rounded-lg p-6 hover:border-primary/50 transition-colors group">
          <div className="w-12 h-12 bg-industrial-900 rounded-md flex items-center justify-center border border-industrial-700 mb-4 group-hover:border-primary/50">
            <Users className="text-slate-300" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Dossiê de Alunos</h3>
          <p className="text-sm text-slate-400 mb-4">
            Importe listas de chamadas (Excel/PDF) e inicie a avaliação de competências da instituição com facilidade.
          </p>
          <div className="text-xs font-medium text-accent flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            Sentry AI Ativo
          </div>
        </div>
      </div>
    </div>
  );
}
