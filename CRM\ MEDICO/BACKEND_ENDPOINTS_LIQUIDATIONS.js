// Backend endpoints for liquidations
app.get('/api/liquidations/summary', authenticateUser, async (req, res) => {
    try {
        const { doctorId, dateFrom, dateTo } = req.query;

        if (!doctorId || !dateFrom || !dateTo) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Fetch invoices for the doctor within date range
        const response = await supabase
            .from('invoices')
            .select(`
                id,
                fecha,
                total,
                concepto,
                pacientes(nombre),
                numero_historia
            `)
            .eq('doctor_id', doctorId)
            .gte('fecha', dateFrom)
            .lte('fecha', dateTo)
            .order('fecha', { ascending: false });

        if (response.error) {
            throw response.error;
        }

        const records = response.data.map(inv => ({
            id: inv.id,
            fecha: new Date(inv.fecha).toLocaleDateString('es-ES'),
            concepto: inv.concepto || 'Servicios Médicos',
            importeCobrado: inv.total || 0,
            nombrePaciente: inv.pacientes?.nombre || 'N/A',
            numeroHistoria: inv.numero_historia || 'N/A',
            doctorId
        }));

        res.json({
            records,
            dateFrom,
            dateTo,
            doctorId,
            total: records.reduce((sum, r) => sum + r.importeCobrado, 0)
        });
    } catch (error) {
        console.error('Error fetching liquidations:', error);
        res.status(500).json({ error: 'Failed to fetch liquidations' });
    }
});

// POST endpoint for PDF export
app.post('/api/liquidations/export-pdf', authenticateUser, async (req, res) => {
    try {
        const { doctorId, dateFrom, dateTo, records } = req.body;

        if (!records || records.length === 0) {
            return res.status(400).json({ error: 'No records to export' });
        }

        // Get doctor details
        const doctorResponse = await supabase
            .from('doctores')
            .select('nombre, apellido, especialidad, numero_colegiado')
            .eq('id', doctorId)
            .single();

        const doctor = doctorResponse.data;

        // Create HTML for PDF
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #1e293b; margin: 0; }
                    .header p { color: #64748b; margin: 5px 0; }
                    .doctor-info { 
                        background: #f1f5f9; 
                        padding: 15px; 
                        border-radius: 8px; 
                        margin-bottom: 30px;
                        border-left: 4px solid #10b981;
                    }
                    .doctor-info p { margin: 5px 0; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th {
                        background: #1e293b;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-size: 13px;
                        font-weight: bold;
                    }
                    td {
                        padding: 10px 12px;
                        border-bottom: 1px solid #e2e8f0;
                        font-size: 13px;
                    }
                    tr:hover { background: #f8fafc; }
                    .total-row {
                        background: #d1fae5;
                        font-weight: bold;
                        border-top: 2px solid #10b981;
                    }
                    .amount-column { text-align: right; }
                    .footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Liquidación de Servicios Médicos</h1>
                    <p>Período: ${dateFrom} a ${dateTo}</p>
                </div>

                <div class="doctor-info">
                    <p><strong>Doctor:</strong> ${doctor?.nombre} ${doctor?.apellido}</p>
                    <p><strong>Especialidad:</strong> ${doctor?.especialidad || 'N/A'}</p>
                    <p><strong>Colegiado N°:</strong> ${doctor?.numero_colegiado || 'N/A'}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Concepto</th>
                            <th>Paciente</th>
                            <th>NUM</th>
                            <th class="amount-column">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${r.fecha}</td>
                                <td>${r.concepto}</td>
                                <td>${r.nombrePaciente}</td>
                                <td>${r.numeroHistoria}</td>
                                <td class="amount-column">${r.importeCobrado.toFixed(2)}€</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="4">TOTAL</td>
                            <td class="amount-column">${records.reduce((sum, r) => sum + r.importeCobrado, 0).toFixed(2)}€</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <p>Este documento fue generado automáticamente el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
                    <p>CRM Médico - Sistema de Gestión</p>
                </div>
            </body>
            </html>
        `;

        // Send as PDF (requires html2pdf library or similar)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="liquidaciones-${doctorId}-${dateFrom}-${dateTo}.pdf"`);
        
        // Option 1: If using html2pdf in backend
        const pdf = await convertHTMLToPDF(html);
        res.send(pdf);

        // Option 2: If frontend handles it, just send HTML
        // res.json({ html });

    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

// Helper function to convert HTML to PDF (requires npm install html-pdf or similar)
async function convertHTMLToPDF(html) {
    return new Promise((resolve, reject) => {
        const pdf = require('html-pdf');
        const options = {
            format: 'A4',
            margin: {
                top: '15mm',
                bottom: '15mm',
                left: '20mm',
                right: '20mm'
            }
        };

        pdf.create(html, options).toBuffer((err, buffer) => {
            if (err) reject(err);
            else resolve(buffer);
        });
    });
}
