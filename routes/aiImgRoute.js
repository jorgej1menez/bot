import userValidator from '../middlewares/userValidator.js'
import { checkIfPlanExpire, checkDallLimit } from '../middlewares/planValidator.js'
import { Router } from 'express'
import { openAiImage, downloadImages, checkHamWizToken, returnTokenTxt2Img } from '../functions/function.js'
import query from '../database/dbpromise.js'
import { createAvatarImages, createUpscale, downloadAiAvatar, downloadImage, downloadText2Img, makeTextImg, uploadAndCropImage } from '../functions/hamwizfun.js'
import randomstring from 'randomstring'

const router = Router()


router.post('/hamwiz_text_to_img', userValidator, checkIfPlanExpire, checkDallLimit, async (req, res) => {
    try {
        // cehck if the requested images are more that limit 
        if (req.body.numOfImage > req.user?.dalle_limit) {
            return res.json({ msg: `You are requesting ${req.body.numOfImage} images however you have ${req.body.numOfImage} limits left` })
        }

        const { prompt, negative_prompt, size, model } = req.body
        if (!prompt || !size || !model) {
            return res.json({ success: false, msg: "Not enough input provided" })
        }

        const checkHamWizAPI = await query(`SELECT * FROM apikeys`, [])
        const hamWizApi = checkHamWizAPI[0]?.hamwiz_api

        if (!hamWizApi) {
            return res.json({ success: false, msg: "HamWiz API keys not found" })
        }

        const getTokens = await checkHamWizToken(hamWizApi)
        if (!getTokens?.success) {
            res.json({ success: false, msg: getTokens?.message || "Check your tokens" })
        } else {
            // res.json({ success: true, tokenAvailable: getTokens?.tokenAvailable })

            const sizeAvailable = ["512x512", "768x768", "512x768"]

            if (!sizeAvailable?.includes(size)) {
                return res.json({ success: false, msg: "Invalid size provided" })
            }

            const tokenSpent = returnTokenTxt2Img(size)
            if (tokenSpent > req.hamWizTokens) {
                return res.json({ success: false, msg: "Not enough credits avaible in HamWiz account to complete this" })
            }
        }

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})

router.post('/gen_ham_ai_img', userValidator, checkIfPlanExpire, checkDallLimit, async (req, res) => {
    try {
        const { prompt, model, negPrompt } = req.body

        let negative_prompt = ""
        negative_prompt = req.body.negative_prompt

        if (!negPrompt) {
            negative_prompt = ""
        }

        if (!prompt || !model) {
            return res.json({ success: false, msg: "Please enter all details" })
        }

        const getAPI = await query(`SELECT * FROM apikeys`, [])
        const apiKey = getAPI[0]?.hamwiz_api

        console.log({ apiKey })

        if (!apiKey) {
            return res.json({ success: false, msg: "HamWiz API keys not found" })
        }

        const genImg = await makeTextImg(prompt, negative_prompt, model, apiKey)
        console.log({ genImg })

        if (!genImg.success) {
            return res.json({ success: false, msg: genImg?.message })
        }

        await query(`INSERT INTO hamWiz_img (uid, job_id, prompt, negative_prompt, status) VALUES (?,?,?,?,?)`, [
            req.decode.uid,
            genImg?.jobID,
            prompt,
            negative_prompt,
            "GENERATING"
        ])

        res.json({ success: true, msg: "Image is generating check after few secounds" })

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})



// download img 
router.get('/get_hamwiz_ai_img', userValidator, async (req, res) => {
    try {
        const getPending = await query(`SELECT * FROM hamWiz_img WHERE status = ? AND uid = ?`, ["GENERATING", req.decode.uid])

        const getAPI = await query(`SELECT * FROM apikeys`, [])
        const apiKey = getAPI[0]?.hamwiz_api
        if (getPending.length > 0) {
            await Promise.all(getPending.map(async (i) => {
                try {
                    const getImg = await downloadText2Img(i?.job_id, apiKey)
                    if (getImg?.image) {
                        const dir = process.cwd()
                        const randomSt = randomstring.generate()
                        await Promise.all([
                            downloadImage(getImg?.image, `${dir}/client/public/aiimages/${randomSt}.png`),
                            downloadImage(getImg?.bgImg, `${dir}/client/public/aiimages/${randomSt}-bw.png`)
                        ]);
                        await query(`UPDATE hamWiz_img SET image = ?, bgRem = ?, status = ? WHERE job_id = ?`, [`${randomSt}.png`, `${randomSt}-bw.png`, "GENERATED", i?.job_id])
                    }
                } catch (error) {
                    console.error('Error processing job:', i?.job_id, error.message);
                    // Handle the error, e.g., log it or continue to the next iteration
                }
            }));
            const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
            const limits = getUser[0]?.dalle_limit || 0
            const finalLimit = parseInt(limits) - getPending.length
            await query(`UPDATE user SET dalle_limit = ? WHERE uid = ?`, [finalLimit, req.decode.uid])
        }
        const data = await query(`SELECT * FROM hamWiz_img WHERE uid = ? AND status =?`, [req.decode.uid, "GENERATED"])
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.json({ msg: 'server error', err });
    }
});

// get pending images 
router.get('/pending_hamwiz_ai_img', userValidator, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM hamWiz_img WHERE status = ? AND uid = ?`, ["GENERATING", req.decode.uid])
        res.json({ data, success: true })
    } catch (err) {
        console.error(err);
        res.json({ msg: 'server error', err });
    }
})

// del image
router.post('/del_hamwiz_ai_img', userValidator, async (req, res) => {
    try {
        await query(`DELETE FROM hamWiz_img WHERE id = ? AND uid = ?`, [req.body.id, req.decode.uid])
        res.json({ success: true, msg: "Image was deleted" })

    } catch (err) {
        console.error(err);
        res.json({ msg: 'server error', err });
    }
});


router.post('/upload_image', userValidator, async (req, res) => {
    try {
        const dir = process.cwd();
        const randomSt = randomstring.generate();
        const filePath = `${dir}/client/public/images/${randomSt}.png`;

        // Check if the 'file' exists in req.files
        if (!req.files || !req.files.file) {
            return res.json({ success: false, msg: 'Image not found.' });
        }

        const uploadedFile = req.files.file;

        // Move the file to the specified path
        await uploadedFile.mv(filePath);

        await query(`INSERT INTO upload_media (uid, file) VALUES (?, ?)`, [
            req.decode.uid,
            `${randomSt}.png`
        ]);

        res.json({ success: true, msg: "Image was uploaded" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, msg: 'Server error', err });
    }
});

// get upload media 
router.get('/uploaded_media', userValidator, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM upload_media WHERE uid = ?`, [req.decode.uid])
        res.json({ data, success: true })
    } catch (err) {
        console.error(err);
        res.json({ msg: 'server error', err });
    }
})

// request for ai avatar 
router.post('/create_avatar', userValidator, async (req, res) => {
    try {
        const { face, body } = req.body;
        if (!face || !body) {
            return res.json({ msg: "send required fields" });
        }

        const getAPI = await query(`SELECT * FROM apikeys`, []);
        const apiKey = getAPI[0]?.hamwiz_api;

        if (!apiKey) {
            return res.json({ success: false, msg: "No HamWiz Token found" });
        }

        const create = await createAvatarImages(`${process.env.URI}/images/${face}`, `${process.env.URI}/images/${body}`, apiKey);
        console.log({ create });

        if (!create.success) {
            return res.json({ success: false, msg: create?.message || create?.reason });
        }

        await query(`INSERT INTO hamWiz_avatar (uid, job_id, status) VALUES (?,?,?)`, [
            req.decode.uid,
            create.jobID,
            "GENERATING"
        ]);

        return res.json({ success: true, msg: "Your Avatar is generating" });
    } catch (err) {
        console.error(err);
        return res.json({ msg: 'server error', err });
    }
});

// get all pending avatar 
router.get('/pending_avatar', userValidator, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM hamWiz_avatar WHERE uid = ? AND status = ?`, [req.decode.uid, "GENERATING"])
        res.json({ data, success: true })
    } catch (err) {
        console.error(err);
        return res.json({ msg: 'server error', err });
    }
})

// add image upscale 
router.post('/hamwiz_img_upscale', userValidator, async (req, res) => {
    try {
        const file = req.files.file
        if (!file || file === undefined) {
            return res.json({ success: false, msg: "Please attach an image file" })
        }

        const getAPI = await query(`SELECT * FROM apikeys`, []);
        const apiKey = getAPI[0]?.hamwiz_api;

        if (!apiKey) {
            return res.json({ success: false, msg: "HamWiz TOKEN not found" })
        }

        const filename = ("" + Math.random()).substring(2, 7) + Date.now() + file.name
        const dir = process.cwd();

        file.mv(`${dir}/client/public/images/${filename}`, err => {
            if (err) {
                console.log(err)
                return res.json({ err })
            }
        })

        const fileUrl = `${process.env.URI}/images/${filename}`
        const create = await createUpscale(fileUrl, apiKey)

        if (!create.success) {
            return res.json({ success: false, msg: create?.message || create?.reason });
        }


        await query(`INSERT INTO hamWiz_upscale (uid, job_id, old_image, status) VALUES (?,?,?,?)`, [
            req.decode.uid,
            create.jobID,
            filename,
            "GENERATING"
        ]);

        return res.json({ success: true, msg: "Your Image is Upscaling" });

    } catch (err) {
        console.error(err);
        return res.json({ msg: 'server error', err });
    }
})


// get upscale img 
router.get('/get_upscale_img', userValidator, async (req, res) => {
    try {
        const getPenUpscale = await query(`SELECT * FROM hamWiz_upscale WHERE status = ? AND uid= ?`, ["GENERATING", req.decode.uid])

        const getAPI = await query(`SELECT * FROM apikeys`, [])
        const apiKey = getAPI[0]?.hamwiz_api

        if (getPenUpscale.length > 0) {
            await Promise.all(getPenUpscale.map(async (i) => {
                try {
                    const getImg = await downloadAiAvatar(i?.job_id, "upscale", apiKey)

                    if (getImg?.image) {
                        const dir = process.cwd()
                        const randomSt = randomstring.generate()
                        await Promise.all([
                            downloadImage(getImg?.image, `${dir}/client/public/aiimages/${randomSt}.png`),
                        ]);
                        await query(`UPDATE hamWiz_upscale SET upscaled_image = ?, status = ? WHERE job_id = ?`, [`${randomSt}.png`, "GENERATED", i?.job_id])
                    }
                } catch (error) {
                    console.error('Error processing job:', i?.job_id, error.message);
                    // Handle the error, e.g., log it or continue to the next iteration
                }
            }));

            const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
            const limits = getUser[0]?.dalle_limit || 0
            const finalLimit = parseInt(limits) - getPenUpscale.length
            await query(`UPDATE user SET dalle_limit = ? WHERE uid = ?`, [finalLimit, req.decode.uid])
        }

        const data = await query(`SELECT * FROM hamWiz_upscale WHERE uid = ? AND status = ?`, [req.decode.uid, "GENERATED"])

        res.json({ success: true, data });

    } catch (err) {
        console.error(err);
        return res.json({ msg: 'server error', err });
    }
})


// get upscale pending 
router.get('/get_pending_upscale', userValidator, async (req, res) => {
    try {
        const data = await query(`SELECT * FROM hamWiz_upscale WHERE status = ? AND UID = ?`, ["GENERATING", req.decode.uid])
        res.json({ data, success: true })
    } catch (err) {
        console.error(err);
        return res.json({ msg: 'server error', err });
    }
})

// get ai avatar 
router.get('/get_hamwiz_avatar_img', userValidator, async (req, res) => {
    try {
        const getPenAvatar = await query(`SELECT * FROM hamWiz_avatar WHERE status = ? AND uid = ?`, ["GENERATING", req.decode.uid])

        const getAPI = await query(`SELECT * FROM apikeys`, [])
        const apiKey = getAPI[0]?.hamwiz_api

        if (getPenAvatar.length > 0) {
            await Promise.all(getPenAvatar.map(async (i) => {
                try {
                    const getImg = await downloadAiAvatar(i?.job_id, "avatar", apiKey)

                    if (getImg?.result_image) {
                        const dir = process.cwd()
                        const randomSt = randomstring.generate()
                        await Promise.all([
                            downloadImage(getImg?.result_image, `${dir}/client/public/aiimages/${randomSt}.png`),
                        ]);
                        await query(`UPDATE hamWiz_avatar SET image = ?, status = ? WHERE job_id = ?`, [`${randomSt}.png`, "GENERATED", i?.job_id])
                    }
                } catch (error) {
                    console.error('Error processing job:', i?.job_id, error.message);
                    // Handle the error, e.g., log it or continue to the next iteration
                }
            }));

            const getUser = await query(`SELECT * FROM user WHERE uid = ?`, [req.decode.uid])
            const limits = getUser[0]?.dalle_limit || 0
            const finalLimit = parseInt(limits) - getPenAvatar.length
            await query(`UPDATE user SET dalle_limit = ? WHERE uid = ?`, [finalLimit, req.decode.uid])
        }

        const data = await query(`SELECT * FROM hamWiz_avatar WHERE uid = ? AND status =?`, [req.decode.uid, "GENERATED"])
        res.json({ success: true, data });

    } catch (err) {
        console.log(err)
        res.json({ msg: 'server error', err })
    }
})


export default router