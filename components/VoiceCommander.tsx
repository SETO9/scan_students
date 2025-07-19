import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../App';
import { getCommandFromTranscript } from '../ai';
import { MicIcon } from './Icons';

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;

// A grammar model to help the speech recognition engine understand app-specific terms.
const keywords = [
  'accueil', 'admin', 'administration', 'surveillance', 'tableau de bord',
  'étudiants', 'présence', 'cours', 'enregistrements', 'liste',
  'caméra', 'enregistrement', 'pdf',
  'va', 'aller', 'navigue', 'montre', 'affiche', 'voir', 'retourne',
  'démarrer', 'commencer', 'activer',
  'arrêter', 'stopper', 'désactiver',
  'chercher', 'trouver', 'rechercher',
  'filtrer', 'filtre', 'niveau',
  'licence 1', 'licence 2', 'licence 3', 'tous',
  'exporter', 'télécharger',
  'ajouter', 'créer', 'nouvel',
  'Jean', 'Dupont', 'Martin' // Example names to improve recognition
];
const grammar = `#JSGF V1.0; grammar commands; public <command> = ${keywords.join(' | ')};`


const VoiceCommander: React.FC = () => {
    const { executeVoiceCommand } = useAppContext();
    const [isListening, setIsListening] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const feedbackTimeoutRef = useRef<number | null>(null);

    const showFeedback = useCallback((message: string, duration: number = 5000) => {
        setFeedback(message);
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
        feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(null), duration);
    }, []);

    useEffect(() => {
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported.");
            return;
        }
        const recognition = new SpeechRecognition();

        // Add our custom grammar model for better accuracy on specific keywords.
        if (SpeechGrammarList) {
            const speechRecognitionList = new SpeechGrammarList();
            speechRecognitionList.addFromString(grammar, 1);
            recognition.grammars = speechRecognitionList;
        }

        recognition.continuous = false;
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            showFeedback("Je vous écoute...", 10000);
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript;
            showFeedback(`Analyse de : "${transcript}"...`);
            try {
                const command = await getCommandFromTranscript(transcript);
                const executionFeedback = executeVoiceCommand(command);
                showFeedback(executionFeedback || command.feedback);
            } catch (error) {
                console.error("Error during command interpretation:", error);
                showFeedback("Une erreur est survenue lors de l'interprétation de la commande.");
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            if (feedbackTimeoutRef.current) {
                // Keep "analyzing" or feedback message on screen a bit longer, don't clear it immediately.
            }
        };
        
        recognition.onerror = (event: any) => {
            // Log a clean object to the console for easier debugging.
            console.error("Speech recognition error:", { type: event.error, message: event.message });

            let feedbackMessage: string;
            if (event.error === 'no-speech') {
                feedbackMessage = "Je n'ai rien entendu. Assurez-vous que votre micro est activé et parlez clairement.";
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                feedbackMessage = "L'accès au microphone est refusé. Veuillez l'autoriser dans les paramètres de votre navigateur.";
            } else if (event.message) {
                // Provide a more descriptive error if the browser provides one.
                feedbackMessage = `Erreur de reconnaissance : ${event.message}`;
            } else {
                feedbackMessage = `Erreur de reconnaissance : ${event.error}`;
            }
            
            showFeedback(feedbackMessage, 5000);
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            if (feedbackTimeoutRef.current) {
                clearTimeout(feedbackTimeoutRef.current);
            }
        }
    }, [executeVoiceCommand, showFeedback]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            return showFeedback("La reconnaissance vocale n'est pas supportée sur ce navigateur.");
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Could not start recognition:", e);
                // This catch handles cases where start() is called improperly (e.g., already started)
                if (e instanceof Error) {
                    showFeedback(`Impossible de démarrer: ${e.message}`);
                } else {
                    showFeedback("Impossible de démarrer la reconnaissance vocale.");
                }
            }
        }
    };
    
    return (
        <>
            {feedback && (
                <div className="fixed bottom-24 right-5 md:right-8 bg-brand-accent text-white py-2 px-4 rounded-lg shadow-2xl z-50 transition-opacity duration-300 animate-pulse">
                    {feedback}
                </div>
            )}
            <button
                onClick={toggleListening}
                aria-label={isListening ? "Arrêter l'écoute" : "Activer la commande vocale"}
                className={`fixed bottom-5 right-5 md:bottom-8 md:right-8 z-50 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300
                    ${isListening ? 'bg-red-600 animate-pulse' : 'bg-brand-accent hover:bg-brand-accent-hover'}
                `}
            >
                <MicIcon className="w-8 h-8" />
            </button>
        </>
    );
};

export default VoiceCommander;
