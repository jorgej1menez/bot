import query from '../database/dbpromise.js'
import { decodeObject, openAiText, getWordCount, createPathAndFileIfNotExists, getReplFromGemini } from '../functions/function.js'
import { deleteSession, getSession, sendMessage } from '../middlewares/req.js'


const webhookBard = async (m, wa, sessionId) => {
    return new Promise(async (resolve, reject) => {
        try {

            const dir = process.cwd()
            const { uid, client_id } = decodeObject(sessionId)


            // getting active bots 
            const getBots = await query(`SELECT * FROM gemini_chatbot WHERE client_id = ? and active = ?`, [sessionId, 1])

            if (getBots.length < 1) {
                return resolve()
            }

            const bot = getBots[0]
            const senderJid = m.messages[0]?.key?.remoteJid || m.messages[0]?.key?.participant
            const question = m.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text
            const isMgsGroup = m.messages[0]?.message?.senderKeyDistributionMessage ? true : false

            const checkIfGroupAlowed = bot?.reply_in_groups

            if (parseInt(checkIfGroupAlowed) < 1 && isMgsGroup) {
                console.log("Message is group but not allowed")
                return resolve()
            }

            // get plans 
            const getPlan = await query(`SELECT * FROM user WHERE uid = ?`, [uid])
            const plan = getPlan[0]?.plan ? JSON.parse(getPlan[0]?.plan) : {}

            console.log({ plan: plan.gemini_chatbot })

            if (!plan || parseInt(plan.gemini_chatbot) < 1 || plan.gemini_chatbot === undefined) {
                const session = getSession(sessionId)
                const mobile = m.messages[0]?.key?.remoteJid

                await sendMessage(session, mobile, { text: "Your plan does not allowed to use Gemini" })

                console.log(`user ${uid} found no gemini chatbot in plan or plan expired`)
                resolve()
                return
            }


            const convoPath = `${dir}/gemini/${uid}/${senderJid}/convo.json`
            const finalQue = `Please answer based on this only '${bot?.text_train_data}' and reply answers only not based on your data and all just give answers.`

            const getReply = await getReplFromGemini(convoPath, finalQue, question, getPlan[0]?.gemini_keys)

            const session = getSession(sessionId)
            const mobile = m.messages[0]?.key?.remoteJid

            // add reaction function here   
            if (bot.reaction) {
                const reactionMessage = {
                    react: {
                        text: bot.reaction,
                        key: m.messages[0].key
                    }
                }
                const a = await sendMessage(session, mobile, reactionMessage)
            }

            if (bot.enable_typing === 1) {
                wa.sendPresenceUpdate('composing', mobile)

                setTimeout(() => {
                    wa.sendPresenceUpdate('paused', mobile)
                }, 1000);
            }

            // sending message 
            await sendMessage(session, mobile, { text: getReply.reply })

            resolve()

        } catch (err) {
            console.log(err)
        }
    })

}

export { webhookBard }