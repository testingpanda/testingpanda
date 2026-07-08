// End-to-end smoke test against a running dev server. Not part of the CI test
// suite (that's tests/*.test.ts) — this exercises the real HTTP API wiring.
const BASE = "http://localhost:3000";
let cookies = {};

function updateCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean);
  for (const c of raw) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    cookies[k] = v;
  }
}

function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(method, path, body, isForm = false) {
  const headers = { cookie: cookieHeader() };
  if (!isForm && body) headers["content-type"] = "application/json";
  if (cookies["gtx_csrf"] && method !== "GET") headers["x-csrf-token"] = cookies["gtx_csrf"];
  const res = await fetch(BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  updateCookies(res);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("json") ? await res.json().catch(() => null) : await res.arrayBuffer();
  if (!res.ok) {
    console.error(`FAIL ${method} ${path} -> ${res.status}`, data);
    process.exit(1);
  }
  console.log(`OK   ${method} ${path} -> ${res.status}`);
  return data;
}

async function main() {
  // prime CSRF cookie
  await req("GET", "/login");

  const email = `smoketest-${Date.now()}@example.com`;
  await req("POST", "/api/auth/register", { email, password: "SmokeTest123!", name: "Smoke Test" });

  const { taxCase } = await req("POST", "/api/cases", { taxYear: 2025, canton: "GE" });
  console.log("Created case", taxCase.id);

  const formData = new FormData();
  formData.append("classification", "SalaryCertificate");
  formData.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4\n%dummy\nCERTIFICAT DE SALAIRE 2025\nSalaire brut: CHF 90'000.00\n")], { type: "application/pdf" }),
    "salary.pdf"
  );
  const { document } = await req("POST", `/api/cases/${taxCase.id}/documents`, formData, true);
  console.log("Uploaded document", document.id, document.status);

  const { issues, gate } = await req("GET", `/api/cases/${taxCase.id}/validation`);
  console.log("Validation issues:", issues.length, "canGenerate:", gate.canGenerate);

  const { sections } = await req("GET", `/api/cases/${taxCase.id}/sections`);
  let confirmedCount = 0;
  for (const section of sections) {
    if (section.items.length === 0) {
      await req("POST", `/api/cases/${taxCase.id}/sections/${section.id}/resolve-empty`, { action: "NOT_APPLICABLE" });
      confirmedCount++;
      continue;
    }
    for (const item of section.items) {
      await req("POST", `/api/tax-field-mappings/${item.id}/confirm`, { action: "CONFIRM" });
      confirmedCount++;
    }
  }
  console.log("Confirmed/resolved", confirmedCount, "declaration section items");

  const { fields } = await req("GET", `/api/cases/${taxCase.id}/extracted-fields`);
  for (const field of fields) {
    if (field.status === "unresolved" || field.status === "extracted" || field.status === "needs_review") {
      await req("POST", `/api/extracted-fields/${field.id}/confirm`, { action: field.value === null ? "MARK_MISSING" : "CONFIRM" });
    }
  }

  const missing = await req("GET", `/api/cases/${taxCase.id}/missing-documents`);
  for (const m of missing.missingDocuments) {
    await req("PATCH", `/api/missing-documents/${m.id}`, { status: "MARKED_NOT_APPLICABLE" });
  }

  const finalGate = await req("GET", `/api/cases/${taxCase.id}/validation`);
  console.log("Final gate canGenerate:", finalGate.gate.canGenerate, finalGate.gate.blockingReasons);

  if (!finalGate.gate.canGenerate) {
    console.error("Gate did not clear — cannot proceed to generation in smoke test.");
    process.exit(1);
  }

  await req("POST", `/api/cases/${taxCase.id}/final-declaration`, {
    reviewedAllValues: true,
    understandsNotCertifiedAdvice: true,
    remainsResponsible: true,
    confirmsComplete: true,
    wantsToGenerate: true,
  });

  const { result } = await req("POST", `/api/cases/${taxCase.id}/generate`, {});
  console.log("Generated package, fill method:", result.fillMethod);

  const { token } = await req("GET", `/api/cases/${taxCase.id}/download-token`);
  const zipRes = await fetch(`${BASE}/api/download?token=${encodeURIComponent(token)}`, { headers: { cookie: cookieHeader() } });
  console.log("Download status:", zipRes.status, "content-type:", zipRes.headers.get("content-type"));
  const buf = Buffer.from(await zipRes.arrayBuffer());
  console.log("Downloaded zip size:", buf.length, "bytes; starts with PK:", buf.subarray(0, 2).toString() === "PK");

  await req("DELETE", `/api/cases/${taxCase.id}`);
  console.log("\nSMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
