import { QueryStatus } from "@/lib/api";

interface ChatMessageProps {
  role: "user" | "bot";
  text: string;
  status?: QueryStatus;
  animate?: boolean;
}

export default function ChatMessage({ role, text, status }: ChatMessageProps) {
  const isUser = role === "user";
  const isWarning = status === "empty";
  const isError = status === "llm_error" || status === "sql_error";

  let bubbleClass = "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800";
  if (isUser) bubbleClass = "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-400 dark:to-blue-700 border border-blue-100 dark:border-blue-400/30 text-gray-900 dark:text-white dark:shadow-[0_0_15px_rgba(59,130,246,0.25)]";
  else if (isError) bubbleClass = "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900";
  else if (isWarning) bubbleClass = "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${bubbleClass}`}>
        {text}
      </div>
    </div>
  );
}