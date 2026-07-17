import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Rocket, Film, Plug } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Campanhas", url: "/campanhas", icon: Rocket },
  { title: "Criativos", url: "/criativos", icon: Film },
  { title: "Integrações", url: "/integracoes", icon: Plug },
];

export function AppSidebar({ connected, accountName }: { connected: boolean; accountName?: string | null }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-surface/50 backdrop-blur-xl z-50 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="size-8 bg-brand rounded-sm flex items-center justify-center">
          <div className="size-4 bg-background rotate-45" />
        </div>
        <span className="font-bold tracking-tight text-foreground text-xl">VELOCITY</span>
      </div>

      <nav className="mt-8 px-4 space-y-1 flex-1">
        {items.map((item) => {
          const active = currentPath === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors " +
                (active
                  ? "text-foreground bg-foreground/5 border border-foreground/10"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground")
              }
            >
              {active && <span className="size-2 bg-brand rounded-full animate-pulse" />}
              <item.icon className="size-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4">
        <div
          className={
            "p-4 rounded-lg border " +
            (connected ? "bg-brand/5 border-brand/20" : "bg-muted/40 border-border")
          }
        >
          <div
            className={
              "text-[10px] font-bold uppercase tracking-wider mb-1 " +
              (connected ? "text-brand" : "text-muted-foreground")
            }
          >
            {connected ? "Meta Ads Connected" : "Meta Ads Desconectado"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {connected ? accountName ?? "Conta vinculada" : "Vá em Integrações"}
          </div>
        </div>
      </div>
    </aside>
  );
}
