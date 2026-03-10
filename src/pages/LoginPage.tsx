import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (user) {
    navigate('/projects', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast({ title: '로그인 실패', description: '이메일 또는 비밀번호를 확인해주세요.', variant: 'destructive' });
    } else {
      navigate('/projects', { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast({ title: '이름을 입력해주세요', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(email, password, displayName.trim());
    setIsLoading(false);
    if (error) {
      toast({ title: '회원가입 실패', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '회원가입 완료', description: '이메일을 확인하여 인증을 완료해주세요.' });
      setMode('login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">바운드포 라벨링</h1>
          <p className="mt-2 text-sm text-muted-foreground">프로젝트 운영 플랫폼</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{mode === 'login' ? '로그인' : '회원가입'}</CardTitle>
            <CardDescription>
              {mode === 'login' ? '계정 정보를 입력해주세요' : '새 계정을 만들어주세요'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">이름 (실명)</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="홍길동"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={mode === 'signup' ? '6자 이상' : ''}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : mode === 'login' ? (
                  <LogIn className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {mode === 'login' ? '로그인' : '회원가입'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
