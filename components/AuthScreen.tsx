
import React, { useState, useEffect } from 'react';
import { ChefHat, ArrowRight, Key, DownloadCloud, Wifi, Check, Server, Sparkles } from 'lucide-react';
import { createNewFamily, joinFamily, importSessionString, setServerUrl, getServerUrl } from '../services/storage';
import { FamilySession } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthScreenProps {
  onJoin: (session: FamilySession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onJoin }) => {
  const [mode, setMode] = useState<'create' | 'join' | 'import' | 'settings'>('create');
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [importString, setImportString] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
      const existing = getServerUrl();
      setServerAddress(existing || 'https://fameats.shivelymedia.com');
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !familyName) return;
    setIsLoading(true);
    try {
      await new Promise(r => setTimeout(r, 800)); 
      const session = await createNewFamily(familyName, name);
      onJoin(session);
    } catch (e) {
      setError("Failed to create family vault.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !joinId || !joinKey) return;
    setIsLoading(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 1200)); 
      const session = await joinFamily(joinId, joinKey, name);
      onJoin(session);
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!importString) return;
      setIsLoading(true);
      setError(null);
      try {
          await new Promise(r => setTimeout(r, 1000));
          const session = await importSessionString(importString);
          onJoin(session);
      } catch (err: any) {
          setError("Invalid Sync Code.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      setServerUrl(serverAddress.trim() || null);
      setSettingsSaved(true);
      setTimeout(() => {
          setSettingsSaved(false);
          setMode('create');
      }, 1000);
  };

  return (
    <div className="h-full flex flex-col p-8 bg-white/50 relative overflow-y-auto no-scrollbar">
      
      {/* Settings Toggle */}
      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        onClick={() => setMode('settings')} 
        className="absolute top-6 right-6 p-2 bg-white rounded-full text-gray-300 hover:text-gray-600 shadow-sm transition-colors"
      >
        <Wifi size={20} />
      </motion.button>

      {/* Header */}
      <div className="mt-8 mb-8 text-center">
        <motion.div 
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="bg-gradient-to-tr from-orange-400 to-rose-500 w-24 h-24 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-orange-200"
        >
             <ChefHat size={48} />
        </motion.div>
        <h1 className="text-4xl font-heading font-black text-gray-900 tracking-tight mb-2">FamEats</h1>
        <p className="text-gray-500 text-sm font-medium">The fun way to decide dinner.</p>
      </div>

      {/* Tabs */}
      {mode !== 'settings' && (
        <div className="flex w-full mb-8 bg-gray-100 p-1 rounded-2xl relative">
            {['create', 'join', 'import'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => { setMode(tab as any); setError(null); }}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all relative z-10 ${mode === tab ? 'text-orange-600 bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    {tab}
                </button>
            ))}
        </div>
      )}

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
            
            {/* Create Form */}
            {mode === 'create' && (
                <motion.form 
                    key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleCreate} className="space-y-4"
                >
                    <div className="group">
                        <label htmlFor="create-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Your Name</label>
                        <input
                            id="create-name"
                            name="userName"
                            type="text" 
                            required 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-gray-800 transition-all"
                            placeholder="e.g. Mom"
                        />
                    </div>
                    <div>
                        <label htmlFor="family-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Family Name</label>
                        <input
                            id="family-name"
                            name="familyName"
                            type="text" 
                            required 
                            value={familyName} 
                            onChange={(e) => setFamilyName(e.target.value)}
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-gray-800 transition-all"
                            placeholder="e.g. The Millers"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        type="submit" disabled={isLoading}
                        className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-2 mt-4 shadow-xl"
                    >
                        {isLoading ? 'Creating...' : <>Start <ArrowRight size={20} /></>}
                    </motion.button>
                </motion.form>
            )}

            {/* Join Form */}
            {mode === 'join' && (
                <motion.form 
                    key="join" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleJoin} className="space-y-4"
                >
                    <div>
                        <label htmlFor="join-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Your Name</label>
                        <input
                            id="join-name"
                            name="userName"
                            type="text" 
                            required 
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-gray-800 transition-all"
                            placeholder="e.g. Leo"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="join-id" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Family ID</label>
                            <input
                                id="join-id"
                                name="familyId"
                                type="text" 
                                required 
                                value={joinId} 
                                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-gray-800 text-center tracking-widest uppercase"
                                placeholder="ID"
                            />
                        </div>
                        <div>
                            <label htmlFor="join-key" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Access Key</label>
                            <input
                                id="join-key"
                                name="accessKey"
                                type="text" 
                                required 
                                value={joinKey} 
                                onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
                                className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-bold text-gray-800 text-center tracking-widest uppercase"
                                placeholder="KEY"
                            />
                        </div>
                    </div>
                    {error && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100">{error}</motion.div>}
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        type="submit" disabled={isLoading}
                        className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 mt-4 shadow-xl shadow-orange-100"
                    >
                         {isLoading ? 'Decrypting...' : <>Unlock <Key size={20} /></>}
                    </motion.button>
                </motion.form>
            )}

            {/* Import Form */}
            {mode === 'import' && (
                <motion.form 
                    key="import" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleImport} className="space-y-4"
                >
                    <div className="bg-blue-50 p-4 rounded-2xl text-xs text-blue-800 font-medium leading-relaxed border border-blue-100">
                        Paste the <strong>Sync Code</strong> generated from the main device to copy the family vault.
                    </div>
                    <div>
                         <label htmlFor="import-code" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Sync Code</label>
                        <textarea
                            id="import-code"
                            name="syncCode"
                            required 
                            value={importString} 
                            onChange={(e) => setImportString(e.target.value)}
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-mono text-xs text-gray-600 h-28 resize-none transition-all"
                            placeholder="Paste long code here..."
                        />
                    </div>
                    {error && <div className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl">{error}</div>}
                    <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        type="submit" disabled={isLoading}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-2 shadow-xl shadow-blue-100"
                    >
                         {isLoading ? 'Importing...' : <>Import <DownloadCloud size={20} /></>}
                    </motion.button>
                </motion.form>
            )}

            {/* Settings Form */}
             {mode === 'settings' && (
                <motion.form 
                    key="settings" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    onSubmit={handleSaveSettings} className="space-y-4"
                >
                    <div className="flex items-center gap-2 mb-2 text-gray-800">
                        <Server size={20} />
                        <h2 className="font-bold text-lg">Server Configuration</h2>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl text-xs text-gray-500 border border-gray-100">
                         Leave blank to use <strong>Local Mode</strong>. Enter URL to sync across devices.
                    </div>
                    <label htmlFor="server-url" className="sr-only">Server URL</label>
                    <input
                        id="server-url"
                        name="serverUrl"
                        type="url"
                        value={serverAddress} 
                        onChange={(e) => setServerAddress(e.target.value)}
                        className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none font-mono text-xs text-gray-800 transition-colors"
                        placeholder="https://fameats.shivelymedia.com"
                    />
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setMode('create')} className="px-6 py-4 rounded-2xl font-bold text-gray-500 bg-gray-100 text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                        <motion.button whileTap={{ scale: 0.95 }} type="submit" className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 shadow-xl flex items-center justify-center gap-2 transition-colors">
                             {settingsSaved ? <><Check size={20} /> Saved</> : 'Save'}
                        </motion.button>
                    </div>
                </motion.form>
            )}

        </AnimatePresence>
      </div>
    </div>
  );
};
