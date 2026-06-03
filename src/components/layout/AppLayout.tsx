import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, FileText, FileSignature, Library, Clock, LogOut, Award } from 'lucide-react';
import { auth } from '../../firebase/config';
import { signOut } from 'firebase/auth';


export function AppLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
      isActive
        ? 'bg-industrial-700 text-white font-semibold'
        : 'hover:bg-industrial-700/50 text-slate-300'
    }`;

  return (
    <div className="flex h-screen bg-industrial-900 text-slate-200 print:bg-white print:text-black print:h-auto">
      {/* Sidebar sidebar */}
      <aside className="w-64 bg-industrial-800 border-r border-industrial-700 flex flex-col print:hidden">
        <div className="p-6 border-b border-industrial-700">
          <h1 className="text-xl font-bold text-white tracking-wider">
            PE <span className="text-primary">GENERATOR</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Plataforma Educacional</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavLink to="/" className={navItemClass} end>
            {({ isActive }) => (
              <>
                <LayoutDashboard size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Dashboard</span>
              </>
            )}
          </NavLink>
          <NavLink to="/classes" className={navItemClass}>
            {({ isActive }) => (
              <>
                <FileText size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Turmas</span>
              </>
            )}
          </NavLink>
          <NavLink to="/schedules" className={navItemClass}>
            {({ isActive }) => (
              <>
                <Clock size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Cronogramas</span>
              </>
            )}
          </NavLink>
          <NavLink to="/calendars" className={navItemClass}>
            {({ isActive }) => (
              <>
                <Calendar size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Calendários</span>
              </>
            )}
          </NavLink>
          <NavLink to="/units" className={navItemClass}>
            {({ isActive }) => (
              <>
                <Library size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Unidades Curriculares</span>
              </>
            )}
          </NavLink>
          <NavLink to="/students" className={navItemClass}>
            {({ isActive }) => (
              <>
                <Users size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Alunos</span>
              </>
            )}
          </NavLink>
          <NavLink to="/dossier" className={navItemClass}>
            {({ isActive }) => (
              <>
                <FileSignature size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Dossiê Digital</span>
              </>
            )}
          </NavLink>
          <NavLink to="/evaluation" className={navItemClass}>
            {({ isActive }) => (
              <>
                <Award size={18} className={isActive ? "text-primary" : "text-slate-400"} />
                <span className="font-medium text-sm">Atividades & Lançamentos</span>
              </>
            )}
          </NavLink>
        </nav>

        <div className="p-4 border-t border-industrial-700 text-xs text-slate-500 text-center">
          Versão Sentry AI 1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col print:overflow-visible print:bg-white">
        <header className="h-16 border-b border-industrial-700 flex items-center justify-between px-8 bg-industrial-800/50 backdrop-blur-sm sticky top-0 z-10 print:hidden">
          <h2 className="text-lg font-medium text-slate-200">Visão Geral</h2>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 text-sm font-medium mr-2"
              title="Sair do sistema"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-industrial-700 flex items-center justify-center border border-industrial-700">
              <span className="text-sm font-medium">DO</span>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1 print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
