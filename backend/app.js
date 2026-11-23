const path = require("path");
const express = require("express");
const cors = require("cors");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createStore } = require("./lib/store");
const { createAuth } = require("./lib/auth");
const { createAi } = require("./lib/ai");
const { createJobService } = require("./lib/jobs");
const { createAuthRouter } = require("./routes/auth");
const { createAvatarRouter } = require("./routes/avatar");
const { DEFAULT_TEXT_MODEL } = require("./lib/ai");

function createApp(options = {}) {
    const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, "..", "data");
    const store = options.store || createStore(dataDir);
    const auth = options.auth || createAuth(options.authSecret || process.env.AUTH_SECRET || store.getOrCreateSecret());
    const ai = options.ai || createAi();
    const jobs = options.jobs || createJobService({
        store,
        ai,
        imageGen: options.imageGen || { generate: require("./lib/images").generateImage }
    });

    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "1mb" }));

    app.get("/health", (req, res) => {
        res.json({
            ok: true,
            textModel: ai.textModel || DEFAULT_TEXT_MODEL,
            imageProvider: process.env.POLLINATIONS_API_KEY ? "pollinations" : "pollinations-legacy"
        });
    });

    app.use("/auth", createAuthRouter({ store, auth }));
    app.use("/avatar", createAvatarRouter({
        store,
        auth,
        jobs,
        imageGen: options.imageGen
    }));
    app.use(express.static(path.join(__dirname, "..", "frontend")));

    app.use((error, req, res, next) => {
        console.error(error);
        if (res.headersSent) return next(error);
        res.status(500).json({ error: "Something went wrong.", code: "INTERNAL" });
    });

    return app;
}

module.exports = { createApp };
