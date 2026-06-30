import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Download, Sparkles } from 'lucide-react';
import ReferenceFormUpload from './components/ReferenceFormUpload.js';
import UploadZone from './components/UploadZone.js';
import StatsPanel from './components/StatsPanel.js';
import DataGrid from './components/DataGrid.js';
import { DocumentItem } from './types.js';
import * as XLSX from 'xlsx';

export default function App() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        await fetch('/api/parse-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkOnly: true })
        });
        setApiConfigured(true);
      } catch {
        setApiConfigured(false);
      }
    };
    checkStatus();
  }, []);

  const handleItemsParsed = (newItems: DocumentItem[]) => {
    setItems(prev => [...newItems, ...prev]);
  };

  const handleExport = () => {
    if (items.length === 0) return;
    const exportData = items.map(item => ({
      '성명': item.data.teacherName,
      '소속': item.data.teacherAffiliation,
      '희망 강좌': item.data.desiredCourse,
      '수강인원': item.data.studentCount,
      '수강학년': item.data.studentGrade,
      '수업촬영일': item.data.shootingDate,
      '강의실': item.data.classroom,
      '교수방법': item.data.teachingMethod,
      '마이크로티칭 요청사항': item.data.microteachingRequests,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '교원 신청자 현황');

    worksheet['!cols'] = [
      { wch: 12 }, { wch: 22 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
      { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 35 },
    ];

    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
    XLSX.writeFile(workbook, `교원_신청서류_취합_목록_${dateStr}.xlsx`);
  };

  const selectedCount = 0; // passed to StatsPanel

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              ED
            </div>
            <div>
              <h1 id="app-title" className="text-2xl font-bold text-slate-800 leading-tight tracking-tight">
                교원 서류 자동 분류 시스템
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                MVP V1.1 • 교원 신청서 자동 추출 및 엑셀 변환
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200">
            <div className={`w-2 h-2 rounded-full ${apiConfigured === false ? 'bg-rose-500' : 'bg-green-500 animate-pulse'}`} />
            <span className="text-xs font-medium text-slate-600">
              {apiConfigured === false ? '서버 연결 안됨' : '서버 연결됨'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-xs text-rose-800">
            <AlertTriangle size={18} className="shrink-0 text-rose-600" />
            <div>
              <p className="font-bold">안내 및 알림</p>
              <p className="mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Section 1: 기준 양식 업로드 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shrink-0">1</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">기준 양식 업로드</h2>
              <p className="text-xs text-slate-500">프로그램별 신청서 양식을 등록하면 해당 양식에 맞춰 데이터를 추출합니다.</p>
            </div>
          </div>
          <ReferenceFormUpload />
        </section>

        {/* Section 2+3: 서류 파일 업로드 + 실시간 처리 현황 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shrink-0">2</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">서류 파일 업로드 (HWP, PDF)</h2>
              <p className="text-xs text-slate-500">교원이 제출한 신청서 파일을 업로드하면 자동으로 데이터를 추출합니다.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <UploadZone
                onItemsParsed={handleItemsParsed}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                setError={setError}
                items={items}
              />
            </div>
            <div>
              <h3 className="sr-only">실시간 처리 현황</h3>
              <StatsPanel items={items} isProcessing={isProcessing} selectedCount={selectedCount} />
            </div>
          </div>
        </section>

        {/* Section 4: 데이터 검수 및 수정 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shrink-0">3</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">데이터 검수 및 수정</h2>
              <p className="text-xs text-slate-500">추출된 데이터를 확인하고 오류를 수정합니다.</p>
            </div>
          </div>
          <DataGrid
            items={items}
            setItems={setItems}
            isProcessing={isProcessing}
          />
        </section>

        {/* Section 5: 엑셀 파일 다운로드 */}
        {items.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shrink-0">4</span>
              <div>
                <h2 className="text-lg font-bold text-slate-800">엑셀 파일 다운로드</h2>
                <p className="text-xs text-slate-500">검수 완료된 데이터를 엑셀 파일로 내보냅니다.</p>
              </div>
            </div>
            <div className="bg-white border-2 border-rose-300 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles size={28} className="text-rose-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-800">최종 데이터 준비 완료</p>
                  <p className="text-xs text-slate-500">{items.length}건의 데이터를 엑셀 파일로 내보낼 수 있습니다.</p>
                </div>
              </div>
              <button
                onClick={handleExport}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-6 py-3 rounded-lg shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Download size={16} />
                엑셀(.xlsx) 내보내기
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 w-full">
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 font-medium justify-center sm:justify-start">
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Local Server Active</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> Local Parser Mode</span>
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div> SheetJS Integrated</span>
        </div>
        <div className="text-[11px] text-slate-400 text-center sm:text-right">
          © 2026 Education Resource Management System
        </div>
      </footer>
    </div>
  );
}