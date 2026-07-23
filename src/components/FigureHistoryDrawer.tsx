import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { deleteFigure, listFigures, renameFigure, type StoredFigure } from "@/lib/figure-history";
import { Archive, Pencil, Trash2 } from "lucide-react";

interface FigureHistoryDrawerProps {
  onRestore: (figure: StoredFigure) => void;
}

export function FigureHistoryDrawer({ onRestore }: FigureHistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [figures, setFigures] = useState<StoredFigure[]>(() => listFigures());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const refresh = () => setFigures(listFigures());

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) refresh();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden font-mono text-xs sm:flex border-border hover:bg-muted"
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          My figures
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4 pr-12 text-left">
          <SheetTitle className="font-heading">My figures</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <div className="space-y-3">
            {figures.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">
                Generated figures are saved here automatically after a successful compile.
              </p>
            ) : (
              figures.map((figure) => (
                <div key={figure.id} className="border border-border p-3">
                  {editingId === figure.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        renameFigure(figure.id, editTitle.trim() || figure.title);
                        setEditingId(null);
                        refresh();
                      }}
                    >
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 border border-border bg-background px-2 py-1 font-mono text-xs"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="h-8 font-mono text-xs">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="font-heading text-sm font-semibold">{figure.title}</p>
                      <p className="mt-1 line-clamp-2 font-mono text-[10px] text-muted-foreground">
                        {figure.prompt}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {figure.versions.length} version(s) ·{" "}
                        {new Date(figure.updatedAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-7 font-mono text-xs"
                          onClick={() => {
                            onRestore(figure);
                            setOpen(false);
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingId(figure.id);
                            setEditTitle(figure.title);
                          }}
                          aria-label="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => {
                            deleteFigure(figure.id);
                            refresh();
                          }}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
