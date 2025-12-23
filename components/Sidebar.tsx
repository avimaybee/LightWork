import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project } from '../types';
import { Plus, Settings, Command, Key, Search, Archive, Check, Trash2, Library, PanelLeftClose, PanelLeftOpen, History, Box } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject?: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  currentView: 'workspace' | 'modules';
  onChangeView: (view: 'workspace' | 'modules') => void;
}

const ITEMS_PER_PAGE = 15;

export const Sidebar: React.FC<SidebarProps> = ({ 
  projects, 
  currentProjectId, 
  onSelectProject, 
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  currentView,
  onChangeView
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search Filter
  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  // Pagination Slice
  const displayedProjects = useMemo(() => {
      return filteredProjects.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredProjects, page]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && displayedProjects.length < filteredProjects.length) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [displayedProjects.length, filteredProjects.length]);

  // Auto focus input on edit
  useEffect(() => {
      if (editingId && inputRef.current) {
          inputRef.current.focus();
      }
  }, [editingId]);

  const handleKeyUpdate = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    }
  };

  const startEditing = (project: Project) => {
      if (isCollapsed) return; 
      setEditingId(project.id);
      setEditName(project.name);
  };

  const saveEditing = () => {
      if (editingId && onRenameProject) {
          onRenameProject(editingId, editName);
      }
      setEditingId(null);
  };

  return (
    <div 
      className={`h-full bg-[#FDFCFB] border-r border-stone-200 flex flex-col flex-shrink-0 z-20 transition-all duration-300 relative group ease-in-out ${isCollapsed ? 'w-[72px]' : 'w-72'}`}
    >
      {/* Header - Height 64px (h-16) for standard alignment */}
      <div className={`h-16 flex items-center border-b border-stone-200/50 shrink-0 transition-all relative ${isCollapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
        {!isCollapsed ? (
            <div className="flex items-center gap-3 text-stone-900 overflow-hidden">
              <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                 <Command className="w-4 h-4 text-[#FDFCFB]" />
              </div>
              <span className="font-logo font-medium text-2xl tracking-wide text-stone-900 whitespace-nowrap">LightWork.</span>
            </div>
        ) : (
            <div className="w-9 h-9 bg-stone-900 rounded-lg flex items-center justify-center shadow-sm">
               <Command className="w-5 h-5 text-[#FDFCFB]" />
            </div>
        )}
        
        {/* Toggle Button */}
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`text-stone-400 hover:text-stone-700 transition-colors ${isCollapsed ? 'absolute -right-3 top-12 bg-white border border-stone-200 shadow-sm rounded-full p-1 z-30' : ''}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
            {isCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Primary Actions */}
      <div className={`p-4 shrink-0 space-y-1.5 flex flex-col border-b border-stone-100/50 ${isCollapsed ? 'items-center px-2' : ''}`}>
        <button 
          onClick={onCreateProject}
          title="New Session"
          className={`
            flex items-center rounded-lg font-heading font-medium text-stone-900 bg-white border border-stone-200 shadow-sm hover:border-stone-300 hover:shadow-md transition-all group h-9
            ${isCollapsed ? 'justify-center w-9 p-0' : 'w-full gap-2.5 px-3 text-sm'}
          `}
        >
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 text-stone-500 group-hover:text-stone-900 transition-colors" />
          </div>
          {!isCollapsed && <span>New Session</span>}
        </button>

        <button 
          onClick={() => onChangeView('modules')}
          title="Module Library"
          className={`
            flex items-center rounded-lg font-heading font-medium transition-all h-9
            ${currentView === 'modules' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'}
            ${isCollapsed ? 'justify-center w-9 p-0' : 'w-full gap-2.5 px-3 text-sm'}
          `}
        >
           <Library className={`shrink-0 ${isCollapsed ? 'w-4 h-4' : 'w-4 h-4'}`} />
           {!isCollapsed && <span>Module Library</span>}
        </button>
      </div>

      {/* Search - Hide when collapsed */}
      {!isCollapsed && (
          <div className="px-4 py-3 shrink-0">
             <div className="relative group">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
                 <input 
                    type="text" 
                    placeholder="Search history..." 
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 h-8 text-xs font-medium text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400/20 transition-all font-sans"
                 />
             </div>
          </div>
      )}

      {/* Main Nav (Scrollable) */}
      <div className={`flex-1 overflow-y-auto px-2 space-y-0.5 ${isCollapsed ? 'scrollbar-hide' : ''}`}>
        {!isCollapsed && (
            <div className="px-3 py-2 mt-2">
              <p className="text-[10px] font-heading font-bold text-stone-400 uppercase tracking-wider">Recent Sessions</p>
            </div>
        )}

        {filteredProjects.length === 0 ? (
            !isCollapsed && (
                <div className="px-4 py-12 text-center flex flex-col items-center gap-3">
                    <Archive className="w-8 h-8 text-stone-200" />
                    <span className="text-sm text-stone-400 italic">No sessions found</span>
                </div>
            )
        ) : (
            <>
                {displayedProjects.map((project) => {
                    const isActive = currentProjectId === project.id && currentView === 'workspace';
                    return (
                        <div
                            key={project.id}
                            className={`group relative flex items-center rounded-lg transition-all duration-200 ${
                            isActive
                                ? 'bg-stone-100 text-stone-900'
                                : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                            } ${isCollapsed ? 'justify-center py-2' : ''}`}
                        >
                            {/* Active Marker */}
                            {isActive && !isCollapsed && (
                                <div className="absolute left-2 w-1 h-1 rounded-full bg-stone-900" />
                            )}

                            {editingId === project.id && !isCollapsed ? (
                                <div className="flex items-center gap-2 px-2 py-1 w-full pl-3 h-9">
                                    <input 
                                        ref={inputRef}
                                        type="text" 
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
                                        className="flex-1 min-w-0 bg-white border border-stone-300 rounded px-2 h-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-stone-200 font-sans"
                                    />
                                    <button onMouseDown={saveEditing} className="text-stone-600 hover:text-stone-900">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => onSelectProject(project.id)}
                                        onDoubleClick={() => startEditing(project)}
                                        title={isCollapsed ? project.name : undefined}
                                        className={`
                                            flex items-center font-medium h-9 font-sans
                                            ${isCollapsed ? 'justify-center w-9 p-0 rounded-lg' : 'w-full gap-3 px-3 text-sm pr-8'}
                                            ${isActive && !isCollapsed ? 'pl-5 font-semibold' : ''} 
                                        `}
                                    >
                                        <History className={`flex-shrink-0 transition-colors ${isActive ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-500'} ${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                                        
                                        {!isCollapsed && (
                                            <>
                                                <span className="truncate text-left flex-1">{project.name}</span>
                                                {project.jobs.length > 0 && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${isActive ? 'bg-stone-200 text-stone-600' : 'bg-stone-100 text-stone-400 group-hover:text-stone-500'}`}>{project.jobs.length}</span>
                                                )}
                                            </>
                                        )}
                                    </button>
                                    
                                    {!isCollapsed && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteProject(project.id);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                                            title="Delete Session"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
                {/* Intersection Target */}
                <div ref={observerTarget} className="h-4 w-full" />
            </>
        )}
      </div>

      {/* Footer */}
      <div className={`p-4 border-t border-stone-100 space-y-1 bg-[#FDFCFB] shrink-0 ${isCollapsed ? 'items-center px-2 flex flex-col gap-2' : ''}`}>
        {!isCollapsed ? (
            <div className="flex items-center gap-3 w-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 font-heading">
              <span>LightWork v2.4</span>
            </div>
        ) : (
            <div title="Settings" className="w-9 h-9 flex items-center justify-center text-stone-400">
                <Settings className="w-4 h-4" />
            </div>
        )}
        
        <button 
          onClick={handleKeyUpdate}
          title="Update API Key"
          className={`
            flex items-center text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors rounded-lg hover:bg-stone-50 h-9 font-sans
            ${isCollapsed ? 'justify-center w-9 p-0' : 'gap-2.5 w-full px-3'}
          `}
        >
          <Key className={`${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
          {!isCollapsed && <span>Update API Key</span>}
        </button>
      </div>
    </div>
  );
};