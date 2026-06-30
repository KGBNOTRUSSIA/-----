import React from 'react';
import { Info, Calendar, CheckSquare, ShieldAlert, FileCode } from 'lucide-react';

export default function GuidelineCard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Rules Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
          <CheckSquare size={16} className="text-blue-600" />
          데이터 정규화 규칙 (Normalization)
        </h3>
        <ul className="space-y-2.5 text-xs text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1. 촬영일 표준화:</span>
            <span>
              수업촬영일은 어떤 텍스트 형식 기입이어도 <strong>&apos;YYYY년 MM월 DD일&apos;</strong> 형식으로 정규화됩니다. 
              (예: &quot;5월 12일&quot; 입력 시 현재 시점을 인지하여 <strong>&quot;2026년 05월 12일&quot;</strong>로 보정)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2. 수강인원:</span>
            <span>
              수강인원은 숫자만 추출되어 표시됩니다 (예: &quot;30명&quot; → &quot;30&quot;).
            </span>
          </li>
        </ul>
      </div>

      {/* Limits & Tips Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3">
          <ShieldAlert size={16} className="text-amber-600" />
          한계 극복 및 예외 사항 가이드라인
        </h3>
        <ul className="space-y-2.5 text-xs text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-amber-600">1. 이미지 텍스트 보정:</span>
            <span>
              신청서 내부 표가 이미지 형식으로 삽입된 경우 파싱 누락이 생길 수 있습니다. 이 경우, 
              <strong>[AI 분석 실패]</strong> 혹은 공란으로 표시되므로 그리드에서 <strong>더블클릭</strong>하여 수동으로 채우실 수 있습니다.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-amber-600">2. 누락 데이터 보정:</span>
            <span>
              AI 추출 과정에서 빈칸으로 표시된 항목은 그리드에서 <strong>더블클릭</strong>하여 수동으로 입력할 수 있습니다.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-amber-600">3. 대량 일괄 처리 한계:</span>
            <span>
              본 MVP는 로컬 및 브라우저 자원 및 API 제한을 고려하여 <strong>최대 20개</strong>의 파일 처리를 동시 지원합니다. 초과하는 서류는 차례로 업로드해 검수하십시오.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
