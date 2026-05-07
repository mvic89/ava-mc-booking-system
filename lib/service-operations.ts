export interface ServiceOperation {
  id:       string;
  name:     string;   // primary display name (Swedish)
  nameEn:   string;   // English alias — searched but not displayed
  category: string;
}

export const SERVICE_OPERATIONS: ServiceOperation[] = [
  // ── Motor / Engine ──────────────────────────────────────────────────────────
  { id: 'oil-change',     name: 'Oljebyte',                    nameEn: 'Oil change',                   category: 'Motor' },
  { id: 'oil-filter',     name: 'Oljefiltersbyte',             nameEn: 'Oil filter replacement',        category: 'Motor' },
  { id: 'spark-plug',     name: 'Tändstiftsbyte',              nameEn: 'Spark plug replacement',        category: 'Motor' },
  { id: 'air-filter',     name: 'Luftfiltersbyte',             nameEn: 'Air filter replacement',        category: 'Motor' },
  { id: 'valve-adj',      name: 'Ventiljustering',             nameEn: 'Valve adjustment',              category: 'Motor' },
  { id: 'coolant',        name: 'Kylvätskebyte',               nameEn: 'Coolant change',                category: 'Motor' },
  { id: 'fuel-filter',    name: 'Bränslefiltersbyte',          nameEn: 'Fuel filter replacement',       category: 'Motor' },
  { id: 'carb-clean',     name: 'Förgasarrengöring',           nameEn: 'Carburetor cleaning',           category: 'Motor' },
  { id: 'fi-service',     name: 'Bränsleinsprutning service',  nameEn: 'Fuel injection service',        category: 'Motor' },
  { id: 'throttle-body',  name: 'Strypkropp rengöring',        nameEn: 'Throttle body cleaning',        category: 'Motor' },
  { id: 'timing-belt',    name: 'Kamremsservice',              nameEn: 'Timing belt service',           category: 'Motor' },
  { id: 'gasket',         name: 'Packningsarbete',             nameEn: 'Gasket work',                   category: 'Motor' },

  // ── Bromsar / Brakes ────────────────────────────────────────────────────────
  { id: 'brake-pad-f',    name: 'Bromsbelägg fram',            nameEn: 'Front brake pads',              category: 'Bromsar' },
  { id: 'brake-pad-r',    name: 'Bromsbelägg bak',             nameEn: 'Rear brake pads',               category: 'Bromsar' },
  { id: 'brake-pad-both', name: 'Bromsbelägg fram & bak',      nameEn: 'Front & rear brake pads',       category: 'Bromsar' },
  { id: 'brake-fluid',    name: 'Bromsvätskebyte',             nameEn: 'Brake fluid change',             category: 'Bromsar' },
  { id: 'brake-disc-f',   name: 'Bromsskiva fram',             nameEn: 'Front brake disc replacement',  category: 'Bromsar' },
  { id: 'brake-disc-r',   name: 'Bromsskiva bak',              nameEn: 'Rear brake disc replacement',   category: 'Bromsar' },
  { id: 'brake-caliper',  name: 'Bromsok service',             nameEn: 'Brake caliper service',         category: 'Bromsar' },

  // ── Däck / Tyres ────────────────────────────────────────────────────────────
  { id: 'tire-f',         name: 'Däckbyte fram',               nameEn: 'Front tyre change',             category: 'Däck' },
  { id: 'tire-r',         name: 'Däckbyte bak',                nameEn: 'Rear tyre change',              category: 'Däck' },
  { id: 'tire-both',      name: 'Däckbyte, båda',              nameEn: 'Both tyres change',             category: 'Däck' },
  { id: 'wheel-balance',  name: 'Hjulbalansering',             nameEn: 'Wheel balancing',               category: 'Däck' },
  { id: 'wheel-bearing-f',name: 'Hjullager fram',              nameEn: 'Front wheel bearing',           category: 'Däck' },
  { id: 'wheel-bearing-r',name: 'Hjullager bak',               nameEn: 'Rear wheel bearing',            category: 'Däck' },

  // ── Drivlina / Drivetrain ────────────────────────────────────────────────────
  { id: 'chain-lube',     name: 'Kedjesmörjning',              nameEn: 'Chain lubrication',             category: 'Drivlina' },
  { id: 'chain-adj',      name: 'Kedjejustering',              nameEn: 'Chain adjustment',              category: 'Drivlina' },
  { id: 'chain-replace',  name: 'Kedjebyte',                   nameEn: 'Chain replacement',             category: 'Drivlina' },
  { id: 'sprocket-chain', name: 'Drev & kedja',                nameEn: 'Sprocket & chain kit',          category: 'Drivlina' },
  { id: 'clutch-adj',     name: 'Kopplingsajustering',         nameEn: 'Clutch adjustment',             category: 'Drivlina' },
  { id: 'clutch-service', name: 'Kopplingsservice',            nameEn: 'Clutch service',                category: 'Drivlina' },
  { id: 'clutch-replace', name: 'Kopplingsbyte',               nameEn: 'Clutch replacement',            category: 'Drivlina' },
  { id: 'belt-drive',     name: 'Drivremsbyte',                nameEn: 'Drive belt replacement',        category: 'Drivlina' },
  { id: 'shaft-drive',    name: 'Kardanaxelservice',           nameEn: 'Shaft drive service',           category: 'Drivlina' },

  // ── Fjädring / Suspension ────────────────────────────────────────────────────
  { id: 'fork-oil',       name: 'Gaffelolja',                  nameEn: 'Fork oil change',               category: 'Fjädring' },
  { id: 'fork-service',   name: 'Gaffelservice',               nameEn: 'Fork service / rebuild',        category: 'Fjädring' },
  { id: 'fork-seal',      name: 'Gaffeltätningsbyte',          nameEn: 'Fork seal replacement',         category: 'Fjädring' },
  { id: 'shock-service',  name: 'Dämpare service',             nameEn: 'Shock absorber service',        category: 'Fjädring' },
  { id: 'steering-head',  name: 'Styrlager service',           nameEn: 'Steering head bearing',         category: 'Fjädring' },

  // ── El / Electrical ─────────────────────────────────────────────────────────
  { id: 'battery',        name: 'Batteribyte',                 nameEn: 'Battery replacement',           category: 'El' },
  { id: 'diagnostics',    name: 'Felkodsläsning',              nameEn: 'Error code diagnostics',        category: 'El' },
  { id: 'lighting',       name: 'Belysningsservice',           nameEn: 'Lighting / bulb service',       category: 'El' },
  { id: 'wiring',         name: 'Kabelarbete',                 nameEn: 'Wiring / electrical repair',    category: 'El' },
  { id: 'abs-service',    name: 'ABS-service',                 nameEn: 'ABS service',                   category: 'El' },
  { id: 'ecu-flash',      name: 'ECU-programmering',           nameEn: 'ECU flashing / programming',    category: 'El' },

  // ── Kontroll & Service ───────────────────────────────────────────────────────
  { id: 'a-service',      name: 'A-service',                   nameEn: 'A-service',                     category: 'Service' },
  { id: 'b-service',      name: 'B-service',                   nameEn: 'B-service',                     category: 'Service' },
  { id: 'c-service',      name: 'C-service',                   nameEn: 'C-service',                     category: 'Service' },
  { id: 'seasonal',       name: 'Säsongskontroll',             nameEn: 'Seasonal inspection',           category: 'Service' },
  { id: 'mot-prep',       name: 'Besiktningsförberedelse',     nameEn: 'MOT preparation',               category: 'Service' },
  { id: 'new-delivery',   name: 'Nybesiktning / PDI',          nameEn: 'Pre-delivery inspection (PDI)', category: 'Service' },
  { id: 'throttle-cable', name: 'Gaskabeljustering',           nameEn: 'Throttle cable adjustment',     category: 'Service' },
  { id: 'idle-adj',       name: 'Tomgångsjustering',           nameEn: 'Idle adjustment',               category: 'Service' },

  // ── Övrigt / Other ───────────────────────────────────────────────────────────
  { id: 'storage-in',     name: 'Inlagring',                   nameEn: 'Winter storage (in)',           category: 'Övrigt' },
  { id: 'storage-out',    name: 'Utlagring',                   nameEn: 'Spring storage (out)',          category: 'Övrigt' },
  { id: 'wash',           name: 'Tvätt & rengöring',           nameEn: 'Wash & cleaning',               category: 'Övrigt' },
  { id: 'recall',         name: 'Återkallelse',                nameEn: 'Recall service',                category: 'Övrigt' },
  { id: 'warranty',       name: 'Garantiarbete',               nameEn: 'Warranty work',                 category: 'Övrigt' },
  { id: 'accessories',    name: 'Tillbehörsmontage',           nameEn: 'Accessories fitting',           category: 'Övrigt' },
  { id: 'road-test',      name: 'Provkörning',                 nameEn: 'Road test',                     category: 'Övrigt' },
];

export function searchOperations(query: string): ServiceOperation[] {
  const q = query.toLowerCase().trim();
  if (!q) return SERVICE_OPERATIONS;
  return SERVICE_OPERATIONS.filter(op =>
    op.name.toLowerCase().includes(q) ||
    op.nameEn.toLowerCase().includes(q) ||
    op.category.toLowerCase().includes(q)
  );
}
