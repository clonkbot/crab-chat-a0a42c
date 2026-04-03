import { useState, useEffect, useRef } from "react";
import { useConvexAuth, useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import "./styles.css";

const CRAB_SYSTEM_PROMPT = `You are Clawrence, a wise and slightly grumpy crab who lives in a cozy tide pool. You speak in short, punchy sentences. You often make crab puns and sideways jokes. You're philosophical but also a bit sarcastic. You love talking about the ocean, tides, shells, and giving life advice from a crustacean perspective. Keep responses under 2-3 sentences. Always stay in character as Clawrence the crab.`;

function pcmToWav(base64Pcm: string): string {
  const pcm = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
  const sampleRate = 24000;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const w = (o: number, s: string) =>
    s.split("").forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, "data");
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
}

function Bubbles() {
  return (
    <div className="bubbles-container">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
            width: `${8 + Math.random() * 20}px`,
            height: `${8 + Math.random() * 20}px`,
          }}
        />
      ))}
    </div>
  );
}

function CrabAvatar({ speaking = false }: { speaking?: boolean }) {
  return (
    <div className={`crab-avatar ${speaking ? "speaking" : ""}`}>
      <div className="crab-body">
        <div className="crab-eye left" />
        <div className="crab-eye right" />
        <div className="crab-claw left" />
        <div className="crab-claw right" />
      </div>
    </div>
  );
}

function VoiceNote({
  audioBase64,
  content,
}: {
  audioBase64?: string;
  content: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioBase64) {
      const url = pcmToWav(audioBase64);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioBase64]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  return (
    <div className="voice-note">
      <div className="shell-shape">
        <CrabAvatar speaking={isPlaying} />
        <div className="voice-controls">
          <button
            onClick={togglePlay}
            className="play-button"
            disabled={!audioUrl}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="waveform">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`wave-bar ${isPlaying ? "active" : ""}`}
                style={{
                  height: `${20 + Math.sin(i * 0.8) * 15 + Math.random() * 10}px`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
            <div
              className="progress-overlay"
              style={{ width: `${100 - progress}%` }}
            />
          </div>
        </div>
        <p className="voice-transcript">{content}</p>
      </div>
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  audioBase64,
}: {
  role: "user" | "crab";
  content: string;
  audioBase64?: string;
}) {
  if (role === "crab") {
    return <VoiceNote audioBase64={audioBase64} content={content} />;
  }

  return (
    <div className="user-message">
      <p>{content}</p>
    </div>
  );
}

function Chat() {
  const messages = useQuery(api.messages.list) ?? [];
  const sendMessage = useMutation(api.messages.send);
  const saveCrabResponse = useMutation(api.messages.saveCrabResponse);
  const clearMessages = useMutation(api.messages.clear);
  const chat = useAction(api.ai.chat);
  const tts = useAction(api.ai.textToSpeech);
  const { signOut } = useAuthActions();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      await sendMessage({ content: userMessage });

      const conversationHistory = [
        ...messages.map((m: { role: "user" | "crab"; content: string }) => ({
          role: m.role === "crab" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ];

      const crabResponse = await chat({
        messages: conversationHistory,
        systemPrompt: CRAB_SYSTEM_PROMPT,
      });

      let audioBase64: string | undefined;
      try {
        const audio = await tts({
          text: crabResponse,
          voice: "Charon",
        });
        if (audio) {
          audioBase64 = audio;
        }
      } catch (ttsErr) {
        console.warn("TTS failed, saving text only:", ttsErr);
      }

      await saveCrabResponse({
        content: crabResponse,
        audioBase64,
      });
    } catch (err) {
      console.error("Error:", err);
      setError("Clawrence got caught in a tide! Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-content">
          <CrabAvatar />
          <div className="header-text">
            <h1>Clawrence</h1>
            <span className="status">
              {isLoading ? "Recording a shell-gram..." : "Chilling in the tide pool"}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => clearMessages()} className="clear-btn" title="Clear chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
          <button onClick={() => signOut()} className="signout-btn">
            Sign Out
          </button>
        </div>
      </header>

      <div className="messages-area">
        {messages.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="big-crab">
              <CrabAvatar />
            </div>
            <h2>Hey there, land-dweller!</h2>
            <p>
              I'm Clawrence, your friendly neighborhood crab. Send me a message
              and I'll reply with a voice note from my tide pool.
            </p>
            <div className="suggestions">
              <button onClick={() => setInput("What's the meaning of life?")}>
                What's the meaning of life?
              </button>
              <button onClick={() => setInput("Tell me about the ocean")}>
                Tell me about the ocean
              </button>
              <button onClick={() => setInput("Got any crab puns?")}>
                Got any crab puns?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg: { _id: string; role: "user" | "crab"; content: string; audioBase64?: string }) => (
          <MessageBubble
            key={msg._id}
            role={msg.role}
            content={msg.content}
            audioBase64={msg.audioBase64}
          />
        ))}

        {isLoading && (
          <div className="loading-state">
            <div className="recording-indicator">
              <CrabAvatar speaking />
              <div className="recording-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
            <p>Clawrence is recording...</p>
          </div>
        )}

        {error && (
          <div className="error-toast">
            <p>{error}</p>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message to Clawrence..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await signIn("password", formData);
    } catch {
      setError(flow === "signIn" ? "Invalid credentials" : "Could not create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Bubbles />
      <div className="auth-card">
        <div className="auth-header">
          <CrabAvatar />
          <h1>CrabChat</h1>
          <p>Chat with Clawrence, the wise crab</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            autoComplete="email"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
          />
          <input name="flow" type="hidden" value={flow} />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? "Loading..." : flow === "signIn" ? "Dive In" : "Join the Tide Pool"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          onClick={() => signIn("anonymous")}
          className="auth-anonymous"
        >
          Continue as Guest
        </button>

        <button
          type="button"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          className="auth-switch"
        >
          {flow === "signIn"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
      <footer className="app-footer auth-footer">
        Requested by @OxPaulius · Built by @clonkbot
      </footer>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <Bubbles />
        <div className="loading-content">
          <CrabAvatar />
          <p>Waking up Clawrence...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <div className="app">
      <Bubbles />
      <Chat />
      <footer className="app-footer">
        Requested by @OxPaulius · Built by @clonkbot
      </footer>
    </div>
  );
}
