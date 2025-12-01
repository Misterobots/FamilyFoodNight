
import React, { useState, useEffect } from 'react';
import { FamilySession } from './types';
import { FamilyManager } from './components/FamilyManager';
import { DecisionFlow } from './components/DecisionFlow';
import { AuthScreen } from './components/AuthScreen';
import { saveSession, subscribeToSync, logout } from './services/storage';
import { LogOut, CloudSun, Sparkles, ArrowRight, Signal, Wifi, Battery } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const [session, setSession] = useState<FamilySession | null>(null);
  const [isDecisionActive, setIsDecisionActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Sync Subscription
  useEffect(() => {
    if (session) {
        const unsubscribe = subscribeToSync(session.familyId, session.familyKey, (updatedSession) => {
            setSession(updatedSession);
            setIsSyncing(true);
            setTimeout(() => setIsSyncing(false), 1000);
        });
        return unsubscribe;
    }
  }, [session?.familyId, session?.familyKey]);

  const handleUpdateMembers = async (newMembers: any) => {
      if (session) {
          const updatedSession = { ...session, members: newMembers };
          setSession(updatedSession);
          await saveSession(updatedSession);
      }
  };

  const handleLogout = () => {
      logout();
      setSession(null);
      setIsDecisionActive(false);
  };

  // Status Bar Component for the "Phone" look
  const StatusBar = () => (
      <div className="flex justify-between items-center px-6 py-3 text-xs font-bold text-gray-900 select-none sticky top-0 bg-white/90 backdrop-blur-sm z-50">
          <div className="flex items-center gap-1">
              <span>9:41</span>
          </div>
          <div className="flex items-center gap-2">
              <Signal size={14} className="fill-gray-900" />
              <Wifi size={14} />
              <Battery size={16} className="fill-gray-900"/>
          </div>
      </div>
  );

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex items-center justify-center font-sans overflow-hidden">
        
        {/* Desktop Background Pattern */}
        <div className="fixed inset-0 pointer-events-none opacity-50 hidden md:block">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        {/* 
            PHONE FRAME CONTAINER
            - Mobile: Full width/height (100dvh), no border.
            - Desktop: Fixed width (400px), rounded corners, heavy border, shadow.
        */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full h-[100dvh] md:w-[400px] md:h-[850px] bg-white md:rounded-[3rem] md:border-[14px] md:border-gray-900 md:shadow-2xl relative overflow-hidden flex flex-col z-10"
        >
            {/* Notch (Desktop Only) */}
            <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-50"></div>

            <StatusBar />

            <div className="flex-1 overflow-hidden relative flex flex-col">
                <AnimatePresence mode="wait">
                    {!session ? (
                        <motion.div 
                            key="auth"
                            initial={{ opacity: 0, x: 20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: -20 }}
                            className="h-full flex flex-col"
                        >
                            <AuthScreen onJoin={setSession} />
                        </motion.div>
                    ) : isDecisionActive ? (
                        <motion.div 
                            key="decision"
                            initial={{ opacity: 0, y: '100%' }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="absolute inset-0 z-40 bg-white"
                        >
                            <DecisionFlow 
                                members={session.members} 
                                onCancel={() => setIsDecisionActive(false)} 
                            />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="dashboard"
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col relative"
                        >
                            {/* App Header */}
                            <header className="px-6 py-4 flex items-center justify-between bg-white sticky top-0 z-20">
                                <div>
                                    <h1 className="text-2xl font-heading font-black text-gray-900 tracking-tight">FamEats</h1>
                                    <p className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-1">
                                        <CloudSun size={12}/> {session.familyName}
                                    </p>
                                </div>
                                <button 
                                    onClick={handleLogout} 
                                    className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    <LogOut size={18} />
                                </button>
                            </header>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar space-y-8">
                                
                                {/* Hero Action */}
                                <motion.button 
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setIsDecisionActive(true)}
                                    className="w-full text-left relative overflow-hidden rounded-[2rem] bg-gray-900 p-8 shadow-xl shadow-gray-200 group"
                                >
                                    <div className="absolute right-0 top-0 text-[8rem] opacity-10 group-hover:rotate-12 transition-transform duration-500">🍕</div>
                                    <div className="relative z-10">
                                        <div className="inline-flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md text-white/80 text-[10px] font-bold uppercase tracking-widest mb-3">
                                            <Sparkles size={10} /> AI Assistant
                                        </div>
                                        <h2 className="text-3xl font-heading font-black text-white mb-2 leading-none">Find Food.</h2>
                                        <p className="text-gray-400 text-sm font-medium mb-6">
                                            Start a vote to decide dinner.
                                        </p>
                                        <div className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm inline-flex items-center gap-2">
                                            Start Now <ArrowRight size={16} />
                                        </div>
                                    </div>
                                </motion.button>

                                <FamilyManager 
                                    members={session.members} 
                                    setMembers={handleUpdateMembers} 
                                    familyId={session.familyId}
                                    familyKey={session.familyKey}
                                    fullSession={session}
                                />
                            </div>

                            {/* Sync Status Overlay */}
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none pb-safe">
                                <motion.div 
                                    animate={{ 
                                        y: isSyncing ? [0, -4, 0] : 0,
                                        scale: isSyncing ? 1.05 : 1,
                                    }}
                                    className={`px-4 py-2 rounded-full shadow-sm border flex items-center gap-2 pointer-events-auto transition-colors bg-white ${isSyncing ? 'border-green-200' : 'border-gray-100'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isSyncing ? 'bg-green-500' : 'bg-green-300'}`}></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        {isSyncing ? 'Syncing...' : 'Online'}
                                    </span>
                                </motion.div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    </div>
  );
};

export default App;
