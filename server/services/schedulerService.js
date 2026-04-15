const cron = require('node-cron');
const whatsappService = require('./whatsappService');
const gmailService = require('./gmailService');

const startScheduler = (prisma) => {
    console.log('⏰ Starting WhatsApp Scheduler...');

    // Job 1: Appointment Reminders (Runs every hour)
    // Checks for appointments roughly 12 hours from now (+/- 30 mins window)
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Running Hourly Appointment Reminder Check...');
        try {
            const now = new Date();
            const startWindow = new Date(now.getTime() + (11.5 * 60 * 60 * 1000));
            const endWindow = new Date(now.getTime() + (12.5 * 60 * 60 * 1000));

            const appointments = await prisma.appointment.findMany({
                where: {
                    date: {
                        gte: startWindow,
                        lte: endWindow
                    },
                    status: 'Scheduled'
                },
                include: {
                    patient: true,
                    doctor: true,
                    treatment: true
                }
            });

            console.log(`🔎 Found ${appointments.length} appointments for reminders.`);

            // Get Reminder Template
            const template = await prisma.whatsAppTemplate.findFirst({
                where: { triggerType: 'APPOINTMENT_REMINDER' }
            });

            if (!template) {
                console.warn('⚠️ No APPOINTMENT_REMINDER template found. Skipping.');
                return;
            }

            for (const appt of appointments) {
                if (!appt.patient.phone) continue;

                // Check if already sent (avoid duplicates)
                // We'll look for a log entry for this patient & day & type
                /* 
                   Ideally we'd link log to appointmentId, but current schema links to Patient.
                   For now, we assume one reminder per trigger type per day/appointment is sufficient logic,
                   or just trust the strict time window won't overlap runs (it runs every hour, window is 1h, risk of edge case doubles).
                   Better: Check if a log exists created in the last 2 hours for this patient & type.
                */

                const alreadySent = await prisma.whatsAppLog.findFirst({
                    where: {
                        patientId: appt.patient.id,
                        type: 'APPOINTMENT_REMINDER',
                        sentAt: {
                            gte: new Date(now.getTime() - (2 * 60 * 60 * 1000)) // Sent recently
                        }
                    }
                });

                if (alreadySent) continue;

                // Format Message
                let msg = template.content
                    .replace('{{PACIENTE}}', appt.patient.name)
                    .replace('{{PATIENT_NAME}}', appt.patient.name) // Legacy support just in case
                    .replace('{{DOCTOR}}', appt.doctor.name)
                    .replace('{{DOCTOR_NAME}}', appt.doctor.name)
                    .replace('{{FECHA}}', new Date(appt.date).toLocaleDateString('es-ES'))
                    .replace('{{DATE}}', new Date(appt.date).toLocaleDateString('es-ES'))
                    .replace('{{HORA}}', appt.time)
                    .replace('{{TIME}}', appt.time)
                    .replace('{{TRATAMIENTO}}', appt.treatment?.name || 'Consulta')
                    .replace('{{TREATMENT}}', appt.treatment?.name || 'Consulta');

                try {
                    await whatsappService.sendMessage(appt.patient.phone, msg);

                    // Log Success
                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: appt.patient.id,
                            type: 'APPOINTMENT_REMINDER',
                            status: 'SENT',
                            content: msg
                        }
                    });
                    console.log(`✅ Reminder sent to ${appt.patient.name}`);
                } catch (err) {
                    console.error(`❌ Failed to send to ${appt.patient.name}:`, err.message);
                    // Log Failure
                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: appt.patient.id,
                            type: 'APPOINTMENT_REMINDER',
                            status: 'FAILED',
                            content: msg,
                            error: err.message
                        }
                    });
                }

                // Gmail reminder (fire-and-forget — does not block WhatsApp flow)
                if (appt.patient.email) {
                    gmailService.sendGmail({
                        to: appt.patient.email,
                        subject: `Recordatorio de cita — ${new Date(appt.date).toLocaleDateString('es-ES')}`,
                        htmlBody: `
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
                                <h2 style="color:#0f766e;">Recordatorio de su cita</h2>
                                <p>Estimado/a <strong>${appt.patient.name}</strong>,</p>
                                <p>Le recordamos que tiene una cita programada:</p>
                                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                                    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Fecha:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${new Date(appt.date).toLocaleDateString('es-ES')}</td></tr>
                                    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Hora:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${appt.time}</td></tr>
                                    <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Doctor/a:</strong></td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${appt.doctor?.name || 'Su médico'}</td></tr>
                                    <tr><td style="padding:8px;"><strong>Tratamiento:</strong></td><td style="padding:8px;">${appt.treatment?.name || 'Consulta'}</td></tr>
                                </table>
                                <p style="color:#64748b;font-size:13px;">Si necesita cancelar o modificar su cita, por favor contacte con la clínica.</p>
                            </div>`,
                    }).catch((emailErr) => {
                        console.warn(`⚠️ Email reminder failed for ${appt.patient.name}:`, emailErr.message);
                    });
                }
            }

        } catch (error) {
            console.error('Error in Reminder Job:', error);
        }
    });

    // Job 2: Treatment Follow-ups (Runs daily at 9 AM)
    // Example: Check "Endodoncia" completed 6 months ago? 
    // This requires complex rules. For MVP we'll look for general "Follow Up" logic if defined.
    // Or we will implement the specific "Review" logic described.
    cron.schedule('0 9 * * *', async () => {
        console.log('⏳ Running Daily Follow-up Check...');
        // Implementation placeholder for follow-up logic based on completed treatments
    });
    // Job 3: Process Scheduled Messages (Messages created with a future date)
    // Runs every 15 minutes to be responsive enough
    cron.schedule('*/15 * * * *', async () => {
        console.log('⏳ Checking for Scheduled WhatsApp Messages...');
        try {
            const now = new Date();
            const pendingMessages = await prisma.whatsAppLog.findMany({
                where: {
                    status: 'PENDING',
                    scheduledFor: {
                        lte: now
                    }
                },
                include: { patient: true }
            });

            console.log(`🔎 Found ${pendingMessages.length} scheduled messages due.`);

            for (const log of pendingMessages) {
                if (!log.patient.phone) {
                    console.warn(`⚠️ Skipped scheduled msg for ${log.patient.name} (No phone)`);
                    await prisma.whatsAppLog.update({
                        where: { id: log.id },
                        data: { status: 'FAILED', error: 'No phone number' }
                    });
                    continue;
                }

                try {
                    console.log(`📤 Sending scheduled message to ${log.patient.name}...`);
                    await whatsappService.sendMessage(log.patient.phone, log.content);

                    await prisma.whatsAppLog.update({
                        where: { id: log.id },
                        data: { status: 'SENT', sentAt: new Date() }
                    });
                    console.log('✅ Scheduled message sent successfully.');
                } catch (e) {
                    console.error('❌ Failed to send scheduled message:', e.message);
                    await prisma.whatsAppLog.update({
                        where: { id: log.id },
                        data: { status: 'FAILED', error: e.message } // Keep scheduledFor so maybe we can retry? Or just fail.
                    });
                }
            }

        } catch (e) {
            console.error('Error processing scheduled messages:', e);
        }
    });
    // Job 4: Process Due Installments (Runs daily at 8 AM)
    // Generates invoices for financing plan installments due today
    cron.schedule('0 8 * * *', async () => {
        console.log('⏳ Running Daily Installment Invoice Generation...');
        try {
            const financeService = require('./financeService');
            const results = await financeService.processDueInstallments(prisma);
            console.log(`📋 Processed ${results.length} installments`);

            // Send WhatsApp notification for each successful invoice
            for (const result of results) {
                if (result.success && result.patientName) {
                    // Find patient and send notification
                    const patient = await prisma.patient.findFirst({
                        where: { name: result.patientName }
                    });

                    if (patient && patient.phone) {
                        const msg = `Hola ${patient.name},\n\nTe informamos que se ha generado tu factura por ${result.amount}€ correspondiente a ${result.installmentId}.\n\nPuedes realizar el pago en nuestra clínica o contactarnos para más información.\n\nGracias por confiar en nosotros.`;

                        try {
                            await whatsappService.sendMessage(patient.phone, msg);
                            console.log(`✅ Payment notification sent to ${patient.name}`);
                        } catch (waErr) {
                            console.warn(`⚠️ Could not send WhatsApp to ${patient.name}:`, waErr.message);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in Installment Invoice Job:', error);
        }
    });

    // Job 5: Installment Payment Reminders (Runs daily at 9 AM)
    // Sends WhatsApp reminders for payments due in 3 days
    cron.schedule('0 9 * * *', async () => {
        console.log('⏳ Running Installment Payment Reminder Check...');
        try {
            const financeService = require('./financeService');
            const upcomingInstallments = await financeService.getUpcomingInstallments(prisma, 3);

            console.log(`🔎 Found ${upcomingInstallments.length} installments due in 3 days`);

            // Get reminder template or use default
            const template = await prisma.whatsAppTemplate.findFirst({
                where: { triggerType: 'PAYMENT_REMINDER' }
            });

            const defaultMsg = `Hola {{PACIENTE}},\n\nTe recordamos que tu próximo pago de {{AMOUNT}}€ correspondiente a "{{DESCRIPTION}}" vence el {{DATE}}.\n\nPor favor, contacta con nosotros si tienes alguna duda.\n\nGracias.`;

            for (const inst of upcomingInstallments) {
                const patient = inst.plan?.patient;
                if (!patient || !patient.phone) continue;

                // Check if already sent today
                const alreadySent = await prisma.whatsAppLog.findFirst({
                    where: {
                        patientId: patient.id,
                        type: 'PAYMENT_REMINDER',
                        sentAt: {
                            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
                        }
                    }
                });

                if (alreadySent) continue;

                // Format message
                let msg = (template?.content || defaultMsg)
                    .replace('{{PACIENTE}}', patient.name)
                    .replace('{{PATIENT_NAME}}', patient.name)
                    .replace('{{AMOUNT}}', inst.amount.toString())
                    .replace('{{DESCRIPTION}}', inst.description)
                    .replace('{{DATE}}', new Date(inst.dueDate).toLocaleDateString('es-ES'));

                try {
                    await whatsappService.sendMessage(patient.phone, msg);

                    // Log success
                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: patient.id,
                            type: 'PAYMENT_REMINDER',
                            status: 'SENT',
                            content: msg
                        }
                    });

                    // Mark reminder sent on installment
                    await prisma.installment.update({
                        where: { id: inst.id },
                        data: { reminderSent: true }
                    });

                    console.log(`✅ Payment reminder sent to ${patient.name}`);
                } catch (err) {
                    console.error(`❌ Failed to send reminder to ${patient.name}:`, err.message);
                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: patient.id,
                            type: 'PAYMENT_REMINDER',
                            status: 'FAILED',
                            content: msg,
                            error: err.message
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error in Payment Reminder Job:', error);
        }
    });

    console.log('✅ All scheduler jobs started successfully');
};

module.exports = { startScheduler };
