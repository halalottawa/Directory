import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantColors = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white'
  };

  const iconColors = {
    danger: 'text-red-600 bg-red-50',
    warning: 'text-yellow-600 bg-yellow-50',
    info: 'text-blue-600 bg-blue-50'
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-20"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative bg-white rounded-[32px] shadow-2xl max-w-sm w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8 space-y-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${iconColors[variant]}`}>
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
              <p className="text-gray-500 leading-relaxed">{message}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`w-full py-4 font-bold rounded-2xl transition-all active:scale-95 ${variantColors[variant]}`}
              >
                {confirmText}
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all active:scale-95"
              >
                {cancelText}
              </button>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
