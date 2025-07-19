
import { Student, AttendanceRecord, CourseRecording } from './types';

const DB_NAME = 'ScanStudentsDB';
const DB_VERSION = 2; // Incremented version for schema change
const STUDENTS_STORE = 'students';
const ATTENDANCE_STORE = 'attendanceRecords';
const COURSE_RECORDINGS_STORE = 'courseRecordings';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STUDENTS_STORE)) {
        db.createObjectStore(STUDENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
        const attendanceStore = db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'id' });
        attendanceStore.createIndex('studentId', 'studentId', { unique: false });
      }
      if (!db.objectStoreNames.contains(COURSE_RECORDINGS_STORE)) {
        db.createObjectStore(COURSE_RECORDINGS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(true);
    };

    request.onerror = (event) => {
      console.error('Database error:', (event.target as IDBOpenDBRequest).error);
      reject(false);
    };
  });
};

// --- Student Functions ---

export const getStudents = (): Promise<Student[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(STUDENTS_STORE, 'readonly');
        const store = transaction.objectStore(STUDENTS_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        }
    });
};

export const addStudentDB = (student: Student): Promise<Student> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(STUDENTS_STORE, 'readwrite');
        const store = transaction.objectStore(STUDENTS_STORE);
        const request = store.add(student);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(student);
        };
    });
};

export const updateStudentDB = (student: Student): Promise<Student> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(STUDENTS_STORE, 'readwrite');
        const store = transaction.objectStore(STUDENTS_STORE);
        const request = store.put(student);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(student);
        };
    });
};

export const deleteStudentDB = (studentId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(STUDENTS_STORE, 'readwrite');
        const store = transaction.objectStore(STUDENTS_STORE);
        const request = store.delete(studentId);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(studentId);
        };
    });
};

// --- Attendance Functions ---

export const getAttendanceRecords = (): Promise<AttendanceRecord[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(ATTENDANCE_STORE, 'readonly');
        const store = transaction.objectStore(ATTENDANCE_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        }
    });
};

export const addAttendanceRecordDB = (record: AttendanceRecord): Promise<AttendanceRecord> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(ATTENDANCE_STORE, 'readwrite');
        const store = transaction.objectStore(ATTENDANCE_STORE);
        const request = store.add(record);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(record);
        };
    });
};

// --- Course Recording Functions ---

export const getCourseRecordings = (): Promise<CourseRecording[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(COURSE_RECORDINGS_STORE, 'readonly');
        const store = transaction.objectStore(COURSE_RECORDINGS_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            // Sort by timestamp descending
            resolve(request.result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        };
        request.onerror = () => {
            reject(request.error);
        }
    });
};

export const addCourseRecordingDB = (record: CourseRecording): Promise<CourseRecording> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(COURSE_RECORDINGS_STORE, 'readwrite');
        const store = transaction.objectStore(COURSE_RECORDINGS_STORE);
        const request = store.add(record);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(record);
        };
    });
};

export const deleteCourseRecordingDB = (recordId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction(COURSE_RECORDINGS_STORE, 'readwrite');
        const store = transaction.objectStore(COURSE_RECORDINGS_STORE);
        const request = store.delete(recordId);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
            resolve(recordId);
        };
    });
};
