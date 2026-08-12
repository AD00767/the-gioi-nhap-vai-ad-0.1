import React from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function ensure9DigitId(fallbackId?: string, numericId?: string): string {
  if (numericId) {
    const str = String(numericId).trim();
    const clean = str.replace(/\D/g, '');
    if (clean.length === 9) {
      return clean;
    }
    if (clean.length > 0 && clean.length < 9) {
      return clean.padStart(9, '1');
    }
    if (clean.length > 9) {
      return clean.slice(0, 9);
    }
  }
  
  if (!fallbackId) return '';
  
  let hash = 0;
  for (let i = 0; i < fallbackId.length; i++) {
    hash = (hash << 5) - hash + fallbackId.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const num = (positive % 899999999) + 100000000;
  return num.toString();
}

interface DisplayIdProps {
  type: 'character' | 'prompt' | 'user' | 'creator';
  numericId?: string;
  fallbackId?: string;
  className?: string;
}

export default function DisplayId({ type, numericId, fallbackId, className = '' }: DisplayIdProps) {
  const [copied, setCopied] = React.useState(false);

  const validNumericId = ensure9DigitId(fallbackId, numericId);

  if (!validNumericId) return null;

  const displayId = `${type}/${validNumericId}`;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(displayId)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast.success("Đã sao chép ID");
        })
        .catch(() => {
          toast.error("Không thể sao chép ID.");
        });
    } else {
      toast.error("Không thể sao chép ID.");
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-800/50 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700/50 max-w-full overflow-hidden ${className}`}>
      <span className="truncate" title={displayId}>{displayId}</span>
      <button 
        onClick={handleCopy}
        className="p-1 hover:text-black dark:hover:text-white transition-colors shrink-0"
        aria-label="Sao chép ID"
        title="Sao chép ID"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

