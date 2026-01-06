
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project } from '../types';
import { Plus, Settings, Command, Search, Archive, Check, Trash2, Library, PanelLeftClose, PanelLeftOpen, History, LogOut, Loader2, Pin, PinOff, Copy, X, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../services/authContext';
import { getGradient } from '../utils';
import { useSidebar } from '../hooks/useSidebar';
import { ProjectMenu } from './ProjectMenu';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => Promise<void>;
  onRenameProject?: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject?: (id: string) => void;
  currentView: 'workspace' | 'modules' | 'settings';
  onChangeView: (view: 'workspace' | 'modules' | 'settings') => void;
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
  onDuplicateProject,
  currentView,
  onChangeView
}) => {
  const { isOpen, isCollapsed, close, toggleCollapse } = useSidebar();

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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
      savePinnedIds(pinnedIds.filter(id => id !== projectId));
    } else {
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

  // Search Filter
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
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

  // Close sidebar on mobile when selecting a project
  const handleSelectProject = (id: string) => {
    onSelectProject(id);
    // Close on mobile
    if (window.innerWidth < 768) {
      close();
    }
  };

  // Sidebar panel content (shared between mobile and desktop)
  const sidebarContent = (
    <>
      {/* Header */}
      <div className={`h-16 flex items-center border-b border-stone-200/50 shrink-0 transition-all relative ${isCollapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3 text-stone-900 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden group bg-white shadow-sm border border-stone-200/50">
              <img src="/logo.png" alt="LightWork Logo" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-clay-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-logo font-medium text-xl tracking-tight text-stone-900 whitespace-nowrap">LightWork.</span>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center relative overflow-hidden group bg-white shadow-sm border border-stone-200/50">
            <img src="/logo.png" alt="LightWork Logo" className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-clay-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Desktop Toggle (hidden on mobile) */}
        <button
          onClick={toggleCollapse}
          className={`hidden md:block text-stone-400 hover:text-stone-700 transition-colors ${isCollapsed ? 'absolute -right-3 top-12 bg-white border border-stone-200 shadow-sm rounded-full p-1 z-30' : ''}`}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" aria-hidden="true" /> : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
        </button>

        {/* Mobile Close Button (visible only on mobile when open) */}
        <button
          onClick={close}
          className="md:hidden p-2 -mr-2 text-stone-400 hover:text-stone-700 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Primary Actions */}
      <div className={`p-4 shrink-0 space-y-1.5 flex flex-col border-b border-stone-100/50 ${isCollapsed ? 'items-center px-2' : ''}`}>
        <button
          onClick={handleCreateProject}
          disabled={isCreating}
          title="New Project"
          className={`flex items-center rounded-lg font-heading font-medium text-stone-900 bg-white border border-stone-200 shadow-sm hover:border-stone-300 hover:shadow-md transition-all group h-9 disabled:opacity-50 disabled:cursor-not-allowed ${isCollapsed ? 'justify-center w-9 p-0' : 'w-full gap-2.5 px-3 text-sm'}`}
        >
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {isCreating ? (
              <Loader2 className="w-4 h-4 text-stone-500 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4 text-stone-500 group-hover:text-stone-900 transition-colors" aria-hidden="true" />
            )}
          </div>
          {!isCollapsed && <span>{isCreating ? 'Creating...' : 'New Project'}</span>}
        </button>

        <button
          onClick={() => { onChangeView('modules'); if (window.innerWidth < 768) close(); }}
          title="Module Library"
          className={`flex items-center rounded-lg font-heading font-medium transition-all h-9 ${currentView === 'modules' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'} ${isCollapsed ? 'justify-center w-9 p-0' : 'w-full gap-2.5 px-3 text-sm'}`}
        >
          <Library className="shrink-0 w-4 h-4" aria-hidden="true" />
          {!isCollapsed && <span>Module Library</span>}
        </button>
      </div>

      {/* Search - Hide when collapsed */}
      {!isCollapsed && (
        <div className="px-4 py-3 shrink-0">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 group-focus-within:text-stone-600 transition-colors" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 h-8 text-xs font-medium text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-clay-400 focus:ring-4 focus:ring-clay-500/5 transition-all font-sans"
            />
          </div>
        </div>
      )}

      {/* Main Nav (Scrollable) */}
      <nav className={`flex-1 overflow-y-auto px-2 space-y-0.5 ${isCollapsed ? 'scrollbar-hide' : ''}`} role="navigation" aria-label="Projects">
        {/* Pinned Projects */}
        {!isCollapsed && !searchTerm && pinnedProjects.length > 0 && (
          <>
            <div className="px-3 py-2 mt-2">
              <p className="text-[10px] font-heading font-bold text-clay-600 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3" aria-hidden="true" />
                Pinned ({pinnedProjects.length}/{MAX_PINNED})
              </p>
            </div>
            {pinnedProjects.map((project) => {
              const isActive = currentProjectId === project.id && currentView === 'workspace';
              return (
                <div
                  key={`pinned-${project.id}`}
                  className={`group relative flex items-center rounded-lg transition-all duration-200 ${isActive ? 'bg-clay-100 text-stone-900' : 'text-stone-600 hover:bg-clay-50 hover:text-stone-900'}`}
                >
                  {isActive && !isCollapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-clay-500 shadow-sm" />
                  )}
                  <button
                    onClick={() => handleSelectProject(project.id)}
                    onDoubleClick={() => startEditing(project)}
                    className={`flex items-center font-medium h-9 font-sans w-full gap-3 px-3 text-sm pr-16 ${isActive ? 'pl-5 font-semibold' : ''}`}
                  >
                    <Pin className={`flex-shrink-0 w-3.5 h-3.5 transition-colors ${isActive ? 'text-clay-600' : 'text-clay-400 group-hover:text-clay-500'}`} aria-hidden="true" />
                    <span className="truncate text-left flex-1">{project.name}</span>
                    {project.jobs.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${isActive ? 'bg-clay-200 text-clay-700' : 'bg-clay-100 text-clay-500 group-hover:text-clay-600'}`}>
                        {project.jobs.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(project.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-clay-400 hover:text-clay-600 hover:bg-clay-50 rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Unpin"
                    aria-label={`Unpin ${project.name}`}
                  >
                    <PinOff className="w-3 h-3" aria-hidden="true" />
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
              <Archive className="w-8 h-8 text-stone-300" aria-hidden="true" />
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
                  className={`group relative flex items-center rounded-lg transition-all duration-200 ${isActive ? 'bg-clay-50 text-stone-900' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'} ${isCollapsed ? 'justify-center py-2' : ''}`}
                >
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
                        className="flex-1 min-w-0 bg-white border border-stone-300 rounded px-2 h-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-clay-500/20 font-sans"
                      />
                      <button onMouseDown={saveEditing} className="text-stone-600 hover:text-stone-900">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelectProject(project.id)}
                        onDoubleClick={() => startEditing(project)}
                        title={isCollapsed ? project.name : undefined}
                        className={`flex items-center font-medium h-9 font-sans ${isCollapsed ? 'justify-center w-9 p-0 rounded-lg' : 'w-full gap-3 px-3 text-sm pr-16'} ${isActive && !isCollapsed ? 'pl-5 font-semibold' : ''}`}
                      >
                        <History className={`flex-shrink-0 transition-colors ${isActive ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-600'} ${isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} aria-hidden="true" />
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
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all z-10">
                          <ProjectMenu
                            projectName={project.name}
                            isPinned={isPinned(project.id)}
                            canPin={pinnedIds.length < MAX_PINNED}
                            onRename={() => startEditing(project)}
                            onDuplicate={onDuplicateProject ? () => onDuplicateProject(project.id) : undefined}
                            onTogglePin={() => togglePin(project.id)}
                            onDelete={() => {
                              if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                                onDeleteProject(project.id);
                              }
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div ref={observerTarget} className="h-4 w-full" />
          </>
        )}
      </nav>

      {/* Footer - User Profile */}
      <div className={`border-t border-stone-100 bg-[#FDFCFB] shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <UserProfile isCollapsed={isCollapsed} onClose={close} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-20
          h-full bg-[#FDFCFB] border-r border-stone-200 flex flex-col flex-shrink-0
          transition-all duration-300 ease-in-out shadow-lg md:shadow-sm
          ${isCollapsed ? 'md:w-[72px]' : 'md:w-72'}
          w-[85vw] max-w-[320px] md:max-w-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
};

// Mobile Menu Trigger (exported for use in App.tsx header)
export function MobileMenuTrigger() {
  const { toggle } = useSidebar();

  return (
    <button
      onClick={toggle}
      className="md:hidden p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

// User Profile Component
function UserProfile({ isCollapsed, onClose }: { isCollapsed: boolean; onClose: () => void }) {
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
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all"
          style={{ background: user.photoURL ? 'transparent' : getGradient(userName) }}
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
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm shadow-md shrink-0"
          style={{ background: user.photoURL ? 'transparent' : getGradient(userName) }}
        >
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

      {/* Settings Button */}
      <button
        onClick={() => {
          const event = new CustomEvent('lightwork:navigate-settings');
          window.dispatchEvent(event);
          if (window.innerWidth < 768) onClose();
        }}
        className="flex items-center gap-2.5 w-full px-3 h-9 text-xs font-semibold text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors rounded-lg font-sans mb-1"
      >
        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Settings</span>
      </button>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2.5 w-full px-3 h-9 text-xs font-semibold text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors rounded-lg font-sans"
      >
        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Sign Out</span>
      </button>
    </div>
  );
}