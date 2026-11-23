const express = require("express");
const crypto = require("crypto");
const { validateCredentials } = require("../lib/auth");

function createAuthRouter({ store, auth }) {
    const router = express.Router();

    async function registerOrLogin(req, res, mode) {
        const checked = validateCredentials(req.body?.username, req.body?.password);
        if (checked.error) {
            return res.status(400).json({ error: checked.error, code: "VALIDATION" });
        }

        if (mode === "register") {
            const existing = store.findUserByName(checked.username);
            if (existing) {
                return res.status(409).json({ error: "That username is already taken.", code: "CONFLICT" });
            }
            const password = auth.hashPassword(checked.password);
            const user = {
                id: crypto.randomUUID(),
                username: checked.username,
                usernameKey: checked.username.toLowerCase(),
                salt: password.salt,
                hash: password.hash,
                createdAt: new Date().toISOString()
            };
            await store.mutate((data) => {
                if (data.users.some((item) => item.usernameKey === user.usernameKey)) {
                    user.conflict = true;
                    return;
                }
                data.users.push(user);
            });
            if (user.conflict) {
                return res.status(409).json({ error: "That username is already taken.", code: "CONFLICT" });
            }
            const saved = store.findUserById(user.id);
            return res.status(201).json({ token: auth.tokenFor(saved), user: auth.publicUser(saved) });
        }

        const user = store.findUserByName(checked.username);
        if (!user || !auth.verifyPassword(checked.password, user)) {
            return res.status(401).json({ error: "Invalid username or password.", code: "UNAUTHORIZED" });
        }
        return res.json({ token: auth.tokenFor(user), user: auth.publicUser(user) });
    }

    router.post("/register", (req, res, next) => {
        registerOrLogin(req, res, "register").catch(next);
    });

    router.post("/login", (req, res, next) => {
        registerOrLogin(req, res, "login").catch(next);
    });

    router.get("/me", (req, res) => {
        const payload = auth.readPayload(auth.readToken(req));
        if (!payload) return res.status(401).json({ error: "Sign in required.", code: "UNAUTHORIZED" });
        const user = store.findUserById(payload.uid);
        if (!user) return res.status(401).json({ error: "Sign in required.", code: "UNAUTHORIZED" });
        res.json({ user: auth.publicUser(user) });
    });

    return router;
}

function userFromRequest(req, store, auth) {
    const payload = auth.readPayload(auth.readToken(req));
    if (!payload) return null;
    const user = store.findUserById(payload.uid);
    return user ? auth.publicUser(user) : null;
}

module.exports = { createAuthRouter, userFromRequest };
