import axios from "axios";

const BASE_URL =
  process.env.TRANSLOOM_API_URL ||
  // "https://localeflow-backend.onrender.com";
  "http://localhost:8000";

function makeClient(apiKey) {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 30_000,
  });
}

export async function validateKey(apiKey) {
  const client = makeClient(apiKey);
  const { data } = await client.post("/api/auth/validate-key/");
  return data; // { valid, user: {username, plan}, usage: {scans_used, scans_limit} }
}

export async function startScan(apiKey, payload) {
  const client = makeClient(apiKey);
  const { data } = await client.post("/api/scans/start/", payload);
  return data; // { scan_id, status }
}

export async function getScanResults(apiKey, scanId) {
  const client = makeClient(apiKey);
  const { data } = await client.get(`/api/scans/${scanId}/results/`);
  return data; // { status, translations, pr_url, updated_files }
}

export async function updateScanStatus(apiKey, scanId, status) {
  const client = makeClient(apiKey);
  const { data } = await client.patch(`/api/scans/${scanId}/update/`, {
    status,
  });
  return data;
}
