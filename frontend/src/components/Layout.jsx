import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Users, Settings, Calendar, Bell, Search as SearchIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const navItems = [
    { name: 'Candidates', path: '/candidates', icon: Users },
    { name: 'Scheduling', path: '/scheduling', icon: Calendar },
  ];

  return (
    <aside className="w-[280px] bg-surface border-r border-borderSoft flex flex-col h-full flex-shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      <div className="h-[72px] flex items-center px-6 border-b border-borderSoft">
        <img 
          src="https://kadellabs.com/wp-content/uploads/2024/08/KL-blue-1-1.svg" 
          alt="Kadellabs Logo" 
          className="h-8"
        />
      </div>
      
      <div className="px-6 py-4">
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center px-3 py-2.5 rounded-[12px] text-[15px] font-semibold transition-all duration-200',
                isActive 
                  ? 'bg-primary-50 text-primary-800 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )
            }
          >
            <item.icon className={cn("w-5 h-5 mr-3", window.location.pathname.includes(item.path) ? "text-primary-600" : "text-slate-400")} />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-borderSoft">
        <div className="flex items-center px-3 py-2.5 text-[15px] font-semibold text-slate-500 rounded-[12px] hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer">
          <Settings className="w-5 h-5 mr-3 text-slate-400" />
          Settings
        </div>
      </div>
    </aside>
  );
};

const Layout = () => {
  const location = useLocation();
  const isScheduling = location.pathname.includes('/scheduling');

  return (
    <div className="flex h-screen overflow-hidden bg-background text-textMain font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-[72px] flex items-center justify-between px-8 bg-surface border-b border-borderSoft flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center flex-1">
            <div className="relative w-96 hidden md:block">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search candidates, jobs, or interviews..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-[12px] pl-9 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all placeholder-slate-400"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="h-8 border-l border-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-700">Alex Recruiter</p>
                <p className="text-xs text-slate-500">Talent Acquisition</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-800 border border-primary-200">
                AR
              </div>
            </div>
          </div>
        </header>
        <div className={cn("flex-1 overflow-auto relative", !isScheduling && "p-8")}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
