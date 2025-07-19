
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeftIcon, CameraIcon, CameraOffIcon, RecordIcon } from './Icons';
import { useAppContext } from '../App';

declare const faceapi: any;

const mtcnnOptions = new faceapi.MtcnnOptions({ minFaceSize: 80, scaleFactor: 0.7 });

const SurveillanceView: React.FC = () => {
  const { 
    students, 
    addAttendanceRecord, 
    addCourseRecording, 
    attendanceRecords,
    navigateTo,
    cameraCommand,
    recordingCommand,
    clearCameraCommand,
    clearRecordingCommand
  } = useAppContext();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecognitionReady, setIsRecognitionReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading recognition models...');
  const [recognizedToday, setRecognizedToday] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  
  const intervalRef = useRef<number | null>(null);
  const faceMatcherRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const stopVideo = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    setIsCameraActive(false);
    setIsRecording(false);
  }, []);

  const startVideo = useCallback(() => {
    setLoadingMessage('Initializing camera...');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onplay = () => {
              setIsCameraActive(true);
              setLoadingMessage(''); // Clear message once playing
            };
          }
        })
        .catch(err => {
          console.error('Error accessing webcam/mic:', err);
          setLoadingMessage('Webcam/mic access denied. Please allow permissions.');
          setIsCameraActive(false);
        });
    } else {
      setLoadingMessage('Webcam not supported by this browser.');
    }
  }, []);

  useEffect(() => {
    const setupRecognition = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await Promise.all([
          faceapi.nets.mtcnn.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setLoadingMessage('Analyzing student data...');
        const labeledDescriptors = students
          .filter(s => s.photo)
          .map(async student => {
            try {
              const img = await faceapi.fetchImage(student.photo!);
              const detections = await faceapi.detectSingleFace(img, mtcnnOptions).withFaceLandmarks().withFaceDescriptor();
              if (detections) {
                return new faceapi.LabeledFaceDescriptors(student.id, [detections.descriptor]);
              }
            } catch (e) {
              console.error(`Could not process photo for student ${student.id}`, e);
            }
            return null;
          });

        const descriptors = (await Promise.all(labeledDescriptors)).filter(d => d !== null);

        if (descriptors.length === 0) {
          setLoadingMessage('No student photos found. Add photos in the admin panel.');
        } else {
          faceMatcherRef.current = new faceapi.FaceMatcher(descriptors as any, 0.7);
        }
        setIsRecognitionReady(true);
        setLoadingMessage('Ready to start surveillance.');
      } catch (error) {
        console.error('Error setting up recognition:', error);
        setLoadingMessage('Failed to load models. Check internet connection.');
      }
    };
    setupRecognition();
  }, [students]);

  useEffect(() => {
    if (!isCameraActive || !isRecognitionReady || !videoRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(async () => {
      if (videoRef.current && canvasRef.current && faceMatcherRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        const detections = await faceapi.detectAllFaces(video, mtcnnOptions).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          resizedDetections.forEach((detection: any) => {
            const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);
            const box = detection.detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, {
              label: bestMatch.toString(),
              boxColor: bestMatch.label === 'unknown' ? 'red' : 'green',
            });
            drawBox.draw(canvas);
            if (bestMatch.label !== 'unknown' && !recognizedToday.has(bestMatch.label)) {
              const studentId = bestMatch.label;
              setRecognizedToday(prev => new Set(prev).add(studentId));
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = video.videoWidth;
              tempCanvas.height = video.videoHeight;
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const snapshot = tempCanvas.toDataURL('image/jpeg');
                addAttendanceRecord({
                  studentId: studentId,
                  timestamp: new Date().toISOString(),
                  photo: snapshot,
                });
              }
            }
          });
        }
      }
    }, 1500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isCameraActive, isRecognitionReady, addAttendanceRecord, recognizedToday]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysRecords = new Set(
      attendanceRecords.filter(r => r.timestamp.startsWith(today)).map(r => r.studentId)
    );
    setRecognizedToday(todaysRecords);
  }, [attendanceRecords]);

  useEffect(() => {
    // This effect runs only on mount to register a cleanup function for unmount.
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  const handleStartRecording = useCallback(() => {
    if (videoRef.current?.srcObject && !isRecording) {
        recordedChunksRef.current = [];
        const stream = videoRef.current.srcObject as MediaStream;
        const options = { mimeType: 'video/webm; codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm; codecs=vp8';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }
        }

        try {
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };
            
            mediaRecorderRef.current.onstop = () => {
                const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                addCourseRecording({
                    timestamp: new Date().toISOString(),
                    video: videoBlob,
                });
                setIsRecording(false);
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch(e) {
            console.error("MediaRecorder error:", e);
            setLoadingMessage("Could not start recording.");
        }
    }
  }, [isRecording, addCourseRecording]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
  }, []);

  const handleStartCamera = useCallback(() => {
    if (!isCameraActive && isRecognitionReady) {
      startVideo();
    }
  }, [isCameraActive, isRecognitionReady, startVideo]);

  const handleStopCamera = useCallback(() => {
    if (isCameraActive) {
      stopVideo();
      setLoadingMessage('Surveillance stopped. Click Start to begin again.');
    }
  }, [isCameraActive, stopVideo]);

  // Effects to handle voice commands
  useEffect(() => {
      if (cameraCommand === 'start') {
          handleStartCamera();
          clearCameraCommand();
      } else if (cameraCommand === 'stop') {
          handleStopCamera();
          clearCameraCommand();
      }
  }, [cameraCommand, clearCameraCommand, handleStartCamera, handleStopCamera]);

  useEffect(() => {
      if (recordingCommand === 'start') {
          handleStartRecording();
          clearRecordingCommand();
      } else if (recordingCommand === 'stop') {
          handleStopRecording();
          clearRecordingCommand();
      }
  }, [recordingCommand, clearRecordingCommand, handleStartRecording, handleStopRecording]);

  const handleBack = () => {
    stopVideo();
    navigateTo('landing');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-400">Surveillance Automatique</h1>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto flex-grow">
      
        {/* Control Panel Section */}
        <div className="lg:w-1/4 flex-shrink-0 bg-brand-secondary p-4 rounded-lg flex flex-col">
            <h2 className="text-xl font-semibold text-white border-b border-gray-700 pb-3 mb-4 text-center">Contrôles</h2>
            <div className="space-y-4">
                <button onClick={handleStartCamera} disabled={isCameraActive || !isRecognitionReady} className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                    <CameraIcon className="w-5 h-5 mr-2" /> Démarrer Caméra
                </button>
                <button onClick={handleStopCamera} disabled={!isCameraActive} className="w-full flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                    <CameraOffIcon className="w-5 h-5 mr-2" /> Arrêter Caméra
                </button>
                <button onClick={isRecording ? handleStopRecording : handleStartRecording} disabled={!isCameraActive} className={`w-full flex items-center justify-center px-4 py-3 text-white rounded-md font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${isRecording ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    <RecordIcon className="w-5 h-5 mr-2" /> {isRecording ? 'Arrêter' : 'Enregistrer'}
                </button>
            </div>
            <div className="flex-grow"></div>
            <button onClick={handleBack} className="w-full flex items-center justify-center px-4 py-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-white font-semibold transition-colors mt-4">
                <ChevronLeftIcon className="h-5 w-5 mr-2" />
                Retour
            </button>
        </div>
        
        {/* Video Player Section */}
        <div className="flex-grow lg:w-3/4 flex flex-col">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-2xl bg-black">
                <video ref={videoRef} autoPlay muted playsInline className="absolute top-0 left-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-10" />

                {isRecording && <div className="absolute top-4 left-4 z-20 flex items-center space-x-2 bg-red-600/80 text-white px-3 py-1 rounded-full text-sm font-bold"><RecordIcon className="w-4 h-4 animate-pulse" /><span>REC</span></div>}

                {!isCameraActive && (
                  <div className="absolute inset-0 bg-black/70 z-20 flex flex-col items-center justify-center p-4">
                    <div className="flex items-center justify-center text-white mb-4">
                      {!isRecognitionReady && <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-indigo-400 mr-3"></div>}
                      <p className="text-md text-center">{loadingMessage}</p>
                    </div>
                    {!isRecognitionReady ? null : isCameraActive ? null : <CameraOffIcon className="w-20 h-20 text-gray-600" />}
                  </div>
                )}
            </div>
        </div>
      </div>

      <div className="mt-6 w-full max-w-7xl mx-auto">
        <h2 className="text-xl font-semibold mb-2 text-white">Présences enregistrées aujourd'hui : {recognizedToday.size}</h2>
        <div className="bg-brand-secondary p-4 rounded-lg max-h-40 overflow-y-auto">
          {recognizedToday.size > 0 ? (
            <ul className="space-y-2">
              {[...recognizedToday].map(studentId => {
                const student = students.find(s => s.id === studentId);
                const record = attendanceRecords.find(r => r.studentId === studentId && r.timestamp.startsWith(new Date().toISOString().split('T')[0]));
                return (
                  <li key={studentId} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                    <span className="font-medium">{student ? `${student.firstName} ${student.lastName} (${student.id})` : studentId}</span>
                    <span className="text-sm text-gray-400">{record ? new Date(record.timestamp).toLocaleTimeString() : ''}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-400 text-center">Aucun étudiant reconnu aujourd'hui.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveillanceView;
