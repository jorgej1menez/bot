import { Router } from 'express'
import sessionsRoute from './routes/sessionsRoute.js'
import chatsRoute from './routes/chatsRoute.js'
import groupsRoute from './routes/groupsRoute.js'
import userRoute from './routes/userRoute.js'
import adminRoute from './routes/adminRoute.js'
import planRoute from './routes/planRoute.js'
import webRoute from './routes/webRoute.js'
import aiBotRoute from './routes/aiBotRoute.js'
import aiImgRoute from './routes/aiImgRoute.js'
import wpBlogRoute from './routes/wpBlogRoute.js'
import chatBotRoute from './routes/chatBotRoute.js'
import ttsRoute from './routes/ttsRoute.js'
import sttRoute from './routes/sttRoute.js'
import barRoute from './routes/barRoute.js'
import embidChatbot from './routes/embidChatbot.js'
import response from './response.js'

const router = Router()

router.use('/sessions', sessionsRoute)
router.use('/chats', chatsRoute)
router.use('/groups', groupsRoute)
router.use('/user', userRoute)
router.use('/admin', adminRoute)
router.use('/plan', planRoute)
router.use('/web', webRoute)
router.use('/bot', aiBotRoute)
router.use('/aiimg', aiImgRoute)
router.use('/wp', wpBlogRoute)
router.use('/chatbot', chatBotRoute)
router.use('/tts', ttsRoute)
router.use('/stt', sttRoute)
router.use('/bard', barRoute)
router.use('/embed', embidChatbot)


router.all('*', (req, res) => {
    response(res, 404, false, 'The requested url cannot be found.')
})

export default router
