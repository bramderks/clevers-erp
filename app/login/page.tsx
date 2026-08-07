import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import LoginForm from "@/components/login/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <PageHeader
          title="Clevers ERP"
          subtitle="Log in met je account."
        />

        <Card>
          <LoginForm />
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Clevers ERP
        </p>
      </div>
    </main>
  );
}