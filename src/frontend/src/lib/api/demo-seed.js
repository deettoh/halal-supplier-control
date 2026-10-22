// Demo data for the in-browser backend, loaded from the project seed
// (seed.json, same file the FastAPI backend seeds its database from).
import seed from './seed.json';

export const RECOGNISED_ISSUERS = [
  ...new Set(seed.certificates.map((c) => c.issuer)),
];

// SMEs are identified by their name in the seed (materials.tenant).
const SME_KINDS = {
  'Sunrise Bakery SAMPLE': 'Bakery',
  'Crescent Caterer SAMPLE': 'Caterer',
};
export const TENANTS = [...new Set(seed.materials.map((m) => m.tenant))].map(
  (name) => ({ id: name, name, kind: SME_KINDS[name] ?? 'SME' }),
);

export const SUPPLIERS = seed.suppliers;

export const SEED_MATERIALS = seed.materials.map((m) => ({
  id: m.id,
  tenant: m.tenant,
  name: m.name,
  supplier_id: m.supplier_id,
  brand: m.approved_brand,
  manufacturer: m.approved_manufacturer,
}));

export const SEED_CERTIFICATES = seed.certificates.map((c) => ({
  id: c.id,
  supplier_id: c.supplier_id,
  issuer: c.issuer,
  cert_no: c.cert_no,
  holder_name: c.holder_name,
  expiry_date: c.expiry_date,
  scope: c.scope,
  image: c.image, // path in the backend's file store; not bundled here
  image_url: null,
  status: c.status,
}));

export const SEED_DELIVERIES = seed.deliveries;
export const SEED_ACTIVITY = seed.activity_log;

// Canned label extractions that stand in for the vision model in demo mode.
export const DEMO_LABELS = [
  // Sunrise Bakery SAMPLE
  {
    id: 'lbl-cocoa-clean',
    title: 'SilverCocoa cocoa powder',
    description: 'Clean match',
    material_id: 6,
    extraction: {
      product_name: 'Cocoa Powder',
      brand: 'SilverCocoa',
      manufacturer: 'Silver Valley Foods',
      halal_mark_present: true,
    },
  },
  {
    id: 'lbl-wheat-clean',
    title: 'GoldenMill wheat flour',
    description: 'Clean match, certificate expiring',
    material_id: 1,
    extraction: {
      product_name: 'Wheat Flour',
      brand: 'GoldenMill',
      manufacturer: 'Golden Grain Foods',
      halal_mark_present: true,
    },
  },
  {
    id: 'lbl-cocoa-sub',
    title: 'DarkBean cocoa powder',
    description: 'Brand substitution',
    material_id: 6,
    extraction: {
      product_name: 'Cocoa Powder',
      brand: 'DarkBean',
      manufacturer: 'Bean Hill Trading',
      halal_mark_present: true,
    },
  },
  {
    id: 'lbl-cake-blurry',
    title: 'Blurry label photo',
    description: 'Unreadable',
    material_id: 3,
    extraction: {
      product_name: 'Cake Flour',
      brand: null,
      manufacturer: null,
      halal_mark_present: null,
    },
  },
  {
    id: 'lbl-vanilla-timeout',
    title: 'Model timeout',
    description: 'Extraction fails',
    material_id: 7,
    extraction: null,
  },
  // Crescent Caterer SAMPLE
  {
    id: 'lbl-oil-clean',
    title: 'SilverPure vegetable oil',
    description: 'Clean match',
    material_id: 13,
    extraction: {
      product_name: 'Vegetable Oil',
      brand: 'SilverPure',
      manufacturer: 'Silver Valley Foods',
      halal_mark_present: true,
    },
  },
  {
    id: 'lbl-rice-clean',
    title: 'GoldenMill rice flour',
    description: 'Clean match, certificate expiring',
    material_id: 10,
    extraction: {
      product_name: 'Rice Flour',
      brand: 'GoldenMill',
      manufacturer: 'Golden Grain Foods',
      halal_mark_present: true,
    },
  },
  {
    id: 'lbl-coconut-sub',
    title: 'SantanKu coconut milk',
    description: 'Brand substitution',
    material_id: 14,
    extraction: {
      product_name: 'Coconut Milk',
      brand: 'SantanKu',
      manufacturer: 'Kelapa Jaya Industries',
      halal_mark_present: true,
    },
  },
];

// Display names for the simulated Orbyte login (people are demo personas;
// the seed has no users).
export const ACTORS = {
  'Sunrise Bakery SAMPLE:staff': 'Aina (Receiving Staff)',
  'Sunrise Bakery SAMPLE:supervisor': 'Encik Hafiz (Halal Supervisor)',
  'Crescent Caterer SAMPLE:staff': 'Ravi (Receiving Staff)',
  'Crescent Caterer SAMPLE:supervisor': 'Puan Salmah (Halal Supervisor)',
  ...Object.fromEntries(
    seed.suppliers.map((s) => [`${s.id}:supplier`, s.name]),
  ),
};
