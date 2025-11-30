
import { FamilyMember, FamilySession, ServerConfig } from '../types';
import { encryptData, decryptData, generateFamilyCode } from './crypto';

const STORAGE_PREFIX = 'fameats_encrypted_';
const SERVER_URL_KEY = 'fameats_server_url';
const CHANNEL_NAME = 'fameats_sync_channel';

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
  localSyncChannel.postMessage({ type: 'UPDATE', familyId: session.familyId });

  // 2. Save Remote (if configured)
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
          // TODO: Implement queue for retry
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

// --- Export/Import Logic ---

export const exportSessionString = async (session: FamilySession): Promise<string> => {
    const encrypted = await encryptData(session, session.familyKey);
    const serverUrl = getServerUrl() || '';
    // If we have a server URL, include it in the export so the new device auto-connects
    const payload = `${session.familyId}|${session.familyKey}|${encrypted}|${serverUrl}`;
    return btoa(payload);
};

export const importSessionString = async (importString: string): Promise<FamilySession> => {
    try {
        const decoded = atob(importString);
        const parts = decoded.split('|');
        // Handle legacy format (3 parts) vs new format (4 parts with URL)
        const familyId = parts[0];
        const familyKey = parts[1];
        const encryptedBlob = parts[2];
        const serverUrl = parts[3] || null;

        if (!familyId || !familyKey || !encryptedBlob) throw new Error("Invalid format");

        // If export included a server URL, automatically set it
        if (serverUrl) {
            setServerUrl(serverUrl);
        }

        // Verify decryption
        const session = await decryptData(encryptedBlob, familyKey);
        
        // Save
        localStorage.setItem(`${STORAGE_PREFIX}${familyId}`, encryptedBlob);
        
        // Force a save to ensure it syncs up to the server if we just configured it
        if (serverUrl) {
            // Wait a tick to ensure state is settled
            setTimeout(() => saveSession(session), 100);
        }
        
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
    // 1. Local Broadcast Channel Listener
    const localHandler = async (event: MessageEvent) => {
        if (event.data.type === 'UPDATE' && event.data.familyId === currentFamilyId) {
            const fresh = await getStoredSession(currentFamilyId, currentKey);
            if (fresh) onUpdate(fresh);
        }
    };
    localSyncChannel.addEventListener('message', localHandler);

    // 2. WebSocket Listener (if Server Configured)
    let ws: WebSocket | null = null;
    const serverUrl = getServerUrl();
    
    if (serverUrl) {
        // Convert http(s) to ws(s)
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

            // Simple reconnect logic
            ws.onclose = () => {
                // setTimeout(connectWs, 5000); // For now, let's not auto-reconnect aggressively in this demo
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
    // Optional cleanup
};
