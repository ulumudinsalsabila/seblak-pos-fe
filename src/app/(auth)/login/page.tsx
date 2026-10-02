"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ErrorNotice } from "@/components/ui";
import { useBranding } from "@/components/branding-provider";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const branding = useBranding();
  const router = useRouter();
  const [email, setEmail] = useState("owner@mail.com");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!loading && user)
      router.replace(
        user.role === "SUPER_ADMIN"
          ? "/admin"
          : user.role === "OWNER" || user.role === "MANAGER"
            ? "/dashboard"
            : user.role === "KITCHEN"
              ? "/kitchen"
              : "/pos",
      );
  }, [loading, user, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const signedIn = await login(email, password);
      router.replace(
        signedIn.role === "SUPER_ADMIN"
          ? "/admin"
          : signedIn.role === "OWNER" || signedIn.role === "MANAGER"
            ? "/dashboard"
            : signedIn.role === "KITCHEN"
              ? "/kitchen"
              : "/pos",
      );
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
      <section className="hidden overflow-hidden bg-[#2d1c14] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 font-black">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7562c] bg-cover bg-center"
            style={
              branding.logoUrl
                ? { backgroundImage: `url(${branding.logoUrl})` }
                : undefined
            }
          >
            {!branding.logoUrl && <Flame />}
          </span>{" "}
          {branding.storeName}
        </div>
        <div>
          <p className="mb-4 text-sm font-bold tracking-[.3em] text-orange-300">
            PEDAS · CEPAT · RAPI
          </p>
          <h1 className="max-w-xl text-6xl font-black leading-[1.02]">
            Kasir lancar,
            <br />
            antrian bubar.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-orange-100/75">
            Semua penjualan, stok, dan laporan dalam satu layar yang dirancang
            untuk ritme dapur.
          </p>
        </div>
        <p className="text-sm text-orange-100/45">
          {branding.storeName} POS · Single Outlet
        </p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card w-full max-w-md p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <span
              className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-[#e7562c] bg-cover bg-center text-white"
              style={
                branding.logoUrl
                  ? { backgroundImage: `url(${branding.logoUrl})` }
                  : undefined
              }
            >
              {!branding.logoUrl && <Flame />}
            </span>
          </div>
          <p className="text-sm font-black tracking-[.2em] text-[#e7562c]">
            SELAMAT DATANG
          </p>
          <h2 className="mt-2 text-3xl font-black">Masuk ke kasir</h2>
          <p className="mt-2 text-sm text-[#796c63]">
            Gunakan akun owner atau cashier yang aktif.
          </p>
          <div className="mt-8 space-y-5">
            <label>
              <span className="label">EMAIL</span>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              <span className="label">PASSWORD</span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            {error !== undefined && <ErrorNotice error={error} />}
            <button
              className="btn-primary flex w-full items-center justify-center gap-2"
              disabled={pending || loading}
            >
              {pending && <LoaderCircle className="animate-spin" size={18} />}
              Masuk
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
