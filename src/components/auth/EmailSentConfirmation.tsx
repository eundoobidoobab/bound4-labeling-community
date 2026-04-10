import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { ReactNode } from 'react';

interface EmailSentConfirmationProps {
  email: string;
  icon?: ReactNode;
  title: string;
  description: string;
  onBack: () => void;
}

export default function EmailSentConfirmation({ email, icon, title, description, onBack }: EmailSentConfirmationProps) {
  return (
    <Card>
      <CardContent className="pt-8 pb-6 text-center space-y-4">
        <div className="flex justify-center">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{email}</span>
          {description}
        </p>
        <Button variant="outline" className="w-full mt-4" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          로그인으로 돌아가기
        </Button>
      </CardContent>
    </Card>
  );
}
