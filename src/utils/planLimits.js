const PLAN_LIMITS = {
  free: { devices: 1, bandwidthBytes: 5 * 1024 * 1024 * 1024 },
  pro:  { devices: 3, bandwidthBytes: Infinity },
  team: { devices: 10, bandwidthBytes: Infinity },
};

function getDeviceLimit(plan) {
  return PLAN_LIMITS[plan]?.devices ?? 1;
}

function getBandwidthLimit(plan) {
  return PLAN_LIMITS[plan]?.bandwidthBytes ?? PLAN_LIMITS.free.bandwidthBytes;
}

module.exports = { PLAN_LIMITS, getDeviceLimit, getBandwidthLimit };
