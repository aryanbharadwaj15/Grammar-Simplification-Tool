# GrammarFlow: Grammar Simplification Visualizer
**Submission for Theory of Automata & Formal Languages Project.**  
**Developed by:** Aryan Bharadwaj (2024UCS1528)  
**Under the guidance of:** Prof. Anmol Awasthi

---

## 🚀 Overview
**GrammarFlow** is a premium, interactive web application designed to visually demonstrate the mathematical process of simplifying Context-Free Grammars (CFG). Built with a focus on pedagogical clarity, the tool breaks down complex transformations into an intuitive, step-by-step playback experience.

The application natively handles the three core phases of grammar simplification:
1.  **Removal of Null (ε) Productions**
2.  **Removal of Unit Productions**
3.  **Elimination of Useless Symbols** (Non-generating and Unreachable)

Whether you are a student visualizing derivation boundaries or a researcher testing edge-case grammars, GrammarFlow provides a robust, zero-dependency environment to resolve CFG structures directly in your browser.

---

## ✨ Key Features
*   **Interactive Playback Engine**: Navigate through the simplification process using a "stepper" interface. Step back and forth or use auto-play to watch the algorithm evolve.
*   **Dynamic Dependency Tree**: Features a live SVG-based dependency graph that redraws as the grammar simplifies, helping you visualize symbol relationships and reachability.
*   **Diff-Aware Highlighting**: Newly added rules and identified target variables are subtly highlighted with green and blue accents to draw the eye without cluttering the interface.
*   **Integrated Practice Quiz**: Test your knowledge with a built-in interactive quiz module featuring real-world simplification problems and detailed explanations.
*   **Clean State Display**: Unlike traditional tools that cross out text, GrammarFlow maintains a "clean" main block showing the active grammar at every step, relying on secondary indicator pills to show history.
*   **Premium Glassmorphism UI**: A state-of-the-art dark mode dashboard centered around modern design principles (Inter/JetBrains Mono typography, vibrant gradients, and smooth micro-animations).
*   **Dual-Theme Support**: Easily toggle between a sleek dark-mode console and a high-contrast light theme.

---

## 🎛️ Input Formats
GrammarFlow allows users to define their CFGs with ease:

### 1. Dynamic Rule Builder
*   Enter a **Start Symbol** (e.g., `S`).
*   Add multiple production rows with ease.
*   Use standard notation: `A → aB | ε`.
*   Supports multiple alternatives separated by the `|` pipe symbol.

### 2. Sample Loaders
*   Use the "Load Sample" dropdown to instantly populate complex edge cases (e.g., transitive unit productions, deep nullability) to see the algorithm's power.

---

## 🚀 Installation & Usage
GrammarFlow is a strictly **zero-dependency** application. No servers, no `npm install`, and no complex setup required.

1.  Clone or download this repository.
2.  Open the root folder.
3.  Double-click `index.html` to launch the application in any modern web browser (Chrome, Edge, Firefox, Safari).

---

## 🧠 Simplification Methodology
GrammarFlow follows a strict mathematical pipeline to ensure the resulting grammar is equivalent to the original:

1.  **Null Termination**: Recursively identifies all nullable variables and generates the powerset of productions to eliminate `ε` while preserving the language.
2.  **Unit Substitution**: Computes unit closures (A ⇒* B) and substitutes non-unit productions to bypass single-variable jumps.
3.  **Useless Symbol Cleanup**: 
    *   **Generating Pass**: Retains symbols that can eventually derive a terminal string.
    *   **Reachable Pass**: Retains symbols reachable from the Start Symbol.

---

## 🛠️ Tech Stack
*   **HTML5**: Semantic structure for accessibility.
*   **Vanilla CSS3**: Custom property-driven design system with glassmorphic effects.
*   **Native JavaScript (ES6+)**: Custom-built playback engine and SVG graph layout algorithm.
*   **SVG**: For high-performance, scalable dependency tree rendering.
