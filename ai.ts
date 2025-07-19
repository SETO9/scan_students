
import { GoogleGenAI, Type } from "@google/genai";
import type { Command } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const commandSchema = {
    type: Type.OBJECT,
    properties: {
        action: {
            type: Type.STRING,
            description: "The primary category of the action to be performed.",
            enum: ['navigate', 'view', 'camera', 'record', 'search', 'filter', 'export', 'add_student', 'unknown']
        },
        payload: {
            type: Type.OBJECT,
            description: "Data associated with the action.",
            properties: {
                page: {
                    type: Type.STRING,
                    description: "The main application page to navigate to.",
                    enum: ['admin', 'surveillance', 'landing']
                },
                view: {
                    type: Type.STRING,
                    description: "The specific view within the admin panel.",
                    enum: ['dashboard', 'students', 'attendance', 'courses']
                },
                operation: {
                    type: Type.STRING,
                    description: "The sub-action to perform, like start or stop.",
                    enum: ['start', 'stop']
                },
                searchTerm: {
                    type: Type.STRING,
                    description: "The term to search for."
                },
                level: {
                    type: Type.STRING,
                    description: "The student level to filter by.",
                    enum: ['all', 'licence1', 'licence2', 'licence3']
                }
            }
        },
        feedback: {
            type: Type.STRING,
            description: "A confirmation message to give to the user, in French."
        }
    },
    required: ['action', 'feedback']
};

const systemInstruction = `
You are a voice command interpreter for a student management web application called 'ScanStudents AI'.
Your task is to analyze the user's command, spoken in French, and translate it into a structured JSON object based on the provided schema.

Application Pages:
- 'landing': The home page. (e.g., "accueil", "page d'accueil")
- 'admin': The administration panel. (e.g., "admin", "administration")
- 'surveillance': The live camera surveillance page. (e.g., "surveillance")

Admin Panel Views:
- 'dashboard': The main admin dashboard. (e.g., "tableau de bord")
- 'students': The student management list. (e.g., "étudiants", "liste des étudiants")
- 'attendance': The attendance records list. (e.g., "présence", "liste de présence")
- 'courses': The recorded courses list. (e.g., "cours", "enregistrements")

Possible Actions:
- 'navigate': To go to a main page. (e.g., "Va sur la page admin", "Retour à l'accueil").
- 'view': To switch views within the admin panel. (e.g., "Montre-moi les étudiants", "Affiche la liste de présence").
- 'camera': To control the camera on the surveillance page. (e.g., "Démarre la caméra", "Arrête la surveillance"). Requires 'operation' payload.
- 'record': To control video recording on the surveillance page. (e.g., "Commence l'enregistrement", "Arrête l'enregistrement"). Requires 'operation' payload.
- 'search': To search for a student. Requires 'searchTerm' payload. (e.g., "Cherche Jean Dupont", "Trouve l'étudiant avec la matricule AB123").
- 'filter': To filter the student list. Requires 'level' payload. (e.g., "Filtre par licence 1", "Montre tous les niveaux").
- 'export': To export the attendance list to PDF. (e.g., "Exporte la liste de présence en PDF").
- 'add_student': To open the form for adding a new student. (e.g., "Ajouter un nouvel étudiant").
- 'unknown': If the command is ambiguous, nonsensical, or cannot be mapped to an action.

Rules:
1. Always respond with a valid JSON object matching the schema.
2. The 'feedback' message should be a concise, user-friendly confirmation in French. For 'unknown', it should be a polite message indicating you didn't understand.
3. Infer the correct action and payload from the user's natural language. For example, "montre-moi les étudiants" is action: 'view', payload: { view: 'students' }.
4. For filtering, "tous" or "tous les niveaux" should map to 'all'. "Licence 1" maps to 'licence1', etc.
`;


export const getCommandFromTranscript = async (transcript: string): Promise<Command> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the following user command and return the corresponding JSON object. Command: "${transcript}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: commandSchema,
                systemInstruction,
            },
        });

        const jsonStr = response.text.trim();
        const command = JSON.parse(jsonStr);
        console.log("Gemini Command:", command);
        return command as Command;
    } catch (error) {
        console.error("Error getting command from Gemini:", error);
        return {
            action: 'unknown',
            feedback: "Désolé, une erreur est survenue avec l'assistant vocal."
        };
    }
};
