import { geocodeQuery } from './geocode.js';
import { haversineMiles, boundingBox } from './distance.js';

const RADIUS_STEPS_MILES = [10, 25, 50];
const MAX_RESULTS = 10;

// Only this status is ever shown to supporters as a seller to contact.
// authorised_chain / candidate / inactive rows exist in D1 for internal
// tracking but must never reach the public endpoint — see the campaign's
// core data principle: chain-level authorisation is not branch-level proof.
const PUBLIC_VERIFICATION_STATUS = 'verified_branch';

async function queryCandidates(db, box, country) {
  // Scoped by country as well as the bounding box — a UK postcode search
  // must never surface an Ireland branch (or vice versa) even if a bounding
  // box technically overlaps near the border/coastline, since a "10 miles
  // away" claim across the Irish Sea would be nonsense and the two
  // geocoders aren't on a shared precision footing anyway.
  const { results } = await db
    .prepare(
      `SELECT * FROM stockists
       WHERE verification_status = ?
         AND country = ?
         AND latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?`
    )
    .bind(PUBLIC_VERIFICATION_STATUS, country, box.minLat, box.maxLat, box.minLon, box.maxLon)
    .all();
  return results;
}

function shapeResult(row, distanceMiles) {
  return {
    id: row.id,
    chain: {
      name: row.chain_name,
      slug: row.chain_id,
      category: row.category,
    },
    branchName: row.branch_name,
    location: {
      address: [row.address_line_1, row.address_line_2].filter(Boolean).join(', '),
      city: row.city,
      postcode: row.postcode,
      country: row.country,
      coordinates: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
    },
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    contact: {
      type: row.contact_type || null,
      value: row.contact_value || null,
      url: row.contact_url || null,
      phone: row.phone_number || null,
    },
    verification: {
      status: row.verification_status,
      method: row.verification_method,
      sourceUrl: row.source_url,
      sourceLabel: row.source_label || null,
      lastVerifiedAt: row.last_verified_at,
    },
  };
}

export async function handleStockistsRequest(url, env) {
  // Param name kept as `postcode` for backward compatibility with the
  // frontend and any existing links, even though it now also accepts an
  // Ireland town/city name — see geocodeQuery() in geocode.js for how the
  // two are told apart.
  const rawQuery = url.searchParams.get('postcode');
  if (!rawQuery) {
    return { status: 400, body: { error: 'missing_postcode', message: "Enter a postcode (UK) or town/city (Ireland) to search." } };
  }

  const geo = await geocodeQuery(rawQuery, env);

  if (geo.error === 'eircode_not_supported') {
    return {
      status: 200,
      body: {
        postcode: rawQuery,
        results: [],
        reason: 'eircode_not_supported',
        message: "We can't yet search by exact Eircode — try your town or city name instead (e.g. \"Dublin\" or \"Cork\").",
      },
    };
  }
  if (geo.error === 'invalid_format' || geo.error === 'not_found') {
    return {
      status: 200,
      body: {
        postcode: rawQuery,
        results: [],
        reason: 'invalid_postcode',
        message: "We couldn't recognise that as a UK postcode or an Ireland town/city. Check it and try again.",
      },
    };
  }
  if (geo.error === 'geocoder_unavailable') {
    // Fail gracefully: the rest of the campaign site must keep working even
    // if the postcode lookup is temporarily down.
    return {
      status: 200,
      body: {
        postcode: rawQuery,
        results: [],
        reason: 'lookup_unavailable',
        message: 'The postcode lookup is temporarily unavailable — please try again shortly, or use the national retailer/optician actions below in the meantime.',
      },
    };
  }

  const { latitude, longitude } = geo.coords;
  let matches = [];
  let radiusUsed = null;

  for (const radiusMiles of RADIUS_STEPS_MILES) {
    const box = boundingBox(latitude, longitude, radiusMiles);
    const candidates = await queryCandidates(env.DB, box, geo.country);
    const withinRadius = candidates
      .map((row) => ({ row, distanceMiles: haversineMiles(latitude, longitude, row.latitude, row.longitude) }))
      .filter((c) => c.distanceMiles <= radiusMiles);

    if (withinRadius.length > 0) {
      matches = withinRadius;
      radiusUsed = radiusMiles;
      break;
    }
  }

  matches.sort((a, b) => a.distanceMiles - b.distanceMiles);
  const results = matches.slice(0, MAX_RESULTS).map((m) => shapeResult(m.row, m.distanceMiles));

  return {
    status: 200,
    body: {
      postcode: geo.normalized,
      country: geo.country,
      radiusMiles: radiusUsed,
      results,
      reason: results.length === 0 ? 'no_results' : null,
      message: results.length === 0 ? "We haven't verified a Meta Ray-Ban seller near this postcode yet." : null,
    },
  };
}
