
import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, Restaurant, FamilySession, Coordinates } from '../types';
import { Share2, Copy, Check, Smartphone, UserPlus, Users, Edit2, Loader2, Sparkles, AlertCircle, RefreshCw, X, Plus, Heart, MapPin, Trash2 } from 'lucide-react';
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

const TagSection = ({ label, tags, tempValue, setTempValue, onAdd, onRemove, colorClass, placeholder }: any) => (
  <div className="space-y-2">
      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[32px]">
          {tags.length === 0 && <span className="text-xs text-gray-300 italic py-1 px-1">None added yet</span>}
          {tags.map((tag: string) => (
              <motion.span 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  key={tag} 
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${colorClass}`}
              >
                  {tag}
                  <button onClick={() => onRemove(tag)} className="hover:text-black transition-colors"><X size={12}/></button>
              </motion.span>
          ))}
      </div>
      <div className="relative">
          <input 
              value={tempValue} 
              onChange={e => setTempValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
              placeholder={placeholder}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-orange-200 outline-none transition-all pr-12"
          />
          <button 
              type="button"
              onClick={(e) => { e.preventDefault(); onAdd(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-orange-500 transition-colors"
          >
              <Plus size={20} />
          </button>
      </div>
  </div>
);

export const FamilyManager: React.FC<FamilyManagerProps> = ({ members, setMembers, familyId, familyKey, fullSession }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Fetch location for favorite searching
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (err) => console.warn("Geo error in manager", err)
      );
    }
  }, []);

  // Handle focus for the name field only when the editor first appears
  useEffect(() => {
    if ((isAdding || editingId) && nameInputRef.current) {
        // Slight delay to ensure animation doesn't fight focus
        const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }
  }, [isAdding, !!editingId]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDietary, setFormDietary] = useState<string[]>([]);
  const [formCuisines, setFormCuisines] = useState<string[]>([]);
  const [formFlavors, setFormFlavors] = useState<string[]>([]);
  const [formFavorites, setFormFavorites] = useState<Restaurant[]>([]);
  
  // Tag Inputs
  const [tempDietary, setTempDietary] = useState('');
  const [tempCuisine, setTempCuisine] = useState('');
  const [tempFlavor, setTempFlavor] = useState('');
  const [tempFavoriteQuery, setTempFavoriteQuery] = useState('');
  const [isSearchingFavorites, setIsSearchingFavorites] = useState(false);
  const [favSearchResults, setFavSearchResults] = useState<Restaurant[]>([]);

  const resetForm = () => {
    setFormName(''); setFormDietary([]); setFormCuisines([]); setFormFlavors([]); setFormFavorites([]);
    setTempDietary(''); setTempCuisine(''); setTempFlavor(''); setTempFavoriteQuery('');
    setFavSearchResults([]);
    setIsAdding(false); setEditingId(null);
  };

  const startAdding = () => { resetForm(); setIsAdding(true); };

  const startEditing = (member: FamilyMember) => {
    setFormName(member.name); 
    setFormDietary(member.dietaryRestrictions || []);
    setFormCuisines(member.cuisinePreferences || []); 
    setFormFlavors(member.flavorPreferences || []);
    setFormFavorites(member.favorites || []);
    setEditingId(member.id); 
    setIsAdding(false);
  };

  const saveMember = () => {
    if (!formName.trim()) return;
    const memberData = { 
      name: formName, 
      dietaryRestrictions: formDietary, 
      cuisinePreferences: formCuisines, 
      flavorPreferences: formFlavors, 
      favorites: formFavorites 
    };

    if (editingId) {
      setMembers(members.map(m => m.id === editingId ? { ...m, ...memberData } : m));
    } else {
      setMembers([...members, { 
        ...memberData,
        id: `mem-${Date.now()}`, 
        avatarColor: AVATAR_COLORS[members.length % AVATAR_COLORS.length] 
      }]);
    }
    resetForm();
  };

  const addTag = (type: 'diet' | 'cuisine' | 'flavor') => {
    if (type === 'diet' && tempDietary.trim()) {
        if (!formDietary.includes(tempDietary.trim())) setFormDietary([...formDietary, tempDietary.trim()]);
        setTempDietary('');
    }
    if (type === 'cuisine' && tempCuisine.trim()) {
        if (!formCuisines.includes(tempCuisine.trim())) setFormCuisines([...formCuisines, tempCuisine.trim()]);
        setTempCuisine('');
    }
    if (type === 'flavor' && tempFlavor.trim()) {
        if (!formFlavors.includes(tempFlavor.trim())) setFormFlavors([...formFlavors, tempFlavor.trim()]);
        setTempFlavor('');
    }
  };

  const removeTag = (tag: string, type: 'diet' | 'cuisine' | 'flavor') => {
    if (type === 'diet') setFormDietary(formDietary.filter(t => t !== tag));
    if (type === 'cuisine') setFormCuisines(formCuisines.filter(t => t !== tag));
    if (type === 'flavor') setFormFlavors(formFlavors.filter(t => t !== tag));
  };

  const searchForFavorites = async () => {
      if (!tempFavoriteQuery.trim()) return;
      setIsSearchingFavorites(true);
      try {
          const results = await searchPlace(tempFavoriteQuery, location);
          setFavSearchResults(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearchingFavorites(false);
      }
  };

  const addFavorite = (place: Restaurant) => {
      if (!formFavorites.some(f => f.name === place.name)) {
          setFormFavorites([...formFavorites, { ...place, source: 'favorite' }]);
      }
      setFavSearchResults([]);
      setTempFavoriteQuery('');
  };

  const removeFavorite = (name: string) => {
      setFormFavorites(formFavorites.filter(f => f.name !== name));
  };

  const handleInviteCode = async () => {
      setIsGenerating(true);
      setError(null);
      try {
          const code = await getInviteCode(familyId, familyKey);
          if (code === "SERVER_ERROR") {
              setError("Cloud sync unreachable. Using local mode.");
              setInviteCode(null);
          } else {
              setInviteCode(code);
              setError(null);
          }
      } catch (e) {
          setError("Failed to connect to sync server.");
      } finally {
          setIsGenerating(false);
      }
  };

  return (
    <div className="space-y-8">
      {/* Invite/Sync Card */}
      <div className="bg-gray-900 rounded-[2.5rem] p-6 text-white relative overflow-hidden group">
         <div className="absolute -right-10 -top-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-all duration-700"></div>
         <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-heading font-bold flex items-center gap-2 mb-1">
                        <Smartphone size={20} className="text-orange-400" /> 
                        Sync Devices
                    </h3>
                    <p className="text-gray-400 text-xs">Invite family members to join.</p>
                </div>
                {!inviteCode && (
                    <button onClick={handleInviteCode} disabled={isGenerating} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50">
                        {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                    </button>
                )}
            </div>
            
            <div className="w-full">
                 {error ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-orange-400">
                            <AlertCircle size={16} />
                            <span className="text-xs font-bold leading-tight">{error}</span>
                        </div>
                        <button onClick={handleInviteCode} className="text-[10px] font-black bg-white/10 self-end px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-1">
                            <RefreshCw size={10} /> RETRY SYNC
                        </button>
                    </motion.div>
                 ) : !inviteCode ? (
                     <button onClick={handleInviteCode} disabled={isGenerating} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:bg-white/10 transition-all disabled:opacity-50">
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                        {isGenerating ? 'Connecting to Cloud...' : 'Generate Invite Code'}
                     </button>
                 ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/10 p-4 rounded-xl flex flex-col items-center gap-3 backdrop-blur-md border border-white/20">
                         <div className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Family Access Code</div>
                         <div className="text-4xl font-black text-orange-400 tracking-[0.3em] font-mono">{inviteCode}</div>
                         <button onClick={() => { navigator.clipboard.writeText(inviteCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-2 text-xs font-bold bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors">
                            {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy Code</>}
                         </button>
                    </motion.div>
                 )}
            </div>
         </div>
      </div>

      {/* Crew List & Editor */}
      <div className="relative">
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
                    <motion.div 
                        key="member-editor"
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95 }} 
                        className="p-6 rounded-[2.5rem] shadow-2xl border-2 border-orange-500 bg-white space-y-6 z-30 mb-8"
                    >
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-black text-gray-900">{editingId ? 'Edit Profile' : 'New Profile'}</h3>
                            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24}/></button>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1">First Name</label>
                            <input ref={nameInputRef} value={formName} onChange={e => setFormName(e.target.value)} className="w-full text-2xl font-black border-b-2 border-gray-100 focus:border-orange-500 outline-none py-2 transition-all" placeholder="e.g. Leo" />
                        </div>

                        <TagSection 
                            label="Can't Have (Dietary)" 
                            tags={formDietary} 
                            tempValue={tempDietary} 
                            setTempValue={setTempDietary} 
                            onAdd={() => addTag('diet')} 
                            onRemove={(t: string) => removeTag(t, 'diet')} 
                            colorClass="bg-red-50 text-red-600"
                            placeholder="e.g. No Nuts, Vegan..."
                        />

                        <TagSection 
                            label="Likes (Cuisines)" 
                            tags={formCuisines} 
                            tempValue={tempCuisine} 
                            setTempValue={setTempCuisine} 
                            onAdd={() => addTag('cuisine')} 
                            onRemove={(t: string) => removeTag(t, 'cuisine')} 
                            colorClass="bg-green-50 text-green-600"
                            placeholder="e.g. Thai, Sushi..."
                        />

                        <TagSection 
                            label="Loves (Flavor Profiles)" 
                            tags={formFlavors} 
                            tempValue={tempFlavor} 
                            setTempValue={setTempFlavor} 
                            onAdd={() => addTag('flavor')} 
                            onRemove={(t: string) => removeTag(t, 'flavor')} 
                            colorClass="bg-blue-50 text-blue-600"
                            placeholder="e.g. Spicy, Extra Cheesy..."
                        />

                        {/* Favorites Section */}
                        <div className="space-y-4 pt-4 border-t-2 border-gray-50">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Favorite Spots (10/10)</label>
                                <Heart size={14} className="text-rose-400" fill="currentColor" />
                            </div>
                            
                            <div className="space-y-2">
                                {formFavorites.map((fav) => (
                                    <div key={fav.name} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-lg text-rose-500"><MapPin size={14} /></div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900 leading-tight">{fav.name}</div>
                                                <div className="text-[10px] font-medium text-rose-400 uppercase tracking-wider">{fav.cuisine}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFavorite(fav.name)} className="text-rose-300 hover:text-rose-500"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {formFavorites.length === 0 && <p className="text-xs text-gray-300 italic text-center py-2">No favorites added yet</p>}
                            </div>

                            <div className="relative">
                                <div className="flex gap-2">
                                    <input 
                                        value={tempFavoriteQuery} 
                                        onChange={e => setTempFavoriteQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchForFavorites())}
                                        placeholder="Search restaurant to add..."
                                        className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 text-sm focus:border-orange-200 outline-none transition-all"
                                    />
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); searchForFavorites(); }}
                                        disabled={isSearchingFavorites}
                                        className="bg-gray-100 p-3 rounded-xl text-gray-500 hover:bg-orange-50 hover:text-orange-500 transition-all disabled:opacity-50"
                                    >
                                        {isSearchingFavorites ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                    </button>
                                </div>
                                
                                <AnimatePresence>
                                    {favSearchResults.length > 0 && (
                                        <motion.div 
                                            key="favorite-search-results"
                                            initial={{ opacity: 0, y: -10 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            exit={{ opacity: 0 }}
                                            className="absolute left-0 right-0 mt-2 bg-white border-2 border-gray-100 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto no-scrollbar"
                                        >
                                            {favSearchResults.map((res, i) => (
                                                <button 
                                                    type="button"
                                                    key={i} 
                                                    onClick={() => addFavorite(res)}
                                                    className="w-full p-4 text-left hover:bg-orange-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-900">{res.name}</div>
                                                        <div className="text-xs text-gray-400">{res.address}</div>
                                                    </div>
                                                    <Plus size={16} className="text-orange-400"/>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={saveMember} className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-colors shadow-lg">Save Changes</button>
                        </div>
                    </motion.div>
                )}

                {!isAdding && !editingId && members.map(member => (
                    <motion.div 
                        layout 
                        key={member.id} 
                        onClick={() => startEditing(member)} 
                        className="bg-white p-5 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between group cursor-pointer hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm ${member.avatarColor}`}>{member.name.charAt(0)}</div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                    {member.name} 
                                    {member.isCurrentUser && <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">You</span>}
                                </h3>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {member.dietaryRestrictions?.length > 0 && <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">Dietary Needs</span>}
                                    {member.favorites?.length > 0 && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter flex items-center gap-0.5"><Heart size={8} fill="currentColor"/> {member.favorites.length} Favs</span>}
                                    {member.cuisinePreferences?.slice(0, 1).map(t => <span key={t} className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{t}</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="w-10 h-10 flex items-center justify-center text-gray-300 group-hover:text-orange-500 transition-colors"><Edit2 size={16} /></div>
                    </motion.div>
                ))}
              </AnimatePresence>
          </div>
      </div>
    </div>
  );
};
