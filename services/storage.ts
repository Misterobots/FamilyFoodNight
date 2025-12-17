
import { FamilyMember, FamilySession } from '../types';
import { encryptData, decryptData, generateFamilyCode } from './crypto';

const STORAGE_PREFIX = 'fameats_encrypted_';
const SERVER_URL_KEY = 'fameats_server_url';
const CHANNEL_NAME = 'fameats_sync_channel';
const LAST_SESSION_KEY = 'fameats_last_session';

const localSyncChannel = new BroadcastChannel(CHANNEL_NAME);

export const setServerUrl = (url: string | null) => {
    if (url) {
        const cleanUrl = url.replace(/\/$/, "");
        localStorage.setItem(SERVER_URL_KEY, cleanUrl);
    } else {
        localStorage.removeItem(SERVER_URL_KEY);
    }
};

export const getServerUrl = (): string | null => {
    return localStorage.getItem(SERVER_URL_KEY);
};

export const getStoredSession = async (familyId: string, key: string): Promise<FamilySession | null> => {
  const serverUrl = getServerUrl();
  let encryptedData: string | null = null;

  if (serverUrl) {
      try {
          const res = await fetch(`${serverUrl}/api/family/${familyId}`);
          if (res.ok) {
              const json = await res.json();
              encryptedData = json.data;
          }
      } catch (e) { console.error("Server fetch failed", e); }
  }

  if (!encryptedData) {
      encryptedData = localStorage.getItem(`${STORAGE_PREFIX}${familyId}`);
  }
  
  if (!encryptedData) return null;
  
  try {
    return await decryptData(encryptedData, key);
  } catch (e) { return null; }
};

export const saveSession = async (session: FamilySession) => {
  const serverUrl = getServerUrl();
  const updatedSession = { ...session, lastUpdated: Date.now() };
  const encrypted = await encryptData(updatedSession, session.familyKey);
  
  localStorage.setItem(`${STORAGE_PREFIX}${session.familyId}`, encrypted);
  
  const currentUser = session.members.find(m => m.isCurrentUser);
  if (currentUser) {
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify({
          id: session.familyId,
          key: session.familyKey,
          name: currentUser.name
      }));
  }

  localSyncChannel.postMessage({ type: 'UPDATE', familyId: session.familyId });

  if (serverUrl) {
      try {
          await fetch(`${serverUrl}/api/family`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ familyId: session.familyId, data: encrypted })
          });
      } catch (e) {}
  }
  
  return updatedSession;
};

export const createNewFamily = async (familyName: string, userName: string): Promise<FamilySession> => {
  const familyId = Math.random().toString(36).substr(2, 9).toUpperCase();
  const familyKey = generateFamilyCode();

  const currentUser: FamilyMember = {
    id: `user-${Date.now()}`,
    name: userName,
    avatarColor: 'bg-orange-100 text-orange-600',
    dietaryRestrictions: [],
    cuisinePreferences: [],
    flavorPreferences: [],
    preferences: [],
    favorites: [],
    isCurrentUser: true
  };

  const session: FamilySession = {
    familyId,
    familyName,
    familyKey,
    members: [currentUser],
    lastUpdated: Date.now()
  };

  await saveSession(session);
  return session;
};

export const joinWithInviteCode = async (inviteCode: string, userName: string): Promise<FamilySession> => {
    const serverUrl = getServerUrl();
    if (!serverUrl) throw new Error("Sync server not configured. Cannot join by code.");

    const res = await fetch(`${serverUrl}/api/invite/${inviteCode}`);
    if (!res.ok) throw new Error("Invalid or expired invite code.");

    const { familyId, familyKey } = await res.json();
    return await joinFamily(familyId, familyKey, userName);
};

export const joinFamily = async (familyId: string, familyKey: string, userName: string): Promise<FamilySession> => {
  let session = await getStoredSession(familyId, familyKey);
  if (!session) throw new Error("Family not found.");

  const existingUser = session.members.find(m => m.name.toLowerCase() === userName.toLowerCase());
  
  if (existingUser) {
    session.members = session.members.map(m => 
      m.id === existingUser.id ? { ...m, isCurrentUser: true } : { ...m, isCurrentUser: false }
    );
  } else {
    const newUser: FamilyMember = {
      id: `user-${Date.now()}`,
      name: userName,
      avatarColor: 'bg-blue-100 text-blue-600', 
      dietaryRestrictions: [],
      cuisinePreferences: [],
      flavorPreferences: [],
      preferences: [],
      favorites: [],
      isCurrentUser: true
    };
    session.members.push(newUser);
  }

  await saveSession(session);
  return session;
};

export const loadLastSession = async (): Promise<FamilySession | null> => {
    try {
        const stored = localStorage.getItem(LAST_SESSION_KEY);
        if (!stored) return null;
        const { id, key, name } = JSON.parse(stored);
        if (!id || !key) return null;
        return await joinFamily(id, key, name);
    } catch (e) { return null; }
};

export const getInviteCode = async (familyId: string, familyKey: string): Promise<string> => {
    const serverUrl = getServerUrl();
    if (!serverUrl) return "Sync Disabled";

    const res = await fetch(`${serverUrl}/api/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, familyKey })
    });
    const data = await res.json();
    return data.code;
};

export const subscribeToSync = (currentFamilyId: string, currentKey: string, onUpdate: (session: FamilySession) => void) => {
    const localHandler = async (event: MessageEvent) => {
        if (event.data.type === 'UPDATE' && event.data.familyId === currentFamilyId) {
            const fresh = await getStoredSession(currentFamilyId, currentKey);
            if (fresh) onUpdate(fresh);
        }
    };
    localSyncChannel.addEventListener('message', localHandler);

    let ws: WebSocket | null = null;
    const serverUrl = getServerUrl();
    
    if (serverUrl) {
        const wsUrl = serverUrl.replace(/^http/, 'ws');
        const connectWs = () => {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => ws?.send(JSON.stringify({ type: 'JOIN', familyId: currentFamilyId }));
            ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'UPDATE' && msg.familyId === currentFamilyId) {
                        const fresh = await getStoredSession(currentFamilyId, currentKey);
                        if (fresh) onUpdate(fresh);
                    }
                } catch (e) {}
            };
        };
        connectWs();
    }
    return () => {
        localSyncChannel.removeEventListener('message', localHandler);
        if (ws) ws.close();
    };
};

export const logout = () => {
    localStorage.removeItem(LAST_SESSION_KEY);
};
