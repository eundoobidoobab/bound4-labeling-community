import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';

interface ForgotPasswordFormProps {
  email: string;
  isLoading: boolean;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export default function ForgotPasswordForm({ email, isLoading, onEmailChange, onSubmit, onBack }: ForgotPasswordFormProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">비밀번호 찾기</CardTitle>
        <CardDescription>가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgotEmail">이메일</Label>
            <Input
              id="forgotEmail"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            재설정 메일 보내기
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="inline mr-1 h-3 w-3" />
            로그인으로 돌아가기
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
