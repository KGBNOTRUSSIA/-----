export interface ReferenceKnowledge {
  programName: string;
  fieldLabels: string[];
  sectionOrder: string[];
}

const CORE_LABELS = new Set(['성명','소속','희망','희망강좌','강좌명','인원','수강인원','학년','수강학년','수업촬영일','강의실','교수','교수방법','방법','요청사항','마이크로티칭','참고사항','기타','과목','구분']);

export function analyzeReferenceForm(text: string, programName: string): ReferenceKnowledge {
  const labels = new Set<string>();
  const lines = text.split('\n');

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('※')) continue;
    const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const pk = parts[i].replace(/\s+/g, '').replace(/[()\[\]{}「」『』]/g, '');
      if (!CORE_LABELS.has(pk)) continue;
      const nextPart = parts[i + 1];
      if (nextPart && !CORE_LABELS.has(nextPart.replace(/\s+/g, '').replace(/[()\[\]{}「」『』]/g, ''))) labels.add(pk);
    }
  }

  const norm = text.replace(/\t+/g, ' ').replace(/\s+/g, ' ');
  for (const parts of [['희망','강좌'],['교수','방법'],['수강','인원'],['수강','학년'],['수업','촬영일'],['마이크로티칭','요청사항'],['기타','참고사항']]) {
    if (norm.includes(parts.join(' '))) labels.add(parts.join(' '));
  }

  // Also check space-normalized text for labels followed by content
  for (const cl of CORE_LABELS) {
    if (labels.has(cl)) continue;
    const re = new RegExp(cl + '\\s+\\S', 'i');
    if (re.test(norm)) labels.add(cl);
  }

  return { programName, fieldLabels: [...labels], sectionOrder: [] };
}

export function findKnownLabels(text: string, all: ReferenceKnowledge[]): ReferenceKnowledge | null {
  let best: ReferenceKnowledge | null = null, bestScore = 0;
  for (const k of all) {
    let s = 0;
    for (const l of k.fieldLabels) if (text.includes(l)) s++;
    if (s > bestScore) { bestScore = s; best = k; }
  }
  return best;
}

export function filterInstructionText(text: string): string {
  return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('※')).join('\n');
}

const SECTION_LABELS = new Set(['교수 방법','교수','방법','마이크로티칭 요청사항','요청사항']);

export function extractFieldsDynamic(text: string, knowledge: ReferenceKnowledge): Record<string, string> {
  const result: Record<string, string> = {};
  const hasTabs = text.includes('\t');
  const norm = text.replace(/\t+/g, ' ').replace(/\s+/g, ' ');

  for (const label of knowledge.fieldLabels) {
    const field = LABEL_TO_FIELD[label];
    if (!field) continue;

    let value = '';
    if (SECTION_LABELS.has(label)) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const endLabels = ['희망','강좌명','수업촬영일','교수','마이크로티칭','기타','참고사항','$'];
      const endPat = '(?:' + endLabels.join('|') + ')';
      const re = new RegExp(`${escaped}\\s+(.+?)(?=${endPat})`, 's');
      const m = norm.match(re);
      if (m) value = m[1].trim();
    } else if (hasTabs) {
      value = findTabValue(text, label);
      // If label starts with numeric prefix, extract just the number
      if (field === 'studentCount') {
        const num = value.match(/\d+/);
        if (num) value = num[0];
      }
      if (field === 'studentGrade') {
        const g = value.match(/(\d+)\s*학년|대학원생/);
        if (g) value = g[0].replace(/\s+/g, '');
        else if (/^\d+$/.test(value.trim())) value = value.trim() + '학년';
      }
    } else {
      value = findSpaceValue(norm, label);
    }

    if (value) result[field] = value;
    // Post-process specific fields
    if (field === 'desiredCourse' && value) {
      result[field] = value.replace(/수강\s*.*$/, '').trim();
    }
  }

  // Always try date regex (works regardless of field label detection)
  const dates = [...norm.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
  if (dates.length > 0) {
    const d = dates[0];
    result['shootingDate'] = `${d[1]}년 ${d[2].padStart(2,'0')}월 ${d[3].padStart(2,'0')}일`;
  }

  return result;
}

function findTabValue(text: string, label: string): string {
  const labelKey = label.replace(/\s+/g, '').replace(/[()\[\]{}「」『』]/g, '');
  for (const line of text.split('\n')) {
    const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      if (i + 1 >= parts.length) continue;
      const pk = parts[i].replace(/\s+/g, '').replace(/[()\[\]{}「」『』]/g, '');
      if (pk.startsWith(labelKey) || pk === labelKey) {
        return parts[i + 1];
      }
    }
  }
  return '';
}

function findSpaceValue(norm: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s+(.+?)(?=\\s+(?:희망|강좌명|인원|수업|교수|마이크로|기타|$))`);
  const m = norm.match(re);
  return m ? m[1].trim() : '';
}

const LABEL_TO_FIELD: Record<string, string> = {
  '성명': 'teacherName', '소속': 'teacherAffiliation',
  '희망 강좌': 'desiredCourse', '희망': 'desiredCourse', '강좌명': 'desiredCourse',
  '수강인원': 'studentCount', '인원': 'studentCount',
  '수강학년': 'studentGrade', '학년': 'studentGrade',
  '수업촬영일': 'shootingDate', '촬영일': 'shootingDate',
  '강의실': 'classroom',
  '교수 방법': 'teachingMethod', '교수': 'teachingMethod', '방법': 'teachingMethod',
  '마이크로티칭 요청사항': 'microteachingRequests', '요청사항': 'microteachingRequests',
};