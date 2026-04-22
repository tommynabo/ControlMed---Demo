const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { uploadTemplate, getTemplates, deleteTemplate } = require('../services/templateService');

const router = express.Router();
const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? '/tmp/uploads/templates'
    : path.join(__dirname, '../../uploads/templates');

// GET /api/templates — list all templates
router.get('/templates', async (req, res) => {
    try {
        const templates = await getTemplates(prisma);
        res.json(templates);
    } catch (err) {
        console.error('Error fetching templates:', err);
        res.status(500).json({ error: 'Error al obtener las plantillas' });
    }
});

// POST /api/templates — upload new template (base64 file OR html content)
router.post('/templates', async (req, res) => {
    try {
        const { title, category, type, contentBase64, content } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'El título es obligatorio' });
        }

        let template;

        if (type === 'html' || (!contentBase64 && content !== undefined)) {
            // Store HTML content directly in DB (no file on disk)
            const htmlContent = content || '';
            const sizeStr = (Buffer.byteLength(htmlContent, 'utf8') / 1024).toFixed(2) + ' KB';
            template = await prisma.documentTemplate.create({
                data: {
                    title,
                    category: category || 'General',
                    type: 'html',
                    size: sizeStr,
                    content: htmlContent,
                },
            });
        } else if (contentBase64) {
            // File-based upload (pdf, docx)
            template = await uploadTemplate(prisma, { title, category: category || 'General', type: type || 'pdf', contentBase64 });
        } else {
            return res.status(400).json({ error: 'Se requiere contentBase64 o content' });
        }

        res.status(201).json(template);
    } catch (err) {
        console.error('Error creating template:', err);
        res.status(500).json({ error: 'Error al crear la plantilla' });
    }
});

// PUT /api/templates/:id — update template title, category and/or content
router.put('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, content } = req.body;

        const existing = await prisma.documentTemplate.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (category !== undefined) updateData.category = category;

        // Only allow content editing for html-type templates
        if (content !== undefined) {
            if (existing.type === 'html') {
                updateData.content = content;
                updateData.size = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2) + ' KB';
            }
        }

        const updated = await prisma.documentTemplate.update({
            where: { id },
            data: updateData,
        });

        res.json(updated);
    } catch (err) {
        console.error('Error updating template:', err);
        res.status(500).json({ error: 'Error al actualizar la plantilla' });
    }
});

// DELETE /api/templates/:id — delete a template
router.delete('/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.documentTemplate.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Plantilla no encontrada' });
        }

        // For file-based templates, delete the file from disk
        if (existing.type !== 'html' && existing.content) {
            const filePath = path.join(UPLOAD_DIR, existing.content);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.documentTemplate.delete({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting template:', err);
        res.status(500).json({ error: 'Error al eliminar la plantilla' });
    }
});

// GET /api/templates/file/:filename — serve uploaded file from disk
router.get('/templates/file/:filename', (req, res) => {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
