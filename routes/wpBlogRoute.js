import query from '../database/dbpromise.js'
import validateUser from '../middlewares/userValidator.js'
import { checkIfPlanExpire } from '../middlewares/planValidator.js'
import { Router } from 'express'
import { checkWpAuth, getAllCategory, returnPost, createBlogPost, postToWordpress } from '../functions/function.js'

const router = Router()

router.post('/update_wp_token', validateUser, async (req, res) => {
    try {
        await query(`UPDATE user SET wp_domain = ?, wp_token = ?, wp_email = ? WHERE uid = ?`, [req.body.wp_domain, req.body.wp_token, req.body.wp_email, req.decode.uid])
        res.json({
            success: true,
            msg: "Token was updated"
        })

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.get('/get_categories', validateUser, async (req, res) => {
    try {
        const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
        const domain = getUser[0].wp_domain

        const resp = await getAllCategory(domain)
        res.json({ success: true, data: resp })

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
})

router.post('/write_blogs', validateUser, checkIfPlanExpire, async (req, res) => {
    try {
        const plan = req.plan
        const user = req.user
        if (plan.wp_auto_bloging !== 1) {
            return res.json({ success: false, msg: "Your plan does not allowed to use Auto Bloging" })
        }
        const body = req.body

        const totalWords = parseInt(body.words_limit) * parseInt(body.blog_count)
        if (parseInt(user.gpt_words_limit) < totalWords) {
            return res.json({ msg: `Your total words could will be ${totalWords} and you have ${user.gpt_words_limit} words left.` })
        }

        const topic = body.topic
        const blogLength = parseInt(body.words_limit)
        const language = body.language
        const blog_count = parseInt(body.blog_count)

        // checking is wp credentials has 
        if (!user.wp_domain || !user.wp_email || !user.wp_token) {
            return res.json({ msg: "Please fill your Wordpress API Credentials" })
        }

        const checkAuth = await checkWpAuth(user)

        if (!checkAuth.success) {
            return res.json({ msg: checkAuth.msg, success: checkAuth.success })
        }

        let i = 1

        async function runFun() {

            console.log("running time ", i)

            // getting user data 
            const latestUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
            const limitsGtp = parseInt(latestUser[0].gpt_words_limit)

            if (limitsGtp < blogLength) {
                console.log("limit exceed stopped blog")
                return
            }

            function countWords(text) {
                const words = text.trim().split(/\s+/);
                return words.length;
            }

            const getPost = await returnPost(topic, language, blogLength)

            const cateArr = body.catArr?.map((i) => i.id)

            if (getPost.success) {
                const blogJson = createBlogPost(getPost.blog)
                const postWP = await postToWordpress(user, blogJson, cateArr, body.postStatus)

                const limitToBeAdd = limitsGtp - countWords(getPost.blog)

                if (postWP.success) {
                    await query(`UPDATE user SET gpt_words_limit = ? WHERE uid = ?`, [limitToBeAdd < 0 ? 0 : limitToBeAdd, req.decode.uid])
                    await query(`INSERT INTO generated_wp (uid, link, post_id, title) VALUES (?,?,?,?)`, [
                        req.decode.uid, postWP?.postRes?.link || "", postWP?.postRes?.id || "", postWP?.postRes?.title || ""
                    ])
                }
            }

            if (i < blog_count && getPost.success) {
                i += 1
                runFun()
            }
        }

        runFun()
        res.json({ msg: "Auto posting was started", success: true })
        console.log("posting was completed")

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})


// get all wp post 
router.get('/get_wp_post', validateUser, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM generated_wp WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

// delete post 
router.post('/del_post', validateUser, async (req, res) => {
    try {
        await query(`DELETE FROM generated_wp WHERE uid = ? and id = ?`, [req.decode.uid, req.body.id])
        res.json({ success: true, msg: "Post was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})


export default router