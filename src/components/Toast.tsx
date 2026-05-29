'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; type: ToastType }

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter
    setToasts(prev => [{ id, message, type }, ...prev])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none" style={{ minWidth: 280 }}>
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const icons = {
    success: <CheckCircle size={16} className="text-emerald-500 shrink-0" />,
    error:   <XCircle    size={16} className="text-red-400 shrink-0" />,
    info:    <AlertCircle size={16} className="text-blue-400 shrink-0" />,
  }

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-4 py-3 shadow-lg transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-12px)',
      }}
    >
      {icons[toast.type]}
      <span className="text-sm text-stone-700 font-medium flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-stone-300 hover:text-stone-500 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
