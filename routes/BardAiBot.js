import query from '../database/dbpromise.js';
import { decodeObject, checkDatabase, daysDiff } from '../functions/function.js';
import { deleteSession, downloadMediaMessage, getSession, sendMessage } from '../middlewares/req.js';
import { getImageReplyFromBard, getReplyFromBard } from './chatting/function.js';
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

async function downloadAndSaveImages(images) {
    const downloadFolder = 'bardimages';

    // Create the folder if it doesn't exist
    if (!fs.existsSync(downloadFolder)) {
        fs.mkdirSync(downloadFolder);
    }

    const downloadedImages = [];

    for (const image of images) {
        try {
            const response = await fetch(image.link);

            if (!response.ok) {
                throw new Error(`Failed to download image "${image.caption}". Status: ${response.status}`);
            }

            const imageBuffer = await response.buffer();

            // Extract file extension from the URL
            const fileExtension = path.extname(image.link);

            // Generate a unique filename
            const imageName = `image_${Date.now()}${fileExtension}`;

            // Save the image locally
            const imagePath = path.join(downloadFolder, imageName);
            fs.writeFileSync(imagePath, imageBuffer);

            // Add image details to the result array
            downloadedImages.push({
                caption: image.caption,
                link: image.link,
                imageName: imageName,
            });

            console.log(`Image "${image.caption}" saved successfully as ${imageName}`);
        } catch (error) {
            console.error(`Error downloading image "${image.caption}": ${error.message}`);
        }
    }

    return downloadedImages;
}

function saveImageToFile(imageBuffer, filePath) {
    try {
        // Save the image buffer to a file
        fs.writeFileSync(filePath, imageBuffer);

        console.log(`Image saved successfully as ${filePath}`);
    } catch (error) {
        console.error(`Error saving image: ${error.message}`);
    }
}

// Function to extract images and text from input text
const extractImagesAndText = (inputText) => {
    // Regular expression to find image URLs and associated text
    const regex = /!\[([^\]]*)]\(([^)]+)\)/g;

    // Array to store image links with captions
    const images = [];

    // Find all matches in the text
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(inputText)) !== null) {
        // Push the image link and caption to the array
        images.push({
            link: match[2],
            caption: match[1],
        });
        // Update lastIndex to the end of the current match
        lastIndex = match.index + match[0].length;
    }

    // If there are no images, the remaining text is the input text
    const remainingText = lastIndex === 0 ? inputText : inputText.substring(0, lastIndex);

    // Remove identified image links from the remaining text
    const cleanedRemainingText = images.reduce((text, image) => {
        return text.replace(`![${image.caption}](${image.link})`, '');
    }, remainingText);

    return { images, remainingText: cleanedRemainingText.trim() };
};

// Webhook function
const webhookWaBard = async (m, wa, sessionId) => {
    try {
        console.log("Bard msg arrive")
        const { uid, client_id } = decodeObject(sessionId);
        const getBots = await query(`SELECT * FROM bard_wa_chatbot WHERE client_id = ? and active = ?`, [sessionId, 1]);

        if (getBots.length < 1) {
            console.log({ getBots })
            console.log("NO bots found")
            return;
        }

        const bot = getBots[0];
        const isActive = bot.active === 1;

        if (!isActive) {
            return;
        }

        const latestUser = await query(`SELECT * FROM user WHERE uid = ?`, [uid]);
        const getPlan = latestUser[0]?.plan

        if (!getPlan) {
            return
        }

        const plan = JSON.parse(getPlan)
        const bardAllowed = plan?.bard_access > 0 ? true : false

        if (!bardAllowed) {
            return
        }


        const senderJid = m.messages[0]?.key?.remoteJid || m.messages[0]?.key?.participant
        const question = m.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text || m?.messages[0]?.message?.imageMessage
        const isMgsGroup = m.messages[0]?.message?.senderKeyDistributionMessage ? true : false

        const replyInGroup = bot.send_in_group > 0 ? true : false


        if (!question) {
            console.log({ question, msg: JSON.stringify(m.messages[0]) })
            console.log("No question was found")
            return
        }

        if (!latestUser[0]?.bard_one || !latestUser[0]?.bard_two || !latestUser[0].bard_three) {
            const session = getSession(sessionId);
            return await sendMessage(session, senderJid, { text: "**ALERT** API keys not found" });
        }

        const bardApiKeys = {
            "__Secure-1PSIDCC": latestUser[0]?.bard_one,
            "__Secure-1PSIDTS": latestUser[0]?.bard_two,
            "__Secure-1PSID": latestUser[0]?.bard_three
        }

        if (isMgsGroup && !replyInGroup) {
            console.log("message in group however it was turned of in the bot")
            return
        }

        const daysLeft = daysDiff(latestUser[0].planexpire)
        if (daysLeft < 1) {
            await query(`UPDATE bard_wa_chatbot SET active = ? WHERE uid = ?`, [0, uid])
            const session = getSession(sessionId);

            try {
                await session.logout();
            } catch {
            } finally {
                deleteSession(sessionId, session.isLegacy);
            }
            console.log("PLAN WAS EXPIRED")
            return
        }

        if (m?.messages[0]?.message?.imageMessage) {

            const bufferMsg = await downloadMediaMessage(m.messages[0], 'buffer', {}, {})
            const dateRandom = Date.now()
            const randomName = `${dateRandom}.png`
            const dir = process.cwd()
            const filePath = `${dir}/bardimages/${randomName}`

            saveImageToFile(bufferMsg, filePath)

            const response = await getImageReplyFromBard(m?.messages[0]?.message?.imageMessage?.caption || "describe this image", filePath, bardApiKeys)
            if (response.success) {

                const session = getSession(sessionId);

                const convertReply = extractImagesAndText(response?.reply)

                if (convertReply.images.length < 1) {
                    await sendMessage(session, senderJid, { text: response?.reply });
                } else {

                    const bufferImgArr = await downloadAndSaveImages(convertReply?.images)

                    // const imgArr = convertReply.images
                    const dir = process.cwd()

                    Promise.all(bufferImgArr.map(async (item) => {
                        await sendMessage(session, senderJid, {
                            image: {
                                url: `${dir}/bardimages/${item.imageName}`,
                                caption: item.caption
                            }
                        });
                    })).then(async () => {
                        if (convertReply.remainingText.length > 2) {
                            await sendMessage(session, senderJid, {
                                text: convertReply.remainingText
                            })
                        }
                    })
                }

            } else {
                console.log({ response })
                const session = getSession(sessionId);
                await sendMessage(session, senderJid, { text: "*ALERT* Either your API incorrect or expired." });
                return
            }

        } else {
            const response = await getReplyFromBard(question, bardApiKeys)

            console.log({ response })

            if (response.success) {

                const session = getSession(sessionId);

                const convertReply = extractImagesAndText(response?.reply)

                if (convertReply.images.length < 1) {
                    await sendMessage(session, senderJid, { text: response?.reply });
                } else {

                    const bufferImgArr = await downloadAndSaveImages(convertReply?.images)

                    // const imgArr = convertReply.images
                    const dir = process.cwd()

                    Promise.all(bufferImgArr.map(async (item) => {
                        await sendMessage(session, senderJid, {
                            image: {
                                url: `${dir}/bardimages/${item.imageName}`,
                                caption: item.caption
                            }
                        });
                    })).then(async () => {
                        if (convertReply.remainingText.length > 2) {
                            await sendMessage(session, senderJid, {
                                text: convertReply.remainingText
                            })
                        }
                    })
                }

            } else {
                console.log({ response })
                const session = getSession(sessionId);
                await sendMessage(session, senderJid, { text: "*ALERT* Either your API incorrect or expired." });
                return
            }

        }



    } catch (err) {
        console.log(err);
    }
};

// Export the functions
export { webhookWaBard };