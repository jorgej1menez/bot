import validateAdmin from '../middlewares/adminValidator.js'
import { checkIfPlanExpire, checkGptWordsLimit } from '../middlewares/planValidator.js'
import { Router } from 'express'
import query from '../database/dbpromise.js'
import validateUser from '../middlewares/userValidator.js'
import { pushObjectToArrayAndDeleteOld } from '../functions/function.js'
import { createFilePath, returnPost, readJsonFile, readJsonArray, getWordCount } from './chatting/function.js'

const router = Router()

// add new category 
router.post('/add_chatbot_category', validateAdmin, async (req, res) => {
    try {
        await query(`INSERT INTO templet_category (name) VALUES (?)`, [
            req.body.categoryName
        ])

        res.json({ msg: "AI Chatbot category was added", success: true })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// get all category 
router.get('/get_all_category', async (req, res) => {
    try {
        const data = await query(`SELECT * FROM templet_category`, [])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// del category 
router.post('/del_category', validateAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM templet_category WHERE id = ?`, [req.body.id])
        res.json({ success: true, msg: "Category was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// add new chatbot templet 
router.post('/add_chatbot_templet', validateAdmin, async (req, res) => {
    try {
        await query(`INSERT INTO chatbot_templet (category_id, title, train_data) VALUES (?,?,?)`, [
            req.body.categoryId, req.body.title, req.body.trainData
        ])

        res.json({
            success: true,
            msg: "New Ai Bot was added"
        })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// get chatbot by category id 
router.post('/get_cahtbot_by_category', async (req, res) => {
    try {

        const data = await query(`SELECT * FROM chatbot_templet WHERE category_id = ?`, [req.body.categoryId])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// del a chatbot 
router.post('/del_chatbot', validateAdmin, async (req, res) => {
    try {
        await query(`DELETE FROM chatbot_templet WHERE id = ?`, [req.body.id])
        res.json({ success: true, msg: "The Ai bot was deleted" })
    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})


router.post('/get_templet_convo', validateUser, async (req, res) => {
    try {
        const dirPath = process.cwd()
        const createNewChatFile = `${dirPath}/routes/chatting/${req.decode.uid}/model/id${req.body.modelId}.json`

        // getting latest convo data 
        const getJson = await readJsonArray(createNewChatFile)
        res.json({ success: true, data: getJson })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

router.post('/get_reply', validateUser, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {
        const dirPath = process.cwd()
        const createNewChatFile = `${dirPath}/routes/chatting/${req.decode.uid}/model/id${req.body.modelId}.json`

        if (parseInt(req.plan?.chat_in_app) < 1) {
            return res.json({ success: false, msg: "Your plan does not allow you to use this feature" })
        }

        // creating path if not exist 
        await createFilePath(createNewChatFile)
        const body = req.body

        if (!body.question) {
            return res.json({ msg: "Please type something" })
        }

        const finalQue = `train data is  : "${body.train_data}"\nquestion is: "${body.question}"\nsend answer based on the train data and do not mention that you are ai model or anything related to ai just answer based on the train data.`

        const questionObj = {
            role: 'user',
            content: finalQue || ""
        }

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
            res.json({ success: false, msg: "Failed to get response from AI", replyReply })
        }

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

export default router