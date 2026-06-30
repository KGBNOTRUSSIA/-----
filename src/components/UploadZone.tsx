import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { DocumentItem, ParsedData } from '../types';

interface UploadZoneProps {
  onItemsParsed: (items: DocumentItem[]) => void;
  isProcessing: boolean;
  setIsProcessing: (loading: boolean) => void;
  setError: (msg: string | null) => void;
  items: DocumentItem[];
}

export default function UploadZone({ onItemsParsed, isProcessing, setIsProcessing, setError }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processSelectedFiles = (filesList: FileList | null) => {
    if (!filesList) return;
    const files = Array.from(filesList).filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ext === 'pdf' || ext === 'hwp' || ext === 'hwpx';
    });

    if (files.length === 0) {
      setError('지원하지 않는 파일 형식입니다. (PDF, HWP, HWPX 파일만 업로드 가능합니다.)');
      return;
    }

    if (selectedFiles.length + files.length > 20) {
      setError('1회 최대 20개 파일까지만 업로드 가능합니다.');
      const sliceCount = 20 - selectedFiles.length;
      if (sliceCount > 0) setSelectedFiles(prev => [...prev, ...files.slice(0, sliceCount)]);
    } else {
      setSelectedFiles(prev => [...prev, ...files]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    processSelectedFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setError(null);
  };

  const triggerUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/parse-documents', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '문서 분석 도중 오류가 발생했습니다.');
      }

      const parsedItems: DocumentItem[] = result.results.map((res: any, idx: number) => {
        const id = `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        const empty = { teacherName: '', teacherAffiliation: '', desiredCourse: '', studentCount: '', studentGrade: '', shootingDate: '', classroom: '', teachingMethod: '', microteachingRequests: '' };
        if (res.status === 'success') {
          return { id, fileName: res.fileName, status: 'success', data: { teacherName: res.data.teacherName || '', teacherAffiliation: res.data.teacherAffiliation || '', desiredCourse: res.data.desiredCourse || '', studentCount: res.data.studentCount || '', studentGrade: res.data.studentGrade || '', shootingDate: res.data.shootingDate || '', classroom: res.data.classroom || '', teachingMethod: res.data.teachingMethod || '', microteachingRequests: res.data.microteachingRequests || '' } };
        } else {
          return { id, fileName: res.fileName, status: 'error', error: res.error || 'AI 분석 오류', data: empty };
        }
      });

      onItemsParsed(parsedItems);
      setSelectedFiles([]);
    } catch (err: any) {
      setError(err.message || '서버 연결에 실패했거나 파싱에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.hwp,.hwpx" className="hidden" onChange={handleFileChange} disabled={isProcessing} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <Upload size={20} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">신청 서류 파일 업로드 (HWP, PDF)</p>
            <p className="text-xs text-slate-400 mt-1">Drag & Drop 또는 클릭하여 파일 선택 (최대 20개)</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-6 border-t border-slate-100 pt-5 overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-slate-500">대기 중인 파일 ({selectedFiles.length}개)</span>
              <button onClick={clearAllFiles} disabled={isProcessing}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer">전체 취소</button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden mr-4">
                    <FileText size={16} className="text-slate-400 shrink-0" />
                    <span className="truncate font-medium text-slate-700">{file.name}</span>
                    <span className="text-[10px] text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer" disabled={isProcessing}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={triggerUpload} disabled={isProcessing}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer">
                {isProcessing ? <><Loader2 size={14} className="animate-spin" /> 문서 파싱 및 분석 중...</> : <><CheckCircle2 size={14} /> 자동 분석 및 정규화 시작</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}