from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from groq import AsyncGroq
import sqlite3
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MyLearn Mandarin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://frontend-alpha-rouge-74.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Gemini setup ---
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# --- Groq setup (optional fallback) ---
groq_client: AsyncGroq | None = None
if os.environ.get("GROQ_API_KEY"):
    groq_client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

# Fallback chain: try these Groq models in order if Gemini fails
GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]

SYSTEM_PROMPT = """You are Baobei (宝贝), a warm, curious, and engaging Mandarin Chinese conversation partner. Your goal is to have a genuine two-sided conversation that helps the user practice Mandarin naturally — not just answer questions, but drive the exchange forward like a real friend would.

Always respond with valid JSON in exactly this format:
{
  "reply": "your Mandarin response in Chinese characters",
  "pinyin": "pinyin with tone marks for your reply",
  "translation": "English translation of your reply",
  "topic": "2-4 word label for the current conversation topic (e.g. 'Ordering food', 'Weekend plans', 'Family introductions')",
  "corrections": [
    {
      "original": "what the user wrote (in Chinese or pinyin)",
      "corrected": "the correct version in Chinese characters",
      "explanation": "brief English explanation of the mistake — include tone fix if relevant"
    }
  ],
  "good_usage": [
    "One specific thing the user said well — quote their phrase and explain why it was good"
  ],
  "new_words": [
    {
      "word": "Chinese word",
      "pinyin": "pinyin with tone marks",
      "meaning": "English meaning"
    }
  ]
}

Conversation rules:
- ALWAYS end your reply with a natural follow-up question or open-ended prompt — never let an exchange be a dead end
- React to the content of what the user says first (their idea, feeling, or story) before any language feedback — show genuine interest
- Be an active participant: share a short opinion, a relatable observation, or a fun cultural tidbit to give the user something to respond to
- If the user gives a short or one-word answer, probe deeper or pivot to a related angle ("Oh really? 那你更喜欢…?")
- Vary your question types: sometimes ask for opinions, sometimes for stories, sometimes for comparisons ("Which do you prefer…?", "Tell me about a time when…")
- Keep replies natural and conversational (2-4 sentences max, including your question)
- If the user writes in English, respond in Mandarin but note in the translation that they should try in Chinese

Language feedback rules:
- Only add to corrections when there are real errors (grammar, wrong character, wrong tone)
- Only add to good_usage when the user genuinely used something well — be specific, quote their phrase
- Include 1-3 useful vocabulary words from your reply
- Never break the JSON format"""

# --- Difficulty context injected into each request ---
# References the original (pre-2021) HSK 6-level system, which is still the most
# widely recognised standard. HSK 5 and 6 are grouped as "Advanced" because the
# difference in proficiency (reading newspapers vs. near-native comprehension)
# does not meaningfully change a conversational AI's speaking style.
DIFFICULTY_PROMPTS = {
    "beginner": """DIFFICULTY: Beginner (HSK 1-2 standard, ~300 active words)
- Use only the most basic, high-frequency vocabulary
- Keep sentences very short and simple (max 8 words per sentence)
- Always include pinyin for every Chinese character in your reply
- Stick to familiar topics: greetings, numbers, family, food, time, directions
- Be very patient and encouraging; repeat or rephrase if needed""",

    "elementary": """DIFFICULTY: Elementary (HSK 3 standard, ~600 words)
- Use everyday vocabulary for common daily situations
- Moderate sentence length (8-12 words)
- Include pinyin for less common characters
- Introduce one new grammar pattern per exchange when it fits naturally
- Topics include: shopping, transport, health, weather, hobbies""",

    "intermediate": """DIFFICULTY: Intermediate (HSK 4 standard, ~1,200 words)
- Use a wide vocabulary range; occasional common 成语 (chéngyǔ, 4-character idioms) are welcome
- Natural sentence length (10-15 words); vary structure
- Pinyin only for rare or potentially ambiguous characters
- Use and gently teach complex grammar: 把-sentences, resultative complements, conditionals
- Cover a broad range of topics including opinions, plans, and abstract ideas""",

    "advanced": """DIFFICULTY: Advanced (HSK 5-6 standard, 2,500+ words)
- Use rich, sophisticated vocabulary; weave in 成语 and 俗语 (colloquial sayings) naturally
- Write as a native speaker: varied, complex sentences, appropriate register
- No pinyin unless the user explicitly asks
- Address subtle errors in register, formality, and naturalness — not just grammar
- Engage on complex topics: society, culture, nuanced emotion, abstract concepts""",
}

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    system_instruction=SYSTEM_PROMPT,
    generation_config={"response_mime_type": "application/json"},
)

SCENARIOS = {
    "free": "",
    "restaurant": "The user is practicing ordering food at a Chinese restaurant. Use menu items, asking for recommendations, dietary restrictions, and paying the bill.",
    "travel": "The user is at an airport, train station, or navigating a Chinese city. Practice asking for directions, buying tickets, and describing locations.",
    "shopping": "The user is shopping at a Chinese market or mall. Practice asking prices, bargaining, describing colors/sizes, and making purchases.",
    "workplace": "The user is in a Chinese workplace setting. Practice professional greetings, meeting vocabulary, and polite business conversation.",
    "social": "The user is making friends with Chinese speakers. Practice small talk, sharing hobbies, asking about family, and casual expressions.",
    "emergency": "Practice asking for help, finding a hospital or police station, describing symptoms or problems in an urgent situation.",
}

# --- SQLite setup ---
DB_PATH = os.environ.get("DB_PATH", "mylearn.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS vocab (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            pinyin TEXT,
            meaning TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario TEXT,
            mode TEXT DEFAULT 'chat',
            message_count INTEGER DEFAULT 0,
            corrections_count INTEGER DEFAULT 0,
            good_usage_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original TEXT NOT NULL,
            corrected TEXT NOT NULL,
            explanation TEXT,
            created_at TEXT NOT NULL
        );
    """)
    # Safe migrations for existing databases
    for migration in [
        "ALTER TABLE sessions ADD COLUMN mode TEXT DEFAULT 'chat'",
        "ALTER TABLE sessions ADD COLUMN good_usage_count INTEGER DEFAULT 0",
    ]:
        try:
            conn.execute(migration)
        except Exception:
            pass  # column already exists
    conn.commit()
    conn.close()


init_db()


# --- Pydantic models ---
class ChatRequest(BaseModel):
    message: str
    scenario: str = "free"
    difficulty: str = "beginner"
    history: list = []


class VocabItem(BaseModel):
    word: str
    pinyin: str = ""
    meaning: str = ""


class SessionData(BaseModel):
    scenario: str = "free"
    mode: str = "chat"
    message_count: int = 0
    corrections_count: int = 0
    good_usage_count: int = 0


# --- Routes ---
@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Build Gemini history — must strictly alternate user/model, starting with user
    history = []
    for msg in req.history[-20:]:
        role = "model" if msg.get("role") == "assistant" else "user"
        content = msg.get("content", "").strip()
        if not content:
            continue
        # Skip if same role as previous (Gemini requires strict alternation)
        if history and history[-1]["role"] == role:
            continue
        history.append({"role": role, "parts": [content]})
    # Gemini requires history to start with a user turn
    if history and history[0]["role"] == "model":
        history = history[1:]

    # Load learner context from DB
    conn = get_db()
    known_vocab_rows = conn.execute(
        "SELECT word FROM vocab ORDER BY created_at DESC LIMIT 60"
    ).fetchall()
    past_corrections_rows = conn.execute(
        "SELECT original, corrected, explanation FROM corrections ORDER BY created_at DESC LIMIT 10"
    ).fetchall()
    conn.close()

    # Build context notes appended to the user message
    context_notes = ""
    if req.scenario in SCENARIOS and SCENARIOS[req.scenario]:
        context_notes += f"\n\n[SCENARIO: {SCENARIOS[req.scenario]}]"
    if req.difficulty in DIFFICULTY_PROMPTS:
        context_notes += f"\n\n[{DIFFICULTY_PROMPTS[req.difficulty]}]"
    if known_vocab_rows:
        words = ", ".join(r["word"] for r in known_vocab_rows)
        context_notes += f"\n\n[LEARNER VOCAB — the user already knows these words, do not re-introduce them as new: {words}]"
    if past_corrections_rows:
        lines = "\n".join(
            f'  • "{r["original"]}" → "{r["corrected"]}" ({r["explanation"]})'
            for r in past_corrections_rows
        )
        context_notes += f"\n\n[PAST CORRECTIONS — watch for these recurring patterns and gently reinforce if they come up again:\n{lines}]"

    full_message = req.message + context_notes
    result = None
    errors = []

    # --- Primary: Gemini ---
    try:
        chat_session = model.start_chat(history=history)
        response = chat_session.send_message(full_message)
        result = json.loads(response.text)
    except Exception as e:
        errors.append(f"Gemini: {e}")

    # --- Fallback: Groq (llama-3.3-70b → llama-3.1-8b) ---
    if result is None and groq_client:
        # Convert Gemini-style history to OpenAI-compatible format
        groq_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in history:
            groq_messages.append({
                "role": "assistant" if h["role"] == "model" else "user",
                "content": h["parts"][0],
            })
        groq_messages.append({"role": "user", "content": full_message})

        for groq_model in GROQ_MODELS:
            try:
                resp = await groq_client.chat.completions.create(
                    model=groq_model,
                    messages=groq_messages,
                    response_format={"type": "json_object"},
                    temperature=0.7,
                )
                result = json.loads(resp.choices[0].message.content)
                break
            except Exception as e:
                errors.append(f"Groq/{groq_model}: {e}")

    if result is None:
        raise HTTPException(status_code=503, detail=f"All AI backends failed: {errors}")

    # Ensure all expected keys exist (guards against partial responses)
    result.setdefault("topic", None)
    result.setdefault("corrections", [])
    result.setdefault("good_usage", [])
    result.setdefault("new_words", [])

    conn = get_db()
    now = datetime.now().isoformat()

    # Auto-save new words (skip duplicates)
    for w in result.get("new_words") or []:
        word = w.get("word", "").strip()
        if not word:
            continue
        exists = conn.execute("SELECT id FROM vocab WHERE word = ?", (word,)).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO vocab (word, pinyin, meaning, created_at) VALUES (?, ?, ?, ?)",
                (word, w.get("pinyin", ""), w.get("meaning", ""), now),
            )

    # Persist corrections so they can be fed back in future sessions
    for c in result.get("corrections") or []:
        orig = c.get("original", "").strip()
        corr = c.get("corrected", "").strip()
        if orig and corr:
            conn.execute(
                "INSERT INTO corrections (original, corrected, explanation, created_at) VALUES (?, ?, ?, ?)",
                (orig, corr, c.get("explanation", ""), now),
            )

    conn.commit()
    conn.close()

    return result


@app.get("/api/vocab")
async def get_vocab():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, word, pinyin, meaning, created_at FROM vocab ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/vocab")
async def add_vocab(item: VocabItem):
    conn = get_db()
    conn.execute(
        "INSERT INTO vocab (word, pinyin, meaning, created_at) VALUES (?, ?, ?, ?)",
        (item.word, item.pinyin, item.meaning, datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/vocab/{vocab_id}")
async def delete_vocab(vocab_id: int):
    conn = get_db()
    conn.execute("DELETE FROM vocab WHERE id = ?", (vocab_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/sessions")
async def get_sessions():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, scenario, mode, message_count, corrections_count, good_usage_count, created_at "
        "FROM sessions ORDER BY created_at DESC LIMIT 30"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/api/sessions")
async def save_session(data: SessionData):
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (scenario, mode, message_count, corrections_count, good_usage_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (data.scenario, data.mode, data.message_count, data.corrections_count,
         data.good_usage_count, datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Groq Whisper STT — fallback when browser Web Speech API is unavailable."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    content = await audio.read()
    transcription = await groq_client.audio.transcriptions.create(
        file=(audio.filename or "recording.webm", content),
        model="whisper-large-v3-turbo",
        language="zh",        # target Mandarin
        response_format="text",
    )
    # response_format="text" returns the string directly
    text = transcription if isinstance(transcription, str) else transcription.text
    return {"text": text.strip()}


@app.get("/api/health")
async def health():
    backends = {"gemini": True, "groq": groq_client is not None}
    return {"status": "ok", "backends": backends}
