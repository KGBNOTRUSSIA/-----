export interface LocalExtractedData {
  teacherName: string;
  teacherAffiliation: string;
  desiredCourse: string;
  studentCount: string;
  studentGrade: string;
  shootingDate: string;
  classroom: string;
  teachingMethod: string;
  microteachingRequests: string;
}

function scanRowTab(text: string, fieldLabel: string): string {
  for (const line of text.split('\n')) {
    const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(fieldLabel) && i + 1 < parts.length) {
        return parts[i + 1];
      }
    }
  }
  return '';
}

function scanRowNumericTab(text: string, fieldLabel: string): string {
  for (const line of text.split('\n')) {
    const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(fieldLabel)) {
        for (let j = i + 1; j < parts.length; j++) {
          const m = parts[j].match(/(\d+)/);
          if (m) return m[1];
        }
      }
    }
  }
  return '';
}

// For space-normalized text (from binary fallback scanner where tabs are collapsed)
const KNOWN_LABELS = ['성명', '소속', '강좌명', '인원', '학년', '수업촬영일', '강의실', '교수 방법', '교수방법', '마이크로티칭 요청사항', '요청사항', '기타 참고사항', '참고사항'];

function extractValueBetween(text: string, startLabel: string, endLabels: string[], maxWords: number = 20): string {
  const norm = text.replace(/\s+/g, ' ').trim();
  const startIdx = norm.indexOf(startLabel);
  if (startIdx === -1) return '';
  const after = norm.slice(startIdx + startLabel.length).trim();
  
  let endIdx = after.length;
  for (const end of endLabels) {
    const idx = after.indexOf(end);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  
  let result = after.slice(0, endIdx).trim();
  // Limit to maxWords
  const words = result.split(/\s+/);
  return words.slice(0, maxWords).join(' ');
}

function extractAfterLabel(text: string, label: string): string {
  const norm = text.replace(/\s+/g, ' ').trim();
  const idx = norm.indexOf(label);
  if (idx === -1) return '';
  const after = norm.slice(idx + label.length).trim();
  
  // Find the next known label to use as boundary
  let minIdx = after.length;
  for (const kl of KNOWN_LABELS) {
    if (kl === label) continue;
    const ki = after.indexOf(kl);
    if (ki !== -1 && ki < minIdx) minIdx = ki;
  }
  
  return after.slice(0, minIdx).trim();
}

export function extractFieldsFromText(text: string): LocalExtractedData {
  const empty: LocalExtractedData = {
    teacherName: '', teacherAffiliation: '', desiredCourse: '',
    studentCount: '', studentGrade: '', shootingDate: '',
    classroom: '', teachingMethod: '', microteachingRequests: '',
  };
  if (!text || text.trim().length < 5) return empty;

  // Filter instruction lines (※)
  const filteredLines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('※'));
  text = filteredLines.join('\n');

  const data: LocalExtractedData = { ...empty };
  const hasTabs = text.includes('\t');

  if (hasTabs) {
    // Tab-separated format (direct PDF extraction)
    data.teacherName = scanRowTab(text, '성명');
    data.teacherAffiliation = scanRowTab(text, '소속');
    const courseRaw = scanRowTab(text, '강좌명');
    data.desiredCourse = (courseRaw || '').replace(/수강.*$/, '').trim();
    data.studentCount = scanRowNumericTab(text, '인원');

    const gradeLine = text.split('\n').find(l => l.includes('학년') && !l.startsWith('2025') && !l.includes('학년도'));
    if (gradeLine) {
      const gradeNorm = gradeLine.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
      const gradeMatch = gradeNorm.match(/(\d+)\s*[^a-zA-Z]*\s*학년|대학원생/);
      if (gradeMatch) {
        const raw = gradeMatch[0].trim();
        const gradeNum = raw.match(/(\d+)/);
        data.studentGrade = gradeNum ? `${gradeNum[1]}학년` : raw;
      }
    }

    const classroomSet = new Set<string>();
    for (const line of text.split('\n')) {
      if (line.includes('강의실')) {
        const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === '강의실' && i + 1 < parts.length) {
            classroomSet.add(parts[i + 1]);
          }
        }
      }
    }
    data.classroom = [...classroomSet].join(', ');

    data.teachingMethod = captureAfter(text, '교수 방법', ['마이크로티칭 요청사항', '기타 참고사항']);
    data.microteachingRequests = captureAfter(text, '마이크로티칭 요청사항', ['기타 참고사항']);
  } else {
    // Space-normalized format (from binary fallback scanner - tabs collapsed)
    const norm = text.replace(/\s+/g, ' ').trim();

    const nameMatch = norm.match(/성명\s+(\S+)/);
    if (nameMatch) data.teacherName = nameMatch[1];

    const deptMatch = norm.match(/소속\s+(.+?)(?=\s+(?:마이크로티칭|희망|강좌|수업|교수|기타|$))/);
    if (deptMatch) data.teacherAffiliation = deptMatch[1].trim();

    const courseMatch = norm.match(/강좌명\s+(.+?)(?=\s+(?:수강|인원|$))/);
    if (courseMatch) data.desiredCourse = courseMatch[1].trim();

    const countMatch = norm.match(/인원[^\d]*(\d+)/);
    if (countMatch) data.studentCount = countMatch[1];

    // Grade: find the "학년" that is NOT part of "학년도" or year pattern
    const gradeInText = norm.match(/(?:^|\s)(\d+\s*학년|대학원생)(?:\s|$)/);
    if (gradeInText) {
      data.studentGrade = gradeInText[1].trim().replace(/\s+/g, '');
    }

    const roomMatch = norm.match(/강의실\s+(.+?)(?=\s+(?:교수|마이크로|기타|$))/);
    if (roomMatch) data.classroom = roomMatch[1].trim();

    data.teachingMethod = extractValueBetween(norm, '교수 방법', ['마이크로티칭', '요청사항', '기타'], 50);
    data.microteachingRequests = extractValueBetween(norm, '요청사항', ['기타', '참고사항'], 50);
  }

  // Date extraction (works for both formats)
  const dates = [...text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
  if (dates.length > 0) {
    const d = dates[0];
    data.shootingDate = `${d[1]}년 ${d[2].padStart(2, '0')}월 ${d[3].padStart(2, '0')}일`;
  } else {
    const dateFallback = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (dateFallback) {
      data.shootingDate = `2026년 ${dateFallback[1].padStart(2, '0')}월 ${dateFallback[2].padStart(2, '0')}일`;
    }
  }

  return data;
}

function captureAfter(text: string, marker: string, endMarkers: string[]): string {
  const norm = text.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
  const startIdx = norm.indexOf(marker);
  if (startIdx === -1) return '';
  let endIdx = norm.length;
  for (const end of endMarkers) {
    const idx = norm.indexOf(end, startIdx + marker.length);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  let section = norm.slice(startIdx + marker.length, endIdx).trim();
  section = section.replace(/※[^.]*\.\s*/g, '').trim();
  return section;
}
