/**
 * PDF SERVICE - Generador de PDFs profesionales para la clínica
 * Maneja márgenes, tipografía, formatos y estilos profesionales
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFOptions {
    title: string;
    content: string;
    patientName?: string;
    doctorName?: string;
    date?: string;
    logo?: string;
    headerColor?: string;
    fileName?: string;
}

export const pdfService = {
    /**
     * Genera un PDF profesional desde HTML mejorado
     * Soporta márgenes, headers, footers, saltos de línea
     */
    generateProfessionalPDF: async (options: PDFOptions): Promise<Blob> => {
        const {
            title,
            content,
            patientName = 'Paciente',
            doctorName = 'Dr. General',
            date = new Date().toLocaleDateString('es-ES'),
            logo = '',
            headerColor = '#1e293b',
            fileName = `${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`
        } = options;

        // Crear HTML mejorado con estilos profesionales
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 11pt;
                        line-height: 1.6;
                        color: #1e293b;
                        background: white;
                    }
                    
                    @page {
                        size: A4;
                        margin: 15mm 20mm 15mm 20mm;
                        @bottom-center {
                            content: string(footer);
                        }
                    }
                    
                    .page-container {
                        min-height: 297mm;
                        width: 210mm;
                        padding: 15mm 20mm;
                        background: white;
                    }
                    
                    /* HEADER */
                    .header {
                        background: linear-gradient(135deg, ${headerColor} 0%, #334155 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    
                    .header h1 {
                        font-size: 18pt;
                        font-weight: 700;
                        margin-bottom: 8px;
                        letter-spacing: 0.5px;
                    }
                    
                    .header p {
                        font-size: 10pt;
                        opacity: 0.95;
                        margin: 4px 0;
                    }
                    
                    .clinic-name {
                        font-size: 12pt;
                        font-weight: 600;
                        margin-bottom: 10px;
                    }
                    
                    /* INFO GRID */
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 25px;
                        padding: 15px;
                        background: #f8fafc;
                        border-left: 4px solid ${headerColor};
                        border-radius: 4px;
                    }
                    
                    .info-item {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .info-label {
                        font-size: 9pt;
                        font-weight: 600;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 4px;
                    }
                    
                    .info-value {
                        font-size: 11pt;
                        font-weight: 500;
                        color: #1e293b;
                    }
                    
                    /* CONTENT */
                    .content {
                        margin: 25px 0;
                        line-height: 1.8;
                    }
                    
                    .content h2 {
                        font-size: 13pt;
                        font-weight: 700;
                        color: ${headerColor};
                        margin: 20px 0 12px 0;
                        padding-bottom: 8px;
                        border-bottom: 2px solid #e2e8f0;
                        letter-spacing: 0.3px;
                    }
                    
                    .content h3 {
                        font-size: 11pt;
                        font-weight: 600;
                        color: #475569;
                        margin: 15px 0 8px 0;
                    }
                    
                    .content p {
                        margin: 8px 0;
                        text-align: justify;
                        word-spacing: 1px;
                    }
                    
                    .content ul, .content ol {
                        margin: 12px 0 12px 25px;
                    }
                    
                    .content li {
                        margin: 6px 0;
                        padding-left: 8px;
                    }
                    
                    /* SIGNATURES */
                    .signatures {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 40px;
                        margin-top: 40px;
                        padding-top: 30px;
                        border-top: 1px solid #e2e8f0;
                    }
                    
                    .signature-block {
                        text-align: center;
                    }
                    
                    .signature-line {
                        border-top: 1px solid #1e293b;
                        margin: 50px auto 8px;
                        width: 140px;
                    }
                    
                    .signature-label {
                        font-size: 10pt;
                        color: #475569;
                        font-weight: 500;
                    }
                    
                    /* FOOTER */
                    .footer {
                        margin-top: 40px;
                        padding-top: 15px;
                        border-top: 1px solid #cbd5e1;
                        font-size: 9pt;
                        color: #64748b;
                        text-align: center;
                    }
                    
                    .footer-text {
                        margin: 4px 0;
                    }
                    
                    /* SPECIAL BOXES */
                    .alert-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 12px 15px;
                        margin: 15px 0;
                        border-radius: 4px;
                        font-size: 10pt;
                    }
                    
                    .info-box {
                        background: #dbeafe;
                        border-left: 4px solid #3b82f6;
                        padding: 12px 15px;
                        margin: 15px 0;
                        border-radius: 4px;
                        font-size: 10pt;
                    }
                    
                    .warning-box {
                        background: #fee2e2;
                        border-left: 4px solid #ef4444;
                        padding: 12px 15px;
                        margin: 15px 0;
                        border-radius: 4px;
                        font-size: 10pt;
                    }
                    
                    /* PAGE BREAK */
                    .page-break {
                        page-break-after: always;
                        margin-top: 20px;
                    }
                    
                    /* CHECKBOXES */
                    .checkbox-group {
                        margin: 10px 0;
                        padding-left: 15px;
                    }
                    
                    .checkbox-item {
                        margin: 6px 0;
                        font-size: 10pt;
                    }
                    
                    .checkbox-item input {
                        margin-right: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <!-- HEADER -->
                    <div class="header" style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="clinic-name">CHC CLÍNICA DENTAL</div>
                            <h1>${title}</h1>
                            <p>Documento generado profesionalmente</p>
                        </div>
                        ${logo ? `<img src="${logo}" style="height:65px;max-width:120px;object-fit:contain;border-radius:4px;background:white;padding:4px;" onerror="this.style.display='none'" />` : ''}
                    </div>
                    
                    <!-- INFO GRID -->
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Paciente</span>
                            <span class="info-value">${patientName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Fecha</span>
                            <span class="info-value">${date}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Profesional</span>
                            <span class="info-value">${doctorName}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Clínica</span>
                            <span class="info-value">CHC Dental</span>
                        </div>
                    </div>
                    
                    <!-- CONTENT -->
                    <div class="content">
                        ${content}
                    </div>
                    
                    <!-- FOOTER -->
                    <div class="footer">
                        <div class="footer-text">CHC Clínica Dental - Documento confidencial</div>
                        <div class="footer-text">Este documento es un registro oficial de la clínica. Se prohíbe su reproducción sin autorización.</div>
                        <div class="footer-text">Generado: ${new Date().toLocaleString('es-ES')}</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Convertir a Blob
        const blob = new Blob([htmlContent], { type: 'text/html' });
        return blob;
    },

    /**
     * Genera un PDF real usando html2canvas + jsPDF
     * Convierte el HTML a canvas, lo embebe en un PDF descargable
     */
    generatePDFFromHTML: async (options: PDFOptions): Promise<void> => {
        const {
            title,
            content,
            patientName = 'Paciente',
            logo = '',
            fileName = `${title.replace(/\s+/g, '_')}.pdf`
        } = options;

        // Build the full HTML page for rendering
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111827; background: white; width: 794px; padding: 40px 50px; }
                    .doc-header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 3px solid #111827; margin-bottom: 20px; }
                    .doc-header h1 { font-size: 14pt; font-weight: 800; text-transform: uppercase; color: #111827; margin-bottom: 3px; }
                    .doc-header .clinic { font-size: 9pt; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
                    .doc-header img { height: 60px; max-width: 110px; object-fit: contain; }
                    .meta-row { display: flex; gap: 24px; margin-bottom: 18px; font-size: 9pt; color: #374151; padding: 10px 14px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px; }
                    .meta-row strong { font-weight: 700; color: #111827; }
                    .content { line-height: 1.7; }
                    .content h2 { font-size: 12pt; font-weight: 700; color: #1e293b; margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
                    .content h3 { font-size: 10.5pt; font-weight: 600; color: #475569; margin: 12px 0 6px; }
                    .content p { margin: 6px 0; text-align: justify; }
                    .doc-footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #d1d5db; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <div class="doc-header">
                    <div>
                        <div class="clinic">CHC Clínica Dental</div>
                        <h1>${title}</h1>
                    </div>
                    ${logo ? `<img src="${logo}" onerror="this.style.display='none'" />` : ''}
                </div>
                <div class="meta-row">
                    <span><strong>Paciente:</strong> ${patientName}</span>
                    <span><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</span>
                </div>
                <div class="content">${content}</div>
                <div class="doc-footer">
                    <span>CHC Clínica Dental — Documento confidencial</span>
                    <span>Generado: ${new Date().toLocaleString('es-ES')}</span>
                </div>
            </body>
            </html>
        `;

        // Render in a hidden off-screen iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:794px;height:1123px;border:none;visibility:hidden;';
        document.body.appendChild(iframe);

        await new Promise<void>(resolve => {
            iframe.onload = () => resolve();
            iframe.srcdoc = htmlContent;
        });

        try {
            const iframeBody = iframe.contentDocument?.body;
            if (!iframeBody) throw new Error('iframe body not available');

            // Wait a tick for images/styles
            await new Promise(r => setTimeout(r, 300));

            const canvas = await html2canvas(iframeBody, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = pdf.internal.pageSize.getHeight();
            const ratio = canvas.height / canvas.width;
            const imgH = pdfW * ratio;

            if (imgH <= pdfH) {
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH);
            } else {
                // Multi-page: slice canvas into A4-height segments
                const pageHeightPx = Math.floor(canvas.width * (pdfH / pdfW));
                let yOffset = 0;
                while (yOffset < canvas.height) {
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = Math.min(pageHeightPx, canvas.height - yOffset);
                    const ctx = sliceCanvas.getContext('2d')!;
                    ctx.drawImage(canvas, 0, -yOffset);
                    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
                    if (yOffset > 0) pdf.addPage();
                    pdf.addImage(sliceData, 'JPEG', 0, 0, pdfW, pdfH * (sliceCanvas.height / pageHeightPx));
                    yOffset += pageHeightPx;
                }
            }

            pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
        } finally {
            document.body.removeChild(iframe);
        }
    },

    /**
     * Descarga como archivo HTML (fallback) o abre en nueva pestaña
     */
    downloadAsHTML: (htmlContent: string, fileName: string): void => {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName.replace('.pdf', '.html');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    /**
     * Abre el PDF en nueva pestaña para impresión
     */
    openInNewTab: (htmlContent: string): void => {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write(htmlContent);
            newWindow.document.close();
        }
    },

    /**
     * Copia el contenido al portapapeles
     */
    copyToClipboard: async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('Error copying to clipboard:', err);
        }
    }
};
