
import React, { useState, useEffect } from 'react';
import { FamilyMember, Restaurant, FamilySession } from '../types';
import { Plus, Trash2, Share2, Copy, Check, Smartphone, X, UserPlus, Users, Edit2, Save, MapPin, Search, Loader2 } from 'lucide-react';
import { exportSessionString } from '../services/storage';
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

const DIETARY_OPTIONS = [
  "Gluten Free", "Vegetarian", "Vegan", "Dairy Free", "Nut Allergy", "Shellfish Allergy", "Halal", "Kosher", "Keto"
];

const CUISINE_OPTIONS = [
  "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Indian", "Burgers", "Pizza", "Mediterranean", "Steakhouse", "Seafood", "BBQ"
];

const FLAVOR_OPTIONS = [
  "Spicy", "Sweet", "Savory", "Umami", "Crunchy", "Comfort Food", "Healthy", "Light", "Rich", "Tangy"
];

export const FamilyManager: React.FC<FamilyManagerProps> = ({ members, setMembers, familyId, familyKey, fullSession }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDietary, setFormDietary] = useState<string[]>([]);
  const [formCuisines, setFormCuisines] = useState<string[]>([]);
  const [formFlavors, setFormFlavors] = useState<string[]>([]);
  const [formFavorites, setFormFavorites] = useState<Restaurant[]>([]);

  // Search State
  const [placeQuery, setPlaceQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [searchLocation, setSearchLocation] = useState<{latitude: number, longitude: number} | null>(null);

  const [copied, setCopied] = useState(false);
  const [exportString, setExportString] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setSearchLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (err) => console.error("Geo error", err)
      );
    }
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDietary([]);
    setFormCuisines([]);
    setFormFlavors([]);
    setFormFavorites([]);
    setPlaceQuery('');
    setSearchResults([]);
    setIsAdding(false);
    setEditingId(null);
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
  };

  const startEditing = (member: FamilyMember) => {
    setFormName(member.name);
    setFormDietary(member.dietaryRestrictions || []);
    setFormCuisines(member.cuisinePreferences || []); // Migrating old prefs if needed could happen here
    setFormFlavors(member.flavorPreferences || []);
    setFormFavorites(member.favorites || []);
    setEditingId(member.id);
    setIsAdding(false);
  };

  const saveMember = () => {
    if (!formName.trim()) return;

    if (editingId) {
      // Update existing
      const updated = members.map(m => m.id === editingId ? {
        ...m,
        name: formName,
        dietaryRestrictions: formDietary,
        cuisinePreferences: formCuisines,
        flavorPreferences: formFlavors,
        favorites: formFavorites
      } : m);
      setMembers(updated);
    } else {
      // Create new
      const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length];
      const newMember: FamilyMember = {
        id: Date.now().toString(),
        name: formName,
        avatarColor: color,
        dietaryRestrictions: formDietary,
        cuisinePreferences: formCuisines,
        flavorPreferences: formFlavors,
        favorites: formFavorites,
        preferences: [] // legacy
      };
      setMembers([...members, newMember]);
    }
    resetForm();
  };

  const handlePlaceSearch = async () => {
    if (!placeQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchPlace(placeQuery, searchLocation);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const addFavorite = (place: Restaurant) => {
    if (!formFavorites.some(f => f.name === place.name)) {
      setFormFavorites([...formFavorites, place]);
    }
    setPlaceQuery('');
    setSearchResults([]);
  };

  const removeFavorite = (index: number) => {
    setFormFavorites(formFavorites.filter((_, i) => i !== index));
  };

  const toggleSelection = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const generateTransferCode = async () => {
      const code = await exportSessionString(fullSession);
      setExportString(code);
  };

  const copyTransferCode = () => {
      if(exportString) {
          navigator.clipboard.writeText(exportString);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  return (
    <div className="space-y-8">
      
      {/* Sync Section */}
      <div className="bg-gray-900 rounded-[2rem] p-6 text-white relative overflow-hidden group">
         <div className="absolute -right-10 -top-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-all duration-700"></div>

         <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-xl font-heading font-bold flex items-center gap-2 mb-1">
                        <Smartphone size={20} className="text-orange-400" /> 
                        Sync Devices
                    </h3>
                    <p className="text-gray-400 text-xs">
                        Share ID or code to link devices.
                    </p>
                </div>
                {!exportString && (
                     <button onClick={generateTransferCode} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors" aria-label="Generate Transfer Code">
                         <Share2 size={18} className="text-white" />
                     </button>
                 )}
            </div>
            
            <div className="w-full">
                 {!exportString ? (
                     <div className="flex gap-3">
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex-1 text-center backdrop-blur-sm">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Family ID</div>
                            <div className="font-mono font-bold text-lg tracking-widest text-white select-all">{familyId}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex-1 text-center backdrop-blur-sm">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Access Key</div>
                            <div className="font-mono font-bold text-lg tracking-widest text-white select-all">{familyKey}</div>
                        </div>
                     </div>
                 ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/10 p-4 rounded-xl flex flex-col gap-2 w-full backdrop-blur-md border border-white/20">
                         <div className="flex justify-between items-center text-xs text-gray-300">
                             <span className="font-bold">Transfer Code Ready</span>
                             <button onClick={() => setExportString(null)} className="hover:text-white"><X size={14}/></button>
                         </div>
                         <div className="flex gap-2">
                             <input readOnly value={exportString} className="bg-black/30 border-none rounded-lg flex-1 text-xs p-2 text-orange-300 font-mono truncate focus:outline-none" aria-label="Transfer Code" />
                             <button onClick={copyTransferCode} className="bg-orange-600 p-2 rounded-lg text-white hover:bg-orange-500 transition-colors" aria-label="Copy Code">
                                 {copied ? <Check size={16}/> : <Copy size={16}/>}
                             </button>
                         </div>
                    </motion.div>
                 )}
            </div>
         </div>
      </div>

      {/* Members Grid */}
      <div>
          <div className="flex justify-between items-end mb-6 px-2">
            <div>
                <h2 className="text-2xl font-heading font-bold text-gray-900 flex items-center gap-2">
                    <Users size={24} className="text-gray-400" /> The Crew
                </h2>
            </div>
            {!isAdding && !editingId && (
                <button onClick={startAdding} className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 px-4 py-2 rounded-full hover:bg-orange-100 transition-all">
                    <UserPlus size={16} /> Add Member
                </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
              
              <AnimatePresence mode="popLayout">
                {/* Editor Form */}
                {(isAdding || editingId) && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="p-6 rounded-[2rem] shadow-xl border-2 border-orange-500 bg-white relative overflow-hidden"
                    >
                        {/* Name Input */}
                        <div className="mb-6">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1">Name</label>
                            <input 
                                value={formName} onChange={e => setFormName(e.target.value)}
                                className="w-full text-2xl font-black border-b-2 border-gray-100 focus:border-orange-500 outline-none py-2 bg-transparent transition-colors placeholder:text-gray-300"
                                placeholder="Member Name"
                            />
                        </div>

                        {/* Section 1: Cannot Have */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-red-400 rounded-full"></div>
                                <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">Cannot Have</label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {DIETARY_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleSelection(formDietary, setFormDietary, opt)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                            formDietary.includes(opt) 
                                            ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 2: Like To Have */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-orange-400 rounded-full"></div>
                                <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">Like to Have</label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {CUISINE_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleSelection(formCuisines, setFormCuisines, opt)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                            formCuisines.includes(opt) 
                                            ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-sm' 
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Love To Have */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-purple-400 rounded-full"></div>
                                <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">Love to Have</label>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {FLAVOR_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => toggleSelection(formFlavors, setFormFlavors, opt)}
                                        className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                            formFlavors.includes(opt) 
                                            ? 'bg-purple-50 border-purple-200 text-purple-600 shadow-sm' 
                                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 4: 10/10 Would Feast Again */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-emerald-400 rounded-full"></div>
                                <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">10/10 Would Feast Again</label>
                            </div>
                            
                            {/* Selected Favorites */}
                            <div className="space-y-2 mb-3">
                                {formFavorites.map((fav, i) => (
                                    <div key={i} className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg">
                                                <MapPin size={14} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-800">{fav.name}</div>
                                                <div className="text-[10px] text-gray-400">{fav.cuisine} • {fav.rating || 'N/A'}⭐</div>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFavorite(i)} className="text-red-400 hover:text-red-600 p-2">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            value={placeQuery}
                                            onChange={e => setPlaceQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handlePlaceSearch()}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 transition-all"
                                            placeholder="Search restaurant to add..."
                                        />
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    </div>
                                    <button 
                                        onClick={handlePlaceSearch}
                                        disabled={isSearching || !placeQuery}
                                        className="bg-gray-900 text-white rounded-xl px-4 disabled:opacity-50"
                                    >
                                        {isSearching ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}
                                    </button>
                                </div>
                                
                                {/* Search Results Dropdown */}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                                        {searchResults.map((place, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => addFavorite(place)}
                                                className="w-full text-left p-3 hover:bg-emerald-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-gray-800">{place.name}</div>
                                                    <div className="text-xs text-gray-400">{place.cuisine}</div>
                                                    {place.flavorProfile && place.flavorProfile.length > 0 && (
                                                        <div className="flex gap-1 mt-1">
                                                            {place.flavorProfile.slice(0,3).map(f => (
                                                                <span key={f} className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded">{f}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <Plus size={16} className="text-emerald-500"/>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button onClick={saveMember} className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-colors shadow-lg flex items-center justify-center gap-2">
                                <Save size={16}/> Save Profile
                            </button>
                            <button onClick={resetForm} className="px-6 py-4 text-gray-500 font-bold text-sm hover:bg-gray-100 rounded-2xl transition-colors">
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Member List */}
                {!isAdding && !editingId && members.map(member => (
                    <motion.div 
                        layout
                        key={member.id} 
                        onClick={() => startEditing(member)}
                        className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm relative flex items-center justify-between group hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${member.avatarColor}`}>
                                {member.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900 leading-none mb-1 flex items-center gap-2">
                                    {member.name}
                                    {member.isCurrentUser && <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">You</span>}
                                </h3>
                                <div className="text-xs text-gray-400 font-medium flex gap-1">
                                    {member.cuisinePreferences?.slice(0, 2).join(', ')}
                                    {(member.cuisinePreferences?.length || 0) > 2 && '...'}
                                    {(!member.cuisinePreferences || member.cuisinePreferences.length === 0) && 'Tap to edit'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-50 text-orange-400">
                                <Edit2 size={14} />
                            </div>
                            {!member.isCurrentUser && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setMembers(members.filter(m => m.id !== member.id)); }} 
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all" 
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}
              </AnimatePresence>
          </div>
      </div>
    </div>
  );
};
