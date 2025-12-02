
import { GoogleGenAI } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";
import { getServerUrl } from "./storage";

// Standard Vite environment variable
const API_KEY = import.meta.env.VITE_API_KEY || '';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

if (!API_KEY) {
    console.warn("[FamEats] API Key is missing. Consensus AI features will fail.");
}

// --- Helper: Call Backend Maps Proxy ---
// This bypasses the AI and uses the Google Places API (New) via our Node server
const fetchPlacesFromBackend = async (
    query: string, 
    location: Coordinates | null,
    limit: number = 3,
    minRating: number = 0
): Promise<Restaurant[]> => {
    try {
        const serverUrl = getServerUrl() || ''; 
        // If local mode (no server url set), we try to hit the relative path. 
        // NOTE: On mobile PWA, 'serverUrl' might be missing if user didn't explicitly set it, 
        // but if the app is served from the same domain, relative path works.
        const endpoint = serverUrl ? `${serverUrl}/api/places/search` : `/api/places/search`;
        
        console.log(`[Search] Calling proxy: ${endpoint} for "${query}"`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                latitude: location?.latitude,
                longitude: location?.longitude,
                limit,
                minRating
            })
        });

        if (!response.ok)