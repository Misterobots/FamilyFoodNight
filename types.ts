
export interface Restaurant {
  name: string;
  cuisine: string;
  flavorProfile?: string[]; // Added for matching logic
  rating?: number;
  address?: string;
  source: 'favorite' | 'search' | 'roulette';
  googleMapsUri?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  avatarColor: string;
  // Detailed Preferences
  dietaryRestrictions: string[]; // "Cannot Have"
  cuisinePreferences: string[];  // "Like to Have"
  flavorPreferences: string[];   // "Love to Have"
  
  // Legacy support (optional)
  preferences?: string[]; 
  
  favorites: Restaurant[];       // "10/10 Would Feast Again"
  isCurrentUser?: boolean; 
}

export type DiningMode = 'restaurant' | 'takeout';

export interface VoteOption {
  id: string;
  cuisine: string; 
  votes: number;
  reasoning?: string;
  isDontCare?: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface FamilySession {
  familyId: string;
  familyName: string;
  familyKey: string; // The user-facing password/code
  members: FamilyMember[];
  lastUpdated: number;
}

export interface SyncState {
  status: 'synced' | 'syncing' | 'offline';
  lastSync?: Date;
}

export interface ServerConfig {
  url: string | null; // null means local mode
}
