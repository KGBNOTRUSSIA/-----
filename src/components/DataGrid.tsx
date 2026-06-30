import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Edit2, Trash2, Check, AlertTriangle, Info, Plus, 
  Search, CheckCircle, HelpCircle, Save, Download, RefreshCw 
} from 'lucide-react';
import { DocumentItem, ParsedData } from '../types';

interface DataGridProps {
  items: DocumentItem[];
  setItems: React.Dispatch<React.SetStateAction<DocumentItem[]>>;
  isProcessing: boolean;
}

export default function DataGrid({ items, setItems, isProcessing }: DataGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ParsedData } | null>(null);
  const [tempValue, setTempValue] = useState('');

  // Local Validation helper
  const getValidationError = (field: keyof ParsedData, value: string): string | null => {
    const trimmed = value.trim();

    if (field === 'shootingDate') {
      if (!trimmed) return '수업촬영일이 비어있습니다.';
      const dateRegex = /^\d{4}년 \d{2}월 \d{2}일$/;
      if (!dateRegex.test(trimmed)) {
        return "'YYYY년 MM월 DD일' 포맷을 유지해 주세요. (예: 2026년 06월 28일)";
      }
    }

    if (field === 'studentCount' && trimmed && !/^\d+$/.test(trimmed)) {
      return '숫자만 입력해 주세요.';
    }

    return null;
  };

  // Check if a item has any validation error
  const hasErrors = (item: DocumentItem) => {
    if (item.status === 'error') return true;
    return Object.keys(item.data).some(key => {
      const field = key as keyof ParsedData;
      return getValidationError(field, item.data[field]) !== null;
    });
  };

  // Edit action
  const startEditing = (id: string, field: keyof ParsedData, currentValue: string) => {
    setEditingCell({ id, field });
    setTempValue(currentValue);
  };

  const saveEdit = (id: string, field: keyof ParsedData) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          data: {
            ...item.data,
            [field]: tempValue
          }
        };
      }
      return item;
    }));
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const deleteRow = (id: string) => {
    if (confirm('선택하신 신청서 데이터를 삭제하시겠습니까?')) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const addNewRow = () => {
    const newId = `manual-${Date.now()}`;
    const newItem: DocumentItem = {
      id: newId,
      fileName: '수동 추가 데이터',
      status: 'success',
      data: {
        teacherName: '교원명',
        teacherAffiliation: 'OO학교',
        desiredCourse: '희망 강좌',
        studentCount: '30',
        studentGrade: '2학년',
        shootingDate: '2026년 06월 28일',
        classroom: '강의실',
        teachingMethod: '교수방법',
        microteachingRequests: '요청사항',
      }
    };
    setItems(prev => [newItem, ...prev]);
  };

  const clearAllData = () => {
    if (confirm('모든 검수 데이터를 초기화하시겠습니까?')) {
      setItems([]);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.fileName.toLowerCase().includes(query) ||
      item.data.teacherName.toLowerCase().includes(query) ||
      item.data.teacherAffiliation.toLowerCase().includes(query) ||
      item.data.desiredCourse.toLowerCase().includes(query) ||
      item.data.classroom.toLowerCase().includes(query)
    );
  });

  const totalErrors = items.reduce((acc, item) => {
    let itemErrorCount = 0;
    if (item.status === 'error') {
      itemErrorCount += 1;
    } else {
      Object.keys(item.data).forEach(key => {
        if (getValidationError(key as keyof ParsedData, item.data[key as keyof ParsedData])) {
          itemErrorCount += 1;
        }
      });
    }
    return acc + (itemErrorCount > 0 ? 1 : 0);
  }, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header and search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            추출 데이터 검수 및 수정
            {items.length > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-crimson/10 text-crimson rounded-full">
                전체 {items.length}건
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-click cells to edit • 변경값은 즉시 메모리에 반영됩니다.
          </p>
        </div>

        <div className="flex flex-wrap w-full sm:w-auto gap-2 items-center">
          <div className="relative w-full sm:w-48">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="검색어 입력..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-crimson"
            />
          </div>

          <button
            type="button"
            onClick={clearAllData}
            disabled={items.length === 0}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            전체 초기화
          </button>

          <button
            type="button"
            onClick={addNewRow}
            disabled={isProcessing}
            className="text-xs px-3 py-1.5 border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus size={12} />
            수동 추가
          </button>

          <button
        </div>
      </div>

      {/* Grid Status Overview */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${totalErrors > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">검수 권장 건수</p>
              <p className="text-base font-bold text-slate-800">
                {totalErrors} <span className="text-xs font-normal text-slate-500">건 (정규화 위배)</span>
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-crimson/10 text-crimson border border-crimson/20 rounded-lg">
              <CheckCircle size={18} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">완료된 데이터</p>
              <p className="text-base font-bold text-slate-800">
                {items.length - totalErrors} <span className="text-xs font-normal text-slate-500">건 / 전체 {items.length}건</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Wrapper */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[480px] custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2">
                <HelpCircle size={36} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">아직 업로드된 서류가 없습니다.</p>
                <p className="text-xs">상단의 PDF/HWP 파일을 올려 자동 분류를 시작해 보세요.</p>
              </div>
            ) : (
              <p className="text-xs">검색어와 일치하는 검수 데이터가 없습니다.</p>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[11px] text-slate-600">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10">
              <tr className="text-slate-500 uppercase tracking-tighter font-semibold">
                <th scope="col" className="px-4 py-3 w-[120px] bg-slate-50">파일명 및 상태</th>
                <th scope="col" className="px-4 py-3 w-[80px] bg-slate-50">성명</th>
                <th scope="col" className="px-4 py-3 w-[100px] bg-slate-50">소속</th>
                <th scope="col" className="px-4 py-3 w-[120px] bg-slate-50">희망 강좌</th>
                <th scope="col" className="px-4 py-3 w-[70px] bg-slate-50">수강인원</th>
                <th scope="col" className="px-4 py-3 w-[70px] bg-slate-50">수강학년</th>
                <th scope="col" className="px-4 py-3 w-[130px] bg-slate-50">수업촬영일</th>
                <th scope="col" className="px-4 py-3 w-[100px] bg-slate-50">강의실</th>
                <th scope="col" className="px-4 py-3 w-[150px] bg-slate-50">교수방법</th>
                <th scope="col" className="px-4 py-3 w-[150px] bg-slate-50">마이크로티칭 요청사항</th>
                <th scope="col" className="px-4 py-3 w-[60px] text-center sticky right-0 bg-slate-50 shadow-[-4px_0_4px_rgba(0,0,0,0.02)]">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => {
                const itemHasErr = hasErrors(item);

                return (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-crimson/5 transition-colors ${
                      item.status === 'error' ? 'bg-rose-50/30' : itemHasErr ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* File info */}
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-[140px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate block font-semibold text-slate-700" title={item.fileName}>
                          {item.fileName}
                        </span>
                        {item.status === 'error' ? (
                          <span className="text-[10px] text-rose-600 flex items-center gap-0.5 font-semibold">
                            <AlertTriangle size={9} /> 분석 실패
                          </span>
                        ) : itemHasErr ? (
                          <span className="text-[10px] text-amber-600 flex items-center gap-0.5 font-semibold">
                            <AlertTriangle size={9} /> 정규화 검수 필요
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                            <Check size={9} /> 정상 파싱 완료
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Render Columns */}
                    {(Object.keys(item.data) as Array<keyof ParsedData>).map((field) => {
                      const val = item.data[field];
                      const valErr = getValidationError(field, val);
                      const isEditing = editingCell?.id === item.id && editingCell?.field === field;

                      return (
                        <td 
                          key={field} 
                          className={`px-3 py-2.5 cursor-pointer relative ${
                            valErr ? 'bg-rose-50/70' : ''
                          }`}
                          onDoubleClick={() => startEditing(item.id, field, val)}
                          title={valErr || "더블클릭하여 편집"}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(item.id, field);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="border border-slate-300 rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-crimson"
                                autoFocus
                              />
                              <button 
                                onClick={() => saveEdit(item.id, field)}
                                className="bg-crimson text-white p-0.5 rounded hover:bg-crimson/90"
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          ) : (
                            <div className="group flex items-center justify-between gap-1 min-h-[22px]">
                              <span className="block truncate">
                                {val || <span className="text-slate-300">공란</span>}
                              </span>
                              
                              <span className="hidden group-hover:inline-block text-slate-400 shrink-0 ml-1">
                                <Edit2 size={10} />
                              </span>

                              {valErr && (
                                <span className="absolute right-1 top-1 text-rose-600" title={valErr}>
                                  <AlertTriangle size={11} />
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Column */}
                    <td className="px-3 py-3 text-center sticky right-0 bg-white shadow-[-4px_0_4px_rgba(0,0,0,0.02)]">
                      <button
                        type="button"
                        onClick={() => deleteRow(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="행 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Grid footer metrics */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
          <div>
            더블클릭 외에도 셀 우측에 나타나는 아이콘을 클릭해 바로 편집이 가능합니다.
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <Info size={12} className="text-slate-400" />
            <span>오류 및 정규화 위배 사항 수정 후 엑셀 파일을 내려받는 것이 안전합니다.</span>
          </div>
        </div>
      )}
    </div>
  );
}
