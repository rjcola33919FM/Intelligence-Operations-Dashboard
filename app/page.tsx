"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentKey =
  | "dataAnalyst"
  | "matterMaps"
  | "realEstate"
  | "islt";

const MAX_MESSAGE_LENGTH = 2000;

export default function Home() {
  const [agent, setAgent] = useState<AgentKey>("dataAnalyst");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.` },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          agent,
          history: [...messages, { role: "user", content: trimmed }],
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Request failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "No response returned.",
        },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAgentChange(newAgent: AgentKey) {
    setAgent(newAgent);
    setMessages([]);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
        Ops Intelligence Command
      </h1>

      <p style={{ marginBottom: 20 }}>
        Choose a GPT and start chatting
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Select GPT
        </label>
        <select
          value={agent}
          onChange={(e) => handleAgentChange(e.target.value as AgentKey)}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            minWidth: 280,
          }}
        >
          <option value="dataAnalyst">DataAnalystGPT</option>
          <option value="matterMaps">Matter Maps GPT</option>
          <option value="realEstate">Real Estate Analyst GPT</option>
          <option value="islt">ISLT Design and Delivery</option>
        </select>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          minHeight: 420,
          marginBottom: 16,
        }}
      >
        {messages.length === 0 ? (
          <p>Choose a GPT, then enter your question.</p>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background: msg.role === "user" ? "#f5f5f5" : "#eef6ff",
              }}
            >
              <strong>{msg.role === "user" ? "You" : "Assistant"}:</strong>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginTop: 8,
                  fontFamily: "inherit",
                }}
              >
                {msg.content}
              </pre>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          maxLength={MAX_MESSAGE_LENGTH}
          style={{
            flex: 1,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 8,
            opacity: loading ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 18px",
            borderRadius: 8,
            border: "1px solid #222",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </main>
  );
}
