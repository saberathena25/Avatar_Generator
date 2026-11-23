const express = require("express");
const multer = require("multer");
const { detectImageType, generateImage } = require("../lib/images");
const { publicJob } = require("../lib/jobs");
const { userFromRequest } = require("./auth");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }
});

function cleanStyle(style) {
    const value = String(style || "Anime").trim().slice(0, 60);
    return value || "Anime";
}

function cleanPrompt(prompt) {
    return String(prompt || "").trim().slice(0, 1000);
}

function cleanVariations(value) {
    const count = Number(value == null || value === "" ? 1 : value);
    if (!Number.isInteger(count) || count < 1 || count > 4) return null;
    return count;
}

function wantsEnhance(value) {
    if (value === undefined || value === null || value === "") return true;
    return value === true || value === "true" || value === "on" || value === "1";
}

function canReadOwned(record, user) {
    if (!record.userId) return true;
    return Boolean(user && user.id === record.userId);
}

function createAvatarRouter({ store, auth, jobs, imageGen }) {
    const router = express.Router();
    const generator = imageGen || { generate: generateImage };

    function currentUser(req) {
        return userFromRequest(req, store, auth);
    }

    router.post("/generate", async (req, res, next) => {
        try {
            const prompt = cleanPrompt(req.body?.prompt);
            const variations = cleanVariations(req.body?.variations);
            if (!prompt) {
                return res.status(400).json({ error: "Enter a description.", code: "VALIDATION" });
            }
            if (!variations) {
                return res.status(400).json({ error: "Choose between 1 and 4 variations.", code: "VALIDATION" });
            }
            const user = currentUser(req);
            const job = await jobs.createJob({
                userId: user?.id || null,
                prompt,
                style: cleanStyle(req.body?.style),
                variations,
                enhance: wantsEnhance(req.body?.enhance),
                source: req.body?.source === "manual" ? "manual" : "text"
            });
            res.status(202).json({ jobId: job.id, status: job.status });
        } catch (error) {
            next(error);
        }
    });

    router.post("/transform", (req, res, next) => {
        upload.single("photo")(req, res, (error) => {
            if (error) {
                const message = error.code === "LIMIT_FILE_SIZE"
                    ? "Photo must be 4 MB or smaller."
                    : "Could not read that photo upload.";
                return res.status(400).json({ error: message, code: "VALIDATION" });
            }
            handleTransform(req, res).catch(next);
        });
    });

    async function handleTransform(req, res) {
        const type = detectImageType(req.file?.buffer);
        if (!req.file || !type) {
            return res.status(400).json({
                error: "Choose a PNG, JPEG, WEBP, or GIF photo.",
                code: "VALIDATION"
            });
        }
        const variations = cleanVariations(req.body?.variations);
        if (!variations) {
            return res.status(400).json({ error: "Choose between 1 and 4 variations.", code: "VALIDATION" });
        }
        const user = currentUser(req);
        const photoId = require("crypto").randomUUID();
        const photoFilename = store.writeUpload(photoId, type.ext, req.file.buffer);
        const job = await jobs.createJob({
            userId: user?.id || null,
            prompt: cleanPrompt(req.body?.prompt),
            style: cleanStyle(req.body?.style),
            variations,
            enhance: wantsEnhance(req.body?.enhance),
            source: "photo",
            photoFilename,
            photoType: type.contentType
        });
        res.status(202).json({ jobId: job.id, status: job.status });
    }

    router.get("/jobs/:id", (req, res) => {
        const job = store.getJob(req.params.id);
        if (!job || !canReadOwned(job, currentUser(req))) {
            return res.status(404).json({ error: "Generation not found.", code: "NOT_FOUND" });
        }
        res.json(publicJob(job));
    });

    router.get("/history", (req, res) => {
        const user = currentUser(req);
        if (!user) return res.status(401).json({ error: "Sign in required.", code: "UNAUTHORIZED" });
        const avatars = store.listAvatars(user.id).map((avatar) => ({
            id: avatar.id,
            prompt: avatar.prompt,
            enhancedPrompt: avatar.enhancedPrompt,
            enhancementSource: avatar.enhancementSource,
            style: avatar.style,
            source: avatar.source,
            createdAt: avatar.createdAt,
            images: avatar.images.map((image) => ({
                id: image.id,
                url: `/avatar/images/${image.id}`
            }))
        }));
        res.json({ avatars });
    });

    router.get("/images/:id", (req, res) => {
        const found = store.findImage(req.params.id);
        if (!found || !canReadOwned(found.avatar, currentUser(req))) {
            return res.status(404).json({ error: "Image not found.", code: "NOT_FOUND" });
        }
        const buffer = store.readImage(found.image.filename);
        res.setHeader("Content-Type", found.image.contentType);
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", found.avatar.userId ? "private, max-age=31536000" : "public, max-age=31536000");
        res.send(buffer);
    });

    router.get("/proxy-image", async (req, res) => {
        const prompt = cleanPrompt(req.query.prompt);
        if (!prompt) return res.status(400).json({ error: "Prompt required.", code: "VALIDATION" });
        try {
            const generated = await generator.generate({
                prompt,
                seed: Number(req.query.seed) || 1
            });
            res.setHeader("Content-Type", generated.contentType);
            res.send(generated.buffer);
        } catch (error) {
            res.status(502).json({ error: error.message, code: error.code || "UPSTREAM" });
        }
    });

    return router;
}

module.exports = { createAvatarRouter };
