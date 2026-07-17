import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "./app-sidebar";

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { data: meta } = useQuery({
    queryKey: ["meta_integration"],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_integration")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar connected={!!meta?.is_connected} accountName={meta?.account_name} />
      <main className="pl-64">
        <header className="h-20 border-b border-border flex items-center justify-between px-8 sticky top-0 bg-background/80 backdrop-blur-md z-40">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-3">{actions}</div>}
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
