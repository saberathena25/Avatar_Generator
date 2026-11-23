const crypto = require("crypto");

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password, salt = crypto.randomBytes(16)) {
    const hash = crypto.scryptSync(password, salt, 32, SCRYPT);
    return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

function verifyPassword(password, user) {
    const actual = crypto.scryptSync(password, Buffer.from(user.salt, "hex"), 32, SCRYPT);
    const expected = Buffer.from(user.hash, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(user) {
    return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function createAuth(secret) {
    function sign(payload) {
        const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
        const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
        return `${body}.${signature}`;
    }

    function readPayload(token) {
        if (!token || !token.includes(".")) return null;
        const [body, signature] = token.split(".");
        const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
        const actualBuf = Buffer.from(signature);
        const expectedBuf = Buffer.from(expected);
        if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
            return null;
        }
        try {
            const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
            if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
            return payload;
        } catch {
            return null;
        }
    }

    function tokenFor(user) {
        return sign({ uid: user.id, exp: Date.now() + TOKEN_TTL_MS });
    }

    function readToken(req) {
        const header = req.get("authorization") || "";
        if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
        if (typeof req.query.access_token === "string") return req.query.access_token;
        return null;
    }

    return {
        hashPassword,
        verifyPassword,
        publicUser,
        tokenFor,
        readPayload,
        readToken
    };
}

function validateCredentials(username, password) {
    const name = String(username || "").trim();
    const pass = String(password || "");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(name)) {
        return { error: "Username must be 3–24 letters, numbers, or underscores." };
    }
    if (pass.length < 8 || pass.length > 100) {
        return { error: "Password must be at least 8 characters." };
    }
    return { username: name, password: pass };
}

module.exports = { createAuth, validateCredentials, publicUser };
