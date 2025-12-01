
import React, { useState, useEffect } from 'react';
import { FamilyMember, DiningMode, VoteOption, Coordinates, Restaurant } from '../types';
import { getCuisineConsensus, findBestPlace, getRouletteOptions } from '../services/ai';
import { Utensils, ShoppingBag, CheckCircle, Loader2, MapPin, Star, ArrowRight, ArrowLeft, Sparkles, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Roulette } from './Roulette';

interface DecisionFlowProps {
  members: FamilyMember[];
  onCancel: () => void;
}

type Step = 'select-who' | 'select-mode' | 'calculating-consensus' | 'voting' | 'finding-place' | 'result' | 'roulette-prep' | 'roulette';

// Confetti Component
const ConfettiExplosion = () => {
    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(25)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: "50%", y: "50%", scale: 0 }}
                    animate={{ 
                        x: `${Math.random() * 120 - 10}%`, 
                        y: `${Math.random() * 120 - 10}%`, 
                        scale: [0, 1.2, 0],
                        rotate: Math.random() * 720
                    }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute w-4 h-4 rounded-full"
                    style={{ backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F43', '#C7F464'][i % 5] }}
                />
            ))}
        </div>
    );
};

export const DecisionFlow: React.FC<DecisionFlowProps> = ({ members, onCancel }) => {
  const [step, setStep] = useState<Step>('select-who');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set(members.map(m => m.id)));
  const [mode, setMode] = useState<DiningMode>('restaurant');
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [rouletteOptions, setRouletteOptions] = useState<Restaurant[]>([]);
  const [simulatedVotesCast, setSimulatedVotesCast] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (err) => console.error("Geo error", err)
      );
    }
  }, []);

  const handleStartConsensus = async () => {
    setStep('calculating-consensus');
    setError(null);
    try {
      const activeMembers = members.filter(m => selectedMemberIds.has(m.id));
      const consensus = await getCuisineConsensus(activeMembers);
      
      const options: VoteOption[] = consensus.options.map((o, i) => ({ 
          id: `opt-${i}`, cuisine: o.cuisine, votes: 0, reasoning: o.reasoning 
      }));
      options.push({ id: 'dont-care', cuisine: "I don't care", votes: 0, reasoning: "Let fate decide!", isDontCare: true });

      setVoteOptions(options);
      setStep('voting');
      simulateFamilyVotes(activeMembers, options);
    } catch (e) {
      console.error(e);
      setError("Failed to analyze preferences. Please try again.");
      setStep('select-mode'); 
    }
  };

  const simulateFamilyVotes = (activeMembers: FamilyMember[], options: VoteOption[]) => {
      const remoteMembers = activeMembers.filter(m => !m.isCurrentUser);
      remoteMembers.forEach((member, index) => {
          setTimeout(() => {
              const isDontCare = Math.random() < 0.2;
              let choiceId = 'dont-care';
              if (!isDontCare) {
                  const validOptions = options.filter(o => !o.isDontCare);
                  const randomOpt = validOptions[Math.floor(Math.random() * validOptions.length)];
                  choiceId = randomOpt.id;
              }
              setVoteOptions(prev => prev.map(opt => opt.id === choiceId ? { ...opt, votes: opt.votes + 1 } : opt));
              setSimulatedVotesCast(prev => new Set(prev).add(member.id));
          }, 3000 + (index * 2500));
      });
  };

  const handleVote = (optionId: string) => {
    setVoteOptions(prev => prev.map(opt => opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt));
  };

  const finishVoting = async () => {
    const dontCareOption = voteOptions.find(o => o.isDontCare);
    const regularVotes = voteOptions.filter(o => !o.isDontCare).reduce((acc, curr) => acc + curr.votes, 0);
    const dontCareVotes = dontCareOption ? dontCareOption.votes : 0;

    if (dontCareVotes > regularVotes) {
        startRoulette();
        return;
    }
    
    const sorted = [...voteOptions.filter(o => !o.isDontCare)].sort((a,b) => b.votes - a.votes);
    const winner = sorted[0];

    setStep('finding-place');
    try {
        const activeMembers = members.filter(m => selectedMemberIds.has(m.id));
        const placeData = await findBestPlace(winner.cuisine, mode, activeMembers, location);
        setResult(placeData);
        setStep('result');
    } catch (e) {
        setError("Failed to find restaurants. Please try again.");
        setStep('voting');
    }
  };

  const startRoulette = async () => {
      setStep('roulette-prep');
      try {
          const places = await getRouletteOptions(location);
          if (places.length === 0) throw new Error("No places found");
          setRouletteOptions(places);
          setStep('roulette');
      } catch (e) {
          setError("Couldn't prepare roulette. Falling back to manual search.");
          setStep('voting');
      }
  };

  const handleRouletteComplete = (winner: Restaurant) => {
      setResult({ recommended: winner, alternatives: rouletteOptions.filter(o => o.name !== winner.name).slice(0, 2) });
      setStep('result');
  };

  const containerVariants = {
      hidden: { opacity: 0, x: 50 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -50 }
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-white">
        
        {/* Progress Bar */}
        <div className="h-2 bg-gray-100 w-full absolute top-0 left-0 z-10">
             <motion.div 
                className="h-full bg-gradient-to-r from-orange-500 to-rose-500" 
                animate={{ 
                    width: step === 'select-who' ? '20%' : 
                           step === 'select-mode' ? '40%' : 
                           step === 'voting' ? '60%' : 
                           step === 'result' ? '100%' : '80%' 
                }}
             />
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col w-full no-scrollbar">
            <AnimatePresence mode="wait">
                
                {/* 1. SELECT WHO */}
                {step === 'select-who' && (
                    <motion.div key="who" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-full">
                        <div className="mb-6 mt-2">
                            <h2 className="text-3xl font-heading font-black text-gray-900 mb-1">Roll Call 🥁</h2>
                            <p className="text-gray-500 font-medium">Who is joining the feast?</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mb-8">
                            {members.map(m => (
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    key={m.id}
                                    onClick={() => {
                                        const newSet = new Set(selectedMemberIds);
                                        newSet.has(m.id) ? newSet.delete(m.id) : newSet.add(m.id);
                                        setSelectedMemberIds(newSet);
                                    }}
                                    className={`p-4 rounded-[1.5rem] border-2 transition-all flex items-center gap-4 ${selectedMemberIds.has(m.id) ? 'border-orange-500 bg-orange-50/50 shadow-md ring-2 ring-orange-100' : 'border-gray-100 bg-white'}`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${m.avatarColor} font-bold text-lg shadow-sm`}>{m.name.charAt(0)}</div>
                                    <span className="font-bold text-lg text-gray-800">{m.name}</span>
                                    {selectedMemberIds.has(m.id) && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle className="ml-auto text-orange-500 fill-orange-100" size={24} /></motion.div>}
                                </motion.button>
                            ))}
                        </div>
                        <div className="mt-auto flex gap-4">
                            <button onClick={onCancel} className="px-6 py-5 font-bold text-gray-400 hover:bg-gray-100 rounded-[1.5rem] transition-colors flex items-center gap-2" aria-label="Cancel">
                                <ArrowLeft size={20} /> Back
                            </button>
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                disabled={selectedMemberIds.size === 0} 
                                onClick={() => setStep('select-mode')} 
                                className="flex-1 bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold text-xl hover:bg-black transition-colors flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl"
                            >
                                Continue <ArrowRight size={22} />
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* 2. SELECT MODE */}
                {step === 'select-mode' && (
                    <motion.div key="mode" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-full">
                         <div className="mb-6 mt-2">
                            <h2 className="text-3xl font-heading font-black text-gray-900 mb-1">The Vibe ✨</h2>
                            <p className="text-gray-500 font-medium">Staying in or going out?</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 mb-8">
                            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setMode('restaurant')} className={`p-6 rounded-[2rem] border-2 flex items-center gap-5 transition-all relative overflow-hidden ${mode === 'restaurant' ? 'border-orange-500 bg-orange-50 shadow-xl ring-2 ring-orange-100' : 'border-gray-100 bg-white'}`}>
                                <div className="bg-orange-100 p-4 rounded-2xl text-orange-600"><Utensils size={32} /></div>
                                <div className="text-left">
                                    <div className="font-bold text-xl text-gray-900">Dine In</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Restaurant Experience</div>
                                </div>
                                {mode === 'restaurant' && <div className="absolute top-1/2 right-6 -translate-y-1/2 text-orange-500"><CheckCircle className="fill-current text-white" size={28}/></div>}
                            </motion.button>
                            
                            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setMode('takeout')} className={`p-6 rounded-[2rem] border-2 flex items-center gap-5 transition-all relative overflow-hidden ${mode === 'takeout' ? 'border-blue-500 bg-blue-50 shadow-xl ring-2 ring-blue-100' : 'border-gray-100 bg-white'}`}>
                                <div className="bg-blue-100 p-4 rounded-2xl text-blue-600"><ShoppingBag size={32} /></div>
                                <div className="text-left">
                                    <div className="font-bold text-xl text-gray-900">Takeout</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Delivery or Pickup</div>
                                </div>
                                {mode === 'takeout' && <div className="absolute top-1/2 right-6 -translate-y-1/2 text-blue-500"><CheckCircle className="fill-current text-white" size={28}/></div>}
                            </motion.button>
                        </div>
                        {error && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="bg-red-50 text-red-600 p-4 rounded-2xl mb-4 text-center font-bold border border-red-100 text-sm">{error}</motion.div>}
                        <div className="mt-auto flex gap-4">
                             <button onClick={() => setStep('select-who')} className="px-4 py-4 font-bold text-gray-400 hover:bg-gray-100 rounded-2xl transition-colors"><ArrowLeft size={24} /></button>
                             <motion.button whileTap={{ scale: 0.95 }} onClick={handleStartConsensus} className="flex-1 bg-gray-900 text-white py-5 rounded-[1.5rem] font-bold text-xl hover:bg-black transition-colors shadow-xl">Let's Go</motion.button>
                        </div>
                    </motion.div>
                )}

                {/* LOADERS */}
                {(step === 'calculating-consensus' || step === 'finding-place' || step === 'roulette-prep') && (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full items-center justify-center text-center">
                         <div className="w-24 h-24 bg-gradient-to-tr from-orange-400 to-rose-500 rounded-full flex items-center justify-center text-white mb-8 shadow-2xl shadow-orange-300 relative">
                             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="absolute inset-[-10px] rounded-full border-4 border-orange-100 border-t-orange-500"></motion.div>
                             <Loader2 size={40} className="animate-spin relative z-10" />
                         </div>
                         <h3 className="text-2xl font-heading font-black text-gray-900 mb-2">
                            {step === 'calculating-consensus' ? 'Syncing Taste Buds...' : 'Scouting Spots...'}
                         </h3>
                         <p className="text-gray-400 font-medium text-sm">AI is negotiating on your behalf</p>
                    </motion.div>
                )}

                {/* 3. VOTING */}
                {step === 'voting' && (
                     <motion.div key="voting" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col h-full">
                        <div className="mb-4 flex flex-col justify-between gap-2 mt-2">
                            <h2 className="text-3xl font-heading font-black text-gray-900">Vote Now 🗳️</h2>
                            <div className="flex -space-x-2 overflow-hidden py-1 h-10 items-center">
                                {Array.from(simulatedVotesCast).map(id => {
                                    const m = members.find(mem => mem.id === id);
                                    return m ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={id} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-[10px] ${m.avatarColor} shadow-md`}>{m.name.charAt(0)}</motion.div> : null;
                                })}
                            </div>
                        </div>
                        
                        <div className="space-y-3 flex-1 overflow-y-auto pb-6 px-1 no-scrollbar">
                            {voteOptions.map((opt) => {
                                 const totalVotes = voteOptions.reduce((acc, curr) => acc + curr.votes, 0);
                                 const percent = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                                 return (
                                    <motion.button 
                                        layout
                                        key={opt.id} 
                                        onClick={() => handleVote(opt.id)} 
                                        whileTap={{ scale: 0.96 }}
                                        className={`w-full p-0 rounded-[1.5rem] shadow-sm border-2 text-left relative overflow-hidden transition-all ${opt.isDontCare ? 'bg-slate-50 border-slate-200' : 'bg-white border-orange-100 hover:border-orange-200'}`}
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 transition-all duration-700 opacity-20 ${opt.isDontCare ? 'bg-gray-400' : 'bg-orange-500'}`} style={{ width: `${percent}%` }}></div>
                                        <div className="relative z-10 p-5 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-800 leading-tight">{opt.cuisine}</h3>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">{opt.reasoning}</p>
                                            </div>
                                            {opt.votes > 0 && (
                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg font-black text-gray-900 bg-white/80 w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                                                    {opt.votes}
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                        <div className="mt-4 pt-4 flex gap-4">
                            <button onClick={() => setStep('select-mode')} className="px-4 py-4 font-bold text-gray-400 hover:bg-gray-100 rounded-2xl transition-colors" aria-label="Back">
                                <ArrowLeft size={24} />
                            </button>
                            <motion.button whileTap={{ scale: 0.95 }} onClick={finishVoting} className="flex-1 bg-gradient-to-r from-orange-600 to-rose-600 text-white py-5 rounded-[1.5rem] font-bold text-xl shadow-xl shadow-orange-200 hover:shadow-orange-300">Finish Voting</motion.button>
                        </div>
                     </motion.div>
                )}

                {/* 4. ROULETTE */}
                {step === 'roulette' && (
                     <motion.div key="roulette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center">
                        <Roulette options={rouletteOptions} onComplete={handleRouletteComplete} />
                     </motion.div>
                )}

                {/* 5. RESULT */}
                {step === 'result' && result && (
                    <motion.div key="result" variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col h-full relative">
                        <ConfettiExplosion />
                        
                        <div className="text-center pt-6 mb-6">
                             <motion.div 
                                initial={{ scale: 0, rotate: -10 }} 
                                animate={{ scale: 1, rotate: 0 }} 
                                transition={{ type: "spring" }}
                                className="inline-block bg-green-100 text-green-700 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4 shadow-sm"
                             >
                                <PartyPopper size={14} className="inline mr-1 mb-0.5"/> Winner
                             </motion.div>
                             <h2 className="text-4xl font-heading font-black text-gray-900 mb-2 leading-none">{result.recommended.name}</h2>
                             <div className="flex items-center justify-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wide">
                                 <span>{result.recommended.cuisine}</span>
                                 <span>•</span>
                                 <span className="flex items-center gap-1 text-orange-500"><Star size={14} fill="currentColor"/> {result.recommended.rating}</span>
                             </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 mb-6 relative group transform transition-all hover:scale-[1.02]">
                             <div className="h-40 bg-gray-900 relative overflow-hidden">
                                  <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                  <div className="absolute bottom-6 left-6 text-white">
                                      <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Recommended By</div>
                                      <div className="font-bold flex items-center gap-2 text-orange-300"><Sparkles size={16}/> AI Consensus</div>
                                  </div>
                             </div>
                             <div className="p-6">
                                  <div className="flex items-start gap-4 mb-6">
                                      <div className="bg-orange-50 p-3 rounded-2xl text-orange-600"><MapPin size={24} /></div>
                                      <div>
                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Address</div>
                                          <div className="font-medium text-lg text-gray-800 leading-snug">{result.recommended.address || "Check maps"}</div>
                                      </div>
                                  </div>
                                  <a href={result.recommended.googleMapsUri} target="_blank" rel="noreferrer" className="block w-full bg-gray-900 text-white text-center py-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl">
                                      Open in Maps
                                  </a>
                             </div>
                        </div>

                        <div className="mt-auto text-center pb-4">
                             <button onClick={onCancel} className="text-gray-400 font-bold hover:text-gray-600 text-xs uppercase tracking-widest py-4">Start Over</button>
                        </div>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    </div>
  );
};
