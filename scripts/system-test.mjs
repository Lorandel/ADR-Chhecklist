#!/usr/bin/env node
/**
 * System test runner (terminal) - prints exact errors.
 * Usage:
 *   npm run system-test
 * Optional:
 *   STORAGE_PROVIDER=blob|r2|auto (just affects what it tests first)
 */
import process from "node:process";
import crypto from "node:crypto";

function section(title) {
  console.log("\n" + "=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}
function ok(msg) { console.log("✅ " + msg); }
function warn(msg) { console.log("⚠️  " + msg); }
function fail(msg) { console.log("❌ " + msg); }

function envBool(name) { return !!process.env[name] && process.env[name] !== "NOT_SET"; }

const provider = (process.env.STORAGE_PROVIDER || "auto").toLowerCase();

section("Environment");
const env = {
  NEXT_PUBLIC_SUPABASE_URL: envBool("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: envBool("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: envBool("SUPABASE_SERVICE_ROLE_KEY"),
  BLOB_READ_WRITE_TOKEN: envBool("BLOB_READ_WRITE_TOKEN"),
  R2_ACCOUNT_ID: envBool("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: envBool("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: envBool("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET: envBool("R2_BUCKET"),
  R2_PUBLIC_BASE_URL: envBool("R2_PUBLIC_BASE_URL"),
  GMAIL_USER: envBool("GMAIL_USER"),
  GMAIL_APP_PASSWORD: envBool("GMAIL_APP_PASSWORD"),
};
console.table(env);

async function testBlob() {
  section("Test: Vercel Blob (write+delete)");
  if (!envBool("BLOB_READ_WRITE_TOKEN")) {
    warn("BLOB_READ_WRITE_TOKEN not set; skipping Blob test.");
    return { ok: false, skipped: true };
  }
  try {
    const { put, del } = await import("@vercel/blob");
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const name = `test/blob_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.txt`;
    const content = Buffer.from("blob system test\n" + new Date().toISOString());
    const res = await put(name, content, {
      access: "public",
      contentType: "text/plain",
      token,
    });
    ok(`PUT ok: ${res.url}`);
    await del(res.url, { token });
    ok("DELETE ok");
    return { ok: true };
  } catch (e) {
    fail(String(e?.message || e));
    if (String(e).includes("suspended")) {
      warn("Blob store appears suspended. Switch to R2 or re-enable Blob store in Vercel.");
    }
    return { ok: false, error: e };
  }
}

async function testR2() {
  section("Test: Cloudflare R2 (write+delete)");
  const needed = ["R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET","R2_PUBLIC_BASE_URL"];
  const missing = needed.filter((k) => !envBool(k));
  if (missing.length) {
    warn(`Missing env vars: ${missing.join(", ")}; skipping R2 test.`);
    return { ok: false, skipped: true };
  }
  try {
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const key = `test/r2_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.txt`;
    const body = Buffer.from("r2 system test\n" + new Date().toISOString());
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/plain",
    }));
    const url = `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    ok(`PUT ok: ${url}`);

    await client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    }));
    ok("DELETE ok");
    return { ok: true };
  } catch (e) {
    fail(String(e?.message || e));
    return { ok: false, error: e };
  }
}

async function testSupabaseAdmin() {
  section("Test: Supabase Admin (list users)");
  const needed = ["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
  const missing = needed.filter((k) => !envBool(k));
  if (missing.length) {
    warn(`Missing env vars: ${missing.join(", ")}; skipping Supabase admin test.`);
    return { ok: false, skipped: true };
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 5 });
    if (error) throw error;
    ok(`Listed users: ${data?.users?.length ?? 0}`);
    return { ok: true };
  } catch (e) {
    fail(String(e?.message || e));
    return { ok: false, error: e };
  }
}

async function testEmail() {
  section("Test: Email config (nodemailer verify)");
  if (!envBool("GMAIL_USER") || !envBool("GMAIL_APP_PASSWORD")) {
    warn("GMAIL_USER / GMAIL_APP_PASSWORD not set; skipping email test.");
    return { ok: false, skipped: true };
  }
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    await transporter.verify();
    ok("SMTP verify ok");
    return { ok: true };
  } catch (e) {
    fail(String(e?.message || e));
    return { ok: false, error: e };
  }
}

async function main() {
  const results = [];
  // Run storage tests (order based on preference)
  if (provider === "blob") {
    results.push(await testBlob());
    results.push(await testR2());
  } else if (provider === "r2") {
    results.push(await testR2());
    results.push(await testBlob());
  } else {
    // auto
    results.push(await testBlob());
    results.push(await testR2());
  }
  results.push(await testSupabaseAdmin());
  results.push(await testEmail());

  section("Summary");
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => r && r.ok === false && !r.skipped).length;
  const skipCount = results.filter((r) => r.skipped).length;
  console.log({ ok: okCount, failed: failCount, skipped: skipCount });

  if (failCount > 0) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
