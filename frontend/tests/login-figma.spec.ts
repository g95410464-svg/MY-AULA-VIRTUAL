import { test, expect } from "@playwright/test";

test("acceso Figma: composición de escritorio y acceso institucional", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1728, height: 1140 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu Aula Virtual" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const art = page.locator(".fl-art img");
  await expect(art).toBeVisible();
  expect(await art.boundingBox()).toEqual({
    x: 880,
    y: 32,
    width: 816,
    height: 1076,
  });
  const assets = await page.locator(".figma-login img").evaluateAll((images) =>
    images.map((node) => {
      const image = node as HTMLImageElement;
      const bounds = image.getBoundingClientRect();
      return {
        src: image.currentSrc,
        valid: image.complete && image.naturalWidth > 0,
        width: bounds.width,
        height: bounds.height,
      };
    }),
  );
  expect(assets.every((asset) => asset.valid)).toBe(true);
  await expect(
    page.getByRole("button", { name: /Google|Facebook/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../evidence/figma-login-desktop.png",
    fullPage: true,
  });
});

test("acceso Figma: composición móvil y ayudas de acceso", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu Aula Virtual" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator(".fl-art img").boundingBox()).toEqual({
    x: 24,
    y: 24,
    width: 342,
    height: 180,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Solicita al administrador/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Solicita acceso" }).click();
  await expect(
    page.getByRole("heading", { name: "Únete a Tu Aula Virtual" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendido" }).click();
  await page.screenshot({
    path: "../evidence/figma-login-mobile.png",
    fullPage: true,
  });
});
