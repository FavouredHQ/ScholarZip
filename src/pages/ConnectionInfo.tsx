import { useState } from "react";
import { Copy, Check, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const CREDENTIALS = [
  {
    label: "Project URL",
    value: import.meta.env.VITE_SUPABASE_URL,
    secret: false,
  },
  {
    label: "Project ID",
    value: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    secret: false,
  },
  {
    label: "Anon / Publishable Key",
    value: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    secret: true,
  },
];

function CopyableField({ label, value, secret }: { label: string; value: string; secret: boolean }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(!secret);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <code className="flex-1 text-sm break-all font-mono">
          {visible ? value : "•".repeat(Math.min(value.length, 40))}
        </code>
        {secret && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function ConnectionInfo() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Connection Credentials</CardTitle>
            <CardDescription>
              Use these credentials to connect external AI agents or tools to your database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CREDENTIALS.map((c) => (
              <CopyableField key={c.label} {...c} />
            ))}

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Service Role Key</p>
              <div className="rounded-md border bg-muted/50 px-3 py-2">
                <p className="text-sm text-muted-foreground italic">
                  Not available client-side. Find it in <strong>Settings → Cloud → Secrets</strong> as{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>, or use the
                  SQL Editor in Cloud to query your data.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Direct Postgres URL</p>
              <div className="rounded-md border bg-muted/50 px-3 py-2">
                <p className="text-sm text-muted-foreground italic">
                  Available as <code className="text-xs bg-muted px-1 py-0.5 rounded">SUPABASE_DB_URL</code> in Cloud
                  Secrets. Use for direct SQL connections from agents.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Start — Python Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs font-mono leading-relaxed">
{`from supabase import create_client

url = "${import.meta.env.VITE_SUPABASE_URL}"
key = "YOUR_SERVICE_ROLE_KEY"   # from Cloud → Secrets

sb = create_client(url, key)

# Example: fetch pending URLs
rows = sb.table("url_queue") \\
         .select("*") \\
         .eq("status", "pending") \\
         .execute()
print(rows.data)`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
