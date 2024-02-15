import query from '../database/dbpromise.js'
import { decodeObject, openAiText, getWordCount } from '../functions/function.js'
import { deleteSession, getSession, sendMessage } from '../middlewares/req.js'


const webhook = async (m, wa, sessionId) => {
    return new Promise(async (resolve, reject) => {
        try {

            console.log({
                msg: JSON.stringify(m.messages[0])
            })

            return resolve()


            const dir = process.cwd()
            const { uid, client_id } = decodeObject(sessionId)


            // getting active bots 
            const getBots = await query(`SELECT * FROM aibot WHERE client_id = ? and active = ?`, [sessionId, 1])

            if (getBots.length < 1) {
                return resolve()
            }

            const bot = getBots[0]
            const isActive = bot.active === 1 ? true : false

            if (!isActive) return resolve()


            const latestUser = await query(`SELECT * FROM user WHERE uid = ?`, [uid])

            const leftWords = latestUser[0]?.gpt_words_limit
            console.log({ limit: latestUser[0]?.gpt_words_limit })

            if (parseInt(leftWords) < 10) {
                // deleting bot 
                await query(`DELETE FROM aibot WHERE uid = ?`, [uid])

                const session = getSession(sessionId)
                try {
                    await session.logout()
                } catch {
                } finally {
                    deleteSession(sessionId, session.isLegacy)
                }
                console.log(`user ${uid} found less than 10 message so deleting the instance and ai bot`)
                resolve()
                return
            }



            const convoPath = `${dir}/bot/${uid}/convo.json`
            const question = m.messages[0]?.message?.conversation || m.messages[0]?.message?.extendedTextMessage?.text || "bye"

            const finalQue = `train data is  : "${bot.train_data}"\nquestion is: "${question}"\nsend answer based on the train data and do not mention that you are ai model or anything related to ai just answer based on the train data. remember the question send by user and answer in short`

            const openAiRes = await openAiText(convoPath, finalQue)

            if (openAiRes.success) {
                const wordCount = getWordCount(openAiRes.reply);
                console.log("Word count:", wordCount);

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
                await sendMessage(session, mobile, { text: openAiRes.reply })

                const updateMsg = parseInt(latestUser[0].gpt_words_limit) - parseInt(wordCount)

                await query(`UPDATE user SET gpt_words_limit = ? WHERE uid = ?`, [updateMsg, uid])
                resolve()
            } else {
                console.log(JSON.stringify(openAiRes))
                resolve()
            }

        } catch (err) {
            console.log(err)
        }
    })

}



export { webhook }