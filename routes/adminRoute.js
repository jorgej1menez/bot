import { Router } from 'express'
import * as controller from '../controllers/adminController.js'
import validateAdmin from '../middlewares/adminValidator.js'
import query from '../database/dbpromise.js'

const router = Router()

router.post('/login', controller.login)
router.get('/get-users', validateAdmin, controller.getUsers)
router.post('/edit-user', validateAdmin, controller.editUser)
router.post('/del-user', validateAdmin, controller.delUser)
router.post('/update-user-plan', validateAdmin, controller.updateUserPlan)

router.get('/get-all-pings', validateAdmin, controller.getAllPings)
router.post('/reply-ping', validateAdmin, controller.replyPing)

router.post('/add-page', validateAdmin, controller.addPage)
router.get('/get-all-page', controller.getAllPage)
router.post('/del-page', validateAdmin, controller.delPage)
router.post('/get-page-by-slug', controller.getBySlug)


router.post('/add-testimonial', validateAdmin, controller.addTesti)
router.post('/del-testimonial', validateAdmin, controller.delTesti)
router.get('/get-all', controller.getAllTesi)


router.post('/add-faq', validateAdmin, controller.addFaq)
router.post('/del-faq', validateAdmin, controller.delFaq)
router.get('/get-all-faq', controller.getAllFaq)

router.post('/add-features', validateAdmin, controller.addFeatures)
router.post('/del-feature', validateAdmin, controller.delFeature)
router.get('/get-all-features', controller.getAllFeatures)

router.get('/get-all-orders', validateAdmin, controller.getAllOrders)
router.post('/get-user-by-uid', validateAdmin, controller.getUserByUID)
router.post('/del-order', validateAdmin, controller.delOrder)

router.post('/del-ping', validateAdmin, controller.delPing)

router.post('/direct-user-login', validateAdmin, controller.directUserLogin)

router.get('/get-admin', validateAdmin, controller.getAdmin)
router.post('/update-admin', validateAdmin, controller.updateAdmin)


router.post('/send_recovery', controller.adminRecovery)
router.post('/modify_admin', validateAdmin, controller.updateRecoverPass)

router.post('/edit-apikey', validateAdmin, async (req, res) => {
    try {
        await query(`UPDATE apikeys SET openai_keys = ?, aws_polly_id = ?, aws_polly_keys = ?,
         hamwiz_api = ?`,
            [req.body.openai_keys, req.body.aws_polly_id, req.body.aws_polly_keys, req.body.hamwiz_api])
        res.json({ success: true, msg: "API was updated" })

    } catch (err) {
        res.json({ err, msg: "server error" })
    }
})

router.get('/get-apikeys', validateAdmin, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM apikeys`, [])
        res.json({ data: data[0], success: true })
    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

function countFreeAndPaidUsers(users) {
    const currentDate = new Date();

    const freeUsers = users.filter((user) => {
        if (user.planexpire === null) {
            return true;
        }

        const planExpireDate = new Date(user.planexpire);
        return planExpireDate <= currentDate;
    });

    const paidUsers = users.filter((user) => {
        if (user.planexpire === null) {
            return false;
        }

        const planExpireDate = new Date(user.planexpire);
        return planExpireDate > currentDate;
    });

    return {
        freeUserCount: freeUsers.length,
        paidUserCount: paidUsers.length,
    };
}

// get dashboard 
router.get('/get_dashboard', async (req, res) => {
    try {
        const totalUsers = await query(`SELECT * FROM user`, [])
        const { freeUserCount, paidUserCount } = countFreeAndPaidUsers(totalUsers)
        const activeInsatnce = await query(`SELECT * FROM instance`, [])
        const activeWaBot = await query(`SELECT * FROM aibot WHERE active = ?`, [1])
        const pendingPings = await query(`SELECT * FROM ping WHERE admin_reply = ?`, [null])

        // getting 24 hours data orders 
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const formattedDateTime = twentyFourHoursAgo.toISOString().slice(0, 19).replace('T', ' ');
        const dailyOrdersData = await query(`SELECT * FROM orders WHERE createdAt >= ?`, [formattedDateTime])

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const formattedDateTimeMonthly = oneMonthAgo.toISOString().slice(0, 19).replace('T', ' ');
        const monthBasedOrder = await query(`SELECT * FROM orders WHERE createdAt >= ?`, [formattedDateTimeMonthly])

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const formattedDateTimeYear = oneYearAgo.toISOString().slice(0, 19).replace('T', ' ');
        const yearBasedOrders = await query(`SELECT * FROM orders WHERE createdAt >= ?`, [formattedDateTimeYear])

        // total orders 
        const totalOrders = await query(`SELECT * FROM orders`, [])


        // getting 24 hours data orders 
        const twentyFourHoursAgotts = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const formattedDateTimetts = twentyFourHoursAgotts.toISOString().slice(0, 19).replace('T', ' ');
        const dailyDatatts = await query(`SELECT * FROM tts WHERE createdAt >= ?`, [formattedDateTimetts])

        const oneMonthAgotts = new Date();
        oneMonthAgotts.setMonth(oneMonthAgotts.getMonth() - 1);
        const formattedDateTimeMonthlytts = oneMonthAgotts.toISOString().slice(0, 19).replace('T', ' ');
        const monthBasedOrdertts = await query(`SELECT * FROM tts WHERE createdAt >= ?`, [formattedDateTimeMonthlytts])

        const oneYearAgotts = new Date();
        oneYearAgotts.setFullYear(oneYearAgotts.getFullYear() - 1);
        const formattedDateTimeYeartts = oneYearAgotts.toISOString().slice(0, 19).replace('T', ' ');
        const yearBasedOrderstts = await query(`SELECT * FROM tts WHERE createdAt >= ?`, [formattedDateTimeYeartts])

        // total tts 
        const totaltts = await query(`SELECT * FROM tts`, [])


        // getting 24 hours data orders 
        const twentyFourHoursAgottsstt = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const formattedDateTimettsstt = twentyFourHoursAgottsstt.toISOString().slice(0, 19).replace('T', ' ');
        const dailyDatattsstt = await query(`SELECT * FROM stt WHERE createdAt >= ?`, [formattedDateTimettsstt])

        const oneMonthAgottsstt = new Date();
        oneMonthAgottsstt.setMonth(oneMonthAgottsstt.getMonth() - 1);
        const formattedDateTimeMonthlyttsstt = oneMonthAgottsstt.toISOString().slice(0, 19).replace('T', ' ');
        const monthBasedOrderttssst = await query(`SELECT * FROM stt WHERE createdAt >= ?`, [formattedDateTimeMonthlyttsstt])

        const oneYearAgottssst = new Date();
        oneYearAgottssst.setFullYear(oneYearAgottssst.getFullYear() - 1);
        const formattedDateTimeYearttssst = oneYearAgottssst.toISOString().slice(0, 19).replace('T', ' ');
        const yearBasedOrdersttssst = await query(`SELECT * FROM stt WHERE createdAt >= ?`, [formattedDateTimeYearttssst])

        // total tts 
        const totalttssst = await query(`SELECT * FROM stt`, [])

        const totalGenWP = await query(`SELECT * FROM generated_wp`, [])

        res.json({
            freeUserCount,
            totalUsers: totalUsers.length,
            paidUserCount,
            activeInsatnce: activeInsatnce.length,
            activeWaBot: activeWaBot.length,
            pendingPings: pendingPings.length,
            dailyOrdersData: dailyOrdersData.length,
            yearBasedOrders: yearBasedOrders.length,
            monthBasedOrder: monthBasedOrder.length,
            totalOrders: totalOrders.length,
            dailyDatatts: dailyDatatts.length,
            monthBasedOrdertts: monthBasedOrdertts.length,
            yearBasedOrderstts: yearBasedOrderstts.length,
            totaltts: totaltts.length,
            dailyDatattsstt: dailyDatattsstt.length,
            monthBasedOrderttssst: monthBasedOrderttssst.length,
            yearBasedOrdersttssst: yearBasedOrdersttssst.length,
            totalttssst: totalttssst.length,
            totalGenWP: totalGenWP.length,
            success: true
        })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

export default router
