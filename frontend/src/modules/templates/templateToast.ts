import { toast } from 'sonner';
import { getApiErrorMessage } from '@/core/errors/apiError';

type AsyncTemplateToastOptions<T> = {
  loading: string;
  success: string | ((value: T) => string);
  error: string;
};

export async function runTemplateActionToast<T>(
  promise: Promise<T> | (() => Promise<T>),
  options: AsyncTemplateToastOptions<T>
) {
  const task = typeof promise === 'function' ? promise() : promise;
  const toastResult = toast.promise(task, {
    loading: options.loading,
    success: (value) => (typeof options.success === 'function' ? options.success(value) : options.success),
    error: (error) => getApiErrorMessage(error, options.error),
  });

  return toastResult.unwrap();
}
