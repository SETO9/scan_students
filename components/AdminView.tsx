
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student } from '../types';
import { UserPlusIcon, EditIcon, TrashIcon, CameraIcon, UsersIcon, ListIcon, DownloadIcon, ChevronLeftIcon, PlayCircleIcon } from './Icons';
import { useAppContext } from '../App';

// Use a global declaration for jsPDF for CDN compatibility
declare const jspdf: any;

interface AdminViewProps {
    isAddStudentModalOpenExternally: boolean;
    onCloseAddStudentModal: () => void;
    pdfExportTrigger: number;
}


// Helper component for video playback
const VideoPlayer: React.FC<{record: any; onDelete: (id: string) => void}> = ({ record, onDelete }) => {
    const { courseRecordings, deleteCourseRecording } = useAppContext();
    const videoUrl = React.useMemo(() => URL.createObjectURL(record.video), [record.video]);
    
    // Cleanup URL on unmount to prevent memory leaks
    React.useEffect(() => {
        return () => URL.revokeObjectURL(videoUrl);
    }, [videoUrl]);

    const handleDelete = () => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet enregistrement ? Cette action est irréversible.")) {
            deleteCourseRecording(record.id);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-md flex flex-col">
            <video src={videoUrl} controls className="w-full aspect-video bg-black"></video>
            <div className="p-4 flex justify-between items-center">
                <div>
                    <p className="text-sm font-medium text-white">Enregistré le</p>
                    <p className="text-xs text-gray-400">{new Date(record.timestamp).toLocaleString('fr-FR')}</p>
                </div>
                <button 
                    onClick={handleDelete} 
                    className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-gray-700 transition-colors"
                    title="Supprimer l'enregistrement"
                >
                    <TrashIcon className="w-5 h-5"/>
                </button>
            </div>
        </div>
    );
};


// Helper to trigger file download
const downloadPhoto = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper component for modals
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string }> = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
};

const AdminView: React.FC<AdminViewProps> = ({ isAddStudentModalOpenExternally, onCloseAddStudentModal, pdfExportTrigger }) => {
  const { 
    navigateTo, 
    students, 
    attendanceRecords, 
    courseRecordings, 
    addStudent, 
    updateStudent, 
    deleteStudent,
    deleteCourseRecording,
    adminView,
    navigateToAdminView,
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter
  } = useAppContext();

  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [isPhotoModalOpen, setPhotoModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if(isAddStudentModalOpenExternally) {
        setEditingStudent(null);
        setStudentModalOpen(true);
    }
  }, [isAddStudentModalOpenExternally]);

  const closeModalAndNotify = () => {
      setStudentModalOpen(false);
      onCloseAddStudentModal();
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet étudiant ? Cela supprimera aussi ses fiches de présence.')) {
        await deleteStudent(studentId);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const studentData = Object.fromEntries(formData.entries()) as Omit<Student, 'photo'>;

    if (editingStudent) {
      await updateStudent({ ...editingStudent, ...studentData });
    } else {
      await addStudent(studentData);
    }
    closeModalAndNotify();
    setEditingStudent(null);
  };
  
  const openAddModal = () => {
      setEditingStudent(null);
      setStudentModalOpen(true);
  };

  const openEditModal = (student: Student) => {
      setEditingStudent(student);
      setStudentModalOpen(true);
  };
  
  const openPhotoModal = (student: Student) => {
      setEditingStudent(student);
      setPhotoModalOpen(true);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Error accessing camera:", err));
  };

  const closePhotoModal = useCallback(() => {
    setPhotoModalOpen(false);
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  const capturePhoto = async () => {
    if (videoRef.current && photoCanvasRef.current && editingStudent) {
        const video = videoRef.current;
        const canvas = photoCanvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const photoDataUrl = canvas.toDataURL('image/jpeg');
        await updateStudent({ ...editingStudent, photo: photoDataUrl });
        closePhotoModal();
    }
  };

  const exportToPDF = useCallback(() => {
    const doc = new jspdf.jsPDF();
    doc.text("Liste de Présence", 14, 16);
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 14, 22);

    const tableColumn = ["Matricule", "Nom", "Prénom", "Niveau", "Date et Heure"];
    const tableRows: (string | null)[][] = [];

    attendanceRecords.forEach(record => {
        const student = students.find(s => s.id === record.studentId);
        const recordData = [
            record.studentId,
            student?.lastName || 'N/A',
            student?.firstName || 'N/A',
            student?.level ? (levelDisplayMap[student.level] || student.level) : 'N/A',
            new Date(record.timestamp).toLocaleString('fr-FR')
        ];
        tableRows.push(recordData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save("liste_de_presence.pdf");
  }, [attendanceRecords, students]);

  useEffect(() => {
      if (pdfExportTrigger > 0) {
          exportToPDF();
      }
  }, [pdfExportTrigger, exportToPDF]);

  const filteredStudents = students
    .filter(s =>
      `${s.firstName} ${s.lastName} ${s.id} ${s.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(s => levelFilter === 'all' || s.level === levelFilter)
    .sort((a,b) => a.lastName.localeCompare(b.lastName));
  
  if (adminView === 'dashboard') {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white">
            Panneau d'<span className="text-indigo-400">Administration</span>
          </h1>
          <p className="text-gray-400 mt-2">Sélectionnez une option pour commencer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          <div onClick={() => navigateToAdminView('students')} className="bg-brand-secondary p-8 rounded-lg shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center text-center">
            <UsersIcon className="w-16 h-16 text-indigo-400 mb-4" />
            <h3 className="text-2xl font-semibold text-white">Gérer les Étudiants</h3>
            <p className="text-gray-400 mt-2 text-sm">Ajouter, modifier ou supprimer des profils étudiants.</p>
          </div>

          <div onClick={() => navigateToAdminView('attendance')} className="bg-brand-secondary p-8 rounded-lg shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center text-center">
            <ListIcon className="w-16 h-16 text-indigo-400 mb-4" />
            <h3 className="text-2xl font-semibold text-white">Liste de Présence</h3>
            <p className="text-gray-400 mt-2 text-sm">Consulter et exporter les fiches de présence.</p>
          </div>

          <div onClick={() => navigateToAdminView('courses')} className="bg-brand-secondary p-8 rounded-lg shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center text-center">
            <PlayCircleIcon className="w-16 h-16 text-indigo-400 mb-4" />
            <h3 className="text-2xl font-semibold text-white">Cours Enregistrés</h3>
            <p className="text-gray-400 mt-2 text-sm">Visionner les enregistrements des cours.</p>
          </div>
        </div>

        <button
          onClick={() => navigateTo('landing')}
          className="mt-16 flex items-center px-6 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md font-semibold transition-colors"
        >
          <ChevronLeftIcon className="h-5 w-5 mr-3" />
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark text-gray-200">
      <header className="p-4 sm:p-6 lg:p-8">
        <button 
            onClick={() => navigateToAdminView('dashboard')} 
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors group"
        >
          <ChevronLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Retour au tableau de bord</span>
        </button>
      </header>
      
      <main className="px-4 sm:px-6 lg:px-8 pb-8">
        {adminView === 'students' && (
          <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
               <h2 className="text-2xl font-semibold text-white w-full sm:w-auto">Gestion des Étudiants</h2>
               <div className="flex items-center gap-4 w-full sm:w-auto">
                 <div className="relative w-full sm:max-w-xs flex-grow">
                  <input
                    type="text"
                    placeholder="Rechercher par nom, matricule..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 pl-4 pr-10 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                  />
                </div>
                <button onClick={openAddModal} className="flex-shrink-0 flex items-center px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-md font-semibold transition-colors">
                    <UserPlusIcon className="w-5 h-5 mr-2" /> Ajouter
                </button>
               </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm font-medium text-gray-400">Filtrer par niveau:</span>
                {['all', 'licence1', 'licence2', 'licence3'].map(level => {
                    const isActive = levelFilter === level;
                    const label = level === 'all' ? 'Tous' : `Licence ${level.slice(-1)}`;
                    return (
                        <button
                            key={level}
                            onClick={() => setLevelFilter(level)}
                            className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${
                                isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            {['Matricule', 'Nom', 'Prénom', 'Niveau', 'Email', 'Photo', 'Actions'].map(h => 
                                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-brand-secondary divide-y divide-gray-700">
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{student.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{student.lastName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{student.firstName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{levelDisplayMap[student.level] || student.level}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{student.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {student.photo ? 
                                        <img src={student.photo} alt="student" className="h-10 w-10 rounded-full object-cover"/> : 
                                        <span className="text-gray-500">Non</span>
                                    }
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => openPhotoModal(student)} className="text-sky-400 hover:text-sky-300" title="Prendre ou modifier la photo"><CameraIcon className="w-5 h-5"/></button>
                                        {student.photo && (
                                            <button onClick={() => downloadPhoto(student.photo!, `${student.id}_profile.jpg`)} className="text-green-400 hover:text-green-300" title="Télécharger la photo">
                                                <DownloadIcon className="w-5 h-5"/>
                                            </button>
                                        )}
                                        <button onClick={() => openEditModal(student)} className="text-yellow-400 hover:text-yellow-300" title="Modifier"><EditIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteStudent(student.id)} className="text-red-500 hover:text-red-400" title="Supprimer"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {filteredStudents.length === 0 && <p className="text-center py-8 text-gray-500">Aucun étudiant trouvé pour les filtres sélectionnés.</p>}
            </div>
          </div>
        )}
        
        {adminView === 'attendance' && (
           <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-semibold text-white">Liste de Présence</h2>
                 <button onClick={exportToPDF} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors">
                     <DownloadIcon className="w-5 h-5 mr-2" /> Exporter PDF
                 </button>
             </div>
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                     <thead className="bg-gray-800">
                        <tr>
                            {['Aperçu', 'Matricule', 'Nom Complet', 'Date et Heure', 'Actions'].map(h => 
                                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-brand-secondary divide-y divide-gray-700">
                        {attendanceRecords.map(record => {
                             const student = students.find(s => s.id === record.studentId);
                             return (
                                <tr key={record.id} className="hover:bg-gray-700/50">
                                    <td className="px-6 py-4"><img src={record.photo} alt="snapshot" className="h-12 w-12 rounded-lg object-cover"/></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{record.studentId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{student ? `${student.firstName} ${student.lastName}` : 'Étudiant supprimé'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(record.timestamp).toLocaleString('fr-FR')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => downloadPhoto(record.photo, `${record.studentId}_${new Date(record.timestamp).getTime()}.jpg`)} className="text-green-400 hover:text-green-300" title="Télécharger le snapshot">
                                            <DownloadIcon className="w-5 h-5"/>
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {attendanceRecords.length === 0 && <p className="text-center py-8 text-gray-500">Aucune présence enregistrée.</p>}
             </div>
           </div>
        )}

        {adminView === 'courses' && (
            <div className="bg-brand-secondary p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold text-white mb-4">Cours Enregistrés</h2>
                {courseRecordings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courseRecordings.map(record => (
                            <VideoPlayer key={record.id} record={record} onDelete={() => deleteCourseRecording(record.id)} />
                        ))}
                    </div>
                ) : (
                    <p className="text-center py-8 text-gray-500">Aucun cours enregistré pour le moment.</p>
                )}
            </div>
        )}
      </main>

      <Modal isOpen={isStudentModalOpen} onClose={closeModalAndNotify} title={editingStudent ? 'Modifier Étudiant' : 'Ajouter Étudiant'}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {Object.entries(newStudentTemplate).map(([key, config]) => {
                const fieldKey = key as keyof Omit<Student, 'photo'>;
                
                const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
                    if ('transform' in config && config.transform === 'uppercase') {
                        e.currentTarget.value = e.currentTarget.value.toUpperCase();
                    }
                };

                if (config.type === 'select') {
                    return (
                        <div key={fieldKey}>
                            <label htmlFor={fieldKey} className="block text-sm font-medium text-gray-300 mb-1">{config.label}</label>
                            <select id={fieldKey} name={fieldKey} defaultValue={editingStudent?.[fieldKey] || ''} required={config.required}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent">
                                <option value="" disabled>Sélectionner un niveau</option>
                                {config.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    );
                }

                return (
                    <div key={fieldKey}>
                        <label htmlFor={fieldKey} className="block text-sm font-medium text-gray-300 mb-1">{config.label}</label>
                        <input 
                            type={config.type}
                            id={fieldKey}
                            name={fieldKey}
                            defaultValue={editingStudent?.[fieldKey] || ''}
                            required={'required' in config && config.required}
                            maxLength={'maxLength' in config ? config.maxLength : undefined}
                            pattern={'pattern' in config ? config.pattern : undefined}
                            onInput={handleInput}
                            title={fieldKey === 'id' ? "Format : 2 lettres majuscules suivies de 3 chiffres (ex: AB123)" : undefined}
                            readOnly={fieldKey === 'id' && !!editingStudent}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent read-only:bg-gray-900 read-only:cursor-not-allowed"
                        />
                    </div>
                );
            })}
             <div className="flex justify-end pt-4">
                <button type="submit" className="px-6 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-md font-semibold transition-colors">
                    {editingStudent ? 'Mettre à jour' : 'Enregistrer'}
                </button>
            </div>
          </form>
      </Modal>

      <Modal isOpen={isPhotoModalOpen} onClose={closePhotoModal} title={`Prendre une photo pour ${editingStudent?.firstName || ''}`}>
          <div className="flex flex-col items-center">
              <video ref={videoRef} autoPlay className="w-full h-auto rounded-md bg-black mb-4"></video>
              <canvas ref={photoCanvasRef} className="hidden"></canvas>
              <button onClick={capturePhoto} className="flex items-center px-6 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-md font-semibold transition-colors">
                  <CameraIcon className="w-5 h-5 mr-2" /> Capturer
              </button>
          </div>
      </Modal>
    </div>
  );
};

const levelDisplayMap: Record<string, string> = {
    'licence1': 'Licence 1',
    'licence2': 'Licence 2',
    'licence3': 'Licence 3',
};

const newStudentTemplate = {
    id: { label: 'Matricule (ex: AB123)', type: 'text' as const, required: true, maxLength: 5, pattern: '[A-Z]{2}[0-9]{3}', transform: 'uppercase' as const },
    lastName: { label: 'Nom', type: 'text' as const, required: true, maxLength: 10, transform: 'uppercase' as const },
    firstName: { label: 'Prénom', type: 'text' as const, required: true, maxLength: 15, transform: 'uppercase' as const },
    level: { label: 'Niveau', type: 'select' as const, required: true, options: [
        { value: 'licence1', label: 'Licence 1' },
        { value: 'licence2', label: 'Licence 2' },
        { value: 'licence3', label: 'Licence 3' },
    ] },
    dob: { label: 'Date de Naissance', type: 'date' as const, required: true },
    phone: { label: 'Téléphone', type: 'tel' as const, required: true },
    email: { label: 'Email', type: 'email' as const, required: true },
};

export default AdminView;
