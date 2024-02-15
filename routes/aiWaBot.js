import query from '../database/dbpromise.js';
import {
    decodeObject,
    openAiText,
    getWordCount,
    createPathAndFileIfNotExists,
    readAndProcessConversations,
    checkDatabase,
    openAitextWABot,
} from '../functions/function.js';
import { deleteSession, getSession, sendMessage } from '../middlewares/req.js';

const dir = process.cwd(); // Use const for constants


function extractNumbersBeforeAt(str) {
    // Using a regular expression to match and extract numbers before '@'
    const match = str.match(/^(\d+)@/);

    // Check if there is a match and return the extracted numbers, or null if no match
    return match ? match[1] : null;
}

async function returnTrainText(bot) {
    try {
        let retTrain = {};

        if (bot.train_type === 'TEXT') {
            retTrain = {
                success: true,
                trainData: bot.text_train_data?.toLowerCase(),
            };
        } else if (bot.train_type === 'SQL') {
            const sqlData = JSON.parse(bot?.sql_connection);
            const getres = await checkDatabase(
                sqlData?.username,
                sqlData?.password,
                sqlData?.database,
                sqlData?.ip,
                sqlData?.port,
                sqlData?.table
            );

            retTrain = getres.success
                ? { success: true, trainData: JSON.stringify(getres?.data) }
                : { success: false, msg: getres?.msg };
        } else {
            retTrain = {
                success: true,
                trainData: bot?.doc_text_train || `Say 'something went wrong'`,
            };
        }

        return retTrain;
    } catch (error) {
        console.error('An error occurred:', error);
        return { success: false, msg: 'An unexpected error occurred.' };
    }
}

function replacePlaceholders(originalText, username, mobile) {
    // Replace {{USERNAME}} with the provided username
    let textWithUsername = originalText.replace(/\{\{USERNAME\}\}/g, username);

    // Replace {{MOBILE}} with the provided mobile number
    let textWithMobile = textWithUsername.replace(/\{\{MOBILE\}\}/g, mobile);

    return textWithMobile;
}

const webhookWa = async (m, wa, sessionId) => {
    try {
        const { uid, client_id } = decodeObject(sessionId);
        const getBots = await query(`SELECT * FROM wa_ai_bot WHERE client_id = ? and active = ?`, [sessionId, 1]);

        if (getBots.length < 1) {
            return;
        }

        const bot = getBots[0];
        const isActive = bot.active === 1;

        if (!isActive) {
            return;
        }

        const latestUser = await query(`SELECT * FROM user WHERE uid = ?`, [uid]);
        const leftWords = latestUser[0]?.gpt_words_limit;

        const senderJid = m.messages[0]?.key?.remoteJid || m.messages[0]?.key?.participant

        if (parseInt(leftWords) < 10) {
            await query(`UPDATE wa_ai_bot SET active = ? WHERE uid = ?`, [0, uid]);
            const session = getSession(sessionId);

            try {
                await session.logout();
            } catch {
            } finally {
                deleteSession(sessionId, session.isLegacy);
            }
            console.log(`User ${uid} found less than 10 messages, so deleting the instance and AI bot.`);
            return;
        }

        const convoPath = `${dir}/bot/${uid}/${senderJid}/convo.json`
        const replyInGroup = parseInt(bot.reply_in_groups) > 0 ? true : false

        const question = m.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text
        const isMgsGroup = m.messages[0]?.message?.senderKeyDistributionMessage ? true : false

        const pushName = m.messages[0]?.pushName



        if (isMgsGroup && !replyInGroup) {
            console.log("message in group however it was turned of in the bot")

            return
        }
        // sending for unknown message 
        if (!question) {
            if (!bot.group_id) {
                console.log("Found unknown msg ignored as no group id found ", question)

                return
            }
            const getGroupMsg = await query(`SELECT * FROM custom_reply_flow WHERE group_id = ?`, [bot.group_id])
            const getUnknownMsg = getGroupMsg.filter((i) => i.incoming_message === "{{UNKNOWN_MSG}}")
            const session = getSession(sessionId);

            Promise.all(getUnknownMsg.map(async (i) => {
                let mobileNumber = extractNumbersBeforeAt(senderJid); // Replace with your actual logic for mobile number

                let text = (i && i.outgoing_message
                    ? replacePlaceholders(i.outgoing_message, pushName, mobileNumber)
                    : "~something went wrong 00UH~");

                await sendMessage(session, senderJid, { text });
            })).then(() => {
                console.log('All messages sent successfully');
            }).catch((error) => {
                console.error('Error sending messages:', error);
            });
        }

        // create filepath if not exist 
        await createPathAndFileIfNotExists(convoPath)

        // getting the old convo 
        const oldConvoJson = await readAndProcessConversations(convoPath)

        if (!oldConvoJson.success) {
            return console.log("Error found in oldConvoJson()")
        }

        const getTraiData = await returnTrainText(bot)

        if (!getTraiData.success) {
            const session = getSession(sessionId);
            await sendMessage(session, senderJid, { text: getTraiData?.msg || "~something went wrong~" });
        }

        // repling for custom messages 
        const sendCustomRep = await replyCustom(bot, sessionId, question, senderJid, pushName)

        if (sendCustomRep.success) {
            return
        }

        const useMyAPI = latestUser[0]?.use_my_openai
        const myOwnAPI = latestUser[0]?.my_openai_api

        const userPlan = JSON.parse(latestUser[0]?.plan)
        const useMineInPlan = userPlan?.allow_own_openai > 0 ? true : false

        if (useMineInPlan && !myOwnAPI) {
            const session = getSession(sessionId);
            await sendMessage(session, senderJid, { text: "**WARNING** Your plan allows you to use your own API however your API KEYS are not there in your panel" });

            return
        }

        const getAPI = await query(`SELECT * FROM apikeys`, [])

        const passAPI = useMineInPlan ? myOwnAPI : getAPI[0]?.openai_keys

        const trainingData = `${bot?.train_data_instruction}: ${getTraiData?.trainData}`

        const openAiRes = await openAitextWABot(convoPath, question, trainingData, passAPI, bot?.openai_model || "gpt-4")

        if (openAiRes.success) {
            const wordCount = useMyAPI && myOwnAPI ? 0 : openAiRes?.spent || 0;
            console.log("Word count:", wordCount);

            const session = getSession(sessionId);
            const mobile = m.messages[0]?.key?.remoteJid;

            // add reaction function here   
            if (bot.reaction) {
                const reactionMessage = {
                    react: {
                        text: bot.reaction,
                        key: m.messages[0].key
                    }
                };
                await sendMessage(session, mobile, reactionMessage);
            }

            if (bot.enable_typing === 1) {
                wa.sendPresenceUpdate('composing', mobile);

                setTimeout(() => {
                    wa.sendPresenceUpdate('paused', mobile);
                }, 1000);
            }

            // sending message 
            await sendMessage(session, mobile, { text: openAiRes.reply });

            const updateMsg = parseInt(latestUser[0].gpt_words_limit) - parseInt(wordCount);

            await query(`UPDATE user SET gpt_words_limit = ? WHERE uid = ?`, [updateMsg, uid]);


            return
        } else {
            console.log(JSON.stringify(openAiRes));


            return
        }

    } catch (err) {
        console.log(err);
    }
};

async function replyCustom(bot, sessionId, question, senderJid, pushName) {
    const getReplies = await query(`SELECT * FROM custom_reply_flow WHERE group_id = ?`, [bot.group_id]);

    if (getReplies.length < 1) {
        return { success: false };
    }

    const session = getSession(sessionId);
    const findReply = getReplies.filter((i) => i.incoming_message?.toLowerCase() === question?.toLowerCase());

    if (findReply.length === 0) {
        console.log('No custom reply found.');
        return { success: false };
    }

    try {
        const sendMessagePromises = findReply.map(async (ii) => {
            console.log({ pushName2: pushName })
            await sendMessage(session, senderJid, {
                text: replacePlaceholders(ii.outgoing_message, pushName, extractNumbersBeforeAt(senderJid)) || '~something went wrong 00UH~',
            });
        });

        await Promise.all(sendMessagePromises);
        console.log('All messages sent successfully');
        return { success: true };
    } catch (error) {
        console.error('Error sending messages:', error);
        return { success: false };
    }
}

export { webhookWa };
