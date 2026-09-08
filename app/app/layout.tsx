import WebAppServiceWorker from "@/components/app/WebAppServiceWorker";
import WebAppBottomNavigation from "@/components/app/WebAppBottomNavigation";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <WebAppServiceWorker />
      <div className="min-h-screen pb-20">
        {children}
      </div>
      <WebAppBottomNavigation />
    </>
  );
}
