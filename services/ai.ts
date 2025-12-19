
import { GoogleGenAI, Type } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";
import { getServerUrl } from "./storage";

/**
 * Helper to get a fresh AI instance.
 * Ensures we only instantiate when needed and prevents crashes if API_KEY is missing.
 */
const getAIClient = () => {
  const apiKey = process?.env?.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing from the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Helper: Call Backend Maps Proxy ---
const fetchPlacesFromBackend = async (
    query: string, 
    location: Coordinates | null,
    limit: number = 3,
    minRating: number = 0
): Promise<Restaurant[]> => {
    try {
        const serverUrl = getServerUrl() || ''; 
        const endpoint = serverUrl ? `${serverUrl}/api/places/search` : `/api/places/search`;
        
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

        if (!response.ok) return [];

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
    return fetchPlacesFromBackend(query, location, 8);
};

export const getCuisineConsensus = async (members: FamilyMember[]): Promise<{ options: { cuisine: string, reasoning: string }[] }> => {
    try {
        const ai = getAIClient();
        const allFavorites = members.flatMap(m => m.favorites.map(f => `${f.name} (${f.cuisine})`));
        const favoriteCuisines = Array.from(new Set(members.flatMap(m => m.favorites.map(f => f.cuisine))));

        const prompt = `
        Analyze the taste profiles of this family and suggest 4 distinct dining options (cuisines or styles) that would satisfy everyone.
        
        Family Members:
        ${members.map(m => `- ${m.name}: Likes [${m.cuisinePreferences.join(', ')}], Loves [${m.flavorPreferences.join(', ')}], Avoids [${m.dietaryRestrictions.join(', ')}]`).join('\n')}
        
        Their Collective Favorite Spots: [${allFavorites.join(', ')}]
        Their Shared Favorite Cuisines: [${favoriteCuisines.join(', ')}]

        If any of their favorites match the general consensus, mention them in the reasoning.
        Return exactly 4 options.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
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
    // 1. Check if any member has a favorite in this cuisine
    const matchingFavorites = members
        .flatMap(m => m.favorites)
        .filter(f => f.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || cuisine.toLowerCase().includes(f.cuisine.toLowerCase()));

    if (matchingFavorites.length > 0) {
        // Return the first matching favorite as high priority
        return { recommended: { ...matchingFavorites[0], source: 'favorite' } };
    }

    const query = `Best ${cuisine} ${mode === 'takeout' ? 'takeout' : 'restaurant'}`;
    const places = await fetchPlacesFromBackend(query, location, 5, 3.5);

    if (places.length === 0) {
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

    const best = places.reduce((prev, current) => (prev.rating || 0) > (current.rating || 0) ? prev : current);
    return { recommended: best };
};

export const getRouletteOptions = async (location: Coordinates | null, members: FamilyMember[] = []): Promise<Restaurant[]> => {
    // Combine some favorites into the roulette for personality
    const favs = members.flatMap(m => m.favorites).slice(0, 3);
    const searchResults = await fetchPlacesFromBackend("best dinner restaurants", location, 10, 4.0);
    
    const combined = [...favs, ...searchResults];
    // Remove duplicates by name
    const unique = Array.from(new Map(combined.map(item => [item.name, item])).values());

    if (unique.length === 0) {
        return [
            { name: "Local Pizza", cuisine: "Italian", source: 'roulette', rating: 4.5 },
            { name: "Burger Joint", cuisine: "American", source: 'roulette', rating: 4.2 },
            { name: "Taco Stand", cuisine: "Mexican", source: 'roulette', rating: 4.8 },
            { name: "Noodle House", cuisine: "Asian", source: 'roulette', rating: 4.3 },
            { name: "Sushi Bar", cuisine: "Japanese", source: 'roulette', rating: 4.6 },
            { name: "BBQ Pit", cuisine: "BBQ", source: 'roulette', rating: 4.4 }
        ];
    }
    return unique.slice(0, 8);
};
