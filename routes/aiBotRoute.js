import userValidator from '../middlewares/userValidator.js'
import { checkIfPlanExpire, checkGptWordsLimit } from '../middlewares/planValidator.js'
import { Router } from 'express'
import query from '../database/dbpromise.js'

const router = Router()

const botTypeArr = [{
    index: 0,
    name: "TEXT"
}, {
    index: 1,
    name: "DOC"
}, {
    index: 2,
    name: "IMAGE"
}, {
    index: 3,
    name: "WEB"
}, {
    index: 4,
    name: "SQL"
}]


// del bard wa chatbot 
router.post('/del_wa_bard_chatbot', userValidator, async (req, res) => {
    try {
        await query(`DELETE FROM bard_wa_chatbot WHERE uid = ? AND id = ?`, [req.decode.uid, req.body.id])
        res.json({ success: true, msg: "Bot was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// get all bard wa chatbot 
router.get('/get_bard_wa_chatbot', userValidator, async (req, res) => {
    try {

        const data = await query(`
        SELECT wa.*, inst.name AS client_name
        FROM bard_wa_chatbot wa
        LEFT JOIN instance inst ON wa.client_id = inst.client_id
        WHERE wa.uid = ?
      `, [req.decode.uid])

        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// add new bard bot 
router.post('/add_bard_wa_bot', userValidator, checkIfPlanExpire, async (req, res) => {
    try {

        const { client_id, train_data, send_in_group, title } = req.body

        if (parseInt(req.plan?.bard_access) !== 1) {
            return res.json({ msg: "Your plan does not allow you to chat with Bard Ai" })
        }

        if (!title) {
            return res.json({ success: false, msg: "You did not add bot title" })
        }

        // checking the openai chatbot 
        const cehckOpen = await query(`SELECT * FROM wa_ai_bot WHERE client_id = ?`, [client_id])
        if (cehckOpen.length > 0) {
            return res.json({ success: false, msg: "This wahstapp account is busy with Another chatbot" })
        }


        if (!client_id) {
            return res.json({ success: false, msg: "You did not select WhatsApp account" })
        }

        // check ext 
        const checkWa = await query(`SELECT * FROM bard_wa_chatbot WHERE client_id = ?`, [client_id])
        if (checkWa.length > 0) {
            return res.json({ success: false, msg: "You can not run two bots with same WhatsApp Account" })
        }

        await query(`INSERT INTO bard_wa_chatbot (uid, client_id, train_data, send_in_group, title) VALUES (?,?,?,?,?)`, [
            req.decode.uid,
            client_id,
            train_data,
            send_in_group ? 1 : 0,
            title,
        ])

        res.json({ success: true, msg: "Your Bard WhatsApp bot was added" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// del bot 
router.post('/del_wa_bot', userValidator, async (req, res) => {
    try {
        const { id } = req.body
        await query(`DELETE FROM wa_ai_bot WHERE id = ? AND uid = ?`, [id, req.decode.uid])
        res.json({ success: true, msg: "Bot was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// update bot activeness 
router.post('/turn_off_on_wa_bot', userValidator, async (req, res) => {
    try {
        const { id, active } = req.body
        await query(`UPDATE wa_ai_bot SET active = ? WHERE id = ?`, [active, id])
        res.json({ success: true, msg: "Bot was updated" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// get all bot 
router.get('/get_wa_ai_bot', userValidator, async (req, res) => {
    try {
        const resData = await query(`
        SELECT wa.*, inst.name AS client_name
        FROM wa_ai_bot wa
        LEFT JOIN instance inst ON wa.client_id = inst.client_id
        WHERE wa.uid = ?
      `, [req.decode.uid]);

        res.json({ data: resData, success: true });
    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// update the bot 
router.post('/update_wa_bot', userValidator, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {
        const {
            bot_title,
            client_id,
            text_train_data,
            doc_text_train,
            train_data_instruction,
            openai_model,
            group_id,
            enable_typing,
            reaction,
            botTypeValue,
            sql_connection,
            reply_in_groups,
            id } = req.body


        let botType = ""
        const getType = botTypeArr.filter((i) => i.index === botTypeValue)
        if (getType.length > 0) {
            botType = getType[0]?.name
        } else {
            botType = "TEXT"
        }

        if (!bot_title || !client_id) {
            return res.json({ success: false, msg: "Please add all required fields" })
        }

        await query(`UPDATE wa_ai_bot SET
        bot_title = ?,
        client_id = ?,
        text_train_data = ?,
        doc_text_train = ?,
        train_type = ?,
        group_id = ?,
        reaction = ?,
        enable_typing = ?,
        openai_model = ?,
        sql_connection = ?,
        train_data_instruction = ?,
        reply_in_groups = ?
        WHERE id = ?
        `, [
            bot_title,
            client_id,
            text_train_data,
            doc_text_train,
            botType,
            group_id,
            reaction,
            enable_typing,
            openai_model,
            JSON.stringify(sql_connection),
            train_data_instruction,
            reply_in_groups ? 1 : 0,
            id
        ])

        res.json({ success: true, msg: "Bot was updated" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})

// add chatbot 
router.post('/add_chatbot_wa', userValidator, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {
        const { bot_title, client_id, text_train_data, reply_in_groups, doc_text_train, train_data_instruction, openai_model, group_id, enable_typing, reaction, botTypeValue, sql_connection } = req.body


        // checking bard bot 
        const checkBard = await query(`SELECT * FROM bard_wa_chatbot WHERE client_id = ?`, [client_id])
        if (checkBard.length > 0) {
            return res.json({ success: false, msg: "This whatsapp account is busy with BardAi chatbot" })
        }

        // checking client_id 
        const getBotAlready = await query(`SELECT * FROM wa_ai_bot WHERE client_id = ?`, [client_id])
        if (getBotAlready.length > 0) {
            return res.json({ success: false, msg: "There is already a bot running using the same whatsapp account" })
        }

        let botType = ""
        const getType = botTypeArr.filter((i) => i.index === botTypeValue)
        if (getType.length > 0) {
            botType = getType[0]?.name
        } else {
            botType = "TEXT"
        }

        if (!bot_title || !client_id) {
            return res.json({ success: false, msg: "Please add all required fields" })
        }

        await query(`INSERT INTO wa_ai_bot (uid, bot_title, client_id, text_train_data, doc_text_train, train_type, group_id, reaction, enable_typing, openai_model, sql_connection, train_data_instruction, reply_in_groups ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            req.decode.uid,
            bot_title,
            client_id,
            text_train_data,
            doc_text_train,
            botType,
            group_id,
            reaction,
            enable_typing,
            openai_model,
            JSON.stringify(sql_connection),
            train_data_instruction,
            reply_in_groups ? 1 : 0
        ])

        res.json({ success: true, msg: "Your chatbot was added" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "something went wrong" })
    }
})


router.post('/update_bot', userValidator, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {
        const body = req.body;

        if (!body.name || !body.train_data || !body.client_id) {
            return res.json({ msg: "Send all required fields for editing." });
        }

        await query(`
            UPDATE aibot
            SET
                name = ?,
                train_data = ?,
                enable_typing = ?,
                reaction = ?,
                client_id = ?
            WHERE
                id = ?
        `, [
            body.name,
            body.train_data,
            body.enable_typing,
            body.reaction,
            body.client_id,
            body.id
        ]);

        res.json({ success: true, msg: "Your AI Bot was updated." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error', err });
    }
})


// add new bot 
router.post('/add-aibot', userValidator, checkIfPlanExpire, checkGptWordsLimit, async (req, res) => {
    try {
        const body = req.body

        // check if bot already there 
        const check = await query(`SELECT * FROM aibot WHERE client_id = ? and active = ?`, [body.client_id, 1])
        if (check.length > 0) {
            return res.json({ msg: "You have already a bot running with this whatsapp account" })
        }

        if (!body.name || !body.train_data || !body.client_id) {
            return res.json({ msg: "send all required fields" })
        }

        await query(`INSERT INTO aibot (name, uid, active, client_id, train_data, enable_typing, reaction) VALUES (
            ?,?,?,?,?,?,?
        )`, [
            body.name, req.decode.uid, 1, body.client_id, body.train_data, body.enable_typing, body.reaction
        ])

        res.json({ success: true, msg: "Your AI Bot was added" })

    } catch (err) {
        res.json({ msg: 'server error', err })
        console.log(err)
    }
})

// get al route 
router.get('/get-bots', userValidator, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM aibot WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })

    } catch (err) {
        res.json({ msg: 'server error', err })
        console.log(err)
    }
})


// turn off on 
router.post('/change-status', userValidator, async (req, res) => {
    try {
        await query(`UPDATE aibot SET active = ? WHERE uid = ? AND id = ? `, [req.body.status, req.decode.uid, req.body.id])
        res.json({ msg: req.body.status === 1 ? "Bot was enabled" : "Bot was disabled", success: true })

    } catch (err) {
        res.json({ msg: 'server error', err })
        console.log(err)
    }
})

// del bot 
router.post('/del-bot', userValidator, async (req, res) => {
    try {
        await query(`DELETE FROM aibot WHERE uid = ? and id = ?`, [req.decode.uid, req.body.id])
        res.json({ success: true, msg: "Bot was deleted" })

    } catch (err) {
        res.json({ msg: 'server error', err })
        console.log(err)
    }
})

export default router