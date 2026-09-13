import { useEffect, useState } from 'react'
import type { AppliedCountPoint, Platform } from '../../../../shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'

const platformColor: Record<Platform, string> = {
  linkedin: '#0a66c2',
  naukri: '#4a90d9'
}

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

const WIDTH = 320
const HEIGHT = 160
const PADDING = 24

interface TrackerProps {
  refreshKey: number
}

function buildPath(
  points: AppliedCountPoint[],
  xScale: (t: number) => number,
  yScale: (c: number) => number
): string {
  return points
    .map((point, index) => {
      const x = xScale(new Date(point.fetchedAt).getTime())
      const y = yScale(point.count)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

export function Tracker({ refreshKey }: TrackerProps): React.JSX.Element {
  const [history, setHistory] = useState<AppliedCountPoint[]>([])

  useEffect(() => {
    void window.bojeno.getAppliedCountHistory().then(setHistory)
  }, [refreshKey])

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Applied counts over time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data yet — fetch applied counts to see the chart.
          </p>
        </CardContent>
      </Card>
    )
  }

  const times = history.map((point) => new Date(point.fetchedAt).getTime())
  const counts = history.map((point) => point.count)
  const timeMin = Math.min(...times)
  const timeMax = Math.max(...times)
  const countMin = 0
  const countMax = Math.max(...counts, 1)

  const xScale = (t: number): number =>
    timeMax === timeMin
      ? WIDTH / 2
      : PADDING + ((t - timeMin) / (timeMax - timeMin)) * (WIDTH - 2 * PADDING)
  const yScale = (c: number): number =>
    HEIGHT - PADDING - ((c - countMin) / (countMax - countMin)) * (HEIGHT - 2 * PADDING)

  const byPlatform: Record<Platform, AppliedCountPoint[]> = { linkedin: [], naukri: [] }
  for (const point of history) byPlatform[point.platform].push(point)

  const platformsWithData = (Object.keys(byPlatform) as Platform[]).filter(
    (platform) => byPlatform[platform].length > 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applied counts over time</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          <line
            x1={PADDING}
            y1={HEIGHT - PADDING}
            x2={WIDTH - PADDING}
            y2={HEIGHT - PADDING}
            stroke="var(--border)"
            strokeWidth={1}
          />
          {platformsWithData.map((platform) => (
            <g key={platform}>
              <path
                d={buildPath(byPlatform[platform], xScale, yScale)}
                fill="none"
                stroke={platformColor[platform]}
                strokeWidth={2}
              />
              {byPlatform[platform].map((point, index) => (
                <circle
                  key={index}
                  cx={xScale(new Date(point.fetchedAt).getTime())}
                  cy={yScale(point.count)}
                  r={3}
                  fill={platformColor[platform]}
                />
              ))}
            </g>
          ))}
        </svg>
        <div className="flex flex-wrap gap-4 text-sm">
          {platformsWithData.map((platform) => (
            <span key={platform} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: platformColor[platform] }}
              />
              {platformLabel[platform]} ({byPlatform[platform].at(-1)?.count})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
