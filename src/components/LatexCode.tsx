import { useMemo } from "react";

interface Token {
    text: string;
    className: string;
}

// Overleaf-like palette. Order matters: earlier patterns win.
const TOKEN_RULES: Array<{ regex: RegExp; className: string }> = [
    { regex: /%[^\n]*/, className: "text-emerald-600" }, // comments
    { regex: /\$[^$]*\$/, className: "text-teal-600" }, // inline math
    { regex: /\\(?:begin|end)\b/, className: "text-purple-600 font-semibold" }, // environments
    { regex: /\\[a-zA-Z@]+\*?/, className: "text-blue-600" }, // commands
    { regex: /\\[^a-zA-Z]/, className: "text-blue-600" }, // escaped symbols (\{, \%, ...)
    { regex: /[{}[\]]/, className: "text-amber-600" }, // delimiters
    { regex: /\b\d+(?:\.\d+)?\b/, className: "text-orange-600" }, // numbers
];

// Single combined regex; each alternative is one capture group so we can map
// a match back to its color rule.
const COMBINED = new RegExp(TOKEN_RULES.map((rule) => `(${rule.regex.source})`).join("|"), "g");

function tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    COMBINED.lastIndex = 0;
    while ((match = COMBINED.exec(code)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ text: code.slice(lastIndex, match.index), className: "text-foreground/90" });
        }
        // match[i+1] is the group for TOKEN_RULES[i].
        const ruleIndex = TOKEN_RULES.findIndex((_, i) => match![i + 1] !== undefined);
        tokens.push({
            text: match[0],
            className: ruleIndex >= 0 ? TOKEN_RULES[ruleIndex].className : "text-foreground/90",
        });
        lastIndex = COMBINED.lastIndex;
        if (match.index === COMBINED.lastIndex) COMBINED.lastIndex++; // guard against zero-width
    }

    if (lastIndex < code.length) {
        tokens.push({ text: code.slice(lastIndex), className: "text-foreground/90" });
    }

    return tokens;
}

export function LatexCode({ code }: { code: string }) {
    const lines = useMemo(() => code.replace(/\t/g, "  ").split("\n"), [code]);

    return (
        <div className="flex font-mono text-[13px] leading-relaxed">
            <div
                aria-hidden="true"
                className="select-none pr-4 text-right text-muted-foreground/40 tabular-nums"
            >
                {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                ))}
            </div>
            <code className="flex-1 whitespace-pre">
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
    );
}
