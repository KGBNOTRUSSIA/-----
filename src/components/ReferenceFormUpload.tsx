import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, CheckCircle2, Bookmark, Loader2, Sparkles } from 'lucide-react';

interface ReferenceForm {
  programName: string;
  fileName: string;
}

const PRESET_PROGRAMS = ['마이크로티칭', '교수코칭', 'SEMO Class 수업컨설팅', '티칭 클리닉'];

export default function ReferenceFormUpload() {
  const [forms, setForms] = useState<ReferenceForm[]>([]);
  const [programName, setProgramName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/reference-forms')
      .then(r => r.json())
      .then(data => {
        if (data.forms) setForms(data.forms);
      })
      .catch(() => {});
  }, []);

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || ext === 'hwp' || ext === 'hwpx') {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('PDF, HWP, HWPX 파일만 업로드 가능합니다.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!programName.trim() || !selectedFile) return;
    setUploading(true); setError(null);
    const formData = new FormData();
    formData.append('reference', selectedFile);
    formData.append('programName', programName.trim());
    try {
      const res = await fetch('/api/reference-form', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '업로드 실패');
      setForms(prev => {
        const filtered = prev.filter(f => f.programName !== programName.trim());
        return [...filtered, { programName: programName.trim(), fileName: selectedFile.name }];
      });
      setProgramName(''); setSelectedFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadPreset = async (name: string) => {
    setUploading(true); setError(null);
    try {
      const res = await fetch(`/api/preset-reference/${encodeURIComponent(name)}`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '로드 실패');
      setForms(prev => {
        const filtered = prev.filter(f => f.programName !== name);
        return [...filtered, { programName: name, fileName: `[${name}] 신청서.pdf` }];
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeForm = async (name: string) => {
    try {
      await fetch(`/api/reference-form/${encodeURIComponent(name)}`, { method: 'DELETE' });
      setForms(prev => prev.filter(f => f.programName !== name));
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      {/* Preset Buttons */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-500 mb-2">프로그램 선택 (프리셋)</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROGRAMS.map(name => (
            <button
              key={name}
              onClick={() => loadPreset(name)}
              disabled={uploading || forms.some(f => f.programName === name)}
              className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                forms.some(f => f.programName === name)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-400'
              }`}
            >
              {forms.some(f => f.programName === name) ? (
                <><CheckCircle2 size={13} /> {name}</>
              ) : (
                <><Sparkles size={13} /> {name}</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Upload */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-500 mb-3">또는 새 기준 양식 업로드</p>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">프로그램 명</label>
            <input type="text" value={programName}
              onChange={e => setProgramName(e.target.value)}
              placeholder="예) AI 교육, SW 기초..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">기준 양식 파일 (PDF/HWP)</label>
            <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg px-4 py-4 text-center cursor-pointer transition-all duration-200 ${
                isDragActive ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
              }`}>
              <input ref={fileInputRef} type="file" accept=".pdf,.hwp,.hwpx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {selectedFile ? (
                <span className="text-sm text-blue-600 font-medium flex items-center justify-center gap-1.5">
                  <FileText size={14} /> {selectedFile.name}
                </span>
              ) : (
                <span className="text-sm text-slate-400 flex items-center justify-center gap-1.5">
                  <Upload size={14} /> Drag & Drop 또는 클릭
                </span>
              )}
            </div>
          </div>

          <button onClick={handleUpload}
            disabled={!programName.trim() || !selectedFile || uploading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer shrink-0">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />}
            등록
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}

      {forms.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-400 mb-2">등록된 기준 양식</p>
          <div className="flex flex-wrap gap-2">
            {forms.map(f => (
              <div key={f.programName}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs">
                <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                <span className="font-medium text-blue-800">{f.programName}</span>
                <span className="text-blue-400">|</span>
                <span className="text-blue-600 truncate max-w-[120px]">{f.fileName}</span>
                <button onClick={() => removeForm(f.programName)}
                  className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}