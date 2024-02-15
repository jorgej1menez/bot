import { Router } from 'express'
import validateAdmin from '../middlewares/adminValidator.js'
import validateUser from '../middlewares/userValidator.js'
import { checkIfPlanExpire, checkTtsLimit } from '../middlewares/planValidator.js'
import query from '../database/dbpromise.js'
import { readJsonFile } from '../functions/function.js'
import { genVoice } from './speech/function.js'

const router = Router()


router.get('/langs_data', validateUser, async (req, res) => {
    try {
        const dirName = process.cwd()
        const path = `${dirName}/routes/tts/languages.json`
        const data = await readJsonFile(path)
        res.json({
            success: true,
            data
        })
    } catch (err) {
        res.json({ err, msg: 'server error' })
        console.log(err)
    }
})

function getWordCount(sentence) {
    // Remove leading and trailing whitespace
    sentence = sentence.trim();

    // Split the sentence by whitespace and count the resulting array length
    const words = sentence.split(/\s+/);
    return words.length;
}

router.post('/gen_voice', validateUser, checkIfPlanExpire, checkTtsLimit, async (req, res) => {
    try {

        const apiKeys = await query(`SELECT * FROM apikeys`, [])

        if (!apiKeys[0]?.aws_polly_id || !apiKeys[0].aws_polly_keys) {
            return res.json({ msg: "API Keys not found" })
        }


        console.log(req.body)
        const genVoicee = await genVoice(apiKeys[0].aws_polly_keys, apiKeys[0]?.aws_polly_id, req)

        if (genVoicee.success) {
            const wordsCount = getWordCount(req.body.text)
            const finalWords = req.wordsLeft - parseInt(wordsCount)

            await query(`UPDATE user SET tts_words_limit = ? WHERE uid = ?`, [finalWords < 0 ? 0 : finalWords, req.decode.uid])

            res.json({ msg: genVoicee.msg, success: true })
        } else {
            console.log(JSON.stringify(genVoicee))
            res.json({ msg: genVoicee.msg, success: genVoicee.err?.message })
        }
    } catch (err) {
        res.json({ err, msg: 'server error' })
        console.log(err)
    }
})

// get voices by uid 
router.get('/my_gen_voices', validateUser, async (req, res) => {
    try {

        const data = await query(`SELECT * FROM tts WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })

    } catch (err) {
        res.json({ err, msg: 'server error' })
        console.log(err)
    }
})

// del voice 
router.post('/del_entry', validateUser, async (req, res) => {
    try {
        await query(`DELETE FROM tts WHERE id = ? and uid = ?`, [req.body.id, req.decode.uid])
        res.json({ success: true, msg: "Entry was deleted" })

    } catch (err) {
        res.json({ err, msg: 'server error' })
        console.log(err)
    }
})

export default router
