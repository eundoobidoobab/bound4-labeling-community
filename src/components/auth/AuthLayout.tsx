import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  animateType?: 'fade' | 'slide';
}

export default function AuthLayout({ children, showHeader = false, animateType = 'slide' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={animateType === 'slide' ? { opacity: 0, y: 20 } : { opacity: 0, scale: 0.95 }}
        animate={animateType === 'slide' ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {showHeader && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">바운드포 라벨링</h1>
            <p className="mt-2 text-sm text-muted-foreground">프로젝트 운영 플랫폼</p>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  );
}
