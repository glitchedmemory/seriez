import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { checkImage } from "@/lib/moderation";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "JPEG, PNG, or WebP only" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split("/")[1];
    const filePath = `${username}-bg-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("backgrounds")
      .upload(filePath, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("backgrounds").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Content moderation
    const modResult = await checkImage(publicUrl);
    if (!modResult.safe) {
      await supabaseAdmin.storage.from("backgrounds").remove([filePath]);
      return NextResponse.json({ error: modResult.reason || "Inappropriate image" }, { status: 422 });
    }

    await supabaseAdmin
      .from("users")
      .update({ background_url: publicUrl })
      .eq("username", username.trim());

    return NextResponse.json({ backgroundUrl: publicUrl });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("background_url")
      .eq("username", username.trim())
      .maybeSingle();

    if (user?.background_url) {
      const url = new URL(user.background_url);
      const pathMatch = url.pathname.match(/\/backgrounds\/(.+)/);
      if (pathMatch) {
        await supabaseAdmin.storage.from("backgrounds").remove([pathMatch[1]]);
      }
    }

    await supabaseAdmin
      .from("users")
      .update({ background_url: null })
      .eq("username", username.trim());

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
