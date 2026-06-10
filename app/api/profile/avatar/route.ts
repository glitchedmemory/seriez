import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUsername } from "@/lib/auth-helper";
import { checkImage } from "@/lib/moderation";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** POST — upload profile avatar */
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
      return NextResponse.json({ error: "File too large (max 2MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage first so we have a URL for moderation check
    const filePath = `${username}-${Date.now()}.${file.type.split("/")[1]}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Content moderation check
    const modResult = await checkImage(publicUrl);
    if (!modResult.safe) {
      // Delete the uploaded file
      await supabaseAdmin.storage.from("avatars").remove([filePath]);
      return NextResponse.json({ error: modResult.reason || "Inappropriate image" }, { status: 422 });
    }

    // Update user's avatar_url
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("username", username.trim());

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ avatarUrl: publicUrl });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/** DELETE — remove profile avatar */
export async function DELETE(req: NextRequest) {
  try {
    const username = await resolveUsername(req);
    if (!username) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get current avatar URL to extract storage path
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("avatar_url")
      .eq("username", username.trim())
      .maybeSingle();

    if (user?.avatar_url) {
      // Extract file path from URL
      const url = new URL(user.avatar_url);
      const pathMatch = url.pathname.match(/\/avatars\/(.+)/);
      if (pathMatch) {
        await supabaseAdmin.storage.from("avatars").remove([pathMatch[1]]);
      }
    }

    await supabaseAdmin
      .from("users")
      .update({ avatar_url: null })
      .eq("username", username.trim());

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
