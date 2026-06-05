import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  onConfirm: (val: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, title, defaultValue, onConfirm, onCancel }) => {
  const [val, setVal] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) setVal(defaultValue);
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#171b26] border border-[#2a2e39] rounded-xl w-full max-w-sm p-4 shadow-xl text-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm tracking-wide">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input 
          autoFocus
          className="w-full bg-[#0b0e14] border border-[#2a2e39] rounded px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 mb-4 font-mono font-bold"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(val); if (e.key === 'Escape') onCancel(); }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded text-xs font-semibold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 cursor-pointer">Cancel</button>
          <button onClick={() => onConfirm(val)} className="px-4 py-2 rounded text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer">Confirm</button>
        </div>
      </div>
    </div>
  );
};
