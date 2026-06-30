import { writeFileSync } from 'fs';

const mocks = [
  { name: '김철수', dept: '컴퓨터공학과', course: '딥러닝 응용', count: '25', grade: '4학년', date: '2026년 9월 15일', room: '공학관 101호', method: '이론과 실습을 병행하여 학생들이 직접 모델을 구현해보도록 지도합니다.', request: '발표 시간 분배에 대한 피드백을 받고 싶습니다.' },
  { name: '이영희', dept: '전자공학과', course: '마이크로프로세서 설계', count: '30', grade: '3학년', date: '2026년 10월 5일', room: '전자관 203호', method: '실습 위주의 수업으로, 매주 팀 프로젝트를 진행합니다.', request: '팀 활동 시 조원 간 역할 분담에 관한 조언을 구합니다.' },
  { name: '박민수', dept: '기계공학과', course: '고체역학', count: '40', grade: '2학년', date: '2026년 11월 12일', room: '기계관 305호', method: '문제 풀이 중심으로 수업을 진행하며, 중간에 퀴즈를 통해 이해도를 확인합니다.', request: '어려운 개념을 쉽게 전달하는 방법에 대해 컨설팅 받고 싶습니다.' },
  { name: '정수진', dept: '화학공학과', course: '반응공학', count: '20', grade: '4학년', date: '2026년 9월 22일', room: '화학관 102호', method: '실험 데이터 분석을 통한 이론 학습을 병행합니다.', request: '수업 속도 조절에 대한 피드백을 원합니다.' },
  { name: '최재호', dept: '산업공학과', course: '데이터 마이닝', count: '35', grade: '3학년', date: '2026년 10월 18일', room: '산업관 401호', method: '실제 데이터셋을 활용한 프로젝트 기반 수업을 운영합니다.', request: '질문 유도 방식에 대한 개선 방안을 논의하고 싶습니다.' },
  { name: '강미나', dept: '신소재공학과', course: '재료과학', count: '28', grade: '2학년', date: '2026년 11월 3일', room: '신소재관 201호', method: '시청각 자료를 활용하여 개념 이해를 돕고, 주기적인 복습을 진행합니다.', request: '집중력이 낮은 학생들을 위한 수업 전략을 알고 싶습니다.' },
  { name: '윤성호', dept: '항공우주공학과', course: '유체역학', count: '22', grade: '3학년', date: '2026년 9월 8일', room: '항공관 502호', method: 'CFD 시뮬레이션을 활용한 실습 위주의 수업을 진행합니다.', request: '전공 기초가 부족한 학생을 위한 보충 설명 방안을 상담하고 싶습니다.' },
  { name: '송지현', dept: '생명공학과', course: '분자생물학', count: '18', grade: '4학년', date: '2026년 10월 28일', room: '생명관 301호', method: '최신 연구 논문을 함께 읽고 토론하는 방식으로 수업을 운영합니다.', request: '토론 수업에서 학생 참여도를 높이는 방법을 알고 싶습니다.' },
  { name: '임동욱', dept: '건축공학과', course: '건축구조역학', count: '32', grade: '3학년', date: '2026년 11월 19일', room: '건축관 104호', method: '실제 건축 사례를 분석하며 이론을 적용하는 방식으로 진행합니다.', request: '수업 자료의 시각화 개선에 대한 의견을 받고 싶습니다.' },
  { name: '한은정', dept: '환경공학과', course: '수질관리', count: '15', grade: '대학원생', date: '2026년 12월 2일', room: '환경관 205호', method: '현장 조사 데이터를 활용한 실습 중심 수업을 운영합니다.', request: '발표 구성과 전달력 향상을 위한 코칭을 요청합니다.' },
];

// Minimal valid PDF generator with embedded text (using raw PDF syntax)
function createMinimalPDF(text: string): Buffer {
  // Encode text in UTF-16BE with BOM for proper PDF text encoding
  const textHex = Buffer.from('\ufeff' + text, 'utf16le').toString('hex').toUpperCase();
  
  const content = `
BT
/F1 10 Tf
100 750 Td
<${textHex}> Tj
ET
`.trim();

  const contentObj = `1 0 obj
<< /Length ${Buffer.byteLength(content, 'utf8')} >>
stream
${content}
endstream
endobj`;

  const pageObj = `2 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 1 0 R /Resources << /Font << /F1 4 0 R >> >> >>
endobj`;

  const pagesObj = `3 0 obj
<< /Type /Pages /Kids [2 0 R] /Count 1 >>
endobj`;

  const fontObj = `4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj`;

  const catalogObj = `5 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj`;

  const body = [contentObj, pageObj, pagesObj, fontObj, catalogObj].join('\n');
  const bodyBytes = Buffer.byteLength(body, 'utf8');
  
  // Calculate xref offsets
  const header = '%PDF-1.4\n';
  const offset1 = header.length; // after header
  const bodyLines = body.split('\n');
  let currentOffset = offset1;
  const offsets: number[] = [];
  for (const line of bodyLines) {
    if (/^\d+ \d+ obj$/.test(line.trim())) {
      offsets.push(currentOffset);
    }
    currentOffset += Buffer.byteLength(line + '\n', 'utf8');
  }

  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n `).join('\n')}\n`;
  const trailer = `trailer\n<< /Size 6 /Root 5 0 R >>\n`;
  const eof = 'startxref\n' + (offset1 + Buffer.byteLength(body, 'utf8') + 1) + '\n%%EOF';

  return Buffer.from(header + body + '\n' + xref + trailer + eof, 'utf8');
}

const dir = 'C:\\Users\\ITS\\AppData\\Local\\Temp\\opencode\\mocks';
mocks.forEach((m, i) => {
  const formText = [
    `2026학년도 2학기 마이크로티칭 신청서`,
    `성명\t${m.name}\t소속\t${m.dept}`,
    `희망 강좌`,
    `강좌명\t${m.course}`,
    `인원(\t${m.count}\t)명`,
    `학년 ${m.grade}`,
    `수업촬영일 1차 희망일 ${m.date}\t강의실\t${m.room}`,
    `교수 방법 ${m.method}`,
    `마이크로티칭 요청사항 ${m.request}`,
  ].join('\n');

  const pdf = createMinimalPDF(formText);
  const idx = String(i + 1).padStart(2, '0');
  writeFileSync(`${dir}\\mock_${idx}_${m.name}.pdf`, pdf);
  console.log(`Created mock_${idx}_${m.name}.pdf (${pdf.length} bytes)`);
});

console.log('\nAll 10 mock PDF files created!');
