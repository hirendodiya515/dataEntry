import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, ZAxis
} from 'recharts';
import {
    Settings, BarChart2, TrendingUp, PieChart, Activity,
    LayoutTemplate, ArrowLeftRight, MousePointerClick, AlignLeft,
    ZoomIn, RotateCcw
} from 'lucide-react';

// --- Types ---
interface FormField {
    id: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'time' | 'decimal' | 'dropdown';
    required: boolean;
    options?: string[];
}

interface FormSchema {
    id: string;
    name: string;
    fields: FormField[];
}

type ChartType = 'column' | 'bar' | 'line' | 'area' | 'combo' | 'scatter' | 'histogram' | 'pareto';

interface ChartConfig {
    type: ChartType;
    xAxis: string;
    yAxis: string;
    secondaryYAxis?: string;
    groupBy?: string;
    target?: number;
}

// --- Icons Map ---
const ChartIcons: Record<ChartType, React.ElementType> = {
    column: BarChart2,
    bar: LayoutTemplate,
    line: TrendingUp,
    area: Activity,
    combo: PieChart,
    scatter: MousePointerClick,
    histogram: AlignLeft,
    pareto: TrendingUp
};

// Helper function to format Y-axis ticks
const formatYAxisTick = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    } else if (value >= 1) {
        return value.toFixed(1);
    } else if (value > 0) {
        return value.toFixed(2);
    }
    return '0';
};

export default function Analysis() {
    // --- State ---
    const [forms, setForms] = useState<FormSchema[]>([]);
    const [selectedForm, setSelectedForm] = useState<FormSchema | null>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const [config, setConfig] = useState<ChartConfig>({
        type: 'column',
        xAxis: '',
        yAxis: ''
    });

    // Zoom/Pan State
    const [yDomain, setYDomain] = useState<[number | 'auto', number | 'auto']>([0, 'auto']);
    const [isDragging, setIsDragging] = useState(false);
    const lastY = useRef<number>(0);

    // --- Fetch Forms ---
    useEffect(() => {
        const fetchForms = async () => {
            const q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormSchema)));
        };
        fetchForms();
    }, []);

    // --- Fetch Submissions ---
    useEffect(() => {
        if (selectedForm) {
            const fetchSubmissions = async () => {
                setLoading(true);
                try {
                    const q = query(collection(db, 'submissions'), where('formId', '==', selectedForm.id));
                    const snapshot = await getDocs(q);
                    setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                    // Auto-select first suitable fields for axes if not set
                    const numberFields = selectedForm.fields.filter(f => f.type === 'number' || f.type === 'decimal');
                    const dateFields = selectedForm.fields.filter(f => f.type === 'date' || f.type === 'time');
                    const textFields = selectedForm.fields.filter(f => f.type === 'text' || f.type === 'dropdown');

                    setConfig(prev => ({
                        ...prev,
                        xAxis: prev.xAxis || dateFields[0]?.name || textFields[0]?.name || '',
                        yAxis: prev.yAxis || numberFields[0]?.name || ''
                    }));

                } catch (error) {
                    console.error("Error fetching submissions:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchSubmissions();
        } else {
            setSubmissions([]);
        }
    }, [selectedForm]);

    // Reset Zoom when config changes
    useEffect(() => {
        setYDomain([0, 'auto']);
    }, [config.yAxis, config.type, selectedForm]);

    // --- Data Processing ---
    const chartData = useMemo(() => {
        if (!submissions.length || !config.xAxis || !config.yAxis) return [];

        // 1. Histogram Logic
        if (config.type === 'histogram') {
            const values = submissions.map(s => Number(s.data[config.yAxis]) || 0).sort((a, b) => a - b);
            if (values.length === 0) return [];

            const min = values[0];
            const max = values[values.length - 1];
            const binCount = 10;
            const binSize = (max - min) / binCount || 1;

            const bins = Array.from({ length: binCount }, (_, i) => {
                const start = min + i * binSize;
                const end = start + binSize;
                return {
                    range: `${start.toFixed(1)} - ${end.toFixed(1)}`,
                    count: 0,
                    start,
                    end,
                    target: config.target
                };
            });

            values.forEach(v => {
                const bin = bins.find(b => v >= b.start && v < b.end) || bins[bins.length - 1];
                bin.count++;
            });

            return bins;
        }

        // 2. Pareto Logic
        if (config.type === 'pareto') {
            const grouped: Record<string, number> = {};
            submissions.forEach(sub => {
                const key = String(sub.data[config.xAxis] || 'Unknown');
                const val = Number(sub.data[config.yAxis]) || 0;
                grouped[key] = (grouped[key] || 0) + val;
            });

            const sorted = Object.entries(grouped)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            const total = sorted.reduce((sum, item) => sum + item.value, 0);
            let cumulative = 0;

            return sorted.map(item => {
                cumulative += item.value;
                return {
                    ...item,
                    cumulativePercentage: Math.round((cumulative / total) * 100),
                    target: config.target
                };
            });
        }

        // 3. Default Logic
        return submissions.map((sub, index) => ({
            ...sub.data,
            index: index + 1,
            [config.yAxis]: Number(sub.data[config.yAxis]) || 0,
            target: config.target
        }));

    }, [submissions, config]);

    const resetZoom = () => setYDomain([0, 'auto']);

    const handleWheel = (e: React.WheelEvent) => {
        if (!chartData.length) return;

        const currentMax = yDomain[1] === 'auto'
            ? Math.max(...chartData.map(d => Number(d[config.yAxis]) || 0)) * 1.1
            : (yDomain[1] as number);

        const currentMin = yDomain[0] === 'auto' ? 0 : (yDomain[0] as number);

        const range = currentMax - currentMin;
        // 10% zoom in/out per scroll
        const zoomFactor = e.deltaY > 0 ? 0.10 : -0.10;
        const newRange = range * (1 + zoomFactor);

        // Prevent zooming out beyond the original data range
        const maxDataValue = Math.max(...chartData.map(d => Number(d[config.yAxis]) || 0)) * 1.1;
        const finalRange = Math.min(newRange, maxDataValue);

        setYDomain([currentMin, currentMin + finalRange]);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        lastY.current = e.clientY;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && lastY.current !== null) {
            if (yDomain[1] === 'auto') return;

            const delta = lastY.current - e.clientY;
            const range = (yDomain[1] as number) - (yDomain[0] as number);
            const factor = range * 0.002;
            const shift = delta * factor;

            setYDomain(prev => [
                (prev[0] as number) + shift,
                (prev[1] as number) + shift
            ]);
            lastY.current = e.clientY;
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const renderChart = () => {
        if (!selectedForm || !config.yAxis) {
            return <div className="flex items-center justify-center h-full text-slate-500">Please configure the chart</div>;
        }

        if (!chartData.length) {
            return <div className="flex items-center justify-center h-full text-slate-500">No data available</div>;
        }

        const CommonAxis = () => (
            <>
                <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                    dataKey={config.type === 'histogram' ? 'range' : (config.xAxis || 'index')}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                    interval={0}
                    tick={{ fontSize: 12 }}
                />
                <YAxis
                    domain={yDomain}
                    allowDataOverflow={true}
                    tickFormatter={formatYAxisTick}
                />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px' }} />
                <Legend />
            </>
        );

        const TargetLine = () => config.target ? (
            <Line
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="#ef4444"
                strokeDasharray="5 5"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
            />
        ) : null;

        switch (config.type) {
            case 'column':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CommonAxis />
                            <Bar dataKey={config.yAxis} fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <TargetLine />
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                            <XAxis type="number" domain={yDomain} allowDataOverflow={true} tickFormatter={formatYAxisTick} />
                            <YAxis dataKey={config.xAxis} type="category" width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey={config.yAxis} fill="#6366f1" radius={[0, 4, 4, 0]} />
                            {config.target && (
                                <Line dataKey="target" stroke="#ef4444" strokeDasharray="5 5" dot={false} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CommonAxis />
                            <Line type="monotone" dataKey={config.yAxis} stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                            <TargetLine />
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CommonAxis />
                            <Area type="monotone" dataKey={config.yAxis} fill="#6366f1" stroke="#6366f1" fillOpacity={0.3} />
                            <TargetLine />
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey={config.xAxis} name={config.xAxis} />
                            <YAxis
                                type="number"
                                dataKey={config.yAxis}
                                name={config.yAxis}
                                domain={yDomain}
                                allowDataOverflow={true}
                                tickFormatter={formatYAxisTick}
                            />
                            <ZAxis range={[60, 400]} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Legend />
                            <Scatter name="Data" data={chartData} fill="#6366f1" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            case 'histogram':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CommonAxis />
                            <Bar dataKey="count" name="Frequency" fill="#6366f1" />
                            <TargetLine />
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'pareto':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" domain={yDomain} allowDataOverflow={true} tickFormatter={formatYAxisTick} />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="value" fill="#6366f1" barSize={20} />
                            <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#ff7300" />
                            {config.target && (
                                <Line yAxisId="left" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" dot={false} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            case 'combo':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CommonAxis />
                            <Bar dataKey={config.yAxis} fill="#6366f1" />
                            {config.secondaryYAxis && (
                                <Line type="monotone" dataKey={config.secondaryYAxis} stroke="#ff7300" />
                            )}
                            <TargetLine />
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            default:
                return <div className="flex items-center justify-center h-full text-slate-500">Select a chart type</div>;
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-6rem)] gap-6">
            {/* Sidebar Configuration */}
            <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="w-full md:w-80 glass-panel p-6 flex flex-col gap-6 overflow-y-auto shrink-0"
            >
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-4">
                    <Settings size={20} />
                    <h2 className="font-bold text-lg">Configuration</h2>
                </div>

                {/* Form Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Data Source</label>
                    <select
                        className="w-full glass-input"
                        value={selectedForm?.id || ''}
                        onChange={(e) => {
                            const form = forms.find(f => f.id === e.target.value);
                            setSelectedForm(form || null);
                            setConfig(prev => ({ ...prev, xAxis: '', yAxis: '' }));
                        }}
                    >
                        <option value="">Select Form...</option>
                        {forms.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                    </select>
                </div>

                {selectedForm && (
                    <>
                        {/* Chart Type Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Chart Type</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(['column', 'bar', 'line', 'area', 'combo', 'scatter', 'histogram', 'pareto'] as ChartType[]).map(type => {
                                    const Icon = ChartIcons[type] || BarChart2;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setConfig(prev => ({ ...prev, type }))}
                                            className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-all ${config.type === type
                                                ? 'bg-indigo-600 text-white shadow-md scale-105'
                                                : 'bg-white/50 text-slate-600 hover:bg-white hover:shadow-sm'
                                                }`}
                                            title={type.charAt(0).toUpperCase() + type.slice(1)}
                                        >
                                            <Icon size={18} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Axes Configuration */}
                        <div className="space-y-4 border-t border-slate-200 pt-4">
                            {config.type !== 'histogram' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <ArrowLeftRight size={16} /> X-Axis {config.type === 'scatter' ? '(Number)' : '(Category)'}
                                    </label>
                                    <select
                                        className="w-full glass-input"
                                        value={config.xAxis}
                                        onChange={(e) => setConfig(prev => ({ ...prev, xAxis: e.target.value }))}
                                    >
                                        <option value="">Select Field...</option>
                                        {selectedForm.fields.map(f => (
                                            <option key={f.id} value={f.name}>{f.name} ({f.type})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                    <TrendingUp size={16} /> Y-Axis (Value)
                                </label>
                                <select
                                    className="w-full glass-input"
                                    value={config.yAxis}
                                    onChange={(e) => setConfig(prev => ({ ...prev, yAxis: e.target.value }))}
                                >
                                    <option value="">Select Field...</option>
                                    {selectedForm.fields
                                        .filter(f => ['number', 'decimal'].includes(f.type))
                                        .map(f => (
                                            <option key={f.id} value={f.name}>{f.name}</option>
                                        ))
                                    }
                                </select>
                            </div>

                            {(config.type === 'combo' || config.type === 'pareto') && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                        <Activity size={16} /> Secondary Y-Axis
                                    </label>
                                    <select
                                        className="w-full glass-input"
                                        value={config.secondaryYAxis || ''}
                                        onChange={(e) => setConfig(prev => ({ ...prev, secondaryYAxis: e.target.value }))}
                                    >
                                        <option value="">None</option>
                                        {selectedForm.fields
                                            .filter(f => ['number', 'decimal'].includes(f.type))
                                            .map(f => (
                                                <option key={f.id} value={f.name}>{f.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                    Target Line (Optional)
                                </label>
                                <input
                                    type="number"
                                    className="w-full glass-input"
                                    placeholder="Enter target value..."
                                    value={config.target || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, target: Number(e.target.value) || undefined }))}
                                />
                            </div>
                        </div>
                    </>
                )}
            </motion.div>

            {/* Main Chart Area */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 glass-panel p-6 flex flex-col min-h-0"
            >
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {selectedForm ? `${selectedForm.name} Analysis` : 'Dashboard'}
                    </h2>
                    <div className="flex items-center gap-4">
                        {loading && <span className="text-indigo-600 animate-pulse text-sm font-medium">Loading data...</span>}
                        {yDomain[0] !== 'auto' && (
                            <button
                                onClick={resetZoom}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium"
                            >
                                <RotateCcw size={16} /> Reset Zoom
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className={`flex-1 w-full min-h-0 bg-white/40 rounded-2xl p-4 border border-white/50 shadow-inner relative overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {renderChart()}
                </div>

                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <ZoomIn size={14} />
                    <span>Scroll to zoom Y-axis (10% per scroll) • Drag to pan</span>
                </div>
            </motion.div>
        </div>
    );
}