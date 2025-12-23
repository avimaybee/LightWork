import React, { useState } from 'react';
import { Module } from '../types';
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, LayoutGrid, Check, Terminal } from 'lucide-react';

interface ModulesManagerProps {
    modules: Module[];
    onCreate: (name: string, prompt: string) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Module>) => void;
    onBack: () => void;
}

export const ModulesManager: React.FC<ModulesManagerProps> = ({ modules, onCreate, onDelete, onUpdate, onBack }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    
    // Detail / Edit View State
    const [selectedModule, setSelectedModule] = useState<Module | null>(null);
    const [editPrompt, setEditPrompt] = useState('');

    const handleCreate = () => {
        if(newName && newPrompt) {
            onCreate(newName, newPrompt);
            setNewName('');
            setNewPrompt('');
            setIsCreating(false);
        }
    };

    const openModule = (m: Module) => {
        setSelectedModule(m);
        setEditPrompt(m.prompt);
    };

    const saveChanges = () => {
        if (selectedModule) {
            onUpdate(selectedModule.id, { prompt: editPrompt });
            setSelectedModule(null);
        }
    };

    return (
        <div className="flex-1 h-full flex flex-col bg-[#F2F0E9] overflow-hidden relative font-sans">
            {/* Header */}
            <div className="h-20 flex items-center px-10 border-b border-stone-200 bg-[#F2F0E9]/80 backdrop-blur-md shrink-0">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors mr-6"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="font-bold text-sm">Back</span>
                </button>
                <h1 className="text-2xl font-bold text-stone-900 font-heading">Module Library</h1>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    
                    {/* Create New Card */}
                    <div 
                        onClick={() => setIsCreating(true)}
                        className={`
                            border border-dashed border-stone-300 rounded-xl p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:border-clay-400 hover:bg-white/50 group h-full min-h-[280px]
                            ${isCreating ? 'ring-2 ring-stone-900 border-transparent bg-white cursor-default shadow-lg' : ''}
                        `}
                    >
                        {isCreating ? (
                            <div className="w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
                                <input 
                                    type="text" 
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="Module Name"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold mb-3 focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-sans"
                                    autoFocus
                                />
                                <textarea 
                                    value={newPrompt}
                                    onChange={e => setNewPrompt(e.target.value)}
                                    placeholder="System instructions..."
                                    className="flex-1 w-full bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs font-mono resize-none mb-3 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                />
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleCreate}
                                        disabled={!newName || !newPrompt}
                                        className="flex-1 bg-stone-900 text-white py-2 rounded-lg text-xs font-bold hover:bg-stone-800 disabled:opacity-50"
                                    >
                                        Create
                                    </button>
                                    <button 
                                        onClick={() => setIsCreating(false)}
                                        className="px-3 py-2 text-stone-500 hover:bg-stone-100 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus className="w-6 h-6 text-stone-400 group-hover:text-clay-600" />
                                </div>
                                <span className="font-bold text-stone-600 text-lg font-heading">Create New Module</span>
                            </>
                        )}
                    </div>

                    {/* Module Cards */}
                    {modules.map(module => (
                        <div 
                            key={module.id} 
                            onClick={() => openModule(module)}
                            className="bg-[#FDFCFB] rounded-xl border border-stone-200 shadow-sm hover:shadow-xl transition-all flex flex-col h-full min-h-[280px] relative group overflow-hidden cursor-pointer hover:-translate-y-1"
                        >
                            {/* Card Header */}
                            <div className="p-6 border-b border-stone-100 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${module.isCustom ? 'bg-clay-50 border-clay-100 text-clay-600' : 'bg-stone-50 border-stone-100 text-stone-500'}`}>
                                        {module.isCustom ? <LayoutGrid className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-stone-900 text-lg leading-tight font-heading">{module.name}</h3>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
                                            {module.isCustom ? 'Custom Preset' : 'System Preset'}
                                        </span>
                                    </div>
                                </div>
                                {module.isCustom && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDelete(module.id); }}
                                        className="text-stone-300 hover:text-red-500 transition-colors p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Card Body */}
                            <div className="p-6 flex-1 flex flex-col relative">
                                <div className="relative flex-1">
                                    <p 
                                        className="text-xs text-stone-600 font-mono leading-relaxed overflow-hidden h-36"
                                        style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
                                    >
                                        {module.prompt}
                                    </p>
                                </div>
                                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm border border-stone-200 rounded-md px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-stone-700 pointer-events-none">
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Inspect</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Modal Overlay */}
            {selectedModule && (
                <div className="absolute inset-0 z-50 bg-stone-900/20 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-[#FDFCFB] rounded-2xl shadow-2xl max-w-3xl w-full h-full max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-white/50 animate-in slide-in-from-bottom-8 zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${selectedModule.isCustom ? 'bg-clay-50 border-clay-100 text-clay-600' : 'bg-stone-50 border-stone-100 text-stone-500'}`}>
                                    {selectedModule.isCustom ? <LayoutGrid className="w-6 h-6" /> : <Terminal className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h2 className="font-bold text-2xl text-stone-900 font-heading">{selectedModule.name}</h2>
                                    <p className="text-xs text-stone-500 font-mono uppercase tracking-wide">
                                        {selectedModule.isCustom ? 'Custom Module' : 'System Module'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedModule(null)} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                                <X className="w-6 h-6 text-stone-400" />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="flex-1 p-8 flex flex-col gap-3 bg-[#FDFCFB]">
                             <div className="flex items-center justify-between">
                                 <label className="text-xs font-bold text-stone-400 uppercase tracking-widest font-mono">System Prompt</label>
                                 {!selectedModule.isCustom && (
                                     <span className="text-[10px] text-clay-600 bg-clay-50 px-2 py-0.5 rounded-full font-bold border border-clay-100">System Defaults are read-only</span>
                                 )}
                             </div>
                             <textarea 
                                value={editPrompt}
                                onChange={(e) => setEditPrompt(e.target.value)}
                                className="flex-1 w-full bg-stone-50 border border-stone-200 rounded-xl p-6 text-sm font-mono text-stone-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400"
                                placeholder="Enter detailed system instructions..."
                                spellCheck={false}
                                autoFocus
                                readOnly={!selectedModule.isCustom}
                             />
                        </div>

                        {/* Modal Footer */}
                        {selectedModule.isCustom && (
                            <div className="p-6 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                                <div className="text-xs text-stone-400 font-mono">
                                    {editPrompt.length} characters
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedModule(null)}
                                        className="px-5 py-2.5 text-stone-500 hover:text-stone-900 font-bold text-sm transition-colors font-sans"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={saveChanges}
                                        className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-bold text-sm shadow-lg shadow-stone-900/10 flex items-center gap-2 transition-all font-sans"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Save Changes</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};