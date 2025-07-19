
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { Student, AttendanceRecord, CourseRecording, AppViewType, AdminViewType, Command, CameraCommandType, RecordingCommandType } from './types';
import LandingPage from './components/LandingPage';
import AdminView from './components/AdminView';
import SurveillanceView from './components/SurveillanceView';
import VoiceCommander from './components/VoiceCommander';
import { 
    initDB, 
    getStudents, 
    addStudentDB, 
    updateStudentDB, 
    deleteStudentDB, 
    getAttendanceRecords, 
    addAttendanceRecordDB,
    getCourseRecordings,
    addCourseRecordingDB,
    deleteCourseRecordingDB
} from './db';

// --- Context for State Management ---
interface AppContextType {
    // Data
    students: Student[];
    attendanceRecords: AttendanceRecord[];
    courseRecordings: CourseRecording[];
    page: AppViewType;
    adminView: AdminViewType;
    cameraCommand: CameraCommandType;
    recordingCommand: RecordingCommandType;
    searchTerm: string;
    levelFilter: string;
    isAddStudentModalOpen: boolean;

    // Actions
    navigateTo: (page: AppViewType) => void;
    navigateToAdminView: (view: AdminViewType) => void;
    
    addStudent: (student: Omit<Student, 'photo' | 'id'> & {id: string}) => Promise<void>;
    updateStudent: (student: Student) => Promise<void>;
    deleteStudent: (studentId: string) => Promise<void>;
    
    addAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;

    addCourseRecording: (record: Omit<CourseRecording, 'id'>) => Promise<void>;
    deleteCourseRecording: (recordId: string) => Promise<void>;

    setSearchTerm: (term: string) => void;
    setLevelFilter: (level: string) => void;
    executeVoiceCommand: (command: Command) => string;
    
    clearCameraCommand: () => void;
    clearRecordingCommand: () => void;
    
    openAddStudentModal: () => void;
    closeAddStudentModal: () => void;
    exportAttendancePDF: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within an AppProvider");
    return context;
};

// --- Main App Component ---
const App: React.FC = () => {
    const [page, setPage] = useState<AppViewType>('landing');
    const [adminView, setAdminView] = useState<AdminViewType>('dashboard');
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [courseRecordings, setCourseRecordings] = useState<CourseRecording[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Lifted state for voice control
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('all');
    const [cameraCommand, setCameraCommand] = useState<CameraCommandType>('idle');
    const [recordingCommand, setRecordingCommand] = useState<RecordingCommandType>('idle');
    const [isAddStudentModalOpen, setAddStudentModalOpen] = useState(false);
    const [pdfExportTrigger, setPdfExportTrigger] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            try {
                await initDB();
                const [initialStudents, initialAttendance, initialRecordings] = await Promise.all([
                    getStudents(),
                    getAttendanceRecords(),
                    getCourseRecordings()
                ]);
                setStudents(initialStudents);
                setAttendanceRecords(initialAttendance);
                setCourseRecordings(initialRecordings);
            } catch (error) {
                console.error("Failed to initialize DB or load data", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);
    
    const addStudent = async (studentData: Omit<Student, 'photo' | 'id'> & {id: string}) => {
        const newStudent = { ...studentData, photo: undefined };
        await addStudentDB(newStudent);
        setStudents(prev => [...prev, newStudent].sort((a,b) => a.lastName.localeCompare(b.lastName)));
    };

    const updateStudent = async (updatedStudent: Student) => {
        await updateStudentDB(updatedStudent);
        setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    };

    const deleteStudent = async (studentId: string) => {
        await deleteStudentDB(studentId);
        setStudents(prev => prev.filter(s => s.id !== studentId));
    };

    const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'id'>) => {
        const newRecord = { ...record, id: `A${Date.now()}` };
        await addAttendanceRecordDB(newRecord);
        setAttendanceRecords(prev => [newRecord, ...prev]);
    };

    const addCourseRecording = async (record: Omit<CourseRecording, 'id'>) => {
        const newRecord = { ...record, id: `REC${Date.now()}` };
        await addCourseRecordingDB(newRecord);
        setCourseRecordings(prev => [newRecord, ...prev]);
    };

    const deleteCourseRecording = async (recordId: string) => {
        await deleteCourseRecordingDB(recordId);
        setCourseRecordings(prev => prev.filter(r => r.id !== recordId));
    };

    const executeVoiceCommand = useCallback((command: Command): string => {
        const { action, payload, feedback } = command;

        switch (action) {
            case 'navigate':
                if (payload?.page) setPage(payload.page);
                break;
            case 'view':
                if (payload?.view) {
                    setPage('admin');
                    setAdminView(payload.view);
                }
                break;
            case 'camera':
                if (page !== 'surveillance') return "Veuillez d'abord aller sur la page de surveillance.";
                if (payload?.operation) setCameraCommand(payload.operation);
                break;
            case 'record':
                if (page !== 'surveillance') return "Veuillez d'abord aller sur la page de surveillance.";
                if (payload?.operation) setRecordingCommand(payload.operation);
                break;
            case 'search':
                if (page !== 'admin') return "Veuillez d'abord aller sur la page de gestion des étudiants.";
                setAdminView('students');
                if (payload?.searchTerm) setSearchTerm(payload.searchTerm);
                break;
            case 'filter':
                if (page !== 'admin') return "Veuillez d'abord aller sur la page de gestion des étudiants.";
                setAdminView('students');
                if (payload?.level) setLevelFilter(payload.level);
                break;
            case 'add_student':
                if (page !== 'admin') return "Veuillez d'abord aller sur la page d'administration.";
                setAdminView('students');
                setAddStudentModalOpen(true);
                break;
            case 'export':
                if (page !== 'admin') return "Veuillez d'abord aller à la liste de présence pour exporter.";
                 setAdminView('attendance');
                setPdfExportTrigger(c => c + 1);
                break;
            case 'unknown':
            default:
                break;
        }
        return feedback;
    }, [page]);


    const contextValue: AppContextType = {
        students,
        attendanceRecords,
        courseRecordings,
        page,
        adminView,
        cameraCommand,
        recordingCommand,
        searchTerm,
        levelFilter,
        isAddStudentModalOpen,
        navigateTo: setPage,
        navigateToAdminView: setAdminView,
        addStudent,
        updateStudent,
        deleteStudent,
        addAttendanceRecord,
        addCourseRecording,
        deleteCourseRecording,
        setSearchTerm,
        setLevelFilter,
        executeVoiceCommand,
        clearCameraCommand: () => setCameraCommand('idle'),
        clearRecordingCommand: () => setRecordingCommand('idle'),
        openAddStudentModal: () => setAddStudentModalOpen(true),
        closeAddStudentModal: () => setAddStudentModalOpen(false),
        exportAttendancePDF: () => setPdfExportTrigger(c => c + 1),
    };
    
    if (isLoading) {
        return (
            <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-white">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
                <p className="mt-4 text-xl">Initialisation de la base de données...</p>
            </div>
        );
    }

    const renderPage = () => {
        switch (page) {
            case 'admin':
                return <AdminView
                    isAddStudentModalOpenExternally={isAddStudentModalOpen}
                    onCloseAddStudentModal={() => setAddStudentModalOpen(false)}
                    pdfExportTrigger={pdfExportTrigger}
                 />;
            case 'surveillance':
                return <SurveillanceView />;
            case 'landing':
            default:
                return <LandingPage />;
        }
    };

    return (
        <AppContext.Provider value={contextValue}>
            {renderPage()}
            {page !== 'landing' && <VoiceCommander />}
        </AppContext.Provider>
    );
};

export default App;
