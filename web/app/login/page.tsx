"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col justify-center bg-ios-bg px-6 shadow-2xl sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:rounded-[32px]">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-gradient-to-r from-ec-yellow via-ec-blue to-ec-red" />
        <h1 className="font-heading text-2xl font-bold text-primary">VENTANA SECA</h1>
        <p className="mt-1 text-sm text-ios-label-2">Elegí tu puerta</p>
      </div>
      <div className="space-y-2">
        <Link href="/brigada" className="btn-primary">
          App de campo
        </Link>
        <Link href="/jefe" className="btn-secondary">
          Panel de mando
        </Link>
      </div>
    </div>
  );
}
