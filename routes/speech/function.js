import query from '../../database/dbpromise.js'
import fetch from 'node-fetch'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import fs from 'fs'
import { OpenAIApi, Configuration } from 'openai'
import path from 'path'
import AWS from 'aws-sdk'

const voiceArr = [
    { Id: 'Kevin', Name: 'Kevin', Engine: 'neural' },
    { Id: 'Filiz', Name: 'Filiz', Engine: 'standard' },
    { Id: 'Elin', Name: 'Elin', Engine: 'neural' },
    { Id: 'Astrid', Name: 'Astrid', Engine: 'standard' },
    { Id: 'Tatyana', Name: 'Tatyana', Engine: 'standard' },
    { Id: 'Maxim', Name: 'Maxim', Engine: 'standard' },
    { Id: 'Carmen', Name: 'Carmen', Engine: 'standard' },
    { Id: 'Ines', Name: 'Inês', Engine: 'neural' },
    { Id: 'Cristiano', Name: 'Cristiano', Engine: 'standard' },
    { Id: 'Vitoria', Name: 'Vitória', Engine: 'neural' },
    { Id: 'Ricardo', Name: 'Ricardo', Engine: 'standard' },
    { Id: 'Camila', Name: 'Camila', Engine: 'neural' },
    { Id: 'Maja', Name: 'Maja', Engine: 'standard' },
    { Id: 'Jan', Name: 'Jan', Engine: 'standard' },
    { Id: 'Jacek', Name: 'Jacek', Engine: 'standard' },
    { Id: 'Ewa', Name: 'Ewa', Engine: 'standard' },
    { Id: 'Ola', Name: 'Ola', Engine: 'neural' },
    { Id: 'Ruben', Name: 'Ruben', Engine: 'standard' },
    { Id: 'Lotte', Name: 'Lotte', Engine: 'standard' },
    { Id: 'Laura', Name: 'Laura', Engine: 'neural' },
    { Id: 'Ida', Name: 'Ida', Engine: 'neural' },
    { Id: 'Liv', Name: 'Liv', Engine: 'standard' },
    { Id: 'Seoyeon', Name: 'Seoyeon', Engine: 'neural' },
    { Id: 'Kazuha', Name: 'Kazuha', Engine: 'neural' },
    { Id: 'Tomoko', Name: 'Tomoko', Engine: 'neural' },
    { Id: 'Takumi', Name: 'Takumi', Engine: 'neural' },
    { Id: 'Mizuki', Name: 'Mizuki', Engine: 'standard' },
    { Id: 'Bianca', Name: 'Bianca', Engine: 'neural' },
    { Id: 'Giorgio', Name: 'Giorgio', Engine: 'standard' },
    { Id: 'Carla', Name: 'Carla', Engine: 'standard' },
    { Id: 'Karl', Name: 'Karl', Engine: 'standard' },
    { Id: 'Dora', Name: 'Dóra', Engine: 'standard' },
    { Id: 'Mathieu', Name: 'Mathieu', Engine: 'standard' },
    { Id: 'Lea', Name: 'Léa', Engine: 'neural' },
    { Id: 'Celine', Name: 'Céline', Engine: 'standard' },
    { Id: 'Chantal', Name: 'Chantal', Engine: 'standard' },
    { Id: 'Gabrielle', Name: 'Gabrielle', Engine: 'neural' },
    { Id: 'Penelope', Name: 'Penélope', Engine: 'standard' },
    { Id: 'Miguel', Name: 'Miguel', Engine: 'standard' },
    { Id: 'Lupe', Name: 'Lupe', Engine: 'neural' },
    { Id: 'Mia', Name: 'Mia', Engine: 'neural' },
    { Id: 'Lucia', Name: 'Lucia', Engine: 'neural' },
    { Id: 'Enrique', Name: 'Enrique', Engine: 'standard' },
    { Id: 'Conchita', Name: 'Conchita', Engine: 'standard' },
    { Id: 'Geraint', Name: 'Geraint', Engine: 'standard' },
    { Id: 'Salli', Name: 'Salli', Engine: 'neural' },
    { Id: 'Matthew', Name: 'Matthew', Engine: 'neural' },
    { Id: 'Kimberly', Name: 'Kimberly', Engine: 'neural' },
    { Id: 'Kendra', Name: 'Kendra', Engine: 'neural' },
    { Id: 'Justin', Name: 'Justin', Engine: 'neural' },
    { Id: 'Joey', Name: 'Joey', Engine: 'neural' },
    { Id: 'Joanna', Name: 'Joanna', Engine: 'neural' },
    { Id: 'Ivy', Name: 'Ivy', Engine: 'neural' },
    { Id: 'Aria', Name: 'Aria', Engine: 'neural' },
    { Id: 'Ayanda', Name: 'Ayanda', Engine: 'neural' },
    { Id: 'Raveena', Name: 'Raveena', Engine: 'standard' },
    { Id: 'Aditi', Name: 'Aditi', Engine: 'standard' },
    { Id: 'Emma', Name: 'Emma', Engine: 'neural' },
    { Id: 'Brian', Name: 'Brian', Engine: 'neural' },
    { Id: 'Amy', Name: 'Amy', Engine: 'neural' },
    { Id: 'Russell', Name: 'Russell', Engine: 'standard' },
    { Id: 'Nicole', Name: 'Nicole', Engine: 'standard' },
    { Id: 'Olivia', Name: 'Olivia', Engine: 'neural' },
    { Id: 'Vicki', Name: 'Vicki', Engine: 'neural' },
    { Id: 'Marlene', Name: 'Marlene', Engine: 'standard' },
    { Id: 'Hans', Name: 'Hans', Engine: 'standard' },
    { Id: 'Naja', Name: 'Naja', Engine: 'standard' },
    { Id: 'Mads', Name: 'Mads', Engine: 'standard' },
    { Id: 'Gwyneth', Name: 'Gwyneth', Engine: 'standard' },
    { Id: 'Zhiyu', Name: 'Zhiyu', Engine: 'neural' },
    { Id: 'Zeina', Name: 'Zeina', Engine: 'standard' },
    { Id: 'Hala', Name: 'Hala', Engine: 'neural' },
    { Id: 'Arlet', Name: 'Arlet', Engine: 'neural' },
    { Id: 'Hannah', Name: 'Hannah', Engine: 'neural' },
    { Id: 'Ruth', Name: 'Ruth', Engine: 'neural' },
    { Id: 'Stephen', Name: 'Stephen', Engine: 'neural' },
    { Id: 'Kajal', Name: 'Kajal', Engine: 'neural' },
    { Id: 'Hiujin', Name: 'Hiujin', Engine: 'neural' },
    { Id: 'Suvi', Name: 'Suvi', Engine: 'neural' },
    { Id: 'Arthur', Name: 'Arthur', Engine: 'neural' },
    { Id: 'Daniel', Name: 'Daniel', Engine: 'neural' },
    { Id: 'Liam', Name: 'Liam', Engine: 'neural' },
    { Id: 'Pedro', Name: 'Pedro', Engine: 'neural' },
    { Id: 'Sergio', Name: 'Sergio', Engine: 'neural' },
    { Id: 'Andres', Name: 'Andrés', Engine: 'neural' },
    { Id: 'Remi', Name: 'Rémi', Engine: 'neural' },
    { Id: 'Adriano', Name: 'Adriano', Engine: 'neural' },
    { Id: 'Thiago', Name: 'Thiago', Engine: 'neural' }
]

function getEngineByName(name, array) {
    const person = array.find(item => item.Name === name);
    return person ? person.Engine : null;
}


function genVoice(keys, id, req) {
    return new Promise(async (resolve) => {
        try {
            AWS.config.update({
                region: 'us-west-2', // Replace with your desired AWS region
                accessKeyId: id,
                secretAccessKey: keys
            });

            const Polly = new AWS.Polly();

            const params = {
                OutputFormat: 'mp3',
                SampleRate: '8000',
                Text: req.body.text,
                TextType: 'text',
                VoiceId: req.body.selVoice,
                Engine: getEngineByName(req.body.selVoice, voiceArr)
            };
            console.log({ params })
            const data = await Polly.synthesizeSpeech(params).promise();

            const dirName = process.cwd();
            const randomName = Date.now();

            const outputFileName = `${dirName}/client/public/speeches/${randomName}.mp3`;

            fs.writeFileSync(outputFileName, data.AudioStream);

            // adding it to database

            await query(`INSERT INTO tts (filename, uid, text, title, language, voice) VALUES (?, ?, ?, ?, ?, ?)`, [
                `${randomName}.mp3`, req.decode.uid, req.body.text, req.body.title, req.body.selectedLang, req.body.selVoice
            ]);

            resolve({ success: true, msg: "Your voice was generated" });

        } catch (err) {
            console.log(JSON.stringify(err));
            resolve({ err, success: false, msg: "Cannot generate voice" });
        }
    });
}


export { genVoice }