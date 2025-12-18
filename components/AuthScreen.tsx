
import React, { useState, useEffect } from 'react';
import { ChefHat, ArrowRight, Key, Smartphone, Wifi, Check, Server } from 'lucide-react';
import { createNewFamily, joinWithInviteCode, setServerUrl, getServerUrl } from '../services/storage';
import { FamilySession } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthScreenProps {
  onJoin: (session: FamilySession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onJoin }) => {
  const [mode, setMode] = useState<'create' | 'join' | 'settings'>('create');
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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
      const session = await createNewFamily(familyName, name);
      onJoin(session);
    } catch (e) {
      setError("Failed to create family.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !inviteCode) return;
    setIsLoading(true);
    setError(null);
    try {
      const session = await joinWithInviteCode(inviteCode, name);
      onJoin(session);
    } catch (err: any) {
      setError(err.message || "Invalid invite code.");
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
    <div className="h-full flex flex-col p-8 bg-white relative overflow-y-auto no-scrollbar">
      <div className="mt-8 mb-8 text-center">
        <div className="w-20 h-20 bg-orange-500 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-orange-200">
             <ChefHat size={40} />
        </div>
        <h1 className="text-3xl font-heading font-black text-gray-900 tracking-tight mb-2 leading-none">Family Food Night</h1>
        <p className="text-gray-400 text-[10px] font-bold tracking-wide uppercase">Secure Family Dining Assistant</p>
      </div>

      {mode !== 'settings' && (
        <div className="flex w-full mb-8 border-b border-gray-100 relative">
            {['create', 'join'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => { setMode(tab as any); setError(null); }}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
                        mode === tab 
                        ? 'text-orange-600 border-b-2 border-orange-500' 
                        : 'text-gray-300 hover:text-gray-500'
                    }`}
                >
                    {tab}
                </button>
            ))}
            <button onClick={() => setMode('settings')} className="absolute right-0 top-2 text-gray-300 hover:text-gray-600">
                <Wifi size={16} />
            </button>
        </div>
      )}

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
            {mode === 'create' && (
                <motion.form key="create" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your Name</label>
                        <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full py-3 px-0 bg-transparent border-b-2 border-gray-100 focus:border-orange-500 outline-none font-bold text-xl text-gray-900 transition-colors" placeholder="e.g. Mom" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Family Name</label>
                        <input required value={familyName} onChange={(e) => setFamilyName(e.target.value)} className="w-full py-3 px-0 bg-transparent border-b-2 border-gray-100 focus:border-orange-500 outline-none font-bold text-xl text-gray-900 transition-colors" placeholder="e.g. The Millers" />
                    </div>
                    <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isLoading} className="w-full bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-2 mt-8 shadow-xl">
                        {isLoading ? 'Creating...' : <>Start Night <ArrowRight size={20} /></>}
                    </motion.button>
                </motion.form>
            )}

            {mode === 'join' && (
                <motion.form key="join" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onSubmit={handleJoin} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your Name</label>
                        <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full py-3 px-0 bg-transparent border-b-2 border-gray-100 focus:border-orange-500 outline-none font-bold text-xl text-gray-900 transition-colors" placeholder="e.g. Leo" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Invite Code</label>
                        <input required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} maxLength={6} className="w-full py-3 px-0 bg-transparent border-b-2 border-gray-100 focus:border-orange-500 outline-none font-bold text-3xl text-gray-900 text-center tracking-[0.5em]" placeholder="000000" />
                    </div>
                    {error && <div className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}
                    <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isLoading} className="w-full bg-orange-600 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2 mt-8 shadow-xl shadow-orange-100">
                         {isLoading ? 'Joining...' : <>Join Night <Smartphone size={20} /></>}
                    </motion.button>
                </motion.form>
            )}

             {mode === 'settings' && (
                <motion.form key="settings" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="flex items-center gap-2 mb-2 text-gray-900">
                        <Server size={20} />
                        <h2 className="font-bold text-lg">Server Setup</h2>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sync Server URL</label>
                        <input type="url" value={serverAddress} onChange={(e) => setServerAddress(e.target.value)} className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-orange-500 outline-none font-mono text-xs text-gray-800 transition-colors" placeholder="https://fameats.shivelymedia.com" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setMode('create')} className="px-6 py-4 rounded-2xl font-bold text-gray-500 bg-gray-100 text-sm hover:bg-gray-200 transition-colors">Cancel</button>
                        <motion.button whileTap={{ scale: 0.95 }} type="submit" className="flex-1 bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-black shadow-xl flex items-center justify-center gap-2 transition-colors">
                             {settingsSaved ? <><Check size={20} /> Saved</> : 'Save Settings'}
                        </motion.button>
                    </div>
                </motion.form>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};
