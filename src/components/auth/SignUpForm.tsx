import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';

interface SignUpFormProps {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  isLoading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onDisplayNameChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToLogin: () => void;
}

export default function SignUpForm({
  email, password, confirmPassword, displayName, isLoading,
  onEmailChange, onPasswordChange, onConfirmPasswordChange, onDisplayNameChange,
  onSubmit, onSwitchToLogin,
}: SignUpFormProps) {
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">회원가입</CardTitle>
        <CardDescription>새 계정을 만들어주세요</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="displayName">이름 (실명)</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="홍길동"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              placeholder="6자 이상"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호를 다시 입력해주세요"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={passwordsMismatch ? 'border-destructive focus-visible:ring-destructive' : passwordsMatch ? 'border-primary focus-visible:ring-primary' : ''}
            />
            {passwordsMismatch && <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>}
            {passwordsMatch && <p className="text-xs text-primary">비밀번호가 일치합니다</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || passwordsMismatch}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            회원가입
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button type="button" onClick={onSwitchToLogin} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            이미 계정이 있으신가요? 로그인
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
