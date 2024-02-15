import { Router } from 'express'
import validateAdmin from '../middlewares/adminValidator.js'
import validateUser from '../middlewares/userValidator.js'
import { checkIfPlanExpire, checkTtsLimit } from '../middlewares/planValidator.js'
import query from '../database/dbpromise.js'
import { readJsonFile } from '../functions/function.js'
import { genVoice } from './speech/function.js'

const router = Router()

router.post('/save_text', validateUser, async (req, res) => {
    try {
        await query(`INSERT INTO stt (uid, text) VALUES (?,?)`, [
            req.decode.uid, req.body.text
        ])
        res.json({ success: true, msg: "Your text was saved to cloud" })

    } catch (err) {
        res.json({ err, msg: "server error" })
        console.log(err)
    }
})


// get my texts 
router.get('/get_my_text', validateUser, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM stt WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })

    } catch (err) {
        res.json({ err, msg: "server error" })
        console.log(err)
    }
})

export default router
