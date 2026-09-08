import WebAppServiceWorker from "@/components/app/WebAppServiceWorker";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <WebAppServiceWorker />
      {children}
    </>
  );
}
