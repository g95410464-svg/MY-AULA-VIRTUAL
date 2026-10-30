import { test, expect } from "@playwright/test";

test("jerarquía visible para los cuatro perfiles sin ampliar sus permisos", async ({
  page,
}) => {
  const profiles = [
    ["admin", "Administrador", 4],
    ["coordinador", "Coordinador", 3],
    ["maestro", "Maestro", 2],
    ["alumno", "Alumno", 1],
  ] as const;
  for (const [who, label, level] of profiles) {
    await page.goto("/");
    await page.getByLabel("Correo electrónico").fill(`${who}@aula.test`);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Entrar a mi aula" }).click();
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
    await page
      .getByRole("button", { name: "Jerarquía y permisos", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Jerarquía institucional",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(`Nivel ${level}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table").getByRole("columnheader")).toHaveCount(
      5,
    );
    await expect(page.locator("tbody tr")).toHaveCount(13);
    await expect(
      page.getByText(`Rol principal: ${label}`, { exact: true }),
    ).toBeVisible();
    const model = await (await page.request.get("/api/access-model")).json();
    expect(model.current.organizationLevel).toBe(level);
    if (who === "admin" || who === "coordinador")
      expect((await page.request.get("/api/courses/1/tasks")).status()).toBe(
        403,
      );
    if (who === "admin") {
      await page.getByRole("button", { name: "Activar modo oscuro" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.screenshot({
        path: "../evidence/hierarchy-dark.png",
        fullPage: true,
      });
    }
    if (who === "alumno") {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "../evidence/hierarchy-mobile.png",
        fullPage: true,
      });
    }
    // Restore desktop so the shared navigation remains available for logout.
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar a mi aula" }),
    ).toBeVisible();
  }
});
