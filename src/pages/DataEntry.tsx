import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Save, Download, Upload, Pencil, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

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

export default function DataEntry() {
    const { currentUser, userRole } = useAuth();
    const { showToast } = useToast();
    const [forms, setForms] = useState<FormSchema[]>([]);
    const [selectedForm, setSelectedForm] = useState<FormSchema | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Refs for managing focus navigation
    const inputRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([]);

    useEffect(() => {
        const fetchForms = async () => {
            const q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setForms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FormSchema)));
        };
        fetchForms();
    }, []);

    useEffect(() => {
        if (selectedForm) {
            fetchSubmissions(selectedForm.id);
            setFormData({});
            setEditingId(null);
            // Reset refs array
            inputRefs.current = inputRefs.current.slice(0, selectedForm.fields.length);
        }
    }, [selectedForm]);

    const fetchSubmissions = async (formId: string) => {
        setLoading(true);
        try {
            const q = query(collection(db, 'submissions'), where('formId', '==', formId), orderBy('submittedAt', 'desc'));
            const snapshot = await getDocs(q);
            setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error fetching submissions:", error);
            showToast("Failed to fetch submissions", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (fieldName: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // If it's the last field, submit
            if (index === (selectedForm?.fields.length || 0) - 1) {
                handleSubmit();
            } else {
                // Move to next field
                inputRefs.current[index + 1]?.focus();
            }
        } else if (e.key === 'ArrowRight') {
            if (index < (selectedForm?.fields.length || 0) - 1) {
                inputRefs.current[index + 1]?.focus();
            }
        } else if (e.key === 'ArrowLeft') {
            if (index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedForm) return;

        // Basic validation
        const missingRequired = selectedForm.fields.some(f => f.required && !formData[f.name]);
        if (missingRequired) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const submissionData = {
                formId: selectedForm.id,
                formName: selectedForm.name,
                data: formData,
                submittedBy: currentUser?.uid,
                submittedAt: serverTimestamp()
            };

            if (editingId) {
                // Update existing document
                const docRef = doc(db, 'submissions', editingId);
                await updateDoc(docRef, {
                    data: formData,
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser?.uid
                });

                setSubmissions(prev => prev.map(sub =>
                    sub.id === editingId ? { ...sub, data: formData } : sub
                ));
                showToast('Entry updated successfully', 'success');
                setEditingId(null);
            } else {
                // Create new document
                const docRef = await addDoc(collection(db, 'submissions'), submissionData);

                // Optimistic update (Ghost effect)
                setSubmissions(prev => [{
                    id: docRef.id,
                    ...submissionData,
                    submittedAt: { toDate: () => new Date() } // Mock timestamp for immediate display
                }, ...prev]);
                showToast('Entry added successfully', 'success');
            }

            setFormData({});
            // Focus back to first input
            inputRefs.current[0]?.focus();
        } catch (error) {
            console.error("Error submitting data:", error);
            showToast('Failed to save data', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadTemplate = () => {
        if (!selectedForm) return;

        const headers = selectedForm.fields.map(f => f.name);
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, `${selectedForm.name}_template.xlsx`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !selectedForm) return;

        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                // cellDates: true converts Excel serial dates to JS Date objects
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    showToast("The uploaded file is empty.", "error");
                    return;
                }

                setLoading(true);
                let successCount = 0;
                let errorCount = 0;

                const batchSize = 400;
                for (let i = 0; i < data.length; i += batchSize) {
                    const chunk = data.slice(i, i + batchSize);

                    const promises = chunk.map(async (row: any) => {
                        // Process and Validate Row
                        const processedRow: any = { ...row };

                        // Format dates and times
                        selectedForm.fields.forEach(field => {
                            if (processedRow[field.name] instanceof Date) {
                                const dateVal = processedRow[field.name] as Date;

                                // Add 12 hours to avoid timezone issues pushing date back one day
                                // This is a safe buffer since Excel dates usually default to midnight
                                dateVal.setHours(dateVal.getHours() + 12);

                                if (field.type === 'date') {
                                    // Format as YYYY-MM-DD
                                    const year = dateVal.getFullYear();
                                    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
                                    const day = String(dateVal.getDate()).padStart(2, '0');
                                    processedRow[field.name] = `${year}-${month}-${day}`;
                                } else if (field.type === 'time') {
                                    // Format as HH:mm
                                    // Re-get original date for time fields to be precise (undo the 12h add if needed, 
                                    // but actually the 12h add helps avoid negative date shift if time is close to 00:00 in some TZs?
                                    // No, for time we just want HH:mm. 
                                    // If we added 12h, the hours will be shifted. We MUST undo it or use a copy.

                                    // Let's use the original value from the row again to be safe for time
                                    const originalDate = row[field.name] as Date;
                                    const hours = String(originalDate.getHours()).padStart(2, '0');
                                    const minutes = String(originalDate.getMinutes()).padStart(2, '0');
                                    processedRow[field.name] = `${hours}:${minutes}`;
                                }
                            }
                        });

                        const missingRequired = selectedForm.fields.some(f => f.required && (processedRow[f.name] === undefined || processedRow[f.name] === null || processedRow[f.name] === ''));

                        if (missingRequired) {
                            errorCount++;
                            return;
                        }

                        const newSubmission = {
                            formId: selectedForm.id,
                            formName: selectedForm.name,
                            data: processedRow,
                            submittedBy: currentUser?.uid,
                            submittedAt: serverTimestamp()
                        };

                        try {
                            await addDoc(collection(db, 'submissions'), newSubmission);
                            successCount++;
                        } catch (err) {
                            console.error("Error uploading row:", err);
                            errorCount++;
                        }
                    });

                    await Promise.all(promises);
                }

                showToast(`Upload complete. Success: ${successCount}, Errors: ${errorCount}`, successCount > 0 ? 'success' : 'error');
                fetchSubmissions(selectedForm.id);

            } catch (error) {
                console.error("Error parsing file:", error);
                showToast("Failed to parse Excel file.", "error");
            } finally {
                setLoading(false);
                // Reset file input
                e.target.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this entry?')) return;

        try {
            await deleteDoc(doc(db, 'submissions', id));
            setSubmissions(prev => prev.filter(sub => sub.id !== id));
            showToast('Entry deleted successfully', 'success');
            if (editingId === id) {
                setEditingId(null);
                setFormData({});
            }
        } catch (error) {
            console.error("Error deleting document:", error);
            showToast('Failed to delete entry', 'error');
        }
    };

    const handleEdit = (submission: any) => {
        setFormData(submission.data);
        setEditingId(submission.id);
        // Focus first input
        inputRefs.current[0]?.focus();
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({});
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800">Data Entry</h2>
            </div>

            <div className="glass-panel p-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between shrink-0">
                <div className="w-full md:w-1/3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Select Form</label>
                    <select
                        className="w-full glass-input"
                        onChange={(e) => setSelectedForm(forms.find(f => f.id === e.target.value) || null)}
                        value={selectedForm?.id || ''}
                    >
                        <option value="">-- Choose a Form --</option>
                        {forms.map(form => (
                            <option key={form.id} value={form.id}>{form.name}</option>
                        ))}
                    </select>
                </div>

                {selectedForm && (
                    <div className="flex gap-4">
                        <button
                            onClick={handleDownloadTemplate}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Download size={18} />
                            <span>Download Template</span>
                        </button>
                        <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md cursor-pointer whitespace-nowrap">
                            <Upload size={18} />
                            <span>Upload Mass Data</span>
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>
                )}
            </div>

            {selectedForm && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-0 overflow-hidden flex-1 flex flex-col min-h-0"
                >
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse relative">
                            <thead className="bg-indigo-50/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                                <tr className="border-b border-indigo-100 text-indigo-900 text-sm font-semibold">
                                    {selectedForm.fields.map(field => (
                                        <th key={field.id} className="p-4 whitespace-nowrap min-w-[150px]">
                                            {field.name} {field.required && <span className="text-red-500">*</span>}
                                        </th>
                                    ))}
                                    <th className="p-4 w-32 text-center sticky right-0 bg-indigo-50/95 backdrop-blur-sm z-20">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700 text-sm">
                                {/* Input Row (Top) - Sticky below header */}
                                <tr className={`border-b-2 border-indigo-100 shadow-sm sticky top-[53px] z-10 ${editingId ? 'bg-amber-50' : 'bg-white'}`}>
                                    {selectedForm.fields.map((field, index) => (
                                        <td key={field.id} className="p-2">
                                            {field.type === 'dropdown' ? (
                                                <select
                                                    ref={el => { inputRefs.current[index] = el }}
                                                    className="w-full glass-input text-sm py-1 px-2 h-10"
                                                    value={formData[field.name] || ''}
                                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                                >
                                                    <option value="">Select...</option>
                                                    {field.options?.map(opt => (
                                                        <option key={opt} value={opt.trim()}>{opt.trim()}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    ref={el => { inputRefs.current[index] = el }}
                                                    type={field.type === 'decimal' ? 'number' : field.type}
                                                    step={field.type === 'decimal' ? '0.01' : undefined}
                                                    className="w-full glass-input text-sm py-1 px-2 h-10"
                                                    value={formData[field.name] || ''}
                                                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                                    placeholder={`Enter ${field.name}`}
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td className="p-2 text-center sticky right-0 bg-inherit z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleSubmit()}
                                                disabled={submitting}
                                                className={`p-2 text-white rounded-lg transition-colors shadow-md ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                                title={editingId ? "Update Entry" : "Save Entry (Enter)"}
                                            >
                                                <Save size={18} />
                                            </button>
                                            {editingId && (
                                                <button
                                                    onClick={cancelEdit}
                                                    className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors shadow-sm"
                                                    title="Cancel Edit"
                                                >
                                                    <X size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>

                                {/* History Rows */}
                                {loading ? (
                                    <tr><td colSpan={selectedForm.fields.length + 1} className="p-8 text-center text-slate-500">Loading history...</td></tr>
                                ) : submissions.map((sub, idx) => (
                                    <motion.tr
                                        key={sub.id}
                                        initial={idx === 0 ? { opacity: 0, backgroundColor: "#e0e7ff" } : {}}
                                        animate={{
                                            opacity: 1,
                                            backgroundColor: sub.id === editingId ? "#fffbeb" : "rgba(224, 231, 255, 0)"
                                        }}
                                        transition={{ duration: 0.5 }}
                                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                                    >
                                        {selectedForm.fields.map(field => (
                                            <td key={field.id} className="p-4 whitespace-nowrap">
                                                {sub.data[field.name]?.toString() || '-'}
                                            </td>
                                        ))}
                                        <td className="p-4 text-center sticky right-0 bg-white/50 backdrop-blur-[1px] z-0 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                            {userRole === 'admin' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEdit(sub)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(sub.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">
                                                    {sub.submittedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}

                                {!loading && submissions.length === 0 && (
                                    <tr>
                                        <td colSpan={selectedForm.fields.length + 1} className="p-8 text-center text-slate-400 italic">
                                            No entries yet. Start typing above!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
