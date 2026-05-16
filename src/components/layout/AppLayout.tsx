import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, FileText, FileSignature, Library, Clock } from 'lucide-react';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-industrial-900 text-slate-200">
      {/* Sidebar sidebar */}
      <aside className="w-64 bg-industrial-800 border-r border-industrial-700 flex flex-col">
        <div className="p-6 border-b border-industrial-700">
          <h1 className="text-xl font-bold text-white tracking-wider">
            PE <span className="text-primary">GENERATOR</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Plataforma Educacional</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-md bg-industrial-700 text-white">
            <LayoutDashboard size={18} className="text-primary" />
            <span className="font-medium text-sm">Dashboard</span>
          </a>
          <a href="/calendars" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <Calendar size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Calendários</span>
          </a>
          <a href="/classes" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <FileText size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Planos de Ensino</span>
          </a>
          <a href="/units" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <Library size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Unidades Curriculares</span>
          </a>
          <a href="/schedules" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <Clock size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Cronogramas</span>
          </a>
          <a href="/students" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <Users size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Alunos</span>
          </a>
          <a href="/dossier" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-industrial-700/50 text-slate-300 transition-colors">
            <FileSignature size={18} className="text-slate-400" />
            <span className="font-medium text-sm">Dossiê Digital</span>
          </a>
        </nav>

        <div className="p-4 border-t border-industrial-700 text-xs text-slate-500 text-center">
          Versão Sentry AI 1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-industrial-700 flex items-center justify-between px-8 bg-industrial-800/50 backdrop-blur-sm sticky top-0 z-10">
          <h2 className="text-lg font-medium text-slate-200">Visão Geral</h2>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-industrial-700 flex items-center justify-center border border-industrial-700">
              <span className="text-sm font-medium">DO</span>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
