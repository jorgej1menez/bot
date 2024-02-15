import { isSessionExists, createSession, getSession, deleteSession } from '../middlewares/req.js'
import response from './../response.js'
import query from '../database/dbpromise.js'


const find = (req, res) => {
    response(res, 200, true, 'Session found.')
}


const status = async (req, res) => {
    try {
        const states = ['connecting', 'connected', 'disconnecting', 'disconnected']
        const session = getSession(res.locals.sessionId)
        let state = states[session.ws.readyState]

        state =
            state === 'connected' && typeof (session.isLegacy ? session.state.legacy.user : session.user) !== 'undefined'
                ? 'authenticated'
                : state

        const userData = session?.authState?.creds?.me || session.user
        const status = session.user ? true : false

        // Send the response after all processing is done
        response(res, 200, status, '', { status: state, loginStatus: userData })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const add = async (req, res) => {
    const { id, isLegacy } = req.body

    // checking user 

    if (isSessionExists(id)) {
        return response(res, 409, false, 'Session already exists, please use another id.')
    }

    // adding new client in database for this user
    await query(`INSERT INTO instance (uid, client_id, name) VALUES (?,?,?)`, [
        req.decode.uid, id, req.body.name
    ])

    createSession(id, isLegacy === 'true', res)
}

const del = async (req, res) => {
    const { id } = req.params
    console.log("hey man")
    const session = getSession(id)

    console.log({ session })

    try {
        await session.logout()
    } catch {
    } finally {
        deleteSession(id, false)
    }
    response(res, 200, true, 'The session has been successfully deleted.', { msg: "The session was deleted" })
}

// get all users sessions 
const getUserSessions = async (req, res) => {
    try {
        const data = await query(`SELECT * FROM instance WHERE uid = ?`, [req.decode.uid])
        res.json({ success: true, data: data })
    } catch (err) {
        console.log(err)
        res.json({ err, msg: "server error" })
    }
}


export { find, status, add, del, getUserSessions }
