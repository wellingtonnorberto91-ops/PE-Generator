import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError('Credenciais inválidas ou erro no servidor.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-industrial-800 border border-industrial-700 rounded-xl shadow-2xl p-8 relative overflow-hidden">
        {/* Detalhe estético neon */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-wider">
            PE <span className="text-primary">GENERATOR</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest">Sentry AI Edition</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email Institucional</label>
            <input
              type="email"
              required
              className="w-full bg-industrial-900 border border-industrial-700 rounded-md px-4 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="docente@escola.edu.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Senha de Acesso</label>
            <input
              type="password"
              required
              className="w-full bg-industrial-900 border border-industrial-700 rounded-md px-4 py-2 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-md transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mt-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={18} />
                Entrar no Sistema
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-industrial-700 text-center">
          <p className="text-xs text-slate-500">
            Acesso restrito ao corpo docente da instituição.
          </p>
        </div>
      </div>
    </div>
  );
}
