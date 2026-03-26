import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Trash2, Upload, FileText, Calendar, User, Eye, Minimize2 } from 'lucide-react';

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
    const [filter, setFilter] = useState<'all' | Document['documentType']>('all');
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const DOC_TYPES = {
        'clinical_history': { label: 'Historia Clínica', color: 'bg-blue-100 text-blue-800', icon: '📋' },
        'diagnosis': { label: 'Diagnóstico', color: 'bg-red-100 text-red-800', icon: '🔍' },
        'treatment_plan': { label: 'Plan de Tratamiento', color: 'bg-green-100 text-green-800', icon: '📝' },
        'report': { label: 'Reporte', color: 'bg-purple-100 text-purple-800', icon: '📊' },
        'prescription': { label: 'Prescripción', color: 'bg-yellow-100 text-yellow-800', icon: '💊' },
        'invoice': { label: 'Factura', color: 'bg-slate-100 text-slate-800', icon: '🧾' },
        'other': { label: 'Otro', color: 'bg-gray-100 text-gray-800', icon: '📄' }
    };

    // Mock data - In production this would come from API
    useEffect(() => {
        if (isOpen && patientId) {
            loadDocuments();
        }
    }, [isOpen, patientId]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            // Simulating API call with mock data
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
                },
                {
                    id: 'doc-3',
                    patientId,
                    fileName: 'Plan_Tratamiento_2024.pdf',
                    documentType: 'treatment_plan',
                    fileSize: 3145728,
                    uploadDate: '2024-12-21',
                    createdBy: 'Dr. García'
                }
            ];
            setDocuments(mockDocuments);
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (doc: Document) => {
        // In production: fetch actual file from backend
        const link = document.createElement('a');
        link.href = `#`;
        link.download = doc.fileName;
        // For demo, show alert
        alert(`📥 Descargando: ${doc.fileName}\n\n(En producción, se descargaría desde el servidor)`);
    };

    const handleFileInput = (files: FileList) => {
        if (files.length === 0) return;

        Array.from(files).forEach((file) => {
            // Validate file type and size
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

            if (file.size > maxSize) {
                alert(`❌ El archivo ${file.name} es demasiado grande (máx. 10MB)`);
                return;
            }

            if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
                alert(`❌ Tipo de archivo no permitido: ${file.type}`);
                return;
            }

            // Create a new document entry
            const newDoc: Document = {
                id: `doc-${Date.now()}-${Math.random()}`,
                patientId,
                fileName: file.name,
                documentType: 'other',
                fileSize: file.size,
                uploadDate: new Date().toISOString().split('T')[0],
                createdBy: 'Usuario Sistema',
                description: `Documento subido: ${file.name}`
            };

            // Add to documents list
            setDocuments(prev => [newDoc, ...prev]);
            
            // Trigger callback
            if (onDocumentUploaded) {
                onDocumentUploaded();
            }
        });

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileInput(e.dataTransfer.files);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileInput(e.target.files);
        }
    };

    const handleDelete = async (docId: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este documento?')) {
            try {
                setDocuments(documents.filter(d => d.id !== docId));
                alert('✓ Documento eliminado correctamente');
            } catch (error) {
                alert('Error al eliminar el documento');
            }
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
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={handleUploadClick}
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer group transition-all ${
                                    dragActive
                                        ? 'border-indigo-600 bg-indigo-100 scale-105'
                                        : 'border-indigo-300 bg-indigo-50 hover:border-indigo-500'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    aria-label="Upload documents"
                                />
                                <Upload size={32} className="text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                                <p className="text-sm font-bold text-slate-900">Arrastra documentos aquí o haz clic para subir</p>
                                <p className="text-xs text-slate-500 mt-1">PDF, DOC, DOCX (máx. 10MB)</p>
                                {uploading && <p className="text-xs text-indigo-600 mt-2 font-semibold">⏳ Subiendo...</p>}
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
                                            </div>

                                            <h3 className="font-bold text-sm text-slate-900 line-clamp-2 mb-2">{doc.fileName}</h3>

                                            <p className={`inline-block px-2 py-1 rounded text-xs font-bold mb-3 ${DOC_TYPES[doc.documentType].color}`}>
                                                {DOC_TYPES[doc.documentType].label}
                                            </p>

                                            <div className="space-y-1 text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} />
                                                    <span>{new Date(doc.uploadDate).toLocaleDateString('es-ES')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <User size={14} />
                                                    <span>{doc.createdBy}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <FileText size={14} />
                                                    <span>{formatFileSize(doc.fileSize)}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center justify-between">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDownload(doc);
                                                    }}
                                                    className="flex-1 text-xs bg-slate-100 text-slate-600 py-2 rounded-lg hover:bg-slate-200 transition-colors font-bold flex items-center justify-center gap-1"
                                                >
                                                    <Download size={12} /> Descargar
                                                </button>
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
