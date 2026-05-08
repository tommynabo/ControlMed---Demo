import React, { useState, useEffect, useRef, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, RotateCcw, Pen } from 'lucide-react';
import { CONSENT_TEMPLATES } from '../components/consentTemplates';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'signing' | 'success' | 'error';

interface ConsentData {
    consentId: string;
    templateId: string;
    title: string;
    expiresAt: string;
    patient: {
        name: string;
        dni: string;
        birthDate: string;
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const h = window.location.hostname;
        if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:3001/api';
    }
    return '/api';
};

function buildConsentHtml(data: ConsentData): string {
    const template = CONSENT_TEMPLATES.find(t => t.id === data.templateId);
    const rawContent = template?.content || data.title;

    let content = rawContent
        .split('{{PATIENT_NAME}}').join(data.patient.name)
        .split('{{PATIENT_DNI}}').join(data.patient.dni)
        .split('{{PATIENT_DOB}}').join(data.patient.birthDate)
        .split('{{TODAY}}').join(new Date().toLocaleDateString('es-ES'))
        .split('{{CLINIC_NAME}}').join('CHC Clínica Dental')
        .split('{{DOCTOR_NAME}}').join('');

    // Remove manual signature lines — we embed the real digital one
    content = content
        .replace(/FIRMA DEL PACIENTE:.*?(?:\r?\n|$)/gi, '')
        .replace(/FIRMA DEL DOCTOR:.*?(?:\r?\n|$)/gi, '')
        .replace(/FIRMA DEL CIRUJANO:.*?(?:\r?\n|$)/gi, '')
        .replace(/FIRMA ADMINISTRACIÓN:.*?(?:\r?\n|$)/gi, '')
        .replace(/FIRMA DEL ANESTESIÓLOGO:.*?(?:\r?\n|$)/gi, '')
        .trim();

    return content;
}

async function buildSignedPdfBase64(
    data: ConsentData,
    signatureDataUrl: string
): Promise<string> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 20;
    const marginY = 20;
    const lineH = 6;
    const maxW = pageW - marginX * 2;
    let cursorY = marginY;

    const addPage = () => {
        doc.addPage();
        cursorY = marginY;
    };

    const checkPageBreak = (needed: number) => {
        if (cursorY + needed > pageH - marginY) addPage();
    };

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CHC Clínica Dental', marginX, 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Firmado digitalmente — ${new Date().toLocaleString('es-ES')}`, pageW - marginX, 11, { align: 'right' });
    cursorY = 26;

    // Title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(data.title, maxW);
    checkPageBreak(titleLines.length * lineH + 4);
    doc.text(titleLines, marginX, cursorY);
    cursorY += titleLines.length * lineH + 4;

    // Meta
    doc.setFillColor(240, 249, 255);
    doc.rect(marginX, cursorY, maxW, 14, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Paciente: ${data.patient.name}`, marginX + 4, cursorY + 5);
    doc.text(`DNI: ${data.patient.dni}`, marginX + 4, cursorY + 10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageW - marginX - 4, cursorY + 5, { align: 'right' });
    cursorY += 20;

    // Divider
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, cursorY, pageW - marginX, cursorY);
    cursorY += 6;

    // Content
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const contentText = buildConsentHtml(data);
    const lines = doc.splitTextToSize(contentText, maxW);
    for (const line of lines) {
        checkPageBreak(lineH);
        doc.text(line, marginX, cursorY);
        cursorY += lineH;
    }

    // Signature block
    cursorY += 10;
    checkPageBreak(60);
    doc.setDrawColor(203, 213, 225);
    doc.line(marginX, cursorY, pageW - marginX, cursorY);
    cursorY += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMA DIGITAL DEL PACIENTE', marginX, cursorY);
    cursorY += 4;

    // Embed signature image
    const sigImgW = 80;
    const sigImgH = 30;
    checkPageBreak(sigImgH + 10);
    doc.addImage(signatureDataUrl, 'PNG', marginX, cursorY, sigImgW, sigImgH);
    cursorY += sigImgH + 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${data.patient.name} — ${data.patient.dni}`, marginX, cursorY);
    cursorY += 5;
    doc.text(`Firmado el ${new Date().toLocaleString('es-ES')} vía firma digital en tablet`, marginX, cursorY);

    return doc.output('datauristring');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignConsent() {
    const { token } = useParams<{ token: string }>();
    const sigRef = useRef<SignatureCanvas>(null);
    const [phase, setPhase] = useState<Phase>('loading');
    const [consentData, setConsentData] = useState<ConsentData | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('');

    // Load consent data
    useEffect(() => {
        if (!token) {
            setErrorMsg('Enlace no válido.');
            setPhase('error');
            return;
        }
        (async () => {
            try {
                const res = await fetch(`${getApiUrl()}/sign/${token}`);
                const data = await res.json();
                if (!res.ok) {
                    setErrorMsg(data.error || 'Error al cargar el documento.');
                    setPhase('error');
                    return;
                }
                setConsentData(data);
                setPhase('signing');
            } catch {
                setErrorMsg('No se pudo conectar al servidor. Comprueba tu conexión.');
                setPhase('error');
            }
        })();
    }, [token]);

    // Countdown timer
    useEffect(() => {
        if (phase !== 'signing' || !consentData) return;
        const tick = () => {
            const diff = new Date(consentData.expiresAt).getTime() - Date.now();
            if (diff <= 0) {
                setErrorMsg('El enlace ha caducado. Solicita uno nuevo en la clínica.');
                setPhase('error');
                return;
            }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${m}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [phase, consentData]);

    const handleClear = useCallback(() => {
        sigRef.current?.clear();
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!consentData || !token) return;
        if (!sigRef.current || sigRef.current.isEmpty()) {
            alert('Por favor, dibuja tu firma antes de confirmar.');
            return;
        }

        setSubmitting(true);
        try {
            const signatureBase64 = sigRef.current.toDataURL('image/png');
            const signedPdfBase64 = await buildSignedPdfBase64(consentData, signatureBase64);

            const res = await fetch(`${getApiUrl()}/sign/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureBase64, signedPdfBase64 })
            });
            const result = await res.json();
            if (!res.ok) {
                alert(result.error || 'Error al guardar la firma.');
                return;
            }
            setPhase('success');
        } catch {
            alert('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setSubmitting(false);
        }
    }, [consentData, token]);

    // ── Render: Loading ────────────────────────────────────────────────────────
    if (phase === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm">Cargando documento…</p>
                </div>
            </div>
        );
    }

    // ── Render: Error ──────────────────────────────────────────────────────────
    if (phase === 'error') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <AlertTriangle size={32} className="text-red-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Enlace no válido</h1>
                    <p className="text-slate-500 text-sm leading-relaxed">{errorMsg}</p>
                    <p className="text-xs text-slate-400">Si necesitas firmar este documento, pide a la clínica que genere un nuevo enlace.</p>
                </div>
            </div>
        );
    }

    // ── Render: Success ────────────────────────────────────────────────────────
    if (phase === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                        <CheckCircle size={40} className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">¡Firma registrada!</h1>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        Tu consentimiento informado ha sido firmado y guardado correctamente.
                    </p>
                    <p className="text-xs text-slate-400 pt-2">
                        Recibirás una copia por correo electrónico. Puedes cerrar esta ventana.
                    </p>
                </div>
            </div>
        );
    }

    // ── Render: Signing ────────────────────────────────────────────────────────
    const template = CONSENT_TEMPLATES.find(t => t.id === consentData?.templateId);
    const previewContent = consentData ? buildConsentHtml(consentData) : '';

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Clinic header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center text-white font-black text-sm">
                        CHC
                    </div>
                    <div>
                        <p className="font-bold text-sm leading-tight">CHC Clínica Dental</p>
                        <p className="text-xs text-slate-400">Firma digital de consentimiento</p>
                    </div>
                </div>
                {timeLeft && (
                    <div className="text-right">
                        <p className="text-xs text-slate-400">Caduca en</p>
                        <p className="font-mono text-sm text-amber-400 font-bold">{timeLeft}</p>
                    </div>
                )}
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                {/* Patient info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Paciente</p>
                    <p className="font-bold text-slate-800 text-lg">{consentData?.patient.name}</p>
                    <p className="text-sm text-slate-500">DNI: {consentData?.patient.dni} · F. nacimiento: {consentData?.patient.birthDate}</p>
                </div>

                {/* Document */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-800 px-5 py-3">
                        <p className="text-white font-bold text-sm">{consentData?.title}</p>
                        {template && <p className="text-slate-400 text-xs mt-0.5">{template.category}</p>}
                    </div>
                    <div className="p-5 max-h-72 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
                            {previewContent}
                        </pre>
                    </div>
                </div>

                {/* Signature area */}
                <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Pen size={16} className="text-blue-600" />
                            <p className="font-bold text-slate-800 text-sm">Firma del paciente</p>
                        </div>
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <RotateCcw size={13} />
                            Limpiar
                        </button>
                    </div>
                    <div className="relative bg-slate-50" style={{ touchAction: 'none' }}>
                        <SignatureCanvas
                            ref={sigRef}
                            penColor="#1e293b"
                            canvasProps={{
                                style: { width: '100%', height: '200px', display: 'block' },
                                className: 'signature-canvas'
                            }}
                            backgroundColor="rgb(248,250,252)"
                        />
                        <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-slate-400 pointer-events-none select-none">
                            Dibuja tu firma aquí con el dedo o el lápiz
                        </p>
                    </div>
                </div>

                {/* Legal notice */}
                <p className="text-xs text-slate-400 leading-relaxed text-center px-2">
                    Al confirmar, reconoces haber leído y entendido el documento anterior y das tu consentimiento informado de forma voluntaria. La firma quedará registrada junto con la fecha, hora y documento en los sistemas de la clínica.
                </p>

                {/* Confirm button */}
                <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Guardando firma…
                        </>
                    ) : (
                        <>
                            <CheckCircle size={20} />
                            Confirmar y guardar firma
                        </>
                    )}
                </button>

                <div className="h-8" /> {/* bottom padding */}
            </div>
        </div>
    );
}
