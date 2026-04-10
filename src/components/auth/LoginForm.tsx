import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';

interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onSwitchToSignUp: () => void;
}

export default function LoginForm({
  email, password, isLoading,
  onEmailChange, onPasswordChange, onSubmit,
  onForgotPassword, onSwitchToSignUp,
}: LoginFormProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">로그인</CardTitle>
        <CardDescription>계정 정보를 입력해주세요</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            로그인
          </Button>
        </form>
        <div className="mt-4 space-y-2 text-center">
          <button type="button" onClick={onForgotPassword} className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
            비밀번호를 잊으셨나요?
          </button>
          <button type="button" onClick={onSwitchToSignUp} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            계정이 없으신가요? 회원가입
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
