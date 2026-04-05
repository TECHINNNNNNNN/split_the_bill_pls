"use client";

import { useState } from "react";
import { scaleLinear, scalePoint } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { curveCardinal } from "@visx/curve";
import { Group } from "@visx/group";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { motion } from "motion/react";

interface TrendChartProps {
  data: { label: string; amount: number }[];
  height?: number;
}

const margin = { top: 20, right: 16, bottom: 36, left: 44 };

export function TrendChart({ data, height = 180 }: TrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const width = 360; // SVG coordinate width — responsive via viewBox

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xScale = scalePoint({
    domain: data.map(d => d.label),
    range: [0, innerWidth],
    padding: 0.1,
  });

  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const yScale = scaleLinear({
    domain: [0, maxVal * 1.15], // 15% headroom for tooltip
    range: [innerHeight, 0],
    nice: true,
  });

  // Estimate total path length for draw animation
  const pathLen = data.length * 80;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: `${height}px`, maxHeight: `${height}px` }}
      onClick={() => setSelectedIndex(null)}
    >
      <Group left={margin.left} top={margin.top}>
        {/* Y-axis gridlines */}
        {yScale.ticks(3).map((tick) => (
          <line
            key={tick}
            x1={0}
            y1={yScale(tick)}
            x2={innerWidth}
            y2={yScale(tick)}
            stroke="#e0ccb0"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Y-axis labels */}
        <AxisLeft
          scale={yScale}
          numTicks={3}
          stroke="none"
          tickStroke="none"
          tickFormat={(v) => {
            const n = v as number;
            return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;
          }}
          tickLabelProps={() => ({
            fill: "#b08a56",
            fontSize: 9,
            fontFamily: "system-ui",
            textAnchor: "end" as const,
            dx: -4,
            dy: 3,
          })}
          hideAxisLine
          hideTicks
        />

        {/* The organic curved line */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <LinePath
            data={data}
            x={(d) => xScale(d.label) ?? 0}
            y={(d) => yScale(d.amount)}
            curve={curveCardinal.tension(0.6)}
            stroke="#C4956A"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            // Animate the line drawing
            style={{
              strokeDasharray: pathLen,
              strokeDashoffset: 0,
              animation: `drawLine 1.2s ease-out forwards`,
            }}
          />
        </motion.g>

        {/* Dots — tappable */}
        {data.map((d, i) => {
          const cx = xScale(d.label) ?? 0;
          const cy = yScale(d.amount);
          const isSelected = selectedIndex === i;

          return (
            <g
              key={d.label}
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(isSelected ? null : i); }}
              style={{ cursor: "pointer" }}
            >
              {/* Invisible hit area for touch */}
              <circle cx={cx} cy={cy} r={16} fill="transparent" />

              {/* Visible dot */}
              <motion.circle
                cx={cx}
                cy={cy}
                r={isSelected ? 6 : 3.5}
                fill={isSelected ? "#C4956A" : "#f5f0eb"}
                stroke="#C4956A"
                strokeWidth={2}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.04, duration: 0.25 }}
              />
            </g>
          );
        })}

        {/* Tooltip on selected dot */}
        {selectedIndex !== null && data[selectedIndex] && (() => {
          const d = data[selectedIndex];
          const cx = xScale(d.label) ?? 0;
          const cy = yScale(d.amount);
          const tooltipW = 68;
          const tooltipH = 22;
          const showBelow = cy - 30 < 0;
          const tooltipY = showBelow ? cy + 14 : cy - 32;
          const textY = showBelow ? cy + 28 : cy - 17;
          const tooltipX = Math.max(0, Math.min(cx - tooltipW / 2, innerWidth - tooltipW));
          const textX = tooltipX + tooltipW / 2;

          return (
            <g>
              {/* Vertical guide */}
              <line
                x1={cx} y1={0} x2={cx} y2={innerHeight}
                stroke="#C4956A" strokeWidth={1} strokeDasharray="3 3" opacity={0.3}
              />
              {/* Tooltip bg */}
              <rect
                x={tooltipX} y={tooltipY}
                width={tooltipW} height={tooltipH}
                rx={8} fill="#3d2810" opacity={0.92}
              />
              {/* Tooltip text */}
              <text
                x={textX} y={textY}
                textAnchor="middle" fill="#faf7f3"
                fontSize={11} fontWeight={700} fontFamily="system-ui"
              >
                ฿{d.amount >= 1000 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount.toFixed(0)}
              </text>
            </g>
          );
        })()}

        {/* X-axis labels */}
        <AxisBottom
          scale={xScale}
          top={innerHeight}
          stroke="none"
          tickStroke="none"
          tickLabelProps={(label) => ({
            fill: selectedIndex !== null && data[selectedIndex]?.label === label ? "#3d2810" : "#b08a56",
            fontSize: 9,
            fontWeight: selectedIndex !== null && data[selectedIndex]?.label === label ? 700 : 400,
            fontFamily: "system-ui",
            textAnchor: "middle" as const,
            dy: 4,
          })}
          hideAxisLine
          hideTicks
        />
      </Group>

      {/* CSS animation for line draw-in */}
      <style>{`
        @keyframes drawLine {
          from { stroke-dashoffset: ${pathLen}; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}
