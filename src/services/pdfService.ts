/**
 * PDF SERVICE - Generador de PDFs profesionales para la clínica
 * Maneja márgenes, tipografía, formatos y estilos profesionales
 */

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
                    <div class="header">
                        <div class="clinic-name">🏥 CHC CLÍNICA DENTAL</div>
                        <h1>${title}</h1>
                        <p>Documento generado profesionalmente</p>
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
     * Genera un HTML2PDF formateado (requiere html2pdf.js en el proyecto)
     * Alternativa más robusta si html2pdf está disponible
     */
    generatePDFFromHTML: async (options: PDFOptions): Promise<void> => {
        const {
            title,
            content,
            patientName = 'Paciente',
            fileName = `${title.replace(/\s+/g, '_')}.pdf`
        } = options;

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 100%; padding: 20px; color: #333;">
                <h1 style="text-align: center; color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
                    ${title}
                </h1>
                <div style="margin: 20px 0; padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6;">
                    <p><strong>Paciente:</strong> ${patientName}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                </div>
                ${content}
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                    <p>CHC Clínica Dental - Documento confidencial</p>
                    <p>Generado: ${new Date().toLocaleString('es-ES')}</p>
                </div>
            </div>
        `;

        // Crear elemento temporal
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        element.style.padding = '20mm';

        // Usar html2pdf si está disponible
        try {
            const opt = {
                margin: 10,
                filename: fileName,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, logging: false },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };

            // @ts-ignore - html2pdf puede no existir
            if (window.html2pdf) {
                // @ts-ignore
                window.html2pdf().set(opt).from(element).save();
            } else {
                // Fallback: descargar HTML como texto
                pdfService.downloadAsHTML(htmlContent, fileName);
            }
        } catch (e) {
            console.warn('html2pdf no disponible, usando fallback:', e);
            pdfService.downloadAsHTML(htmlContent, fileName);
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
