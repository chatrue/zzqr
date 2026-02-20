"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type EccLevel = "L" | "M" | "Q" | "H";

function looksLikeUrl(s: string) {
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^www\./i.test(t)) return true;
  if (/^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  return false;
}

function normalizeValue(raw: string) {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (looksLikeUrl(t) && !/^https?:\/\//i.test(t)) return `https://${t.replace(/^www\./i, "www.")}`;
  return t;
}

export default function Page() {
  // draft: 입력 중
  const [draft, setDraft] = useState("");
  // locked: 저장(확정)된 값 (QR은 이것만 반영)
  const [locked, setLocked] = useState<string>("");

  // ✅ ECC 토글 상태
  const [ecc, setEcc] = useState<EccLevel>("M");

  const [err, setErr] = useState<string | null>(null);

  const [clipCandidate, setClipCandidate] = useState<string | null>(null);
  const [clipInfo, setClipInfo] = useState<string | null>(null);

  const [qrReady, setQrReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // ✅ 토스트 / 하이라이트
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [qrHighlight, setQrHighlight] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 스크롤/포커스용
  const headerRef = useRef<HTMLElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const qrWrapRef = useRef<HTMLElement | null>(null);

  const lockedValue = useMemo(() => normalizeValue(locked), [locked]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }

  function pulseQrHighlight() {
    setQrHighlight(true);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setQrHighlight(false), 900);
  }

  function scrollToElement(el: HTMLElement | null) {
    if (!el) return;
    const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
    const y = window.scrollY + el.getBoundingClientRect().top - headerH - 10;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  // ✅ QR 렌더: lockedValue + ecc 변화에 반응해야 토글이 먹음
  useEffect(() => {
    setErr(null);
    setQrReady(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const payload = lockedValue || "https://example.com";

    QRCode.toCanvas(canvas, payload, {
      margin: 2,
      scale: 9,
      errorCorrectionLevel: ecc, // ✅ 토글 반영
    })
      .then(() => setQrReady(true))
      .catch((e) => setErr(e?.message ?? "QR 생성 실패"));
  }, [lockedValue, ecc]);

  // 클립보드 자동 감지
  useEffect(() => {
    let cancelled = false;

    async function detectClipboard() {
      try {
        const t = await navigator.clipboard.readText();
        if (cancelled) return;

        const raw = (t ?? "").trim();
        if (!raw) return;
        if (raw.length > 800) return;

        const normalized = normalizeValue(raw);
        if (!normalized) return;

        if (normalizeValue(draft) === normalized) return;

        setClipCandidate(normalized);
        setClipInfo(looksLikeUrl(raw) ? "클립보드에서 링크를 감지했어요." : "클립보드에서 텍스트를 감지했어요.");
      } catch {
        // ignore
      }
    }

    detectClipboard();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onImportClipboard() {
    if (!clipCandidate) return;
    setDraft(clipCandidate);
    setClipCandidate(null);
    setErr(null);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }

  function onDismissClipboard() {
    setClipCandidate(null);
  }

  async function onPasteButton() {
    try {
      const t = await navigator.clipboard.readText();
      const normalized = normalizeValue(t ?? "");
      if (!normalized) {
        setErr("클립보드에 내용이 없어요.");
        return;
      }
      setDraft(normalized);
      setErr(null);
      setClipCandidate(null);
      setTimeout(() => textareaRef.current?.focus(), 60);
    } catch {
      setErr("클립보드 접근이 막혀있어요. 직접 붙여넣어 주세요.");
    }
  }

  function onClear() {
    setDraft("");
    setErr(null);
  }

  function onSave({ scrollToQr }: { scrollToQr: boolean }) {
    const normalized = normalizeValue(draft);
    if (!normalized) {
      setErr("내용을 입력한 뒤 저장을 눌러주세요.");
      textareaRef.current?.focus();
      return false;
    }

    setLocked(normalized);
    setErr(null);

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setSavedAt(`${hh}:${mm}`);

    showToast("저장됨");
    pulseQrHighlight();

    if (scrollToQr) {
      requestAnimationFrame(() => scrollToElement(qrWrapRef.current));
      setTimeout(() => scrollToElement(qrWrapRef.current), 180);
    }
    return true;
  }

  function onDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "zzQR.png";
    a.click();
  }

  // ✅ 지금 QR로 버튼: 저장 전이면 저장 + QR로 스크롤, 저장 후면 QR로 스크롤
  function onNowQr() {
  if (!lockedValue) {
    showToast("먼저 저장해주세요");
    return;
  }

  const url = normalizeValue(lockedValue);

  // http / https 링크만 열기
  if (url.startsWith("http")) {
    window.open(url, "_blank");
  } else {
    showToast("이 QR은 링크가 아니에요");
  }
}

  // ✅ ECC 토글: 클릭 시 L→M→Q→H 순환 + 하이라이트(확정 느낌)
  function onToggleEcc() {
    const order: EccLevel[] = ["L", "M", "Q", "H"];
    const next = order[(order.indexOf(ecc) + 1) % order.length];
    setEcc(next);
    showToast(`ECC: ${next}`);
    pulseQrHighlight();
  }

  const btnBase =
    "rounded-2xl px-4 py-2 text-[13px] font-semibold active:scale-[0.97] transition-transform";

  return (
    <main className="min-h-[100svh] bg-neutral-50 text-neutral-900">
      {/* Toast */}
      <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
        {toast && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-2 text-[12px] font-semibold text-neutral-800 shadow-sm">
            {toast}
          </div>
        )}
      </div>

      <header
        ref={(n) => {
          headerRef.current = n;
        }}
        className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur"
      >
        <div className="mx-auto w-full max-w-xl px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between py-3">
            <div className="min-w-0 leading-tight">
              <div className="text-[15px] font-semibold tracking-[0.22em] text-neutral-500">zzQR</div>
              <div className="text-[18px] font-extrabold tracking-tight text-neutral-900">지큐알</div>
            </div>

            <button
              type="button"
              onClick={onNowQr}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[12px] font-semibold text-neutral-700 active:scale-[0.98] transition-transform"
              aria-label="지금 QR로"
              title={lockedValue ? "QR로 이동" : "저장 후 QR 생성"}
            >
              지금 QR로
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-3 sm:pt-6">
        {clipCandidate && (
          <section className="mb-3 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
            <div className="flex items-start gap-3 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-neutral-900 text-white shadow-sm">
                <span className="text-[12px] font-black">QR</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-neutral-900">
                  {clipInfo ?? "클립보드 내용을 감지했어요."}
                </div>
                <div className="mt-1 line-clamp-2 break-all text-[12px] text-neutral-600">{clipCandidate}</div>
              </div>

              <div className="flex shrink-0 gap-2">
                <button onClick={onImportClipboard} className={`${btnBase} bg-neutral-900 text-white shadow-sm`}>
                  가져오기
                </button>
                <button
                  onClick={onDismissClipboard}
                  className={`${btnBase} border border-black/10 bg-white text-neutral-700`}
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="border-t border-black/5 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600">
              팁: iOS/Safari에서는 자동 읽기가 제한될 수 있어요. 이때는{" "}
              <span className="font-semibold text-neutral-800">“클립보드 붙여넣기”</span>를 눌러주세요.
            </div>
          </section>
        )}

        {/* 입력 카드 */}
        <section ref={inputWrapRef} className="rounded-3xl border border-black/10 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-extrabold tracking-tight">링크/텍스트</div>
              <div className="mt-1 text-[12px] text-neutral-500">
              <span className="sm:hidden">입력 → 저장 → QR</span>
              <span className="hidden sm:inline">
             입력 후 <span className="font-semibold text-neutral-800">저장</span>을 눌러 QR을 확정하세요.
            </span>
            </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSave({ scrollToQr: true })}
                className={`${btnBase} bg-neutral-900 text-white shadow-sm`}
                title="저장 후 QR 확정"
              >
                저장
              </button>
              <button
                type="button"
                onClick={onDownload}
                className={`${btnBase} border border-black/10 bg-white text-neutral-800`}
                title="QR PNG 저장"
              >
                PNG
              </button>
            </div>
          </div>

          <div className="mt-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="예: https://example.com"
              rows={2}
              className="w-full resize-none rounded-2xl border border-black/10 bg-neutral-50 px-3 py-3 text-[15px] leading-relaxed outline-none placeholder:text-neutral-400 focus:border-black/20 focus:bg-white"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={onPasteButton} className={`${btnBase} border border-black/10 bg-white text-neutral-800`}>
              클립보드 붙여넣기
            </button>
            <button onClick={onClear} className={`${btnBase} border border-black/10 bg-white text-neutral-600`}>
              지우기
            </button>

            <div className="ml-auto flex items-center gap-2 ">
              {savedAt && (
                <span className="rounded-full border border-black/10 bg-neutral-50 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                  저장됨 {savedAt}
                </span>
              )}

              {/* ✅ ECC 토글 버튼 */}
              <button
                type="button"
                onClick={onToggleEcc}
                className="rounded-full border border-black/10 bg-neutral-50 px-3 py-1 text-[11px] font-semibold text-neutral-600 active:scale-[0.96] transition-transform"
                title="ECC 토글 (L/M/Q/H)"
              >
                ECC: {ecc}
              </button>
            </div>
          </div>

          {err && <div className="mt-2 text-[12px] font-semibold text-red-600">{err}</div>}
        </section>

        {/* QR 카드 */}
        <section
          ref={(n) => {
            qrWrapRef.current = n;
          }}
          className={[
            "mt-3 sm:mt-4 rounded-3xl border border-black/10 bg-white p-3 sm:p-4 shadow-sm",
            "transition-colors duration-500",
            qrHighlight ? "ring-2 ring-neutral-900/10 bg-neutral-50" : "",
          ].join(" ")}
        >
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[14px] font-extrabold tracking-tight">QR 미리보기</div>
              <div className="mt-1 text-[12px] text-neutral-500">
                {lockedValue ? "저장된 내용으로 QR이 확정됐어요." : "저장을 눌러 QR을 확정하세요."}
              </div>
            </div>
            <div className="text-[12px] font-semibold text-neutral-500">정사각 · 고해상도</div>
          </div>

          <div className="mt-3 grid place-items-center">
            <div
              className={[
                "rounded-[28px] border border-black/5 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)]",
                "transition-all duration-300 ease-out",
                qrReady ? "opacity-100 scale-100" : "opacity-0 scale-[0.985]",
              ].join(" ")}
            >
              <div className="p-3">
                <div className="rounded-[24px] bg-white p-2">
                  <canvas ref={canvasRef} />
                </div>
              </div>
            </div>

            <div className="mt-3 w-full rounded-2xl bg-neutral-50 px-3 py-2 text-[12px] text-neutral-600">
              <span className="font-semibold text-neutral-800">내용:</span>{" "}
              <span className="break-all">{lockedValue || "아직 저장되지 않았어요."}</span>
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-[12px] text-neutral-500">
          <div className="font-semibold">Made by Chatrue</div>
          <div className="mt-1">zzQR · 지큐알</div>
        </footer>
      </div>
    </main>
  );
}