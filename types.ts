
export interface Student {
  id: string; // Matricule
  lastName: string;
  firstName: string;
  level: string;
  dob: string;
  phone: string;
  email: string;
  photo?: string; // Base64 encoded image
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  timestamp: string;
  photo: string; // Base64 snapshot of the detection
}

export interface CourseRecording {
  id: string;
  timestamp: string;
  video: Blob;
}

export type AdminViewType = 'dashboard' | 'students' | 'attendance' | 'courses';
export type AppViewType = 'landing' | 'admin' | 'surveillance';
export type CameraCommandType = 'idle' | 'start' | 'stop';
export type RecordingCommandType = 'idle' | 'start' | 'stop';

export interface Command {
  action: 'navigate' | 'view' | 'camera' | 'record' | 'search' | 'filter' | 'export' | 'add_student' | 'unknown';
  payload?: {
    page?: AppViewType;
    view?: AdminViewType;
    operation?: 'start' | 'stop';
    searchTerm?: string;
    level?: 'all' | 'licence1' | 'licence2' | 'licence3';
  };
  feedback: string;
}
