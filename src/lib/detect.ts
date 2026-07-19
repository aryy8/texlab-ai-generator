import type { OutputType } from "@/lib/openrouter";

export interface Detection {
  type: OutputType | null;
  style: string | null;
}

interface StyleRule {
  type: OutputType;
  style: string;
  keywords: string[];
}

// Style-level detection. Rules are scored, not first-match: every rule gets
// points for each keyword found (longer keywords weigh more, so specific
// phrases beat generic single words), and the best-scoring rule wins.
const DETECTION_RULES: StyleRule[] = [
  {
    type: "diagram",
    style: "neural-network",
    keywords: [
      "neural network", "neural net", "cnn", "convolutional", "rnn", "lstm", "gru",
      "transformer architecture", "perceptron", "mlp", "deep learning", "hidden layer",
      "activation layer", "softmax", "backpropagation", "encoder-decoder", "autoencoder",
      "attention mechanism", "dense layer", "conv layer", "pooling layer", "embedding layer",
    ],
  },
  {
    type: "diagram",
    style: "architecture",
    keywords: [
      "architecture", "system design", "block diagram", "microservice", "system components",
      "infrastructure", "client-server", "backend", "frontend", "database layer", "api gateway",
      "load balancer", "message queue", "system overview", "component diagram", "deployment",
    ],
  },
  {
    type: "diagram",
    style: "timeline",
    keywords: ["timeline", "roadmap", "gantt", "chronology", "chronological", "milestone", "phases over time", "project schedule", "history of"],
  },
  {
    type: "diagram",
    style: "hierarchy",
    keywords: [
      "hierarchy", "tree diagram", "org chart", "organizational chart", "taxonomy",
      "hierarchical", "parent-child", "family tree", "classification of", "org structure",
      "inheritance", "directory structure", "file structure", "categories and subcategories",
    ],
  },
  {
    type: "diagram",
    style: "flowchart",
    keywords: [
      "flowchart", "flow chart", "flow diagram", "process flow", "workflow", "pipeline",
      "decision tree", "procedure", "process diagram", "steps of", "steps for", "algorithm for",
      "life cycle", "lifecycle", "state machine", "sequence of steps", "process of",
    ],
  },
  // Plot phrases must outrank generic table "results/metrics" keywords,
  // otherwise "training loss over 50 epochs" is misread as a results table.
  {
    type: "plot",
    style: "line",
    keywords: [
      "line plot", "line chart", "line graph", "loss curve", "training loss", "validation loss",
      "over epochs", "learning curve", "time series", "over time", "convergence", "trend of",
      "accuracy curve", "loss over", "as a function of",
    ],
  },
  {
    type: "plot",
    style: "bar",
    keywords: ["bar chart", "bar graph", "bar plot", "histogram", "bars comparing", "grouped bars", "stacked bar"],
  },
  {
    type: "plot",
    style: "scatter",
    keywords: ["scatter", "scatterplot", "correlation plot", "points plotted", "data points"],
  },
  {
    type: "plot",
    style: "multi-series",
    keywords: ["multi-series", "multiple series", "multiple curves", "compare curves", "several lines", "multiple lines on"],
  },
  {
    type: "table",
    style: "ablation",
    keywords: ["ablation"],
  },
  {
    type: "table",
    style: "comparison",
    keywords: ["comparison table", "table comparing", "compare", "comparison", "versus", " vs ", "vs.", "pros and cons", "feature matrix", "side by side"],
  },
  {
    type: "table",
    style: "results",
    keywords: ["results table", "table of results", "table which shows results", "benchmark", "performance table", "metrics table", "accuracy table", "scores table", "evaluation results", "experiment results"],
  },
  {
    type: "table",
    style: "compact",
    keywords: ["compact table", "small table", "summary table"],
  },
  {
    type: "table",
    style: "academic",
    keywords: ["table", "tabular", "spreadsheet"],
  },
  {
    type: "equation",
    style: "derivation",
    keywords: ["derivation", "derive", "step by step", "proof", "prove that", "show that"],
  },
  {
    type: "equation",
    style: "cases",
    keywords: ["piecewise", "cases", "conditional function", "defined by cases"],
  },
  {
    type: "equation",
    style: "boxed",
    keywords: ["boxed", "final result", "highlight the result", "boxed equation"],
  },
  {
    type: "equation",
    style: "aligned",
    keywords: [
      "equation", "equations", "formula", "formulas", "integral", "derivative", "theorem",
      "system of equations", "math expression", "mathematical expression", "identity",
      "expansion of", "summation", "matrix equation",
    ],
  },
];

// Type-level fallback: if no style rule scored, still pick the output type
// from a bare keyword (e.g. "create a diagram for ...") and leave style empty.
const TYPE_KEYWORDS: Array<{ type: OutputType; keywords: string[] }> = [
  { type: "diagram", keywords: ["diagram", "flow", "pipeline", "workflow", "process", "architecture", "network", "schematic", "tree", "block", "nodes", "arrows"] },
  { type: "table", keywords: ["table", "tabular", "spreadsheet", "matrix of", "grid of", "rows and columns"] },
  { type: "plot", keywords: ["plot", "chart", "histogram", "curve", "axis", "axes", "graph of", "visualize", "visualization"] },
  { type: "equation", keywords: ["equation", "formula", "math", "integral", "derivative", "theorem", "proof", "expression"] },
];

// Words that explicitly name the artifact ("draw a table", "make a plot").
// An explicit artifact word pins the TYPE even when style keywords from other
// types score higher (e.g. "table comparing CNN vs LSTM" stays a table).
const EXPLICIT_TYPE_WORDS: Array<{ type: OutputType; words: string[] }> = [
  { type: "table", words: ["table", "tabular"] },
  // Diagram phrases that contain "chart"/"graph" must be listed here so they
  // are pinned as diagrams before the bare plot words match.
  { type: "diagram", words: ["diagram", "flowchart", "flow chart", "schematic", "org chart", "organizational chart", "gantt chart", "gantt", "figure of the architecture"] },
  { type: "plot", words: ["plot", "chart", "graph", "histogram"] },
  { type: "equation", words: ["equation", "formula", "derivation", "proof"] },
];

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+.-]+/g, " ").trim()} `;
}

function scoreRule(haystack: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    const needle = keyword.includes(" ") ? keyword : ` ${keyword} `;
    if (haystack.includes(needle)) {
      // Multi-word phrases are far stronger signals than single words.
      score += keyword.includes(" ") ? 3 : 1;
    }
  }
  return score;
}

export function detectFromPrompt(text: string): Detection {
  const haystack = normalize(text);
  if (haystack.trim().length === 0) return { type: null, style: null };

  // 1. Explicit artifact words pin the type.
  let pinnedType: OutputType | null = null;
  for (const { type, words } of EXPLICIT_TYPE_WORDS) {
    if (words.some((word) => haystack.includes(word.includes(" ") ? word : ` ${word} `))) {
      pinnedType = type;
      break;
    }
  }

  // 2. Score every style rule; when a type is pinned, only its rules compete.
  let best: { rule: StyleRule; score: number } | null = null;
  for (const rule of DETECTION_RULES) {
    if (pinnedType && rule.type !== pinnedType) continue;
    const score = scoreRule(haystack, rule.keywords);
    if (score > 0 && (!best || score > best.score)) {
      best = { rule, score };
    }
  }
  if (best) {
    return { type: best.rule.type, style: best.rule.style };
  }
  if (pinnedType) {
    return { type: pinnedType, style: null };
  }

  // 3. Fall back to loose type keywords with no style.
  for (const rule of TYPE_KEYWORDS) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.includes(" ") ? keyword : ` ${keyword} `))) {
      return { type: rule.type, style: null };
    }
  }
  return { type: null, style: null };
}
