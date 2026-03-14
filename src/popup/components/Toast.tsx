import type { ToastState } from '../hooks/useToast';

interface ToastProps {
  toast: ToastState;
}

export default function Toast({ toast }: ToastProps) {
  if (!toast.message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded-lg shadow-lg px-4 py-2 transition-opacity duration-300 pointer-events-none z-50 ${
        toast.visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {toast.message}
    </div>
  );
}
