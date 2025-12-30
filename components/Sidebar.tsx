import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Project } from '../types';
import { Plus, Settings, Command, Key, Search, Archive, Check, Trash2, Library, PanelLeftClose, PanelLeftOpen, History, Box, LogOut, User, Loader2, Pin, PinOff } from 'lucide-react';
import { useAuth } from '../services/authContext';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => Promise<void>;
  onRenameProject?: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  currentView: 'workspace' | 'modules';
  onChangeView: (view: 'workspace' | 'modules') => void;
}

const ITEMS_PER_PAGE = 15;
const PINNED_PROJECTS_KEY = 'lightwork_pinned_projects';
const MAX_PINNED = 5;

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
  const [isCreating, setIsCreating] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load pinned projects from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINNED_PROJECTS_KEY);
      if (stored) {
        setPinnedIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save pinned projects to localStorage
  const savePinnedIds = (ids: string[]) => {
    setPinnedIds(ids);
    try {
      localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  };

  // Toggle pin status
  const togglePin = (projectId: string) => {
    if (pinnedIds.includes(projectId)) {
      // Unpin
      savePinnedIds(pinnedIds.filter(id => id !== projectId));
    } else {
      // Pin (if under limit)
      if (pinnedIds.length < MAX_PINNED) {
        savePinnedIds([...pinnedIds, projectId]);
      }
    }
  };

  const isPinned = (projectId: string) => pinnedIds.includes(projectId);

  // Get pinned projects (that still exist)
  const pinnedProjects = useMemo(() => {
    return pinnedIds
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is Project => p !== undefined);
  }, [pinnedIds, projects]);

  // Handle create project with loading state
  const handleCreateProject = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreateProject();
    } finally {
      setIsCreating(false);
    }
  };

  // Search Filter (excluding pinned projects to avoid duplication when not searching)
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // When searching, show all matches; otherwise exclude pinned projects
    if (searchTerm) {
      return filtered;
    }

    const pinnedIdSet = new Set(pinnedIds);
    return filtered.filter(p => !pinnedIdSet.has(p.id));
  }, [projects, searchTerm, pinnedIds]);

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
      className={`h-full bg-[#FDFCFB] border-r border-stone-200 flex flex-col flex-shrink-0 z-20 transition-all duration-300 relative group ease-in-out shadow-sm ${isCollapsed ? 'w-[72px]' : 'w-72'}`}
    >
      {/* Header - Height 64px (h-16) for standard alignment */}
      <div className={`h-16 flex items-center border-b border-stone-200/50 shrink-0 transition-all relative ${isCollapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 text-stone-900 overflow-hidden">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <Command className="w-4 h-4 text-[#FDFCFB]" />
            </div>
            <span className="font-logo font-light text-2xl tracking-tight text-stone-900 whitespace-nowrap">LightWork.</span>
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
          onClick={handleCreateProject}
          disabled={isCreating}
          title="New Project"
          className={`
            flex items-center rounded-lg font-heading font-medium text-stone-900 bg-white border border-stone-200 shadow-sm hover:border-stone-300 hover:shadow-md transition-all group h-9 disabled:opacity-50 disabled:cursor-not-allowed
            ${isCollapsed ? 'justify-center w-9 p-0' : 'w-full gap-2.5 px-3 text-sm'}
          `}
        >
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {isCreating ? (
              <Loader2 className="w-4 h-4 text-stone-500 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 text-stone-500 group-hover:text-stone-900 transition-colors" />
            )}
          </div>
          {!isCollapsed && <span>{isCreating ? 'Creating...' : 'New Project'}</span>}
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
        {/* Pinned Projects (hide when searching) */}
        {!isCollapsed && !searchTerm && pinnedProjects.length > 0 && (
          <>
            <div className="px-3 py-2 mt-2">
              <p className="text-[10px] font-heading font-bold text-clay-600 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3" />
                Pinned ({pinnedProjects.length}/{MAX_PINNED})
              </p>
            </div>
            {pinnedProjects.map((project) => {
              const isActive = currentProjectId === project.id && currentView === 'workspace';
              return (
                <div
                  key={`pinned-${project.id}`}
                  className={`group relative flex items-center rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-clay-100 text-stone-900 border-l-2 border-clay-500'
                    : 'text-stone-600 hover:bg-clay-50 hover:text-stone-900 border-l-2 border-transparent'
                    }`}
                >
                  <button
                    onClick={() => onSelectProject(project.id)}
                    onDoubleClick={() => startEditing(project)}
                    className={`flex items-center font-medium h-9 font-sans w-full gap-3 px-3 text-sm pr-16 ${isActive ? 'pl-5 font-semibold' : ''}`}
                  >
                    <Pin className={`flex-shrink-0 w-3.5 h-3.5 transition-colors ${isActive ? 'text-clay-600' : 'text-clay-400 group-hover:text-clay-500'}`} />
                    <span className="truncate text-left flex-1">{project.name}</span>
                    {project.jobs.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${isActive ? 'bg-clay-200 text-clay-700' : 'bg-clay-100 text-clay-500 group-hover:text-clay-600'}`}>
                        {project.jobs.length}
                      </span>
                    )}
                  </button>
                  {/* Unpin button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(project.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-clay-400 hover:text-clay-600 hover:bg-clay-50 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Unpin"
                  >
                    <PinOff className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <div className="border-b border-stone-100 my-2 mx-3" />
          </>
        )}

        {!isCollapsed && (
          <div className="px-3 py-2 mt-2">
            <p className="text-[10px] font-heading font-bold text-stone-500 uppercase tracking-wider">
              {searchTerm ? 'Search Results' : 'All Projects'}
            </p>
          </div>
        )}

        {filteredProjects.length === 0 ? (
          !isCollapsed && (
            <div className="px-4 py-12 text-center flex flex-col items-center gap-3">
              <Archive className="w-8 h-8 text-stone-300" />
              <span className="text-sm text-stone-500 italic">No projects found</span>
            </div>
          )
        ) : (
          <>
            {displayedProjects.map((project) => {
              const isActive = currentProjectId === project.id && currentView === 'workspace';
              return (
                <div
                  key={project.id}
                  className={`group relative flex items-center rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-clay-50 text-stone-900 border-l-2 border-clay-500'
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 border-l-2 border-transparent'
                    } ${isCollapsed ? 'justify-center py-2' : ''}`}
                >
                  {/* Active Accent Bar - improved visibility */}
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-clay-500 shadow-sm" />
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
                                            ${isCollapsed ? 'justify-center w-9 p-0 rounded-lg' : 'w-full gap-3 px-3 text-sm pr-16'}
                                            ${isActive && !isCollapsed ? 'pl-5 font-semibold' : ''} 
                                        `}
                      >
                        <History className={`flex-shrink-0 transition-colors ${isActive ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-600'} ${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />

                        {!isCollapsed && (
                          <>
                            <span className="truncate text-left flex-1">{project.name}</span>
                            {project.jobs.length > 0 && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${isActive ? 'bg-stone-200 text-stone-600' : 'bg-stone-100 text-stone-500 group-hover:text-stone-600'}`}>{project.jobs.length}</span>
                            )}
                          </>
                        )}
                      </button>

                      {!isCollapsed && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all z-10">
                          {/* Pin button */}
                          {!isPinned(project.id) && pinnedIds.length < MAX_PINNED && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(project.id);
                              }}
                              className="p-1.5 text-stone-300 hover:text-clay-600 hover:bg-clay-50 rounded-md transition-colors"
                              title="Pin to top"
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                          )}
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(project.id);
                            }}
                            className="p-1.5 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Project"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
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

      {/* Footer - User Profile */}
      <div className={`border-t border-stone-100 bg-[#FDFCFB] shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <UserProfile isCollapsed={isCollapsed} />
      </div>
    </div>
  );
};

// User Profile Component
function UserProfile({ isCollapsed }: { isCollapsed: boolean }) {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const userInitial = user.displayName?.charAt(0) || user.email?.charAt(0) || 'U';
  const userEmail = user.email || '';
  const userName = user.displayName || userEmail.split('@')[0];

  const handleSignOut = async () => {
    if (confirm('Sign out of LightWork?')) {
      await signOut();
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={handleSignOut}
          title={`Sign out (${userEmail})`}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-clay-400 to-clay-600 flex items-center justify-center text-white font-heading font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all"
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
          ) : (
            userInitial.toUpperCase()
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* User Info */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-clay-400 to-clay-600 flex items-center justify-center text-white font-heading font-bold text-sm shadow-md shrink-0">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" loading="lazy" decoding="async" />
          ) : (
            userInitial.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-stone-900 truncate">{userName}</p>
          <p className="text-[10px] text-stone-500 truncate">{userEmail}</p>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2.5 w-full px-3 h-9 text-xs font-semibold text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg font-sans"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}