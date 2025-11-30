
import { GoogleGenAI, Type } from "@google/genai";
import { FamilyMember, DiningMode, Restaurant, Coordinates } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper to search for a specific place ---
export const searchPlace = async (
  query: string,
  location: Coordinates | null
): Promise<Restaurant[]> => {
  let locationStr = "the user's current location";
  
  if (location) {
    locationStr = `lat: ${location.latitude}, long: ${location.longitude}`;
  }

  const prompt = `
    Using Google Search, find restaurants matching the name "${query}" near ${locationStr}.
    Return a list of up to 5 matches.
    
    CRITICAL OUTPUT FORMAT:
    Return ONLY a valid JSON array of objects. Do not wrap in markdown code blocks.
    Each object must have these keys:
    - name (string)
    - cuisine (string)
    - flavorProfile (array of strings, e.g. ["Spicy", "Umami", "Rich"])
    - rating (number)
    - address (string)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseSchema is not supported with tools in some versions, so we parse manually
      },
    });

    const text = response.text;
    if (!text) return [];

    // Sanitize and parse JSON
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const rawPlaces = JSON.parse(cleanText);
    
    // Add grounding
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const attachUri = (placeName: string) => {
        const chunk = groundingChunks.find(c => 
          c.web?.title?.toLowerCase().includes(placeName.toLowerCase())
        );
        return chunk?.web?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
    };

    if (!Array.isArray(rawPlaces)) return [];

    return rawPlaces.map((p: any) => ({
      name: p.name,
      cuisine: p.cuisine,
      flavorProfile: Array.isArray(p.flavorProfile) ? p.flavorProfile : [],
      rating: p.rating,
      address: p.address,
      source: 'search',
      googleMapsUri: attachUri(p.name)
    }));

  } catch (e) {
    console.error("Failed to parse place search", e);
    return [];
  }
};

// --- Helper to get consensus on cuisine ---
export const getCuisineConsensus = async (
  members: FamilyMember[]
): Promise<{ options: { cuisine: string; reasoning: string }[] }> => {
  
  // Map new data structure to prompt
  const memberData = members.map((m) => {
    // Format favorites to include flavor profile context
    const favoritesContext = m.favorites.map(f => {
       const flavors = f.flavorProfile && f.flavorProfile.length > 0 ? ` - Known for: ${f.flavorProfile.join(', ')}` : '';
       return `${f.name} (${f.cuisine}${flavors})`;
    });

    return {
      name: m.name,
      cannotEat: m.dietaryRestrictions || [],
      likes: m.cuisinePreferences || [],
      loves: m.flavorPreferences || [],
      favoritePlaces: favoritesContext
    };
  });

  const prompt = `
    Here are the food profiles of family members who want to eat together:
    ${JSON.stringify(memberData)}

    Analyze these profiles.
    1. STRICT RULE: Do NOT suggest cuisines that violate any member's "cannotEat" restrictions.
    2. Prioritize intersections of "loves" and the flavor profiles of their "favoritePlaces".
    3. Use "likes" as secondary weights.
    4. Return exactly 3 distinct cuisine options for them to vote on.
    5. Provide a very short, fun reasoning for each option (max 10 words).
  `;

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
                reasoning: { type: Type.STRING },
              },
              required: ["cuisine", "reasoning"],
            },
          },
        },
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text);
};

// --- Helper to find the specific place ---
export const findBestPlace = async (
  cuisine: string,
  mode: DiningMode,
  members: FamilyMember[],
  location: Coordinates | null
): Promise<{ recommended: Restaurant; alternatives: Restaurant[] }> => {
  
  const allFavorites = members.flatMap((m) => m.favorites);
  
  // Filter favorites by cuisine to prioritize them
  const relevantFavorites = allFavorites.filter(f => f.cuisine.toLowerCase().includes(cuisine.toLowerCase()) || cuisine.toLowerCase().includes(f.cuisine.toLowerCase()));

  let locationStr = "the user's current location";

  if (location) {
    locationStr = `lat: ${location.latitude}, long: ${location.longitude}`;
  }

  const prompt = `
    Task: Find the best place to eat.
    Context: The family has chosen "${cuisine}". Mode: "${mode}".
    Current Location: ${locationStr}.
    Relevant Family Favorites (Prioritize these if they match the cuisine): ${JSON.stringify(relevantFavorites)}
    
    Dietary Restrictions (CRITICAL): ${JSON.stringify(members.map(m => m.dietaryRestrictions).flat())}
    Flavor Preferences (Consider these): ${JSON.stringify(members.map(m => m.flavorPreferences).flat())}

    Instructions:
    1. Check "Relevant Family Favorites" first. If one matches the cuisine and mode well, recommend it.
    2. If no favorites match, use Google Search to find 3 highly rated "${cuisine}" places near ${locationStr} suitable for "${mode}".
    3. Ensure recommendations respect the Dietary Restrictions provided.
    4. Output Valid JSON ONLY. No markdown.
       Structure:
       {
         "recommended": { "name": "...", "cuisine": "...", "rating": 4.5, "address": "...", "flavorProfile": ["..."] },
         "alternatives": [ ...same structure... ]
       }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let cleanText = response.text || "";
    cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsedData: { recommended: any; alternatives: any[] };
    
    try {
       parsedData = JSON.parse(cleanText);
    } catch (e) {
      parsedData = {
          recommended: { name: "Search Result", cuisine: cuisine, source: "search", address: "See map" },
          alternatives: []
      };
    }

    const attachUri = (placeName: string) => {
      const chunk = groundingChunks.find(c => 
        c.web?.title?.toLowerCase().includes(placeName.toLowerCase()) || 
        (c.web?.uri && placeName.toLowerCase().includes("restaurant"))
      );
      return chunk?.web?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
    };

    const processPlace = (p: any): Restaurant => ({
        name: p.name,
        cuisine: p.cuisine || cuisine,
        flavorProfile: Array.isArray(p.flavorProfile) ? p.flavorProfile : [],
        rating: p.rating,
        address: p.address,
        source: p.source || 'search',
        googleMapsUri: attachUri(p.name)
    });

    return {
      recommended: processPlace(parsedData.recommended),
      alternatives: (parsedData.alternatives || []).map(processPlace)
    };
  } catch (e) {
    console.error("Find Best Place Error", e);
    throw e;
  }
};

// --- Helper for Roulette ---
export const getRouletteOptions = async (
    location: Coordinates | null
): Promise<Restaurant[]> => {
    
    let locationStr = "current location";
    if (location) {
        locationStr = `lat: ${location.latitude}, long: ${location.longitude}`;
    }

    const prompt = `
      Use Google Search to find 6 diverse, highly-rated restaurants near ${locationStr}.
      They must be different cuisines (e.g., one Italian, one Thai, one Burger, etc.).
      
      Return a valid JSON array of objects (NO markdown blocks).
      Keys: name, cuisine, rating.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        let cleanText = response.text || "";
        cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        let places: any[] = [];
        try {
           const parsed: any = JSON.parse(cleanText);
           if(Array.isArray(parsed)) {
               places = parsed;
           } else if (parsed && typeof parsed === 'object') {
               const keys = Object.keys(parsed);
               const arrayKey = keys.find(k => Array.isArray(parsed[k]));
               if (arrayKey) {
                 places = parsed[arrayKey];
               } else {
                 if(parsed.name) places = [parsed];
               }
           }
        } catch (e) {
            console.error("Failed to parse roulette options", e);
            return [];
        }

        const attachUri = (placeName: string) => {
            const chunk = groundingChunks.find(c => 
              c.web?.title?.toLowerCase().includes(placeName.toLowerCase())
            );
            return chunk?.web?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
        };

        return places.slice(0, 6).map(p => ({
            name: p.name,
            cuisine: p.cuisine,
            rating: p.rating,
            source: 'roulette',
            googleMapsUri: attachUri(p.name)
        }));
    } catch (e) {
        console.error("Roulette Error", e);
        return [];
    }
};
