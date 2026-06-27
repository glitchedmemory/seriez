import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const paddleApiKey = process.env.PADDLE_API_KEY;

  if (!paddleApiKey) {
    return NextResponse.json(
      { error: "Billing is not configured yet" },
      { status: 503 }
    );
  }

  try {
    // Get user session
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user has a Paddle customer ID
    const { data: profile } = await supabase
      .from("users")
      .select("paddle_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.paddle_customer_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Generate Paddle customer portal session
    const res = await fetch(
      `https://api.paddle.com/customers/${profile.paddle_customer_id}/portal-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paddleApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      console.error("Paddle portal session error:", await res.text());
      return NextResponse.json(
        { error: "Failed to generate portal link" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const portalUrl = data?.data?.urls?.general?.overview;

    if (!portalUrl) {
      return NextResponse.json(
        { error: "No portal URL returned" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    console.error("Billing portal error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
