#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GPS_ROOT = path.join(ROOT, "archive", "GPS tracks");
const MAP_STEPS_PATH = path.join(ROOT, "src", "data", "map-steps.json");
const OUTPUT_ROUTE_PATH = path.join(ROOT, "src", "data", "route.geojson");
const OUTPUT_TRACE_PATH = path.join(ROOT, "src", "data", "route-trace.geojson");

const MIN_DEDUPE_DISTANCE_KM = 0.02;
const DEDUPE_TIME_WINDOW_MS = 30 * 60 * 1000;

const SEGMENT_MIN_SPACING_KM = 1.2;
const SEGMENT_MAX_POINTS = 650;

const TRACE_MIN_SPACING_KM = 0.2;
const TRACE_MAX_POINTS = 9000;
const TRACE_BREAK_DISTANCE_KM = 260;
const TRACE_BREAK_TIME_GAP_MS = 18 * 60 * 60 * 1000;

function walkFiles(rootDir, predicate, out = []) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, out);
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function extractAttr(tagAttrs, attrName) {
  const regex = new RegExp(`${attrName}\\s*=\\s*"([^"]+)"`, "i");
  const match = regex.exec(tagAttrs);
  return match ? match[1] : null;
}

function extractTimeMs(block) {
  if (!block) return null;
  const match = /<time>([^<]+)<\/time>/i.exec(block);
  if (!match) return null;
  const parsed = Date.parse(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGpxPoints(xml) {
  const points = [];
  const pointRegex = /<(trkpt|rtept|wpt)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
  let match;
  while ((match = pointRegex.exec(xml)) !== null) {
    const pointType = String(match[1] ?? "").toLowerCase();
    const attrs = match[2] ?? "";
    const lat = Number(extractAttr(attrs, "lat"));
    const lng = Number(extractAttr(attrs, "lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    points.push({
      lat,
      lng,
      time: extractTimeMs(match[3]) ?? null,
      kind: pointType,
    });
  }
  return points;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function inferTimestampFromFilename(filePath) {
  const base = path.basename(filePath);
  const longStamp = /(\d{14})/.exec(base);
  if (longStamp) {
    const value = longStamp[1];
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
      6,
      8,
    )}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) return parsed;
  }

  const shortStamp = /(\d{8})/.exec(base);
  if (shortStamp) {
    const value = shortStamp[1];
    const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
      6,
      8,
    )}T00:00:00Z`;
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.POSITIVE_INFINITY;
}

function dedupeSequential(points) {
  if (points.length === 0) return [];
  const deduped = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const previous = deduped[deduped.length - 1];
    const distanceKm = haversineKm(
      previous.lat,
      previous.lng,
      current.lat,
      current.lng,
    );
    const hasBothTimes = previous.time !== null && current.time !== null;
    const timeGapMs = hasBothTimes
      ? Math.abs(current.time - previous.time)
      : Number.POSITIVE_INFINITY;
    const shouldDrop =
      distanceKm < MIN_DEDUPE_DISTANCE_KM &&
      (!hasBothTimes || timeGapMs < DEDUPE_TIME_WINDOW_MS);

    if (shouldDrop) continue;
    deduped.push(current);
  }

  return deduped;
}

function simplifyTrack(points, minSpacingKm, maxPoints) {
  if (points.length <= 2) return points.slice();

  const simplified = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const last = simplified[simplified.length - 1];
    const distanceKm = haversineKm(last.lat, last.lng, point.lat, point.lng);
    if (distanceKm >= minSpacingKm) {
      simplified.push(point);
    }
  }
  simplified.push(points[points.length - 1]);

  if (simplified.length <= maxPoints) {
    return simplified;
  }

  const sampled = [simplified[0]];
  const stride = Math.ceil((simplified.length - 2) / (maxPoints - 2));
  for (let i = 1; i < simplified.length - 1; i += stride) {
    sampled.push(simplified[i]);
  }
  sampled.push(simplified[simplified.length - 1]);
  return sampled;
}

function roundCoordinate(value) {
  return Number(value.toFixed(6));
}

function findNearestPointIndex(points, step, startIndex = 0) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = startIndex; i < points.length; i += 1) {
    const point = points[i];
    const distanceKm = haversineKm(step.lat, step.lng, point.lat, point.lng);
    if (distanceKm < bestDistance) {
      bestDistance = distanceKm;
      bestIndex = i;
    }
  }
  return { index: bestIndex, distanceKm: bestDistance };
}

function loadChronologicalGpxPoints() {
  const gpxFiles = walkFiles(GPS_ROOT, (fullPath) =>
    fullPath.toLowerCase().endsWith(".gpx"),
  );
  const batches = [];

  for (const gpxPath of gpxFiles) {
    const xml = readFileSync(gpxPath, "utf8");
    const points = parseGpxPoints(xml);
    if (points.length === 0) continue;
    const firstTimedPoint = points.find((point) => point.time !== null);
    const firstTimestamp =
      firstTimedPoint?.time ?? inferTimestampFromFilename(gpxPath);
    batches.push({
      filePath: gpxPath,
      firstTimestamp,
      points,
    });
  }

  batches.sort((a, b) => {
    if (a.firstTimestamp !== b.firstTimestamp) {
      return a.firstTimestamp - b.firstTimestamp;
    }
    return a.filePath.localeCompare(b.filePath);
  });

  const trackPoints = [];
  const tracePoints = [];

  for (const batch of batches) {
    for (const point of batch.points) {
      if (point.kind === "trkpt") {
        trackPoints.push(point);
      }
      if (point.kind === "trkpt" || point.kind === "rtept") {
        tracePoints.push(point);
      }
    }
  }

  const fallbackTrackPoints = trackPoints.length > 0 ? trackPoints : tracePoints;
  return {
    gpxFileCount: batches.length,
    trackPoints: fallbackTrackPoints,
    tracePoints,
  };
}

function ensureLineCoordinates(segmentPoints, fromStep, toStep) {
  if (segmentPoints.length < 2) {
    return [
      [roundCoordinate(fromStep.lng), roundCoordinate(fromStep.lat)],
      [roundCoordinate(toStep.lng), roundCoordinate(toStep.lat)],
    ];
  }

  const line = segmentPoints.map((point) => [
    roundCoordinate(point.lng),
    roundCoordinate(point.lat),
  ]);
  line[0] = [roundCoordinate(fromStep.lng), roundCoordinate(fromStep.lat)];
  line[line.length - 1] = [
    roundCoordinate(toStep.lng),
    roundCoordinate(toStep.lat),
  ];
  return line;
}

function getSegmentTransport(fromStep, toStep) {
  let transport = fromStep.transport || "drive";
  if (toStep.transport === "flight") {
    transport = "flight";
  } else if (fromStep.transport === "flight") {
    // A stop can be reached by flight and followed by overland driving.
    transport = "drive";
  }
  return transport;
}

function splitPointsByGap(points, maxDistanceKm, maxTimeGapMs) {
  if (points.length < 2) return [];
  const segments = [];
  let current = [points[0]];

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const next = points[i];
    const distanceKm = haversineKm(previous.lat, previous.lng, next.lat, next.lng);
    const hasBothTimes = previous.time !== null && next.time !== null;
    const timeGapMs = hasBothTimes
      ? Math.abs(next.time - previous.time)
      : Number.NEGATIVE_INFINITY;
    const shouldBreak =
      distanceKm > maxDistanceKm || (hasBothTimes && timeGapMs > maxTimeGapMs);

    if (shouldBreak) {
      if (current.length > 1) {
        segments.push(current);
      }
      current = [next];
      continue;
    }

    current.push(next);
  }

  if (current.length > 1) {
    segments.push(current);
  }
  return segments;
}

function simplifySegmentsToBudget(rawSegments, minSpacingKm, maxTotalPoints) {
  let spacing = minSpacingKm;
  let simplified = rawSegments;
  let totalPoints = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    simplified = rawSegments
      .map((segment) =>
        simplifyTrack(segment, spacing, Number.MAX_SAFE_INTEGER),
      )
      .filter((segment) => segment.length > 1);
    totalPoints = simplified.reduce((sum, segment) => sum + segment.length, 0);
    if (totalPoints <= maxTotalPoints || simplified.length === 0) {
      break;
    }
    spacing *= 1.25;
  }

  return { segments: simplified, spacingKm: spacing, totalPoints };
}

function buildTraceGeoJson(tracePointsRaw) {
  const tracePoints = dedupeSequential(tracePointsRaw);
  const splitSegments = splitPointsByGap(
    tracePoints,
    TRACE_BREAK_DISTANCE_KM,
    TRACE_BREAK_TIME_GAP_MS,
  );
  const simplified = simplifySegmentsToBudget(
    splitSegments,
    TRACE_MIN_SPACING_KM,
    TRACE_MAX_POINTS,
  );

  const features = simplified.segments.map((segment, index) => ({
    type: "Feature",
    properties: {
      traceSegment: index + 1,
      coordinateCount: segment.length,
    },
    geometry: {
      type: "LineString",
      coordinates: segment.map((point) => [
        roundCoordinate(point.lng),
        roundCoordinate(point.lat),
      ]),
    },
  }));

  return {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    metadata: {
      source: "archive/GPS tracks",
      rawPointCount: tracePointsRaw.length,
      dedupedPointCount: tracePoints.length,
      segmentCount: features.length,
      totalCoordinateCount: simplified.totalPoints,
      minSpacingKmUsed: Number(simplified.spacingKm.toFixed(3)),
      breakDistanceKm: TRACE_BREAK_DISTANCE_KM,
      breakTimeGapHours: TRACE_BREAK_TIME_GAP_MS / (60 * 60 * 1000),
    },
    features,
  };
}

function main() {
  const mapSteps = JSON.parse(readFileSync(MAP_STEPS_PATH, "utf8"))
    .slice()
    .sort((a, b) => a.mapOrder - b.mapOrder);

  if (mapSteps.length < 2) {
    throw new Error("Expected at least two map steps in src/data/map-steps.json");
  }

  const { gpxFileCount, trackPoints: rawTrackPoints, tracePoints: rawTracePoints } =
    loadChronologicalGpxPoints();
  if (rawTrackPoints.length === 0) {
    throw new Error("No GPX track/route points found under archive/GPS tracks");
  }

  const trackPoints = dedupeSequential(rawTrackPoints);
  const traceGeoJson = buildTraceGeoJson(rawTracePoints);

  const anchors = [];
  let searchStart = 0;
  for (const step of mapSteps) {
    const nearest = findNearestPointIndex(trackPoints, step, searchStart);
    if (nearest.index < 0) {
      throw new Error(`Unable to anchor step ${step.mapOrder} (${step.mapTitle})`);
    }
    anchors.push({
      mapOrder: step.mapOrder,
      mapTitle: step.mapTitle,
      index: nearest.index,
      distanceKm: nearest.distanceKm,
    });
    searchStart = nearest.index;
  }

  const features = [];
  for (let i = 0; i < mapSteps.length - 1; i += 1) {
    const fromStep = mapSteps[i];
    const toStep = mapSteps[i + 1];
    const fromAnchor = anchors[i];
    const toAnchor = anchors[i + 1];
    const transport = getSegmentTransport(fromStep, toStep);

    let segmentPoints = [];
    if (
      transport !== "flight" &&
      Number.isInteger(fromAnchor.index) &&
      Number.isInteger(toAnchor.index) &&
      toAnchor.index > fromAnchor.index
    ) {
      const rawSegment = trackPoints.slice(fromAnchor.index, toAnchor.index + 1);
      segmentPoints = simplifyTrack(
        rawSegment,
        SEGMENT_MIN_SPACING_KM,
        SEGMENT_MAX_POINTS,
      );
    }

    const coordinates = ensureLineCoordinates(segmentPoints, fromStep, toStep);
    features.push({
      type: "Feature",
      properties: {
        segment: i + 1,
        from: fromStep.mapTitle || fromStep.title,
        to: toStep.mapTitle || toStep.title,
        transport,
        source: transport === "flight" ? "manual" : "archive-gps",
        anchorStartDistanceKm: Number(fromAnchor.distanceKm.toFixed(3)),
        anchorEndDistanceKm: Number(toAnchor.distanceKm.toFixed(3)),
        coordinateCount: coordinates.length,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    });
  }

  const routeGeoJson = {
    type: "FeatureCollection",
    generatedAt: new Date().toISOString(),
    metadata: {
      source: "archive/GPS tracks",
      gpxFileCount,
      rawTrackPointCount: rawTrackPoints.length,
      dedupedTrackPointCount: trackPoints.length,
      segmentCount: features.length,
    },
    features,
  };

  writeFileSync(OUTPUT_ROUTE_PATH, `${JSON.stringify(routeGeoJson, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUT_TRACE_PATH, `${JSON.stringify(traceGeoJson, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${features.length} route segments to ${path.relative(
      ROOT,
      OUTPUT_ROUTE_PATH,
    )} (raw track points: ${rawTrackPoints.length}, deduped: ${trackPoints.length})`,
  );
  for (const feature of features) {
    const { segment, from, to, transport, coordinateCount } = feature.properties;
    console.log(
      `Segment ${segment}: ${from} -> ${to} (${transport}, ${coordinateCount} coords)`,
    );
  }

  const traceMeta = traceGeoJson.metadata;
  console.log(
    `Wrote trace overlay to ${path.relative(ROOT, OUTPUT_TRACE_PATH)} (${traceMeta.segmentCount} segments, ${traceMeta.totalCoordinateCount} coords, spacing ${traceMeta.minSpacingKmUsed} km)`,
  );
}

main();
