
import { GoogleGenAI } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";
import { getServerUrl } from "./storage";

// Safe access to environment variable
const getApiKey = () => {
  try {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_API_KEY : "") || "";
  } catch (e) {
    return "";
  }
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

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
        // If local mode (no server url set), we try to hit the relative path, assuming we are served by the backend
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

        if (!response.ok) throw new Error("Backend search failed");
        
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

// --- 1. Search for a specific place (e.g. adding favorites) ---
export const searchPlace = async (
  query: string,
  location: Coordinates | null
): Promise<Restaurant[]> => {
    // Use the Maps Proxy
    return await fetchPlacesFromBackend(query, location, 5);
};

// --- 2. Consensus Calculation (KEEPING AI) ---
// This logic is abstract negotiation, so AI is still the best tool for this part.
export const getCuisineConsensus = async (
  members: FamilyMember[]
): Promise<{ options: { cuisine: string; reasoning: string }[] }> => {
  
  const memberData = members.map((m) => ({
      n: m.name,
      no: m.dietaryRestrictions || [],
      like: m.cuisinePreferences || [],
      love: (m.flavorPreferences || []).slice(0, 2), 
      fav: (m.favorites || []).slice(0, 3).map(f => f.cuisine)
  }));

  const prompt = `
    Analyze: ${JSON.stringify(memberData)}
    Return 3 cuisine options that maximize 'like'/'love' and avoid 'no'.
    Format: JSON { "options": [{"cuisine": "...", "reasoning": "..."}] }
  `;

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const text = response.text;
      if (!text) throw new Error("No response");
      return JSON.parse(text);
  } catch (e) {
      // Fallback if AI fails
      return { options: [
          { cuisine: "Pizza", reasoning: "Everyone loves pizza." },
          { cuisine: "Burgers", reasoning: "Safe bet." },
          { cuisine: "Mexican", reasoning: "Popular choice." }
      ]};
  }
};

// --- 3. Find Best Place (Using Maps) ---
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
  const query = `${cuisine} restaurant`;
  const results = await fetchPlacesFromBackend(query, location, 3, 4.0);

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

// --- 4. Roulette (Using Maps) ---
export const getRouletteOptions = async (
    location: Coordinates | null
): Promise<Restaurant[]> => {
    // Search for highly rated "restaurants" in general
    return await fetchPlacesFromBackend("restaurant", location, 6, 4.5);
};
