import { z } from 'zod';
import { WHOOP_API_BASE, refreshTokens, type WhoopTokens } from './oauth';

/**
 * Cliente REST de Whoop API v2 con auto-refresh de tokens y backoff de rate limit.
 *
 * Base: https://api.prod.whoop.com/developer/v2/...
 * Rate limits: 100 req/min y 10k req/day por API key (Whoop dev docs).
 *
 * Uso:
 *   const client = new WhoopClient({ accessToken, refreshToken, expiresAt, ... });
 *   const { records } = await client.listCycles({ start, end });
 */

const DATA_API_PREFIX = '/developer/v2';

export interface WhoopClientOptions {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  clientId: string;
  clientSecret: string;
  /**
   * Callback invocado cuando los tokens se refrescan automáticamente.
   * El consumidor debe persistir los nuevos tokens.
   */
  onTokensRefreshed?: (tokens: WhoopTokens) => Promise<void>;
}

export interface PaginatedRequest {
  start?: string; // ISO 8601
  end?: string;
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResponse<T> {
  records: T[];
  next_token?: string | null;
}

const cycleSchema = z.object({
  id: z.union([z.number(), z.string().transform((v) => Number(v))]),
  user_id: z.number(),
  start: z.string(),
  end: z.string().nullable().optional(),
  score: z
    .object({
      strain: z.number().optional(),
      average_heart_rate: z.number().optional(),
      max_heart_rate: z.number().optional(),
      kilojoule: z.number().optional(),
      percent_recorded: z.number().optional(),
    })
    .optional(),
  score_state: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type WhoopCycle = z.infer<typeof cycleSchema>;

const recoverySchema = z.object({
  cycle_id: z.union([z.number(), z.string().transform((v) => Number(v))]),
  sleep_id: z.union([z.number(), z.string()]).optional(),
  user_id: z.number(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  score: z
    .object({
      user_calibrating: z.boolean().optional(),
      recovery_score: z.number().optional(),
      resting_heart_rate: z.number().optional(),
      hrv_rmssd_milli: z.number().optional(),
      spo2_percentage: z.number().optional(),
      skin_temp_celsius: z.number().optional(),
    })
    .optional(),
  score_state: z.string().optional(),
});
export type WhoopRecovery = z.infer<typeof recoverySchema>;

// v2: sleep id es UUID (string).
const sleepSchema = z.object({
  id: z.union([z.string(), z.number().transform((v) => String(v))]),
  user_id: z.number(),
  start: z.string(),
  end: z.string(),
  nap: z.boolean().optional(),
  score: z
    .object({
      stage_summary: z
        .object({
          total_in_bed_time_milli: z.number().optional(),
          total_awake_time_milli: z.number().optional(),
          total_light_sleep_time_milli: z.number().optional(),
          total_slow_wave_sleep_time_milli: z.number().optional(),
          total_rem_sleep_time_milli: z.number().optional(),
        })
        .optional(),
      sleep_needed: z
        .object({
          baseline_milli: z.number().optional(),
        })
        .optional(),
      sleep_efficiency_percentage: z.number().optional(),
    })
    .optional(),
  score_state: z.string().optional(),
});
export type WhoopSleep = z.infer<typeof sleepSchema>;

// v2: workout id es UUID (string).
const workoutSchema = z.object({
  id: z.union([z.string(), z.number().transform((v) => String(v))]),
  user_id: z.number(),
  start: z.string(),
  end: z.string(),
  sport_id: z.number().optional(),
  sport_name: z.string().optional(),
  score: z
    .object({
      strain: z.number().optional(),
      average_heart_rate: z.number().optional(),
      max_heart_rate: z.number().optional(),
      kilojoule: z.number().optional(),
      distance_meter: z.number().optional(),
    })
    .optional(),
  score_state: z.string().optional(),
});
export type WhoopWorkout = z.infer<typeof workoutSchema>;

const paginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    records: z.array(item),
    next_token: z.string().nullable().optional(),
  });

export class WhoopClient {
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: Date;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly onTokensRefreshed?: (tokens: WhoopTokens) => Promise<void>;

  constructor(opts: WhoopClientOptions) {
    this.accessToken = opts.accessToken;
    this.refreshToken = opts.refreshToken;
    this.expiresAt = opts.expiresAt;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    if (opts.onTokensRefreshed) {
      this.onTokensRefreshed = opts.onTokensRefreshed;
    }
  }

  private async ensureFreshToken(): Promise<void> {
    const skewMs = 5 * 60 * 1000; // refresh if expires in < 5min
    if (this.expiresAt.getTime() - Date.now() > skewMs) return;
    const tokens = await refreshTokens({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      refreshToken: this.refreshToken,
    });
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    if (this.onTokensRefreshed) {
      await this.onTokensRefreshed(tokens);
    }
  }

  private async request<T>(path: string, schema: z.ZodSchema<T>, retried = false): Promise<T> {
    await this.ensureFreshToken();
    const res = await fetch(`${WHOOP_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    // 401 → refresh y reintenta una vez
    if (res.status === 401 && !retried) {
      this.expiresAt = new Date(0);
      await this.ensureFreshToken();
      return this.request(path, schema, true);
    }

    // 429 → respeta X-RateLimit-Reset (segundos), reintenta una vez si <= 30s
    if (res.status === 429 && !retried) {
      const resetHdr = res.headers.get('X-RateLimit-Reset');
      const resetSecs = resetHdr ? Number(resetHdr) : NaN;
      if (Number.isFinite(resetSecs) && resetSecs > 0 && resetSecs <= 30) {
        await new Promise((r) => setTimeout(r, resetSecs * 1000));
        return this.request(path, schema, true);
      }
      throw new Error(`Whoop API rate limited (429). Reset in ${resetSecs}s`);
    }

    if (!res.ok) {
      throw new Error(`Whoop API ${path}: ${res.status} ${res.statusText}`);
    }
    return schema.parse(await res.json());
  }

  private buildPath(resource: string, params: PaginatedRequest): string {
    const qs = new URLSearchParams();
    if (params.start) qs.set('start', params.start);
    if (params.end) qs.set('end', params.end);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.nextToken) qs.set('nextToken', params.nextToken);
    const q = qs.toString();
    const base = `${DATA_API_PREFIX}${resource}`;
    return q ? `${base}?${q}` : base;
  }

  listCycles(params: PaginatedRequest = {}): Promise<PaginatedResponse<WhoopCycle>> {
    return this.request(this.buildPath('/cycle', params), paginatedSchema(cycleSchema));
  }

  listRecovery(params: PaginatedRequest = {}): Promise<PaginatedResponse<WhoopRecovery>> {
    return this.request(this.buildPath('/recovery', params), paginatedSchema(recoverySchema));
  }

  listSleep(params: PaginatedRequest = {}): Promise<PaginatedResponse<WhoopSleep>> {
    return this.request(this.buildPath('/activity/sleep', params), paginatedSchema(sleepSchema));
  }

  listWorkouts(params: PaginatedRequest = {}): Promise<PaginatedResponse<WhoopWorkout>> {
    return this.request(this.buildPath('/activity/workout', params), paginatedSchema(workoutSchema));
  }

  /**
   * Auto-paginate hasta agotar nextToken.
   */
  async *paginate<T>(
    fetchPage: (params: PaginatedRequest) => Promise<PaginatedResponse<T>>,
    initialParams: PaginatedRequest = {},
  ): AsyncGenerator<T[]> {
    let nextToken: string | null | undefined = initialParams.nextToken;
    let count = 0;
    const MAX_PAGES = 200; // safety
    while (count < MAX_PAGES) {
      const page: PaginatedResponse<T> = await fetchPage({
        ...initialParams,
        ...(nextToken !== undefined && nextToken !== null && { nextToken }),
      });
      yield page.records;
      if (!page.next_token) break;
      nextToken = page.next_token;
      count++;
    }
  }
}
