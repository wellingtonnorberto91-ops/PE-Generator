import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DropzoneProps {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  label?: string;
  className?: string;
}

export function Dropzone({ onDrop, accept, maxFiles = 1, label = 'Arraste um documento ou clique para selecionar', className }: DropzoneProps) {
  const handleDrop = useCallback((acceptedFiles: File[]) => {
    onDrop(acceptedFiles);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 overflow-hidden group",
        isDragActive ? "border-primary bg-primary/5" : "border-industrial-700 bg-industrial-800 hover:border-primary/50 hover:bg-industrial-800/80",
        isDragReject && "border-red-500 bg-red-500/5",
        className
      )}
    >
      <input {...getInputProps()} />
      
      {/* Background glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative z-10 flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
        {isDragReject ? (
          <AlertCircle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        ) : isDragActive ? (
          <UploadCloud className="w-12 h-12 text-primary mb-4 animate-bounce" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-industrial-900 border border-industrial-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <FileType className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        )}
        
        <p className="mb-2 text-sm text-slate-300 font-medium">
          {isDragActive ? "Solte o arquivo aqui..." : label}
        </p>
        <p className="text-xs text-slate-500 max-w-xs">
          O Sentry AI extrairá os dados automaticamente.
          <br/>
          Suporta PDF, Excel e Word.
        </p>
      </div>
    </div>
  );
}
