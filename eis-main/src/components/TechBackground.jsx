import React from "react";

/**
 * Dark tech background with glowing blue interconnected node network.
 * Matches the ProductPrime registration/login design spec.
 */
export default function TechBackground() {
  // Pre-computed node positions and connections for the network graph
  const nodes = [
    { x: 50, y: 40 }, { x: 150, y: 90 }, { x: 280, y: 50 }, { x: 400, y: 120 },
    { x: 120, y: 200 }, { x: 250, y: 260 }, { x: 380, y: 220 }, { x: 500, y: 300 },
    { x: 80, y: 350 }, { x: 200, y: 420 }, { x: 350, y: 380 }, { x: 480, y: 450 },
    { x: 150, y: 500 }, { x: 300, y: 550 }, { x: 450, y: 520 }, { x: 550, y: 600 },
    { x: 30, y: 600 }, { x: 250, y: 650 }, { x: 400, y: 700 }, { x: 550, y: 750 },
    { x: 100, y: 750 }, { x: 300, y: 100 }, { x: 500, y: 60 }, { x: 600, y: 200 },
    { x: 600, y: 400 }, { x: 600, y: 600 }, { x: 50, y: 250 }, { x: 480, y: 650 },
  ];

  const connections = [
    [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5],
    [5, 6], [6, 7], [4, 8], [5, 9], [6, 10], [7, 11], [8, 9], [9, 10],
    [10, 11], [8, 12], [9, 13], [10, 14], [11, 15], [12, 13], [13, 14],
    [14, 15], [12, 16], [13, 17], [14, 18], [15, 19], [16, 17], [17, 18],
    [18, 19], [16, 20], [17, 21], [18, 22], [19, 23], [20, 21], [21, 22],
    [22, 23], [1, 21], [3, 21], [21, 24], [24, 18], [24, 25], [25, 19],
    [25, 23], [26, 0], [26, 4], [26, 8], [27, 15], [27, 19], [27, 25],
  ];

  return (
    <>
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, #0c3050 0%, #061a2e 40%, #020e1a 80%, #010810 100%)",
        }}
      />
      {/* Glowing orbs */}
      <div
        className="absolute top-[15%] left-[20%] w-80 h-80 rounded-full blur-3xl"
        style={{ background: "rgba(0, 160, 220, 0.18)" }}
      />
      <div
        className="absolute bottom-[10%] right-[15%] w-96 h-96 rounded-full blur-3xl"
        style={{ background: "rgba(0, 120, 200, 0.14)" }}
      />
      <div
        className="absolute top-[50%] right-[30%] w-64 h-64 rounded-full blur-3xl"
        style={{ background: "rgba(20, 100, 180, 0.12)" }}
      />
      {/* Node network SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 600 800"
        style={{ opacity: 0.5 }}
      >
        {/* Connections */}
        {connections.map(([a, b], i) => (
          <line
            key={`line-${i}`}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="rgba(0, 180, 255, 0.15)"
            strokeWidth="1"
          />
        ))}
        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={`node-${i}`}>
            <circle
              cx={n.x}
              cy={n.y}
              r="3"
              fill="rgba(0, 200, 255, 0.6)"
            />
            <circle
              cx={n.x}
              cy={n.y}
              r="8"
              fill="rgba(0, 200, 255, 0.08)"
            />
          </g>
        ))}
      </svg>
    </>
  );
}
