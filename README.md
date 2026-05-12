# MyLearn — Mandarin Practice

An AI conversation partner for practising Mandarin. Supports text chat and voice talk modes, real-time learning extraction, and difficulty levels referenced to the HSK standard.

## Stack

| Layer | Technology |
|---|---|
| AI (primary) | Google Gemini 1.5 Flash |
| AI (fallback) | Groq — LLaMA 3.3 70B → LLaMA 3.1 8B → Mixtral 8x7B |
| Voice STT | Browser Web Speech API → Groq Whisper (fallback) |
| Voice TTS | Browser SpeechSynthesis API |
| Backend | FastAPI + SQLite |
| Frontend | React + Vite |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Local Setup

### 1. Get API keys (both free)

| Key | Link |
|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com |
| `GROQ_API_KEY` | https://console.groq.com |

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# edit backend/.env and paste your keys
```

### 3. Install and run

```bash
# Install all dependencies
make install

# Run backend  (terminal 1)
make backend

# Run frontend (terminal 2)
make frontend
```

Open http://localhost:5173 in **Chrome or Edge** (required for Web Speech API).

---

## Deploy

### Backend → Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect repo
3. Render auto-detects `render.yaml` — root dir is set to `backend/`
4. Add environment variables in the Render dashboard:
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
5. Note your service URL: `https://mylearn-backend.onrender.com`

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → connect same repo
2. Set **Root Directory** to `frontend/`
3. Add environment variable:
   - `VITE_API_URL` = `https://mylearn-backend.onrender.com`
4. Deploy

> **Note:** Render's free tier sleeps after 15 min of inactivity. The first request after sleep takes ~30s.

---

## Project Structure

```
mylearn/
├── backend/
│   ├── main.py          # FastAPI app — chat, vocab, sessions, transcribe
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Layout, shared state, difficulty/scenario selectors
│   │   ├── App.css
│   │   ├── api.js                # API_URL helper
│   │   └── components/
│   │       ├── ChatMode.jsx      # Text conversation
│   │       ├── TalkMode.jsx      # Voice orb (Web Speech → Whisper fallback)
│   │       ├── LearningPanel.jsx # Real-time topic/vocab/corrections panel
│   │       └── ReviewModal.jsx   # End-of-session summary
│   ├── vercel.json
│   └── vite.config.js            # Dev proxy: /api → localhost:8000
├── render.yaml
├── Makefile
└── .gitignore
```

---

## Features

- **Chat mode** — type in Mandarin or English, get corrections and vocabulary inline
- **Talk mode** — Revolut-style animated orb, speak Mandarin and hear responses
- **Learning panel** — live extraction of topic, new words, good usage, corrections
- **End & Review** — full session summary with all learning notes
- **Difficulty levels** — Beginner (HSK 1–2) / Elementary (HSK 3) / Intermediate (HSK 4) / Advanced (HSK 5–6)
- **Scenarios** — Free Talk, Restaurant, Travel, Shopping, Workplace, Social, Emergency
- **AI fallback chain** — Gemini → Groq LLaMA → Groq Mixtral
- **STT fallback** — Web Speech API → Groq Whisper
