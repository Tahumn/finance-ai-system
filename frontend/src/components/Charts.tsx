import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { clamp } from '../utils/format';

type LineChartProps = {
  data: number[];
  width: number;
  height: number;
  stroke: string;
  strokeWidth?: number;
};

const buildLinePath = (data: number[], width: number, height: number, min: number, max: number) => {
  const range = max - min || 1;
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

export const LineChart = ({ data, width, height, stroke, strokeWidth = 3 }: LineChartProps) => {
  if (!data.length) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const path = buildLinePath(data, width, height, min, max);

  return (
    <Svg width={width} height={height}>
      <Path d={path} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
};

type DualLineChartProps = {
  incomeData: number[];
  expenseData: number[];
  width: number;
  height: number;
  incomeStroke: string;
  expenseStroke: string;
  strokeWidth?: number;
};

export const DualLineChart = ({
  incomeData,
  expenseData,
  width,
  height,
  incomeStroke,
  expenseStroke,
  strokeWidth = 3,
}: DualLineChartProps) => {
  const pointCount = Math.max(incomeData.length, expenseData.length);
  if (!pointCount) {
    return null;
  }

  const normalizedIncome = Array.from({ length: pointCount }, (_, index) => incomeData[index] || 0);
  const normalizedExpense = Array.from({ length: pointCount }, (_, index) => expenseData[index] || 0);
  const domain = [...normalizedIncome, ...normalizedExpense];
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const incomePath = buildLinePath(normalizedIncome, width, height, min, max);
  const expensePath = buildLinePath(normalizedExpense, width, height, min, max);

  return (
    <Svg width={width} height={height}>
      <Path d={incomePath} fill="none" stroke={incomeStroke} strokeWidth={strokeWidth} />
      <Path d={expensePath} fill="none" stroke={expenseStroke} strokeWidth={strokeWidth} />
    </Svg>
  );
};

type DonutSegment = {
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
};

export const DonutChart = ({ segments, size = 120, thickness = 14 }: DonutChartProps) => {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  const radius = size / 2 - thickness;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {segments.map((segment, index) => {
          const value = clamp(segment.value, 0, total);
          const length = (value / total) * circumference;
          const dashArray = `${length} ${circumference - length}`;
          const offset = -(cumulative / total) * circumference;
          cumulative += value;
          return (
            <Circle
              key={`${segment.color}-${index}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={dashArray}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="transparent"
            />
          );
        })}
      </G>
    </Svg>
  );
};
