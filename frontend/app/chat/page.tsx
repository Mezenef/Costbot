"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import CostChart from "@/components/CostChart";
import DataTable from "@/components/DataTable";
import { askQuestionStream, getHistory, getDashboardSummary, QueryStatus } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface Message {
  role: "user" | "bot";
  text: string;
  status?: QueryStatus;
  data?: Record<string, unknown>[];
  isNew?: boolean;
}
function buildConversationContext(msgs: Message[], maxPairs: number = 3): string {
  const relevant = msgs.filter((m) => m.text.trim() !== "");
  const recentMessages = relevant.slice(-maxPairs * 2);
  return recentMessages
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "Asistan"}: ${m.text}`)
    .join("\n\n");
}

interface StoredUser {
  user_id: number;
  full_name: string;
  email: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const sessionId = user ? `user-${user.user_id}` : null;
  const [pendingCount, setPendingCount] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [t("chat.suggestion1"), t("chat.suggestion2"), t("chat.suggestion3")];

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem("costbot_user");
    const parsedUser = raw ? JSON.parse(raw) : null;
    if (parsedUser) setUser(parsedUser);
    getDashboardSummary(locale, parsedUser?.user_id).then((d) => setPendingCount(d.pending_recommendations)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !sessionId) return;
    getHistory(sessionId, user.user_id).then((history) => {
      const restored: Message[] = history.flatMap((h) => {
        let parsedData: Record<string, unknown>[] | undefined;
        try {
          const parsed = JSON.parse(h.QueryResultJSON);
          if (Array.isArray(parsed)) parsedData = parsed;
        } catch {
          parsedData = undefined;
        }
        return [
          { role: "user" as const, text: h.UserPrompt, isNew: false },
          { role: "bot" as const, text: h.BotResponseText, isNew: false, data: parsedData },
        ];
      });
      setMessages(restored);
    });
  }, [sessionId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendQuestion(question: string) {
    if (!question.trim() || loading || !sessionId) return;
    const conversationContext = buildConversationContext(messages);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "bot", text: "", isNew: true }]);
    setInput("");
    setLoading(true);

    // Backend'den parçalar cok hizli gelebiliyor (yerel sunucu + hizli LLM),
    // bu yuzden dogrudan ekrana yazmak yerine bir KUYRUGA aliyoruz ve sabit,
    // goz ile takip edilebilir bir hizda (her 15ms'de birkac karakter)
    // ekrana yaziyoruz -- ChatGPT'nin de yaptigi gibi.
    let pendingText = "";
    let streamDone = false;
    let doneMeta: { status: QueryStatus; data: Record<string, unknown>[] } | null = null;

    const typeInterval = setInterval(() => {
      if (pendingText.length === 0) {
        if (streamDone) {
          clearInterval(typeInterval);
          if (doneMeta) {
            const finalMeta = doneMeta;
            setMessages((prev) => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              next[lastIdx] = {
                ...next[lastIdx],
                status: finalMeta.status,
                data: finalMeta.status === "ok" ? finalMeta.data : undefined,
              };
              return next;
            });
          }
          setLoading(false);
          getDashboardSummary(locale, user?.user_id).then((d) => setPendingCount(d.pending_recommendations)).catch(() => {});
        }
        return;
      }
      const take = pendingText.slice(0, 2);
      pendingText = pendingText.slice(2);
      setMessages((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        next[lastIdx] = { ...next[lastIdx], text: next[lastIdx].text + take };
        return next;
      });
    }, 15);

    await askQuestionStream(
      question, sessionId, locale, user?.user_id, conversationContext || undefined,
      (chunkText) => {
        pendingText += chunkText;
      },
      (meta) => {
        streamDone = true;
        doneMeta = { status: meta.status, data: meta.data };
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuestion(input);
    }
  }

  function handleLogout() {
    localStorage.removeItem("costbot_user");
    router.push("/");
  }

  function renderVisual(data?: Record<string, unknown>[]) {
    if (!data || data.length <= 1) return null;
    const keys = Object.keys(data[0]);
    const hasNumericSecondCol = keys.length === 2 && typeof data[0][keys[1]] === "number";
    return hasNumericSecondCol ? <CostChart data={data} /> : <DataTable data={data} />;
  }

  const lastMessage = messages[messages.length - 1];
  const showTypingDots = loading && (!lastMessage || lastMessage.role !== "bot" || lastMessage.text === "");

  return (
    <div className="flex bg-gray-50 dark:bg-gray-950 h-screen">
      <Sidebar pendingCount={pendingCount} userName={user?.full_name} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3.5">
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white text-sm">{t("chat.title")}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t("chat.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Tema değiştir"
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
            >
              {mounted && (theme === "dark" ? "☀️" : "🌙")}
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium"
            >
              {t("common.logout")}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-0">
          <div className="max-w-2xl mx-auto py-6">
            {messages.length === 0 && (
              <div className="text-center mt-16">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  {t("chat.emptyPrompt")}
                </p>
                <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendQuestion(s)}
                      className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full px-3.5 py-2 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                <ChatMessage role={m.role} text={m.text} status={m.status} />
                {renderVisual(m.data)}
              </div>
            ))}

            {showTypingDots && (
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 px-2 py-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                </span>
                {t("chat.typing")}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </main>

        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              onClick={() => sendQuestion(input)}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition dark:shadow-[0_0_15px_rgba(59,130,246,0.35)]"
            >
              {t("chat.send")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}