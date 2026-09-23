type MailInput = { to: string; subject: string; html: string; text: string };

export async function verstuurMail({ to, subject, html, text }: MailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("E-mail is niet geconfigureerd. Stel RESEND_API_KEY en EMAIL_FROM in.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("E-mail verzenden mislukt:", detail);
    throw new Error("De e-mail kon niet worden verzonden.");
  }
}

export function absoluteUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://erp.iselto.nl").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function webAppUrl(path = "/") {
  const base = (process.env.NEXT_PUBLIC_WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://erp.iselto.nl").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
