import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  const userEmail = session?.user?.email;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { supplierProfile: true, affiliateProfile: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: user.email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      userId: user.id,
      role: user.role,
    },
  });

  if (user.role === "SUPPLIER") {
    if (!user.supplierProfile) {
      return NextResponse.json(
        { error: "Supplier profile is required for this role" },
        { status: 400 },
      );
    }

    await prisma.supplierProfile.update({
      where: { id: user.supplierProfile.id },
      data: { stripeAccountId: account.id },
    });
  } else if (user.role === "AFFILIATE") {
    if (!user.affiliateProfile) {
      return NextResponse.json(
        { error: "Affiliate profile is required for this role" },
        { status: 400 },
      );
    }

    await prisma.affiliateProfile.update({
      where: { id: user.affiliateProfile.id },
      data: { stripeAccountId: account.id },
    });
  } else {
    return NextResponse.json(
      { error: "Only supplier or affiliate accounts can connect Stripe" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${baseUrl}/dashboard/stripe/refresh`,
    return_url: `${baseUrl}/dashboard/stripe/return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ onboardingUrl: accountLink.url });
}
