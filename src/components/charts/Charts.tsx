import React from 'react';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Txt } from '../ui/Txt';
import { colors, fonts } from '../../theme/tokens';

export interface Datum {
  label: string;
  /** null = no data recorded for this bucket. Shown as a gap, never filled in. */
  value: number | null;
}

interface ChartProps {
  data: Datum[];
  height?: number;
  color?: string;
  goal?: number | null;
  format?: (v: number) => string;
  /** Fixed y range; defaults to 0..max. */
  min?: number;
  max?: number;
}

const PAD_TOP = 16;
const PAD_BOTTOM = 22;

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

function labelStep(n: number) {
  if (n <= 8) return 1;
  if (n <= 16) return 2;
  if (n <= 31) return 5;
  return Math.ceil(n / 6);
}

function NoData() {
  return (
    <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
      <Txt variant="caption" tone="muted">
        Nothing recorded in this period
      </Txt>
    </View>
  );
}

export function BarChart({ data, height = 150, color = colors.moss, goal, format }: ChartProps) {
  const { width, onLayout } = useWidth();
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (values.length === 0) return <NoData />;
  const top = Math.max(...values, goal ?? 0) * 1.1 || 1;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const slot = width / data.length;
  const barW = Math.max(3, Math.min(26, slot * 0.6));
  const step = labelStep(data.length);
  const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH;

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`Bar chart, ${values.length} of ${data.length} periods with data`}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke={colors.stone} strokeWidth={1} />
          {goal ? (
            <>
              <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={colors.taupe} strokeWidth={1} strokeDasharray="4 4" />
              <SvgText x={width - 2} y={y(goal) - 4} fontSize={10} fill={colors.muted} textAnchor="end" fontFamily={fonts.body}>
                Goal {format ? format(goal) : Math.round(goal)}
              </SvgText>
            </>
          ) : null}
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            return (
              <React.Fragment key={i}>
                {d.value === null ? (
                  <Line x1={cx - barW / 2} x2={cx + barW / 2} y1={PAD_TOP + plotH - 2} y2={PAD_TOP + plotH - 2} stroke={colors.stone} strokeWidth={2} strokeDasharray="2 2" />
                ) : (
                  <Rect x={cx - barW / 2} y={y(d.value)} width={barW} height={Math.max(2, PAD_TOP + plotH - y(d.value))} rx={Math.min(6, barW / 2)} fill={color} />
                )}
                {i % step === 0 ? (
                  <SvgText x={cx} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle" fontFamily={fonts.body}>
                    {d.label}
                  </SvgText>
                ) : null}
              </React.Fragment>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

export function LineChart({ data, height = 150, color = colors.ink, goal, format, min, max }: ChartProps) {
  const { width, onLayout } = useWidth();
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (values.length === 0) return <NoData />;
  const lo = min ?? Math.min(...values, goal ?? Infinity);
  const hi = max ?? Math.max(...values, goal ?? -Infinity);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  const bottom = min ?? lo - span * 0.15;
  const topV = max ?? hi + span * 0.15;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - 16) + 8);
  const y = (v: number) => PAD_TOP + plotH - ((v - bottom) / (topV - bottom)) * plotH;
  const step = labelStep(data.length);

  // Break the line wherever data is missing.
  const segments: string[] = [];
  let current = '';
  data.forEach((d, i) => {
    if (d.value === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)} `;
  });
  if (current) segments.push(current);

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={`Line chart, ${values.length} readings`}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke={colors.stone} strokeWidth={1} />
          {goal ? <Line x1={0} x2={width} y1={y(goal)} y2={y(goal)} stroke={colors.taupe} strokeWidth={1} strokeDasharray="4 4" /> : null}
          <SvgText x={2} y={PAD_TOP - 4} fontSize={10} fill={colors.muted} fontFamily={fonts.body}>
            {format ? format(hi) : Math.round(hi)}
          </SvgText>
          {segments.map((d, i) => (
            <Path key={i} d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {data.map((d, i) =>
            d.value === null ? null : <Circle key={`p${i}`} cx={x(i)} cy={y(d.value)} r={3} fill={colors.paper} stroke={color} strokeWidth={2} />,
          )}
          {data.map((d, i) =>
            i % step === 0 ? (
              <SvgText key={`l${i}`} x={x(i)} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle" fontFamily={fonts.body}>
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
