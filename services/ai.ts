
import { GoogleGenAI, Type } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";
import { getServerUrl } from "./storage";

// Declare the global constant defined in vite.config.ts
declare const __API_KEY__: string;

// Use the global constant directly. 
// Vite will replace __API_KEY__ with the actual string "AIza..." at build time.
const API_KEY = typeof __API_KEY__ !== 'undefined' ? __API_KEY__ : '';

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
        // If local mode (no server url set), we try to hit the relative path
        const endpoint = serverUrl ? `${serverUrl}/api/places/search` : `/api/places/search`;
        
        console.log(`[Search] Calling proxy: ${endpoint} for "${query}"`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-fameats-api-key': API_KEY // Pass the client key as fallback
            },
            body: JSON.stringify({
                query,
                latitude: location?.latitude,
                longitude: location?.longitude,
                limit,
                minRating
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`[Search] Backend failed (${response.status}):`, err);
            throw new Error("Backend search failed");
        }
        
        const places = await response.json();
        
        return places.map((p: any) => ({
            name: p.displayName?.text || "Unknown",
            cuisine: p.primaryType ? p.primaryType.replace(/_/g, ' ') : "Restaurant",
            flavorProfile: [],
            rating: p.rating || 0,
            address: p.formattedAddress || "See Map",
            source: 'search',
            googleMapsUri: p.googleMapsUri
        }));

    } catch (e) {
        console.error("Maps Proxy Error", e);
        return [];
    }
};

// --- 1. Search for a specific place (Favorites) ---
// USES BACKEND PROXY (No AI)
export const searchPlace = async (
  query: string,
  location: Coordinates | null
): Promise<Restaurant[]> => {
    return await fetchPlacesFromBackend(query, location, 5);
};

// --- 2. Consensus Calculation (USES AI) ---
// AI is used only for text negotiation, not for finding places.
export const getCuisineConsensus = async (
  members: FamilyMember[]
): Promise<{ options: { cuisine: string; reasoning: string }[] }> => {
  
  if (!API_KEY) {
      return { options: [
          { cuisine: "Pizza", reasoning: "Consensus unavailable (API Key missing)." },
          { cuisine: "Burgers", reasoning: "Consensus unavailable (API Key missing)." },
          { cuisine: "Tacos", reasoning: "Consensus unavailable (API Key missing)." }
      ]};
  }

  // Optimized member data to save input tokens
  const memberData = members.map((m) => ({
      n: m.name,
      no: m.dietaryRestrictions || [],
      like: m.cuisinePreferences || [],
      love: (m.flavorPreferences || []).slice(0, 2)
  }));

  // Concise prompt relying on Schema for structure
  const prompt = `Analyze preferences: ${JSON.stringify(memberData)}. Return 3 distinct cuisines.`;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
                            },
                            required: ["cuisine", "reasoning"]
                        }
                    }
                }
            },
            maxOutputTokens: 200, // Strict limit for efficiency
            thinkingConfig: { thinkingBudget: 0 } // Disable thinking to save tokens
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response");
      return JSON.parse(text);
  } catch (e: any) {
      // Improve error logging for the specific 403 case
      if (e.toString().includes("403") || e.toString().includes("API_KEY_SERVICE_BLOCKED")) {
        console.error("🚨 CONFIG ERROR: 'Generative Language API' is not enabled in your Google Cloud Console.");
        console.error("👉 Enable it here: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com");
      } else {
        console.error("AI Consensus Error", e);
      }

      return { options: [
          { cuisine: "Pizza", reasoning: "Everyone loves pizza." },
          { cuisine: "Burgers", reasoning: "Safe bet." },
          { cuisine: "Mexican", reasoning: "Popular choice." }
      ]};
  }
};

// --- 3. Find Best Place (USES BACKEND PROXY) ---
export const findBestPlace = async (
  cuisine: string,
  mode: DiningMode,
  members: FamilyMember[],
  location: Coordinates | null
): Promise<{ recommended: Restaurant; alternatives: Restaurant[] }> => {
  
  // A. Check Favorites (Instant)
  const allFavorites = members.flatMap((m) => m.favorites);
  const relevantFavorites = allFavorites.filter(f => 
    f.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || 
    cuisine.toLowerCase().includes(f.cuisine.toLowerCase())
  );

  if (relevantFavorites.length > 0) {
      const winner = relevantFavorites.sort((a,b) => (b.rating || 0) - (a.rating || 0))[0];
      const alts = relevantFavorites.filter(f => f.name !== winner.name).slice(0, 2);
      return {
          recommended: { ...winner, source: 'favorite' },
          alternatives: alts
      };
  }

  // B. Search Maps (Fast & Accurate)
  // We append "restaurant" or "delivery" based on mode
  const suffix = mode === 'takeout' ? 'delivery' : 'restaurant';
  const query = `${cuisine} ${suffix}`;
  
  const results = await fetchPlacesFromBackend(query, location, 3, 3.5);

  if (results.length > 0) {
      return {
          recommended: results[0],
          alternatives: results.slice(1)
      };
  }

  // C. Fallback
  return {
      recommended: { 
          name: `${cuisine} Place`, 
          cuisine: cuisine, 
          source: 'search', 
          rating: 0,
          googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cuisine)}` 
      },
      alternatives: []
  };
};

// --- 4. Roulette (USES BACKEND PROXY) ---
export const getRouletteOptions = async (
    location: Coordinates | null
): Promise<Restaurant[]> => {
    return await fetchPlacesFromBackend("restaurant", location, 6, 4.0);
};
