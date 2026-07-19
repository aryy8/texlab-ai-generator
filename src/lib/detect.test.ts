import { describe, expect, it } from "vitest";
import { detectFromPrompt } from "./detect";

interface Case {
  prompt: string;
  type: string | null;
  style?: string | null; // undefined = don't care, null = must be unset
}

const CASES: Case[] = [
  // --- Straightforward, explicit ---
  { prompt: "A flowchart showing the compilation process of a LaTeX document", type: "diagram", style: "flowchart" },
  { prompt: "create a table which shows results of epochs on distilbert model", type: "table", style: "results" },
  { prompt: "An IEEE conference 2-column table comparing machine learning models", type: "table", style: "comparison" },
  { prompt: "bar chart of GPU market share by vendor", type: "plot", style: "bar" },
  { prompt: "scatter plot of height vs weight", type: "plot", style: "scatter" },
  { prompt: "a piecewise function defined by cases", type: "equation", style: "cases" },
  { prompt: "derivation of the quadratic formula step by step", type: "equation", style: "derivation" },
  { prompt: "org chart of a startup with CEO, CTO, and engineers", type: "diagram", style: "hierarchy" },
  { prompt: "project roadmap timeline for 2026 with quarterly milestones", type: "diagram", style: "timeline" },
  { prompt: "ablation study table for our new attention module", type: "table", style: "ablation" },

  // --- The failures the user actually hit ---
  { prompt: "create a diagram for nlp based techniques", type: "diagram" },
  { prompt: 'Training and validation loss over 50 epochs, training loss decreasing smoothly, validation loss rising after epoch 30 to show overfitting', type: "plot", style: "line" },
  { prompt: "create a diagram of neural network propagation", type: "diagram", style: "neural-network" },

  // --- Short / minimal ---
  { prompt: "create a table", type: "table" },
  { prompt: "a diagram", type: "diagram" },
  { prompt: "plot", type: "plot" },
  { prompt: "an equation", type: "equation" },
  { prompt: "histogram", type: "plot", style: "bar" },

  // --- Confusing: keywords from multiple types ---
  // Explicit artifact word should pin the type even with foreign keywords.
  { prompt: "a table comparing CNN, LSTM and transformer architectures", type: "table", style: "comparison" },
  { prompt: "a diagram of the data flow between microservices in our architecture", type: "diagram", style: "architecture" },
  { prompt: "plot of the equation y = x^2 from -5 to 5", type: "plot" },
  { prompt: "table of derivatives of common functions", type: "table" },
  { prompt: "a flowchart of the algorithm for computing the integral numerically", type: "diagram", style: "flowchart" },
  { prompt: "line graph comparing accuracy of three models over training epochs", type: "plot", style: "line" },

  // --- Longer, natural-language, no artifact word ---
  { prompt: "CNN for MNIST digit classification: 28x28 input, two conv+pool blocks, flatten, two dense layers, softmax output with 10 classes", type: "diagram", style: "neural-network" },
  { prompt: "An NLP pipeline for text classification using bag of words and SVM", type: "diagram", style: "flowchart" },
  { prompt: "show the steps of photosynthesis as a process", type: "diagram", style: "flowchart" },
  { prompt: "training loss decreasing over time for three optimizers", type: "plot", style: "line" },
  { prompt: "the taxonomy of machine learning: supervised, unsupervised, reinforcement, each with sub-branches", type: "diagram", style: "hierarchy" },

  // --- Vague / no signal: should stay unselected ---
  { prompt: "something cool for my paper", type: null, style: null },
  { prompt: "make it look professional", type: null, style: null },
  { prompt: "", type: null, style: null },
  { prompt: "asdf qwerty", type: null, style: null },

  // --- Tricky phrasing ---
  { prompt: "visualize the relationship between price and demand", type: "plot" },
  { prompt: "benchmark results for BERT, GPT-2 and T5 on GLUE", type: "table", style: "results" },
  { prompt: "a proof that sqrt(2) is irrational", type: "equation", style: "derivation" },
  { prompt: "client-server architecture with a load balancer and two backend services", type: "diagram", style: "architecture" },
  { prompt: "gantt chart of the thesis writing schedule", type: "diagram", style: "timeline" },
];

describe("detectFromPrompt", () => {
  for (const c of CASES) {
    it(`"${c.prompt.slice(0, 70)}" -> ${c.type}/${c.style === undefined ? "*" : c.style}`, () => {
      const result = detectFromPrompt(c.prompt);
      expect(result.type).toBe(c.type);
      if (c.style !== undefined) {
        expect(result.style).toBe(c.style);
      }
    });
  }
});
