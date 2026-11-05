import { ProviderPassword } from "@/components/provider/provider-password";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProviderAccount() {
  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Your password</CardTitle><CardDescription>Change it after first sign-in, and whenever it may have been shared.</CardDescription></CardHeader>
      <CardContent><ProviderPassword /></CardContent>
    </Card>
  );
}
