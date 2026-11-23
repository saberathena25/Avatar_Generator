const crypto = require("crypto");

function createJobService({ store, ai, imageGen }) {
    async function createJob(fields) {
        const job = {
            id: crypto.randomUUID(),
            userId: fields.userId || null,
            status: "queued",
            stage: "queued",
            prompt: fields.prompt,
            style: fields.style,
            variations: fields.variations,
            enhance: fields.enhance,
            source: fields.source,
            photoFilename: fields.photoFilename || null,
            photoType: fields.photoType || null,
            progress: { completed: 0, total: fields.variations },
            error: null,
            warnings: [],
            result: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await store.mutate((data) => {
            data.jobs.push(job);
        });
        setImmediate(() => {
            processJob(job.id).catch((error) => {
                console.error("Unhandled generation error:", error.message);
            });
        });
        return store.getJob(job.id);
    }

    async function fail(id, code, message) {
        await store.mutate((data) => {
            const job = data.jobs.find((item) => item.id === id);
            if (!job || job.status === "completed") return;
            job.status = "failed";
            job.stage = "failed";
            job.error = { code, message };
            job.updatedAt = new Date().toISOString();
        });
    }

    async function processJob(id) {
        const initial = store.getJob(id);
        if (!initial || initial.status !== "queued") return;

        try {
            let workingPrompt = initial.prompt;
            if (initial.photoFilename) {
                await store.mutate((data) => {
                    const job = data.jobs.find((item) => item.id === id);
                    job.status = "processing";
                    job.stage = "describing";
                    job.updatedAt = new Date().toISOString();
                });
                const photo = store.readUpload(initial.photoFilename);
                const description = await ai.describePhoto(photo, initial.photoType, initial.style, initial.prompt);
                workingPrompt = [initial.prompt, `Photo details: ${description}`].filter(Boolean).join(". ");
            }

            let enhancedPrompt = workingPrompt;
            let enhancementSource = "original";
            let enhancementWarning = null;
            if (initial.enhance) {
                await store.mutate((data) => {
                    const job = data.jobs.find((item) => item.id === id);
                    job.status = "processing";
                    job.stage = "enhancing";
                    job.updatedAt = new Date().toISOString();
                });
                const enhanced = await ai.enhance(workingPrompt, initial.style);
                enhancedPrompt = enhanced.prompt;
                enhancementSource = enhanced.source;
                enhancementWarning = enhanced.warning || null;
            } else {
                await store.mutate((data) => {
                    const job = data.jobs.find((item) => item.id === id);
                    job.status = "processing";
                    job.stage = "generating";
                    job.updatedAt = new Date().toISOString();
                });
            }

            const warnings = [];
            if (enhancementWarning) warnings.push(enhancementWarning);
            const images = [];

            for (let index = 0; index < initial.variations; index += 1) {
                await store.mutate((data) => {
                    const job = data.jobs.find((item) => item.id === id);
                    job.status = "processing";
                    job.stage = "generating";
                    job.progress = { completed: index, total: initial.variations };
                    job.updatedAt = new Date().toISOString();
                });
                try {
                    const seed = crypto.randomInt(1, 2147483646);
                    const generated = await imageGen.generate({ prompt: enhancedPrompt, seed });
                    const imageId = crypto.randomUUID();
                    const filename = store.writeImage(imageId, generated.ext, generated.buffer);
                    images.push({
                        id: imageId,
                        filename,
                        contentType: generated.contentType
                    });
                } catch (error) {
                    warnings.push(error.message || `Variation ${index + 1} failed.`);
                }
            }

            if (!images.length) {
                await fail(id, "GENERATION_FAILED", warnings[warnings.length - 1] || "Image generation failed.");
                return;
            }

            const avatar = {
                id: crypto.randomUUID(),
                userId: initial.userId,
                jobId: id,
                prompt: initial.prompt,
                enhancedPrompt,
                enhancementSource,
                style: initial.style,
                source: initial.source,
                images,
                createdAt: new Date().toISOString()
            };

            await store.mutate((data) => {
                const job = data.jobs.find((item) => item.id === id);
                data.avatars.push(avatar);
                job.status = "completed";
                job.stage = "completed";
                job.progress = { completed: images.length, total: initial.variations };
                job.warnings = warnings;
                job.error = null;
                job.result = {
                    avatarId: avatar.id,
                    prompt: initial.prompt,
                    enhancedPrompt,
                    enhancementSource,
                    style: initial.style,
                    source: initial.source,
                    images: images.map((image) => ({
                        id: image.id,
                        url: `/avatar/images/${image.id}`
                    }))
                };
                job.updatedAt = new Date().toISOString();
            });
        } catch (error) {
            await fail(id, error.code || "GENERATION_FAILED", error.message || "Generation failed.");
        }
    }

    return { createJob, processJob };
}

function publicJob(job) {
    if (!job) return null;
    return {
        id: job.id,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        error: job.error,
        warnings: job.warnings || [],
        result: job.result,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    };
}

module.exports = { createJobService, publicJob };
