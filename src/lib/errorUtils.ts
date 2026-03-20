import { AuthError } from '@supabase/supabase-js';

/**
 * Supabase/네트워크 에러를 사용자 친화적 메시지로 변환
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  // 네트워크 오프라인
  if (!navigator.onLine) {
    return '인터넷 연결이 끊겼습니다. 연결 상태를 확인해주세요.';
  }

  // Supabase AuthError
  if (error instanceof AuthError) {
    const map: Record<string, string> = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'Email not confirmed': '이메일 인증이 필요합니다. 메일함을 확인해주세요.',
      'User already registered': '이미 가입된 이메일입니다.',
      'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
    };
    return map[error.message] || error.message;
  }

  // PostgrestError or generic Error
  if (error instanceof Error) {
    // 네트워크 관련 에러
    if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
      return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    // 타임아웃
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    // RLS / 권한
    if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
      return '해당 작업에 대한 권한이 없습니다.';
    }
    // 중복
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      return '이미 존재하는 데이터입니다.';
    }
    return error.message;
  }

  if (typeof error === 'string') return error;

  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

/**
 * 토스트용 에러 객체 반환
 */
export function toastError(error: unknown, fallbackTitle = '오류 발생') {
  return {
    title: fallbackTitle,
    description: getErrorMessage(error),
    variant: 'destructive' as const,
  };
}
