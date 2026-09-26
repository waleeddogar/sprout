import { test, expect } from "@playwright/test";

test("preview uses the real lesson controller without microphone or provider requests", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/**", route => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error("Preview must not request a microphone");
    };
  });
  await page.goto("/demo");
  await expect(page.getByText(/Developer preview · Synthetic answers/)).toBeVisible();
  await page.getByRole("button", { name: "Start counting together" }).click();
  await expect(page.locator('[data-scene="hello-duck"]')).toBeVisible();
  await page.getByRole("button", { name: "Try 1", exact: true }).click();
  await expect(page.locator('[data-scene="duck-friends"]')).toBeVisible();
  await page.getByRole("button", { name: "Try 2", exact: true }).click();
  await expect(page.locator('[data-scene="butterfly-garden"]')).toBeVisible();
  await page.getByRole("button", { name: "End lesson" }).click();
  await expect(page.getByRole("heading", { name: "Bye for now." })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Durable session record" })).toHaveCount(0);
  await page.getByText("Parent testing notes").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download attempt diagnostics" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report).toMatchObject({ schemaVersion: 1, mode: "synthetic_demo", ending: "parent_stop", droppedEvents: 0 });
  expect(report.events.some((event: { type: string }) => event.type === "scene.displayed")).toBe(true);
  expect(requests).toEqual([]);
});
