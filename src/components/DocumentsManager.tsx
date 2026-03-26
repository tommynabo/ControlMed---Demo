import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Trash2, Upload, FileText, Calendar, User, AlertCircle, Check } from 'lucide-react';

interface Document {
    id: string;
    patientId: string;
    fileName: string;
    documentType: 'clinical_history' | 'diagnosis' | 'treatment_plan' | 'report' | 'prescription' | 'invoice' | 'other';
    fileSize: number;
    uploadDate: string;
    createdBy: string;
    description?: string;
}

interface DocumentsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    patientName: string;
    patientId: string;
    onDocumentUploaded?: () => void;
}

export const DocumentsManager: React.FC<DocumentsManagerProps> = ({
    isOpen,
    onClose,
    patientName,
    patientId,
    onDocumentUploaded
}) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [filter, setFilter] = useState<'all' | Document['documentType']>('all');
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedDocType, setSelectedDocType] = useState<Document['documentType']>('other');

    const DOC_TYPES = {
        'clinical_history': { label: 'Historia Clínica', color: 'bg-blue-100 text-blue-800', icon: '📋' },
        'diagnosis': { label: 'Diagnóstico', color: 'bg-red-100 text-red-800', icon: '🔍' },
        'treatment_plan': { label: 'Plan de Tratamiento', color: 'bg-green-100 text-green-800', icon: '📝' },
        'report': { label: 'Reporte', color: 'bg-purple-100 text-purple-800', icon: '📊' },
        'prescription': { label: 'Prescripción', color: 'bg-yellow-100 text-yellow-800', icon: '💊' },
        'invoice': { label: 'Factura', color: 'bg-slate-100 text-slate-800', icon: '🧾' },
        'other': { label: 'Otro', color: 'bg-gray-100 text-gray-800', icon: '📄' }
    };

    useEffect(() => {
        if (isOpen && patientId) {
            loadDocuments();
        }
    }, [isOpen, patientId]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            // Mock data - reemplazar con API call real
            const mockDocuments: Document[] = [
                {
                    id: 'doc-1',
                    patientId,
                    fileName: 'Historia_Clinica_Completa.pdf',
                    documentType: 'clinical_history',
                    fileSize: 2048576,
                    uploadDate: '2024-12-15',
                    createdBy: 'Dr. García',
                    description: 'Historia clínica completa del paciente'
                },
                {
                    id: 'doc-2',
                    patientId,
                    fileName: 'Diagnostico_Caries.pdf',
                    documentType: 'diagnosis',
                    fileSize: 1024576,
                    uploadDate: '2024-12-20',
                    createdBy: 'Dr. López',
                    description: 'Diagnóstico de caries múltiples'
                }
            ];
            setDocuments(mockDocuments);
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];

        // Validaciones
        if (file.size > 10 * 1024 * 1024) {
            alert('⚠️ El archivo es demasiado grande. Máximo 10MB.');
            return;
        }

        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            alert('⚠️ Solo se permiten archivos PDF, DOC y DOCX.');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('patientId', patientId);
            formData.append('documentType', selectedDocType);

            // Simular progreso
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 30;
                if (progress > 90) progress = 90;
                setUploadProgress(Math.floor(progress));
            }, 200);

            // Hacer upload real (reemplazar con tu endpoint)
            const res = await fetch(`/api/patients/${patientId}/documents`, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!res.ok) throw new Error('Error uploading document');

            const newDoc = await res.json();
            setDocuments(prev => [newDoc, ...prev]);

            setTimeout(() => {
                setUploading(false);
                setUploadProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
                onDocumentUploaded?.();
                alert('✅ Documento subido correctamente');
            }, 500);
        } catch (error) {
            console.error('Error uploading document:', error);
            alert('❌ Error al subir el documento. Intenta de nuevo.');
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDownload = async (doc: Document) => {
        try {
            const res = await fetch(`/api/patients/${patientId}/documents/${doc.id}/download`);
            if (!res.ok) throw new Error('Error downloading document');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = doc.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert('❌ Error descargando el documento');
        }
    };

    const handleDelete = async (docId: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este documento?')) return;

        try {
            const res = await fetch(`/api/patients/${patientId}/documents/${docId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Error deleting document');
            setDocuments(documents.filter(d => d.id !== docId));
            setSelectedDoc(null);
            alert('✅ Documento eliminado correctamente');
        } catch (error) {
            alert('❌ Error al eliminar el documento');
        }
    };

    const filteredDocuments = filter === 'all'
        ? documents
        : documents.filter(d => d.documentType === filter);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Gestión de Documentos</h2>
                        <p className="text-sm text-purple-100 mt-1">📋 {patientName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {selectedDoc ? (
                        // DETAIL VIEW
                        <div className="space-y-6">
                            <button
                                onClick={() => setSelectedDoc(null)}
                                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                ← Volver
                            </button>

                            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-8 space-y-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-6xl">{DOC_TYPES[selectedDoc.documentType].icon}</span>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900">{selectedDoc.fileName}</h3>
                                            <p className={`inline-block px-3 py-1 rounded-lg text-xs font-bold mt-2 ${DOC_TYPES[selectedDoc.documentType].color}`}>
                                                {DOC_TYPES[selectedDoc.documentType].label}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 bg-white p-6 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📦</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold">Tamaño</p>
                                            <p className="text-lg font-bold text-slate-900">{formatFileSize(selectedDoc.fileSize)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📅</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold">Fecha</p>
                                            <p className="text-lg font-bold text-slate-900">{new Date(selectedDoc.uploadDate).toLocaleDateString('es-ES')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">👤</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold">Subido por</p>
                                            <p className="text-lg font-bold text-slate-900">{selectedDoc.createdBy}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">🏥</span>
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase font-bold">Paciente</p>
                                            <p className="text-lg font-bold text-slate-900">{patientName}</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedDoc.description && (
                                    <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                                        <p className="text-xs text-indigo-600 uppercase font-bold mb-2">Descripción</p>
                                        <p className="text-slate-700">{selectedDoc.description}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => handleDownload(selectedDoc)}
                                        className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                                    >
                                        <Download size={18} /> Descargar
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleDelete(selectedDoc.id);
                                        }}
                                        className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                                    >
                                        <Trash2 size={18} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // LIST VIEW
                        <div className="space-y-6">
                            {/* Filter Tabs */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        filter === 'all'
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({documents.length})
                                </button>
                                {(Object.keys(DOC_TYPES) as Array<Document['documentType']>).map(type => {
                                    const count = documents.filter(d => d.documentType === type).length;
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => setFilter(type)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                                filter === type
                                                    ? 'bg-indigo-600 text-white shadow-lg'
                                                    : count === 0 ? 'opacity-30 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                            disabled={count === 0}
                                        >
                                            {DOC_TYPES[type].label} ({count})
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Upload Section */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                                    dragOver
                                        ? 'border-indigo-600 bg-indigo-100 scale-105'
                                        : 'border-indigo-300 bg-indigo-50 hover:border-indigo-500'
                                }`}
                            >
                                <Upload size={40} className="text-indigo-600 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-900">
                                    {dragOver ? 'Suelta el archivo aquí' : 'Arrastra documentos aquí o haz clic'}
                                </p>
                                <p className="text-xs text-slate-500 mt-2">PDF, DOC, DOCX (máx. 10MB)</p>

                                {/* Document Type Selector */}
                                <div className="mt-4 inline-block">
                                    <select
                                        value={selectedDocType}
                                        onChange={(e) => setSelectedDocType(e.target.value as Document['documentType'])}
                                        className="px-4 py-2 bg-white border-2 border-indigo-300 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {(Object.keys(DOC_TYPES) as Array<Document['documentType']>).map(type => (
                                            <option key={type} value={type}>
                                                {DOC_TYPES[type].label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                    className="hidden"
                                />
                            </div>

                            {/* Upload Progress */}
                            {uploading && (
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm font-bold text-blue-900">Subiendo documento...</p>
                                        <p className="text-sm font-bold text-blue-600">{uploadProgress}%</p>
                                    </div>
                                    <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Documents Grid */}
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    <p className="text-slate-500 mt-3 font-bold">Cargando documentos...</p>
                                </div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                                    <FileText size={48} className="text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-bold">No hay documentos en esta categoría</p>
                                    <p className="text-xs text-slate-400 mt-1">Sube el primer documento para comenzar</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map(doc => (
                                        <div
                                            key={doc.id}
                                            onClick={() => setSelectedDoc(doc)}
                                            className="border-2 border-slate-200 rounded-xl p-6 hover:border-indigo-400 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group bg-white"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <span className="text-5xl">{DOC_TYPES[doc.documentType].icon}</span>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(doc);
                                                        }}
                                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                        title="Descargar"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('¿Eliminar este documento?')) {
                                                                handleDelete(doc.id);
                                                            }
                                                        }}
                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2">{doc.fileName}</h3>
                                            <p className={`inline-block px-2 py-1 rounded text-xs font-bold ${DOC_TYPES[doc.documentType].color}`}>
                                                {DOC_TYPES[doc.documentType].label}
                                            </p>
                                            <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                                                <p><strong>Tamaño:</strong> {formatFileSize(doc.fileSize)}</p>
                                                <p><strong>Fecha:</strong> {new Date(doc.uploadDate).toLocaleDateString('es-ES')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Documentos Clínicos</h2>
                        <p className="text-sm text-purple-100 mt-1">{patientName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {selectedDoc ? (
                        // Document Detail View
                        <div className="space-y-6">
                            <button
                                onClick={() => setSelectedDoc(null)}
                                className="mb-4 text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                ← Volver
                            </button>

                            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-8 space-y-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-4xl">{DOC_TYPES[selectedDoc.documentType].icon}</span>
                                            <h3 className="text-2xl font-black text-slate-900">{selectedDoc.fileName}</h3>
                                        </div>
                                        <p className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${DOC_TYPES[selectedDoc.documentType].color}`}>
                                            {DOC_TYPES[selectedDoc.documentType].label}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-lg border border-slate-200">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold">Tamaño</p>
                                        <p className="text-lg font-bold text-slate-900">{formatFileSize(selectedDoc.fileSize)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold">Fecha de Carga</p>
                                        <p className="text-lg font-bold text-slate-900">{new Date(selectedDoc.uploadDate).toLocaleDateString('es-ES')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold">Creado por</p>
                                        <p className="text-lg font-bold text-slate-900">{selectedDoc.createdBy}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold">Paciente</p>
                                        <p className="text-lg font-bold text-slate-900">{patientName}</p>
                                    </div>
                                </div>

                                {selectedDoc.description && (
                                    <div className="bg-white p-6 rounded-lg border border-slate-200">
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-2">Descripción</p>
                                        <p className="text-slate-700">{selectedDoc.description}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => handleDownload(selectedDoc)}
                                        className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                                    >
                                        <Download size={16} /> Descargar Documento
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleDelete(selectedDoc.id);
                                            setSelectedDoc(null);
                                        }}
                                        className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                                    >
                                        <Trash2 size={16} /> Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Documents List View
                        <div className="space-y-6">
                            {/* Filter Tabs */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        filter === 'all'
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({documents.length})
                                </button>
                                {(Object.keys(DOC_TYPES) as Array<Document['documentType']>).map(type => {
                                    const count = documents.filter(d => d.documentType === type).length;
                                    return count > 0 ? (
                                        <button
                                            key={type}
                                            onClick={() => setFilter(type)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                                filter === type
                                                    ? 'bg-indigo-600 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {DOC_TYPES[type].label} ({count})
                                        </button>
                                    ) : null;
                                })}
                            </div>

                            {/* Upload Section */}
                            <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer bg-indigo-50 group">
                                <Upload size={32} className="text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-bold text-slate-900">Arrastra documentos aquí o haz clic para subir</p>
                                <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX (máx. 10MB)</p>
                            </div>

                            {/* Documents Grid */}
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    <p className="text-slate-500 mt-2">Cargando documentos...</p>
                                </div>
                            ) : filteredDocuments.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-xl">
                                    <FileText size={48} className="text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No hay documentos disponibles</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredDocuments.map(doc => (
                                        <div
                                            key={doc.id}
                                            onClick={() => setSelectedDoc(doc)}
                                            className="border-2 border-slate-200 rounded-xl p-6 hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group bg-white"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <span className="text-4xl">{DOC_TYPES[doc.documentType].icon}</span>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownload(doc);
                                                        }}
                                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                        title="Descargar"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(doc.id);
                                                        }}
                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>

