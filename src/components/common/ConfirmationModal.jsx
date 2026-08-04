import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Are you sure?", 
  message = "This action cannot be undone.", 
  confirmText = "Delete", 
  isLoading = false 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={onConfirm} 
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-rose-500 text-white hover:bg-rose-600 rounded-xl font-semibold shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
