import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type DialogOptions = {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'danger' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
};

interface DialogContextType {
  showAlert: (message: string, title?: string, type?: DialogOptions['type']) => Promise<void>;
  showConfirm: (message: string, title?: string, type?: DialogOptions['type']) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showAlert = (message: string, title = 'Aviso', type: DialogOptions['type'] = 'info') => {
    return new Promise<void>((resolve) => {
      setDialog({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'OK',
        onConfirm: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  };

  const showConfirm = (message: string, title = 'Confirmação', type: DialogOptions['type'] = 'warning') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        title,
        message,
        type,
        showCancel: true,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        },
      });
    });
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-800 transform transition-all scale-100">
            <div className="p-6">
              <div className="flex flex-col items-center text-center gap-4">
                {dialog.type === 'danger' || dialog.type === 'warning' ? (
                   <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                     <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                   </div>
                ) : dialog.type === 'success' ? (
                   <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                     <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                   </div>
                ) : (
                   <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                     <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                   </div>
                )}
                
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{dialog.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm whitespace-pre-wrap">{dialog.message}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 flex gap-3 justify-end border-t border-gray-100 dark:border-gray-800">
              {dialog.showCancel && (
                <button
                  type="button"
                  onClick={dialog.onCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-1"
                >
                  {dialog.cancelText}
                </button>
              )}
              <button
                type="button"
                onClick={dialog.onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex-1 ${
                  dialog.type === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : dialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : dialog.type === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
