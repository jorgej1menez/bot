import query from '../database/dbpromise.js'
import bcrypt, { getRounds } from 'bcrypt'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import moment from 'moment'
import { updatePlan, sendRecoveryEmail } from '../functions/function.js'

const login = async (req, res) => {
    try {
        const body = req.body
        const email = body.email
        const pass = body.password

        if (!email || !pass) {
            return res.json({ msg: "please send required fields" })
        }

        // check for user 
        const userFind = await query(`SELECT * FROM admin WHERE email = ?`, [email])
        if (userFind.length < 1) {
            return res.json({ msg: "Invalid credentials" })
        }
        const compare = await bcrypt.compare(pass, userFind[0].password)
        if (!compare) {
            return res.json({ msg: "Invalid credentials" })
        } else {
            const token = sign({ uid: userFind[0].uid, role: 'admin', password: userFind[0].password, email: userFind[0].email }, process.env.JWTKEY, {})
            res.json({
                success: true, token
            })
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getUsers = async (req, res) => {
    try {
        const users = await query(`SELECT * FROM user`, [])
        res.json({ success: true, data: users })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const editUser = async (req, res) => {
    try {
        // check if email is already there 
        const findUser = await query(`SELECT * FROM user WHERE email = ?`, [
            req.body.email
        ])
        if (findUser.length > 0 && findUser[0].uid !== req.body.uid) {
            return res.json({ msg: "This email is already taken by another user" })
        } else {
            if (req.body.newpass) {
                const hashpass = await bcrypt.hash(req.body.newpass, 10)
                await query(`UPDATE user SET name = ?, email = ?, password = ? WHERE uid = ?`, [
                    req.body.name, req.body.email, hashpass, req.body.uid
                ])
            } else {
                await query(`UPDATE user SET name = ?, email = ? WHERE uid = ?`, [
                    req.body.name, req.body.email, req.body.uid
                ])
            }
            res.json({ msg: "User was updated", success: true })
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delUser = async (req, res) => {
    try {
        await query(`DELETE FROM user WHERE id = ?`, [req.body.id])
        res.json({ msg: "user was deleted", success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const updateUserPlan = async (req, res) => {
    try {
        await updatePlan(req.body.uid, req.body.plan)
        res.json({ msg: "plan was updated", success: true })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getAllOrders = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM orders`, [])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getUserByUID = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM user WHERE uid = ?`, [req.body.uid])
        res.json({ data: data[0], success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getAllPings = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM ping`, [])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const replyPing = async (req, res) => {
    try {
        await query(`UPDATE ping SET admin_reply = ? WHERE id = ?`, [
            req.body.admin_reply, req.body.id
        ])

        res.json({ success: true, msg: "You reply was sent" })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const addPage = async (req, res) => {
    try {
        if (!req.body.title || !req.body.meta || !req.body.content) {
            return res.json({ msg: "Send required fields" })
        }

        // check if slug exist 
        const slugdata = await query(`SELECT * FROM page WHERE slug = ?`, [req.body.slug])
        if (slugdata.length > 0) {
            return res.json({ msg: "Duplicate slug found" })
        }

        const data = await query(`INSERT INTO page (title, slug, meta, content) VALUES (?,?,?,?)`, [
            req.body.title, req.body.slug, req.body.meta, req.body.content
        ])
        res.json({ success: true, msg: "Page was added" })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getAllPage = async (req, res) => {
    try {

        const data = await query(`SELECT * FROM page`, [])
        res.json({ success: true, data })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delPage = async (req, res) => {
    try {

        const data = await query(`DELETE FROM page WHERE id = ?`, [req.body.id])
        res.json({ success: true, msg: "Page was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getBySlug = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM page WHERE slug = ?`, [req.body.slug])

        if (data.length < 1) {
            return res.json({ success: false })
        }

        res.json({ data: data[0], success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const addTesti = async (req, res) => {
    try {

        const data = await query(`INSERT INTO testimonial (name, position, description) VALUES (?,?,?)`, [
            req.body.name, req.body.position, req.body.description
        ])
        res.json({ success: true, msg: "Testimonial was added" })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getAllTesi = async (req, res) => {
    try {
        const data = await query(`SELECT * from testimonial`, [])
        res.json({ data, success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delTesti = async (req, res) => {
    try {

        const data = await query(`DELETE FROM testimonial WHERE id  = ? `, [req.body.id])
        res.json({ data, success: true, msg: "Testimonial was deleted" })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const addFaq = async (req, res) => {
    try {
        const data = await query(`INSERT INTO faq (que, ans) VALUES (?,?)`, [
            req.body.que, req.body.ans
        ])
        res.json({ success: true, msg: "Faq was added" })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const getAllFaq = async (req, res) => {
    try {
        const data = await query(`SELECT * from faq`, [])
        res.json({ data, success: true })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delFaq = async (req, res) => {
    try {
        const data = await query(`DELETE FROM faq WHERE id  = ? `, [req.body.id])
        res.json({ data, success: true, msg: "Faq was deleted" })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const addFeatures = async (req, res) => {
    try {
        if (!req.files || !req.body.title || !req.body.des) {
            return res.json({ msg: "please send all requred fields" })
        }

        if (req.files) {
            if (req.files.file !== undefined) {
                const file = req.files.file
                const filename = ("" + Math.random()).substring(2, 7) + Date.now() + file.name
                const currentDir = process.cwd();

                file.mv(`${currentDir}/client/public/images/${filename}`, err => {
                    if (err) {
                        console.log(err)
                        return res.json({ err })
                    }
                })
                await query(`INSERT INTO features (title, des, image) VALUES (?,?,?)`, [
                    req.body.title,
                    req.body.des,
                    filename
                ])

                res.json({ success: true, msg: "Feature was added" })
            } else {
                return res.json({ msg: "Please send file" })
            }
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const getAllFeatures = async (req, res) => {
    try {
        const data = await query(`SELECT * FROm features`, [])
        res.json({ data, success: true })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delFeature = async (req, res) => {
    console.log(req.body)
    try {
        await query(`DELETE FROM features WHERE id = ?`, [req.body.id])
        res.json({ msg: "Feature was deleted", success: true })
    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const delOrder = async (req, res) => {
    try {
        await query(`DELETE FROM orders WHERE id = ?`, [req.body.id])
        res.json({ msg: "Order record was deleted", success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const delPing = async (req, res) => {
    try {
        await query(`DELETE FROM ping WHERE id = ?`, [req.body.id])
        res.json({ msg: "Ping record was deleted", success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const directUserLogin = async (req, res) => {
    try {
        const user = await query(`SELECT * FROM user WHERE uid = ?`, [req.body.uid])
        const token = sign({ uid: user[0].uid, role: 'user', password: user[0].password, email: user[0].email }, process.env.JWTKEY, {})
        console.log(token)
        res.json({
            success: true,
            token: token
        })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const getAdmin = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM admin WHERE uid = ?`, [req.decode.uid])
        res.json({ data: data[0], success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

const updateAdmin = async (req, res) => {
    try {

        if (req.body.newpass) {
            const hash = await bcrypt.hash(req.body.newpass, 10)
            await query(`UPDATE admin SET email = ?, password = ? WHERE uid = ?`, [req.body.email, hash, req.decode.uid])
            res.json({ success: true, msg: "Admin was updated refresh the page" })
        } else {
            await query(`UPDATE admin SET email = ? WHERE uid = ?`, [req.body.email, req.decode.uid])
            res.json({ success: true, msg: "Admin was updated refresh the page" })
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}



const adminRecovery = async (req, res) => {
    try {
        const checkEmailValid = await query(`SELECT * FROM admin WHERE email = ?`, [req.body.recovery_email])
        if (checkEmailValid.length < 1) {
            return res.json({ success: false, msg: "We have sent a recovery link if this email is associated with admin account." })
        }

        await sendRecoveryEmail(checkEmailValid[0], "admin", req)

        res.json({ success: true, msg: "We have sent a recovery link if this email is associated with admin account." })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}



const updateRecoverPass = async (req, res) => {
    try {
        if (!req.body.password) {
            return res.json({ success: false, msg: "No input provided" })
        }

        if (moment(req.decode.time).diff(moment(new Date()), 'hours') > 1) {
            return res.json({ success: false, msg: "Token expired" })
        }

        const hashpassword = await bcrypt.hash(req.body.password, 10)

        const result = await query(`UPDATE admin SET password = ? WHERE email = ?`, [hashpassword, req.decode.old_email])
        console.log(result)
        res.json({ success: true, msg: "Admin has been updated", data: result })


    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


export { login, getUsers, adminRecovery, updateRecoverPass, getAdmin, updateAdmin, addFeatures, directUserLogin, delPing, delOrder, delFeature, getAllFeatures, delPage, addFaq, delFaq, getAllFaq, delTesti, getAllTesi, addTesti, getAllPings, getBySlug, getAllPage, addPage, replyPing, editUser, delUser, getAllOrders, updateUserPlan, getUserByUID }
