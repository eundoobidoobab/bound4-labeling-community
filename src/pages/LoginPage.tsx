import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import LoginForm from '@/components/auth/LoginForm';
import SignUpForm from '@/components/auth/SignUpForm';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import EmailSentConfirmation from '@/components/auth/EmailSentConfirmation';

const AUTH_COOLDOWN_SECONDS = 45;

const getAuthErrorInfo = (error: Error | null) => {
  const message = error?.message ?? '';
  const status = 'status' in (error ?? {}) ? Number((error as Error & { status?: number }).status) : undefined;
  const isRateLimited = status === 429 || message.includes('429') || message.toLowerCase().includes('rate limit');
  const isTimeout = status === 504 || message.includes('504') || message.toLowerCase().includes('timeout') || message.includes('deadline exceeded');
  const isAlreadyRegistered = message.includes('User already registered') || message.includes('already registered');

  if (isRateLimited) {
    return {
      shouldCooldown: true,
      title: '요청이 너무 많습니다',
      description: '여러 번 시도되어 인증 서버가 잠시 차단했습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  if (isTimeout) {
    return {
      shouldCooldown: true,
      title: '인증 서버 응답이 지연되고 있습니다',
      description: '요청이 실패로 보여도 계정이 생성됐을 수 있습니다. 잠시 후 로그인 또는 비밀번호 재설정을 먼저 시도해주세요.',
    };
  }

  if (isAlreadyRegistered) {
    return {
      shouldCooldown: false,
      title: '이미 가입된 이메일입니다',
      description: '회원가입을 반복하지 말고 로그인 또는 비밀번호 재설정을 이용해주세요.',
    };
  }

  return {
    shouldCooldown: false,
    title: '인증 실패',
    description: message || '잠시 후 다시 시도해주세요.',
  };
};

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate('/projects', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const resetFields = () => {
    setEmail(''); setPassword(''); setConfirmPassword(''); setDisplayName('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      const errorInfo = getAuthErrorInfo(error);
      if (errorInfo.shouldCooldown) setCooldownSeconds(AUTH_COOLDOWN_SECONDS);
      toast({
        title: error.message === 'Email not confirmed' ? '이메일 인증이 필요합니다' : errorInfo.title,
        description: error.message === 'Email not confirmed' ? '가입 시 발송된 인증 메일을 확인해주세요.' : errorInfo.description,
        variant: 'destructive',
      });
    } else {
      navigate('/projects', { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    if (!displayName.trim()) { toast({ title: '이름을 입력해주세요', variant: 'destructive' }); return; }
    if (password !== confirmPassword) { toast({ title: '비밀번호가 일치하지 않습니다', description: '비밀번호 확인을 다시 입력해주세요.', variant: 'destructive' }); return; }
    setIsLoading(true);
    const { error, data } = await signUp(email, password, displayName.trim());
    setIsLoading(false);
    if (error) {
      const errorInfo = getAuthErrorInfo(error);
      if (errorInfo.shouldCooldown) setCooldownSeconds(AUTH_COOLDOWN_SECONDS);
      toast({ title: errorInfo.title, description: errorInfo.description, variant: 'destructive' });
    } else if (data?.user?.identities?.length === 0) {
      toast({ title: '이미 가입된 이메일입니다', description: '로그인 페이지에서 로그인해주세요.', variant: 'destructive' });
      setMode('login'); setPassword(''); setConfirmPassword(''); setDisplayName('');
    } else {
      setSignUpSuccess(true);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ title: '메일 발송 실패', description: error.message, variant: 'destructive' });
    } else {
      setForgotSent(true);
    }
  };

  // Success states
  if (forgotSent) {
    return (
      <AuthLayout animateType="fade">
        <EmailSentConfirmation
          email={email}
          icon={<Mail className="h-16 w-16 text-primary" />}
          title="이메일을 확인해주세요"
          description="(으)로 비밀번호 재설정 메일을 발송했습니다."
          onBack={() => { setForgotSent(false); setMode('login'); setEmail(''); }}
        />
      </AuthLayout>
    );
  }

  if (signUpSuccess) {
    return (
      <AuthLayout animateType="fade">
        <EmailSentConfirmation
          email={email}
          icon={<CheckCircle2 className="h-16 w-16 text-primary" />}
          title="이메일을 확인해주세요"
          description="(으)로 인증 메일을 발송했습니다."
          onBack={() => { setSignUpSuccess(false); setMode('login'); setPassword(''); setConfirmPassword(''); }}
        />
      </AuthLayout>
    );
  }

  // Forgot password mode
  if (mode === 'forgot') {
    return (
      <AuthLayout showHeader>
        <ForgotPasswordForm
          email={email}
          isLoading={isLoading}
          onEmailChange={setEmail}
          onSubmit={handleForgotPassword}
          onBack={() => { setMode('login'); setEmail(''); }}
        />
      </AuthLayout>
    );
  }

  // Login / Signup mode
  return (
    <AuthLayout showHeader>
      {mode === 'login' ? (
        <LoginForm
          email={email}
          password={password}
          isLoading={isLoading}
          cooldownSeconds={cooldownSeconds}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
          onForgotPassword={() => { setMode('forgot'); setPassword(''); }}
          onSwitchToSignUp={() => { setMode('signup'); resetFields(); }}
        />
      ) : (
        <SignUpForm
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          displayName={displayName}
          isLoading={isLoading}
          cooldownSeconds={cooldownSeconds}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onDisplayNameChange={setDisplayName}
          onSubmit={handleSignUp}
          onSwitchToLogin={() => { setMode('login'); resetFields(); }}
        />
      )}
    </AuthLayout>
  );
}
