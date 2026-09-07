import { useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { xml as xmlLang } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import TreeView from "./components/TreeView";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/xml-formatter";

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Checking for a <parsererror> element is the one universal,
// spec-guaranteed way to detect a parse failure (parseFromString never
// throws) — but the *text* of that element is not standardized across
// engines, so unlike the JSON/YAML tools this doesn't try to extract a
// "line X, column Y" out of it; the browser's own message (often already
// describing the location in its own words) is shown as-is.
function parseXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");
  const perr = doc.querySelector("parsererror");
  if (perr) throw new Error(perr.textContent.trim());
  return doc;
}

function prettyPrintXml(doc, indentSize) {
  const pad = " ".repeat(indentSize);
  function serialize(node, depth) {
    if (node.nodeType === Node.COMMENT_NODE) return `${pad.repeat(depth)}<!--${node.textContent}-->\n`;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const attrs = Array.from(node.attributes || []).map((a) => ` ${a.name}="${a.value}"`).join("");
    const children = Array.from(node.childNodes).filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
    if (children.length === 0) return `${pad.repeat(depth)}<${node.tagName}${attrs}/>\n`;
    const onlyText = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
    if (onlyText) return `${pad.repeat(depth)}<${node.tagName}${attrs}>${escapeText(children[0].textContent.trim())}</${node.tagName}>\n`;
    let out = `${pad.repeat(depth)}<${node.tagName}${attrs}>\n`;
    for (const child of children) out += serialize(child, depth + 1);
    out += `${pad.repeat(depth)}</${node.tagName}>\n`;
    return out;
  }
  return serialize(doc.documentElement, 0).trim();
}

function minifyXml(doc) {
  function serialize(node) {
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.textContent}-->`;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const attrs = Array.from(node.attributes || []).map((a) => ` ${a.name}="${a.value}"`).join("");
    const children = Array.from(node.childNodes).filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
    if (children.length === 0) return `<${node.tagName}${attrs}/>`;
    const onlyText = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
    if (onlyText) return `<${node.tagName}${attrs}>${escapeText(children[0].textContent.trim())}</${node.tagName}>`;
    return `<${node.tagName}${attrs}>${children.map(serialize).join("")}</${node.tagName}>`;
  }
  return serialize(doc.documentElement);
}

// Converted to a plain-object shape (@attributes, #text, repeated tags
// become arrays) so the same generic TreeView used by JSON/YAML can render
// it too — repeated sibling tags correctly collapse into an array, a leaf
// element's text lands under #text.
function elementToPlain(el) {
  const obj = {};
  if (el.attributes && el.attributes.length) {
    obj["@attributes"] = Object.fromEntries(Array.from(el.attributes).map((a) => [a.name, a.value]));
  }
  const children = Array.from(el.children);
  if (children.length === 0) {
    const text = el.textContent?.trim();
    if (text) obj["#text"] = text;
  } else {
    for (const child of children) {
      const childValue = elementToPlain(child);
      if (obj[child.tagName] === undefined) obj[child.tagName] = childValue;
      else if (Array.isArray(obj[child.tagName])) obj[child.tagName].push(childValue);
      else obj[child.tagName] = [obj[child.tagName], childValue];
    }
  }
  return obj;
}

function xmlToPlainObject(doc) {
  const root = doc.documentElement;
  return { [root.tagName]: elementToPlain(root) };
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const cmExtensions = [xmlLang(), EditorView.lineWrapping];

const styles = {
  root: { height: "100dvh", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "20px 24px", flex: 1, minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--bg-subtle, #f0efed)" },
  header: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text, #1a1a1a)" },
  subtitle: { fontSize: 13, opacity: 0.55, margin: "4px 0 0", color: "var(--text, #1a1a1a)" },
  body: { display: "flex", gap: 16, flex: 1, minHeight: 0, minWidth: 0 },
  pane: { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 },
  paneHeader: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text, #1a1a1a)" },
  paneHeaderActions: { display: "flex", gap: 6, alignItems: "center" },
  iconBtn: {
    padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "transparent",
    color: "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 11, textTransform: "none", fontWeight: 400,
  },
  editorWrap: { flex: 1, minHeight: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border, #e5e7eb)" },
  statusBar: { fontSize: 11, opacity: 0.5, marginTop: 6, color: "var(--text, #1a1a1a)" },
  empty: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 13,
    border: "1px dashed var(--border, #e5e7eb)", borderRadius: 8, color: "var(--text, #1a1a1a)",
  },
  errorBox: {
    flex: 1, padding: 16, borderRadius: 8, border: "1px solid #e05c5c", background: "rgba(224,92,92,0.08)",
    color: "#e05c5c", fontSize: 13, fontFamily: "'SFMono-Regular', Consolas, monospace", whiteSpace: "pre-wrap", overflow: "auto",
  },
  validBox: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600,
    color: "#3fb950", border: "1px solid #3fb950", borderRadius: 8, background: "rgba(63,185,80,0.08)",
  },
  rail: { display: "flex", flexDirection: "column", gap: 10, width: 168, flexShrink: 0 },
  btn: (kind) => ({
    padding: "10px 14px", borderRadius: 6, border: kind === "primary" ? "none" : "1px solid var(--border, #e5e7eb)",
    background: kind === "primary" ? "var(--accent, #4f46e5)" : "transparent",
    color: kind === "primary" ? "#fff" : "var(--text, #1a1a1a)",
    cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%",
  }),
  select: {
    padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "var(--input-bg, #f9fafb)",
    color: "var(--text, #1a1a1a)", fontSize: 13, width: "100%",
  },
  railDivider: { height: 1, background: "var(--border, #e5e7eb)", margin: "2px 0" },
  viewToggle: { display: "flex", border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, overflow: "hidden" },
  viewToggleBtn: (active) => ({
    padding: "2px 10px", border: "none", background: active ? "var(--accent, #4f46e5)" : "transparent",
    color: active ? "#fff" : "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 11,
  }),
};

export default function App() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [treeValue, setTreeValue] = useState(undefined);
  const [viewMode, setViewMode] = useState("code");
  const [error, setError] = useState(null);
  const [valid, setValid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indentOption, setIndentOption] = useState("2");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const fileInputRef = useRef(null);

  function resetResult() {
    setError(null);
    setValid(false);
    setOutput("");
    setTreeValue(undefined);
  }

  function format(mode) {
    if (!input.trim()) {
      resetResult();
      return;
    }
    try {
      const doc = parseXml(input);
      setOutput(mode === "minify" ? minifyXml(doc) : prettyPrintXml(doc, Number(indentOption)));
      setTreeValue(xmlToPlainObject(doc));
      setViewMode("code");
      setError(null);
      setValid(false);
    } catch (e) {
      setOutput("");
      setTreeValue(undefined);
      setValid(false);
      setError({ message: e.message });
    }
  }

  // A direct rail action, not just a toggle that only appears once Format
  // has already been clicked (see App.jsx in json-formatter for the same fix).
  function showTree() {
    if (!input.trim()) {
      resetResult();
      return;
    }
    try {
      const doc = parseXml(input);
      setOutput(prettyPrintXml(doc, Number(indentOption)));
      setTreeValue(xmlToPlainObject(doc));
      setViewMode("tree");
      setError(null);
      setValid(false);
    } catch (e) {
      setOutput("");
      setTreeValue(undefined);
      setValid(false);
      setError({ message: e.message });
    }
  }

  function validate() {
    if (!input.trim()) {
      resetResult();
      return;
    }
    try {
      parseXml(input);
      setOutput("");
      setError(null);
      setValid(true);
    } catch (e) {
      setOutput("");
      setValid(false);
      setError({ message: e.message });
    }
  }

  function clearAll() {
    setInput("");
    resetResult();
  }

  function copyOutput() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setInput(String(reader.result || ""));
      resetResult();
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCursorUpdate(viewUpdate) {
    if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
    const head = viewUpdate.state.selection.main.head;
    const line = viewUpdate.state.doc.lineAt(head);
    setCursor({ line: line.number, col: head - line.from + 1 });
  }

  return (
    <div style={styles.root}>
      <Header repoUrl={REPO_URL} />
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>XML Formatter &amp; Validator</h1>
          <p style={styles.subtitle}>Paste or upload XML, format/minify/validate it, or view it as a tree. Nothing leaves your browser.</p>
        </div>

        <div style={styles.body}>
          <div style={styles.pane}>
            <div style={styles.paneHeader}>
              <span>Input</span>
            </div>
            <div style={styles.editorWrap}>
              <CodeMirror
                value={input}
                height="100%"
                theme={oneDark}
                extensions={cmExtensions}
                onChange={(value) => setInput(value)}
                onUpdate={handleCursorUpdate}
                placeholder="Paste XML here..."
                style={{ height: "100%", fontSize: 13 }}
              />
            </div>
            <div style={styles.statusBar}>Ln {cursor.line}, Col {cursor.col}</div>
            <input ref={fileInputRef} type="file" accept=".xml,.txt,application/xml,text/xml" style={{ display: "none" }} onChange={handleFileChosen} />
          </div>

          <div style={styles.rail}>
            <button style={styles.btn("secondary")} onClick={handleUploadClick}>Upload Data</button>
            <button style={styles.btn("secondary")} onClick={validate}>Validate</button>
            <div style={styles.railDivider} />
            <select style={styles.select} value={indentOption} onChange={(e) => setIndentOption(e.target.value)}>
              <option value="2">2 space indent</option>
              <option value="4">4 space indent</option>
            </select>
            <button style={styles.btn("primary")} onClick={() => format("pretty")}>Format / Beautify</button>
            <button style={styles.btn("secondary")} onClick={() => format("minify")}>Minify / Compact</button>
            <button style={styles.btn("secondary")} onClick={showTree}>Tree View</button>
            <div style={styles.railDivider} />
            <button style={styles.btn("secondary")} onClick={() => downloadText("formatted.xml", output || input)}>Download</button>
            <button style={styles.btn("secondary")} onClick={clearAll}>Clear</button>
          </div>

          <div style={styles.pane}>
            <div style={styles.paneHeader}>
              <span>Output</span>
              <div style={styles.paneHeaderActions}>
                {output && (
                  <div style={styles.viewToggle}>
                    <button style={styles.viewToggleBtn(viewMode === "code")} onClick={() => setViewMode("code")}>Code</button>
                    <button style={styles.viewToggleBtn(viewMode === "tree")} onClick={() => setViewMode("tree")}>Tree</button>
                  </div>
                )}
                {output && viewMode === "code" && (
                  <button style={styles.iconBtn} onClick={copyOutput}>{copied ? "Copied" : "Copy"}</button>
                )}
              </div>
            </div>
            {error ? (
              <div style={styles.errorBox}>Invalid XML{"\n\n"}{error.message}</div>
            ) : valid ? (
              <div style={styles.validBox}>Valid XML</div>
            ) : output && viewMode === "tree" ? (
              <div style={styles.editorWrap}>
                <TreeView data={treeValue} />
              </div>
            ) : output ? (
              <div style={styles.editorWrap}>
                <CodeMirror value={output} height="100%" theme={oneDark} extensions={cmExtensions} editable={false} readOnly style={{ height: "100%", fontSize: 13 }} />
              </div>
            ) : (
              <div style={styles.empty}>Formatted output will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
