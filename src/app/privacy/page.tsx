import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PrivacyContact } from "@/components/app/legal-page";

export const metadata: Metadata = { title: "Privacy policy", description: "How Galla handles your account and business data." };

// Linked from the Google Play listing and the apps. Keep it in step with what the code actually does.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="6 November 2026">
      <p>
        Galla is billing, stock and khata software for shops, made by Concilio Solutions. This policy covers the Galla website and the Galla apps for Windows,
        macOS and Android. They all use the same account and the same server.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your account:</b> name, email address, a hashed password, two-step verification settings and your signed-in devices (device type and IP address).</li>
        <li>
          <b>Your business records,</b> which you enter: business details and GSTIN, products, prices, stock, bills, purchases, customers and suppliers (names, phone numbers,
          addresses, GSTINs and balances), khata entries, product photos, logos and supplier bill photos you upload.
        </li>
        <li><b>Security records:</b> an audit log of changes in your business, failed sign-in counts and rate-limit counters.</li>
        <li><b>GST e-invoice credentials,</b> if you set them up. They are encrypted before they are stored.</li>
      </ul>

      <h2>What the apps use on your device</h2>
      <ul>
        <li><b>Camera:</b> only to read barcodes and QR codes while the scanner is open. Pictures are not saved or uploaded, except product or bill photos you choose to attach.</li>
        <li><b>Bluetooth and local network:</b> only to print receipts to printers you pick.</li>
        <li><b>Storage on the device:</b> your sign-in token (in the system&apos;s secure storage), and for offline billing a copy of your products, customers and unsynced bills.</li>
      </ul>
      <p>The apps contain no advertising and no third-party analytics or tracking.</p>

      <h2>How it is used and shared</h2>
      <p>
        Your data is used only to run Galla for you and the team members you invite. We do not sell it or share it for advertising. It is processed by the services that run
        Galla: the hosting and database provider and the email provider that sends verification, password-reset and invitation emails. When you share a bill on WhatsApp,
        the bill link and message go to the person you send them to. When you turn on GST e-invoicing, invoice data is sent to the government&apos;s e-invoice system (NIC)
        or the GSP you configured.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted (HTTPS). Every business&apos;s records are kept separate and are visible only to its members, according to their role. Passwords are
        hashed, sign-in attempts are limited, and two-step verification is available.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        Business records are kept while your account exists, because bills and tax records have to be retained. You can delete your account at any time in the app
        (More → My account → Delete account) or on the web (My account). See <Link href="/account-deletion">account deletion</Link> for exactly what is removed.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and correct your data in the app, export reports to Excel, and delete your account. For any other request, or a question about this policy,
        contact <PrivacyContact />.
      </p>
    </LegalPage>
  );
}
