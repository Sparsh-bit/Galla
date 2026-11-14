import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PrivacyContact } from "@/components/app/legal-page";

export const metadata: Metadata = { title: "Delete your Galla account", description: "How to delete your Galla account and what happens to your data." };

// Google Play asks for a web page where people can request account deletion; this is it.
export default function AccountDeletionPage() {
  return (
    <LegalPage title="Delete your Galla account" updated="6 November 2026">
      <h2>In the Android app</h2>
      <p>Open <b>More → My account → Delete account</b>, enter your password and type DELETE to confirm.</p>

      <h2>On the web or the desktop app</h2>
      <p>
        <Link href="/sign-in">Sign in</Link>, open <b>My account</b> from the menu under your name, and choose <b>Delete my account</b>.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li>Your account: name, email, password, two-step verification and every signed-in device. This happens immediately.</li>
        <li>Every business where you are the only member, with all its products, stock, bills, purchases, customers, suppliers, khata, audit log, uploaded photos and saved GST credentials.</li>
        <li>Your membership of businesses shared with other people. Their records stay with them, because they belong to that business.</li>
      </ul>
      <p>
        If you are the only owner of a business that has other members, make one of them an owner first (Settings → Team), so the shop isn&apos;t left without an owner.
        Download any reports you need for GST before deleting: deleted data can&apos;t be recovered.
      </p>

      <h2>Can&apos;t sign in?</h2>
      <p>Reset your password from the sign-in page, or ask for deletion at <PrivacyContact /> from the email address of the account.</p>
    </LegalPage>
  );
}
