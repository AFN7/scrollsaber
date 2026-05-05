import * as React from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastCtx = React.createContext<ToastContextValue | null>(null);

export function useToaster(): ToastContextValue {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) throw new Error('useToaster must be used under ToasterProvider');
  return ctx;
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, 'id'>): string => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { ...t, id }]);
    return id;
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      <ToastProvider swipeDirection="right">
        {children}
        {items.map((item) => (
          <Toast
            key={item.id}
            variant={item.variant}
            duration={item.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
          >
            <div className="grid gap-1">
              {item.title && <ToastTitle>{item.title}</ToastTitle>}
              {item.description && (
                <ToastDescription>{item.description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastCtx.Provider>
  );
}
