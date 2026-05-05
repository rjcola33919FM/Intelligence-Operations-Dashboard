"use client";

import { FormEvent, useState } from "react";
import { AGENTS, type AgentKey } from "@/app/lib/agents";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface AgentCall {
  agent: AgentKey;
  task: string;
  context?: string;
  response: string;
}

type Mode = "single" | "orchestrate";

const ALL_AGENT_KEYS = Object.keys(AGENTS) as AgentKey[];
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TASK_LENGTH = 4000;

export default function Home() {
  // Mode
  const [mode, setMode] = useState<Mode>("single");

  // Single agent state
  const [agent, setAgent] = useState<AgentKey>("dataAnalyst");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Multi-agent state
  const [task, setTask] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<AgentKey>>(new Set(ALL_AGENT_KEYS));
  const [agentCalls, setAgentCalls] = useState<AgentCall[]>([]);
  const [synthesis, setSynthesis] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Single agent submit ───────────────────────────────────────────────────

  async function handleSingleSubmit(e: FormEvent) {
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
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          agent,
          history: [...messages, { role: "user", content: trimmed }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response returned." },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Multi-agent submit ────────────────────────────────────────────────────

  async function handleOrchestrate(e: FormEvent) {
    e.preventDefault();
    const trimmed = task.trim();
    if (!trimmed || loading) return;

    if (selectedAgents.size === 0) {
      setError("Select at least one agent.");
      return;
    }

    if (trimmed.length > MAX_TASK_LENGTH) {
      setError(`Task too long. Please keep it under ${MAX_TASK_LENGTH} characters.`);
      return;
    }

    setError("");
    setAgentCalls([]);
    setSynthesis("");
    setLoading(true);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: trimmed,
          selectedAgents: Array.from(selectedAgents),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
      setAgentCalls(data.agentCalls ?? []);
      setSynthesis(data.synthesis ?? "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function toggleAgent(key: AgentKey) {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAgentChange(newAgent: AgentKey) {
    setAgent(newAgent);
    setMessages([]);
  }

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    setError("");
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#111" }}>
        Ops Intelligence Command
      </h1>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 15 }}>
        Single-agent chat or multi-agent orchestration across all specialists.
      </p>

      {/* Mode Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["single", "orchestrate"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: mode === m ? "2px solid #111" : "1px solid #ccc",
              background: mode === m ? "#111" : "#fff",
              color: mode === m ? "#fff" : "#555",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {m === "single" ? "Single Agent" : "Multi-Agent"}
          </button>
        ))}
      </div>

      {/* ── Single Agent Mode ── */}
      {mode === "single" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600, fontSize: 14, color: "#333" }}>
              Select Agent
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ALL_AGENT_KEYS.map((key) => {
                const a = AGENTS[key];
                const active = agent === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleAgentChange(key)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: active ? "2px solid #111" : "1px solid #ccc",
                      background: active ? "#111" : "#fff",
                      color: active ? "#fff" : "#444",
                      fontWeight: active ? 700 : 500,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
            <p style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
              {AGENTS[agent].description}
            </p>
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, minHeight: 380, marginBottom: 16, background: "#fafafa" }}>
            {messages.length === 0 ? (
              <p style={{ color: "#aaa", fontSize: 14 }}>Select an agent and send a message to begin.</p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 8,
                    background: msg.role === "user" ? "#f0f0f0" : "#eef4ff",
                    border: msg.role === "user" ? "1px solid #e0e0e0" : "1px solid #d0e0ff",
                  }}
                >
                  <strong style={{ fontSize: 13, color: msg.role === "user" ? "#555" : "#2563eb" }}>
                    {msg.role === "user" ? "You" : AGENTS[agent].name}
                  </strong>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6, fontFamily: "inherit", fontSize: 15, color: "#222", lineHeight: 1.6 }}>
                    {msg.content}
                  </pre>
                </div>
              ))
            )}
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>{error}</p>}

          <form onSubmit={handleSingleSubmit} style={{ display: "flex", gap: 10 }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              maxLength={MAX_MESSAGE_LENGTH}
              style={{ flex: 1, padding: "11px 14px", border: "1px solid #ccc", borderRadius: 8, fontSize: 15, opacity: loading ? 0.6 : 1 }}
            />
            <button
              type="submit"
              disabled={loading || !message.trim()}
              style={{ padding: "11px 20px", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </form>
        </>
      )}

      {/* ── Multi-Agent Orchestration Mode ── */}
      {mode === "orchestrate" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14, color: "#333" }}>
              Select Agents to Run
            </label>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
              Toggle which specialists to include. Selected agents run in order and share context.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {ALL_AGENT_KEYS.map((key) => {
                const a = AGENTS[key];
                const active = selectedAgents.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAgent(key)}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: active ? "2px solid #111" : "1px solid #ccc",
                      background: active ? "#111" : "#fff",
                      color: active ? "#fff" : "#666",
                      fontWeight: active ? 700 : 500,
                      fontSize: 14,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
            {selectedAgents.size > 0 && (
              <p style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                {selectedAgents.size} agent{selectedAgents.size > 1 ? "s" : ""} selected
                {" · "}
                <button
                  type="button"
                  onClick={() => setSelectedAgents(new Set(ALL_AGENT_KEYS))}
                  style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  select all
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={() => setSelectedAgents(new Set())}
                  style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  clear all
                </button>
              </p>
            )}

            <form onSubmit={handleOrchestrate}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14, color: "#333" }}>
                Task
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g. Analyze this rental property at 123 Main St, estimate financials, flag legal risks, and create an investor onboarding guide."
                rows={4}
                maxLength={MAX_TASK_LENGTH}
                disabled={loading}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid #ccc", borderRadius: 10, fontSize: 15, resize: "vertical", boxSizing: "border-box", opacity: loading ? 0.6 : 1 }}
              />
              {error && <p style={{ color: "#dc2626", fontSize: 14, marginTop: 8 }}>{error}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="submit"
                  disabled={loading || !task.trim() || selectedAgents.size === 0}
                  style={{ padding: "11px 24px", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontWeight: 600, fontSize: 14, cursor: (loading || selectedAgents.size === 0) ? "not-allowed" : "pointer", opacity: (loading || selectedAgents.size === 0) ? 0.5 : 1 }}
                >
                  {loading ? "Running agents..." : `Run ${selectedAgents.size} Agent${selectedAgents.size !== 1 ? "s" : ""} →`}
                </button>
              </div>
            </form>
          </div>

          {/* Loading */}
          {loading && agentCalls.length === 0 && (
            <p style={{ color: "#888", fontSize: 14, textAlign: "center", padding: "40px 0" }}>
              Running specialists — this may take 30–60 seconds...
            </p>
          )}

          {/* Agent Outputs */}
          {agentCalls.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "#333" }}>
                Specialist Outputs — {agentCalls.length} agent{agentCalls.length > 1 ? "s" : ""} ran
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {agentCalls.map((call, i) => (
                  <div key={i} style={{ border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#f5f5f5", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>
                        {AGENTS[call.agent]?.name ?? call.agent}
                      </span>
                      <span style={{ fontSize: 12, color: "#888" }}>· {AGENTS[call.agent]?.description}</span>
                    </div>
                    <div style={{ padding: 16, background: "#fff" }}>
                      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 15, color: "#222", lineHeight: 1.7, margin: 0 }}>
                        {call.response}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Synthesis */}
          {synthesis && (
            <div style={{ marginTop: 24, border: "2px solid #111", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#111", color: "#fff", fontWeight: 700, fontSize: 15 }}>
                Orchestrated Synthesis
              </div>
              <div style={{ padding: 20, background: "#fff" }}>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 15, color: "#222", lineHeight: 1.7, margin: 0 }}>
                  {synthesis}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
