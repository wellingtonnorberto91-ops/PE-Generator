import { useState, useEffect, useRef } from 'react';
import { sendMessageToCopilot, finalizeCopilotGeneration } from '../../features/ai-core/gemini';
import type { CopilotMessage } from '../../features/ai-core/gemini';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'PLAN' | 'ACTIVITIES' | 'REPORT';
  contextData: any;
  onApply: (result: any) => void;
}

export function SentryCopilot({ isOpen, onClose, mode, contextData, onApply }: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Determinar rótulos e saudações contextuais
  const getContextMeta = () => {
    switch (mode) {
      case 'PLAN':
        return {
          title: 'Ajuste de Plano MSEP',
          greeting: `Olá! Sou o Sentry AI Copilot. Analisei o Plano de Ensino da UC de **${contextData?.unitName || 'Curso'}**. A versão inicial está pronta na sua tela. Como você prefere refinar os critérios ou a situação de aprendizagem? Tem algum equipamento de laboratório específico ou projeto de mercado que gostaria de focar?`
        };
      case 'ACTIVITIES':
        const labels: Record<string, string> = {
          'SA': 'Desafio Prático (MSEP)',
          'ESTUDO_CASO': 'Estudo de Caso',
          'TEORICA': 'Avaliação Teórica / Formativa'
        };
        const intLabel = labels[contextData?.intention || 'SA'] || 'Avaliação';
        return {
          title: `Atividades de ${intLabel}`,
          greeting: `Olá! Vamos estruturar as atividades de avaliação para a UC de **${contextData?.unitName || 'Módulo'}** com foco na intenção **${intLabel}**. Qual cenário de mercado ou desafio prático você gostaria de propor aos alunos?`
        };
      case 'REPORT':
        return {
          title: 'Elaboração de Parecer',
          greeting: `Olá! Analisei as médias e o rendimento geral da turma **${contextData?.className || 'Geral'}** na UC de **${contextData?.unitName || 'Curso'}**. Gostaria de acrescentar alguma justificativa específica de faltas dos alunos, ou tem alguma ação de recuperação em mente para estruturarmos no plano de ação?`
        };
    }
  };

  const meta = getContextMeta();

  // Resetar chat e colocar a saudação inicial toda vez que abrir o drawer
  useEffect(() => {
    if (isOpen) {
      setMessages([
        { role: 'model', text: meta.greeting }
      ]);
      setInput('');
      setSending(false);
      setConsolidating(false);
    }
  }, [isOpen, mode, contextData?.unitName]);

  // Rolar para o final ao receber mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userText = input.trim();
    setInput('');
    
    // Adicionar mensagem do usuário localmente
    const updatedHistory = [...messages, { role: 'user', text: userText } as CopilotMessage];
    setMessages(updatedHistory);
    setSending(true);

    try {
      const reply = await sendMessageToCopilot(mode, messages, userText, contextData);
      setMessages([...updatedHistory, { role: 'model', text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages([...updatedHistory, { role: 'model', text: 'Houve uma falha ao contatar o Sentry AI Copilot. Verifique as configurações de rede e API.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleConsolidate = async () => {
    if (consolidating) return;
    setConsolidating(true);

    try {
      const result = await finalizeCopilotGeneration(mode, messages, contextData);
      onApply(result);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao consolidar as decisões do copiloto. Tente novamente.');
    } finally {
      setConsolidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-industrial-950 border-l border-industrial-700 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      
      {/* Header */}
      <div className="p-4 bg-industrial-900 border-b border-industrial-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <div>
            <h3 className="text-xs uppercase font-extrabold text-white tracking-widest font-mono">Sentry Copilot</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{meta.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleConsolidate}
            disabled={consolidating || sending}
            className="px-3 py-1.5 bg-gradient-to-r from-primary to-accent hover:from-blue-600 hover:to-emerald-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 transition-all shadow cursor-pointer font-mono"
            title="Extrai os pontos acordados e aplica no app"
          >
            {consolidating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            {consolidating ? 'Aplicando...' : 'Aplicar'}
          </button>
          
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-industrial-850 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-industrial-950/60">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed font-sans ${
              msg.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none shadow-md shadow-blue-500/5' 
                : 'bg-industrial-900/90 border border-industrial-750 text-slate-200 rounded-tl-none'
            }`}>
              {/* Tratar quebras de linha simples e negritos markdown em parágrafos */}
              {msg.text.split('\n').map((para, pIdx) => {
                if (!para.trim()) return <div key={pIdx} className="h-1.5" />;
                
                // Parser de negrito inline básico
                const parts = para.split('**');
                const parsedContent = parts.map((part, partIdx) => 
                  partIdx % 2 === 1 ? <strong key={partIdx} className="font-bold text-white">{part}</strong> : part
                );

                return (
                  <p key={pIdx} className="my-0.5">
                    {parsedContent}
                  </p>
                );
              })}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-industrial-900/60 border border-industrial-750 p-3 rounded-2xl rounded-tl-none text-slate-400 text-xs flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span className="font-mono text-[10px] animate-pulse">Sentry AI elaborando resposta...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Form */}
      <form onSubmit={handleSend} className="p-3 bg-industrial-900 border-t border-industrial-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Diga ao Sentry o que focar ou mudar..."
          disabled={sending || consolidating}
          className="flex-1 bg-industrial-950 border border-industrial-750 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:border-primary outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || consolidating}
          className="p-2.5 bg-primary hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl transition-all cursor-pointer shadow-md"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
