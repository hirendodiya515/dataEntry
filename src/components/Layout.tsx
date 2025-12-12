import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, BarChart2, Users, LogOut, Menu, X, FilePlus, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { currentUser, userRole, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/form-builder', icon: FilePlus, label: 'Form Builder' },
        { path: '/data-entry', icon: Database, label: 'Data Entry' },
        { path: '/analysis', icon: BarChart2, label: 'Analysis' },
        ...(userRole === 'admin' ? [{ path: '/admin', icon: Users, label: 'Admin' }] : []),
    ];

    return (
        <div className="flex min-h-screen overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100">
            {/* Sidebar for Desktop */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? '5rem' : '16rem' }}
                className="hidden md:flex flex-col m-4 glass-panel h-[calc(100vh-2rem)] sticky top-4 overflow-hidden"
            >
                <div className={`p-6 border-b border-white/20 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    {!isCollapsed && (
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 whitespace-nowrap">
                                DataViz
                            </h1>
                            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Analytics Platform</p>
                        </div>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`p-1.5 rounded-lg hover:bg-white/50 text-slate-600 transition-colors ${isCollapsed ? '' : 'ml-2'}`}
                    >
                        <Menu size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                                    ? 'bg-white/40 shadow-sm text-indigo-700 font-medium'
                                    : 'text-slate-600 hover:bg-white/20 hover:text-indigo-600'
                                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                                title={isCollapsed ? item.label : ''}
                            >
                                <Icon size={20} className="min-w-[20px]" />
                                {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/20">
                    {!isCollapsed ? (
                        <div className="flex items-center gap-3 px-4 py-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 min-w-[2rem]">
                                {currentUser?.email?.[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{currentUser?.email}</p>
                                <p className="text-xs text-slate-500 capitalize">{userRole}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center mb-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200" title={currentUser?.email || ''}>
                                {currentUser?.email?.[0].toUpperCase()}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? "Logout" : ""}
                    >
                        <LogOut size={18} className="min-w-[18px]" />
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </motion.aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 p-4">
                <div className="glass-panel p-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-indigo-600">DataViz</h1>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-40 bg-white/80 backdrop-blur-xl pt-24 px-6 md:hidden"
                    >
                        <nav className="space-y-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/50 shadow-sm text-slate-700"
                                >
                                    <item.icon size={24} />
                                    <span className="text-lg font-medium">{item.label}</span>
                                </Link>
                            ))}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-50 text-red-600 mt-8"
                            >
                                <LogOut size={24} />
                                <span className="text-lg font-medium">Logout</span>
                            </button>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto h-screen p-4 md:p-8 pt-24 md:pt-8">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
