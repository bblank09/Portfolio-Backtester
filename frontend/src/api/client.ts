import type { BacktestRequest, BacktestResult, DataStatus, SecFund } from "../types/backtest";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function assertSecOnly(result: unknown) {
  const data = result as { data_source?: string };
  if (data.data_source && data.data_source !== "sec_open_data") {
    throw new Error("Production app accepts SEC Open Data results only.");
  }
}

function extractErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : JSON.stringify(item)))
        .join("; ");
    }
  } catch {
    // Not JSON — fall through and use the raw text.
  }
  return text;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(extractErrorMessage(text) || `Request failed with status ${response.status}`);
  }
  const data = (await response.json()) as T;
  assertSecOnly(data);
  return data;
}

export async function fetchFunds(): Promise<SecFund[]> {
  const payload = await requestJson<{ data_source: "sec_open_data"; funds: SecFund[] }>("/api/funds");
  return payload.funds;
}

export async function fetchDataStatus(): Promise<DataStatus> {
  return requestJson<DataStatus>("/api/data-status");
}

export async function runBacktest(payload: BacktestRequest): Promise<BacktestResult> {
  const result = await requestJson<Omit<BacktestResult, "request">>("/api/backtests", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return { ...result, request: payload };
}
