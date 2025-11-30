
import { FamilyMember, FamilySession } from '../types';

const STORAGE_KEY = 'fameats_session';

const DEFAULT_MEMBERS: FamilyMember[] = [
  {
    id: 'mom-1',
    name: 'Mom',
    avatarColor: 'bg-pink-100 text-pink-600',
    dietaryRestrictions: [],
    cuisinePreferences: ['Sushi', 'Thai'],
    flavorPreferences: ['Spicy', 'Light'],
    favorites: [{ name: "Thai Spice", cuisine: "Thai", source: 'favorite' }]
  },
  {
    id: 'kid-1',
    name: 'Leo',
    avatarColor: 'bg-blue-100 text-blue-600',
    dietaryRestrictions: [],
    cuisinePreferences: ['Burgers', 'Pizza', 'Mac n Cheese'],
    flavorPreferences: ['Cheesy', 'Simple'],
    favorites: []
  },
  {
    id: 'teen-1',
    name: 'Sarah',
    avatarColor: 'bg-purple-100 text-purple-600',
    dietaryRestrictions: [],
    cuisinePreferences: ['Korean BBQ', 'Ramen'],
    flavorPreferences: ['Umami', 'Savory'],
    favorites: []
  }
];

export const getSession = (): FamilySession | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const createSession = (familyName: string, userName: string): FamilySession => {
  const currentUser: FamilyMember = {
    id: `user-${Date.now()}`,
    name: userName,
    avatarColor: 'bg-orange-100 text-orange-600',
    dietaryRestrictions: [],
    cuisinePreferences: [],
    flavorPreferences: [],
    favorites: [],
    isCurrentUser: true
  };

  const session: FamilySession = {
    familyId: Math.random().toString(36).substr(2, 9).toUpperCase(),
    familyName,
    familyKey: Math.random().toString(36).substr(2, 6).toUpperCase(),
    members: [currentUser, ...DEFAULT_MEMBERS],
    lastUpdated: Date.now()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
};

export const updateSessionMembers = (members: FamilyMember[]) => {
  const session = getSession();
  if (session) {
    session.members = members;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEY);
};
