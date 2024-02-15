import query from '../database/dbpromise.js'
import fetch from 'node-fetch'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import fs from 'fs'
import { OpenAIApi, Configuration } from 'openai'
import path, { resolve } from 'path'
import Jimp from 'jimp'

// request hamwiz text to image 
async function makeTextImg(prompt, negative_prompt, model, bearerToken) {
    // URL for the POST request
    const url = 'https://hamwiz.com/api/v1/user/text-to-image'; // Replace with your actual API endpoint

    // Data to be sent in the request body
    const data = {
        prompt: prompt,
        negative_prompt: negative_prompt,
        model: model,
        size: process.env.HAMWIZ_SIZE || "512x512"
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerToken}`,
            },
            body: JSON.stringify(data),
        });

        // Check if the request was successful (status code 2xx)
        if (response.ok) {
            const responseData = await response.json();
            return responseData;
        } else {
            // Handle error cases, e.g., log the error or throw an exception
            console.error(`Error: ${response.statusText}`);
            throw new Error(`Failed to make POST request. Status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error during POST request:', error.message);
        throw error; // Propagate the error to the caller
    }
}

// download text2Img 

async function downloadImage(imageSource, savePath) {
    try {
        const response = await fetch(imageSource);

        if (!response.ok) {
            throw new Error(`Failed to download image. Status: ${response.status}`);
        }

        const buffer = await response.buffer();

        // Create the directory if it doesn't exist
        const directory = path.dirname(savePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        // Write the buffer to the file
        fs.writeFileSync(savePath, buffer);

        console.log(`Image downloaded and saved to: ${savePath}`);
    } catch (error) {
        console.error('Error during image download:', error.message);
        throw error; // Propagate the error to the caller
    }
}


async function downloadAiAvatar(jobID, type, bearerToken) {
    // URL for the POST request
    const url = `https://hamwiz.com/api/v1/user/download-job?type=${type}&job=${jobID}`; // Replace with your actual API endpoint

    const data = {
        job_id: jobID,
        type: type
    };

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerToken}`,
            },
        });

        // Check if the request was successful (status code 2xx)
        if (response.ok) {
            const responseData = await response.json();

            if (responseData.message === "Invalid job found") {
                await query(`DELETE FROM hamWiz_avatar WHERE job_id = ?`, [jobID])
                await query(`DELETE FROM hamWiz_upscale WHERE job_id = ?`, [jobID])
            }

            return responseData;
        } else {
            // Handle error cases, e.g., log the error or throw an exception
            console.error(`Error: ${response.statusText}`);
            throw new Error(`Failed to make POST request. Status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error during POST request:', error.message);
        throw error; // Propagate the error to the caller
    }

}

async function downloadText2Img(jobID, bearerToken) {
    // URL for the POST request
    const url = 'https://hamwiz.com/api/v1/user/check-text-to-image'; // Replace with your actual API endpoint

    // Data to be sent in the request body
    const data = {
        job_id: jobID
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerToken}`,
            },
            body: JSON.stringify(data),
        });

        // Check if the request was successful (status code 2xx)
        if (response.ok) {
            const responseData = await response.json();
            return responseData;
        } else {
            // Handle error cases, e.g., log the error or throw an exception
            console.error(`Error: ${response.statusText}`);
            throw new Error(`Failed to make POST request. Status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error during POST request:', error.message);
        throw error; // Propagate the error to the caller
    }
}

async function uploadAndCropImage(file, savePath) {
    try {
        if (!file || !savePath) {
            return { success: false, msg: 'Please provide a valid file and save path.' };
        }

        // Check if file is an image
        if (!file.mimetype.startsWith('image/')) {
            return { success: false, msg: 'Invalid file type. Only images are allowed.' };
        }

        // Save the image to the specified path
        await fs.writeFile(savePath, file.data);

        return { success: true, msg: 'Image uploaded successfully.' };
    } catch (err) {
        console.error('Error during image upload:', err.message);
        return { success: false, msg: 'Internal server error' };
    }
}


async function createUpscale(image, bearerToken) {
    const apiUrl = `https://hamwiz.com/api/v1/user/add-task-image-upscale`

    const response = await fetch(`${apiUrl}?image=${encodeURIComponent(image)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;
}

async function createAvatarImages(faceUrl, bodyUrl, bearerToken) {
    const apiUrl = 'https://hamwiz.com/api/v1/user/add-task-ai-avatar'; // Replace with your actual API endpoint

    const response = await fetch(`${apiUrl}?face=${encodeURIComponent(faceUrl)}&body=${encodeURIComponent(bodyUrl)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bearerToken}`,
        },
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const jsonResponse = await response.json();
    return jsonResponse;
}


export { makeTextImg, downloadText2Img, downloadAiAvatar, createUpscale, createAvatarImages, downloadImage, uploadAndCropImage }