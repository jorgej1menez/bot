import query from '../../database/dbpromise.js'
import fetch from 'node-fetch'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import fs from 'fs'
import { OpenAIApi, Configuration } from 'openai'
import path from 'path'
import Bard from './functionNew.js'

function deleteFilePathIfExists(filePath) {
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('File does not exist. Ignoring file deletion.');
            return;
        }

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('File deleted successfully!');
        });
    });
}

function getReplyFromBard(question, api) {
    return new Promise(async (resolve) => {
        try {
            let bot = new Bard(api);

            let reply = await bot.ask(question)
            resolve({ success: true, reply })

        } catch (err) {
            console.log(err)
            resolve({ msg: "Something went wrong, Try again later", err })
        }
    })
}

function getImageReplyFromBard(question, imagePath, api) {
    return new Promise(async (resolve) => {
        try {
            let bot = new Bard(api);

            let reply = await bot.ask(question, {
                format: Bard.JSON,
                image: imagePath,
                // ids: {},
            })
            resolve({ success: true, reply: reply?.content })

        } catch (err) {
            console.log(err)
            resolve({ msg: "Something went wrong, Try again later", err })
        }
    })
}


function createFilePath(filePath) {
    return new Promise((resolve, reject) => {
        // Check if the file path exists
        if (!fs.existsSync(filePath)) {
            // Create the directory path if it doesn't exist
            const directory = path.dirname(filePath);
            if (!fs.existsSync(directory)) {
                fs.mkdir(directory, { recursive: true }, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Create the file with an empty array
                        fs.writeFile(filePath, '[]', (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(`File created at ${filePath}`);
                            }
                        });
                    }
                });
            } else {
                // Create the file with an empty array
                fs.writeFile(filePath, '[]', (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(`File created at ${filePath}`);
                    }
                });
            }
        } else {
            resolve(`File already exists at ${filePath}`);
        }
    });
}


function pushObjectToArrayAndDeleteOld(filePath, newObject) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err); // Reject with the error if reading the file fails
                return;
            }

            let json;
            try {
                json = JSON.parse(data);
            } catch (error) {
                reject(error); // Reject if the file content is not valid JSON
                return;
            }

            if (!Array.isArray(json)) {
                reject(new Error('File does not contain an array')); // Reject if the JSON is not an array
                return;
            }

            json.push(newObject); // Push the new object into the array

            if (json.length > 1000) {
                json = json.slice(-1000); // Keep the last 30 objects
            }

            const updatedJson = JSON.stringify(json, null, 2);

            fs.writeFile(filePath, updatedJson, 'utf8', (error) => {
                if (error) {
                    reject(error); // Reject with the error if writing to the file fails
                } else {
                    resolve(); // Resolve if the object is successfully pushed and old objects are deleted
                }
            });
        });
    });
}

function readJsonFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    const latestObjects = jsonData.slice(-10);
                    resolve(latestObjects);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

function readJsonOldChat(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    const latestObjects = jsonData.slice(-40);
                    resolve(latestObjects);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

function readJsonArray(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // File does not exist, return empty array
                    resolve([]);
                } else {
                    // Other error occurred
                    reject(err);
                }
            } else {
                try {
                    const jsonArray = JSON.parse(data);
                    if (Array.isArray(jsonArray)) {
                        // Limit the number of messages to 200
                        const limitedArray = jsonArray.slice(0, 300);
                        resolve(limitedArray);
                    } else {
                        reject(new Error('Invalid JSON data. Expected an array.'));
                    }
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}


function returnPost(promptArr) {

    return new Promise(async (resolve) => {
        try {
            const api = await query(`SELECT * FROM apikeys`, []);
            const openAiApi = api[0].openai_keys;

            const configuration = new Configuration({
                apiKey: openAiApi
            });


            const openai = new OpenAIApi(configuration);

            console.log({ promptArr })

            const completion = await openai.createChatCompletion({
                model: process.env.OPENAIMODEL || "gpt-3.5-turbo",
                messages: promptArr
            });

            const completion_text = completion?.data?.choices[0]?.message.content;
            const spent = completion?.data?.usage?.total_tokens
            // console.log({ completion_text });`

            resolve({ reply: completion_text, success: true, spent: spent });
        } catch (err) {
            // console.log(JSON.stringify(err))
            resolve({ blog: "", success: false, err });
        }
    });
}


function getWordCount(sentence) {
    // Remove leading and trailing whitespace
    sentence = sentence.trim();

    // Split the sentence by whitespace and count the resulting array length
    const words = sentence.split(/\s+/);
    return words.length;
}

export { createFilePath, deleteFilePathIfExists, getImageReplyFromBard, readJsonOldChat, getReplyFromBard, returnPost, readJsonArray, pushObjectToArrayAndDeleteOld, readJsonFile, getWordCount }