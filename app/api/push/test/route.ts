import webpush from "web-push";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function vapidInstellen() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function POST() {
  const gebruiker = await getCurrentUser();

  if (!gebruiker) {
    return NextResponse.json(
      { fout: "Je moet ingelogd zijn." },
      { status: 401 },
    );
  }

  if (!vapidInstellen()) {
    return NextResponse.json(
      { fout: "Pushmeldingen zijn niet geconfigureerd." },
      { status: 500 },
    );
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      systeemGebruikerId: gebruiker.id,
      actief: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json(
      { fout: "Er is voor dit account geen actieve pushregistratie gevonden." },
      { status: 400 },
    );
  }

  let verstuurd = 0;
  let fouten = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({
          title: "Clevers — testmelding",
          body: "Pushmeldingen werken. Dit is een testmelding.",
          href: "/dashboard",
        }),
      );

      verstuurd += 1;
    } catch (error) {
      fouten += 1;

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            actief: false,
            laatsteFoutOp: new Date(),
          },
        });
      }
    }
  }

  return NextResponse.json({
    ok: fouten === 0,
    verstuurd,
    fouten,
  });
}
