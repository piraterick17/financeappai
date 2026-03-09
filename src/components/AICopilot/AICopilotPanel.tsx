import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Trash2, ChevronDown, Mic, MicOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    action?: { function: string; args: any; result: any }; // For function calling context
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

const QUICK_QUESTIONS = [
    '¿Cuál es mi resumen financiero?',
    '¿Cuánto debo en tarjetas?',
    '¿Cuáles son mis gastos más altos del mes?',
    '¿Cuándo termino de pagar mis MSI?',
    '¿Cómo puedo optimizar mis gastos?',
];

function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'es-MX';

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }
                setTranscript(finalTranscript || interimTranscript);
            };

            recognition.onerror = () => {
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }

        return () => {
            recognitionRef.current?.abort();
        };
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            setTranscript('');
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    return { isListening, transcript, isSupported, startListening, stopListening, setTranscript };
}

export function AICopilotPanel() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    const {
        isListening, transcript, isSupported: voiceSupported,
        startListening, stopListening, setTranscript,
    } = useSpeechRecognition();

    // When voice transcript updates, put it in the input
    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    // When voice stops and we have text, auto-send
    const prevListeningRef = useRef(false);
    useEffect(() => {
        if (prevListeningRef.current && !isListening && transcript.trim()) {
            // Voice just stopped with text — send it
            sendMessage(transcript.trim());
            setTranscript('');
        }
        prevListeningRef.current = isListening;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListening]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (messages.length > 0) scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollDown(scrollHeight - scrollTop - clientHeight > 100);
        }
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading || !user) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('No active session');

            const history = messages.map((m) => {
                const entry: { role: string; content: string } = {
                    role: m.role,
                    content: m.content,
                };
                // Include action metadata so the AI knows the transaction_id
                if (m.action?.result?.transaction_id) {
                    entry.content += `\n[SYSTEM: transaction_id=${m.action.result.transaction_id}]`;
                }
                return entry;
            });

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text.trim(),
                    history,
                    accessToken: session.access_token,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                // Handle rate limit with friendly message
                if (res.status === 429) {
                    const retryAfter = data.retryAfter || 60;
                    throw new Error(data.error || `⏳ Límite de consultas alcanzado. Espera ${retryAfter}s.`);
                }
                throw new Error(data.error || 'Error al comunicarse con el asistente');
            }

            const assistantMessage: Message = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: data.reply,
                timestamp: new Date(),
                action: data.action || undefined,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Invalidate context cache if a transaction was modified
            if (data.action?.result?.success) {
                // The cached context on the server will expire in 30s anyway
                // but we could force a refresh on next message
            }
        } catch (err: any) {
            const isRateLimit = err.message?.includes('⏳') || err.message?.includes('cuota') || err.message?.includes('429');
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: isRateLimit
                    ? err.message
                    : `⚠️ Error: ${err.message}. Intenta de nuevo.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    const toggleVoice = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen
                    ? 'bg-surface text-text-muted hover:text-text-main rotate-0'
                    : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-400 hover:to-indigo-500'
                    }`}
                style={{
                    boxShadow: isOpen ? undefined : '0 4px 24px rgba(139, 92, 246, 0.4)',
                }}
            >
                {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </button>

            {/* Chat Panel */}
            <div
                className={`fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] transition-all duration-300 origin-bottom-right ${isOpen
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
                    }`}
            >
                <div className="bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
                    style={{
                        height: 'min(600px, calc(100vh - 160px))',
                        boxShadow: '0 8px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05)',
                    }}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center gap-3 shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm">Asistente Financiero IA</h3>
                            <p className="text-violet-200 text-xs">Pregúntame o usa el micrófono 🎤</p>
                        </div>
                        {messages.length > 0 && (
                            <button
                                onClick={clearChat}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                title="Limpiar chat"
                            >
                                <Trash2 className="w-4 h-4 text-violet-200" />
                            </button>
                        )}
                    </div>

                    {/* Messages */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                                    <Bot className="w-8 h-8 text-violet-400" />
                                </div>
                                <h4 className="text-text-main font-semibold mb-2">¡Hola! 👋</h4>
                                <p className="text-text-muted text-sm mb-6">
                                    Soy tu asistente financiero. Puedo analizar tus gastos, registrar movimientos por ti, y darte recomendaciones. ¡También puedes hablarme por voz! 🎤
                                </p>
                                <div className="w-full space-y-2">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                                        Preguntas sugeridas
                                    </p>
                                    {QUICK_QUESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            className="w-full text-left px-3 py-2.5 rounded-xl bg-background hover:bg-primary/5 border border-border hover:border-primary/30 text-sm text-text-main transition-all duration-200"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md'
                                            : 'bg-background border border-border text-text-main rounded-bl-md'
                                            }`}
                                    >
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-sm max-w-none text-text-main [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-text-main [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_code]:bg-surface [&_code]:px-1 [&_code]:rounded">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        )}
                                        <p
                                            className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-violet-200' : 'text-text-muted'
                                                }`}
                                        >
                                            {msg.timestamp.toLocaleTimeString('es-MX', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-background border border-border rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-xs text-text-muted">Analizando...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll-to-bottom button */}
                    {showScrollDown && (
                        <button
                            onClick={scrollToBottom}
                            className="absolute bottom-[76px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center hover:bg-background transition-colors z-10"
                        >
                            <ChevronDown className="w-4 h-4 text-text-muted" />
                        </button>
                    )}

                    {/* Voice Recording Indicator */}
                    {isListening && (
                        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-3 shrink-0">
                            <div className="relative flex items-center justify-center">
                                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                <span className="absolute w-5 h-5 rounded-full bg-red-500/30 animate-ping" />
                            </div>
                            <span className="text-xs text-red-400 font-medium flex-1">
                                Escuchando... {transcript && <span className="text-text-muted">"{transcript}"</span>}
                            </span>
                            <button
                                onClick={stopListening}
                                className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                            >
                                Detener
                            </button>
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-4 py-3 border-t border-border bg-surface shrink-0">
                        <div className="flex items-end gap-2">
                            {/* Microphone Button */}
                            {voiceSupported && (
                                <button
                                    onClick={toggleVoice}
                                    disabled={isLoading}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isListening
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                                        : 'bg-background border border-border text-text-muted hover:text-violet-400 hover:border-violet-400/50'
                                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                                    title={isListening ? 'Detener grabación' : 'Hablar por voz'}
                                >
                                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                            )}

                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isListening ? 'Escuchando...' : 'Escribe o usa el micrófono...'}
                                rows={1}
                                className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 max-h-[100px] transition-all"
                                style={{ minHeight: '42px' }}
                                onInput={(e) => {
                                    const el = e.target as HTMLTextAreaElement;
                                    el.style.height = 'auto';
                                    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
                                }}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-400 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/25"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-text-muted mt-2 text-center">
                            IA powered by Gemini • Los datos financieros son reales
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
