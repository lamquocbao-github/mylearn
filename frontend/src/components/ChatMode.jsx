import { useState, useRef, useEffect } from 'react'
import { API_URL } from '../api'

const WELCOME = {
  role: 'assistant',
  content: '你好！我是宝贝，你的普通话练习伙伴。你今天过得怎么样？有什么想聊的吗？',
  pinyin: 'Nǐ hǎo! Wǒ shì Bǎobèi, nǐ de pǔtōnghuà liànxí huǒbàn. Nǐ jīntiān guò de zěnme yàng? Yǒu shénme xiǎng liáo de ma?',
  translation: "Hi! I'm Baobei, your Mandarin practice partner. How has your day been? Anything you'd like to chat about?",
}

export default function ChatMode({ scenario, difficulty, messages, setMessages, onAIResponse }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPinyin, setShowPinyin] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Show welcome message once
  useEffect(() => {
    if (messages.length === 0) setMessages([WELCOME])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

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

      setMessages([
        ...updated,
        {
          role: 'assistant',
          content: data.reply || '',
          pinyin: data.pinyin || '',
          translation: data.translation || '',
          new_words: data.new_words || [],
        },
      ])
      speak(data.reply)
      onAIResponse(data)
    } catch {
      setMessages([
        ...updated,
        { role: 'assistant', content: '抱歉，出错了。请再试一次。', pinyin: '', translation: 'Sorry, an error occurred.' },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const speak = (text) => {
    if (!text || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = 0.85
    const trySpeak = () => {
      const zh = speechSynthesis.getVoices().find((v) => v.lang.startsWith('zh'))
      if (zh) utter.voice = zh
      speechSynthesis.speak(utter)
    }
    speechSynthesis.getVoices().length ? trySpeak() : (speechSynthesis.onvoiceschanged = trySpeak)
  }

  return (
    <div className="chat-mode">
      <div className="chat-toggles">
        <label><input type="checkbox" checked={showPinyin} onChange={(e) => setShowPinyin(e.target.checked)} /> Pinyin</label>
        <label><input type="checkbox" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} /> Translation</label>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            {msg.role === 'assistant' && <div className="msg-avatar">宝</div>}
            <div className="msg-bubble-wrap">
              <div className="msg-bubble">
                <p className="msg-chinese">{msg.content}</p>
                {msg.role === 'assistant' && showPinyin && msg.pinyin && (
                  <p className="msg-pinyin">{msg.pinyin}</p>
                )}
                {msg.role === 'assistant' && showTranslation && msg.translation && (
                  <p className="msg-translation">{msg.translation}</p>
                )}
              </div>
              {msg.role === 'assistant' && (
                <button className="msg-speak" onClick={() => speak(msg.content)}>🔊</button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg assistant">
            <div className="msg-avatar">宝</div>
            <div className="msg-bubble typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type in Mandarin or English…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
        />
        <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
