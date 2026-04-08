import { Body, Head, Html, Preview } from "@react-email/components";
import * as React from "react";

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

interface EmailShellProps {
  previewText: string;
  footerReason: string;
  children: React.ReactNode;
}

export function EmailShell({ previewText, footerReason, children }: EmailShellProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{`
          @media only screen and (max-width: 400px) {
            .tile-cell { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 8px !important; }
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#F7F7F5", fontFamily: font, margin: "0", padding: "0" }}>
        <table
          cellPadding="0"
          cellSpacing="0"
          role="presentation"
          style={{ width: "100%", backgroundColor: "#F7F7F5" }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "40px 24px" }}>
                <table
                  cellPadding="0"
                  cellSpacing="0"
                  role="presentation"
                  style={{
                    maxWidth: "560px",
                    width: "100%",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E8E8E6",
                    borderRadius: "12px",
                  }}
                >
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={{ padding: "16px 24px", borderBottom: "1px solid #E8E8E6" }}>
                        <table cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  backgroundColor: "#6C63FF",
                                  borderRadius: "7px",
                                  textAlign: "center",
                                  verticalAlign: "middle",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: "13px",
                                    fontWeight: "700",
                                    lineHeight: "28px",
                                    fontFamily: font,
                                  }}
                                >
                                  ✓
                                </span>
                              </td>
                              <td style={{ paddingLeft: "10px", verticalAlign: "middle" }}>
                                <span
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: "600",
                                    color: "#1A1A1A",
                                    fontFamily: font,
                                  }}
                                >
                                  HTML Review
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ padding: "28px" }}>{children}</td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ padding: "16px 24px", borderTop: "1px solid #E8E8E6" }}>
                        <span style={{ fontSize: "12px", color: "#BBBBBB", fontFamily: font }}>
                          {footerReason}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#BBBBBB",
                    textAlign: "center",
                    margin: "20px 0 0",
                    fontFamily: font,
                  }}
                >
                  HTML Review · htmlreview.com
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}
