
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function transcribeFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        const audioVideoFiles = files.filter(file => file.endsWith('.mp3') || file.endsWith('.mp4'));

        console.log(`Found ${audioVideoFiles.length} audio/video files in ${folderPath}`);

        for (const file of audioVideoFiles) {
            console.log(`Transcribing ${file}...`);
            const filePath = path.join(folderPath, file);

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: "whisper-1",
            });

            console.log(`\n--- Transcription for ${file} ---`);
            console.log(transcription.text);
            console.log('-----------------------------------\n');

            const textFilePath = filePath.replace(path.extname(file), '.txt');
            fs.writeFileSync(textFilePath, transcription.text, 'utf8');
            console.log(`Saved transcription to ${textFilePath}`);
        }
    } catch (error) {
        console.error('Error transcribing files:', error);
    }
}

const audioFolder = path.join(__dirname, '../audioInstructions');
transcribeFolder(audioFolder);
