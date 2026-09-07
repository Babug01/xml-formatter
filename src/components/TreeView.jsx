import { useState } from "react";

// Works on any plain JS value — object/array/primitive. JSON.parse() and
// yaml.parse() both produce exactly this shape, so this one component covers
// both. XML pages convert their DOM tree into the same plain-object shape
// (see xmlToPlainObject in XmlTool.jsx) before handing it to this component,
// rather than this component needing to know anything about XML at all.

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

const typeColor = {
  string: "#98c379",
  number: "#d19a66",
  boolean: "#56b6c2",
  null: "#7f848e",
  undefined: "#7f848e",
};

function Leaf({ value, type }) {
  if (type === "string") return <span style={{ color: typeColor.string }}>"{value}"</span>;
  if (type === "null" || type === "undefined") return <span style={{ color: typeColor.null }}>{type}</span>;
  return <span style={{ color: typeColor[type] || "inherit" }}>{String(value)}</span>;
}

function Node({ label, value, depth }) {
  const type = typeOf(value);
  const isBranch = type === "object" || type === "array";
  const [collapsed, setCollapsed] = useState(false);

  if (!isBranch) {
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        {label != null && <span style={{ opacity: 0.65 }}>{label}: </span>}
        <Leaf value={value} type={type} />
      </div>
    );
  }

  const entries = type === "array" ? value.map((v, i) => [i, v]) : Object.entries(value);
  const [open, close] = type === "array" ? ["[", "]"] : ["{", "}"];
  const count = entries.length;

  return (
    <div>
      <div style={{ paddingLeft: depth * 16, cursor: "pointer", userSelect: "none" }} onClick={() => setCollapsed((c) => !c)}>
        <span style={{ display: "inline-block", width: 12, opacity: 0.55, fontSize: 10 }}>{collapsed ? "▶" : "▼"}</span>
        {label != null && <span style={{ opacity: 0.65 }}>{label}: </span>}
        <span style={{ opacity: 0.5 }}>
          {open}
          {collapsed ? ` ${count} item${count === 1 ? "" : "s"} ${close}` : ""}
        </span>
      </div>
      {!collapsed && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} label={type === "array" ? null : k} value={v} depth={depth + 1} />
          ))}
          <div style={{ paddingLeft: depth * 16, opacity: 0.5 }}>{close}</div>
        </>
      )}
    </div>
  );
}

export default function TreeView({ data }) {
  return (
    <div style={{ padding: 12, overflow: "auto", height: "100%", fontFamily: "'SFMono-Regular', Consolas, monospace", fontSize: 13, lineHeight: 1.7 }}>
      <Node label={null} value={data} depth={0} />
    </div>
  );
}
