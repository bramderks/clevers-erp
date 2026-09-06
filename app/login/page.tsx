import Image from "next/image";

import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="Clevers"
            width={300}
            height={128}
            priority
            className="h-auto max-h-32 w-auto max-w-[300px] object-contain"
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Clevers ERP
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Welkom terug. Log in om verder te gaan.
              </p>
            </div>

            <LoginForm />
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Iselto B.V.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}