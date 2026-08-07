import { test, expect } from "@playwright/test";

test("explicit save survives navigation and reload", async ({ page }) => {
  await page.goto("./#/interviews/new");
  await page.getByLabel(/Job title/).fill("Persistence test role");
  await page.getByRole("spinbutton", { name: "Questions" }).fill("1");
  await page.getByRole("button", { name: "Review devices and start" }).click();
  await page.getByRole("button", { name: "Begin practice" }).click();
  await page.getByRole("button", { name: "Start preparation" }).click();
  await page.getByRole("button", { name: "Start answer now" }).click();
  await page
    .getByLabel("Answer text")
    .fill(
      "I investigated a difficult issue, documented the evidence, and explained the result clearly to the client.",
    );
  await page.getByRole("button", { name: "Finish answer" }).click();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Answer saved on this device.")).toBeVisible();
  await page.getByRole("link", { name: "Saved" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved sessions" }),
  ).toBeVisible();
  await expect(page.getByText("Persistence test role")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Persistence test role")).toBeVisible();
});
