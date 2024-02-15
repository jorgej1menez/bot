import { Router } from 'express'
import validateAdmin from '../middlewares/adminValidator.js'
import validateUser from '../middlewares/userValidator.js'
import { checkIfPlanExpire, checkEmbedLimit, checkGptWordsLimit, makingDecode } from '../middlewares/planValidator.js'
import query from '../database/dbpromise.js'
import { createJsonFileEmbed } from '../functions/function.js'
import { readJsonFile, returnPost, deleteFilePathIfExists, readJsonOldChat, getWordCount, readJsonArray } from './chatting/function.js'
import { genVoice } from './speech/function.js'
import { pushObjectToArrayAndDeleteOld } from '../functions/function.js'
import randomstring from 'randomstring'

const router = Router()

router.post('/add', validateUser, checkIfPlanExpire, checkEmbedLimit, async (req, res) => {
    try {
        const body = req.body
        const botId = randomstring.generate(18)
        await query(`INSERT INTO embed_chatbot (
        uid,
        active,
        train_data,
        title,
        bot_id
    ) VALUES (
        ?,?,?,?,?
    )`, [req.decode.uid, 1, body.train_data, body.title, botId])

        res.json({ msg: "Your embed bot was added", success: true })
    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// get all by user 
router.get('/get', validateUser, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM embed_chatbot WHERE uid = ?`, [req.decode.uid])
        res.json({ data: data, success: true })

    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// del one 
router.post('/del', validateUser, async (req, res) => {
    try {
        await query(`DELETE FROM embed_chatbot WHERE uid = ? and id = ?`, [req.decode.uid, req.body.id])
        res.json({ msg: "The bot was deleted" })

    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// getting bot data 
router.post('/get_bot', async (req, res) => {
    try {
        const data = await query(`SELECT * FROM embed_chatbot WHERE bot_id = ?`, [req.body.botId])

        const user = await query(`SELECT * FROM user WHERE uid = ?`, [req.body.uid])

        if (data.length > 0 && user.length > 0) {
            res.json({ data: data[0], success: true })
        } else {
            res.json({ data, success: false })
        }

    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// create chat env 
router.post('/create_chat', async (req, res) => {
    try {
        const body = req.body
        if (!body.botId || !body.uid || !body.user_email || !body.user_mobile || !body.user_name) {
            return res.json({ msg: "Please send all required fields" })
        }

        // get if email exisit 
        const findExt = await query(`SELECT * FROM embed_chats WHERE user_email = ?`, [body.user_email])
        const dirName = process.cwd()

        if (findExt.length < 1) {

            const dirName = process.cwd()
            createJsonFileEmbed(`${dirName}/embed/${body.uid}/${body.user_email}.json`, [])

            await query(`INSERT INTO embed_chats (uid, user_email, user_mobile, user_name, bot_id, chat_id) VALUES (?,?,?,?,?,?)`, [
                body.uid,
                body.user_email,
                body.user_mobile,
                body.user_name,
                body.botId,
                body.chatId
            ])
            res.json({ msg: "Chat was started", success: true, data: [] })
            return
        }


        const getJson = await readJsonOldChat(`${dirName}/embed/${body.uid}/${body.user_email}.json`)
        res.json({ msg: "Chat was started", success: true, data: getJson.length > 0 ? getJson : [] })

    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

router.post('/get_reply', makingDecode, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {

        const body = req.body
        const embedBot = parseInt(req.plan.embed_chatbot) > 0 ? true : false

        if (!embedBot) {
            return res.json({
                msg: "Your plan does not allowed you to use Embed Bot"
            })
        }
        const dirName = process.cwd()
        const createNewChatFile = `${dirName}/embed/${body.uid}/${body.user_email}.json`



        if (!body.question) {
            return res.json({ msg: "Please type something" })
        }

        const finalQue = `train data is  : "${body.train_data}"\nquestion is: "${body?.question}"\nsend answer based on the train data and do not mention that you are ai model or anything related to ai just answer based on the train data. remember the question send by user and answer in short`
        const questionObj = {
            role: 'user',
            content: finalQue || ""
        }
        console.log("three")
        // adding question to path 
        await pushObjectToArrayAndDeleteOld(createNewChatFile, questionObj)

        // getting latest convo data 
        const getJson = await readJsonFile(createNewChatFile)

        const replyReply = await returnPost(getJson)

        if (replyReply.success) {
            const newObj = {
                role: 'assistant',
                content: replyReply.reply
            }

            // adding question to path 
            await pushObjectToArrayAndDeleteOld(createNewChatFile, newObj)
            res.json({ success: true, data: replyReply.reply })

            const wordCount = replyReply?.spent || 0
            console.log("Word count:", wordCount);

            const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
            const updateMsg = parseInt(getUser[0].gpt_words_limit) - parseInt(wordCount)
            await query(`UPDATE user SET gpt_words_limit = ? WHERE uid = ?`, [updateMsg, req.decode.uid])
        } else {
            res.json({ success: false, msg: "Failed to get response from AI" })
        }


    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})


// get all chats 
router.get('/get_embed_chats', validateUser, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM embed_chats WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })
    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})


// del setup bot by user 
router.post('/del_bot', validateUser, async (req, res) => {
    try {
        console.log(req.body)
        await query(`DELETE FROM embed_chatbot WHERE id = ?`, [req.body.id])
        res.json({ msg: "Bot was deleted", success: true })
    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// del chats 
router.post('/del_chat', validateUser, async (req, res) => {
    try {
        await query(`DELETE FROM embed_chats WHERE user_email = ?`, [req.body.email])
        const dirName = process.cwd()
        deleteFilePathIfExists(`${dirName}/embed/${req.decode.uid}/${req.body.email}.json`)
        res.json({ success: true, msg: "Chat was deleted" })
    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

// read chats 
router.post('/read_chat', validateUser, async (req, res) => {
    try {
        const dirName = process.cwd()
        const pathString = `${dirName}/embed/${req.decode.uid}/${req.body.email}.json`

        const data = await readJsonArray(pathString)

        res.json({ data, success: true })
    } catch (err) {
        res.json({ mgs: "server error" })
        console.log(err)
    }
})

export default router
