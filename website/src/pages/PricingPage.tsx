import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { createOrder, PlanCode } from "../lib/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

type CheckoutState = "idle" | "creating" | "opened" | "failed" | "cancelled";

/** Load the Razorpay Checkout script when the global constructor is unavailable. */
async function loadRazorpay(): Promise<NonNullable<Window["Razorpay"]>> {
  if (window.Razorpay) return window.Razorpay;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout failed to initialize"));
    };
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded"));
    document.head.appendChild(script);
  });
}

/** Display plans and support server-priced Razorpay checkout for signed-in users. */
export function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checkoutPlan, setCheckoutPlan] = useState<PlanCode | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = async (plan: PlanCode) => {
    setCheckoutPlan(plan);
    setCheckoutError(null);
    setCheckoutState("creating");

    try {
      const order = await createOrder(plan);
      if (!order?.key_id || !order?.order_id) {
        throw new Error("Razorpay checkout configuration is missing.");
      }

      const RazorpayConstructor = await loadRazorpay();
      const rzp = new RazorpayConstructor({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Soravo",
        description: `${plan} plan`,
        handler: () => {
          // The browser callback is informational only; server state is authoritative.
          setCheckoutState("opened");
          navigate("/account?checkout=1");
        },
        modal: {
          ondismiss: () => {
            setCheckoutState("cancelled");
            setCheckoutError("Checkout was cancelled before completion.");
            setCheckoutPlan(null);
          },
        },
      });

      rzp.on("payment.failed", (response: unknown) => {
        setCheckoutState("failed");
        const message =
          typeof response === "object" && response !== null && "error" in response
            ? String((response as { error?: { description?: string } }).error?.description ?? "Payment failed.")
            : "Payment failed.";
        setCheckoutError(message);
        setCheckoutPlan(null);
      });

      setCheckoutState("opened");
      rzp.open();
    } catch (error) {
      setCheckoutState("failed");
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
      setCheckoutPlan(null);
    }
  };

  const planAction = (plan: PlanCode, label: string, className: string) => {
    if (authLoading) {
      return <span className={className}>Loading...</span>;
    }
    if (!user) {
      return (
        <Link to={`/signup?plan=${plan}`} className={className}>
          {label}
        </Link>
      );
    }
    return (
      <button
        type="button"
        disabled={checkoutState === "creating"}
        onClick={() => void startCheckout(plan)}
        className={className}
      >
        {checkoutState === "creating" && checkoutPlan === plan ? "Starting checkout..." : `Buy ${plan}`}
      </button>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <div className="flex gap-6 text-sm">
            {user ? (
              <>
                <Link to="/account" className="hover:underline">Account</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:underline">Log in</Link>
                <Link to="/signup" className="rounded-full bg-ink px-4 py-2 text-lime">Sign up</Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-center text-4xl font-bold text-ink">Simple pricing</h1>
        <p className="mt-4 text-center text-lg text-muted">
          Choose the plan that works for you. All plans include full access to Soravo.
        </p>

        {checkoutError && (
          <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {checkoutError}
          </div>
        )}

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border border-ink/10 p-8">
            <h2 className="text-2xl font-bold text-ink">Monthly</h2>
            <p className="mt-2 text-4xl font-bold text-ink">
              $12<span className="text-lg font-normal text-muted">/month</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li>Full dictation access</li>
              <li>Up to 3 active devices</li>
              <li>14-day offline grace</li>
            </ul>
            <div className="mt-8">
              {planAction("monthly", "Create account for monthly", "block w-full rounded-full bg-ink py-3 text-center font-semibold text-lime")}
            </div>
          </div>

          {/* Lifetime */}
          <div className="rounded-2xl border-2 border-lime bg-lime/5 p-8">
            <div className="mb-2 inline-block rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
              Best value
            </div>
            <h2 className="text-2xl font-bold text-ink">Lifetime</h2>
            <p className="mt-2 text-4xl font-bold text-ink">
              $50<span className="text-lg font-normal text-muted"> one-time</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li>Full dictation access forever</li>
              <li>Unlimited devices</li>
              <li>Indefinite offline operation</li>
            </ul>
            <div className="mt-8">
              {planAction("lifetime", "Create account for lifetime", "block w-full rounded-full bg-lime py-3 text-center font-semibold text-ink")}
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted">
          Payments processed securely via Razorpay. Prices in USD.
        </p>
      </main>
    </div>
  );
}