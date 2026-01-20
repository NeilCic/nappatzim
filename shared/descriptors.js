// Shared climb descriptors used across backend and mobile.
// Single source of truth to keep validation, UI options, and test data in sync.

export const DESCRIPTORS = [
  "reachy",
  "balance",
  "slopey",
  "crimpy",
  "slippery",
  "static",
  "technical",
  "dyno",
  "coordination",
  "explosive",
  "endurance",
  "powerful",
  "must-try",
  "dangerous",
  "overhang",
  "pockety",
  "dual-tex",
  "compression",
  "campusy",
  "shouldery",
  "slab",
  "juggy",
  "pinchy",
];

export const STYLE_BUCKETS = Object.freeze({
  POWER: "power",
  GRIP_STRENGTH: "gripStrength",
  TECHNIQUE: "technique",
  COORDINATION: "coordination",
  OTHER: "other",
});

// Buckets for high-level style categories used in insights / radar chart.
// We intentionally limit this to at most 5 buckets:
// - STYLE_BUCKETS.POWER, STYLE_BUCKETS.GRIP_STRENGTH, STYLE_BUCKETS.TECHNIQUE, STYLE_BUCKETS.COORDINATION are shown on the radar
// - STYLE_BUCKETS.OTHER is a misc bucket that is NOT visualized directly
// Each key is a descriptor; each value is one or more bucket ids.

export const DESCRIPTOR_BUCKETS = {
  // power
  explosive: [STYLE_BUCKETS.POWER],
  powerful: [STYLE_BUCKETS.POWER],
  overhang: [STYLE_BUCKETS.POWER],
  compression: [STYLE_BUCKETS.POWER],
  campusy: [STYLE_BUCKETS.POWER],
  shouldery: [STYLE_BUCKETS.POWER],
  juggy: [STYLE_BUCKETS.POWER],

  // Grip strength
  crimpy: [STYLE_BUCKETS.GRIP_STRENGTH],
  pockety: [STYLE_BUCKETS.GRIP_STRENGTH],
  pinchy: [STYLE_BUCKETS.GRIP_STRENGTH],
  slopey: [STYLE_BUCKETS.GRIP_STRENGTH],

  // Technique / footwork / subtlety
  balance: [STYLE_BUCKETS.TECHNIQUE],
  slippery: [STYLE_BUCKETS.TECHNIQUE],
  static: [STYLE_BUCKETS.TECHNIQUE],
  technical: [STYLE_BUCKETS.TECHNIQUE],
  "dual-tex": [STYLE_BUCKETS.TECHNIQUE],
  slab: [STYLE_BUCKETS.TECHNIQUE],

  // Coordination / timing
  coordination: [STYLE_BUCKETS.COORDINATION],
  dyno: [STYLE_BUCKETS.COORDINATION],

  // Misc / not directly style-related
  "must-try": [STYLE_BUCKETS.OTHER],
  dangerous: [STYLE_BUCKETS.OTHER],
  reachy: [STYLE_BUCKETS.OTHER],
  endurance: [STYLE_BUCKETS.OTHER],
};

export default DESCRIPTORS;


