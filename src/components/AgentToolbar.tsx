import { useMemo, useState } from "react";
import { CheckCircle2, History, MessageSquare, Pencil, Plus, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listFigures, type StoredFigure } from "@/lib/figure-history";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function truncate(text: string, max = 36): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export interface AgentTab {
  id: string;
  title: string;
  figureId: string | null;
}

interface AgentToolbarProps {
  tabs: AgentTab[];
  activeTabId: string;
  currentFigureId: string | null;
  disabled?: boolean;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewAgent: () => void;
  onRestore: (figure: StoredFigure) => void;
}

export function AgentToolbar({
  tabs,
  activeTabId,
  currentFigureId,
  disabled,
  onSelectTab,
  onCloseTab,
  onNewAgent,
  onRestore,
}: AgentToolbarProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [figures, setFigures] = useState<StoredFigure[]>(() => listFigures());

  const refresh = () => setFigures(listFigures());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return figures;
    return figures.filter(
      (f) =>
        f.title.toLowerCase().includes(q)
        || f.prompt.toLowerCase().includes(q),
    );
  }, [figures, query]);

  const todayStart = startOfToday();
  const today = filtered.filter((f) => new Date(f.updatedAt).getTime() >= todayStart);
  const older = filtered.filter((f) => new Date(f.updatedAt).getTime() < todayStart);

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-0">
      <div className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto ws-agent-tabs">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`ws-agent-tab group ${active ? "ws-agent-tab--active" : ""}`}
            >
              <button
                type="button"
                className="ws-agent-tab-main"
                disabled={disabled}
                onClick={() => onSelectTab(tab.id)}
                title={tab.title}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={1.5} />
                <span className="min-w-0 truncate">{truncate(tab.title, 22)}</span>
              </button>
              {active && (
                <button
                  type="button"
                  className="ws-agent-tab-close"
                  title="Close agent"
                  aria-label="Close agent"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        <button
          type="button"
          className="ws-agent-icon-btn"
          title="New agent"
          aria-label="New agent"
          disabled={disabled}
          onClick={onNewAgent}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <Popover
          open={historyOpen}
          onOpenChange={(open) => {
            setHistoryOpen(open);
            if (open) {
              refresh();
              setQuery("");
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`ws-agent-icon-btn ${historyOpen ? "ws-agent-icon-btn--active" : ""}`}
              title="Show chat history"
              aria-label="Show chat history"
              aria-expanded={historyOpen}
              disabled={disabled}
            >
              <History className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="ws-agent-history w-[min(20rem,calc(100vw-2rem))] border-[var(--ws-input-border)] bg-[var(--ws-input)] p-0 text-[var(--ws-text)] shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-[var(--ws-divider)] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ws-text-muted)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents…"
                className="w-full bg-transparent font-heading text-[13px] text-[var(--ws-text)] placeholder:text-[var(--ws-text-muted)] focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-[min(22rem,55vh)] overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 font-mono text-[11px] text-[var(--ws-text-muted)]">
                  {figures.length === 0
                    ? "No saved figures yet. Generate one to see it here."
                    : "No matches."}
                </p>
              ) : (
                <>
                  {today.length > 0 && (
                    <HistorySection
                      label="Today"
                      figures={today}
                      currentId={currentFigureId}
                      onPick={(figure) => {
                        onRestore(figure);
                        setHistoryOpen(false);
                      }}
                    />
                  )}
                  {older.length > 0 && (
                    <HistorySection
                      label="Older"
                      figures={older}
                      currentId={currentFigureId}
                      onPick={(figure) => {
                        onRestore(figure);
                        setHistoryOpen(false);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function HistorySection({
  label,
  figures,
  currentId,
  onPick,
}: {
  label: string;
  figures: StoredFigure[];
  currentId: string | null;
  onPick: (figure: StoredFigure) => void;
}) {
  return (
    <div className="pb-1">
      <p className="px-3 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ws-text-muted)]">
        {label}
      </p>
      <ul className="px-1">
        {figures.map((figure) => {
          const active = figure.id === currentId;
          const draft = figure.versions.length === 0;
          return (
            <li key={figure.id}>
              <button
                type="button"
                onClick={() => onPick(figure)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-[var(--ws-hover)] text-[var(--ws-text)]"
                    : "text-[var(--ws-text-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text)]"
                }`}
              >
                {draft ? (
                  <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1 truncate font-heading text-[13px] leading-snug">
                  {truncate(figure.title || figure.prompt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
