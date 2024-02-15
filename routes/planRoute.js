import { Router } from 'express'
import validateAdmin from '../middlewares/adminValidator.js'
import userValidator from '../middlewares/userValidator.js'
import fetch from 'node-fetch'
import query from '../database/dbpromise.js'
import { updatePlan, createOrder, rzCapturePayment } from '../functions/function.js'
import * as Instamojo from './instamojo/instamojo.js'
import { setting } from './zarnipal/zarnipal.js';
import Stripe from 'stripe';

const router = Router()

router.post('/pay-free', userValidator, async (req, res) => {
    try {
        const planId = req.body.plan_id
        const uid = req.decode.uid
        if (!planId) {
            return res.json({ success: false, msg: "No plan id found" })
        }

        const checPlan = await query(`SELECT * FROM plan WHERE id = ?`, [planId])

        if (checPlan.length < 1) {
            return res.json({ msg: "There is no plan found you requested for" })
        }

        if (checPlan[0].cost > 0) {
            return res.json({ mgs: "This plan is not free" })
        }

        await updatePlan(uid, JSON.stringify(checPlan[0]))

        await createOrder(uid, 'Offline', checPlan[0].price, JSON.stringify("Offline payment"))
        res.json({ success: true, msg: "Your plan was activated you are good to go now." })

    } catch (err) {
        console.error(err);
        res.status(500).json({ err, msg: "Server error" });
    }
})

// update plan 
router.post('/edit_plan', validateAdmin, async (req, res) => {
    try {
        const body = req.body;

        // Add the ID of the plan you want to update
        const planIdToUpdate = body.id; // Make sure you have a plan_id field in your request body

        if (!planIdToUpdate) {
            return res.json({ success: false, msg: "Plan is not provided" })
        }

        await query(`
            UPDATE plan
            SET
                plan_name = ?,
                gemini_chatbot = ?,
                cost = ?,
                gpt_words_limit = ?,
                dalle = ?,
                dalle_limit = ?,
                dalle_size = ?,
                wa_bot = ?,
                wp_auto_bloging = ?,
                chat_in_app = ?,
                text_to_speech = ?,
                tts_words_limit = ?,
                speech_to_text = ?,
                embed_chatbot = ?,
                embed_chatbot_limit = ?,
                bard_access = ?,
                planexpire = ?,
                allow_own_openai = ?
            WHERE
                id = ?
        `, [
            body.plan_name,
            body.gemini_chatbot || 0,
            body.cost || 0,
            body.gpt_words_limit || 0,
            body.dalle || 0,
            body.dalle_limit || 0,
            body.dalle_size,
            body.wa_bot || 0,
            body.wp_auto_bloging || 0,
            body.chat_in_app || 0,
            body.text_to_speech || 0,
            body.tts_words_limit || 0,
            body.speech_to_text || 0,
            body.embed_chatbot || 0,
            body.embed_chatbot_limit || 0,
            body.bard_access || 0,
            body.planexpire,
            body.allow_own_openai,
            planIdToUpdate // Pass the plan ID as the last parameter
        ]);

        res.json({ success: true, msg: "Plan was updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ err, msg: "Server error" });
    }
})

router.post('/add', validateAdmin, async (req, res) => {
    try {

        const body = req.body
        await query(`INSERT INTO plan 
       (plan_name,
        gemini_chatbot,
       cost,
       gpt_words_limit,
       dalle,
       dalle_limit,
       dalle_size,
       wa_bot,
       wp_auto_bloging,
       chat_in_app,
       text_to_speech,
       tts_words_limit,
       speech_to_text,
       embed_chatbot,
       embed_chatbot_limit,
       bard_access,
       planexpire,
       allow_own_openai) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
            body.plan_name,
            body.gemini_chatbot || 0,
            body.cost || 0,
            body.gpt_words_limit || 0,
            body.dalle || 0,
            body.dalle_limit || 0,
            body.dalle_size,
            body.wa_bot || 0,
            body.wp_auto_bloging || 0,
            body.chat_in_app || 0,
            body.text_to_speech || 0,
            body.tts_words_limit || 0,
            body.speech_to_text || 0,
            body.embed_chatbot || 0,
            body.embed_chatbot_limit || 0,
            body.bard_access || 0,
            body.planexpire,
            body.allow_own_openai || 0
        ])

        res.json({ success: true, msg: "Plan was added" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// get all plans 
router.get('/get_plans', async (req, res) => {
    try {
        const data = await query(`SELECT * FROM plan`, [])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

// del plan 
router.post('/del_plan', async (req, res) => {
    try {
        await query(`DELETE FROM plan WHERE id = ?`, [req.body.id])
        res.json({ success: true, msg: "Plan was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})


// del plan 
router.get('/get-all', async (req, res) => {
    try {
        const data = await query(`SELECT * FROM plan`, [])
        res.json({ success: true, data })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})


router.post('/pay-with-instamojo', userValidator, async (req, res) => {
    try {

        const plan = req.body.plan
        const web = await query(`SELECT * FROM web`, [])
        const userData = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
        const user = userData[0]


        const instam = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['instamojo'])

        if (instam.length < 1) {
            return res.json({ msg: "Instamojo keys not found" })
        }

        Instamojo.isSandboxMode(false)
        Instamojo.setKeys(instam[0]?.payment_id, instam[0]?.payment_keys)
        // Instamojo.setKeys("403fa88553ff9368f24ed1d2a30d50aa", "e1aee79791049888b471d7e0cf57eed5")

        const options = {
            purpose: plan.plan_name, // REQUIRED
            amount: plan.cost / web[0].exchange_rate * 82, // REQUIRED and must be > ₹3 (3 INR)
            currency: "INR",
            buyer_name: user.name,
            email: user.email,
            phone: null,
            send_email: false,
            send_sms: false,
            allow_repeated_payments: false,
            webhook: "",
            redirect_url: `${process.env.URI}/api/plan/verify-instamojo?uid=${req.decode.uid}&plan_id=${plan.id}`,
        };

        const paymentData = Instamojo.PaymentData(options);

        const response = await Instamojo.createNewPaymentRequest(paymentData);

        console.log(response)

        if (response.success) {
            res.json({ success: true, url: response?.payment_request?.longurl })
        } else {
            res.json({ success: false, msg: response.message || "It seems instamojo api keys are not valid" })
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.get('/verify-instamojo', async (req, res) => {
    try {
        const payment_id = req.query.payment_id
        const payment_request_id = req.query.payment_request_id
        const uid = req.query.uid
        const plan_id = req.query.plan_id

        if (!payment_id || !payment_request_id || !plan_id || !uid) {
            return res.json({ msg: "Invalid request" })
        }

        const instamojo = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['instamojo'])

        const getPlan = await query(`SELECT * FROM plan WHERE id = ?`, [plan_id])

        if (getPlan.length < 1) {
            return res.json({ msg: "This plan was not found. Contact custom support." })
        }

        Instamojo.isSandboxMode(false)
        const resp = await Instamojo.getOnePayedPaymentDetails(payment_request_id, payment_id, instamojo[0].payment_id, instamojo[0].payment_keys, false)


        if (resp.success && resp.payment_request?.payment?.status == "Credit") {

            await updatePlan(uid, JSON.stringify(getPlan[0]))

            await createOrder(uid, 'Instamojo', getPlan[0].price, JSON.stringify(resp.payment_request?.payment))

            res.send("<h1>Payment Success\nYou can login your account now</h1>")
        } else {
            res.json({ msg: "Transaction failed, check your API keys" })
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.post('/pay-with-zarnipal', userValidator, async (req, res) => {
    try {
        const paymentToken = Date.now()
        const amount = req.body.amount
        const description = req.body.description
        const plan = req.body.plan

        if (!amount || !description || !plan) {
            return res.json({ msg: "please send required fields" })
        }
        // adding token 
        await query(`UPDATE payment_gateways SET payment_keys = ? WHERE code = ? `, [paymentToken, 'zarnipal'])

        // getting zrn keys 
        const zarni = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['zarnipal'])

        // getting user 
        const user = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])

        // getting web 
        const web = await query(`SELECT * FROM web`, [])

        // const zarniPal = new setting()

        const zarinpal = new setting(zarni[0].payment_id, false)

        const finalAmount = plan.cost / web[0].exchange_rate * 82

        const authority = await zarinpal.requestPayment({ amount: Math.round(finalAmount), callbackUrl: process.env.URI + `/api/plan/verify-zarnipal?uid=${req.decode.uid}&plan_id=${plan.id}`, description: plan.plan_name })

        const redirect = zarinpal.startPayUrl + authority

        res.json({ success: true, url: redirect })

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.get('/verify-zarnipal', userValidator, async (req, res) => {
    try {
        if (!req.query.Authority) {
            res.json({ success: false, msg: "Invalid request" })
        }

        const plan_id = req.query.plan_id

        const getPlan = await query(`SELECT * FROM plan WHERE id = ?`, [plan_id])

        if (getPlan.length < 1) {
            return res.json({ msg: "This plan was not found. Contact custom support." })
        }

        // getting web 
        const web = await query(`SELECT * FROM web`, [])

        // getting zarni payment id 
        const zarni = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['zarnipal'])

        const finalAmount = getPlan[0].cost / web[0].exchange_rate * 82

        const zarinpal = new setting(zarni[0].payment_id, false)


        const refId = await zarinpal.verifyPayment({ authority: req.query.Authority, amount: finalAmount })


        await updatePlan(req.query.uid, JSON.stringify(getPlan[0]))

        await createOrder(req.query.uid, 'Zarnipal', getPlan[0].cost, JSON.stringify(refId))


        if (refId) {
            res.send("<h1>Payment Success\nYou can login your account now</h1>")
        }


    } catch (err) {
        console.log(err)
        res.json({ msg: 'transaction error', err })
    }
})

router.post('/pay-with-razorpay', userValidator, async (req, res) => {
    try {
        if (!req.body.rz_payment_id || !req.body.plan || !req.body.amount) {
            return res.json({ msg: "please send required fields" })
        }

        // getting web 
        const web = await query(`SELECT * from web`, [])
        const data = web[0]
        const planID = req.body.plan
        const mobile = req.body.mobile

        // getting plan 
        const plan = await query(`SELECT * FROM plan WHERE id = ?`, [planID.id])

        // getting keys 
        const razorpay = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['razorpay'])

        if (plan.length < 1) {
            return res.json({ msg: "Sorry this plan was not found" })
        }

        const finalamt = parseInt(req.body.amount) / parseInt(data.exchange_rate) * 82

        const resp = await rzCapturePayment(req.body.rz_payment_id, Math.round(finalamt) * 100, razorpay[0].payment_id, razorpay[0].payment_keys)

        if (!resp) {
            res.json({ success: false, msg: resp.description })
            return
        }

        await updatePlan(req.decode.uid, JSON.stringify(plan[0]))

        await createOrder(req.decode.uid, 'Razorpay', plan[0].cost, JSON.stringify(resp))

        res.json({ success: true, msg: "Thank for your payment you are good to go now." })


    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})



router.post('/pay-with-stripe', userValidator, async (req, res) => {
    try {
        // Retrieve keys from the database
        const stripeKeys = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['stripe']);
        const stripeSecretKey = stripeKeys[0]?.payment_keys;

        // Create a new Stripe instance
        const stripeClient = new Stripe(stripeSecretKey);

        // Get the request body
        const { token, amount } = req.body;

        // Create a charge with Stripe
        const charge = await stripeClient.charges.create({
            source: token?.id,
            amount: amount,
            currency: 'usd',
        });
        if (charge.paid) {
            // getting plan 
            const plan = await query(`SELECT * FROM plan WHERE id = ?`, [req.body?.plan?.id])
            await updatePlan(req.decode.uid, JSON.stringify(plan[0]))

            await createOrder(req.decode.uid, 'Stripe', plan[0].cost, JSON.stringify(charge))

            res.json({ success: true, msg: "Thanks for the payment youa re good to go now" })


        } else {
            res.json({ msg: "Something went wrong", charge })
        }
    } catch (err) {
        console.error(err?.raw);
        res.json({ success: false, msg: err?.raw?.message || "Something went wrong", err });
    }
});


router.post('/pay-with-paystack', userValidator, async (req, res) => {
    try {
        const planData = req.body.plan
        const trans_id = req.body.trans_id

        if (!planData || !trans_id) {
            return res.json({
                msg: "Order id and plan required"
            })
        }

        // getting plan 
        const plan = await query(`SELECT * FROM plan WHERE id = ?`, [planData.id])

        if (plan.length < 1) {
            return res.json({ msg: "Sorry this plan was not found" })
        }


        // getting keys 
        const paystack = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['paystack'])
        const cred = paystack[0]
        const paystackSecretKey = cred.payment_id;
        const transactionId = trans_id;

        var response = await fetch(`https://api.paystack.co/transaction/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        })

        const resp = await response.json()


        if (resp.data?.status !== 'success') {
            res.json({ success: false, msg: resp.message })
            return
        }


        await updatePlan(req.decode.uid, JSON.stringify(plan[0]))

        await createOrder(req.decode.uid, 'Paystack', plan[0].cost, JSON.stringify(resp))

        res.json({ success: true, msg: "Thank for your payment you are good to go now." })


    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.post('/pay-with-paypal', userValidator, async (req, res) => {
    try {
        const orderID = req.body.order_id
        const plan = req.body.plan
        if (!plan || !orderID) {
            return res.json({ msg: "order id and plan required" })
        }

        // getting web 
        const web = await query(`SELECT * from web`, [])
        // getting keys 
        const paypal = await query(`SELECT * FROM payment_gateways WHERE code = ?`, ['paypal'])

        const paypalClientId = paypal[0].payment_id
        const paypalClientSecret = paypal[0].payment_keys

        let response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
            method: 'POST',
            body: 'grant_type=client_credentials',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${paypalClientId}:${paypalClientSecret}`, 'binary').toString('base64')
            }
        })

        let data = await response.json();

        console.log({ data })

        let resp_order = await fetch(`https://api-m.sandbox.paypal.com/v1/checkout/orders/${orderID}`, {
            method: "GET",
            headers: {
                'Authorization': 'Bearer ' + data.access_token
            }
        });

        let order_details = await resp_order.json()
        console.log({ order_details })

        if (order_details.status === 'COMPLETED') {

            await updatePlan(req.decode.uid, JSON.stringify(plan))

            await createOrder(req.decode.uid, 'Paypal', plan.cost, JSON.stringify(order_details))

            res.json({ success: true, msg: "Thank for your payment you are good to go now." })

        } else {
            res.json({ success: false, msg: error_description })
            return
        }

    } catch (err) {
        res.json({ err, msg: 'server error' })
        console.log(err)
    }
})


export default router
