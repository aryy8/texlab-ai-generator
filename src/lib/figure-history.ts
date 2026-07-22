import type { GenerationPreferences } from "@/lib/openrouter";

export interface StoredFigureVersion {
  latex: string;
  label: string;
}

export interface StoredFigure {
  id: string;
  title: string;
  prompt: string;
  preferences: GenerationPreferences;
  versions: StoredFigureVersion[];
  activeVersion: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "texlab:figures:v1";
const MAX_FIGURES = 30;

function readAll(): StoredFigure[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredFigure[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(figures: StoredFigure[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(figures.slice(0, MAX_FIGURES)));
}

export function listFigures(): StoredFigure[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveFigure(entry: Omit<StoredFigure, "id" | "createdAt" | "updatedAt"> & { id?: string }): StoredFigure {
  const now = new Date().toISOString();
  const figures = readAll();
  const existingIndex = entry.id ? figures.findIndex((f) => f.id === entry.id) : -1;

  if (existingIndex >= 0) {
    const updated: StoredFigure = {
      ...figures[existingIndex],
      ...entry,
      id: figures[existingIndex].id,
      createdAt: figures[existingIndex].createdAt,
      updatedAt: now,
    };
    figures.splice(existingIndex, 1);
    figures.unshift(updated);
    writeAll(figures);
    return updated;
  }

  const created: StoredFigure = {
    id: crypto.randomUUID(),
    title: entry.title,
    prompt: entry.prompt,
    preferences: entry.preferences,
    versions: entry.versions,
    activeVersion: entry.activeVersion,
    createdAt: now,
    updatedAt: now,
  };
  figures.unshift(created);
  writeAll(figures);
  return created;
}

export function deleteFigure(id: string): void {
  writeAll(readAll().filter((f) => f.id !== id));
}

export function renameFigure(id: string, title: string): void {
  const figures = readAll();
  const index = figures.findIndex((f) => f.id === id);
  if (index < 0) return;
  figures[index] = { ...figures[index], title, updatedAt: new Date().toISOString() };
  writeAll(figures);
}

export function getFigure(id: string): StoredFigure | undefined {
  return readAll().find((f) => f.id === id);
}
