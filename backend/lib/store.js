const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function emptyDb() {
    return { users: [], jobs: [], avatars: [] };
}

function createStore(dataDir) {
    const imagesDir = path.join(dataDir, "images");
    const uploadsDir = path.join(dataDir, "uploads");
    const dbFile = path.join(dataDir, "db.json");
    const secretFile = path.join(dataDir, "auth-secret");

    fs.mkdirSync(imagesDir, { recursive: true });
    fs.mkdirSync(uploadsDir, { recursive: true });

    let data = emptyDb();
    if (fs.existsSync(dbFile)) {
        try {
            data = { ...emptyDb(), ...JSON.parse(fs.readFileSync(dbFile, "utf8")) };
        } catch {
            data = emptyDb();
        }
    }

    let interrupted = false;
    for (const job of data.jobs) {
        if (job.status === "queued" || job.status === "processing") {
            job.status = "failed";
            job.stage = "failed";
            job.error = {
                code: "INTERRUPTED",
                message: "Generation was interrupted because the server restarted."
            };
            job.updatedAt = new Date().toISOString();
            interrupted = true;
        }
    }

    const persist = () => {
        const temp = `${dbFile}.${process.pid}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(data, null, 2));
        fs.renameSync(temp, dbFile);
    };

    if (interrupted || !fs.existsSync(dbFile)) persist();

    let chain = Promise.resolve();
    function mutate(fn) {
        const task = chain.then(() => {
            const result = fn(data);
            persist();
            return result;
        });
        chain = task.then(() => undefined, () => undefined);
        return task;
    }

    function clone(value) {
        return value == null ? value : structuredClone(value);
    }

    return {
        dataDir,
        imagesDir,
        uploadsDir,
        mutate,
        getOrCreateSecret() {
            if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, "utf8").trim();
            const secret = crypto.randomBytes(32).toString("hex");
            fs.writeFileSync(secretFile, secret);
            return secret;
        },
        findUserByName(username) {
            const key = String(username || "").trim().toLowerCase();
            return clone(data.users.find((user) => user.usernameKey === key) || null);
        },
        findUserById(id) {
            return clone(data.users.find((user) => user.id === id) || null);
        },
        getJob(id) {
            return clone(data.jobs.find((job) => job.id === id) || null);
        },
        listAvatars(userId) {
            return data.avatars
                .filter((avatar) => avatar.userId === userId)
                .map((avatar) => clone(avatar))
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        },
        findImage(id) {
            for (const avatar of data.avatars) {
                const image = avatar.images.find((item) => item.id === id);
                if (image) return clone({ image, avatar });
            }
            return null;
        },
        writeImage(id, ext, buffer) {
            const filename = `${id}${ext}`;
            fs.writeFileSync(path.join(imagesDir, filename), buffer);
            return filename;
        },
        writeUpload(id, ext, buffer) {
            const filename = `${id}${ext}`;
            fs.writeFileSync(path.join(uploadsDir, filename), buffer);
            return filename;
        },
        readUpload(filename) {
            return fs.readFileSync(path.join(uploadsDir, path.basename(filename)));
        },
        readImage(filename) {
            return fs.readFileSync(path.join(imagesDir, path.basename(filename)));
        }
    };
}

module.exports = { createStore };
