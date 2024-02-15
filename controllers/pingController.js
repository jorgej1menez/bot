import query from '../database/dbpromise.js'


const adminReply = async (req, res) => {
    try {

    } catch (err) {
        console.log(err)
        res.json({ msg: "server error", err })
    }
}


export { adminReply }
