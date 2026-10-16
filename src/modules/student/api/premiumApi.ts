/**
 * Phễu Premium tự phục vụ (IDENT-R22..R25). Backend Billing có sẵn; cổng thanh
 * toán thật chưa nối (purchase trả checkout_url tới cổng stub). Dùng lại apiFetch.
 */
import { apiFetch } from "./practiceApi";

export interface BillingPlan {
  code: string;
  name: string;
  price_per_month: number;
  features: string[];
}

export interface PlansResponse {
  currency: string;
  trial_days: number;
  plans: BillingPlan[];
}

export interface SubscriptionStatus {
  plan: string;
  stored_plan: string;
  is_premium: boolean;
  expires_at: string | null;
  source: string | null;
  trial_used: boolean;
  trial_eligible: boolean;
}

export interface TrialResult {
  plan: string;
  expires_at: string;
  source: string;
}

export interface PurchaseIntent {
  intent_ref: string;
  checkout_url: string;
  amount?: number;
  currency?: string;
  months?: number;
}

export function getPlans(): Promise<PlansResponse> {
  return apiFetch<PlansResponse>("/api/v1/billing/plans");
}

export function getSubscription(): Promise<SubscriptionStatus> {
  return apiFetch<SubscriptionStatus>("/api/v1/billing/subscription");
}

export function startTrial(): Promise<TrialResult> {
  return apiFetch<TrialResult>("/api/v1/billing/trial", { method: "POST" });
}

export function purchasePremium(months: number): Promise<PurchaseIntent> {
  return apiFetch<PurchaseIntent>("/api/v1/billing/premium/purchase", {
    method: "POST",
    body: JSON.stringify({ months }),
  });
}
