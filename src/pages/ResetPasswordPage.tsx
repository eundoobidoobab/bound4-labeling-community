import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Loader2, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Check URL hash for recovery token
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: '비밀번호가 일치하지 않습니다', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: '비밀번호는 6자 이상이어야 합니다', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast({ title: '비밀번호 변경 실패', description: error.message, variant: 'destructive' });
    } else {
      setSuccess(true);
    }
  };

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
          <Card>
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-muted-foreground">새 비밀번호로 로그인할 수 있습니다.</p>
              <Button className="w-full mt-4" onClick={() => navigate('/projects', { replace: true })}>
                시작하기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card>
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">잘못된 접근입니다. 이메일의 비밀번호 재설정 링크를 통해 접속해주세요.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                로그인으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">바운드포 라벨링</h1>
        </div>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              새 비밀번호 설정
            </CardTitle>
            <CardDescription>새로운 비밀번호를 입력해주세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">비밀번호 확인</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="비밀번호를 다시 입력해주세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={passwordsMismatch ? 'border-destructive focus-visible:ring-destructive' : passwordsMatch ? 'border-primary focus-visible:ring-primary' : ''}
                />
                {passwordsMismatch && <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>}
                {passwordsMatch && <p className="text-xs text-primary">비밀번호가 일치합니다</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || passwordsMismatch}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                비밀번호 변경
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
