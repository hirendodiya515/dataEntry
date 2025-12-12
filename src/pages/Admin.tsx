import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
    id: string;
    email: string;
    role: 'admin' | 'editor' | 'viewer';
    createdAt?: string;
}

export default function Admin() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const { currentUser } = useAuth();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const q = query(collection(db, 'users'));
            const snapshot = await getDocs(q);
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as UserProfile));
            setUsers(fetchedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
            showToast("Failed to fetch users", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            showToast(`User role updated to ${newRole}`, "success");
        } catch (error) {
            console.error("Error updating role:", error);
            showToast("Failed to update role", "error");
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (userId === currentUser?.uid) {
            showToast("You cannot delete your own account here.", "error");
            return;
        }

        if (!confirm("Are you sure you want to delete this user profile? This will remove their access permissions.")) return;

        try {
            await deleteDoc(doc(db, 'users', userId));
            setUsers(prev => prev.filter(u => u.id !== userId));
            showToast("User profile deleted", "success");
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast("Failed to delete user", "error");
        }
    };

    const handleAddUserClick = () => {
        alert("To add a new user, ask them to Sign Up on the login page. Once they sign up, they will appear here, and you can assign them a role.");
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return <ShieldAlert size={16} className="text-red-500" />;
            case 'editor': return <ShieldCheck size={16} className="text-green-500" />;
            default: return <Shield size={16} className="text-blue-500" />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-700 border-red-200';
            case 'editor': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">User Management</h2>
                    <p className="text-slate-500 mt-1">Manage user access and permissions</p>
                </div>
                <button
                    onClick={handleAddUserClick}
                    className="glass-button bg-indigo-600/80 text-white hover:bg-indigo-700/80 flex items-center gap-2"
                >
                    <UserPlus size={18} />
                    Add User
                </button>
            </div>

            <div className="glass-panel p-6">
                {loading ? (
                    <div className="text-center py-8 text-slate-500">Loading users...</div>
                ) : (
                    <div className="space-y-4">
                        {users.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">No users found.</div>
                        ) : (
                            users.map((user) => (
                                <div key={user.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/30 border border-white/40 gap-4 transition-all hover:bg-white/50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${user.role === 'admin' ? 'bg-red-100 text-red-600' :
                                                user.role === 'editor' ? 'bg-green-100 text-green-600' :
                                                    'bg-blue-100 text-blue-600'
                                            }`}>
                                            {user.email?.[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800">{user.email}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>ID: {user.id.slice(0, 8)}...</span>
                                                {user.id === currentUser?.uid && <span className="text-indigo-600 font-medium">(You)</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 self-end md:self-auto">
                                        <div className="relative group">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                                                className={`appearance-none pl-8 pr-8 py-1.5 rounded-full text-xs font-medium border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 transition-all ${getRoleColor(user.role)}`}
                                                disabled={user.id === currentUser?.uid}
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="editor">Editor</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                {getRoleIcon(user.role)}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={user.id === currentUser?.uid}
                                            className={`p-2 rounded-lg transition-colors ${user.id === currentUser?.uid
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                }`}
                                            title="Delete User Profile"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
