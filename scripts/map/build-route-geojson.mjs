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
const SEOUL_TRACE_BOUNDS = {
  minLat: 37.2,
  maxLat: 37.95,
  minLng: 126.55,
  maxLng: 127.4,
};
const SEOUL_TRACE_MIN_SPACING_KM = 12;
const SEOUL_TRACE_MAX_POINTS = 28;
const MANUAL_SEGMENT_GPX_OVERRIDES = {
  "Vladivostok Sea Port__Khabarovsk Biker Welcome":
    "archive/GPS tracks/Manual/20160610_russia_vladivostok_to_khabarovsk_osrm.gpx",
  "Khabarovsk Biker Welcome__Blagoveshchensk Border City":
    "archive/GPS tracks/Manual/20160612_russia_khabarovsk_to_blagoveshchensk_osrm.gpx",
  "Blagoveshchensk Border City__Trans-Siberian Memorial Stop":
    "archive/GPS tracks/Manual/20160614_russia_blagoveshchensk_to_memorial_osrm.gpx",
  "Trans-Siberian Memorial Stop__Chita Victory Park":
    "archive/GPS tracks/Manual/20160617_russia_memorial_to_chita_osrm.gpx",
  "Chita Children's Railroad__Ulan-Ude Opposite Club":
    "archive/GPS tracks/Manual/20160621_russia_chita_to_ulanude_osrm.gpx",
  "Ulan-Ude Opposite Club__Irkutsk Inturist Parking":
    "archive/GPS tracks/Manual/20160624_russia_ulanude_to_irkutsk_osrm.gpx",
  "Khuzhir, Olkhon Island__Ulaanbaatar":
    "archive/GPS tracks/Manual/20160707_mongolia_khuzhir_to_ulaanbaatar_osrm.gpx",
  "Donghae Ferry Terminal__Vladivostok Sea Port":
    "archive/GPS tracks/Manual/20160608_korea_donghae_to_vladivostok_ferry.gpx",
  "Ulaanbaatar__Orkhon Valley Camp":
    "archive/GPS tracks/Manual/20160704_mongolia_ulaanbaatar_to_orkhon_camp_osrm.gpx",
  "Orkhon Valley Camp__Mongol Els Dunes":
    "archive/GPS tracks/Manual/20160706_mongolia_orkhon_camp_to_mongol_els_osrm.gpx",
  "Mongol Els Dunes__Ulaanbaatar Return":
    "archive/GPS tracks/Manual/20160706_mongolia_mongol_els_to_ulaanbaatar_osrm.gpx",
  "Ulaanbaatar Return__Dalanzadgad Fuel Stop":
    "archive/GPS tracks/Manual/20160708_mongolia_ulaanbaatar_to_dalanzadgad_osrm.gpx",
  "Dalanzadgad Fuel Stop__Khongoryn Approach Camp":
    "archive/GPS tracks/Manual/20160709_mongolia_dalanzadgad_to_khongoryn_camp_osrm.gpx",
  "Khongoryn Approach Camp__Khongoryn Els Dunes":
    "archive/GPS tracks/Manual/20160709_mongolia_khongoryn_camp_to_els_osrm.gpx",
  "Khongoryn Els Dunes__Bayankhongor":
    "archive/GPS tracks/Manual/20160710_mongolia_khongoryn_to_bayankhongor_osrm.gpx",
  "Bayankhongor__Flooded Valley Crossing":
    "archive/GPS tracks/Manual/20160713_mongolia_bayankhongor_to_flood_crossing_osrm.gpx",
  "Flooded Valley Crossing__Altai Reunion Stop":
    "archive/GPS tracks/Manual/20160714_mongolia_flood_crossing_to_altai_osrm.gpx",
  "Altai Reunion Stop__Western Mongolia Camp":
    "archive/GPS tracks/Manual/20160714_mongolia_altai_to_western_camp_osrm.gpx",
  "Western Mongolia Camp__Tashanta Border Queue":
    "archive/GPS tracks/Manual/20160715_mongolia_western_camp_to_tashanta_osrm.gpx",
  "Tashanta Border Queue__Kosh-Agach Market Stop":
    "archive/GPS tracks/Manual/20160718_russia_tashanta_to_kosh_agach_osrm.gpx",
  "Kosh-Agach Market Stop__Barnaul Honey Stop":
    "archive/GPS tracks/Manual/20160718_russia_kosh_agach_to_barnaul_osrm.gpx",
  "Barnaul Honey Stop__Novosibirsk Host Stop":
    "archive/GPS tracks/Manual/20160720_russia_barnaul_to_novosibirsk_osrm.gpx",
  "Novosibirsk Host Stop__Ob Reservoir Camp":
    "archive/GPS tracks/Manual/20160723_russia_novosibirsk_to_ob_reservoir_camp_osrm.gpx",
  "Ob Reservoir Camp__Novosibirsk Return":
    "archive/GPS tracks/Manual/20160724_russia_ob_reservoir_camp_to_novosibirsk_osrm.gpx",
  "Novosibirsk Return__Kazakhstan Border Village":
    "archive/GPS tracks/Manual/20160730_russia_novosibirsk_to_kaz_border_village_osrm.gpx",
  "Kazakhstan Border Village__Taldykorgan Meetup":
    "archive/GPS tracks/Manual/20160801_kaz_border_village_to_taldykorgan_osrm.gpx",
  "Taldykorgan Meetup__Almaty City Camp":
    "archive/GPS tracks/Manual/20160801_taldykorgan_to_almaty_city_osrm.gpx",
  "Almaty City Camp__Big Almaty Lake Viewpoint":
    "archive/GPS tracks/Manual/20160802_almaty_city_to_big_almaty_lake_osrm.gpx",
  "Big Almaty Lake Viewpoint__Almaty Spring Stop":
    "archive/GPS tracks/Manual/20160802_big_almaty_lake_to_almaty_spring_osrm.gpx",
  "Almaty Spring Stop__Altyn Emel Park Office":
    "archive/GPS tracks/Manual/20160803_almaty_spring_to_altyn_emel_park_office_osrm.gpx",
  "Altyn Emel Park Office__Singing Dunes (Altyn Emel)":
    "archive/GPS tracks/Manual/20160806_altyn_emel_park_office_to_singing_dunes_osrm.gpx",
  "Singing Dunes (Altyn Emel)__Red Lava Sculptures":
    "archive/GPS tracks/Manual/20160806_singing_dunes_to_red_lava_sculptures_osrm.gpx",
  "Red Lava Sculptures__Aktau Mountain":
    "archive/GPS tracks/Manual/20160806_red_lava_sculptures_to_aktau_mountain_osrm.gpx",
  "Aktau Mountain__700-Year-Old Willow Tree":
    "archive/GPS tracks/Manual/20160806_aktau_mountain_to_700_year_willow_osrm.gpx",
  "700-Year-Old Willow Tree__Sharyn Canyon Rim Camp":
    "archive/GPS tracks/Manual/20160807_700_year_willow_to_sharyn_canyon_rim_osrm.gpx",
  "Sharyn Canyon Rim Camp__Djety-Oguz, Issykul":
    "archive/GPS tracks/Manual/20160807_sharyn_canyon_rim_to_djety_oguz_osrm.gpx",
  "Djety-Oguz, Issykul__Skazka (Fairy Tale) Canyon":
    "archive/GPS tracks/Manual/20160810_djety_oguz_to_skazka_canyon_osrm.gpx",
  "Skazka (Fairy Tale) Canyon__Issykul South Camp":
    "archive/GPS tracks/Manual/20160811_skazka_canyon_to_issykul_south_camp_osrm.gpx",
  "Issykul South Camp__Songkul Lakeshore Camp":
    "archive/GPS tracks/Manual/20160812_issykul_south_camp_to_songkul_lakeshore_osrm.gpx",
  "Songkul Lakeshore Camp__Bishkek Repair Stop":
    "archive/GPS tracks/Manual/20160813_songkul_lakeshore_to_bishkek_repair_stop_osrm.gpx",
  "Bishkek Repair Stop__Toktogul Reservoir Overlook":
    "archive/GPS tracks/Manual/20160816_bishkek_repair_to_toktogul_overlook_osrm.gpx",
  "Toktogul Reservoir Overlook__Osh City Stop":
    "archive/GPS tracks/Manual/20160817_toktogul_overlook_to_osh_city_stop_osrm.gpx",
  "Osh City Stop__Sary-Tash":
    "archive/GPS tracks/Manual/20160818_osh_city_to_sary_tash_osrm.gpx",
  "Sary-Tash__Peak Lenin Basecamp Valley":
    "archive/GPS tracks/Manual/20160819_sary_tash_to_peak_lenin_basecamp_osrm.gpx",
  "Peak Lenin Basecamp Valley__Osh Return":
    "archive/GPS tracks/Manual/20160819_peak_lenin_basecamp_to_osh_return_osrm.gpx",
  "Sharyn Canyon Rim Camp__Karakol Base Stay":
    "archive/GPS tracks/Manual/20160808_sharyn_canyon_to_karakol_base_osrm.gpx",
  "Karakol Base Stay__Altyn Arashan Valley Camp":
    "archive/GPS tracks/Manual/20160809_karakol_base_to_altyn_arashan_valley_osrm.gpx",
  "Altyn Arashan Valley Camp__Karakol Return":
    "archive/GPS tracks/Manual/20160810_altyn_arashan_valley_to_karakol_return_osrm.gpx",
  "Karakol Return__Djety-Oguz, Issykul":
    "archive/GPS tracks/Manual/20160810_karakol_return_to_djety_oguz_osrm.gpx",
  "Osh Return__Kazakh Steppe Camp":
    "archive/GPS tracks/Manual/20160824_osh_return_to_kaz_steppe_camp_osrm.gpx",
  "Kazakh Steppe Camp__Astana City Stay":
    "archive/GPS tracks/Manual/20160825_kaz_steppe_camp_to_astana_city_osrm.gpx",
  "Astana City Stay__Burabay (Borovoe)":
    "archive/GPS tracks/Manual/20160830_astana_city_to_burabay_osrm.gpx",
  "Burabay (Borovoe)__Kazakhstan-Russia Border Crossing":
    "archive/GPS tracks/Manual/20160901_burabay_to_kaz_rus_border_osrm.gpx",
  "Kazakhstan-Russia Border Crossing__Kurgan Transit Stop":
    "archive/GPS tracks/Manual/20160901_kaz_rus_border_to_kurgan_transit_osrm.gpx",
  "Kurgan Transit Stop__Miass Friends Home":
    "archive/GPS tracks/Manual/20160902_kurgan_transit_to_miass_friends_home_osrm.gpx",
  "Miass Friends Home__Miass Departure":
    "archive/GPS tracks/Manual/20160904_miass_friends_home_to_miass_departure_osrm.gpx",
  "Miass Departure__Kazan Family City":
    "archive/GPS tracks/Manual/20160904_miass_departure_to_kazan_family_city_osrm.gpx",
  "Kazan Family City__Nizhniy Novgorod Kremlin":
    "archive/GPS tracks/Manual/20160906_kazan_family_city_to_nizhniy_novgorod_osrm.gpx",
  "Nizhniy Novgorod Kremlin__Vladimir Historic Center":
    "archive/GPS tracks/Manual/20160908_nizhniy_novgorod_to_vladimir_historic_center_osrm.gpx",
  "Vladimir Historic Center__Suzdal Church District":
    "archive/GPS tracks/Manual/20160909_vladimir_historic_center_to_suzdal_church_district_osrm.gpx",
  "Suzdal Church District__Moscow Dacha Welcome":
    "archive/GPS tracks/Manual/20160910_suzdal_to_moscow_dacha_welcome_osrm.gpx",
  "Moscow Dacha Welcome__Dad Apartment Parking":
    "archive/GPS tracks/Manual/20160911_moscow_dacha_welcome_to_dad_apartment_parking_osrm.gpx",
  "Dad Apartment Parking__Red Square Meet-up":
    "archive/GPS tracks/Manual/20160912_dad_apartment_parking_to_red_square_meetup_osrm.gpx",
  "Red Square Meet-up__Moscow Home Base":
    "archive/GPS tracks/Manual/20161013_red_square_meetup_to_moscow_home_base_osrm.gpx",
  "Moscow Home Base__Vnukovo Airport Departure":
    "archive/GPS tracks/Manual/20161020_moscow_home_base_to_vnukovo_airport_departure_osrm.gpx",
  "Beijing Smog Arrival__Beijing Summer Palace":
    "archive/GPS tracks/Manual/20161110_beijing_smog_arrival_to_summer_palace_osrm.gpx",
  "Beijing Summer Palace__Tiantan Temple of Heaven":
    "archive/GPS tracks/Manual/20161111_summer_palace_to_tiantan_temple_osrm.gpx",
  "Tiantan Temple of Heaven__Mutianyu Great Wall":
    "archive/GPS tracks/Manual/20161114_tiantan_temple_to_mutianyu_great_wall_osrm.gpx",
  "Mumbai Fort Area__Gateway Ferry Jetty":
    "archive/GPS tracks/Manual/20161110_mumbai_fort_area_to_gateway_ferry_jetty_osrm.gpx",
  "Gateway Ferry Jetty__Elephanta Island and Caves":
    "archive/GPS tracks/Manual/20161112_gateway_ferry_jetty_to_elephanta_island_ferry.gpx",
  "Elephanta Island and Caves__Udaipur Railway Station Arrival":
    "archive/GPS tracks/Manual/20161112_elephanta_island_to_udaipur_railway_station_osrm.gpx",
  "Udaipur Railway Station Arrival__Jagdish Temple, Udaipur":
    "archive/GPS tracks/Manual/20161113_udaipur_railway_station_to_jagdish_temple_osrm.gpx",
  "Jagdish Temple, Udaipur__Natraj Dining Hall":
    "archive/GPS tracks/Manual/20161113_jagdish_temple_to_natraj_dining_hall_osrm.gpx",
  "Natraj Dining Hall__Jaisalmer Fort":
    "archive/GPS tracks/Manual/20161115_natraj_dining_hall_to_jaisalmer_osrm.gpx",
  "Jaisalmer Fort__Nathmal Haveli Quarter":
    "archive/GPS tracks/Manual/20161116_jaisalmer_fort_to_nathmal_haveli_osrm.gpx",
  "Nathmal Haveli Quarter__Sunset Viewpoint, Jaisalmer":
    "archive/GPS tracks/Manual/20161116_nathmal_haveli_to_sunset_viewpoint_osrm.gpx",
  "Sunset Viewpoint, Jaisalmer__Thar Desert Camp":
    "archive/GPS tracks/Manual/20161116_sunset_viewpoint_to_thar_desert_camp_osrm.gpx",
  "Thar Desert Camp__Bada Bagh Ruins":
    "archive/GPS tracks/Manual/20161117_thar_desert_camp_to_bada_bagh_osrm.gpx",
  "Bada Bagh Ruins__Gadii Sagar Lake":
    "archive/GPS tracks/Manual/20161117_bada_bagh_to_gadii_sagar_osrm.gpx",
  "Seoul__Busan Port":
    "archive/GPS tracks/Manual/20160531_korea_seoul_to_busan_port_osrm.gpx",
  "Busan Port__Busan Customs Office":
    "archive/GPS tracks/Manual/20160601_korea_busan_port_to_customs_office_osrm.gpx",
  "Busan Customs Office__Nangman Mountain Camp":
    "archive/GPS tracks/Manual/20160605_korea_busan_customs_to_nangman_camp_osrm.gpx",
  "Nangman Mountain Camp__Busan Ferry Terminal":
    "archive/GPS tracks/Manual/20160612_korea_nangman_camp_to_busan_ferry_terminal_osrm.gpx",
  "Busan Ferry Terminal__Seoul Departure":
    "archive/GPS tracks/Manual/20160617_korea_busan_ferry_terminal_to_seoul_departure_osrm.gpx",
  "Seoul Departure__Donghae Ferry Terminal":
    "archive/GPS tracks/Manual/20160618_korea_seoul_departure_to_donghae_ferry_terminal_osrm.gpx",
};
const MANUAL_SEGMENT_NO_SIMPLIFY = new Set([
  // Preserve the exact path so this leg visibly goes through Shimanovsk and Magdagachi.
  "Blagoveshchensk Border City__Trans-Siberian Memorial Stop",
  // Keep urban detail for this short Mumbai segment.
  "Mumbai Fort Area__Gateway Ferry Jetty",
  // Keep the recorded ferry shape from phone track.
  "Gateway Ferry Jetty__Elephanta Island and Caves",
  // Preserve intra-city shape in Udaipur.
  "Udaipur Railway Station Arrival__Jagdish Temple, Udaipur",
  "Jagdish Temple, Udaipur__Natraj Dining Hall",
  // Preserve short city segments in Jaisalmer.
  "Jaisalmer Fort__Nathmal Haveli Quarter",
  "Nathmal Haveli Quarter__Sunset Viewpoint, Jaisalmer",
  // Keep this tiny port hop from simplifying down to one point.
  "Busan Port__Busan Customs Office",
]);
const MANUAL_SEGMENT_NO_DEDUPE = new Set([
  // Preserve both endpoints for this short in-port move.
  "Busan Port__Busan Customs Office",
]);

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

function buildSegmentKey(fromStep, toStep) {
  const fromLabel = fromStep.mapTitle || fromStep.title || "";
  const toLabel = toStep.mapTitle || toStep.title || "";
  return `${fromLabel}__${toLabel}`;
}

function loadManualSegmentOverrides() {
  const loaded = new Map();
  for (const [key, relativePath] of Object.entries(MANUAL_SEGMENT_GPX_OVERRIDES)) {
    const fullPath = path.join(ROOT, relativePath);
    try {
      const xml = readFileSync(fullPath, "utf8");
      const points = parseGpxPoints(xml).filter(
        (point) => point.kind === "trkpt" || point.kind === "rtept",
      );
      const shouldBypassSimplification = MANUAL_SEGMENT_NO_SIMPLIFY.has(key);
      const shouldBypassDedupe = MANUAL_SEGMENT_NO_DEDUPE.has(key);
      const deduped = shouldBypassDedupe ? points : dedupeSequential(points);
      const segmentPoints = shouldBypassSimplification
        ? deduped
        : simplifyTrack(
            deduped,
            SEGMENT_MIN_SPACING_KM,
            SEGMENT_MAX_POINTS,
          );
      if (segmentPoints.length > 1) {
        loaded.set(key, segmentPoints);
      } else {
        console.warn(`Manual segment override is too short: ${relativePath}`);
      }
    } catch (error) {
      console.warn(
        `Unable to load manual segment override ${relativePath}: ${error.message}`,
      );
    }
  }
  return loaded;
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

function loadChronologicalGpxPoints(options = {}) {
  const manualOnly = options.manualOnly === true;
  const gpxFiles = walkFiles(GPS_ROOT, (fullPath) =>
    fullPath.toLowerCase().endsWith(".gpx") &&
    (!manualOnly ||
      fullPath.toLowerCase().includes(`${path.sep}manual${path.sep}`)),
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

function segmentIntersectsBounds(segment, bounds) {
  for (const point of segment) {
    if (
      point.lat >= bounds.minLat &&
      point.lat <= bounds.maxLat &&
      point.lng >= bounds.minLng &&
      point.lng <= bounds.maxLng
    ) {
      return true;
    }
  }
  return false;
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
  const cityCleanedSegments = splitSegments.map((segment) => {
    if (!segmentIntersectsBounds(segment, SEOUL_TRACE_BOUNDS)) {
      return segment;
    }
    // The Seoul metro archive logs are extremely dense and create noisy spaghetti on globe view.
    // Compress those clusters aggressively while keeping the broad travel shape.
    return simplifyTrack(
      segment,
      SEOUL_TRACE_MIN_SPACING_KM,
      SEOUL_TRACE_MAX_POINTS,
    );
  });
  const simplified = simplifySegmentsToBudget(
    cityCleanedSegments,
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
    loadChronologicalGpxPoints({ manualOnly: true });
  if (rawTrackPoints.length === 0) {
    throw new Error("No manual GPX track/route points found under archive/GPS tracks/Manual");
  }

  const trackPoints = dedupeSequential(rawTrackPoints);
  const traceGeoJson = buildTraceGeoJson(rawTracePoints);
  const manualSegmentOverrides = loadManualSegmentOverrides();

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
    const segmentKey = buildSegmentKey(fromStep, toStep);

    let segmentPoints = [];
    let source = transport === "flight" ? "manual" : "archive-gps";
    const manualOverridePoints = manualSegmentOverrides.get(segmentKey);

    if (transport !== "flight" && Array.isArray(manualOverridePoints)) {
      segmentPoints = manualOverridePoints;
      source = "manual-osrm";
    } else if (
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
        source,
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
      source: "archive/GPS tracks/Manual",
      gpxFileCount,
      rawTrackPointCount: rawTrackPoints.length,
      dedupedTrackPointCount: trackPoints.length,
      manualOverrideCount: manualSegmentOverrides.size,
      segmentCount: features.length,
      mode: "manual-gpx + manual-osrm-overrides",
    },
    features,
  };

  writeFileSync(OUTPUT_ROUTE_PATH, `${JSON.stringify(routeGeoJson, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUT_TRACE_PATH, `${JSON.stringify(traceGeoJson, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${features.length} route segments to ${path.relative(
      ROOT,
      OUTPUT_ROUTE_PATH,
    )} (mode: manual-gpx + manual-osrm-overrides, raw points: ${rawTrackPoints.length}, deduped: ${trackPoints.length})`,
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
