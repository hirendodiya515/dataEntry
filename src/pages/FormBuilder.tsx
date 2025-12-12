import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Type, Calendar, Hash, Clock, List, AlignLeft, Edit, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

type FieldType = 'text' | 'number' | 'date' | 'time' | 'decimal' | 'dropdown';

interface FormField {
    id: string;
    name: string;
    type: FieldType;
    required: boolean;
    options?: string[]; // For dropdowns
}

interface FormSchema {
    id: string;
    name: string;
    fields: FormField[];
}

export default function FormBuilder() {
    const { currentUser } = useAuth();
    const [formName, setFormName] = useState('');
    const [fields, setFields] = useState<FormField[]>([]);
    const [loading, setLoading] = useState(false);
    const [existingForms, setExistingForms] = useState<FormSchema[]>([]);
    const [editingFormId, setEditingFormId] = useState<string | null>(null);

    useEffect(() => {
        fetchForms();
    }, []);

    const fetchForms = async () => {
        try {
            const q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setExistingForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormSchema)));
        } catch (error) {
            console.error("Error fetching forms:", error);
        }
    };

    const addField = () => {
        const newField: FormField = {
            id: crypto.randomUUID(),
            name: '',
            type: 'text',
            required: false
        };
        setFields([...fields, newField]);
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleEditForm = (form: FormSchema) => {
        setEditingFormId(form.id);
        setFormName(form.name);
        setFields(form.fields);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteForm = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) return;

        try {
            await deleteDoc(doc(db, 'forms', id));
            setExistingForms(prev => prev.filter(f => f.id !== id));
            if (editingFormId === id) {
                resetForm();
            }
        } catch (error) {
            console.error("Error deleting form:", error);
            alert("Failed to delete form");
        }
    };

    const resetForm = () => {
        setEditingFormId(null);
        setFormName('');
        setFields([]);
    };

    const handleSaveForm = async () => {
        if (!formName.trim()) {
            alert('Please enter a form name');
            return;
        }
        if (fields.length === 0) {
            alert('Please add at least one field');
            return;
        }
        if (fields.some(f => !f.name.trim())) {
            alert('All fields must have a name');
            return;
        }

        setLoading(true);
        try {
            const formData = {
                name: formName,
                fields: fields,
                updatedAt: serverTimestamp(),
                ...(editingFormId ? {} : { createdBy: currentUser?.uid, createdAt: serverTimestamp(), status: 'active' })
            };

            if (editingFormId) {
                await updateDoc(doc(db, 'forms', editingFormId), formData);
                alert('Form updated successfully!');
            } else {
                await addDoc(collection(db, 'forms'), formData);
                alert('Form created successfully!');
            }

            resetForm();
            fetchForms();
        } catch (error) {
            console.error('Error saving form:', error);
            alert('Failed to save form');
        } finally {
            setLoading(false);
        }
    };

    const getIconForType = (type: FieldType) => {
        switch (type) {
            case 'text': return <Type size={16} />;
            case 'number': return <Hash size={16} />;
            case 'decimal': return <Hash size={16} />;
            case 'date': return <Calendar size={16} />;
            case 'time': return <Clock size={16} />;
            case 'dropdown': return <List size={16} />;
            default: return <AlignLeft size={16} />;
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Form Builder</h2>
                <div className="flex gap-2">
                    {editingFormId && (
                        <button
                            onClick={resetForm}
                            className="glass-button bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-2"
                        >
                            <X size={20} />
                            Cancel Edit
                        </button>
                    )}
                    <button
                        onClick={handleSaveForm}
                        disabled={loading}
                        className="glass-button bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Save size={20} />
                        {loading ? 'Saving...' : (editingFormId ? 'Update Form' : 'Save Form')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Editor Area */}
                <div className="lg:col-span-2 glass-panel p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            {editingFormId ? 'Editing Form' : 'New Form Name'}
                        </label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="e.g., Employee Survey, Sales Report"
                            className="w-full glass-input text-lg font-medium"
                        />
                    </div>

                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <motion.div
                                key={field.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-white/50 rounded-xl border border-white/60 shadow-sm flex flex-col gap-4"
                            >
                                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                                    <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                                        #{index + 1}
                                    </div>

                                    <div className="flex-1 w-full">
                                        <input
                                            type="text"
                                            value={field.name}
                                            onChange={(e) => updateField(field.id, { name: e.target.value })}
                                            placeholder="Field Name"
                                            className="w-full glass-input"
                                        />
                                    </div>

                                    <div className="w-full md:w-48">
                                        <div className="relative">
                                            <select
                                                value={field.type}
                                                onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                                                className="w-full glass-input !pl-12 appearance-none"
                                            >
                                                <option value="text">Text</option>
                                                <option value="number">Number</option>
                                                <option value="decimal">Decimal</option>
                                                <option value="date">Date</option>
                                                <option value="time">Time</option>
                                                <option value="dropdown">Dropdown</option>
                                            </select>
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                                {getIconForType(field.type)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            Required
                                        </label>

                                        <button
                                            onClick={() => removeField(field.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove Field"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {field.type === 'dropdown' && (
                                    <div className="w-full pl-0 md:pl-8">
                                        <input
                                            type="text"
                                            placeholder="Options (comma separated, e.g. Red, Green, Blue)"
                                            value={field.options?.join(', ') || ''}
                                            onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                                            className="w-full glass-input text-sm bg-indigo-50/30 border-indigo-100"
                                        />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    <button
                        onClick={addField}
                        className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                        <Plus size={20} />
                        Add Field
                    </button>
                </div>

                {/* Existing Forms List */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-6 sticky top-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <List className="text-indigo-600" />
                            Existing Forms
                        </h3>

                        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                            {existingForms.length === 0 ? (
                                <p className="text-slate-500 text-sm text-center py-4">No forms created yet.</p>
                            ) : (
                                existingForms.map(form => (
                                    <div
                                        key={form.id}
                                        className={`p-3 rounded-lg border transition-all ${editingFormId === form.id
                                                ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                                                : 'bg-white/40 border-white/50 hover:bg-white/60'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-slate-700 truncate pr-2">{form.name}</h4>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEditForm(form)}
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
                                                    title="Edit Form"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteForm(form.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                                                    title="Delete Form"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 flex gap-2">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded-full">
                                                {form.fields.length} fields
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
