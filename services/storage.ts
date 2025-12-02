
import { FamilyMember, FamilySession, ServerConfig } from '../types';
import { encryptData, decryptData, generateFamilyCode } from './crypto';

const STORAGE_PREFIX = 'fameats_encrypted_';
const SERVER_URL_KEY = 'fameats_server_url';
const CHANNEL_NAME = 'fameats_sync_channel';
const LAST_SESSION_KEY = 'fameats_last_session';

// Local Sync Channel (for when running without server or multiple tabs)
const localSyncChannel = new BroadcastChannel(CHANNEL_NAME);

// --- Server Configuration ---

export const setServerUrl = (url: string | null) => {
    if (url) {
        // Strip trailing slash
        const cleanUrl = url.replace(/\/$/, "");
        localStorage.setItem(SERVER_URL_KEY, cleanUrl);
    } else {
        localStorage.removeItem(SERVER_URL_KEY);
    }
};

export const getServerUrl = (): string | null => {
    return localStorage.getItem(SERVER_URL_KEY);
};

// --- Persistence Logic ---

export const getStoredSession = async (familyId: string, key: string): Promise<FamilySession | null> => {
  const serverUrl = getServerUrl();

  let encryptedData: string | null = null;

  if (serverUrl) {
      // Fetch from Server
      try {
          const res = await fetch(`${serverUrl}/api/family/${familyId}`);
          if (res.ok) {
              const json = await res.json();
              encryptedData = json.data;
          }
      } catch (e) {
          console.error("Server fetch failed, falling back to local if available", e);
      }
  }

  // Fallback or Primary Local Storage
  if (!encryptedData) {
      encryptedData = localStorage.getItem(`${STORAGE_PREFIX}${familyId}`);
  }
  
  if (!encryptedData) return null;
  
  try {
    return await decryptData(encryptedData, key);
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
};

export const saveSession = async (session: FamilySession) => {
  const serverUrl = getServerUrl();
  
  // Update timestamp
  const updatedSession = { ...session, lastUpdated: Date.now() };
  
  // Encrypt (Zero Knowledge: Server never sees raw data)
  const encrypted = await encryptData(updatedSession, session.familyKey);
  
  // 1. Save Local (Always cache locally)
  localStorage.setItem(`${STORAGE_PREFIX}${session.familyId}`, encrypted);
  
  // 2. Save Last Active Credentials for Auto-Login
  localStorage.setItem(LAST_SESSION_KEY, JSON.stringify({
      id: session.familyId,
      key: session.familyKey,
      name: session.members.find(m => m.isCurrentUser)?.name || 'User'
  }));

  localSyncChannel.postMessage({ type: 'UPDATE', familyId: session.familyId });

  // 3. Save Remote (if configured)
  if (serverUrl) {
      try {
          await fetch(`${serverUrl}/api/family`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  familyId: session.familyId,
                  data: encrypted
              })
          });
      } catch (e) {
          console.error("Failed to sync to server", e);
      }
  }
  
  return updatedSession;
};

// --- Initialization ---

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

export const joinFamily = async (familyId: string, familyKey: string, userName: string): Promise<FamilySession> => {
  // Try to load existing (Remote or Local)
  let session = await getStoredSession(familyId, familyKey);
  
  if (!session) {
    throw new Error("Family not found. Check ID/Code or ensure Server URL is set if using cloud sync.");
  }

  // Check if user already exists
  const existingUser = session.members.find(m => m.name.toLowerCase() === userName.toLowerCase());
  
  if (existingUser) {
    session.members = session.members.map(m => 
      m.id === existingUser.id ? { ...m, isCurrentUser: true } : { ...m, isCurrentUser: false }
    );
  } else {
    // Add new user
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

// --- Auto Login ---

export const loadLastSession = async (): Promise<FamilySession | null> => {
    try {
        const stored = localStorage.getItem(LAST_SESSION_KEY);
        if (!stored) return null;
        
        const { id, key, name } = JSON.parse(stored);
        if (!id || !key) return null;

        return await joinFamily(id, key, name);
    } catch (e) {
        console.error("Auto-login failed", e);
        return null;
    }
};

// --- Export/Import Logic ---

export const exportSessionString = async (session: FamilySession): Promise<string> => {
    const encrypted = await encryptData(session, session.familyKey);
    const serverUrl = getServerUrl() || '';
    const payload = `${session.familyId}|${session.familyKey}|${encrypted}|${serverUrl}`;
    return btoa(payload);
};

export const importSessionString = async (importString: string): Promise<FamilySession> => {
    try {
        const decoded = atob(importString);
        const parts = decoded.split('|');
        const familyId = parts[0];
        const familyKey = parts[1];
        const encryptedBlob = parts[2];
        const serverUrl = parts[3] || null;

        if (!familyId || !familyKey || !encryptedBlob) throw new Error("Invalid format");

        if (serverUrl) {
            setServerUrl(serverUrl);
        }

        const session = await decryptData(encryptedBlob, familyKey);
        
        // Save
        localStorage.setItem(`${STORAGE_PREFIX}${familyId}`, encryptedBlob);
        
        // Save and triggering update
        setTimeout(() => saveSession(session), 100);
        
        return session;
    } catch (e) {
        throw new Error("Failed to import session. Invalid code.");
    }
};

// --- Subscriptions (WebSocket + BroadcastChannel) ---

export const subscribeToSync = (
    currentFamilyId: string, 
    currentKey: string, 
    onUpdate: (session: FamilySession) => void
) => {
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
            
            ws.onopen = () => {
                ws?.send(JSON.stringify({ type: 'JOIN', familyId: currentFamilyId }));
            };

            ws.onmessage = async (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'UPDATE' && msg.familyId === currentFamilyId) {
                        const fresh = await getStoredSession(currentFamilyId, currentKey);
                        if (fresh) onUpdate(fresh);
                    }
                } catch (e) { console.error("WS Parse Err", e); }
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
