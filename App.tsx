
import React, { useState, useEffect } from 'react';
import { FamilySession } from './types';
import { FamilyManager } from './components/FamilyManager';
import { DecisionFlow } from './components/DecisionFlow';
import { AuthScreen } from './components/AuthScreen';
import { saveSession, subscribeToSync, logout } from './services/storage';
import { Settings, LogOut, ArrowLeft, CloudSun, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  const [session, setSession] = useState<FamilySession | null>(null);
  const [isDecisionActive, setIsDecisionActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Fun animated background elements for desktop
  const FloatingFood = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden hidden md:block z-0">
        <div className="absolute top-10 left-10 text-7xl animate-float-slow opacity-20 rotate-12">🍕</div>
        <div className="absolute bottom-20 left-20 text-7xl animate-float-medium opacity-20 -rotate-12">🍔</div>
        <div className="absolute top-40 right-20 text-7xl animate-float-fast opacity-20 rotate-45">🌮</div>
        <div className="absolute bottom-10 right-40 text-7xl animate-float-slow opacity-20 -rotate-6">🍱</div>
        <div className="absolute top-1/2 left-1/4 text-5xl animate-float-medium opacity-10">🍩</div>
        <div className="absolute top-1/3 right-1/3 text-5xl animate-float-fast opacity-10">🥗</div>
    </div>
  );

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

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center font-sans overflow-hidden relative selection:bg-orange-200">
        
        <FloatingFood />

        {/* 
            LAYOUT STRATEGY:
            Mobile: Full screen, no borders, native feel.
            Desktop: A centered, floating 'Game Card' with soft shadows.
        */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-[100dvh] md:max-w-md md:h-[85vh] md:max-h-[900px] md:rounded-[2.5rem] md:shadow-2xl md:border border-white/50 bg-white/90 backdrop-blur-xl relative overflow-hidden flex flex-col z-10 transition-all duration-500"
        >
            <AnimatePresence mode="wait">
                {!session ? (
                    <motion.div 
                        key="auth"
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -20 }}
                        className="h-full flex flex-col"
                    >
                        <AuthScreen onJoin={setSession} />
                    </motion.div>
                ) : isDecisionActive ? (
                    <motion.div 
                        key="decision"
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ type: "spring", bounce: 0.2 }}
                        className="absolute inset-0 z-30 bg-white"
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
                        {/* Header */}
                        <header className="px-6 py-5 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-20 border-b border-orange-50/50">
                            <div>
                                <h1 className="text-2xl font-heading font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    FamEats <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
                                </h1>
                                <p className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-1 mt-0.5">
                                    <CloudSun size={12}/> {session.familyName}
                                </p>
                            </div>
                            <button 
                                onClick={handleLogout} 
                                className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                            >
                                <LogOut size={18} />
                            </button>
                        </header>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar space-y-8">
                            
                            {/* CTA Card */}
                            <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setIsDecisionActive(true)}
                                className="w-full text-left group relative overflow-hidden rounded-[2rem] bg-gradient-to-tr from-orange-500 to-rose-500 p-8 shadow-xl shadow-orange-200"
                            >
                                <div className="absolute -right-6 -top-6 text-[8rem] opacity-20 rotate-12 transition-transform group-hover:rotate-45 duration-700">🍕</div>
                                <div className="relative z-10">
                                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-widest mb-3">
                                        <Sparkles size={12} /> AI Powered
                                    </div>
                                    <h2 className="text-3xl font-heading font-black text-white mb-2 leading-none">Find Food<br/>Fast.</h2>
                                    <p className="text-orange-50 text-sm font-medium mb-6 max-w-[160px] leading-relaxed">
                                        Let's decide where to eat without the arguments.
                                    </p>
                                    <div className="bg-white text-orange-600 px-6 py-3 rounded-xl font-black text-sm inline-flex items-center gap-2 shadow-lg group-hover:bg-orange-50 transition-colors">
                                        Start Vote <ArrowRight size={16} />
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

                        {/* Floating Sync Badge */}
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none pb-safe">
                            <motion.div 
                                animate={{ 
                                    y: isSyncing ? [0, -4, 0] : 0,
                                    scale: isSyncing ? 1.05 : 1,
                                    borderColor: isSyncing ? 'rgb(34,197,94)' : 'rgba(0,0,0,0)'
                                }}
                                className="bg-white/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2 pointer-events-auto transition-colors"
                            >
                                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isSyncing ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-green-300'}`}></div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {isSyncing ? 'Syncing...' : 'Connected'}
                                </span>
                            </motion.div>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    </div>
  );
};

export default App;
