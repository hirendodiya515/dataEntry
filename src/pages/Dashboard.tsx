import { motion } from 'framer-motion';
import { TrendingUp, Users, FileText, Activity } from 'lucide-react';

import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Dashboard() {
    const [stats, setStats] = useState([
        { title: 'Total Records', value: '...', icon: FileText, color: 'bg-blue-500' },
        { title: 'Active Users', value: '...', icon: Users, color: 'bg-green-500' },
        { title: 'Data Points', value: '...', icon: Activity, color: 'bg-purple-500' },
        { title: 'Growth', value: '...', icon: TrendingUp, color: 'bg-pink-500' },
    ]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'records'));
                const totalRecords = querySnapshot.size;

                // Calculate other stats based on real data if available
                // For now, we'll simulate some based on the record count

                setStats([
                    { title: 'Total Records', value: totalRecords.toLocaleString(), icon: FileText, color: 'bg-blue-500' },
                    { title: 'Active Users', value: '1', icon: Users, color: 'bg-green-500' }, // Hardcoded for now
                    { title: 'Data Points', value: (totalRecords * 5).toLocaleString(), icon: Activity, color: 'bg-purple-500' }, // Simulated
                    { title: 'Growth', value: '+0%', icon: TrendingUp, color: 'bg-pink-500' }, // Placeholder
                ]);
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Dashboard</h2>
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white/40 rounded-full text-sm text-slate-600 border border-white/50">Last updated: Just now</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="glass-panel p-6 flex items-center gap-4"
                    >
                        <div className={`p-3 rounded-xl ${stat.color} text-white shadow-lg`}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel p-6 h-96"
                >
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Recent Activity</h3>
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Chart Placeholder
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="glass-panel p-6 h-96"
                >
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Data Trends</h3>
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Chart Placeholder
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
