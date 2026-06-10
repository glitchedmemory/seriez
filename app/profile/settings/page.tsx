"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Reset ratings
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Logout
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function handleChangePassword() {
    if (!currentPw || !newPw) {
      setPwMsg({ ok: false, text: "모든 필드를 입력해주세요" });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ ok: false, text: "비밀번호는 6자 이상이어야 합니다" });
      return;
    }
    if (currentPw === newPw) {
      setPwMsg({ ok: false, text: "새 비밀번호가 현재와 같습니다" });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      }).then(r => r.json());
      if (res.error) {
        setPwMsg({ ok: false, text: res.error });
      } else {
        setPwMsg({ ok: true, text: "비밀번호가 변경되었습니다" });
        setCurrentPw("");
        setNewPw("");
        setShowPwForm(false);
      }
    } catch {
      setPwMsg({ ok: false, text: "오류가 발생했습니다" });
    }
    setPwLoading(false);
  }

  async function handleResetRatings() {
    setResetLoading(true);
    setResetMsg("");
    try {
      const res = await fetch("/api/auth/reset-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: resetInput }),
      }).then(r => r.json());
      if (res.error) {
        setResetMsg(res.error);
      } else {
        setResetMsg("평가내역이 초기화되었습니다");
        setShowResetConfirm(false);
        setResetInput("");
      }
    } catch {
      setResetMsg("오류가 발생했습니다");
    }
    setResetLoading(false);
  }

  async function handleDeleteAccount() {
    if (!deletePw || !deleteInput) {
      setDeleteMsg("모든 필드를 입력해주세요");
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg("");
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw, confirmation: deleteInput }),
      }).then(r => r.json());
      if (res.error) {
        setDeleteMsg(res.error);
      } else {
        await supabase.auth.signOut();
        localStorage.removeItem("seriez-username");
        router.push("/");
      }
    } catch {
      setDeleteMsg("오류가 발생했습니다");
    }
    setDeleteLoading(false);
  }

  async function handleLogout() {
    setLogoutLoading(true);
    await supabase.auth.signOut();
    localStorage.removeItem("seriez-username");
    router.push("/");
  }

  return (
    <ErrorBoundary sectionName="Settings">
      <div className="max-w-lg md:max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 pt-4 pb-3">
          <button
            onClick={() => router.back()}
            className="text-[#9ca3af] hover:text-white transition-colors"
          >
            ← 뒤로
          </button>
          <h1 className="text-lg font-bold text-white">내 설정</h1>
        </div>

        <div className="px-4 space-y-4 mt-2">
          {/* ── 프로필 변경 ── */}
          <button
            onClick={() => router.push("/profile")}
            className="w-full flex items-center justify-between bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4 hover:border-[#6366f1]/40 transition-colors"
          >
            <span className="text-sm text-white">프로필 변경</span>
            <span className="text-[#6b7280]">아바타 · 배경사진 ›</span>
          </button>

          {/* ── 이메일 변경 ── */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4 opacity-60">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">이메일 변경</span>
              <span className="text-[10px] text-[#f59e0b]">SMTP 설정 필요</span>
            </div>
          </div>

          {/* ── 비밀번호 변경 ── */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowPwForm(!showPwForm)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-white">비밀번호 변경</span>
              <span className="text-[#6b7280] text-xs">{showPwForm ? "▲" : "▼"}</span>
            </button>
            {showPwForm && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#2d2d4a] pt-4">
                <input
                  type="password"
                  placeholder="현재 비밀번호"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1]"
                />
                <input
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1]"
                />
                {pwMsg && (
                  <p className={`text-xs ${pwMsg.ok ? "text-green-400" : "text-red-400"}`}>{pwMsg.text}</p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={pwLoading}
                  className="w-full py-2 bg-[#6366f1] hover:bg-[#818cf8] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {pwLoading ? "변경 중..." : "비밀번호 변경"}
                </button>
              </div>
            )}
          </div>

          {/* ── 로그아웃 ── */}
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full flex items-center justify-between bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-4 hover:border-red-500/40 transition-colors"
          >
            <span className="text-sm text-red-400">로그아웃</span>
            <span className="text-[#6b7280] text-xs">›</span>
          </button>

          {/* ── 평가내역 초기화 ── */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowResetConfirm(!showResetConfirm)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-[#f59e0b]">평가내역 초기화</span>
              <span className="text-[#6b7280] text-xs">{showResetConfirm ? "▲" : "▼"}</span>
            </button>
            {showResetConfirm && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#2d2d4a] pt-4">
                <p className="text-xs text-[#9ca3af]">
                  모든 별점 평가와 리뷰가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  계속하려면 사용자명을 입력하세요.
                </p>
                <input
                  type="text"
                  placeholder="사용자명 입력"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-[#f59e0b]"
                />
                {resetMsg && (
                  <p className={`text-xs ${resetMsg.includes("되었습니다") ? "text-green-400" : "text-red-400"}`}>{resetMsg}</p>
                )}
                <button
                  onClick={handleResetRatings}
                  disabled={resetLoading || !resetInput}
                  className="w-full py-2 bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-50 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  {resetLoading ? "처리 중..." : "초기화"}
                </button>
              </div>
            )}
          </div>

          {/* ── 탈퇴하기 ── */}
          <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-red-400">탈퇴하기</span>
              <span className="text-[#6b7280] text-xs">{showDeleteConfirm ? "▲" : "▼"}</span>
            </button>
            {showDeleteConfirm && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#2d2d4a] pt-4">
                <p className="text-xs text-[#9ca3af]">
                  계정과 모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
                </p>
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={deletePw}
                  onChange={(e) => setDeletePw(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-red-500"
                />
                <input
                  type="text"
                  placeholder="사용자명 입력"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-[#2d2d4a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:outline-none focus:border-red-500"
                />
                {deleteMsg && (
                  <p className="text-xs text-red-400">{deleteMsg}</p>
                )}
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || !deletePw || !deleteInput}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {deleteLoading ? "처리 중..." : "탈퇴하기"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
