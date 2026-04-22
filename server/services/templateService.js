
const fs = require('fs');
const path = require('path');

// Adapt path for Vercel (Read-only OS, except /tmp)
const UPLOAD_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? '/tmp/uploads/templates'
    : path.join(__dirname, '../uploads/templates');

// Ensure directory exists (Safe check)
try {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
} catch (e) {
    console.warn("⚠️ Warning: Could not create upload directory on startup:", e.message);
}

/**
 * Saves a template to disk and DB
 * @param {PrismaClient} prisma 
 * @param {Object} data { title, category, type, contentBase64 }
 */
const uploadTemplate = async (prisma, data) => {
    const { title, category, type, contentBase64 } = data;

    // Decode Base64
    const buffer = Buffer.from(contentBase64, 'base64');
    const sizeInBytes = buffer.length;
    const sizeStr = (sizeInBytes / 1024).toFixed(2) + ' KB';

    // File name
    const filename = `${Date.now()}_${title.replace(/[^a-z0-9]/gi, '_')}.${type}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Save to Disk
    fs.writeFileSync(filePath, buffer);

    // Save to DB
    const template = await prisma.documentTemplate.create({
        data: {
            title,
            category,
            type,
            size: sizeStr,
            content: filename // Store relative path/filename
        }
    });

    return template;
};

const getTemplates = async (prisma) => {
    return await prisma.documentTemplate.findMany({
        orderBy: { createdAt: 'desc' }
    });
};

const deleteTemplate = async (prisma, id) => {
    const template = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!template) throw new Error("Template not found");

    // Remove file (only for file-based templates, not html)
    if (template.type !== 'html' && template.content) {
        const filePath = path.join(UPLOAD_DIR, template.content);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    // Remove DB record
    return await prisma.documentTemplate.delete({ where: { id } });
};

const updateTemplate = async (prisma, id, { title, category, content }) => {
    const existing = await prisma.documentTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Template not found');

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined && existing.type === 'html') {
        updateData.content = content;
        updateData.size = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2) + ' KB';
    }

    return await prisma.documentTemplate.update({ where: { id }, data: updateData });
};

module.exports = {
    uploadTemplate,
    getTemplates,
    deleteTemplate,
    updateTemplate,
};
