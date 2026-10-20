import { collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface AiLogPayload {
  uid: string;
  userEmail?: string;
  feature: 'ocr' | 'nlp';
  model: string;
  durationMs: number;
  status: 'success' | 'fallback' | 'error';
  tokensUsed?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
  errorMsg?: string | null;
}

export interface AiLogEntry extends AiLogPayload {
  id: string;
  timestamp: number;
  dateKey: string;
}

export interface AiTelemetrySummary {
  totalCalls: number;
  ocrCalls: number;
  nlpCalls: number;
  successCount: number;
  fallbackCount: number;
  errorCount: number;
  avgDurationMs: number;
  totalTokens: number;
}

export function formatTelemetryDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Log an AI invocation to Firestore in a fire-and-forget manner.
 * Never throws and never interrupts the calling feature.
 */
export async function logAiUsage(payload: AiLogPayload): Promise<void> {
  try {
    const timestamp = Date.now();
    const dateKey = formatTelemetryDateKey(new Date(timestamp));

    const logData = {
      uid: payload.uid,
      userEmail: payload.userEmail || '',
      feature: payload.feature,
      model: payload.model,
      durationMs: Math.max(0, Math.round(payload.durationMs)),
      status: payload.status,
      tokensUsed: payload.tokensUsed || null,
      errorMsg: payload.errorMsg || null,
      timestamp,
      dateKey,
    };

    // Asynchronously write to ai_logs collection
    await addDoc(collection(db, 'ai_logs'), logData);
  } catch (err) {
    // Non-blocking catch
    console.warn('Gagal mencatat log telemetri AI (non-blocking):', err);
  }
}

export function subscribeAiLogs(
  callback: (logs: AiLogEntry[]) => void,
  limitCount: number = 100
): () => void {
  try {
    const q = query(
      collection(db, 'ai_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const logs: AiLogEntry[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            uid: data.uid || '',
            userEmail: data.userEmail || '',
            feature: data.feature || 'ocr',
            model: data.model || '',
            durationMs: data.durationMs || 0,
            status: data.status || 'success',
            tokensUsed: data.tokensUsed || undefined,
            errorMsg: data.errorMsg || null,
            timestamp: data.timestamp || Date.now(),
            dateKey: data.dateKey || '',
          };
        });
        callback(logs);
      },
      (err) => {
        console.warn('Error saat subscribe ai_logs:', err);
        callback([]);
      }
    );
  } catch (err) {
    console.warn('Gagal inisialisasi onSnapshot ai_logs:', err);
    callback([]);
    return () => {};
  }
}

export function calculateTelemetrySummary(logs: AiLogEntry[]): AiTelemetrySummary {
  if (!logs || logs.length === 0) {
    return {
      totalCalls: 0,
      ocrCalls: 0,
      nlpCalls: 0,
      successCount: 0,
      fallbackCount: 0,
      errorCount: 0,
      avgDurationMs: 0,
      totalTokens: 0,
    };
  }

  let ocrCalls = 0;
  let nlpCalls = 0;
  let successCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;
  let sumDuration = 0;
  let totalTokens = 0;

  for (const log of logs) {
    if (log.feature === 'ocr') ocrCalls++;
    if (log.feature === 'nlp') nlpCalls++;

    if (log.status === 'success') successCount++;
    else if (log.status === 'fallback') fallbackCount++;
    else if (log.status === 'error') errorCount++;

    sumDuration += log.durationMs || 0;
    if (log.tokensUsed?.totalTokens) {
      totalTokens += log.tokensUsed.totalTokens;
    }
  }

  const totalCalls = logs.length;
  const avgDurationMs = totalCalls > 0 ? Math.round(sumDuration / totalCalls) : 0;

  return {
    totalCalls,
    ocrCalls,
    nlpCalls,
    successCount,
    fallbackCount,
    errorCount,
    avgDurationMs,
    totalTokens,
  };
}
