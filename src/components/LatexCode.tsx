import { useMemo } from "react";

interface Token {
    text: string;
    className: string;
}

// Workspace-token palette so dark mode stays bright like Cursor, not muddy.
const TOKEN_RULES: Array<{ regex: RegExp; className: string }> = [
    { regex: /%[^\n]*/, className: "text-[var(--ws-code-comment)]" },
    { regex: /\$[^$]*\$/, className: "text-[var(--ws-code-math)]" },
    { regex: /\\(?:begin|end)\b/, className: "font-semibold text-[var(--ws-code-env)]" },
    { regex: /\\[a-zA-Z@]+\*?/, className: "text-[var(--ws-code-command)]" },
    { regex: /\\[^a-zA-Z]/, className: "text-[var(--ws-code-command)]" },
    { regex: /[{}[\]]/, className: "text-[var(--ws-code-delim)]" },
    { regex: /\b\d+(?:\.\d+)?\b/, className: "text-[var(--ws-code-number)]" },
];

const COMBINED = new RegExp(TOKEN_RULES.map((rule) => `(${rule.regex.source})`).join("|"), "g");

function tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    COMBINED.lastIndex = 0;
    while ((match = COMBINED.exec(code)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ text: code.slice(lastIndex, match.index), className: "text-[var(--ws-code-plain)]" });
        }
        const ruleIndex = TOKEN_RULES.findIndex((_, i) => match![i + 1] !== undefined);
        tokens.push({
            text: match[0],
            className: ruleIndex >= 0 ? TOKEN_RULES[ruleIndex].className : "text-[var(--ws-code-plain)]",
        });
        lastIndex = COMBINED.lastIndex;
        if (match.index === COMBINED.lastIndex) COMBINED.lastIndex++;
    }

    if (lastIndex < code.length) {
        tokens.push({ text: code.slice(lastIndex), className: "text-[var(--ws-code-plain)]" });
    }

    return tokens;
}

export function LatexCode({ code }: { code: string }) {
    const lines = useMemo(() => code.replace(/\t/g, "  ").split("\n"), [code]);

    return (
        <div className="flex min-h-0 font-mono text-[13px] leading-[1.55]">
            {/* Fixed gutter: does not scroll horizontally with the source */}
            <div
                aria-hidden="true"
                className="ws-code-gutter sticky left-0 z-[1] shrink-0 select-none self-start bg-[var(--ws-elevated,var(--ws-bg))] pl-3 pr-4 text-right tabular-nums"
            >
                {lines.map((_, i) => (
                    <div key={i} className="min-w-[2ch]">
                        {i + 1}
                    </div>
                ))}
            </div>
            {/* Only this pane scrolls horizontally */}
            <div className="min-w-0 flex-1 overflow-x-auto pl-2 pr-3">
                <code className="block w-max min-w-full whitespace-pre">
                    {lines.map((line, i) => (
                        <div key={i}>
                            {line.length === 0
                                ? "\u00A0"
                                : tokenize(line).map((token, j) => (
                                      <span key={j} className={token.className}>
                                          {token.text}
                                      </span>
                                  ))}
                        </div>
                    ))}
                </code>
            </div>
        </div>
    );
}
