import React from 'react';
import { DocumentItem } from '../types';

interface StatsPanelProps {
  items: DocumentItem[];
  isProcessing: boolean;
  selectedCount: number;
}

export default function StatsPanel({ items, isProcessing, selectedCount }: StatsPanelProps) {
  const successCount = items.filter(i => i.status === 'success').length;
  const errorCount = items.filter(i => i.status === 'error').length;
  const progressPercentage = items.length > 0 ? Math.round((successCount / items.length) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-sm font-bold text-slate-700">실시간 처리 현황</h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isProcessing ? 'bg-crimson/10 text-crimson animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
            {isProcessing ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>

        <div className="space-y-3.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">대기 중인 파일</span>
            <span className="font-semibold text-slate-700">{selectedCount}건</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">분석 중</span>
            <span className={`font-semibold ${isProcessing ? 'text-crimson' : 'text-slate-500'}`}>{isProcessing ? '작업 진행 중' : '0건'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">분석 완료</span>
            <span className="font-semibold text-green-600">{successCount}건</span>
          </div>
          {errorCount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">분석 에러</span>
              <span className="font-semibold text-rose-600">{errorCount}건</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
          <span>완료 진행률</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div className="bg-crimson h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.max(items.length > 0 ? 5 : 0, progressPercentage)}%` }} />
        </div>
      </div>
    </div>
  );
}