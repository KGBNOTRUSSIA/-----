export type StatusType = 'success' | 'error' | 'processing';

export interface ParsedData {
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

export interface DocumentItem {
  id: string;
  fileName: string;
  status: StatusType;
  error?: string;
  data: ParsedData;
}

export interface ValidationError {
  field: keyof ParsedData;
  message: string;
}
