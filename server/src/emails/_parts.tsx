import * as React from "react";
import { font } from "./_shell";

/* ── Badge + heading row ── */
export function Badge({
  bg,
  fg,
  symbol,
  label,
}: {
  bg: string;
  fg: string;
  symbol: string;
  label: string;
}) {
  return (
    <table
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ marginBottom: "20px" }}
    >
      <tbody>
        <tr>
          <td
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: bg,
              borderRadius: "5px",
              textAlign: "center",
              verticalAlign: "middle",
            }}
          >
            <span
              style={{ color: fg, fontSize: "11px", fontWeight: "700", lineHeight: "20px", fontFamily: font }}
            >
              {symbol}
            </span>
          </td>
          <td style={{ paddingLeft: "8px", verticalAlign: "middle" }}>
            <span
              style={{ fontSize: "13px", fontWeight: "500", color: "#888888", fontFamily: font, letterSpacing: "-0.02em" }}
            >
              {label}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Avatar + actor name + description ── */
export function Actor({ name, description }: { name: string; description: string }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <table
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ width: "100%", marginBottom: "20px" }}
    >
      <tbody>
        <tr>
          <td style={{ width: "52px", verticalAlign: "top" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: "#F0EFFF",
                textAlign: "center",
                lineHeight: "40px",
                fontSize: "15px",
                fontWeight: "600",
                color: "#6C63FF",
                fontFamily: font,
              }}
            >
              {initial}
            </div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#1A1A1A", marginBottom: "4px", fontFamily: font }}>
              {name}
            </div>
            <div style={{ fontSize: "13px", color: "#999999", lineHeight: "1.5", fontFamily: font }}>
              {description}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Comment snippet block ── */
export function Snippet({ text }: { text: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FAFAF8",
        border: "1px solid #E8E8E6",
        borderRadius: "10px",
        padding: "16px 18px",
        marginBottom: "20px",
      }}
    >
      <p style={{ fontSize: "14px", color: "#444444", margin: "0", lineHeight: "1.6", fontFamily: font }}>
        {text}
      </p>
    </div>
  );
}

/* ── Project tile (single) ── */
export function ProjectTile({ name }: { name: string }) {
  return (
    <div
      style={{
        backgroundColor: "#FAFAF8",
        border: "1px solid #E8E8E6",
        borderRadius: "10px",
        padding: "14px 16px",
        marginBottom: "20px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: "500", color: "#999999", marginBottom: "4px", fontFamily: font }}>
        Project
      </div>
      <div style={{ fontSize: "15px", fontWeight: "600", color: "#1A1A1A", fontFamily: font }}>
        {name}
      </div>
    </div>
  );
}

/* ── Full-width CTA button ── */
export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <table cellPadding="0" cellSpacing="0" role="presentation" style={{ width: "100%" }}>
      <tbody>
        <tr>
          <td style={{ backgroundColor: "#1A1A1A", borderRadius: "10px", textAlign: "center" }}>
            <a
              href={href}
              style={{
                display: "block",
                padding: "12px 24px",
                color: "#FFFFFF",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
                letterSpacing: "-0.01em",
                fontFamily: font,
              }}
            >
              {label} →
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
