#still in develpoment phase........
# AvatarForge

AI-powered avatar generation platform that creates unique avatars from user photos or text prompts. Users can generate avatars in different styles, preview results, download images, and manage their avatar history through a modern web interface.
It also has a option for manual creation of avatar the old school way , do try it 

---

## Features

* Generate avatars from uploaded images
* Generate avatars from text prompts
* Multiple avatar styles

  * Anime
  * Cartoon
  * Pixel Art
  * Fantasy
  * Professional Headshot
* Download generated avatars
* User authentication
* Avatar history management
* Responsive UI
* AI-powered image generation

---

## Tech Stack

### Frontend

* React.js
* Tailwind CSS
* Axios

### Backend

* FastAPI
* Python

### Database

* PostgreSQL

### AI Integration

* FLUX API / Stable Diffusion

---

## Project Architecture

```text
                    +------------------+
                    |      User        |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | React Frontend   |
                    |  (Tailwind CSS)  |
                    +--------+---------+
                             |
                        REST API
                             |
                             v
                    +------------------+
                    | FastAPI Backend  |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                                 |
            v                                 v
 +--------------------+          +----------------------+
 | PostgreSQL DB      |          | AI Generation API    |
 | Users              |          | FLUX / Stable Diff.  |
 | Avatar History     |          +----------+-----------+
 +--------------------+                     |
                                             v
                                   +------------------+
                                   | Generated Avatar |
                                   +--------+---------+
                                            |
                                            v
                                   +------------------+
                                   | Download / Save  |
                                   +------------------+
```

---

## Workflow

1. User uploads an image or enters a prompt.
2. Frontend sends a request to the FastAPI backend.
3. Backend validates the request.
4. AI model generates the avatar.
5. Generated image is returned to the frontend.
6. Avatar details are stored in PostgreSQL.
7. User can view, download, or manage generated avatars.

---

## Project Structure

```text
avatar-generator/

├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── assets/
│
├── backend/
│   ├── routes/
│   ├── models/
│   ├── database/
│   ├── services/
│   └── main.py
│
├── docs/
├── screenshots/
└── README.md
```
