import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight, Sofa } from 'lucide-react';

const Login = () => {
  const { login } = useApp();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password.trim()) {
      toast.error('Please enter your ID and password');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const success = login(id.trim(), password);
      if (!success) toast.error('Invalid credentials. Please try again.');
      setLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-zinc-950 px-4">
      
      {/* ── Background Image & Overlay ── */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center animate-in fade-in duration-[2000ms]"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=2000)' }}
      />
      <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />
      
      {/* ── Glassmorphism Login Card ── */}
      <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            
          {/* Subtle glow effect behind card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-[60px] pointer-events-none" />

          {/* Logo & Branding */}
          <div className="flex flex-col items-center mb-10 relative">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}>
              <Sofa className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-heading font-bold tracking-tight text-white mb-1">
              JGS
            </h1>
            <p className="text-[11px] font-medium tracking-[0.3em] uppercase"
              style={{ color: 'hsl(38 72% 60%)' }}>
              Interior Management
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 relative">
            <div>
              <Label htmlFor="id" className="text-[11px] font-semibold uppercase tracking-widest text-white/70 ml-1">
                Username / ID
              </Label>
              <Input
                id="id"
                value={id}
                onChange={e => setId(e.target.value)}
                className="mt-2 h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-amber-500/50 text-base px-5 transition-all focus:bg-black/40"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-widest text-white/70 ml-1">
                Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-14 rounded-2xl bg-black/20 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-amber-500/50 text-base px-5 pr-12 transition-all focus:bg-black/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl font-bold text-base gap-2 text-white shadow-lg transition-all duration-300 hover:opacity-90 hover:scale-[1.02] mt-6 border border-white/10"
              style={{ background: 'linear-gradient(135deg, hsl(38 72% 38%), hsl(32 85% 50%))' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : (<>Secure Login <ArrowRight className="w-5 h-5" /></>)}
            </Button>
          </form>

        </div>
        
      </div>
    </div>
  );
};

export default Login;
