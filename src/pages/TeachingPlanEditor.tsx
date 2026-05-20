import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  generateTeachingPlanAI,
  type ModuleTeachingPlan,
  type TeachingPlanInput,
  type AvaliacaoCriterio,
  type DidacticStrategy,
} from '../features/ai-core/gemini';
import {
  ArrowLeft, Sparkles, Save, Printer, AlertTriangle,
  BookOpen, FlaskConical, ClipboardList, BarChart3, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';

interface Module {
  name: string;
  hours: number;
  objective?: string;
  technicalCapabilities?: string[];
  socioemotionalCapabilities?: string[];
  knowledge?: string[];
  recommendations?: string;
  aiSuggestions?: string;
  teachingPlan?: ModuleTeachingPlan;
}

interface TeachingPlan {
  id?: string;
  name: string;
  totalHours: number;
  modules: Module[];
  msep?: {
    objetivoGeral?: string;
    capacidadesBasicas?: string[];
    capacidadesTecnicas?: string[];
    capacidadesSocioemocionais?: string[];
    conhecimentos?: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-industrial-700">
      <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary">{icon}</div>
      <div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        {sub && <p className="text-slate-500 text-xs">{sub}</p>}
      </div>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="text-[11px] px-2.5 py-1 bg-industrial-900 border border-industrial-700 text-slate-300 rounded-lg">
          {item}
        </span>
      ))}
    </div>
  );
}

function CriterioRow({ c, index }: { c: AvaliacaoCriterio; index: number }) {
  return (
    <div className="flex gap-3 p-3 bg-industrial-900 rounded-xl border border-industrial-700/60">
      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border ${c.tipo === 'critico' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-amber-500/15 border-amber-500/40 text-amber-400'}`}>
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium leading-relaxed">{c.criterio}</p>
        <p className="text-[10px] text-slate-500 mt-1 italic">{c.evidencia}</p>
      </div>
      <span className={`flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border self-start mt-0.5 ${c.tipo === 'critico' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
        {c.tipo === 'critico' ? 'Crítico' : 'Desejável'}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function TeachingPlanEditor() {
  const { classId, moduleIndex } = useParams<{ classId: string; moduleIndex: string }>();
  const navigate = useNavigate();

  const [classPlan, setClassPlan] = useState<TeachingPlan | null>(null);
  const [mod, setMod] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<ModuleTeachingPlan | null>(null);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    situacao: true, didatico: true, formativa: true, somativa: true, niveis: true,
  });

  // Form inputs
  const [docente, setDocente] = useState('');
  const [semestre, setSemestre] = useState('1º Semestre');
  const [chFormativa, setChFormativa] = useState(0);
  const [chSomativa, setChSomativa] = useState(0);

  const modIdx = Number(moduleIndex ?? 0);

  useEffect(() => {
    if (!classId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'teaching_plans', classId));
        if (!snap.exists()) { setError('Turma não encontrada.'); return; }
        const data = { id: snap.id, ...snap.data() } as TeachingPlan;
        setClassPlan(data);
        const m = data.modules[modIdx];
        setMod(m ?? null);
        if (m) {
          const total = m.hours || 60;
          const fDefault = Math.round(total * 0.75);
          setChFormativa(fDefault);
          setChSomativa(total - fDefault);
          if (m.teachingPlan) setPlan(m.teachingPlan);
        }
      } catch (e) {
        setError('Erro ao carregar dados da turma.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classId, modIdx]);

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async () => {
    if (!mod || !classPlan) return;
    if (!docente.trim()) { alert('Informe o nome do docente antes de gerar.'); return; }
    if (chFormativa + chSomativa !== mod.hours) {
      alert(`A soma da CH Formativa (${chFormativa}h) + CH Somativa (${chSomativa}h) deve ser igual à carga horária do módulo (${mod.hours}h).`);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const input: TeachingPlanInput = {
        docente,
        curso: classPlan.name,
        unidadeCurricular: mod.name,
        modulo: mod.name,
        semestre,
        chTotal: mod.hours,
        chFormativa,
        chSomativa,
        capacidadesTecnicas: mod.technicalCapabilities ?? classPlan.msep?.capacidadesTecnicas ?? [],
        conhecimentos: mod.knowledge ?? classPlan.msep?.conhecimentos ?? [],
        capacidadesSociais: mod.socioemotionalCapabilities ?? classPlan.msep?.capacidadesSocioemocionais ?? [],
      };
      const result = await generateTeachingPlanAI(input);
      setPlan(result);
    } catch (e) {
      setError('Falha ao gerar o plano. Verifique a chave de API e tente novamente.');
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!classPlan || !plan) return;
    setSaving(true);
    try {
      const updatedModules = [...classPlan.modules];
      updatedModules[modIdx] = { ...updatedModules[modIdx], teachingPlan: plan };
      await updateDoc(doc(db, 'teaching_plans', classId!), { modules: updatedModules });
      alert('Plano salvo com sucesso!');
    } catch (e) {
      alert('Erro ao salvar o plano no servidor.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-red-400 font-semibold">{error}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-white underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── PRINT HEADER (only visible when printing) ── */}
      <div className="hidden print:block print:mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PLANO DE ENSINO</h1>
        <p className="text-sm text-gray-600 mt-1">Educação Profissional por Competências</p>
        <hr className="mt-3 border-gray-400" />
      </div>

      {/* ── SCREEN HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-industrial-700 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Plano de Ensino</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {classPlan?.name} → <span className="text-primary font-semibold">{mod?.name}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {plan && (
            <>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-slate-300 rounded-xl font-medium text-sm flex items-center gap-2 transition-all"
              >
                <Printer size={15} /> Imprimir / PDF
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md"
              >
                <Save size={15} />
                {saving ? 'Salvando...' : 'Salvar Plano'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── FORM DE ENTRADA ── */}
      <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 relative overflow-hidden print:hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
        <div className="absolute top-3 right-4 flex items-center gap-1.5 text-accent text-[10px] font-bold">
          <Sparkles size={12} /> Sentry AI
        </div>

        <h2 className="text-base font-bold text-white mb-4">Dados para Geração do Plano</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nome do Docente *</label>
            <input
              type="text" value={docente} onChange={e => setDocente(e.target.value)}
              placeholder="Ex: Prof. João da Silva"
              className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Semestre</label>
            <select
              value={semestre} onChange={e => setSemestre(e.target.value)}
              className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all cursor-pointer"
            >
              {['1º Semestre', '2º Semestre', '3º Semestre', '4º Semestre', '5º Semestre', '6º Semestre'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">CH Total do Módulo</label>
            <div className="flex items-center gap-2 bg-industrial-900 border border-industrial-700 rounded-xl px-3 py-2.5">
              <span className="text-sm font-mono font-bold text-primary">{mod?.hours ?? 0}h</span>
              <span className="text-slate-600 text-xs">total</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">CH Formativa (h)</label>
            <input
              type="number" value={chFormativa}
              onChange={e => setChFormativa(Number(e.target.value))}
              min={0} max={mod?.hours ?? 0}
              className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">CH Somativa (h)</label>
            <input
              type="number" value={chSomativa}
              onChange={e => setChSomativa(Number(e.target.value))}
              min={0} max={mod?.hours ?? 0}
              className="w-full bg-industrial-900 border border-industrial-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all font-mono"
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <div className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${chFormativa + chSomativa === (mod?.hours ?? 0) ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
              <CheckCircle2 size={14} />
              {chFormativa + chSomativa === (mod?.hours ?? 0) ? `Carga horária correta: ${chFormativa + chSomativa}h / ${mod?.hours}h` : `Atenção: ${chFormativa + chSomativa}h atribuídas de ${mod?.hours}h total`}
            </div>
          </div>
        </div>

        {/* Competências pré-carregadas */}
        {mod && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 p-3 bg-industrial-900/60 rounded-xl border border-industrial-700/40">
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500 mb-1.5">Capacidades Técnicas</p>
              <TagList items={mod.technicalCapabilities ?? []} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500 mb-1.5">Conhecimentos</p>
              <TagList items={mod.knowledge ?? []} />
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-500 mb-1.5">Cap. Sociais / Metodológicas</p>
              <TagList items={mod.socioemotionalCapabilities ?? []} />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-3.5 bg-gradient-to-r from-primary to-accent hover:from-blue-600 hover:to-emerald-600 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/20 transition-all text-sm cursor-pointer"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sentry AI está estruturando o Plano de Ensino...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {plan ? 'Regenerar Plano com Sentry AI' : 'Gerar Plano de Ensino com Sentry AI'}
            </>
          )}
        </button>
      </div>

      {/* ── RESULTADO ── */}
      {plan && (
        <div className="space-y-4 print:space-y-6">

          {/* IDENTIFICAÇÃO */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl p-6 print:border-gray-300 print:bg-white">
            <SectionHeader icon={<BookOpen size={16} />} title="1. Identificação" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
              {[
                ['Docente', plan.identificacao.docente],
                ['Curso', plan.identificacao.curso],
                ['Unidade Curricular', plan.identificacao.unidadeCurricular],
                ['Módulo / Turma', plan.identificacao.modulo],
                ['Semestre', plan.identificacao.semestre],
                ['CH Total', `${plan.identificacao.chTotal}h`],
                ['CH Formativa', `${plan.identificacao.chFormativa}h`],
                ['CH Somativa', `${plan.identificacao.chSomativa}h`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[9px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
                  <p className="text-white font-medium">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-industrial-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Capacidades Técnicas</p>
                <TagList items={plan.competencias.capacidadesTecnicas} />
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Conhecimentos</p>
                <TagList items={plan.competencias.conhecimentos} />
              </div>
              <div>
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Capacidades Sociais / Metodológicas</p>
                <TagList items={plan.competencias.capacidadesSociais} />
              </div>
            </div>
          </div>

          {/* SITUAÇÃO DE APRENDIZAGEM */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl overflow-hidden print:border-gray-300 print:bg-white">
            <button
              onClick={() => toggleSection('situacao')}
              className="w-full flex items-center justify-between p-5 hover:bg-industrial-700/30 transition-colors print:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary"><FlaskConical size={15} /></div>
                <span className="font-bold text-white text-sm">2. Situação de Aprendizagem (Formativa)</span>
              </div>
              {expandedSections.situacao ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {(expandedSections.situacao) && (
              <div className="px-6 pb-6 pt-0 print:pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-industrial-900 rounded-xl p-4 border border-industrial-700/50 print:border-gray-200 print:bg-gray-50">
                    <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Contexto</p>
                    <p className="text-sm text-slate-300 leading-relaxed print:text-gray-700">{plan.situacaoAprendizagem.contexto}</p>
                  </div>
                  <div className="bg-industrial-900 rounded-xl p-4 border border-industrial-700/50 print:border-gray-200 print:bg-gray-50">
                    <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Desafio</p>
                    <p className="text-sm text-slate-300 leading-relaxed print:text-gray-700">{plan.situacaoAprendizagem.desafio}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Atividades', items: plan.situacaoAprendizagem.atividades },
                    { label: 'Recursos', items: plan.situacaoAprendizagem.recursos },
                    { label: 'Resultados Esperados', items: plan.situacaoAprendizagem.resultadosEsperados },
                  ].map(({ label, items }) => (
                    <div key={label} className="bg-industrial-900 rounded-xl p-4 border border-industrial-700/50 print:border-gray-200 print:bg-gray-50">
                      <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">{label}</p>
                      <ul className="space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="flex gap-2 text-xs text-slate-300 print:text-gray-700">
                            <span className="text-primary mt-0.5 flex-shrink-0">›</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PLANEJAMENTO DIDÁTICO */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl overflow-hidden print:border-gray-300 print:bg-white">
            <button
              onClick={() => toggleSection('didatico')}
              className="w-full flex items-center justify-between p-5 hover:bg-industrial-700/30 transition-colors print:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary"><ClipboardList size={15} /></div>
                <span className="font-bold text-white text-sm">3. Planejamento Didático</span>
              </div>
              {expandedSections.didatico ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expandedSections.didatico && (
              <div className="px-6 pb-6 pt-0 print:pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-industrial-700">
                        {['Estratégia', 'Conteúdo', 'Recursos', 'CH (h)', 'Intervenção do Docente'].map(h => (
                          <th key={h} className="text-left text-[9px] uppercase font-bold text-slate-500 py-2 pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-industrial-700/50">
                      {plan.planejamentoDidatico.map((row: DidacticStrategy, i: number) => (
                        <tr key={i} className="hover:bg-industrial-700/20 transition-colors">
                          <td className="py-3 pr-4 text-primary font-semibold">{row.estrategia}</td>
                          <td className="py-3 pr-4 text-slate-300">{row.conteudo}</td>
                          <td className="py-3 pr-4 text-slate-400">{row.recursos}</td>
                          <td className="py-3 pr-4 font-mono font-bold text-white">{row.cargaHoraria}h</td>
                          <td className="py-3 text-slate-400 italic">{row.intervencao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* AVALIAÇÃO FORMATIVA */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl overflow-hidden print:border-gray-300 print:bg-white">
            <button
              onClick={() => toggleSection('formativa')}
              className="w-full flex items-center justify-between p-5 hover:bg-industrial-700/30 transition-colors print:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-accent/10 border border-accent/20 rounded-lg text-accent"><CheckCircle2 size={15} /></div>
                <span className="font-bold text-white text-sm">4. Avaliação Formativa</span>
              </div>
              {expandedSections.formativa ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expandedSections.formativa && (
              <div className="px-6 pb-6 pt-0 print:pt-6 space-y-3">
                <div className="flex flex-wrap gap-4 text-xs mb-3">
                  <div><span className="text-slate-500">Instrumento: </span><span className="text-white font-medium">{plan.avaliacaoFormativa.instrumento}</span></div>
                  <div><span className="text-slate-500">Periodicidade: </span><span className="text-white font-medium">{plan.avaliacaoFormativa.periodicidade}</span></div>
                </div>
                <div className="space-y-2">
                  {plan.avaliacaoFormativa.criterios.map((c, i) => <CriterioRow key={i} c={c} index={i} />)}
                </div>
              </div>
            )}
          </div>

          {/* SITUAÇÃO PROBLEMA + AVALIAÇÃO SOMATIVA */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl overflow-hidden print:border-gray-300 print:bg-white">
            <button
              onClick={() => toggleSection('somativa')}
              className="w-full flex items-center justify-between p-5 hover:bg-industrial-700/30 transition-colors print:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400"><FlaskConical size={15} /></div>
                <span className="font-bold text-white text-sm">5. Situação-Problema e Avaliação Somativa</span>
              </div>
              {expandedSections.somativa ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expandedSections.somativa && (
              <div className="px-6 pb-6 pt-0 print:pt-6 space-y-5">
                <div className="bg-industrial-900 rounded-xl p-5 border border-industrial-700/60">
                  <p className="text-[9px] uppercase font-bold text-orange-400 mb-1">Título da Atividade Somativa</p>
                  <p className="text-base font-bold text-white mb-3">{plan.situacaoProblema.titulo}</p>
                  <p className="text-sm text-slate-300 leading-relaxed mb-4">{plan.situacaoProblema.descricao}</p>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500 mb-2">Entregáveis</p>
                    <ul className="space-y-1">
                      {plan.situacaoProblema.entregaveis.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-300">
                          <span className="text-orange-400 mt-0.5 flex-shrink-0">›</span><span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] uppercase font-bold text-slate-500">Critérios de Avaliação Somativa</p>
                    <span className="text-[9px] text-slate-500">Instrumento: {plan.avaliacaoSomativa.instrumento}</span>
                  </div>
                  <div className="space-y-2">
                    {plan.avaliacaoSomativa.criterios.map((c, i) => <CriterioRow key={i} c={c} index={i} />)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NÍVEIS DE DESEMPENHO */}
          <div className="bg-industrial-800 border border-industrial-700 rounded-2xl overflow-hidden print:border-gray-300 print:bg-white">
            <button
              onClick={() => toggleSection('niveis')}
              className="w-full flex items-center justify-between p-5 hover:bg-industrial-700/30 transition-colors print:hidden"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/10 border border-primary/20 rounded-lg text-primary"><BarChart3 size={15} /></div>
                <span className="font-bold text-white text-sm">6. Níveis de Desempenho</span>
              </div>
              {expandedSections.niveis ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
            </button>
            {expandedSections.niveis && (
              <div className="px-6 pb-6 pt-0 print:pt-6 overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-industrial-700">
                      {['Nível', 'Critérios Atingidos', 'Classificação', 'Nota Final'].map(h => (
                        <th key={h} className="text-left text-[9px] uppercase font-bold text-slate-500 py-2 pr-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-industrial-700/30">
                    {plan.niveisDesempenho.map(n => {
                      const colorMap: Record<string, string> = {
                        'Insatisfatório': 'text-red-400',
                        'Em Desenvolvimento': 'text-amber-400',
                        'Satisfatório': 'text-blue-400',
                        'Destaque': 'text-emerald-400',
                        'Excelência': 'text-primary',
                      };
                      const color = Object.keys(colorMap).find(k => n.tipo.includes(k));
                      return (
                        <tr key={n.nivel} className="hover:bg-industrial-700/20 transition-colors">
                          <td className="py-2.5 pr-6">
                            <span className="w-7 h-7 rounded-full bg-industrial-900 border border-industrial-700 text-white font-bold text-xs flex items-center justify-center">{n.nivel}</span>
                          </td>
                          <td className="py-2.5 pr-6 text-slate-300">{n.criteriosAtingidos}</td>
                          <td className={`py-2.5 pr-6 font-bold ${color ? colorMap[color] : 'text-slate-400'}`}>{n.tipo}</td>
                          <td className="py-2.5 font-mono font-extrabold text-white text-sm">{n.notaFinal.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PRINT FOOTER */}
          <div className="hidden print:block mt-10 pt-6 border-t border-gray-300">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-gray-500">Assinatura do Docente</p>
                <div className="mt-8 border-b border-gray-400 w-full" />
                <p className="text-xs text-gray-600 mt-1">{plan.identificacao.docente}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Aprovação da Coordenação</p>
                <div className="mt-8 border-b border-gray-400 w-full" />
                <p className="text-xs text-gray-600 mt-1">Data: ______ / ______ / __________</p>
              </div>
            </div>
          </div>

          {/* Bottom save bar */}
          <div className="flex justify-end gap-3 print:hidden pb-4">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-industrial-800 border border-industrial-700 hover:bg-industrial-700 text-slate-300 rounded-xl font-medium text-sm flex items-center gap-2 transition-all"
            >
              <Printer size={15} /> Imprimir / PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-accent hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-md"
            >
              <Save size={15} />
              {saving ? 'Salvando...' : 'Salvar Plano no Sistema'}
            </button>
          </div>
        </div>
      )}

      {/* Print CSS */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:border-gray-300 { border-color: #d1d5db !important; }
          .print\\:bg-gray-50 { background: #f9fafb !important; }
          .print\\:text-gray-700 { color: #374151 !important; }
          .print\\:space-y-4 > * + * { margin-top: 1rem !important; }
          .print\\:space-y-6 > * + * { margin-top: 1.5rem !important; }
          .print\\:pt-6 { padding-top: 1.5rem !important; }
          .rounded-2xl, .rounded-xl, .rounded-3xl { border-radius: 0 !important; }
          table { border-collapse: collapse; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
        }
      `}</style>
    </div>
  );
}
