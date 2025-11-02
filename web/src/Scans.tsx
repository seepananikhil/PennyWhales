import React, { useState, useEffect } from "react";
import api from "./api";
import { ScanStatus } from "./types";
import { theme } from "./theme";

const Scans: React.FC = () => {
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadScanStatus();

    // Auto-refresh scan status every 2 seconds when scanning
    const interval = setInterval(() => {
      if (scanStatus?.scanning) {
        loadScanStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [scanStatus?.scanning]);

  const loadScanStatus = async () => {
    try {
      const status = await api.getScanStatus();
      setScanStatus(status);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError("Failed to load scan status");
      console.error("Error loading scan status:", err);
    }
  };

  const handleStartScan = async (scanType: "full" | "daily") => {
    if (scanStatus?.scanning) {
      setError("A scan is already in progress");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result =
        scanType === "full"
          ? await api.startScan()
          : await api.startDailyScan();

      if (result.success) {
        // Immediately refresh status to show scanning state
        await loadScanStatus();
      } else {
        setError(result.message || "Failed to start scan");
      }
    } catch (err) {
      setError(`Failed to start ${scanType} scan`);
      console.error(`Error starting ${scanType} scan:`, err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor(
      (seconds % 3600) / 60
    )}m`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage < 30) return theme.status.warning;
    if (percentage < 70) return theme.status.info;
    return theme.status.success;
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: theme.typography.fontFamily,
      }}
    >
      {/* Header Section */}
      <div
        style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.ui.border}`,
          backgroundColor: theme.ui.surface,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: theme.spacing.md,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: theme.typography.fontSize.xxl,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.ui.text.primary,
            }}
          >
            🔍 Stock Scans
          </h1>
          <button
            onClick={loadScanStatus}
            disabled={loading}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.ui.background,
              color: theme.ui.text.primary,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              transition: `all ${theme.transition.normal}`,
              border: `1px solid ${theme.ui.border}`,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "🔄 Refreshing..." : "🔄 Refresh Status"}
          </button>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: theme.typography.fontSize.base,
            color: theme.ui.text.secondary,
            lineHeight: 1.5,
          }}
        >
          Start stock scans to analyze BlackRock and Vanguard holdings across
          your ticker list.
        </p>
      </div>

      {/* Content Section */}
      <div
        style={{
          flex: 1,
          padding: theme.spacing.lg,
          overflow: "auto",
        }}
      >
        {error && (
          <div
            style={{
              padding: theme.spacing.md,
              backgroundColor: "#f8d7da",
              color: "#721c24",
              borderRadius: theme.borderRadius.md,
              marginBottom: theme.spacing.lg,
              border: "1px solid #f5c6cb",
            }}
          >
            {error}
          </div>
        )}

        {/* Current Scan Status */}
        {scanStatus && (
          <div
            style={{
              backgroundColor: theme.ui.surface,
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.ui.border}`,
              padding: theme.spacing.lg,
              marginBottom: theme.spacing.lg,
              boxShadow: theme.ui.shadow.sm,
            }}
          >
            <h2
              style={{
                margin: `0 0 ${theme.spacing.md} 0`,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.ui.text.primary,
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.sm,
              }}
            >
              {scanStatus.scanning ? "⚡" : "✅"} Current Scan Status
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: theme.spacing.md,
                marginBottom: theme.spacing.lg,
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: theme.spacing.md,
                  backgroundColor: scanStatus.scanning
                    ? "#e3f2fd"
                    : theme.ui.background,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${
                    scanStatus.scanning ? "#2196f3" : theme.ui.border
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: scanStatus.scanning
                      ? "#1976d2"
                      : theme.ui.text.primary,
                  }}
                >
                  {scanStatus.scanning ? "SCANNING" : "IDLE"}
                </div>
                <div
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.ui.text.secondary,
                    fontWeight: theme.typography.fontWeight.medium,
                  }}
                >
                  Status
                </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: theme.spacing.md,
                  backgroundColor: theme.ui.background,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.ui.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.ui.text.primary,
                  }}
                >
                  {formatDate(scanStatus.last_scan)}
                </div>
                <div
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.ui.text.secondary,
                    fontWeight: theme.typography.fontWeight.medium,
                  }}
                >
                  Last Scan
                </div>
              </div>

              {scanStatus.progress && (
                <div
                  style={{
                    textAlign: "center",
                    padding: theme.spacing.md,
                    backgroundColor: theme.ui.background,
                    borderRadius: theme.borderRadius.md,
                    border: `1px solid ${theme.ui.border}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: getProgressColor(scanStatus.progress.percentage),
                    }}
                  >
                    {scanStatus.progress.current}/{scanStatus.progress.total}
                  </div>
                  <div
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.ui.text.secondary,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    Progress
                  </div>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {scanStatus.scanning && scanStatus.progress && (
              <div
                style={{
                  marginBottom: theme.spacing.md,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: theme.spacing.xs,
                  }}
                >
                  <span
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.medium,
                      color: theme.ui.text.primary,
                    }}
                  >
                    Scanning Progress
                  </span>
                  <span
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: getProgressColor(scanStatus.progress.percentage),
                    }}
                  >
                    {scanStatus.progress.percentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: theme.ui.background,
                    borderRadius: "4px",
                    overflow: "hidden",
                    border: `1px solid ${theme.ui.border}`,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${scanStatus.progress.percentage}%`,
                      backgroundColor: getProgressColor(
                        scanStatus.progress.percentage
                      ),
                      transition: "width 0.3s ease-in-out",
                      borderRadius: "3px",
                    }}
                  />
                </div>
              </div>
            )}

            {scanStatus.error && (
              <div
                style={{
                  padding: theme.spacing.sm,
                  backgroundColor: "#f8d7da",
                  color: "#721c24",
                  borderRadius: theme.borderRadius.sm,
                  fontSize: theme.typography.fontSize.sm,
                  border: "1px solid #f5c6cb",
                }}
              >
                <strong>Scan Error:</strong> {scanStatus.error}
              </div>
            )}
          </div>
        )}

        {/* Scan Actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: theme.spacing.lg,
          }}
        >
          {/* Daily Scan Card */}
          <div
            style={{
              backgroundColor: theme.ui.surface,
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.ui.border}`,
              padding: theme.spacing.lg,
              boxShadow: theme.ui.shadow.sm,
              transition: `all ${theme.transition.normal}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.md,
                marginBottom: theme.spacing.md,
              }}
            >
              <span style={{ fontSize: "32px" }}>⚡</span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.ui.text.primary,
                  }}
                >
                  Daily Scan
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.ui.text.secondary,
                  }}
                >
                  Quick update of recent changes
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: theme.ui.background,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
                border: `1px solid ${theme.ui.border}`,
              }}
            >
              <h4
                style={{
                  margin: `0 0 ${theme.spacing.sm} 0`,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.ui.text.primary,
                }}
              >
                What this does:
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: theme.spacing.md,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.ui.text.secondary,
                  lineHeight: 1.4,
                }}
              >
                <li>Scans only tickers added/changed today</li>
                <li>Quick holdings data refresh</li>
                <li>Updates fire levels for new data</li>
                <li>Faster execution</li>
                <li>Perfect for daily updates</li>
              </ul>
            </div>

            <button
              onClick={() => handleStartScan("daily")}
              disabled={loading || scanStatus?.scanning}
              style={{
                width: "100%",
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: scanStatus?.scanning
                  ? theme.ui.background
                  : theme.status.success,
                color: scanStatus?.scanning ? theme.ui.text.secondary : "white",
                cursor:
                  loading || scanStatus?.scanning ? "not-allowed" : "pointer",
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.semibold,
                transition: `all ${theme.transition.normal}`,
                opacity: loading || scanStatus?.scanning ? 0.6 : 1,
                border: `1px solid ${
                  scanStatus?.scanning ? theme.ui.border : theme.status.success
                }`,
              }}
              onMouseEnter={(e) => {
                if (!loading && !scanStatus?.scanning) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !scanStatus?.scanning) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {scanStatus?.scanning
                ? "⏳ Scan in Progress..."
                : "⚡ Start Daily Scan"}
            </button>
          </div>

          {/* Full Scan Card */}
          <div
            style={{
              backgroundColor: theme.ui.surface,
              borderRadius: theme.borderRadius.lg,
              border: `1px solid ${theme.ui.border}`,
              padding: theme.spacing.lg,
              boxShadow: theme.ui.shadow.sm,
              transition: `all ${theme.transition.normal}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.md,
                marginBottom: theme.spacing.md,
              }}
            >
              <span style={{ fontSize: "32px" }}>🚀</span>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.ui.text.primary,
                  }}
                >
                  Full Scan
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.ui.text.secondary,
                  }}
                >
                  Complete analysis of all tickers
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: theme.ui.background,
                borderRadius: theme.borderRadius.md,
                padding: theme.spacing.md,
                marginBottom: theme.spacing.md,
                border: `1px solid ${theme.ui.border}`,
              }}
            >
              <h4
                style={{
                  margin: `0 0 ${theme.spacing.sm} 0`,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.ui.text.primary,
                }}
              >
                What this does:
              </h4>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: theme.spacing.md,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.ui.text.secondary,
                  lineHeight: 1.4,
                }}
              >
                <li>Scans ALL tickers in your list</li>
                <li>Fetches latest BlackRock & Vanguard holdings</li>
                <li>Calculates fire levels (0-3)</li>
                <li>Updates complete database</li>
                <li>Takes longer but most comprehensive</li>
              </ul>
            </div>

            <button
              onClick={() => handleStartScan("full")}
              disabled={loading || scanStatus?.scanning}
              style={{
                width: "100%",
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: scanStatus?.scanning
                  ? theme.ui.background
                  : theme.status.info,
                color: scanStatus?.scanning ? theme.ui.text.secondary : "white",
                cursor:
                  loading || scanStatus?.scanning ? "not-allowed" : "pointer",
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.semibold,
                transition: `all ${theme.transition.normal}`,
                opacity: loading || scanStatus?.scanning ? 0.6 : 1,
                border: `1px solid ${
                  scanStatus?.scanning ? theme.ui.border : theme.status.info
                }`,
              }}
              onMouseEnter={(e) => {
                if (!loading && !scanStatus?.scanning) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = theme.ui.shadow.md;
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !scanStatus?.scanning) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {scanStatus?.scanning
                ? "⏳ Scan in Progress..."
                : "🚀 Start Full Scan"}
            </button>
          </div>
        </div>

        {/* Status Footer */}
        <div
          style={{
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            backgroundColor: theme.ui.background,
            borderRadius: theme.borderRadius.md,
            border: `1px solid ${theme.ui.border}`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: theme.typography.fontSize.xs,
              color: theme.ui.text.secondary,
            }}
          >
            Last status refresh: {lastRefresh.toLocaleTimeString()} •
            Auto-refreshing every 2 seconds during scan
          </p>
        </div>
      </div>
    </div>
  );
};

export default Scans;
