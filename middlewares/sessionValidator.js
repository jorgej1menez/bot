import { isSessionExists } from '../middlewares/req.js'
import response from './../response.js'

const validate = (req, res, next) => {
    const sessionId = req.query.id ?? req.params.id

    if (!isSessionExists(sessionId)) {
        return response(res, 404, false, 'Session not found.')
    }
    console.log('done')

    res.locals.sessionId = sessionId
    next()
}

export default validate
