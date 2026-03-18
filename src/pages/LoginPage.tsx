import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Loader2, LogIn, UserPlus, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/projects', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      if (error.message === 'Email not confirmed') {
        toast({ title: '이메일 인증이 필요합니다', description: '가입 시 발송된 인증 메일을 확인해주세요.', variant: 'destructive' });
      } else {
        toast({ title: '로그인 실패', description: '이메일 또는 비밀번호를 확인해주세요.', variant: 'destructive' });
      }
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
    if (password !== confirmPassword) {
      toast({ title: '비밀번호가 일치하지 않습니다', description: '비밀번호 확인을 다시 입력해주세요.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { error, data } = await signUp(email, password, displayName.trim());
    setIsLoading(false);
    if (error) {
      toast({ title: '회원가입 실패', description: error.message, variant: 'destructive' });
    } else {
      if (data?.user?.identities?.length === 0) {
        // User already exists
        toast({ title: '이미 가입된 이메일입니다', description: '로그인 페이지에서 로그인해주세요.', variant: 'destructive' });
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setDisplayName('');
        return;
      }
      setSignUpSuccess(true);
    }
  };

  if (signUpSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          <Card>
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">이메일을 확인해주세요</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{email}</span>
                (으)로 인증 메일을 발송했습니다.
              </p>
              <p className="text-sm text-muted-foreground">
                메일함에서 인증 링크를 클릭하면 가입이 완료됩니다.
              </p>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => {
                  setSignUpSuccess(false);
                  setMode('login');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                로그인으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
            <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4" autoComplete={mode === 'signup' ? 'off' : 'on'}>
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
                    autoComplete="off"
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
                  autoComplete={mode === 'login' ? 'username' : 'off'}
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="비밀번호를 다시 입력해주세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className={passwordsMismatch ? 'border-destructive focus-visible:ring-destructive' : passwordsMatch ? 'border-primary focus-visible:ring-primary' : ''}
                  />
                  {passwordsMismatch && (
                    <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>
                  )}
                  {passwordsMatch && (
                    <p className="text-xs text-primary">비밀번호가 일치합니다</p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading || (mode === 'signup' && passwordsMismatch)}>
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

            <div className="mt-4 space-y-2 text-center">
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setPassword(''); }}
                  className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setDisplayName('');
                }}
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
