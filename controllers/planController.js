import query from '../database/dbpromise.js'
import bcrypt, { getRounds } from 'bcrypt'
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import moment from 'moment'

const addPlan = async () => {
    try {

    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
}


export { addPlan }
