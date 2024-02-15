import jwt from 'jsonwebtoken'
import query from '../database/dbpromise.js'
import { daysDiff } from '../functions/function.js'

const checkEmbedLimit = async (req, res, next) => {
    try {
        const plan = req.plan

        const isAllowed = parseInt(plan.embed_chatbot) > 0 ? true : false
        if (!isAllowed) {
            return res.json({ msg: "Your current plan does not allow you to use Ai Bot Embed" })
        }
        const getEmbedBot = await query(`SELECT * FROM embed_chatbot WHERE uid = ?`, [req.decode.uid])
        const botAdded = getEmbedBot.length

        if (parseInt(plan.embed_chatbot_limit) >= botAdded.length) {
            return res.json({ msg: `You have ${plan.embed_chatbot_limit} allowed only pelase delete one to add new` })
        }

        next()

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const makingDecode = async (req, res, next) => {
    try {
        if (!req.body.uid) {
            return res.json({ msg: "send all required fields" })
        }
        req.decode = { uid: req.body.uid }
        next()
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const checkIfPlanExpire = async (req, res, next) => {
    try {
        const data = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
        if (!data[0].plan) {
            return res.json({ msg: "You dont have a plan get one" })
        }
        const daysLeft = daysDiff(data[0].planexpire)
        if (daysLeft < 1) {
            return res.json({ msg: `Your plan has been expired please renew.` })
        }

        req.plan = JSON.parse(data[0].plan)
        req.user = data[0]
        req.daysLeft = daysLeft

        next()

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const instanceValidator = async (req, res, next) => {
    try {
        const plan = req.plan
        if (!plan.wa_bot) {
            return res.json({ msg: `You are not allowed to set whatsapp bot, Please upgrade your plan` })
        } next()
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const checkGptWordsLimit = async (req, res, next) => {
    try {
        const user = req.user
        if (parseInt(user.gpt_words_limit) < 10) {
            return res.json({ msg: "You dont have enough words left in your account, Renew plan" })
        }

        next()

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const checkDallLimit = async (req, res, next) => {
    try {
        const user = req.user
        if (parseInt(user.dalle_limit) < 1) {
            return res.json({ msg: "You dont have enough ai-image limit left in your account, Renew plan" })
        }
        req.hamWizTokens = parseInt(user.dalle_limit) || 0
        next()
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

function getWordCount(sentence) {
    // Remove leading and trailing whitespace
    sentence = sentence.trim();

    // Split the sentence by whitespace and count the resulting array length
    const words = sentence.split(/\s+/);
    return words.length;
}

const checkTtsLimit = async (req, res, next) => {
    try {
        const user = req.user
        if (!user.tts_words_limit) {
            return res.json({ msg: "You dont have a plan with Text to Speech feature" })
        }
        const limit = parseInt(user.tts_words_limit)
        const words = getWordCount(req.body.text)

        if (limit < words) {
            return res.json({ msg: `You have ${limit} limits in your account however you are trying to convert ${words} words` })
        }
        req.wordsLeft = limit
        next()

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


export { checkIfPlanExpire, makingDecode, checkDallLimit, instanceValidator, checkEmbedLimit, checkGptWordsLimit, checkTtsLimit }