
import { GoogleGenAI, Type } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";
import { getServerUrl } from "./storage";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: Call Backend Maps Proxy ---
const fetchPlacesFromBackend = async (
    query: string, 
    location: Coordinates | null,
    limit: number = 3,
    minRating: number = 0
): Promise<Restaurant[]> => {
    try {
        const serverUrl = getServerUrl() || ''; 
        // Use relative path if serverUrl is not set (assumes same origin), otherwise full URL
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

        if (!response.ok) {
            console.warn("[Search] Proxy failed (possibly offline or configured incorrectly).");
            return [];
        }

        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.map((p: any) => ({
            name: p.displayName?.text || p.name || "Unknown",
            cuisine: p.primaryType || "Restaurant",
            rating: p.rating || 0,
            address: p.formattedAddress || "",
            googleMapsUri: p.googleMapsUri,
            source: 'search'
        }));

    } catch (e) {
        console.error("Search failed", e);
        return [];
    }
};

// --- Exported Functions ---

export const searchPlace = async (query: string, location: Coordinates | null): Promise<Restaurant[]> => {
    return fetchPlacesFromBackend(query, location, 5);
};

export const getCuisineConsensus = async (members: FamilyMember[]): Promise<{ options: { cuisine: string, reasoning: string }[] }> => {
    try {
        const prompt = `
        Analyze the taste profiles of this family and suggest 4 distinct dining options (cuisines or styles) that would satisfy everyone.
        
        Family Members:
        ${members.map(m => `- ${m.name}: Likes [${m.cuisinePreferences.join(', ')}], Loves [${m.flavorPreferences.join(', ')}], Avoids [${m.dietaryRestrictions.join(', ')}]`).join('\n')}
        
        Return exactly 4 options.
        `;

        // Using gemini-3-flash-preview for the consensus task as it is optimized for basic text reasoning and categorization.
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    cuisine: { type: Type.STRING },
                                    reasoning: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI");
        return JSON.parse(text);

    } catch (e) {
        console.error("AI Consensus failed", e);
        // Fallback options if AI fails
        return {
            options: [
                { cuisine: "Pizza", reasoning: "A universal crowd pleaser." },
                { cuisine: "Mexican", reasoning: "Great variety for all tastes." },
                { cuisine: "Burgers", reasoning: "Classic and satisfying." },
                { cuisine: "Italian", reasoning: "Comfort food for everyone." }
            ]
        };
    }
};

export const findBestPlace = async (
    cuisine: string, 
    mode: DiningMode, 
    members: FamilyMember[], 
    location: Coordinates | null
): Promise<{ recommended: Restaurant }> => {
    // 1. Search for real places via Backend Proxy
    const query = `Best ${cuisine} ${mode === 'takeout' ? 'takeout' : 'restaurant'}`;
    const places = await fetchPlacesFromBackend(query, location, 5, 3.5);

    if (places.length === 0) {
        // Return a fallback object that triggers the "Search Failed" UI instead of throwing an error
        return {
             recommended: {
                 name: cuisine,
                 cuisine: cuisine,
                 source: 'search',
                 rating: 0,
                 address: 'Search on Maps',
                 googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cuisine + ' food')}`
             }
        };
    }

    // 2. Simple ranking: Pick the highest rated one
    const best = places.reduce((prev, current) => (prev.rating || 0) > (current.rating || 0) ? prev : current);
    
    return { recommended: best };
};

export const getRouletteOptions = async (location: Coordinates | null): Promise<Restaurant[]> => {
    const places = await fetchPlacesFromBackend("best dinner restaurants", location, 10, 4.0);
    if (places.length === 0) {
        // Mock data if live search fails
        return [
            { name: "Local Pizza", cuisine: "Italian", source: 'roulette', rating: 4.5 },
            { name: "Burger Joint", cuisine: "American", source: 'roulette', rating: 4.2 },
            { name: "Taco Stand", cuisine: "Mexican", source: 'roulette', rating: 4.8 },
            { name: "Noodle House", cuisine: "Asian", source: 'roulette', rating: 4.3 },
            { name: "Sushi Bar", cuisine: "Japanese", source: 'roulette', rating: 4.6 },
            { name: "BBQ Pit", cuisine: "BBQ", source: 'roulette', rating: 4.4 }
        ];
    }
    return places.slice(0, 6);
};
