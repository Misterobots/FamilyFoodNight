
import React, { useState, useEffect } from 'react';
import { FamilyMember, Restaurant, FamilySession } from '../types';
import { Plus, Trash2, Share2, Copy, Check, Smartphone, X, UserPlus, Users, Edit2, Save, MapPin, Search, Loader2, Sparkles, Link } from 'lucide-react';
import { getInviteCode } from '../services/storage';
import { searchPlace } from '../services/ai';
import { motion, AnimatePresence } from 'framer-motion';

interface FamilyManagerProps {
  members: FamilyMember[];
  setMembers: (m: FamilyMember[]) => void;
  familyId: string;
  familyKey: string;
  fullSession: FamilySession; 
}

const AVATAR_COLORS = [
  'bg-rose-100 text-rose-600',
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
  'bg-violet-100 text-violet-600',
  'bg-cyan-100 text-cyan-600',
];

export const FamilyManager: React.FC<FamilyManagerProps> = ({ members, setMembers, familyId, familyKey, fullSession }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDietary, setFormDietary] = useState<string[]>([]);
  const [formCuisines, setFormCuisines] = useState<string[]>([]);
  const [formFlavors, setFormFlavors] = useState<string[]>([]);
  const [formFavorites, setFormFavorites] = useState<Restaurant[]>([]);

  const resetForm = () => {
    setFormName(''); setFormDietary([]); setFormCuisines([]); setFormFlavors([]); setFormFavorites([]);
    setIsAdding(false); setEditingId(null);
  };

  const startAdding = () => { resetForm(); setIsAdding(true); };

  const startEditing = (member: FamilyMember) => {
    setFormName(member.name); setFormDietary(member.dietaryRestrictions || []);
    setFormCuisines(member.cuisinePreferences || []); setFormFlavors(member.flavorPreferences || []);
    setFormFavorites(member.favorites || []); setEditingId(member.id); setIsAdding(false);
  };

  const saveMember = () => {
    if (!formName.trim()) return;
    if (editingId) {
      setMembers(members.map(m => m.id === editingId ? { ...m, name: formName, dietaryRestrictions: formDietary, cuisinePreferences: formCuisines, flavorPreferences: formFlavors, favorites: formFavorites } : m));
    } else {
      setMembers([...members, { id: Date.now().toString(), name: formName, avatarColor: AVATAR_COLORS[members.length % AVATAR_COLORS.length], dietaryRestrictions: formDietary, cuisinePreferences: formCuisines, flavorPreferences: formFlavors, favorites: formFavorites }]);
    }
    resetForm();
  };

  const handleInviteCode = async () => {
      setIsGenerating(true);
      const code = await getInviteCode(familyId, familyKey);
      setInviteCode(code);
      setIsGenerating(false);
  };

  const handleShare = async () => {
      if (!inviteCode) return;
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteCode}`;
      const shareData = {
          title: 'Join our FamEats!',
          text: `Join the ${fullSession.familyName} on FamEats to decide where to eat!`,
          url: shareUrl,
      };

      if (navigator.share) {
          try {
              await navigator.share(shareData);
          } catch (e) {
              copyInvite(shareUrl);
          }
      } else {
          copyInvite(shareUrl);
      }
  };

  const copyInvite = (url: string) => {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-900 rounded-[2rem] p-6 text-white relative overflow-hidden group">
         <div className="absolute -right-10 -top-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-all duration-700"></div>
         <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-heading font-bold flex items-center gap-2 mb-1">
                        <Smartphone size={20} className="text-orange-400" /> 
                        Magic Invite
                    </h3>
                    <p className="text-gray-400 text-xs">Share a link to add family members instantly.</p>
                </div>
            </div>
            
            <div className="w-full">
                 {!inviteCode ? (
                     <button onClick={handleInviteCode} disabled={isGenerating} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:bg-white/10 transition-all">
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <><Sparkles size={16} /> Generate Invite Link</>}
                     </button>
                 ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/10 p-5 rounded-xl flex flex-col items-center gap-4 backdrop-blur-md border border-white/20">
                         <div className="flex items-center gap-8">
                             <div className="text-center">
                                <div className="text-[9px] text-gray-400 uppercase tracking-widest font-black mb-1">Code</div>
                                <div className="text-2xl font-black text-orange-400 tracking-wider font-mono">{inviteCode}</div>
                             </div>
                             <div className="w-[1px] h-8 bg-white/10"></div>
                             <div className="text-center">
                                <div className="text-[9px] text-gray-400 uppercase tracking-widest font-black mb-1">Status</div>
                                <div className="text-xs font-bold text-green-400">Ready to Share</div>
                             </div>
                         </div>
                         <button onClick={handleShare} className="w-full flex items-center justify-center gap-2 text-sm font-black bg-orange-500 py-4 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-900/20 active:scale-95">
                            {copied ? <><Check size={18}/> Link Copied!</> : <><Share2 size={18}/> Share Invite Link</>}
                         </button>
                    </motion.div>
                 )}
            </div>
         </div>
      </div>

      <div>
          <div className="flex justify-between items-end mb-6 px-2">
            <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
                <Users size={24} className="text-gray-400" /> The Crew
            </h2>
            {!isAdding && !editingId && (
                <button onClick={startAdding} className="text-xs font-bold text-orange-600 bg-orange-50 px-4 py-2 rounded-full hover:bg-orange-100 transition-all">
                    <UserPlus size={16} className="inline mr-1" /> Add
                </button>
            )}
          </div>
          <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {(isAdding || editingId) && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-6 rounded-[2rem] shadow-xl border-2 border-orange-500 bg-white">
                        <div className="mb-6">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">Name</label>
                            <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full text-2xl font-black border-b-2 border-gray-100 focus:border-orange-500 outline-none py-2" placeholder="Member Name" />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={saveMember} className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-colors shadow-lg">Save Profile</button>
                            <button onClick={resetForm} className="px-6 py-4 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-2xl transition-colors">Cancel</button>
                        </div>
                    </motion.div>
                )}
                {!isAdding && !editingId && members.map(member => (
                    <motion.div layout key={member.id} onClick={() => startEditing(member)} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group cursor-pointer hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${member.avatarColor}`}>{member.name.charAt(0)}</div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">{member.name} {member.isCurrentUser && <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-1 rounded-lg">You</span>}</h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-2"><Edit2 size={14} className="text-gray-300" /></div>
                    </motion.div>
                ))}
              </AnimatePresence>
          </div>
      </div>
    </div>
  );
};
