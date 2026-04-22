import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
    X, Save, Printer, Bold, Italic, UnderlineIcon, List, ListOrdered,
    AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Minus
} from 'lucide-react';
import { DocumentTemplate } from '../../types';

interface TemplateEditorModalProps {
    template: DocumentTemplate | null; // null = new template
    onSave: (data: { id?: string; title: string; category: string; content: string }) => Promise<void>;
    onClose: () => void;
}

const CATEGORIES = [
    'Consentimiento Informado',
    'General',
    'Médico',
    'Privacidad',
    'Financiero',
    'Quirúrgico',
    'Periodontal',
    'Endodóntico',
    'Ortodóncico',
    'Implantología',
    'Biomateriales',
    'Otro',
];

const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({ template, onSave, onClose }) => {
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('General');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[400px] p-4 text-sm text-gray-800',
            },
        },
    });

    // Populate form when template changes
    useEffect(() => {
        if (template) {
            setTitle(template.title || (template as any).name || '');
            setCategory(template.category || 'General');
            if (editor && template.content) {
                editor.commands.setContent(template.content);
            }
        } else {
            setTitle('');
            setCategory('General');
            if (editor) {
                editor.commands.setContent('');
            }
        }
    }, [template, editor]);

    const handleSave = async () => {
        if (!title.trim()) {
            setSaveError('El título es obligatorio');
            return;
        }
        setIsSaving(true);
        setSaveError(null);
        try {
            const content = editor?.getHTML() || '';
            await onSave({
                id: template?.id,
                title: title.trim(),
                category,
                content,
            });
            onClose();
        } catch (err: any) {
            setSaveError(err.message || 'Error al guardar la plantilla');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = useCallback(() => {
        const content = editor?.getHTML() || '';
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 40px; color: #000; }
    h1, h2, h3 { color: #1a1a1a; }
    p { margin: 0.5em 0; }
    @media print {
      body { margin: 20mm; }
      @page { size: A4; margin: 20mm; }
    }
  </style>
</head>
<body>
  <h2 style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">${title}</h2>
  ${content}
  <div style="margin-top:60px; display:flex; justify-content:space-between;">
    <div style="text-align:center;">
      <div style="border-top:1px solid #333; width:200px; padding-top:5px;">Firma del Paciente</div>
    </div>
    <div style="text-align:center;">
      <div style="border-top:1px solid #333; width:200px; padding-top:5px;">Firma del Profesional</div>
    </div>
  </div>
</body>
</html>`);
        win.document.close();
        setTimeout(() => {
            win.focus();
            win.print();
        }, 400);
    }, [editor, title]);

    if (!editor) return null;

    const ToolbarButton: React.FC<{
        onClick: () => void;
        active?: boolean;
        title: string;
        children: React.ReactNode;
    }> = ({ onClick, active, title: btnTitle, children }) => (
        <button
            type="button"
            title={btnTitle}
            onClick={onClick}
            className={`p-1.5 rounded text-sm transition-colors ${
                active
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {template ? 'Editar Plantilla' : 'Nueva Plantilla'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Metadata row */}
                <div className="px-6 py-3 border-b border-gray-100 flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nombre de la plantilla..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="w-56">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1 bg-gray-50">
                    <ToolbarButton
                        title="Negrita"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        active={editor.isActive('bold')}
                    >
                        <Bold size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Cursiva"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        active={editor.isActive('italic')}
                    >
                        <Italic size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Subrayado"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        active={editor.isActive('underline')}
                    >
                        <UnderlineIcon size={15} />
                    </ToolbarButton>

                    <div className="w-px bg-gray-300 mx-1 self-stretch" />

                    <ToolbarButton
                        title="Título 1"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        active={editor.isActive('heading', { level: 1 })}
                    >
                        <Heading1 size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Título 2"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        active={editor.isActive('heading', { level: 2 })}
                    >
                        <Heading2 size={15} />
                    </ToolbarButton>

                    <div className="w-px bg-gray-300 mx-1 self-stretch" />

                    <ToolbarButton
                        title="Lista sin orden"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        active={editor.isActive('bulletList')}
                    >
                        <List size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Lista numerada"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        active={editor.isActive('orderedList')}
                    >
                        <ListOrdered size={15} />
                    </ToolbarButton>

                    <div className="w-px bg-gray-300 mx-1 self-stretch" />

                    <ToolbarButton
                        title="Alinear izquierda"
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        active={editor.isActive({ textAlign: 'left' })}
                    >
                        <AlignLeft size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Centrar"
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        active={editor.isActive({ textAlign: 'center' })}
                    >
                        <AlignCenter size={15} />
                    </ToolbarButton>
                    <ToolbarButton
                        title="Alinear derecha"
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        active={editor.isActive({ textAlign: 'right' })}
                    >
                        <AlignRight size={15} />
                    </ToolbarButton>

                    <div className="w-px bg-gray-300 mx-1 self-stretch" />

                    <ToolbarButton
                        title="Línea horizontal"
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    >
                        <Minus size={15} />
                    </ToolbarButton>
                </div>

                {/* Editor area */}
                <div className="flex-1 overflow-y-auto border-b border-gray-100">
                    <EditorContent editor={editor} />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex items-center justify-between gap-3">
                    {saveError && (
                        <p className="text-sm text-red-600">{saveError}</p>
                    )}
                    {!saveError && <div />}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <Printer size={16} />
                            Imprimir
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                            <Save size={16} />
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditorModal;
