# AvatarForge — AI Avatar Generator

AvatarForge is a web-based avatar creation application. It provides an AI avatar generator, a manual avatar builder, photo-inspired avatar transformation, user registration and login, and an avatar history/gallery.

**You can run AvatarForge entirely on your own computer. You do not need to deploy it, purchase a domain, configure a hosting URL, or use a public website URL.** When running locally, open the application at:

**http://localhost:5000**

The Express backend also serves the frontend, so one local server runs the complete application.

---

## Features

- **AI Avatar Generator:** Create avatar variations from a text description.
- **Manual Avatar Builder:** Choose visual options and create a prompt for avatar generation.
- **Photo-to-Avatar Transformation:** Upload a portrait and generate a stylized, photo-inspired avatar.
- **Prompt Enhancement:** Use Groq to improve text prompts when an API key is configured.
- **User Accounts:** Register, sign in, and access user-specific avatar history.
- **Avatar Gallery:** View and download generated avatars.
- **Generation Status:** Track generation jobs while they are processing.

> Photo transformation uses an AI vision model to describe the uploaded photo, then sends that description to an image-generation service. It is photo-inspired generation; it does not guarantee exact identity preservation.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Authentication | Bearer tokens, password hashing |
| AI prompt and photo analysis | Groq API through the OpenAI-compatible SDK |
| Image generation | Pollinations |
| Local persistence | JSON file and local filesystem |
| File uploads | Multer |

## Project Structure

```text
AVATAR_GENERATOR/
├── backend/
│   ├── app.js
│   ├── server.js
│   ├── lib/
│   │   ├── ai.js
│   │   ├── auth.js
│   │   ├── images.js
│   │   ├── jobs.js
│   │   └── store.js
│   └── routes/
│       ├── auth.js
│       └── avatar.js
├── frontend/
│   ├── index.html
│   ├── ai-generator.html
│   ├── manual-generator.html
│   ├── signin.html
│   ├── script.js
│   ├── avatar-client.js
│   └── style.css
├── tests/
│   ├── backend.test.js
│   └── frontend.test.js
├── .env.example
├── .gitignore
├── package.json
└── package-lock.json
```

## Requirements

Install the following before running the project:

- **Node.js 18 or later** (Node.js 20 LTS or later is recommended).
- **npm**, which is included with Node.js.
- A modern browser such as Chrome, Edge, or Firefox.

Check that Node.js and npm are installed:

```bash
node --version
npm --version
```

## Run Locally — No Deployment or Public URL Required

### 1. Download or clone the project

Clone the repository:

```bash
git clone https://github.com/saberathena25/Avatar_Generator.git
```

Or download the repository as a ZIP file from GitHub and extract it.

### 2. Open the project folder

Open the extracted `AVATAR_GENERATOR` folder in VS Code or a terminal.

Make sure the terminal is in the same directory as the root `package.json`.

For example:

```bash
cd AVATAR_GENERATOR
```

### 3. Install dependencies

Run:

```bash
npm install
```

This installs the dependencies listed in `package.json`.

### 4. Configure environment variables

Create a file named `.env` in the project root (the same directory as `package.json`).

You can copy `.env.example` and rename the copy to `.env`.

The environment file supports these variables:

```env
GROQ_API_KEY=
POLLINATIONS_API_KEY=
AUTH_SECRET=
```

**What each variable does:**

| Variable | Required? | Purpose |
|---|---|---|
| `GROQ_API_KEY` | Optional for text generation; required for photo transformation | Enables Groq prompt enhancement and photo description |
| `POLLINATIONS_API_KEY` | Optional | Enables the authenticated Pollinations image-generation endpoint when configured |
| `AUTH_SECRET` | Optional | Keeps authentication tokens valid across server restarts when the same secret is retained |

If `GROQ_API_KEY` is not configured, text prompt enhancement falls back to a local prompt template. Photo transformation requires a working Groq API key.

If `POLLINATIONS_API_KEY` is not configured, the application attempts to use the legacy Pollinations image endpoint. Availability of external AI services depends on those providers and your internet connection.

**Keep `.env` private. Never commit API keys or secrets to GitHub or place them in frontend files.**

### 5. Start the application

From the project root, run:

```bash
npm start
```

You should see a message similar to:

```text
Server running on port 5000
```

The server uses port `5000` by default. If the `PORT` environment variable is set, it uses that port instead.

### 6. Open AvatarForge in your browser

Visit:

**http://localhost:5000**

You can use the application locally without a deployed backend URL, Vercel, Netlify, Render, a custom domain, or GitHub Pages.

Use the navigation in the application to open the AI Generator, Manual Builder, and Sign In pages.

### 7. Stop the local server

Return to the terminal where the server is running and press:

```text
Ctrl + C
```

To use AvatarForge again, run `npm start` and open `http://localhost:5000`.

---

## Run Tests

The project includes Node.js test-runner tests for backend and frontend behavior.

Run:

```bash
npm test
```

The test command runs:

```bash
node --test tests/backend.test.js tests/frontend.test.js
```

A passing test suite checks the covered application logic. It does not guarantee that external Groq or Pollinations services are available or that live image generation will succeed.

## Local Data and Storage

When running locally, the application stores its data on the computer in the project data directory.

The backend creates and uses:

```text
data/
├── db.json
├── auth-secret
├── images/
└── uploads/
```

- `db.json` stores local application records.
- `auth-secret` stores the generated authentication secret when `AUTH_SECRET` is not supplied.
- `images/` stores generated image files.
- `uploads/` stores uploaded photos.

The `data/` directory is ignored by Git. Back it up if you want to preserve local accounts and generated content. Deleting it removes the locally stored application data and images.

## API Endpoints

The backend exposes the following main endpoints on the same local origin:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check whether the backend is running |
| `POST` | `/auth/register` | Register a user |
| `POST` | `/auth/login` | Sign in |
| `GET` | `/auth/me` | Get the authenticated user's account information |
| `POST` | `/avatar/generate` | Start text-based avatar generation |
| `POST` | `/avatar/transform` | Start photo-inspired avatar transformation |
| `GET` | `/avatar/jobs/:id` | Check a generation job |
| `GET` | `/avatar/history` | Get the authenticated user's avatar history |
| `GET` | `/avatar/images/:id` | Retrieve an avatar image |
| `GET` | `/avatar/proxy-image` | Proxy an image request |

Check the local health endpoint in a browser:

**http://localhost:5000/health**

A successful response contains `"ok": true`.

## Troubleshooting

### `npm` or `node` is not recognized

Install Node.js from [https://nodejs.org/](https://nodejs.org/), close and reopen your terminal, then check:

```bash
node --version
npm --version
```

### Port 5000 is already in use

Stop the other process using port 5000, or set a different port in `.env`, for example:

```env
PORT=5001
```

Then start the app again and open `http://localhost:5001`.

### The page does not load

- Confirm that `npm start` is still running.
- Open the exact local address shown by the server.
- Do not open the HTML files directly using `file://`.
- Check the terminal for server errors.

### Prompt enhancement is unavailable

Check that `GROQ_API_KEY` is correctly set in the root `.env` file, then restart the server. Without the key, text prompt enhancement uses the local fallback prompt template.

### Photo transformation fails

Photo transformation requires a valid `GROQ_API_KEY`, a supported image upload, and access to the Groq service. Check the terminal output and verify the key.

### Image generation fails

Image generation depends on Pollinations and an internet connection. Check provider availability and, if applicable, verify `POLLINATIONS_API_KEY`.

### Environment variable changes do not take effect

Stop the server with `Ctrl + C`, save `.env`, and run `npm start` again.

---

## Security Notes

- Do not share or commit `.env`, `backend/.env`, API keys, authentication secrets, or private user data.
- Do not expose Groq or Pollinations API keys in browser-side JavaScript.
- The included local JSON and filesystem storage is intended for local development and testing. It is not a substitute for managed persistent storage in a production deployment.
- The local development server is not hardened for public production use.

## Deployment

Deployment is optional. The application can be run locally using the instructions above.

If you later choose to deploy it, the frontend and backend will need to be configured for their hosted origins, and local JSON/filesystem persistence will need to be replaced with suitable persistent database and image storage services. The local setup does not require any hosted URL.

---

## License

No specific open-source license is declared in the project files. Contact the repository owner before redistributing or reusing the project beyond the permissions provided by its repository.
