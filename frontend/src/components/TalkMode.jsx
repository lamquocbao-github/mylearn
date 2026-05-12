import { useState, useRef, useEffect } from 'react'
import { API_URL } from '../api'

// orbState: 'idle' | 'listening' | 'thinking' | 'speaking'

export default function TalkMode({ scenario, difficulty, messages, setMessages, onAIResponse }) {
  const [orbState, setOrbState] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [lastReply, setLastReply] = useState(null)
  const [sttMode, setSttMode] = useState(null) // 'webspeech' | 'whisper' | null
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const synthRef = useRef(null)

  // Show welcome on first load
  useEffect(() => {
    if (messages.length === 0) {
      const welcome = {
        role: 'assistant',
        content: '你好！我是宝贝。你今天怎么样？点击麦克风开始说话！',
        pinyin: 'Nǐ hǎo! Wǒ shì Bǎobèi. Nǐ jīntiān zěnme yàng? Diǎnjī màikèfēng kāishǐ shuōhuà!',
        translation: "Hello! I'm Baobei. How are you today? Tap the mic to start speaking!",
      }
      setMessages([welcome])
      setLastReply(welcome)
      speakText(welcome.content, () => setOrbState('idle'))
      setOrbState('speaking')
    }
  }, [])

  const speakText = (text, onEnd) => {
    if (!text || !('speechSynthesis' in window)) { onEnd?.(); return }
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.85
    utter.onend = () => onEnd?.()
    synthRef.current = utter
    const trySpeak = () => {
      const zh = speechSynthesis.getVoices().find((v) => v.lang.startsWith('zh'))
      if (zh) utter.voice = zh
      speechSynthesis.speak(utter)
    }
    speechSynthesis.getVoices().length ? trySpeak() : (speechSynthesis.onvoiceschanged = trySpeak)
  }

  // --- Web Speech API (primary) ---
  const startWebSpeech = () => {
    speechSynthesis.cancel()
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const r = new SR()
    r.lang = 'zh-CN'
    r.interimResults = true
    r.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join('')
      setTranscript(t)
      if (e.results[e.results.length - 1].isFinal) {
        setTranscript('')
        setOrbState('thinking')
        sendToAPI(t)
      }
    }
    r.onerror = () => { setOrbState('idle'); setTranscript('') }
    r.onend = () => { if (orbState === 'listening') setOrbState('idle') }
    recognitionRef.current = r
    r.start()
    setSttMode('webspeech')
    setOrbState('listening')
  }

  // --- Groq Whisper (fallback) ---
  const startWhisper = async () => {
    speechSynthesis.cancel()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: mimeType })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        setOrbState('thinking')
        setTranscript('')
        try {
          const res = await fetch(`${API_URL}/api/transcribe`, { method: 'POST', body: formData })
          if (!res.ok) throw new Error()
          const data = await res.json()
          if (data.text) sendToAPI(data.text)
          else setOrbState('idle')
        } catch {
          setOrbState('idle')
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setSttMode('whisper')
      setOrbState('listening')
    } catch {
      setOrbState('idle')
    }
  }

  const startListening = () => {
    const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    hasWebSpeech ? startWebSpeech() : startWhisper()
  }

  const stopListening = () => {
    if (sttMode === 'webspeech') {
      recognitionRef.current?.stop()
      setOrbState('idle')
    } else if (sttMode === 'whisper') {
      // stopping the recorder triggers onstop → transcribe → sendToAPI
      mediaRecorderRef.current?.stop()
    }
    setSttMode(null)
  }

  const sendToAPI = async (text) => {
    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          scenario,
          difficulty,
          history: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()

      const aiMsg = {
        role: 'assistant',
        content: data.reply || '',
        pinyin: data.pinyin || '',
        translation: data.translation || '',
      }
      setMessages([...updated, aiMsg])
      setLastReply(aiMsg)
      onAIResponse(data)

      setOrbState('speaking')
      speakText(data.reply, () => setOrbState('idle'))
    } catch {
      setOrbState('idle')
      const err = { role: 'assistant', content: '抱歉，出错了。', pinyin: 'Bàoqiàn, chū cuò le.', translation: 'Sorry, an error.' }
      setMessages([...updated, err])
      setLastReply(err)
    }
  }

  const handleMicClick = () => {
    if (orbState === 'listening') stopListening()
    else if (orbState === 'idle') startListening()
    // do nothing if thinking/speaking
  }

  const stateLabel = {
    idle: 'Tap to speak',
    listening: sttMode === 'whisper' ? 'Recording via Whisper…' : 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  }

  return (
    <div className="talk-mode">
      {/* Ambient floating particles */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className="talk-particle" style={{ '--i': i }} />
      ))}

      <div className="orb-container">
        {/* Bloom glow behind orb */}
        <div className={`orb-bloom orb-bloom-${orbState}`} />

        <div className={`orb orb-${orbState}`} onClick={handleMicClick}>
          {/* Outer dashed ring — slow spin */}
          <div className="orb-ring orb-ring-1" />
          {/* Middle solid ring — counter spin */}
          <div className="orb-ring orb-ring-2" />
          {/* Conic sweep ring — radar/scanner */}
          <div className="orb-ring orb-ring-3" />

          {/* Audio frequency dots around the orb */}
          <div className="orb-dots">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="orb-dot" style={{ '--i': i }} />
            ))}
          </div>

          {/* Core sphere with shine */}
          <div className="orb-core">
            <div className="orb-core-shine" />
            <span className="orb-char">宝</span>
          </div>
        </div>

        <p className={`orb-status-label orb-status-${orbState}`}>{stateLabel[orbState]}</p>
        {transcript && <p className="orb-interim">{transcript}</p>}
      </div>

      {lastReply && orbState !== 'listening' && (
        <div className="orb-reply-card">
          <p className="orb-reply-zh">{lastReply.content}</p>
          <p className="orb-reply-py">{lastReply.pinyin}</p>
          <p className="orb-reply-en">{lastReply.translation}</p>
          <button className="orb-replay" onClick={() => { setOrbState('speaking'); speakText(lastReply.content, () => setOrbState('idle')) }}>
            🔊 Replay
          </button>
        </div>
      )}
    </div>
  )
}
