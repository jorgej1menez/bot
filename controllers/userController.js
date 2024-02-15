import query from '../database/dbpromise.js'
import bcrypt from 'bcrypt'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import randomstring from 'randomstring'


const login = async (req, res) => {
    try {
        const body = req.body
        const email = body.email
        const pass = body.password

        console.log(req.body)

        if (!email || !pass) {
            return res.json({ msg: "please send required fields" })
        }

        // check for user 
        const userFind = await query(`SELECT * FROM user WHERE email = ?`, [email])
        if (userFind.length < 1) {
            return res.json({ msg: "Invalid credentials" })
        }
        const compare = await bcrypt.compare(pass, userFind[0].password)
        if (!compare) {
            return res.json({ msg: "Invalid credentials" })
        } else {
            const token = sign({ uid: userFind[0].uid, role: 'user', password: userFind[0].password, email: userFind[0].email }, process.env.JWTKEY, {})
            res.json({
                success: true, token
            })
        }


    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


const signup = async (req, res) => {
    try {
        const body = req.body
        const name = body.name
        const email = body.email
        const pass = body.password

        if (!name || !email || !pass) {
            return res.json({ msg: "Please send all required fields" })
        }

        // check if user already has same email
        const findEx = await query(`SELECT * FROM user WHERE email = ?`, email)
        if (findEx.length > 0) {
            return res.json({ msg: "A user already exist with this email" })
        }

        const haspass = await bcrypt.hash(pass, 10)
        const uid = randomstring.generate();

        await query(`INSERT INTO user (uid, name, email, password) VALUES (?,?,?,?)`, [
            uid, name, email, haspass
        ])

        res.json({ msg: "Signup Success", success: true })

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}

export { login, signup }
