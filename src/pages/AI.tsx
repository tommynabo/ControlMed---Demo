import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Activity, Send, Plus, Trash2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

// === Types ===
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface Conversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
}

// === SessionStorage persistence ===
const CONVERSATIONS_KEY = 'crm_ai_conversations';
const ACTIVE_CONV_KEY = 'crm_ai_active_conversation';

const loadConversations = (): Conversation[] => {
    try {
        const raw = sessionStorage.getItem(CONVERSATIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveConversations = (convs: Conversation[]) => {
    try {
        sessionStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
    } catch (e) {
        console.warn('[AI] Error saving conversations:', e);
    }
};

const getActiveConvId = (): string | null => {
    try {
        return sessionStorage.getItem(ACTIVE_CONV_KEY);
    } catch {
        return null;
    }
};

const setActiveConvId = (id: string) => {
    try {
        sessionStorage.setItem(ACTIVE_CONV_KEY, id);
    } catch { }
};

// === Simple Markdown renderer ===
const renderMarkdown = (text: string): string => {
    if (!text) return '';
    let html = text
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n/g, '<br/>')
        // List items (- item)
        .replace(/(^|<br\/>)\s*-\s+(.+?)(?=<br\/>|$)/g, '$1<span class="flex gap-2 items-start"><span class="text-blue-500 mt-0.5">•</span><span>$2</span></span>')
        // Numbered lists (1. item)
        .replace(/(^|<br\/>)\s*(\d+)\.\s+(.+?)(?=<br\/>|$)/g, '$1<span class="flex gap-2 items-start"><span class="text-blue-500 font-bold mt-0.5">$2.</span><span>$3</span></span>');
    return html;
};

// === Generate title from first user message ===
const generateTitle = (msg: string): string => {
    const clean = msg.replace(/\n/g, ' ').trim();
    return clean.length > 45 ? clean.substring(0, 42) + '...' : clean;
};

const AI: React.FC = () => {
    const { api, selectedPatient, refreshAppointments, refreshPatients } = useAppContext();

    // Conversations state
    const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
    const [activeConversationId, setActiveConversationId] = useState<string | null>(() => getActiveConvId());
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Chat state
    const [aiInput, setAiInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Get active conversation
    const activeConversation = conversations.find(c => c.id === activeConversationId) || null;
    const chatHistory = activeConversation?.messages || [];

    // Auto-scroll on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory.length, isProcessing]);

    // Persist conversations to sessionStorage whenever they change
    useEffect(() => {
        saveConversations(conversations);
    }, [conversations]);

    // Persist active conversation ID
    useEffect(() => {
        if (activeConversationId) {
            setActiveConvId(activeConversationId);
        }
    }, [activeConversationId]);

    // === Actions ===
    const createNewConversation = () => {
        const newConv: Conversation = {
            id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            title: 'Nueva conversación',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        setAiInput('');
    };

    const deleteConversation = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
            const remaining = conversations.filter(c => c.id !== id);
            setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    const selectConversation = (id: string) => {
        setActiveConversationId(id);
        setAiInput('');
    };

    const updateConversation = (id: string, messages: ChatMessage[], title?: string) => {
        setConversations(prev => prev.map(c =>
            c.id === id
                ? { ...c, messages, updatedAt: Date.now(), ...(title ? { title } : {}) }
                : c
        ));
    };

    // === Send Message ===
    const handleAiQuery = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!aiInput.trim() || isProcessing) return;

        // Ensure we have an active conversation
        let convId = activeConversationId;
        if (!convId) {
            const newConv: Conversation = {
                id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                title: 'Nueva conversación',
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            setConversations(prev => [newConv, ...prev]);
            convId = newConv.id;
            setActiveConversationId(convId);
        }

        const userMsg: ChatMessage = { role: 'user', content: aiInput.trim(), timestamp: Date.now() };
        const currentMessages = [...(conversations.find(c => c.id === convId)?.messages || []), userMsg];

        // Generate title from first user message
        const isFirst = currentMessages.filter(m => m.role === 'user').length === 1;
        const title = isFirst ? generateTitle(aiInput.trim()) : undefined;

        updateConversation(convId, currentMessages, title);
        setAiInput('');
        setIsProcessing(true);

        try {
            const response = await api.ai.query(aiInput.trim(), undefined, {
                chatHistory: currentMessages.slice(-12).map(m => ({ role: m.role, content: m.content })),
                patientId: selectedPatient?.id,
                patientName: selectedPatient?.name
            });

            const content = response.content || response.answer || JSON.stringify(response);
            const assistantMsg: ChatMessage = { role: 'assistant', content, timestamp: Date.now() };
            const updatedMessages = [...currentMessages, assistantMsg];
            updateConversation(convId, updatedMessages);

            // Refresh global state when AI performed a mutation (budget, appointment, record, etc.)
            if (response.type === 'action_completed') {
                refreshAppointments();
                refreshPatients();
            }
        } catch (error) {
            const errorMsg: ChatMessage = { role: 'assistant', content: "Lo siento, hubo un error al procesar tu consulta.", timestamp: Date.now() };
            updateConversation(convId, [...currentMessages, errorMsg]);
        } finally {
            setIsProcessing(false);
        }
    };

    // === Format time ===
    const formatTime = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Hoy';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="h-full flex animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out bg-slate-900 flex flex-col overflow-hidden relative flex-shrink-0`}>
                {sidebarOpen && (
                    <>
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-slate-700/50">
                            <button
                                onClick={createNewConversation}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-900/30"
                            >
                                <Plus size={16} /> Nueva Conversación
                            </button>
                        </div>

                        {/* Conversation List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {conversations.length === 0 ? (
                                <div className="text-center py-12 px-4">
                                    <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-xs text-slate-500 font-medium">Sin conversaciones</p>
                                    <p className="text-[10px] text-slate-600 mt-1">Haz clic en "Nueva Conversación"</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <button
                                        key={conv.id}
                                        onClick={() => selectConversation(conv.id)}
                                        className={`w-full text-left px-3 py-3 rounded-xl transition-all group flex items-start gap-3 ${conv.id === activeConversationId
                                                ? 'bg-blue-600/20 text-white border border-blue-500/30'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            }`}
                                    >
                                        <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-slate-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate">{conv.title}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatDate(conv.updatedAt)} • {conv.messages.length} msgs
                                            </p>
                                        </div>
                                        <button
                                            onClick={(e) => deleteConversation(conv.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all flex-shrink-0"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </button>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Toggle sidebar button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-slate-800 hover:bg-slate-700 text-slate-400 p-1.5 rounded-r-lg transition-all"
                style={{ left: sidebarOpen ? '288px' : '0px' }}
            >
                {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 flex flex-col bg-white rounded-tl-3xl shadow-xl border-l border-slate-200 overflow-hidden">
                    {/* Header */}
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center bg-slate-900 text-white gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <MessageSquare size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black uppercase tracking-widest">ControlMed AI</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">
                                {activeConversation ? activeConversation.title : 'Asistente Cognitivo'}
                                {selectedPatient && ` • Paciente: ${selectedPatient.name}`}
                            </p>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar bg-slate-50/30">
                        {chatHistory.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-10 text-slate-900">
                                <Activity size={80} className="mb-6" />
                                <p className="text-xs font-black uppercase tracking-[0.5em]">MediBot Esperando Consulta</p>
                            </div>
                        )}
                        {chatHistory.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[80%] relative group ${m.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-[1.5rem] rounded-tr-sm px-5 py-4'
                                        : 'bg-white border border-slate-200 text-slate-800 rounded-[1.5rem] rounded-tl-sm px-5 py-4 shadow-sm'
                                    }`}>
                                    {m.role === 'assistant' ? (
                                        <div
                                            className="text-[13px] font-medium leading-relaxed ai-markdown"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                                        />
                                    ) : (
                                        <p className="text-[13px] font-bold leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                    )}
                                    <span className={`text-[9px] mt-2 block ${m.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                                        {formatTime(m.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {isProcessing && (
                            <div className="flex justify-start animate-in slide-in-from-bottom-2">
                                <div className="bg-white border border-slate-200 px-5 py-4 rounded-[1.5rem] rounded-tl-sm shadow-sm">
                                    <div className="flex gap-1.5">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleAiQuery} className="p-5 bg-white border-t border-slate-100 flex gap-3">
                        <textarea
                            ref={textareaRef}
                            value={aiInput}
                            onChange={e => {
                                setAiInput(e.target.value);
                                // Auto-resize
                                if (textareaRef.current) {
                                    textareaRef.current.style.height = 'auto';
                                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
                                }
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAiQuery(e);
                                }
                            }}
                            placeholder="Ej: Agenda una cita para mañana... (Enter para enviar)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all resize-none min-h-[52px] max-h-[180px] overflow-y-auto"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={isProcessing || !aiInput.trim()}
                            className="bg-blue-600 text-white px-6 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:shadow-none self-end h-[52px] flex-shrink-0"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AI;
