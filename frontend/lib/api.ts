// src/lib/api.ts
// Backend (FastAPI) ile konuşan tüm fonksiyonlar burada toplanıyor.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type QueryStatus = "ok" | "empty" | "unknown_column" | "no_data" | "sql_error" | "llm_error";

export interface QueryResponse {
  status: QueryStatus;
  answer: string;
  sql: string | null;
  data: Record<string, unknown>[];
  execution_time: number;
}

export interface ChatHistoryItem {
  MessageId: number;
  SessionId: string;
  Timestamp: string;
  UserPrompt: string;
  GeneratedSQL: string | null;
  QueryResultJSON: string;
  BotResponseText: string;
  ExecutionTime: number;
}



export async function askQuestion(question: string, sessionId: string, language: string = "tr", userId?: number, previousAnswer?: string): Promise<QueryResponse> {
  const res = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: sessionId, language, user_id: userId, previous_answer: previousAnswer }),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      status: "llm_error",
      answer: data.detail || "Bilinmeyen bir hata oluştu.",
      sql: null,
      data: [],
      execution_time: 0,
    };
  }
  return data as QueryResponse;
}

export async function getHistory(sessionId: string, userId: number): Promise<ChatHistoryItem[]> {
  const res = await fetch(`${API_URL}/history?session_id=${sessionId}&user_id=${userId}`);
  if (!res.ok) throw new Error("Geçmiş alınamadı.");
  return res.json();
}
export interface AuthUser {
  user_id: number;
  full_name: string;
  email: string;
}

export interface RegisterResult {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  email_sent: boolean;
}

export async function registerUser(fullName: string, email: string, password: string, role: string = "Kullanıcı"): Promise<RegisterResult> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: fullName, email, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Kayıt başarısız.");
  }
  return res.json();
}

export async function verifyCode(email: string, code: string) {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Doğrulama başarısız.");
  }
  return res.json();
}




export async function resendCode(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/resend-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Kod gönderilemedi.");
  }
}
export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error = new Error(err.detail || "Giriş başarısız.") as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export interface CostSpike {
  service_name: string;
  change_pct: number;
  current_total: number;
  delta: number;
}

export interface DashboardSummary {
  current_month: string | null;
  previous_month: string | null;
  total_cost: number;
  cost_change_pct: number | null;
  potential_savings: number;
  pending_recommendations: number;
  resource_count: number;
  trend: { month: string; total: number }[];
  service_breakdown: { name: string; total: number; pct: number }[];
  top_resource_groups: {
    resource_group: string;
    total: number;
    resource_count: number;
    change_pct: number | null;
  }[];
  cost_spikes: CostSpike[];
}

export async function getDashboardSummary(language: string = "tr", userId?: number): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary?language=${language}&user_id=${userId ?? ""}`);
  if (!res.ok) throw new Error("Dashboard verisi alınamadı.");
  return res.json();
}
export interface Recommendation {
  RecommendationId: number;
  CreatedDate: string;
  TargetService: string | null;
  TargetResourceName: string | null;
  RecommendationText: string | null;
  PotentialSavings: number | null;
  Currency: string | null;
  Status: "Beklemede" | "Uygulandı" | "Reddedildi";
  ActionDate: string | null;
}

export async function getRecommendations(userId: number, status?: string): Promise<Recommendation[]> {
  const url = status
    ? `${API_URL}/recommendations?user_id=${userId}&status=${encodeURIComponent(status)}`
    : `${API_URL}/recommendations?user_id=${userId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Öneriler alınamadı.");
  return res.json();
}
export async function updateRecommendationStatus(id: number, status: "Beklemede" | "Uygulandı" | "Reddedildi", userId: number): Promise<Recommendation> {
  const res = await fetch(`${API_URL}/recommendations/${id}?user_id=${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Öneri güncellenemedi.");
  return res.json();
}
export function getReportDownloadUrl(language: string = "tr", userId?: number, granularity?: string): string {
  const granularityParam = granularity ? `&granularity=${granularity}` : "";
  return `${API_URL}/reports/download?language=${language}&user_id=${userId ?? ""}${granularityParam}`;
}
export async function deleteRecommendation(id: number, userId: number): Promise<void> {
  const res = await fetch(`${API_URL}/recommendations/${id}?user_id=${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Öneri silinemedi.");
}
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "İstek gönderilemedi.");
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Şifre sıfırlanamadı.");
  }
}
export async function verifyResetCode(email: string, code: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/verify-reset-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Kod doğrulanamadı.");
  }
}
export interface ResourceGroupDetail {
  resource_group: string;
  current_month: string | null;
  previous_month: string | null;
  total: number;
  resources: {
    resource_name: string;
    service_name: string;
    total: number;
    change_pct: number | null;
  }[];
}

export async function getResourceGroupDetail(groupName: string, language: string = "tr"): Promise<ResourceGroupDetail> {
  const res = await fetch(`${API_URL}/dashboard/resource-group/${encodeURIComponent(groupName)}?language=${language}`);
  if (!res.ok) throw new Error("Detay alınamadı.");
  return res.json();
}

export interface ServiceBreakdownByPeriod {
  services: string[];
  data: Record<string, string | number>[];
}

export async function getServiceBreakdownByPeriod(granularity: "month" | "week", language: string = "tr"): Promise<ServiceBreakdownByPeriod> {
  const res = await fetch(`${API_URL}/dashboard/service-breakdown-by-period?granularity=${granularity}&language=${language}`);
  if (!res.ok) throw new Error("Veri alınamadı.");
  return res.json();
}

export interface ResourceItem {
  resource_name: string;
  service_name: string;
  resource_group: string;
  total_cost: number;
  current_month_cost: number;
}

export interface ResourcesResponse {
  total_count: number;
  resources: ResourceItem[];
}

export async function getResources(search: string = "", limit: number = 50, offset: number = 0): Promise<ResourcesResponse> {
  const res = await fetch(`${API_URL}/resources?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Kaynaklar alınamadı.");
  return res.json();
}
export interface ReportHistoryItem {
  ReportId: number;
  UserId: number;
  GeneratedDate: string;
  Period: string;
  Language: string;
}

export async function getReportHistory(userId: number): Promise<ReportHistoryItem[]> {
  const res = await fetch(`${API_URL}/reports/history?user_id=${userId}`);
  if (!res.ok) throw new Error("Rapor geçmişi alınamadı.");
  return res.json();
}

export async function sendAlertEmail(userId: number, language: string = "tr", serviceName?: string): Promise<{ sent: number; errors: string[] }> {
  const res = await fetch(`${API_URL}/alerts/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, language, service_name: serviceName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "E-posta gönderilemedi.");
  }
  return res.json();
}

interface StreamDoneMeta {
  sql: string | null;
  data: Record<string, unknown>[];
  status: QueryStatus;
  execution_time: number;
}

export async function askQuestionStream(
  question: string,
  sessionId: string,
  language: string,
  userId: number | undefined,
  previousAnswer: string | undefined,
  onChunk: (text: string) => void,
  onDone: (meta: StreamDoneMeta) => void
): Promise<void> {
  const res = await fetch(`${API_URL}/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: sessionId, language, user_id: userId, previous_answer: previousAnswer }),
  });

  if (!res.ok || !res.body) {
    onDone({ sql: null, data: [], status: "llm_error", execution_time: 0 });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const jsonStr = part.slice("data: ".length);
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === "chunk") {
          onChunk(event.text);
        } else if (event.type === "done") {
          onDone(event);
        }
      } catch {
        // parçalı/bozuk JSON -- sessizce atla, sonraki chunk'ta tamamlanabilir
      }
    }
  }
}

export async function getTeamsRecipients(): Promise<string[]> {
  const res = await fetch(`${API_URL}/alerts/teams-recipients`);
  if (!res.ok) throw new Error("Alıcı listesi alınamadı.");
  const data = await res.json();
  return data.recipients;
}

export async function sendTeamsAlert(userId: number, recipient: string, language: string = "tr", serviceName?: string): Promise<{ sent: number }> {
  const res = await fetch(`${API_URL}/alerts/send-teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, language, service_name: serviceName, recipient }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Teams bildirimi gönderilemedi.");
  }
  return res.json();
}
export interface ForecastServiceChange {
  service_name: string;
  recent_total: number;
  previous_total: number;
  change_pct: number;
}

export interface ForecastChartPoint {
  date: string;
  actual: number | null;
  projected: number | null;
}

export interface CostForecast {
  available: boolean;
  current_month?: string;
  last_data_date?: string;
  days_elapsed?: number;
  days_remaining?: number;
  days_in_month?: number;
  month_to_date_total?: number;
  avg_daily_cost?: number;
  estimated_month_end?: number;
  trend_pct?: number | null;
  confidence_score?: number;
  top_increasing_services?: ForecastServiceChange[];
  top_decreasing_services?: ForecastServiceChange[];
  chart_data?: ForecastChartPoint[];
  ai_insight?: string | null;
}

export async function getCostForecast(language: string = "tr"): Promise<CostForecast> {
  const res = await fetch(`${API_URL}/forecast?language=${language}`);
  if (!res.ok) throw new Error("Tahmin verisi alınamadı.");
  return res.json();
}

export interface FinOpsCheckDetail {
  name: string;
  cost: number;
}

export interface FinOpsCheck {
  ok: boolean;
  label: string;
  details: FinOpsCheckDetail[];
}

export interface FinOpsScore {
  score: number;
  checks: FinOpsCheck[];
}

export async function getFinOpsScore(language: string = "tr", userId?: number): Promise<FinOpsScore> {
  const res = await fetch(`${API_URL}/finops-score?language=${language}&user_id=${userId ?? ""}`);
  if (!res.ok) throw new Error("FinOps Score alınamadı.");
  return res.json();
}